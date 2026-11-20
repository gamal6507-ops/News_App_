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

test('only loopback development origins get cross-origin read access', async () => {
  for (const [origin, allowed] of [['http://localhost:8080', true], ['http://127.0.0.1:8080', true], ['https://other.example', false], ['http://localhost.other.example:8080', false]]) {
    const res = response();
    await handler({ method: 'GET', headers: { origin }, query: {} }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.headers.Vary, 'Origin');
    assert.equal(res.headers['Access-Control-Allow-Origin'], allowed ? origin : undefined);
  }
});

const rss = (items) => `<?xml version="1.0"?><rss version="2.0"><channel>${items.map((item, index) => `<item><title>${item.title || `Headline ${index + 1}`}</title><link>${item.url || `https://news.google.com/rss/articles/article-${index}`}</link><pubDate>${item.date ?? new Date().toUTCString()}</pubDate><source url="https://publisher.example">Publisher</source><description>&lt;p&gt;News summary&lt;/p&gt;</description></item>`).join('')}</channel></rss>`;

test('serves current Egyptian feeds without requiring a NewsAPI key', async () => {
  delete process.env.NEWS_API_KEY;
  let target;
  global.fetch = async (url) => {
    target = new URL(url);
    return new Response(rss([{}]), { headers: { 'Content-Type': 'application/xml' } });
  };
  const res = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/top-headlines', country: 'eg', category: 'technology' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(target.origin, 'https://news.google.com');
  assert.equal(target.pathname, '/rss/headlines/section/topic/TECHNOLOGY');
  assert.equal(target.searchParams.get('ceid'), 'EG:ar');
  assert.equal(target.searchParams.has('apiKey'), false);
  assert.equal(res.body.articles[0].source.name, 'Publisher');
  assert.equal(res.body.articles[0].urlToImage, null);
  assert.equal(res.body.articles[0].description, 'News summary');
});

