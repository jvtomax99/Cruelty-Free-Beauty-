# HANDOFF: launch film, waiting on the founder

Written 2026-11-11. Branch `claude/cruelty-free-app-intro-y05sfl`, pull
request #10 (open, ON HOLD, do not merge).

## Goal and exact next step

The 20-second launch film (stage show, pink) is built, reviewed and in PR
#10. Jose stopped it: the founder said "the pink background and bunny isn't
me", wants white, and Jose then asked for a second mock: "more dramatic,
cute, something about saving animals from makeup cruelty, the bunny is the
hero".

**Mock 2 ("The Rescue") is cancelled (Jose, 2026-11-11, evening).** The
stage show stays as the film. Still open, ask Jose with buttons: does the
stage film stay pink (merge PR #10 as it is), get a free white regrade, or
get remade on a white set (about 600 Runway credits; 1,478 left)? He also
asked once whether the bunny's cape could be purple (a preview was shown);
the cape only existed in mock 2, so confirm whether he wants one on the
stage bunny.

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
- Mock 2 storyboard (cancelled, kept only for reference), seven frames, made on Meshy (image-to-image,
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
