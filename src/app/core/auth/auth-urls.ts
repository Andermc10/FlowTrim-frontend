import { environment } from '../../../environments/environment';

/** Ruta interna a la que se vuelve cuando la URL de retorno no es segura. */
export const defaultReturnUrl = '/app';

/**
 * Acepta solo rutas internas de la SPA. Rechaza URLs absolutas y las variantes `//host` o `/\host`
 * que el navegador interpretaría como otro origen (protección contra open redirect).
 */
export function toSafeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return defaultReturnUrl;
  }

  // Volver al login o al callback tras autenticarse provocaría un ciclo.
  return value.startsWith('/auth/') ? defaultReturnUrl : value;
}

/**
 * Indica si la solicitud va a la API de FlowTrim. Compara el prefijo exacto `<apiUrl>/api/` para no
 * confundir orígenes parecidos (p. ej. `localhost:52140`) ni enviar el token al proveedor de identidad.
 */
export function isFlowTrimApiRequest(url: string, apiUrl: string = environment.apiUrl): boolean {
  const apiBase = `${apiUrl.replace(/\/$/, '')}/api`;
  return url === apiBase || url.startsWith(`${apiBase}/`);
}
