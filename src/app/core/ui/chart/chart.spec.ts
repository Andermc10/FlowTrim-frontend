import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChartConfiguration } from 'chart.js';

import { ThemeService } from '../../theme/theme.service';
import { CHART_FACTORY, ChartKind, FlowTrimChart } from './chart';

@Component({
  imports: [FlowTrimChart],
  template: `<app-chart [kind]="kind()" [labels]="labels()" [values]="values()" [highlight]="highlight()"
    ariaLabel="Spending by category" [formatValue]="format" />`,
})
class Host {
  readonly kind = signal<ChartKind>('doughnut');
  readonly labels = signal(['Streaming', 'Music']);
  readonly values = signal([38900, 16900]);
  readonly highlight = signal<number[]>([]);
  readonly format = (value: number) => `$${value}`;
}

describe('FlowTrimChart', () => {
  let created: ChartConfiguration[];
  let destroyed: number;

  beforeEach(() => {
    localStorage.clear();
    created = [];
    destroyed = 0;
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [{
        provide: CHART_FACTORY,
        useValue: (_canvas: HTMLCanvasElement, config: ChartConfiguration) => {
          created.push(config);
          return { destroy: () => destroyed++ };
        },
      }],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    TestBed.tick();
    return fixture;
  }

  it('creates a doughnut with the given labels, values and accessible name', () => {
    const fixture = render();

    expect(created.length).toBe(1);
    expect(created[0].type).toBe('doughnut');
    expect(created[0].data.labels).toEqual(['Streaming', 'Music']);
    expect(created[0].data.datasets[0].data).toEqual([38900, 16900]);
    expect(fixture.nativeElement.querySelector('canvas').getAttribute('aria-label')).toBe('Spending by category');
  });

  it('rebuilds the chart when the data changes and destroys the previous instance', () => {
    const fixture = render();

    fixture.componentInstance.values.set([1, 2]);
    fixture.detectChanges();
    TestBed.tick();

    expect(created.length).toBe(2);
    expect(destroyed).toBe(1);
    expect(created[1].data.datasets[0].data).toEqual([1, 2]);
  });

  it('rebuilds the chart when the theme changes', () => {
    render();

    TestBed.inject(ThemeService).toggle();
    TestBed.tick();

    expect(created.length).toBe(2);
  });

  it('uses a horizontal index axis and highlights the requested bars', () => {
    // jsdom no carga styles.scss: se definen los tokens de color que el gráfico lee del tema.
    document.documentElement.style.setProperty('--color-primary', '#1fc1ce');
    document.documentElement.style.setProperty('--color-warning', '#ffb547');
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.kind.set('horizontal-bar');
    fixture.componentInstance.highlight.set([1]);
    fixture.detectChanges();
    TestBed.tick();

    const config = created[0] as ChartConfiguration<'bar'>;
    expect(config.type).toBe('bar');
    expect(config.options?.indexAxis).toBe('y');
    const colors = config.data.datasets[0].backgroundColor as string[];
    expect(colors[0]).not.toBe(colors[1]);
  });

  it('destroys the chart with the component', () => {
    const fixture = render();

    fixture.destroy();

    expect(destroyed).toBe(1);
  });
});
