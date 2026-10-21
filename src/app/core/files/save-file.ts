/** Archivo listo para guardar en el equipo del usuario. */
export interface DownloadedFile {
  blob: Blob;
  fileName: string;
}

/** Guarda un Blob como archivo descargado mediante un enlace temporal (reporte CSV y plantilla de importación). */
export function saveFile(file: DownloadedFile): void {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName;
  link.click();
  URL.revokeObjectURL(url);
}
