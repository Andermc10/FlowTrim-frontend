import {
  Component,
  ElementRef,
  InjectionToken,
  OnDestroy,
  afterRenderEffect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';

import { ThemeService } from '../../theme/theme.service';

// Solo se registran las piezas usadas (dona y barras) para no cargar todo Chart.js en el bundle.
Chart.register(
  DoughnutController,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

export type ChartKind = 'doughnut' | 'bar' | 'horizontal-bar';

/** Lo mínimo que el componente necesita de una instancia de Chart.js (permite dobles en pruebas). */
export interface ChartHandle {
  destroy(): void;
  resize?(): void;
}

export type ChartFactory = (canvas: HTMLCanvasElement, config: ChartConfiguration) => ChartHandle;

/** Crea el gráfico real; las pruebas lo sustituyen por un doble sin canvas. */
export const CHART_FACTORY = new InjectionToken<ChartFactory>('CHART_FACTORY', {
  providedIn: 'root',
  factory: () => (canvas, config) => new Chart(canvas, config),
});

// Variables Carbon Signal usadas como paleta; se leen en cada render para seguir el tema activo.
// El orden alterna tonos bien distintos; el cian claro va al final para no confundirse con el principal.
const paletteVariables = [
  '--color-primary',
  '--color-success',
  '--color-warning',
  '--color-danger',
  '--color-muted',
  '--color-border-strong',
  '--color-primary-bright',
];

/**
 * Gráfico reutilizable de FlowTrim sobre Chart.js: dona, barras verticales u horizontales. Toma los colores
 * del tema (y se redibuja al cambiarlo), respeta "reducir movimiento" y no calcula nada: solo pinta.
 */
@Component({
  selector: 'app-chart',
  template: `<canvas #canvas role="img" [attr.aria-label]="ariaLabel()"></canvas>`,
  // Al imprimir cambia el ancho disponible: Chart.js recomienda redimensionar en beforeprint/afterprint.
  host: {
    '(window:beforeprint)': 'resizeChart()',
    '(window:afterprint)': 'resizeChart()',
  },
  styles: `
    :host {
      position: relative;
      display: block;
      width: 100%;
      min-height: 15rem;
    }
    canvas {
      position: absolute;
      inset: 0;
    }
  `,
})
export class FlowTrimChart implements OnDestroy {
  private readonly factory = inject(CHART_FACTORY);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly theme = inject(ThemeService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  readonly kind = input.required<ChartKind>();
  readonly labels = input.required<string[]>();
  readonly values = input.required<number[]>();
  readonly ariaLabel = input.required<string>();
  /** Índices resaltados con el color de aviso (p. ej. meses pico de cobros). */
  readonly highlight = input<number[]>([]);
  readonly formatValue = input<(value: number) => string>((value) => String(value));

  private chart: ChartHandle | null = null;

  constructor() {
    afterRenderEffect(() => {
      // Dependencias: entradas (leídas en buildConfig) y tema; cualquier cambio vuelve a construir el gráfico.
      this.theme.mode();
      const config = this.buildConfig();
      this.chart?.destroy();
      this.chart = this.factory(this.canvas().nativeElement, config);
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  protected resizeChart(): void {
    this.chart?.resize?.();
  }

  private buildConfig(): ChartConfiguration {
    // Se leen las variables desde el propio elemento: heredan del tema global, pero un contenedor puede
    // redefinirlas (p. ej. la hoja clara del reporte imprimible).
    const css = getComputedStyle(this.host.nativeElement);
    const color = (name: string) => css.getPropertyValue(name).trim() || '#1fc1ce';
    const palette = paletteVariables.map(color);
    const text = color('--color-text');
    const muted = color('--color-muted');
    const grid = color('--color-border');
    const format = this.formatValue();
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const highlighted = new Set(this.highlight());
    const kind = this.kind();

    const backgroundColor =
      kind === 'doughnut'
        ? this.values().map((_, index) => palette[index % palette.length])
        : this.values().map((_, index) =>
            highlighted.has(index) ? color('--color-warning') : color('--color-primary'),
          );

    const tooltip = {
      callbacks: {
        label: (item: { label: string; parsed: number | { x: number; y: number } }) => {
          const value =
            typeof item.parsed === 'number'
              ? item.parsed
              : kind === 'horizontal-bar'
                ? item.parsed.x
                : item.parsed.y;
          return ` ${item.label}: ${format(value)}`;
        },
      },
    };

    if (kind === 'doughnut') {
      return {
        type: 'doughnut',
        data: {
          labels: this.labels(),
          datasets: [
            {
              data: this.values(),
              backgroundColor,
              borderColor: color('--color-surface'),
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: reducedMotion ? false : undefined,
          cutout: '62%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: text, usePointStyle: true, padding: 14 },
            },
            tooltip,
          },
        },
      } as ChartConfiguration;
    }

    const horizontal = kind === 'horizontal-bar';
    const valueAxis = {
      grid: { color: grid },
      ticks: { color: muted, callback: (value: string | number) => format(Number(value)) },
    };
    const categoryAxis = { grid: { display: false }, ticks: { color: text } };
    return {
      type: 'bar',
      data: {
        labels: this.labels(),
        datasets: [{ data: this.values(), backgroundColor, borderRadius: 6, maxBarThickness: 42 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reducedMotion ? false : undefined,
        indexAxis: horizontal ? 'y' : 'x',
        // Margen a la derecha para que la última etiqueta inclinada del eje no quede cortada.
        layout: { padding: { right: 12 } },
        plugins: { legend: { display: false }, tooltip },
        scales: horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
      },
    } as ChartConfiguration;
  }
}
