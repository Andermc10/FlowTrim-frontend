/** Modelos que reflejan la respuesta de GET /api/analytics (HU-50). */
export interface AnalyticsResponse {
  referenceMonth: string;
  currencies: CurrencyAnalytics[];
}

export interface CurrencyAnalytics {
  currency: string;
  monthlyTotal: number;
  byCategory: CategorySpend[];
  topSubscriptions: TopSubscription[];
  expectedCharges: ExpectedCharge[];
}

export interface CategorySpend {
  category: string;
  monthlyEquivalent: number;
  share: number;
  count: number;
}

export interface TopSubscription {
  id: string;
  name: string;
  monthlyEquivalent: number;
}

/** Cobros esperados (no confirmados) de un mes; <c>month</c> en formato yyyy-MM. */
export interface ExpectedCharge {
  month: string;
  amount: number;
  count: number;
}
