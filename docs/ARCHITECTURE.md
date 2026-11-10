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
| `sw.js` | Offline worker: page network-first with a 1 s fallback, everything else saved copy first. `CACHE_VERSION` is bumped by hand in every change to a precached file |
| `manifest.webmanifest` | Install name, colours, icons |
| `assets/logo.svg` | The bunny logo (original) |
| `assets/icons/` | App icons, made from the logo by `tools/make-icons.cjs` |
| `assets/fonts/` | Fraunces (headings) and Inter (text), WOFF2, OFL |
| `tools/make-icons.cjs` | Re-renders the icons after a logo change (needs Playwright) |
| `.github/site-check.cjs` | The pull-request check (copied from Lions-Roar-): missing files, links starting with "/", script errors at phone and desktop width |

## How data moves

Nothing leaves the phone. Settings and, later, quiz answers live in
localStorage under `cfb-` keys. Brand data (phase 2) will be a JSON file in
the repo, precached by the worker, so the list works offline.

## Checks

- `node .github/site-check.cjs index.html` (runs on every pull request).
- `node --check` on each `.js` file.
- Preview: Playwright screenshots at 390 px then 1440 px, served from the
  parent folder so the URL includes `/Cruelty-Free-Beauty-/`.
