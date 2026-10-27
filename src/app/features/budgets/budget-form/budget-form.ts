import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import { BudgetResponse } from '../budgets.models';
import { BudgetsService } from '../budgets-service';
import { AccountsService } from '../../accounts/accounts-service';
import { AccountResponse } from '../../accounts/accounts.models';
import { CategoriesService } from '../../categories/categories-service';
import { CategoryResponse } from '../../categories/categories.models';
import { ValidationProblemDetails } from '../../subscriptions/models/subscription.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { FieldError } from '../../../core/forms/field-error';
import { ErrorMessages, FormValidators, visibleErrorKey } from '../../../core/forms/form-validators';
import { CategoryIcon } from '../../../core/ui/icon/category-icon';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { conflictErrorToast } from '../../../core/ui/toast/conflict-toast';

type FieldName = 'categoryId' | 'currency' | 'limit';

const fieldMessages: Record<FieldName, ErrorMessages> = {
  categoryId: [['required', 'budgets.form.categoryRequired']],
  currency: [['currencyCode', 'form.currencyCode']],
  limit: [['required', 'budgets.form.limitRequired'], ['min', 'form.amountPositive'], ['maxDecimals', 'form.amountDecimals']],
};

/**
 * Crear o editar un presupuesto (EP-15 HU-76). Al crear se elige una categoría de gastos activa (chips), la moneda (las
 * de tus cuentas activas) y el límite; al editar solo cambia el límite.
 */
@Component({
  selector: 'app-budget-form',
  imports: [ReactiveFormsModule, TranslatePipe, FieldError, CategoryIcon],
  templateUrl: './budget-form.html',
  styleUrl: './budget-form.scss',
})
export class BudgetForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(BudgetsService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Presupuesto que se edita; nulo al crear. */
  @Input() budget: BudgetResponse | null = null;
  @Output() readonly saved = new EventEmitter<void>();
  @Output() readonly closeRequested = new EventEmitter<void>();

  protected readonly saving = signal(false);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly categories = signal<CategoryResponse[]>([]);
  private readonly accounts = signal<AccountResponse[]>([]);

  /** Monedas de las cuentas activas (COP si aún no hay cuentas). */
  protected readonly currencies = computed(() => {
    const unique = [...new Set(this.accounts().filter((a) => !a.isArchived).map((a) => a.currency))].sort();
    return unique.length > 0 ? unique : ['COP'];
  });

  protected readonly form = this.fb.group({
    categoryId: this.fb.nonNullable.control('', [Validators.required]),
    currency: this.fb.nonNullable.control('COP', [FormValidators.currencyCode]),
    limit: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01), FormValidators.maxDecimals(2)]),
  });

  protected get isEdit(): boolean {
    return this.budget !== null;
  }

  ngOnInit(): void {
    if (this.budget) {
      this.form.patchValue({ categoryId: this.budget.categoryId, currency: this.budget.currency, limit: this.budget.limit });
      return;
    }

    forkJoin({
      categories: this.categoriesService.list({ kind: 'Expense' }).pipe(catchError(() => of([] as CategoryResponse[]))),
      accounts: this.accountsService.list().pipe(catchError(() => of([] as AccountResponse[]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ categories, accounts }) => {
        this.categories.set(categories.filter((category) => !category.isArchived));
        this.accounts.set(accounts);
        this.form.controls.currency.setValue(this.currencies()[0]);
      });
  }

  protected submit(): void {
    this.fieldErrors.set({});
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const limit = value.limit as number;
    this.saving.set(true);
    const request = this.budget
      ? this.service.update(this.budget.id, { limit })
      : this.service.create({ categoryId: value.categoryId, currency: value.currency, limit });
    request.subscribe({
      next: (budget) => {
        this.toast.success(this.i18n.translate(this.budget ? 'budgets.toast.updated' : 'budgets.toast.created', { name: budget.categoryName }));
        this.saved.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        if (error.status === 400 && error.error) {
          this.fieldErrors.set((error.error as ValidationProblemDetails).errors ?? {});
          return;
        }
        conflictErrorToast(this.toast, this.i18n, error, ['budget_exists'], 'budgets.conflict');
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
