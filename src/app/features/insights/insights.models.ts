/** Longitud máxima de una pregunta (misma regla que el backend, que sigue siendo la autoridad). */
export const questionMaxLength = 500;

/** Estado de la respuesta de Insights (HU-35). */
export type InsightsStatus = 'answered' | 'no_data' | 'unsupported';

/** Cifra determinista calculada por una herramienta del backend; nunca sale del texto del modelo. */
export interface InsightFigure {
  kind: string;
  label: string;
  subject?: string;
  value: number;
  currency?: string;
  months?: number;
  date?: string; // yyyy-MM-dd
}

/** Supuesto con clave estable para traducir y texto en inglés como respaldo. */
export interface InsightAssumption {
  key: string;
  text: string;
}

export interface InsightsQuestionRequest {
  question: string;
}

export interface InsightsAnswer {
  status: InsightsStatus;
  answer: string;
  figures: InsightFigure[];
  assumptions: InsightAssumption[];
  sources: string[];
  toolsUsed: string[];
}
