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
     never publish this (1 of 18 brand sites did, 2026-11-11). Founder
     approved 2026-11-11.
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
- **Filters.** Strictness, vegan, price (drugstore, mid, luxury). (Product
  type moved to Later 2026-11-11: the data has the same types for almost
  every brand.) Done when switching to Strict hides every brand whose parent tests
  or that sells in China, and the count updates.
- **Where to buy.** Done when every brand has at least one buy link that
  opens. Wording is "carries this brand", never "in stock".
- **Beauty profile quiz.** About 8 questions: skin type, depth, undertone
  (vein, jewelry and sun tests), finish, budget. Done when finishing it
  shows a profile and a suggested routine (foundation, concealer, blush,
  bronzer, lip) of product lines from brands that pass the user's
  strictness setting, each with why it fits and a link to that brand's own
  shade finder. Answers stay on the phone.
  (2026-11-11, Jose: the routine suggests brands per step, not named
  products; we hold no sourced product data. "Why it fits" uses strictness,
  budget, vegan and what the brand sells.)
- **Learn.** Cruelty-free vs vegan, PETA vs Leaping Bunny, parent
  companies, China today. Done when every answer links a primary source.

- **Launch show** (added 2026-11-11). A short stage reveal for the bunny,
  in the style of a game's character reveal: a gate ("Enter with sound" /
  "Enter quietly"), an empty stage under a spotlight, close-ups (the
  lipstick twisting up, ears in silhouette against a bright door, the paws,
  the face), one flash, the hero pose with hearts and the name card, then
  the bunny lands on Home's logo. Pink after dark; music made in code.
  Every launch; Skip and a tap skip it; `?intro=0` skips, `?intro=1`
  forces; never on a link to one brand. Profile: "Play the opening when
  the app starts" switch and "Replay the opening". Not in this version: a
  shorter cut for later launches, rendered video, voice-over, haptics.
  - Done when: the gate shows on every launch, both buttons play the show
    and land on a working Home in under 7 s, Skip works at any moment, and
    `?intro=0` skips it.

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

Product-type filter, once product data tells brands apart (quiz phase).

Prices for the 10 brands whose sites block automated readers (e.l.f.,
Too Faced, Urban Decay, Kosas, Juvia's Place, NYX, Maybelline, L'Oréal
Paris, Estée Lauder, Benefit): checked by hand, or by the founder.

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
- [x] Price for 20 brands and store links for 28 from the brands' own
      sites (done 2026-11-11; the other 10 sites block automated readers)

### Phase 3: Directory
- [x] Brand list, search, filters, strictness switch (2026-11-11)
- [x] Brand page and where to buy (2026-11-11; Kosas and Juvia's links
      come from their sites but can't be opened from the cloud environment)

### Phase 4: Beauty profile
- [x] Quiz, profile, suggested routine (2026-11-11; brands per step)

### Phase 5: Scanner and saved list
- [ ] Barcode scan (Open Beauty Facts for barcode to brand; a code
      library for iPhone, which has no built-in barcode reader)
- [ ] Saved list on the phone

### Launch show (added 2026-11-11, after phase 4)
- [x] New bunny logo (sitting, hugging a lipstick, hearts) and icons
- [x] The gate, the shots, the music, skip, the landing on Home's logo
- [x] Profile switch and replay

## Open questions (TO FILL)

- The founder's name (stays out of the repo until Jose fills it in).
- 1 to 3 websites whose look the founder likes (for DESIGN.md).

## Decided

- 2026-11-11 (Jose): the launch show is "too simplistic". Version 2 is to
  be glamorous and close to the Star Rail reveal: real animated video
  (key art animated by a video model, Runway credits bought by Jose, so the
  $0 budget doesn't apply to this piece), about 20 seconds. Version 1 stays
  as the fallback. Plan and research: `HANDOFF.md`.
- 2026-11-11 (Jose): a launch show, built now, styled on a game's
  character reveal (the video he sent) and his other apps' intros. The new
  logo is our own redraw of his bunny picture (sitting, hugging a
  lipstick, hearts). Pink after dark, not the video's purple. Full show on
  every launch. A tap first, then the show with sound. Founder to see the
  logo and the show.
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
  with a note (replaces "not confirmed for Strict"). Founder approved
  2026-11-11, with the labels "Passes" / "Doesn't pass" / "Not on either
  list".
- Paid or affiliate links: ever?
