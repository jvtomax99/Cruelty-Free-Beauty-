# HANDOFF: more of Home's host (the girl)

Written 2026-11-13. Delete this file when its work is done.

## Goal

Jose approved the animated girl on Home's banner ("She is perfect"), asked
to give her more (**lines, moves, places**; he approved "Build all three"),
and then, later on 2026-11-13, changed how she should move: **"I want her
to look 3D and expressive like Dr Smiley in the Interp hub."** The section
"Like Dr Smiley" below replaces the old step 2 (two canned video clips):
do not make those clips.

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

## Progress (2026-11-13, third session)

- Step 1 (lines) is live: pull request #26, merge commit 341983f.
- Step 2 (moves) is built: `host-engine.js`, `assets/host/`, the new
  `tools/make-host.py <folder>` (takes the still and one edit per frame;
  the old clip-to-strip tool and `assets/images/host.webp` are gone),
  `tools/test-host-engine.cjs`. 14 frames, all image edits of option A
  (Runway task `f8da62eb-...`), 52 credits; 582 left. No clip was needed.
  The source PNGs lived in the session's scratch folder and are gone:
  the Runway account still has every edit, and CREDITS.md names the still.
- Decided while building, for Jose to confirm or change: reactions to a
  scan or a Sanctuary answer play when Home next opens (she is only on
  Home); a tap on her picture plays a face instead of following the link.

## Left to do

- Step 3 (places): a 72 px still of her with one line on the Scan
  result, the end of the profile quiz and the empty states. Draft the
  lines, get Jose's sign-off, then build (its own pull request). With
  her on the Scan result, think again about whether her face there
  should show the reaction at once (the plan says the small copies do
  not move).
- Delete this file when step 3 is merged.

## Files to read first

`CLAUDE.md`, `SPEC.md` ("Home's host"), `docs/ARCHITECTURE.md`,
`DESIGN.md` (Hello banner), `host.js`, `host-engine.js`, `app.css`
(`.hb-pal`, `.hb-host`, `.hb-face`), `tools/make-host.py`.
