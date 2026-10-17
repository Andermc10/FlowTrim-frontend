import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const runGuard = (url: string) =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => sessionStorage.clear());

  it('redirects anonymous users to the login page keeping the requested route', () => {
    const result = runGuard('/app/subscriptions');

    const router = TestBed.inject(Router);
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/auth/login?returnUrl=%2Fapp%2Fsubscriptions');
  });

  it('redirects when the stored token has expired', () => {
    sessionStorage.setItem('flowtrim.access_token', 'old-token');
    sessionStorage.setItem('flowtrim.access_token_expires_at', String(Date.now() - 1_000));

    expect(runGuard('/app')).toBeInstanceOf(UrlTree);
  });

  it('allows users with a valid token', () => {
    sessionStorage.setItem('flowtrim.access_token', 'test-token');
    sessionStorage.setItem('flowtrim.access_token_expires_at', String(Date.now() + 60_000));

    expect(runGuard('/app')).toBe(true);
  });
});
