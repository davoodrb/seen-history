// Google Drive backup, via Google Identity Services (GIS).
// The OAuth client ID is public by design (it only identifies the app);
// the user's access token is kept in memory only and never stored.

export const DRIVE_CLIENT_ID: string = '1098692766756-ggdf8ijic7k1bn92gmjgqj9qan6iotpq.apps.googleusercontent.com' // Google Cloud OAuth client (Web application, "Seen History web") — public by design

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const BACKUP_FILE_NAME = 'seen-history-backup.json'
const GIS_SCRIPT = 'https://accounts.google.com/gsi/client'

interface GoogleAccounts {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        prompt?: string
        callback: (resp: { access_token?: string; error?: string }) => void
      }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
    }
  }
}

declare global {
  interface Window {
    google?: GoogleAccounts
  }
}

let gisPromise: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (typeof window.google?.accounts?.oauth2 !== 'undefined') return Promise.resolve()
  if (!gisPromise) {
    gisPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = GIS_SCRIPT
      s.async = true
      s.defer = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Could not load Google sign-in'))
      document.head.appendChild(s)
    })
  }
  return gisPromise
}

/** Ask Google for a Drive access token. silent=true tries without any popup. */
export async function requestDriveToken(clientId: string, silent = false): Promise<string> {
  await loadGis()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error('Google sign-in did not load')
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.access_token) resolve(resp.access_token)
        else
          reject(
            new Error(
              resp.error === 'interaction_required' ? 'Sign-in needed' : 'Google sign-in was cancelled',
            ),
          )
      },
    })
    client.requestAccessToken({ prompt: silent ? 'none' : '' })
  })
}

async function driveFetch(token: string, url: string, init?: RequestInit) {
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...((init?.headers as Record<string, string> | undefined) ?? {}) },
  })
  if (r.status === 401 || r.status === 403) throw new Error('Drive session expired')
  return r
}

export async function findBackupFile(token: string): Promise<{ id: string; modifiedTime?: string } | null> {
  const q = `name='${BACKUP_FILE_NAME}'`
  const r = await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(q)}&fields=files(id,modifiedTime)`,
  )
  if (!r.ok) throw new Error('Could not look for the Drive backup')
  const j = (await r.json()) as { files?: { id: string; modifiedTime?: string }[] }
  return j.files?.[0] ?? null
}

/** Create the backup file, or update it if it already exists. Returns the file id. */
export async function uploadBackup(token: string, fileId: string | null, json: string): Promise<string> {
  if (fileId) {
    const r = await driveFetch(token, `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    })
    if (!r.ok) throw new Error('Could not update the Drive backup')
    const j = (await r.json()) as { id: string }
    return j.id
  }
  const boundary = `seen-history-${Date.now()}`
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: BACKUP_FILE_NAME, parents: ['appDataFolder'] }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`
  const r = await driveFetch(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!r.ok) throw new Error('Could not create the Drive backup')
  const j = (await r.json()) as { id: string }
  return j.id
}

export async function downloadBackup(token: string, fileId: string): Promise<string> {
  const r = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`)
  if (!r.ok) throw new Error('Could not read the Drive backup')
  return r.text()
}

export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `token=${encodeURIComponent(token)}`,
    })
  } catch {
    // revocation is best-effort
  }
}
