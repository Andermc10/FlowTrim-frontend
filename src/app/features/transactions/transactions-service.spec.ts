import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { TransactionsService } from './transactions-service';

const base = `${environment.apiUrl}/api/transactions`;

describe('TransactionsService', () => {
  let httpMock: HttpTestingController;
  let service: TransactionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TransactionsService);
  });

  afterEach(() => httpMock.verify());

  it('sends only the filters that have a value, with the largest page', () => {
    service.list({ from: '2026-10-01', to: '2026-10-31', accountId: undefined, type: 'Expense', search: '' }).subscribe();

    const request = httpMock.expectOne((r) => r.url === base);
    const params = request.request.params;
    expect(params.get('from')).toBe('2026-10-01');
    expect(params.get('to')).toBe('2026-10-31');
    expect(params.get('type')).toBe('Expense');
    expect(params.has('accountId')).toBe(false);
    expect(params.has('search')).toBe(false);
    expect(params.get('pageSize')).toBe('200');
  });

  it('creates, updates and deletes on the transaction routes', () => {
    const request = {
      type: 'Expense' as const, accountId: 'bank', toAccountId: null, categoryId: 'food', amount: 10,
      date: '2026-10-20', description: null, note: null,
    };

    service.create(request).subscribe();
    service.update('t1', request).subscribe();
    service.delete('t1').subscribe();

    expect(httpMock.expectOne(base).request.body).toEqual(request);
    httpMock.expectOne((r) => r.url === `${base}/t1` && r.method === 'PUT');
    httpMock.expectOne((r) => r.url === `${base}/t1` && r.method === 'DELETE');
  });
});
