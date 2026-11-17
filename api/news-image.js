module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const id = req.query?.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_.-]{1,180}$/.test(id)) return res.status(400).json({ error: 'Invalid image ID' });
  const target = new URL('https://www.bing.com/th');
  target.searchParams.set('id', id);
  target.searchParams.set('pid', 'News');
  try {
    const upstream = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !/^image\/(jpeg|png|webp|avif|gif)(;|$)/i.test(contentType)) throw new Error('No image');
    if (Number(upstream.headers.get('content-length')) > 2_000_000) throw new Error('Image too large');
    const reader = upstream.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) { await reader.cancel(); throw new Error('Image too large'); }
      chunks.push(value);
    }
    if (!size) throw new Error('Empty image');
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
    return res.status(200).send(Buffer.concat(chunks));
  } catch (_) {
    return res.status(502).json({ error: 'Article image unavailable' });
  }
};
