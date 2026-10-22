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

/**
 * Plantilla con el formato del export (HU-52, HU-58): línea `sep=,` para que Excel separe las columnas en cualquier
 * configuración regional, cabecera y cuatro ejemplos (mensual, anual, sin categoría e inactiva). Las fechas se calculan
 * desde hoy para que la plantilla siempre se pueda importar (HU-56 no admite fechas pasadas).
 */
export function buildImportTemplate(today: string): string {
  const rows = [
    'name,amount,currency,billing_cycle,next_billing_date,category,status',
    `Example Streaming,38900,COP,Monthly,${addDays(today, 10)},Streaming,Active`,
    `Example Cloud Storage,119.88,USD,Yearly,${addDays(today, 60)},Productivity,Active`,
    `Example Gym,90000,COP,Monthly,${addDays(today, 3)},,Active`,
    `Example Newspaper,15900,COP,Monthly,${addDays(today, 20)},News,Inactive`,
  ];
  return ['sep=,', ...rows].join('\r\n') + '\r\n';
}

// Suma días a una fecha yyyy-MM-dd sin depender de la zona horaria del navegador.
function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
