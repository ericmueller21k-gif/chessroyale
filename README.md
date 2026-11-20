# End screen, built (Nov 20): stills

The end screen on the real screens (branch `claude/end-screen-build`), at the end of its sequence, 2x: phone 390 × 844 and computer
1280 × 800, light and dark.

- `tower-win-*`: Battle Tower floor 4 won: "Victory!", "Floor 4 cleared!", its 3 bosses 1-2-1 in their defeat beats, XP EARNED +450
  (Win +50 · Quest +300) through a level-up to Level 3, the moved quest, "Next: floor 5", Back to the tower, the review.
- `tower-loss-*`: floor 3 resigned after two moves: "Defeat", "Floor 3 lost · 1 life left" (red, still), its 2 bosses gloating, +60 XP,
  two quests moved (Warm Up done ✓).
- `ranked-win-*`: ranked 1 v 1's own page: "Victory!", "Mira resigned.", RP EARNED +20 through a division (Gold 3 → Gold 2 at 10 RP, the
  new emblem), XP EARNED +150, two quests, +15 coins, Play again / Home, the chat; on a computer the game move by move beside it.

The XP, RP and quest numbers are faked server answers (the test's 🏆 makes a test game, which earns none); the screens and the
sequence are the app's own. Frame by frame checks of the count, the lob and the fill are in `e2e/xp.spec.ts` and `e2e/ranked-tiers.spec.ts`.
