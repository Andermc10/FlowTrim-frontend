import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface DownloadedFile {
  blob: Blob;
  fileName: string;
}

/** Capa HTTP de reportes: descarga del CSV de suscripciones (HU-52). */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/reports/subscriptions.csv`;

  downloadSubscriptionsCsv(today: string): Observable<DownloadedFile> {
    return this.http.get(this.url, { observe: 'response', responseType: 'blob' }).pipe(
      map((response: HttpResponse<Blob>) => ({
        blob: response.body ?? new Blob([], { type: 'text/csv' }),
        // Entre orígenes distintos el navegador no expone Content-Disposition: se usa el mismo formato de nombre.
        fileName: fileNameFrom(response.headers.get('Content-Disposition')) ?? `flowtrim-subscriptions-${today}.csv`,
      })),
    );
  }
}

/** Extrae filename="…" de una cabecera Content-Disposition, o null si no está. */
export function fileNameFrom(contentDisposition: string | null): string | null {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : null;
}
