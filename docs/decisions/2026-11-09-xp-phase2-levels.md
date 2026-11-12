# XP phase 2: level-up rewards (Nov 9, 2026)

Eric (Nov 9): "a crate and a key when you level up"; the design's section 4: 2 crates + 1 key a level, every 10th also a boss crate
the player picks.

- **Every level owed is paid at a counted game**, not only the level that game crossed: each level 2 up to your level now whose op
  (`level:<n>:<ledger id>`) isn't in the ledger. So levels reached before phase 2 (phase 1 shipped the same day), through a test
  switch's jump (`?xp=`, test servers only), a guest's merge or while rewards were paused are paid at the next counted game, and nothing is paid twice
  (setting XP down and up again pays nothing more). One count first, so the usual game costs one read.
- **At most 20 levels a game** (`XP.levelsPerGame`): a test switch's jump to level 100 can't make one batch of hundreds of statements;
  the rest come at the next games.
- **Its legs name the game that paid them**, so that game's result screen (and `GET /api/xp`) answers the levels it paid
  (`results.xp_rewards`).
- **Shown in a toast after the bar fills** ("Level 8!", the crates and key with their counts, "Choose your boss crate in Crates."):
  see 2026-11-09-xp-phase2-toast.md. The XP box itself is unchanged (78 px), so nothing shifts.
