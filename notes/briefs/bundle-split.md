# The bundle split: each boss's code loads with his match (audit L6). Opus, high. Targeted lane

Branch `claude/bundle-split` from main. About 3-5 h. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/ops.md`, `docs/areas/bosses.md`,
`docs/areas/god-king.md`, and on `claude/director-notes` `notes/pipeline-audit-2026-11-12.md` (L6) and `-11-16.md` (L6).

**Why (Eric, Nov 16: "that sounds like an important thing to do"):** the main chunk every player downloads before the home screen is
about 2.0 MB (705 kB gzip); it carries every boss's code (art, rules, animations, lines) though a match meets one. Every deploy changes
it, so every player downloads it again after each update.
**Do:**
1. Measure first: a `vite build` with a size breakdown of the main chunk (by module, minified and gzip). Write the top 20 into the PR
   body: how much is boss art and boss code, what else is big.
2. Split each boss's own code (sprite, portrait, animations, lines, powers' screen code) into its own chunk, loaded when it's needed:
   his match, his home or a screen that draws him (the boss select's tile needs only his small icon/portrait: keep what it needs light).
   Start the load early enough (when the match or the home is chosen) that nothing he draws waits on it; `docs/rules/eric.md`'s
   "nothing hidden, nothing shifts" applies: no box pops in late. A load that fails shows a retry, never a stuck screen.
   Rules every device and the server run (`packages/chess`, `packages/core`) stay as they are unless they are the weight: say if so.
3. Re-measure: the main chunk before → after (min, gzip), each boss chunk's size, and the first load on an emulated phone (throttled
   "Fast 4G"): time to the home screen before → after.
**Checks:** typecheck; the unit tests you touch; the boss kit; `e2e/boss-smoke.spec.ts` (every boss); the specs of screens that draw a
boss (the boss select, homes) as `e2e/areas.json` traces them. Add new chunks' paths to `e2e/areas.json` if new files appear. Push at
each real step; `.pr-body.md` (short: sizes before → after, what loads when, changed checks old → new) and `.done`. Commits end with the
`Claude-Session:` line only, no model names. No PR, no waiting on CI.
