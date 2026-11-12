# HANDOFF: Your Sanctuary, part 2 (animal behaviour and four more habitats)

Written 2026-11-12. Delete this file when its work is done. Branch
`claude/affectionate-knuth-2thai8`, pushed, no pull request, nothing live.
The founder has seen none of it; nothing merges before she has.

## Jose's ask (2026-11-12, his words shortened; do all of it)

1. Believable behaviour. Each rabbit on its own clock: resting, sniffing,
   grazing, grooming, exploring, short hops; breathing, blinking, ear
   turns, head moves; never in sync; feet grounded, no sliding; never
   through rocks, plants, water or each other. Movement has a purpose
   (clover, shelter, nearby activity, each other). Keep stillness.
2. Environment, restrained: flowers and leaves in one shared breeze, water
   flowing, ripples spreading on the pond, an occasional butterfly going
   flower to flower.
3. Camera: drag turns, pinch or scroll zooms, tapping a habitat moves
   closer, eased, keeping the selected animal in view; a tap is not a drag.
4. Tap an animal: its name, personality, a button. "Say hello" must show:
   turn to the camera, come closer, sniff. Touch and mouse.
5. Lessons improve habitats: more flowers, a better shelter, another
   animal. Never imply real donations or real rescues.
6. Four more habitats at the rabbit habitat's standard: willow pond (ducks
   and ducklings), orchard (guinea pigs), leafy garden (beagles), wooded
   meadow (deer). Each with its own land, planting, shelter and
   behaviours, joined by paths and water.
7. Phone overview readable: animals recognisable, trees not blocking
   important views, more detail as the camera nears; the close view is the
   same world.
8. Keep the look (cream panels, berry buttons, sage accents) and keep
   learning and shopping within reach.
9. Mobile speed: shared geometry, instanced plants, sensible shadows, less
   detail far away, quality that adapts to the device, no full-screen
   effects.
10. Verify the whole run: open, rotate, zoom, select a habitat, greet an
    animal, finish a lesson, get the improvement, reload and find it kept;
    narrow portrait and landscape.
11. Send screenshots of overview and close-up, and say which models or
    textures still need to be better.

## Done in this commit (work in progress, untested)

- **Five new models** in `assets/sanctuary/`: `duck`, `duckling`,
  `guinea-pig`, `beagle`, `deer` (Tripo, 100 credits; 475 left there;
  Meshy has 122, shared). They face +X, so they need a quarter turn
  (`yaw: -Math.PI / 2`, already in `SPECIES`). The deer has small antlers
  though none were asked for; the style is more cartoon than the rabbits.
  Not yet in `CREDITS.md`.
- **`sanctuary3d-life.js`** (new, never run): `SPECIES` (rig numbers are
  first guesses, not tuned), the soft skeleton (`rigMaterial`: a vertex
  shader that turns head, ears, legs and tail about pivots; a blink that
  fills the eyes with fur colour), `prepare` (stands a model up 1 unit
  tall facing +Z and finds its eyes from the texture), `Animal` (states
  rest, look, sniff, graze, groom, move, hello; hop, walk, scurry and swim
  gaits; ducklings follow), `Life` (`free`, `check`, `update`).
- **`tools/rig-sheet.html`**: side, front and top views of one model on a
  0.1 grid, for setting rig numbers. Serve the repo and open
  `tools/rig-sheet.html?m=beagle&yaw=-1.5708`. Its camera crops the bottom
  of the model; fix that before trusting it.

## Left, in order

1. **Tune the rigs.** Render each species in a few poses (head down,
   head turned, ears, a walk phase) and adjust `SPECIES` until nothing
   tears. Check `geo.userData.eyes` is 2 for each.
2. **Wire `Life` into `sanctuary3d.js`.** It expects: `group`, `height`,
   `wet`, `obstacles` (`{x, z, r, what}` for rocks, trunks, shrubs, flower
   drifts at 0.8 of their radius, the cottage, shelters), `cam`,
   `shadow(size)` (a blob-shadow mesh), `ripple(x, z, size)`, `flyers`
   (butterflies as `{x, z}`). Replace the three fixed rabbits and the old
   `hello`. Animals cast no real shadow (the shadow map is drawn once).
