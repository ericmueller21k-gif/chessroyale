# Payments PR 4 (#966): the review's fixes (Nov 26). Opus xhigh, FULL lane. On branch `claude/pay-boost`

Read `git show origin/review/pay-boost:REVIEW.md` (1 blocker, 1 major, 3 minor, 2 nits) and the PR body (#966).
FIRST: merge origin/main into `claude/pay-boost` (PR 5, purchases storage, merged as #963): resolve `ledger.ts` (schema comment,
`AssetKind`, `HOLDINGS`, merge comment) and `account-data.test.ts` (`SCHEMA_COLUMNS`) as a union (the review did it once: m2).
Then:
- **B1 (blocker):** make the drop deterministic in tests at its cause: `setTestQuests` (test servers only) takes an optional `drop`
  per dealt quest (`none` default | `boost` | `bonus`) and draws quest ids until `questDrop(questOpId(...))` gives it, as the review
  describes; `?quests=warm-up:2:boost` in e2e. `quests.test.ts:308/:326` and `e2e/quests.spec.ts:171` then pass as they are (run each
  20x to show it); `coin-boost.test.ts`' `rolling()` uses `drop: "boost"`. Production untouched.
- **M1:** charge the boost the minutes that earned play coins, not the game's: `min(m, max(1, ceil(base.play / PLAY_COINS.perMinute)))`
  (or the server passes the paid minutes). Test the crossing game: day at 290, a 30-minute game uses 6 minutes and leaves 114.
- **m1 (director's call, made):** charge each boosted game at least `COIN_BOOST.minGameMinutes` = 5 (a setting) so short games can't
  multiply a crate's worth (win-trading); test a 40-second win charging 5. Record the call and a crate's worth range in the decision note.
- **m2:** PR 5's `purchases.test.ts` migration test: the expected `wallets` rows gain `boost_crates: 0, boost_minutes: 0, crate_bonus: 0`.
- **m3:** the reward card's line: "Crate Bonus: your next 5 level-ups that give crates give double crates" (or with "(N left)").
- **n1:** with `coins.bonus === 0`, the boost guard also checks the bonus op is absent.
- **n2:** record both calls in the decision note (boss picks never doubled; the roll reads the odds live).
Also add the review's R3 (two games at once reaching a level pay one bonus) and R4 (two opens at once open one) as tests.
Tests: core + server unit tests pass (full); the quest specs 20x; typecheck. Append a "Review fixes" section to `.pr-body.md` (each
finding → what you did, checks changed old → new). Push at each real step; at the end COMMIT and push `.pr-body.md` and an empty
`.done`, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
