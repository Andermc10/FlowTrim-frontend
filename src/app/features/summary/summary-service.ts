import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SummaryResponse } from './summary.models';

/** Capa HTTP para el resumen financiero. */
@Injectable({ providedIn: 'root' })
export class SummaryService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/summary`;

  getSummary(): Observable<SummaryResponse> {
    return this.http.get<SummaryResponse>(this.url);
  }
}
