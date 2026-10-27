import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import { SubscriptionResponse, ValidationProblemDetails } from '../models/subscription.models';
import { SubscriptionService } from '../services/subscription-service';
import { SubscriptionActions } from '../services/subscription-actions';
import { AccountsService } from '../../accounts/accounts-service';
import { AccountResponse } from '../../accounts/accounts.models';
import { CategoriesService } from '../../categories/categories-service';
import { CategoryResponse } from '../../categories/categories.models';
import { Modal } from '../../../core/ui/modal/modal';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MoneyPipe } from '../../../core/format/money.pipe';
import { productToday } from '../../../core/format/product-calendar';
import { FieldError } from '../../../core/forms/field-error';
import { ErrorMessages, FormValidators, visibleErrorKey } from '../../../core/forms/form-validators';
import { CategoryIcon } from '../../../core/ui/icon/category-icon';

type DialogStatus = 'loading' | 'ready' | 'saving' | 'error';
type Mode = 'record' | 'dateOnly';
type FieldName = 'accountId' | 'amount' | 'date' | 'categoryId';

const fieldMessages: Record<FieldName, ErrorMessages> = {
  accountId: [['required', 'markPaid.accountRequired']],
  amount: [['required', 'form.amountRequired'], ['min', 'form.amountPositive'], ['maxDecimals', 'form.amountDecimals']],
  date: [['required', 'markPaid.dateRequired'], ['notAfter', 'markPaid.dateInFuture']],
  categoryId: [['required', 'markPaid.categoryRequired']],
};

/**
 * Diálogo "Marcar como pagado" (EP-14 HU-73): registrar el gasto en una cuenta de la moneda del pago (importe, fecha y
 * categoría editables; las facturas varían) o solo mover la próxima fecha. Registrar viene marcado cuando el pago tiene
 * cuenta por defecto. Si no hay cuentas en esa moneda, solo se puede mover la fecha y se explica por qué.
 */
@Component({
  selector: 'app-mark-paid-dialog',
  imports: [ReactiveFormsModule, Modal, TranslatePipe, MoneyPipe, FieldError, CategoryIcon],
  templateUrl: './mark-paid-dialog.html',
  styleUrl: './mark-paid-dialog.scss',
})
export class MarkPaidDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly subscriptions = inject(SubscriptionService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly actions = inject(SubscriptionActions);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) subscriptionId!: string;
  @Output() readonly paid = new EventEmitter<void>();
  @Output() readonly closeRequested = new EventEmitter<void>();

  protected readonly status = signal<DialogStatus>('loading');
  protected readonly payment = signal<SubscriptionResponse | null>(null);
  private readonly accounts = signal<AccountResponse[]>([]);
  protected readonly categories = signal<CategoryResponse[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly today = productToday();

  /** Cuentas activas en la moneda del pago: FlowTrim nunca convierte monedas. */
  protected readonly accountOptions = computed(() => {
    const currency = this.payment()?.currency;
    return this.accounts().filter((account) => !account.isArchived && account.currency === currency);
  });

  protected readonly form = this.fb.group({
    mode: this.fb.nonNullable.control<Mode>('record'),
    accountId: this.fb.nonNullable.control('', [Validators.required]),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01), FormValidators.maxDecimals(2)]),
    date: this.fb.nonNullable.control(this.today, [Validators.required, FormValidators.notAfter(() => this.today)]),
    categoryId: this.fb.nonNullable.control('', [Validators.required]),
  });

  ngOnInit(): void {
    forkJoin({
      payment: this.subscriptions.get(this.subscriptionId),
      accounts: this.accountsService.list().pipe(catchError(() => of([] as AccountResponse[]))),
      categories: this.categoriesService.list({ kind: 'Expense' }).pipe(catchError(() => of([] as CategoryResponse[]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ payment, accounts, categories }) => {
          this.payment.set(payment);
          this.accounts.set(accounts);
          this.categories.set(categories.filter((category) => !category.isArchived));
          this.prefill(payment);
          this.status.set('ready');
        },
        error: () => this.status.set('error'),
      });
  }

  // Valores por defecto del pago (EP-14 D7); si su cuenta por defecto ya no sirve, se elige la única disponible.
  private prefill(payment: SubscriptionResponse): void {
    const options = this.accountOptions();
    const account = options.find((a) => a.id === payment.defaultAccountId) ?? (options.length === 1 ? options[0] : null);
    const category = this.categories().find((c) => c.id === payment.categoryId);
    this.form.patchValue({
      mode: options.length > 0 && (payment.defaultAccountId !== null || options.length === 1) ? 'record' : 'dateOnly',
      accountId: account?.id ?? '',
      amount: payment.amount,
      categoryId: category?.id ?? '',
    });
  }

  protected get recording(): boolean {
    return this.form.controls.mode.value === 'record';
  }

  protected submit(): void {
    this.fieldErrors.set({});
    const payment = this.payment();
    if (!payment) {
      return;
    }

    const recordFields = [this.form.controls.accountId, this.form.controls.amount, this.form.controls.date, this.form.controls.categoryId];
    if (this.recording && recordFields.some((control) => control.invalid)) {
      recordFields.forEach((control) => control.markAsTouched());
      return;
    }

    const value = this.form.getRawValue();
    const request = this.recording
      ? { accountId: value.accountId, amount: value.amount as number, date: value.date, categoryId: value.categoryId }
      : null;
    this.status.set('saving');
    this.actions.markPaid(payment, request).subscribe({
      next: () => this.paid.emit(),
      error: (error: HttpErrorResponse) => {
        if (error.status === 400 && request) {
          this.fieldErrors.set((error.error as ValidationProblemDetails | null)?.errors ?? {});
        }
        this.status.set('ready');
      },
    });
  }

  protected errorKey(field: FieldName): string | null {
    return visibleErrorKey(this.form.controls[field], fieldMessages[field]);
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected isInvalid(field: FieldName): boolean {
    return this.errorKey(field) !== null || this.errorsFor(field).length > 0;
  }
}