test('forwards filters with the server key and preserves upstream errors', async () => {
  process.env.NEWS_API_KEY = 'server-test-key';
  let target;
  global.fetch = async (url) => {
    target ||= url;
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

test('empty NewsAPI results fall back to regional headlines', async () => {
  process.env.NEWS_API_KEY = 'server-test-key';
  global.fetch = async (url) => new URL(url).hostname === 'newsapi.org'
    ? Response.json({ status: 'ok', totalResults: 0, articles: [] })
    : new Response(rss([{}]));
  const res = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/top-headlines', country: 'eg' } }, res);
  assert.equal(res.body.provider, 'google-news');
  assert.equal(res.body.articles.length, 1);
});

test('upstream failures still serve fallback search with language and date filters', async () => {
  process.env.NEWS_API_KEY = 'server-test-key';
  let target;
  global.fetch = async (url) => {
    if (new URL(url).hostname === 'newsapi.org') throw new Error('offline');
    target = new URL(url);
    return new Response(rss([{}]));
  };
  const res = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/everything', q: 'علوم & تقنية', language: 'ar', from: '2026-11-01', to: '2026-11-17' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(target.pathname, '/rss/search');
  assert.equal(target.searchParams.get('hl'), 'ar');
  assert.match(target.searchParams.get('q'), /علوم & تقنية/);
  assert.match(target.searchParams.get('q'), /after:2026-11-01/);
  assert.match(target.searchParams.get('q'), /before:2026-11-18/);
});

test('exhausted NewsAPI pages remain empty without switching provider', async () => {
  process.env.NEWS_API_KEY = 'server-test-key';
  let calls = 0;
  global.fetch = async () => { calls++; return Response.json({ status: 'ok', totalResults: 1, articles: [] }); };
  const res = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/everything', q: 'technology', page: '2' } }, res);
  assert.equal(calls, 1);
  assert.equal(JSON.parse(res.body).articles.length, 0);
});

test('feed pagination is finite and duplicate or unsafe article links are discarded', async () => {
  delete process.env.NEWS_API_KEY;
  global.fetch = async () => new Response(rss([{url:'javascript:alert(1)'}, {url:'https://news.google.com/rss/articles/one'}, {url:'https://news.google.com/rss/articles/one'}, {url:'https://news.google.com/rss/articles/two'}]));
  const res = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/top-headlines', page: '2', pageSize: '1' } }, res);
  assert.equal(res.body.totalResults, 2);
  assert.equal(res.body.articles.length, 1);
  assert.equal(res.body.articles[0].url, 'https://news.google.com/rss/articles/two');
  const last = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/top-headlines', page: '3', pageSize: '1' } }, last);
  assert.equal(last.body.articles.length, 0);
});

test('invalid pages and malformed external feeds do not produce success payloads', async () => {
  delete process.env.NEWS_API_KEY;
  global.fetch = async () => new Response('<html>Service unavailable</html>');
  const invalid = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/top-headlines', page: '-1' } }, invalid);
  assert.equal(invalid.statusCode, 400);
  const badFeed = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/top-headlines' } }, badFeed);
  assert.equal(badFeed.statusCode, 502);
});

test('returns a gateway error when upstream is unreachable', async () => {
  process.env.NEWS_API_KEY = 'server-test-key';
  global.fetch = async () => { throw new Error('offline'); };
  const res = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/top-headlines' } }, res);
  assert.equal(res.statusCode, 502);
});

test('rejects impossible, ambiguous and reversed dates before contacting providers', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return new Response(rss([{}])); };
  for (const filters of [
    { from: '2026-02-31' }, { from: '2025-02-29' }, { from: '2026-13-01' },
    { from: '19-11-2026' }, { from: '2026-11-19junk' },
    { from: '2026-11-19T12:00:00Z' }, { from: '2026-11-19', to: '2026-01-01' },
  ]) {
    const res = response();
    await handler({ method: 'GET', query: { endpoint: 'v2/everything', q: 'news', ...filters } }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(filters));
  }
  assert.equal(calls, 0);
});

test('accepts leap days and normalizes legacy sort spelling for the primary provider', async () => {
  process.env.NEWS_API_KEY = 'server-test-key';
  let target;
  global.fetch = async url => { target = new URL(url); return Response.json({ status: 'ok', totalResults: 1, articles: [{ title: 'Leap day' }] }); };
  const res = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/everything', q: 'news', from: '2024-02-29', to: '2024-02-29', sortBy: 'relevance' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(target.searchParams.get('sortBy'), 'relevancy');
});

test('rejects unknown locales, sort orders and unsupported headline filters explicitly', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; return new Response(rss([{}])); };
  for (const filters of [{country:'zz'}, {country:'xx'}, {language:'zz'}, {sortBy:'random'}, {from:'2026-11-01'}, {sources:'bbc-news',country:'us'}]) {
    const res = response();
    await handler({ method: 'GET', query: { endpoint: 'v2/top-headlines', ...filters } }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(filters));
    assert.match(res.body.message, /filters|date|sources/i);
  }
  assert.equal(calls, 0);
});

test('valid territories remain accepted and feed-only languages bypass the primary provider', async () => {
  process.env.NEWS_API_KEY = 'server-test-key';
  for (const language of ['ja', 'ko', 'ur']) {
    const targets = [];
    global.fetch = async url => { targets.push(new URL(url)); return new Response(rss([{}])); };
    const res = response();
    await handler({ method: 'GET', query: { endpoint: 'v2/everything', q: 'news', language, country: 'aq' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(targets.some(url => url.hostname === 'newsapi.org'), false, language);
  }
});

test('Google headline fallback includes keyword and source constraints', async () => {
  delete process.env.NEWS_API_KEY;
  let target;
  global.fetch = async url => { target = new URL(url); return new Response(rss([{}])); };
  const res = response();
  await handler({ method: 'GET', query: { endpoint: 'v2/top-headlines', q: 'space exploration', sources: 'bbc-news' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(target.pathname, '/rss/search');
  assert.match(target.searchParams.get('q'), /space exploration/);
  assert.match(target.searchParams.get('q'), /site:bbc.com/);
});
