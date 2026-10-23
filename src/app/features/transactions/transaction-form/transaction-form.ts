import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { TransactionRequest, TransactionResponse, TransactionType, transactionTypes } from '../transactions.models';
import { TransactionsService } from '../transactions-service';
import { AccountResponse } from '../../accounts/accounts.models';
import { CategoryResponse } from '../../categories/categories.models';
import { ValidationProblemDetails } from '../../subscriptions/models/subscription.models';
import { productToday } from '../../../core/format/product-calendar';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { FieldError } from '../../../core/forms/field-error';
import { ErrorMessages, FormValidators, visibleErrorKey } from '../../../core/forms/form-validators';

type FieldName = 'accountId' | 'toAccountId' | 'categoryId' | 'amount' | 'date' | 'description' | 'note';

/** Límites del dominio (Transaction.DescriptionMaxLength / NoteMaxLength en la API). */
export const descriptionMaxLength = 140;
export const noteMaxLength = 500;

const fieldMessages: Record<FieldName, ErrorMessages> = {
  accountId: [['required', 'transactions.form.accountRequired']],
  toAccountId: [['required', 'transactions.form.toAccountRequired']],
  categoryId: [['required', 'transactions.form.categoryRequired']],
  amount: [['required', 'form.amountRequired'], ['min', 'form.amountPositive'], ['maxDecimals', 'form.amountDecimals']],
  date: [['required', 'form.dateRequired'], ['notAfter', 'transactions.form.dateInFuture']],
  description: [['maxlength', 'transactions.form.descriptionLength']],
  note: [['maxlength', 'transactions.form.noteLength']],
};

// Validador "requerido" que solo aplica cuando la condición se cumple (depende del tipo de movimiento).
function requiredWhen(condition: () => boolean) {
  return (control: AbstractControl) => (condition() && !control.value ? { required: true } : null);
}

/**
 * Registrar o editar un ingreso, un gasto o una transferencia (HU-66). Recibe las cuentas y categorías del padre para
 * que el registro rápido (HU-67) pueda reutilizarlo. Las categorías se filtran por clase; las cuentas destino, por la
 * misma moneda (no hay conversión). Las archivadas no se ofrecen, salvo la que ya tiene el movimiento que se edita.
 */
@Component({
  selector: 'app-transaction-form',
  imports: [ReactiveFormsModule, TranslatePipe, FieldError],
  templateUrl: './transaction-form.html',
  styleUrl: './transaction-form.scss',
})
export class TransactionForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(TransactionsService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Movimiento a editar; nulo para registrar uno nuevo. */
  @Input() transaction: TransactionResponse | null = null;
  @Input({ required: true }) accounts: readonly AccountResponse[] = [];
  @Input({ required: true }) categories: readonly CategoryResponse[] = [];
  @Output() readonly saved = new EventEmitter<TransactionResponse>();
  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly dirtyChange = new EventEmitter<boolean>();

  protected readonly saving = signal(false);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly types = transactionTypes;
  protected readonly today = productToday();
  protected readonly descriptionMaxLength = descriptionMaxLength;
  protected readonly noteMaxLength = noteMaxLength;

  protected readonly form = this.fb.group({
    type: this.fb.nonNullable.control<TransactionType>('Expense'),
    accountId: this.fb.nonNullable.control('', [Validators.required]),
    toAccountId: this.fb.nonNullable.control('', [requiredWhen(() => this.isTransfer())]),
    categoryId: this.fb.nonNullable.control('', [requiredWhen(() => !this.isTransfer())]),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01), FormValidators.maxDecimals(2)]),
    date: this.fb.nonNullable.control(this.today, [Validators.required, FormValidators.notAfter(() => this.today)]),
    description: this.fb.nonNullable.control('', [Validators.maxLength(descriptionMaxLength)]),
    note: this.fb.nonNullable.control('', [Validators.maxLength(noteMaxLength)]),
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly type = computed(() => this.value().type ?? 'Expense');

  /** Cuentas que se pueden elegir: activas, más la que ya usa el movimiento editado aunque esté archivada. */
  protected readonly sourceAccounts = computed(() =>
    this.accounts.filter((account) => !account.isArchived || account.id === this.transaction?.accountId));

  /** Destinos de una transferencia: otra cuenta de la misma moneda. */
  protected readonly destinationAccounts = computed(() => {
    const source = this.accounts.find((account) => account.id === this.value().accountId);
    return this.accounts.filter((account) =>
      account.id !== source?.id
      && (!source || account.currency === source.currency)
      && (!account.isArchived || account.id === this.transaction?.toAccountId));
  });

  /** Categorías de la clase del tipo elegido. */
  protected readonly kindCategories = computed(() => {
    const kind = this.type() === 'Income' ? 'Income' : 'Expense';
    return this.categories.filter((category) =>
      category.kind === kind && (!category.isArchived || category.id === this.transaction?.categoryId));
  });

  protected readonly currency = computed(
    () => this.accounts.find((account) => account.id === this.value().accountId)?.currency ?? null);

  ngOnInit(): void {
    const existing = this.transaction;
    if (existing) {
      this.form.setValue({
        type: existing.type,
        accountId: existing.accountId,
        toAccountId: existing.toAccountId ?? '',
        categoryId: existing.categoryId ?? '',
        amount: existing.amount,
        date: existing.date,
        description: existing.description ?? '',
        note: existing.note ?? '',
      });
    } else {
      const firstAccount = this.sourceAccounts()[0];
      if (firstAccount) {
        this.form.controls.accountId.setValue(firstAccount.id);
      }
    }
    this.form.markAsPristine();

    // Al cambiar tipo o cuenta se limpia lo que dejó de ser válido (categoría de otra clase, destino de otra moneda).
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const { categoryId, toAccountId } = this.form.controls;
      if (categoryId.value && !this.kindCategories().some((category) => category.id === categoryId.value)) {
        categoryId.setValue('', { emitEvent: false });
      }
      if (toAccountId.value && !this.destinationAccounts().some((account) => account.id === toAccountId.value)) {
        toAccountId.setValue('', { emitEvent: false });
      }
      categoryId.updateValueAndValidity({ emitEvent: false });
      toAccountId.updateValueAndValidity({ emitEvent: false });
      this.dirtyChange.emit(this.form.dirty);
    });
  }

  protected isTransfer(): boolean {
    return this.form?.controls.type.value === 'Transfer';
  }

  protected submit(): void {
    this.fieldErrors.set({});
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const transfer = value.type === 'Transfer';
    const request: TransactionRequest = {
      type: value.type,
      accountId: value.accountId,
      toAccountId: transfer ? value.toAccountId : null,
      categoryId: transfer ? null : value.categoryId,
      amount: value.amount as number,
      date: value.date,
      description: value.description.trim() || null,
      note: value.note.trim() || null,
    };

    this.saving.set(true);
    const existing = this.transaction;
    const call = existing ? this.service.update(existing.id, request) : this.service.create(request);
    call.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.success(this.i18n.translate(existing ? 'toast.transactionUpdated' : 'toast.transactionCreated'));
        this.saved.emit(saved);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        if (error.status === 400 && error.error) {
          this.fieldErrors.set((error.error as ValidationProblemDetails).errors ?? {});
          return;
        }
        this.toast.httpError(error);
      },
    });
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected errorKey(field: FieldName): string | null {
    return visibleErrorKey(this.form.controls[field], fieldMessages[field]);
  }

  protected isInvalid(field: FieldName): boolean {
    return this.errorKey(field) !== null || this.errorsFor(field).length > 0;
  }
}
