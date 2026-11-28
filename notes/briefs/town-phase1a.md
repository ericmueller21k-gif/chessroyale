# Town structure, phase 1a: the build makes the pictures (bake script + manifest), no app change yet. Fable, xhigh. Targeted lane.

Read `notes/briefs/rules-common.md`, `DESIGN.md` on `origin/claude/town-architecture` (section 2 and phase 1), and `notes/briefs/town-phases.md`.
Phase 0 (PR on `claude/town-phase0`: the art fingerprint `__TOWN_ART__`, `packages/app/town-art.ts`) may or may not be merged when you
start: branch `claude/town-phase1a` from `origin/main`, and merge `origin/claude/town-phase0` in if it isn't merged yet (it's green).
1. **The picture list out of the renderer** (`render.ts` `warm`/`plan`): one module that names every picture the town draws, its group (a
   home with its frames, boss and glow; a street's row; the park; the Colosseum; the props; each sidekick's sheet), and how it's painted
   (`paint-jobs.ts`, already browser-free).
2. **`scripts/bake-town.ts`:** runs the painting code in Node, packs each group's pictures into pages, writes content-named PNGs and a small
   manifest (each picture's group, page and place; animations' frame counts and timing; roofs' and glows' pieces; the box tops). It prints
   each group's pictures, pixels and bytes and the totals. Wire it into the build so `npm run build` bakes (output under the app's public
   build, never committed if it's large: decide and say).
3. **A test that the baked pixels equal today's** (the picture hash the town already has), for every picture.
No app change: the town still paints on the device after this job. Measure the bake's time and output size. Five-line decision note.
Commit AND push `.pr-body.md` and `.done` (`git add -f`), check `git ls-remote`, stop. Split anything over about 4 hours and say so.
