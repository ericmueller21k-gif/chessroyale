# The shared boss test kit: every boss gets the important checks for free (Oct 18, 2026)

Eric, Oct 18: "I should be able to tell you to add a boss and it should take an hour of a few agents running in
parallel… the testing is getting out of hand." His new rule: boss content gets one quick review and no fix/re-review
loops. So the bugs those loops used to catch must be caught automatically, for every boss, with no edit per boss. How
it works now and what a new boss still adds: [docs/areas/bosses.md](../areas/bosses.md), "Adding a boss".

## What was built

- **`packages/chess/test/boss-kit.test.ts`** (the driver and checks in `boss-kit-lib.ts`): every boss in `BOSS_ROSTER`
  with powers, hidden ones included (read from the roster: Chub & Chirp and the Hidden Boss are covered today), three
  short seeded battles each through the match runner, in solo's order of steps: his passive switched on early (crowd
  White); his ultimate switched on early and the admins' trigger pulled again and again (crowd Black); and from a
  stress start with the trigger pulled from the first turn (crowd White). The God King's strike is called now and then.
  The crowd plays cheap seeded legal moves (promotions, pawn moves and captures first); the boss and every power's
  engine pick use a stand-in engine (a hash, with a bonus for pawn steps forward, so both sides push their pawns into
  promotions, nose-to-nose pawns and en passant). Stockfish 19 (the game's own build) is the referee for legality.
- **`packages/server/test/boss-kit-parity.test.ts`**: every boss, one seeded battle through the lobby (the server's
  rules, two people, a host answering every request as the app's host does: net.ts's handlers on the stand-in engine)
  and the same battle through solo's path (a copy of the lobby's runner as the battle starts, driven by the runner's own
  steps on the device's engine). The crowd plays the same move from the same position on both. Asserted: the same
  position and allowed moves every crowd turn, the same power events, the same result.
- **`e2e/boss-smoke.spec.ts`**: every playable boss in the roster, on the phone: his tile, a battle through the test
  switches, his passive at work and his ultimate (the admins' trigger), no page errors. The computer runs the first boss.

## The invariants, and why each is there

Checked after every step (a crowd move, each step at the start of his turn, his move, his extra move, the funhouse's
move, the battle's end):

| Invariant | From |
| --- | --- |
| The position is one Stockfish 19 plays: `stockfishRefuses` (pawns never on rank 1 or 8, at most 8 pawns, no more pieces than promotions could make, the side not to move never in check), at most 16 pieces a side, the en passant square only where Stockfish keeps it (`epKept`: a pawn of the side to move attacking it, the pawn that moved in front of it, it and the square behind it empty) | the area rule "no power may make a position the engine refuses"; #275's S2 |
| chess.js's legal moves equal Stockfish's (`go perft 1`), wherever a power made the position (a base at its ply) and at the start | #275's S2 (22 moves against 21: the judge and the boss asked about a move the engine never scores) |
| A round's scored moves are each legal and listed once; the crowd's move is one it was allowed | "A move scored twice, another not at all" (Oct 14); "stray scored entries" |
| Whoever is to move has a legal move unless the game is over; a power's limit leaves at least one allowed move, each legal; his move is one he was allowed (or any legal one when the limit lifted) | the ground rules ("a power never leaves anyone without a legal move"); `boss-power-legal.test.ts` |
| The replay from the last base reproduces the position; the boss view builds and serializes; no event from a turn to come | "A move only legal after a burn" (Oct 9); the screens and the lobby send the view |
| No step at the start of his turn (Lights out, a bounce, Alfil's steps, the Carrot Patch's cast, a hop) leaves him a promotion he didn't have as the crowd's move left the board; per-boss opt-out list (`PROMOTION_OPT_OUT`, empty) | #273's "instant queen" (a hop onto the crowd's second rank, then dxc1=Q) |
| A power's declared win (an event whose kind ends in `Win`) still ends "boss" on a copy of the battle with the board stalemated; at the real end, such an event means "boss" | #275's S1 (his fifth carrot scored as a draw when the same move stalemated) |
| A win a power declares on his move still comes when the same move also ends the game (the same move replayed on a copy from before it, the runner's game-over check answering yes); at a real ending on his move, the turn his rules would set up declares nothing the view leaves out; a battle he won with no mate, no time-out and before the cap carries its declaring event in the last view | #275's N-a (the turn's setup returned at the game's end; his win's moments never came) |
| Solo and online reach the same positions, power events and result (the parity test) | "host and server disagreeing" |
| A kind of step the runner has that the driver doesn't play (`…Due`, `…Step` on `MatchRunner`) fails the kit (`KNOWN_STEPS`) | so a new boss's new step is never skipped silently |

Left out: the king attack facing away (#274) has its own test (`king-attack.test.ts`, "every attacker's face toward the
king"); it's art, not rules. Determinism from the seed is covered by the parity test (the lobby restores its runner from
a snapshot at every event; solo plays from a copy).

## Judgment calls

- **Stockfish only where a power made the position.** A position an ordinary legal move made is chess.js's own
  (including its en passant square, set only when a capture is possible); a power's edit is where the two can part (S2).
  Asking Stockfish only at bases cut its calls by about seven eighths (163 of 1,282 positions in a run); `epKept` still runs everywhere.
- **The stand-in engine, not Stockfish, plays.** Real searches would cost minutes; the invariants are about the rules,
  which never depend on how strong the numbers are. The stand-in is a pure function of the position, so the two paths
  in the parity test get the same answers.
- **Searches against the clock are cut to 200 ms, on a stepped clock** (`quickSearches`: every `…SearchMs`, `…TurnMs`,
  `…TestMs` in BOSS_POWERS, today Wrangler's showdown at 3 to 10 s a turn; `performance.now` stepping 1 ms each read).
  The stand-in answers at once, so a full budget is only waiting; the rules and guards don't change, and Wrangler still
  fires showdowns in the kit. The stepped clock came from a parity run that failed once under load: on the real clock
  the lobby's host and solo searched different numbers of line-ups in the same 200 ms, found different ones, and the
  battles parted at turn 5. That's by design between two devices (the host decides, the server checks), so it isn't a
  disagreement; on the stepped clock a search's length is a count of its own steps, the same on both paths and on every
  run, so a kit failure in Wrangler's battles replays exactly.
- **The stress start** (1.d3 d5 2.Nf3 d4 … his d4 pawn nose to nose with your d3, d2 open) is where a power can hand him
  a promotion for his very next move. Without it a reverted #273 slipped through the fuzz (the hop never came there);
  with it the kit catches it.
- **A declared win is an event whose kind ends in `Win`** (`carrotWin` today). One convention, no new hook in the rules:
  a new power that decides the battle names its event that way (bosses.md, "Adding a boss").
- **The probes use copies of the battle** (`MatchRunner.restore` of a snapshot, as every lobby event does): the
  stalemated board for S1, the game-over check answering yes for N-a. The bugs only showed when a fifth carrot and a
  game end fell on the same move, which a short fuzz almost never meets; the probes check that case at every win a power
  declares, which the fuzz meets often (Chub & Chirp's Carrot Patch in most of his battles).
- **The parity test's boss is rated past slips** (the people rated 3000: the boss a step above). A slip is drawn from
  each path's own random source (the lobby's and the device's are different by design), so his move would differ for a
  reason that isn't a disagreement. Everything else (the God King's stagger, a power's best reply) is the same on both.
- **The smoke test's passives by their events** (`PASSIVE_EVENTS`, keyed by power id: a playable boss's passive missing
  from it fails the test with what to add); his ultimate by the view's count (`ults`), the same for every boss.
- **20 crowd moves a battle** keeps `boss-kit.test.ts` at about 35 to 40 s on a quiet machine (Wrangler about 8 s of
  it); `KIT_SEEDS=<n>` adds n more seeds of each battle for a deeper run by hand.

## Proof: each past bug re-introduced, the kit failing

Each bug put back on a copy of the code (`git checkout` afterwards), only the kit run:

| Bug | Re-introduced as | Caught by |
| --- | --- | --- |
| #273 instant queen | `hopRefused` without its `nextToLast` and `promote` refusals | the fuzz (the stress start): "hopper (seed 883, …, from kit-stress), after the hop: a power gave him a promotion for his very next move: d2c1" |
| #275 S2 | `editedFen` keeping the en passant square with a piece behind it | the kit's fixture on the review's position ("an en passant square Stockfish drops (d6)", "only chess.js: c5d6"); the fuzz didn't meet a prize or a landing right behind a double step in 3 battles a boss, nor in 21 for Alfil and Chub & Chirp |
| #275 S1 | `bossCarrotWin` requiring the board's game not over | the fuzz's win probe: "carrotWin declared the battle his, but with the same move stalemating it ends "draw"" |
| #275 N-a | `preparePowers` returning at any game end | the fuzz's end probe: "with the same move also ending the game on the board, carrotWin never comes" |
| a move scored twice | a round's `scored` listing its best move twice | the fuzz: "moves scored twice: h2h4" |
| host and server disagreeing | the lobby ignoring the host's bounce pick; the lobby dropping the race from Chub & Chirp's boss request | the parity test (turn 3 differs) for both; a third (the lobby dropping Alfil's landing pieces, `land`) isn't caught: the stand-in engine's landing guard kept his move |

## Found on the way (not fixed here: listed for the director)

- **The app's host never sends `outside`.** When the admins' trigger fires Wrangler's showdown outside the band, solo
  marks it (`showdown.outside`, and the admins' dock line "Showdown (test: outside the band)"), but online the host's
  reply (`hostBoss` in `packages/app/src/net.ts`) passes on `drag` and `showdown` only, though `pigTurn`'s answer has
  `outside` and the lobby accepts it. Admins only, testing only; the fix is one spread in that reply. The showdown's
  `edge` likewise never travels (no field for it in `bossMove`), so online it's null; nothing on screen reads it.

## What it costs

Measured on this machine (CI's runners are about the same speed): `boss-kit.test.ts` about 35 s and
`boss-kit-parity.test.ts` about 10 s, run side by side (vitest runs files in parallel, so the check job grows by less
than their sum); `boss-smoke.spec.ts` about 3 minutes on the phone (eight bosses, 17 to 30 s each, in order on one
worker) beside 24 s on the computer, on one e2e shard (`e2e/ci-timings.json`: 210 s).
