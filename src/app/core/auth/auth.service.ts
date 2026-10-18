import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { toSafeReturnUrl } from './auth-urls';

interface OpenIdConfiguration {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

const accessTokenKey = 'flowtrim.access_token';
const tokenExpiresAtKey = 'flowtrim.access_token_expires_at';
const authorizationStateKey = 'flowtrim.authorization_state';
const codeVerifierKey = 'flowtrim.code_verifier';
const returnUrlKey = 'flowtrim.return_url';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly accessTokenState = signal(this.readValidAccessToken());

  readonly isAuthenticated = computed(() => this.accessTokenState() !== null);

  async startLogin(returnUrl: string): Promise<void> {
    this.ensureProviderConfiguration();

    const discovery = await this.loadDiscovery();
    const state = this.randomUrlSafeValue();
    const verifier = this.randomUrlSafeValue(64);
    const challenge = await this.createCodeChallenge(verifier);

    sessionStorage.setItem(authorizationStateKey, state);
    sessionStorage.setItem(codeVerifierKey, verifier);
    sessionStorage.setItem(returnUrlKey, toSafeReturnUrl(returnUrl));

    const authorizationUrl = new URL(discovery.authorization_endpoint);
    authorizationUrl.search = new URLSearchParams({
      response_type: 'code',
      client_id: environment.auth.clientId,
      redirect_uri: this.redirectUri(),
      scope: environment.auth.scope,
      audience: environment.auth.audience,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();

    window.location.assign(authorizationUrl.toString());
  }

  async completeLogin(route: ActivatedRoute): Promise<string> {
    const error = route.snapshot.queryParamMap.get('error');
    if (error) {
      throw new Error('The identity provider rejected the authentication request.');
    }

    const code = route.snapshot.queryParamMap.get('code');
    const state = route.snapshot.queryParamMap.get('state');
    const expectedState = sessionStorage.getItem(authorizationStateKey);
    const verifier = sessionStorage.getItem(codeVerifierKey);

    if (!code || !state || !expectedState || state !== expectedState || !verifier) {
      throw new Error('The authentication callback could not be verified.');
    }

    const discovery = await this.loadDiscovery();
    const response = await this.exchangeCode(discovery.token_endpoint, code, verifier);

    if (!response.access_token) {
      throw new Error('The identity provider did not return an access token.');
    }

    const returnUrl = toSafeReturnUrl(sessionStorage.getItem(returnUrlKey));
    const expiresAt = Date.now() + (response.expires_in ?? 300) * 1000;
    sessionStorage.setItem(accessTokenKey, response.access_token);
    sessionStorage.setItem(tokenExpiresAtKey, String(expiresAt));
    this.clearAuthorizationState();
    this.accessTokenState.set(response.access_token);

    return returnUrl;
  }

  getAccessToken(): string | null {
    const token = this.accessTokenState();
    if (!token) {
      return null;
    }

    const expiresAt = Number(sessionStorage.getItem(tokenExpiresAtKey));
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      this.clearSession();
      return null;
    }

    return token;
  }

  clearSession(): void {
    sessionStorage.removeItem(accessTokenKey);
    sessionStorage.removeItem(tokenExpiresAtKey);
    this.accessTokenState.set(null);
  }

  /** Sesión vencida o revocada (la API respondió 401): limpia el token y ofrece volver a autenticarse. */
  expireSession(currentUrl: string): void {
    this.clearSession();
    void this.router.navigate(['/auth/login'], {
      queryParams: { returnUrl: toSafeReturnUrl(currentUrl), reason: 'expired' },
    });
  }

  /**
   * Cierra la sesión local y, si el proveedor publica `end_session_endpoint`, también la del proveedor;
   * así el siguiente inicio de sesión no reutiliza en silencio la cuenta anterior.
   */
  async logout(): Promise<void> {
    this.clearSession();

    const endSessionEndpoint = await this.findEndSessionEndpoint();
    if (!endSessionEndpoint) {
      await this.router.navigateByUrl('/');
      return;
    }

    const logoutUrl = new URL(endSessionEndpoint);
    logoutUrl.search = new URLSearchParams({
      client_id: environment.auth.clientId,
      post_logout_redirect_uri: `${window.location.origin}/`,
    }).toString();
    window.location.assign(logoutUrl.toString());
  }

  private async loadDiscovery(): Promise<OpenIdConfiguration> {
    const authority = environment.auth.authority.replace(/\/$/, '');
    return firstValueFrom(this.http.get<OpenIdConfiguration>(`${authority}/.well-known/openid-configuration`));
  }

  /**
   * Intercambia el authorization code por el access token. Si el proveedor lo rechaza, se expone su
   * motivo estándar OAuth (`error` / `error_description`), que no contiene secretos, para poder
   * diagnosticar la configuración del tenant.
   */
  private async exchangeCode(tokenEndpoint: string, code: string, verifier: string): Promise<TokenResponse> {
    try {
      return await firstValueFrom(this.http.post<TokenResponse>(
        tokenEndpoint,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: environment.auth.clientId,
          code,
          redirect_uri: this.redirectUri(),
          code_verifier: verifier,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      ));
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const reason = error.error?.error_description ?? error.error?.error ?? `HTTP ${error.status}`;
        throw new Error(`The identity provider rejected the sign-in (${reason}).`);
      }

      throw error;
    }
  }

  private async findEndSessionEndpoint(): Promise<string | null> {
    if (!environment.auth.authority) {
      return null;
    }

    try {
      return (await this.loadDiscovery()).end_session_endpoint ?? null;
    } catch {
      // Sin discovery solo se puede cerrar la sesión local, que ya se limpió.
      return null;
    }
  }

  private ensureProviderConfiguration(): void {
    if (!environment.auth.authority || !environment.auth.clientId || !environment.auth.audience) {
      throw new Error('Authentication provider configuration is missing.');
    }
  }

  private redirectUri(): string {
    return `${window.location.origin}/auth/callback`;
  }

  private readValidAccessToken(): string | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    const token = sessionStorage.getItem(accessTokenKey);
    const expiresAt = Number(sessionStorage.getItem(tokenExpiresAtKey));
    return token && Number.isFinite(expiresAt) && expiresAt > Date.now() ? token : null;
  }

  private clearAuthorizationState(): void {
    sessionStorage.removeItem(authorizationStateKey);
    sessionStorage.removeItem(codeVerifierKey);
    sessionStorage.removeItem(returnUrlKey);
  }

  private randomUrlSafeValue(byteLength = 32): string {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return this.toBase64Url(bytes);
  }

  private async createCodeChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return this.toBase64Url(new Uint8Array(digest));
  }

  private toBase64Url(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((byte) => binary += String.fromCharCode(byte));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
