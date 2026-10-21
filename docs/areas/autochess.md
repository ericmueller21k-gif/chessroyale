# Auto chess (the demo)

Lane: the director. A TFT-style auto battler with chess pieces, against a bot, all in the browser (`/autochess`). A demo to
feel it ("it might just be terrible"): nothing is recorded, rewarded or sent. **Shelved** (Eric, Oct 19: "it's going to take
more work than I realized to make this balanced and fun"): no button on home; admins open it from Settings → TESTING ("Auto
chess (shelved demo) ›"). Why it is the way it is: [docs/decisions/2026-10-19-autochess-demo.md](../decisions/2026-10-19-autochess-demo.md)
(v6 is its last design section; the HunChess engine, Oct 21, after it).

## How it works today (v6)

- **A round:** the game puts both kings on mirrored squares (the same file, the rank mirrored) on a random square of each side's
  back two ranks. **Buy** 30 s (the last 3 locked, "Locked" on the timer), the full reveal and **adjust** 5 s, the fight, the
  result. Every board starts with only its king.
- **The shop decides where pieces go.** Five **offers**, each a piece and a square of your half ("Bishop c2" under the piece and
  its price). The odds are pawn 75, knight 10, bishop 8, rook 5, queen 2 (prices pawn 10, knight 30, bishop 32, rook 50, queen 90,
  one queen at most). A pawn is offered on your 2nd to 4th rank, any other piece anywhere on your half; only squares you could use
  (empty, not your king's, the legal-position limits). **On the board each offer is a glowing green silhouette** of its piece on its
  square (two or more on one square are smaller, side by side). **Tap an offer, in the shop or its silhouette, to buy it:** it lands
  on its square and a new offer rolls into the slot; another offer on that square rolls again ("Another offer was on b4: it rolled
  again."). **Reroll** costs 2 and rolls all five; a round starts with a fresh shop, free. An offer you can't buy is greyed with its
  reason under the price (no gold, one queen at most, 8 pawns, too many pieces, locked); when only your level has no room it says
  "Level full" and can still be held. Every roll is seeded by the round, the reroll count and the refill count, so a test repeats.
  There is no free placing or dragging pieces about.
- **The bench** holds 4 pieces and **stays from round to round** (the board's pieces still go home each round). **Drag an offer
  (its card or its silhouette) onto the bench row to hold it:** you pay now, the piece keeps the square it was offered on, and tapping
  it places it there when that square is free and your level allows ("b4 is taken.", "c2 is your king's square."). Because the colors
  turn each round, a held piece's square turns with them (same file, rank mirrored, as the kings are). What is held counts as owned for
  the shop's limits. **Selling gives back 75%** (P7 N22 B24 R37 Q67): tap a piece on the board then "Sell N", or drag a piece from the
  board or the bench onto the shop row; a "+N" floats up from the square or bench slot it was sold from.
- **Levels:** your level is how many pieces (not the king) you may have on the board. Start at 4, top 10. **+2 XP free at each round's
  start** (round 1 too); **Buy XP gives 4 XP for 20 gold**; XP to the next level 4, 8, 12, 16, 20, 24 (4 to 5 ... 9 to 10), the extra
  carrying over. Placing past your level is refused ("Your level allows 4 pieces on the board. Buy XP to level up."). Each side's strip
  shows its level and XP ("Lv 4 · 2/4 XP", a thin gold line under it); a level-up pops the number and plays a chime.
- **Lock in** (the gold button): your board, bench, shop and XP freeze for the rest of the step, **the first side to lock in gets 25
  gold at once**, the other side sees "Locked in" by the opponent's name, and when both have locked the step ends at once. The bot locks
  at a seeded time in the open part of the step, or now and then never.
- **The opponent's board while you buy:** every piece of theirs is a plain circle, **pawns too**, 2 s behind; **every 5 s of the 30 one
  piece is revealed at random** (5, 10, 15, 20 and 25 s: five) and stays shown as the piece it is, a gold ring opening on its square
  and a ping. Their gold, HP, level and XP show in their strip (2 s behind, as the circles are); "Locked in" shows at once.
- **Adjust** 5 s (the full reveal: their real pieces show and stay shown, one plain line over their half): **one change.** Move one of
  your pieces to any legal empty square of your half (not a chess move: a knight may go to the far corner; a pawn never to your back
  rank), hidden from them until the fight; tap the moved piece (↩) to take it back while the step lasts. The king stays where the game
  put it. A refused square says why in the placement rules' words. `adjustStep` false skips the step (straight to the fight); testers
  add `?adjust=0`.
- **Fight:** **the HunChess engine** (our own, `packages/chess/src/hunchess/`, in a Web Worker: [the decision](../decisions/2026-10-21-hunchess-engine.md))
  plays both armies at the same fixed node budget (`fightNodes`), a move about every 0.35 s and **twice as fast (0.175 s) after 30 moves
  a side, or once either side is down to its king and pawns**, to mate, stalemate or too little material to mate (draws), or a
  **stall**: a threefold repetition, 10 moves a side with no capture or cash-in (a check doesn't count), or 60 moves a side. **A stall
  goes to the side the engine's score of the final position (material and position) favors by a pawn** (`stallWinMargin`); closer is a
  draw. **Too far ahead:** a side the engine's score favors by 5 pawns (`decisiveMargin`) for 6 of its own moves in a row
  (`decisiveMoves`) wins at once, unless the engine has found it a forced win within 5 moves (`mateShowMoves`), which plays out. Checks
  in a row count for nothing (until Oct 21, 5 of them won). The result line says why, naming the sides "you" and "your opponent" ("Fight
  stalled (60 moves each): you're 2 pawns up.", "Your opponent is too far ahead: 5+ pawns for 6 moves."; [the decision](../decisions/2026-10-21-autochess-endings.md)). **A side left
  with only its king loses at once** (both: a draw), and so does a side that starts the fight with only its king. **No promotion: a pawn that moves onto its last rank cashes in:** it lands there, a
  coin sounds, a "+5" floats up from the square, and it leaves the board; its owner gets **5 gold** (`cashInGold`) with the next round's
  pay ("+ 5 from cash-ins" in the result's gold line). The engine knows every one of these rules inside its search (the counters are part
  of its position, and it judges a stall as the fight does) but the early end, which only stops a fight it is winning anyway; the fight
  plays by the engine's own rules code, so the two never disagree. Stockfish isn't loaded on this screen.
  If the engine doesn't answer within 4 s a stand-in move is played (a capture if there is one); after three misses in a row the rest of
  the visit plays stand-ins, so a fight always ends. **Result:** the loser loses
  2 + 1 per enemy piece left; 20 HP each. **Nothing carries over but gold, HP, the win streak, the bench and each side's level and XP:**
  each round starts with the two kings only. Each side gets back 25% of the price of its pieces still on the board; income 100 then +20
  a round (max 200), interest, win streak gold; the result line shows the next round's gold.
- **Avatars:** each side's strip has its pawn: yours is the pawn home and your profile draw (your name, your items, your board's color),
  right under your side of the board; the bot's is a pawn of its own (a look seeded by the match, named "Bot") right above theirs.
- **Sounds and feel** (all synthesized, `autochess/sounds.ts`, each under a move's peak and loudness, muted with the rest): reroll (a
  riffle and a coin's clink), place (a thunk), hold (a soft pop), sell (a coin cascade), buy XP (a small rising chime), level up (a
  bigger chime), lock in (a latch click), a reveal (a ping). Every button presses down while held; Reroll is a thicker key that drops
  onto its shadow. The floating gold is `components/FloatGold.tsx` (CSS only, over a square or a bench slot).
- **Colors** alternate (White in round 1); your half is always at the bottom (the board turns).
- **Legal positions only** (the engine refuses others): pawns not on your back rank, at most 8, extras beyond the starting set at most
  8 minus your pawns; the limits count what you own (board and bench).
- **Who moves first:** White, unless a king is attacked as the fight starts (that side first); both attacked: a drawn round.
- **The bot** (`autochess/bot.ts`): places what it held first, for nothing; buys from its own seeded shop (picking among what it sees by
  weights, minor pieces and rooks over pawns, a queen when rich; rerolling now and then, at most 4 a round); buys XP now and then when
  that gives it a level or it is rich; with its board full holds a good piece (never a pawn) on its bench, at most 2 a round; puts its
  pieces down evenly over the first 70% of the open step; in the adjust step picks its one change greedily with the engine (a small
  search per try with the HunChess engine (`bot.adjustNodes`), at most 16 tries, a few random squares for each of some pieces). It sells
  nothing.
- **The board** is the shared `Board` (colors, sizes, knocks). In the buy and adjust steps it draws a position and the screen puts its
  own layer over it (taps, drags, dots, the circles, the silhouettes, the marks, the floating gold: in eighths of `--board-size`); in
  the fight it is an ordinary board with the engine's moves.

## Where the code is

| What | Where |
| --- | --- |
| The screen (steps, timers, taps and drags) | `packages/app/src/screens/AutoChess.tsx`; styles `styles.css`, "Auto chess" (`ac-`) |
| The rules, pure and tested | `packages/app/src/autochess/`: `army.ts` (squares, kings, the buy, hold, place and sell checks and words, the bench's carry-over), `shop.ts` (the five offers, rolls, refills, rerolls, buying and holding from a slot), `level.ts` (XP and levels), `lockin.ts`, `adjust.ts` (the one change, taking it back, the step switch), `reveal.ts` (what shows of their board while you buy), `economy.ts` (gold, streaks, refunds and cash-ins, HP, levels, the match), `position.ts` (FEN, who moves first, material), `bot.ts`, `fight.ts` (the fight, refereed by the HunChess engine's rules), `words.ts`, `sounds.ts` (the nine sounds), `engine.ts` (the link to the engine's worker), `hunchess-worker.ts` (the worker) |
| The HunChess engine | `packages/chess/src/hunchess/` (`@chessroyale/chess/hunchess`): `board.ts` (the board, moves, every fight rule), `search.ts`, `eval.ts`, `pst.ts`; its strength and speed: `reports/hunchess-engine.md`, scripts `packages/sim/scripts/hunchess-*.ts` |
| The floating gold | `components/FloatGold.tsx` |
| The sounds' play names | `sound.ts` (`acReroll`, `acPlace`, `acHold`, `sell`, `acXp`, `acLevel`, `acLock`, `acReveal`, `acCash`); made ahead by the sound worker through `characters/boss-sounds.ts` (`autochess`) |
| Home's button, the route | `screens/Home.tsx` (`onAutoChess`), `App.tsx` (`/autochess`) |

## Settings

`AUTOCHESS` in `packages/core/src/settings.ts`: prices, the shop (slots, odds, reroll cost), sell back, the bench's slots, the lock-in
bonus, the steps' seconds, the reveal's interval, the adjust step (on or off, seconds, changes), the levels (start, top, free XP, XP
bought and its price, the XP to each level), the king ranks, the fight's pace and search (`fightMoveMs`, `fightFastAfter`,
`fightFastMoveMs`, `fightNodes`), the cash-in (`cashInGold`, and `cashInValue`: what the engine counts a cash-in's gold as, in centipawns), the move cap, HP and damage, start gold, income, interest, the survivors' refund, the streak tables,
the legal-position limits, the bot's numbers (lock-in times, rerolls, holds, XP, how early it places, saving, the adjust search).
Test switches (where they work): `?quick=1` short steps (buy 7 s with the last 2 locked, a reveal every 1.5 s, adjust 8 s), `?seed=N`,
`?gold=N` (N more gold at the start of round 1), `?adjust=0` (no adjust step), `?fightfen=FEN` (the fight starts from that position),
`?stall=1` (the engine never answers: stand-in moves).

## Tests and tools

- Unit: `packages/app/test/autochess-shop.test.ts` (the odds, usable squares, buying and holding from a slot, refills, rerolls),
  `autochess-lockin.test.ts`, `autochess-level.test.ts` (levels, XP, the room a level gives, the bot's levels),
  `autochess-reveal.test.ts` (the reveal times, what shows when), `autochess-rules.test.ts` (the shop's reasons, selling at 75%, the
  bench, the kings, placing, the adjust step's change and its off switch), `autochess-match.test.ts` (the economy, the bench through the
  rounds, the bot's buys, holds, XP, rerolls and adjust staying legal over hundreds of seeds and a whole match, fights ending within the
  cap; the fight's rules, cash-ins and their gold), `autochess-engine.test.ts` (the worker link: answers, the bot's look, the timeout's
  stand-ins), `autochess-sounds.test.ts` (peak, loudness, different from each other), `autochess-words.test.ts` (the words, the settings'
  numbers).
- Engine: `packages/chess/test/hunchess-board.test.ts` (perft against known counts and chess.js, a fight's moves, every rule),
  `hunchess-search.test.ts` (wins and losses by the fight's rules, determinism, the node budget).
- e2e: `e2e/autochess.spec.ts` (phone and computer; seeds are listed at its top): the shop and its silhouettes, a reroll, buying by tap,
  the reasons, selling by tap and drag, the bench, levels, the lock in, the reveals, the adjust change and its off switch, the avatars,
  the button feel, the floating gold, mute, a fight to a result and the next round, a cash-in's "+5", a fight with a silent engine, layouts. `e2e/home-layout.spec.ts` (home).

## Rules for this area

- A change to a rule or a number is made in `AUTOCHESS` or the pure files, with its unit test; the screen draws what the rules say.
- Nothing is drawn per frame: the clock is read every 120 ms, the board draws only when its position changes; the rings, the floating
  gold and the level pop are CSS animations on still boxes.
- The board never moves between steps: the box under it is the same height in every step (the message line, the bench, the shop and
  the buttons together: 186 px), with your strip just under the board and theirs just above.
- A seed in an e2e test fixes the shop, the kings and the bot's lock time; changing how a roll is made (the shop's seeding) changes
  every seed's fixture: re-pick them (a small script over the pure code finds one). The bot's lock-in time comes from a draw of its own,
  so changing how the bot buys doesn't move it.
- A sound's play name goes in `SoundName` and `MAKE` (sound.ts); a sound is added with its peak and loudness test.
