// Modelos que reflejan los DTO de la API (nombres en inglés, camelCase).

export type BillingCycle = 'Monthly' | 'Yearly';
export type SubscriptionStatus = 'Active' | 'Inactive';

export interface CreateSubscriptionRequest {
  name: string;
  category?: string | null;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDate: string; // yyyy-MM-dd
}

export interface SubscriptionResponse {
  id: string;
  name: string;
  category: string | null;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  status: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
}

// Forma del cuerpo RFC 7807 que devuelve la API en un 400 (ValidationProblemDetails).
export interface ValidationProblemDetails {
  title?: string;
  status?: number;
  errors?: Record<string, string[]>;
}
