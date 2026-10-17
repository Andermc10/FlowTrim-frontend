import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ThemeService } from './core/theme/theme.service';
import { I18nService } from './core/i18n/i18n.service';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly themeMode = this.theme.mode;

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
    await this.auth.logout();
  }
}
