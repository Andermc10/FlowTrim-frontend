import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  const storeValidToken = () => {
    sessionStorage.setItem('flowtrim.access_token', 'test-token');
    sessionStorage.setItem('flowtrim.access_token_expires_at', String(Date.now() + 60_000));
  };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    sessionStorage.clear();
    httpMock.verify();
  });

  it('adds a valid access token to FlowTrim API requests', () => {
    storeValidToken();

    http.get('http://localhost:5214/api/summary').subscribe();

    const request = httpMock.expectOne('http://localhost:5214/api/summary');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({});
  });

  it('does not leak the FlowTrim token to identity-provider requests', () => {
    storeValidToken();

    http.get('https://issuer.example.com/.well-known/openid-configuration').subscribe();

    const request = httpMock.expectOne('https://issuer.example.com/.well-known/openid-configuration');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('does not send the token to a look-alike origin', () => {
    storeValidToken();

    http.get('http://localhost:52140/api/summary').subscribe();

    const request = httpMock.expectOne('http://localhost:52140/api/summary');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('clears the session and asks to sign in again when the API returns 401', () => {
    storeValidToken();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    let failedStatus: number | undefined;

    http.get('http://localhost:5214/api/summary').subscribe({ error: (error) => failedStatus = error.status });
    httpMock.expectOne('http://localhost:5214/api/summary').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(failedStatus).toBe(401);
    expect(sessionStorage.getItem('flowtrim.access_token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/', reason: 'expired' },
    });
  });

  it('keeps the session on non-401 API errors', () => {
    storeValidToken();

    http.get('http://localhost:5214/api/summary').subscribe({ error: () => undefined });
    httpMock.expectOne('http://localhost:5214/api/summary').flush(null, { status: 500, statusText: 'Server Error' });

    expect(sessionStorage.getItem('flowtrim.access_token')).toBe('test-token');
  });
});
