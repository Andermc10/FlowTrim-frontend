// Configuración de producción. apiUrl vacío = mismo origen (el API se sirve tras el mismo host/proxy).
// El valor real se ajusta en el despliegue (HU-40) si el API vive en otro origen.
export const environment = {
  production: true,
  apiUrl: '',
  // Mismo tenant Auth0 que desarrollo (valores públicos, no secretos). Las URLs de producción
  // (callback, logout y web origin) se registran en Auth0 al desplegar (HU-40).
  auth: {
    authority: 'https://dev-flowtrim.us.auth0.com',
    clientId: '36ELaBI4sbqbaI8xNSeDBwAerrvfMmac',
    audience: 'https://api.flowtrim.dev',
    scope: 'openid profile email',
  },
};
