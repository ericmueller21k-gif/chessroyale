# Auto chess v8: stars (Oct 22, 2026)

## What Eric asked

Oct 22, an idea for after v7.1 (the design notes have every answer):

- "No moving pieces period during action phase but a twist, pieces can now be 2 starred which lets you move the piece once legally during the action phase, so only 2
  starred pieces can move during this time, 3 star pieces can move anywhere. Each star level is denoted from a star on the piece itself normal pieces have none, 2
  starred have 2, 3 have 3. [...] Pawns can't be starred up. When you have a piece of a tile only that piece can appear there for the tile anymore."
- The star-up's price: "maybe even it's just a flat 5 to upgrade honestly, since rolling to find them will be very hard", then "it's also like already very painfully
  expensive to roll... I was thinking it could even be free, so having it be 5 is already generous".
- The move step: "a flat 5 seconds no matter what. That way it gives you a few seconds to look at the board anyway before it plays out", and "if you have two and your
  opponent has two starred up pieces, that's still just... an extra 6 seconds total" (3 s for each starred piece of the side with more).
- The bench: stars up there too, and "for things on your bench, they can be duplicates" (a bench bishop for f2 and a board rook on f2: the shop can offer both). An occupied
  board square still offers only its own piece ("we'll keep it how it is. We can always change it later").
- On screen: "just putting little stars on the piece"; a star-up offer glows "like TFT" (gold for a second star, rainbow for a third); "a cool level up sound", not cheesy or
  cheap, a different one for the third star ("TFT does a good job of this").
- A 3-star moves "anywhere": "any tile on your side of the board".

## What was built

**Stars.** Every piece but a pawn or the king has 1 (plain), 2 or 3 stars (`maxStars`). A star changes nothing in the fight. `Army.stars` has the starred pieces of the board by
square (the key is left off when nothing is starred, so a plain army is still plain data), a bench piece has its own `stars` (`Held`). A piece keeps its stars when it is moved,
placed from the bench or carried into the next round on the bench (the board's pieces still go at each round's end).

