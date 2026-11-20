const ALLOWED_ENDPOINTS = new Set([
  'v2/top-headlines',
  'v2/everything',
  'v2/top-headlines/sources',
]);
const { fetchGoogleNews } = require('../server/google_news.cjs');
const { fetchBingNews } = require('../server/bing_news.cjs');
const COUNTRIES = new Set('ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw'.split(' '));
const PRIMARY_LANGUAGES = new Set('ar de en es fr he it nl no pt ru sv ud zh'.split(' '));
const LANGUAGES = new Set([...PRIMARY_LANGUAGES, 'ja', 'ko', 'ur']);

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const rawEndpoint = Array.isArray(req.query?.endpoint)
    ? req.query.endpoint.join('/')
    : (req.query?.endpoint || '');
  const endpoint = String(rawEndpoint).replace(/^\/+/, '');

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return res.status(400).json({ status: 'error', message: 'Invalid endpoint' });
  }

  const query = { ...req.query };
  if (typeof query.country === 'string') query.country = query.country.toLowerCase();
  if (typeof query.language === 'string') query.language = query.language.toLowerCase();
  if (query.sortBy === 'relevance') query.sortBy = 'relevancy';
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 20);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
      (query.country && !COUNTRIES.has(query.country)) ||
      (query.language && !LANGUAGES.has(query.language)) ||
      (query.sortBy && !['relevancy', 'popularity', 'publishedAt'].includes(query.sortBy)) ||
      (query.category && !['general', 'business', 'entertainment', 'health', 'science', 'sports', 'technology'].includes(query.category)) ||
      [query.from, query.to].some(value => value !== undefined && !validDate(value)) ||
      (query.from && query.to && query.from > query.to) ||
      String(query.q || '').length > 500 ||
      (endpoint === 'v2/everything' && !String(query.q || '').trim() && !query.sources)) {
    return res.status(400).json({ status: 'error', message: 'Invalid news filters' });
  }
  if (endpoint !== 'v2/everything' && (query.from || query.to)) {
    return res.status(400).json({ status: 'error', message: 'Date filters require the v2/everything endpoint' });
  }
  if (endpoint === 'v2/top-headlines' && query.sources && (query.country || query.category)) {
    return res.status(400).json({ status: 'error', message: 'Sources cannot be combined with country or category filters' });
  }

  const apiKey = (process.env.NEWS_API_KEY || '').trim();
  let originalResponse;
  try {
    if (!apiKey || (query.language && !PRIMARY_LANGUAGES.has(query.language))) throw new Error('Use feed provider');
    const targetUrl = new URL(`https://newsapi.org/${endpoint}`);
    for (const [key, value] of Object.entries(query)) {
      if (key === 'endpoint' || key === 'apiKey') continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          targetUrl.searchParams.append(key, String(item));
        }
      } else if (value !== undefined) {
        targetUrl.searchParams.set(key, String(value));
      }
    }
    targetUrl.searchParams.set('apiKey', apiKey);

    const upstream = await fetch(targetUrl, { signal: AbortSignal.timeout(3000) });
    const body = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';
    originalResponse = { status: upstream.status, body, contentType };
    const data = JSON.parse(body);
    const articlesEmpty = Array.isArray(data.articles) && data.articles.length === 0 && Number(data.totalResults || 0) === 0;
    if (upstream.ok && !articlesEmpty) {
      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      return res.send(body);
    }
    if (upstream.status === 400) {
      return res.status(400).json(data);
    }
  } catch (_) { /* Try the independent feed provider. */ }

  try {
    if (endpoint !== 'v2/top-headlines/sources') {
      const data = await fetchBingNews(endpoint, query);
      res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
      return res.status(200).json(data);
    }
  } catch (_) { /* Keep the text feed as a final fallback. */ }

  try {
    const data = await fetchGoogleNews(endpoint, query);
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (_) {
    if (originalResponse && originalResponse.status >= 400) {
      res.setHeader('Content-Type', originalResponse.contentType);
      return res.status(originalResponse.status).send(originalResponse.body);
    }
    return res.status(502).json({ status: 'error', message: 'News sources are temporarily unavailable. Please try again.' });
  }
};
