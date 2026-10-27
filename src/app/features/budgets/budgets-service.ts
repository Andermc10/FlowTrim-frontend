import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { BudgetListResponse, BudgetResponse, CreateBudgetRequest, UpdateBudgetRequest } from './budgets.models';

/** Capa HTTP de presupuestos (EP-15 HU-76). */
@Injectable({ providedIn: 'root' })
export class BudgetsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/budgets`;

  /** Presupuestos con su avance en el mes `yyyy-MM`. */
  list(month: string): Observable<BudgetListResponse> {
    return this.http.get<BudgetListResponse>(this.baseUrl, { params: new HttpParams().set('month', month) });
  }

  /** Crea un presupuesto (201 / 400 / 409 budget_exists). */
  create(request: CreateBudgetRequest): Observable<BudgetResponse> {
    return this.http.post<BudgetResponse>(this.baseUrl, request);
  }

  /** Cambia el límite mensual (200 / 400 / 404). */
  update(id: string, request: UpdateBudgetRequest): Observable<BudgetResponse> {
    return this.http.put<BudgetResponse>(`${this.baseUrl}/${id}`, request);
  }

  /** Borra el presupuesto (204 / 404). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
