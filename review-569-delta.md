# Delta review of #569: the review fixes (ac426be..4da22f7)

Read-only review of `git diff ac426be origin/claude/xp-phase1` only, against `review/569:review-569.md` and `.review-fixes.md`.

**Quick checks:** `npm run typecheck` passes. `npx vitest run packages/core/test/xp.test.ts packages/server/test/xp.test.ts
packages/server/test/accounts.test.ts packages/server/test/ledger.test.ts`: 4 files, 73 tests, all pass.

**Verdict: no blocking findings.** Every finding (M1, M2, m1 to m7) is fixed. The fixes added one minor display regression
(D1) and one latent limit worth a comment (D2).

## Each finding
- **M1 fixed.** `api.ts`: `timed` null means `xp: null`, with no grant call at all. An unknown, ended or replayed `game` id is
  also null, because `endSoloGame` takes the game off with DELETE…RETURNING. The win needs `ms >= soloWinMinMinutes`, and that
  `ms` is the server's time (or the forced minutes, which exist only on TEST_SWITCHES servers).
- **M2 fixed, and it holds under concurrent results.** The time leg's source is `solo`. `timeXp` comes from a pre-read
  (`standing`'s `solo`), and the guard `SUM(today's solo xp legs) + timeXp <= limit` sits in the same INSERT…SELECT as leg 0.
  The wallet write is gated on `ours`, so a result that read a stale sum is refused whole (+0) and never over-pays. Its parts then
  say "Daily solo limit +0", or "limit" if nothing was paid. Underpaying a racing result is the safe direction.
  - **The day boundary is consistent.** `day = xpDayStart(game.now)` is computed once and used by the pre-read, both guards and
    `created_at` (`op.now = game.now`, the same ms units). 08:00 UTC is applied in core's `xpDayStart`, which the delta didn't touch.
  - Online time legs keep the game key as their source, so they never count toward the cap. Merge and erase rows use other
    reasons, so they aren't counted either.
- **m1 fixed.** Lobby: `xpgame` is honored only with `xpGameOn = env.TEST_SWITCHES === "1"`. Anywhere else it's one of the test
  switches and sets `tested`. A non-admin's `xpgame` is stripped before that. Solo: an admin's game without TEST_SWITCHES stores
  `SOLO_TESTED` (-1), which becomes `test: true`, and `forced` is null, so the -1 never becomes minutes.
- **m2 fixed.** The duel shows the test line when unranked and the component's neutral default otherwise.
- **m3 fixed.** `ultimateTrigger` sets `overrides.tested` only when the trigger fires (`ok`), and `lobbyXpGame` reads it.
- **m4 fixed, with no false matches.** Ledger ids are `newId()`: 24 lowercase hex characters, so they hold no LIKE wildcards
  (`%`, `_`) and LIKE's case folding doesn't matter. `',' || substr(source_id, 4) || ','` matched against `'%,<id>,%'` only
  matches whole ids, since the ids have a fixed length. Old `vs:a,b` rows read the same way. An old row cut at 512 characters can
  only lose its partial last id (a missed match, which pays a win it should have blocked once), never gain a false one. The old
  `xp-win` rows with source `solo` don't start with `vs:`, so they're excluded. Note that the rule is now "any overlap blocks":
  a win against {B,C} also blocks a later win against {C,D}, even though D wasn't beaten. That's stricter than "per opponent".
  It's what the FAQ line implies, so it's fine as a decision.
- **m5 fixed, and the folded reads return the right values.** `standing` LEFT JOINs `ledger_accounts`, where `user_id` is the
  PRIMARY KEY, so it returns one row. A missing ledger id falls back to `ledgerAccount`. The after-read takes leg 0's `delta`
  for the time op (a replay gets the first attempt's delta, and a refused op has no row, so 0), leg 0's `nonce` for the win
  (present means paid, by this attempt or a replay), and the wallet. All of this is equivalent to the old
  `opOutcome !== "refused"` + `xpOf`. Non-solo games keep the old parts (`timePaid` is only tested for truthiness).
- **m6 fixed.** The app sends `left` for afk, and the server's `abandoned` answers "left".
- **m7 fixed for the waiting → grant case.** `from = min(after, max(before, waited))`, decided once per grant, and the gain text
  and level start from `from`. A finished fill is remembered (WeakSet), so a remount shows the end at once. One gap remains: a
  box unmounted mid-fill replays from `before` on the next mount. That's known, and it's display only.
- **Nits:** an old app's `moves` is now NULL. The `endSoloGame` comment is added.

## D1. Minor (regression): a box that mounts with `xp === null` shows "Level 1" and an empty bar
`packages/app/src/components/XpResult.tsx:29-30`. `waited` reads the profile only when `xp === undefined` at mount. `still` is
then `xp ? xp.before : (waited.current ?? 0)`. So a box whose first render already has `null` (no grant) uses 0. Before the
fix, `still` was the profile's XP.
- **Scenario:** a level-12 player finishes a duel and the outcome arrives with `xp` missing: an unranked test clock, a grant that
  threw, no DB, or a null `recordDuel` answer. `DuelResult` mounts with `snap.outcome` already set, so the box gets `null`. The
  same happens on any remount after the answer settled to null (Squads' card → results, the online answers map). Since M1, a
  solo result with no server game also answers `xp: null`. The box reads "Level 1" with an empty bar beside "No XP for this
  game." The same is true of `aria-valuenow`.
- **Fix (one line):** `useRef<number | null>(xp ? null : (account().profile?.xp ?? 0))`, which reads the profile for both
  `undefined` and `null`. Optionally add a check in `e2e/xp.spec.ts`'s no-XP case that the level shown equals the profile's.

## D2. Nit (latent): the friends' cap guard binds one parameter per opponent, against D1's 100-per-statement limit
`packages/server/src/xp.ts:158` and `ledger.ts:241-251`. Leg 0's INSERT binds 10 + 2 + the guard's (2 + n) = 14 + n
parameters. More than 86 opponents with accounts would throw on D1 (the local SQLite in tests has no such limit, so no test can
catch it). That throw fails the winner's grant (both legs: it's one batch).
- **Today it can't happen:** `xpOpponents` is the other team in Crowd (about 50) and everyone else in Classic (63 at most), so
  the worst case is 77 parameters. It breaks if a lobby ever has more than 86 accounts on the other side, for example a
  teamless Crowd or bigger lobbies.
- **Fix:** bind the ids as one JSON parameter: `EXISTS (SELECT 1 FROM json_each(?) j WHERE (',' || substr(source_id, 4) || ',')
  LIKE '%,' || j.value || ',%')` with `JSON.stringify(ids)`. That's constant parameters, the same match, and the same idea as
  `deleteItems`. Or at least add a comment next to `ledgerIds`' chunking that says the guard isn't chunked.
