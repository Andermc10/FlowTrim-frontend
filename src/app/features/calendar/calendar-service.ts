import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CalendarResponse } from './calendar.models';

/** Capa HTTP del calendario financiero (EP-14 HU-75). */
@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/calendar`;

  /** Días del mes `yyyy-MM` con lo esperado y lo registrado, y los totales por moneda. */
  get(month: string): Observable<CalendarResponse> {
    return this.http.get<CalendarResponse>(this.baseUrl, { params: new HttpParams().set('month', month) });
  }
}
