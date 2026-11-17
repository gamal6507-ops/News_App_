const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/news.js');
const originalFetch = global.fetch;
const originalKey = process.env.NEWS_API_KEY;

afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.NEWS_API_KEY;
  else process.env.NEWS_API_KEY = originalKey;
});

function response() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
  };
}

test('rejects mutations and paths outside the NewsAPI allowlist', async () => {
  for (const req of [{ method: 'POST', query: {} }, { method: 'GET', query: { endpoint: 'https://example.com' } }]) {
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, req.method === 'POST' ? 405 : 400);
  }
});

test('requires a configured server API key', async () => {
  delete process.env.NEWS_API_KEY;
  const res = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/top-headlines' } }, res);
  assert.equal(res.statusCode, 500);
});

test('forwards filters with the server key and preserves upstream errors', async () => {
  process.env.NEWS_API_KEY = 'server-test-key';
  let target;
  global.fetch = async (url) => {
    target = url;
    return new Response('{"status":"error","code":"rateLimited"}', { status: 429, headers: { 'Content-Type': 'application/json' } });
  };
  const res = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/everything', q: 'news & science', apiKey: 'untrusted-key', page: '2' } }, res);
  assert.equal(target.origin, 'https://newsapi.org');
  assert.equal(target.pathname, '/v2/everything');
  assert.equal(target.searchParams.get('apiKey'), 'server-test-key');
  assert.equal(target.searchParams.get('q'), 'news & science');
  assert.equal(target.searchParams.get('page'), '2');
  assert.equal(target.searchParams.has('endpoint'), false);
  assert.equal(res.statusCode, 429);
  assert.equal(JSON.parse(res.body).code, 'rateLimited');
});

test('returns a gateway error when upstream is unreachable', async () => {
  process.env.NEWS_API_KEY = 'server-test-key';
  global.fetch = async () => { throw new Error('offline'); };
  const res = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/top-headlines' } }, res);
  assert.equal(res.statusCode, 502);
});
