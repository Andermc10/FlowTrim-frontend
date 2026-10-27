import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { GoalResponse } from '../goals.models';
import { GoalsService } from '../goals-service';
import { ValidationProblemDetails } from '../../subscriptions/models/subscription.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MoneyPipe } from '../../../core/format/money.pipe';
import { FieldError } from '../../../core/forms/field-error';
import { ErrorMessages, FormValidators, visibleErrorKey } from '../../../core/forms/form-validators';
import { productToday } from '../../../core/format/product-calendar';
import { ToastService } from '../../../core/ui/toast/toast.service';

type FieldName = 'amount' | 'date' | 'note';
type Mode = 'deposit' | 'withdrawal';

const fieldMessages: Record<FieldName, ErrorMessages> = {
  amount: [['required', 'form.amountRequired'], ['min', 'form.amountPositive'], ['maxDecimals', 'form.amountDecimals']],
  date: [['required', 'goals.contribution.dateRequired'], ['notAfter', 'goals.contribution.dateInFuture']],
  note: [['maxlength', 'goals.contribution.noteLength']],
};

/**
 * Aporte o retiro declarado de una meta (EP-15 HU-77, D6). El usuario escribe un importe positivo y elige si es un
 * aporte o un retiro; la API recibe el retiro en negativo. No mueve dinero entre cuentas.
 */
@Component({
  selector: 'app-contribution-form',
  imports: [ReactiveFormsModule, TranslatePipe, MoneyPipe, FieldError],
  templateUrl: './contribution-form.html',
  styleUrl: '../goal-dialogs.scss',
})
export class ContributionForm {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(GoalsService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  @Input({ required: true }) goal!: GoalResponse;
  @Output() readonly saved = new EventEmitter<void>();
  @Output() readonly closeRequested = new EventEmitter<void>();

  protected readonly saving = signal(false);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly today = productToday();

  protected readonly form = this.fb.group({
    mode: this.fb.nonNullable.control<Mode>('deposit'),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01), FormValidators.maxDecimals(2)]),
    date: this.fb.nonNullable.control(this.today, [Validators.required, FormValidators.notAfter(() => this.today)]),
    note: this.fb.nonNullable.control('', [Validators.maxLength(200)]),
  });

  protected submit(): void {
    this.fieldErrors.set({});
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const amount = (value.amount as number) * (value.mode === 'withdrawal' ? -1 : 1);
    this.saving.set(true);
    this.service.contribute(this.goal.id, { amount, date: value.date, note: value.note.trim() || null }).subscribe({
      next: () => {
        this.toast.success(this.i18n.translate(
          value.mode === 'withdrawal' ? 'goals.toast.withdrawn' : 'goals.toast.contributed', { name: this.goal.name }));
        this.saved.emit();
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
