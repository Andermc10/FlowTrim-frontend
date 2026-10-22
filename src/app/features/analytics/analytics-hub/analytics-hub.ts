import { Component, ElementRef, signal, viewChildren } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Pestañas del módulo: gráficos y reporte imprimible sobre los mismos datos (HU-59). */
export const analyticsTabs = [
  { path: '/app/analytics', labelKey: 'analytics.tabCharts', exact: true },
  { path: '/app/analytics/report', labelKey: 'analytics.tabReport', exact: false },
] as const;

/**
 * Contenedor de Analítica y reportes: una barra de pestañas (patrón tablist con enlaces del router, flechas para
 * moverse entre pestañas) y el panel con la pestaña activa.
 */
@Component({
  selector: 'app-analytics-hub',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="'nav.analyticsReports' | translate">
      @for (tab of tabs; track tab.path) {
        <a
          #tabLink
          role="tab"
          class="tab"
          [routerLink]="tab.path"
          routerLinkActive="is-active"
          [routerLinkActiveOptions]="{ exact: tab.exact }"
          (isActiveChange)="onActiveChange($index, $event)"
          [attr.aria-selected]="activeTab() === $index"
          [tabIndex]="activeTab() === $index ? 0 : -1"
          (keydown)="onKeydown($event, $index)"
        >
          {{ tab.labelKey | translate }}
        </a>
      }
    </div>
    <div role="tabpanel" class="panel">
      <router-outlet />
    </div>
  `,
  styles: `
    :host { display: block; }
    .tabs {
      display: inline-flex;
      gap: 0.3rem;
      margin-bottom: 1.25rem;
      padding: 0.3rem;
      border: 1px solid var(--color-border);
      border-radius: 0.8rem;
      background: var(--color-surface);
    }
    .tab {
      padding: 0.55rem 1rem;
      border-radius: 0.55rem;
      color: var(--color-muted);
      font-size: 0.8rem;
      font-weight: 800;
      text-decoration: none;
      transition: background 160ms ease, color 160ms ease;
    }
    .tab:hover { color: var(--color-text); }
    .tab.is-active { background: var(--color-primary-soft); color: var(--color-primary); }
    .tab:focus-visible { outline: 3px solid var(--color-primary-soft-strong); outline-offset: 2px; }
    @media print { .tabs { display: none; } }
  `,
})
export class AnalyticsHub {
  protected readonly tabs = analyticsTabs;
  // Con OnPush, isActive de RouterLinkActive no refresca la vista: el evento isActiveChange sí (estado accesible).
  protected readonly activeTab = signal(-1);
  private readonly links = viewChildren<ElementRef<HTMLAnchorElement>>('tabLink');

  protected onActiveChange(index: number, active: boolean): void {
    if (active) {
      this.activeTab.set(index);
    }
  }

  /** Flechas izquierda/derecha (y Inicio/Fin) mueven el foco entre pestañas; Enter las activa como cualquier enlace. */
  protected onKeydown(event: KeyboardEvent, index: number): void {
    const last = this.tabs.length - 1;
    const target = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    this.links()[target].nativeElement.focus();
  }
}
