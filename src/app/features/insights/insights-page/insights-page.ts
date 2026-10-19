import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, map, takeWhile, timer } from 'rxjs';

import { correlationReference } from '../../../core/http-error.interceptor';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MoneyPipe } from '../../../core/format/money.pipe';
import { dateLabel, localeFor, numberLabel } from '../../../core/format/money';
import { InsightFigure, InsightsAnswer, questionMaxLength } from '../insights.models';
import { InsightsService } from '../insights-service';

/** Error visible: clave de traducción y referencia de soporte (solo para fallos inesperados del proveedor). */
interface InsightsError {
  key: string;
  reference: string | null;
}

/**
 * Pantalla de Insights (HU-36): una pregunta a la vez, la respuesta y la evidencia determinista del backend.
 * Todo texto del servidor se muestra por interpolación (nunca HTML) y nada se guarda en el navegador.
 */
@Component({
  selector: 'app-insights-page',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, MoneyPipe],
  templateUrl: './insights-page.html',
  styleUrl: './insights-page.scss',
})
export class InsightsPage {
  static readonly DefaultRetrySeconds = 60;

  protected readonly maxLength = questionMaxLength;
  protected readonly suggestions = ['monthly', 'upcoming', 'categories', 'annual'];

  // Fuentes que tienen una pantalla determinista donde el usuario puede comprobar la cifra.
  private static readonly SourceRoutes: Record<string, string> = {
    summary: '/app/summary',
    analytics: '/app/analytics',
    'upcoming-charges': '/app/upcoming',
    simulator: '/app/simulator',
  };

  private readonly insights = inject(InsightsService);
  protected readonly i18n = inject(I18nService);

  protected readonly question = new FormControl('', { nonNullable: true });
  protected readonly asked = signal<string | null>(null);
  protected readonly pending = signal(false);
  protected readonly result = signal<InsightsAnswer | null>(null);
  protected readonly error = signal<InsightsError | null>(null);
  protected readonly waitSeconds = signal(0);

  private readonly questionValue = toSignal(this.question.valueChanges, { initialValue: '' });
  protected readonly length = computed(() => this.questionValue().length);
  protected readonly canSubmit = computed(() => {
    const trimmed = this.questionValue().trim().length;
    return trimmed > 0 && trimmed <= questionMaxLength && !this.pending() && this.waitSeconds() === 0;
  });

  private request?: Subscription;
  private countdown?: Subscription;

  constructor() {
    // Salir de la página cancela la petición en curso (la API la registra como cancelada por el cliente).
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      this.countdown?.unsubscribe();
    });
  }

  protected ask(): void {
    if (!this.canSubmit()) {
      return;
    }

    const question = this.question.value.trim();
    this.error.set(null);
    this.result.set(null);
    this.asked.set(question);
    this.pending.set(true);
    this.request = this.insights.ask(question).subscribe({
      next: (answer) => {
        this.pending.set(false);
        this.result.set(answer);
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.asked.set(null);
        this.showError(error);
      },
    });
  }

  // Formulario nativo con un solo control: se evita la recarga y se reutiliza la misma validación.
  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.ask();
  }

  protected askSuggestion(suggestion: string): void {
    this.question.setValue(this.i18n.translate(`insights.suggestion.${suggestion}`));
    this.ask();
  }

  protected cancel(): void {
    this.request?.unsubscribe();
    this.pending.set(false);
    this.asked.set(null);
  }

  // Enter envía y Shift+Enter agrega una línea; durante la composición de un IME no se envía nada.
  protected onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey || keyboard.isComposing) {
      return;
    }
    keyboard.preventDefault();
    this.ask();
  }

  protected figureTitle(figure: InsightFigure): string {
    return this.translateOr(`insights.figure.${figure.kind}`, figure.label);
  }

  protected figureDetail(figure: InsightFigure): string {
    const parts: string[] = [];
    if (figure.subject) {
      parts.push(figure.subject);
    }
    if (figure.months !== undefined) {
      parts.push(this.i18n.translate('simulator.months', { count: figure.months }));
    }
    if (figure.date) {
      parts.push(dateLabel(figure.date, this.locale()));
    }
    return parts.join(' · ');
  }

  protected countLabel(value: number): string {
    return numberLabel(value, this.locale());
  }

  protected assumptionText(key: string, text: string): string {
    return this.translateOr(`insights.assumption.${key}`, text);
  }

  protected sourceLabel(source: string): string {
    return this.translateOr(`insights.source.${source}`, source);
  }

  protected sourceRoute(source: string): string | null {
    return InsightsPage.SourceRoutes[source] ?? null;
  }

  private showError(error: HttpErrorResponse): void {
    switch (error.status) {
      case 400:
        this.error.set({ key: 'insights.error.invalid', reference: null });
        return;
      case 401:
        // El interceptor de autenticación ya cerró la sesión y ofrece volver a entrar.
        return;
      case 429:
        this.error.set({ key: 'insights.error.rateLimited', reference: null });
        this.startCountdown(retryAfterSeconds(error));
        return;
      case 502:
        this.error.set({ key: 'insights.error.unavailable', reference: correlationReference(error) });
        return;
      case 504:
        this.error.set({ key: 'insights.error.timeout', reference: correlationReference(error) });
        return;
      default:
        this.error.set({
          key: error.status === 0 ? 'insights.error.network' : 'insights.error.generic',
          reference: correlationReference(error),
        });
    }
  }

  private startCountdown(seconds: number): void {
    this.countdown?.unsubscribe();
    this.countdown = timer(0, 1000)
      .pipe(
        map((elapsed) => seconds - elapsed),
        takeWhile((remaining) => remaining >= 0),
      )
      .subscribe((remaining) => {
        this.waitSeconds.set(remaining);
        if (remaining === 0) {
          this.error.set(null);
        }
      });
  }

  private translateOr(key: string, fallback: string): string {
    const text = this.i18n.translate(key);
    return text === key ? fallback : text;
  }

  private locale(): string {
    return localeFor(this.i18n.language());
  }
}

/** Segundos de espera de la cabecera Retry-After; si falta o no es un entero positivo, 60 s. */
export function retryAfterSeconds(error: HttpErrorResponse): number {
  const seconds = Number(error.headers?.get('Retry-After'));
  return Number.isInteger(seconds) && seconds > 0 ? seconds : InsightsPage.DefaultRetrySeconds;
}
