import { norm, type Item } from './types'

export interface Suggestion {
  t: string
  y: string
  k: 'm' | 's'
  p: string
  i: string
}

/**
 * Titles & posters.
 * TMDB is the main source, reached through a Cloudflare Worker proxy
 * (https://seen-history-tmdb.davood3284.workers.dev) that holds the TMDB
 * API key server-side, so the key never reaches the browser. If the worker
 * is unreachable, autocomplete falls back to IMDb's public suggestion feed
 * and TVMaze, both free and keyless.
 */
const WORKER_URL = 'https://seen-history-tmdb.davood3284.workers.dev'

export async function searchTitles(q: string): Promise<Suggestion[]> {
  q = q.trim()
  if (q.length < 2) return []
  const out: Suggestion[] = []
  const seen = new Set<string>()
  const push = (x: Suggestion) => {
    const k = `${x.i}|${norm(x.t)}|${x.y}`
    if (!x.t || seen.has(k)) return
    seen.add(k)
    out.push(x)
  }

  try {
    const r = await fetch(`${WORKER_URL}/search?q=${encodeURIComponent(q)}`)
    if (r.ok) {
      const j = await r.json()
      ;(Array.isArray(j) ? j : []).forEach((d: { t?: string; y?: string; k?: string; p?: string; i?: string | number }) => {
        if (!d.t) return
        push({ t: d.t, y: d.y || '', k: d.k === 's' ? 's' : 'm', p: d.p || '', i: d.i != null ? String(d.i) : '' })
      })
    }
  } catch {
    /* worker unreachable — the IMDb feed and TVMaze below still work */
  }

  if (out.length < 5) {
  try {
    const first = q[0].toLowerCase()
    const letter = /[a-z]/.test(first) ? first : 'x'
    const r = await fetch(
      `https://v2.sg.media-imdb.com/suggestion/titles/${letter}/${encodeURIComponent(q)}.json`,
    )
    const j = await r.json()
    ;(j.d || []).slice(0, 10).forEach((d: { l?: string; y?: number; qid?: string; q?: string; i?: { imageUrl?: string }; id?: string }) => {
      if (!d.l) return
      const k =
        d.qid === 'tvSeries' || d.qid === 'tvMiniSeries' || d.q === 'TV series' ? ('s' as const) : ('m' as const)
      push({ t: d.l, y: d.y ? String(d.y) : '', k, p: d.i?.imageUrl || '', i: d.id || '' })
    })
  } catch {
    /* IMDb feed unreachable — TVMaze below still works for series */
  }
  }

  if (out.length < 5) {
    try {
      const r = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`)
      const j = await r.json()
      j.slice(0, 5).forEach((x: { show: { name: string; premiered?: string; image?: { medium?: string } } }) => {
        const s = x.show
        push({ t: s.name, y: (s.premiered || '').slice(0, 4), k: 's', p: s.image?.medium || '', i: '' })
      })
    } catch {
      /* ignore */
    }
  }
  return out.slice(0, 8)
}

const posterCache = new Map<string, string>()

export async function fetchPoster(title: string): Promise<string> {
  if (posterCache.has(title)) return posterCache.get(title) || ''
  const r = await searchTitles(title)
  const hit = r.find((x) => norm(x.t) === norm(title)) || r[0]
  const p = hit ? hit.p : ''
  posterCache.set(title, p)
  return p
}

export function toItem(s: Suggestion): Item {
  return { t: s.t, y: s.y || '', k: s.k || 'm', p: s.p || '', i: s.i || '' }
}
