import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from './server/handler.mjs';
const root = fileURLToPath(new URL('./public/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
// Preview uses isolated memory, never Netlify's event data. Restart resets the preview.
let state = null; let revision = 0;
const store = {
  async getWithMetadata() { return state ? { data: structuredClone(state), etag: `"${revision}"` } : null; },
  async setJSON(key, next, options) {
    if ((options.onlyIfNew && state) || (options.onlyIfMatch && options.onlyIfMatch !== `"${revision}"`)) return { modified: false };
    state = structuredClone(next); revision++; return { modified: true, etag: `"${revision}"` };
  }
};
const handler = createHandler({ getStore: () => store, getSecret: () => process.env.ORGANISER_KEY || 'local-preview-organiser-code-2026' });
http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith('/api/')) {
      const chunks = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 4000000) { response.writeHead(413); response.end(); return; } chunks.push(chunk); }
      const body = Buffer.concat(chunks);
      const result = await handler(new Request(`http://${request.headers.host}${request.url}`, { method: request.method, headers: request.headers, ...(['GET', 'HEAD'].includes(request.method) ? {} : { body }) }));
      response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(Buffer.from(await result.arrayBuffer())); return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end('Method not allowed'); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root)) { response.writeHead(403); response.end(); return; }
    const body = await fs.readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(body);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(Number(process.env.PORT || 4183), '127.0.0.1', () => console.log(`Preview at http://localhost:${process.env.PORT || 4183} (isolated demo data; code: local-preview-organiser-code-2026)`));
