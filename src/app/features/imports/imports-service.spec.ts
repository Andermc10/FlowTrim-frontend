import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { routes } from '../../app.routes';
import { authGuard } from '../../core/auth/auth.guard';
import { buildImportTemplate, maxImportFileBytes, preCheckFile } from './import-file';
import { ImportsService } from './imports-service';

const baseUrl = `${environment.apiUrl}/api/subscription-imports`;

describe('ImportsService', () => {
  let httpMock: HttpTestingController;
  let service: ImportsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ImportsService);
  });

  afterEach(() => httpMock.verify());

  it('preview_SendsMultipartFileField', () => {
    const file = new File(['name\n'], 'subscriptions.csv', { type: 'text/csv' });

    service.preview(file).subscribe();

    const request = httpMock.expectOne(`${baseUrl}/preview`);
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('file') as File).name).toBe('subscriptions.csv');
    // Sin Content-Type manual: el navegador agrega el boundary del multipart.
    expect(request.request.headers.has('Content-Type')).toBe(false);
  });

  it('confirm_PostsToConfirmRoute', () => {
    const file = new File(['name\n'], 'subscriptions.csv', { type: 'text/csv' });

    service.confirm(file).subscribe();

    const request = httpMock.expectOne(`${baseUrl}/confirm`);
    expect(request.request.method).toBe('POST');
    expect(((request.request.body as FormData).get('file') as File).name).toBe('subscriptions.csv');
  });
});

describe('preCheckFile', () => {
  it('returns the server code for files that would be rejected and null otherwise', () => {
    expect(preCheckFile(new File(['x'], 'notes.txt'))).toBe('unsupported_file_type');
    expect(preCheckFile(new File([], 'empty.csv'))).toBe('empty_file');
    expect(preCheckFile(new File([new Uint8Array(maxImportFileBytes + 1)], 'big.csv'))).toBe('file_too_large');
    expect(preCheckFile(new File([new Uint8Array(maxImportFileBytes)], 'limit.CSV'))).toBeNull();
  });

  it('uses the export header in the template', () => {
    const lines = buildImportTemplate('2026-10-28').split('\r\n');

    // sep=, para Excel, la cabecera del export y cuatro ejemplos con fechas desde hoy (nunca pasadas).
    expect(lines[0]).toBe('sep=,');
    expect(lines[1]).toBe('name,amount,currency,billing_cycle,next_billing_date,category,status');
    expect(lines.slice(2, 6).map((line) => line.split(',')[4])).toEqual(['2026-11-07', '2026-12-27', '2026-10-31', '2026-11-17']);
    expect(lines[6]).toBe('');
  });
});

describe('Import route', () => {
  it('requires a session: it is a lazy child of the guarded workspace', () => {
    const workspace = routes.find((route) => route.path === 'app');
    const imports = workspace?.children?.find((route) => route.path === 'subscriptions/import');

    expect(workspace?.canActivate).toContain(authGuard);
    expect(imports?.loadComponent).toBeDefined();
  });
});
