import { HttpErrorResponse } from '@angular/common/http';

import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../core/ui/toast/toast.service';
import { AccountConflictCode } from './accounts.models';

const conflictCodes: readonly AccountConflictCode[] = ['account_has_transactions', 'account_currency_locked'];

/**
 * Toast de error de una acción sobre cuentas: los 409 de la API llevan un `code` con mensaje propio traducido (p. ej.
 * "archívala en su lugar"); el resto usa el mensaje genérico con la referencia de correlación.
 */
export function accountErrorToast(toast: ToastService, i18n: I18nService, error: HttpErrorResponse): void {
  const code = error.status === 409 ? (error.error?.code as AccountConflictCode | undefined) : undefined;
  if (code && conflictCodes.includes(code)) {
    toast.warning(i18n.translate(`accounts.error.${code}`));
    return;
  }
  toast.httpError(error);
}
