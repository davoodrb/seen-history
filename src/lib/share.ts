import type { Item, Playlist } from './types'

/**
 * The share code IS the whole list: list JSON, gzipped with the browser's
 * built-in CompressionStream, base64url-encoded. A code / QR alone therefore
 * shows the list — nothing is stored on a server.
 * Format: "SH2-" + base64url(gzip(json))  (SH1- = plain base64url fallback)
 */
function b64url(buf: ArrayBuffer): string {
  let s = ''
  const b = new Uint8Array(buf)
  for (let i = 0; i < b.length; i += 8192) {
    s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 8192)))
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function unb64(str: string): ArrayBuffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const bin = atob(str)
  const b = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i)
  return b.buffer
}

export async function encodeList(list: Playlist): Promise<string> {
  const json = JSON.stringify({ v: 2, n: list.name, items: list.items })
  try {
    const cs = new CompressionStream('gzip')
    const w = cs.writable.getWriter()
    void w.write(new TextEncoder().encode(json))
    void w.close()
    return 'SH2-' + b64url(await new Response(cs.readable).arrayBuffer())
  } catch {
    return 'SH1-' + b64url(new TextEncoder().encode(json).buffer)
  }
}

export async function decodeCode(
  str: string,
): Promise<{ n: string; items: Item[] }> {
  let s = String(str || '').trim()
  const m = s.match(/[?&]c=([^&#\s]+)/)
  if (m) s = decodeURIComponent(m[1])
  s = s.replace(/^SH[12]-/, '')
  const buf = unb64(s)
  try {
    const ds = new DecompressionStream('gzip')
    const w = ds.writable.getWriter()
    void w.write(buf)
    void w.close()
    return JSON.parse(new TextDecoder().decode(await new Response(ds.readable).arrayBuffer()))
  } catch {
    return JSON.parse(new TextDecoder().decode(buf))
  }
}

/** Old ?p= links from the very first version still open. */
export function decodeOld(str: string): { n: string; items: Item[] } | null {
  const m = String(str).match(/[?&]p=([^&#\s]+)/)
  if (!m) return null
  try {
    const raw = m[1].replace(/-/g, '+').replace(/_/g, '/')
    const o = JSON.parse(decodeURIComponent(escape(atob(raw))))
    return {
      n: o.name,
      items: (o.items || []).map((i: { title: string; year?: string; type?: string }) => ({
        t: i.title,
        y: i.year || '',
        k: i.type === 'series' ? ('s' as const) : ('m' as const),
        p: '',
        i: '',
      })),
    }
  } catch {
    return null
  }
}

export function listFromDecoded(o: { n?: string; items?: Item[] }): Playlist {
  return {
    name: o.n || 'Shared list',
    items: (o.items || []).map((i) => ({
      t: i.t,
      y: i.y || '',
      k: i.k || 'm',
      p: i.p || '',
      i: i.i || '',
    })),
  }
}
