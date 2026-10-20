// Configuración solo para el flujo de navegador (HU-48): API local y emisor OIDC de prueba en localhost.
// Se usa únicamente con `ng build --configuration e2e`; producción y desarrollo no la incluyen.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5214',
  auth: {
    authority: 'http://localhost:5999',
    clientId: 'flowtrim-e2e',
    audience: 'https://api.flowtrim.e2e',
    scope: 'openid profile email',
  },
};