**Star-up offers** (`shop.ts`, `rollOffer`). An offer's square is drawn first, evenly among the squares of your half that aren't your king's and no other current offer is on; the
square's candidates are every piece of yours that can star up (not a pawn, under 3 stars) and stands on it (the board) or is held for it (the bench), plus, when the board square is
empty, a new piece rolled by the level's odds (the limits apply); the offer is one candidate, evenly. A square with no candidate is drawn again (the squares with a candidate are
drawn from evenly, which is the same thing). **An offer is a star-up when its kind and square match a piece of yours that can star up** (`starUpTarget`), however it was rolled: so a
new-piece roll that happens to match a held piece's kind and square merges into it, as the brief says. It costs a flat 5 (`starUpCost`), the piece gains a star where it is, and no limit
on new pieces applies (a queen's with your one queen out, with a full board): a merge never adds a piece. Holding one is refused ("Tap to star up").

**The move step** (`adjust.ts`, `adjustMode: "stars"`, the new default; `"legal"` and `"teleport"` stay behind the setting). `moveBase` 5 s plus `movePerStar` 3 s for each starred piece
on the board of the side with more of them (the bench's stars don't count); it always runs; with no starred piece it is 5 s to look at the board. Only starred pieces on the board move,
each at most once, in any order: a 2-star one legal move on your half (the fight's own move generator, in the position as the earlier moves of the step left it), a 3-star to any empty
square of your half where it may stand (`adjustTargets`: the half, not your king's, a pawn's ranks don't matter as a pawn is never starred). Each moved piece can be taken back while the
step lasts. Every starred piece glows at the step's start; the random lit piece is gone for this mode (it stays in `"legal"`).

**The bot** (`bot.ts`). It buys a star-up whenever one of its offers is one it can pay for, `bot.starUpChance` (95%) of the time a look finds one, before anything else and whatever its board's
room is (the one giving the most stars first, then the dearest piece); its bench's too, as it is the same rule. In the move step it moves each of its starred pieces (`botStarMoves`): a
2-star the engine's best legal move, a 3-star the best of a sample of the empty squares of its half; the search is no bigger than v7's (see the calls).

**On screen** (`AutoChess.tsx`, `styles.css`). *(Changed later the same day: tiny stars inside the piece, an outline round it and a clean board, [2026-10-22-autochess-star-look.md](2026-10-22-autochess-star-look.md); what follows is the first look.)* Two or three small gold stars with a dark edge over the piece's lower edge: on the board (yours; theirs once shown), the benches, and a
shop card's piece (what it becomes). A star-up card has a gold border and glow, a rainbow one for a third star, and its price says 5; the piece it merges into (or its bench tile) has the
same ring. A merge pops the piece and flashes it where it is, its new star pops in, and a sound plays. Reduced motion: no animation, the borders stay.

**Sounds** (`sounds.ts`): `star2` (a soft low thump, a quick shimmer rising from 500 Hz to 2 kHz, a bright two-note bell tail, 0.62 s) and `star3` (a deeper thump, a longer shimmer into a
swelling major chord, a bright bell-like hit and a sparkle of small high bells falling away, 1.0 s). Both under the move's peak and loudness like the others. They are made at half the sample rate and doubled (linear interpolation; every partial is under 6 kHz, so the top loses at most 1.5 dB): the third star's first version took 134 ms on CI against the sounds test's 120 ms limit (a sound is made ahead of its cue), and is now about half that; a rate under 32 kHz is made at its own rate.

## Judgment calls

1. **The odds pill is still exact.** The brief's order (square first) would, taken to the letter, skew the odds of a new piece: a pawn can't stand on a back-rank square, so a pawn rolled there would
   have to be dropped and the pawn share would fall from 74% to about 56% at level 4. So when the new piece's kind can't stand on the drawn square it goes to a square it can (the old roll's own
   square rule). Over many rolls the new pieces follow the level's row to a point (a test, with a star-capable army). And an army with **nothing that can star up rolls exactly as before** (the old roll,
   kind first), so the odds' own tests and the old seeds' first shops are as they were.
2. **Star-up-ness is derived, not stored.** A card is a star-up when, at that moment, its kind and square match a piece of yours that can star up. So an offer that was a plain new piece becomes a
   gold card the moment you hold a piece it matches, and a star-up card turns back into a plain one (at the full price) if you sell the piece it merged into. The card always says what a tap does now.
3. **Which piece it merges into** when more than one matches: the board's, then the bench's (the lowest slot). Two held pieces with the same kind and square can only happen with a 3-star beside a lower one.
4. **A star-up card is only tapped,** never dragged to the bench (a merge has nowhere to be held); its drop on the bench is refused with "Tap to star up".
5. **Stars follow the pieces through the fight** (`moveStars`): they are drawn on the pieces, and they are needed for the survivors' refund ("everything paid for the piece").
6. **Selling and the refund** count the price plus 5 for each star above the first: a 2-star knight 35 (sells for 26), a 3-star rook 60 (sells for 45); the refund 25% of the survivors' total.
7. **The step's length is known when the buying ends** (both armies are known then), so there is no tell: the full reveal shows their stars at the same moment. Their stars on the board are shown only for
   revealed pieces while you buy; every starred piece of theirs shows in the move step.
8. **The move step needs a tap first:** tap a glowing piece (its squares light as dots), then a dot, or drag it. A 3-star's dots are all the empty squares of your half (up to 27). A tap on any other piece of
   yours says "Not starred", the king "King stays put".
9. **Taking a move back replays the rest of the step** with each move checked in the position it was made in, so taking one back can't leave a later 2-star move that is no longer legal ("Undo the other
   first" if a later move needs it: a rook that went through a square the knight left, a piece that moved onto the square another left).
10. **The bot's search is the v7 step's size:** one look at the start and at most `bot.adjustTries` (16) more in all, shared evenly by its starred pieces (at least one each). The 3-stars go first, then the
    2-stars, each in square order, each judged in the position the earlier moves made. A 3-star tries a seeded sample of the empty squares of its half (with one starred piece that is 16 of up to 27).
11. **The bot still places what it held first,** for nothing, so a held piece of its own is starred up only when it was held in the same round (the bot holds with a full board); its board pieces are the usual star-up.
12. **The step with nobody starred runs all 5 s** (Eric: "a flat 5 seconds no matter what"), also when neither side can move: the v7 shortcut to the fight (no piece could move) is only for the v7 mode.
13. **Test switches** (`?stars=n@c2:1,b@d2:2` your board, `?benchstars=b@f3:2` your bench, `?botbench=n@c7:2` the bot's, which it places for nothing, `?adjustmode=legal|teleport|stars`): the shop rolls for the
    army that is there, so a test finds a seed that shows a star-up by the pure code (`findseed`, in the checks below), never by luck.
14. **Messages:** every one is under 15 characters a line (see the table).

## Counts

(The script is the screen's own pure code in a loop, `rollOffer`, `newShop`, `botPlan` and `settleRound`; it is not in the repo.)

**How often a star-up shows** (20,000 seeded shops each; four offers; level 4's odds; the pieces that can star up are plain knights, bishops and rooks on random squares of the half, nothing else on the board):

| Pieces that can star up | Shops with a star-up | Star-ups per shop | Share of offers |
| --- | --- | --- | --- |
| 1 | 12.9% | 0.13 | 3.2% |
| 2 | 24.5% | 0.26 | 6.4% |
| 3 | 35.1% | 0.39 | 9.7% |
| 4 | 43.7% | 0.51 | 12.7% |
| 5 | 52.3% | 0.65 | 16.2% |
| 6 | 59.4% | 0.77 | 19.2% |

(With three pawns standing as well the rates are a little higher: the pawns' squares offer nothing, so a draw lands on the other squares more: 2 pieces 27.4%, 3 pieces 38.3%.) A round's shop is
rolled again after every buy and every reroll, so over a round the star-ups come far more often than in one shop: they are found by rolling, as Eric said, but not rarely.

**How often stars happen in bot-against-bot rounds** (400 matches of 8 rounds, both sides the bot's own plan with its gold, level, XP and bench carried round to round, a coin flip for each round's winner, no fights, so the
economy is a little off the real one; 6,400 side-rounds): at the end of the buying **39.7% of side-rounds have a starred piece on the board, and 7.7% a 3-star** (3-stars: 540 of 3,520 starred pieces). By round: round 1 13.9% / 1.0%, round 2 20.0% / 2.3%, round 3 30.3% / 3.3%,
round 4 38.4% / 6.5%, round 5 43.3% / 8.1%, round 6 52.9% / 10.0%, round 7 57.5% / 15.3%, round 8 61.1% / 15.5% (starred / 3-star). The bot bought 0.64 star-ups a side-round: 3,529 second stars and 540 third stars; 4,018 on its board and 51 on a held piece (it places what it held for
nothing at the start of a round, so a held piece is starred up only when it was held that round: 42 starred bench pieces came into a round). A board's stars are gone at each round's end, so these 3-stars are all made in one round (two star-ups of one piece), or on the bench.
The bot takes every one it is offered (95%), so a human's rate is lower; the numbers are the ceiling of what the rules give.

## Player-visible text changes

| Where | Before | After |
| --- | --- | --- |
| A star-up card | none | a gold-bordered card (a rainbow one for a third star), the piece drawn with its stars, the price `5`; its spoken label "Star up your rook on f2 to 2 stars, 5 gold" |
| After a star-up | none | under the bench's row, "f2 is 2 stars" or "f2 is 3 stars" |
| A star-up card, short of gold | none | "Need 3 more" (the 5 less your gold) |
| A star-up card dropped on the bench | none | "Tap to star up" |
| Move step, a piece that isn't starred tapped | "Only the lit piece" | "Not starred" |
| Move step, the first line when the step begins (the v6 step's "Tap a piece, then a square") | unchanged in that mode | none in the stars mode |
| Sell button and "Drop to sell for N" | the price's 75% | 75% of everything paid, the star-ups included |
| The move step's clock | "0:07" for every step | "0:05" with no starred piece, 3 s more for each starred piece of the side with more |
| A held or starred piece's labels (spoken) | "Held rook for e7" | "Held rook, 2 stars, for e7" (a plain piece: unchanged) |

No other word changed. "Only the lit piece", "No piece can move" and the rest of v7's lines are still said in the `legal` mode.

## Checks

- Unit (`packages/app/test`): `autochess-stars.test.ts` (the offer rule: candidates, the redraw, the limits ignored by star-ups, one offer to a square, seeded, the odds of the new pieces; the merge on the board, the bench and a new-piece roll
  that matches a held piece; prices and refunds; the stars through the fight; the step's length, each star's moves, taking back; the bot's buys and moves), `autochess-sounds.test.ts` (the two new sounds), and the older files
  updated where the default move step or the offers changed (none loosened).
- e2e (`e2e/autochess.spec.ts`): see the area page.
