# Auto chess (the demo)

Lane: the director. A TFT-style auto battler with chess pieces, against a bot, all in the browser (`/autochess`). A demo to
feel it ("it might just be terrible"): nothing is recorded, rewarded or sent. **Shelved** (Eric, Oct 19: "it's going to take
more work than I realized to make this balanced and fun"): no button on home; admins open it from Settings → TESTING ("Auto
chess (shelved demo) ›"). Why it is the way it is: [docs/decisions/2026-10-19-autochess-demo.md](../decisions/2026-10-19-autochess-demo.md)
(v6 is its last design section; the HunChess engine, Oct 21, after it; [drags, silhouettes and one offer to a square](../decisions/2026-10-21-autochess-drag-fixes.md), Oct 21, after that;
[v7: the new screen, the move step, odds by level, four slots, no lock-in](../decisions/2026-10-21-autochess-v7.md), Oct 21, last).

## How it works today (v7)

- **A round:** the game puts both kings on mirrored squares (the same file, the rank mirrored) on a random square of each side's
  back two ranks. **Buy** 30 s (the last 3 locked, "Locked" under the clock; the whole 30 s runs: no lock-in), the full reveal and the **move step** 7 s, the fight, the
  result. Every board starts with only its king.
- **The shop decides where pieces go.** Four **offers** (v7: was five), each a piece and a square of your half ("Bishop c2" on its card, with its price). **The odds follow the
  level of whoever's shop it is** (`shop.oddsByLevel`, percent P/N/B/R/Q, levels 1 to 10: L1 82/10/8/0/0, L4 74/14/12/0/0, L5 66/14/13/7/0, L7 54/18/16/11/1, L10 36/21/20/16/7; no rooks before
  level 5, no queens before 7, every row 100). Every roll (the first shop, a reroll, a refill after a buy or a hold, `replaceTaken`) uses the level you have then; the offers on show keep
  their pieces when you level up, and the next roll uses the new row. The bot rolls by its own level. Prices pawn 10, knight 30, bishop 32, rook 50, queen 90, one queen at most. A pawn is
  offered on your 2nd to 4th rank, any other piece anywhere on your half; only squares you could use (empty, not your king's, the legal-position limits). **One offer to a square** (Eric,
  Oct 21: "pieces should never be duplicate on one spot"): a roll draws its square from the squares no piece of yours, your king or another current offer is on, so the four offers
  always stand on four squares (a shop the limits leave nothing to offer is shorter). **On the board each offer is a glowing green silhouette** of its piece on its square, filling it.
  **Tap an offer, in the shop or its silhouette, to buy it:** it lands on its square and a new offer rolls into the slot. **A silhouette on the board is only ever tapped** (Eric, Oct 21): it is
  never picked up, dragged or dropped, so a drag that starts on one does nothing (a tap is the pointer staying within 10 px, `TAP_SLOP_PX`); the shop's cards still drag (to the bench). An offer that can no longer use its square (a held piece placed on it,
  the third pawn of a file bought) rolls again, and the small spot says the square it was on ("h4 rolled again"). **Reroll** costs 2 and rolls all four; a round starts with a fresh shop, free. An offer you can't
  buy is dimmed with its reason in a few words when it is tapped ("Need 22 more", "One queen max", "8 pawns max", "Too many pieces"); when only your level has no room it
  isn't dimmed (its square shows in gold) and a tap says "Board full. Drag to bench". Every roll is seeded by the round, the reroll count and the refill count, so a test repeats.
  There is no free placing or dragging pieces about.
