# Auto chess: drags, silhouettes and one offer to a square (Oct 21, 2026)

## What Eric saw

His first test of the new fights ([how they end](2026-10-21-autochess-endings.md)), voice-typed:

1. "I dropped my queen in and then it froze. So it looked like I had two queens, and... the one on my bottom rank didn't actually
   count as a queen, I think, because it never moved." His screenshot (round 1, "Round over", "You're too far ahead") has a white
   queen on g1 that never moved all fight, next to the real one on d6.
2. "The shadow pieces. I was able to click on them and then sell them... You should not be able to... there's a shop and the shadow
   pieces, those should never be draggable, only clickable. So I was able to drag it into the sell spot and then it just sold a
   piece that didn't exist."
3. "I had two queens in my first shop. That seems extremely unlikely, but I'll just assume that's a coincidence."
4. (No change wanted: "right when you load in, you just instantly get into it. That's fine for testing.")

Then, narrowing 2 (relayed by the director): "When I say I dragged, I mean I dragged the shadow piece that was on the chessboard, not
the shop... the shop, you should still be able to drag it... You just shouldn't be able to do anything but tap the shadows that are
on the board." So only the silhouettes on the board are tap only; the shop's cards keep dragging (to the bench), and the bench works
as it did. (The brief's first version had the bench held by dragging a board piece there instead: not built.)

And a new rule: "pieces should never be duplicate on one spot. I noticed two pawns showing. It should be hard kept one piece per
shop or one tile cap per shop." His screenshot had two small pawn silhouettes side by side on one square beside the king. Then: a
shop slot never stays empty; when an offer would land on a square that's already used, the roll picks another free square.

## What each bug really was

All reproduced on main (bc9a97e) first, each by a Playwright test that failed there and passes now.

1. **The frozen queen: a drag held through the end of the adjust step.** The adjust step is 5 s, so a player moving their one piece
   is often still holding it when it ends. `toFight` cleared the press and the selection but not the drag, so the drag ghost (a
   copy of the piece under the pointer, `.ac-ghost`) stayed on screen at the pointer's last place through the whole fight and result:
   the "queen on g1" was the ghost of the queen he was moving; the real one played on from g1 to d6. Letting go didn't help (the press
   was already gone, so nothing cleared the drag), and **it carried into the next round**: the buy step opened with the ghost still
   there and "Drop to sell for N" lit over the shop with nothing being dragged. The buy step's own ends (time up, lock in) already
   cleared it; `toFight`, the lock's start, `nextRound` and `playAgain` didn't. The brief's reading (an offer card unmounting at the
   step's end, the capture lost) was the same family but not what Eric hit: with a mouse, those paths already ended cleanly on main
   (`toAdjust` cleared the drag), except that a drag lived on through the last seconds' lock.
2. **Shop cards could not be dragged by a finger at all.** Found on the way: the browser takes a finger's drag on a `.ac-buy` button
   for a pan (it had no `touch-action`) and sends `pointercancel` after three moves, so on a phone "drag an offer to the bench" only
   ever worked from the board's silhouette (which has `touch-action: none`). With the silhouettes tap only, that would have left
   phones no way to hold a piece. `.ac-buy` is `touch-action: none` now.
3. **A sale of something that isn't there.** `sellPiece` took `army.board[square]` and paid `sellValue(kind!)` even when nothing was
   there (`NaN` gold); `sellHeld` threw on a missing slot. A hold goes stale whenever the piece is sold another way while it is
   held. The path reproduced: pick a piece up (picking it up selects it, so "Sell 7" shows), sell it with the Sell button (the
   keyboard does it with the mouse still down), then drop it on the shop row: the drop sold it again, `NaN`. **I could not make a
   plain silhouette drag sell anything on main**: by mouse and by touch, a silhouette dragged to the shop row, the bench, the board,
   the header, ~500 random gestures with an invariant (gold moves only by a price, a sale or a reroll, and only with a piece
   gained or lost), no violation. A silhouette drag did pick up an offer, show its ghost and "Drop to hold it" on the bench, and a
   drop on the bench bought and held it. What Eric saw sold may have been that (a held offer
   he took for a sale), or tied to the leftover "Drop to sell for N" of bug 1; I can't tell which. Either way the rule now is that a
   sale pays only for a real piece (below), and a silhouette cannot be dragged.
4. **Two queens in a first shop: chance.** 2% a slot makes two or more among five 1 in 260. The slots are independent on main: see
   "The odds" below. (What he did see, a third of first shops with two offers on one square, is the new rule.)

## What was built

- **Silhouettes on the board are only tapped** (`tapOnly` on the press `layerDown` starts). A tap buys it, as before; the pointer
  moving more than 10 px (`TAP_SLOP_PX`) makes it neither a tap nor a drag: nothing is picked up, no ghost, nothing dropped or
  bought. The shop's cards drag as before.
