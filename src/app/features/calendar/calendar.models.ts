// Modelos del calendario financiero (EP-14 HU-75); reflejan GET /api/calendar.

import { SubscriptionKind } from '../subscriptions/models/subscription.models';

/** Cobro esperado de un día: no es un pago; vencido si el día ya pasó y sigue sin pagar. */
export interface CalendarExpected {
  subscriptionId: string;
  name: string;
  kind: SubscriptionKind;
  amount: number;
  currency: string;
  isOverdue: boolean;
  paymentUrl: string | null;
}

/** Lo registrado un día en una moneda (las transferencias no cuentan). */
export interface CalendarRecorded {
  currency: string;
  income: number;
  expense: number;
}

export interface CalendarDay {
  date: string; // yyyy-MM-dd
  expected: CalendarExpected[];
  recorded: CalendarRecorded[];
}

export interface CalendarTotals {
  currency: string;
  expected: number;
  recordedIncome: number;
  recordedExpense: number;
}

export interface CalendarResponse {
  month: string; // yyyy-MM
  today: string;
  days: CalendarDay[];
  totals: CalendarTotals[];
}
