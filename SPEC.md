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
  Browsing lists only brands that pass, each row naming its certifier; a
  brand that doesn't pass appears only when searched or scanned, with the
  reason (founder, 2026-11-11).
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
  shorter cut for later launches, voice-over, haptics.
  - Done when: the gate shows on every launch, both buttons play the show
    and land on a working Home in under 7 s, Skip works at any moment, and
    `?intro=0` skips it.
  - **Version 2, the film** (remade 2026-11-12, second time: Jose's vision
    of what the app is for). A rendered 13.8-second film
    (`assets/video/launch.mp4`) set at a vanity in a warm, glamorous
    dressing room: a lipstick close-up; a woman (a stylised character of
    the founder) turns it over, curious, and "Was this tested on animals?"
    appears; she checks it with her phone; a card says "Doesn't pass" with
    the brand and its parent company on separate lines and "See why"; a
    second card, "Try instead", "Passes", slides in and her tap selects
    it; a pink heart rises from the phone into a sunlit garden of
    comfortable, playful animals and becomes the rabbit ("Beauty that's
    kind to them."); back at the vanity she wears the lipstick, sets her
    phone down and the rabbit nudges her hand ("Cruelty-free looks
    beautiful on you", then the button "Find cruelty-free makeup").
    The garden is a symbol of compassion: no cage or rescue is shown, and
    nothing says one purchase saves an animal. Every word, the phone and
    its cards are real text over the film; the cards are marked "Example"
    and name no product or brand. A voice in English with a Latina accent
    speaks her thoughts; it reads fully with the sound off. It plays on
    the first visit only and from "Replay the opening" in Profile. (If the
    film was only slow to load and the drawn show played instead, the
    next visit tries the film again.) On a screen wider than a phone the
    film is a centred column, not a crop. When it
    ends, the last frame holds with the button; the button, or 3 seconds,
    opens Home. The drawn show (version 1) plays instead when the film
    can't start within 0.8 s of the tap, on reduced motion, or with data
    saver on. If the film breaks or freezes for 1.5 s, the app opens at
    once. "Enter quietly" plays it muted. On a computer the film is a
    centred column. The offline worker saves the film once it has played.
    Not in this version: a widescreen cut, a tappable "See why", real
    products on the cards, Spanish.
    - Done when: on a first visit one tap on the gate plays the film with
      each line of text on its beat, the two cards readable inside the
      phone, and the button opens Home; a second visit goes straight to
      Home; Skip reaches Home in under 1.5 s at any moment; with the film
      blocked, version 1 lands on Home in under 7 s. Not yet checked on a
      real iPhone, and the voice and music mix was placed by measurement,
      not checked by ear by Claude (Jose to listen).
- **What changed** (founder's ask, 2026-11-11). When a recheck finds that a
  brand's PETA, Leaping Bunny, parent company or China status changed, the
  app says so the next time it is opened: a card on Home (brands the person
  hearted first), a line on the brand's page, and "Recent changes" under
  the Brands list for 12 months. The words say only what the list showed on
  the date we looked ("No longer in Leaping Bunny's guide"), never why, and
  good news shows too. Changes live in `data/brands.json` ("changes") and
  go live only through the recheck pull request Jose reads.
  A first finding (from "unknown") says "Newly confirmed", not "now". The
  date shown is when we checked, not when the list changed. The compare
  tool covers PETA and Leaping Bunny; parent and China changes are entered
  by hand. An installed app shows a change one or two opens after the
  update, because of how the offline worker swaps versions.
  - Done when: a change added to `data/brands.json` shows on Home once the
    app has updated, with its date and source link, hearted brands first; "Got it"
    hides it and it stays in "Recent changes" and on the brand page.

- **The Garden** (added 2026-11-12, planned, not built). A study game: an
  open sanctuary garden in 3D that grows with what the person learns. Five
  habitats, one per topic: Meadow (cruelty-free or vegan), Burrow hill
  (PETA or Leaping Bunny), Old oak (parent companies), Pond (China today),
  Orchard (read a brand). Rounds of 5 questions; a missed question comes
  back sooner than a right one (5 minutes, then 1, 3, 7, 16, 35 days); "I
  guessed" counts as a miss. About 40 written questions come from the
  Learn answers, each with its source and checked date, written by one
  helper and checked against the source by another. The Orchard's
  questions are built from `data/brands.json` each time, never stored, and
  skip a brand whose check is over 90 days old. A habitat goes from bare to
  blooming and animals move in as its topic is learned. Progress stays on
  the phone (`cfb-garden`).
  Rules: no fences, cages or enclosures; nothing ever dies, leaves or looks
  sad; the garden grows only from learning, never from scanning, saving or
  buying; the words are "moved in" and "at home here", never "rescued" or
  "saved"; no certifier's mark in the scene. The 3D loads only when the
  Garden is opened, and plain habitat cards show instead where 3D can't
  run (no WebGL, reduced motion, data saver).
  Not in this version: walking around, feeding or petting, naming animals,
  streaks, reminders, an exam mode, sharing, Spanish, sound.
  - Done when (the quiz): a round of 5 can be played from Home, each
    answer shows right or wrong with its source and date, a missed question
    comes back sooner than a right one, and progress survives a reload and
    works offline.
  - Done when (the 3D garden and its animals): learning a topic visibly
    changes its habitat and brings in a resident; tapping a habitat starts
    its round; Home, Brands and Scan load no 3D code; the Garden opens
    offline after one visit; with 3D blocked, the cards show instead.

## Not in v1

- Camera skin or undertone analysis (lighting makes it unreliable; face
  photos are biometric data).
- Exact shade matching across brands (no free shade data).
- Reviews, photo uploads, accounts, sign-in.
- Store stock or "near me".
- Notifications while the app is closed, or by email (they need a push or
  mail service; the in-app "What changed" notice is in v1).
- An app-store app.
- Skincare, hair and household products.
- Paid or affiliate links (undecided; the data has a link-type field so
  they can be added later, always disclosed).

## Later

Product-type filter, once product data tells brands apart (quiz phase).

Prices for the 10 brands whose sites block automated readers (e.l.f.,
Too Faced, Urban Decay, Kosas, Juvia's Place, NYX, Maybelline, L'Oréal
Paris, Estée Lauder, Benefit): checked by hand, or by the founder.

Notifications while the app is closed, Spanish (EN | ES switch
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

### Phase 5: Scanner and saved list (done 2026-11-11)
- [x] Barcode scan (Open Beauty Facts for barcode to brand; a code
      library for iPhone, which has no built-in barcode reader)
      Done when: scanning a real Maybelline barcode shows "Doesn't pass"
      (Strict) with a link to its proof; a barcode Open Beauty Facts doesn't
      know asks which brand is on the box.
- [x] Saved list on the phone
      Done when: a brand saved from its page or a scan shows on Profile
      after a reload and offline.

### Launch show (added 2026-11-11, after phase 4)
- [x] New bunny logo (sitting, hugging a lipstick, hearts) and icons
- [x] The gate, the shots, the music, skip, the landing on Home's logo
- [x] Profile switch and replay
- [x] Version 2: the rendered 20-second film, with version 1 as the
      fallback (2026-11-11)
- [x] Version 2 remade as the founder's rescue story: 24 seconds, the
      Welcome frame, the logo and icons redrawn as the film's hero
      (2026-11-12)
- [x] Version 2 remade again as the vanity story with voice, text cards
      and the button; first visit only; new Home line (2026-11-12)

### What changed (added 2026-11-11, the founder's ask)
- [x] `changes` list in the data, checked by `check-brands`
- [x] Home card, brand page line, "Recent changes" under Brands
- [x] `lookup-certifiers --diff` prints what looks changed, for a person
      to confirm

### The Garden (added 2026-11-12)
- [ ] Look sample and one test animal approved by Jose and the founder
- [ ] Phase A: question bank, rounds, progress, habitat cards
- [ ] Phase B: the 3D garden, loaded on demand
- [ ] Phase C: the animals (Meshy, Jose's credits) and their motion

## Open questions (TO FILL)

- Has the founder seen and accepted the Garden (a study game in her app)?
  Jose to show her the look sample.

- Does the founder accept the neutral wording ("No longer in Leaping
  Bunny's guide", never "dropped")? Jose to ask.

- The founder's name (stays out of the repo until Jose fills it in).
- 1 to 3 websites whose look the founder likes (for DESIGN.md).

## Decided

- 2026-11-12 (Jose, buttons): a study simulator like his CPA and CCHI
  apps. He asked for a zoo; after Claude's objection (enclosures, and the
  film's "no cage" rule) he chose an open sanctuary garden, grown by a new
  quiz bank and not by using the app, in full 3D loaded on demand. Meshy
  and other credits are his and OK'd for this, over the $0 budget. Plan
  approved the same day; the founder has not seen it.
- 2026-11-12 (Jose): a new direction for the opening, replacing the
  rescue film the same day. The app helps people buy makeup that is
  cruelty-free, and the opening should show that: love of makeup, a moment
  of concern, the app as the turning point, a cruelty-free alternative, a
  hopeful garden, her and the rabbit together. It must not suggest that
  one purchase rescues an animal. Jose's picks: the woman is the founder
  as a stylised character (painted from a written description; the softer
  look was preferred over one painted from her photo); dusk dressing-room
  lighting; about 12 seconds; first visit only with Replay; the closing
  line "Cruelty-free looks beautiful on you" replaces "Cruelty free looks
  best on skin." on Home too; the first card says "Doesn't pass" with a
  reason; voice "la" (a young Latina-accented English voice), made
  through Runway. The Profile switch is gone (the opening no longer plays
  at every launch). The founder had not yet seen this version when it was
  built: Jose to show her.
- 2026-11-12 (Jose, buttons): the remade film is 24 seconds, all eight
  beats. Frames 2 and 3 of the storyboard were repainted first (a neater
  cape, a visible eyeliner pencil).
  Music: take B of two (harpsichord and music box in the lab, then the
  dembow beat), picked by ear. Icon tile: white to ivory. The arrival
  shot's wide cape flap stays (Claude offered a retake).
- 2026-11-11 (the founder, through Jose): the pink stage film "isn't me".
  The film is now her own story: a dark, slightly gothic lab; the hero
  frees the animals with eyeliner, mascara and lipstick; they walk into the
  light; the show in white and gold; the hero turns into the app logo with
  "Welcome" underneath. She approved the storyboard; Jose approved
  rendering it and changing the logo and icons to the new bunny. Jose
  asked for the cape to be "based on" PETA's Approved logo: only its
  colours and line were used; the mark itself must never appear.
- 2026-11-11 (Jose, buttons): the film plays in full, 20 seconds, on every
  open (Claude recommended the full film once and a short ending after;
  Jose chose every open). The music has a Puerto Rican feel, "think of Bad
  Bunny": the reggaeton take, picked by ear over a plena and salsa take.
  The 5-second test clip was approved before the rest was made.
  The founder saw the finished film and liked it (Jose, 2026-11-11).
- 2026-11-11 (Jose): the launch show is "too simplistic". Version 2 is to
  be glamorous and close to the Star Rail reveal: real animated video
  (key art animated by a video model, Runway credits bought by Jose, so the
  $0 budget doesn't apply to this piece), about 20 seconds. Version 1 stays
  as the fallback. (Built the same day; the handoff file is gone.)
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
- 2026-11-11 (Jose): phase 5. The scanner replaces the "Where to buy" Home
  tile, plus a scan button beside the Brands search. A brand we haven't
  checked gets "We haven't checked it yet" and links to search PETA and
  Leaping Bunny, never a verdict from memory, and is noted on the phone.
  Saved brands show on the Profile screen. Reader: `barcode-detector`
  (MIT, zxing-wasm reader), saved in the repo, used only where the phone
  has no built-in reader. Open Beauty Facts covers our brands thinly, so
  typing the brand is part of the main flow.
- 2026-11-12 (Jose): Home takes the Interpreter Hub's layout in C.F.B.'s
  own colours: a photo hello banner with the bunny and a speech bubble,
  four pin tiles, a sideways rail of brands that pass. Sample Home first;
  the founder still has to see it, and the bubble's words ("Shopping
  today? Scan it first.") are hers to approve. Same day, on Jose's "keep
  going": pins in the tab bar and side rail, and My beauty profile with a
  hero panel, the summary as chips, and a pin on each routine step. No
  words of the profile changed. Art: Runway, Jose's credits (44 used),
  which he OK'd over the $0 budget for this. Not in main until the
  founder has seen it.
- Paid or affiliate links: ever?
