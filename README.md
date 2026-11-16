# Battle Royale Chess

64 players on 8 boards, one move at a time. Each round you get a position on one of the boards with 7 others; Stockfish
scores every pick, and you score by playing better than the rest of your group. After every stage the bottom 8 go
out and the most lopsided board closes, until 4 players are left on the last board for a 2v2 final, where teammates
alternate moves and the best average move quality wins.

- Brief: `buildspec.md`. Decisions and their reasons: `DECISIONS.md`. Bot playtest: `reports/playtest.md`.
- Deploying (Cloudflare, free): `DEPLOY.md`. Checking on a real phone: `TESTING.md`.
- Developer notes and commands: `CLAUDE.md`.

Licenses: every third-party piece of the app, its license and how it's used is in `LICENSES.md` (the game's own
source isn't published; Stockfish, GPL-3, and Maia-3, AGPL-3, are separate programs with their own notices). Data
sources: `packages/chess/data/SOURCES.md`.
