import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-auth-callback',
  imports: [RouterLink, TranslatePipe],
  template: `
    <main class="auth-callback" aria-live="polite">
      @if (error(); as message) {
        <div class="auth-callback-error">
          <p role="alert">{{ message }}</p>
          <a routerLink="/auth/login">{{ 'auth.backToLogin' | translate }}</a>
        </div>
      } @else {
        <p>{{ 'auth.finishing' | translate }}</p>
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .auth-callback {
        display: grid;
        min-height: 100vh;
        place-items: center;
        color: var(--color-muted);
      }
    `,
  ],
})
export class AuthCallback {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.finishLogin();
  }

  private async finishLogin(): Promise<void> {
    try {
      const returnUrl = await this.auth.completeLogin(this.route);
      await this.router.navigateByUrl(returnUrl);
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Authentication could not be completed.',
      );
    }
  }
}
