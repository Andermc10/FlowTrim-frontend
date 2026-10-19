import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CurrencySummary } from '../summary.models';
import { SummaryService } from '../summary-service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MoneyPipe } from '../../../core/format/money.pipe';

type DashboardStatus = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-summary-dashboard',
  imports: [RouterLink, TranslatePipe, MoneyPipe],
  templateUrl: './summary-dashboard.html',
  styleUrl: './summary-dashboard.scss',
})
export class SummaryDashboard implements OnInit {
  private readonly service = inject(SummaryService);

  protected readonly status = signal<DashboardStatus>('loading');
  protected readonly currencies = signal<CurrencySummary[]>([]);
  protected readonly isEmpty = computed(
    () => this.status() === 'success' && this.currencies().length === 0,
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.service.getSummary().subscribe({
      next: (summary) => {
        this.currencies.set(summary.currencies);
        this.status.set('success');
      },
      error: () => this.status.set('error'),
    });
  }
}
