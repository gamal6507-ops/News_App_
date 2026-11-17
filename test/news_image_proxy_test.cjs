const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/news-image.js');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
function response() {
  return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, setHeader(key, value) { this.headers[key] = value; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } };
}

test('image proxy only fetches fixed Bing thumbnails and returns binary images', async () => {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02]);
  let target;
  global.fetch = async (url, options) => {
    target = new URL(url);
    assert.equal(options.redirect, 'error');
    return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg' } });
  };
  const res = response();
  await handler({ method: 'GET', query: { id: 'ONUT.real-image' } }, res);
  assert.equal(target.origin, 'https://www.bing.com');
  assert.equal(target.pathname, '/th');
  assert.equal(target.searchParams.get('id'), 'ONUT.real-image');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, bytes);
  assert.equal(res.headers['Content-Type'], 'image/jpeg');
  assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
});

test('rejects URL injection, arrays, missing IDs, and mutations without fetching', async () => {
  global.fetch = async () => { throw new Error('Must not fetch'); };
  for (const id of [undefined, ['a'], 'http://127.0.0.1/private', 'ONUT.x&url=secret', 'x'.repeat(181)]) {
    const res = response();
    await handler({ method: 'GET', query: { id } }, res);
    assert.equal(res.statusCode, 400);
  }
  const res = response();
  await handler({ method: 'POST', query: { id: 'ONUT.valid' } }, res);
  assert.equal(res.statusCode, 405);
});

test('does not relay HTML, oversized images, or upstream failures as images', async () => {
  for (const upstream of [
    new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('large', { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '3000000' } }),
    new Response(Buffer.alloc(2_000_001), { headers: { 'Content-Type': 'image/jpeg' } }),
    new Response('Not found', { status: 404 }),
  ]) {
    global.fetch = async () => upstream;
    const res = response();
    await handler({ method: 'GET', query: { id: 'ONUT.valid' } }, res);
    assert.equal(res.statusCode, 502);
  }
});
