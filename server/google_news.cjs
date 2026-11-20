const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { plainText } = require('./feed_text.cjs');

const COUNTRY_LANGUAGES = {
  eg: 'ar', sa: 'ar', ae: 'ar', qa: 'ar', kw: 'ar', jo: 'ar', lb: 'ar',
  ma: 'ar', dz: 'ar', tn: 'ar', iq: 'ar', bh: 'ar', om: 'ar', ye: 'ar',
  fr: 'fr', de: 'de', es: 'es', it: 'it', br: 'pt', pt: 'pt', ru: 'ru',
  jp: 'ja', kr: 'ko', cn: 'zh', tw: 'zh',
};
const LANGUAGE_COUNTRIES = { ar: 'eg', en: 'us', de: 'de', fr: 'fr', ru: 'ru', it: 'it', es: 'es', pt: 'br', zh: 'tw', ja: 'jp', ko: 'kr' };
const TOPICS = { business: 'BUSINESS', entertainment: 'ENTERTAINMENT', health: 'HEALTH', science: 'SCIENCE', sports: 'SPORTS', technology: 'TECHNOLOGY', general: '' };
const SOURCE_DOMAINS = { 'bbc-news': 'bbc.com', cnn: 'cnn.com', reuters: 'reuters.com', 'al-jazeera-english': 'aljazeera.com', 'the-verge': 'theverge.com', wired: 'wired.com' };
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, processEntities: true });

function text(value) {
  return typeof value === 'string' ? value : (value?.['#text'] || '');
}

function safeUrl(value) {
  try {
    const url = new URL(text(value));
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch (_) { return null; }
}

function buildFeedUrl(endpoint, query) {
  const country = String(query.country || LANGUAGE_COUNTRIES[query.language] || 'us').toLowerCase();
  const language = String(query.language || COUNTRY_LANGUAGES[country] || 'en');
  let path = '/rss';
  const search = endpoint === 'v2/everything' || (endpoint === 'v2/top-headlines' && (query.q || query.sources));
  if (search) path = '/rss/search';
  else if (TOPICS[query.category]) path = `/rss/headlines/section/topic/${TOPICS[query.category]}`;
  const url = new URL(path, 'https://news.google.com');
  url.searchParams.set('hl', language);
  url.searchParams.set('gl', country.toUpperCase());
  url.searchParams.set('ceid', `${country.toUpperCase()}:${language}`);
  if (search) {
    const terms = [String(query.q || '')];
    if (endpoint === 'v2/top-headlines' && query.category && query.category !== 'general') terms.push(query.category);
    if (query.from) terms.push(`after:${String(query.from).slice(0, 10)}`);
    if (query.to) {
      const end = new Date(`${String(query.to).slice(0, 10)}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      terms.push(`before:${end.toISOString().slice(0, 10)}`);
    }
    if (query.sources) {
      const domains = String(query.sources).split(',').map(value => SOURCE_DOMAINS[value.trim()] || value.trim()).filter(Boolean);
      terms.push(`(${domains.map(domain => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) ? `site:${domain}` : `"${domain.replace(/["()]/g, '')}"`).join(' OR ')})`);
    }
    url.searchParams.set('q', terms.join(' '));
  }
  return url;
}

async function fetchGoogleNews(endpoint, query) {
  const upstream = await fetch(buildFeedUrl(endpoint, query), { signal: AbortSignal.timeout(3000) });
  if (!upstream.ok) throw new Error('Feed unavailable');
  const xml = await upstream.text();
  if (xml.length > 2_000_000 || /<!DOCTYPE/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid feed');
  const channel = parser.parse(xml)?.rss?.channel;
  if (!channel) throw new Error('Invalid feed');
  const items = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
  const seen = new Set();
  const articles = [];
  const oldestHeadline = Date.now() - 7 * 86400000;
  for (const item of items) {
    const url = safeUrl(item.link);
    const title = plainText(text(item.title));
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    const date = new Date(text(item.pubDate));
    if (endpoint === 'v2/top-headlines' && date.getTime() < oldestHeadline) continue;
    const summary = plainText(text(item.description));
    articles.push({
      source: { id: null, name: text(item.source) || 'Google News' },
      author: text(item.source) || null,
      title,
      description: summary || null,
      url,
      urlToImage: safeUrl(item['media:content']?.['@_url'] || item.enclosure?.['@_url']),
      publishedAt: Number.isNaN(date.getTime()) ? null : date.toISOString(),
      content: null,
    });
  }
  if (endpoint === 'v2/top-headlines/sources') {
    const sources = [...new Map(articles.map(article => [article.source.name, { id: article.source.name, name: article.source.name }])).values()];
    return { status: 'ok', sources, provider: 'google-news' };
  }
  if (query.sortBy === 'publishedAt') articles.sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''));
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 20);
  return { status: 'ok', totalResults: articles.length, articles: articles.slice((page - 1) * pageSize, page * pageSize), provider: 'google-news' };
}

module.exports = { fetchGoogleNews };
