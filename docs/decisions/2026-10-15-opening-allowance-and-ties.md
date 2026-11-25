# Opening allowance and ties survive the cut (Oct 15, 2026)

Eric (Oct 15): "make it so the first say 10 moves on each side are scored different or the scoring is tapering where
the first few moves only punish egregiously poor moves but if some people wanna play a random pawn line they don't just
lose points … skill becomes more important than knowing memorized lines. Ideally you'd see after 10 moves basically
everyone is tied who hasn't made total blunders, or conversely if very obvious plays were missed then that would also
be an extreme swing." On cuts: "Allow those players to continue playing when it's tied, players should be like 'yea I
know I messed up' when they get cut or at least not feel gypped." His goal for the game: "smoothness, quickness, with
some variety offered." On the size of the grace: "there's scenarios where an obvious capture early or blunder is
possible before move 10 and that can't be a 0." The acceptance goal: "the goal is simply to still cut players playing
poor, and not punish players not playing precise engine lines or slight variations in the opening 10-14 moves."

## Part 1: the opening allowance

- **The rule** (`OPENING_ALLOWANCE` in settings.ts: `points` 8, `flatThrough` 10, `goneBy` 14, `materialPawns` 1;
  `openingAllowance`, `scoreGroup` in scoring.ts). A pick's **counted loss** is its raw loss less the allowance, never
  below 0: 8 points through move 10, then 6, 4, 2 on moves 11 to 13, nothing from move 14. **The material fallback:** a
  pick that gives up a pawn or more against the engine's best move by a simple exchange check gets no allowance at all:
  it left something to be taken, or passed up a capture that wins material (`exchangeNet`, `materialSlips` in
  `packages/chess/src/rules.ts`). Called the **opening allowance** everywhere (code, docs, the FAQ), never a grace or
  "free moves": it's points off a loss, not moves that don't count. (The brief called it "opening grace".)
- **Calibrated, not guessed** (`packages/sim/scripts/opening-allowance.ts`, `reports/opening-allowance.md`): 2,451
  positions (32,068 scored moves) from 84 games (the starting position, Classic's library openings 4 moves in, a
  raid's 5 in, played on with the engine's top 3, plus side branches after a hung piece), moves 1-14, scored the way
  the judge scores (the lite build at 250k nodes, the top 8, then one search over the other picks). Each move sorted
  by the exchange check against the best move. The full tables (by move number, every G, flat against taper) are in
  the report; in short, loss in points:

  | Kind | p10 | p25 | median | p75 | p90 |
  | --- | ---: | ---: | ---: | ---: | ---: |
  | engine's 2nd-4th (no material) | 0.0 | 0.5 | 1.6 | 5.7 | 15.8 |
  | engine's 5th-8th (no material) | 0.1 | 2.0 | 4.7 | 14.8 | 31.3 |
  | random legal move, no material | 0.9 | 5.3 | 17.3 | 39.2 | 48.8 |
  | missed a free pawn | 0.0 | 4.5 | 30.1 | 46.9 | 53.8 |
  | missed a free piece | 0.0 | 7.7 | 47.3 | 53.0 | 95.0 |
  | hung a pawn | 0.0 | 4.5 | 37.1 | 50.1 | 62.2 |
  | hung a piece | 0.0 | 16.9 | 50.2 | 88.6 | 100.0 |

- **Why the fallback: one G can't separate them.** The material errors' low tail (p25 about 4-8) sits inside the sound
  offbeat moves' range (the 5th-8th's median 4.7, p75 15). A flat G on its own, moves 1-10 (sound kinds: share counted
  0; material kinds: share still charged at least half / share counted under 1 point):

  | Kind | G=3 | G=5 | G=8 | G=10 |
  | --- | ---: | ---: | ---: | ---: |
  | engine's 2nd-4th | 66% | 75% | 84% | 87% |
  | engine's 5th-8th | 36% | 55% | 65% | 71% |
  | random, no material | 10% | 20% | 31% | 37% |
  | missed a free pawn | 84% / 19% | 79% / 23% | 73% / 27% | 68% / 29% |
  | hung a pawn | 86% / 18% | 82% / 22% | 76% / 25% | 73% / 27% |

  Even G=3 takes about a fifth of the missed free pawns to about 0 (against 11% the engine itself scores under a
  point), which breaks Eric's "can't be a 0". With the fallback every material error keeps its whole raw loss (only the
  11-15% the engine itself says cost under a point stay near 0: the exchange check's false positives, a sound gambit),
  so G can sit at the knee of the sound moves' curve: **G = 8** counts 84% of the engine's 2nd-4th moves 0 and 65% of
  its 5th-8th, while only 31% of random legal moves get to 0 (most of them still cost). The director approved it.
