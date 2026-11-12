# CLAUDE.md: Cruelty-Free Beauty

**C.F.B. (Cruelty-Free Beauty)**, "Cruelty free looks best on skin." A
phone-first installable web app for makeup shoppers: is this brand
cruelty-free (with the proof), and is it right for me. Plain HTML, CSS and
JS, no build step. Jose builds it for the founder, who is the real user.

Read first: `SPEC.md` (what, who, phases and what's next),
`docs/ARCHITECTURE.md` (map of files), `DESIGN.md` (look). The rules shared
by all of Jose's projects are in `.claude/rules/general.md`; where this file
differs, this file wins.

## Rules for this repo

- **Claims need sources.** Whether a brand is cruelty-free changes (parent
  companies, sales where animal testing is required). Every such claim links
  its source and the date it was checked. Never state one from memory.
- **The founder signs off.** Remind Jose to check plans, brand rules and any
  words that speak for the founder with them.
- **Offline worker.** Bump `CACHE_VERSION` in `sw.js` in every change to a
  file it precaches, or returning users keep the old app.
- **Launch film.** `assets/video/launch.mp4` (24 s), cut by
  `tools/make-launch-video.sh`. It is not in the worker's precache list; if
  the film changes, bump `MEDIA` in `sw.js`. Runway credits are Jose's: ask
  before spending more. Never show PETA's logo or bunny-ears mark.
- **Brand sites.** Read them with curl or Playwright from Bash (a subagent's
  WebFetch skips the proxy and fails). Verify every quote before saving.
  Exponent and ACTAsia refuse automated readers; cite the certifiers' own
  pages instead.
- **Budget: $0.** Free assets only, listed in `CREDITS.md`. The repo is
  public, so paid raw files can't be committed.

## Preview, checks and going live

- **Preview.** There are no branch previews. Serve the repo from its parent
  folder and send Playwright screenshots at 390 px, then 1440 px, plus a
  "try this" list.
- **Site check.** Run `node .github/site-check.cjs index.html`. It also runs
  on every pull request and must be green before merging. A new page goes
  into the list in `.github/workflows/site-check.yml`.
- **Hosting.** GitHub Pages from `main`, root folder, at
  `jvtomax99.github.io/Cruelty-Free-Beauty-/`. Turning Pages on or off is a
  repo setting: ask Jose.
- **Merging (Jose, 2026-11-11).** Claude merges its own pull requests into
  `main` once the site check is green and the reviewer's findings are fixed,
  then sends a phone notification naming the change with the one-line undo.
  Exception: a monthly recheck that changes any brand's status waits for
  Jose.

## Tools

- **Taste skill** (`.claude/skills/taste/`): it asks for the Playwright MCP
  server. In a cloud session use the installed Playwright instead and run
  its `references/extract.js` with `page.evaluate`.
- **Refactor.** `docs/refactor.md`, run when Jose asks for "Refactor:
  CLEANUP.md items ...". The list is `docs/CLEANUP.md`.
