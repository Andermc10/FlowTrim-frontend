import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AccountsService } from './accounts-service';

const base = `${environment.apiUrl}/api/accounts`;

describe('AccountsService', () => {
  let service: AccountsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AccountsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists without archived accounts by default and with them on request', () => {
    service.list().subscribe();
    service.list(true).subscribe();

    expect(httpMock.expectOne(base).request.params.has('includeArchived')).toBe(false);
    expect(httpMock.expectOne(`${base}?includeArchived=true`).request.method).toBe('GET');
  });

  it('creates, updates and deletes on the account routes', () => {
    const request = { name: 'Bank', type: 'Bank' as const, currency: 'COP', openingBalance: 500000 };

    service.create(request).subscribe();
    service.update('a1', { ...request, isArchived: true }).subscribe();
    service.delete('a1').subscribe();

    const create = httpMock.expectOne(base);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(request);
    const update = httpMock.expectOne((request) => request.url === `${base}/a1` && request.method === 'PUT');
    expect(update.request.body.isArchived).toBe(true);
    httpMock.expectOne((request) => request.url === `${base}/a1` && request.method === 'DELETE');
  });
});
