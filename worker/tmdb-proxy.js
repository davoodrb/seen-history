// Seen History — TMDB search proxy.
// The TMDB API key is stored in Cloudflare as an encrypted secret
// (TMDB_API_KEY) and never leaves Cloudflare. The app only calls
// this worker: GET /search?q=inception

const TMDB_API = 'https://api.themoviedb.org/3'
const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'
const ALLOWED_ORIGINS = ['https://davoodrb.github.io', 'http://localhost:5173']

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function jsonResponse(data, origin, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') || ''

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (request.method !== 'GET' || url.pathname !== '/search') {
      return jsonResponse({ error: 'Not found' }, origin, 404)
    }

    const q = (url.searchParams.get('q') || '').trim()
    if (q.length < 2) return jsonResponse([], origin)
    if (!env.TMDB_API_KEY) {
      return jsonResponse({ error: 'TMDB_API_KEY secret is not set' }, origin, 500)
    }

    // Cache the transformed answer for a day, keyed by query + origin.
    const cache = caches.default
    const cacheKey = new Request(
      `${url.origin}/search?q=${encodeURIComponent(q)}&origin=${encodeURIComponent(origin)}`,
    )
    const cached = await cache.match(cacheKey)
    if (cached) return cached

    const tmdbUrl = new URL(`${TMDB_API}/search/multi`)
    tmdbUrl.searchParams.set('api_key', env.TMDB_API_KEY)
    tmdbUrl.searchParams.set('query', q)
    tmdbUrl.searchParams.set('page', '1')
    tmdbUrl.searchParams.set('include_adult', 'false')

    let tmdbRes
    try {
      tmdbRes = await fetch(tmdbUrl)
    } catch {
      return jsonResponse({ error: 'TMDB is unreachable' }, origin, 502)
    }
    if (!tmdbRes.ok) {
      return jsonResponse({ error: 'TMDB error' }, origin, 502)
    }

    const data = await tmdbRes.json()
    const out = (data.results || [])
      .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
      .slice(0, 8)
      .map((r) => ({
        t: r.title || r.name || '',
        y: (r.release_date || r.first_air_date || '').slice(0, 4),
        k: r.media_type === 'tv' ? 's' : 'm',
        p: r.poster_path ? POSTER_BASE + r.poster_path : '',
        i: String(r.id),
      }))

    const res = jsonResponse(out, origin)
    res.headers.set('Cache-Control', 'public, max-age=86400')
    ctx.waitUntil(cache.put(cacheKey, res.clone()))
    return res
  },
}
