# Auto chess (the demo)

Lane: the director. A TFT-style auto battler with chess pieces, against a bot, all in the browser (`/autochess`). A demo to
feel it ("it might just be terrible"): nothing is recorded, rewarded or sent. **Shelved** (Eric, Oct 19: "it's going to take
more work than I realized to make this balanced and fun"): no button on home; admins open it from Settings → TESTING ("Auto
chess (shelved demo) ›"). Why it is the way it is: [docs/decisions/2026-10-19-autochess-demo.md](../decisions/2026-10-19-autochess-demo.md).

## How it works today

- **A round:** the game puts both kings on mirrored squares (the same file, the rank mirrored) on a random square of each side's
  back two ranks. **Buy and place** 30 s (the last 3 locked, "Locked" on the timer): the shop row (pawn 10, knight 30, bishop 32,
  rook 50, queen 90, one queen a round; a piece you can't buy is greyed with its reason under the price) puts a piece on your
  bench of 8; drag it, or tap it then a square, onto your half; drag a placed one back to the bench; sell by dragging onto
  the shop row or tap it then "Sell N" (90% back, rounded down). The opponent's pieces show as plain circles 2 s behind, as
  the bot places them. **Reveal and adjust** 15 s: their real pieces show and stay shown (one plain line over their half),
  and each of your pieces may make one legal chess move on your half (no captures, nothing into their half); a moved piece is
  marked, a tap takes its move back. **Fight:** the engine plays both armies at the same strength, a move about every
  0.35 s, to mate, stalemate, a draw by the rules, 60 moves a side or 10 a side with nothing taken (then material
  decides). **Pawns don't promote:** a pawn never moves onto its last rank. **Result:** the loser loses 2
  + 1 per enemy piece left; 20 HP each. **Nothing carries over but gold, HP and the win streak:** each round starts with
  the two kings only. Each side gets back 25% of its pieces' price still on the board and its bench in full; income 100 then
  +20 a round (max 200), interest, win streak gold; the result line shows the next round's gold.
- **Colors** alternate (White in round 1); your half is always at the bottom (the board turns).
- **Legal positions only** (the engine refuses others): pawns not on your back rank, at most 8, extras beyond the starting
  set at most 8 minus your pawns; shop limits count what you own (board and bench).
- **Who moves first:** White, unless a king is attacked as the fight starts (that side first); both attacked: a drawn round.
- **The bot** (`autochess/bot.ts`): simple buying rules, places pawns in front and pieces behind (seeded), adjusts greedily
  with a small engine search; it sells nothing.
- **The board** is the shared `Board` (colors, sizes, knocks). In the buy and adjust steps it draws a position and the screen
  puts its own layer over it (taps, drags, dots, the circles, the moved marks: in eighths of `--board-size`); in the fight it
  is an ordinary board with the engine's moves.

## Where the code is

| What | Where |
| --- | --- |
| The screen (steps, timers, taps and drags) | `packages/app/src/screens/AutoChess.tsx`; styles `styles.css`, "Auto chess" (`ac-`) |
| The rules, pure and tested | `packages/app/src/autochess/`: `army.ts` (squares, kings, shop and placement limits, buying, selling), `adjust.ts`, `economy.ts` (gold, streaks, refunds, HP, the match), `position.ts` (FEN, who moves first, material), `bot.ts`, `fight.ts`, `words.ts` (what the result says), `engine.ts` (the browser's Stockfish for the fight and the bot) |
| Home's button, the route | `screens/Home.tsx` (`onAutoChess`), `App.tsx` (`/autochess`) |
| The sell sound | `sound.ts` (`sell`) |

## Settings

`AUTOCHESS` in `packages/core/src/settings.ts`: prices, sell back, the steps' seconds, the adjust move cap (off), the bench,
the king ranks, the fight's pace and search (`fightMoveMs`, `fightNodes`), the move cap, HP and damage, start gold,
income, interest, the survivors' refund, the streak tables, the legal-position limits, the bot's numbers. Test switches
(where they work): `?quick=1` short steps, `?seed=N`.

## Tests and tools

- Unit: `packages/app/test/autochess-rules.test.ts` (the shop and its reasons, sell back, the kings, placement, the adjust
  moves, who moves first), `autochess-match.test.ts` (the economy, a round that starts empty, the bot's buys and places staying
  legal over 300 seeds, its greedy adjust, fights ending within the cap and by mate or stalemate), `autochess-words.test.ts`.
- e2e: `e2e/autochess.spec.ts` (phone and computer: home's button, buy, place, sell, the reasons, the lock, the circles, the
  reveal and one move each, a fight to a result and the next round, layouts); `e2e/home-layout.spec.ts` (the button and your
  pawn's size on home).

## Rules for this area

- A change to a rule or a number is made in `AUTOCHESS` or the pure files, with its unit test; the screen draws what the rules say.
- Nothing is drawn per frame: the clock is read every 120 ms, the board draws only when its position changes.
- The board never moves between steps: the box under it is the same height in every step.
