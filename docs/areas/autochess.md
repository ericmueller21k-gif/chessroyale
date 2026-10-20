# Auto chess (the demo)

Lane: the director. A TFT-style auto battler with chess pieces, against a bot, all in the browser (`/autochess`). A demo to
feel it ("it might just be terrible"): nothing is recorded, rewarded or sent. **Shelved** (Eric, Oct 19: "it's going to take
more work than I realized to make this balanced and fun"): no button on home; admins open it from Settings → TESTING ("Auto
chess (shelved demo) ›"). Why it is the way it is: [docs/decisions/2026-10-19-autochess-demo.md](../decisions/2026-10-19-autochess-demo.md).

## How it works today

- **A round:** the game puts both kings on mirrored squares (the same file, the rank mirrored) on a random square of each side's
  back two ranks. **Buy and place** 30 s (the last 3 locked, "Locked" on the timer):
  - **The shop is five random slots** (pawn 75%, knight 10%, bishop 8%, rook 5%, queen 2%; prices pawn 10, knight 30, bishop 32,
    rook 50, queen 90, one queen a round). Buying a piece rolls a new one into its slot; **Reroll** (5 gold, a button under the
    shop) rolls all five; a round starts with a fresh shop, free. Every roll is seeded by the round, the reroll count and the
    refill count, so a test repeats. A slot you can't buy is greyed with its reason under the price (no gold, a limit, bench full,
    locked). Bought pieces go to a bench of 8; drag one, or tap it then a square, onto your half; drag a placed one back to the
    bench; sell by dragging onto the shop row or tap it then "Sell N" (90% back, rounded down).
  - **Lock in** (the gold button beside Reroll): your board, bench and shop freeze for the rest of the step, **the first side to lock
    in gets 25 gold at once**, the other side sees "Locked in" by the opponent's name (or its own button), and when both have
    locked the step ends at once. The bot locks at a seeded time in the open part of the step, or now and then never.
  - **The board holds at most 10 pieces and the king.** A placement past it is refused ("Your board is full: 10 pieces and your
    king at most."). A piece already on the board may still move about.
  - **Each pawn is picked up once:** a pawn you have placed may be picked up once; wherever it goes then (another square, or the
    bench and later a square) its next placement is final (a small gold dot marks it). Tapped, it says "This pawn can't move
    again. You can still sell it." Other pieces move freely.
  - **The opponent's pieces show 2 s behind, as the bot places them:** its pawns as real pawns, every other piece as a plain circle.
- **When buying ends** (the time, or both locked in), pieces still on your bench **drop onto your board by themselves**, left to
  right in bench order (the left of your screen), each on its first good square (pawns in front, pieces behind, by the placement
  rules), **until your board has 8**; the rest stay on the bench. Same for the bot.
- **Reveal and adjust** 15 s: their real pieces show and stay shown (one plain line over their half). You get **one chess move in
  all** (any one of your pieces, the king too, on your half: no captures, nothing into their half) and **one drop** of a bench piece
  onto an empty square of your half for 25 gold (the placement rules and the 10-piece limit; greyed with the reason when it is used,
  the gold isn't there or the board is full). Either, both or neither, in any order; a piece you moved or dropped is marked (arrow),
  and a tap takes the change back (a drop gives its gold back; a change another one stands on waits for that one). Hidden from the
  opponent until the fight.
- **Fight:** the engine plays both armies at the same strength, a move about every 0.35 s and **twice as fast (0.175 s) after 30
  moves a side**, to mate or 5 checks in a row by one side (a win either way), stalemate, a draw by the rules, 60 moves a side or 10
  a side with no capture or check (then material decides). **A side left with only its king loses at once** (before mate, stalemate
  and "not enough pieces"; both kings alone: a draw), and so does a side that starts the fight with only its king. **Pawns don't
  promote:** a pawn never moves onto its last rank. **Result:** the loser loses 2 + 1 per enemy piece left; 20 HP each. **Nothing
  carries over but gold, HP and the win streak:** each round starts with the two kings only. Each side gets back 25% of its pieces'
  price still on the board and its bench in full; income 100 then +20 a round (max 200), interest, win streak gold; the result
  line shows the next round's gold.
- **Colors** alternate (White in round 1); your half is always at the bottom (the board turns).
- **Legal positions only** (the engine refuses others): pawns not on your back rank, at most 8, extras beyond the starting
  set at most 8 minus your pawns; shop limits count what you own (board and bench).
- **Who moves first:** White, unless a king is attacked as the fight starts (that side first); both attacked: a drawn round.
- **The bot** (`autochess/bot.ts`): buys from its own seeded random shop (picking among what it sees by weights, minor pieces and
  rooks over pawns, a queen when rich; rerolling now and then when it has gold to spare, at most 3 a round), puts down 8 pieces
  (pawns in front, pieces behind, seeded), keeps at most one more on its bench, bought only with the 25 gold for the drop left;
  in the adjust step it picks its one move and, when it can pay, one drop greedily with the engine (a drop is kept when it scores
  better, or when the bot isn't already winning: the engine's score saturates). It sells nothing.
- **The board** is the shared `Board` (colors, sizes, knocks). In the buy and adjust steps it draws a position and the screen
  puts its own layer over it (taps, drags, dots, the circles, the marks: in eighths of `--board-size`); in the fight it
  is an ordinary board with the engine's moves.

## Where the code is

| What | Where |
| --- | --- |
| The screen (steps, timers, taps and drags) | `packages/app/src/screens/AutoChess.tsx`; styles `styles.css`, "Auto chess" (`ac-`) |
| The rules, pure and tested | `packages/app/src/autochess/`: `army.ts` (squares, kings, buying and placement limits, the board limit, the pawn pick-up, the auto-drop, selling), `shop.ts` (the five slots, refills, rerolls), `lockin.ts` (lock in, the bonus, the freeze), `adjust.ts` (one move, one drop, taking them back), `economy.ts` (gold, streaks, refunds, HP, the match), `position.ts` (FEN, who moves first, material), `bot.ts`, `fight.ts`, `words.ts` (what the result says), `engine.ts` (the browser's Stockfish for the fight and the bot) |
| Home's button, the route | `screens/Home.tsx` (`onAutoChess`), `App.tsx` (`/autochess`) |
| The sell sound | `sound.ts` (`sell`) |

## Settings

`AUTOCHESS` in `packages/core/src/settings.ts`: prices, the shop (slots, odds, reroll cost), sell back, the lock-in bonus, the
steps' seconds, the adjust step's moves, drops and drop cost, the bench, the board limit and the auto-drop's number, the king ranks,
the fight's pace and search (`fightMoveMs`, `fightFastAfter`, `fightFastMoveMs`, `fightNodes`), the move cap, HP and damage, start
gold, income, interest, the survivors' refund, the streak tables, the legal-position limits, the bot's numbers (lock-in times,
rerolls, saving, the adjust search, drops). Test switches (where they work): `?quick=1` short steps, `?seed=N`, `?gold=N` (N more
gold at the start of round 1).

## Tests and tools

- Unit: `packages/app/test/autochess-shop.test.ts` (the odds over many rolls, refills, rerolls, a round's fresh shop),
  `autochess-lockin.test.ts` (the bonus to the first only, the freeze, both locked, the bot's lock time),
  `autochess-rules.test.ts` (the shop's reasons, sell back, the kings, placement, the 10-piece board, the auto-drop's order and its stop
  at 8, a pawn's one pick-up, the adjust step's one move and one drop and their undo, who moves first), `autochess-match.test.ts` (the
  economy, a round that starts empty, the bot's buys, rerolls, places and adjust staying legal over hundreds of seeds, fights ending
  within the cap and by mate, stalemate or a lone king, the late speed-up), `autochess-words.test.ts` (the words, and the settings'
  numbers).
- e2e: `e2e/autochess.spec.ts` (phone and computer; seeds are in the file: the shop, reroll, lock in and the bonus, the 10-piece board,
  the auto-drop, the opponent's pawns, a fixed pawn, the adjust step's move and drop, a lone king, a fight to a result and the next
  round, layouts); `e2e/home-layout.spec.ts` (the button and your pawn's size on home).

## Rules for this area

- A change to a rule or a number is made in `AUTOCHESS` or the pure files, with its unit test; the screen draws what the rules say.
- Nothing is drawn per frame: the clock is read every 120 ms, the board draws only when its position changes.
- The board never moves between steps: the box under it is the same height in every step (the message line, the bench, the shop and
  the buttons together: 186 px; the adjust step's bench is in it).
- A seed in an e2e test fixes the shop, the kings and the bot; changing how a roll is made (the shop's seeding, the bot's draws)
  changes every seed's fixture: re-pick them (a small script over the pure code finds one).
