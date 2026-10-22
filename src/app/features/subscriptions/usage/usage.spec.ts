import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { Usage } from './usage';

const base = `${environment.apiUrl}/api/subscriptions/sub-1`;

/** HU-55 / HU-56 en el formulario de uso. "Hoy" = 2026-10-20 en Bogotá. */
describe('Usage form live validation', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 15, 0, 0)));
    TestBed.configureTestingModule({
      imports: [Usage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'sub-1' }) } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function render() {
    const fixture = TestBed.createComponent(Usage);
    fixture.detectChanges();
    httpMock.expectOne(base).flush({
      id: 'sub-1', name: 'Netflix', category: null, amount: 38900, currency: 'COP', billingCycle: 'Monthly',
      nextBillingDate: '2026-11-01', status: 'Active', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
    });
    httpMock.expectOne(`${base}/usage-records`).flush([]);
    httpMock.expectOne(`${base}/cost-per-use`).flush({
      subscriptionId: 'sub-1', currency: 'COP', from: null, to: null, monthsInPeriod: 0, totalPaid: 0, totalUses: 0,
      calculable: false, costPerUse: null, reason: 'No usage in the selected period.',
    });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const input = (id: string) => element.querySelector<HTMLInputElement>(`#${id}`)!;
    const type = (id: string, value: string) => {
      input(id).value = value;
      input(id).dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const errorOf = (id: string) => element.querySelector(`#${id}-error`)?.textContent?.trim() ?? '';
    return { input, type, errorOf };
  }

  it('shows placeholders and limits the date picker to today', () => {
    const form = render();

    expect(form.input('usageCount').placeholder).toBe('e.g. 3');
    expect(form.input('notes').placeholder).toBe('e.g. Watched two films');
    expect(form.input('usageDate').max).toBe('2026-10-20');
  });

  it('rejects a future usage date and a fractional count while typing', () => {
    const form = render();

    form.type('usageDate', '2026-10-21');
    expect(form.errorOf('usageDate')).toBe('Usage date cannot be in the future.');
    form.type('usageDate', '2026-10-20');
    expect(form.errorOf('usageDate')).toBe('');

    form.type('usageCount', '2.5');
    expect(form.errorOf('usageCount')).toBe('Usage count must be a whole number.');
  });
});
