import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TodayDashboard } from './today.models';

/** Capa HTTP del panel "Hoy" (HU-68). */
@Injectable({ providedIn: 'root' })
export class TodayService {
  private readonly http = inject(HttpClient);

  /** Cifras del día por moneda, cuentas, últimos movimientos y cobros hasta fin de mes. */
  get(): Observable<TodayDashboard> {
    return this.http.get<TodayDashboard>(`${environment.apiUrl}/api/dashboard/today`);
  }
}
