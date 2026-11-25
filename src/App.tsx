import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Clapperboard, Copy, Download, EllipsisVertical, Info, Link2, Loader2, Moon, Plus, Save, Search, Settings, Share2, Sun, Trash2, Upload, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { loadLists, norm, saveLists, type Item, type Playlist } from '@/lib/types'
import { decodeCode, decodeOld, encodeList, listFromDecoded } from '@/lib/share'
import { fetchPoster, searchTitles, toItem, type Suggestion } from '@/lib/search'
import { DRIVE_CLIENT_ID, downloadBackup, findBackupFile, requestDriveToken, revokeToken, uploadBackup } from '@/lib/drive'

function Poster({ item, onRemove }: { item: Item; onRemove?: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <Card className="overflow-hidden py-0">
      <div className="relative">
        {item.p ? (
          <img src={item.p} alt={item.t} loading="lazy" className="aspect-[2/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[2/3] w-full items-center justify-center bg-muted text-4xl">🎬</div>
        )}
        {onRemove && !confirming && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full"
            onClick={() => setConfirming(true)}
            aria-label={`Remove ${item.t}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        {onRemove && confirming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-2 text-center">
            <p className="text-xs font-semibold text-white">Remove “{item.t}”?</p>
            <div className="flex gap-2">
              <Button variant="destructive" size="icon" onClick={onRemove} aria-label={`Remove ${item.t}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="icon" onClick={() => setConfirming(false)} aria-label={`Keep ${item.t}`}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      <CardContent className="px-3 py-2">
        <p className="text-sm leading-snug font-semibold">{item.t}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {item.y ? `${item.y} · ` : ''}
          {item.k === 's' ? 'Series' : 'Movie'}
        </p>
      </CardContent>
    </Card>
  )
}

// The browser's install prompt event (not in the default DOM types).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type View = 'main' | 'settings' | 'privacy' | 'terms' | 'not-found'

// Small text pages (Privacy Policy, Terms of Service), linked from the footer
// and reachable directly at #privacy / #terms.
function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Last updated: November 25, 2026</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h2 className="text-base font-semibold">{heading}</h2>
      <div className="text-muted-foreground mt-1 space-y-2 text-sm">{children}</div>
    </section>
  )
}

function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <LegalSection heading="No account, no tracking">
        <p>
          Seen History is made by Davood Rabiei. There is no account and no sign-up, and the app collects no
          analytics, runs no tracking and shows no ads.
        </p>
      </LegalSection>
      <LegalSection heading="What stays on your device">
        <p>
          Your lists — titles, years and posters — are stored in your browser&apos;s local storage, on your device
          only. The app does not upload them anywhere unless you choose to share a list or back it up.
        </p>
      </LegalSection>
      <LegalSection heading="Search">
        <p>
          When you search for a title, your query is sent to TMDB to fetch matching titles and posters. If that is
          unreachable, the app falls back to IMDb&apos;s public suggestion feed and TVMaze. Your query goes to those
          services so they can return results; no account or personal information is attached to it.
        </p>
      </LegalSection>
      <LegalSection heading="Sharing">
        <p>
          A share code contains your whole list. Anyone who has the code can see the list, so only share
          it with people you want to see it.
        </p>
      </LegalSection>
      <LegalSection heading="Google Drive backup (optional)">
        <p>
          If you connect Google Drive in Settings, the app saves a backup of your lists to a hidden folder in your
          Drive that only this app can see, and updates it when your lists change. Your Google sign-in token is kept
          in memory only and is never stored. You can disconnect at any time in Settings.
        </p>
      </LegalSection>
      <LegalSection heading="Contact">
        <p>
          Questions about this policy:{' '}
          <a className="underline" href="mailto:davoodrb1@gmail.com">
            davoodrb1@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}