- **It fails safe both ways.** A false positive (a sound gambit flagged) only loses the allowance, i.e. today's
  scoring at the engine's own small loss. A false negative (a fork the exchange check doesn't see) still pays loss − 8.
- **Flat through move 10, not a taper from move 1.** Sound moves cost least at moves 1-4 and more by moves 9-10 (the
  5th-8th's median 3.4 at moves 1-4, 7.2 at 9-10), the opposite of a taper's shape. At an equal share of material still
  charged at least half, flat lets more sound moves through: flat G=4 counts 63% of the 2nd-4th moves 0 with 84% of
  missed free pawns charged at least half; a taper from G=8 at move 1 gives 62% / 84%; flat G=6 70% / 80% against a
  taper from 10, 65% / 80%. Then down to nothing by move 14, as Eric's "the opening 10-14 moves".
- **The move number** is the game's own: the position's fullmove number ("Move 6" on the top bar), the same in every
  mode. Crowd from move 1; a raid from move 6 (its opening is 5 moves in), so its first strikes count the allowance;
  Classic from move 5, and a replaced board's fresh opening again; the Crowd's boss final is a fresh board from move 1
  (no strikes there; its placements by matchLoss count it like any move).
- **Raw for the board, counted for points.** The raw loss keeps deciding which move is played (the draw rules), the
  brilliant badge (`brilliance`), fair play's signals, ratings and the Elo estimate (`lossesByStage` stays raw), the
  God King's Last Stand and the bots' calls for him. The counted loss makes the round scores (the group's average is of
  counted losses, so a group's scores still sum to zero), standings and cuts, the boss's strikes (`finalLosses`),
  `matchLoss` (`countedLossSum`, raw for a match stored before this) and so the team final's steps and final
  placements. A miss costs exactly as before. Bots unchanged (they still pick by raw losses).
- **Where it's worked out:** `MatchRunner.resolveBoard` (`allowanceFor`), after the bosses' rules have adjusted the
  numbers (G-REX's fire, a power's limits: `judgeEvaluation`, `withoutBarred`), so the allowance comes off the final
  losses. Online the lobby does it from the judges' raw numbers, so judging devices never need to agree on it; it's
  pure all the same (a test runs two judges of one board and gets identical allowances). Only the distinct picks, only
  while there's an allowance (moves 1-13).
- **The exchange check has its own small board** (64 squares from the FEN), not chess.js: chess.js builds a SAN and two
  FENs for every move it lists, which cost about 11 ms a check; this one about 0.15 ms (a board of 15 distinct picks: a
  couple of milliseconds). It asks only what attacks a square: a pinned piece still counts, a check is answered only by
  taking the checker, a king takes only onto a square the other side doesn't attack, a pawn reaching the last rank
  becomes a queen, en passant both ways. Simple on purpose (and the calibration used this same check).
- **Squads is untouched:** it doesn't score moves. Its points come from games won and drawn; the engine only judges a
  same-move token's refund (and Mercenary's brilliant move), never a loss that counts for points.
- **Players see it.** The reveal says it in one line (`allowanceNote`), tested at 320 px, in plain words with one
  number at most (the director, Oct 15: the first version, "−46.2 · gave up material" under the round score's
  "−44.8", stacked two negatives that read as a mistake): "1.2 forgiven · opening", "8 of 9.6 forgiven · opening",
  "no allowance · gave up material", "no allowance · missed a capture". Crowd: its own line under the poll's result;
  Classic: under the round score; a boss battle: the dock's second line is the note alone (it holds about 18
  characters on a 320 px phone, where it shortens to "8 of 9.6 forgiven" and "no allowance"). Measured at 320, 390 and
  1280 with the widest cases ("8 of 99.9 forgiven · opening", "no allowance · missed a capture"): nothing spills.
  "Why was I cut?" says what counted for each move (kept as it was: the director found it reads well). The FAQ's "The opening allowance" says both rules in two sentences, and its
  Crowd section says ties go through. Nothing in Settings: its How to play is becoming links to the FAQ (#232).

## Part 2: ties at the cut line survive

- **The rule** (`cutPlan` in match.ts). At a cut everyone tied exactly with the last player through goes through:
  nobody goes out on thinking time or a coin flip. "Exactly" is to 1e-9 (`sameScore`): players with the same counted
  losses every move get bit-for-bit the same sum, but different moves can add up to the same score in different
  orders.
- **What's owed carries, spread evenly** (`cutCarry`, per team in 50 v 50): each cut takes its own plus its share of
  what earlier cuts left over, divided evenly over the cuts still to come (rounded up; all of it by the last), so the
  endings keep their sizes (the team final's 8, the boss final's 4, the duel's 2, Classic's final four). First built as
  "the next cut takes it all": the sims showed the owed places piling into the cut after move 14, the first move the
  allowance no longer covers (12 out instead of 8), where the field arrives nearly tied and one small loss decides
  (the 24th strongest of 100 bots went out over a single 3.4-point move). The director chose to spread it (Oct 15): Eric's bar is
  that a player who goes out thinks "yeah, I messed up".
- **The last cut before a fixed-size ending** (`isLastCut`) takes exactly what's owed. An exact tie at its line goes to
  less **raw** loss over the match (`rawLossTotal`: every raw loss, a miss counting `finalMissLoss`), then less
  thinking time (over the match in Crowd, the stage in Classic), and only then a coin (two players with the same score,
  raw losses and thinking time to the millisecond). Why raw loss is fair: the allowance forgives small losses so a
  sound opening isn't punished, but between two players who are otherwise level, the one who gave away less before
  any forgiveness played more accurately; it's a measure of the same moves, not of speed or luck, so the one who goes
  can still say "I gave away more". The team final's steps (they must leave exact sizes) break a tie the same way.
- **The display order follows the same keys** (`standings`: score, raw loss, thinking time, coin), so a cut is always
  the bottom of the list, and every screen draws the line from the runner: `cutoff()` (how many would go through now)
  and each standing's `cut` flag (each team's line in 50 v 50, `towerView`).
