# Delta for the re-review: Payments PR 2 (#950), the review's fixes (Nov 25)

Base: `a4de7fc` (the head the review read). Head: this branch. The director's calls: `notes/briefs/payments-pr2-fixes.md` on
`claude/director-notes`. The review: `REVIEW.md` on `review/pay-play-coins`. `git diff a4de7fc -- packages docs` is the whole delta.

## Finding → change → test

- **M1 (coins lost to one failed D1 call).**
  - `server/xp.ts grantXp`: `settleCoins` is no longer wrapped in a catch; a D1 failure there throws, as the batch's does. The grant is
    keyed throughout (XP ops, coin ops, quests, daily, levels), so a caller's retry pays once and answers the same.
  - `server/duel-do.ts`: `withXp` tries each side's grant `XP_TRIES` (3) times at once, then throws. `recordFinished` keeps
    `recordDuel`'s answer on the room's record (`DuelRecord.ranks`, `duel-room.ts`) when the try fails after it, and a later try uses
    it instead of calling `recordDuel` again. The alarm's retry schedule is the existing one (RECORD_RETRY_MS, then
    `recordRetrySeconds`, up to `recordRetryHours`). The dodge/leave counters count only on a fresh `recordDuel` answer.
  - `server/squads-do.ts`: `writeReward`'s grant error propagates unless the reward's `failedAt` is `MATCH_SAVE.strictMinutes` old
    (then logged, `squads.xpFailed`, written without XP and coins), as `lobby-do.ts writeResult`'s `soft()`. The queue loop moved to
    the exported `writeRewardQueue` (same order and splice; marks `failedAt` on the reward that failed; the DO stores the record after
    a failure too, so `failedAt` survives a restart; the daily cap's `refused` handled after the loop, as before).
  - Tests: `duel-do.test.ts` "XP and its coins when D1 fails…" (once: inline retry, paid once; 3 times: ranks kept, the alarm pays
    once, the outcome's rank change is the first recording's, the game recorded once). `play-coins.test.ts` "M1, Squads…" and
    "M1: settling the coins failing partway…".
- **m1.** `server/play-coins.ts`: `STRICT = 4` (the batch + 3 strict retries), then the loose one, then the log ("refused 5 times").
  Words: module comment, `coinOps` comment, decision note call 1, `docs/areas/accounts.md`, the test's comment. Test: the burst from
  mid-day, the cap only.
- **m2.** `XpGame.soloCoins` (xp.ts) → `CoinPlan.solo` for the coins only (XP's `cap`, its time op and win op unchanged); `writeReward`
  gets `unvouched` from `rec.unvouched?.[r.squadId]`. Test "m2". Docs: call 5, `squads.md`, `accounts.md`, the settings comment.
- **m3.** `oldCoins(key, account)` in `server/play-coins.ts`, ANDed into both coin ops' guards; `settleCoins` checks it once before
  retrying. Test "m3" (ranked: Ann's old op blocks only Ann; Squads: the old coins leg blocks the new coins, the crate op replays).
- **m4.** Core `bonusFor`'s comment and decision note call 8 corrected; core test to 45 wins, 120 draws and others. New server test: a
  Squads member who resigned after 10+ moves.
- **Nits:** n1 FAQ line; n2 `ranked-schema.ts` comments (JS comments only: the schema text and version unchanged); n3 call 13; n5
  call 14 (for PR 3); n6 `CoinTry.won`; n7 `ledger_reason` index in `LEDGER_SCHEMA` (call 15); n8 the folded check in core
  `gameCoins`. n4 left.

## Worth a look

- **Ranked, kept ranks:** `this.record.ranks` is set on the same object `persist()` stores (DuelCore wraps `this.record`), then
  `storage.put("game", …)`. On a restart the constructor reads it back. Left on the record after the outcome goes out (harmless; deleted
  with the room).
- **Solo:** no retry exists (its game is ended before the grant); a settle failure there now costs the result its XP box (XP and coins
  in stay in), where before it cost only the coins line. Call 11.
- **50 v 50:** unchanged code; a settle failure now goes through its existing `soft("xp", …)` (held up to the strict window).
- **The schema:** one new index (`CREATE INDEX IF NOT EXISTS`), so the schema version changes and the run goes once on the next load.
- **Checks changed (old → new):** core "a game's share never drifts" → "…within half a coin…"; server "the bonus steps across a day":
  the burst's exact 300/300 from an empty day → the cap only from mid-day. Test helpers: `memory-db.ts` (statements show `sql` and
  `params`), `duel-do.test.ts` runtime `xpFails`. `squads-lone.test.ts`: comments only.

## Run

`npm run typecheck` (pass); `npx vitest run packages/core packages/server packages/app/test/faq.test.ts
packages/app/test/squads-reward-line.test.ts`: 138 files, 2024 tests, all pass. e2e not run locally (no screen or flow changed).
