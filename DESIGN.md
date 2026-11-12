# DESIGN.md: C.F.B. look

Soft luxury: blush, cream, nude, cocoa. Warm and calm, like a good
makeup counter, never loud. Every value lives as a token in `:root` at the
top of `app.css`; change it there and here together.

Written 2026-11-10 from the founder's pick ("soft luxury") with no
reference sites yet. When the founder names 1 to 3 sites, run the taste
skill on them, save the output in `docs/design/`, and fold extra touches in
here.

## Colour

| Token | Value | Role |
|---|---|---|
| `--bg` | #FBF6F2 | Cream page |
| `--paper` | #FFFCFA | Raised surfaces (cards, search, Learn rows) |
| `--blush` | #F6E4E0 | Tiles, soft fills, pressed rows |
| `--blush-2` | #F0D2CE | Pressed tiles, the active tab |
| `--pink` | #EFA9AE | Icon colour blocks only, never text |
| `--nude` | #E4C3A9 | Accents in art |
| `--rose` | #9E4F62 | Accent text, links, focus ring |
| `--rose-ink` | #7E3A4B | Accent text on blush |
| `--ink` | #3B2A2A | Body text |
| `--ink-soft` | #6B524D | Secondary text |
| `--line` | #EBDCD6 | Hairlines, borders |
| `--focus` | #9E4F62 | Keyboard focus ring (3 px) |
| `--glass` / `--glass-line` | cream at 78% / line at 90% | Tab bar glass and its edge |
| `--rail-bg` | cream at 60% | Side rail on computers |
| `--scrim` | ink at 35% | Dims the camera view around the barcode frame |
| `--bunny-line` | #DB6B7E | The logo's outline |
| `--ok` / `--ok-bg` | #2E5A3C / #E3EFE4 | Cruelty-free: green words with a ✓ (6.7:1 on its fill) |
| `--no` / `--no-bg` | #9A3A2E / #F8E2DD | Not cruelty-free: red words with a ✕ (5.6:1 on its fill) |
| `--night`, `--night-2`, `--spot`, `--glow`, `--star`, `--halo`, `--veil`, `--spot-line`, `--night-glass` | see "Launch show" | The launch show only |

Measured contrast (WCAG, 4.5:1 needed for text): ink on cream 12.6,
ink-soft on cream 6.7, rose on cream 5.2, rose-ink on blush 6.6, ink-soft
on blush 5.8. No pure grey or black anywhere: neutrals lean warm.

A soft colour mesh (blush top right, nude bottom left) sits fixed behind
everything (`body::before`).

## Type

- **Headings:** Fraunces, a soft serif (variable, WOFF2 in
  `assets/fonts/`). Display italic in rose for the slogan's last words.
- **Everything else:** Inter (variable).
- Scale (`--fs-*`): 11, 12, 13, 15, 16, 17, 20, 22, 28, 34, 40 for the
  hello line, and 56 (`--fs-show`) for the launch show's name card. Body text is 16. Inputs are never under 16 (iPhone zooms).
- Weights: 450 (italic slogan), 500 (hello), 550 (labels, screen titles),
  600 (tile and card titles, wordmark).
- Letter spacing tightens as size grows (`--tr-sm`, `--tr-body`,
  `--tr-head`, `--tr-title`). Small capitals labels (the greeting) use
  0.12em.

## Space and shape

- Spacing `--sp-*`: 2 (`--sp-px`, icon to label in tabs), 6, 9, 13, 17, 26, 40.
- Sizes that aren't spacing: logo 44 (brand bar) and 96 (empty states),
  icons 22 to 32, tap targets at least 44, content 760 (phone) and 980
  (computer).
- Radius: `--r-sm` 10, `--r-md` 14, `--r-lg` 20, `--r-pill`. A rounded
  child inside a rounded parent takes the smaller radius (tile 20, its icon
  14).
- Phone: 17 px side gutter, 2-column tiles. Computer (900 px and up): side
  rail 248 px, content up to 980 px, 4-column tiles.

## Shadows

Every raised surface uses `--finish`, tinted cocoa, never black:

```css
0 1px 0 0 inset rgba(255,255,255,.82),
0 1px 2px rgba(59,42,42,.06),
0 8px 20px -12px rgba(94,52,58,.24);
```

Floating things (the tab bar) use `--float`, a deeper version. A pressed
tile drops to `--pressed`.

## Icons

Duotone, as in Interp: a soft pink block (`.ic-fill`) spilling past a
cocoa outline (`.ic-line`, 1.7 stroke). 24 px in rows and tabs, 32 px in
tiles.

## Components

