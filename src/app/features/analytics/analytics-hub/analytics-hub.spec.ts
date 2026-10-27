import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../../app.routes';
import { AnalyticsSelection } from '../analytics-selection';
import { AnalyticsHub } from './analytics-hub';

@Component({ template: '<p>charts</p>' })
class ChartsStub {}

@Component({ template: '<p>report</p>' })
class ReportStub {}

/** HU-59: un módulo, dos pestañas accesibles y la moneda elegida compartida. */
describe('AnalyticsHub', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'app/analytics',
            component: AnalyticsHub,
            providers: [AnalyticsSelection],
            children: [
              { path: '', pathMatch: 'full', component: ChartsStub },
              { path: 'report', component: ReportStub },
              { path: 'statement', component: ReportStub },
            ],
          },
        ]),
      ],
    });
  });

  async function open(url: string) {
    const harness = await RouterTestingHarness.create(url);
    // RouterLinkActive avisa con isActiveChange tras la navegación: se espera al render que programa ese signal.
    await harness.fixture.whenStable();
    harness.detectChanges();
    const element = harness.routeNativeElement!;
    const tabs = () => [...element.querySelectorAll<HTMLAnchorElement>('[role="tab"]')];
    return { harness, element, tabs };
  }

  it('marks the active tab and keeps only it in the tab order', async () => {
    const page = await open('/app/analytics/report');

    expect(page.tabs().map((tab) => tab.textContent?.trim())).toEqual(['Charts', 'Report', 'Statement']);
    expect(page.tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(page.tabs().map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
    expect(page.element.querySelector('[role="tabpanel"]')?.textContent).toContain('report');
  });

  it('moves focus between tabs with the arrow keys', async () => {
    const page = await open('/app/analytics');

    page.tabs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(document.activeElement).toBe(page.tabs()[1]);
    page.tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(document.activeElement).toBe(page.tabs()[2]);
    page.tabs()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(document.activeElement).toBe(page.tabs()[0]);
  });

  it('keeps the chosen currency while switching tabs', async () => {
    const page = await open('/app/analytics');
    const hub = () => page.harness.fixture.debugElement.query((node) => node.componentInstance instanceof AnalyticsHub).injector;

    hub().get(AnalyticsSelection).currency.set('USD');
    await page.harness.navigateByUrl('/app/analytics/report');
    await page.harness.navigateByUrl('/app/analytics');

    // El servicio vive en la ruta del módulo: la misma instancia sobrevive al cambio de pestaña.
    expect(hub().get(AnalyticsSelection).currency()).toBe('USD');
  });
});

describe('AnalyticsSelection', () => {
  it('keeps a currency that still exists and falls back to the first one otherwise', () => {
    const selection = new AnalyticsSelection();

    selection.reconcile(['COP', 'USD']);
    expect(selection.currency()).toBe('COP');
    selection.currency.set('USD');
    selection.reconcile(['COP', 'USD']);
    expect(selection.currency()).toBe('USD');
    selection.reconcile(['COP']);
    expect(selection.currency()).toBe('COP');
  });
});

describe('Analytics routes', () => {
  it('redirects the old report link to the report tab', () => {
    const workspace = routes.find((route) => route.path === 'app')!;
    const report = workspace.children!.find((route) => route.path === 'report');
    const analytics = workspace.children!.find((route) => route.path === 'analytics');

    expect(report?.redirectTo).toBe('analytics/report');
    expect(analytics?.children?.map((child) => child.path)).toEqual(['', 'report', 'statement']);
  });
});
