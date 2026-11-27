# Review of PR #990 (claude/hidden-boss-forms @ 27eaa3a6), full lane, read-only

One should-fix and four nits; nothing blocks. The touched unit tests pass (accounts, account-data, recluse-online,
public-profile, portraits: 140 tests).

1. **should-fix**: `packages/server/src/lobby.ts:4705` (`formsBeaten`, called from `resultOf` at :1432). In the child's fall
   (`RECLUSE_CHILD.fallMs`, 7.5 s, until `nextBossForm` at :3055) the boss is still `form: "child", result: "crowd"`, so anyone who
   leaves then (resign, away timeout, party kick) is stored with 0, though the child fell. It should be 1. Confirmed with a
   throwaway test (reverted): `roomFight(3, 1, { child: true })`, the 🏆, play to the mate, p3 resigns in the fall →
   `{ teamWon: false, formsBeaten: 0 }`. Cause: the count is the index of the form he's in, not the forms that fell. Fix: one more
   when `boss.result === "crowd"`, plus this case in recluse-online (its test now skips the fall). The same cause would undercount
   the adult's fall in any raid against him with no phase 2 after it (not his room).
2. **nit**: `packages/server/src/xp.ts:157`. A solo fight against him that is abandoned or forfeited is a loss row with NULL, so it
   shows no form grayed even after the child and the man fell. The decision's "else none" covers older rows; say it covers these.
3. **nit**: `packages/app/src/App.tsx:136-137`. `soloResult`'s count has no test: accounts.md names `accounts.test.ts` and
   `recluse-online.test.ts`, and neither runs it. The clamp bounds it, but a wrong form read (1 for a phase-2 loss) would go unseen.
4. **nit**: `packages/app/src/components/ProfileParts.tsx:143` (View all). The strip's default 26 px faces take 96 px from the
   title, so "Boss Battle · a boss · unranked" wraps on a phone. Measured from styles.css in a bare page with the fallback font
   (approximate): his rows are 74 px at 390 wide and 90 px at 360, against 64 px for the others. The e2e only counts faces here.
   The card's 20 px faces or a one-line title would avoid it.
5. **nit**: `packages/core/src/settings.ts:2593`. The stored count is a position in `RECLUSE_FORMS`, a tunable: changing the list
   re-reads every stored row (drop the child, and an old 1 grays the man). Note this beside the list.

## Checked, no problem found

- Migration: one nullable `ADD COLUMN`, no backfill, nothing else changed. Older rows keep NULL. A fresh DB gets the column last
  (`SCHEMA_COLUMNS` pins it), and every insert names its columns.
- Account data: the download includes the column. The anonymized copy maps 33 columns to 33 values, `forms_beaten` kept last.
- NULL on other bosses, the Crowd's final against him (`c.mode` is "crowd"; the lobby requires `settings.raid`), Squads and
  abandon rows.
- Trust: the clamp in `recordResult` covers every writer. A win stores 3; anything else 0 to 2. A string, boolean, Infinity or
  negative stores NULL or a clamped value. Solo is forced to `online: false`.
- Online: a resign gives 0 as the child and 1 as the man. The four boards give 3 for a win, 2 for a loss, 2 for a leaver; the
  fall and the cutscene give 2 (`recluse2` is set at the fall). A party gets the same count on every row; no result, no row.
- Solo: you can't leave in a fall or the phase change; a phase-2 result always has `simul`. The strip is always three faces, in
  `RECLUSE_FORMS` order. The e2e title check is meaningful (nowrap and ellipsis) and runs on phone and desktop.
