import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { SubscriptionResponse } from '../../subscriptions/models/subscription.models';
import { SimulationResponse } from '../simulation.models';
import { Simulator } from './simulator';

const simulationsUrl = `${environment.apiUrl}/api/simulations`;

function subscription(id: string, name: string, status: 'Active' | 'Inactive' = 'Active'): SubscriptionResponse {
  return {
    id, name, category: null, amount: 100, currency: 'COP', billingCycle: 'Monthly', nextBillingDate: '2026-11-01',
    status, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    kind: 'Subscription', paymentUrl: null, defaultAccountId: null, categoryId: null, monthlyEquivalent: 100,
  };
}

function simulation(selectedMonthly: number): SimulationResponse {
  return {
    horizons: [1, 12, 24],
    currencies: [{
      currency: 'COP', currentMonthly: 200, selectedMonthly, projectedMonthly: 200 - selectedMonthly,
      savings: [1, 12, 24].map((months) => ({ months, amount: selectedMonthly * months })),
    }],
    assumptions: [],
  };
}

describe('Simulator', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Simulator],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render() {
    const fixture = TestBed.createComponent(Simulator);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/api/subscriptions`).flush({
      items: [subscription('a', 'Netflix'), subscription('b', 'Spotify'), subscription('c', 'Old gym', 'Inactive')],
      page: 1, pageSize: 100, totalCount: 3,
    });
    fixture.detectChanges();
    return fixture;
  }

  it('lists only active subscriptions and simulates with nothing selected', () => {
    const fixture = render();

    const names = [...(fixture.nativeElement as HTMLElement).querySelectorAll('label')].map((label) => label.textContent ?? '');
    expect(names.some((name) => name.includes('Netflix'))).toBe(true);
    expect(names.some((name) => name.includes('Old gym'))).toBe(false);
    expect(httpMock.expectOne(simulationsUrl).request.body).toEqual({ subscriptionIds: [], horizons: [1, 12, 24] });
  });

  it('cancels the previous simulation when the selection changes, so a slow answer cannot overwrite a newer one', () => {
    const fixture = render();
    httpMock.expectOne(simulationsUrl).flush(simulation(0));
    const boxes = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type="checkbox"]');

    boxes[0].dispatchEvent(new Event('change'));
    const first = httpMock.expectOne(simulationsUrl);
    boxes[1].dispatchEvent(new Event('change'));
    const second = httpMock.expectOne(simulationsUrl);

    expect(first.cancelled).toBe(true);
    expect(second.request.body).toEqual({ subscriptionIds: ['a', 'b'], horizons: [1, 12, 24] });
    second.flush(simulation(200));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('2,400');
  });
});
