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

## Shelved (Eric, Oct 19 evening)

"I'm honestly thinking we may have to shelve this idea for a bit and keep the button on maybe like an admin only screen for
testing... it's going to take more work than I realized to make this balanced and fun." So the home button is gone and home
is exactly as it was before it (its spacing and `home-layout.spec.ts` / `live-window.spec.ts` back to before #298; your
pawn is the size it was). Admins open the demo from Settings → TESTING, "Auto chess (shelved demo) ›". `/autochess` still
opens it for anyone with the link (it's client-only and behind Access). The no-promotion and fizzle-out rules above stay in.

