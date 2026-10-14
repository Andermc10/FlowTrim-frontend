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
});
