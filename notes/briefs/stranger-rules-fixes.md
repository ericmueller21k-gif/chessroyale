# #1000 fix round: the independent review's should-fix and nits (Nov 27)

Read `notes/briefs/rules-common.md` first. Branch `claude/stranger-rules` (PR #1000) at its head (a9260122 or later). The review:
`REVIEW.md` on branch `claude/stranger-rules-review`. Effort xhigh (server pick gates, stored data tests). Opus. Fix only what's
listed; no new features.

Already done by the director (don't redo): B1 (his facing, side sizes + `SIDE_FEEL.overMenu`, goodbye, six shorter lines: b0444d7),
B2 (boss-select's tile count b28e398; boss-smoke skips him until Eric's ult 9e59c8c; a `?boss=` test link isn't held by his lock
a926012, so boss-side.spec, Eric's guard, can open his battle).

Do:
1. **S1:** pin the server's online pick gates, one focused block in the existing server tests: `lobbyOptions(?mode=raid&boss=stranger)`
   with unlocks `[]` and `["stranger"]`, admins first on → no `bossId` for a non-admin either way; the same pair for
   `bossPartyOverrides`; and the pool `writeTowerEnds` passes without `testSwitches` has no `stranger`. Show each fails when its gate
   is opened (a quick mutation, restored).
2. **S2:** in `packages/chess/test/stranger.test.ts` ("the burn on its tile"): his own piece pinned to his king by your piece on the
   tile → spared; your piece on its back rank with his pawn right behind → `chooseStrike` passes it over; a strike whose burn falls at
   the cap → no strike, no event.
3. **N1:** the merge test keeps the earlier unlock (make the guest's the later one). **N2:** FAQ "frozen for your next 1 turn" / "1 turn":
   read naturally for 1 ("your next turn", "one turn"). **N8:** `account-data.test.ts` `world()` gets a `boss_unlocks` row.
4. **N3, N5, N6:** a few lines in the decision note (`docs/decisions/2026-11-27-stranger-unlock-win.md`): what going live includes
   (tokens, quest icons: `isPlayable`'s `!b.unlock` keeps him out; say so, no change now); a party meets him on the leader's unlock;
   the solo unlock is as trusted as the tower best (the device's floor results, server-timed).
Run: typecheck, the touched unit tests. No e2e locally (CI runs the full suite). Push WIP at each step; at the end `.pr-body.md` = the
PR body (read the current one on GitHub, update Checks and Results, at most 40 lines), then push `.done`. Don't open PRs or wait on CI.
