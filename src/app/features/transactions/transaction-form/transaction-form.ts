import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
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
import { localeFor, moneyFormatter } from '../../../core/format/money';
import { productToday } from '../../../core/format/product-calendar';
import { CategoryIcon } from '../../../core/ui/icon/category-icon';
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
 *
 * En modo registro rápido (HU-67) el foco empieza en el importe, las categorías son chips ordenados por uso (Enter sobre
 * un chip guarda) y "Guardar y agregar otro" deja el formulario listo con el mismo tipo y la misma cuenta.
 */
@Component({
  selector: 'app-transaction-form',
  imports: [NgTemplateOutlet, ReactiveFormsModule, TranslatePipe, FieldError, CategoryIcon],
  templateUrl: './transaction-form.html',
  styleUrl: './transaction-form.scss',
})
export class TransactionForm implements OnInit, AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(TransactionsService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Movimiento a editar; nulo para registrar uno nuevo. */
  @Input() transaction: TransactionResponse | null = null;
  @Input({ required: true }) accounts: readonly AccountResponse[] = [];
  @Input({ required: true }) categories: readonly CategoryResponse[] = [];
  /** Modo registro rápido (HU-67). */
  @Input() quickAdd = false;
  /** Cuenta preseleccionada al registrar (la última usada); se ignora si ya no está disponible. */
  @Input() initialAccountId: string | null = null;
  /** Usos recientes por categoría: ordena los chips de más a menos usada. */
  @Input() categoryUsage: ReadonlyMap<string, number> = new Map();
  @Output() readonly saved = new EventEmitter<TransactionResponse>();
  /** "Guardar y agregar otro": se guardó y el formulario sigue abierto para el siguiente. */
  @Output() readonly savedAndContinued = new EventEmitter<TransactionResponse>();
  @ViewChild('amountInput') private readonly amountInput?: ElementRef<HTMLInputElement>;
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
    const usage = this.categoryUsage;
    return this.categories
      .filter((category) => category.kind === kind && (!category.isArchived || category.id === this.transaction?.categoryId))
      // Más usadas primero (registro rápido); sin usos se conserva el orden de la API (por nombre).
      .map((category, index) => ({ category, index, uses: usage.get(category.id) ?? 0 }))
      .sort((a, b) => b.uses - a.uses || a.index - b.index)
      .map((entry) => entry.category);
  });

  /** En el registro rápido de gastos e ingresos la cuenta (ya preseleccionada) va después de las categorías. */
  protected readonly accountAfterCategories = computed(() => this.quickAdd && this.type() !== 'Transfer');

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
      const remembered = this.sourceAccounts().find((account) => account.id === this.initialAccountId);
      const firstAccount = remembered ?? this.sourceAccounts()[0];
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

  /**
   * En el registro rápido el foco empieza en el importe (HU-67 FR-2). Se espera a que el modal padre abra el diálogo,
   * porque showModal() mueve el foco al primer elemento enfocable (el botón de cerrar).
   */
  ngAfterViewInit(): void {
    if (this.quickAdd) {
      queueMicrotask(() => this.amountInput?.nativeElement.focus());
    }
  }

  protected isTransfer(): boolean {
    return this.form?.controls.type.value === 'Transfer';
  }

  /** Enter sobre un chip de categoría lo elige y guarda: el registro rápido se completa solo con teclado (HU-67 AC-1). */
  protected chooseCategoryAndSubmit(event: Event, categoryId: string): void {
    event.preventDefault();
    this.form.controls.categoryId.setValue(categoryId);
    this.submit();
  }

  protected submit(addAnother = false): void {
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
        this.toast.success(this.successMessage(saved, existing !== null));
        if (addAnother) {
          this.resetForNext();
          this.savedAndContinued.emit(saved);
          return;
        }
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

  // En el registro rápido el aviso dice qué se guardó ("Gasto registrado · Comida · COP 38.900").
  private successMessage(saved: TransactionResponse, updated: boolean): string {
    if (updated) {
      return this.i18n.translate('toast.transactionUpdated');
    }
    if (!this.quickAdd) {
      return this.i18n.translate('toast.transactionCreated');
    }
    const detail = saved.type === 'Transfer' ? `${saved.accountName} → ${saved.toAccountName}` : saved.categoryName ?? '';
    return this.i18n.translate(`toast.quickAdded.${saved.type}`, {
      detail,
      amount: moneyFormatter(saved.currency, localeFor(this.i18n.language()))(saved.amount),
    });
  }

  // Deja el formulario listo para el siguiente: mismo tipo, cuenta y fecha; importe, categoría y textos vacíos.
  private resetForNext(): void {
    const { type, accountId, toAccountId, date } = this.form.getRawValue();
    this.form.reset({ type, accountId, toAccountId, date, categoryId: '', amount: null, description: '', note: '' });
    this.dirtyChange.emit(false);
    this.amountInput?.nativeElement.focus();
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
