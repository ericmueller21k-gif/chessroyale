# Review: PR #1000, the Stranger's rules (full lane: stored data)

Independent, read-only review of `git diff origin/main...origin/claude/stranger-rules` at `04c8fec2` (base `feb4fd35`), xhigh, then
the author's `b0444d72` (pushed during the review: B1's data). Method: read the diff and the server/core paths it touches; ran the PR's
new unit tests at the head (all pass); ran 20 quick mutations (one line opened or removed, the touched test files run, the file
restored) to see which new checks bite.

**Verdict: no defect in the stored data or the unlock itself.** The `boss_unlocks` table, its writes, the sign-in merge, the download
and the delete are correct, and nothing the client sends can unlock him or deal his floor to a non-admin. The gaps are in what the tests
pin, not in the code.

**Update after the review (CI on `b0444d72` and `b28e3980`):** B1 (unit) is fixed: `check` is green on both. **B2 is new and blocks:**
the e2e is red on `b28e3980`, including Eric's Nov 4 guard, because the boss-wide specs can't open his battle (his card is locked).

## Blockers

**B1. `check` is red on the PR head: 5 unit failures, all from moving his kit into `BOSS_KITS`.**
`packages/app/src/characters/kits.ts:1255` (his kit now in `BOSS_KITS`) puts him under every roster-wide character check, and his art
(#992) lacks the data they read. CI's `unit` job (run 45938920759) and a local run agree:
- `packages/app/test/sprite-kit.test.ts:206`: "Stranger: its art's facing (sprites.ts): expected null not to be null". No facing for him
  in `packages/app/src/characters/sprites.ts` (`artFacing`), so no place can turn him to face the board.
- `packages/app/test/boss-result-lines.test.ts:36`: "goodbye: expected undefined to be truthy". No `GOODBYE_LINES.stranger`
  (`packages/app/src/characters/boss-select.ts:253`).
- `packages/app/test/boss-bar-lines.test.ts:53`: six of his lines (`packages/app/src/characters/stranger-lines.ts`) wrap to 3 rows at
  320 px, e.g. "I heard someone strong lives here. Is it you?", "The way home is through the strongest.".
- `packages/app/test/battle-desktop.test.ts:46` and `:52`: no `SIDE_REACH.stranger` or `SIDE_SWING.stranger`
  (`packages/app/src/characters/side-size.ts:66`, `:99`).

The PR body's "Results" names the vitest files that pass and none of these. Failing scenario: merging this ships a boss whose
computer side figure is sized with no reach of its own and whose facing is unknown. **The eric.md guard** `e2e/boss-side.spec.ts`
("whole on screen at rest and at the end of every beat", one case per `BOSS_KITS` boss, Nov 4) now covers him and depends on that
reach. Fix: the characters lane's data for him (facing, goodbye, shorter bar lines, the two reach rows), or keep the kit out of
`BOSS_KITS` until it's complete.

**Status: fixed in `b0444d72`.** It adds:
- `artFacing` "front";
- `GOODBYE_LINES.stranger`;
- `SIDE_REACH`/`SIDE_SWING` rows;
- him to `SIDE_FEEL.overMenu`;
- six shorter lines.

It changes no test. The four files pass locally (77/77), and `check` and `unit` are green on `b0444d72` and `b28e3980`. The PR body
should list `b0444d72`'s new text: the goodbye "Good game. I'll keep looking for the strongest." and the six reworded lines.

**B2. The e2e is red on `b28e3980`: the boss-wide specs open his battle as an admin with no unlock, so his card is locked.** CI run
45941946034 has three failures:
- **`e2e/boss-side.spec.ts:98`, Eric's Nov 4 guard** ("stranger and the God King whole on screen …"), phone and desktop. START stays
  disabled and the test times out at 180 s, so the guard never measured him.
- **`e2e/boss-smoke.spec.ts:99`.** It looks for the open tile "The Stranger", but an admin without the unlock sees "Locked boss: The
  Stranger. Beat him on Battle Tower floor 10". Past that, its `ultimate: true` (the same test) can't pass while `strangerult` never
  fires.

Failing scenario: merged as is, `main`'s full run is red, and Eric's guard reports nothing about him. Fix direction (the director's
call):
- Give these specs a way to meet him unlocked without touching the guard's checks: e.g. the shared e2e helper seeding his
  `boss_unlocks` row for the test account, or a test server's `?boss=stranger` link counting as unlocked. Editing
  `boss-side.spec.ts` itself needs Eric's OK (eric.md).
- For the smoke's ultimate: either a named, recorded exception for a placeholder ultimate or waiting for Eric's. Never a silent skip.

**The `overMenu` call** (`b0444d72`, `packages/app/src/characters/side-size.ts:44`; the author asked for this check) follows Chandy's
precedent and the rule's own words ("over the board or a menu is fine"). No other boss shrinks, because `SIDE_WIDEST` still leaves
both out. Facing "front", he isn't mirrored, so his swing toward the board counts as 0, as Chandy's does. At rest and at every beat's
end he reaches 50 left and 51 right, against Chandy's 57 and 43. Where his room is short, his drawing (101 wide against Chandy's 100) sits
with its right edge at the same place as Chandy's, so his far edge comes 1 sprite px (at most 3.4 screen px at `max`) further out,
inside the 8 px `margin` only if Chandy's case has that slack. His 61 left swing is mid-beat only, which the rule allows. So it's
consistent, but **unproven until B2 lets the guard measure him** at its five sizes, including whether a front-facing figure passes
its "facing the board" step.

