import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { GoalRequest, GoalResponse } from '../goals.models';
import { GoalsService } from '../goals-service';
import { ValidationProblemDetails } from '../../subscriptions/models/subscription.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { FieldError } from '../../../core/forms/field-error';
import { ErrorMessages, FormValidators, visibleErrorKey } from '../../../core/forms/form-validators';
import { productToday } from '../../../core/format/product-calendar';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { conflictErrorToast } from '../../../core/ui/toast/conflict-toast';

type FieldName = 'name' | 'currency' | 'target' | 'targetDate';

const fieldMessages: Record<FieldName, ErrorMessages> = {
  name: [['required', 'form.nameRequired'], ['maxlength', 'goals.form.nameLength']],
  currency: [['currencyCode', 'form.currencyCode']],
  target: [['required', 'goals.form.targetRequired'], ['min', 'form.amountPositive'], ['maxDecimals', 'form.amountDecimals']],
  targetDate: [['notBefore', 'goals.form.dateInPast']],
};

/** Crear o editar una meta de ahorro (EP-15 HU-77): nombre, objetivo, moneda y fecha objetivo opcional. */
@Component({
  selector: 'app-goal-form',
  imports: [ReactiveFormsModule, TranslatePipe, FieldError],
  templateUrl: './goal-form.html',
  styleUrl: '../goal-dialogs.scss',
})
export class GoalForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(GoalsService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  @Input() goal: GoalResponse | null = null;
  @Output() readonly saved = new EventEmitter<void>();
  @Output() readonly closeRequested = new EventEmitter<void>();

  protected readonly saving = signal(false);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly today = productToday();
  // Fecha guardada al editar: si no cambia se acepta aunque ya pasó.
  private keptDate: string | null = null;

  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [FormValidators.requiredText, Validators.maxLength(60)]),
    target: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01), FormValidators.maxDecimals(2)]),
    currency: this.fb.nonNullable.control('COP', [FormValidators.currencyCode]),
    targetDate: this.fb.nonNullable.control('', [FormValidators.notBefore(() => this.today, () => this.keptDate)]),
  });

  ngOnInit(): void {
    if (this.goal) {
      this.keptDate = this.goal.targetDate;
      this.form.setValue({
        name: this.goal.name,
        target: this.goal.target,
        currency: this.goal.currency,
        targetDate: this.goal.targetDate ?? '',
      });
    }
  }

  /** El código de moneda se escribe siempre en mayúsculas. */
  protected upperCaseCurrency(): void {
    const control = this.form.controls.currency;
    if (control.value !== control.value.toUpperCase()) {
      control.setValue(control.value.toUpperCase());
    }
  }

  protected submit(): void {
    this.fieldErrors.set({});
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: GoalRequest = {
      name: value.name.trim(),
      target: value.target as number,
      currency: value.currency.trim().toUpperCase(),
      targetDate: value.targetDate || null,
    };
    this.saving.set(true);
    (this.goal ? this.service.update(this.goal.id, request) : this.service.create(request)).subscribe({
      next: (goal) => {
        this.toast.success(this.i18n.translate(this.goal ? 'goals.toast.updated' : 'goals.toast.created', { name: goal.name }));
        this.saved.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        if (error.status === 400 && error.error) {
          this.fieldErrors.set((error.error as ValidationProblemDetails).errors ?? {});
          return;
        }
        conflictErrorToast(this.toast, this.i18n, error, ['goal_currency_locked'], 'goals.conflict');
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