- **The boss's strikes** (`strikeVictim`): the worst since the last strike by counted losses, a tie going against the
  weaker player over the match (`matchLoss`), as before. Still tied on both (say everyone played sound moves in the
  opening): nobody is struck, and the strike is due again after the next crowd move. Never two at once: a strike's
  screens show one victim, and half the group is a floor the battle may never reach anyway, not a fixed size.
- **Classic's grouping:** with players kept in by ties, the next stage keeps enough boards for them
  (`ceil(survivors / groupSize)`, never fewer than the plan's), so groups stay at their size (7-10 with an odd number of
  boards, as before) and never crowd a board; the boards still go one at a time, finished games first.
- **The screens' words hold with fewer out:** the cut says the real numbers ("5 out · 87 left", or "Nobody out · 92
  left" over "Everyone at the cut line was tied, and ties go through"); Classic's break lists who went out; "Why was I
  cut?" says "below the last player through" with the real gap, "level with" only at the last cut (with why), and
  "less than 0.1 points below" when the shown scores round the same.

## Sims

`packages/sim/scripts/allowance-sim.ts` (`reports/allowance-sim.md`): 12 Crowd 50 v 50 matches of 100 bots before
the change (`main` at 144eb80) and 12 after, the same seeds (identical up to the first cut), the judge's strength
(250k nodes), team final. "Poor" is a pick that gave up a pawn or more by the exchange check, lost 20 points or more
raw, or a miss; "slight variations" are picks among the engine's top 8.

| | before | after |
| --- | ---: | ---: |
| Cut 1 (after move 10): of those who played only top-8 moves, went through | 96% | 99% |
| Cut 1: cut players who had played poorly | 83% | 91% |
| Cut 1: cut players with a negative score | 100% | 97% |
| Cut 1: players out (mean) | 16.0 | 15.1 |
| Cut 2 (after move 11): of those who played only top-8 moves, went through | 92% | 97% |
| Cut 2: cut players who had played poorly | 66% | 85% |
| Cut 2: players out (mean) | 14.0 | 11.9 |
| Cuts with an exact tie at a team's line | 8% | 56% |
| Most owed at once (mean of each match's largest) | 0 | 9.3 |
| Out at each cut (mean) | 16 · 14 · 12 · 10 · 8 · 8 · 6 · 6 · 4 · 4 · 4 | 15.1 · 11.9 · 10.1 · 8.2 · 8.2 · 8.4 · 6.0 · 7.5 · 4.8 · 5.1 · 6.8 |
| The move-14 cut (the 5th) | 8 | 8.2 |
| The ending's size (every match) | 8 | 8 |
| Plies per match (mean) | 160.3 | 150.5 |

- **Both halves of Eric's goal move the right way:** fewer players who only played the engine's top moves go out (4%
  to 1% at the first cut, 8% to 3% at the second), and more of those who do go out played poorly (83% to 91%, 66% to
  85%). Only 3% of the first cut's players had a score of 0 or more (they were the lowest of a team whose rest was tied
  above them).