**`b28e3980` changed `e2e/boss-select.spec.ts:315`** (an admin's tile count now adds `unlockBosses(…, admin)`): this follows the spec's
own design (counted from the roster), its fit checks are unchanged, and they passed on `b28e3980` with his 22nd tile. It isn't an
eric.md guard. The PR body must list it, old → new.

## Should-fix

**S1. Nothing pins the server's online pick gates, and they're now the only thing between a client's `?boss=stranger` and the runner.**
`chooseBoss` (`packages/core/src/boss.ts:403`) now takes him whenever `wanted` names him (`unlockReady(pick, false, true)`), trusting
each caller to have checked. Each caller does (see "Checked and correct"), but every one of these mutations leaves every server test
green (`boss-party`, `test-switches`, `tower-party` and one more online-boss test file: 117/117):
- `packages/server/src/lobby-options.ts:59`: `canPick(..., unlocked, xpGameOn, true)` (admin on) or `canPick(..., ["stranger"], true)`
  (no unlock needed, unfinished on);
- `packages/server/src/boss-party.ts:17`: `canPick(bossDef(s.boss), ["stranger"], true, true)`;
- `packages/server/src/lobby-do.ts:880`: the party room's write pool as `{ unfinished: true, admin: true }`.

The reads behind them (`packages/server/src/index.ts:332`, the creator's unlocks by session uid; `packages/server/src/squads-do.ts:650-651`,
the leader's) and `towerPoolNow` (`squads-do.ts:765`) have no test either. Failing scenario: a later edit passes `admin` or the device's
list into one of these, and a non-admin's raid or party meets him on production with every check green. Fix (one focused block in the
existing tests): `lobbyOptions(?mode=raid&boss=stranger)` with `[]` and with `["stranger"]`, `xpGameOn` false → no `bossId`; with
`xpGameOn` true and `["stranger"]` → his; the same pair for `bossPartyOverrides`; and the pool `writeTowerEnds` passes without
`testSwitches` has no `stranger`.

**S2. Three of the burn's legal-position guards can be removed with every test green.** In `packages/chess/src/bosses/stranger.ts`:
- `:124` `(!kingAttacked(fen, mover) && kingAttacked(after, mover))`, his king checked by the gap. This one is new in kind: Birdie's
  train only smashes the crowd's pieces, but Frostfire burns his too, so burning his own piece pinned to his king is a case Birdie's
  tests never had.
- `:123-124` `handed`, a promotion handed to him;
- `:63` the back-rank rule in `burnLegalNow` (his pawn right behind your piece on your back rank);
- also `:259`, the strike dropped when its burn falls at or past `bossMaxMoves`.

(Removing `kingAttacked(after, other(mover))` is harmless: `stockfishRefuses` also refuses "the side not to move is in check".)
Failing scenario: a refactor drops one of these, and a burn leaves a position the engine or a later move can't handle, mid-match, with
no test red. Fix: one FEN each in `packages/chess/test/stranger.test.ts:63` ("the burn on its tile"): his own knight pinned to his king
by your rook on the tile → `spared`; your piece on e1 with his pawn on e2 → `chooseStrike` passes it over; a strike whose `burnAt` is the
cap → no strike, no event.

## Nits

- **N1. The merge test doesn't pin "the earlier kept".** `packages/server/test/tower.test.ts:589` sets the guest's unlock at T0+5 and the
  account's at T0+9, so `SET at = excluded.at` (always the guest's) passes too (mutation checked). Make the guest's the later one.
