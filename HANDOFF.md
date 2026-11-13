# HANDOFF: more of Home's host (the girl)

Written 2026-11-13. Delete this file when its work is done.

## Goal

Jose approved the animated girl on Home's banner ("She is perfect"), asked
to give her more (**lines, moves, places**; he approved "Build all three"),
and then, later on 2026-11-13, changed how she should move: **"I want her
to look 3D and expressive like Dr Smiley in the Interp hub."** The section
"Like Dr Smiley" below replaces the old step 2 (two canned video clips):
do not make those clips.

## Done (live, pull request #25, merge commit fe29c2b)

- The girl replaces the bunny in Home's hello banner: 160 px wide, her
  shoulders behind the Search field, a speech bubble that links to Scan.
- `assets/images/host.webp` is a strip of 39 frames (300 x 335 each,
  412 KB) that `app.css` steps through (`.hb-host`, `@keyframes hostPlay`:
  3.9 s of motion, 3 s of rest; none under reduced motion). No JavaScript.
- `tools/make-host.py <clip.mp4>` builds the strip from a clip of her on a
  flat backdrop (it keys the backdrop out).
- Runway spent on her so far: 76 credits. 642 were left afterwards.

## How she was made (repeat this for every new move)

1. The clean still: Runway task `079bae6c-b528-42cb-9c52-11a9a316c8f9`
   (her on a flat pale blue-grey backdrop, #C9D6E2, 1024 x 1024). Use it as
   the start AND end frame of every new clip so each move begins and ends
   on the same pose and can be chained with the idle loop.
2. A 4 s clip, 480p, 1:1, no audio, on Runway's cheaper Seedance 2.5 tier:
   52 credits. Prompt pattern: locked-off camera, she stays centred, the
   move, "returns to exactly her starting pose", flat uniform backdrop.
3. `python3 tools/make-host.py clip.mp4` (today it always writes
   `assets/images/host.webp`: give it an output argument first).

Cutting her out of the opening film itself does not work: her hair is
blurred into a brown stage backdrop there. Jose rejected that three times.

## The plan (approved by Jose, 2026-11-13)

**What it does.** She becomes the app's host instead of one picture.

- *More lines.* Her bubble on Home picks one line from what the phone
  already knows, each linking to the matching screen: no profile yet (the
  quiz), unseen changes to a hearted brand (What changed), Sanctuary
  questions due (Practise), a recent scan (that brand), otherwise a
  time-of-day line pointing to Scan. All from existing `cfb-` keys; no new
  stored data. She never words a verdict: only `CFB.verdict` does.
  The lines speak for the founder's brand, so Jose signs off the list.
- *More moves.* Replaced: see "Like Dr Smiley" below.
- *More places.* A small version of her (about 72 px, still frame, with a
  line) on: the Scan result, the end of the profile quiz, and the empty
  states (no saved brands, no scans yet).

**Who for.** The founder's shoppers: a friendly face that points to the
next useful thing.

**Not in the first version.** A name, a voice or audio, chat, her inside
the Sanctuary's 3D world, comments on single brands, more than one
appearance per screen.

**How similar apps do it (from memory, not rechecked today).** Duolingo's
owl has many poses and reacts to right and wrong answers; Finch's pet
changes with what you did that day; Headspace uses its characters in empty
states with no speech. Where C.F.B. can be better: her lines can carry
facts from the brand data and the phone's own history, each one a link to
the proof, so she is useful and never only decoration.

**Biggest risk.** Weight and noise. Three strips are over 1 MB, and a host
on every screen can crowd the proof the app exists for. Hence lazy loading
and one appearance per screen.

**Order.** 1) lines on Home (no credits), 2) the Dr Smiley-style rebuild,
3) the other places. Each is its own pull request with screenshots.

## Like Dr Smiley (Jose's two choices, 2026-11-13)

**What Dr Smiley is.** Public repo `jvtomax99/interp` (clone it read-only:
`drsmiley/*.webp`, `features/smiley-engine.js`,
`features/smiley-performances.js`, `docs/features/dr-smiley.md`). He is not
a video. He is one calm base picture (`base.webp`, head and shoulders, a
glossy 3D cartoon) with a strip of 30 face frames (`face.webp`: only the
eyes and mouth, shown through a small window over the base, swapped
outright, never faded), brows that are their own pictures and glide, and an
engine (`DrAnim`) with priorities that blinks at random, follows touch with
his gaze, leans, squashes and stretches, and plays short performances
(greet, laugh, love, surprised, sad, worried, doubt) from task states.

