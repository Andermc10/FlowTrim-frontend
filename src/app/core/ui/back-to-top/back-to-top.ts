import { Component, signal } from '@angular/core';

import { TranslatePipe } from '../../i18n/translate.pipe';

/** Desplazamiento a partir del cual aparece el botón. */
export const backToTopThreshold = 600;

/**
 * Botón "volver arriba" compartido por el landing y el workspace (HU-63). Aparece tras desplazarse, vuelve al inicio
 * (sin animación si el usuario pide reducir movimiento) y lleva el foco al título principal de la página. La distancia
 * al borde inferior sale de `--back-to-top-bottom`, para quedar sobre la navegación móvil.
 */
@Component({
  selector: 'app-back-to-top',
  imports: [TranslatePipe],
  host: { '(window:scroll)': 'onScroll()' },
  template: `
    <button
      type="button"
      class="back-to-top"
      [class.is-visible]="visible()"
      [attr.aria-hidden]="!visible()"
      [tabIndex]="visible() ? 0 : -1"
      [attr.aria-label]="'common.backToTop' | translate"
      [attr.title]="'common.backToTop' | translate"
      (click)="scrollToTop()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
    </button>
  `,
  styles: `
    .back-to-top {
      position: fixed;
      right: 1.25rem;
      bottom: var(--back-to-top-bottom, 1.5rem);
      z-index: 15;
      display: grid;
      place-items: center;
      width: 2.9rem;
      height: 2.9rem;
      padding: 0;
      border: 1px solid var(--color-primary-soft-strong);
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-primary);
      box-shadow: 0 0.8rem 2rem var(--color-shadow);
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transform: translateY(0.75rem) scale(0.9);
      transition: opacity 200ms ease, transform 200ms ease, background 160ms ease;
    }
    .back-to-top.is-visible { opacity: 1; pointer-events: auto; transform: none; }
    .back-to-top:hover, .back-to-top:focus-visible { background: var(--color-primary-soft); }
    .back-to-top:focus-visible { outline: 3px solid var(--color-primary-soft-strong); outline-offset: 2px; }
    svg { width: 1.2rem; height: 1.2rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    @media (prefers-reduced-motion: reduce) { .back-to-top { transition: none; } }
  `,
})
export class BackToTop {
  protected readonly visible = signal(false);

  protected onScroll(): void {
    this.visible.set(window.scrollY > backToTopThreshold);
  }

  protected scrollToTop(): void {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });

    // El foco vuelve al título principal: con teclado se sigue leyendo desde el inicio de la página.
    const heading = document.querySelector<HTMLElement>('main h1');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) {
        heading.setAttribute('tabindex', '-1');
      }
      heading.focus({ preventScroll: true });
    }
  }
}
