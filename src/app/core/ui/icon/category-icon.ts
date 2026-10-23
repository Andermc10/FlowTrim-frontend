import { Component, computed, input } from '@angular/core';

/**
 * Íconos de categoría (HU-65): un trazo SVG propio por clave de la lista fija de la API. Se dibujan con [attr.d],
 * así que nunca se inserta HTML ni SVG aportado por el usuario. Una clave desconocida muestra "other".
 */
const paths: Record<string, string> = {
  food: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-1.7 1.3-2.5 3.3-2.5 6 0 1.4.8 2.5 2.5 2.5V21M16 3v18',
  groceries: 'M3 5h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 8H6.2M9 20h.01M17 20h.01',
  transport: 'M5 16V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v8M5 12h14M5 16h14v2H5zM8 18v2M16 18v2M8 14h.01M16 14h.01',
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5h4v5',
  utilities: 'M13 2 5 13h6l-1 9 8-11h-6l1-9Z',
  health: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10ZM12 9v5M9.5 11.5h5',
  education: 'M2 9l10-5 10 5-10 5L2 9ZM6 11v5c3.5 2.5 8.5 2.5 12 0v-5M22 9v6',
  entertainment: 'M4 6h16v12H4zM10 9.5v5l4.5-2.5L10 9.5Z',
  shopping: 'M6 8h12l-1 12H7L6 8ZM9 8V6a3 3 0 0 1 6 0v2',
  travel: 'M10.5 13.5 3 11l1.5-1.5 8 .5 4.5-4.5a2 2 0 0 1 3 3l-4.5 4.5.5 8L14.5 22 12 14.5l-3 3V20l-1.5 1.5-1-3.5-3.5-1L4.5 15.5H7l3.5-2Z',
  gifts: 'M4 10h16v4H4zM5.5 14v7h13v-7M12 10v11M12 10C9 10 7.5 8.5 8 7s3 0 4 3c1-3 3.5-4.5 4-3s-1 3-4 3',
  subscriptions: 'M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6M17 3v3.5h3.5M7 21v-3.5H3.5',
  salary: 'M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v4M18 10v4',
  freelance: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16M11 13v2h2v-2',
  investments: 'M4 19V5M4 19h16M7 15l4-4 3 3 5-6M15 8h4v4',
  other: 'M5 12h.01M12 12h.01M19 12h.01',
};

@Component({
  selector: 'app-category-icon',
  template: `<svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="path()" /></svg>`,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      width: 1.1rem;
      height: 1.1rem;
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
export class CategoryIcon {
  readonly name = input.required<string>();
  protected readonly path = computed(() => paths[this.name()] ?? paths['other']);
}
