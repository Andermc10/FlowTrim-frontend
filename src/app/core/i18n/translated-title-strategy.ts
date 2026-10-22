import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { I18nService } from './i18n.service';

/** Nombre del producto que acompaña al título de cada pantalla. */
export const appName = 'FlowTrim';

/**
 * Título de la pestaña del navegador por ruta: el `title` de cada ruta es una clave de traducción y se muestra
 * como "Pantalla · FlowTrim". Se vuelve a aplicar al cambiar de idioma, sin esperar a otra navegación.
 */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private currentKey: string | undefined;

  constructor() {
    super();
    effect(() => {
      this.i18n.language();
      this.apply();
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.currentKey = this.buildTitle(snapshot);
    this.apply();
  }

  private apply(): void {
    const key = this.currentKey;
    this.title.setTitle(key ? `${this.i18n.translate(key)} · ${appName}` : appName);
  }
}
