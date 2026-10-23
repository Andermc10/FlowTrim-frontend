import { TransactionResponse } from './transactions.models';

/** Un día del listado: sus movimientos (en el orden de la API) y el neto del día por moneda. */
export interface TransactionDay {
  date: string;
  items: TransactionResponse[];
  /** Ingresos − gastos del día por moneda; las transferencias no cuentan. */
  net: { currency: string; amount: number }[];
}

/** Mes `yyyy-MM` de una fecha `yyyy-MM-dd`. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Primer y último día (inclusivos) de un mes `yyyy-MM`, como espera el filtro de la API. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

/** Mes `yyyy-MM` desplazado `delta` meses. */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Agrupa por día los movimientos que ya vienen ordenados por fecha descendente. Solo suma lo que mostró la API;
 * redondea a centavos para que la coma flotante no deje restos.
 */
export function groupByDay(items: readonly TransactionResponse[]): TransactionDay[] {
  const days: TransactionDay[] = [];
  for (const item of items) {
    let day = days.at(-1);
    if (!day || day.date !== item.date) {
      day = { date: item.date, items: [], net: [] };
      days.push(day);
    }
    day.items.push(item);
    if (item.type === 'Transfer') {
      continue;
    }
    const signed = item.type === 'Income' ? item.amount : -item.amount;
    const entry = day.net.find((net) => net.currency === item.currency);
    if (entry) {
      entry.amount = Math.round((entry.amount + signed) * 100) / 100;
    } else {
      day.net.push({ currency: item.currency, amount: signed });
    }
  }
  return days;
}
