# Auto chess v7: the new screen, the move step, odds by level, four shop slots, no lock-in (Oct 21, 2026)

## What Eric asked

Oct 21, afternoon (the design notes' "v7" sections have his words and every round of the mock):

- "Let's disable but keep the code for autochess for the phase 2 moving, it's too strong, instead it highlights one piece at random of yours and
  you get 7 seconds to do a LEGAL move on your half of the board."
- "4 shops instead of 5... when you level you have slightly higher chances for better pieces and pawn odds slightly decrease. Queens are
  appearing too often they shouldn't even appear till level 7 like in TFT, so 0% before that then 1% then 3% say etc... levels should go up
  to 10... the tiny % numbers above the shop should represent each piece odds based on your level and show a little icon of piece accordingly."
  Then: "Rooks should start at level 5."
- A UI overhaul, mock first (four rounds: the light take, "the curved boards and border colors on the chess board", both benches always
  visible with real pieces, their bench's labels kept, a tap on one of their bench pieces lights its landing square red, the custom pawns
  hopping, "ACTION PHASE / 3 2 1 / MOVE PHASE / BATTLE PHASE" on the board, the app's usual green edge bars for the clock with small numbers
  under the board, the shop cards square).
- "Lock shop can go for now... just remove the button keep the logic there, might wanna readd it later", then: the whole feature goes.
- Last change on top of round 4 (~19:05): the ODDS strip goes; the five icons with their percent under each go into the gold row as a small
  pill like the W2's, the percents' bottoms on the gold number's baseline; everything below moves up, unchanged in size.

## What was built

**Rules (pure, tested; `packages/app/src/autochess/`, settings `AUTOCHESS`).**

- **Shop: 4 slots** (`shop.slots`). **Odds by level:** `shop.oddsByLevel[level - 1]`, percent P/N/B/R/Q, levels 1 to 10, Eric's table (L4 74/14/12/0/0,
  L5 66/14/13/7/0, L7 54/18/16/11/1, L10 36/21/20/16/7); no rooks before 5, no queens before 7, "one queen at most" stays. Every roll
  (the first shop, a reroll, a refill after a buy or a hold, `replaceTaken`) takes the level of the shop's owner at that moment: yours, the
  bot's own. A shop already on show keeps its offers when a level is gained; the next roll uses the new row. A kind at 0% is never offered, and
  a shop the limits leave nothing to offer (8 pawns and no extras left, at a level with no rooks) is shorter, as before.
