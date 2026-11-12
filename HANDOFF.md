# HANDOFF: Your Sanctuary (the Garden)

Written 2026-11-12. Delete this file when its work is done.

**Goal.** A study game in C.F.B. like Jose's CPA city: a 3D sanctuary that
grows with what the person learns. SPEC.md, "The Garden", has the rules.

**Where it stands.** Branch `claude/affectionate-knuth-2thai8`, pushed, no
pull request, nothing live. Built and passing its checks: the quiz (33
written questions plus one per brand), the 3D island, the first habitat
(Bunny Meadow, Meet Clover).

**Next step.** Jose looks at it and shows the founder. She has not seen
any of it, and "Your Sanctuary", "A little kindness. A world of life." and
Clover's line are words that speak for her. Nothing merges before that.

**Left.**
- The other four habitats in 3D and their animals (dogs, cats, guinea
  pigs, hamsters, mice, birds; SPEC has the planned homes). Meshy balance
  was 122 on 2026-11-12, shared with Jose's other projects; a model is 30
  credits with the `latest` model, and about half the first batch had to
  be thrown away, so ask before a batch.
- Speed on a real phone is not verified (the cloud browser draws 3D in
  software). If it is slow: fewer grass tufts, a smaller shadow map
  (`low` in `mount`), a lower pixel ratio.
- Meshy's terms for a public repo: CREDITS.md says TO FILL.
- Look, against Jose's two reference pictures: the water is flat (no real
  reflections), the falls are thin, the land could use more height, and
  the trees are rounded but plain. Meshy's own trees came out jagged.
- A reviewer subagent has not yet read the 3D commit (969094b). It did
  read the quiz commit and its findings are fixed.
- `tools/test-garden.cjs` and `tools/test-sanctuary.cjs` are not in the
  pull-request workflow (only the site check is).

**Read first.** SPEC.md ("The Garden"), docs/ARCHITECTURE.md (rows for
`garden.js`, `sanctuary3d.js`, `sw.js`), DESIGN.md ("Your Sanctuary").

**How the models were made.** Meshy text-to-3D (preview, then refine),
then `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt
--texture-compress webp --texture-size 1024 --simplify false`.
