# The page keeps growing in battles: Grex's fireworks and a long boss battle (Nov 23). Opus, high, beside the town helper

Eric, Nov 23, on the numbers: "if those pieces are showing 1987 we gotta fix this and see why things are being cleared from memory or
whatever, that's a big efficiency issue and could be bad." Two `@perf` checks on `origin/main` (`e2e/perf.spec.ts`, phone; CI leaves
@perf out, so run them locally under the e2e lock) fail their element counts:
- "G-REX's fire on a slow phone": 1,987 elements after the barrage (limit 391).
- "A long boss battle on a slow phone": 248 (limit 232).
The boss is **Grex** now (Eric, Nov 23: the official name; id `grex`; was Jefferson, G-REX before Oct 10); his power is the fireworks
(sparkler, Roman candle, fire tiles, char marks: `packages/app/src/characters/effects/grex.ts`, `components/Grex.tsx`, boss-beats).
Read CLAUDE.md ("Fix the cause"; "Simple beats flashy"), `.claude/LESSONS.md`, `docs/areas/bosses.md`, the perf spec. For each: find
which elements stay (count by selector/class before and after, and after a second and third barrage, to tell a one-off from a leak
that grows every time) and why they aren't removed (an effect never unmounted, a list that only grows, a key that changes so Preact
keeps the old nodes, char marks or move-list rows piling up). Fix it at the cause so the page returns to its size after each effect.
Change a limit only where the number was never right (say why, with the counts). Don't touch the town's load (another helper is on it,
branch `claude/perf-main-fails`) or the name (branch `claude/rename-grex`). Lane: targeted (drawing): watch the fireworks frame by
frame before and after (`npm run frames:boss`), and the frame budgets (`--grep @perf --project phone`) must not get worse.
Branch `claude/perf-dom-growth` from `origin/main`; `.pr-body.md` (what changed, what players feel, changed checks old → new),
`.done`, push and stop. Don't open PRs or wait on CI. Commits end with the `Claude-Session:` line only.
