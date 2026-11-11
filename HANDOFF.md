# HANDOFF: launch show, version 2 (glamorous, longer)

Written 2026-11-11. Branch `claude/cruelty-free-app-intro-y05sfl` (restarted
from main after PR #8 merged).

## Goal

Jose, 2026-11-11: "The intro is too simplistic. I want it glamorous, and
similar to the Star Rail video. Improve the animation and longer length. Use
any tools you need and do research."

Version 1 is live in main (PR #8): `intro.js`, flat SVG shots, 6.4 s, music
made in code. It stays as the fallback (offline before the new files are
cached, reduced motion, a failed load).

## Exact next step

Jose picks how to build it (asked with buttons at the end of the last chat;
his answers are under "Decisions" once given). Then: write the short plan in
plan mode, get his OK, build.

## What the research found

**The video** (`53089536-screen-recording-compressed.mp4`, a Honkai: Star
Rail character reveal; the cinematic is about 36 s and the recording plays
it twice). About 14 shots of 2 to 6 s, joined by bursts of strobing flash
cuts (several cuts inside half a second at 3.1 to 3.9 s, 22.1 to 23.2 s,
26.8 to 27.4 s). In order: black; feet walking on a stage with a long
shadow; a torso close-up with jewellery catching light; a mid shot walking
with crescent moons; a film-strip blur wipe; her face on a giant screen over
a crowd in silhouette; a silhouette against a blinding doorway; a heel on a
glowing platform edge; the same from below; a wide hero shot on a carnival
stage with fireworks; a seated portrait with gold confetti; a dress sweep; a
crystal-white figure with moons; a door opening onto a gold spotlight; a
dance turn; a billboard; the pose with fireworks; the final portrait. Every
shot is fully rendered 3D with bloom, rim light, depth of field and
particles. That, and the cut rhythm, is what version 1 lacks.

**Tools checked in this session**

- Runway (connected): every video and image model is available, but the
  account has 88 credits. Video costs 15.7 credits per second (kling-4,
  720p) to 30 (seedance-2.5, 720p), so 88 buys about 5 s. Images cost 4 to
  6 credits each (nano-banana-2.1).
- Runway's download host `dnznrvs05pmza.cloudfront.net` is blocked in the
  Default environment and my request to add it was rejected by the
  environments service. Jose has to add it under Allowed domains, or
  nothing Runway makes can be downloaded.
- Gemini key: image models have zero free quota (HTTP 429, limit 0). Lyria
  (music) not tested.
- Meshy: 1,080 credits (image to 3D model works from here; `api.meshy.ai`
  and `assets.meshy.ai` are allowed).
- This machine: 4 cores, no graphics card. `bpy` 5.3 installs from PyPI,
  but a 20 s Cycles render at phone size would take hours per attempt.

**One test frame made** (6 credits): Runway task
`2e18b618-bec3-4841-a192-1cf3e51d5ac9`, the bunny on a glam stage, 9:16,
2K. Not yet seen by Claude (blocked host). The logo reference is uploaded
as a Runway asset (re-upload `assets/logo.svg` rendered at 1024 px on a
pink background if the link has expired). The prompt that made it is in the
task.

## The three ways to build it

1. **Real animated video.** Key art of each shot (image model, logo as the
   reference), each animated by a video model, cut to the video's rhythm
   with ffmpeg, about 20 s, phone (portrait) and computer (landscape)
   files, played by `intro.js` like the Phillis start screen. Closest to
   the Star Rail look. Needs roughly 800 to 1,500 more Runway credits
   (bought by Jose) and adds about 4 to 6 MB to the offline download. Name
   card and slogan stay real text on top; the last frame flashes to the
   flat logo, which lands on Home as now.
2. **Painted key art, moved in code.** About 8 key-art frames from the 88
   credits Jose has, animated in the browser as layered 2.5D (camera
   pushes, parallax, light sweeps, glitter, strobe cuts). Glamorous stills
   with motion on top; the bunny itself doesn't hop or turn. About 1.5 MB.
3. **Live 3D.** A 3D bunny from Meshy (credits Jose has), shown with
   three.js like the CPA ride: real camera moves, the bunny hops and
   spins. Adds a 670 KB library; the lighting won't reach rendered video.

## Decisions

(to fill from Jose's answers)

## Files to look at first

- `intro.js` (version 1; its gate, skip, landing, focus and timer handling
  are reviewed and should be kept), the "Launch show" block in `app.css`,
  the head script and `#intro` markup in `index.html`.
- `tools/test-intro.cjs` (22 checks; the new show must keep them passing).
- `SPEC.md` "Launch show", `DESIGN.md` "Launch show (night)".
- `Phillis-bookshelves-/index.html` for how a rendered start video is
  played (loop, open clip, autoplay refused, data saver).
