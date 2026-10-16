# The best move is the highest-scored pick (Oct 16, 2026)

The judge named the first line of its top-8 search (F) as the best move, but measured every loss from the highest number
among F and the picks. When a pick (P) scored above F, the two disagreed. The flaky-test helper found it in an online
Crowd boss final (docs/decisions/2026-10-16-flaky-e2e-batch-2.md): the player picked Qe2, the round's `bestMove` was
Qe2, and the loss was 7.55 (5.55 counted after the opening allowance). So the reveal said "you found the best move, Qe2"
while charging 7.55 points. F was also never re-checked, whatever it lost, because it was the re-check's anchor. The God
King played F, and the exchange check measured against it.

**The rule now:**

- **The best move is the highest-scored pick** when one scored above the judge's best (`bestOf` in
  `packages/core/src/scoring.ts`). A tie keeps the judge's best; between equal picks, the first by name wins.
  `MatchRunner.resolveBoard` names it on every path (solo, the host, the judges, an older app's numbers), so the reveal
  and the dock, the God King's move and the exchange check all follow the move every loss is measured from.
- **The re-check weighs P against F, like for like, before it counts** (`recheckTargets` in
  `packages/chess/src/runner.ts`). The re-check stays anchored on F. P is searched with any re-check that runs, on top
  of the usual picks, and it starts one when F's pickers lose to it within the re-check's range (5+ points, or 1+ for a
  player near the cut line).
- **What changes:** the quick losses don't change, because they were already measured from P's number. Where a re-check
  runs in these positions, its numbers do:
  - P gets a deep number, and is the best only if it holds up against F.
  - Every other pick it re-checks (X) is now measured from the deep search's best. Before, X was put on the scale through
    F's deep number but charged from P's quick number, so X was overcharged by the quick gap, less any real gap: 0.73
    points on average against a device's re-check.
  - The first version of this change anchored on P instead, which undercharged X whenever F was really better (1.24
    points on average; the reviewer's example). Neither is left.

## How often, and is it real (`reports/best-move-gap.md`)

`packages/sim/scripts/best-move-gap.ts` played 60 games (3,204 positions) through the judge's own code at its own budget
(the lite build, 250k nodes):

- 40 Crowd 50 v 50 games from the start: the team's bots pick from the job's seed, plus two people (one plays F, one a
  decent player with a 15% chance of a random move);
- 20 Classic-like groups of 8, the move drawn at random.

| | Crowd | Classic-like | All |
| --- | ---: | ---: | ---: |
| Positions with a pick above the first line | 3.1% | 1.9% | 2.8% |
| ... from another line of the top-8 search | 3.0% | 1.9% | 2.7% |
| ... from the second search (picks outside the top 8) | 0.1% | 0.0% | 0.1% |
| Above it by 1+ point / 5+ points | 1.0% / 0.1% | 0.8% / 0.0% | 1.0% / 0.1% |

- **Nearly all of them come from the top-8 search itself.** A line not searched again at the budget's last depth keeps
  the previous depth's score, so a later line can come out above F (the Oct 6 lesson, "the engine's first line").
- **The second search almost never does it:** 2 of the 1,224 picks it scored. The bots' random moves are almost always
  worse than F.
- **By how much:** a median of 0.55 points (p90 2.4, at most 17.2). With several picks above F (11 of 90 positions),
  F's pickers are charged the largest gap.
- **Is the higher number real?** Each P was searched again together with F, like for like, by the full network at 2M
  nodes (the engine server's stand-in). P was at least as good in 42%, within a point in 70%, and worse by 2+ points in
  16% (by 5+ in 10%). The median difference was −0.25 points: noise around zero.

## The rule, against the others

90 positions with a P. The truth is the server's stand-in. Each pair of numbers is a device's re-check / the engine
server's.

| Rule | F's pickers: mean error | P's pickers | Other re-checked picks (mean, signed) | Positions searched |
| --- | ---: | ---: | ---: | ---: |
| Before: anchored on F, P never re-checked | 1.63 / 1.63 | 2.47 / 2.47 | +0.73 / +0.09 | 43 |
| This PR's first version: anchored on P, F re-checked from 5 points | 1.19 / 1.19 | 2.40 / 2.19 | −1.24 / −1.60 | 45 |
| **Anchored on F, P re-checked with any re-check (chosen)** | 0.92 / 0.59 | 2.51 / 1.43 | 0 (by construction) | 45 |
| Every P re-checked, with a search of its own if need be | 0.65 / 0 | 2.06 / 0 | 0 (by construction) | 90 |

- **The chosen rule** measures every other re-checked pick from the deep search's best. Its "0" is by construction: a
  consistency check, not accuracy. It roughly halves F's error on the server, and needs no more searches than the first
  version: in 43 of its 45, a re-check was running anyway.
- **On a device** it leaves P's pickers a little further off than before (2.51 against 2.47 points): where a re-check
  runs, the device's noisy re-check charges them instead of the quick numbers' 0. On the server it's 1.43.
- **Re-checking every such pick** would be exact online, where the engine server re-checks. So the argument against it
  isn't accuracy; it's the extra searches:
  - one of its own in half these positions, about 1.4% of rounds with a person;
  - online they come out of the server's daily budget, otherwise out of device time;
  - it would treat a gap under 5 points differently from every other pick's, which the judge accepts unchecked (a
    sound move costs a point or two).

  It's one condition in `recheckTargets` if wanted.
- **Rejected: the first version's anchor on P.** Every other pick it re-checked was measured against P's deep number,
  and P often isn't really the best. The review's example: quick F 0.50, P 0.52, X 0.40; deep F 0.55, P 0.54, X 0.45.
  X loses 10 to the deep best, F. That was 12 before this change, 9 in the first version, and is 10 now.

## Every judge, every app version

- **One choice everywhere.** `recheckTargets` is what every judge runs: devices, the host, the engine server's re-check
  of a host's numbers, and the lobby's check of a device's re-check. `bestOf` runs only in `resolveBoard`. So judges
  agree exactly, as before (`JUDGES.tolerance` 0). `boardsAgree` compares the judges' boards, whose best is still F
  before any re-check.
- **The quick report a device sends is unchanged,** so an older app's report agrees with this one's. That covers the
  shipped configuration: engine server up, devices don't re-check.
- **Where devices re-check** (no engine server, or deep checks on computers, which ships off), an older app's re-check
  leaves P out:
  - **No engine server:** the two re-checks disagree and the quick numbers stand. An older app whose own list came out
    empty sends none, so the round waits `deepWaitMs` for it, then takes the other device's.
  - **Deep checks on, engine server up:** the server re-checks. A device's re-check that leaves out only the picks above
    F (an older app's pattern) isn't compared, so an honest older app is never struck for that. Any other omission is
    blamed as before.
  - **The catch:** a device that copies that pattern on purpose escapes blame for it, but the server's numbers decide and
    it costs a server search. That's acceptable while deep checks ship off; revisit before turning them on.
- **The God King** plays the best move: after any re-check, the highest-scored pick, the move the reveal names. It's
  within a point of F in 70% of cases. Where a re-check ran, P was weighed against F first. Without one it can be a
  little weaker than F (about 0.26% of the King's moves); consistency with the reveal wins (director, Oct 16).
- **The exchange check** (the opening allowance's material fallback) measures against the best move. Of the 40 such
  picks while an allowance applied, F gave up material against P in none, so no allowance was lost.
- **Sims:** bot-only matches don't change: with no person there's no re-check, and every loss is the same.
  `crowd-sim.ts` over 2 matches gave identical output before and after.
- **Before → after:** a reveal that said "you found the best move" while charging points: 2.8% of positions → 0.

## What players see

- **The best move named:** the reveal's "best was X" and the dock's "best X" name the highest-scored pick. In 2.8% of
  positions that's a different move from before.
- **The boss dock, when your pick is the best** (the director's suggestion): "You: e4 (+2.1) · the best" (it was
  "You: e4 (+2.1) · best e4").
  - The reveal's own words, "you found the best move, e4", don't fit the dock's one line.
  - Measured in its box and font (12 px): "You found the best move, e4 (+0.0)" is 187 px. The room is 175 px at 390
    wide, 146 at 360 and 112 at 320.
  - "· the best" is within 4 px of the old line for a 2-character move, and narrower for longer ones.
- **The FAQ:**
  - "Points": "if picks score above the engine's own choice, the highest-scored pick counts as the best move, and every
    other pick, the engine's choice included, is measured against it."
  - "The deeper re-check": "A pick scored above the engine's own choice is searched again too, alongside it, whenever
    there's a re-check."
  - The God King's "Play this move": "he plays the judge's best move for the crowd (stronger than the boss)."

## Calls I made

- **Only picks are compared, not every scored move.** A line nobody picked is left alone, as the losses leave it. Fair
  play's `scored[0]` keeps its own reading (the highest of everything scored).
- **A tie keeps the judge's best.** Between equal picks, the first by name, so every judge picks the same one.
- **The picks above F go first in the re-check, on top of `recheckMax`.** They're the anchor's rivals, not close calls
  competing for a slot.
- **The dock's wording,** above.
