# The reload's card test: its own move ended the game (Nov 25, 2026)

- Main's run 45584074647 (after #942): xp.spec's "a solo battle left mid-game" reloaded after your 9th move and the card never came;
  the page showed home. Passed on its retry.
- Not #942, and not a player bug: the test plays the engine's best move, which can mate Ginger (the CI retry's game was won outright by
  move 10). A battle that's decided is rightly not kept (SoloMatch `noteEnded` clears it), so the reload, about 10 ms after that
  move, had nothing to offer. 37 local runs on CI's Chromium 141 (4 workers, CPU stress, the whole spec in CI's order) never failed.
- Fix: `playOwnMoves` plays the best move that doesn't end the game (mate or stalemate by chess.js), else pickMove's quiet one among
  the moves that don't. No player-visible change.
