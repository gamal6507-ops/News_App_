const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { fetchBingNews } = require('../server/bing_news.cjs');
const { fetchGoogleNews } = require('../server/google_news.cjs');
const news = require('../api/news.js');
const originalFetch = global.fetch;
const originalKey = process.env.NEWS_API_KEY;
const now = Date.now();
const day = 86400000;
const feed = (items) => `<rss xmlns:News="https://www.bing.com/news"><channel>${items.map((item, i) => `<item><title>${item.title || 'Headline'}</title><link>https://publisher.example/${i}</link><pubDate>${item.date ?? new Date(now).toUTCString()}</pubDate><source>Publisher</source><News:Source>Publisher</News:Source><description>${item.description || 'Summary'}</description></item>`).join('')}</channel></rss>`;

afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.NEWS_API_KEY;
  else process.env.NEWS_API_KEY = originalKey;
});

for (const [name, provider] of [['Bing', fetchBingNews], ['Google', fetchGoogleNews]]) {
  test(`${name} headlines omit old dates while keeping recent and unknown dates`, async () => {
    global.fetch = async () => new Response(feed([
      { title: 'Old', date: new Date(now - 8 * day).toUTCString() },
      { title: 'Recent', date: new Date(now - 6 * day).toUTCString() },
      { title: 'Unknown', date: 'invalid date' },
    ]));
    const result = await provider('v2/top-headlines', { country: 'eg' });
    assert.deepEqual(result.articles.map(article => article.title), ['Recent', 'Unknown']);
    assert.equal(result.totalResults, 2);
    assert.equal(result.articles[1].publishedAt, null);
  });

  test(`${name} historical search retains articles older than seven days`, async () => {
    global.fetch = async () => new Response(feed([{ date: new Date(now - 365 * day).toUTCString() }]));
    const result = await provider('v2/everything', { q: 'history' });
    assert.equal(result.articles.length, 1);
  });

  test(`${name} decodes nested numeric and named HTML entities into readable text`, async () => {
    global.fetch = async () => new Response(feed([{
      title: 'العالم &amp;#171;البحر&amp;#187; &amp;nbsp; &amp;amp; science',
      description: '&amp;lt;p&amp;gt;A&amp;nbsp;B &amp;#x2014; science &amp;amp; news&amp;lt;/p&amp;gt;',
    }]));
    const result = await provider('v2/top-headlines', {});
    assert.equal(result.articles[0].title, 'العالم «البحر» & science');
    assert.equal(result.articles[0].description, 'A B — science & news');
  });
}

test('old-only Bing headlines trigger the current Google fallback', async () => {
  delete process.env.NEWS_API_KEY;
  global.fetch = async url => new URL(url).hostname === 'www.bing.com'
    ? new Response(feed([{ title: 'Old Bing', date: new Date(now - 365 * day).toUTCString() }]))
    : new Response(feed([{ title: 'Current Google' }]));
  const res = {
    status(code) { this.code = code; return this; },
    setHeader() {}, json(body) { this.body = body; return this; },
  };
  await news({ method: 'GET', query: { endpoint: 'v2/top-headlines', country: 'eg' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.provider, 'google-news');
  assert.equal(res.body.articles[0].title, 'Current Google');
});
