import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/** Mensaje accionable para errores que no son de validación por campo (400 lo manejan las vistas). */
export function toUserMessage(error: HttpErrorResponse): string {
  switch (error.status) {
    case 0:
      return 'Cannot reach the server. Check your connection and try again.';
    case 404:
      return 'The requested item was not found.';
    case 400:
      return 'Please review the highlighted fields.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Interceptor HTTP central: registra el error (sin secretos: solo método, url y estado) y lo
 * reenvía para que cada vista muestre su mensaje. No bloquea ni traga el error.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error(`HTTP ${error.status} on ${req.method} ${req.urlWithParams}`);
      return throwError(() => error);
    }),
  );
