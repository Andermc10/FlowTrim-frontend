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

import {
  CategoryColor,
  CategoryConflictCode,
  CategoryIconName,
  CategoryKind,
  CategoryResponse,
  CreateCategoryRequest,
  categoryColors,
  categoryIcons,
  categoryKinds,
} from '../categories.models';
import { CategoriesService } from '../categories-service';
import { ValidationProblemDetails } from '../../subscriptions/models/subscription.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CategoryIcon } from '../../../core/ui/icon/category-icon';
import { conflictErrorToast } from '../../../core/ui/toast/conflict-toast';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { FieldError } from '../../../core/forms/field-error';
import { ErrorMessages, FormValidators, visibleErrorKey } from '../../../core/forms/form-validators';

/** Límite del dominio (Category.NameMaxLength en la API). */
export const categoryNameMaxLength = 40;

export const categoryConflictCodes: readonly CategoryConflictCode[] = ['category_in_use', 'category_kind_locked'];

const nameMessages: ErrorMessages = [['required', 'form.nameRequired'], ['maxlength', 'categories.form.nameLength']];

/**
 * Crear o editar una categoría dentro de un modal (HU-65). Color e ícono se eligen en grupos de opciones (radios
 * nativos: flechas del teclado y lectores de pantalla funcionan sin código extra). La clase queda bloqueada si la
 * categoría ya tiene movimientos.
 */
@Component({
  selector: 'app-category-form',
  imports: [ReactiveFormsModule, TranslatePipe, FieldError, CategoryIcon],
  templateUrl: './category-form.html',
  styleUrl: './category-form.scss',
})
export class CategoryForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CategoriesService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Categoría a editar; nula para crear. */
  @Input() category: CategoryResponse | null = null;
  /** Clase inicial al crear (el botón de cada grupo la fija). */
  @Input() initialKind: CategoryKind = 'Expense';
  @Output() readonly saved = new EventEmitter<CategoryResponse>();
  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly dirtyChange = new EventEmitter<boolean>();

  protected readonly saving = signal(false);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly kinds = categoryKinds;
  protected readonly colors = categoryColors;
  protected readonly icons = categoryIcons;
  protected readonly nameMaxLength = categoryNameMaxLength;

  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [FormValidators.requiredText, Validators.maxLength(categoryNameMaxLength)]),
    kind: this.fb.nonNullable.control<CategoryKind>('Expense'),
    color: this.fb.nonNullable.control<CategoryColor>('teal'),
    icon: this.fb.nonNullable.control<CategoryIconName>('other'),
  });

  /** La clase de una categoría usada no cambia (409 category_kind_locked en la API). */
  protected get kindLocked(): boolean {
    return this.category?.hasTransactions ?? false;
  }

  ngOnInit(): void {
    if (this.category) {
      this.form.setValue({
        name: this.category.name,
        kind: this.category.kind,
        color: this.category.color,
        icon: this.category.icon,
      });
      if (this.kindLocked) {
        this.form.controls.kind.disable();
      }
    } else {
      this.form.controls.kind.setValue(this.initialKind);
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
    const request: CreateCategoryRequest = { name: value.name.trim(), kind: value.kind, color: value.color, icon: value.icon };

    this.saving.set(true);
    const existing = this.category;
    const call = existing
      ? this.service.update(existing.id, { ...request, isArchived: existing.isArchived })
      : this.service.create(request);
    call.subscribe({
      next: (category) => {
        this.saving.set(false);
        this.toast.success(this.i18n.translate(existing ? 'toast.categoryUpdated' : 'toast.categoryCreated', { name: category.name }));
        this.saved.emit(category);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        if (error.status === 400 && error.error) {
          this.fieldErrors.set((error.error as ValidationProblemDetails).errors ?? {});
          return;
        }
        conflictErrorToast(this.toast, this.i18n, error, categoryConflictCodes, 'categories.error');
      },
    });
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected nameErrorKey(): string | null {
    return visibleErrorKey(this.form.controls.name, nameMessages);
  }

  protected nameInvalid(): boolean {
    return this.nameErrorKey() !== null || this.errorsFor('name').length > 0;
  }
}
