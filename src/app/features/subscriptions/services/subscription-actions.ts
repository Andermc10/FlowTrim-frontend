import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { dateLabel, localeFor } from '../../../core/format/money';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { AlertWindow, SubscriptionResponse } from '../models/subscription.models';
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
   * Marca el cobro actual como pagado (HU-57): la API mueve la próxima fecha un ciclo. No registra dinero, así que
   * el aviso solo habla de la nueva fecha.
   */
  markPaid(subscription: Pick<SubscriptionResponse, 'id' | 'name'>): Observable<SubscriptionResponse> {
    return this.subscriptions.markPaid(subscription.id).pipe(
      tap({
        next: (updated) => {
          const date = dateLabel(updated.nextBillingDate, localeFor(this.i18n.language()));
          this.toast.success(this.i18n.translate('toast.markedPaid', { name: updated.name, date }));
        },
        error: (error: HttpErrorResponse) => this.toast.httpError(error),
      }),
    );
  }
}
