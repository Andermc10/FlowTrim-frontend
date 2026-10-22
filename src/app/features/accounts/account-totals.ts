import { AccountResponse } from './accounts.models';

/** Totales de una moneda en la pantalla de cuentas. Nunca se suman monedas distintas. */
export interface CurrencyTotals {
  currency: string;
  /** Efectivo, banco y ahorros no archivados: el dinero propio. */
  inAccounts: number;
  /** Saldo de las tarjetas de crédito no archivadas (negativo = deuda); se muestra aparte, es dinero prestado. */
  creditCards: number;
  hasCreditCards: boolean;
}

/**
 * Agrupa los saldos (ya calculados por la API) por moneda. Las cuentas archivadas no cuentan y se listan aparte.
 * Solo suma lo que mostró el servidor; no recalcula saldos.
 */
export function totalsByCurrency(accounts: readonly AccountResponse[]): CurrencyTotals[] {
  const totals = new Map<string, CurrencyTotals>();
  for (const account of accounts) {
    if (account.isArchived) {
      continue;
    }
    const entry = totals.get(account.currency)
      ?? { currency: account.currency, inAccounts: 0, creditCards: 0, hasCreditCards: false };
    if (account.type === 'CreditCard') {
      entry.creditCards = roundCents(entry.creditCards + account.balance);
      entry.hasCreditCards = true;
    } else {
      entry.inAccounts = roundCents(entry.inAccounts + account.balance);
    }
    totals.set(account.currency, entry);
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

// Los saldos llegan con 2 decimales; sumar en coma flotante puede dejar restos como 0.30000000000000004.
function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
