import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { TodayDashboard } from '../today.models';
import { TodayService } from '../today-service';
import { AccountResponse } from '../../accounts/accounts.models';
import { QuickAddService } from '../../transactions/quick-add/quick-add.service';
import { TransactionResponse } from '../../transactions/transactions.models';
import { dateLabel, localeFor } from '../../../core/format/money';
import { MoneyPipe } from '../../../core/format/money.pipe';
import { I18nService } from '../../../core/i18n/i18n.service';
import { BudgetMeter } from '../../budgets/budget-meter/budget-meter';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CategoryIcon } from '../../../core/ui/icon/category-icon';

type PageStatus = 'loading' | 'success' | 'error';

/**
 * Panel "Hoy" (HU-68), portada del workspace: "Puedes gastar hoy" por moneda con su fórmula a la vista, cifras del mes
 * y de hoy, cuentas, últimos movimientos y cobros esperados hasta fin de mes. Todo lo calcula la API; aquí solo se
 * muestra. Se actualiza al registrar desde el registro rápido.
 */
@Component({
  selector: 'app-today-page',
  imports: [RouterLink, TranslatePipe, MoneyPipe, CategoryIcon, BudgetMeter],
  templateUrl: './today-page.html',
  styleUrl: './today-page.scss',
})
export class TodayPage implements OnInit {
  private readonly service = inject(TodayService);
  private readonly quickAdd = inject(QuickAddService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly i18n = inject(I18nService);

  protected readonly status = signal<PageStatus>('loading');
  protected readonly data = signal<TodayDashboard | null>(null);

  protected readonly hasAccounts = computed(() => (this.data()?.accounts.length ?? 0) > 0);
  protected readonly hasTransactions = computed(() => (this.data()?.recentTransactions.length ?? 0) > 0);
  protected readonly dateTitle = computed(() => {
    const date = this.data()?.referenceDate;
    return date ? dateLabel(date, localeFor(this.i18n.language())) : '';
  });

  /** Último día del mes de la fecha de referencia, para explicar hasta cuándo se cuentan los cobros. */
  protected readonly monthEndLabel = computed(() => {
    const date = this.data()?.referenceDate;
    if (!date) {
      return '';
    }
    const [year, month] = date.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return dateLabel(`${date.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`, localeFor(this.i18n.language()));
  });

  ngOnInit(): void {
    this.load();
    // Un movimiento registrado desde el registro rápido cambia las cifras: se recargan sin recargar la página.
    this.quickAdd.saved$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load(false));
  }

  /** Carga el panel; al recargar tras un registro no se vuelve a mostrar el estado de carga. */
  protected load(showLoading = true): void {
    if (showLoading) {
      this.status.set('loading');
    }
    this.service.get().subscribe({
      next: (data) => {
        this.data.set(data);
        this.status.set('success');
      },
      error: () => this.status.set('error'),
    });
  }

  protected openQuickAdd(): void {
    this.quickAdd.open();
  }

  protected isOwed(account: AccountResponse): boolean {
    return account.type === 'CreditCard' && account.balance < 0;
  }

  protected chargeDate(date: string): string {
    return dateLabel(date, localeFor(this.i18n.language()));
  }

  protected rowTitle(item: TransactionResponse): string {
    return item.description ?? item.categoryName ?? this.i18n.translate('transactions.type.Transfer');
  }
}
