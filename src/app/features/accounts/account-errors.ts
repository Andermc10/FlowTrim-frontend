import { HttpErrorResponse } from '@angular/common/http';

import { I18nService } from '../../core/i18n/i18n.service';
import { conflictErrorToast } from '../../core/ui/toast/conflict-toast';
import { ToastService } from '../../core/ui/toast/toast.service';
import { AccountConflictCode } from './accounts.models';

const conflictCodes: readonly AccountConflictCode[] = ['account_has_transactions', 'account_currency_locked'];

/** Toast de error de una acción sobre cuentas (409 con mensaje propio traducido). */
export function accountErrorToast(toast: ToastService, i18n: I18nService, error: HttpErrorResponse): void {
  conflictErrorToast(toast, i18n, error, conflictCodes, 'accounts.error');
}
