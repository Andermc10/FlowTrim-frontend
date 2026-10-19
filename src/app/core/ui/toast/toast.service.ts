import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

import { correlationReference } from '../../http-error.interceptor';
import { I18nService } from '../../i18n/i18n.service';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  route: string;
}

export interface ToastOptions {
  title?: string;
  /** Milisegundos; null = permanece hasta que el usuario lo cierre. */
  duration?: number | null;
  action?: ToastAction;
  /** Identificador de correlación (HU-41) que el usuario puede copiar y reportar. */
  reference?: string | null;
}

export interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  message: string;
  duration: number | null;
  action: ToastAction | null;
  reference: string | null;
  createdAt: number;
}

/** Duraciones por variante: los errores se leen con más calma que una confirmación. */
export const toastDurations: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
};

/** Máximo de toasts visibles a la vez; el resto se resume como "+N". */
export const maxVisibleToasts = 3;

// Dos toasts idénticos dentro de esta ventana se fusionan (evita duplicados por doble clic).
const duplicateWindowMs = 1000;

/** Cola global de notificaciones toast (HU-53). Solo estado: el host las pinta y anima. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly i18n = inject(I18nService);
  private readonly toastsState = signal<Toast[]>([]);
  private nextId = 1;

  /** Todas las notificaciones activas, la más reciente primero. */
  readonly toasts = this.toastsState.asReadonly();
  readonly visible = computed(() => this.toastsState().slice(0, maxVisibleToasts));
  readonly hiddenCount = computed(() => Math.max(0, this.toastsState().length - maxVisibleToasts));

  success(message: string, options?: ToastOptions): number {
    return this.show('success', message, options);
  }

  error(message: string, options?: ToastOptions): number {
    return this.show('error', message, options);
  }

  warning(message: string, options?: ToastOptions): number {
    return this.show('warning', message, options);
  }

  info(message: string, options?: ToastOptions): number {
    return this.show('info', message, options);
  }

  /**
   * Toast de error para una respuesta HTTP fallida: mensaje traducido según el estado y la referencia
   * de correlación cuando la API la devolvió.
   */
  httpError(error: HttpErrorResponse, options?: Omit<ToastOptions, 'reference'>): number {
    const key = error.status === 0 ? 'toast.error.network' : error.status === 404 ? 'toast.error.notFound' : 'toast.error.unexpected';
    return this.error(this.i18n.translate(key), { ...options, reference: correlationReference(error) });
  }

  show(variant: ToastVariant, message: string, options: ToastOptions = {}): number {
    const title = options.title ?? this.i18n.translate(`toast.title.${variant}`);
    const now = Date.now();
    const duplicate = this.toastsState().find(
      (toast) => toast.variant === variant && toast.message === message && toast.title === title
        && now - toast.createdAt < duplicateWindowMs,
    );
    if (duplicate) {
      return duplicate.id;
    }

    const toast: Toast = {
      id: this.nextId++,
      variant,
      title,
      message,
      duration: options.duration === undefined ? toastDurations[variant] : options.duration,
      action: options.action ?? null,
      reference: options.reference ?? null,
      createdAt: now,
    };
    this.toastsState.update((toasts) => [toast, ...toasts]);
    return toast.id;
  }

  dismiss(id: number): void {
    this.toastsState.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  clear(): void {
    this.toastsState.set([]);
  }
}
