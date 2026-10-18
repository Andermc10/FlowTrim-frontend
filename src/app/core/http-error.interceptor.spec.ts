import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { httpErrorInterceptor, toUserMessage } from './http-error.interceptor';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('propagates the error to the caller without swallowing it', () => {
    let status: number | undefined;
    http.get('/api/subscriptions').subscribe({
      next: () => {
        throw new Error('should not succeed');
      },
      error: (error: HttpErrorResponse) => (status = error.status),
    });

    httpMock.expectOne('/api/subscriptions').flush('boom', { status: 500, statusText: 'Server Error' });

    expect(status).toBe(500);
  });

  it('derives actionable messages by status', () => {
    expect(toUserMessage(new HttpErrorResponse({ status: 0 }))).toContain('Cannot reach the server');
    expect(toUserMessage(new HttpErrorResponse({ status: 404 }))).toContain('not found');
    expect(toUserMessage(new HttpErrorResponse({ status: 500 }))).toContain('Something went wrong');
  });

  it('appends the correlation reference to unexpected failures', () => {
    const headers = new HttpHeaders({ 'X-Correlation-ID': 'abc123' });

    expect(toUserMessage(new HttpErrorResponse({ status: 500, headers })))
      .toBe('Something went wrong. Please try again. Reference: abc123');
    expect(toUserMessage(new HttpErrorResponse({ status: 503, error: { correlationId: 'from-body' } })))
      .toContain('Reference: from-body');
  });

  it('does not add a reference to validation or not-found messages', () => {
    const headers = new HttpHeaders({ 'X-Correlation-ID': 'abc123' });

    expect(toUserMessage(new HttpErrorResponse({ status: 400, headers }))).not.toContain('Reference');
    expect(toUserMessage(new HttpErrorResponse({ status: 404, headers }))).not.toContain('Reference');
  });

  it('omits the reference when the response carries none', () => {
    expect(toUserMessage(new HttpErrorResponse({ status: 500 }))).not.toContain('Reference');
  });
});
