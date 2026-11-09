# Boss result v2: you vs. the boss, no God King (Eric, Nov 9) — APPROVED (Eric, Nov 9: "go ahead with the boss result redesign … add the already boss animations we have built, remove the king")

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

## Also in this job (Eric, Nov 9)
- **Remove the time part from the XP box everywhere** ("remove the 12 min, we dont want players to know they could just stall to get
  more XP"): the parts line never shows minutes ("12 min +120"); it shows only the win's part ("Win +50") when there is one, and the
  "Daily solo limit" note stays as a word without minutes. The total "+N XP" stays. Update the FAQ's XP section so it doesn't
  say XP comes from minutes played (it can say XP comes from finishing games, more for longer games, plus a win bonus, capped per
  game). The rules don't change (30-minute cap per game, 120 solo minutes a day).
- Reuse what exists: YourPawn (already drawn in the Last Stand duo inside GodKingEpilogue), BossCharacter and its existing attack
  animation (the one it plays on a king), XpResult. Remove GodKingEpilogue from the result screen (and its lines there), not
  elsewhere.
- Your name over the bar: on boss results the XP sits under your pawn (name, then "+N XP" and "Level N" over the bar), the bar the
  same length as #569's box. Other result screens keep the XP box as merged.