3. **Habitats** (`{id, x, z, r, food: [[x, z]], shelter: [x, z], pool?}`),
   planned on an island of mean radius 31, one per quiz topic:
   `meadow` Bunny Meadow (-5, 10) rabbits; `pond` Willow Pond = pool C,
   ducks, `pool` set; `orchard` Orchard (-19.5, 0.5) guinea pigs;
   `burrow` renamed Leafy Garden (4.5, -8.5) beagles; `oak` renamed Wooded
   Meadow (0, -21, on the oak's hill) deer. Each needs a terrace in
   `natural()`, planting, a shelter built in code (hutch, pergola with a
   cushion, a lean-to of branches, a duck house, a burrow mound), food
   spots, and a clear middle. Trees go behind and beside, never in front.
   Paths from the hub at (0, 1.5) to each.
4. **Roster** (names and lines speak for the founder: flag them). Rabbits
   Clover, Hazel, Ash; duck Willow with ducklings Pip, Dot, Puddle; guinea
   pigs Biscuit, Nutmeg, Pear (one model, three tints and sizes); beagles
   Poppy, Scout, Juniper; deer Fern, Bramble, Rowan.
5. **Environment.** One `uTime` / `uWind` pair patched into the flower,
   tuft, clover, shrub and crown materials; ring ripples on the pond;
   butterflies that fly between drift centres and settle.
6. **Camera and picking.** Pick animals by distance on screen (they are
   small on a phone), then the land for a habitat. Visit eases to the
   habitat; a selected animal is followed. Hide a tree that stands between
   the camera and the target. Draw animals up to about 1.7 times larger at
   overview distance (`life.big`).
7. **Progress.** `setState` takes every habitat: flowers by `p`,
   residents 1 to 3 (kept as a high-water mark in `state.best`), shelter
   improved at half learned (also kept). The round's summary says what
   improved. Words: "moved in", never "rescued", "saved" or "donated".
8. **`garden.js` and the card.** World: the selected habitat, arrows to
   step through habitats, Visit. Visit: the habitat, what the next lesson
   brings, Practise. Animal: name, personality, Say hello, Practise.
9. **Speed.** Fewer tufts and no clover when far; lower the pixel ratio
   when frames run slow.
10. **Checks.** `debug.simulate(seconds)` stepping `Life` with no drawing,
    asserting `check()` stays empty for ten simulated minutes; the full
    run in item 10 above at 390 x 844, 320 x 568 and 844 x 390. Bump
    `WORLD` and `CACHE_VERSION` in `sw.js`; add `sanctuary3d-life.js` to
    `WORLD_PATHS` (the prefix `sanctuary3d` already matches it).
11. **Docs.** `SPEC.md`, `docs/ARCHITECTURE.md`, `DESIGN.md`,
    `CREDITS.md` (Tripo's terms: read them or mark TO FILL).
12. A reviewer subagent has not read commit 969094b (the first 3D world)
    or this work.

## How models were made

Tripo: `POST https://api.tripo3d.ai/v2/openapi/task` with
`{"type":"text_to_model","prompt":...,"model_version":"v2.5-20250123","face_limit":12000,"texture":true,"pbr":false}`,
poll `GET .../task/<id>` until `status` is `success`, download
`output.pbr_model` or `output.model`. 20 credits each. Then, in a scratch
folder: `npm i @gltf-transform/cli@4` and
`npx gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024 --simplify false`.

## Read first

`SPEC.md` ("The Garden"), `docs/ARCHITECTURE.md` (rows for `garden.js`,
`sanctuary3d.js`, `sw.js`), `DESIGN.md` ("Your Sanctuary"), then
`sanctuary3d-life.js` top to bottom.
