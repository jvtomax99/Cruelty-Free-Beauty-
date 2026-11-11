# HANDOFF: C.F.B. phase 2, brand data

**Goal now:** finish phase 2 in `SPEC.md`: fill China sales and parent
company for the 30 brands in `data/brands.json` from the brands' own sites,
then price, product types and where to buy, then review and pull request.

**Exact next step:** fill `price`, `productTypes` and `whereToBuy` for the
30 brands (PETA's "Where to Find" and "What X Sells" and Leaping Bunny's
"Products Sold" are sourced starting points), run
`node tools/check-brands.cjs --links`, then create the monthly recheck
scheduled task, run the reviewer subagent, open the pull request and send
Jose a push notification.

## Done (branch `claude/clever-lovelace-io1u7j`, pushed)
- SPEC decisions 2026-11-11: Strict default, failing only on known
  problems (unknowns pass with a note); monthly scheduled Claude recheck opening a
  pull request; affiliate links undecided (`linkType` field); brand list.
- `data/brands.json`: 30 brands, PETA and Leaping Bunny status sourced and
  dated 2026-11-11. Parents only where PETA names them (L'Oréal, Estée
  Lauder and Kosé test; Unilever tests when the law requires it ("Working
  for Regulatory Change"); Markwins does not, per PETA).
- `tools/lookup-certifiers.cjs` (PETA JSON plus page icons; Leaping Bunny
  via its own query API inside the page, needs Playwright) and
  `tools/check-brands.cjs` (tested: catches broken records, dead links,
  checks over 90 days with `CHECK_DATE`).
- `sw.js` precaches `data/brands.json`, `CACHE_VERSION` cfb-v3.

## Research lessons (2026-11-11)
- Subagents' WebFetch skips the proxy: every brand site fails DNS for them.
  Use curl or Playwright from Bash (goes through the proxy) and WebSearch
  to find page URLs. Verify every quote with curl before saving it.
- Brands almost never publish China sales or owners: of 18 brand sites,
  only Charlotte Tilbury did (sells in China, saved). Fenty's FAQ says no
  testing "in any region" (saved as context, China still unknown). So
  Strict now fails only on known problems (SPEC, founder to confirm).
- kosas.com gets a 403 from the proxy; Huda Beauty's policy page URL is
  unknown; e.l.f.'s cruelty-free page is JavaScript and shows no China text.

## Environment (Default)
- Added: `imisservices.mosaic-mobile.info` (Leaping Bunny's list) and 19
  brand hosts (e.l.f. through Huda Beauty).
- Rejected twice by the environments service, no reason given: the second
  19 hosts (Anastasia, Juvia's Place, Revolution, Thrive, Hourglass, NYX,
  Maybelline, L'Oréal, MAC, Estée Lauder, Clinique, Benefit, LVMH, Unilever,
  Kosé, Coty, Puig). Jose may need to add them in Settings, or use a
  separate C.F.B. environment.

## Still to do
- Price, productTypes, whereToBuy (empty now, the check script warns).
- Optional: the second batch of hosts, if Jose adds them in Settings.
- The monthly scheduled recheck task (not created yet).
- Reviewer subagent, then pull request and push notification.

## Look at first
`data/brands.json`, `tools/check-brands.cjs`, `SPEC.md` (Brand rules).
