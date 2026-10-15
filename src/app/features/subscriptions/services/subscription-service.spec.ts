import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { CreateSubscriptionRequest, SubscriptionResponse } from '../models/subscription.models';
import { SubscriptionService } from './subscription-service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SubscriptionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POSTs the request to /api/subscriptions and returns the created subscription', () => {
    const request: CreateSubscriptionRequest = {
      name: 'Netflix',
      category: 'Streaming',
      amount: 38900,
      currency: 'COP',
      billingCycle: 'Monthly',
      nextBillingDate: '2026-11-01',
    };

    let result: SubscriptionResponse | undefined;
    service.create(request).subscribe((response) => (result = response));

    const httpRequest = httpMock.expectOne(`${environment.apiUrl}/api/subscriptions`);
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual(request);

    httpRequest.flush({
      id: '4f6c0000-0000-0000-0000-000000000000',
      name: 'Netflix',
      category: 'Streaming',
      amount: 38900,
      currency: 'COP',
      billingCycle: 'Monthly',
      nextBillingDate: '2026-11-01',
      status: 'Active',
      createdAt: '2026-10-14T06:30:00Z',
      updatedAt: '2026-10-14T06:30:00Z',
    } satisfies SubscriptionResponse);

    expect(result?.id).toBe('4f6c0000-0000-0000-0000-000000000000');
    expect(result?.status).toBe('Active');
  });

  it('GETs a paged list with page and pageSize params', () => {
    service.list(2, 10).subscribe();

    const httpRequest = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/api/subscriptions`,
    );
    expect(httpRequest.request.method).toBe('GET');
    expect(httpRequest.request.params.get('page')).toBe('2');
    expect(httpRequest.request.params.get('pageSize')).toBe('10');
    httpRequest.flush({ items: [], page: 2, pageSize: 10, totalCount: 0 });
  });

  it('DELETEs a subscription by id', () => {
    const id = '4f6c0000-0000-0000-0000-000000000000';
    service.delete(id).subscribe();

    const httpRequest = httpMock.expectOne(`${environment.apiUrl}/api/subscriptions/${id}`);
    expect(httpRequest.request.method).toBe('DELETE');
    httpRequest.flush(null);
  });

  it('GETs upcoming charges', () => {
    service.getUpcoming().subscribe();

    const httpRequest = httpMock.expectOne(`${environment.apiUrl}/api/subscriptions/upcoming`);
    expect(httpRequest.request.method).toBe('GET');
    httpRequest.flush({ referenceDate: '2026-10-14', items: [] });
  });
});
