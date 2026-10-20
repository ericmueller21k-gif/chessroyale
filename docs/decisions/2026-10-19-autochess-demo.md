# Auto chess, the demo (Oct 19, 2026)

## What Eric asked for

> Auto chess chess. We will start by making this a boss battle and if people like it could turn it into its own game mode.

A TFT-style auto battler with normal chess pieces: you buy pieces with gold, place them on your half, scout, and the
engine plays the position out for both sides. Skill is gold management, chess positioning and reading a position fast.
"We're just testing this thing. It might just be terrible": a demo to feel it, built small, every number in one
settings block (`AUTOCHESS`, `packages/core/src/settings.ts`) so it can be tuned after Eric plays it. A thin button
"Auto chess" at the very bottom of home (Eric: "just a thin button for now"). Client-only (`/autochess`): no server, no
account, nothing recorded or rewarded. How it works now: [docs/areas/autochess.md](../areas/autochess.md).

The design changed four times on Oct 19 (the notes: "Decided", then v2, v3 and v4, each replacing what it touches; v4 is
the last): placement is together and live (a bench, selling for 90%, the opponent as circles 2 s behind, the last 3 s locked, then
their real pieces shown and one legal chess move for each of your pieces), and **nothing carries over between rounds**
(Eric: "I don't think we can allow like just pieces that save to carry over to the next round... you'd just get these
massive boards... running your opponent over... not very chess-like... boring quick"). Continuity is gold and HP.

## The rules as built

- **A round:** the game puts both kings down (mirrored: the same file, the rank mirrored, a random square of each side's
  back two ranks, seeded by the round). Buy and place 30 s (the last 3 locked), reveal and adjust 15 s, the fight, the
  result. You are White in round 1, then the colors alternate; your half is always at the bottom (the board turns).
- **Shop:** pawn 10, knight 30, bishop 32, rook 50, queen 90 (one queen a round). A bought piece goes to a bench of 8;
  drag it (or tap it, then a square) onto your half; drag a placed piece back to the bench; sell by dragging onto the
  shop row (or tap it, then "Sell 27"): 90% back, rounded down (P9 N27 B28 R45 Q81).
- **Legal positions only** (the engine refuses others): at most 8 pawns, no pawn on your back rank, at most 3 in a file
  (a half has only three pawn squares in a file, ranks 2 to 4, so the file rule holds by itself), and pieces beyond the
  starting set (a second queen, a third rook, bishop or knight...) at most 8 minus your pawns. Shop limits count what you
  own (board and bench); a piece that can't be bought is greyed with its reason under the price.
- **Adjust:** each of your pieces (the king too) may make one legal chess move onto an empty square of your half: its own
  move, the path clear, no captures, nothing into their half, no castling, no en passant; a pawn pushes one (two from its
  start rank if both are empty). Check doesn't matter here. A moved piece is marked; tap it to take its move back. The
  opponent's moves stay hidden until the fight.
- **Fight:** the engine plays both sides at the same strength (6000 nodes a move, a move about every 0.35 s, with the
  board's usual knocks and the last-move highlight) until mate, stalemate, a draw by the rules, or 60 moves a side, when the
  side with more material (P1 N3 B3 R5 Q9) wins, equal is a draw. White moves first unless a king is attacked as the
  fight starts (that side moves first; both attacked: the round is a draw, no fight). No castling rights, no en passant.
- **Result:** the loser loses 2 + 1 per enemy piece (not the king) left on the board; a draw costs nothing; 20 HP each;
  first to 0 loses the match.
- **Gold (v4):** none at the start; each round: income 100 in round 1, +20 a round, up to 200; interest +10 per full 100
  banked before the income (max +30); win streak gold +10 at 2 or 3 wins in a row, +20 at 4, +30 at 5 or more (a draw ends a
  streak; a loss streak's gold is a setting at 0, off); and the last fight's refund: 25% (rounded down) of the summed price
  of that side's pieces still on the board, win or lose, and its bench pieces (they never fought) in full. The result shows the next round's gold line
  by line.
- **The bot:** buys with simple rules (a mix weighted to minor pieces early, then rooks, a queen when rich, now and
  then keeps a hundred banked for interest, sells nothing), places pawns in front and pieces behind (seeded, paced over the
  open part of the 30 s), and adjusts greedily with the engine: each candidate move scored by a 1500-node search of the
  position the fight would start from, kept only if it beats not moving, at most 24 searches.

## Calls I made

- **The pawn on home** (Eric: "I don't want it any smaller"; he allowed trimming "the white space a bit at the bottom of the
  pawn display container" and the gap under PLAY if only empty space). The button is 32 px with an 8 px gap. Its room comes
  from home's gaps (10 → 8 px), the page's top and bottom padding (12 → 8, 14 → 10) and, where your pawn stands beside
  your name, the card's padding (12 → 4 above and below). Measured at 360×640, 375×667, 390×664, 390×844 and 430×932, the
  drawn pawn is the same size within 2 px at four of them (115.7, 115.7, 137, 137 px for its box); **at 375×667 it is
  bigger** (93.6 → 115.7 px): the card there was 189.2 px, 0.2 px over the 189 px at which the pawn goes beside your name,
  and it is now 171 px, so the pawn goes beside your name as it already did at 390×664. Never smaller. Below the spec's
  360×640 floor, 320×568 scrolls 24 px (your card is at its 100 px floor there). `home-layout.spec.ts` checks this at all five sizes.
- **A full file of three pawns** (ranks 2 to 4) can't move in the adjust step: the front pawn's next square is in their
  half. The brief's "in a file of three pawns only the front one can move" holds for shorter stacks (two pawns: only the
  front one).
- **A move taken back needs its square free:** if another of your pieces has moved onto the square the first came from,
  take that move back first (the message says so).
- **A pawn that promotes** counts as the piece it became when the fight is over (its price for the refund, and as one more
  piece for the damage): no tracking of where a piece came from, and a promotion is rewarded. (v3's "comes back as a pawn" went with the carry-over.)
- **Refund timing:** paid with the next round's income, and counted in the interest (banked before the income). Pieces left
  on the bench are refunded in full (both sides; the bot never has any).
- **Streaks** are kept for both sides (the bot earns streak gold too). The tables are settings (`winStreakGold`,
  `lossStreakGold`: from n rounds in a row, that much).
- **The opponent's gold** shows 2 s behind, like its circles (what it has bought so far), so it isn't a faster look than the
  circles. Its HP is live.
- **Where the board goes:** `/autochess` is its own page (no side menu or live panel on a computer), as wide as the room
  under the other rows allows. The step's box below the board (the result, the adjust and fight words) is the size of the
  message line, the bench and the shop together, so the board never moves between steps.
- **The result waits for a tap** ("Next round"); the match end offers "Play again" and "Home".
- **If the engine doesn't answer** (a stalled worker), the fight plays stand-in moves (a capture if there is one, else a
  random legal move) so a round always ends; the engine is given up on after three misses in a row.
- **Test switches** (only where they work: an admin, e2e, dev): `?quick=1` (buy 7 s with the last 2 locked, circles half
  a second behind, adjust 5 s, a fight move every 60 ms) and `?seed=N` (the kings and the bot).
- **CI:** the settings block is in `packages/core/src/settings.ts` as asked, and `packages/core/src/**` is a shared
  foundation in `e2e/areas.json`, so this PR runs the whole suite. The new area (its own paths and spec) is in `areas.json`
  for later PRs.
- **`e2e/live-window.spec.ts`** compares the column's foot to your card's bottom. It compared PLAY's line until the Boss raid
  card moved to the bottom (#296; #297 changed it to the card); the foot is now Auto chess's button, so it compares that.
- **The FAQ** is unchanged: the demo isn't a mode players can find in the FAQ's list yet; its words come with the game mode if
  people like it.

## Tuning notes (one run, no sweep)

Twelve fights between two bot armies at rounds 1 to 6 with the real engine (6000 nodes a move): 7 mates, 2 cap decisions, 2
draws by insufficient material, 1 repetition; White won 6, Black 3, 3 draws; 72 moves on average, about 22 ms a move on this
machine (a phone is several times slower and still under the 350 ms a move takes). Every number to tune is in `AUTOCHESS`.

## Oct 19 evening: pawns don't promote; quiet fights fizzle out (Eric, after playing)

Eric: "the computer prefers just buying pawns because it just wants to get the pawns... promoted to queens. So that's not
going to work." On a thin board a pawn on its fourth rank is three or four moves from a queen, so at 10 gold pawns beat
everything else. Eric's options were no promotion, or pawns that vanish or refund at the far side; also "if it's not mate in
like 20 moves... it probably should fizzle out" (he left the cap itself open: "maybe that's fine").

- **Pawns don't promote:** the fight never plays a move onto a pawn's last rank, so a pawn stops on the rank before it
  (still attacking and checking from there). The browser's Stockfish can't be told the rule, so the fight filters its
  choice: when its best move is a promotion it is asked for its top lines again, as many as there are promotions plus three
  (each promotion piece is a line of its own), and the best non-promotion is played; the stand-in
  move never promotes either. A side whose only legal moves were promotions has none: mated if its king is attacked,
  else stalemated. Chosen over "vanish or refund": a vanishing pawn would have the engine sacrificing pieces for a queen it
  never gets, while a stopped pawn is a plain blocked pawn the engine's search handles as it is (it still likes advanced
  pawns a little more than this rule deserves; both sides alike).
- **Quiet fights fizzle out:** 10 moves a side with nothing taken ends the fight like the cap does (more material wins,
  equal is a draw): "10 moves each with nothing taken: more material wins." / "..., and equal material." This also ends the
  dead endings no-promotion makes (kings and stopped pawns) in a few seconds instead of running to the cap. `quietCap` in
  `AUTOCHESS`. The 60-move cap stays as it was (Eric: "maybe that's fine"); it's one number if he wants 20 or 30.
- **The bot no longer buys pawns first:** its early weights favor knights and bishops (pawn 2, knight 3, bishop 3, rook 2;
  later pawn 1.5, minors 2.5, rook 3, queen 2).
- The fight's card now reads: "The engine plays both armies at the same strength, until mate, a draw, 60 moves each, or 10
  each with nothing taken. Pawns don't promote."
- **Checked with the real engine** (6000 nodes, 12 bot-v-bot fights at rounds 1 to 6, and 8 fights of 8 pawns and a rook,
  130 gold, against two knights and two bishops, 124 gold): no promotion was ever played (the engine reached for one 5
  times and was turned to its best other move). Bot v bot: 3 mates, 8 fizzled out, 1 repetition; 30 moves (both sides) on
  average, about 10 s at 0.35 s a move. The pawn army lost all 8 to the minor pieces. With `quietCap` 15: 4 mates, 5
  fizzled, 3 repetitions, 50 moves on average, and the pawn army won 2 of 8. Kept at 10 for short fights (Eric's "fizzle
  out"); 15 is the number to try if fights feel cut short.

## Checks (Eric, Oct 19 evening)

The fizzle-out cut short attacks on a lone king (nothing left to take, so 10 quiet moves came before the mate). Eric: "it
should end with either a certain number of checks in a row, or it just actually becomes checkmate... they're both a win...
even five". So:

- **A check restarts the fizzle-out count** like a capture does ("10 moves each with no capture or check").
- **5 checks in a row by one side win, as mate does** (`checksToWin`; "5 checks in a row count as mate."; the same damage).
  Five is about when checking back and forth would be a draw by repetition, so the rule is tested before the draws: what was
  a perpetual check (a draw in chess) is now a win for the side giving it.
- Real engine, the same 12 bot fights: 3 mates, 2 wins by checks (one was a repetition draw before), 6 fizzled, 1
  repetition; 48 moves (both sides) on average, about 17 s. The pawn army against two knights and two bishops: 0 wins, 6
  losses, 2 draws.

## Shelved (Eric, Oct 19 evening)

"I'm honestly thinking we may have to shelve this idea for a bit and keep the button on maybe like an admin only screen for
testing... it's going to take more work than I realized to make this balanced and fun." So the home button is gone and home
is exactly as it was before it (its spacing and `home-layout.spec.ts` / `live-window.spec.ts` back to before #298; your
pawn is the size it was). Admins open the demo from Settings → TESTING, "Auto chess (shelved demo) ›". `/autochess` still
opens it for anyone with the link (it's client-only and behind Access). The no-promotion and fizzle-out rules above stay in.


## v5 (Eric, Oct 20): the shop, lock in, visible pawns, auto-drop, a tighter adjust step, faster fights

Eric's notes ("These numbers may need adjusting"; every number is in `AUTOCHESS`) held the demo until Moo & Moon was live and he gave
the all clear; Moo is live (#301), and the director asked for the build. Built one change at a time, each its own commit.

**What changed**
1. **The shop is five random slots:** pawn 75%, knight 10%, bishop 8%, rook 5%, queen 2% (`shop.odds`), prices unchanged. Buying
   rolls a new piece into the slot; **Reroll** costs 5 for all five (`shop.rerollCost`); the shop refills free each round. No hold
   button. Every roll is seeded by the round, the reroll count and the refill count.
2. **Lock in:** your board, bench and shop freeze; the first side to lock gets 25 gold at once (`lockInBonus`); the other sees
   "Locked in"; both locked ends the step. Eric: the race is fine as is, no minimum pieces ("the player who doesn't lock in sees your
   shadows and might have an advantage then of adjusting pieces").
3. **At most 10 pieces and the king on a board** (`boardLimit`); bench stays 8. When buying ends, bench pieces drop onto the board
   left to right until it has 8 (`autoDropTo`; Eric's "if you already have 8 and then you have 2 sitting on your rack, then they
   won't drop in", his answer to the question of 8 against 10).
4. **The opponent's pawns show as real pawns while you buy** (2 s behind); a placed pawn is picked up once, its next placement final.
   Eric's answer: a pawn moved back to the bench uses its one move.
5. **The adjust step is one chess move and one drop for 25 gold** (`adjustMoves`, `adjustDrops`, `adjustDropCost`), either, both or
   neither, in any order, each can be taken back. Eric: not two drops for now ("adding in two, we can consider that later").
6. **The fight:** a side left with only its king loses at once (both: a draw); after 30 moves a side, moves play at 0.175 s instead of
   0.35 s (`fightFastAfter`, `fightFastMoveMs`).
7. **The bot** buys from its own shop, rerolls now and then, locks in at a seeded time, drops when it can pay.

**Calls I made (reasons)**
- **Buttons in a row of their own** under the shop (Reroll left, Lock in right, 34 px). The shop's five slots can't share a row with
  them at 320 px (a slot would be about 40 px wide, narrower than "Bench full"). The row costs height, so the page's gaps and
  padding went from 6 px to 4 px (net 22 px, not 40). Where the height decides the board it is a little smaller: 2% at 360×640,
  4% at 390×664, 8% at 320×568, 4% at 1280×800 and 7% at 1280×600 (measured from the formula); at 390×844 and up nothing changes.
  The step's box for the other steps is 186 px, so the board still doesn't move between steps.
- **"Locked in" by their name shows at once,** not 2 s behind like the circles: the bonus goes to whoever is first, and a bonus lost
  to a lock you couldn't see yet would feel like a trick. The bot's gold shows its bonus at once for the same reason.
- **The bot's lock-in** is seeded between 30% and 95% of the step's open part (before its locked end), with all its pieces down
  a moment before, or never 15% of the time, so a quick player can beat it to the 25 and a slow one usually doesn't
  (`bot.lockFrom`, `lockTo`, `neverLockChance`). A tie in time goes to the bot (practically never).
- **Lock in can't be undone,** ends only your own buying (the other side's step goes on, with you watching its pawns and circles),
  and its 25 gold can pay for the adjust drop (the first-lock-and-drop line is the point of it).
- **Where a piece auto-drops:** the first good empty square, pawns on the third rank from home, then the fourth, then the second;
  pieces on the back rank, then the second, then the third; files from the left of the screen (White's a to h, Black's h to a, since
  your half is always at the bottom). A pawn that had used its pick-up lands final.
- **A pawn's pick-up counts when it lands somewhere else:** a drag that is cancelled, or dropped on its own square, costs nothing.
  A fixed pawn can still be dragged onto the shop row to sell it, and tapped to select it for "Sell 9"; the line says so.
- **The one move includes the king** ("any one of your pieces"), and it may be the piece you just dropped. Taking a change back is
  by replaying what is left: a change another one stands on waits ("Take back your other change first."): e.g. a drop onto the square
  a moved piece left.
- **A bench piece dropped in the adjust step costs 25** and counts as a survivor (25% back) instead of a bench piece (all back): a drop
  is a bet that the piece fights.
- **A lone king loses before anything else** (mate, stalemate, "not enough pieces"), so King and knight against a bare king, which
  used to be a draw, is a loss for the bare king: that is Eric's rule ("boring moving around"). The bot never starts with a bare king
  (it always buys), and a player who buys nothing loses at once with "A side left with only its king loses at once.".
- **The speed-up** is 30 moves a side (60 plies) and the counter then reads "Move 31 of 60 · twice as fast".
- **The bot's shop buying:** it picks among the five slots it sees by weights (minor pieces and rooks over pawns, a queen when rich);
  a shop is mostly pawns, so pawns are the filler. It rerolls (5 gold, at most 3 a round, only with 60 gold or more and enough left
  for a knight) at 15% a look, 40% when the shop shows only pawns. It puts down 8 and keeps one more on its bench only if it keeps the
  25 gold for the drop. Measured (2000 plans a round, one setting): round 1 buys 5.5 pieces for 96 of 100 gold (4 pawns), round 5
  7.8 pieces for 161 of 220, a ninth piece in 38% of round-5 plans, rerolls 0.7 to 1.6 a round.
- **The bot's drop:** the engine's expected score saturates at 0 and 1 (in 60 real-engine setups, 1500 nodes, the best drop changed
  the score in 2 of 16 cases with a bench piece), so a drop that merely beats the margin almost never showed up. It now drops when the
  best square scores better, or at least as well when the bot's score is under 0.9 (`bot.dropBelow`): 7 of 16 in the same run. Already
  winning, it keeps its gold. Beatable: it still picks one move and one drop from a 1500-node search.
- **`?gold=N`** (a test switch, like `?quick=1` and `?seed=N`) adds N gold to round 1, to try a big army and to test the 10-piece board.
- **CI:** the numbers are in `packages/core/src/settings.ts` as asked, which `e2e/areas.json` counts as shared, so this PR runs the
  whole e2e suite.
- **Seeds in the e2e file:** the shop, the kings and the bot all come from `?seed=N`. A different roll order changes every fixture.


## v6 (Eric, Oct 20 evening): the shop decides where pieces go, a bench that carries over, levels, avatars, sounds that feel good

Eric: "we're finally moving in the right direction." His notes (the director's design file, "v6" sections and their answers) replace
the v5 flow where they differ. Built one change at a time, each its own commit (steps 1 to 7; step 8, the bot, went in with each of
them and has its own tests). How it works now: [docs/areas/autochess.md](../areas/autochess.md). Every number is in `AUTOCHESS`.

**What changed**
1. **The shop places pieces.** Five offers, each a piece and a square of your half ("Bishop c2"), the same odds, only squares you
   could use; green silhouettes on the board (two on a square: smaller, side by side); tap an offer (card or silhouette) to buy it, it
   lands on its square; reroll 2 gold; no free placing; every board starts with just the king.
2. **A bench of 4 that carries over;** hold by dragging an offer onto it, a held piece keeps its square and is placed by a tap; selling
   gives back 75% (was 90%), from the board or the bench.
3. **Levels:** the board holds as many pieces as your level (start 4, top 10); +2 XP free each round, 4 XP for 20 gold, the thresholds 4,
   8, 12, 16, 20, 24. The old fixed board limit (`boardLimit`, 10) is gone.
4. **Their board while you buy:** circles only, pawns too (2 s behind), and one piece revealed at random every 5 s (five in the 30 s),
   staying shown.
5. **The adjust step:** 5 s (was 15) and one change: a piece to any legal empty square of your half. A setting turns it off. v5's adjust
   drop, the bench auto-drop and the one-move-per-pawn rule are removed.
6. **Avatars** in each side's strip, with name, level and XP; a level-up pops the number.
7. **Sounds and feel:** eight synthesized sounds, a pressed-down feel on every button, a floating "+N" on a sale.
8. **The bot** plays all of it.

**Calls I made (reasons)**
- **An offer whose square gets taken is replaced, not greyed.** Eric left it to me ("replaced or greyed"). A greyed offer is a dead slot
  for the rest of the round (nothing can free the square except selling), and a replaced one keeps the shop worth looking at. The player
  is told so an offer doesn't change under their finger unexplained: "Another offer was on b4: it rolled again." An offer whose kind is
  over a limit (a second queen, a ninth pawn) is greyed with its reason as in v5, since the limit isn't a thing of one square.
- **Hold is a drag, with no "Hold" button.** Eric allowed either. The shop row is five slots and a button per slot doesn't fit at 320 px
  (a slot is about 54 px wide), and dragging to the bench (right above the shop) is the same gesture as dragging a piece to the shop to
  sell it. The message line says so ("Drag one to the bench to hold it."), and an offer the board has no room for is not greyed (it can
  be held): its label says "Level full" in gold.
- **A held piece's square turns with the colors.** The colors alternate each round, so "c2" (White's half) is not on Black's half the
  next round: the square is mirrored the way the kings are (same file, rank 9 minus the rank), so a held piece is still on its owner's
  half, the same way round. "b4" held in round 1 is "b5" in round 2.
- **What is held counts as owned** for the legal-position limits (one queen at most, 8 pawns, extras), so a held queen blocks a second
  queen, and a held piece can always be placed without breaking them. "One queen a round." became "One queen at most." (a queen held
  from an earlier round is still your one).
- **Selling a held piece is by dragging it onto the shop row** (a tap places it); a board piece sells by dragging it there or tapping it
  and "Sell N". 75% of the price, rounded down (P7 N22 B24 R37 Q67).
- **+2 XP at every round's start, round 1 included** ("+2 XP free each round"), so level 5 comes at round 2's start with nothing bought,
  and the opponent gets the same. XP beyond a threshold carries over; at the top level XP stays 0 and Buy XP says "You are at the top
  level, 10.". Buy XP is a third button in the row under the shop; while the first-lock bonus is open the Lock in button is two lines
  (its name over "+25 gold") so the three fit at 320 px.
- **The strips are 32 px (were 26) and the board is a little smaller where the height decides it:** the name over "Lv 4 · 2/4 XP" and
  HP and gold over income, with a pawn: the rest of the page is 324 px (was 312), 12 px less board at 320×568 and 360×640 (about 5%);
  at 390×844 and up nothing changes. Your strip sits right under the board (above the message line, the bench and the shop) and theirs
  right above it, so each pawn is "by its side of the board" (the God King's dock is likewise by the board).
- **The reveal picks among the pieces on their board at that time, not only the circles already shown** (those are 2 s behind). With the
  circles only, a bot placing slowly wasted the reveal at 5 s (measured: a seed's first piece went down at 11 s), and Eric wants five
  reveals. A piece whose circle isn't shown yet just appears as the piece, with its ring and ping. With nothing on their board at a reveal
  time, nothing is revealed then. For the same reason **the bot now puts its pieces down evenly over the first 70% of the open step**
  (`bot.placeBy`; they were spread over all of it), a reroll or XP a moment before the piece it was for.
- **The adjust change excludes the king:** the game places both kings, mirrored, for fairness ("pieces" in Eric's levels means not the
  king), and a king that walks to a corner changes what a mirrored board means. A tap on a square with one of your pieces picks that
  piece up, so the "taken" and "king's square" refusals show when a piece is dragged there. Refusals use the placement rules' own words.
- **`?quick=1` adjust is 8 s** (the real one is 5) so a test has time for its taps; one test plays the real 5 s (a full-length step ended
  by locking in after the opponent's lock) and checks it.
- **Avatars:** your pawn is drawn by the same `Avatar` as home and profiles, in your board's color for the round (so it also says which
  side you play); the opponent is named "Bot" (the 1 v 1 bot's name), a look from `botLook` seeded by the match.
- **The level chime plays when your level number changes** (Buy XP, or the round's free XP), with the pop; Buy XP itself plays the small
  rising chime. Sounds are synthesized like the bosses' (`autochess/sounds.ts`, in the same cache and sound worker), each with its peak
  under half a move's (0.32) and its mean level 2 dB under a move's (-23.3 dBFS), measured in a unit test: reroll peak 0.29, mean -30.5
  dB; place 0.30, -26.4; hold 0.22, -24.0; sell 0.28, -25.9; XP 0.28, -24.1; level 0.19, -24.1; lock 0.29, -27.9; reveal 0.23, -24.1.
  Another test checks each pair differs in length or brightness. The old "sell" (two notes) is replaced by the cascade, same play name.
- **Pressed-down feel:** CSS only (`:active` sinks a button 2 px and shrinks it a hair with a short spring back; Reroll, Buy XP and Lock
  in sit on a 3 px shadow and drop onto it). The floating gold is `components/FloatGold.tsx`: a box over a square (or a bench slot) with
  one CSS animation, 1 s, no script per frame; a later round's pawn cash-in ("+5") places it the same way. Buying has none.
- **The bot** (the numbers are `AUTOCHESS.bot`): places held pieces first (free); buys by weights from its own shop; rerolls (2 gold) at
  most 4 a round; buys XP (20 gold) only when that gives it a level, or when it has 140 or more (it saves up), at most 3 a round; with its
  board full holds a non-pawn at 50% a look, at most 2 a round; adjusts with a small engine search (1500 nodes, at most 16 tries, 3 random
  squares per piece). Simulated over 400 matches of 8 rounds without fights (the bot alone, with the income): round 1 it has 4.1 pieces
  on the board (level 4.4), round 4 5.5 (level 5.9), round 8 7.2 (level 7.6), a bench of 0.35 pieces, and it ends round 8 with about 260
  gold unspent: it is limited by its level, as a player is, and is beatable by one who levels. With the real engine, 24 setups: the bot
  changes a piece in 10 of them, 17 searches and 183 ms an adjust on this machine (the step is 5 s).
- **CI:** the numbers are in `packages/core/src/settings.ts` (a shared path in `e2e/areas.json`), and `sound.ts` is shared too, so this
  PR runs the whole e2e suite.
- **Seeds in the e2e file** are listed at its top (the shop and the kings from `?seed=N`, the bot's lock-in time from its own draw).
- **One slow request is not a game bug:** once, a first request to the local server took 5.4 s (`/api/status`, then
  `/api/auth/config`, which the screen waits for) and the test's 5 s check gave up; it passed on its re-run. The timeout was not
  lengthened.

**Player-visible text** (exact; old → new where it changed)
- The buy step's line: "Tap an offer to buy it: it lands on its square. Drag one to the bench to hold it." (was "Tap a piece to buy it. Drag it onto your half, or tap a square."). Locked in: "You're locked in. Your board, bench and shop are frozen until the step ends." (unchanged).
- The timer's labels: "Buy" (was "Buy & place"), "Locked", "Locked in", "Move" (was "Move & drop"), "Fight", "Round over", "Match over".
- Offers: "Bishop c2" under the piece and price; short reasons "No gold", "Level full" (was "Board full"), "Bench full", "Taken", "Max 1", "Max 8", "Too many", "Locked".
- Lines: "Not enough gold: a rook costs 50 and you have 10.", "Your level allows 4 pieces on the board. Buy XP to level up." (was "Your board is full: 10 pieces and your king at most."; on an offer: + " Drag the offer to the bench to hold it."), "Your bench is full: 4 pieces at most. Place or sell one first." (was "Your bench is full. Place or sell a piece first."), "b4 is taken.", "c2 is your king's square.", "One queen at most." (was "One queen a round."), "8 pawns at most.", "Another offer was on b4: it rolled again.", "Held the rook for b4. Tap it on the bench to place it.".
- Reroll and XP: "Reroll 2" (was "Reroll 5"), "Buy XP 20", "Not enough gold: a reroll costs 2 and you have 0.", "Not enough gold: 4 XP cost 20 and you have 10.", "You are at the top level, 10.", "Level 5: your board may hold 5 pieces.", "Bought 4 XP.".
- Selling: "Queen selected. Tap Sell to sell it for 67." (was 81 at 90%), "Sell 67", "Sold the queen for 67.", "Drop to sell for 67", "Drop to hold it for 50", the floating "+67".
- Strips: "Bot" (was "Opponent"), your account's name (was "You"), "Lv 4 · 2/4 XP", "Lv 10 · max", "HP", "Gold", "Income +100", "Locked in".
- Adjust: "Move one piece to any empty square of your half. Tap a piece, then a square." (was "One move and one drop (25 gold). Tap a piece, then a square."), "Their pieces stay shown; yours stay hidden until the fight. Tap ↩ to take your move back." (was "... Tap ↩ to take a change back. Bench pieces left over are refunded."), "Your opponent is moving their pieces…", "You've made your move. Tap the piece you moved (↩) to take it back.", "Pick one of your pieces.", "Your king stays where the game put it.", "Pieces go on your half of the board.", "That's your king's square.", "That square is taken.", "Pawns can't stand on your back rank.", "3 pawns a file at most." (was, for a piece that can't go there: "That piece can't move there: one chess move, onto an empty square of your half.").
- Gone (they went with v5's drop, auto-drop and pawn pick-up): "You've made your drop. Tap the piece you dropped (↩) to take it back.", "Not enough gold: a drop costs 25 and you have N.", "Pick a piece from your bench.", "3 bench pieces dropped onto your board.", "This pawn can't move again. You can still sell it.".