- **The move step** (the "adjust" step, `adjustMode: "legal"`, `adjustSeconds: 7`). One of your pieces is picked at random, seeded by the round
  (`youMoveSeed`; the bot's own pick `botMoveSeed`): never the king, only a piece with at least one legal chess move that stays on your half.
  You play one such move with it, or skip (just don't move). The old step (a piece to any empty square of your half) stays in code behind
  `adjustMode: "teleport"`. The bot gets the same: its own random piece, and the engine's best such move with it (`botMove`).
- **Lock-in is off** (`lockIn: false`): no button, no bonus for anyone, the bot never locks, every buy step runs its full 30 s (the last 3 s
  still lock). The code (`lockin.ts`, the button, the bot's lock-in time) stays behind the setting; `?lockin=1` turns it on for testers.
- Test switches added: `?lockin=1`, `?adjustmode=teleport`, `?level=N` (5 to 10: both sides start at level N, so rooks and queens show up in a
  test's first shop; the XP to each next level shifts with it).

**The screen (`screens/AutoChess.tsx`, styles `ac-` in `styles.css`)**, built from the approved round-4 mock (its HTML and CSS reused, renamed
to `ac-`), as the mock plus the last change:

- Their bench top left, their custom pawn top right (name, level, thin HP and XP bars), the board in its curved frame, your pawn bottom left (thin HP and
  XP bars, a gold level badge), the clock's small numbers in the gap and your bench bottom right, the same distance from the board as theirs
  (10 px at 390). Empty bench spots are faint tile outlines; your whole bench row lights (gold ring) while you drag an offer. Both pawns hop, out of step
  (1.8 s and 2.1 s, transforms and opacity only, off under reduced motion).
- The clock is the app's own `TimerBar` (quiet: no ticks, as this screen never had any) along the board's top and bottom, in the buy and move steps; the
  time and the step's name ("Buy", "Locked", "Move", "Fight") sit under the board on the page's own background, no box. A message takes the step
  name's place for 4.2 s.
- Phase banners on the board: ACTION PHASE for the first 1.6 s of buying, the big 3-2-1 (the app's `.cc-num`) for its last three seconds, MOVE PHASE and
  BATTLE PHASE for the first 1.6 s of those steps: the words in a rounded frosted box (backdrop blur and a light gray tint), at 8.4 hundredths of the board's
  width (the 3 is 44). No hint text under the board.
- The dock: the gold row (gold, income, the odds pill, the win streak "W2" from two wins), Buy XP and Reroll stacked at the left of four square cards
  (the piece on a tile of the color of the square it lands on, its name and square, its price). Cards and buttons dim while the shop is shut (the last
  3 s and the move step).
- Tapping one of their bench pieces: a red ring on it and its landing square lights red on their half; a second tap or another piece clears it; it
  clears when the fight begins. Their bench never drags.
- The move step: the lit piece glows (pulsing gold box) with its legal squares as dots; tap a dot or drag the piece to it; ↩ on the moved piece
  takes it back while the step lasts. Any other piece says "Only the lit piece"; the king "King stays put". No piece of yours able to move: "No piece can move"
  and the step still runs (the bot may move); neither side able to: straight to the fight.

## Judgment calls

1. **"Legal" is the fight's own rules,** the HunChess engine's move generator (`fightMoves`) on the position as the step shows it, yours against theirs. So a
   pinned piece can't leave its line, and with your king in check only the moves that answer it are legal. (The v2 step ignored check; Eric's word this time is
   LEGAL.) Since the move must end on your half, where only your pieces and your king stand, nothing is ever captured.
2. **The bot skips when no move beats standing still by `bot.adjustMargin`** (as its old step did), the same freedom a player has: "its best such move"
   means its best by the engine's eval, standing still included.
3. **Messages are short words.** The round-4 note: about 15 characters a line, two lines at 390, 11 at 320 over three. Every message the screen says was
   rewritten (the list is in the PR); `placeWords`, `buyWords`, `xpWords`, `rerollWords`, `freezeWords` and `adjustWords` return the short ones, and the
   fight's and the result's boxes keep their full sentences.
4. **The Sell button** has no place in the mock (the dock has no room). It is a gold button in the gap under the clock, over the free room beside your pawn,
   positioned so it never grows a row. Selling by dragging a piece onto the shop works as it did.
5. **The result and the fight's box** take the shop's place (the buttons at the left, as tall as Buy XP and Reroll, the words at the right); the result's
   box also takes the gold row's room, so it holds the longest result at 320 x 568. The line "Next round: ... gold" has the gold.
6. **Dropped from the old screen** (the mock has no place for them): the opponent's gold (it was a scouting number) and your name beside your pawn
   (it stays as the bars' tooltip), the "Your opponent is moving their pieces..." line over their half (the MOVE PHASE banner and their shown board
   say it), the lock-in tag when lock-in is off.
7. **The board keeps the round-4 mock's size,** so the odds strip's room became free room at the bottom of every phone (24 px at 320 x 568, 52 at 390 x 844), as Eric
   asked ("every phone gets some free space at the bottom"), not a bigger board.
8. **A laptop's short window (1280 x 600)** gets its own smaller rows (a 60 px pawn, 38 px bench tiles, `@media (max-height: 700px)`): the round-4 mock was checked at phone
   sizes and 1280 x 800 only, and at 600 high the board column (292 px) can't hold a 4 x 54 px bench, a name and a 116 px pawn.
9. **Tap targets:** every button and card is 44 px tall and wide or more; a bench tile is 44 tall and 40 wide at 390, 34 at 320 and 54 on a computer (the
   mock's sizes: a tile is a piece on a square-colored tile, not a button). Their bench's tiles are tapped, so they are real targets too.
10. **The timer bars use `TimerBar` as it is** (it re-renders itself each frame; the rest of the screen still reads its clock every 120 ms). The area page's
   "nothing is drawn per frame" now says "but the bars".
11. **Their bench is drawn 2 s behind** (`circlesDelaySeconds`), as their board's circles are, so a hold doesn't show a moment before its circle would.
    Its squares and pieces are real (Eric: intentional); only the tap is new.

## Checks

Unit: `autochess-odds.test.ts` (the table: each level's row, every row sums to 100, no rook before 5, no queen before 7; the shop rolls each level's row,
independent slots, at levels 4, 7 and 10), `autochess-shop.test.ts` (4 slots, rolling by level, buy/hold/reroll at the owner's level, one offer to a square),
`autochess-move.test.ts` (the move step: the legal moves, pins and check, the random pick and its seed, no piece qualifying, taking back, the bot's pick and
move), `autochess-lockin.test.ts` (off: no bonus, no lock, the bot never locks, the full time; on: as in v5), `autochess-match.test.ts` (the bot rolls by its own level,
its bench by time), `autochess-rules.test.ts` (the teleport step behind its setting, the short words).
e2e (`e2e/autochess.spec.ts`, every test of the old screen kept and updated, none skipped or loosened; lock-in's run behind `?lockin=1`): the layouts at 320, 360, 375, 390, 414 and
on a computer (no scrolling, every target, both benches' gaps equal, the odds pill and its baseline), the phase banners and the clock's bars, the move step with its
lit piece and its 7 s, no piece able to move, their bench tapped, the odds pill at level 4 and after a level-up, four shop slots, lock-in off for the whole 30 s.
