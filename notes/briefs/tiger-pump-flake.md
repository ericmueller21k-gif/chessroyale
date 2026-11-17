# Main red: tiger.spec:552 (Babur's pump on a computer) passed only on retry. Fix the cause. Opus, high (rendering/layout)

Branch `claude/tiger-pump-flake` from main. About 45 min. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/decisions/2026-11-17-boss-facing.md`
(#774, merged today: turned side figures, `SIDE_SWING`, `fitSides`, Babur turns to his pump on a computer).

**The failure** (main's full run on be0435e, shard 13, desktop; passed on the retry, so main is red by rule):
`e2e/tiger.spec.ts:552` "Babur's pump on a computer at 1280 × 800, 1440 × 900, 1920 × 1080 and 1024 × 768 …", line 575:
`Error: 1440 × 900: its place — expect(locator('.tg-pump-slot')).toHaveAttribute("data-place", "side") — Received: "tall"`.
At 1440 × 900 the pump's place came out "tall" once and "side" on the retry: its choice is not deterministic. Main's run on #774's merge
(4e35f10) passed, so it's intermittent, likely since #774 (Babur is now a turned side figure whose room/swing is measured) — confirm.

Find why the pump's place depends on timing (e.g. measured from a figure frame mid-animation, a box read before the turn/mirror
applies, a resize race at the viewport change, fonts/images not loaded) and make the choice deterministic from settled numbers. Don't
loosen the spec or add waits that hide it; if the spec itself reads too early, fix the spec's read to wait for the settled state the
app defines. Prove it: run `npx playwright test e2e/tiger.spec.ts:552 --project desktop --repeat-each 10` before (to see it flake if
you can) and after (10/10). Typecheck. Light/targeted lane.

Done: `.pr-body.md` (under 30 lines: cause, fix, proof, changed checks) and `.done`, end. No PRs, no CI waits.
