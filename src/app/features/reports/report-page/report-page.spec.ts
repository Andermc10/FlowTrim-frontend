import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { CHART_FACTORY } from '../../../core/ui/chart/chart';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { ReportPage } from './report-page';

const api = environment.apiUrl;

describe('ReportPage', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ReportPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CHART_FACTORY, useValue: () => ({ destroy: () => undefined }) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render(withSubscriptions = true) {
    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    httpMock.expectOne(`${api}/api/summary`).flush({
      currencies: withSubscriptions ? [{ currency: 'COP', monthlyEquivalent: 48900, annualProjection: 586800, activeCount: 2 }] : [],
    });
    httpMock.expectOne(`${api}/api/analytics?months=12`).flush({
      referenceMonth: '2026-10',
      currencies: withSubscriptions
        ? [{
            currency: 'COP', monthlyTotal: 48900,
            byCategory: [{ category: 'Streaming', monthlyEquivalent: 48900, share: 100, count: 2 }],
            topSubscriptions: [], expectedCharges: [{ month: '2026-10', amount: 48900, count: 2 }],
          }]
        : [],
    });
    httpMock.expectOne((request) => request.url === `${api}/api/subscriptions`).flush({
      items: withSubscriptions
        ? [
            { id: '2', name: 'Spotify', category: null, amount: 10000, currency: 'COP', billingCycle: 'Monthly', nextBillingDate: '2026-11-12', status: 'Inactive', createdAt: '', updatedAt: '' },
            { id: '1', name: 'Netflix', category: 'Streaming', amount: 38900, currency: 'COP', billingCycle: 'Monthly', nextBillingDate: '2026-11-01', status: 'Active', createdAt: '', updatedAt: '' },
          ]
        : [],
      page: 1, pageSize: 100, totalCount: withSubscriptions ? 2 : 0,
    });
    httpMock.expectOne(`${api}/api/subscriptions/upcoming`).flush({
      referenceDate: '2026-10-18',
      items: withSubscriptions
        ? [{ id: '1', name: 'Netflix', amount: 38900, currency: 'COP', billingCycle: 'Monthly', nextBillingDate: '2026-11-01', daysUntilCharge: 14, alertWindow: 'Later' }]
        : [],
    });
    fixture.detectChanges();
    TestBed.tick();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('renders the summary, charts, subscriptions sorted by name, upcoming charges and assumptions', () => {
    const { element } = render();

    expect(element.querySelector('.sheet')).not.toBeNull();
    expect(element.querySelectorAll('app-chart').length).toBe(2);
    const rows = Array.from(element.querySelectorAll('.sheet table')[1].querySelectorAll('tbody tr'));
    expect(rows.map((row) => row.querySelector('th')?.textContent)).toEqual(['Netflix', 'Spotify']);
    expect(rows[1].classList).toContain('is-inactive');
    expect(element.querySelector('.sheet__assumptions')?.textContent).toContain('not confirmed payments');
  });

  it('prints through the browser dialog', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { element } = render();

    const button = Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Print'));
    button?.click();

    expect(print).toHaveBeenCalled();
  });

  it('downloads the CSV and confirms with a toast', () => {
    const { fixture, element } = render();
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const button = Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Export CSV'));
    button?.click();
    httpMock.expectOne(`${api}/api/reports/subscriptions.csv`).flush(new Blob(['name\r\n'], { type: 'text/csv' }));
    fixture.detectChanges();

    expect(created).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(TestBed.inject(ToastService).toasts()[0].message).toMatch(/^Downloaded flowtrim-subscriptions-\d{4}-\d{2}-\d{2}\.csv\.$/);
  });

  it('shows the empty state and disables printing without subscriptions', () => {
    const { element } = render(false);

    expect(element.querySelector('.empty')).not.toBeNull();
    const print = Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Print')) as HTMLButtonElement;
    expect(print.disabled).toBe(true);
  });
});
