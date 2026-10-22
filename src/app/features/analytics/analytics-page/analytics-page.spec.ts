import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { CHART_FACTORY } from '../../../core/ui/chart/chart';
import { AnalyticsSelection } from '../analytics-selection';
import { AnalyticsResponse } from '../analytics.models';
import { AnalyticsPage } from './analytics-page';

const url = `${environment.apiUrl}/api/analytics?months=12`;

const response: AnalyticsResponse = {
  referenceMonth: '2026-10',
  currencies: [
    {
      currency: 'COP',
      monthlyTotal: 48900,
      byCategory: [
        { category: 'Streaming', monthlyEquivalent: 38900, share: 79.6, count: 1 },
        { category: 'Uncategorized', monthlyEquivalent: 10000, share: 20.4, count: 1 },
      ],
      topSubscriptions: [{ id: '1', name: 'Netflix', monthlyEquivalent: 38900 }],
      expectedCharges: [
        { month: '2026-10', amount: 38900, count: 1 },
        { month: '2026-11', amount: 38900, count: 1 },
        { month: '2026-12', amount: 158900, count: 2 },
      ],
    },
    {
      currency: 'USD',
      monthlyTotal: 9.99,
      byCategory: [{ category: 'Music', monthlyEquivalent: 9.99, share: 100, count: 1 }],
      topSubscriptions: [{ id: '2', name: 'Music', monthlyEquivalent: 9.99 }],
      expectedCharges: [{ month: '2026-10', amount: 9.99, count: 1 }],
    },
  ],
};

describe('AnalyticsPage', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AnalyticsPage],
      providers: [
        AnalyticsSelection,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CHART_FACTORY, useValue: () => ({ destroy: () => undefined }) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render(body: AnalyticsResponse | null, status = 200) {
    const fixture = TestBed.createComponent(AnalyticsPage);
    fixture.detectChanges();
    const request = httpMock.expectOne(url);
    if (status === 200) {
      request.flush(body);
    } else {
      request.flush(null, { status, statusText: 'Error' });
    }
    fixture.detectChanges();
    TestBed.tick();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('renders three charts and data tables for the first currency', () => {
    const { element } = render(response);

    expect(element.querySelectorAll('app-chart').length).toBe(3);
    expect(element.querySelector('.total')?.textContent).toContain('48,900');
    const tables = element.querySelectorAll('table');
    expect(tables.length).toBe(3);
    expect(tables[0].textContent).toContain('Uncategorized');
    expect(tables[2].textContent).toContain('158,900');
  });

  it('switches every chart and table to the selected currency', () => {
    const { fixture, element } = render(response);

    const usd = Array.from(element.querySelectorAll('.currency-switch button')).find((b) => b.textContent?.trim() === 'USD') as HTMLButtonElement;
    usd.click();
    fixture.detectChanges();

    expect(usd.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('.total')?.textContent).toContain('9.99');
    expect(element.querySelector('table')?.textContent).toContain('Music');
  });

  it('highlights the peak months of expected charges', () => {
    const { fixture } = render(response);

    const page = fixture.componentInstance as unknown as { peakMonths: () => number[] };
    expect(page.peakMonths()).toEqual([2]);
  });

  it('shows the empty state without subscriptions', () => {
    const { element } = render({ referenceMonth: '2026-10', currencies: [] });

    expect(element.querySelector('.empty')).not.toBeNull();
    expect(element.querySelector('app-chart')).toBeNull();
  });

  it('shows the error state with a retry', () => {
    const { element } = render(null, 500);

    expect(element.querySelector('.banner--error')?.textContent).toContain('Could not load the analytics.');
  });
});
