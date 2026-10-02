# Data and third-party code

| What | Used for | Source | Licence |
| --- | --- | --- | --- |
| `sources/[a-e].tsv` | Named opening lines (ECO, name, moves) | https://github.com/lichess-org/chess-openings | CC0 1.0 (public domain dedication); see `sources/COPYING.txt` |
| `openings.json` | The opening library, generated from the TSVs by `scripts/build-openings.ts` | This repo | Same as the TSVs (CC0) |
| Stockfish 19 (stockfish.js, lite single-threaded WebAssembly build) | Scoring moves, bots | https://github.com/nmrugg/stockfish.js (npm `stockfish`); Stockfish source: https://github.com/official-stockfish/Stockfish | GPL-3.0 |
| chess.js | Move generation and rules | https://github.com/jhlywa/chess.js | BSD-2-Clause |
| chessground 9 | The board (packages/app) | https://github.com/lichess-org/chessground | GPL-3.0-or-later |
| Preact | UI framework (packages/app) | https://github.com/preactjs/preact | MIT |
| `packages/app/public/sounds/{move,capture,castle}.mp3` | Piece sounds | PyChess (`sounds/mov2.wav`, `capture2.wav`, `castle.wav`), https://github.com/pychess/pychess, converted to mp3 | GPL-3.0 |

Stockfish is GPL-3.0: anything distributed with it must offer its source and licence. Before any public release,
review the licence terms (buildspec.md, "Parked for later").
