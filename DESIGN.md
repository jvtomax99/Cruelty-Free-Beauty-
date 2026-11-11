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
| `--bunny-line` | #DB6B7E | The logo's outline |
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
- **Hello:** time-of-day label in small capitals, then the slogan at 40.
- **Search:** paper, 52 px tall, hairline border, finish shadow.
- **Tile:** blush, radius 20, icon top left, title (Fraunces 20) pinned
  low, subtitle in rose-ink 13.
- **Card:** paper with a hairline and the finish.
- **Tab bar (phones):** floating glass capsule, 52 px tabs, the active one
  in blush-2. **Side rail (computers)** replaces it.
- **Empty state:** the logo, a Fraunces line, one honest sentence.
- **Strict / Certified switch:** blush pill track, the chosen side paper
  with the finish (44 px tall).
- **Filter chip:** paper pill with a hairline, 44 px; on: blush-2 with
  rose-ink text.
- **Brand row:** paper card, radius 20, name in Fraunces 17, chips on the
  right, the reason it fails on its own line in ink-soft.
- **Verdict chip:** Passes = blush-2 / rose-ink; Doesn't pass = ink /
  paper; Not on either list = paper with a dashed ink-soft edge. The words
  always say it, so colour is never the only signal.
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
own drawing): a white bunny sitting on a pink shadow, hugging a lipstick
(charcoal tube, pink bullet), closed happy eyes, a "w" smile, blush cheeks,
white hearts around it. Outline `--bunny-line` #DB6B7E, 3.05:1 on cream
(the 3:1 graphics minimum). Every part has an id (`ears`, `body`, `face`,
`eye-l`, `bullet`, `hearts`...): the launch show animates them, so keep the
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

## Don'ts

- No pure black or grey; no `rgba(0,0,0,x)` shadows.
- No new colour, size, radius or shadow without a token here.
- No certifier logos, no real brand logos as decoration.
