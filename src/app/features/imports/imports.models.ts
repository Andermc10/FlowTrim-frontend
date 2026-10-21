/** Modelos de la importación CSV; reflejan los DTO de la API (HU-43 a HU-45). */

export type ImportRowStatus = 'valid' | 'invalid' | 'duplicate';

export type ImportDuplicateSource = 'existing' | 'file';

/** Valores normalizados de una fila válida o duplicada. */
export interface ImportRowValues {
  name: string;
  category: string | null;
  amount: number;
  currency: string;
  billingCycle: string;
  nextBillingDate: string;
  status: string;
}

/** Error de un campo: columna CSV, código estable y mensaje en inglés del servidor. */
export interface ImportError {
  field: string;
  code: string;
  message: string;
}

export interface ImportRow {
  rowNumber: number;
  status: ImportRowStatus;
  values: ImportRowValues | null;
  errors: ImportError[];
  /** Solo en filas duplicadas. */
  duplicateOf?: ImportDuplicateSource;
  /** Solo en duplicados de una fila anterior del archivo. */
  duplicateOfRow?: number;
}

/** Conteos de la vista previa: `valid` son las filas que se crearían. */
export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
}

export interface SubscriptionImportPreview {
  rows: ImportRow[];
  summary: ImportSummary;
  ignoredColumns: string[];
}

/** Resultado de confirmar: conteos calculados dentro de la transacción del servidor. */
export interface SubscriptionImportConfirmation {
  total: number;
  created: number;
  invalid: number;
  duplicate: number;
}
