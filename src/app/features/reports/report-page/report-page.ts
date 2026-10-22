import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { localeFor, monthLabel, moneyFormatter } from '../../../core/format/money';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { FlowTrimChart } from '../../../core/ui/chart/chart';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { AnalyticsService } from '../../analytics/analytics-service';
import { CurrencyAnalytics } from '../../analytics/analytics.models';
import { SubscriptionResponse, UpcomingChargeItem } from '../../subscriptions/models/subscription.models';
import { SubscriptionService } from '../../subscriptions/services/subscription-service';
import { SummaryService } from '../../summary/summary-service';
import { CurrencySummary } from '../../summary/summary.models';
import { saveFile } from '../../../core/files/save-file';
import { ReportsService } from '../reports-service';

type ReportStatus = 'loading' | 'ready' | 'error';

/** Máximo de próximos cobros en el reporte para que quepa en una página. */
const upcomingLimit = 10;

/**
 * Reporte imprimible (HU-52): resumen, gráficos, suscripciones, próximos cobros y supuestos en una hoja clara
 * que el navegador guarda como PDF con su diálogo de impresión (@media print). También exporta el CSV.
 */
@Component({
  selector: 'app-report-page',
  imports: [RouterLink, TranslatePipe, FlowTrimChart],
  templateUrl: './report-page.html',
  styleUrl: './report-page.scss',
})
export class ReportPage implements OnInit {
  private readonly summaryService = inject(SummaryService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly reportsService = inject(ReportsService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  protected readonly status = signal<ReportStatus>('loading');
  protected readonly summary = signal<CurrencySummary[]>([]);
  protected readonly analytics = signal<CurrencyAnalytics[]>([]);
  protected readonly subscriptions = signal<SubscriptionResponse[]>([]);
  protected readonly upcoming = signal<UpcomingChargeItem[]>([]);
  protected readonly exporting = signal(false);
  protected readonly generatedAt = signal(new Date());

  protected readonly isEmpty = computed(() => this.status() === 'ready' && this.subscriptions().length === 0);
  private readonly locale = computed(() => localeFor(this.i18n.language()));
  /**
   * Datos de los gráficos por moneda, calculados una vez por cambio de datos o idioma: pasar arrays nuevos
   * en cada ciclo de detección haría que los gráficos se reconstruyeran sin parar.
   */
  protected readonly chartData = computed(() => {
    const locale = this.locale();
    return this.analytics().map((currency) => ({
      currency: currency.currency,
      format: moneyFormatter(currency.currency, locale),
      categoryLabels: currency.byCategory.map((c) =>
        c.category === 'Uncategorized' ? this.i18n.translate('analytics.uncategorized') : c.category),
      categoryValues: currency.byCategory.map((c) => c.monthlyEquivalent),
      monthLabels: currency.expectedCharges.map((m) => monthLabel(m.month, locale)),
      monthValues: currency.expectedCharges.map((m) => m.amount),
    }));
  });

  protected readonly generatedLabel = computed(() =>
    new Intl.DateTimeFormat(this.locale(), { dateStyle: 'long', timeStyle: 'short' }).format(this.generatedAt()));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    forkJoin({
      summary: this.summaryService.getSummary(),
      analytics: this.analyticsService.getAnalytics(),
      subscriptions: this.subscriptionService.listAll(),
      upcoming: this.subscriptionService.getUpcoming(),
    }).subscribe({
      next: ({ summary, analytics, subscriptions, upcoming }) => {
        this.summary.set(summary.currencies);
        this.analytics.set(analytics.currencies);
        this.subscriptions.set([...subscriptions].sort((a, b) => a.name.localeCompare(b.name)));
        this.upcoming.set(upcoming.items.slice(0, upcomingLimit));
        this.generatedAt.set(new Date());
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  protected money(value: number, currency: string): string {
    return moneyFormatter(currency, this.locale())(value);
  }

  protected print(): void {
    window.print();
  }

  protected exportCsv(): void {
    this.exporting.set(true);
    const today = new Date().toISOString().slice(0, 10);
    this.reportsService.downloadSubscriptionsCsv(today).subscribe({
      next: (file) => {
        saveFile(file);
        this.exporting.set(false);
        this.toast.success(this.i18n.translate('report.exported', { file: file.fileName }));
      },
      error: (error) => {
        this.exporting.set(false);
        this.toast.httpError(error);
      },
    });
  }
}
