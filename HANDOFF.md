# HANDOFF: launch film, waiting on the founder

Written 2026-11-11. Branch `claude/cruelty-free-app-intro-y05sfl`, pull
request #10 (open, ON HOLD, do not merge).

## Goal and exact next step

The 20-second launch film (stage show, pink) is built, reviewed and in PR
#10. Jose stopped it: the founder said "the pink background and bunny isn't
me", wants white, and Jose then asked for a second mock: "more dramatic,
cute, something about saving animals from makeup cruelty, the bunny is the
hero".

**The founder has given the story herself (2026-11-11, evening). Mock 3
is her version and replaces mocks 1 and 2 as the direction:**

> "You can start at the lab where is it dark and a little gothic and the
> hero arrives using different makeup like eyeliner, mascara, and lipstick
> to unlock the cages and free all the animals. They all walk to the light -
> the surroundings should start to get lighter to fit the theme of freedom
> and then you see all the animals and the hero at the concert/ show like
> in the first video and the hero holds the lipstick. Then the hero with
> lipsticks turns into the app logo and you see a "Welcome" underneath"

A storyboard of it (8 frames: gothic lab, hero arrives, eyeliner, mascara,
lipstick, into the light, the show, logo with "Welcome") was painted on
Meshy and sent to Jose, then repainted with the hero look Jose chose: a
soft pink cape with a black brush-stroke edge, a pink heart clasp, and a
gold tiara. Jose first asked for it tilted to one side, then (same
evening) said to drop the side tiara: one small pearl tiara, centred and
straight. Frame 8 is now the rendered hero holding its lipstick on plain
ivory with "Welcome" under it (Jose picked this over a redrawn flat
logo). The whole storyboard was then repainted (version 4) with that
rendered bunny as the reference for every hero frame; the stage shot is
white and gold. The frames live only in the session scratchpad and on
Meshy (image-to-image tasks of 2026-11-11); repaint them at 2K on Runway
as key art before animating, using the Welcome bunny as the reference. Open: the film then lands on Home's flat logo, which has no cape
or tiara, so either the app logo is redrawn to match or the landing is
replaced by a fade. The reference for that look
is Meshy task for "cape-a" (hero on the rock). Jose asked for the cape to
be based on PETA's "Approved" logo: refused, because it is PETA's licensed
certification mark and DESIGN.md bans it; the cape only borrows its pink,
black line and white. Still Claude's guesses: the show relit in white and
gold; "Welcome" as real text under the drawn logo, replacing the name
card. The logo frame is still the pink app logo.

**Next step: Jose shows her the storyboard and brings back her OK or
changes.** Then animate (about 700 to 800 Runway credits for 8 shots;
1,478 left; Runway must be reconnected first). Eight beats do not fit 20
seconds comfortably: propose about 24 seconds, or drop one makeup beat.

## What exists

- PR #10: film v1 of the stage show (`assets/video/launch.mp4`), the film
  player in `intro.js`, the worker's film cache, 47 checks in
  `tools/test-intro.cjs` (all pass locally, with scan, profile and
  directory). Main (phase 5) is merged in; worker cache `cfb-v13`.
- The player does not care what the film shows. A new film only needs:
  20 s, 720 by 1280, last 1.15 s a held flash (see
  `tools/make-launch-video.sh`), then bump `MEDIA` in `sw.js`. If the new
  film ends on white, change the flash colour in the script and check the
  handover to the drawn logo (it is drawn for a dark stage).
- Mock 2 storyboard, seven frames, made on Meshy (image-to-image,
  `nano-banana`, the stage test frame as the bunny reference, 3 credits
  each). Re-download with
  `GET https://api.meshy.ai/openapi/v1/image-to-image/<id>`:
  1 lab at night `01a1cc3c-df3c-7003-830b-2ce62c99e314`,
  2 hero lands `01a1cc3c-dee9-71fd-a49d-125ee08ff247`,
  3 locks open `01a1cc3c-df10-7054-83a7-3bc39b6b377c`,
  4 out to the light `01a1cc3c-df3e-76b4-8260-344d1a4602f7`,
  5 free in the meadow `01a1cc3c-dfa4-7154-92d9-0b454d925505`,
  6 hero shot on the rock `01a1cc3c-2c3a-702a-860a-7d4cdc9487c3`,
  7 portrait for the name card `01a1cc3c-df47-7517-8d0f-4b7c22d2c70b`.
  To animate them, upload each to Runway (`init_upload`) as a start frame.
- Free white regrades of the stage film (white light, hint of rose, white
  and gold) were shown too: `ffmpeg -vf hue=s=0.03` and similar. They keep
  the dark background and grey out the lipstick.

## Decisions this session (also in SPEC.md)

- Film plays in full on every open. Reggaeton score (Runway music task
  `cad9af60-db36-4722-ba6f-66ab57fa98cd`).
- 2026-11-11: production stopped for the founder's changes. Not yet in
  SPEC.md: add the outcome once she has chosen.

## Open problems

- Runway's connector refused every call late in the session ("Unsupported
  protocol version"). Jose: reconnect it at claude.ai/customize/connectors,
  or use a new chat. Check with `whoami` first.
- GitHub's site check on PR #10 failed twice installing its browser (the
  runner could not reach Ubuntu's package server); the check itself never
  ran. Add a retry to "Install the browser" in
  `.github/workflows/site-check.yml` with the next push.
- Not checked on a real iPhone. CREDITS.md price is TO FILL.
- If pink is not her, the app's blush theme and pink logo outline are the
  bigger question. Ask her.

## Files to look at first

`intro.js` ("the film" block), `sw.js`, `tools/make-launch-video.sh`,
`tools/test-intro.cjs`, SPEC.md "Version 2, the film".
