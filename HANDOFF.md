# HANDOFF: C.F.B. phase 2, brand data

**Goal now:** finish phase 2 in `SPEC.md`: fill China sales and parent
company for the 30 brands in `data/brands.json` from the brands' own sites,
then price, product types and where to buy, then review and pull request.

**Exact next step:** add the brand-site research results to
`data/brands.json` (quotes checked against the live page), run
`node tools/check-brands.cjs --links`, then ask Jose about the blocked
second batch of hosts (below).

## Done (branch `claude/clever-lovelace-io1u7j`, pushed)
- SPEC decisions 2026-11-11: Strict default; unknown parent or China shows
  "not confirmed for Strict"; monthly scheduled Claude recheck opening a
  pull request; affiliate links undecided (`linkType` field); brand list.
- `data/brands.json`: 30 brands, PETA and Leaping Bunny status sourced and
  dated 2026-11-11. Parents only where PETA names them (L'Oréal, Estée
  Lauder and Kosé test; Unilever and Markwins don't, per PETA).
- `tools/lookup-certifiers.cjs` (PETA JSON plus page icons; Leaping Bunny
  via its own query API inside the page, needs Playwright) and
  `tools/check-brands.cjs` (tested: catches broken records, dead links,
  checks over 90 days with `CHECK_DATE`).
- `sw.js` precaches `data/brands.json`, `CACHE_VERSION` cfb-v3.

## Environment (Default)
- Added: `imisservices.mosaic-mobile.info` (Leaping Bunny's list) and 19
  brand hosts (e.l.f. through Huda Beauty).
- Rejected twice by the environments service, no reason given: the second
  19 hosts (Anastasia, Juvia's Place, Revolution, Thrive, Hourglass, NYX,
  Maybelline, L'Oréal, MAC, Estée Lauder, Clinique, Benefit, LVMH, Unilever,
  Kosé, Coty, Puig). Jose may need to add them in Settings, or use a
  separate C.F.B. environment.

## Still to do
- China and parent for the remaining brands; price, productTypes,
  whereToBuy (all empty now, the check script warns).
- The monthly scheduled recheck task (not created yet).
- Reviewer subagent, then pull request and push notification.

## Look at first
`data/brands.json`, `tools/check-brands.cjs`, `SPEC.md` (Brand rules).
