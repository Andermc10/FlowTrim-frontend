import { Component, Input } from '@angular/core';

export type IconName = 'close' | 'delete' | 'edit' | 'paid' | 'plus' | 'usage';

@Component({
  selector: 'app-icon',
  template: `
    @switch (name) {
      @case ('close') {
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      }
      @case ('delete') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
        </svg>
      }
      @case ('edit') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m4 16.5-.7 3.7 3.7-.7L18.7 7.8a2.1 2.1 0 0 0-3-3L4 16.5ZM14.5 6.5l3 3" />
        </svg>
      }
      @case ('paid') {
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.3l2.7 2.7L16.2 9.4" /></svg>
      }
      @case ('plus') {
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      }
      @case ('usage') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 19V5M4 19h16M7 15l3-4 3 2 4-6" />
        </svg>
      }
    }
  `,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      width: 1.05rem;
      height: 1.05rem;
    }
    svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.8;
    }
  `,
})
export class Icon {
  @Input({ required: true }) name!: IconName;
}
