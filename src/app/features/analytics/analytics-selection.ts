import { Injectable, signal } from '@angular/core';

/**
 * Moneda elegida en Analítica y reportes (HU-59). Se provee en la ruta del módulo, así que sobrevive al cambiar de
 * pestaña y se reinicia al salir del módulo.
 */
@Injectable()
export class AnalyticsSelection {
  readonly currency = signal<string | null>(null);

  /** Mantiene la moneda elegida si sigue existiendo; si no, usa la primera disponible. */
  reconcile(available: readonly string[]): void {
    const current = this.currency();
    if (current === null || !available.includes(current)) {
      this.currency.set(available[0] ?? null);
    }
  }
}
