# No door cards from a door's picture during a challenge or Don's beat (Nov 20, 2026)

- **What happened:** after #836 (a door's picture tapped from anywhere opens its card), main's e2e failed: in Rolling Dough's back room, mid-beat after Don's Challenge, a tap on the floor at 4,8 landed on the back door's picture (it stands in the near wall, drawn over the floor behind it), opened the door card and stopped the walk; the card stayed open through the walk-out.
- **Cause:** "no cards from a challenge or Don's Challenge on" lived only in `stepCards` (the cards that show as you arrive); the new way to open a card (`aimDoor`) skipped it.
- **Fix:** one rule, `noCards()`, asked by every way a card opens: while it holds, a tap on a door's picture walks you to the floor under it, as before #836. #836's behavior is unchanged everywhere else. The spec's tap was right and is unchanged.
