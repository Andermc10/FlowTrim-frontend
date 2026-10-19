import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AnalyticsResponse } from './analytics.models';

/** Capa HTTP para la analítica (los cálculos los hace el backend; aquí solo se pintan). */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/analytics`;

  getAnalytics(months = 12): Observable<AnalyticsResponse> {
    return this.http.get<AnalyticsResponse>(this.url, { params: { months } });
  }
}
