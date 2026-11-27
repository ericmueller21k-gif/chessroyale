# Review of PR #990 (claude/hidden-boss-forms @ 27eaa3a6), full lane, read-only

One should-fix and four nits. Nothing blocks. The touched unit tests pass: accounts, account-data, recluse-online, public-profile
and portraits (5 files, 140 tests).

## Findings

1. **should-fix**: `packages/server/src/lobby.ts:4705` (`formsBeaten`, reached from `resultOf` at :1432). The child is beaten, but
   during his fall (`RECLUSE_CHILD.fallMs`, 7.5 s, until `nextRound` calls `nextBossForm` at :3055) the boss still reads
   `form: "child", result: "crowd"`. Anyone who leaves in that window (a resign, an away timeout, a party kick: `leaveMatch` →
   `resultOf`) gets `formsBeaten: 0`. It should be 1, because the child fell. I confirmed this with a throwaway test (reverted, not
   committed): `roomFight(3, 1, { child: true })`, the 🏆, play to the child's mate, then p3 resigns in the fall → the stored result
   is `{ teamWon: false, formsBeaten: 0 }`. Cause: the count is "the index of the form he's in", not "the forms that fell". Fix: count
   one more when `boss.result === "crowd"` (pass `RECLUSE_FORMS.indexOf(form) + 1` to `recluseFormsBeaten`). Add this case to the
   recluse-online test (it now skips the fall: `advance(fallMs)` comes before the resign). The same cause would undercount his
   adult form's fall in any raid against him with no phase 2 after it (`phase2Online` false: not his room).
2. **nit**: `packages/server/src/xp.ts:157`. A solo fight against him that is abandoned or forfeited is written as a loss with
   `forms_beaten` NULL, so its row shows no form grayed, even after the child and the man fell (a page closed in phase 2). This
   matches the decision's rule for older rows ("else none"), but these rows are new. Say so in the decision note, or accept it.
3. **nit**: `packages/app/src/App.tsx:136-137` (`soloResult`'s count) has no test. accounts.md names `accounts.test.ts` and
   `recluse-online.test.ts`, and neither runs `soloResult`. The server's clamp bounds the value, but a wrong form read would still
   store 1 instead of 2 for a phase-2 loss, and no test would notice.
4. **nit**: `packages/app/src/components/ProfileParts.tsx:143` (the View all list). The strip uses `.rf-forms` at its default 26 px
   (84 px wide, plus a 12 px gap), which takes 96 px from the title. On a phone, "Boss Battle · a boss · unranked" then wraps to
   two lines. I measured this from styles.css in a bare page with the fallback font, so the numbers are approximate: his rows are
   74 px tall at 390 wide and 90 px at 360, against 64 px for a row without the strip. The strip itself keeps its size, but his rows
   end up taller than their neighbors, and the e2e test only counts faces in this list. The card's 20 px faces, or a one-line
   title, would avoid it.
5. **nit**: `packages/core/src/settings.ts:2593`. The stored count is a position in `RECLUSE_FORMS`, which is a tunable. If the list
   changes (for example, the child is dropped), every stored row is read against the new list: an old 1 (the child beaten) would
   gray the man. Note this beside `RECLUSE_FORMS`, so whoever edits the list knows the stored rows depend on it.

## Checked, no problem found

- Migration: one nullable `ALTER TABLE ... ADD COLUMN`, with no backfill and nothing else changed. An existing D1 keeps NULL on
  older rows, and a fresh one gets the column last (the pinned `SCHEMA_COLUMNS`). Every insert names its columns.
- Account data: the download (`RESULT_COLUMNS`) includes the column. The anonymized copy maps 33 columns to 33 values, with
  `forms_beaten` kept last; it identifies nobody.
- Rows that stay NULL: other bosses, the Crowd's final against him (online `c.mode` is "crowd", and the lobby requires
  `settings.raid`), Squads, and the abandon row.
- Trust: `recordResult` applies the clamp to every writer. A win always stores 3. A row that wasn't a win stores 0 to 2. A string,
  boolean, Infinity or negative stores NULL or a clamped value. The API forces `online: false`.
- Online counts: a resign as the child gives 0 and as the man 1. The four boards give 3 for a win, 2 for a loss and 2 for a leaver.
  `recluse2` is set at the adult's fall, so the fall and the cutscene count 2. A party gets the same count on every row. A no-result
  fight writes no row (lobby-do.ts:907).
- Solo: the player can't leave during a fall or the phase change (`exit` is null then). A phase-2 result always carries `simul`.
- Read and strip: older rows show three grayed for a win and none otherwise. The count grays faces in `RECLUSE_FORMS` order. The
  strip is always three faces. The e2e test's title check is meaningful (nowrap and ellipsis), and it runs on both phone and
  desktop.
