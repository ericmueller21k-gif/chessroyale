# Three quick fixes (Eric, Nov 10 night)

1. **Auto chess rerolls:** Eric: "1 free reroll every round, and then it costs 1 for the next one, and then 2, and it's capped at
   2." Settings only: `AUTOCHESS.shop.reroll` from `{ first: 2, step: 1, max: 5 }` to `{ first: 0, step: 1, max: 2 }` (0, 1, 2, 2...;
   back to free at each round's start). Update the settings comment, the FAQ/rules text if it states the prices, and the tests
   that pin them (`rerollPrice`). The bot's reroll rule (`maxRerolls`, `rerollGold`, `rerollChance`) reads the same price: check it
   still behaves sensibly with a free first roll (it may now reroll more; that's fine, but no infinite loop at price 0).
2. **Auto chess board colors:** Eric: "the board in the center ... the colors fuse. They look very similar on some of the tiles ...
   see if you can just slightly adjust it." Look at the auto chess board (the center board; each player's color or the light/dark
   squares, whichever are near-identical on some tiles), find the pairs that are too close (measure: contrast / color distance
   between adjacent tile colors, light and dark mode), and nudge them apart slightly, keeping the look. One still before/after
   (phone, light and dark).
3. **Top bar icons black:** Eric (his screenshot: notes/assets/eric-topbar-nov10.jpg): "just make them all black, like the settings
   [gear], just black and empty on the inside, except for your guy [the profile pawn]. That can be the colorful one." Undo #580's
   colors for the Quests, Shop and Friends icons (and the desktop side menu's if they're colored): black outline, no fill, like
   the gear, in light mode (and the matching light outline in dark mode). The profile face stays as it is.

Lane: light (settings numbers, colors, CSS) with a unit-test update for the price. Effort medium. One decision note
docs/decisions/2026-11-10-quick-fixes.md (≤ 120 words). Stills: the board before/after and the top bar (phone), on the orphan
branch stills/quick-nov10. Push to claude/quick-nov10; when done write .pr-body.md and push. Don't open the PR. Read CLAUDE.md
and notes/briefs/rules-common.md first.
