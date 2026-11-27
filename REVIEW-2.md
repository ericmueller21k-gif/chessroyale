# Delta re-review: PR #1000, the Stranger's rules (full lane), Nov 27

Read-only, xhigh. Scope: `git diff 04c8fec2..origin/claude/stranger-rules` at `f9d9ee11`: b0444d72, b28e3980, 9e59c8c3, a9260122
and the fix round 53b5d4cc..61dc732e (13 files, +119 −21). There's no main merge in the range: `origin/main` is still `feb4fd35`, the
PR's base. Method: read the delta and the paths it relies on; ran the four changed test files at the head (89/89); ran 21 one-line
mutations against the touched server and chess tests (each restored); read CI on the head (both workflows complete).

**Verdict: no blocker.** Every finding the first review asked to fix is fixed, and its new checks catch what they were written for. CI on
`f9d9ee11` is green:
- `check`: success.
- e2e: the whole suite (133 files, 15 shards, `full-e2e`): success. Eric's Nov 4 guard measured the Stranger and passed on the first try,
  on phone and desktop.

Two guards the first review listed are still unpinned (should-fix below). In both cases the first review's own "Fix" line left them out.

## Blockers

None.

## Should-fix

**SF1. The party's plan pool still has no check (the rest of S1).** `packages/server/src/squads-do.ts:766` (`towerPoolNow`:
`{ unfinished: this.env.TEST_SWITCHES === "1" }`). Two mutations leave every test green: adding `admin: true`, or `unfinished: true`
regardless of TEST_SWITCHES. That's 107/107 across tower-party-do, tower, account-data, boss-party, boss-party-do and test-switches.
This pool is what `preparePartyFloor` gives `startFloor`, and `startFloor` re-deals a copy's floor only when `sideRefusal` rejects its
bosses (`packages/core/src/tower.ts:274`).

Failing scenario: an edit widens the pool, and an admin who was dealt him alone on floor 10 regroups with a player. The party keeps that
deal, and the player meets him on production while he's still admins first. Fix: one block in `tower-party-do.test.ts:347`. Without
TEST_SWITCHES, a party regrouping on a copy dealt `["stranger"]` on floor 10 is re-dealt without him; with it, he stays. The pool
`writeTowerEnds` uses (the other party pool) is now pinned (see Checked).

**SF2. The burn's `handed` guard can still be removed with every test green (the rest of S2).** `packages/chess/src/bosses/stranger.ts:124`
(`!moves.length || handed ||` → `!moves.length ||`): 46/46 in stranger and boss-kit. Removing it changes the burn's outcome: with his
pawn walked to d2 behind your frozen d1 knight during the freeze, the burn clears his promotion square.

Fix: one line in `packages/chess/test/stranger.test.ts:85`'s block. `frostfireOutcome("4k3/8/8/8/8/8/3p4/K2N4 b - - 0 1", "d1")` is
`spared: true` at the head, and the burn goes ahead once the guard is removed. Checked both ways: no other guard spares it.

## Nits

- **N-a. The smoke skip is keyed on the id, not on "a placeholder".** `e2e/boss-smoke.spec.ts:105`
  (`powersOf(def) === "strangerult"`). If Eric's ultimate keeps the id `strangerult`, the skip quietly outlives the placeholder; the
  comment and the PR body are the only reminders. Put a line in his row of `docs/areas/bosses.md` (or under the smoke's template at
  `:1216`) saying the smoke skips him until his ult and that the ult PR removes the skip, and add the same to the ult's brief.
  `chess/test/stranger.test.ts:194` ("a placeholder that never fires") has to change in that PR anyway, so the brief can point from it
  to the smoke's skip.
- **N-b.** `powersOf` (`e2e/boss-smoke.spec.ts:41`) returns the ultimate, not the powers. `def.powers?.ultimate === "strangerult"`
  inline would do with no helper.
