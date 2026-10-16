# The best move is the highest-scored pick (Oct 16, 2026)

The judge called the first line of its top-8 search the best move, but measured every loss from the highest number
among that move and the picks. When a pick scored above the first line, the two disagreed. The flaky-test helper found
it in an online Crowd boss final (docs/decisions/2026-10-16-flaky-e2e-batch-2.md): the player picked Qe2, the round's
`bestMove` was Qe2, and the loss was 7.55 (5.55 counted after the opening allowance). The reveal said "you found the
best move, Qe2" while charging 7.55 points. The first line was also the re-check's anchor, so it could never be
re-checked, whatever it lost. The God King played it, and the exchange check measured against it.

**The rule now:** the best move is the highest-scored of the engine's first line and the picks (`bestOf` in
`packages/core/src/scoring.ts`). A tie keeps the engine's choice; between equal picks, the first by name. Every loss is
measured from the same number as before, so no loss changes. What changes is which move is called the best, and so:
the reveal and the dock, the God King's move, the exchange check's reference, and the re-check's anchor. The first line
is now an ordinary pick, re-checked like any other when its loss is in range (5 to 60 points, or 1 to 60 for a player
near the cut line).

## How often, and is it real (`reports/best-move-gap.md`)

`packages/sim/scripts/best-move-gap.ts` played 60 games (3,204 positions) through the judge's own code at its own
budget (the lite build, 250k nodes): 40 Crowd 50 v 50 games from the start (the team's bots picking from the job's
seed, plus two people: one plays the first line, one a decent player with a 15% chance of a random move), and 20
Classic-like groups of 8 with a random draw.

| | Crowd | Classic-like | All |
| --- | ---: | ---: | ---: |
| Positions with a pick above the first line | 3.1% | 1.9% | 2.8% |
| ... from another line of the top-8 search | 3.0% | 1.9% | 2.7% |
| ... from the second search (picks outside the top 8) | 0.1% | 0.0% | 0.1% |
| Above it by 1+ point / 5+ points | 1.0% / 0.1% | 0.8% / 0.0% | 1.0% / 0.1% |

- **Nearly all of them come from the top-8 search itself.** A line not searched again at the budget's last depth keeps
  the previous depth's score, so a later line can come out above the first (the Oct 6 lesson, "the engine's first
  line"). The second search almost never does it: 2 of the 1,224 picks it scored. The bots' random moves are almost
  always worse than the first line. So the brief's guess (most Crowd rounds have one, from bots' random moves) didn't
  hold. The bug is real, but its source is different, and one rule covers both.
- **By how much:** a median of 0.55 points (p90 2.4, at most 17.2).
- **Is the higher number real?** Each one was searched again together with the first line, like for like, by the full
  network at 2M nodes (the engine server's stand-in). The pick was at least as good in 42%, within a point in 70%, and
  worse by 2+ points in 16% (by 5+ in 10%). The median difference was −0.25 points. That's noise around zero, not a
  search that inflates weak moves. Promoting these picks changes no score: losses were already measured from them.

## Why this rule, not "re-check such a pick first"

The other rule was to re-check every pick above the first line against it before it counts. Against the server's
stand-in (110 cases):

| Rule | Re-checked | First line's pickers: mean error | Pick above it: mean error | 2+ points off |
| --- | ---: | ---: | ---: | ---: |
| The quick numbers (before, and promoted without a re-check) | 0% | 1.48 | 2.10 | 25% |
| Promoted: the first line re-checked from 5 points, like any pick | 3% | 1.12 | 2.04 | 25% |
| Promoted, a player near the cut line (from 1 point) | 35% | 0.66 | 1.95 | 29% |
| Every such pick re-checked | 100% | 0.66 | 1.78 | 37% |

- Re-checking every such pick gains under a point on average, and makes large misses more common, because a device's
  re-check is noisy at this scale too. It would also need a new re-check condition and more searches (online, on the
  engine server's daily budget).
- Promoted, the pick gets the treatment every other close call gets. The judge already accepts quick-search noise
  under 5 points for every pick. The re-check reaches the first line where it matters: big gaps, and the cut line's
  1-point range. Eric: "easier code and less lag over all else, fewer bug risks".

## Where it applies

There is one function, called where each judge first puts a board's numbers together:

- the runner's `scoreBoard` (solo);
- `baseBoard` in `judge.ts`: each device's judged board, the lobby's check of it, and its re-check targets;
- `hostScore` in `net.ts` (the host);
- `recheckCloseCalls`, so the engine server's re-check of a host's numbers is anchored on it too;
- `resolveBoard`, the final numbers, so a host on an older app still gets it right.

Every judge runs it on the same numbers, so they still agree exactly (`JUDGES.tolerance` stays 0, and `boardsAgree`
compares `bestMove`). The quick report a device sends is unchanged; only what's worked out from it changes. So an older
app's report agrees with a new one's. An older device's own deep re-check is anchored on the first line, so when the
anchor differs it adds nothing (`applyRecheck` keeps the quick numbers). Devices only re-check with no engine server,
or with deep checks on, which ships off.

- **The God King** plays the best move, now the highest-scored pick. That's the move the reveal names. It's within a
  point of the first line in 70% of cases. When the first line was picked and the gap is in the re-check's range, the
  re-check settles it first.
- **The exchange check** (the opening allowance's material fallback) now measures against the best move. There were 40
  such picks while an allowance applied. The first line gave up material against the pick in none of them, so no
  allowance was lost in the data.
- **Sims:** bot-only matches don't change: with no person there's no re-check, and every loss is the same.
  `crowd-sim.ts` over 2 matches gave identical output before and after.
- **Before → after:** a reveal that said "you found the best move" while charging points: 2.8% of positions → 0.

## What players see

- The reveal's "best was X" and the dock's "best X" name the highest-scored pick. In 2.8% of positions that's a
  different move from before.
- **The boss dock, when your pick is the best** (the director's suggestion): "You: e4 (+2.1) · the best" (it was
  "You: e4 (+2.1) · best e4"). The reveal's own words, "you found the best move, e4", don't fit the dock's one line.
  Measured in the dock's own box and font (12 px): "You found the best move, e4 (+0.0)" is 187 px. The room is 175 px
  at 390 px, 146 at 360 and 112 at 320. "· the best" is within 4 px of the old line for a 2-character move, and
  narrower for longer ones.
- The FAQ ("Points"): "if your move scores above the engine's own choice, yours counts as the best move, and the
  engine's choice is charged against it like any other pick".

## Calls I made

- **Only picks are compared, not every scored move.** A line nobody picked is left alone, as the losses leave it, so no
  loss changes. Fair play's `scored[0]` keeps its own reading (the highest of everything scored).
- **A tie keeps the engine's choice.** Between equal picks, the first by name, so every judge picks the same one.
- **The dock's wording,** above.
