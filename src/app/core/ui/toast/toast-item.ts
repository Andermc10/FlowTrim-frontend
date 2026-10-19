import { Component, ElementRef, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { Toast } from './toast.service';

/**
 * Un toast individual: temporizador con pausa al pasar el puntero o el foco, barra de progreso,
 * copia de la referencia de correlación y cierre con Esc o con el botón.
 */
@Component({
  selector: 'app-toast-item',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './toast-item.html',
  styleUrl: './toast-item.scss',
  host: {
    '[class]': "'toast toast--' + toast().variant",
    '[attr.role]': "toast().variant === 'error' || toast().variant === 'warning' ? 'alert' : 'status'",
    '[style.--toast-duration]': "(toast().duration ?? 0) + 'ms'",
    '[class.is-paused]': 'paused()',
    '[class.is-sticky]': 'toast().duration === null',
    '(mouseenter)': 'pause()',
    '(mouseleave)': 'resume()',
    '(focusin)': 'pause()',
    '(focusout)': 'handleFocusOut($event)',
    '(keydown.escape)': 'close()',
  },
})
export class ToastItem implements OnInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly toast = input.required<Toast>();
  readonly dismissed = output<number>();

  protected readonly paused = signal(false);
  protected readonly copied = signal(false);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private remaining = 0;
  private startedAt = 0;

  ngOnInit(): void {
    const duration = this.toast().duration;
    if (duration !== null) {
      this.remaining = duration;
      this.startTimer();
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  protected pause(): void {
    if (this.timer === undefined) {
      return;
    }
    clearTimeout(this.timer);
    this.timer = undefined;
    this.remaining -= Date.now() - this.startedAt;
    this.paused.set(true);
  }

  protected resume(): void {
    if (!this.paused() || this.toast().duration === null) {
      return;
    }
    this.paused.set(false);
    this.startTimer();
  }

  // Solo se reanuda si el foco sale del toast, no al moverse entre sus botones.
  protected handleFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.element.nativeElement.contains(next)) {
      this.resume();
    }
  }

  protected close(): void {
    clearTimeout(this.timer);
    this.dismissed.emit(this.toast().id);
  }

  protected async copyReference(): Promise<void> {
    const reference = this.toast().reference;
    if (!reference) {
      return;
    }
    try {
      await navigator.clipboard.writeText(reference);
    } catch {
      // Sin portapapeles (HTTP o permisos): se deja seleccionado el texto para copiarlo a mano.
      const code = this.element.nativeElement.querySelector('.toast__reference code');
      if (code) {
        window.getSelection()?.selectAllChildren(code);
      }
    }
    this.copied.set(true);
  }

  private startTimer(): void {
    this.startedAt = Date.now();
    this.timer = setTimeout(() => this.close(), Math.max(0, this.remaining));
  }
}
