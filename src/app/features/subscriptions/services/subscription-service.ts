import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { CreateSubscriptionRequest, SubscriptionResponse } from '../models/subscription.models';

/** Capa HTTP tipada para suscripciones. */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/subscriptions`;

  /** Crea una suscripción. Devuelve 201 con el recurso creado o 400 con errores por campo. */
  create(request: CreateSubscriptionRequest): Observable<SubscriptionResponse> {
    return this.http.post<SubscriptionResponse>(this.baseUrl, request);
  }
}
