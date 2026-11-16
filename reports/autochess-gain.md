# Auto chess: judged by gains, before and after (Oct 21, 2026)

The rule: [docs/decisions/2026-10-21-autochess-gain.md](../docs/decisions/2026-10-21-autochess-gain.md). The earlier endings report:
[reports/autochess-endings.md](autochess-endings.md).

**The sample:** the same 80 fights as before (`sparseStarts(80, 4242)`, stand-in seeds `mulberry32(i)`), played by the real fight with
the HunChess engine at 30,000 nodes a move for both sides, at the fight's real pace (0.6 s a move, 0.3 s when fast). These are not
the same 80 starts as the endings report: main's shop changed since (#308, one offer to a square), so the bot buys different armies.
60 of the 80 start uneven.
- **Before** is main at 7419241, running its own `hunchess-fights.ts`. Stalls and "too far ahead" go by the absolute score.
- **After** is this branch as shipped: stalls and "too far ahead" go by what each side gained since the start, with `stallWinMargin`
  50 (half a pawn) and `decisiveMargin` 300 (3 pawns); `decisiveMoves` stays 6. The first build kept 100 and 500; its sim showed
  draws nearly doubling and the long king walks coming back, so the margins were retuned (the director's call on PR #310).

Raw data, fight by fight: [reports/autochess-gain/](autochess-gain/).

## Before and after

| | Before (absolute lead) | **After (gains, 50 / 300)** |
| --- | --- | --- |
| **Ends** | too far ahead 46 (57.5%), quiet cap 18 (22.5%), bare king 10 (12.5%), repetition 4 (5%), mate 2 (2.5%) | bare king 28 (35%), quiet cap 27 (34%), too far ahead 15 (19%), mate 7 (9%), repetition 3 (4%) |
| **Draws** | 8 (10%) | 12 (15%) |
| **Bigger army** (P1 N3 B3 R5 Q9; 60 uneven starts): wins / losses / draws | 54 / 4 / 2 | 52 / 6 / 2 |
| **Won by the side that started behind** | 4 | 6 |
| **The early end decides** | 46 fights | 15 fights |
| **Moves a side:** average / median / longest | 13.9 / 10.5 / 40.5 | 19.4 / 17.3 / 40.5 |
| **Seconds:** average / median / longest | 13.7 / 10.5 / 42.3 | 19.1 / 16.8 / 42.3 |
| **Longest king-only stretch** (plies in a row where only kings moved) | 13 | 11 |
| **One side's king walking** (its own moves in a row, all the king's): longest; fights with 5+; with 10+ | 9; 16; 0 | 11; 28; 5 |
| Cash-ins a fight | 0.06 | 0.03 |

68 of 80 fights have the same winner as before.

**What changed for the bigger army.** It now wins by gaining (15 early ends need 3 pawns gained) or outright (bare king 28, mate 7),
not by holding its edge. Its losses go from 4 to 6, and wins by the side that started behind from 4 to 6. Most of the bigger army's
wins stay, because it usually does gain: it has more to attack with.

**Draws:** 12 (15%), from 8 (10%). 10 of the 12 are even starts that stayed even. When one engine plays both sides, "nothing
gained" is common.

## The long king walks

With the gains, 5 fights have a side walking only its king for 10 moves or more (0 before); the longest is 11 moves.

**At the real pace each one takes 5.7 to 6.3 s, and every ply of every walk plays at the fast pace (0.3 s).** The fight has thinned
out by then (`fightFastPieces`, or a side down to king and pawns):

| Fight | Walk (moves) | Plies (all fast) | Seconds | How the fight ended |
| --- | --- | --- | --- | --- |
| #11, round 8, 8 v 8 | 10 | 19 | 5.7 | quiet cap, Black gained 5.6 pawns |
| #23, round 3, 5 v 5 | 11 | 21 | 6.3 | bare king, White |
| #27, round 4, 6 v 6 | 10 | 19 | 5.7 | mate, Black |
| #40, round 2, 5 v 5 | 11 | 21 | 6.3 | quiet cap, White gained 0.7 pawns |
| #60, round 4, 7 v 6 | 11 | 21 | 6.3 | quiet cap, Black gained 2.5 pawns |

Three of the five end at the quiet cap, which (10 moves a side with no capture) is what bounds them. The king walks while the other
side maneuvers without a capture.

**Two rule-free settings were tried against them on the same 80 fights. Neither is proposed:**

| Settings (with 50 / 300) | Draws | Too far ahead | Seconds: median / longest | One side's king walks: longest; 10+ |
| --- | --- | --- | --- | --- |
| as shipped (`quietCap` 10, `decisiveMoves` 6) | 12 (15%) | 15 | 16.8 / 42.3 | 11; 5 |
| `quietCap` 8 | **15 (18.8%)** | 6 | 16.2 / 38.4 | **14**; 2 |
| `decisiveMoves` 4 | 12 (15%) | 19 | 15.8 / 41.1 | 11; 5 |

- **`quietCap` 8** cuts the 10-move walks from 5 to 2, but raises draws back to 18.8%. Its longest walk is also longer (14 moves),
  since a fight that would have stalled goes on another way.
- **`decisiveMoves` 4** ends 4 more fights early and shortens fights a little, but leaves the walks untouched. They are not in
  fights a gain decides.
- So no single setting cuts the walks without raising draws. Each walk is about 6 s of fast moves, bounded by the quiet cap.

## The margins

All on the same 80 fights:

| `stallWinMargin` / `decisiveMargin` | Draws | Bigger army W / L / D | Started behind wins | Early ends | Seconds: median / longest | One side's king walks: longest; 10+ |
| --- | --- | --- | --- | --- | --- | --- |
| 100 / 500 (first build) | 15 (18.8%) | 46 / 7 / 7 | 7 | 1 | 20.7 / 48.6 | 27; 9 |
| 100 / 300 | 15 (18.8%) | 46 / 7 / 7 | 7 | 8 | 20.1 / 45.6 | 19; 8 |
| 50 / 500 | 12 (15%) | 52 / 6 / 2 | 6 | 3 | 17.7 / 46.8 | 11; 5 |
| **50 / 300 (shipped)** | **12 (15%)** | **52 / 6 / 2** | **6** | **15** | **16.8 / 42.3** | **11; 5** |

- **The half-pawn stall margin** cuts the draws, and it makes a side that has gained a little play on for the stall instead of
  shuffling.
- **The 3-pawn early end** stops the fight once a side has clearly won material, instead of hunting every last piece.
- **Draws stay above before's 10%.** That is the cost of not rewarding the bigger army. Below half a pawn, the "gain" would be the
  engine's positional noise.
