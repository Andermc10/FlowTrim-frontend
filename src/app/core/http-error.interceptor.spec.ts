import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
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
});
