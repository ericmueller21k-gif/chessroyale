# Big Boy's tower: his rare topple, and his strength (Nov 18, 2026)

Eric (Nov 18, answering whether only the crowd topples the tower): "both but he usually doesn't".

## His topple (call)

- On a `towerBossChance` (0.25) share of his turns, a tower `towerEnter` tall or more is open to his pieces as well
  (`hisToppleOpen`: a roll on the battle's seed and the crowd turn just played, so the server, the host and solo agree;
  online the server sends the host the moves he may play, as for every power that stops him). On those turns a move onto
  it is one of his moves like any other: his engine or brain plays it only if it picks it. No bonus. On the other turns
  it stops his pieces as before.
- Its blocks stand through the crowd's next turn and go as its move is played (the review's fix: Eric's rule, gone at
  the end of the crowd's next turn, every time), and a new tower starts (the topple comes as that crowd turn begins, `by: "boss"`, as his fall at
  `towerMax` does; the same drawing and lines).
- Why a seeded gate and not "only when it's clearly his best": a margin would have to run through every way his move is
  chosen (Stockfish at his strength, Maia, the engine server's scores) and the host's request. The gate is one pure roll
  in `bossStops`, and his engine still decides.
- Measured: his pieces toppled it 2 times in 26 sim battles (0.08 a battle), against the crowd's 1.65 and his own fall at
  10's 1.96 a battle. So he rarely does.

## Strength: the baseline had moved, not the tower (call: Eric's design stays)

The brief asked me to bring the crowd's raid score from 0.02 back to "today's" 0.27 to 0.35 (`ref1`, `rf1`, `rf2`). Same
sim, same seeds (raid, 50 bots, seeds 1-13 and 31-43, one battle each, his tier 1600, Stockfish at 1350):

| Run | Code | Crowd score | W-D-L | Avg moves |
|---|---|---|---|---|
| `tower` (first pass) | the tower, all blocks scatter | 0.02 | 0-1-25 | 36 |
| `half` (run 1) | the tower, half the blocks scatter (`towerScatterShare` 0.5) | 0.00 | 0-0-26 | 36 |
| `base18` (run 2, control) | today's main: the old single block, no tower | 0.00 | 0-0-26 | 32 |
| `old15` (run 3, control) | main as of Nov 15 (`e47619c`) | 0.00 | 0-0-26 | 37 |

- Today's Big Boy without the tower loses every battle in this sim too, and so did the Nov 15 code. The references are
  from an older sim: their rows carry no tier or Elo (the sim added those before Nov 8), so they aren't today's.
- Halving the scatter changed nothing measurable. So I didn't change Eric's design: `towerScatterShare` stays 1 (all
  blocks), `towerScatterReach` 3, `towerMax` 10. The share stays a setting, for later tuning.
- For the director (engine lane): re-baseline the raid sim before tuning any boss against `ref1` or `rf1`/`rf2`. Today
  even the old Big Boy wins 26 of 26. Find what changed since those runs (the boss tiers, the bots, his offset's
  1320 floor) and whether every boss moved (Sawyer's `ref1` was 0.15).

## Fair play: a proposal (not changed)

`powerTurn` is true whenever the tower or its blocks stand, so nearly every crowd turn against him is a power turn and
gives fair play no signal (before, about one turn in four had no block). An engine-free estimate on the opening
library's positions, with the tower where his rules put it:

- A new one-block tower takes a crowd move away 100% of the time: it sits on a square a crowd piece could move to.
- A tower 2 or more tall does so on 53% of positions (a slide through it). The crowd may move onto it, so nothing else
  is lost.
- Scattered blocks do so on nearly 100%.

Proposal: count a tower turn as a power turn only when his toys actually take a legal move away (the crowd's `crowdFilter`
removes one). That gives back roughly half the tower's turns as signal turns. It needs `powerTurn` to see the position (an
interface change in `BossRules`), so it's the director's call. The Last Stand's `boardAltered` should stay as it is, since
the tower also stops his replies.
