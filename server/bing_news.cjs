const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { plainText } = require('./feed_text.cjs');

const LANGUAGES = { eg: 'ar', sa: 'ar', ae: 'ar', ma: 'ar', dz: 'ar', tn: 'ar', jo: 'ar', qa: 'ar', kw: 'ar', lb: 'ar', om: 'ar', iq: 'ar', fr: 'fr', de: 'de', es: 'es', it: 'it', br: 'pt', pt: 'pt', ru: 'ru', jp: 'ja', kr: 'ko', tw: 'zh', cn: 'zh' };
const COUNTRIES = { ar: 'eg', en: 'us', fr: 'fr', de: 'de', es: 'es', it: 'it', pt: 'br', ru: 'ru', ja: 'jp', ko: 'kr', zh: 'tw' };
const CATEGORIES_AR = { general: 'أخبار', business: 'اقتصاد', entertainment: 'فن وترفيه', health: 'صحة', science: 'علوم', sports: 'رياضة', technology: 'تكنولوجيا' };
const SOURCE_DOMAINS = { 'bbc-news': 'bbc.com', cnn: 'cnn.com', reuters: 'reuters.com', 'al-jazeera-english': 'aljazeera.com', 'the-verge': 'theverge.com', wired: 'wired.com' };
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
const text = value => typeof value === 'string' ? value : (value?.['#text'] || '');

function publicUrl(value) {
  try {
    const url = new URL(text(value));
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch (_) { return null; }
}

function publisherUrl(value) {
  const url = publicUrl(value);
  if (!url) return null;
  if (['www.bing.com', 'bing.com'].includes(url.hostname) && url.pathname === '/news/apiclick.aspx') {
    return publicUrl(url.searchParams.get('url'))?.href || null;
  }
  return url.href;
}

function thumbnailUrl(value) {
  const url = publicUrl(value);
  if (!url || !['www.bing.com', 'bing.com'].includes(url.hostname) || url.pathname !== '/th') return null;
  const id = url.searchParams.get('id');
  if (!id || !/^[A-Za-z0-9_.-]{1,180}$/.test(id)) return null;
  const origin = process.env.PUBLIC_APP_ORIGIN || 'https://news-app-five-kappa-90.vercel.app';
  const proxy = new URL('/api/news-image', origin);
  proxy.searchParams.set('id', id);
  return proxy.href;
}

async function fetchBingNews(endpoint, query) {
  const country = String(query.country || COUNTRIES[query.language] || 'us').toLowerCase();
  const language = String(query.language || LANGUAGES[country] || 'en');
  const region = new Intl.DisplayNames([language], { type: 'region' }).of(country.toUpperCase());
  const terms = endpoint === 'v2/everything'
    ? [String(query.q || '')]
    : [language === 'ar' ? (CATEGORIES_AR[query.category || 'general'] || 'أخبار') : `${query.category || 'latest'} news`, region];
  if (endpoint === 'v2/top-headlines' && query.q) terms.push(String(query.q));
  if (query.sources) {
    const domains = String(query.sources).split(',').map(source => SOURCE_DOMAINS[source.trim()] || source.trim());
    if (!domains.every(domain => /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(domain))) throw new Error('Use alternate provider for this source filter');
    terms.push(`(${domains.map(domain => `site:${domain}`).join(' OR ')})`);
  }
  const target = new URL('https://www.bing.com/news/search');
  target.searchParams.set('q', terms.join(' '));
  target.searchParams.set('format', 'rss');
  target.searchParams.set('cc', country);
  target.searchParams.set('setlang', language);
  target.searchParams.set('mkt', `${language}-${country}`);
  target.searchParams.set('count', '100');
  if (query.sortBy === 'publishedAt') target.searchParams.set('sortbydate', '1');
  const upstream = await fetch(target, { signal: AbortSignal.timeout(2500) });
  if (!upstream.ok) throw new Error('Image news feed unavailable');
  const xml = await upstream.text();
  if (xml.length > 2_000_000 || /<!DOCTYPE/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid image feed');
  const channel = parser.parse(xml)?.rss?.channel;
  const items = channel?.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
  if (!items.some(item => item['News:Source'])) throw new Error('No image feed entries');
  const seen = new Set();
  const articles = [];
  const oldestHeadline = Date.now() - 7 * 86400000;
  for (const item of items) {
    const url = publisherUrl(item.link);
    const title = plainText(text(item.title));
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    const date = new Date(text(item.pubDate));
    if (endpoint === 'v2/top-headlines' && date.getTime() < oldestHeadline) continue;
    if (query.from && date < new Date(String(query.from).slice(0, 10))) continue;
    if (query.to && date >= new Date(new Date(String(query.to).slice(0, 10)).getTime() + 86400000)) continue;
    const sourceName = text(item['News:Source']) || new URL(url).hostname;
    articles.push({
      source: { id: null, name: sourceName }, author: sourceName, title,
      description: plainText(text(item.description)) || null,
      url, urlToImage: thumbnailUrl(item['News:Image']),
      publishedAt: Number.isNaN(date.getTime()) ? null : date.toISOString(), content: null,
    });
  }
  if (!articles.length) throw new Error('No matching image feed entries');
  if (query.sortBy === 'publishedAt') articles.sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''));
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 20);
  return { status: 'ok', totalResults: articles.length, articles: articles.slice((page - 1) * pageSize, page * pageSize), provider: 'bing-news' };
}

module.exports = { fetchBingNews };
