// Modelos de la importación del CSV del banco (EP-16 HU-79); reflejan /api/transaction-imports.

import { ImportError } from '../../imports/imports.models';

export interface BankImportValues {
  date: string;
  type: 'Expense' | 'Income';
  amount: number;
  description: string | null;
  categoryId: string;
  categoryName: string;
  /** La columna category traía un nombre que no existe: se usó la categoría por defecto. */
  categoryFallback: boolean;
}

export interface BankImportRow {
  rowNumber: number;
  status: 'valid' | 'invalid' | 'duplicate';
  values: BankImportValues | null;
  errors: ImportError[];
  duplicateOf?: 'existing' | 'file';
  duplicateOfRow?: number;
}

export interface BankImportPreview {
  rows: BankImportRow[];
  summary: { total: number; valid: number; invalid: number; duplicate: number };
  ignoredColumns: string[];
}

export interface BankImportConfirmation {
  total: number;
  created: number;
  invalid: number;
  duplicate: number;
}

/** Cuenta destino y categorías por defecto elegidas para el archivo. */
export interface BankImportChoices {
  accountId: string;
  expenseCategoryId: string;
  incomeCategoryId: string;
}
