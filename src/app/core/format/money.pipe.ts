import { Pipe, PipeTransform, inject } from '@angular/core';

import { I18nService } from '../i18n/i18n.service';
import { localeFor, moneyFormatter } from './money';

/**
 * Formatea un importe en su moneda según el idioma de la interfaz: `{{ amount | money: currency }}`.
 * No es puro porque depende del idioma activo (igual que el pipe translate).
 */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: number | null | undefined, currency: string): string {
    if (value === null || value === undefined) {
      return '';
    }
    return moneyFormatter(currency, localeFor(this.i18n.language()))(value);
  }
}