- **A gesture ends cleanly** (`cancelGesture()`: the press, its pointer capture, the drag's ghost, the selection). It runs when the
  buy step ends, lock in is pressed, the adjust step ends, the next round or a new game starts, the round or phase changes (a layout
  effect, the net), the buy step's last seconds lock (the same effect, `interactiveLayer`), the window loses focus, and when the
  pointer is cancelled or loses its capture (listeners on the window too, for a captured element that left the screen). Nothing
  is picked up once the step is locked (a press there is a tap and says "Locked: ..."), and the ghost draws only in the buy and
  adjust steps.
- **A sale only pays for a piece that is there** (`sellPiece(army, square, kind)` and `sellHeld(army, index, kind)` return null
  unless that kind of piece is on that square or in that slot now; the king and offers never match). The screen's `sell` clears the
  selection and does nothing else on a refusal (no gold, no sound, no line). The Sell button shows only for a piece that is there.
- **One offer to a square.** `rollOffer` takes the squares other offers are on; the first roll, a reroll and a refill pass them,
  and `replaceTaken` also rolls an offer sharing a square with an earlier one (a shop built some other way). Drawing: the square is
  drawn from all the usable ones as ever and drawn again among the free ones only when it was taken, so a roll that collides with
  nothing is the one of old and only the shops that doubled up changed (65,776 of 200,000 first shops did). The side-by-side
  drawing, the `--n`/`--i` sizing and the half-square hit test (`offersOn`'s split) are gone; the offer under a press is the one on
  that square, and none counts on a square a piece of yours stands on. A shop that couldn't give an offer a free square would still
  just be a slot short (the old path); no text, and a test asserts it never happens (880 sequences of rerolls, buys, holds and
  placings). It can't: the half has 32 squares and at most about 16 are used (the king, up to 10 pieces, 5 offers).

## Player-visible text, exactly

- "Another offer was on X: it rolled again." (after a buy, or a held piece placed): **X is now the square the offer that rolled was
  on**; it was the square just bought or placed, which was always right when two offers could share a square and is wrong now that
  they can't. It shows only when an offer can't use its square any more: a held piece placed over it, or the third pawn of a file.
- Nothing else is reworded: "Tap an offer to buy it: it lands on its square. Drag one to the bench to hold it." and "...Drag the
  offer to the bench to hold it." stay true (the shop's cards still drag). A refused sale says nothing.
- Not text, but seen: a silhouette fills its square (no half-size pairs) and no longer drags; no ghost or "Drop to sell for N"
  outlives the step it began in; a drag ends when the last seconds lock the step; a finger can drag a shop card.

## The odds (no change)

`packages/app/test/autochess-odds.test.ts`, 36,000 first shops (3 rounds of 12,000 matches) and more for rerolls, refills and
consecutive match seeds, seeded as the game seeds them: each slot rolls each kind within four standard deviations of the odds; all ten
pairs of slots independent (Pearson's chi-square against the product of the odds, limit 70 on 24 degrees of freedom against the
99.99th percentile of 58.6); a shop and its reroll, a refilled slot and what it replaced, one round and the next, and match m and
m + 1 independent too; queens per shop 0, 1, 2+ as the binomial says. On 200,000 first shops (main's code and the new one alike):
queens 1.95 to 2.04% a slot, pair chi-squares 9 to 35 (mean 24), two or more queens in 0.36% (1 in 281; 1 in 260 expected), 19 shops
with three or more. So two queens in his first shop was luck, about a 1-in-260 shop.

## Calls I made

- **The tap slop is 10 px.** A finger always wobbles, and the drag threshold (3 px) would have made a wobbling tap on a silhouette
  buy nothing. Past 10 px it does nothing at all, not even a buy.
- **Cards drag by finger now** (`touch-action: none`), needed once the silhouettes stopped dragging.
- **Cancel at the lock, not just at the end.** The brief lists the lock; a drag started before it ends within a tick (120 ms) of
  "Locked" showing, and none starts inside it.
- **Window listeners as a net**, not a replacement for the elements': the elements' handlers stay, so nothing about a normal tap or
  drag changed.
- **Offers avoid your pieces, your king and each other, not a held piece's square.** A held piece isn't on the board, and its square
  may be offered again; placing it rolls that offer again ("Another offer was on d3..."), which is how it worked.
- **Redraw on a collision, rather than drawing only from the free squares first**, so every seed that never collided keeps its shop
  and the e2e fixtures changed only where the shop did (seeds 9, 5, 60; two new ones, 3328 and 10412, are listed at the spec's top).
- **The line names the square that rolled** (above): the smallest change that keeps it true.
- **A refused sale is silent**: nothing was sold, so there is nothing to say, and a line saying "Sold..." would be false.

## Noticed, not changed

- `toFight` and `toAdjust` are started from the interval set up on the first render, so they read that render's `orientation`: a
  cash-in's "+5" float in round 2 or later (the board turns each round) is likely placed as if the board were still the first
  round's. Not touched here; not verified in a game.

How Auto chess works now: [docs/areas/autochess.md](../areas/autochess.md).
