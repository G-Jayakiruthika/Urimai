'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
});

const ROOT = path.join(__dirname, '..', 'public');
const SHARED = path.join(__dirname, '..', 'shared');

/**
 * Serve the front end.
 *
 * Two rules matter here. Every resolved path is checked to still sit inside a
 * directory we meant to publish, so no amount of `../` in a URL escapes it. And
 * the two shared modules are served from one copy rather than duplicated into
 * public/, so the rules the server enforces and the rules the browser explains
 * can never drift apart.
 */
function serveStatic(req, res, root = ROOT) {
  const raw = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = raw === '/' ? 'index.html' : raw.replace(/^\/+/, '');

  const base = rel.startsWith('js/rules.js') || rel.startsWith('js/letters.js') ? SHARED : root;
  const name = base === SHARED ? path.basename(rel) : rel;
  const file = path.resolve(base, name);

  if (!file.startsWith(path.resolve(base) + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    // The HTML shell must revalidate so a deploy is seen; fingerprint-free assets
    // get a short cache that still survives a demo being clicked through quickly.
    const cache = type.startsWith('text/html') ? 'no-cache' : 'public, max-age=600';
    res.writeHead(200, { 'content-type': type, 'content-length': stat.size, 'cache-control': cache });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

module.exports = { serveStatic, TYPES, ROOT, SHARED };
