# Seen History 🎬 — Vite + React + shadcn/ui

Your history of what you've watched — minimal, no account, no server.

**Live site:** https://davoodrb.github.io/seen-history/

## How it works

1. **Search and add.** One search box. Start typing a movie or series, pick it from the suggestions — it comes in with its poster, year and type (movie/series). No result? Press Enter to add what you typed.
2. **That's your list.** Posters in a grid, tap ✕ to remove one. Nothing else is asked for — no genre, rating, notes or owner fields.
3. **Share it.** The share code is generated automatically and updates as your list changes — the full code is shown in the share box. The code *is* your whole list — every title, year and poster, gzipped into one code. Share it, copy the link, or copy the code. Anyone with the code can see the list, no account.
4. **Compare.** Paste a friend's code or link and see what you've both watched, what only you have seen, and what only they have seen.

Privacy Policy and Terms of Service pages are linked in the footer, and open directly at `…/seen-history/#privacy` and `#terms`.

## Backup

Settings → Backup. **On this device:** download all your lists as one `.json` file, or restore from one. **Google Drive:** connect your own Google account and the app backs up to a hidden folder in your Drive (only this app can see it) about 2 seconds after every change — only your own lists, never anyone else's. Restore from Drive, or disconnect, from the same place. Your Google token is kept in memory only, never stored.

Lists live in your browser (localStorage) unless you share them. Old `?p=` share links from the first version still open.

## Titles & posters

Autocomplete uses TMDB through a free Cloudflare Worker proxy (`seen-history-tmdb.davood3284.workers.dev`) — the TMDB API key lives in the worker as an encrypted secret and never reaches the browser. If the worker is unreachable, it falls back to two free, keyless sources:

- **IMDb's public suggestion feed** (`v2.sg.media-imdb.com/suggestion/titles/…`) — titles, years, posters, IMDb IDs for movies and series.
- **TVMaze** (`api.tvmaze.com/search/shows`) — backup for series, with posters.

If all are unreachable, you can still add titles by typing them and pressing Enter. This product uses the TMDB API but is not endorsed or certified by TMDB.

## Tech

- [Vite](https://vite.dev/) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (`src/components/ui/*`, `components.json`)
- The share code is the list JSON, gzipped with the browser's built-in `CompressionStream` and base64url-encoded (plain base64url fallback on older browsers)

## Run it locally

```bash
npm install
npm run dev      # then open the local URL it prints
npm run build    # production build into dist/
npm run preview  # serve the production build
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the app (`npm ci && npm run build`) and deploys `dist/` to GitHub Pages. The repo's Pages source must be set to **GitHub Actions** (Settings → Pages). The Vite `base` is `/seen-history/`, matching the Pages URL.
