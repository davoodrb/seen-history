export interface Item {
  /** title */
  t: string
  /** year, e.g. "2010" */
  y: string
  /** 'm' = movie, 's' = series */
  k: 'm' | 's'
  /** poster image URL */
  p: string
  /** IMDb id, e.g. "tt1375666" */
  i: string
}

export interface Playlist {
  name: string
  items: Item[]
}

const LS = 'seen-history.v2'
const OLD = 'seen-history.playlists.v1'

export function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ')
    .trim()
}

export function loadLists(): Playlist[] {
  try {
    const v = JSON.parse(localStorage.getItem(LS) || 'null')
    if (Array.isArray(v) && v.length) return v as Playlist[]
  } catch {
    /* fall through */
  }
  // migrate the old single-file app's lists, if any
  try {
    const o = JSON.parse(localStorage.getItem(OLD) || 'null')
    if (Array.isArray(o) && o.length) {
      return o.map((p: { name?: string; items?: Array<{ title: string; year?: string; type?: string }> }) => ({
        name: p.name || 'My list',
        items: (p.items || []).map((i) => ({
          t: i.title,
          y: i.year || '',
          k: i.type === 'series' ? ('s' as const) : ('m' as const),
          p: '',
          i: '',
        })),
      }))
    }
  } catch {
    /* fall through */
  }
  return [{ name: 'My list', items: [] }]
}

export function saveLists(lists: Playlist[]) {
  localStorage.setItem(LS, JSON.stringify(lists))
}
