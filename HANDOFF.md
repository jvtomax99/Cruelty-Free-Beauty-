# HANDOFF: more of Home's host (the girl)

Written 2026-11-13. Delete this file when its work is done.

## Goal

Jose approved the animated girl on Home's banner ("She is perfect") and
asked to give her more: **more lines, more moves, more places**. The plan
below is a proposal. It is NOT approved yet: get Jose's OK before any code.

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

## Proposed plan (needs Jose's OK)

**What it does.** She becomes the app's host instead of one picture.

- *More lines.* Her bubble on Home picks one line from what the phone
  already knows, each linking to the matching screen: no profile yet (the
  quiz), unseen changes to a hearted brand (What changed), Sanctuary
  questions due (Practise), a recent scan (that brand), otherwise a
  time-of-day line pointing to Scan. All from existing `cfb-` keys; no new
  stored data. She never words a verdict: only `CFB.verdict` does.
  The lines speak for the founder's brand, so Jose signs off the list.
- *More moves.* Two new clips: a wave when Home opens (once per visit) and
  a happy reaction when she is tapped. About 52 credits each, 104 in all.
  Each strip is about 400 KB, so new moves load after the page, not in the
  worker's install list.
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

**Order.** 1) lines on Home (no credits), 2) the two moves, 3) the other
places. Each is its own pull request with screenshots.

## Left to do

- Get Jose's OK on the plan (or his changes), then add it to `SPEC.md`
  (it is outside the current spec) before coding.
- Draft the lines for Jose to sign off.
- `tools/make-host.py`: take an output path.

## Files to read first

`CLAUDE.md`, `SPEC.md`, `docs/ARCHITECTURE.md`, `DESIGN.md` (Hello banner),
`app.css` (`.hb`, `.hb-pal`, `.hb-host`, `hostPlay`), `index.html` (Home),
`tools/make-host.py`, `changes.js` and `home.js` (how Home reads `cfb-`
keys).
