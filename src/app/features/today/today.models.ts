// Modelos del panel "Hoy" (HU-68), reflejo de GET /api/dashboard/today.

import { AccountResponse } from '../accounts/accounts.models';
import { BudgetResponse } from '../budgets/budgets.models';
import { TransactionResponse } from '../transactions/transactions.models';

// Cifras de una moneda con todas las entradas de "Puedes gastar hoy" (calculadas por la API).
export interface CurrencyToday {
  currency: string;
  available: number;
  monthIncome: number;
  monthExpenses: number;
  monthNet: number;
  todayExpenses: number;
  committedUntilMonthEnd: number;
  daysLeft: number;
  safeToSpendToday: number;
  shortfall: number;
}

// Cobro esperado (no un pago) de una suscripción activa hasta fin de mes.
export interface MonthCharge {
  subscriptionId: string;
  name: string;
  amount: number;
  currency: string;
  nextBillingDate: string;
  isOverdue: boolean;
}

export interface TodayDashboard {
  referenceDate: string;
  currencies: CurrencyToday[];
  accounts: AccountResponse[];
  recentTransactions: TransactionResponse[];
  chargesUntilMonthEnd: MonthCharge[];
  // Presupuestos del mes en aviso o excedidos (EP-15 HU-76).
  budgetsToWatch: BudgetResponse[];
}
