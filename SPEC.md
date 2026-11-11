# SPEC: C.F.B. (Cruelty-Free Beauty)

*"Cruelty free looks best on skin."*

Draft, 2026-11-10, from the founder's pitch and the ChatGPT chat Jose
brought (screenshots and `CFB_Chat_Transcript.pdf`). Lines marked TO FILL
wait for Jose and the founder.

## What it is and who it's for

A phone-first app that answers two questions for makeup shoppers:
**is this brand cruelty-free** (with the evidence), and **is it right for
me**.

- **Founder and real user:** TO FILL (name). Jose builds it for them; they
  check the plan, the brand rules and any words that speak for them.
- **Audience:** people who already shop cruelty-free or are switching,
  mostly on a phone, often in a store aisle. US first (retailers and
  certifications differ by country).
- **Form:** an installable web app (added to the home screen from the
  browser), hosted free on GitHub Pages. No app store, no accounts, no
  server. Anything personal (quiz answers, saved items) stays on the phone.

## Brand rules (what the data follows)

1. Every brand record holds: PETA status, Leaping Bunny status (two
   separate fields, different standards), parent company and whether it
   tests on animals, mainland China retail sales, vegan availability, price
   level, product types, where to buy, evidence links, last-checked date,
   review status.
2. Values are yes / no / unknown / not applicable. Absence from a
   certifier's list is "unknown", never "tests on animals".
3. A brand is shown as cruelty-free only when a certifier's own listing
   was checked and dated. A brand's marketing claim alone shows as
   "unverified".
4. **Strictness switch**, the user's choice:
   - *Certified:* listed by PETA or certified by Leaping Bunny.
   - *Strict* (the founder's original rule): certified, parent company does
     not test, and not sold in mainland China stores.
   - Default: Strict (decided 2026-11-11).
   - Strict fails a brand only on a known problem: a parent that tests, or
     sold in mainland China stores, each with a source. An unknown passes
     with a small note ("brand doesn't say where it sells"). Brands almost
     never publish this (1 of 18 brand sites did, 2026-11-11). Founder to
     confirm.
5. China: Leaping Bunny's FAQ says China's rules now make it possible, in
   specific cases, to sell there without animal testing and stay certified
   (its China Qualification Program). Trade press dates the change to May 1,
   2021, for imported general cosmetics with a safety assessment and a GMP
   certificate; special cosmetics (sunscreen, for example) can still be
   tested. The app treats China sales as a filter, not as the definition of
   cruelty-free.
6. Every brand is rechecked at least every 90 days. Past that, it shows
   "check due" until rechecked.
7. No PETA or Leaping Bunny logos (trademarks). The app names the
   certification in words and links to the certifier's listing.

## Features in v1, and when each is done

- **Look and logo.** Done when DESIGN.md exists (soft luxury: blush pink,
  cream, nude) and the bunny logo reads at 32 px and 512 px.
- **Install and offline.** Done when it installs on an iPhone and an
  Android phone and opens with the brand list in airplane mode.
- **Brand directory and search.** Done when 30 makeup brands each have a
  record where every claim has a working evidence link and a last-checked
  date or is marked unknown (2026-11-11: brands rarely publish China sales
  or owners), and
  search finds any of them by name on a phone.
- **Brand page.** Done when it shows both certifications, the parent
  company, China, vegan, where to buy, sources and the checked date, and
  says "unknown" plainly wherever evidence is missing.
- **Filters.** Strictness, vegan, price (drugstore, mid, luxury), product
  type. Done when switching to Strict hides every brand whose parent tests
  or that sells in China, and the count updates.
- **Where to buy.** Done when every brand has at least one buy link that
  opens. Wording is "carries this brand", never "in stock".
- **Beauty profile quiz.** About 8 questions: skin type, depth, undertone
  (vein, jewelry and sun tests), finish, budget. Done when finishing it
  shows a profile and a suggested routine (foundation, concealer, blush,
  bronzer, lip) of product lines from brands that pass the user's
  strictness setting, each with why it fits and a link to that brand's own
  shade finder. Answers stay on the phone.
- **Learn.** Cruelty-free vs vegan, PETA vs Leaping Bunny, parent
  companies, China today. Done when every answer links a primary source.

## Not in v1

- Camera skin or undertone analysis (lighting makes it unreliable; face
  photos are biometric data).
- Exact shade matching across brands (no free shade data).
- Barcode scanner (phase 5).
- Reviews, photo uploads, accounts, sign-in.
- Store stock or "near me".
- Brand-change alerts.
- An app-store app.
- Skincare, hair and household products.
- Paid or affiliate links (undecided; the data has a link-type field so
  they can be added later, always disclosed).

## Later

Barcode scanner, saved list, brand-change alerts, Spanish (EN | ES switch
like Lions-Roar-), near me, skincare, reviews, a camera undertone helper
only if it can be shown to work across skin tones.

## Phases

### Phase 1: Look and app shell (done 2026-11-10)
- [x] DESIGN.md (soft luxury), sample page shown to Jose before wider use
- [x] Bunny logo (SVG), app icons, home-screen install, offline cache
- [x] Home (greeting, search, four tiles), tab bar, empty screens
- [x] Learn page with sourced answers
- [x] Site check on every pull request

### Phase 2: Brand data
- [x] Research and verify 30 makeup brands from primary sources (certifier
      status for all 30; unknowns marked)
- [x] `data/brands.json` plus a check script (missing fields, dead links,
      checks older than 90 days)
- [ ] Fill price and where to buy for the 17 brands left (needs the
      second batch of sites allowed), and owners where a source exists

### Phase 3: Directory
- [ ] Brand list, search, filters, strictness switch
- [ ] Brand page and where to buy

### Phase 4: Beauty profile
- [ ] Quiz, profile, suggested routine

### Phase 5: Scanner and saved list
- [ ] Barcode scan (Open Beauty Facts for barcode to brand; a code
      library for iPhone, which has no built-in barcode reader)
- [ ] Saved list on the phone

## Open questions (TO FILL)

- The founder's name (stays out of the repo until Jose fills it in).
- 1 to 3 websites whose look the founder likes (for DESIGN.md).

## Decided

- 2026-11-10 (Jose): built for the founder; v1 is the directory plus the
  quiz; $0 asset budget; soft luxury look; Fraunces headings.
- 2026-11-11 (Jose): default strictness is Strict. Brand rechecks run as a
  monthly scheduled Claude task that opens a pull request for Jose to
  approve. Affiliate links undecided; the data leaves room for them.
  Brand list: 24 likely certified plus 6 popular brands that may fail
  (Maybelline, L'Oréal Paris, MAC, Estée Lauder, Clinique, Benefit). Each
  claim in a record has its own source and date; the verdict is computed
  by the app, never stored.
- 2026-11-11 (Jose): Strict fails only on known problems; unknowns pass
  with a note (replaces "not confirmed for Strict"). Founder to confirm.
- Paid or affiliate links: ever?