- **The bench** holds 4 pieces and **stays from round to round** (the board's pieces still go home each round). **Drag an offer
  from the shop (its card) onto the bench row to hold it:** you pay now, the piece keeps the square it was offered on, and tapping
  it places it there when that square is free and your level allows ("b4 is taken.", "c2 is your king's square."). Because the colors
  turn each round, a held piece's square turns with them (same file, rank mirrored, as the kings are). What is held counts as owned for
  the shop's limits. **Both benches are always on screen** (v7): theirs at the top left with real pieces and each piece's square (Eric: intentional; drawn 2 s behind, as their circles are),
  tap one and its tile gets a red ring and its landing square lights red on their half (a second tap or another piece clears it; it clears when the fight begins), and theirs never drags. **Selling gives back 75%** (P7 N22 B24 R37 Q67): tap a piece on the board then "Sell N", or drag a piece from the
  board or the bench onto the shop row; a "+N" floats up from the square or bench slot it was sold from. **A sale only ever pays for a
  piece of yours that is there now, of the kind the hold says** (`sellPiece` and `sellHeld` return null otherwise: no gold, never for
  the king or an offer); the Sell button only shows for a piece that is really there.
- **Levels:** your level is how many pieces (not the king) you may have on the board. Start at 4, top 10. **+2 XP free at each round's
  start** (round 1 too); **Buy XP gives 4 XP for 20 gold**; XP to the next level 4, 8, 12, 16, 20, 24 (4 to 5 ... 9 to 10), the extra
  carrying over. Placing past your level is refused ("Your level allows 4 pieces on the board. Buy XP to level up."). Each side's strip
  shows its level and XP ("Lv 4 · 2/4 XP", a thin gold line under it); a level-up pops the number and plays a chime.
- **Lock in is off** (v7, Eric: "the whole function/feature"; `lockIn: false`): no button, no bonus for anyone (the bot never locks), and every buy step runs its full time. The code stays
  behind the setting (`?lockin=1` for testers): with it on, a gold bar under the shop locks your board, bench and shop for the rest of the step, **the first side to lock in gets 25
  gold at once**, the other side sees "Locked in" by the opponent's name, and when both have locked the step ends at once; the bot locks at a seeded time in the open part of the step, or now and then never.
- **The opponent's board while you buy:** every piece of theirs is a plain circle, **pawns too**, 2 s behind; **every 5 s of the 30 one
  piece is revealed at random** (5, 10, 15, 20 and 25 s: five) and stays shown as the piece it is, a gold ring opening on its square
  and a ping. Their HP, level and XP show by their pawn (the level 2 s behind, as the circles are); the gold is no longer shown (v7).
- **The move step** (the old "adjust" step; `adjustMode: "legal"`, `adjustSeconds: 7`; the full reveal: their real pieces show and stay shown): **one of your pieces is lit at random** (a pulsing gold box,
  its legal squares as dots), picked by a draw seeded by the round (`youMoveSeed`): never the king, only a piece with at least one legal chess move that stays on your half. You play **one
  legal chess move with it that stays on your half**, or skip (just don't move): tap a dot or drag the piece to it; tap the moved piece (↩) to take it back while the step lasts. Hidden
  from them until the fight. "Legal" is the fight's own rules (the HunChess engine's move generator, `fightMoves`) on the position as the step shows it: a pawn steps one square (two from its
  start rank), pieces are blocked by what stands in their way, a pinned piece can't leave its line, and with your king in check only the moves that answer it are legal; since the target is
  on your half nothing is captured. Any other piece says "Only the lit piece", the king "King stays put", a square it can't reach "Not a legal move". **No piece qualifies:** "No piece can
  move" and the step still runs (the bot may move); neither side able to: straight to the fight. The v6 step (a piece to any legal empty square of your half, not a chess move) stays in
  code behind `adjustMode: "teleport"` (`?adjustmode=teleport`). `adjustStep` false skips the step (straight to the fight); testers add `?adjust=0`.
- **Fight:** **the HunChess engine** (our own, `packages/chess/src/hunchess/`, in a Web Worker: [the decision](../decisions/2026-10-21-hunchess-engine.md))
  plays both armies at the same fixed node budget (`fightNodes`), a move about every 0.6 s and **twice as fast (0.3 s) after 30 moves
  a side, once either side is down to its king and pawns, or once 5 or fewer pieces are left besides the kings
  (`fightFastPieces`, `thinFight`)**, to mate, stalemate or too little material to mate (draws), or a
  **stall**: a threefold repetition, 10 moves a side with no capture or cash-in (a check doesn't count), or 60 moves a side. **What decides
  a fight that isn't won outright is what each side gained during it, not the bigger army** (Eric, Oct 21: "I shouldn't get rewarded
  just because I play more pieces"): the stall judge's score (material and position, a clean quiescence search) of the position now,
  less its score of the fight's start. **A stall goes to the side that gained half a pawn or more** (`stallWinMargin` 50); closer is a draw. **Too far
  ahead:** a side that has gained 3 pawns (`decisiveMargin` 300) after each of 6 of its own moves in a row (`decisiveMoves`) wins at once,
  unless the engine has found it a forced win within 5 moves (`mateShowMoves`), which plays out. Mate, a bare king, stalemate and too
  little material stay absolute. Checks in a row count for nothing (until Oct 21, 5 of them won). The result line says why, naming
  the sides "you" and "your opponent" ("Fight stalled (60 moves each): you gained 2 pawns." or "... the edge." under a pawn, "Your opponent gained 3+ pawns
  and held it for 6 moves."; the decisions: [endings](../decisions/2026-10-21-autochess-endings.md), [gains](../decisions/2026-10-21-autochess-gain.md)). **A side left
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
- **The screen** (v7, from Eric's approved round-4 mock): kitty-corner. At the top, the title row, **their bench** (left) and **their custom pawn** (right: its name and level beside it, thin HP and XP
  bars); the board in its curved frame with **the move clock's bars** (the app's own `TimerBar`, quiet, along its top and bottom in the buy and move steps); under it **your pawn** (left, the dressed pawn of
  your profile, a gold level badge, thin HP and XP bars), **the clock's small numbers** in the gap ("0:28", the step's name under it: "Buy", "Locked", "Move", "Fight"; a short message takes the name's place for 4.2 s)
  and **your bench** (right, the same distance from the board as theirs). Both pawns hop, out of step (1.8 s and 2.1 s loops, transforms and opacity only, off under reduced motion). **Phase banners** on
  the board: "ACTION PHASE" for the first 1.6 s of buying, the big 3-2-1 for its last three seconds, "MOVE PHASE", "BATTLE PHASE": the words in a rounded frosted box, about half the 3's size. No hint text.
  Then **the dock**: the gold row (gold, income, the **odds pill**: each kind's percent at your level under its icon, on the gold number's baseline, faded at 0%; the win streak "W2" from two wins), then Buy XP and Reroll
  (stacked) beside the four square cards. The fight's and the result's boxes take the shop's place. **Sell** is a gold button in the gap under the clock when a piece of yours is selected. On a computer the board is
  at the left and the dock at the right, level with the board's top. Every button and card is 44 px tall or more (a bench tile 44 tall, 34 to 54 wide); nothing scrolls, at 320 x 568 up to a computer.
- **Sounds and feel** (all synthesized, `autochess/sounds.ts`, each under a move's peak and loudness, muted with the rest): reroll (a
  riffle and a coin's clink), place (a thunk), hold (a soft pop), sell (a coin cascade), buy XP (a small rising chime), level up (a
  bigger chime), lock in (a latch click), a reveal (a ping). Every button presses down while held; Reroll is a thicker key that drops
  onto its shadow. The floating gold is `components/FloatGold.tsx` (CSS only, over a square or a bench slot).
- **Colors** alternate (White in round 1); your half is always at the bottom (the board turns).
- **Legal positions only** (the engine refuses others): pawns not on your back rank, at most 8, extras beyond the starting set at most
  8 minus your pawns; the limits count what you own (board and bench).
- **Who moves first:** White, unless a king is attacked as the fight starts (that side first); both attacked: a drawn round.
- **Gestures end with their step** (Oct 21): a press, a drag (its ghost) and a selection are one thing, `cancelGesture()`, and every
  moment that stops them ends them with no action: the last seconds locking the step, lock in, the step changing (the reveal, the
  adjust step's end under a finger most of all), the round turning, the window losing focus, and a pointer that is cancelled or
  loses its capture (also when its element left the screen: a window listener catches that one). Nothing is picked up once the step
  is locked, and the ghost only draws in the buy and adjust steps. The shop's cards take a finger's drag (`touch-action: none`).
- **The bot** (`autochess/bot.ts`): places what it held first, for nothing; buys from its own seeded shop (rolled by its own level; picking among what it sees by
  weights, minor pieces and rooks over pawns, a queen when rich; rerolling now and then, at most 4 a round); buys XP now and then when
  that gives it a level or it is rich; with its board full holds a good piece (never a pawn) on its bench, at most 2 a round; puts its
  pieces down evenly over the first 70% of the open step; in the move step picks a random piece of its own (`botMoveSeed`, the same rule as yours) and plays the engine's best legal move with it
  (a small search per try with the HunChess engine (`bot.adjustNodes`), at most 16 tries), or skips if none beats standing still (`bot.adjustMargin`). It sells
  nothing, and never locks in (lock-in is off).
- **The board** is the shared `Board` (colors, sizes, knocks). In the buy and adjust steps it draws a position and the screen puts its
  own layer over it (taps, drags, dots, the circles, the silhouettes, the marks, the floating gold: in eighths of `--board-size`); in
  the fight it is an ordinary board with the engine's moves.

## Where the code is

| What | Where |
| --- | --- |
| The screen (steps, timers, taps and drags) | `packages/app/src/screens/AutoChess.tsx`; styles `styles.css`, "Auto chess" (`ac-`) |
| The rules, pure and tested | `packages/app/src/autochess/`: `army.ts` (squares, kings, the buy, hold, place and sell checks and words, the bench's carry-over), `shop.ts` (the four offers, the odds by level, rolls, refills, rerolls, buying and holding from a slot), `level.ts` (XP and levels), `lockin.ts` (off since v7), `adjust.ts` (the move step: the legal moves, the random pick, the one move, taking it back, the step switch; the v6 teleport step), `reveal.ts` (what shows of their board while you buy), `economy.ts` (gold, streaks, refunds and cash-ins, HP, levels, the match), `position.ts` (FEN, who moves first, material), `bot.ts`, `fight.ts` (the fight, refereed by the HunChess engine's rules), `words.ts`, `sounds.ts` (the nine sounds), `engine.ts` (the link to the engine's worker), `hunchess-worker.ts` (the worker) |
| The HunChess engine | `packages/chess/src/hunchess/` (`@chessroyale/chess/hunchess`): `board.ts` (the board, moves, every fight rule), `search.ts`, `eval.ts`, `pst.ts`; its strength and speed: `reports/hunchess-engine.md`, scripts `packages/sim/scripts/hunchess-*.ts` |
| The floating gold | `components/FloatGold.tsx` |
| The sounds' play names | `sound.ts` (`acReroll`, `acPlace`, `acHold`, `sell`, `acXp`, `acLevel`, `acLock`, `acReveal`, `acCash`); made ahead by the sound worker through `characters/boss-sounds.ts` (`autochess`) |
| Home's button, the route | `screens/Home.tsx` (`onAutoChess`), `App.tsx` (`/autochess`) |

## Settings

`AUTOCHESS` in `packages/core/src/settings.ts`: prices, the shop (slots, the odds by level `oddsByLevel`, reroll cost), sell back, the bench's slots, lock-in (`lockIn` off, its
bonus), the steps' seconds, the reveal's interval, the adjust step (on or off, `adjustMode` legal or teleport, seconds 7, changes), the levels (start, top, free XP, XP
bought and its price, the XP to each level), the king ranks, the fight's pace and search (`fightMoveMs`, `fightFastAfter`,
`fightFastMoveMs`, `fightNodes`), the cash-in (`cashInGold`, and `cashInValue`: what the engine counts a cash-in's gold as, in centipawns), the move cap, HP and damage, start gold, income, interest, the survivors' refund, the streak tables,
the legal-position limits, the bot's numbers (lock-in times, rerolls, holds, XP, how early it places, saving, the adjust search).
Test switches (where they work): `?quick=1` short steps (buy 7 s with the last 2 locked, a reveal every 1.5 s, the move step 7 s), `?seed=N`,
`?gold=N` (N more gold at the start of round 1), `?adjust=0` (no adjust step), `?fightfen=FEN` (the fight starts from that position),
`?stall=1` (the engine never answers: stand-in moves), `?lockin=1` (lock-in on), `?adjustmode=teleport` (the v6 adjust step), `?level=N` (5 to 10: both sides start at level N: rooks and queens in the first shop).

## Tests and tools

- Unit: `packages/app/test/autochess-shop.test.ts` (four slots, rolling by level, usable squares, buying and holding from a slot, refills, rerolls, one offer to a square),
  `autochess-odds.test.ts` (the odds table: every level's row, sums, no rook before 5 and no queen before 7; the four slots roll independently, at the level's odds, at levels 4, 7 and 10: chi-square over tens of
  thousands of shops, rerolls, refills, rounds and match seeds; two queens in a level-10 shop is 2.7%),
  `autochess-move.test.ts` (the move step: legal moves staying on your half, pins and check, the random seeded pick, no piece able to move, taking back, the bot's pick and move),
  `autochess-lockin.test.ts` (off: no bonus, no lock, the full time; on: v5's rules), `autochess-level.test.ts` (levels, XP, the room a level gives, the bot's levels),
  `autochess-reveal.test.ts` (the reveal times, what shows when), `autochess-rules.test.ts` (the shop's reasons, selling at 75%, the
  bench, the kings, placing, the teleport step's change and its off switch), `autochess-match.test.ts` (the economy, the bench through the
  rounds, the bot's buys, holds, XP, rerolls and adjust staying legal over hundreds of seeds and a whole match, fights ending within the
  cap; the fight's rules, cash-ins and their gold), `autochess-engine.test.ts` (the worker link: answers, the bot's look, the timeout's
  stand-ins), `autochess-sounds.test.ts` (peak, loudness, different from each other), `autochess-words.test.ts` (the words, the settings'
  numbers).
- Engine: `packages/chess/test/hunchess-board.test.ts` (perft against known counts and chess.js, a fight's moves, every rule),
  `hunchess-search.test.ts` (wins and losses by the fight's rules, determinism, the node budget).
- e2e: `e2e/autochess.spec.ts` (phone and computer; seeds are listed at its top): the four-card shop and its silhouettes (one to a square), a reroll, buying by tap,
  the reasons, selling by tap and drag, the bench (and your whole row lighting while you drag), drags cut off by a step's end, lock-in off for the whole 30 s (and its tests behind `?lockin=1`), a cancelled pointer or lost capture,
  silhouettes that are only tapped, a sale of a piece that is gone, levels, the odds pill at level 4 and after a level-up, the reveals, their bench tapped (the red square), the phase banners and the clock's bars,
  the move step (the lit piece, its 7 s, the refusals, taking back, no piece able to move, the step off, the teleport step behind its setting), the kitty-corner layout and the hopping pawns, the button feel, the floating
  gold, mute, a fight to a result and the next round, a cash-in's "+5", a fight with a silent engine, layouts (320 to 430 and 1280 to 1920: nothing scrolls, every target 44 px, both benches' gaps equal, the odds pill's
  baseline, every short message in the small spot, the board never moving from step to step). `e2e/home-layout.spec.ts` (home).

## Rules for this area

- A change to a rule or a number is made in `AUTOCHESS` or the pure files, with its unit test; the screen draws what the rules say.
- Nothing is drawn per frame by the screen: its clock is read every 120 ms, the board draws only when its position changes; the rings, the floating
  gold, the level pop, the pawns' hops and the banners are CSS animations on still boxes. The one thing that updates every frame is the move clock's bars (`TimerBar`, its own small component).
- The board never moves between steps (nothing above or beside it changes size with the step), and nothing scrolls: the fight's and the result's boxes take the shop's place (the result's
  also the gold row's), and a test measures the board, your row and the dock's top in every step at 320 x 568, 390 x 844 and 1280 x 800.
- Every message in the small spot under the board is a few words (about 15 characters a line, 11 at 320 over three lines): a test lays each one into the spot at 320 and measures it. A new message goes in that test's list.
- A seed in an e2e test fixes the shop, the kings and the bot's lock time (with lock-in on); changing how a roll is made (the shop's seeding, its odds or its slots) changes
  every seed's fixture: re-pick them (a small script over the pure code finds one: the spec's header says what each is). The shop rolls by level, so a test that needs a rook or a queen in
  the first shop starts at `?level=N`. Taking out the odds' fifth slot and rolling by level (v7) changed every seed's kinds, not its squares.
- A gesture never outlives the moment it can act: a new step, round or lock goes through `cancelGesture()`, and a test holds a drag
  through every one of them (the ghost must be gone within a moment, with no gold, piece or bench change). The bot's lock-in time comes from a draw of its own,
  so changing how the bot buys doesn't move it.
- A sound's play name goes in `SoundName` and `MAKE` (sound.ts); a sound is added with its peak and loudness test.
