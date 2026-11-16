'use strict';

const http = require('node:http');
const { createEngine, InputError } = require('./engine');
const { serveStatic } = require('./static');

const MAX_BODY = 32 * 1024;

/** A fixed window per client address. Small, allocation-free, good enough for one instance. */
function createLimiter({ windowMs, max }) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const slot = hits.get(key);
    if (!slot || now > slot.reset) {
      hits.set(key, { n: 1, reset: now + windowMs });
      if (hits.size > 10000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
      return true;
    }
    slot.n += 1;
    return slot.n <= max;
  };
}

/**
 * Security headers.
 *
 * The content-security-policy is the important one: 'self' for scripts and no
 * inline execution means a payload smuggled into a scam message cannot run even
 * if it reached the DOM, and `connect-src 'self'` means nothing this page loads
 * can exfiltrate what a user pasted. Gemini is reached from the server, never
 * from the browser, which is what makes that restriction affordable.
 */
const SECURITY_HEADERS = Object.freeze({
  'content-security-policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "font-src 'self'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
});

const sendJson = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
};

/** Read a JSON body, refusing anything oversized without leaving the socket stuck. */
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { tooLarge = true; return; } // keep draining, do not destroy
      chunks.push(c);
    });
    req.on('end', () => {
      if (tooLarge) return reject(new InputError(413, 'Request body is too large'));
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new InputError(400, 'Body must be valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function createApp({ engine = createEngine(), logger = console, publicDir } = {}) {
  const limitApi = createLimiter({ windowMs: 60_000, max: 20 });
  const limitAll = createLimiter({ windowMs: 60_000, max: 240 });

  const routes = {
    'GET /api/health': async () => ({ ok: true, ai: engine.aiEnabled(), model: engine.model }),
    'POST /api/analyze': (body) => engine.analyze(body),
  };

  return async function handle(req, res) {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    res.setHeader('x-powered-by', 'Urimai');

    // Cloud Run terminates TLS and reports the original scheme here.
    const client = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    if (!limitAll(client)) return sendJson(res, 429, { error: 'Too many requests' });

    let pathname;
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      return sendJson(res, 400, { error: 'Bad request' });
    }

    const route = routes[`${req.method} ${pathname}`];
    if (route) {
      if (pathname.startsWith('/api/') && req.method === 'POST' && !limitApi(client)) {
        return sendJson(res, 429, { error: 'Too many requests. Please wait a minute.' });
      }
      try {
        const body = req.method === 'POST' ? await readJson(req) : {};
        return sendJson(res, 200, await route(body));
      } catch (err) {
        if (err instanceof InputError) return sendJson(res, err.status, { error: err.message });
        logger.error('[urimai]', err instanceof Error ? err.message : String(err));
        return sendJson(res, 500, { error: 'Something went wrong' }); // never leak a stack
      }
    }

    if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Not found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' });
    return serveStatic(req, res, publicDir);
  };
}

const createServer = (opts) => http.createServer(createApp(opts));

module.exports = { createApp, createServer, SECURITY_HEADERS, createLimiter, MAX_BODY };
