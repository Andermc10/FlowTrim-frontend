// Configuración de desarrollo. La variante de producción vive en environment.production.ts
// y se intercambia en el build mediante fileReplacements (angular.json).
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5214',
  auth: {
    authority: '',
    clientId: '',
    audience: '',
    scope: 'openid profile email',
  },
};
