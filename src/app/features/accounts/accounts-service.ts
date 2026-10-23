import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AccountResponse, CreateAccountRequest, UpdateAccountRequest } from './accounts.models';

/** Capa HTTP tipada para cuentas (HU-64). */
@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/accounts`;

  /** Cuentas con su saldo; las archivadas solo si se piden. */
  list(includeArchived = false): Observable<AccountResponse[]> {
    const params = includeArchived ? new HttpParams().set('includeArchived', true) : undefined;
    return this.http.get<AccountResponse[]>(this.baseUrl, { params });
  }

  /** Detalle de una cuenta (404 si no existe). */
  get(id: string): Observable<AccountResponse> {
    return this.http.get<AccountResponse>(`${this.baseUrl}/${id}`);
  }

  /** Crea una cuenta (201 / 400). */
  create(request: CreateAccountRequest): Observable<AccountResponse> {
    return this.http.post<AccountResponse>(this.baseUrl, request);
  }

  /** Actualiza una cuenta (200 / 400 / 404 / 409 account_currency_locked). */
  update(id: string, request: UpdateAccountRequest): Observable<AccountResponse> {
    return this.http.put<AccountResponse>(`${this.baseUrl}/${id}`, request);
  }

  /** Borra una cuenta sin movimientos (204 / 404 / 409 account_has_transactions). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
