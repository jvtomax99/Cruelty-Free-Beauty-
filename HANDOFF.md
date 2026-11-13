# HANDOFF: Your Sanctuary, part 3: the floating island

Written 2026-11-13. Delete this file when its work is done. Work branch
`claude/affectionate-knuth-2thai8`, restarted from `main` after pull
request #19 was merged (the Sanctuary is live). `main` is the live site:
this work goes in by pull request, site check green, as `CLAUDE.md` says.

## Goal

Redesign the island in `sanctuary3d.js` after the reference picture
`docs/reference/floating-island.jpg` (Jose made it in ChatGPT; it is a
direction, not an asset: nothing from it ships in the app). Look at the
picture before anything else.

## Jose's brief (2026-11-13, his words; do all of it)

Redesign my existing Three.js diorama using the attached image as the
visual direction. Implement the changes in the app. Inspect the current
scene code first, preserve the study game, saved progress and island
growth system, and reuse the existing animal and cottage models.

The island should feel like an earthy, living fantasy world with
substantial depth. The biggest change is its structure: replace the flat
circular platform with an irregular floating landmass that loosely
resembles a diamond, broad near the top and tapering unevenly underneath.

1. **Give the island a complex, organic silhouette.** Create an
   asymmetrical mass of earth and stone with projecting ledges, recessed
   sections, overhangs and an uneven tapered base. Avoid a perfect
   inverted pyramid, smooth cone or stack of circular layers. Different
   sides should have different contours. Make the underside deep enough
   to be a major part of the composition. Build complexity through a few
   strong structural forms that remain readable on a phone, rather than
   hundreds of tiny details. Include one shaded hollow or rock arch, with
   believable thickness around the opening. Avoid disconnected rocks that
   appear randomly glued to the outside.
2. **Make exposed tree roots a defining feature.** The main blossom tree
   should have thick roots that visibly emerge from its trunk, spread
   across the ground and crawl down the outside of the island. Have roots
   twist around rocks, follow crevices, cross exposed soil and branch
   into progressively smaller roots toward the bottom. Vary their
   thickness, length and direction. Some should disappear into the earth
   and emerge farther down. They should look like they grew through the
   land, with tapered branches and irregular curves. Avoid uniform tubes,
   repeated spirals or roots resembling ropes wrapped around a pot. Use
   low-segment curved geometry where appropriate.
3. **Create a waterfall that travels down the outside.** Connect the
   upper stream to the pond, then let water overflow a clearly shaped
   opening at the island's edge. The waterfall should fall onto an
   intermediate rocky basin, change direction slightly, then spill
   farther down past the tapered base. Shape the surrounding ledges
   around the water's route. Use stylized turquoise water, simple
   animated flow, restrained foam and a little mist near the lower drop.
   Keep the waterfall visible from the default camera. Avoid expensive
   fluid simulation or realistic refraction.
4. **Add elevation to the garden itself.** Place the cottage on a raised
   grassy terrace. Let a winding cream path descend toward the animal
   clearing and lower pond. Use rounded slopes, exposed rock edges and
   occasional shallow steps. Keep comfortable open spaces for the
   animals. Group flowers and shrubs around paths, tree bases and terrace
   edges, leaving enough open grass to make the animals easy to see.
5. **Balance earthy materials with gentle fantasy.** Use warm brown soil,
   muted stone, sage moss, cream paths, blush blossoms and berry accents.
   Keep rounded forms, but give the cliffs and roots stronger dimensional
   shading than the garden. Keep the curved blossom tree as the main
   fantasy feature. Add a few luminous seed pods beneath its canopy and a
   small cluster of glowing mushrooms inside the shaded hollow. Avoid
   covering the scene in sparkles.
6. **Make it feel alive.** Add slow water movement, occasional falling
   petals, subtle foliage movement and animal routines separated by
   pauses. Ducks should leave ripple rings. Animals should sometimes
   notice nearby flowers, butterflies or each other. Use existing model
   animations where available. Do not slide rigid animals around to
   imitate walking. Keep environmental motion gentle enough for a study
   app.
7. **Preserve the technical constraints.** This is a $0 phone web app
   using Three.js with no build step. Generate the environment in code
   and add no paid assets or required services. Reuse geometry and
   materials, instance repeated plants and rocks where appropriate, keep
   curved geometry economical, limit shadow rendering and avoid heavy
   postprocessing. Reduce decorative detail before sacrificing the island
   silhouette, roots or waterfall. Keep procedural generation stable so
   the island does not randomly rearrange when reopened. Integrate new
   terraces and planting with the existing learning progression.
