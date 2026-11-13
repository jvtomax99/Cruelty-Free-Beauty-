# HANDOFF: Your Sanctuary, what is left after part 2

Written 2026-11-13. Delete this file when its work is done. Branch
`claude/affectionate-knuth-2thai8`, pushed, no pull request, nothing live.
The founder has seen none of it; nothing merges before she has.

## Done (2026-11-13)

All eleven points of Jose's brief of 2026-11-12 are built and checked in
the cloud browser: `node tools/test-sanctuary.cjs` passes (about ten
minutes; software 3D). `SPEC.md` ("The Garden") says what was built,
`docs/ARCHITECTURE.md` where it lives. A reviewer subagent read the code;
its findings were fixed, except the two under "Left" below.

## Left, in order

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
