import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'flowtrim-theme';

  readonly mode = signal<ThemeMode>(this.getInitialMode());

  constructor() {
    effect(() => {
      const mode = this.mode();
      this.document.documentElement.dataset['theme'] = mode;

      try {
        localStorage.setItem(this.storageKey, mode);
      } catch {
        // La preferencia visual sigue funcionando aunque el almacenamiento no esté disponible.
      }
    });
  }

  toggle(): void {
    this.mode.update((mode) => (mode === 'dark' ? 'light' : 'dark'));
  }

  private getInitialMode(): ThemeMode {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {
      // Usa la preferencia del sistema cuando localStorage no está disponible.
    }

    // matchMedia puede no existir (pruebas con jsdom, entornos sin DOM completo): se usa oscuro por defecto.
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
}
