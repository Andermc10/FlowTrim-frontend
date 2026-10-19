/** Locale de formato según el idioma de la interfaz. */
export function localeFor(language: string): string {
  return language === 'es' ? 'es-CO' : 'en-US';
}

/**
 * Formateador de moneda: COP sin decimales (no se usan centavos en la práctica), el resto con 2.
 * Solo formatea; los importes ya vienen calculados por el backend.
 */
export function moneyFormatter(currency: string, locale: string): (value: number) => string {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'COP' ? 0 : 2,
  });
  return (value: number) => formatter.format(value);
}

/** Etiqueta corta de un mes `yyyy-MM` (p. ej. "Feb 27" / "feb 27"). */
export function monthLabel(month: string, locale: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}