- **N2. FAQ copy** (`packages/app/src/faq/content.ts:999`): `n(s.freezeTurns, "turn")` reads "frozen for your next 1 turn" and "you
  get 1 turn to move it off". Hidden until he's live.
- **N3. Going live is more than taking him out of `BOSS_ADMIN_FIRST`.** `isPlayable`'s `!b.unlock` (`packages/core/src/boss.ts:314`)
  keeps him out of every list built on it for good: tokens (`dropBosses`/`tokenBosses`, `packages/core/src/boss-tokens.ts:26`, `:29`:
  no Stranger token ever, nor an admin's test grant), quest icons (`packages/server/src/quests.ts:194`) and the raid's random pick
  (intended). Worth a line in the decision note on what "live" includes, for the director or Eric.
- **N4. An admin's unlocked pick goes online as a random boss.** His card shows him picked and the online ways to play stay open, but
  `lobbyOptions`/`bossPartyOverrides` pass no admin, so the raid or party meets someone else. Same as Timber today, and the PR body says
  so; only a note in case Eric tests it.
- **N5. A party meets him on the leader's unlock alone** (`squads-do.ts:650`): members who haven't beaten him fight him too. A
  reasonable call, but not in either decision note.
- **N6. The solo unlock is the device's word**, as the best is (the PR says so): once he's live, a modified client unlocks him by posting
  9 floor wins and a 10th, 10 s apart (`soloWinMinSeconds`). Low stakes (an unlock to fight a boss); flagging it because "you have to
  beat him" is Eric's rule.
- **N7. `dealsOut` (`packages/core/src/tower.ts:207`) counts 10, 30 and 50 as deck floors** on a climb that meets him, so the
  deal-out check is off by one floor's draw there. It only affects how well a deck deals out (the deal has its fallback); admins now,
  everyone once live.
- **N8.** `account-data.test.ts`'s `world()` (`:116`) has "something in every store" but no `boss_unlocks` row, so its "no row names her
  after deleting" sweep skips the new table (`tower.test.ts` covers the delete).

## Checked and correct

- **The schema run.** `boss_unlocks` is a `CREATE TABLE IF NOT EXISTS` in `TOWER_SCHEMA`, spread into `SCHEMA`, so `SCHEMA_VERSION`
  changes and each database runs the one batch of IF NOT EXISTS statements once. There's no ALTER and no rebuild, existing tables are
  untouched, and a second run is a no-op. The primary key `(user_id, boss)` serves every read (`WHERE user_id = ?`).
  `account-data.test.ts` pins its columns.
- **Written only server-side, only on a win against him.**
  - `floorUnlocks` (core `tower.ts`) names him only on one of `bossFloors` with him in the floor as the server dealt and stored it
    (`before.floors[floor - 1]`, never the request).
  - Solo or a party copy alone: `finishTowerFloor` → `bestAfter`, a win only, the server-started fight only.
  - Retry: `resultAgain` acts only on a stored `last` with the same id and outcome that isn't a room's, and rewrites idempotently
    (`ON CONFLICT DO NOTHING`).
  - Party: `partyFloorWrite`, the room's write per member, in the same batch as the copy's update, only while that copy's fight is
    this one. A member who left, free or not, never gets a "won".
  - Mutations that fail a test, as they should: unlock on a loss (M1), the floor's bosses ignored (M2), no party unlock (M4), no
    unlock on retry (M8).
- **The loophole is closed.** A life spent on 10, then 11 won: nothing (11 isn't his floor). 30 and 50 count. His floor dealt to others
  and won: nothing. A retry rewrites only a win.
- **The sign-in merge.** `INSERT … SELECT … WHERE … ON CONFLICT DO UPDATE SET at = MIN(at, excluded.at)` meets SQLite's upsert-parse
  rule (a WHERE on the SELECT), the guest's rows are deleted after, and it's in the sign-in batch (`accounts.ts:770`). Download:
  `unlocked: [{boss, at}]`. Delete: `towerDeletes` and `ACCOUNT_STORES` include the table. The privacy page says what's kept and how
  long. Mutations: no merge (M5), no delete (M6): each fails a test.
- **Never trusting the device online.**
  - The tower's pool reads the session's admin (`api.ts:364` `isAdmin(env, current)`; `tower.ts:618`), never the body (mutation M11:
    fails a test).
  - The party's plan pool (`towerPoolNow`) and the room's write pool never pass admin. `unfinished` only where TEST_SWITCHES is "1".
  - Raid creation reads `towerUnlocks` by the session's uid; the party reads the leader's uid from the party record (set at connect from
    the session).
  - `canPick` with no admin means never on production while he's admins first, for anyone.
  - The matchmaker sets no `bossId`; the party's `choose` stores any string but reaches a battle only through `bossPartyOverrides`.
- **A party with a non-admin never deals him.** Its pools lack him. A copy an admin played alone with him dealt on floor 10 is
  re-dealt when the party regroups (`preparePartyFloor` → `startFloor` → `sideRefusal` against the party's pool), and the unlock reads
  the floor as committed.
- **Admins first, for a non-admin.** Floors 10/30/50 deal two bosses as before, and decks shuffle the same (he's filtered out of the
  deck pool). No card (`unlockBosses(…, admin=false)` is empty). The FAQ hides him (`unlockBosses(src.roster)` is empty for everyone
  while he's admins first). `?wip=1` reads through `testParams()` (dev, a test server or an admin only).
- **Frostfire.**
  - Castling rights and the en passant square follow a burn (`withoutPiece` + `keptEnPassant`), and a king is never burnt (mutation
    R4: fails a test).
  - The pick is the same everywhere: `powerRoll` on the seed, ties broken by square.
  - The freeze is a board-layer hold, lifted if it would leave no move.
  - `powerTurn` covers the strike's turn through the burn's (mutation R5: fails a test), so there's no fair-play signal and no Last
    Stand then. `king-save-altered` audits him.
  - No burn once the battle is decided, the board's game is over, or at the cap. The board base is written at `history.length`, as
    Birdie's.
- **Guard tests.** Of `docs/rules/eric.md`'s guards, only `banners.test.ts` changed (his VIEWS row; the checks unchanged; Eric OK'd).
  The decision notes are within 10 lines.

## Not reached

- The e2e runs: on `04c8fec2` it was cancelled; on `b0444d72`, shard 9 failed (the tile count `b28e3980` fixed) and the rest were
  cancelled. On `b28e3980` every shard but 11 and 12 passed, `e2e/stranger.spec.ts` included. What the guard would measure for him
  once B2 is fixed is not known. Whether "front" is the right facing for his art beside the board is the characters lane's call; the
  unit check only asks that there is one.
- The rest of the unit suite beyond the files named here; the sim report; his screen effects (`Stranger.tsx`); the judge's numbers on a
  device against the server's; Squads.
