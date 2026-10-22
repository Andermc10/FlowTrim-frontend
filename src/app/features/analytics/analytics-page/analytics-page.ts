import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { localeFor, monthLabel, moneyFormatter } from '../../../core/format/money';
import { FlowTrimChart } from '../../../core/ui/chart/chart';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { AnalyticsService } from '../analytics-service';
import { CurrencyAnalytics } from '../analytics.models';

type AnalyticsStatus = 'loading' | 'success' | 'error';

/**
 * Pantalla de analítica (HU-51): convierte los números de HU-50 en tres gráficos con su tabla de datos.
 * No calcula nada; solo formatea y elige qué moneda mostrar.
 */
@Component({
  selector: 'app-analytics-page',
  imports: [RouterLink, TranslatePipe, FlowTrimChart],
  templateUrl: './analytics-page.html',
  styleUrl: './analytics-page.scss',
})
export class AnalyticsPage implements OnInit {
  private readonly service = inject(AnalyticsService);
  protected readonly i18n = inject(I18nService);

  protected readonly status = signal<AnalyticsStatus>('loading');
  protected readonly currencies = signal<CurrencyAnalytics[]>([]);
  protected readonly selectedCurrency = signal<string | null>(null);

  protected readonly isEmpty = computed(
    () => this.status() === 'success' && this.currencies().length === 0,
  );
  protected readonly current = computed(() => {
    const currencies = this.currencies();
    return (
      currencies.find((c) => c.currency === this.selectedCurrency()) ?? currencies.at(0) ?? null
    );
  });

  private readonly locale = computed(() => localeFor(this.i18n.language()));

  protected readonly money = computed(() =>
    moneyFormatter(this.current()?.currency ?? 'COP', this.locale()),
  );

  protected readonly categoryLabels = computed(
    () => this.current()?.byCategory.map((c) => this.categoryName(c.category)) ?? [],
  );
  protected readonly categoryValues = computed(
    () => this.current()?.byCategory.map((c) => c.monthlyEquivalent) ?? [],
  );
  protected readonly topLabels = computed(
    () => this.current()?.topSubscriptions.map((t) => t.name) ?? [],
  );
  protected readonly topValues = computed(
    () => this.current()?.topSubscriptions.map((t) => t.monthlyEquivalent) ?? [],
  );
  protected readonly monthLabels = computed(
    () => this.current()?.expectedCharges.map((m) => this.monthName(m.month)) ?? [],
  );
  protected readonly monthValues = computed(
    () => this.current()?.expectedCharges.map((m) => m.amount) ?? [],
  );

  /** Meses pico: los que superan el cobro mensual más frecuente (p. ej. cuando cae una anual). */
  protected readonly peakMonths = computed(() => {
    const values = this.monthValues();
    if (values.length === 0) {
      return [];
    }
    const baseline = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    return values.flatMap((value, index) => (value > baseline ? [index] : []));
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.service.getAnalytics().subscribe({
      next: (response) => {
        this.currencies.set(response.currencies);
        this.selectedCurrency.set(response.currencies[0]?.currency ?? null);
        this.status.set('success');
      },
      error: () => this.status.set('error'),
    });
  }

  protected selectCurrency(currency: string): void {
    this.selectedCurrency.set(currency);
  }

  protected categoryName(category: string): string {
    return category === 'Uncategorized' ? this.i18n.translate('analytics.uncategorized') : category;
  }

  protected monthName(month: string): string {
    return monthLabel(month, this.locale());
  }
}
