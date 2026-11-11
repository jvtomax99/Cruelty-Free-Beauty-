# Cleanup list

Last audit: 2026-11-11, after phase 2.

Report from `docs/cleanup-audit.md`. Nothing here has been changed yet. Run
fixes with "Refactor: CLEANUP.md items ..." (docs/refactor.md). No
packages, so knip and depcheck had nothing to check; a helper scanned for
unused CSS, unused code and abandoned files, and each item below was
confirmed with grep.

1. **Maskable icon not saved for offline.** `sw.js` PRECACHE lists every
   icon except `assets/icons/icon-maskable-512.png`, which
   `manifest.webmanifest` uses. Fixing it means an installed app always has
   its Android icon, even offline. Add one line and bump `CACHE_VERSION`.
   Risk: low.
2. **Lookup script may not reach PETA through the proxy.**
   `tools/check-brands.cjs` restarts itself with `NODE_USE_ENV_PROXY=1` so
   Node's fetch uses the proxy; `tools/lookup-certifiers.cjs` does not. It
   works today only because PETA's site resolves without the proxy. Copying
   the same 8 lines protects the monthly recheck. Risk: low.
3. **ARCHITECTURE.md says the brand list works offline.** `data/brands.json`
   is precached, but no screen reads it until phase 3. Reword to "will work
   offline once the Brands screen reads it" (or fix in phase 3). Risk: low.
4. **Unused design tokens.** `app.css` defines `--nude`, `--fs-cap` and
   `--fs-t1`; nothing uses them (DESIGN.md lists `--nude`). Removing them
   shortens the token list. Phase 3 may want them, so decide then. Risk: low.
5. **Press-feedback handler is longer than needed.** `app.js` (about lines
   39 to 56) adds and removes four listeners per tap; `{ once: true }` would
   do the same in about half the lines. Small gain, and tap feel must be
   rechecked on a phone after the change. Risk: medium.
6. **Two tiny helpers written twice in the tools.** A pause (`sleep` in
   `lookup-certifiers.cjs`, inline `setTimeout` in `check-brands.cjs`) and a
   fetch with a User-Agent. A shared file would save about 10 lines but add
   a file; probably not worth it. Risk: low.

Checked and kept on purpose:
- `CFB.store` in `app.js` (saved settings): unused today, needed for the
  phase 4 profile and quiz.
- `.sr-only` in `app.css`: unused today, likely needed for screen-reader
  labels on the phase 3 list.
- Extra fields in the lookup script's output (`countries`, `tradingName`,
  `parentTests`, `vegan`): meant for the person reading it.
- All icons, fonts and SVG symbols are referenced; no unused JS functions;
  every class in the HTML has a style.
