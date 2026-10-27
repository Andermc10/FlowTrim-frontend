// Modelos de presupuestos (EP-15 HU-76); reflejan /api/budgets.

export type BudgetState = 'OnTrack' | 'Warning' | 'Exceeded';

/** Presupuesto con su avance en el mes pedido. */
export interface BudgetResponse {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  categoryArchived: boolean;
  currency: string;
  limit: number;
  spent: number;
  remaining: number;
  over: number;
  percent: number;
  state: BudgetState;
}

export interface BudgetListResponse {
  month: string; // yyyy-MM
  items: BudgetResponse[];
}

export interface CreateBudgetRequest {
  categoryId: string;
  currency: string;
  limit: number;
}

export interface UpdateBudgetRequest {
  limit: number;
}
