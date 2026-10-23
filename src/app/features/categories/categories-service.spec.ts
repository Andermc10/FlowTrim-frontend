import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { I18nService } from '../../core/i18n/i18n.service';
import { CategoriesService } from './categories-service';

const base = `${environment.apiUrl}/api/categories`;

describe('CategoriesService', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sends the interface language so default categories are named in it', () => {
    const i18n = TestBed.inject(I18nService);
    const service = TestBed.inject(CategoriesService);

    service.list().subscribe();
    expect(httpMock.expectOne(base).request.headers.get('Accept-Language')).toBe('en');

    i18n.toggleLanguage();
    service.list({ kind: 'Income', includeArchived: true }).subscribe();
    const request = httpMock.expectOne(`${base}?kind=Income&includeArchived=true`);
    expect(request.request.headers.get('Accept-Language')).toBe('es');
  });

  it('creates, updates and deletes on the category routes', () => {
    const service = TestBed.inject(CategoriesService);
    const request = { name: 'Pets', kind: 'Expense' as const, color: 'teal' as const, icon: 'other' as const };

    service.create(request).subscribe();
    service.update('c1', { ...request, isArchived: true }).subscribe();
    service.delete('c1').subscribe();

    expect(httpMock.expectOne(base).request.body).toEqual(request);
    expect(httpMock.expectOne((r) => r.url === `${base}/c1` && r.method === 'PUT').request.body.isArchived).toBe(true);
    httpMock.expectOne((r) => r.url === `${base}/c1` && r.method === 'DELETE');
  });
});
