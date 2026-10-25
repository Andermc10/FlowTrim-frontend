import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { SubscriptionKind, SubscriptionResponse } from '../models/subscription.models';
import { SubscriptionList } from './subscription-list';

/** EP-14 HU-72: insignia y filtro por tipo, y enlace a la página de pago del proveedor. */
describe('SubscriptionList recurring payments', () => {
  let httpMock: HttpTestingController;

  const payment = (id: string, name: string, kind: SubscriptionKind, paymentUrl: string | null = null): SubscriptionResponse => ({
    id, name, category: null, amount: 100, currency: 'COP', billingCycle: 'Monthly', nextBillingDate: '2026-11-01',
    status: 'Active', kind, paymentUrl, defaultAccountId: null, categoryId: null, monthlyEquivalent: 100,
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
  });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [SubscriptionList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render() {
    const fixture = TestBed.createComponent(SubscriptionList);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/api/subscriptions?page=1&pageSize=100`).flush({
      items: [payment('a', 'Netflix', 'Subscription'), payment('b', 'Rent', 'Bill', 'https://pay.example.com/rent')],
      page: 1, pageSize: 100, totalCount: 2,
    });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const names = () => [...element.querySelectorAll('tbody td:first-child strong')].map((cell) => cell.textContent?.trim());
    return { fixture, element, names };
  }

  it('shows the kind of each payment and filters by kind', () => {
    const list = render();

    expect([...list.element.querySelectorAll('.kind-badge')].map((badge) => badge.textContent?.trim())).toEqual(['Subscription', 'Bill']);
    const filter = list.element.querySelector<HTMLSelectElement>('.kind-filter')!;
    filter.value = 'Bill';
    filter.dispatchEvent(new Event('change'));
    list.fixture.detectChanges();

    expect(list.names()).toEqual(['Rent']);
  });

  it('links to the provider page in a new tab only when there is a payment link', () => {
    const list = render();

    const links = list.element.querySelectorAll<HTMLAnchorElement>('.pay-link');
    expect(links.length).toBe(1);
    expect(links[0].href).toBe('https://pay.example.com/rent');
    expect(links[0].target).toBe('_blank');
    expect(links[0].rel).toBe('noopener noreferrer');
  });
});
