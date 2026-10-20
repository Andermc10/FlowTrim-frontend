import { APIRequestContext, expect, test } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';

import { e2eSettings } from './support/settings';

// HU-48 AC-5: el emisor de prueba exige PKCE S256 de verdad, así que el flujo crítico ejercita el código real de login.
const callback = `${e2eSettings.appOrigin}/auth/callback`;

async function authorize(request: APIRequestContext, verifier: string): Promise<string> {
  const response = await request.post(`${e2eSettings.issuerOrigin}/authorize`, {
    form: {
      client_id: e2eSettings.clientId,
      redirect_uri: callback,
      response_type: 'code',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      audience: e2eSettings.audience,
      state: 'state-1',
      account: 'a',
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  return new URL(response.headers()['location']).searchParams.get('code') ?? '';
}

function exchange(request: APIRequestContext, code: string, verifier: string) {
  return request.post(`${e2eSettings.issuerOrigin}/oauth/token`, {
    form: { grant_type: 'authorization_code', client_id: e2eSettings.clientId, code, redirect_uri: callback, code_verifier: verifier },
  });
}

test('TokenEndpoint_WrongVerifier_IsRejected', async ({ request }) => {
  const verifier = randomBytes(32).toString('base64url');

  const wrong = await exchange(request, await authorize(request, verifier), 'not-the-verifier');
  expect(wrong.status()).toBe(400);
  expect((await wrong.json()).error).toBe('invalid_grant');

  const code = await authorize(request, verifier);
  const accepted = await exchange(request, code, verifier);
  expect(accepted.status()).toBe(200);
  expect((await accepted.json()).access_token).toBeTruthy();

  // Un código ya usado no vale otra vez, ni con el verificador correcto.
  expect((await exchange(request, code, verifier)).status()).toBe(400);
});
