# HANDOFF: C.F.B. phase 2, brand data

**Goal now:** phase 2 in `SPEC.md`: research and verify 30 makeup brands
from primary sources and store them in `data/brands.json`, plus a check
script (missing fields, dead links, checks older than 90 days).

**Exact next step:** ask Jose the founder questions still marked TO FILL
in `SPEC.md` (name, default strictness, who rechecks brands every 90 days),
then propose the brand record format and the starting list of 30 brands
for his OK before researching.

## Done (all merged into main)
- PR #1: CLAUDE.md, rule docs, taste skill, .gitignore.
- PR #2 (phase 1): SPEC.md, DESIGN.md (soft luxury, Fraunces + Inter),
  bunny logo and icons, Home / Brands / Profile / Learn shell, Learn with 5
  sourced answers, offline worker (`sw.js`, `CACHE_VERSION` cfb-v2), site
  check.

## Decisions this session (also in SPEC.md "Decided")
- Built for the founder (name TO FILL); v1 = directory + quiz; scanner is
  phase 5; $0 budget; soft luxury look; Fraunces headings.
- GitHub Pages stays off until phase 3.
- Certifier sites are allowed in the Default environment; Exponent and
  ACTAsia refuse automated readers.
- PETA's list only covers brands selling in the U.S., Canada, India and
  Germany; Leaping Bunny keeps brands owned by testing parents if they run
  stand-alone (its FAQ). Leaping Bunny has a China Qualification Program.

## Look at first
`SPEC.md` (Brand rules, Phase 2), `docs/ARCHITECTURE.md`, `learn.js` (how
sources and the checked date are shown), `sw.js` (add `data/brands.json`
to PRECACHE and bump `CACHE_VERSION`).
