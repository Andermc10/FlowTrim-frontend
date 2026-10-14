import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  BillingCycle,
  CreateSubscriptionRequest,
  SubscriptionResponse,
  ValidationProblemDetails,
} from '../models/subscription.models';
import { SubscriptionService } from '../services/subscription-service';

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-subscription-form',
  imports: [ReactiveFormsModule],
  templateUrl: './subscription-form.html',
  styleUrl: './subscription-form.scss',
})
export class SubscriptionForm {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(SubscriptionService);

  protected readonly status = signal<FormStatus>('idle');
  protected readonly created = signal<SubscriptionResponse | null>(null);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly generalError = signal<string | null>(null);

  protected readonly billingCycles: readonly BillingCycle[] = ['Monthly', 'Yearly'];

  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(120)]),
    category: this.fb.nonNullable.control('', [Validators.maxLength(60)]),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    currency: this.fb.nonNullable.control('COP', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]),
    billingCycle: this.fb.nonNullable.control<BillingCycle>('Monthly', [Validators.required]),
    nextBillingDate: this.fb.nonNullable.control('', [Validators.required]),
  });

  protected submit(): void {
    this.generalError.set(null);
    this.fieldErrors.set({});

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: CreateSubscriptionRequest = {
      name: value.name.trim(),
      category: value.category.trim() ? value.category.trim() : null,
      amount: value.amount as number,
      currency: value.currency.trim().toUpperCase(),
      billingCycle: value.billingCycle,
      nextBillingDate: value.nextBillingDate,
    };

    this.status.set('loading');
    this.service.create(request).subscribe({
      next: (response) => {
        this.created.set(response);
        this.status.set('success');
        this.form.reset();
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 400 && error.error) {
          const problem = error.error as ValidationProblemDetails;
          this.fieldErrors.set(problem.errors ?? {});
        } else {
          this.generalError.set('Something went wrong. Please try again.');
        }
        this.status.set('error');
      },
    });
  }

  /** Errores devueltos por la API para un campo (clave en camelCase). */
  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  /** Vuelve al formulario tras un alta exitosa para registrar otra suscripción. */
  protected startAnother(): void {
    this.status.set('idle');
    this.created.set(null);
  }
}