- **N-c.** `docs/decisions/2026-11-27-stranger-unlock-win.md` is 10 lines but 135 words (the cap is about 120).
- **N-d (CI, not this delta).** One flaky test on the head: desktop `e2e/zebra.spec.ts:89` ("Expected: play, Received: results" at
  `:16`: his battle ended before the test's next move), which passed on retry. Neither the delta nor the PR touches that boss's paths.
  On `main`, a test that passes only on retry turns the run red, so watch main's run after the merge.

## Checked

- **B1** (the roster-wide unit checks): the `unit`, `chess (1)` and `chess (2)` jobs pass on `f9d9ee11`. The PR body lists the goodbye and
  the six reworded lines word for word.
- **B2, Eric's guard:** in `e2e/boss-side.spec.ts:98`, "stranger and the God King whole on screen …" passed on phone (`✓ 43`, 9.7 s) and
  desktop (`✓ 141`, 11.8 s), shard 11 of run 45945702008, first attempt. That covers the five sizes, the drawing inside the window,
  clear of the move list, and facing the board (front: not mirrored).
  - He's the boss it measures: `?boss=stranger` with `asAdmin` gives `chosenBoss(hidden)` → `adminPlayable` (`Home.tsx:142`), then
    `chooseBoss` → `unlockReady(pick, false, true)` (`packages/core/src/boss.ts:403`).
  - The guard's file is unchanged in the delta, as is `banners.test.ts`.
- **`SIDE_FEEL.overMenu` gains him** (`side-size.ts:44`): the guard above passes at all five sizes. `SIDE_WIDEST`
  (`side-size.ts:171`) filters him out, so no other boss changes size. `battle-desktop.test.ts:103` (an overMenu boss whole in the
  window) passes in `unit`.
- **a9260122** (`Home.tsx:731`, `unlockPicked = lockedPick(pick) && !bossInUrl()`):
  - `bossInUrl` reads `testParams()`, which is empty unless the app is on Vite's dev server, the server has TEST_SWITCHES on, or the
    account is an admin (`test-switches.ts:11-21`). So on production only an admin's link skips the lock, and only in solo. Online:
    - a raid or a party drops him for anyone without the unlock (`lobbyOptions` and `bossPartyOverrides` pass no admin);
    - App's `?boss=` for a lobby goes through `chosenBoss()` without `hidden`, so a link alone never asks for him;
    - the tower deals on the server.
  - The lock without a link still has its e2e: `e2e/stranger.spec.ts:78` (opened with `/?debug&wip=1`, no `?boss=`) checks his card
    locked and every way to play greyed, then unlocked after floor 10. It passed in CI. A hidden boss's lock (`hiddenPicked`) is
    untouched.
- **9e59c8c3** (the smoke skip, `boss-smoke.spec.ts:105`): only the boss whose ultimate is the placeholder is skipped, with a reason
  string. The comment and the PR body both say Eric's ultimate PR takes it out. His card and Frostfire are covered by
  `stranger.spec.ts` (both tests passed in CI). Recording it is N-a.
- **b28e3980** (`boss-select.spec.ts:315`): listed in the PR body (21 → 22); passed in CI.
- **S1, the gates the first review asked for: each caught** (`tower-party-do.test.ts:347`).
  - Mutations:
    - `lobby-options.ts:59` with admin on, with `["stranger"]` in place of the unlocks, and with `unfinished: true`;
    - `boss-party.ts:17` with admin on and with `["stranger"]`;
    - `lobby-do.ts:880`'s write pool with `admin: true`, with `unfinished: true` and with `unfinished: false`.
  - The `BOSS_ADMIN_FIRST` assertion makes going live fail this block, so it gets rewritten then, as its comment says.
- **S2, the three FENs: each caught** (`stranger.test.ts:85`, `:91`, `:96`).
  - The pin's gap guard, the back-rank rule (`burnLegalNow`), and the cap.
  - The cap fails both as removed and as `<=` in place of `<`. With `maxMoves` 4 and then 3, the case pins both sides of the boundary.
  - The pinned-knight FEN is spared by that guard alone. The other guards don't fire: no move is lost, there's no promotion, and the
    side not to move isn't in check.
- **N1** (`tower.test.ts:589`): `SET at = excluded.at`, `DO NOTHING` and `MAX(…)` each fail the merge test.
- **N8** (`account-data.test.ts:120`): dropping `boss_unlocks` from the account stores fails "every table is accounted for". Dropping
  it from `towerDeletes` fails account-data's delete sweep (and tower.test's). An empty download fails both downloads.
- **N2** (`faq/content.ts:999`): with the settings (1 and 1) it reads "frozen for your next turn" and "you get one turn to move it
  off". `countWords` is the file's existing helper (`:245`).
- **N3, N5, N6:** in the decision note, as asked.

## Not reached

- `index.ts:332`'s read (the creator's unlocks by session uid) and `squads-do.ts:650-651` (the leader's): still unpinned, as in the first
  review; its Fix didn't ask for them, and I didn't re-raise them.
- No e2e run locally (CI ran it all). The zebra flake's cause (N-d). The PR body's length.
