# Auto chess: judged by gains, before and after (Oct 21, 2026)

The rule: [docs/decisions/2026-10-21-autochess-gain.md](../docs/decisions/2026-10-21-autochess-gain.md). The earlier endings report:
[reports/autochess-endings.md](autochess-endings.md).

**The sample:** the same 80 fights as before (`sparseStarts(80, 4242)`, stand-in seeds `mulberry32(i)`), played by the real fight with
the HunChess engine at 30,000 nodes a move for both sides, at the fight's real pace (0.6 s a move, 0.3 s when fast). The starts are
not the same 80 as the endings report: main's shop changed since (#308, one offer to a square), so the bot buys different armies; 60
of the 80 start uneven this time.
- **Before** is main at 7419241, running its own `hunchess-fights.ts`. Stalls and "too far ahead" go by the absolute score.
- **After** is this branch with the same settings (`stallWinMargin` 100, `decisiveMargin` 500, `decisiveMoves` 6). Stalls and "too
  far ahead" go by what each side gained since the start.

Raw data, fight by fight: [reports/autochess-gain/](autochess-gain/).

## Before and after

| | Before (absolute lead) | **After (gains)** |
| --- | --- | --- |
| **Ends** | too far ahead 46 (57.5%), quiet cap 18 (22.5%), bare king 10 (12.5%), repetition 4 (5%), mate 2 (2.5%) | bare king 42 (52.5%), quiet cap 27 (34%), mate 6 (7.5%), repetition 4 (5%), too far ahead 1 (1%) |
| **Draws** | 8 (10%) | **15 (18.8%)** |
| **Bigger army** (P1 N3 B3 R5 Q9; 60 uneven starts): wins / losses / draws | 54 / 4 / 2 | 46 / 7 / 7 |
| **Won by the side that started behind** | 4 | 7 |
| **The early end decides** | 46 fights | 1 fight |
| **Moves a side:** average / median / longest | 13.9 / 10.5 / 40.5 | 22.2 / 20.5 / 51 |
| **Seconds:** average / median / longest | 13.7 / 10.5 / 42.3 | 21.4 / 20.7 / 48.6 |
| **Longest king-only stretch** (plies in a row where only kings moved) | 13 | 24 |
| **One side's king walking** (its own moves in a row, all the king's): longest; fights with 5+; with 10+ | 9; 16; 0 | **27; 44; 9** |
| Cash-ins a fight | 0.06 | 0.17 |

61 of 80 fights have the same winner. Of the 19 that changed, 12 had been decided by the absolute score: 8 early ends and 4 stall
wins. They are now bare-king wins (some by the other side), stalls won by the side that gained, or draws.

## What the rule does, and what looks wrong for fun

- **It does what Eric asked.** Holding a starting edge no longer wins: the bigger army's wins fall from 54 to 46. Its draws go from
  2 to 7, and its losses from 4 to 7. Wins by the side that started behind nearly double, from 4 to 7. The early end almost never
  fires: a side must gain 5 pawns on its start, not just start 5 up.
- **Draws nearly double, from 10% to 18.8%.** 7 of the 15 draws are uneven starts where neither side gained a pawn. 8 are even
  starts that stayed even. With one engine playing both sides, "nothing gained" is common.
- **Fights are twice as long:** 20.7 s at the median, from 10.5 s. A bigger army now has to win outright: take every piece (bare
  king 42) or mate (6). Before, it stopped 6 moves in, holding its edge.
- **The long king walks are back.** 9 fights have a side walking only its king for 10 moves or more (0 before), and the longest is
  27 moves. That is what Eric asked to stop on PR #305 ("just the king moving around for 10 to 15 moves"). They come from fights
  where the bigger side hunts the last pieces. Example: fight #15 came down to kings and pawns. Black had gained about 4 pawns, short of
  the 5 the early end needs, so the pawn race ran 46 moves a side, until White's last pawn cashed in and left a bare king.

## Proposal: settings only (Eric's rule unchanged)

Tried on the same 80 fights:

| `stallWinMargin` / `decisiveMargin` | Draws | Bigger army W / L / D | Started behind wins | Early ends | Seconds: median / longest | One side's king walks: longest; 10+ |
| --- | --- | --- | --- | --- | --- | --- |
| 100 / 500 (as built) | 15 (18.8%) | 46 / 7 / 7 | 7 | 1 | 20.7 / 48.6 | 27; 9 |
| 100 / 300 | 15 (18.8%) | 46 / 7 / 7 | 7 | 8 | 20.1 / 45.6 | 19; 8 |
| 50 / 500 | 12 (15%) | 52 / 6 / 2 | 6 | 3 | 17.7 / 46.8 | 11; 5 |
| **50 / 300 (proposed)** | **12 (15%)** | **52 / 6 / 2** | **6** | **15** | **16.8 / 42.3** | **11; 5** |

**Proposed: `stallWinMargin` 50 (half a pawn) and `decisiveMargin` 300 (3 pawns gained).** Not applied: Eric's numbers stay until
he or the director says.
- The half-pawn margin cuts draws to 15%. It also makes the side that has gained a little play on for the stall instead of shuffling.
- The 3-pawn early end stops 15 fights once a side has clearly won material. Together they bring the longest king walk back to 11
  moves and the median fight to 16.8 s.
- Draws stay above before's 10%. That is the cost of not rewarding the bigger army. Below half a pawn, the "gain" would be the
  engine's positional noise.
