// Servidor estático mínimo del build e2e con fallback a index.html (rutas del SPA). Solo localhost.
// Uso: node e2e/support/spa-server.mjs <carpeta> <puerto>
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const root = resolve(process.argv[2]);
const port = Number(process.argv[3]);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

createServer(async (request, response) => {
  const requested = resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
  // Nunca se sirve nada fuera de la carpeta del build.
  const candidates = requested.startsWith(root + sep) ? [requested] : [];
  for (const file of [...candidates, join(root, 'index.html')]) {
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
      response.end(body);
      return;
    } catch {
      // Ruta del SPA o archivo inexistente: se prueba el siguiente candidato.
    }
  }
  response.writeHead(404).end();
}).listen(port, 'localhost', () => console.log(`SPA ready on http://localhost:${port}`));
