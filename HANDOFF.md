# HANDOFF: C.F.B. phase 4, beauty profile

**Goal now:** phase 4 in `SPEC.md` ("Beauty profile quiz"): about 8
questions, a profile, and a suggested routine from brands that pass the
user's strictness setting. Answers stay on the phone.

**Exact next step:** build the approved plan below, step 1 first (`sells`
and `shadeFinder` data). Nothing built yet.

**State:** phases 1 to 3 merged (PRs #2 to #5). Pages is off: Jose turns
it on after the founder confirms the Strict rule and the verdict wording.

**Waiting on Jose:** founder check, then Pages (Settings, Pages, main,
root); attach repo and GitHub to the "C.F.B. monthly brand recheck"
scheduled task before 3 Dec.

**Look at first:** `SPEC.md` (Beauty profile quiz, Not in v1), `brands.js`
(verdict, `CFB.store`), `DESIGN.md`, `docs/ARCHITECTURE.md`.

---

## Approved plan: Phase 4: Beauty profile quiz and suggested routine

## Context
SPEC phase 4: about 8 questions, a profile, and a suggested routine from brands that pass the shopper's strictness setting, with answers kept on the phone. We have sourced brand data but no product data, so Jose chose (2026-11-11) **brands per step plus each brand's own shade finder**, not named products. "Why it fits" uses only facts we hold: strictness, budget, vegan, and that the brand sells that step.

## What I'll build

**1. Data: what each brand sells, and its shade finder** (`data/brands.json`)
- A new `sells` field: `{ foundation, concealer, blush, bronzer, lip }`, each true or false, taken from the brand's own product list (the same feeds the prices came from, kept in `priceSource`). Brands with no feed get `sells: null`, and the routine leaves them out with an honest note ("10 brands' ranges not checked yet").
- A new `shadeFinder` field: `{ url, checked }`, the brand's own shade-finder page, found with web search and opened with curl or Playwright before saving. Only brands that pass Certified need one (19). Where a brand has none, or its site blocks checking, the link falls back to the official site and is labelled "Brand's site", not "Shade finder".
- `tools/check-brands.cjs` learns both fields: valid values, an https link, a date, and the 90-day check. `--links` opens shade finders too.

**2. Quiz** (Profile screen, new `profile.js`)
- 8 questions, one per screen, with big tap targets, a progress line ("3 of 8") and Back:
  1. Skin type: dry, oily, combination, normal
  2. Depth: fair, light, medium, tan, deep
  3. Vein test (wrist veins look blue/purple, green, or can't tell)
  4. Jewelry test (gold, silver, both)
  5. Sun test (burn, tan, both)
  6. Finish: matte, natural, dewy
  7. Budget: $, $$, $$$, or any
  8. Vegan only: yes or no
- Undertone is worked out from questions 3 to 5: warm, cool or neutral by majority, neutral on a tie. The profile says so ("from your three tests"), and you can change it by hand.
- Answers are saved on the phone with `CFB.store` (`cfb-profile`). Nothing leaves the phone. "Retake" and "Clear my answers" buttons.

**3. Profile and routine** (same screen, after the quiz)
- Profile card: "Combination skin · Medium · Warm undertone · Natural finish · $$ · Vegan".
- Routine: one block per step (foundation, concealer, blush, bronzer, lip). Each lists up to 3 brands that pass your strictness (from the Brands switch), fit your budget, meet vegan if asked, and sell that step. Each brand shows a one-line "why" (for example "Passes Strict · $$ · vegan, per PETA"), a "Find your shade" link to its own finder, and a link to its brand page.
- A tip on each foundation and concealer block: "Tell the shade finder: medium depth, warm undertone." This is wording only, with no product claims.
- If no brand fits a step, it says so and suggests widening the budget.

**4. Wiring:** `index.html` (the Profile screen replaces "Coming soon"), `app.css` (quiz and routine styles from DESIGN.md tokens, with new pieces added to DESIGN.md), `sw.js` (add `profile.js`, bump `CACHE_VERSION`), `docs/ARCHITECTURE.md`, and SPEC.md (record the routine decision and check off phase 4). The verdict logic is reused: `brands.js` exposes `verdict()` on `window.CFB`, not copied.

## Assumptions (separate from the plan)
- The undertone tests are a guide, not a measurement. The screen says "a starting point; check in daylight".
- "Sells foundation" comes from product names on the brand's own site ("foundation", "skin tint", "concealer", "blush", "bronzer", "lip..."). It's a keyword match, and its source and date are stored.
- Up to 3 brands per step keeps it readable. The order: passes both certifiers first, then A to Z (no hidden ranking).
- The founder should see the quiz questions and wording before Pages goes live.

## Not in this phase
Named products, exact shade matching, photo or camera undertone (SPEC Not in v1), saving several profiles, sharing a routine.

## Verification
- `node tools/check-brands.cjs --links`, `node .github/site-check.cjs index.html`, `node tools/test-directory.cjs` (still green).
- New `tools/test-profile.cjs` (Playwright): complete the quiz, check the undertone result for set answer combinations, check every listed brand passes the current strictness, fits the budget, meets vegan and sells that step (checked against the data independently), check answers survive a reload, check "Clear my answers" empties storage, and check it works offline.
- Screenshots at 390 px and 1440 px: a quiz question, the profile and routine.
- A reviewer subagent, then the pull request, then a merge when green (CLAUDE.md rule).
