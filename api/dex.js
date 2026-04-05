// api/dex.js — Vercel Serverless Proxy (v4.1 otimizada)
const DEXSCREENER_BASE = 'https://api.dexscreener.com';

const rateLimitMap = new Map();
const cache = new Map(); // cache simples de 30 segundos

const RATE_LIMIT = 80;
const RATE_WINDOW = 60 * 1000;
const CACHE_TTL = 30 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip) || { count: 0, reset: now + RATE_WINDOW };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + RATE_WINDOW;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count <= RATE_LIMIT;
}

const ALLOWED_PATHS = [
  '/latest/dex/search',
  '/latest/dex/pairs/',
  '/token-boosts/latest/v1',
  '/token-boosts/top/v1',
  '/token-profiles/latest/v1',
  '/tokens/v1/',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded (80 req/min)' });

  let dexPath = req.query.path || '';
  if (!dexPath) {
    const match = (req.url || '').match(/^\/api\/dex(\/.*?)(\?|$)/);
    if (match) dexPath = match[1];
  }

  if (!dexPath || !ALLOWED_PATHS.some(p => dexPath.startsWith(p))) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  // Cache
  const cacheKey = dexPath + JSON.stringify(req.query);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.status(200).json({ ...cached.data, _proxy: { ...cached.data._proxy, cached: true } });
  }

  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(req.query)) {
    if (key !== 'path') qs.append(key, val);
  }
  const targetUrl = `${DEXSCREENER_BASE}${dexPath}${qs.toString() ? '?' + qs.toString() : ''}`;

  try {
    const upstream = await fetch(targetUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'SolSniper-Bot/4.1' },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) return res.status(upstream.status).json({ error: `DexScreener ${upstream.status}` });

    const data = await upstream.json();
    const response = {
      _proxy: {
        source: 'dexscreener.com',
        path: dexPath,
        timestamp: new Date().toISOString(),
        cached: false,
      },
      ...data
    };

    cache.set(cacheKey, { data: response, timestamp: Date.now() });
    if (cache.size > 150) cache.delete(cache.keys().next().value);

    return res.status(200).json(response);
  } catch (err) {
    return res.status(err.name === 'TimeoutError' ? 504 : 500).json({ error: err.message, path: dexPath });
  }
}
