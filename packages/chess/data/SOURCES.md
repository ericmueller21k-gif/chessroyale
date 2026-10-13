# Data and third-party code

| What | Used for | Source | License |
| --- | --- | --- | --- |
| `sources/[a-e].tsv` | Named opening lines (ECO, name, moves) | https://github.com/lichess-org/chess-openings | CC0 1.0 (public domain dedication); see `sources/COPYING.txt` |
| `openings.json` | The opening library, generated from the TSVs by `scripts/build-openings.ts` | This repo | Same as the TSVs (CC0) |
| Stockfish 19 (stockfish.js, lite single-threaded WebAssembly build) | Scoring moves, bots | https://github.com/nmrugg/stockfish.js (npm `stockfish`); Stockfish source: https://github.com/official-stockfish/Stockfish | GPL-3.0 |
| chess.js | Move generation and rules | https://github.com/jhlywa/chess.js | BSD-2-Clause |
| The cburnett chess pieces (Colin M.L. Burnett) | The pieces on the board (packages/app; the board itself is the game's own since Oct 12, 2026, replacing chessground) | Wikimedia Commons; file by file in `packages/app/src/board/pieces/SOURCES.md` | BSD (3-clause) |
| Preact | UI framework (packages/app) | https://github.com/preactjs/preact | MIT |
| `packages/app/public/sounds/{move,capture,castle}.mp3` and `sounds/pieces/*-classic-*.mp3` | The classic piece sounds (the defaults) and their variations | PyChess (`sounds/mov2.wav`, `capture2.wav`, `castle.wav`), https://github.com/pychess/pychess/tree/master/sounds, converted to mp3; the variations made from them by `scripts/piece-sounds.py`; file by file in `packages/app/public/sounds/SOURCES.md` | GPL-3.0 (separate data files) |
| The other `packages/app/public/sounds/pieces/*.mp3` | The other move and capture sounds (all wood) | Kenney's *Impact Sounds* (https://kenney.nl), and our own (`scripts/piece-sounds.py`); file by file in `packages/app/public/sounds/SOURCES.md` | CC0 1.0, and ours |

Stockfish is GPL-3.0: anything distributed with it must offer its source and license. Before any public release,
review the license terms (buildspec.md, "Parked for later").
