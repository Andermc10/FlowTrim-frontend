// Ajustes del flujo de navegador (HU-48). Fuente única: la config de Playwright los pasa por entorno al emisor y a
// la API, y deben coincidir con src/environments/environment.e2e.ts.
export const e2eSettings = {
  appOrigin: 'http://localhost:4200',
  apiOrigin: 'http://localhost:5214',
  issuerPort: 5999,
  issuerOrigin: 'http://localhost:5999',
  clientId: 'flowtrim-e2e',
  audience: 'https://api.flowtrim.e2e',
} as const;
