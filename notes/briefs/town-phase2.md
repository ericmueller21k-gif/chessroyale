# Town structure, phase 2: one door for the pictures the device still makes. Fable, xhigh. Targeted lane (full-e2e if it touches loading).

Read `notes/briefs/rules-common.md` (load first, then show), `DESIGN.md` on `origin/claude/town-architecture` (§2, phase 2; findings 4,
5, 8), `notes/briefs/town-phases.md`, and phase 1c's notes (`notes/briefs/town-phase1c-done.txt`) and review (`REVIEW.md` on
`claude/town-phase1c-review`: its nits on the three waits' separate 15 s stalls and a lost context in a room are yours to close if they
fall in this work). Branch `claude/town-phase2` from `origin/main`. Push at each real step; split anything over about 4 hours.
1. **The picture service:** everything the device still makes (name tags, speech bubbles, outfits and rides, crate items, labels) is
   asked for ahead, made and uploaded between frames within a per-frame budget, drawn when ready and left out until then. Once the
   loading card lifts, **the painter never uploads inside a draw** (today `paint-gl.ts` uploads whatever it's handed on first draw; the
   speech bubble still does): that path is removed, not checked for.
2. **Text at one size,** scaled by the GPU: one picture a name, not nine (home names) or five (tags). Before building it, a still of the
   town's names and tags at every zoom on a phone and a computer, old and new side by side, for the director: if small text looks
   soft, two sizes.
3. **Bubbles made ahead of their line** (the line is known before it shows).
4. **Tags never overflow the atlas:** 55 players' tags fit in their own pages; no page started again in play.
5. Measure: the 55-player busy-town walk (the `@perf` busy-town tests): uploads inside frames → 0; no page reset; text pixels 8.7 M →
   about 1.5 M; frame budget held. Same look otherwise (the picture hash for the baked town unchanged).
Decision note, area pages. Commit AND push `.pr-body.md` and `.done` (`git add -f`), check `git ls-remote`, stop. Stills on an orphan
`stills/town-phase2` branch.
