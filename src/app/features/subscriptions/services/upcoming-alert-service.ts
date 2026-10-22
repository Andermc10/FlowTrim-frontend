import { Injectable, inject } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { SoundService } from '../../../core/ui/sound/sound.service';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { AlertWindow, UpcomingChargeItem } from '../models/subscription.models';
import { SubscriptionService } from './subscription-service';

/** Marca de "ya se mostró en esta sesión de pestaña". */
export const upcomingAlertShownKey = 'flowtrim.upcoming_alert_shown';

/** Ventanas que merecen aviso al entrar; 7 días o más no interrumpen al usuario. */
const attentionWindows: readonly AlertWindow[] = ['Overdue', 'Today', 'DueWithin3Days'];

/** Máximo de nombres listados en el toast; el resto se resume como "+N". */
const maxListedNames = 3;

/**
 * Avisos de próximos cobros al entrar al workspace (HU-54): un único toast por sesión con los cobros vencidos,
 * de hoy o de los próximos 3 días. Solo dentro de la app; días y ventanas vienen del servidor (HU-04).
 */
@Injectable({ providedIn: 'root' })
export class UpcomingAlertService {
  private readonly subscriptions = inject(SubscriptionService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly sound = inject(SoundService);

  /** Revisa los próximos cobros una sola vez por sesión. Si la petición falla, no muestra nada. */
  checkOnce(): void {
    if (this.wasShown()) {
      return;
    }
    this.markShown();

    this.subscriptions.getUpcoming().subscribe({
      next: (response) => this.notify(response.items),
      // Silencioso a propósito: la página de próximos cobros ya muestra su propio estado de error.
      error: () => undefined,
    });
  }

  /** Permite volver a avisar tras cerrar sesión e iniciarla de nuevo. */
  reset(): void {
    try {
      sessionStorage.removeItem(upcomingAlertShownKey);
    } catch {
      // Sin almacenamiento de sesión no hay marca que borrar.
    }
  }

  private notify(items: UpcomingChargeItem[]): void {
    const attention = items
      .filter((item) => attentionWindows.includes(item.alertWindow))
      .sort((a, b) => a.daysUntilCharge - b.daysUntilCharge);
    if (attention.length === 0) {
      return;
    }

    const hasOverdue = attention.some((item) => item.alertWindow === 'Overdue');
    const listed = attention.slice(0, maxListedNames).map((item) => `${item.name} (${this.relativeDay(item)})`).join(', ');
    const hidden = attention.length - maxListedNames;
    const more = hidden > 0 ? ` ${this.i18n.translate('alerts.more', { count: hidden })}` : '';
    const title = attention.length === 1
      ? this.i18n.translate('alerts.titleOne')
      : this.i18n.translate('alerts.titleMany', { count: attention.length });
    const message = `${this.i18n.translate('alerts.expected')} ${listed}${more}`;
    const action = { label: this.i18n.translate('alerts.viewUpcoming'), route: '/app/upcoming' };

    if (hasOverdue) {
      // Algo vencido: rojo y permanece hasta que el usuario lo cierre.
      this.toast.error(message, { title, action, duration: null });
    } else {
      this.toast.warning(message, { title, action });
    }
    // Solo suena si el usuario activó el sonido (HU-62).
    this.sound.play(hasOverdue ? 'overdue' : 'soon');
  }

  private relativeDay(item: UpcomingChargeItem): string {
    const days = item.daysUntilCharge;
    if (days === 0) {
      return this.i18n.translate('alerts.today');
    }
    if (days < 0) {
      return days === -1
        ? this.i18n.translate('alerts.overdueOneDay')
        : this.i18n.translate('alerts.overdueDays', { days: -days });
    }
    return days === 1 ? this.i18n.translate('alerts.tomorrow') : this.i18n.translate('alerts.inDays', { days });
  }

  private wasShown(): boolean {
    try {
      return sessionStorage.getItem(upcomingAlertShownKey) === 'true';
    } catch {
      return false;
    }
  }

  private markShown(): void {
    try {
      sessionStorage.setItem(upcomingAlertShownKey, 'true');
    } catch {
      // Sin almacenamiento se avisaría en cada entrada: aceptable, no bloquea la app.
    }
  }
}
