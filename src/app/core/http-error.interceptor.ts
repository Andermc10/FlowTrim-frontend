import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/** Cabecera con el identificador de correlación que devuelve la API (HU-41). */
export const correlationHeader = 'X-Correlation-ID';

/**
 * Referencia de soporte de una respuesta de error: la cabecera X-Correlation-ID o, si no es legible,
 * el campo correlationId del ProblemDetails. Devuelve null cuando no hay respuesta (fallo de red).
 */
export function correlationReference(error: HttpErrorResponse): string | null {
  const fromHeader = error.headers?.get(correlationHeader);
  const fromBody = typeof error.error?.correlationId === 'string' ? error.error.correlationId : null;
  return fromHeader ?? fromBody;
}

/** Mensaje accionable para errores que no son de validación por campo (400 lo manejan las vistas). */
export function toUserMessage(error: HttpErrorResponse): string {
  switch (error.status) {
    case 0:
      return withReference('Cannot reach the server. Check your connection and try again.', error);
    case 404:
      return 'The requested item was not found.';
    case 400:
      return 'Please review the highlighted fields.';
    default:
      return withReference('Something went wrong. Please try again.', error);
  }
}

// Solo los fallos inesperados llevan referencia: es lo que el usuario reporta para buscar en los logs.
function withReference(message: string, error: HttpErrorResponse): string {
  const reference = correlationReference(error);
  return reference ? `${message} Reference: ${reference}` : message;
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
