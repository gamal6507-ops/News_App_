const ALLOWED_ENDPOINTS = new Set([
  'v2/top-headlines',
  'v2/everything',
  'v2/top-headlines/sources',
]);
const { fetchGoogleNews } = require('../server/google_news.cjs');

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

  const query = req.query || {};
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 20);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
      (query.country && !/^[a-z]{2}$/i.test(query.country)) ||
      (query.language && !/^[a-z]{2}$/i.test(query.language)) ||
      (query.category && !['general', 'business', 'entertainment', 'health', 'science', 'sports', 'technology'].includes(query.category)) ||
      [query.from, query.to].some(value => value && (!/^\d{4}-\d{2}-\d{2}/.test(value) || Number.isNaN(Date.parse(value)))) ||
      String(query.q || '').length > 500 ||
      (endpoint === 'v2/everything' && !String(query.q || '').trim() && !query.sources)) {
    return res.status(400).json({ status: 'error', message: 'Invalid news filters' });
  }

  const apiKey = (process.env.NEWS_API_KEY || '').trim();
  let originalResponse;
  try {
    if (!apiKey) throw new Error('Use feed provider');
    const targetUrl = new URL(`https://newsapi.org/${endpoint}`);
    for (const [key, value] of Object.entries(req.query || {})) {
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

    const upstream = await fetch(targetUrl, { signal: AbortSignal.timeout(4000) });
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
