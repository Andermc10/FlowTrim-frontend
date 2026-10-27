// Modelos del estado de cuenta mensual (EP-16 HU-78); reflejan GET /api/statements.

export interface StatementCategory {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  share: number;
  previousAmount: number;
}

export interface CurrencyStatement {
  currency: string;
  income: number;
  expense: number;
  net: number;
  savingsRate: number | null;
  previousIncome: number;
  previousExpense: number;
  previousNet: number;
  expenseChange: number | null;
  topCategories: StatementCategory[];
}

export interface StatementResponse {
  month: string;
  previousMonth: string;
  currencies: CurrencyStatement[];
}
