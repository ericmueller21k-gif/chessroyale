# Main red: dash.spec:576 fails on main since #776 (Moo cinematic) landed after #775 (Dash clock tap). Opus, high

Branch `claude/dash-spec-main` from main. About 45 min. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/decisions/2026-11-17-dash-tap-when-slow.md`
(#775) and `docs/decisions/2026-11-17-moo-cinematic.md` (#776). Both merged today, each green on its own PR run; together main is red.

**The failure** (main's full run on 5be698e, shard 11, phone; failed on the first try AND the retry, so it's real):
`e2e/dash.spec.ts:576` "the clock tap (&power=clocktap) only when you're slow: …; the next slow move has the slam", line 631:
`expect((await lies(page)).filter((l) => l.move !== 1)).toEqual([])` received entries `{ move: 2, ms: -1, at: … }` (12 on the retry,
32 on the first try): his lying figure shows (or the spec's `lies` probe records it) on the next move, where only the slam should come.
main on be0435e (#775 alone) passed this spec; 5be698e adds #776. So something in #776 (e.g. `body.mo-on`, the `.mo-area`/`mo-block`
taps, `noteRejoin` in net.ts/moo-state.ts, `boardOnScreen` export, `fullMoonLeadMs`/`bossThinkMs(view…)` in boss-timing.ts and solo/server,
`Play.tsx`/`App.tsx` shared changes) collides with #775's `DashTap` (drawn beside the match screens in App.tsx, `dash-away`, `tapSeen`)
— or #776 changed shared state the tap reads. Find the real cause (reproduce on main first:
`npx playwright test e2e/dash.spec.ts:576 --project phone`), fix it there (not in the spec unless the spec reads wrongly), and run
dash.spec and moo.spec on phone and desktop plus boss-smoke. Typecheck; the dash and moo unit tests.

Done: `.pr-body.md` (under 30 lines: cause, fix, proof, changed checks) and `.done`, end. No PRs, no CI waits.
