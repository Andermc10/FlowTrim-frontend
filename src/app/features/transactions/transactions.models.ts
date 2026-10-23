// Modelos que reflejan los DTO de movimientos de la API (HU-66).

export type TransactionType = 'Income' | 'Expense' | 'Transfer';

export const transactionTypes: readonly TransactionType[] = ['Expense', 'Income', 'Transfer'];

// Creación o reemplazo (PUT). La moneda no se envía: es la de la cuenta.
export interface TransactionRequest {
  type: TransactionType;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  amount: number;
  date: string; // yyyy-MM-dd
  description: string | null;
  note: string | null;
}

export interface TransactionResponse {
  id: string;
  type: TransactionType;
  accountId: string;
  accountName: string;
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  amount: number;
  currency: string;
  date: string;
  description: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

// Totales de una moneda para todo el filtro (no solo la página); las transferencias no cuentan.
export interface CurrencyTotals {
  currency: string;
  income: number;
  expense: number;
  net: number;
}

export interface TransactionListResponse {
  items: TransactionResponse[];
  page: number;
  pageSize: number;
  totalCount: number;
  totals: CurrencyTotals[];
}

export interface TransactionFilter {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  search?: string;
}
