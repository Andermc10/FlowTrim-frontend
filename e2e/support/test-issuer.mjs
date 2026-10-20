// Emisor OIDC de prueba para el flujo de navegador (HU-48). Solo localhost y solo para pruebas: discovery, JWKS,
// pantalla de autorización con dos cuentas sintéticas, intercambio de código con verificación PKCE S256 y logout.
// Sin dependencias. Los ajustes llegan por entorno desde playwright.config.ts.
import { createHash, createSign, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}.`);
  }
  return value;
};

const port = Number(required('E2E_ISSUER_PORT'));
const appOrigin = required('E2E_APP_ORIGIN');
const clientId = required('E2E_CLIENT_ID');
const audience = required('E2E_AUDIENCE');
const runId = required('E2E_RUN_ID');
const issuer = `http://localhost:${port}/`;
const callbackUrl = `${appOrigin}/auth/callback`;
const accounts = { a: 'Account A', b: 'Account B' };

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: `e2e-${runId}`, use: 'sig', alg: 'RS256' };

// Códigos de un solo uso, válidos 60 s.
const codes = new Map();

const base64Url = (value) => Buffer.from(value).toString('base64url');

function signToken(subject) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: jwk.kid }));
  const payload = base64Url(JSON.stringify({
    iss: issuer, aud: audience, sub: subject, iat: now, nbf: now, exp: now + 3600, jti: randomUUID(),
  }));
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'Access-Control-Allow-Origin': appOrigin, ...headers });
  response.end(body);
}

const json = (response, status, value) => send(response, status, JSON.stringify(value), { 'Content-Type': 'application/json' });

function redirect(response, location) {
  send(response, 302, '', { Location: location });
}

async function readForm(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
  }
  return new URLSearchParams(body);
}

// Valida la petición de autorización; devuelve el motivo del rechazo o null.
function authorizeError(params) {
  if (params.get('client_id') !== clientId) return 'unknown client_id';
  if (params.get('redirect_uri') !== callbackUrl) return 'redirect_uri not allowed';
  if (params.get('response_type') !== 'code') return 'response_type must be code';
  if (params.get('code_challenge_method') !== 'S256' || !params.get('code_challenge')) return 'PKCE S256 is required';
  if (params.get('audience') !== audience) return 'unknown audience';
  return null;
}

const escapeHtml = (value) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function authorizePage(params) {
  const hidden = ['client_id', 'redirect_uri', 'response_type', 'code_challenge', 'code_challenge_method', 'audience', 'state']
    .map((name) => `<input type="hidden" name="${name}" value="${escapeHtml(params.get(name) ?? '')}">`)
    .join('');
  const buttons = Object.entries(accounts)
    .map(([key, label]) => `<button type="submit" name="account" value="${key}">Sign in as ${label}</button>`)
    .join(' ');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>FlowTrim test sign-in</title></head>`
    + `<body><h1>FlowTrim test identity provider</h1><form method="post" action="/authorize">${hidden}${buttons}</form></body></html>`;
}

async function handle(request, response) {
  const url = new URL(request.url, issuer);

  if (request.method === 'OPTIONS') {
    return send(response, 204, '', { 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type' });
  }

  if (request.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
    return json(response, 200, {
      issuer,
      authorization_endpoint: `${issuer}authorize`,
      token_endpoint: `${issuer}oauth/token`,
      end_session_endpoint: `${issuer}logout`,
      jwks_uri: `${issuer}jwks`,
    });
  }

  if (request.method === 'GET' && url.pathname === '/jwks') {
    return json(response, 200, { keys: [jwk] });
  }

  if (url.pathname === '/authorize') {
    const params = request.method === 'POST' ? await readForm(request) : url.searchParams;
    const error = authorizeError(params);
    if (error) {
      return send(response, 400, error, { 'Content-Type': 'text/plain' });
    }
    if (request.method === 'GET') {
      return send(response, 200, authorizePage(params), { 'Content-Type': 'text/html; charset=utf-8' });
    }

    const account = params.get('account');
    if (!(account in accounts)) {
      return send(response, 400, 'unknown account', { 'Content-Type': 'text/plain' });
    }
    const code = randomBytes(24).toString('base64url');
    codes.set(code, {
      challenge: params.get('code_challenge'),
      subject: `e2e|account-${account}-${runId}`,
      expiresAt: Date.now() + 60_000,
    });
    const target = new URL(callbackUrl);
    target.search = new URLSearchParams({ code, state: params.get('state') ?? '' }).toString();
    return redirect(response, target.toString());
  }

  if (request.method === 'POST' && url.pathname === '/oauth/token') {
    const form = await readForm(request);
    const grant = codes.get(form.get('code') ?? '');
    // El código se consume siempre, también si el intercambio falla.
    codes.delete(form.get('code') ?? '');
    const verifier = form.get('code_verifier') ?? '';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    if (form.get('grant_type') !== 'authorization_code' || form.get('client_id') !== clientId
      || form.get('redirect_uri') !== callbackUrl || !grant || grant.expiresAt < Date.now() || grant.challenge !== challenge) {
      return json(response, 400, { error: 'invalid_grant', error_description: 'The authorization code or PKCE verifier is invalid.' });
    }
    return json(response, 200, { access_token: signToken(grant.subject), token_type: 'Bearer', expires_in: 3600 });
  }

  if (request.method === 'GET' && url.pathname === '/logout') {
    const target = url.searchParams.get('post_logout_redirect_uri') ?? '';
    return target.startsWith(`${appOrigin}/`)
      ? redirect(response, target)
      : send(response, 400, 'post_logout_redirect_uri not allowed', { 'Content-Type': 'text/plain' });
  }

  // El navegador pide el favicon al abrir la pantalla de autorización: sin contenido, pero no es un error.
  if (url.pathname === '/favicon.ico') {
    return send(response, 204, '');
  }

  return send(response, 404, '');
}

createServer((request, response) => {
  handle(request, response).catch(() => send(response, 500, ''));
}).listen(port, 'localhost', () => console.log(`Test issuer ready on ${issuer}`));
