import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
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
    sessionStorage.setItem('flowtrim.access_token', 'test-token');
    sessionStorage.setItem('flowtrim.access_token_expires_at', String(Date.now() + 60_000));

    http.get('http://localhost:5214/api/summary').subscribe();

    const request = httpMock.expectOne('http://localhost:5214/api/summary');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({});
  });

  it('does not leak the FlowTrim token to identity-provider requests', () => {
    sessionStorage.setItem('flowtrim.access_token', 'test-token');
    sessionStorage.setItem('flowtrim.access_token_expires_at', String(Date.now() + 60_000));

    http.get('https://issuer.example.com/.well-known/openid-configuration').subscribe();

    const request = httpMock.expectOne('https://issuer.example.com/.well-known/openid-configuration');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
