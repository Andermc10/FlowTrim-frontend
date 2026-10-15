// Configuración de producción. apiUrl vacío = mismo origen (el API se sirve tras el mismo host/proxy).
// El valor real se ajusta en el despliegue si el API vive en otro origen.
export const environment = {
  production: true,
  apiUrl: '',
};
