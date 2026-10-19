import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { InsightsAnswer, InsightsQuestionRequest } from './insights.models';

/** Capa HTTP de Insights: solo habla con la API de FlowTrim, nunca con el proveedor de IA. */
@Injectable({ providedIn: 'root' })
export class InsightsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/insights/questions`;

  ask(question: string): Observable<InsightsAnswer> {
    const request: InsightsQuestionRequest = { question };
    return this.http.post<InsightsAnswer>(this.url, request);
  }
}
