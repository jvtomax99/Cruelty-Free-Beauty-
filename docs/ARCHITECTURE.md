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
| `brands.js` | Brands screen and brand pages (`#brand/<id>`): loads `data/brands.json`, works out each verdict (Strict / Certified, saved as `cfb-mode`), search, filters. Also shared helpers: `CFB.match` (a label's brand name to our brand), `CFB.saved` (hearts, `cfb-saved`) |
| `changes.js` | "What changed": reads `changes` from `data/brands.json` (through `CFB.data`), shows the ones this phone hasn't seen on Home (hearted brands first; seen ones saved as `cfb-changes-seen`), the last 12 months under the Brands list, and a line on the brand's page (`CFB.changeLine`). Its words say what a list showed, never why |
| `home.js` | Home's rail of brands that pass (hearted first, 8 then "See all"). Uses `CFB.verdict` and `CFB.mode`; it never words a verdict itself |
| `assets/images/`, `assets/pins/` | Home's banner picture and the pin pictures on the quick tiles (256 px WebP, cut out). `CREDITS.md` says where from |
| `scan.js` | Scan screen (`#scan`): camera or photo, barcode to brand through Open Beauty Facts (only the number is sent), matched by `CFB.match`, verdict by `CFB.verdict`. Falls back to typing the brand. Recent scans (`cfb-scans`, 10) and brands we haven't checked (`cfb-unlisted`, 50) stay on the phone. Camera stops on leaving the screen |
| `assets/vendor/barcode-detector/` | Barcode reader for phones without one built in (iPhone): `barcode-detector` 3.2.3 plus `zxing_reader.wasm` 3.1.6, MIT and Apache 2.0; its README says how to update |
| `profile.js` | Profile screen: 8-question quiz, profile (saved as `cfb-profile`, only on the phone), routine of brands per step using `CFB.verdict` and the brand data from `brands.js`; Saved brands list |
| `intro.js` | The launch show: gate, shots, sparkles (one canvas), music (Web Audio), skip, the landing on Home's logo, Profile's replay; it plays on the first visit only (`cfb-intro-seen`). A script in `index.html`'s head decides before paint (`html.intro-on`). `CFBIntro.seek(t)` shows any moment for tests. Version 2: when `assets/video/launch.mp4` is ready at the tap it plays in a `<video>` over the drawn scene (which waits on its hero pose), then the drawn logo does the landing; the drawn show alone is the fallback (film can't start within 0.8 s of the tap, reduced motion, data saver); a film that breaks or freezes 1.5 s part-way opens the app at once. `CFBIntro.film()` reports its state for tests |
| `assets/video/` | The opening film (13.8 s, with voice; `intro.js` lays its words, phone cards and button over it on the times in `FILM`). Cut from the rendered shots by `tools/make-launch-video.sh <folder>`; the source shots are not in the repo |
| `learn.js` | The Learn answers and their sources (`ANSWERS`, `CHECKED` date) |
| `sw.js` | Offline worker: every file from one versioned cache, so a launch never mixes old and new files. A bumped `CACHE_VERSION` downloads the new version whole in the background; it shows a launch or two later (tested 2026-11-11). Bump it by hand in every change to a precached file. The launch film is not precached (too big to make the install wait): it lives in its own cache (`MEDIA`), saved when the page asks once the film has played, served in byte ranges (iPhones need that), and kept across app updates; bump `MEDIA` if the film changes |
| `manifest.webmanifest` | Install name, colours, icons |
| `assets/logo.svg` | The bunny logo (original). Every part has an id; `intro.js` animates them |
| `assets/icons/` | App icons, made from the logo by `tools/make-icons.cjs` |
| `assets/fonts/` | Fraunces (headings) and Inter (text), WOFF2, OFL |
| `data/brands.json` | The 30 brands. Each claim (PETA, Leaping Bunny, parent company, China sales) has its own `url` and `checked` date; values yes / no / unknown (parent also n/a). The cruelty-free verdict is never stored: the app works it out per strictness. `search` holds the names the recheck looks up. `sells` (foundation, concealer, blush, bronzer, lip) and `shadeFinder` come from the brand's own site, each dated. `price` ($ / $$ / $$$) comes from the median single-product price on the brand's own site, explained in `priceSource` |
| `tools/lookup-certifiers.cjs` | With `--diff`, compares the lookup with the stored statuses and prints what looks changed plus a `changes` entry to paste. Looks brands up on PETA (WordPress JSON plus the page's icons) and Leaping Bunny (the query its Shopping Guide page runs, so it needs Playwright) and prints what each says. Never edits the data |
| `tools/check-brands.cjs` | Checks `data/brands.json`: missing or invalid fields, claims without a source or date, checks over 90 days old; `--links` also opens every link |
| `tools/make-icons.cjs` | Re-renders the icons after a logo change (needs Playwright) |
| `.github/site-check.cjs` | The pull-request check (copied from Lions-Roar-): missing files, links starting with "/", script errors at phone and desktop width |

## How data moves

Nothing leaves the phone except a scanned barcode number, sent to Open
Beauty Facts to learn the brand. Settings and, later, quiz answers live in
localStorage under `cfb-` keys. Brand data is `data/brands.json`, precached by
the worker so the list will work offline once the Brands screen reads it
(phase 3). Research flow: `lookup-certifiers`
prints what the certifiers say, a person updates the JSON, `check-brands`
confirms it.

## Checks

- `node .github/site-check.cjs index.html` (runs on every pull request).
- `node tools/check-brands.cjs --links` after any brand data change.
- `node tools/test-profile.cjs`: the quiz and routine in a real browser (undertone, picks checked against the data, reload, clear, offline).
- `node tools/test-scan.cjs` (add `--live` for real Open Beauty Facts lookups): photo, fake camera and typed barcodes through the vendored reader, every result type, brand matching on real Open Beauty Facts names, saved list, offline.
- `node tools/test-intro.cjs` after any change to the launch show or the logo.
- `node tools/test-changes.cjs`: the "What changed" notices with made-up changes (order, hearted first, "Got it", brand page, ignored entries).
- `node tools/test-directory.cjs`: the directory in a real browser (counts, search, filters, brand page, Back, offline).
- Monthly: a scheduled task (3rd of each month) reruns the lookup and opens
  a recheck pull request. A status that changed also gets an entry in
  `changes` (brand id, claim, from, to, date, source link, optional short
  note stating a fact, never a reason; `law: true` when PETA says "working
  for regulatory change"), which is what the app announces. A data-only
  change still needs the `CACHE_VERSION` bump, or installed apps never
  get it.
- `node --check` on each `.js` file.
- Preview: Playwright screenshots at 390 px then 1440 px, served from the
  parent folder so the URL includes `/Cruelty-Free-Beauty-/`.
