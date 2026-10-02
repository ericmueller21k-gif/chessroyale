# Battle Royale Chess

32 players, one move at a time. Each round you get 10 seconds on a position you haven't seen; Stockfish scores
every pick, and you score by playing better than the other three players on your board. The weakest go out after
each stage until two players are left for a real 3-minute game.

- Brief: `buildspec.md`. Decisions and their reasons: `DECISIONS.md`. Bot playtest: `reports/playtest.md`.
- Deploying (Cloudflare, free): `DEPLOY.md`. Checking on a real phone: `TESTING.md`.
- Developer notes and commands: `CLAUDE.md`.

Licences: Stockfish (GPL-3) and chessground (GPL-3), so this app is GPL-3 too; chess.js (BSD-2); opening names
from Lichess chess-openings (CC0). Details in `packages/chess/data/SOURCES.md`.
