// Configuración de desarrollo. La variante de producción vive en environment.production.ts
// y se intercambia en el build mediante fileReplacements (angular.json).
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5214',
  // Valores públicos del tenant Auth0 de desarrollo (viajan al navegador por diseño; no son secretos).
  auth: {
    authority: 'https://dev-flowtrim.us.auth0.com',
    clientId: '36ELaBI4sbqbaI8xNSeDBwAerrvfMmac',
    audience: 'https://api.flowtrim.dev',
    scope: 'openid profile email',
  },
};
