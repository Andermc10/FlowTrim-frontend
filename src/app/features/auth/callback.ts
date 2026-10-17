import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-auth-callback',
  imports: [TranslatePipe],
  template: `
    <main class="auth-callback" aria-live="polite">
      @if (error(); as message) {
        <p role="alert">{{ message }}</p>
      } @else {
        <p>{{ 'auth.finishing' | translate }}</p>
      }
    </main>
  `,
  styles: [`
    :host { display: block; }
    .auth-callback { display: grid; min-height: 100vh; place-items: center; color: var(--color-muted); }
  `],
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
      this.error.set(error instanceof Error ? error.message : 'Authentication could not be completed.');
    }
  }
}
