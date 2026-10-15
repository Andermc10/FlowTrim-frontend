import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SimulationRequest, SimulationResponse } from './simulation.models';

/** Capa HTTP para la simulación de cancelación (no persiste). */
@Injectable({ providedIn: 'root' })
export class SimulationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/simulations`;

  simulate(request: SimulationRequest): Observable<SimulationResponse> {
    return this.http.post<SimulationResponse>(this.url, request);
  }
}
