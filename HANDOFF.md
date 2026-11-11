# HANDOFF: C.F.B. phase 3, brand directory

**Goal now:** build phase 3 from the plan below (approved by Jose
2026-11-11). Nothing is built yet.

**Exact next step:** confirm with Jose, then build `brands.js` and the
Brands screen, then the brand page, then tests, screenshots, reviewer,
pull request, merge (CLAUDE.md merge rule), and ask Jose before turning
on GitHub Pages.

**State:** main has phases 1 and 2 (PRs #2 to #4 merged). Branch
`claude/clever-lovelace-io1u7j` = main plus this handoff and the SPEC
change (product-type filter moved to Later).

**Waiting on Jose:** attach repo and GitHub to the "C.F.B. monthly brand
recheck" scheduled task before 3 Dec; founder confirms the Strict rule and
verdict wording; optionally allow `www.juviasplace.com` and `kosas.com`
so every brand has a buy link that opens.

---

## Approved plan: Phase 3: Brand directory and brand page

## Context
Phase 2 put 30 sourced brands in `data/brands.json`, but the Brands screen still says "Brands are on the way". Phase 3 makes the data useful: a list you can search and filter, a Strict / Certified switch, and a page per brand showing the proof. SPEC "Done when" lines: search finds any brand by name on a phone; switching to Strict hides every brand with a testing parent or China sales, and the count updates; the brand page shows both certifications, parent, China, vegan, where to buy, sources and dates, and says "unknown" plainly; every brand has a buy link that opens.

## What I'll build

**1. Brands screen** (`index.html` section `data-screen="brands"`, new `brands.js`)
- Loads `data/brands.json` with `fetch` (it's already precached, so this works offline).
- Top: a **Strict / Certified** switch (two-button toggle). Default Strict; the choice is saved with the existing `CFB.store` in `app.js`.
- **Search box:** matches the brand name and its `search` names, ignoring case and accents ("estee" finds Estée Lauder).
- **Filters:** Vegan only, and Price ($ drugstore, $$ mid, $$$ luxury).
- **Count line:** "14 brands pass Strict".
- **Browsing** shows only brands that pass. **Searching** shows every match, including brands that fail, with the reason, so "is Maybelline OK?" gets "Doesn't pass: PETA says it tests on animals" instead of nothing. Under the list there's a "Show the brands that don't pass" button.
- **Each row:** name, a verdict chip (Passes / Doesn't pass / Not on either list), price tier, Vegan chip. Tapping a row opens its brand page.

**2. Verdict logic** (in `brands.js`, worked out on the fly, never stored)
- *Certified:* passes if PETA = yes or Leaping Bunny = yes. Fails if PETA = no and Leaping Bunny isn't yes. Otherwise "Not on either list".
- *Strict:* passes Certified, AND the parent is not a known tester, AND it's not known to sell in mainland China stores. An unknown parent or China status passes with a small note ("Brand doesn't say where it sells").
- Expected with today's data: 19 pass Certified and 14 pass Strict (Tarte, Too Faced, Urban Decay, NYX and Hourglass drop out over their parents). The test will check these numbers.

**3. Brand page** (route `#brand/<id>`, so Back returns to the list with its scroll kept)
- Header: name and verdict under the current setting, with the reason in one sentence.
- One card each for PETA, Leaping Bunny, parent company, China, vegan and price. Each card has the status in words, a source link ("PETA's page"), "Checked 11 Nov 2026", "Unknown" written plainly where there's no evidence, and "Check due" after 90 days.
- **Where to buy:** "Official site carries this brand" (never "in stock"). Maybelline and L'Oréal Paris read "Brand site, sells through other stores".

**4. Wiring:** `app.js` routing learns `#brand/<id>` (the Brands tab stays highlighted). `sw.js` adds `brands.js` and bumps `CACHE_VERSION`. Styles go in `app.css` using the existing DESIGN.md tokens and components (chips, cards, tiles), with new pieces added to DESIGN.md. ARCHITECTURE.md gets updated.

**5. Go live:** at the end, turning on GitHub Pages is a repo setting, so I'll ask you first (CLAUDE.md).

## Recommendation: drop the product-type filter from this phase
SPEC lists it, but the data can't support it: 18 of the 20 brands with types have lips, eyes, cheeks and face, and 10 have none. A filter that hides nothing, or hides brands for missing data, would mislead. I'd move it to "Later" until the quiz phase needs better data. Approving this plan approves that change, and I'll record it in SPEC.md.

## Assumptions (separate from the plan)
- Kosas and Juvia's Place have no buy link yet: Kosas is refused by the proxy, and Juvia's redirects to `www.juviasplace.com`, which isn't allowed. To meet "every brand has a buy link that opens" you'd need to add `www.juviasplace.com` and `kosas.com` to Allowed domains. Otherwise I'll add the links unchecked and flag them.
- No brand logos (trademarks; docs/assets.md). Rows are text only, styled per DESIGN.md.
- No sorting choices: passing brands first, then A to Z.
- The founder should see the verdict wording ("Doesn't pass", "Not on either list") before Pages goes live.

## Not in this phase
Saved list, sorting options, logos, the product-type filter, store-specific links (Ulta, Sephora).

## Verification
- `node .github/site-check.cjs index.html` and `node tools/check-brands.cjs --links`.
- A Playwright script: the Strict count is 14, Certified is 19, a search for "estee" finds Estée Lauder with "Doesn't pass", the Vegan filter count matches the data, a brand page shows every card and the "Unknown" wording, Back returns to the list, and it works offline after the first load.
- Screenshots at 390 px, then 1440 px, served from the parent folder, plus a "try this" list for your phone.
- A reviewer subagent before the pull request; I merge when checks are green (CLAUDE.md rule).
