import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Usage : node outils/serveur.mjs [dossier racine, par défaut site] [port, par défaut 5173]
const ROOT = path.resolve(import.meta.dirname, process.argv[2] || '../site');
const PORT = Number(process.argv[3] || 5173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, url.endsWith('/') ? url + 'index.html' : url);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    const page = await readFile(path.join(ROOT, '404.html')).catch(() => 'Not found');
    res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end(page);
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
