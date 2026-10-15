import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CreateSubscriptionRequest,
  CostPerUseResponse,
  PagedResponse,
  RegisterUsageRequest,
  SubscriptionResponse,
  UpcomingChargesResponse,
  UpdateSubscriptionRequest,
  UsageRecordResponse,
} from '../models/subscription.models';

/** Capa HTTP tipada para suscripciones. */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/subscriptions`;

  /** Crea una suscripción. Devuelve 201 con el recurso creado o 400 con errores por campo. */
  create(request: CreateSubscriptionRequest): Observable<SubscriptionResponse> {
    return this.http.post<SubscriptionResponse>(this.baseUrl, request);
  }

  /** Lista paginada de suscripciones. */
  list(page = 1, pageSize = 20): Observable<PagedResponse<SubscriptionResponse>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResponse<SubscriptionResponse>>(this.baseUrl, { params });
  }

  /** Detalle de una suscripción (404 si no existe). */
  get(id: string): Observable<SubscriptionResponse> {
    return this.http.get<SubscriptionResponse>(`${this.baseUrl}/${id}`);
  }

  /** Actualiza una suscripción existente (200 / 400 / 404). */
  update(id: string, request: UpdateSubscriptionRequest): Observable<SubscriptionResponse> {
    return this.http.put<SubscriptionResponse>(`${this.baseUrl}/${id}`, request);
  }

  /** Elimina una suscripción (204 / 404). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Próximos cobros ordenados por fecha, con cuenta regresiva y ventana de alerta (servidor). */
  getUpcoming(): Observable<UpcomingChargesResponse> {
    return this.http.get<UpcomingChargesResponse>(`${this.baseUrl}/upcoming`);
  }

  /** Registra un uso declarado para una suscripción (201 / 400 / 404). */
  registerUsage(id: string, request: RegisterUsageRequest): Observable<UsageRecordResponse> {
    return this.http.post<UsageRecordResponse>(`${this.baseUrl}/${id}/usage-records`, request);
  }

  /** Lista los usos de una suscripción (200 / 404). */
  listUsage(id: string): Observable<UsageRecordResponse[]> {
    return this.http.get<UsageRecordResponse[]>(`${this.baseUrl}/${id}/usage-records`);
  }

  /** Calcula el costo declarado por uso usando el periodo derivado de los registros. */
  getCostPerUse(id: string): Observable<CostPerUseResponse> {
    return this.http.get<CostPerUseResponse>(`${this.baseUrl}/${id}/cost-per-use`);
  }
}
