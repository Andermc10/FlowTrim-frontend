import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ContributionRequest, ContributionResponse, GoalDetailResponse, GoalRequest, GoalResponse } from './goals.models';

/** Capa HTTP de metas de ahorro y aportes (EP-15 HU-77). */
@Injectable({ providedIn: 'root' })
export class GoalsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/goals`;

  list(): Observable<GoalResponse[]> {
    return this.http.get<GoalResponse[]>(this.baseUrl);
  }

  /** Meta con sus últimos 50 aportes (200 / 404). */
  get(id: string): Observable<GoalDetailResponse> {
    return this.http.get<GoalDetailResponse>(`${this.baseUrl}/${id}`);
  }

  create(request: GoalRequest): Observable<GoalResponse> {
    return this.http.post<GoalResponse>(this.baseUrl, request);
  }

  /** 200 / 400 / 404 / 409 goal_currency_locked. */
  update(id: string, request: GoalRequest): Observable<GoalResponse> {
    return this.http.put<GoalResponse>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Aporte (positivo) o retiro (negativo). 201 / 400 / 404. */
  contribute(id: string, request: ContributionRequest): Observable<ContributionResponse> {
    return this.http.post<ContributionResponse>(`${this.baseUrl}/${id}/contributions`, request);
  }

  /** 204 / 404 / 409 goal_saved_negative. */
  deleteContribution(id: string, contributionId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/contributions/${contributionId}`);
  }
}
