import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { toUserMessage } from '../../../core/http-error.interceptor';

type FormStatus = 'idle' | 'loading' | 'saving' | 'error';

@Component({
  selector: 'app-subscription-form',
  imports: [ReactiveFormsModule],
  templateUrl: './subscription-form.html',
  styleUrl: './subscription-form.scss',
})
export class SubscriptionForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(SubscriptionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly status = signal<FormStatus>('idle');
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly generalError = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly isEdit = computed(() => this.editingId() !== null);

  protected readonly billingCycles: readonly BillingCycle[] = ['Monthly', 'Yearly'];
  protected readonly statuses: readonly SubscriptionStatus[] = ['Active', 'Inactive'];

  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(120)]),
    category: this.fb.nonNullable.control('', [Validators.maxLength(60)]),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    currency: this.fb.nonNullable.control('COP', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]),
    billingCycle: this.fb.nonNullable.control<BillingCycle>('Monthly', [Validators.required]),
    nextBillingDate: this.fb.nonNullable.control('', [Validators.required]),
    status: this.fb.nonNullable.control<SubscriptionStatus>('Active', [Validators.required]),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
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
        this.status.set('idle');
      },
      error: () => {
        this.generalError.set('Could not load the subscription.');
        this.status.set('error');
      },
    });
  }

  protected submit(): void {
    this.generalError.set(null);
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
        next: () => this.router.navigate(['']),
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
    } else {
      this.service.create(base).subscribe({
        next: () => this.router.navigate(['']),
        error: (error: HttpErrorResponse) => this.handleError(error),
      });
    }
  }

  private handleError(error: HttpErrorResponse): void {
    if (error.status === 400 && error.error) {
      const problem = error.error as ValidationProblemDetails;
      this.fieldErrors.set(problem.errors ?? {});
    } else {
      this.generalError.set(toUserMessage(error));
    }
    this.status.set('error');
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected cancel(): void {
    this.router.navigate(['']);
  }
}
