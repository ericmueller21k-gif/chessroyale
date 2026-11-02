# Auto chess: a TFT-style economy, whole-number gold (Nov 1, 2026)

## What Eric asked

Oct 25: "rework Auto chess's gold so it plays like Teamfight Tactics, with buying, rolling and leveling in small whole numbers… Will
need to test it a bit so it feels like TFT… this is for another day" (ROADMAP, "Auto chess: a TFT-style economy"). Nov 1: "I thought we
were changing it to match TFT style with… gold earned, levels cost, reroll with… a slight reroll change I had suggested… the raw number
difference… for what each piece would cost." His numbers: pieces 1 / 3 / 3 / 5 and a queen of 7 "unless 8 or 9 is more true to chess
value"; 4 gold for 4 XP, top level 10; income squeezed to TFT's size; interest +1 per 10 held up to +5 at 50; rolls 2, 3, 4, 5 within a
round, capped at 5; everything else in gold scales down with it.

## What changed (`AUTOCHESS` in `packages/core/src/settings.ts`, old → new)

| | before (×10 scale) | now |
|---|---|---|
| Prices P / N / B / R / Q | 10 / 30 / 32 / 50 / 90 | **1 / 3 / 3 / 5 / 9** |
| Buy XP | 20 gold for 4 XP | **4 gold for 4 XP** (the XP table and the top level, 10, unchanged) |
| Income | 100, +20 a round, up to 200 | **10, +2 a round, up to 20** |
| Interest | 10 per 100 banked, up to 30 | **1 per 10 banked, up to 5 (at 50)** |
| Reroll | 5, +1 a roll, up to 10 | **2, +1 a roll, up to 5** (back to 2 each round) |
| Win streak (2-3 / 4 / 5+) | 10 / 20 / 30 | **1 / 2 / 3** |
| Star-up | 5 | **1** |
| Cash-in | 5 | **1** |
| Lock-in bonus (off since v7) | 25 | **3** |
| Selling (75%) P / N / B / R / Q | 7 / 22 / 24 / 37 / 67 (rounded down) | **1 / 2 / 2 / 4 / 7** (to the nearest, a half up) |
| Survivors' refund (25%) | rounded down | **to the nearest, a half up** |
| Bot: `rerollGold`, `xpGold`, `xpRichGold` | 70, 60, 140 | **7, 6, 14** |
| Bot: `xpChance`, `xpChanceFull` | 0.2, 0.7 | **0.3, 0.8** (tuned by the sim, below) |
| Bot: banking for interest | "a hundred" (whole 100s up to 3 of them), keeping 30 to spend | whole 10s up to 5 of them, keeping **`saveKeep` 8** to spend |
| Bot: a queen only with this much left after her | 40 (a constant in bot.ts) | **`queenChange` 4** (a setting now) |

`cashInValue` (20) is centipawns for the engine, not gold: unchanged.

## Judgment calls

1. **The queen is 9** (Eric: "7, unless 8 or 9 is more true to chess value"): 9 is her chess value, and today's prices were already the
   chess values times ten. The director's call in the brief.
2. **Income 10, +2, up to 20** (today's ÷10). Unlike TFT, every round here starts with the two kings only, so a side rebuys its whole
   army each round: TFT's 5 a round would shrink the boards to two or three pieces. The sim (below) kept the game's shape with today's
   income ÷10; TFT-like is the rest: a bigger interest (+5 at 50), dearer XP and rolls, small whole numbers everywhere.
3. **Selling and the refund round to the nearest gold, a half up** (were rounded down). Rounded down, a pawn would sell for 0 and a
   rook for 3 (75% of 5 is 3.75); to the nearest, every piece sells for something, never for more than it cost (a pawn sells for its 1),
   and the five prices stay closest to 75%.
4. **The bot banks up to the new interest top (50) but keeps 8 to spend**, and buys XP a little more often (0.3 / 0.8): with XP twice as
   dear against the income and banking worth more, the straight ÷10 bot sat at a lower level and fielded about 0.5 to 0.8 fewer pieces
   from round 6 on. With these two the boards, levels and stars by round match today's (below).
5. **The gold row's layout test keeps its widest case** (3 digits of gold, +200, W10) as a margin: a long match now makes 2 digits and
   +20, so nothing can shift.

## The sim (before → after)

`packages/sim/scripts/autochess-economy.ts`: whole bot-against-bot matches with real fights (the HunChess engine at the fight's node
budget, the screen's own pure code, no move step), 60 matches, seeds 1000 to 1059, both sides buying with the bot's plan.

| | before | after |
|---|---|---|
| Rounds a game | median 8, mean 8.02, 6 to 10; 58/60 in 7 to 10 | median 8, mean 8.25, 7 to 10; **60/60** in 7 to 10 |
| Draws | 41 of 481 rounds | 62 of 495 |
| Level by round (1, 3, 5, 7, 9) | 4.4, 5.5, 6.3, 7.2, 7.9 | 4.5, 5.5, 6.2, 7.0, 7.7 |
| Pieces on the board (1, 3, 5, 7, 9) | 4.1, 4.9, 5.8, 6.8, 7.3 | 3.8, 5.1, 5.9, 6.6, 7.2 |
| Stars paid on the board (1, 3, 5, 7, 9) | 0.22, 0.33, 0.64, 1.05, 1.19 | 0.19, 0.38, 0.55, 0.93, 1.00 |
| Gold spent: pieces / star-ups / rolls / XP | 86% / 2% / 1% / 10% | 76% / 3% / 6% / 15% |
| Rolls | 0.43 a side a round, in 33% of rounds | 0.44, in 35% of rounds |

Rolling and leveling now take a real share of the gold (TFT-like), and the bot still rolls in about a third of its rounds, levels, and
banks for interest. A straight ÷10 of the bot's thresholds (bot `saveKeep` 3, `xpChance` 0.2 / 0.7) gave rounds median 8, mean 8.18,
58/60 in 7 to 10, but level 7.5 and 6.4 pieces at round 8 against today's 7.8 and 7.2.

Lane: targeted (numbers plus the rounding and the bot's banking: logic). No check guarding a rule in `docs/rules/eric.md` changed.
