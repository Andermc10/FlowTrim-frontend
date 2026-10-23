import { Component, Input } from '@angular/core';

export type IconName =
  | 'archive'
  | 'bank'
  | 'card'
  | 'cash'
  | 'close'
  | 'delete'
  | 'edit'
  | 'paid'
  | 'plus'
  | 'restore'
  | 'savings'
  | 'usage';

@Component({
  selector: 'app-icon',
  template: `
    @switch (name) {
      @case ('archive') {
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v4H3zM5 9v10h14V9M10 13h4" /></svg>
      }
      @case ('bank') {
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></svg>
      }
      @case ('card') {
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3zM3 10h18M7 15h4" /></svg>
      }
      @case ('cash') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v4M18 10v4" />
        </svg>
      }
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
      @case ('restore') {
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" /></svg>
      }
      @case ('savings') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 11a7 6 0 0 1 12.6-3.5H20v4l-2 1.2V16h-3v2h-3v-2H9v2H6v-3.2A6 6 0 0 1 5 11ZM15 10h.01" />
        </svg>
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
