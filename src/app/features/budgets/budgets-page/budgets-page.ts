import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';

import { BudgetResponse } from '../budgets.models';
import { BudgetsService } from '../budgets-service';
import { BudgetForm } from '../budget-form/budget-form';
import { BudgetMeter } from '../budget-meter/budget-meter';
import { monthOf, shiftMonth } from '../../transactions/transaction-days';
import { QuickAddService } from '../../transactions/quick-add/quick-add.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MoneyPipe } from '../../../core/format/money.pipe';
import { localeFor } from '../../../core/format/money';
import { productToday } from '../../../core/format/product-calendar';
import { Icon } from '../../../core/ui/icon/icon';
import { CategoryIcon } from '../../../core/ui/icon/category-icon';
import { Modal } from '../../../core/ui/modal/modal';
import { ToastService } from '../../../core/ui/toast/toast.service';

type PageStatus = 'loading' | 'success' | 'error';

/**
 * Presupuestos del mes (EP-15 HU-76): un límite mensual por categoría de gastos y moneda, cuánto se gastó (solo
 * movimientos registrados) y su estado a 80 % y 100 %. El aviso es visual, dentro de FlowTrim.
 */
@Component({
  selector: 'app-budgets-page',
  imports: [TranslatePipe, MoneyPipe, Icon, CategoryIcon, Modal, BudgetForm, BudgetMeter],
  templateUrl: './budgets-page.html',
  styleUrl: './budgets-page.scss',
})
export class BudgetsPage implements OnInit {
  private readonly service = inject(BudgetsService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly quickAdd = inject(QuickAddService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly month = signal(monthOf(productToday()));
  protected readonly status = signal<PageStatus>('loading');
  protected readonly budgets = signal<BudgetResponse[]>([]);
  /** null = sin editor; 'new' = crear; un presupuesto = editar su límite. */
  protected readonly editor = signal<BudgetResponse | 'new' | null>(null);
  protected readonly deleteTarget = signal<BudgetResponse | null>(null);

  private readonly reload$ = new Subject<void>();

  protected readonly monthTitle = computed(() => {
    const [year, monthNumber] = this.month().split('-').map(Number);
    return new Intl.DateTimeFormat(localeFor(this.i18n.language()), { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  });

  protected readonly editing = computed(() => {
    const editor = this.editor();
    return editor === 'new' ? null : editor;
  });

  ngOnInit(): void {
    this.reload$
      .pipe(
        tap(() => this.status.set('loading')),
        switchMap(() => this.service.list(this.month()).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        if (!response) {
          this.status.set('error');
          return;
        }
        this.budgets.set(response.items);
        this.status.set('success');
      });
    this.reload$.next();
    // Un gasto registrado con el registro rápido cambia lo gastado: se recarga el mes.
    this.quickAdd.saved$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reload$.next());
  }

  protected load(): void {
    this.reload$.next();
  }

  protected changeMonth(delta: number): void {
    this.month.set(shiftMonth(this.month(), delta));
    this.reload$.next();
  }

  protected setMonth(value: string): void {
    if (/^\d{4}-\d{2}$/.test(value)) {
      this.month.set(value);
      this.reload$.next();
    }
  }

  protected handleSaved(): void {
    this.editor.set(null);
    this.reload$.next();
  }

  protected confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }
    this.service.delete(target.id).subscribe({
      next: () => {
        this.toast.success(this.i18n.translate('budgets.toast.deleted', { name: target.categoryName }));
        this.deleteTarget.set(null);
        this.reload$.next();
      },
      error: (error: HttpErrorResponse) => this.toast.httpError(error),
    });
  }
}
