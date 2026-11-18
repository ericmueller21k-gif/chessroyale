# Squads: "Relay with Quick board jump" passed only on its retry on main (Nov 18). Opus, high

Branch `claude/squads-replay-next` from main. About 1 h. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/squads.md`
(Quick board jump, move replay), `docs/rules/eric.md` (line ~256: this spec is one of Eric's guard tests),
`docs/decisions/2026-11-10-squads-replay-test.md` (its last edit and why).

**What failed:** main's full run on 36a6366 (Nov 18): `e2e/squads-replay.spec.ts:252` [phone], first try, at line 264:
`expect(page.locator(".sq-tiny.on .sq-mark.next")).toHaveCount(1, { timeout: 5_000 })` got 0; it passed on the retry.

**The director's guess (check it, don't assume it):** the little board's NEXT mark (`SquadsParts.tsx` `MatchBoards`, from
`myBoards({ ...m, turn: shownTurn(m) })`) shows only until your turn there begins; then the same board is marked YOU. If the other
players move fast, the window between the quick jump and your turn can close before the test looks. If that's it, find out
whether the app is right (the jump lands on the board you play next, marked NEXT then YOU) and the test simply assumed a window;
or whether the app shows something wrong (no mark, the wrong board, a flicker) for a moment.

**Fix the cause (CLAUDE.md, Nov 13).** An app bug: fix the app. The test assuming a timing window: fix the test so it checks the
rule (the big board is the one you play next: marked NEXT or YOU), not the timing.
**Eric's OK, Nov 18** (his words: "yes, you have my permission to do whatever we need to do to make it work"): editing this guard
test is approved. Write a 5-line decision note quoting him, list the check old → new in the PR body, and update the line in
`docs/rules/eric.md` only if what the guard guards changes.

Prove it: reproduce first if you can (e.g. `--repeat-each 10` on that test, phone, under the shared e2e lock), then the same run
passing. Typecheck; the touched units. Done: `.pr-body.md` (under 30 lines) and `.done`; push and end. No PRs, no CI waits.