function TermsOfService() {
  return (
    <LegalPage title="Terms of Service">
      <LegalSection heading="The app">
        <p>Seen History is a free app, provided as-is, with no warranty.</p>
      </LegalSection>
      <LegalSection heading="Your lists">
        <p>
          No account is needed. You are responsible for the lists you keep and share — a share code shows your whole
          list to anyone who has it, so share carefully.
        </p>
      </LegalSection>
      <LegalSection heading="Fair use">
        <p>Use the app lawfully, and don&apos;t use it to harm others.</p>
      </LegalSection>
      <LegalSection heading="Data sources">
        <p>
          Titles, posters and other data come from TMDB, IMDb and TVMaze, and belong to their owners. This product
          uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </LegalSection>
      <LegalSection heading="Changes">
        <p>
          These terms may change from time to time. If you keep using the app after a change, you accept the new
          terms.
        </p>
      </LegalSection>
      <LegalSection heading="Contact">
        <p>
          Questions:{' '}
          <a className="underline" href="mailto:davoodrb1@gmail.com">
            davoodrb1@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}

// Shown for any unknown hash, e.g. #something-that-doesnt-exist.
function NotFound() {
  return (
    <Card className="mt-4">
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-5xl font-extrabold">404</p>
        <p className="text-muted-foreground">This page doesn&apos;t exist.</p>
        <Button
          className="mt-2"
          onClick={() => {
            window.location.hash = ''
          }}
        >
          Back to lists
        </Button>
      </CardContent>
    </Card>
  )
}

// The Google Drive logo (green/yellow/blue triangle), drawn as inline SVG
// so the Drive section and its button can show the real mark.
function DriveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 87.3 78" className={className} aria-hidden="true">
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  )
}

