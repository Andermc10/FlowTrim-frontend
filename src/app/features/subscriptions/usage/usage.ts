import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  CostPerUseResponse,
  SubscriptionResponse,
  UsageRecordResponse,
  ValidationProblemDetails,
} from '../models/subscription.models';
import { SubscriptionService } from '../services/subscription-service';
import { toUserMessage } from '../../../core/http-error.interceptor';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

type UsageStatus = 'loading' | 'ready' | 'notfound' | 'error';

@Component({
  selector: 'app-usage',
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './usage.html',
  styleUrl: './usage.scss',
})
export class Usage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(SubscriptionService);
  private readonly route = inject(ActivatedRoute);

  private id = '';
  protected readonly status = signal<UsageStatus>('loading');
  protected readonly subscription = signal<SubscriptionResponse | null>(null);
  protected readonly records = signal<UsageRecordResponse[]>([]);
  protected readonly costPerUse = signal<CostPerUseResponse | null>(null);
  protected readonly costPerUseLoading = signal(false);
  protected readonly costPerUseError = signal(false);
  protected readonly saving = signal(false);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly generalError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly form = this.fb.group({
    usageDate: this.fb.nonNullable.control('', [Validators.required]),
    usageCount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    notes: this.fb.nonNullable.control('', [Validators.maxLength(500)]),
  });

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.costPerUse.set(null);
    this.costPerUseError.set(false);
    this.service.get(this.id).subscribe({
      next: (subscription) => {
        this.subscription.set(subscription);
        this.loadRecords();
      },
      error: (error: HttpErrorResponse) => this.status.set(error.status === 404 ? 'notfound' : 'error'),
    });
  }

  private loadRecords(): void {
    this.service.listUsage(this.id).subscribe({
      next: (records) => {
        this.records.set(records);
        this.status.set('ready');
        this.loadCostPerUse();
      },
      error: () => this.status.set('error'),
    });
  }

  protected loadCostPerUse(): void {
    this.costPerUseLoading.set(true);
    this.costPerUseError.set(false);
    this.service.getCostPerUse(this.id).subscribe({
      next: (result) => {
        this.costPerUse.set(result);
        this.costPerUseLoading.set(false);
      },
      error: () => {
        this.costPerUseLoading.set(false);
        this.costPerUseError.set(true);
      },
    });
  }

  protected submit(): void {
    this.generalError.set(null);
    this.successMessage.set(null);
    this.fieldErrors.set({});

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.service
      .registerUsage(this.id, {
        usageDate: value.usageDate,
        usageCount: value.usageCount as number,
        notes: value.notes.trim() ? value.notes.trim() : null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.successMessage.set('Usage recorded.');
          this.form.reset();
          this.loadRecords();
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          if (error.status === 400 && error.error) {
            this.fieldErrors.set((error.error as ValidationProblemDetails).errors ?? {});
          } else {
            this.generalError.set(toUserMessage(error));
          }
        },
      });
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }
}
