import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AccountResponse, AccountType, accountTypes, CreateAccountRequest } from '../accounts.models';
import { AccountsService } from '../accounts-service';
import { accountErrorToast } from '../account-errors';
import { ValidationProblemDetails } from '../../subscriptions/models/subscription.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { FieldError } from '../../../core/forms/field-error';
import { ErrorMessages, FormValidators, visibleErrorKey } from '../../../core/forms/form-validators';

type FieldName = 'name' | 'currency' | 'openingBalance';

/** Límite del dominio (Account.NameMaxLength en la API). */
export const accountNameMaxLength = 60;

// Mensaje de cada regla, en el orden en que se muestran (HU-55).
const fieldMessages: Record<FieldName, ErrorMessages> = {
  name: [['required', 'form.nameRequired'], ['maxlength', 'accounts.form.nameLength']],
  currency: [['currencyCode', 'form.currencyCode']],
  openingBalance: [['required', 'accounts.form.openingBalanceRequired'], ['maxDecimals', 'form.amountDecimals']],
};

/**
 * Crear o editar una cuenta dentro de un modal (HU-64). Al editar, el archivado no se toca aquí (tiene su propia
 * acción) y la moneda queda bloqueada si la cuenta ya tiene movimientos.
 */
@Component({
  selector: 'app-account-form',
  imports: [ReactiveFormsModule, TranslatePipe, FieldError],
  templateUrl: './account-form.html',
  styleUrl: './account-form.scss',
})
export class AccountForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AccountsService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Cuenta a editar; nula para crear. */
  @Input() account: AccountResponse | null = null;
  @Output() readonly saved = new EventEmitter<AccountResponse>();
  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly dirtyChange = new EventEmitter<boolean>();

  protected readonly saving = signal(false);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly types = accountTypes;
  protected readonly nameMaxLength = accountNameMaxLength;

  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [FormValidators.requiredText, Validators.maxLength(accountNameMaxLength)]),
    type: this.fb.nonNullable.control<AccountType>('Bank', [Validators.required]),
    currency: this.fb.nonNullable.control('COP', [FormValidators.currencyCode]),
    // Puede ser negativo: una tarjeta que ya debe dinero.
    openingBalance: this.fb.control<number | null>(0, [Validators.required, FormValidators.maxDecimals(2)]),
  });

  /** La moneda de una cuenta con movimientos no cambia (409 account_currency_locked en la API). */
  protected get currencyLocked(): boolean {
    return this.account?.hasTransactions ?? false;
  }

  ngOnInit(): void {
    if (this.account) {
      this.form.setValue({
        name: this.account.name,
        type: this.account.type,
        currency: this.account.currency,
        openingBalance: this.account.openingBalance,
      });
      if (this.currencyLocked) {
        this.form.controls.currency.disable();
      }
    }
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.dirtyChange.emit(this.form.dirty));
  }

  protected submit(): void {
    this.fieldErrors.set({});
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: CreateAccountRequest = {
      name: value.name.trim(),
      type: value.type,
      currency: value.currency.trim().toUpperCase(),
      openingBalance: value.openingBalance as number,
    };

    this.saving.set(true);
    const existing = this.account;
    const call = existing
      ? this.service.update(existing.id, { ...request, isArchived: existing.isArchived })
      : this.service.create(request);
    call.subscribe({
      next: (account) => {
        this.saving.set(false);
        this.toast.success(this.i18n.translate(existing ? 'toast.accountUpdated' : 'toast.accountCreated', { name: account.name }));
        this.saved.emit(account);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        if (error.status === 400 && error.error) {
          this.fieldErrors.set((error.error as ValidationProblemDetails).errors ?? {});
          return;
        }
        accountErrorToast(this.toast, this.i18n, error);
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

  /** El código de moneda se escribe siempre en mayúsculas. */
  protected upperCaseCurrency(): void {
    const control = this.form.controls.currency;
    const upper = control.value.toUpperCase();
    if (upper !== control.value) {
      control.setValue(upper);
    }
  }
}