**Her look: "Same girl, more depth".** Keep the face Jose called perfect
(the clean still, Runway task `079bae6c-...`). Re-light her like Dr Smiley:
glossy hair, soft shadows, rounder shading, a warm rim of light, so she
comes off the banner. Do NOT change her proportions (he turned down "Dr
Smiley proportions"). Still on a flat backdrop so `tools/make-host.py`'s
keying works. Show Jose the new still before building on it.

**Expressive: "Full set like his".** Replace the 4-second loop with his
structure: a base picture, a face strip of about 16 frames (rest, blink
in-betweens and shut, wink, smile, laugh, love, surprised, sad, worried,
looks left, right, up and down), and a small engine of our own in a new
file: random blinks, eyes that follow a finger, reactions to taps, to a
scan result and to a quiz answer. Jose approved about 150 to 250 Runway
credits for this (642 were left). Ask before going over 250.

**Advice from making her so far.**
- Every face frame must sit on the same base, or her hair and outline
  jump. Dr Smiley's frames were fitted onto one face. Two ways to get that:
  image edits of the base that change only the eyes and mouth (check each
  against the base and re-fit), or one or two clips with her head held
  perfectly still and frames picked from them (clips keep the base
  consistent; the first clip here did, apart from a small head tilt).
- Port the idea, not the file: `smiley-engine.js` is 1,100 lines tied to
  the Hub. Ours should be a few hundred lines, one controller per picture,
  frame changes on the sequence's own clock (his notes explain why).
- Reduced motion: she stays on the rest frame. Data saver: no extra art.
- She reacts to a scan result, but never words a verdict: `CFB.verdict`
  does. A sad face on a fail is fine; a sentence about the brand is not.
- New art goes in its own folder (say `assets/host/`), in `CREDITS.md`,
  and into `sw.js` with a version bump.
- This is a big feature by `.claude/rules/general.md` (a new engine and a
  new set of art): write its "Done when" into `SPEC.md` first.

## Progress (2026-11-13, second session)

- Step 1 (lines) is live: pull request #26, merge commit 341983f.
  `host.js` holds `LINES`; Jose signed off the seven lines and chose the
  quiz line on every other day. Test: `node tools/test-host.cjs`.
- Jose confirmed step 2 is the Dr Smiley-style rebuild, not two clips.
  Its plan and "Done when" are in `SPEC.md` ("Plan for the moves").
- Jose picked re-lit **option A**: Runway task
  `f8da62eb-1d26-4c74-b5a5-e9b3cdd9f0e4` (1024 x 1024, same flat
  #C9D6E2 backdrop). Build the base picture and every face frame on it.
  (Option B, `1fa1d2c1-...`, was turned down. 8 credits spent, 634 left.)
- Jose OK'd the moves plan as written in `SPEC.md` ("Build it"): no
  moving brows, head tilts or talking mouth in this version. Budget:
  about 60 credits of image edits (nano-banana-2.1 at 1K is 4 each),
  52 more only if the fallback clip is needed; ask before going over 250.
- Next: step 2 (build it, one pull request, 390 px and 1440 px
  screenshots, reviewer, merge when green, notify), then step 3 (places).
- `jvtomax99/interp` clones read-only in a cloud session (public).

## Left to do

- Build in the order above, one pull request each, with 390 px and 1440 px
  screenshots; merge when the site check is green, then notify Jose.
- Step 3 (places): draft its lines for Jose to sign off.
- `tools/make-host.py`: take an output path.

## Files to read first

`CLAUDE.md`, `SPEC.md`, `docs/ARCHITECTURE.md`, `DESIGN.md` (Hello banner),
`app.css` (`.hb`, `.hb-pal`, `.hb-host`, `hostPlay`), `index.html` (Home),
`tools/make-host.py`, `changes.js` and `home.js` (how Home reads `cfb-`
keys).
