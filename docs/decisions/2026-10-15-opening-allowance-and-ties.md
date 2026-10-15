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
- **Players see it.** The reveal says it in one line (`allowanceNote`), tested at 320 px: "−2.4 → 0 · opening" (or
  "−9.6 → −1.6 · opening"), "−4.1 · gave up material", "−4.1 · missed a capture". Crowd: its own line under the poll's
  result; Classic: under the round score; a boss battle: the dock's second line is the note alone (it holds about 18
  characters on a 320 px phone, where it shortens to "−9.6 → −1.6" and "−4.1 · all counts"; measured at 320, 390 and
  1280 with the widest losses: nothing spills). "Why was
  I cut?" says what counted for each move. The FAQ's "The opening allowance" says both rules in two sentences, and its
  Crowd section says ties go through. Nothing in Settings: its How to play is becoming links to the FAQ (#232).

## Part 2: ties at the cut line survive

- **The rule** (`cutPlan` in match.ts). At a cut everyone tied exactly with the last player through goes through:
  nobody goes out on thinking time or a coin flip. "Exactly" is to 1e-9 (`sameScore`): players with the same counted
  losses every move get bit-for-bit the same sum, but different moves can add up to the same score in different
  orders.
- **What's owed carries** (`cutCarry`, per team in 50 v 50): the next cut takes its own plus what the last one left
  over, so the endings keep their sizes (the team final's 8, the boss final's 4, the duel's 2, Classic's final four).
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
- **The screens' words hold with fewer out:** the cut says the real numbers ("5 out · 87 left", or "Nobody out, ties go
  through"); Classic's break lists who went out; "Why was I cut?" says "below the last player through" with the real
  gap, "level with" only at the last cut (with why), and "less than 0.1 points below" when the shown scores round the
  same.

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
| Cut 2: cut players who had played poorly | 66% | 86% |
| Cut 2: players out (mean) | 14.0 | 12.2 |
| Cuts with an exact tie at a team's line | 8% | 67% |
| Most owed at once (mean of each match's largest) | 0 | 9.3 |
| Out at each cut (mean) | 16 · 14 · 12 · 10 · 8 · 8 · 6 · 6 · 4 · 4 · 4 | 15.1 · 12.2 · 10.2 · 8.3 · 12.2 · 7.8 · 6.3 · 4.6 · 5.3 · 3.8 · 6.5 |
| The ending's size (every match) | 8 | 8 |
| Plies per match (mean) | 160.3 | 158.8 |
| Placement against bot skill (Spearman) | 0.763 | 0.634 |

- **Both halves of Eric's goal move the right way:** fewer players who only played the engine's top moves go out (4%
  to 1% at the first cut, 8% to 3% at the second), and more of those who do go out played poorly (83% to 91%, 66% to
  86%). Only 3% of the first cut's players had a score of 0 or more (they were the lowest of a team whose rest was tied
  above them).
- **What it costs:** exact ties are common (two players with the same counted losses every move tie to the bit), so
  most cuts keep someone in, and the owed players go when the allowance runs out: the 5th cut (move 14) takes 12
  rather than 8. The endings keep their sizes, and a match is as long as before.
- **Placement tracks the bots' skill less (0.763 to 0.634).** A bot's skill shows the same in every move, the opening
  included, so forgiving the opening's small losses takes real signal away from bots; for people the opening's
  precision is the memorized lines Eric doesn't want to decide a match. ARMS_PLACEHOLDER

## Testing

Full lane (rules). Unit: `packages/core/test/opening-allowance.test.ts` (the taper at moves 1, 10, 11, 12, 14 and 30;
counted against raw in `scoreGroup`; brilliance on raw; a miss as before), `cut-ties.test.ts` (ties go through; what's
owed carries; the last cut's tie-break; the endings' sizes; 50 v 50's teams; the boss's tied strike; the team final's
steps), `packages/chess/test/exchange.test.ts` (hanging, a missed capture, a gambit, en passant both ways, promotion,
a capture giving check and one that mates, castling; two judges agree), `runner.test.ts` (Classic with ties kept in:
more boards, groups at most 10, the final four), the strike tests that leaned on a coin flip among tied players
(`crowd.test.ts`, `last-stand.test.ts`, `recluse.test.ts`, `resign.test.ts`: their players now differ), `lobby.test.ts`
(the cut is exactly the rows marked), `faq.test.ts`. e2e: `crowd.spec.ts` (the reveal's line at 320 px, real and
widest; the cut's "+N" from the real count).
