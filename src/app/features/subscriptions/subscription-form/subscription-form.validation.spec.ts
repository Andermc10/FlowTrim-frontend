import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { SubscriptionResponse } from '../models/subscription.models';
import { SubscriptionForm } from './subscription-form';

/** HU-55 / HU-56: ejemplos en los campos y errores en vivo, sin pulsar Guardar. "Hoy" = 2026-10-20 en Bogotá. */
describe('SubscriptionForm live validation', () => {
  let httpMock: HttpTestingController;

  function configure(id: string | null) {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 15, 0, 0)));
    TestBed.configureTestingModule({
      imports: [SubscriptionForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    // Cuentas, categorías (EP-14 HU-72) y últimos pagos (HU-73) del formulario: se responden vacíos.
    httpMock
      .match((request) => /\/api\/(accounts|categories)$|\/payments$/.test(request.url))
      .forEach((request) => request.flush([]));
    httpMock.verify();
    vi.useRealTimers();
  });

  function render() {
    const fixture = TestBed.createComponent(SubscriptionForm);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const input = (id: string) => element.querySelector<HTMLInputElement>(`#${id}`)!;
    const type = (id: string, value: string) => {
      input(id).value = value;
      input(id).dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const leave = (id: string) => {
      input(id).dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    };
    const errorOf = (id: string) => element.querySelector(`#${id}-error`)?.textContent?.trim() ?? '';
    return { fixture, element, input, type, leave, errorOf };
  }

  it('shows example placeholders and no errors before the user interacts', () => {
    configure(null);
    const form = render();

    expect(form.input('name').placeholder).toBe('e.g. Netflix');
    expect(form.input('category').placeholder).toBe('e.g. Streaming');
    expect(form.input('amount').placeholder).toBe('e.g. 38900');
    expect(form.input('currency').placeholder).toBe('COP');
    expect(form.input('nextBillingDate').min).toBe('2026-10-20');
    expect(form.element.querySelectorAll('.error').length).toBe(0);
  });

  it('shows an amount error while typing and clears it when corrected (AC-1, AC-2, AC-3)', () => {
    configure(null);
    const form = render();

    form.type('amount', '-5');
    form.leave('amount');
    expect(form.errorOf('amount')).toBe('Amount must be greater than zero.');
    expect(form.input('amount').getAttribute('aria-invalid')).toBe('true');
    expect(form.input('amount').getAttribute('aria-describedby')).toBe('amount-error');

    form.type('amount', '10.123');
    expect(form.errorOf('amount')).toBe('Use at most 2 decimals.');

    form.type('amount', '38900');
    expect(form.errorOf('amount')).toBe('');
    expect(form.input('amount').getAttribute('aria-invalid')).toBe('false');
  });

  it('rejects a past next billing date live and accepts today (HU-56)', () => {
    configure(null);
    const form = render();

    form.type('nextBillingDate', '2026-10-19');
    expect(form.errorOf('nextBillingDate')).toBe('Next billing date cannot be in the past.');

    form.type('nextBillingDate', '2026-10-20');
    expect(form.errorOf('nextBillingDate')).toBe('');
  });

  it('upper-cases the currency and validates a blank name', () => {
    configure(null);
    const form = render();

    form.type('currency', 'usd');
    expect(form.input('currency').value).toBe('USD');

    form.type('name', '   ');
    expect(form.errorOf('name')).toBe('Name is required.');
  });

  it('keeps an unchanged overdue date valid when editing, but not a new past date (HU-56)', () => {
    configure('sub-1');
    const form = render();
    httpMock.expectOne(`${environment.apiUrl}/api/subscriptions/sub-1`).flush({
      id: 'sub-1', name: 'Gym', category: null, amount: 90000, currency: 'COP', billingCycle: 'Monthly',
      nextBillingDate: '2026-10-01', status: 'Active', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
      kind: 'Subscription', paymentUrl: null, defaultAccountId: null, categoryId: null, monthlyEquivalent: 90000, totalInstalments: null, paidInstalments: 0,
    } satisfies SubscriptionResponse);
    form.fixture.detectChanges();

    form.type('name', 'Gym plus');
    expect(form.errorOf('nextBillingDate')).toBe('');

    form.type('nextBillingDate', '2026-10-05');
    expect(form.errorOf('nextBillingDate')).toBe('Next billing date cannot be in the past.');
  });
});
