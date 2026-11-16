# Four flaky e2e tests, three causes (Oct 16, 2026)

CI's `e2e` run listed these as flaky (passed only on the retry). Each was traced to its cause from CI's logs and the
failing tries' page snapshots, and reproduced locally before anything changed. No assertion was loosened, skipped or
given a longer timeout. None was a game bug: two were test setups that no longer held, one a test racing the machine's
frame rate. One real inconsistency in the judge turned up on the way; it's queued on its own (below), not changed here.

## A lash the frames skipped: `king-attack.spec.ts` "the God King's Last Stand against Hollow" (phone)

- **Seen:** the lashes the test saw were 1 to 9; lash 0 never showed in any frame it sampled (job 116794019958).
- **Cause:** the test raced the machine's frame rate. It read the attack's `data-hit` (the lash just landed) once an
  animation frame, and each lash holds it for 170 ms (`KING_ATTACK.lashEveryMs`), so one frame longer than that skips a
  lash. The game's own work there is light: on a phone slowed 4 times (CDP CPU throttling), 10 Last Stands had no
  frame over 86 ms during the attack's 2.8 s (their only long frames, 100 to 175 ms, are where the Last Stand starts
  and ends, as the screens change). The long frame came from the runner, which two Chromiums,
  workerd and their Stockfish workers share (the other worker was in `formats.spec.ts`). Reproduced: one 280 ms stall
  of the page's main thread at the first lash, as a starved runner gives, made exactly CI's result (lashes 1 to 9) in
  5 of 5 runs. Without it, 0 of 20.
- **Fix:** each lash's "−N" says which lash it is (`data-lash` on `.ka-hp`, `KingAttack.tsx`; nothing a player sees
  changes) and stays on screen for a second. The test checks that all ten lashes' numbers showed, and that the
  attack's beat (`data-hit`) only goes forward, to the last lash. The claim is the same, every lash lands with its "−N";
  the evidence is now what a player has a second to see, not a 170 ms marker. Under the same 280 ms stall: the old check
  failed 5 of 5, the new one passed 5 of 5. Hollow's mate test had the same check and takes the new one.

## Loose bots that kept up: `crowd-hidden.spec.ts`, the solo and online boss finals' "you reached the final"

- **Seen:** you weren't among the four who meet the Hidden Boss: solo (phone) on main's run at 49028fc, online
  (desktop) on #246's. In the online failure the four had 44.5, 43.3, 40.5 and 40.5 points and you were out, 9th.
- **Cause:** the test setup no longer guaranteed what it relied on. `?weakbots=1` (Oct 14) promised that a test playing
  the engine's best move reaches the top 4, because loose bots fall behind. The opening allowance (Oct 15) took that
  away: with `rounds=2` the knockout is over by move 14, losses up to 8 points are forgiven through move 10 (less up to
  move 14), so a loose bot scores exactly as the engine's best move does on nearly every move, and several on each team
  end level with you. Only two of each team go on, and that last cut is strict. Then one move decides it: the judge's
  final numbers sometimes rank a bot's pick above the engine's first choice, which the test played (the re-check of
  close calls promotes it, or the separate search over picks outside the top 8 scores it higher), and the test's
  player alone loses those points. Logged locally, online failed 2 of 6:
  - Rd1 on move 12, where the re-check made Re1 the best: 9.85 points (5.85 counted). You ended on 26.1, third on
    White behind two bots on 30.4 and 27.9, while Black's two went through on 21.9.
  - Qe2 on move 13, charged 7.55 (5.55 counted) against a pick scored above it: you on 7.5, the bots level on 13.1.

  Every other move of yours scored 0. Solo: 0 of 6 locally (the same judge; it happens less often).
- **Not a game bug:** the judge did as designed (a deeper look found a better move). One related inconsistency did show:
  a pick the second search scores above the best move never becomes the best move, so the reveal can say "you found
  the best move, Qe2" while charging 7.55 points. It's a judging change (engine lane), so it's queued as its own task.
- **Fix:** `?weakbots=1` now also ranks people above bots in the standings (`peopleFirst`, in `WEAK_BOTS`;
  `standings()` in `match.ts`), so every cut takes bots first and the test's player surely reaches the final, solo
  and online. It's off unless the switch sets it, and the switch works only for admins and where `TEST_SWITCHES` is on
  (never for players). Unit test: `cut-ties.test.ts`. The tests still play the engine's best move and their assertions
  are unchanged (the messages now say why you're through).
- **Turned down:** making the test's move the judge's final best. The re-check picks its close calls from everyone's
  picks after they lock, and online the host scores with its own settings, so turning the re-check and the bots'
  random moves off for the test would need a protocol change. Longer stages, past the allowance, would add minutes to
  each test and still leave it to the odds.

## Your own name in the cut: `crowd.spec.ts` "narrow phones: … the cut lists whole rows of names" (phone)

- **Seen:** a name in the cut's list not struck through (#247's run). The failing try's page: "You're out, in 99th
  place", and the list's first name "You".
- **Cause:** the test setup. To reach the first cut it submitted a bot's planned pick as your move. Every bot, even the
  strongest, plays a random legal move 2% of the time (`botRandomMoveChance`), so now and then that pick is a bad first
  move, and the test puts you only a few points above your team's cut line (its made-up scores, there for the widest
  numbers in the top bar). Out, your name heads the list as "You" in red, not struck through, by design
  (`.cut-out .cut-name.you`). The try lasted 21.6 s, a normal first pass, so no move was missed on time. Locally 0 of
  10; forcing one bad first pick (1.g4 for White, 1...b5 for Black) gave CI's failure in 4 of 4 runs (100th place each
  time).
- **Fix:** the test plays the engine's best move (`engineTop`, as the other Crowd tests do). No pick scores better than
  yours, so you stay above the line; the test checks that you went through before it reads the names.

## Before and after (local, `--repeat-each`, failures over runs)

| Test | Before | After |
| --- | --- | --- |
| `king-attack.spec.ts` the Last Stand (phone) | 0 / 20; a 280 ms stall at the first lash: 5 / 5 | 0 / 10 (the file, both projects: 0 / 40); the same stall: 0 / 5 |
| `crowd-hidden.spec.ts` online (desktop) | 2 / 6 | 0 / 6 |
| `crowd-hidden.spec.ts` solo (phone) | 0 / 6; CI 1 | 0 / 6 |
| `crowd.spec.ts` narrow phones (phone) | 0 / 10; a forced bad first pick: 4 / 4 | 0 / 10 |
