import { fileNameFrom } from './reports-service';
import { localeFor, monthLabel, moneyFormatter } from '../../core/format/money';

describe('fileNameFrom', () => {
  it('reads quoted and unquoted file names', () => {
    expect(fileNameFrom('attachment; filename="flowtrim-subscriptions-2026-10-18.csv"')).toBe('flowtrim-subscriptions-2026-10-18.csv');
    expect(fileNameFrom('attachment; filename=report.csv; filename*=UTF-8\'\'report.csv')).toBe('report.csv');
  });

  it('returns null when the header is missing or has no file name', () => {
    expect(fileNameFrom(null)).toBeNull();
    expect(fileNameFrom('attachment')).toBeNull();
  });
});

describe('money helpers', () => {
  it('formats COP without cents and USD with cents', () => {
    // Intl separa el código de moneda con un espacio no separable (U+00A0).
    expect(moneyFormatter('COP', 'en-US')(38900)).toMatch(/^COP\s38,900$/);
    expect(moneyFormatter('USD', 'en-US')(9.99)).toBe('$9.99');
  });

  it('maps the interface language to a locale and formats month labels', () => {
    expect(localeFor('es')).toBe('es-CO');
    expect(localeFor('en')).toBe('en-US');
    expect(monthLabel('2027-02', 'en-US')).toBe('Feb 27');
  });
});
