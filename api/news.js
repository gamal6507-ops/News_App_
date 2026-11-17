const ALLOWED_ENDPOINTS = new Set([
  'v2/top-headlines',
  'v2/everything',
  'v2/top-headlines/sources',
]);

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

  const apiKey = (process.env.NEWS_API_KEY || '').trim();
  if (!apiKey) {
    return res
      .status(500)
      .json({ status: 'error', message: 'NEWS_API_KEY is not configured' });
  }

  try {
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

    const upstream = await fetch(targetUrl);
    const body = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    return res.send(body);
  } catch (_) {
    return res
      .status(502)
      .json({ status: 'error', message: 'Failed to reach NewsAPI upstream' });
  }
};
