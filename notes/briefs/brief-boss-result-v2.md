# Boss result v2: you vs. the boss, no God King (Eric, Nov 9) — DRAFT, waiting on Eric's OK of the mockup

Eric (Nov 9): "when you lose, it should do that same God King attack animation, like the boss is kind of standing there
attacking you … get rid of the king in the victory and defeat screen entirely, even though I know he has some quotes he says …
to make room, and then we can make that exp suggestion so it just shows under our name, kind of like … in the auto chess … we
can keep it the same length … it always shows our pawn piece and the boss. And then if we lost, it shows him, they're like attack
animation on us."

Mockups: assets/boss-result-v2-win.png, assets/boss-result-v2-loss.png.
- Boss result screens (victory, defeat, draw; solo and raid; after a Last Stand too): no God King (no GodKingEpilogue, no his
  lines); one row: the boss left, YOUR pawn right (your look on), facing each other.
- Under your pawn: your name, then "+N XP" and "Level N" over the XP bar (the XP box's fill animation, same bar length as #569),
  then its parts. This replaces the separate XP box on boss results only.
- A loss: the boss plays his existing attack animation (the one he uses on a king: the Last Stand / mate attack) aimed at your
  pawn, which reacts (a knock-back). A win: as now (his defeat pose). A draw: both stand.
- The boss's line stays (his bubble); the God King's epilogue line goes.
- Depends on XP phase 1 (#569) merging first (it owns XpResult).
- Lane: targeted (+ boss kit since boss animations are wired); frames checked with real taps (npm run frames:boss).
