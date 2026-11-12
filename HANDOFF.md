# HANDOFF: launch film, waiting on the founder

Written 2026-11-11. Branch `claude/cruelty-free-app-intro-y05sfl`, pull
request #10 (open, ON HOLD, do not merge).

## Goal and exact next step

**The founder loved storyboard version 5. Jose, 2026-11-11 late: "Let's
render it and make the changes. Including the app cover and the updated
mascot."** That is the go-ahead to animate (Runway credits, 1,478 left,
budget about 800) and to change the app's logo and icons to the new bunny.

Nothing has been rendered yet: Runway's connector failed in the old chat
all evening ("Unsupported protocol version", then disconnected). **First
step in the new chat: call Runway `whoami`.** If it still fails, Jose
reconnects Runway at claude.ai/customize/connectors.

Her story, in her words:

> "You can start at the lab where is it dark and a little gothic and the
> hero arrives using different makeup like eyeliner, mascara, and lipstick
> to unlock the cages and free all the animals. They all walk to the light -
> the surroundings should start to get lighter to fit the theme of freedom
> and then you see all the animals and the hero at the concert/ show like
> in the first video and the hero holds the lipstick. Then the hero with
> lipsticks turns into the app logo and you see a "Welcome" underneath"

### Build list, in order

1. **Fetch the approved frames** from Meshy (they are the look she said
   yes to; 768 by 1344, enough for 720p video):
   `GET https://api.meshy.ai/openapi/v1/image-to-image/<id>` then download
   `image_urls[0]`.
   - 1 gothic lab `01a1cc66-9d8e-7284-be8a-8c129b38b634`
   - 2 hero arrives `01a1cc79-a220-756d-8523-ec32b24bf45b`
   - 3 eyeliner `01a1cc79-a1f8-7542-be30-564f6f79049c`
   - 4 mascara `01a1cc7a-2be2-73f8-a2d3-0e248fba4cce`
   - 5 lipstick, all free `01a1cc79-a206-7760-85e1-11f2e52c3ed0`
   - 6 into the light `01a1cc79-a1fd-70c7-8aad-b29e7afd9a62`
   - 7 the show (white and gold) `01a1cc7a-2c1c-76db-af85-8536b475c019`
   - 8 Welcome stage background with the hero `01a1cc7b-0e19-77fc-9158-bc70a7c78860`
   - the hero alone on ivory (the character reference) `01a1cc78-9d31-71c2-81f6-5c8a823f5cea`
   Repaint two before animating (Meshy image-to-image, `nano-banana`, the
   hero reference, 3 credits each): frame 3 must show the eyeliner pencil;
   frame 2's cape flares too wide.
2. **The hero's look, fixed:** round glossy white bunny, closed happy eyes,
   tiny w smile, blush cheeks; one small pearl tiara, centred and straight
   (no second crown); a soft pink satin cape with a dark brush-stroke edge
   and a pink heart clasp; the lipstick has a dark charcoal tube and a rose
   bullet. Cape idea came from PETA's "Approved" logo, which must NOT
   appear (their licensed mark; DESIGN.md bans it): colours and line only.
3. **Animate** each frame on Runway (upload with `init_upload`, then
   `generate_video`, kling-4, 720p, 9:16, start frame; that model kept the
   bunny on-model in film 1). Proposed cut, about 24 s (Jose has not
   confirmed 24 against 20; she approved all eight beats, so do not drop
   one without asking): lab 3, arrive 3, eyeliner 2.5, mascara 2.5,
   lipstick 3.5, walk 3.5, show 3.5, Welcome 2.5 plus the hold.
   Flash-cut bursts as in film 1 are optional.
4. **Music:** new take at the film's exact length (Runway music,
   `eleven-music-v2.5`, instrumental): Puerto Rican reggaeton as chosen
   (task `cad9af60-db36-4722-ba6f-66ab57fa98cd` is the old 22 s take), now
   a tense gothic pulse for the lab, the dembow beat dropping when the
   lipstick frees everyone, full chorus at the show, a bright chime on
   Welcome. Jose picks by ear.
5. **Cut** with `tools/make-launch-video.sh` (edit its shot table and
   length; the ending is now white, so the closing flash colour and
   `intro.js` handover change). Keep the file near 5 MB; flag it if over
   (docs/assets.md). Bump `MEDIA` in `sw.js`.
6. **The Welcome frame** is real text over the film's last shot, replacing
   the night name card: the spec is below. New tokens go in DESIGN.md.
7. **The updated mascot and app cover:** redraw `assets/logo.svg` as the
   new bunny (add the pearl tiara and the pink cape with the dark edge and
   heart clasp; keep every existing part id, `intro.js` animates them), then
   remake the icons with `tools/make-icons.cjs` and check the manifest.
   Jose asked for this ("app cover and the updated mascot"). Not yet
   decided: the icon tile's colour. She said the pink "isn't me" and "don't
   lose the white", so propose a white or ivory tile and show it before
   merging. A rough flat sketch exists only in the old chat.
8. **The landing:** with the logo redrawn, the rendered hero can turn into
   the flat logo and fly to Home as in film 1 (her "turns into the app
   logo"). The drawn show (version 1, the fallback) then also stars the
   new logo; check it still looks right on its pink night stage or simplify
   it.
9. Update `tools/test-intro.cjs` timings for the longer film, run all four
   test suites and the site check, reviewer subagent, update PR #10's
   title and body, add the retry to the workflow's browser install, merge
   when green per the standing rule, notify Jose with the undo line.
10. SPEC.md: rewrite "Version 2, the film" for the rescue story and record
    the decisions below.

### Decisions (2026-11-11, to copy into SPEC.md)

- The stage-show film (pink) was built and reviewed, then stopped: the
  founder said the pink background and bunny "isn't me".
- The film is now her rescue story, ending on the show and a Welcome.
- Hero look as in item 2. Jose asked for a tilted tiara, then dropped it.
- Welcome frame: white stage with gold script (spec below).
- Film plays in full on every open; reggaeton score; "Enter quietly" mutes.
- Jose approved rendering and changing the logo and icons.

### Welcome frame spec

A bright white stage (sheer white curtains, a ring of gold bulbs behind
the hero, white spotlight, gold glitter). Text over a white veil across
the bottom 46% of the screen: "C.F.B. PRESENTS" in Inter 600 small
capitals, tracked .34em, 10.5 px, dark gold #9A6B14; "Welcome" in Fraunces
italic 500, about 66 px on a 384 px wide screen, gold foil gradient
#8A5E12, #C99A3A, #F4DC9A, #C99A3A, #8A5E12; a thin gold rule with a
diamond; the slogan in Fraunces 16 px with "best on skin." italic in
#B4586A. The foil's pale middle is low contrast on white: check on a
phone and deepen it if hard to read.

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
