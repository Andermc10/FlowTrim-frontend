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

// Actualización completa de una suscripción (mismo contrato que la creación más status).
export interface UpdateSubscriptionRequest extends CreateSubscriptionRequest {
  status: SubscriptionStatus;
}

// Página de resultados devuelta por GET /api/subscriptions.
export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

// Ventana de alerta de un cobro (calculada por el servidor).
export type AlertWindow = 'Overdue' | 'Today' | 'DueWithin3Days' | 'DueWithin7Days' | 'Later';

// Un cobro próximo con su cuenta regresiva (daysUntilCharge y referenceDate vienen del servidor).
export interface UpcomingChargeItem {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  daysUntilCharge: number;
  alertWindow: AlertWindow;
}

export interface UpcomingChargesResponse {
  referenceDate: string;
  items: UpcomingChargeItem[];
}

// Uso declarado de una suscripción.
export interface RegisterUsageRequest {
  usageDate: string; // yyyy-MM-dd
  usageCount: number;
  notes?: string | null;
}

export interface UsageRecordResponse {
  id: string;
  subscriptionId: string;
  usageDate: string;
  usageCount: number;
  notes: string | null;
}

// Forma del cuerpo RFC 7807 que devuelve la API en un 400 (ValidationProblemDetails).
export interface ValidationProblemDetails {
  title?: string;
  status?: number;
  errors?: Record<string, string[]>;
}
