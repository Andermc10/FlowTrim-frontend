import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TransactionFilter, TransactionListResponse, TransactionRequest, TransactionResponse } from './transactions.models';

/** Tamaño de página máximo que acepta la API (ListTransactionsHandler.MaxPageSize). */
export const maxTransactionPageSize = 200;

/** Capa HTTP tipada para movimientos (HU-66). */
@Injectable({ providedIn: 'root' })
export class TransactionsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/transactions`;

  /** Página filtrada con los totales por moneda de todo el filtro. */
  list(filter: TransactionFilter, page = 1, pageSize = maxTransactionPageSize): Observable<TransactionListResponse> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    for (const [key, value] of Object.entries(filter)) {
      if (value) {
        params = params.set(key, value);
      }
    }
    return this.http.get<TransactionListResponse>(this.baseUrl, { params });
  }

  /** Detalle de un movimiento (404 si no existe). */
  get(id: string): Observable<TransactionResponse> {
    return this.http.get<TransactionResponse>(`${this.baseUrl}/${id}`);
  }

  /** Registra un movimiento (201 / 400). */
  create(request: TransactionRequest): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(this.baseUrl, request);
  }

  /** Reemplaza un movimiento (200 / 400 / 404). */
  update(id: string, request: TransactionRequest): Observable<TransactionResponse> {
    return this.http.put<TransactionResponse>(`${this.baseUrl}/${id}`, request);
  }

  /** Borra un movimiento (204 / 404). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
