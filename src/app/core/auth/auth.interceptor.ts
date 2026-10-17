import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { isFlowTrimApiRequest } from './auth-urls';
import { AuthService } from './auth.service';

/**
 * Agrega el bearer token únicamente a las solicitudes dirigidas a la API de FlowTrim. Si la API responde
 * 401 (token vencido o revocado), cierra la sesión local y ofrece volver a autenticarse.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isFlowTrimApiRequest(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getAccessToken();
  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.expireSession(router.url);
      }

      // El error se propaga igual para que la vista salga de su estado de carga.
      return throwError(() => error);
    }),
  );
};
