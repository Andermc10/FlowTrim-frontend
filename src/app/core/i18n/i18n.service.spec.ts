import { TestBed } from '@angular/core/testing';

import { I18nService, translations } from './i18n.service';

describe('I18nService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [I18nService] });
  });

  it('uses English by default and translates a known key', () => {
    const service = TestBed.inject(I18nService);

    expect(service.language()).toBe('en');
    expect(service.translate('nav.overview')).toBe('Overview');
  });

  it('switches to Spanish and persists the preference', () => {
    const service = TestBed.inject(I18nService);

    service.toggleLanguage();

    expect(service.language()).toBe('es');
    expect(service.translate('nav.overview')).toBe('Resumen');
    expect(localStorage.getItem('flowtrim-language')).toBe('es');
  });

  it('falls back to English for an unknown key', () => {
    const service = TestBed.inject(I18nService);

    expect(service.translate('missing.key')).toBe('missing.key');
  });

  it('has the same keys in English and Spanish', () => {
    const english = Object.keys(translations.en).sort();
    const spanish = Object.keys(translations.es).sort();

    expect(english.filter((key) => !spanish.includes(key))).toEqual([]);
    expect(spanish.filter((key) => !english.includes(key))).toEqual([]);
  });
});