- **What's owed, spread over the cuts still to come**, keeps every cut near its planned size; the move-14 cut takes 8.2
  (it took 12.2 when the next cut owed it all). The last cut takes what's left (6.8 instead of 4).
- **The move-14 cut is still the allowance's first real test**, whatever its size: most of those it takes (82%; 87%
  when the next cut owed it all, 73% with the allowance alone) gave nothing away that counted before move 11, so a
  few small losses at moves 11-14 decide it (their median, counted: 4.2 points; 2.4 when it took 12). Bots from the
  strongest quarter it took, over the 12 matches: 5 before, 10 at the next cut, 8 spread (the strongest bot: once
  before, never after). In match 7001 the 24th strongest still goes out there, 1.3 below the line over one 3.4-point
  move at move 14 (its "Why you went out" is in the PR). That's the allowance doing what it says: forgiving the
  opening's small losses moves the first separation to where the allowance ends.

**Which part does what** (the director asked, Oct 15). The same seeds with only part of the change: `ties-only` (the
allowance's points 0), `allowance-only` (every cut exact, ties broken as at the last cut), `after-next-cut` (both, the
owed places all due at the next cut, as first built). Spearman of each bot's temperature against its placement:

| | before | ties only | allowance only | both, next cut | both (this PR) |
| --- | ---: | ---: | ---: | ---: | ---: |
| All 100 (± standard error) | 0.763 ±0.020 | 0.761 ±0.019 | 0.676 ±0.028 | 0.634 ±0.021 | 0.640 ±0.023 |
| The last 20 | 0.500 | 0.526 | 0.464 | 0.465 | 0.476 |
| The 8 finalists | 0.226 | 0.198 | 0.264 | 0.268 | 0.236 |
| Winner in the strongest quarter of the bots | 11/12 | 11/12 | 12/12 | 12/12 | 11/12 |
| The move-14 cut: out | 8.0 | 8.0 | 8.0 | 12.2 | 8.2 |
| Plies per match | 160 | 155 | 160 | 159 | 151 |

- **Ties are free** (0.761 against 0.763). **The allowance is the cost**, and the intended one: a bot's skill is a
  steady trickle of small losses, which the allowance forgives for moves 1-13, so the early cuts take the bots who made
  material or big errors rather than those who trickle. For people, that trickle is the precision of memorized lines
  Eric doesn't want to decide a match. The late game still separates skill (the last 20, the finalists, the winner).
- **Classic in one-round stages** (the `?rounds=1` test switch): a stage's score is one round against one board's group,
  so whole groups tie exactly, nearly nobody is cut, and the owed places pile into the last cuts, where the luck of the
  groups decides (measured headless, the engine's best every move: through to the final in 0 of 6 matches at one
  round a stage, 3 of 6 at two or three; the last cut took 20 to 35). At Classic's own 8 and 5 rounds a stage the cuts
  stay at 8 and the engine's best wins 3 of 3. Classic is off the menu;
  the e2e that played it at one round a stage now asserts the rule rather than the final (below).

## Testing

Full lane (rules). Unit: `packages/core/test/opening-allowance.test.ts` (the taper at moves 1, 10, 11, 12, 14 and 30;
counted against raw in `scoreGroup`; brilliance on raw; a miss as before), `cut-ties.test.ts` (ties go through; what's
owed carries; the last cut's tie-break; the endings' sizes; 50 v 50's teams; the boss's tied strike; the team final's
steps), `packages/chess/test/exchange.test.ts` (hanging, a missed capture, a gambit, en passant both ways, promotion,
a capture giving check and one that mates, castling; two judges agree), `runner.test.ts` (Classic with ties kept in:
more boards, groups at most 10, the final four), the strike tests that leaned on a coin flip among tied players
(`crowd.test.ts`, `last-stand.test.ts`, `recluse.test.ts`, `resign.test.ts`: their players now differ), `lobby.test.ts`
(the cut is exactly the rows marked), `faq.test.ts`. e2e: `crowd.spec.ts` (the reveal's line at 320 px, real and
widest; the cut's "+N" from the real count); `solo.spec.ts`'s Classic strong-play test asserted that strong play always
reaches the final, which rested on the old tie-break (its comment: "Strong play wins exact ties at a cut by thinking
less"); it now asserts the new rule: never cut while tied with or above the last player through except at the last
cut, the final played, your turns in it when you're there. The first CI run also caught two layout shifts the
allowance caused: the computer's panel beside the board now keeps room for the allowance's line (so chat under it
stays put), and the top bar's cut pill stays through a stage even while nobody would be cut (ties), so the board
never moves.