- **Brand bar:** logo 44 px, "C.F.B." wordmark in Fraunces rose, "Cruelty-Free Beauty" under it.
- **Hello banner (Home, 2026-11-12, sample awaiting the founder):** the
  Interpreter Hub's banner in our colours. A dressing-table photo
  (`assets/images/home-banner.webp`) full width on phones (452 px tall), a
  radius-20 card on computers (380). The time-of-day label and the slogan
  at 40 sit top left in ink over a cream shade (`--veil-cream`), never
  white text. The bunny (84 px, a slow bob) sits bottom left with a paper
  speech bubble that links to Scan. The photo fades into the page at the
  bottom and Search overlaps it by 26 px.
- **Quick tiles:** four across, paper-to-blush, radius 20, bright rim
  (`--qt-edge`), a 52 px pin over a 13 px semibold label (64 px pin on
  computers). These replace the four big blush tiles on Home.
- **Rail:** a Fraunces 20 heading, a count, "View all" in rose, then
  cards that scroll sideways (156 px wide, paper-to-blush). A 48 px tile
  with the brand's initial pokes over each card's top edge where the Hub
  has a pin; never a brand's logo.
- **Pins:** glossy pictures in one family of materials only: white
  porcelain, blush enamel, rose gold, a touch of cocoa. 256 px WebP with a
  clear background, in `assets/pins/`. No rainbow of colours: that is the
  Hub's look, not ours.
- **Search:** paper, 52 px tall, hairline border, finish shadow.
- **Card:** paper with a hairline and the finish.
- **Tab bar (phones):** floating glass capsule, 56 px tabs, each a 28 px
  pin over its label (32 px in the side rail); the active one in blush-2
  with its pin a touch larger. **Side rail (computers)** replaces it.
- **Empty state:** the logo, a Fraunces line, one honest sentence.
- **Strict / Certified switch:** blush pill track, the chosen side paper
  with the finish (44 px tall).
- **Filter chip:** paper pill with a hairline, 44 px; on: blush-2 with
  rose-ink text.
- **Brand row:** paper card, radius 20, name in Fraunces 17, chips on the
  right, the reason it fails on its own line in ink-soft.
- **What changed:** a paper card on Home under the search bar, only when
  there is news; each change is a brand row with what the list showed, then
  the date and source link in footnote size; one hairline "Got it" button.
  On a brand page: a paper note with a 3 px rose left edge. No red, no
  warning icon: it reports, it doesn't accuse.
- **Verdict chip:** like the film (founder, 2026-11-12): Passes = ok-bg / ok
  with a ✓, one per certifier ("✓ PETA", "✓ Leaping Bunny") on a brand row;
  Doesn't pass = no-bg / no with a ✕; Not on either list = paper with a
  dashed ink-soft edge and no mark (unverified is not the same as testing).
  The words always say it, so colour is never the only signal.
- **Verdict box and fact lines:** the box takes the chip's fill, its title
  the chip's colour and mark. On a brand page each fact line is green with
  ✓ when it counts for the brand, red with ✕ when it counts against
  (PETA says it tests, parent tests, mainland China sales under Strict), and
  plain ink when unknown or not about animal testing (vegan, price).
- **Quiz:** one question per screen, Fraunces 22 question, 56 px paper
  answer cards (chosen: blush-2), a rose progress bar on blush, Back as a
  rose text button.
- **Profile hero:** a paper-to-blush panel with a blush glow top right,
  a small-caps rose-ink label, the mirror pin (84 px, slow bob), the
  summary as paper chips, undertone chips to change it by hand. Before
  the quiz it shows the five step pins in a row instead.
- **Routine step:** its 44 px pin beside the step name (Fraunces 17) and
  a blush count ("3 brands"); when every step gives the same brands, the
  five pins sit in a row under the one heading.
  Inside: a paper card like the fact card; brand name in Fraunces 17
  (links to its page), the reason in ink-soft, "Find your shade" link.
- **Save button:** paper pill with a hairline, heart icon and "Save";
  on: blush-2 with the heart filled pink, "Saved". Beside the brand name.
- **Scan screen:** the camera in a radius-20 frame with a paper aim box and
  a `--scrim` around it; rose "Start camera" button; the result is a paper
  card with the verdict box, "See the proof" (rose) and Save. Other ways in
  (photo, typed numbers) are the outline `.more` buttons.
- **Scan button (Brands):** a 52 px paper square beside the search.
- **Fact card (brand page):** small-caps rose-ink label, the status at 17
  semibold, then the source link and "Checked" date. Two columns from
  900 px.

## Motion

- `--ease` cubic-bezier(.2,.8,.2,1). Press .18 s, screen change .32 s.
- **Press on touch:** `:active` plus a JS `.is-pressed` class held 260 ms
  (`LIFTS` in `app.js`). Tiles shrink to .97 and deepen to blush-2. Every
  rule is written `X:active, X.is-pressed`.
