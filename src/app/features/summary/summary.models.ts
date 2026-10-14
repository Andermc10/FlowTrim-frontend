// Modelos del resumen financiero (reflejan los DTO de GET /api/summary).

export interface CurrencySummary {
  currency: string;
  monthlyEquivalent: number;
  annualProjection: number;
  activeCount: number;
}

export interface SummaryResponse {
  currencies: CurrencySummary[];
}
