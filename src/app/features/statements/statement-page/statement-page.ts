import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { StatementResponse } from '../statements.models';
import { monthOf, shiftMonth } from '../../transactions/transaction-days';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MoneyPipe } from '../../../core/format/money.pipe';
import { localeFor } from '../../../core/format/money';
import { productToday } from '../../../core/format/product-calendar';
import { CategoryIcon } from '../../../core/ui/icon/category-icon';

type PageStatus = 'loading' | 'success' | 'error';

/**
 * Estado de cuenta mensual (EP-16 HU-78): ingresos, gastos, neto y tasa de ahorro por moneda, comparados con el mes
 * anterior, y las categorías con más gasto. Solo cuenta lo registrado; las transferencias no son ingreso ni gasto.
 */
@Component({
  selector: 'app-statement-page',
  imports: [TranslatePipe, MoneyPipe, CategoryIcon],
  templateUrl: './statement-page.html',
  styleUrl: './statement-page.scss',
})
export class StatementPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly month = signal(monthOf(productToday()));
  protected readonly status = signal<PageStatus>('loading');
  protected readonly statement = signal<StatementResponse | null>(null);
  private readonly reload$ = new Subject<void>();

  protected readonly monthTitle = computed(() => this.title(this.month()));
  protected readonly previousTitle = computed(() => this.title(shiftMonth(this.month(), -1)));

  ngOnInit(): void {
    this.reload$
      .pipe(
        tap(() => this.status.set('loading')),
        switchMap(() =>
          this.http
            .get<StatementResponse>(`${environment.apiUrl}/api/statements`, { params: new HttpParams().set('month', this.month()) })
            .pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((statement) => {
        this.statement.set(statement);
        this.status.set(statement ? 'success' : 'error');
      });
    this.reload$.next();
  }

  protected load(): void {
    this.reload$.next();
  }

  protected changeMonth(delta: number): void {
    this.month.set(shiftMonth(this.month(), delta));
    this.reload$.next();
  }

  protected setMonth(value: string): void {
    if (/^\d{4}-\d{2}$/.test(value)) {
      this.month.set(value);
      this.reload$.next();
    }
  }

  /** Flecha y texto del cambio del gasto (nunca solo color): ↑ más gasto, ↓ menos gasto. */
  protected changeKey(change: number | null): string {
    if (change === null) {
      return 'statement.noComparison';
    }
    return change > 0 ? 'statement.spentMore' : change < 0 ? 'statement.spentLess' : 'statement.spentSame';
  }

  protected abs(value: number): number {
    return Math.abs(value);
  }

  private title(month: string): string {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Intl.DateTimeFormat(localeFor(this.i18n.language()), { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  }
}
