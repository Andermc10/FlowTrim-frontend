import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

import { e2eSettings } from './e2e/support/settings';

// Flujo de navegador (HU-48): levanta el emisor OIDC de prueba, la API real (repositorio hermano) y el build e2e
// del SPA. Cada ejecución usa sujetos nuevos, así que no hace falta reiniciar la base de datos.
process.env['E2E_RUN_ID'] ??= Date.now().toString(36);

const backendDir = resolve(process.env['FLOWTRIM_BACKEND_DIR'] ?? '../FlowTrim-backend');
const reuseExistingServer = process.env['E2E_REUSE_SERVERS'] === '1';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/results/test-output',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: './e2e/results/report', open: 'never' }]],
  use: {
    baseURL: e2eSettings.appOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/support/test-issuer.mjs',
      url: `${e2eSettings.issuerOrigin}/.well-known/openid-configuration`,
      reuseExistingServer,
      env: {
        E2E_ISSUER_PORT: String(e2eSettings.issuerPort),
        E2E_APP_ORIGIN: e2eSettings.appOrigin,
        E2E_CLIENT_ID: e2eSettings.clientId,
        E2E_AUDIENCE: e2eSettings.audience,
        E2E_RUN_ID: process.env['E2E_RUN_ID'],
      },
    },
    {
      // Se ejecuta desde la carpeta del proyecto para que cargue appsettings*.json y los User Secrets de desarrollo.
      command: `dotnet run --no-launch-profile --urls ${e2eSettings.apiOrigin}`,
      cwd: resolve(backendDir, 'src/FlowTrim.Api'),
      url: `${e2eSettings.apiOrigin}/api/health`,
      timeout: 180_000,
      reuseExistingServer,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        Authentication__Authority: `${e2eSettings.issuerOrigin}/`,
        Authentication__Audience: e2eSettings.audience,
        Authentication__RequireHttpsMetadata: 'false',
        Insights__Provider__Kind: 'Fake',
      },
    },
    {
      command: `npx ng build --configuration e2e && node e2e/support/spa-server.mjs dist/flowtrim-frontend-e2e/browser ${new URL(e2eSettings.appOrigin).port}`,
      url: e2eSettings.appOrigin,
      timeout: 300_000,
      reuseExistingServer,
    },
  ],
});
