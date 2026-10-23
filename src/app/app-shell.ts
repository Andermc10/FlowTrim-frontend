import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ThemeService } from './core/theme/theme.service';
import { I18nService } from './core/i18n/i18n.service';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { AuthService } from './core/auth/auth.service';
import { BackToTop } from './core/ui/back-to-top/back-to-top';
import { SoundService } from './core/ui/sound/sound.service';
import { ToastHost } from './core/ui/toast/toast-host';
import { UpcomingAlertService } from './features/subscriptions/services/upcoming-alert-service';
import { QuickAdd } from './features/transactions/quick-add/quick-add';
import { QuickAddService } from './features/transactions/quick-add/quick-add.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ToastHost, BackToTop, TranslatePipe, QuickAdd],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell implements OnInit {
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly upcomingAlerts = inject(UpcomingAlertService);
  private readonly quickAdd = inject(QuickAddService);
  protected readonly sound = inject(SoundService);
  protected readonly i18n = inject(I18nService);

  protected readonly themeMode = this.theme.mode;
  protected readonly signingOut = signal(false);

  ngOnInit(): void {
    // Al entrar al workspace se avisa (una vez por sesión) de cobros vencidos o inminentes (HU-54).
    this.upcomingAlerts.checkOnce();
  }

  protected openQuickAdd(): void {
    this.quickAdd.open();
  }

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected themeIcon(): string {
    return this.themeMode() === 'dark' ? '☼' : '☾';
  }

  protected themeLabel(): string {
    return this.themeMode() === 'dark'
      ? this.i18n.translate('nav.switchToLight')
      : this.i18n.translate('nav.switchToDark');
  }

  /** Sonido de las alertas de cobro: apagado por defecto (HU-62). */
  protected toggleSound(): void {
    this.sound.setEnabled(!this.sound.enabled());
  }

  protected toggleLanguage(): void {
    this.i18n.toggleLanguage();
  }

  /** Cierra la sesión sin esperar a la red; el botón queda deshabilitado mientras el navegador sale (HU-61). */
  protected signOut(): void {
    if (this.signingOut()) {
      return;
    }
    this.signingOut.set(true);
    this.upcomingAlerts.reset();
    this.auth.logout();
  }
}
