# Review of #569: XP and levels, phase 1

Independent read-only review of `origin/main...origin/claude/xp-phase1` at `ac426be`. Read against the
design (v2) and `brief-xp-phase1.md`, CLAUDE.md, LESSONS.md, `docs/areas/accounts.md` and `ledger.ts`'s header.

**Quick checks:** `npm run typecheck` passes. `npx vitest run packages/core/test/xp.test.ts packages/server/test/xp.test.ts
packages/server/test/ledger.test.ts packages/server/test/account-data.test.ts`: 4 files, 60 tests, all pass (the ledger's
reconciliation and "nothing else writes a balance table" guard included).

**Verdict: no blockers.** Two majors are about farming solo XP. Both are bounded today and cheap to fix, but they matter before
phase 2 ties level-ups to crates and keys. Everything below the majors is minor or a nit.

## What holds (checked)
- **Once per game:** the op ids `xp:<game>:<ledger id>` and `xpwin:<game>:<ledger id>` use ON CONFLICT DO NOTHING, and the wallet
  write is gated by the nonce (`ours`). A replay, two calls at once, a room restarting before `resultsSaved` is stored, or a duel's
  record retry all grant once. The keys are stable across restarts: lobby code + `startedAt`, squads code + `createdAt`, the duel's
  `f.id`. `opOutcome` returns "replay" on a repeat, so the parts are answered again. Solo replays get a fresh random key, but
  `endSoloGame` DELETE…RETURNING times a game once (see the majors for what a replay can still win).
- **Ledger:** `xp` is in `HOLDINGS`, so the daily check, merge (`mergeMoves` adds `xp` too) and erase (`eraseMoves` closes it)
  cover it. `setTestXp` goes through the ledger with a non-negative guard. The cap guards run in the same statement as the leg.
- **Migrations:** `wallets.xp INTEGER NOT NULL DEFAULT 0` and five nullable `results` columns go through COLUMNS, and `solo_games`
  through SCHEMA (CREATE IF NOT EXISTS), so a fresh database and a migrated one end the same. Old rows stay NULL, so `xpFromRow`
  returns null and no box shows. The protocol fields are all optional, so old apps ignore them.
- **Server facts:** in the lobby, moves are counted only from real `pick()` calls, and the time ends at the last pick
  (`pickedAt`), so a knocked-out player's time stops at their last move. Squads uses `played[id].at`, measured from `bracketAt`.
  `replacedByBot` is cleared when the player returns. An abandoned leaver (away/afk/kicked) gets "left". The duel uses the room's
  clock and plies. The device can't override `playMs`, `moves` or `xp` on the solo path (the server's values are spread last).
- **App:** the box is a fixed 78 px with `contain: strict`. Only `transform` and text change per frame. `xpAt` is eased and
  monotonic, and a level's end shows full before the bar empties. Reduced motion jumps straight to the end state and never shows
  the pop. The "No XP" lines come from the shared `XP_NONE_LINES`, so the app and the server can't disagree on the words.
- **Privacy:** download my data includes the wallet's `xp`, each result's five columns and the open solo game. Delete erases
  `solo_games`, closes the balance and blanks `xp_before` on kept results. `GET /api/xp` only reads your own rows. The public
  profile shows only `level`.

## Major

### M1. A solo win pays with no game the server timed (or one it timed for a second)
`packages/server/src/api.ts:589-597`. The solo result path pays the win whenever the body says `won: true` and `moves >= 10`, both
the device's word. The server's clock isn't checked for the win at all.
- **Scenario:** a signed-in player (or a script) sends `POST /api/results {placement:1, players:64, won:true, moves:10}` five times
  with no `game`. `timed` is null, so `ms` is 0 and the key is `solo:<uuid>`. Each call returns "Win +50", so that's 250 XP every XP
  day without playing. The same works with a real `game` id that was started a second earlier. The decision note says "a result
  with no server start counts 0 minutes", but the win still pays.
