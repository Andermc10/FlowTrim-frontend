/** Zona del calendario del producto: la misma que usa la API para decidir qué es "hoy" (HU-04, HU-56). */
export const productTimeZone = 'America/Bogota';

/** Fecha de hoy (`yyyy-MM-dd`) en el calendario del producto, sin importar la zona del navegador. */
export function productToday(now: Date = new Date()): string {
  // en-CA formatea como yyyy-MM-dd.
  return new Intl.DateTimeFormat('en-CA', { timeZone: productTimeZone }).format(now);
}
