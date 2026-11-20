const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const news = require('../api/news.js');
const originalFetch = global.fetch;
const originalKey = process.env.NEWS_API_KEY;
afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.NEWS_API_KEY;
  else process.env.NEWS_API_KEY = originalKey;
});

function response() {
  return {
    statusCode: 200, headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
  };
}

const feed = `<?xml version="1.0"?><rss version="2.0" xmlns:News="https://www.bing.com/news"><channel><item>
  <title>خبر مصري مصوّر</title><link>http://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fpublisher.example%2Fstory</link>
  <description>تفاصيل الخبر</description><pubDate>${new Date().toUTCString()}</pubDate>
  <News:Source>الناشر</News:Source><News:Image>http://www.bing.com/th?id=ONUT.real-news-photo&amp;pid=News</News:Image>
</item></channel></rss>`;

test('empty primary news uses real article thumbnails and direct publisher links', async () => {
  delete process.env.NEWS_API_KEY;
  global.fetch = async url => {
    assert.equal(new URL(url).hostname, 'www.bing.com');
    return new Response(feed);
  };
  const res = response();
  await news({ method: 'GET', query: { endpoint: 'v2/top-headlines', country: 'eg' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.provider, 'bing-news');
  assert.equal(res.body.articles[0].source.name, 'الناشر');
  assert.equal(res.body.articles[0].url, 'https://publisher.example/story');
  const imageUrl = new URL(res.body.articles[0].urlToImage);
  assert.equal(imageUrl.pathname, '/api/news-image');
  assert.equal(imageUrl.searchParams.get('id'), 'ONUT.real-news-photo');
});

test('image feed preserves Arabic search and finite pagination', async () => {
  delete process.env.NEWS_API_KEY;
  let target;
  global.fetch = async url => { target = new URL(url); return new Response(feed); };
  const res = response();
  await news({ method: 'GET', query: { endpoint: 'v2/everything', q: 'اقتصاد مصر', language: 'ar', page: '2', pageSize: '1' } }, res);
  assert.equal(target.searchParams.get('setlang'), 'ar');
  assert.match(target.searchParams.get('q'), /اقتصاد مصر/);
  assert.equal(res.body.totalResults, 1);
  assert.equal(res.body.articles.length, 0);
});

test('multiple publishers are OR site filters rather than words in the article', async () => {
  delete process.env.NEWS_API_KEY;
  let target;
  global.fetch = async url => { target = new URL(url); return new Response(feed); };
  const res = response();
  await news({ method: 'GET', query: { endpoint: 'v2/everything', q: 'technology', sources: 'bbc-news, cnn' } }, res);
  assert.match(target.searchParams.get('q'), /\(site:bbc\.com OR site:cnn\.com\)/);
  assert.equal(res.body.provider, 'bing-news');
});

test('headline keyword filters are preserved by the image provider', async () => {
  delete process.env.NEWS_API_KEY;
  let target;
  global.fetch = async url => { target = new URL(url); return new Response(feed); };
  const res = response();
  await news({ method: 'GET', query: { endpoint: 'v2/top-headlines', country: 'eg', category: 'science', q: 'space exploration' } }, res);
  assert.equal(res.body.provider, 'bing-news');
  assert.match(target.searchParams.get('q'), /space exploration/);
});
