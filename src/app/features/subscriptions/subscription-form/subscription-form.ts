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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import {
  BillingCycle,
  CreateSubscriptionRequest,
  SubscriptionStatus,
  UpdateSubscriptionRequest,
  ValidationProblemDetails,
} from '../models/subscription.models';
import { SubscriptionService } from '../services/subscription-service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { productToday } from '../../../core/format/product-calendar';
import { FieldError } from '../../../core/forms/field-error';
import { ErrorMessages, FormValidators, visibleErrorKey } from '../../../core/forms/form-validators';

type FormStatus = 'idle' | 'loading' | 'saving' | 'error';

type FieldName = 'name' | 'category' | 'amount' | 'currency' | 'nextBillingDate';

/** Límites del dominio (Subscription.NameMaxLength / CategoryMaxLength en la API). */
export const nameMaxLength = 120;
export const categoryMaxLength = 60;

// Mensaje de cada regla, en el orden en que se muestran (HU-55).
const fieldMessages: Record<FieldName, ErrorMessages> = {
  name: [['required', 'form.nameRequired'], ['maxlength', 'form.nameLength']],
  category: [['maxlength', 'form.categoryLength']],
  amount: [['required', 'form.amountRequired'], ['min', 'form.amountPositive'], ['maxDecimals', 'form.amountDecimals']],
  currency: [['currencyCode', 'form.currencyCode']],
  nextBillingDate: [['required', 'form.dateRequired'], ['notBefore', 'form.dateInPast']],
};

@Component({
  selector: 'app-subscription-form',
  imports: [ReactiveFormsModule, TranslatePipe, FieldError],
  templateUrl: './subscription-form.html',
  styleUrl: './subscription-form.scss',
})
export class SubscriptionForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(SubscriptionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() modalMode: 'create' | 'edit' | null = null;
  @Input() subscriptionId: string | null = null;
  @Output() readonly saved = new EventEmitter<void>();
  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly dirtyChange = new EventEmitter<boolean>();

  protected readonly status = signal<FormStatus>('idle');
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  // Clave del error al cargar la suscripción a editar: reemplaza al formulario (no hay nada que editar).
  protected readonly loadError = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly isEdit = computed(() => this.editingId() !== null);

  protected readonly billingCycles: readonly BillingCycle[] = ['Monthly', 'Yearly'];
  protected readonly statuses: readonly SubscriptionStatus[] = ['Active', 'Inactive'];

  /** Hoy en el calendario del producto: mínimo del selector de fecha y de la validación (HU-56). */
  protected readonly today = productToday();
  protected readonly nameMaxLength = nameMaxLength;
  protected readonly categoryMaxLength = categoryMaxLength;

  // Fecha guardada al editar: si no cambia, se acepta aunque ya esté vencida.
  private originalNextBillingDate: string | null = null;

  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [FormValidators.requiredText, Validators.maxLength(nameMaxLength)]),
    category: this.fb.nonNullable.control('', [Validators.maxLength(categoryMaxLength)]),
    amount: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      FormValidators.maxDecimals(2),
    ]),
    currency: this.fb.nonNullable.control('COP', [FormValidators.currencyCode]),
    billingCycle: this.fb.nonNullable.control<BillingCycle>('Monthly', [Validators.required]),
    nextBillingDate: this.fb.nonNullable.control('', [
      Validators.required,
      FormValidators.notBefore(() => this.today, () => this.originalNextBillingDate),
    ]),
    status: this.fb.nonNullable.control<SubscriptionStatus>('Active', [Validators.required]),
  });

  ngOnInit(): void {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.dirtyChange.emit(this.form.dirty));
    const id = this.subscriptionId ?? this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editingId.set(id);
      this.load(id);
    }
  }

  private load(id: string): void {
    this.status.set('loading');
    this.service.get(id).subscribe({
      next: (subscription) => {
        this.form.setValue({
          name: subscription.name,
          category: subscription.category ?? '',
          amount: subscription.amount,
          currency: subscription.currency,
          billingCycle: subscription.billingCycle,
          nextBillingDate: subscription.nextBillingDate,
          status: subscription.status,
        });
        this.originalNextBillingDate = subscription.nextBillingDate;
        this.form.markAsPristine();
        this.dirtyChange.emit(false);
        this.status.set('idle');
      },
      error: (error: HttpErrorResponse) => {
        this.loadError.set(error.status === 404 ? 'common.notFound' : 'form.loadError');
        this.status.set('error');
      },
    });
  }

  protected submit(): void {
    this.fieldErrors.set({});

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const base: CreateSubscriptionRequest = {
      name: value.name.trim(),
      category: value.category.trim() ? value.category.trim() : null,
      amount: value.amount as number,
      currency: value.currency.trim().toUpperCase(),
      billingCycle: value.billingCycle,
      nextBillingDate: value.nextBillingDate,
    };

    this.status.set('saving');

    const editingId = this.editingId();
    if (editingId) {
      const request: UpdateSubscriptionRequest = { ...base, status: value.status };
      this.service.update(editingId, request).subscribe({
        next: () => this.finishSave('toast.subscriptionUpdated', base.name),
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
    } else {
      this.service.create(base).subscribe({
        next: () => this.finishSave('toast.subscriptionCreated', base.name),
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
    }
  }

  private handleError(error: HttpErrorResponse): void {
    if (error.status === 400 && error.error) {
      const problem = error.error as ValidationProblemDetails;
      this.fieldErrors.set(problem.errors ?? {});
    } else {
      // Fallos inesperados: toast con la referencia de correlación (HU-41/HU-53).
      this.toast.httpError(error);
    }
    this.status.set('error');
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  /** Mensaje de validación en vivo del campo, o null si no hay que mostrar ninguno (HU-55). */
  protected errorKey(field: FieldName): string | null {
    return visibleErrorKey(this.form.controls[field], fieldMessages[field]);
  }

  /** Marca el campo como inválido para tecnologías de asistencia (validación en vivo o error del servidor). */
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

  protected cancel(): void {
    if (this.modalMode) {
      this.closeRequested.emit();
      return;
    }
    this.router.navigate(['/app/subscriptions']);
  }

  private finishSave(messageKey: string, name: string): void {
    this.toast.success(this.i18n.translate(messageKey, { name }));
    if (this.modalMode) {
      this.saved.emit();
      return;
    }
    this.router.navigate(['/app/subscriptions']);
  }
}
