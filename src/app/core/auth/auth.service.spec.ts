import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

describe('AuthService.completeLogin', () => {
  const authority = environment.auth.authority.replace(/\/$/, '');
  const discoveryUrl = `${authority}/.well-known/openid-configuration`;
  const tokenUrl = 'https://issuer.example.com/oauth/token';

  let service: AuthService;
  let httpMock: HttpTestingController;

  const callbackRoute = (params: Record<string, string>) =>
    ({ snapshot: { queryParamMap: convertToParamMap(params) } }) as unknown as ActivatedRoute;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('flowtrim.authorization_state', 'expected-state');
    sessionStorage.setItem('flowtrim.code_verifier', 'verifier');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    sessionStorage.clear();
    httpMock.verify();
  });

  // Resuelve el discovery y espera un ciclo del event loop para que el servicio emita la petición al token endpoint.
  async function answerDiscovery(): Promise<void> {
    httpMock.expectOne(discoveryUrl).flush({ authorization_endpoint: 'x', token_endpoint: tokenUrl });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('rejects a callback whose state does not match', async () => {
    await expect(service.completeLogin(callbackRoute({ code: 'abc', state: 'forged' })))
      .rejects.toThrow('The authentication callback could not be verified.');
  });

  it('surfaces the provider reason when the token exchange is rejected', async () => {
    const login = service.completeLogin(callbackRoute({ code: 'abc', state: 'expected-state' }));
    await answerDiscovery();

    httpMock.expectOne(tokenUrl).flush(
      { error: 'access_denied', error_description: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );

    await expect(login).rejects.toThrow('The identity provider rejected the sign-in (Unauthorized).');
    expect(sessionStorage.getItem('flowtrim.access_token')).toBeNull();
  });

  it('stores the access token and returns the safe return url on success', async () => {
    sessionStorage.setItem('flowtrim.return_url', '/app/subscriptions');
    const login = service.completeLogin(callbackRoute({ code: 'abc', state: 'expected-state' }));
    await answerDiscovery();

    httpMock.expectOne(tokenUrl).flush({ access_token: 'token-123', expires_in: 600 });

    await expect(login).resolves.toBe('/app/subscriptions');
    expect(service.getAccessToken()).toBe('token-123');
    expect(sessionStorage.getItem('flowtrim.code_verifier')).toBeNull();
  });
});
