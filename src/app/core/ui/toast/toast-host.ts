import { Component, ElementRef, effect, inject } from '@angular/core';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { ToastItem } from './toast-item';
import { ToastService } from './toast.service';

/**
 * Contenedor de toasts del workspace. Usa la Popover API para vivir en la capa superior del navegador,
 * igual que los <dialog> modales, de modo que los toasts nunca quedan tapados por un modal.
 */
@Component({
  selector: 'app-toast-host',
  imports: [ToastItem, TranslatePipe],
  template: `
    <section class="toast-stack" aria-live="polite" aria-relevant="additions" [attr.aria-label]="'toast.region' | translate">
      @for (toast of toasts.visible(); track toast.id) {
        <app-toast-item [toast]="toast" (dismissed)="toasts.dismiss($event)"
          animate.enter="toast-enter" animate.leave="toast-leave" />
      }
      @if (toasts.hiddenCount() > 0) {
        <p class="toast-more">{{ 'toast.more' | translate: { count: toasts.hiddenCount() } }}</p>
      }
    </section>
  `,
  styleUrl: './toast-host.scss',
  host: { popover: 'manual' },
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // El popover se abre con el primer toast y no se cierra al vaciarse (pointer-events: none), así los
    // toasts visibles no reinician sus animaciones. Solo se reabre si hay un <dialog> modal abierto, para
    // subir de nuevo a lo más alto de la capa superior.
    let previousCount = 0;
    effect(() => {
      const count = this.toasts.toasts().length;
      const host = this.element.nativeElement;
      const added = count > previousCount;
      previousCount = count;
      if (!added || typeof host.showPopover !== 'function') {
        return;
      }
      const isOpen = host.matches(':popover-open');
      if (isOpen && document.querySelector('dialog[open]')) {
        host.hidePopover();
        host.showPopover();
      } else if (!isOpen) {
        host.showPopover();
      }
    });
  }
}
