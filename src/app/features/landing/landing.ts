import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { landingSample } from './landing-sample';
import { I18nService } from '../../core/i18n/i18n.service';
import { MoneyPipe } from '../../core/format/money.pipe';
import { ThemeService } from '../../core/theme/theme.service';
import { BackToTop } from '../../core/ui/back-to-top/back-to-top';
import { CategoryIcon } from '../../core/ui/icon/category-icon';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** Elemento de la cuadrícula de funciones: ícono de texto y claves de título y descripción. */
interface Feature {
  icon: string;
  key: string;
}

/**
 * Landing de FlowTrim 3.0 (EP-13 / HU-69): cuenta el ciclo diario (cuentas → registro rápido → cobros del mes →
 * "Puedes gastar hoy"), luego las suscripciones, la fórmula y los principios. Está completo sin animaciones: la capa
 * de movimiento (HU-70) solo se añade encima. Todas las cifras son datos de ejemplo etiquetados.
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, TranslatePipe, MoneyPipe, BackToTop, CategoryIcon],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  protected readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  protected readonly sample = landingSample;
  protected readonly themeMode = this.theme.mode;

  protected readonly features: readonly Feature[] = [
    { icon: '☀', key: 'today' },
    { icon: '◧', key: 'accounts' },
    { icon: '≡', key: 'transactions' },
    { icon: 'N', key: 'quickAdd' },
    { icon: '◈', key: 'categories' },
    { icon: '◫', key: 'subscriptions' },
    { icon: '◔', key: 'analytics' },
    { icon: '⇅', key: 'csv' },
    { icon: '◎', key: 'assistant' },
  ];

  protected readonly principles: readonly string[] = ['manual', 'facts', 'deterministic', 'isolated'];

  protected toggleLanguage(): void {
    this.i18n.toggleLanguage();
  }

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected themeLabel(): string {
    return this.i18n.translate(this.themeMode() === 'dark' ? 'nav.switchToLight' : 'nav.switchToDark');
  }
}
