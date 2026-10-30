import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';

import { CalendarDay, CalendarResponse } from '../calendar.models';
import { CalendarService } from '../calendar-service';
import { monthOf, shiftMonth } from '../../transactions/transaction-days';
import { MarkPaidDialog } from '../../subscriptions/mark-paid-dialog/mark-paid-dialog';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MoneyPipe } from '../../../core/format/money.pipe';
import { capitalizeFirst, localeFor, monthTitle } from '../../../core/format/money';
import { productToday } from '../../../core/format/product-calendar';

type PageStatus = 'loading' | 'success' | 'error';

/** Celda de la cuadrícula: un día del mes o un hueco antes del día 1 (la semana empieza el lunes). */
type GridCell = { day: CalendarDay; number: number } | null;

/**
 * Calendario financiero del mes (EP-14 HU-75): qué se espera pagar cada día y qué se registró de verdad. Escritorio:
 * cuadrícula del mes y panel del día elegido; móvil: lista de los días con algo. Lo esperado no es un pago: desde el
 * panel se puede marcar como pagado o abrir la página del proveedor.
 */
@Component({
  selector: 'app-calendar-page',
  imports: [NgTemplateOutlet, TranslatePipe, MoneyPipe, MarkPaidDialog],
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.scss',
})
export class CalendarPage implements OnInit {
  private readonly service = inject(CalendarService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly today = productToday();
  protected readonly month = signal(monthOf(this.today));
  protected readonly status = signal<PageStatus>('loading');
  protected readonly calendar = signal<CalendarResponse | null>(null);
  protected readonly selectedDate = signal<string | null>(null);
  protected readonly payTargetId = signal<string | null>(null);

  private readonly reload$ = new Subject<void>();

  protected readonly monthTitle = computed(() => monthTitle(this.month(), localeFor(this.i18n.language())));

  /** Nombres cortos de lunes a domingo en el idioma de la interfaz (5 ene 2026 fue lunes). */
  protected readonly weekdays = computed(() => {
    const format = new Intl.DateTimeFormat(localeFor(this.i18n.language()), { weekday: 'short', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, index) => format.format(new Date(Date.UTC(2026, 0, 5 + index))));
  });

  protected readonly cells = computed<GridCell[]>(() => {
    const days = this.calendar()?.days ?? [];
    if (days.length === 0) {
      return [];
    }
    const [year, monthNumber] = days[0].date.split('-').map(Number);
    const offset = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
    return [...Array.from({ length: offset }, () => null), ...days.map((day, index) => ({ day, number: index + 1 }))];
  });

  /** Días con algo esperado o registrado, para la lista móvil y el estado vacío. */
  protected readonly busyDays = computed(() =>
    (this.calendar()?.days ?? []).filter((day) => day.expected.length > 0 || day.recorded.length > 0),
  );

  protected readonly selectedDay = computed(() =>
    this.calendar()?.days.find((day) => day.date === this.selectedDate()) ?? null,
  );

  ngOnInit(): void {
    this.reload$
      .pipe(
        tap(() => this.status.set('loading')),
        switchMap(() => this.service.get(this.month()).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((calendar) => {
        if (!calendar) {
          this.status.set('error');
          return;
        }
        this.calendar.set(calendar);
        this.selectDefaultDay(calendar);
        this.status.set('success');
      });
    this.reload$.next();
  }

  // Hoy si cae en el mes; si no, el primer día con algo; si no, el día 1.
  private selectDefaultDay(calendar: CalendarResponse): void {
    const keep = calendar.days.some((day) => day.date === this.selectedDate());
    if (keep) {
      return;
    }
    const today = calendar.days.find((day) => day.date === calendar.today);
    const busy = calendar.days.find((day) => day.expected.length > 0 || day.recorded.length > 0);
    this.selectedDate.set((today ?? busy ?? calendar.days[0])?.date ?? null);
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

  protected select(day: CalendarDay): void {
    this.selectedDate.set(day.date);
  }

  /** Suma lo esperado de un día por moneda, para el resumen de la celda. */
  protected expectedByCurrency(day: CalendarDay): { currency: string; amount: number }[] {
    const totals = new Map<string, number>();
    for (const charge of day.expected) {
      totals.set(charge.currency, Math.round(((totals.get(charge.currency) ?? 0) + charge.amount) * 100) / 100);
    }
    return [...totals].map(([currency, amount]) => ({ currency, amount }));
  }

  protected hasOverdue(day: CalendarDay): boolean {
    return day.expected.some((charge) => charge.isOverdue);
  }

  /** Etiqueta larga del día para el panel y la lista ("lunes, 20 de octubre"). */
  protected dayLabel(date: string): string {
    const [year, monthNumber, day] = date.split('-').map(Number);
    const locale = localeFor(this.i18n.language());
    const label = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, monthNumber - 1, day)));
    return capitalizeFirst(label, locale);
  }

  protected markPaid(subscriptionId: string): void {
    this.payTargetId.set(subscriptionId);
  }

  protected handlePaid(): void {
    this.payTargetId.set(null);
    this.reload$.next();
  }
}