8. **Frame and verify the result.** Adjust the default camera so the
   garden, exposed roots, deep underside and waterfall are visible
   together in portrait orientation. Keep animals readable and prevent
   the interface from covering the lower island.

No fences, cages, distressed animals, or wording implying real rescues or
donations.

Build the structural landmass, roots and waterfall first, then add
planting and animation. Continue through implementation and verification.
Show the completed scene at phone size, check that study progress still
works, and report what you actually tested.

## What already exists (so it is not rebuilt)

Much of point 6 is there: the breeze (`sway`), running stream, ripple
rings from ducks and on the pond (`ripple`), butterflies between flowers
(`flutter`), animals on their own clocks that look at butterflies and at
each other and visit food and friends (`sanctuary3d-life.js`). The models
have no bones or animations: the "skeleton" is a vertex shader, and
rabbits only move while in the air of a hop. New for point 6: falling
petals, and animals noticing flowers.

## Where the work is, in `sanctuary3d.js`

- `edgeR(th)` is the island's outline, `natural`/`height` the land, and
  `skirt()` the side and underside: today a 9-deep bowl. That function is
  what becomes the deep, uneven, tapering mass. The rim rocks (`rim`) are
  the "glued-on" rocks the brief wants gone.
- `POOLS` and `RUNS` are the water: two small pools feed the pond
  (`POOLS[2]`, the ducks' home). The outside waterfall starts at a notch
  cut in the pond's bank at the island's edge.
- `HABS` fixes where the five habitats, their shelters and food are;
  `ROSTER` where each animal starts. `Life.free` keeps animals inside
  their habitat circle, on dry ground, clear of `obstacles`. If the land
  or the water moves, move these with it and re-run the simulation.
- The camera's whole-island frame is in `frame0()`; the card covers the
  bottom of a portrait screen, so the island has to sit higher or the
  view pull back for the underside to show.
- There is no postprocessing and there should be none: glow is an
  unlit bright material plus, at most, a soft sprite.
- Shadows are drawn once (`shadowMap.autoUpdate = false`), again on
  `setState`.

## How to check (learned the slow way)

- Serve the repo's parent folder and use the installed Playwright with
  `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
  Open `?intro=0&3d=1#garden`, wait for `.sx.is-ready`.
- `window.CFB.garden.world.debug`: `quality(1)` first (stops the
  adaptive quality and makes software 3D bearable), `snap()` jumps the
  camera to its goal and draws, `simulate(600)` lives ten minutes of
  animal life and returns anything out of place, `info()` counts
  triangles. Call `world.stop()` before a large screenshot or it times
  out.
- `node tools/test-sanctuary.cjs` takes about ten minutes: run it in the
  background. `node tools/test-garden.cjs` is the quiz and progress.
- For pictures with everything unlocked, write `cfb-garden` in an init
  script: `best` 3 and `shelter` true for all five habitats, every
  question id at `{ s: 2, due: future, k: "w" }`.
- Bump `WORLD` and `CACHE_VERSION` in `sw.js`. Update `SPEC.md`,
  `DESIGN.md` and `docs/ARCHITECTURE.md`. A reviewer subagent reads the
  diff before the pull request.
- A full sanctuary is about 400,000 triangles already (animals 111,000).
  The new underside, roots and waterfall should cost tens of thousands,
  not hundreds.

## Still owed from part 2 (do not lose these)

1. **The founder.** She signs off the look, and the words that speak for
   her: sixteen names and one-line personalities, three habitat names,
   five shelter lines (`HOME` in `garden.js`, `ROSTER` in
   `sanctuary3d.js`; listed in SPEC "Open questions").
2. **Speed on a real phone** (Jose): not measured. The animal models
   were shrunk on 2026-11-13 (glTF Transform `weld`, `simplify`,
   `meshopt`): the Tripo five and the tan rabbit to about 6,000 triangles
   each; Clover and the grey rabbit only to about 12,000, because their
   fur textures are cut into many small pieces that the tool will not
   merge.
3. **Models to remake or keep** (Tripo, 20 credits each): the ducklings
   read as rubber ducks; the deer has small antlers; the guinea pig came
   with a tail (hidden in code); the beagle and deer are more cartoon
   than the rabbits; the grey rabbit's ears are stiff because they lie on
   its back.
4. **Tripo's terms** for `CREDITS.md` (marked TO FILL).
5. From the review, not done: on a computer the mouse wheel over the
   world zooms and cannot scroll the page (the scrollbar and keys can);
   each animal makes a little garbage every frame (about 50 small objects
   a frame with all sixteen).
