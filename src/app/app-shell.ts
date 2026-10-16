import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly theme = inject(ThemeService);

  protected readonly themeMode = this.theme.mode;

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected themeIcon(): string {
    return this.themeMode() === 'dark' ? '☼' : '☾';
  }

  protected themeLabel(): string {
    return this.themeMode() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }
}
