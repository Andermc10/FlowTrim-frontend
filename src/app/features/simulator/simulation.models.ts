// Modelos del simulador (reflejan los DTO de POST /api/simulations).

export interface SimulationRequest {
  subscriptionIds: string[];
  horizons?: number[];
}

export interface SavingsAtHorizon {
  months: number;
  amount: number;
}

export interface CurrencySimulation {
  currency: string;
  currentMonthly: number;
  selectedMonthly: number;
  projectedMonthly: number;
  savings: SavingsAtHorizon[];
}

export interface SimulationResponse {
  horizons: number[];
  currencies: CurrencySimulation[];
  assumptions: string[];
}
