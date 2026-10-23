// Modelos que reflejan los DTO de cuentas de la API (HU-64).

export type AccountType = 'Cash' | 'Bank' | 'CreditCard' | 'Savings';

export const accountTypes: readonly AccountType[] = ['Cash', 'Bank', 'CreditCard', 'Savings'];

export interface CreateAccountRequest {
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: number;
}

// Reemplazo completo de los campos editables (PUT).
export interface UpdateAccountRequest extends CreateAccountRequest {
  isArchived: boolean;
}

// Cuenta con su saldo calculado por el servidor. Con movimientos no se puede borrar ni cambiar de moneda.
export interface AccountResponse {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: number;
  balance: number;
  isArchived: boolean;
  hasTransactions: boolean;
  createdAt: string;
  updatedAt: string;
}

// Códigos de los conflictos 409 de cuentas.
export type AccountConflictCode = 'account_has_transactions' | 'account_currency_locked';
