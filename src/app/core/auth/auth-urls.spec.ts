import { isFlowTrimApiRequest, toSafeReturnUrl } from './auth-urls';

describe('toSafeReturnUrl', () => {
  it('keeps internal routes', () => {
    expect(toSafeReturnUrl('/app/subscriptions?page=2')).toBe('/app/subscriptions?page=2');
  });

  it.each([
    'https://evil.example.com',
    '//evil.example.com',
    '/\\evil.example.com',
    'app',
    '',
    null,
    undefined,
  ])('rejects unsafe value %s', (value) => {
    expect(toSafeReturnUrl(value)).toBe('/app');
  });

  it('avoids returning to the auth pages', () => {
    expect(toSafeReturnUrl('/auth/login?returnUrl=%2Fapp')).toBe('/app');
  });
});

describe('isFlowTrimApiRequest', () => {
  it('matches the configured API base exactly', () => {
    expect(isFlowTrimApiRequest('http://localhost:5214/api/summary', 'http://localhost:5214')).toBe(true);
    expect(isFlowTrimApiRequest('http://localhost:52140/api/summary', 'http://localhost:5214')).toBe(false);
    expect(isFlowTrimApiRequest('http://localhost:5214/other', 'http://localhost:5214')).toBe(false);
  });

  it('uses same-origin /api when the API URL is empty', () => {
    expect(isFlowTrimApiRequest('/api/summary', '')).toBe(true);
    expect(isFlowTrimApiRequest('https://issuer.example.com/api/x', '')).toBe(false);
  });
});
