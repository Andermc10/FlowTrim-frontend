// Modelos que reflejan los DTO de la API (nombres en inglés, camelCase).

import { TransactionResponse } from '../../transactions/transactions.models';

// Ciclos de cobro (EP-14 añadió semanal, quincenal y trimestral), en el orden en que se ofrecen.
export const billingCycles = ['Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Yearly'] as const;
export type BillingCycle = (typeof billingCycles)[number];
export type SubscriptionStatus = 'Active' | 'Inactive';

// Tipo de pago recurrente (EP-14 D2). La API y el código conservan el nombre "subscription".
export const subscriptionKinds = ['Subscription', 'Bill'] as const;
export type SubscriptionKind = (typeof subscriptionKinds)[number];

export interface CreateSubscriptionRequest {
  name: string;
  category?: string | null;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDate: string; // yyyy-MM-dd
  kind: SubscriptionKind;
  paymentUrl: string | null;
  defaultAccountId: string | null;
  categoryId: string | null;
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
  kind: SubscriptionKind;
  paymentUrl: string | null;
  defaultAccountId: string | null;
  categoryId: string | null;
  monthlyEquivalent: number;
  createdAt: string;
  updatedAt: string;
}

// Actualización completa de una suscripción (mismo contrato que la creación más status).
export interface UpdateSubscriptionRequest extends CreateSubscriptionRequest {
  status: SubscriptionStatus;
}

// Cuerpo opcional de "marcar como pagado" (EP-14 HU-73). Sin accountId solo se mueve la próxima fecha.
export interface MarkPaidRequest {
  accountId: string;
  amount: number;
  date: string; // yyyy-MM-dd
  categoryId: string;
}

// Resultado de marcar como pagado: el pago con su nueva fecha y el gasto registrado (null si solo se movió la fecha).
export interface MarkPaidResponse {
  subscription: SubscriptionResponse;
  transaction: TransactionResponse | null;
  completed: boolean;
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

export interface CostPerUseResponse {
  subscriptionId: string;
  currency: string;
  from: string | null;
  to: string | null;
  monthsInPeriod: number;
  totalPaid: number;
  totalUses: number;
  calculable: boolean;
  costPerUse: number | null;
  reason: string | null;
}

// Forma del cuerpo RFC 7807 que devuelve la API en un 400 (ValidationProblemDetails).
export interface ValidationProblemDetails {
  title?: string;
  status?: number;
  errors?: Record<string, string[]>;
}
