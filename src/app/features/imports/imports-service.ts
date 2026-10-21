import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SubscriptionImportConfirmation, SubscriptionImportPreview } from './imports.models';

/**
 * Capa HTTP de la importación CSV. La vista previa no guarda nada; la confirmación reenvía el mismo archivo
 * (decisión D4: el servidor no conserva vistas previas).
 */
@Injectable({ providedIn: 'root' })
export class ImportsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/subscription-imports`;

  preview(file: File): Observable<SubscriptionImportPreview> {
    return this.http.post<SubscriptionImportPreview>(`${this.url}/preview`, formWith(file));
  }

  confirm(file: File): Observable<SubscriptionImportConfirmation> {
    return this.http.post<SubscriptionImportConfirmation>(`${this.url}/confirm`, formWith(file));
  }
}

// El navegador arma el multipart y su boundary: no se fija Content-Type a mano.
function formWith(file: File): FormData {
  const form = new FormData();
  form.append('file', file, file.name);
  return form;
}