- Entrance animations use `backwards`, never `both` (a held last frame
  would beat the press rule).
- Each screen keeps its own scroll position (like a phone's tab bar), and
  a screen change moves focus to its heading so screen readers announce it.
- Every animation has a `prefers-reduced-motion` guard; every control
  keeps `:focus-visible` (3 px rose ring).

## Logo

`assets/logo.svg` (redrawn 2026-11-11 from Jose's reference picture, our
own drawing; 2026-11-12 it became the film's hero): a white bunny sitting
on a pink shadow, hugging a lipstick (charcoal tube, pink bullet), closed
happy eyes, a "w" smile, blush cheeks, a small pearl tiara with a gold
band (#C99A3A), a soft pink cape (#F6C4CC) with a dark edge (#3E3537) and
a heart clasp, pale pink hearts around it. The app icons sit on a white to
ivory tile (#FFFFFF to #F7EFE6), not blush: the founder asked to keep the
white. Outline `--bunny-line` #DB6B7E, 3.05:1 on cream
(the 3:1 graphics minimum). Every part has an id (`ears`, `body`, `face`,
`eye-l`, `bullet`, `hearts`, `cape`, `tiara`, `collar`, `clasp`...): the launch show animates them, so keep the
ids when editing. Re-render the icons with `node tools/make-icons.cjs`. It
reads at 32 px. Never use PETA or Leaping Bunny marks anywhere in the app.

## Launch show (night)

The only dark screen in the app: "pink after dark", the soft luxury
palette under a spotlight. Tokens: `--night` #1C0F13 (the stage),
`--night-2` #3A1E27 (where the spot falls), `--spot` #FFE3E8 (light, text
on night, 15.4:1), `--glow` #F28DA0 (glow, the flash's edge), `--star` #FFF6F4 (the
name card's brightest text), `--halo` (pink at 60%, text and button glow),
`--veil` (night at 75%, the vignette's edge), `--spot-line` (outlines on
night) and `--night-glass` (buttons over the stage). Labels in
`--pink` (7.9:1 on night-2). The name card's "C.F.B." is Fraunces 600 at
`--fs-show` (56) with a pink glow; small-caps labels at 0.32em. Buttons:
52 px pills, the main one blush with rose-ink text and a pink glow, the
other an outline. The focus ring on night is `--pink`. Letterbox bars
(6vh, at most 56 px) frame the show like a film. Reduced motion: the
finished hero pose, held 1.6 s, then a 0.6 s fade.

The gate (2026-11-12, Jose: the dark spotlight stage "looks low detail
and doesn't scream glamorous"): the film's own frame at 0.6 s, the
lipstick held up before the bulb mirror (`assets/images/gate.webp`), so
the tap flows straight into the film. It drifts slowly (scale 1 to 1.06
over 14 s) and the glint on the lipstick breathes. Top: "C.F.B. presents"
in `--gold-pale` small capitals, then "Cruelty-Free *Beauty*" in Fraunces
500 at 34, `--star` with the italic in `--gold-pale`, and a short gold
rule. Bottom: two 56 px pills with a `--gold-pale` hairline, the main one
`--rose` with `--star` text, the other night glass. On a wide screen the
frame is a centred column with soft edges, like the film. The drawn stage
is still underneath as the fallback show.

The film (version 2, remade twice on 2026-11-12) is set in a glamorous
dressing room at dusk: bronze shadow, warm mirror bulbs, gold rim light,
ivory satin, marble, pearls, soft pink accents only; one sunlit garden
shot. No pink or plum wash. It fills a phone screen (cropped to fit, no
letterbox bars); on a wide screen it is a centred 9:16 column whose side
edges fade into the night stage. Every word is real text in `.in-over`,
which sits exactly on the film and sizes itself in the film's own units
(cqw), so phone and column lay out the same. Lines over the film are
Fraunces 500 with the second line italic: `--gold-pale` #F4DC9A on a
`--night-veil` shade over the dressing room, `--gold-deep` #8A5E12 with
`--berry` italic on a `--day-veil` over the garden. The phone is drawn in
CSS; its cards are `--paper` with a thin `--gold` edge, an "Example" tag,
the app's own chips ("Passes" green, "Doesn't pass" red), a label and a
Fraunces status line for brand and for parent company (green ✓ or red ✕), and "See why" in
`--rose`. The chosen card gets a `--pink` outline and a filled heart. The
button is `--rose` with a `--gold-pale` hairline, at least 56 px tall.
Skip stays top right throughout. Never show PETA's logo or bunny-ears
mark, real brand names, or a cage.

## Don'ts

- No pure black or grey; no `rgba(0,0,0,x)` shadows.
- No new colour, size, radius or shadow without a token here.
- No certifier logos, no real brand logos as decoration.
