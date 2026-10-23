import { HttpErrorResponse } from '@angular/common/http';

import { I18nService } from '../../i18n/i18n.service';
import { ToastService } from './toast.service';

/**
 * Toast de error de una acción: un 409 con un `code` conocido muestra su mensaje traducido (`<keyPrefix>.<code>`, p. ej.
 * "archívala en su lugar") como advertencia; el resto usa el mensaje genérico con la referencia de correlación.
 */
export function conflictErrorToast(
  toast: ToastService,
  i18n: I18nService,
  error: HttpErrorResponse,
  knownCodes: readonly string[],
  keyPrefix: string,
): void {
  const code = error.status === 409 ? (error.error?.code as string | undefined) : undefined;
  if (code && knownCodes.includes(code)) {
    toast.warning(i18n.translate(`${keyPrefix}.${code}`));
    return;
  }
  toast.httpError(error);
}
