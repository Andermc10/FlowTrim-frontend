import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AuthService } from './auth.service';

/** Protege el workspace: sin un token vigente redirige al login conservando la ruta solicitada. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // getAccessToken también descarta un token vencido, a diferencia de leer solo la señal.
  return auth.getAccessToken() !== null
    ? true
    : router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};
