# Delta review: Payments PR 4, the review fixes (#966)

Independent delta review, full lane (wallets). Read-only on `claude/pay-boost`. The delta reviewed is `2dcde2b7..4b67a5d0`: the merge
of `main` at `204b305d` (PR 5, purchases storage), then `ed24370b`, `7cbedc7a` and `4b67a5d0`. The later merge of `main` at
`70ee387d` (#964, the boss frame) is outside it and touches none of the payments files. Nov 26, 2026.

## Verdict

**No blockers, no majors, no minors. Two nits, neither needs code.** Each fix does what `REVIEW.md` asked, and each has a test that
fails without it (I reverted each one to check). No over-pay anywhere. The merge with PR 5 is a clean union, and PR 5's
`applySpend` is untouched and still the only coin spend. Ready to merge on green CI.

## What I ran (at `4b67a5d0`, in a throwaway worktree)

| Run | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npx vitest run packages/core packages/server` | **140 files, 2,041 / 2,041 pass** |
| Same, with both drop odds forced to 45% (local edit) | 2,039 / 2,041. The only 2 failures are core's settings block and its 60,000-key odds test, which check the odds by design. **The whole server suite passes**, so no server test still depends on chance (B1). |
| B1 reverted (ids not drawn), odds forced | 4 fail: `quests.test.ts` "the game that finishes a quest pays it" (`:308`) and "a replay of the finishing game" (`:326`), plus 2 `rolling()` cases in server `coin-boost.test.ts` |
| M1 reverted (`paid = counted`) | 2 fail: core and server "the game that reaches the day's 300 …" |
| m1 reverted (no floor) | 2 fail: core and server "a short game uses at least COIN_BOOST.minGameMinutes …" |
| n1 reverted (the old guard) | 1 fails: server "a boost worked out with no bonus while the ledger has the game's bonus is refused …" |
| `boostFor` over every input (play 0-60, 9 bonuses, minutes 0 to `XP.maxMinutes`, 13 values of minutes left) | never more than round(1.5 × base), never more minutes than are left, never coins without minutes, nothing past the 300 |
| `boostFor` on every whole online game (0 to `maxMinutes` minutes, play coins from `playCoinsFor`) | uses max(its minutes, 5): M1 changes nothing for a game the day's cap didn't trim |
| `boostFor` on the exact multiples of 1.8 (9 … 324 play coins) | exactly play / 1.8 minutes: the `- 1e-9` works |
| The test switch's draws, 20,000 deals of a `boost` | mean 25, p99 113, max 263 draws. A miss in 10,000 at 4% is e^-408. |

## Findings

### N1 (nit): the 5-minute floor also applies to the game that crosses the 300

- **Where:** `packages/core/src/coin-boost.ts:60-61` (`cost = max(paid, minGameMinutes)`). The decision note's call 2
  (`docs/decisions/2026-11-26-coin-boost.md:5`) says "past the day's 300 it waits, so its minutes always buy boosted play coins".
- **Scenario:** the day stands at 299, the boost is on, and the player finishes a 30-minute game with no bonus. It pays 1 play coin.
  Its coins paid for 1 minute, but it uses 5, for 2 extra coins.
  - A crossing game that pays 1 to 7 play coins uses 4, 3, 3, 2, 2, 1, 1 minutes more than its coins took.
  - That's at most about 11 coins of boost value, once a day, and only under-pay.
  - With a win it's 5 minutes for 24 extra, the same as a short win, which is what the floor is meant to do.
- **Fix:** none in code (simple beats flashy). Optionally add a clause to call 2: "(the floor applies to it too: from 299 it uses 5)".

### N2 (nit): n1's guard closes one order of a race, not the other

- **Where:** `packages/server/src/coin-boost.ts:83-90`.
- **Scenario:** two attempts at the same game's grant at the same moment, A and B. A reads the game's coins (bonus not in yet), then B
  writes the bonus op.
  - If B's write lands before A's boost write, A is refused (n1) and B boosts the play coins and the bonus. That's the fix.
  - If it lands after, A boosts the play coins only, and B finds A's boost and answers it, so the bonus goes unboosted. That's the
    same under-pay as before n1.
- **How likely:** it needs two concurrent attempts with different views of the bonus. The duel room's retries come one after another,
  a room restart ends the attempt before it, and solo pays no bonus. I found no real path to it.
- **Fix:** none needed. The ledger stays right either way. A's own answer can lack the boost that B paid, which only matters for a
  card that A shows.

## The brief's questions

1. **B1: the drawn ids can't reach production; the cap is safe.**
   - `setTestQuests` is reached only from `POST /api/quests/test`, which checks `env.TEST_SWITCHES === "1"` itself (`api.ts:833`;
     there is no admin path). Only the staging env sets it (`wrangler.jsonc:113`), and production's vars don't.
   - Production's `ensureQuests` and the reroll still deal with plain `newId()`, and `questStatements` builds the same key
     (`questOpId(def.id, q.id, me.account)`) that the switch draws against. The roll and the odds are unchanged.
   - Side effects are on test servers only:
     - The switch now creates the account's ledger id early (`ledgerAccount`). The whole suite passes with that.
     - A user that doesn't exist now gets 400 instead of a silent no-op.
   - An unknown drop (`gold`, `__proto__`, `toString`) is refused (`Object.hasOwn` on a literal). A missing drop, or `?quests=warm-up:2:`
     with an empty one, means none.
   - The cap: at 4% a miss is e^-408, so it only matters when the odds can't give the asked drop. Then 6 quests × 10,000 draws cost
     about 140 ms (Node), answered 400, on a test server only.
2. **M1/m1: `boostFor` is exact at the edges, with no over-pay.**

   | Case | Answer |
   | --- | --- |
   | 290 + a 30-minute game (10 play coins) | `{ coins: 15, minutes: 6 }`, 114 left (server test). With a win: 38 for 6. |
   | A 40-second win (1 play coin, 15 bonus) | `{ coins: 24, minutes: 5 }` |
   | Fewer than 5 minutes left: 3, then a 40-second win | `{ coins: 14, minutes: 3 }` (3/5 of it) |
   | The last minutes: 2 left, a 30-minute win | `{ coins: 7, minutes: 2 }` |
   | The last minutes: 1 left, a 30-minute game | `{ coins: 3, minutes: 1 }` |
   | The last minutes: 1 left, a 40-second game with no bonus | nothing used (0.3 rounds to 0); the minute waits for the next game |

   - Over-pay is impossible by construction: `used ≤ cost`, so the extra is at most round(1.5 × (play + bonus)), and the guard's
     `boost_minutes >= used` is in the same statement as the debit.
   - Solo passes the minutes XP paid, so a solo game trimmed by its daily cap gets the same treatment.
   - **The director's call (`minGameMinutes` 5):** I found no abuse the daily caps don't bound. The extra is at most 1.5 × the game's
     base coins, and the base is capped at 300 + 300 a day, so the boost can never add more than 900 coins in a day, however many
     crates or games.
3. **n1 can't starve a legit boost.**
   - The new `NOT EXISTS` refuses only when the game's bonus op is in.
   - It's only ever written with a positive amount (`coinOps`: `c.bonus > 0`), so when it's in, the attempt that wrote it reads it
     back (`paidOf`) and boosts with it. If that attempt throws first, the callers retry the whole grant, which reads it.
   - Solo and the old-code games never write one, so for them the clause always passes.
   - The one remaining gap is N2 (under-pay only).
4. **The union merge with PR 5.**
   - `AssetKind` has `purchase` and the 3 new kinds. `HOLDINGS` has the purchase row and the 3 wallet rows.
   - The merge's ledger legs (`BALANCES`) and the erase cover every kind. The wallet's merge statement is built from `WALLET_COLUMN`
     (8 counts). PR 5's `UPDATE purchases` / `refunds` moves are kept.
   - The download keeps the 3 counts in `wallet`, and purchases are PR 5's own.
   - `account-data.test.ts`'s `SCHEMA_COLUMNS` has PR 5's `purchases`, `refunds` and `users` columns and PR 4's `wallets` columns.
     `ledger.test.ts` is main's whole, correctly: PR 4 never touched it.
   - `purchases.ts`, `payments.ts` and `spendLegs` are byte-identical to `main`'s.
   - The only coin debit in the server is `spendLegs`, called only from `applySpend` (`purchases.ts:328`). The boost credits through
     `leg.coins`, which throws on a negative amount and only ever gets `use.coins > 0`.
   - m2 is in: `purchases.test.ts` expects the 3 zeros and passes.
5. **The tests prove each fix.** See the reverts above: B1 4 fails (at forced odds; at today's odds `rolling()` fails about 92% of
   runs), M1 2, m1 2, n1 1. m3's copy is pinned by core's `rewardLines` test, m2 by PR 5's migration test. The R3 and R4 races are
   now tests and pass. The PR's changed-checks list matches the diff.
