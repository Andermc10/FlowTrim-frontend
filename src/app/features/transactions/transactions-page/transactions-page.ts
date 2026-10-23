import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, switchMap } from 'rxjs';

import { TransactionFilter, TransactionResponse, TransactionType, CurrencyTotals, transactionTypes } from '../transactions.models';
import { TransactionsService } from '../transactions-service';
import { groupByDay, monthOf, monthRange, shiftMonth } from '../transaction-days';
import { TransactionForm } from '../transaction-form/transaction-form';
import { AccountResponse } from '../../accounts/accounts.models';
import { AccountsService } from '../../accounts/accounts-service';
import { CategoryResponse } from '../../categories/categories.models';
import { CategoriesService } from '../../categories/categories-service';
import { dateLabel, localeFor } from '../../../core/format/money';
import { MoneyPipe } from '../../../core/format/money.pipe';
import { productToday } from '../../../core/format/product-calendar';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CategoryIcon } from '../../../core/ui/icon/category-icon';
import { Icon } from '../../../core/ui/icon/icon';
import { Modal } from '../../../core/ui/modal/modal';
import { ToastService } from '../../../core/ui/toast/toast.service';

type PageStatus = 'loading' | 'success' | 'error';

/**
 * Movimientos del mes (HU-66): selector de mes, filtros (cuenta, categoría, tipo, texto), filas agrupadas por día con
 * su neto, totales por moneda de todo el filtro y acciones de editar y borrar. Los importes llevan signo y texto, no
 * solo color.
 */
@Component({
  selector: 'app-transactions-page',
  imports: [RouterLink, TranslatePipe, MoneyPipe, Icon, CategoryIcon, Modal, TransactionForm],
  templateUrl: './transactions-page.html',
  styleUrl: './transactions-page.scss',
})
export class TransactionsPage implements OnInit {
  private readonly transactionsService = inject(TransactionsService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly i18n = inject(I18nService);

  protected readonly status = signal<PageStatus>('loading');
  protected readonly accounts = signal<AccountResponse[]>([]);
  protected readonly categories = signal<CategoryResponse[]>([]);
  protected readonly items = signal<TransactionResponse[]>([]);
  protected readonly totals = signal<CurrencyTotals[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly loadingMore = signal(false);
  // Última página pedida del filtro actual: "Cargar más" pide la siguiente.
  private loadedPage = 1;

  protected readonly currentMonth = monthOf(productToday());
  protected readonly month = signal(this.currentMonth);
  protected readonly accountId = signal('');
  protected readonly categoryId = signal('');
  protected readonly type = signal<TransactionType | ''>('');
  protected readonly search = signal('');
  protected readonly types = transactionTypes;

  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<TransactionResponse | null>(null);
  protected readonly editorDirty = signal(false);
  protected readonly discardConfirmation = signal(false);
  protected readonly deleteTarget = signal<TransactionResponse | null>(null);
  protected readonly deleting = signal(false);

  protected readonly days = computed(() => groupByDay(this.items()));
  protected readonly hasMore = computed(() => this.items().length < this.totalCount());
  protected readonly hasActiveAccounts = computed(() => this.accounts().some((account) => !account.isArchived));
  protected readonly filtered = computed(() => !!(this.accountId() || this.categoryId() || this.type() || this.search()));
  protected readonly monthTitle = computed(() => {
    const [year, monthNumber] = this.month().split('-').map(Number);
    return new Intl.DateTimeFormat(localeFor(this.i18n.language()), { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  });

  // Cada cambio de filtro pide la primera página; switchMap descarta la respuesta de un filtro anterior.
  private readonly reload$ = new Subject<void>();
  private readonly search$ = new Subject<string>();
  private referencesLoaded = false;

  ngOnInit(): void {
    this.reload$
      .pipe(
        switchMap(() => {
          this.status.set('loading');
          // El error se atrapa dentro: así el flujo sigue vivo y "Reintentar" vuelve a pedir.
          return this.transactionsService.list(this.filter()).pipe(
            catchError(() => {
              this.status.set('error');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.loadedPage = page.page;
        this.items.set(page.items);
        this.totals.set(page.totals);
        this.totalCount.set(page.totalCount);
        this.status.set('success');
      });

    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.search.set(term);
        this.reload$.next();
      });

    this.loadReferences();
  }

  /** Cuentas y categorías (archivadas incluidas): filtros, nombres y el formulario. */
  protected loadReferences(): void {
    this.status.set('loading');
    forkJoin([this.accountsService.list(true), this.categoriesService.list({ includeArchived: true })]).subscribe({
      next: ([accounts, categories]) => {
        this.referencesLoaded = true;
        this.accounts.set(accounts);
        this.categories.set(categories);
        this.reload$.next();
      },
      error: () => this.status.set('error'),
    });
  }

  protected retry(): void {
    if (this.referencesLoaded) {
      this.reload$.next();
    } else {
      this.loadReferences();
    }
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

  protected setAccount(value: string): void {
    this.accountId.set(value);
    this.reload$.next();
  }

  protected setCategory(value: string): void {
    this.categoryId.set(value);
    this.reload$.next();
  }

  protected setType(value: string): void {
    this.type.set(value as TransactionType | '');
    this.reload$.next();
  }

  protected setSearch(value: string): void {
    this.search$.next(value.trim());
  }

  protected clearFilters(): void {
    this.accountId.set('');
    this.categoryId.set('');
    this.type.set('');
    this.search.set('');
    this.reload$.next();
  }

  protected loadMore(): void {
    this.loadingMore.set(true);
    this.transactionsService.list(this.filter(), this.loadedPage + 1).subscribe({
      next: (page) => {
        this.loadedPage = page.page;
        this.items.update((items) => [...items, ...page.items]);
        this.totalCount.set(page.totalCount);
        this.loadingMore.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loadingMore.set(false);
        this.toast.httpError(error);
      },
    });
  }

  protected dayTitle(date: string): string {
    return dateLabel(date, localeFor(this.i18n.language()));
  }

  /** Título de la fila: la descripción, o la categoría, o "Transferencia". */
  protected rowTitle(item: TransactionResponse): string {
    return item.description ?? item.categoryName ?? this.i18n.translate('transactions.type.Transfer');
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.editorDirty.set(false);
    this.editorOpen.set(true);
  }

  protected openEdit(item: TransactionResponse): void {
    this.editing.set(item);
    this.editorDirty.set(false);
    this.editorOpen.set(true);
  }

  protected requestEditorClose(): void {
    if (this.editorDirty()) {
      this.discardConfirmation.set(true);
      return;
    }
    this.closeEditor();
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
    this.editing.set(null);
    this.editorDirty.set(false);
    this.discardConfirmation.set(false);
  }

  protected handleSaved(saved: TransactionResponse): void {
    this.closeEditor();
    // Un movimiento registrado en otro mes lleva al usuario a ese mes, para que lo vea.
    if (monthOf(saved.date) !== this.month()) {
      this.month.set(monthOf(saved.date));
    }
    this.reload$.next();
  }

  protected confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }
    this.deleting.set(true);
    this.transactionsService.delete(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.toast.success(this.i18n.translate('toast.transactionDeleted'));
        this.reload$.next();
      },
      error: (error: HttpErrorResponse) => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.toast.httpError(error);
      },
    });
  }

  private filter(): TransactionFilter {
    return {
      ...monthRange(this.month()),
      accountId: this.accountId() || undefined,
      categoryId: this.categoryId() || undefined,
      type: this.type() || undefined,
      search: this.search() || undefined,
    };
  }
}
