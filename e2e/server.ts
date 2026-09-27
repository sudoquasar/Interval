/**
 * Serves the e2e build the way GitHub Pages does: files if they exist, otherwise 404.html with
 * a 404 status. `/interval/data/*` comes from fixtures so the tests never depend on real data.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const PORT = Number(process.env.PORT ?? 4173);
const BASE = '/interval/';
const DIST = resolve('dist-e2e');
const FIXTURE_DATA = resolve('e2e/fixtures/data');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

function resolveFile(root: string, relative: string): string | null {
  const path = normalize(join(root, relative));
  if (path !== root && !path.startsWith(root + sep)) return null;
  if (existsSync(path) && statSync(path).isFile()) return path;
  const index = join(path, 'index.html');
  return existsSync(index) ? index : null;
}

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  if (!pathname.startsWith(BASE)) {
    res.writeHead(404).end();
    return;
  }
  const relative = pathname.slice(BASE.length);
  const file = relative.startsWith('data/')
    ? resolveFile(FIXTURE_DATA, relative.slice('data/'.length))
    : resolveFile(DIST, relative);

  if (file) {
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    });
    createReadStream(file).pipe(res);
    return;
  }

  const fallback = join(DIST, '404.html');
  res.writeHead(404, { 'content-type': CONTENT_TYPES['.html'] });
  if (existsSync(fallback)) createReadStream(fallback).pipe(res);
  else res.end('Not found');
}).listen(PORT, '127.0.0.1', () => {
  console.log(`e2e server on http://127.0.0.1:${PORT}${BASE}`);
});
