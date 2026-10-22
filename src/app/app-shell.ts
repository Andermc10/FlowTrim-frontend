import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ThemeService } from './core/theme/theme.service';
import { I18nService } from './core/i18n/i18n.service';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { AuthService } from './core/auth/auth.service';
import { BackToTop } from './core/ui/back-to-top/back-to-top';
import { ToastHost } from './core/ui/toast/toast-host';
import { UpcomingAlertService } from './features/subscriptions/services/upcoming-alert-service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ToastHost, BackToTop, TranslatePipe],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell implements OnInit {
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly upcomingAlerts = inject(UpcomingAlertService);
  protected readonly i18n = inject(I18nService);

  protected readonly themeMode = this.theme.mode;

  ngOnInit(): void {
    // Al entrar al workspace se avisa (una vez por sesión) de cobros vencidos o inminentes (HU-54).
    this.upcomingAlerts.checkOnce();
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

  protected toggleLanguage(): void {
    this.i18n.toggleLanguage();
  }

  protected async signOut(): Promise<void> {
    this.upcomingAlerts.reset();
    await this.auth.logout();
  }
}
