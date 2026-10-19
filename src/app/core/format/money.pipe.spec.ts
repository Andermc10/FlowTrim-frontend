import { TestBed } from '@angular/core/testing';

import { I18nService } from '../i18n/i18n.service';
import { MoneyPipe } from './money.pipe';

describe('MoneyPipe', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  const pipe = () => TestBed.runInInjectionContext(() => new MoneyPipe());

  it('formats amounts in their currency and follows the interface language', () => {
    const money = pipe();

    // Intl separa el código de moneda con un espacio no separable (U+00A0); \s lo acepta.
    expect(money.transform(164716.67, 'COP')).toMatch(/^COP\s164,717$/);
    expect(money.transform(9.99, 'USD')).toBe('$9.99');

    TestBed.inject(I18nService).toggleLanguage();
    expect(money.transform(164716.67, 'COP')).toMatch(/164\.717/);
  });

  it('returns an empty string for missing values', () => {
    expect(pipe().transform(null, 'COP')).toBe('');
    expect(pipe().transform(undefined, 'COP')).toBe('');
  });
});
