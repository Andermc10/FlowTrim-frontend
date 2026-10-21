/** Límites y comprobaciones del archivo en el navegador; el servidor sigue siendo la autoridad (HU-46). */

/** Igual que el límite del servidor (256 KB). */
export const maxImportFileBytes = 256 * 1024;

/**
 * Código de error de archivo que el servidor daría, o null si el archivo pasa las comprobaciones previas. Así el
 * usuario ve el mismo mensaje sin enviar una petición que de todos modos fallaría.
 */
export function preCheckFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return 'unsupported_file_type';
  }
  if (file.size === 0) {
    return 'empty_file';
  }
  return file.size > maxImportFileBytes ? 'file_too_large' : null;
}

export const importTemplateFileName = 'flowtrim-import-template.csv';

/** Plantilla con el formato del export (HU-52): columnas obligatorias, opcionales y una fila de ejemplo. */
export const importTemplateCsv =
  'name,amount,currency,billing_cycle,next_billing_date,category,status\r\n' +
  'Example Streaming,38900,COP,Monthly,2026-11-05,Streaming,Active\r\n';
