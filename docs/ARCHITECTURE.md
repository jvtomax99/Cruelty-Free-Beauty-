# ARCHITECTURE: C.F.B.

A static installable web app. No build step, no server, no packages. GitHub
Pages serves the repo root from `main` (Pages is not turned on yet; plan:
phase 3). The site lives under `/Cruelty-Free-Beauty-/`, so every path is
relative.

## Files

| Path | What |
|---|---|
| `index.html` | The shell: icon sprite, side rail (computers), the four screens (`data-screen` home, brands, profile, learn), tab bar (phones) |
| `app.css` | All styles. Tokens in `:root` at the top; DESIGN.md explains them |
| `app.js` | Screens by `#hash` (Back retraces), greeting by time of day, press feedback (`LIFTS`, `.is-pressed` held 260 ms), saved settings (`CFB.store`, localStorage inside try/catch), registers the worker |
| `learn.js` | The Learn answers and their sources (`ANSWERS`, `CHECKED` date) |
| `sw.js` | Offline worker: every file from one versioned cache, so a launch never mixes old and new files. A bumped `CACHE_VERSION` downloads the new version whole in the background; it shows a launch or two later (tested 2026-11-11). Bump it by hand in every change to a precached file |
| `manifest.webmanifest` | Install name, colours, icons |
| `assets/logo.svg` | The bunny logo (original) |
| `assets/icons/` | App icons, made from the logo by `tools/make-icons.cjs` |
| `assets/fonts/` | Fraunces (headings) and Inter (text), WOFF2, OFL |
| `data/brands.json` | The 30 brands. Each claim (PETA, Leaping Bunny, parent company, China sales) has its own `url` and `checked` date; values yes / no / unknown (parent also n/a). The cruelty-free verdict is never stored: the app works it out per strictness. `search` holds the names the recheck looks up |
| `tools/lookup-certifiers.cjs` | Looks brands up on PETA (WordPress JSON plus the page's icons) and Leaping Bunny (the query its Shopping Guide page runs, so it needs Playwright) and prints what each says. Never edits the data |
| `tools/check-brands.cjs` | Checks `data/brands.json`: missing or invalid fields, claims without a source or date, checks over 90 days old; `--links` also opens every link |
| `tools/make-icons.cjs` | Re-renders the icons after a logo change (needs Playwright) |
| `.github/site-check.cjs` | The pull-request check (copied from Lions-Roar-): missing files, links starting with "/", script errors at phone and desktop width |

## How data moves

Nothing leaves the phone. Settings and, later, quiz answers live in
localStorage under `cfb-` keys. Brand data is `data/brands.json`, precached by
the worker, so the list works offline. Research flow: `lookup-certifiers`
prints what the certifiers say, a person updates the JSON, `check-brands`
confirms it.

## Checks

- `node .github/site-check.cjs index.html` (runs on every pull request).
- `node tools/check-brands.cjs --links` after any brand data change.
- `node --check` on each `.js` file.
- Preview: Playwright screenshots at 390 px then 1440 px, served from the
  parent folder so the URL includes `/Cruelty-Free-Beauty-/`.
