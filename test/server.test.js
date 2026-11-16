'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer, SECURITY_HEADERS, MAX_BODY } = require('../src/app');
const { createEngine } = require('../src/engine');

const quiet = { error() {} };
const offline = { enabled: false, model: 'none', read: async () => ({}) };

/** Start the real server on an ephemeral port for each test file run. */
async function withServer(fn) {
  const server = createServer({ engine: createEngine({ gemini: offline, logger: quiet }), logger: quiet });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const post = (base, path, body, init = {}) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body), ...init });

test('health reports what the service can actually do', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.ai, false);
  });
});

test('every response carries the security headers', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/health`);
    for (const header of Object.keys(SECURITY_HEADERS)) {
      assert.ok(res.headers.get(header), `missing ${header}`);
    }
    assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(res.headers.get('content-security-policy'), /connect-src 'self'/);
  });
});

test('analysis returns a verdict and its documents', async () => {
  await withServer(async (base) => {
    const res = await post(base, '/api/analyze', { text: 'Your KYC expired, share the OTP and pay Rs 4999 to a@ybl now', lang: 'en' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.kind, 'THREAT');
    assert.ok(body.documents.length >= 3);
  });
});

test('a malformed body is refused without a stack trace', async () => {
  await withServer(async (base) => {
    const res = await post(base, '/api/analyze', '{not json');
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /JSON/);
    assert.doesNotMatch(JSON.stringify(body), /at .*\.js:\d+/, 'no stack may leak');
  });
});

test('an oversized body is refused rather than buffered', async () => {
  await withServer(async (base) => {
    const res = await post(base, '/api/analyze', { text: 'x'.repeat(MAX_BODY + 1024) });
    assert.equal(res.status, 413);
  });
});

test('unknown API routes 404 and wrong methods 405', async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/api/nope`)).status, 404);
    assert.equal((await fetch(`${base}/`, { method: 'DELETE' })).status, 405);
  });
});

test('path traversal cannot escape the public directory', async () => {
  await withServer(async (base) => {
    for (const attack of ['/../package.json', '/..%2f..%2fserver.js', '/js/../../src/gemini.js']) {
      const res = await fetch(`${base}${attack}`);
      assert.ok(res.status === 403 || res.status === 404, `${attack} returned ${res.status}`);
      const text = await res.text();
      assert.doesNotMatch(text, /GEMINI_API_KEY/, `${attack} leaked a source file`);
    }
  });
});

test('the API is rate limited', async () => {
  await withServer(async (base) => {
    const body = { text: 'Shall I bring curd rice?', lang: 'en' };
    let limited = false;
    for (let i = 0; i < 26; i++) {
      const res = await post(base, '/api/analyze', body);
      if (res.status === 429) { limited = true; break; }
    }
    assert.ok(limited, 'the limiter must stop a flood');
  });
});

test('the shared rules module is served to the browser from one copy', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/js/rules.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
    assert.match(await res.text(), /UrimaiRules/);
  });
});
