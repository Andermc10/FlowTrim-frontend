import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { dateLabel, localeFor, moneyFormatter } from '../../../core/format/money';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { AlertWindow, MarkPaidRequest, MarkPaidResponse, SubscriptionResponse } from '../models/subscription.models';
import { SubscriptionService } from './subscription-service';

/** Ventanas en las que Próximos cobros ofrece "Marcar como pagado": lo vencido y lo que vence pronto. */
export const markPaidWindows: readonly AlertWindow[] = ['Overdue', 'Today', 'DueWithin3Days'];

/**
 * Acciones sobre una suscripción que comparten la lista y Próximos cobros: la llamada, el toast de resultado y el
 * de error. Las vistas solo deciden cuándo recargar.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionActions {
  private readonly subscriptions = inject(SubscriptionService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  /**
   * Marca el cobro actual como pagado. Sin `request` solo se mueve la próxima fecha (HU-57); con él también se registra
   * el gasto en la cuenta (HU-73) y el aviso dice cuánto y dónde. Los 400 de campos los muestra el diálogo, no un toast.
   */
  markPaid(subscription: Pick<SubscriptionResponse, 'id' | 'name'>, request: MarkPaidRequest | null = null): Observable<MarkPaidResponse> {
    return this.subscriptions.markPaid(subscription.id, request).pipe(
      tap({
        next: ({ subscription: updated, transaction, completed }) => {
          const locale = localeFor(this.i18n.language());
          const date = dateLabel(updated.nextBillingDate, locale);
          if (completed) {
            // Última cuota: el plan quedó completado y deja de contar en los cobros esperados (HU-74).
            this.toast.success(this.i18n.translate('toast.planCompleted', { name: updated.name }));
            return;
          }
          this.toast.success(
            transaction
              ? this.i18n.translate('toast.paymentRecorded', {
                  name: updated.name,
                  amount: moneyFormatter(transaction.currency, locale)(transaction.amount),
                  account: transaction.accountName,
                  date,
                })
              : this.i18n.translate('toast.markedPaid', { name: updated.name, date }),
          );
        },
        error: (error: HttpErrorResponse) => {
          if (error.status !== 400 || !request) {
            this.toast.httpError(error);
          }
        },
      }),
    );
  }
}