- **Fix (one or two lines):** treat a solo result as untimed when `timed` is null, so no XP at all (or "short"). And/or pay the
  solo win only when `timed.ms` is at least a floor in settings (for example `XP.soloWinMinMinutes`, or the boss tokens' 5 minutes).
  Add a test to `server/test/xp.test.ts`: no `game` plus `won: true` gives nothing.

### M2. Solo time XP can be farmed by waiting (not blocking phase 1; fix before phase 2's crates and keys)
`packages/server/src/xp.ts` (`startSoloGame`/`endSoloGame`) and `api.ts:589-600`. The server's clock only proves that time passed.
The moves are the device's word, and solo has nothing like online's idle removal.
- **Scenario:** a script loops: `POST /api/xp/solo/start`, wait 30 minutes, `POST /api/results {game, moves:10, placement:2,
  players:64}`. That earns +300 XP every 30 minutes, around the clock: about 14,000 XP (14 levels) a day per account with no
  play. A real player can't come close online. This matches the boss tokens' solo rule the design copied, but XP buys crates
  from phase 2.
- **Fix:** a daily cap on solo time XP, using the same guard pattern as the solo win cap. Give the time leg `source_id 'solo'` and
  add a `when` that keeps `SUM(delta)` for reason `xp`, source `solo`, this XP day under `XP.soloMinutesPerDay × perMinute`. Or
  record it as a known limit in a decision note and in phase 2's brief. Eric's call on the number.

## Minor

### m1. `?xpgame` pays real XP on production (admins) and to everyone in an admin's lobby
`packages/server/src/api.ts:572`, `packages/server/src/lobby-options.ts:83`, `packages/server/src/lobby-do.ts:607-617`.
`testSwitchesOn` is true for admins on hunchess.com, and `forced !== null` sets `test: false` while forcing 30 minutes and
`minMoves`.
- **Scenario:** an admin opens a private Crowd lobby with `?xpgame=30`. Every human who joins and stays to the end (even with 0 moves)
  gets "30 min +300" and maybe "Win +50", as real XP under reason `xp`. Solo `?xpgame=30` does the same for the admin's own
  account. That breaks the rule that a test switch means "No XP: test game."
- **Fix:** honor `xpgame` only where `env.TEST_SWITCHES === "1"` (the e2e and test servers). Elsewhere, treat it like any other
  switch (`tested: true`).

### m2. The duel's box says "the game ended before move 10" whenever `xp` is missing
`packages/app/src/screens/Duel.tsx:438` passes `none={XP_NONE_LINES.short}`. But `outcome.xp` is also missing for:
- an unranked game on a test clock (`outcome.unranked`);
- a grant that threw (`withXp` catches it and drops `xp`);
- a server with no `DB`;
- a recorded game whose `recordDuel` answer is null.

So a 40-move game can read "No XP: the game ended before move 10." Fix: use `XP_NONE_LINES.test` when `outcome.unranked`, and
otherwise the component's default "No XP for this game."

### m3. The admins' boss-ultimate test trigger doesn't make a raid a test game
`packages/server/src/lobby.ts` `ultimateTrigger`. The brief says no XP for "any test switch or test control". The trigger
changes the battle for everyone, but `overrides.tested` is never set, so every human in that raid still earns XP (and the win).
Fix: set `this.r.overrides = { ...this.r.overrides, tested: true }` (or a `testUsed` flag `lobbyXpGame` reads) when it fires.

### m4. The friends' win cap is per set of opponents, not per opponent, so it barely bites
`packages/server/src/xp.ts:114-123`. The director's call was "once per opponent per day". The code keys the guard on the whole
sorted set.
- **Scenario:** with two alts B and C, account A wins vs {B}, vs {C} and vs {B, C}: three wins a day. With n alts that's 2ⁿ−1. In
  a Crowd friends' lobby the set changes whenever anyone joins or leaves, so the cap rarely repeats.
- **Fix:** guard on any overlap instead. Write one leg per opponent's ledger id (source `vs:<id>`), or check
  `NOT EXISTS (… source_id IN (vs:<id1>, vs:<id2>, …))`, or record it as a decision. (A friends' lobby against bots only being
  uncapped is already recorded as a decision.)

### m5. XP adds sequential D1 round trips per player before the room's record is stored
`packages/server/src/lobby-do.ts:214` → `saveResults` → `grantXp`. Each player adds about 6 sequential queries: `standing`,
`ledgerAccount`, the batch, two `opOutcome` and `xpOf`. On top of that comes one `ledgerAccount` per opponent for each winner in a
friends' lobby. All of it happens before `this.store()`. In a 100-person private Crowd that's about 50 winners × 50 opponents, so
about 2,500 extra lookups. Fix: read the opponents' ledger ids in one `WHERE user_id IN (…)` query. Optionally fold `xpOf` and the
two `opOutcome` reads into one SELECT. `ops` may want to measure it.

### m6. Solo "afk" counts as resigned, not left
`packages/app/src/App.tsx:417`: `resigned` includes `how === "afk"`, and the server only hears `resigned`. A solo game the device
ended for idling, with 10 or more moves, earns time XP. Online, the same thing is "No XP: you left the match." It's the device's
word either way, but the reasons should match: send `left: true` for afk and have the server answer "left".

### m7. The wait → grant handoff can step the bar backwards
`packages/app/src/components/XpResult.tsx:28`. While waiting, the bar stands at `account().profile.xp`. If the profile refreshes
before the grant arrives, the bar is already at `after`. That can happen online, where the room writes before the second ask, via
the TokenBox's or WelcomeNotice's `refreshProfile` (2.5 s). When the grant lands, the bar jumps back to `before` and fills again.
Also, Squads' OutCard → SquadsResults remounts the box, so the fill plays again from `before`. Fix: capture the waiting XP once,
when the match starts (or on mount, from a ref), and skip the fill on a remount once it has finished (keep "filled" next to the
answer in `xp.ts`'s `answers` map).

## Nits
- `api.ts:590`: an old app's solo result stores `moves = 0` and `xp_none = 'short'`, not NULL as the `accounts.ts` comment says
  ("NULL … a solo result from an app before XP"). Store `null` when `b.moves` is missing.
- `xp.ts` `grantXp`: `before = after − gained` reads the wallet after the batch. If another game's XP lands in between (a squads
  reward flush and a solo result at once), the box starts from the wrong place. It's display only.
- `endSoloGame` deletes the open game before `grantXp`. If the grant throws, that game's time is lost, and a retry can't recover
  it. Acceptable, but say so in the comment.
- The PR body's "PAUSE_REWARDS not built" is fine for phase 1. Note it in phase 2's brief, since crates will hang on XP then.
