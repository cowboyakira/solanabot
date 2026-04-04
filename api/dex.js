// api/dex.js — Vercel Serverless Proxy para DexScreener
// Elimina CORS e serve dados reais da Solana para o SOL SNIPER bot

const DEXSCREENER_BASE = 'https://api.dexscreener.com';

// Rate limit simples em memória (por IP)
const rateLimitMap = new Map();
const RATE_LIMIT = 60; // requisições por minuto por IP
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, reset: now + RATE_WINDOW };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + RATE_WINDOW;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count <= RATE_LIMIT;
}

// Endpoints permitidos (whitelist de segurança)
const ALLOWED_PATHS = [
  '/latest/dex/search',
  '/latest/dex/pairs/',
  '/token-boosts/latest/v1',
  '/token-boosts/top/v1',
  '/token-profiles/latest/v1',
  '/tokens/v1/',
];

function isAllowed(path) {
  return ALLOWED_PATHS.some(allowed => path.startsWith(allowed));
}

export default async function handler(req, res) {
  // CORS headers — permite qualquer origem (ajuste para seu domínio em produção)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Max 60 req/min.' });
  }

  // Extrai o path da DexScreener a partir de ?path=/latest/dex/search&q=BONK
  // ou de /api/dex/latest/dex/search?q=BONK
  let dexPath = req.query.path || '';
  
  // Se não veio via ?path=, tenta extrair do URL
  if (!dexPath) {
    // Remove o prefixo /api/dex do pathname
    const rawUrl = req.url || '';
    const match = rawUrl.match(/^\/api\/dex(\/.*?)(\?|$)/);
    if (match) dexPath = match[1];
  }

  if (!dexPath) {
    return res.status(400).json({
      error: 'Missing path parameter',
      usage: '/api/dex?path=/latest/dex/search&q=BONK',
      examples: [
        '/api/dex?path=/latest/dex/search&q=BONK',
        '/api/dex?path=/token-boosts/latest/v1',
        '/api/dex?path=/token-profiles/latest/v1',
        '/api/dex?path=/latest/dex/pairs/solana/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      ]
    });
  }

  // Segurança: só paths autorizados
  if (!isAllowed(dexPath)) {
    return res.status(403).json({
      error: 'Path not allowed',
      allowed: ALLOWED_PATHS
    });
  }

  // Monta query string (exclui 'path' do nosso parâmetro interno)
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(req.query)) {
    if (key !== 'path') qs.append(key, val);
  }
  const qsStr = qs.toString();
  const targetUrl = `${DEXSCREENER_BASE}${dexPath}${qsStr ? '?' + qsStr : ''}`;

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SolSniper-Bot/2.0',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `DexScreener returned ${upstream.status}`,
        url: targetUrl
      });
    }

    const data = await upstream.json();

    // Adiciona metadata do proxy
    const response = {
      _proxy: {
        source: 'dexscreener.com',
        path: dexPath,
        timestamp: new Date().toISOString(),
        cached: false,
      },
      ...data
    };

    return res.status(200).json(response);

  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'DexScreener timeout', path: dexPath });
    }
    return res.status(500).json({
      error: 'Proxy error',
      message: err.message,
      path: dexPath
    });
  }
}
