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
      kind: 'Subscription', paymentUrl: null, defaultAccountId: null, categoryId: null,
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
      kind: 'Subscription', paymentUrl: null, defaultAccountId: null, categoryId: null,
      monthlyEquivalent: 38900,
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

  it('listAll requests every page of 100 until the total is reached', () => {
    const item = (index: number) => ({ id: `id-${index}`, name: `Sub ${index}` }) as SubscriptionResponse;
    let result: SubscriptionResponse[] | undefined;

    service.listAll().subscribe((all) => (result = all));

    const pageRequest = (page: number) => httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/api/subscriptions` && r.params.get('page') === String(page));
    const first = pageRequest(1);
    expect(first.request.params.get('pageSize')).toBe('100');
    first.flush({ items: Array.from({ length: 100 }, (_, i) => item(i)), page: 1, pageSize: 100, totalCount: 150 });
    expect(result).toBeUndefined();
    pageRequest(2).flush({ items: Array.from({ length: 50 }, (_, i) => item(100 + i)), page: 2, pageSize: 100, totalCount: 150 });

    expect(result?.length).toBe(150);
    expect(result?.at(-1)?.name).toBe('Sub 149');
    httpMock.verify();
  });

  it('listAll makes a single request when everything fits in one page', () => {
    let result: SubscriptionResponse[] | undefined;

    service.listAll().subscribe((all) => (result = all));
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/api/subscriptions`)
      .flush({ items: [], page: 1, pageSize: 100, totalCount: 0 });

    expect(result).toEqual([]);
    httpMock.verify();
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

  it('POSTs a usage record for a subscription', () => {
    const id = '4f6c0000-0000-0000-0000-000000000000';
    service.registerUsage(id, { usageDate: '2026-10-10', usageCount: 2, notes: null }).subscribe();

    const httpRequest = httpMock.expectOne(`${environment.apiUrl}/api/subscriptions/${id}/usage-records`);
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual({ usageDate: '2026-10-10', usageCount: 2, notes: null });
    httpRequest.flush({ id: 'u1', subscriptionId: id, usageDate: '2026-10-10', usageCount: 2, notes: null });
  });

  it('GETs usage records for a subscription', () => {
    const id = '4f6c0000-0000-0000-0000-000000000000';
    service.listUsage(id).subscribe();

    const httpRequest = httpMock.expectOne(`${environment.apiUrl}/api/subscriptions/${id}/usage-records`);
    expect(httpRequest.request.method).toBe('GET');
    httpRequest.flush([]);
  });

  it('GETs cost per use for a subscription', () => {
    const id = '4f6c0000-0000-0000-0000-000000000000';
    service.getCostPerUse(id).subscribe();

    const httpRequest = httpMock.expectOne(`${environment.apiUrl}/api/subscriptions/${id}/cost-per-use`);
    expect(httpRequest.request.method).toBe('GET');
    httpRequest.flush({
      subscriptionId: id,
      currency: 'COP',
      from: '2026-10-10',
      to: '2026-10-10',
      monthsInPeriod: 1,
      totalPaid: 38900,
      totalUses: 2,
      calculable: true,
      costPerUse: 19450,
      reason: null,
    });
  });
});
