import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-login',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  protected readonly i18n = inject(I18nService);
  protected readonly error = signal<string | null>(null);
  protected readonly starting = signal(false);

  // El interceptor llega aquí con reason=expired cuando la API respondió 401.
  protected readonly sessionExpired = this.route.snapshot.queryParamMap.get('reason') === 'expired';

  protected async startLogin(): Promise<void> {
    this.error.set(null);
    this.starting.set(true);
    try {
      // Si todo va bien el navegador sale hacia el proveedor; el botón queda deshabilitado mientras tanto.
      await this.auth.startLogin(this.route.snapshot.queryParamMap.get('returnUrl') ?? '/app');
    } catch (error) {
      this.starting.set(false);
      this.error.set(error instanceof Error ? error.message : 'Authentication could not start.');
    }
  }
}