export default function App() {
  const [lists, setLists] = useState<Playlist[]>(() => loadLists())
  const [active, setActive] = useState(0)
  const [query, setQuery] = useState('')
  const [sugg, setSugg] = useState<Suggestion[]>([])
  const [selIdx, setSelIdx] = useState(-1)
  const [suggOpen, setSuggOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [view, setView] = useState<View>(() => {
    const h = window.location.hash
    return h === '#privacy' ? 'privacy' : h === '#terms' ? 'terms' : h === '' ? 'main' : 'not-found'
  })
  // Privacy and Terms are real pages: #privacy and #terms open them, so they
  // have links that can be shared (and used for Google verification). The
  // browser back button works through the hash. Any other hash is a 404 page.
  useEffect(() => {
    const applyHash = () => {
      const h = window.location.hash
      setView(h === '#privacy' ? 'privacy' : h === '#terms' ? 'terms' : h === '' ? 'main' : 'not-found')
    }
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [listMenuOpen, setListMenuOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(20)
  const [compareShown, setCompareShown] = useState({ common: 20, mine: 20, them: 20 })

  // Escape closes the list options menu
  useEffect(() => {
    if (!listMenuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setListMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [listMenuOpen])
  // Theme: dark by default, remembered in localStorage. The class is applied
  // here (before first paint) so a saved light theme never flashes dark.
  const [dark, setDark] = useState(() => {
    let d = true
    try {
      d = localStorage.getItem('seen-history.theme') !== 'light'
    } catch {
      d = true
    }
    document.documentElement.classList.toggle('dark', d)
    return d
  })
  // Draft for the list name: typing never writes back live, so the field can
  // be erased and rewritten from empty. Save commits it, Dismiss reverts it.
  // It starts as the real list name, so the title never flashes "My list" on load.
  const [nameDraft, setNameDraft] = useState(() => lists[0]?.name ?? 'My list')
  const restoreInputRef = useRef<HTMLInputElement>(null)
  const [shareCode, setShareCode] = useState('')
  const [incoming, setIncoming] = useState<Playlist | null>(null)
  const [friendCode, setFriendCode] = useState('')
  const [compare, setCompare] = useState<{ other: Playlist; common: Item[]; onlyMine: Item[]; onlyThem: Item[] } | null>(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)

  // Install drawer: shown shortly after opening, until the user installs the
  // app or taps "Don't show again" (remembered in localStorage). Never shown
  // when the app is already installed.
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstall, setShowInstall] = useState(false)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => {
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (installed) return
    try {
      if (localStorage.getItem('seen-history.install-dismissed') === '1') return
    } catch {
      // Without storage the drawer just shows again next time
    }
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
      setShowInstall(true)
    }
    const onInstalled = () => {
      try {
        localStorage.setItem('seen-history.install-dismissed', '1')
      } catch {
        // ignore
      }
      setShowInstall(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    // If the install prompt never arrives (e.g. iOS Safari has no such
    // event), still show the drawer shortly after opening, with manual steps.
    const t = window.setTimeout(() => setShowInstall(true), 1200)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      window.clearTimeout(t)
    }
  }, [])

  const installApp = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') {
      try {
        localStorage.setItem('seen-history.install-dismissed', '1')
      } catch {
        // ignore
      }
    }
    setInstallEvent(null)
    setShowInstall(false)
  }

  const dismissInstallForever = () => {
    try {
      localStorage.setItem('seen-history.install-dismissed', '1')
    } catch {
      // ignore
    }
    setShowInstall(false)
  }

  const list = lists[active] ?? lists[0]

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('seen-history.theme', dark ? 'dark' : 'light')
    } catch {
      // Remembering the theme is a nice-to-have
    }
  }, [dark])

  useEffect(() => {
    saveLists(lists)
  }, [lists])

  // The share code is generated automatically and updates whenever the list changes
  useEffect(() => {
    let cancelled = false
    void encodeList(list).then((code) => {
      if (!cancelled) setShareCode(code)
    })
    return () => {
      cancelled = true
    }
  }, [list])

  // Keep the name draft in sync when switching lists (or after a save)
  useEffect(() => {
    setNameDraft(list.name)
  }, [active, list.name])

  // Show the first 20 posters; "Show more" loads 20 at a time. Reset when switching lists.
  useEffect(() => {
    setVisibleCount(20)
  }, [active])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2400)
  }, [])

  // Open a shared list from ?c= (or an old ?p= link)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const raw = q.get('c')
    if (raw) {
      decodeCode(raw)
        .then((o) => setIncoming(listFromDecoded(o)))
        .catch(() => undefined)
    } else if (q.get('p')) {
      const o = decodeOld(window.location.search)
      if (o) setIncoming(listFromDecoded(o))
    }
  }, [])

  // Autocomplete, debounced — shows a loading state while searching
  useEffect(() => {
    if (query.trim().length < 2) {
      setSugg([])
      setSuggOpen(false)
      setSearching(false)
      return
    }
    setSearching(true)
    setSuggOpen(true)
    const t = window.setTimeout(async () => {
      const r = await searchTitles(query)
      setSugg(r)
      setSelIdx(-1)
      setSearching(false)
    }, 250)
    return () => window.clearTimeout(t)
  }, [query])

  const updateList = (fn: (l: Playlist) => Playlist) => {
    setLists((ls) => ls.map((l, i) => (i === active ? fn(l) : l)))
  }

  // Commit the name draft (empty falls back to 'My list' only here, at save time)
  const saveName = () => {
    const next = nameDraft.trim() || 'My list'
    if (next === list.name) return
    updateList((l) => ({ ...l, name: next }))
    showToast(`Renamed to “${next}”`)
  }
  // Both buttons stay disabled until the name actually changes
  const nameUnchanged = (nameDraft.trim() || 'My list') === list.name

  // Delete the whole current list (deleting the last one leaves a fresh empty list)
  // Called only from the confirmation modal, once the list title was typed in.
  const deleteList = () => {
    const name = list.name
    setLists((ls) => {
      const rest = ls.filter((_, i) => i !== active)
      return rest.length ? rest : [{ name: 'My list', items: [] }]
    })
    setActive(0)
    setCompare(null)
    setDeleteModalOpen(false)
    setDeleteConfirm('')
    showToast(`Deleted “${name}”`)
  }

  // Backup: download all lists as one JSON file
  const backupLists = () => {
    const blob = new Blob(
      [JSON.stringify({ app: 'seen-history', version: 2, exportedAt: new Date().toISOString(), lists }, null, 2)],
      { type: 'application/json' },
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `seen-history-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    showToast('Backup downloaded')
  }

  // Restore: replace the current lists with the lists in a backup JSON string
  const applyBackupJson = (text: string) => {
    try {
      const parsed = JSON.parse(text) as unknown
      type BackupItem = { t?: unknown; y?: unknown; k?: unknown; p?: unknown; i?: unknown }
      type BackupList = { name?: unknown; items?: unknown }
      const arr = (Array.isArray(parsed) ? parsed : (parsed as { lists?: unknown }).lists) as BackupList[]
      if (
        !Array.isArray(arr) ||
        !arr.length ||
        !arr.every((l: BackupList) => l && typeof l.name === 'string' && Array.isArray(l.items))
      ) {
        throw new Error('bad backup')
      }
      const cleaned: Playlist[] = arr.map((l: BackupList) => ({
        name: typeof l.name === 'string' && l.name ? l.name : 'My list',
        items: (l.items as BackupItem[])
          .filter((i: BackupItem) => i && typeof i.t === 'string')
          .map((i: BackupItem) => ({
            t: i.t as string,
            y: typeof i.y === 'string' ? i.y : '',
            k: i.k === 's' ? ('s' as const) : ('m' as const),
            p: typeof i.p === 'string' ? i.p : '',
            i: typeof i.i === 'string' ? i.i : '',
          })),
      }))
      setLists(cleaned)
      setActive(0)
      setCompare(null)
      showToast(`Backup restored — ${cleaned.length} list${cleaned.length === 1 ? '' : 's'}`)
    } catch {
      showToast("That file isn't a Seen History backup")
    }
  }

  // Restore: read a backup file and replace the current lists with it
  const restoreBackup = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => applyBackupJson(String(reader.result))
    reader.readAsText(file)
  }

  // Google Drive backup: the access token lives in memory only. When
  // connected, lists are backed up to a hidden app folder in Drive a couple
  // of seconds after every change.
  const [driveState, setDriveState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [driveError, setDriveError] = useState('')
  const [driveLastBackup, setDriveLastBackup] = useState<string | null>(() => {
    try {
      return localStorage.getItem('seen-history.drive-last-backup')
    } catch {
      return null
    }
  })
  const driveTokenRef = useRef<string | null>(null)
  const driveFileIdRef = useRef<string | null>(null)

  const backupToDrive = useCallback(
    async (silent = true) => {
      const token = driveTokenRef.current
      if (!token || driveState !== 'connected') return
      try {
        const json = JSON.stringify(
          { app: 'seen-history', version: 2, exportedAt: new Date().toISOString(), lists },
          null,
          2,
        )
        const id = await uploadBackup(token, driveFileIdRef.current, json)
        driveFileIdRef.current = id
        const now = new Date().toISOString()
        setDriveLastBackup(now)
        try {
          localStorage.setItem('seen-history.drive-last-backup', now)
        } catch {
          // ignore
        }
        if (!silent) showToast('Backed up to Google Drive')
      } catch {
        driveTokenRef.current = null
        setDriveState('idle')
        setDriveError('Google Drive session expired — reconnect to resume auto-backup.')
        if (!silent) showToast('Google Drive backup failed')
      }
    },
    [lists, driveState, showToast],
  )

  // Back up to Drive a couple of seconds after every change, while connected.
  useEffect(() => {
    if (driveState !== 'connected') return
    const t = window.setTimeout(() => {
      void backupToDrive(true)
    }, 2000)
    return () => window.clearTimeout(t)
  }, [lists, driveState, backupToDrive])

  // Try to silently resume a previous Drive session on open, so auto-backup
  // keeps working across visits without signing in again.
  useEffect(() => {
    if (!DRIVE_CLIENT_ID) return
    let wasConnected = false
    try {
      wasConnected = localStorage.getItem('seen-history.drive-connected') === '1'
    } catch {
      wasConnected = false
    }
    if (!wasConnected) return
    void (async () => {
      try {
        const token = await requestDriveToken(DRIVE_CLIENT_ID, true)
        driveTokenRef.current = token
        const found = await findBackupFile(token)
        if (found) driveFileIdRef.current = found.id
        setDriveState('connected')
      } catch {
        // Stay disconnected; the user can reconnect from Settings.
      }
    })()
  }, [])

  const connectDrive = async () => {
    if (!DRIVE_CLIENT_ID) return
    setDriveState('connecting')
    setDriveError('')
    try {
      const token = await requestDriveToken(DRIVE_CLIENT_ID)
      driveTokenRef.current = token
      const found = await findBackupFile(token)
      if (found) driveFileIdRef.current = found.id
      try {
        localStorage.setItem('seen-history.drive-connected', '1')
      } catch {
        // ignore
      }
      setDriveState('connected')
      showToast('Google Drive connected')
    } catch (e) {
      setDriveState('error')
      setDriveError(e instanceof Error ? e.message : 'Could not connect to Google Drive')
    }
  }

  const disconnectDrive = () => {
    const token = driveTokenRef.current
    driveTokenRef.current = null
    setDriveState('idle')
    setDriveError('')
    try {
      localStorage.removeItem('seen-history.drive-connected')
    } catch {
      // ignore
    }
    if (token) void revokeToken(token)
    showToast('Google Drive disconnected')
  }

  const restoreFromDrive = async () => {
    const token = driveTokenRef.current
    if (!token) return
    try {
      const id = driveFileIdRef.current ?? (await findBackupFile(token))?.id
      if (!id) {
        showToast('No backup found in Google Drive yet')
        return
      }
      driveFileIdRef.current = id
      applyBackupJson(await downloadBackup(token, id))
    } catch {
      showToast("Couldn't read the Drive backup")
    }
  }

  const addItem = useCallback(
    (s: Suggestion) => {
      const item: Item = toItem(s)
      if (list.items.some((x) => norm(x.t) === norm(item.t) && String(x.y) === String(item.y || ''))) {
        showToast('Already in your list')
        return
      }
      updateList((l) => ({ ...l, items: [item, ...l.items] }))
      showToast(`Added “${item.t}”`)
      if (!item.p) {
        void fetchPoster(item.t).then((p) => {
          if (!p) return
          setLists((ls) =>
            ls.map((l, i) =>
              i === active
                ? { ...l, items: l.items.map((x) => (norm(x.t) === norm(item.t) ? { ...x, p } : x)) }
                : l,
            ),
          )
        })
      }
    },
    [active, list.items, showToast],
  )

  const pickSugg = (i: number) => {
    const s = sugg[i]
    if (!s) return
    addItem(s)
    setQuery('')
    setSuggOpen(false)
  }

  const addManual = (title: string) => {
    if (!title.trim()) return
    addItem({ t: title.trim(), y: '', k: 'm', p: '', i: '' })
    setQuery('')
  }

  const shareList = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Seen History — ${list.name}`,
          text: `${list.name} (${list.items.length} watched)`,
          url: shareUrl,
        })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    await copyText(shareUrl, 'Link copied — sharing is not supported here')
  }

  const shareUrl = shareCode
    ? `${window.location.origin}${window.location.pathname}?c=${encodeURIComponent(shareCode)}`
    : ''

  const copyText = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('input')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      el.remove()
    }
    showToast(msg)
  }

  const doCompare = (other: Playlist) => {
    const byTitle = new Map<string, Item>()
    ;[...list.items, ...other.items].forEach((x) => byTitle.set(norm(x.t), x))
    const setOf = (items: Item[]) => new Set(items.map((x) => norm(x.t)).filter(Boolean))
    const A = setOf(list.items)
    const B = setOf(other.items)
    const pick = (keys: string[]) => keys.map((k) => byTitle.get(k)!).filter(Boolean)
    setCompare({
      other,
      common: pick([...A].filter((x) => B.has(x))),
      onlyMine: pick([...A].filter((x) => !B.has(x))),
      onlyThem: pick([...B].filter((x) => !A.has(x))),
    })
    setCompareShown({ common: 20, mine: 20, them: 20 })
    document.getElementById('compare')?.scrollIntoView({ behavior: 'smooth' })
  }

  const compareFriend = async () => {
    const v = friendCode.trim()
    if (!v) {
      showToast('Paste a code or link first')
      return
    }
    try {
      const o = await decodeCode(v)
      doCompare(listFromDecoded(o))
    } catch {
      const o = decodeOld(v)
      if (o) doCompare(listFromDecoded(o))
      else showToast('Could not read that code — check it and try again')
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            <Clapperboard className="h-7 w-7" /> Seen History
          </h1>
          <p className="text-muted-foreground mt-1">
            Your history of what you&apos;ve watched. Search it, add it, share the whole list as one code.
          </p>
        </div>
        {view !== 'main' ? (
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setView('main')
              window.location.hash = ''
            }}
            aria-label="Back to lists"
            title="Back to lists"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="icon" onClick={() => setView('settings')} aria-label="Settings" title="Settings">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </header>

      {view === 'settings' ? (
        <>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Your preferences for this app, on this device.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Choose how the app looks.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Theme</p>
                <Button variant="outline" onClick={() => setDark((d) => !d)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
                  {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {dark ? 'Dark' : 'Light'}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Backup</CardTitle>
              <CardDescription>Keep a copy of your lists somewhere safe.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium">On this device</p>
                <p className="text-muted-foreground mt-0.5">
                  Download all lists as one .json file, or restore from one.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={backupLists}>
                    <Download className="h-4 w-4" /> Download backup
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => restoreInputRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Restore from file
                  </Button>
                  <input
                    ref={restoreInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) restoreBackup(f)
                      e.target.value = ''
                    }}
                  />
                </div>
              </div>
              <Separator />
              <div>
                <p className="flex items-center gap-2 font-medium">
                  <DriveIcon className="h-5 w-5 shrink-0" /> Google Drive
                </p>
                {DRIVE_CLIENT_ID === '' ? (
                  <p className="text-muted-foreground mt-0.5">Google Drive backup isn&apos;t set up yet.</p>
                ) : driveState === 'connected' ? (
                  <>
                    <p className="text-muted-foreground mt-0.5">
                      Connected — backs up automatically whenever a list changes.
                      {driveLastBackup ? ` Last backup: ${new Date(driveLastBackup).toLocaleString()}.` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => void backupToDrive(false)}>
                        Back up now
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void restoreFromDrive()}>
                        Restore from Drive
                      </Button>
                      <Button variant="ghost" size="sm" onClick={disconnectDrive}>
                        Disconnect
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground mt-0.5">
                      Backs up to a hidden folder in your Drive, automatically whenever a list changes.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={driveState === 'connecting'}
                        onClick={() => void connectDrive()}
                        className="border-[#dadce0] bg-white text-[#1f1f1f] hover:bg-[#f8f9fa] hover:text-[#1f1f1f] dark:border-[#dadce0] dark:bg-white dark:text-[#1f1f1f] dark:hover:bg-[#f8f9fa] dark:hover:text-[#1f1f1f]"
                      >
                        <DriveIcon className="h-5 w-5 shrink-0" />
                        {driveState === 'connecting' ? 'Connecting…' : 'Connect Google Drive'}
                      </Button>
                    </div>
                    {driveError && <p className="mt-2 text-sm text-red-500">{driveError}</p>}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2 text-sm">
              <p>Seen History — your history of what you&apos;ve watched. No account. Your lists live in this browser only.</p>
              <p>
                Titles &amp; posters from{' '}
                <a className="underline" href="https://www.themoviedb.org">
                  TMDB
                </a>
                . This product uses the TMDB API but is not endorsed or certified by TMDB.
              </p>
              <p>
                Source:{' '}
                <a className="underline" href="https://github.com/davoodrb/seen-history">
                  github.com/davoodrb/seen-history
                </a>
              </p>
            </CardContent>
          </Card>
        </>
      ) : view === 'privacy' ? (
        <PrivacyPolicy />
      ) : view === 'terms' ? (
        <TermsOfService />
      ) : view === 'not-found' ? (
        <NotFound />
      ) : (
        <>
      {incoming && (
        <Card className="mt-4 border-teal-500/50">
          <CardHeader>
            <CardTitle>📩 Someone shared a list with you</CardTitle>
            <CardDescription>
              <strong>{incoming.name}</strong> — {incoming.items.length} titles. The code already contains the whole list.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setLists((ls) => [...ls, incoming])
                setActive(lists.length)
                setIncoming(null)
                showToast(`Saved “${incoming.name}”`)
              }}
            >
              Save it
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                doCompare(incoming)
                setIncoming(null)
              }}
            >
              Compare with mine
            </Button>
            <Button variant="ghost" onClick={() => setIncoming(null)}>
              Dismiss
            </Button>
            <Button variant="link" size="sm" asChild>
              <a href={window.location.pathname} title="Open the main page without this shared list">
                Don&apos;t show again
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {lists.map((l, i) => (
          <Button
            key={`${l.name}-${i}`}
            variant={i === active ? 'default' : 'outline'}
            size="sm"
            className="rounded-full"
            onClick={() => {
              setActive(i)
              setCompare(null)
            }}
          >
            {l.name} ({l.items.length})
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => {
            setLists((ls) => [...ls, { name: `List ${ls.length + 1}`, items: [] }])
            setActive(lists.length)
          }}
        >
          <Plus className="h-4 w-4" /> New list
        </Button>
      </div>

      <Card className="mt-4">
        <CardContent className="space-y-4 pt-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName()
                    else if (e.key === 'Escape') setNameDraft(list.name)
                  }}
                  aria-label="List name"
                  className="w-full border bg-muted pr-11 pl-3 text-xl font-extrabold shadow-none focus-visible:ring-0 dark:bg-input/30"
                />
                {nameDraft !== list.name && (
                  <button
                    type="button"
                    onClick={() => setNameDraft(list.name)}
                    aria-label="Discard name changes"
                    title="Discard changes"
                    className="text-muted-foreground hover:text-foreground hover:bg-accent absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              <div className="relative">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setListMenuOpen((o) => !o)}
                  aria-label="List options"
                  aria-haspopup="menu"
                  aria-expanded={listMenuOpen}
                  title="List options"
                >
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
                {listMenuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close menu"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setListMenuOpen(false)}
                    />
                    <div role="menu" className="bg-popover absolute right-0 z-50 mt-1 w-48 rounded-md border p-1 shadow-md">
                      <button
                        type="button"
                        role="menuitem"
                        className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                        onClick={() => {
                          setListMenuOpen(false)
                          copyText(list.name, 'List name copied')
                        }}
                      >
                        <Copy className="h-4 w-4" /> Copy list name
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="text-destructive hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                        onClick={() => {
                          setListMenuOpen(false)
                          setDeleteConfirm('')
                          setDeleteModalOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" /> Delete playlist
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <Button className="mt-2 w-full" disabled={nameUnchanged} onClick={saveName}>
              <Save className="h-4 w-4" /> Save name
            </Button>
            <p className="text-muted-foreground mt-1 px-1 text-sm">{list.items.length} watched</p>
          </div>

          <div className="relative">
            <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
            {searching && <Loader2 className="text-muted-foreground absolute top-3 right-3 h-4 w-4 animate-spin" />}
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setSelIdx(Math.min(sugg.length - 1, selIdx + 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setSelIdx(Math.max(0, selIdx - 1))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  if (selIdx >= 0 && sugg[selIdx]) pickSugg(selIdx)
                  else addManual(query)
                } else if (e.key === 'Escape') {
                  setSuggOpen(false)
                }
              }}
              onBlur={() => window.setTimeout(() => setSuggOpen(false), 150)}
              onFocus={() => sugg.length && setSuggOpen(true)}
              placeholder="Search a movie or series…  e.g. Inception"
              aria-label="Search a movie or series"
              className="pl-9 text-base"
              autoComplete="off"
            />
            {suggOpen && (
              <div className="bg-popover absolute top-full right-0 left-0 z-20 mt-2 overflow-hidden rounded-xl border shadow-lg">
                {searching ? (
                  <p className="text-muted-foreground flex items-center gap-2 px-3 py-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                  </p>
                ) : sugg.length === 0 ? (
                  <div className="px-3 py-3">
                    <p className="text-sm">No results found — you can save what you typed.</p>
                    <Button
                      size="sm"
                      className="mt-2"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        addManual(query)
                      }}
                    >
                      <Plus className="h-4 w-4" /> Add “{query.trim()}”
                    </Button>
                  </div>
                ) : (
                  sugg.map((s, i) => (
                    <button
                      key={`${s.i || s.t}-${i}`}
                      type="button"
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent ${i === selIdx ? 'bg-accent' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        pickSugg(i)
                      }}
                    >
                      {s.p ? (
                        <img src={s.p} alt="" className="h-14 w-9 rounded object-cover" />
                      ) : (
                        <span className="flex h-14 w-9 items-center justify-center rounded bg-muted text-xl">🎬</span>
                      )}
                      <span>
                        <span className="block text-sm font-semibold">{s.t}</span>
                        <span className="text-muted-foreground text-xs">
                          {s.y ? `${s.y} · ` : ''}
                          {s.k === 's' ? 'Series' : 'Movie'}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Pick a result to add it with its poster. No result? Press Enter to add what you typed.
          </p>

          {list.items.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
              <Clapperboard className="h-10 w-10" />
              <p>Nothing here yet — search above and add the first thing you&apos;ve watched.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {list.items.slice(0, visibleCount).map((it, i) => (
                  <Poster
                    key={`${it.t}-${i}`}
                    item={it}
                    onRemove={() => updateList((l) => ({ ...l, items: l.items.filter((_, j) => j !== i) }))}
                  />
                ))}
              </div>
              {list.items.length > visibleCount && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={() => setVisibleCount((c) => c + 20)}>
                    Show more
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {list.items.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" /> Share this list
            </CardTitle>
            <CardDescription>
              One code holds your <strong>entire list</strong> — every title in it. It&apos;s generated automatically and updates
              as your list changes. Anyone with the code can see the list, no account, nothing stored on a server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {shareCode ? (
              <>
                <p className="text-muted-foreground text-xs">
                  {shareCode.length} characters — the whole list is inside it.
                </p>
                <Textarea
                  readOnly
                  value={shareCode}
                  onClick={(e) => e.currentTarget.select()}
                  className="max-h-28 overflow-y-auto font-mono text-xs break-all"
                  rows={2}
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={shareList}>
                    <Share2 className="h-4 w-4" /> Share
                  </Button>
                  <Button variant="outline" onClick={() => copyText(shareUrl, 'Link copied')}>
                    <Link2 className="h-4 w-4" /> Copy link
                  </Button>
                  <Button variant="outline" onClick={() => copyText(shareCode, 'Code copied')}>
                    <Copy className="h-4 w-4" /> Copy code
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Generating your code…</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-4" id="compare">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Compare with a friend
          </CardTitle>
          <CardDescription>Paste their code or link. You&apos;ll see what you&apos;ve both seen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value)}
              placeholder="Paste a friend's code or link here"
              aria-label="Friend's code or link"
            />
            <Button onClick={compareFriend}>Compare</Button>
          </div>
          {compare && (
            <div className="space-y-5">
              <Separator />
              <div>
                <h3 className="text-base font-bold">
                  You both watched {compare.common.length} <Badge variant="secondary">{compare.other.name} · {compare.other.items.length} total</Badge>
                </h3>
                <p className="text-muted-foreground text-sm">
                  {compare.common.length ? 'These are in common — good picks to talk about or rewatch.' : 'No overlap yet. The lists below are ideas for each other.'}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {compare.common.slice(0, compareShown.common).map((it, i) => (
                    <Poster key={`c-${it.t}-${i}`} item={it} />
                  ))}
                  {compare.common.length === 0 && <p className="text-muted-foreground text-sm">—</p>}
                </div>
                {compare.common.length > compareShown.common && (
                  <div className="mt-2 flex justify-center">
                    <Button variant="outline" onClick={() => setCompareShown((s) => ({ ...s, common: s.common + 20 }))}>
                      Show more
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-base font-bold">Only you ({compare.onlyMine.length})</h3>
                <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {compare.onlyMine.slice(0, compareShown.mine).map((it, i) => (
                    <Poster key={`m-${it.t}-${i}`} item={it} />
                  ))}
                  {compare.onlyMine.length === 0 && <p className="text-muted-foreground text-sm">—</p>}
                </div>
                {compare.onlyMine.length > compareShown.mine && (
                  <div className="mt-2 flex justify-center">
                    <Button variant="outline" onClick={() => setCompareShown((s) => ({ ...s, mine: s.mine + 20 }))}>
                      Show more
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-base font-bold">Only them ({compare.onlyThem.length})</h3>
                <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {compare.onlyThem.slice(0, compareShown.them).map((it, i) => (
                    <Poster key={`t-${it.t}-${i}`} item={it} />
                  ))}
                  {compare.onlyThem.length === 0 && <p className="text-muted-foreground text-sm">—</p>}
                </div>
                {compare.onlyThem.length > compareShown.them && (
                  <div className="mt-2 flex justify-center">
                    <Button variant="outline" onClick={() => setCompareShown((s) => ({ ...s, them: s.them + 20 }))}>
                      Show more
                    </Button>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setLists((ls) => [...ls, compare.other])
                  setActive(lists.length)
                  showToast(`Saved “${compare.other.name}”`)
                }}
              >
                Save their list as a new list
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <footer className="text-muted-foreground mt-6 text-xs">
        <p className="flex items-start gap-1.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No account. Your lists live in this browser only. Titles &amp; posters come from TMDB, with IMDb&apos;s public suggestion
          feed and TVMaze as a backup when TMDB is unreachable.
        </p>
        <p className="mt-2">
          Source:{' '}
          <a className="underline" href="https://github.com/davoodrb/seen-history">
            github.com/davoodrb/seen-history
          </a>
        </p>
        <p className="mt-2">
          <a className="underline" href="#privacy">
            Privacy Policy
          </a>
          {' · '}
          <a className="underline" href="#terms">
            Terms of Service
          </a>
        </p>
      </footer>
        </>
      )}

      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          onClick={() => {
            setDeleteModalOpen(false)
            setDeleteConfirm('')
          }}
        >
          <Card
            className="w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="delete-title">
                Delete “
                <button
                  type="button"
                  onClick={() => copyText(list.name, 'List name copied')}
                  className="cursor-pointer underline decoration-dotted underline-offset-4"
                  title="Click to copy the list name"
                >
                  {list.name}
                </button>
                ”?
              </CardTitle>
              <CardDescription>This can&apos;t be undone. Type the list name to confirm.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirm.trim() === list.name) deleteList()
                  else if (e.key === 'Escape') {
                    setDeleteModalOpen(false)
                    setDeleteConfirm('')
                  }
                }}
                placeholder={`Type "${list.name}" to confirm`}
                aria-label="Type the list name to confirm"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDeleteModalOpen(false)
                    setDeleteConfirm('')
                  }}
                >
                  Cancel
                </Button>
                <Button variant="destructive" disabled={deleteConfirm.trim() !== list.name} onClick={deleteList}>
                  <Trash2 className="h-4 w-4" /> Delete list
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white px-4 py-2 font-bold text-black shadow-xl">
          {toast}
        </div>
      )}

      {showInstall && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3">
          <Card className="animate-in slide-in-from-bottom-4 fade-in mx-auto max-w-md duration-300">
            <div className="flex gap-3 p-4">
              <img src="/seen-history/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Install Seen History</p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {installEvent
                    ? 'Add it to your home screen for quick access — it works offline too.'
                    : isIOS
                      ? 'Tap Share, then “Add to Home Screen” to install it.'
                      : 'Use your browser menu → “Install app” to add it to your home screen.'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {installEvent && (
                    <Button size="sm" onClick={installApp}>
                      <Download className="h-4 w-4" /> Install
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={dismissInstallForever}>
                    Don&apos;t show again
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowInstall(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
