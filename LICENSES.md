# Licenses: everything third-party the app ships

The game's own code is HunChess's, all rights reserved. Its GitHub repository is public but has no license file, so no
license is granted: GitHub's terms let people view it and fork it on GitHub, nothing more (corrected Oct 15, 2026: this
line said the source "isn't published"). Eric decides later whether the repository goes private. Either way, nothing
GPL, AGPL, LGPL, non-commercial or share-alike may be compiled into the app's own code. This is the full list of what reaches a player's device, from the build's own module
list (every module in every built chunk) and every file in `packages/app/public/`, with how each is credited. Audited
Oct 12, 2026; update it in the same PR as anything that adds or removes a third-party piece.

## Compiled into the app's code (the built JS and CSS)

| What | Version | License | Where | Credit / notice |
| --- | --- | --- | --- | --- |
| The game's own code (`packages/app`, `core`, `chess`) | | HunChess's own | every chunk | |
| Preact | 10.29.8 | MIT | main chunk | `/licenses/third-party.txt`, linked from Settings and the FAQ |
| chess.js | 1.4.0 | BSD-2-Clause | main chunk (its license comment kept in it too) | `/licenses/third-party.txt` |
| Vite's runtime helper (module preloading) | 5.4.21 | MIT | main chunk | `/licenses/third-party.txt` |
| The cburnett pieces (Colin M.L. Burnett) | Commons, 2006 | BSD (3-clause), chosen from the author's GFDL / BSD / GPL | the CSS (inlined) | `/licenses/pieces.txt`, Settings and the FAQ; `packages/app/src/board/pieces/SOURCES.md` |

Nothing else: the build's module list has no other package (`npm run build`; the audit script lists each module's
package, version, license and size).

## Files the app serves (`packages/app/public/`)

| What | License | Credit / notice |
| --- | --- | --- |
| Stockfish 19 (stockfish.js lite single-threaded WebAssembly build, npm `stockfish` 19.0.0), `engine/` | GPL-3.0 | A separate program in a Web Worker, never compiled into the game. Its license: `/engine/COPYING.txt`; this build's complete source served at `/engine/stockfish-source.tar.gz` (the tag `v19.0.0` and its network, `packages/app/stockfish-source/`); credited in Settings and the FAQ with both. |
| The Maia box (Maia-3 by CSSLab, onnxruntime-web, chess.js), `engine/maia/` | AGPL-3.0 (its bundled parts MIT and BSD) | A separate program (Eric's decision, Oct 11): `/engine/maia/LICENSE.txt`, `NOTICE.txt` (with onnxruntime's and chess.js's notices); its complete source served at `/engine/maia/maia-box-source.tar.gz` (written by its build); credited in Settings and the FAQ with the source linked |
| Fonts: Archivo, Archivo Black, Press Start 2P, `fonts/` | SIL OFL 1.1 | `fonts/LICENSE.md`; each copyright notice and the license in `/licenses/third-party.txt` |
| The classic piece sounds (PyChess's knocks, the defaults), `sounds/move.mp3`, `capture.mp3`, `castle.mp3`, and their variations, `sounds/pieces/*-classic-*.mp3` | GPL-3.0 (GPL-3.0 data files: sounds the game plays, never compiled into it; Eric, Oct 12) | `sounds/SOURCES.md` (each file's source and, for the variations, exactly how it was made); the notice in `/licenses/third-party.txt`; the license's text at `/engine/COPYING.txt`; credited in Settings and the FAQ ("Classic piece sounds and their variations: PyChess (GPL-3.0)", linking PyChess's `sounds/`); their complete source (PyChess's original WAVs and `scripts/piece-sounds.py`) served at `/sounds/pychess-sounds-source.tar.gz`, written by `scripts/sounds-source.py` |
| The other piece sounds, `sounds/pieces/` | CC0 1.0 (Kenney's *Impact Sounds*) and ours | `sounds/SOURCES.md` (all wood) |
| The God King's, banner and menu sounds, `sounds/god-king/`, `banner/`, `menu/` | CC0 1.0 (Juhani Junkala, HaelDB, wintuh) and ours | each folder's `CREDITS.md` (CC0: no credit owed) |
| Icons, `icons/`; the landing page's demo video and still, `media/`; bot-match replays, `replays/` | ours (made for the game: the icons, a recording of the game, its own bot matches) | |
| The pieces' and third-party licenses, `licenses/` | (the notices themselves) | |

## Flagged

- **Fixed Oct 14: the engines' source is on the site** (DECISIONS.md, "The Maia box's source on the site"). The Maia
  box's was "on request"; now its build writes its complete source beside it (`/engine/maia/maia-box-source.tar.gz`,
  which rebuilds the served files byte for byte; the model is served beside it and its upstream checkpoint pinned).
  Stockfish's credits pointed upstream only; now the exact build's source is served too
  (`/engine/stockfish-source.tar.gz`). Both are linked from Settings, the FAQ and `/licenses/third-party.txt`. Still
  to watch: the Maia archive relies on CSSLab keeping its checkpoint revision public (else we host it).
- Fixed in this audit: the cburnett pieces
  re-sourced under BSD (they came in through chessground's GPL CSS); the fonts' copyright notices and license, and the
  notices for Preact, chess.js and Vite's helper, now ship with the app (`/licenses/third-party.txt`) and are linked
  from Settings and the FAQ.
- **The PyChess knocks (GPL-3.0) are shipped again** (Eric, Oct 12, 2026: "classic PyChess knocks back as the
  default, GPL-3.0, credited"). This audit had removed them; Eric brought them back as the defaults, with close
  variations made from them by `scripts/piece-sounds.py` (GPL-3.0 too). A sound file is data the game plays, not code
  compiled into it, so the GPL covers the files, not the game: the same separate-file reasoning as Stockfish. Each
  file's source and how the variations were made are in `sounds/SOURCES.md`.
- **Fixed Oct 15: the PyChess sounds' source is on the site** (DECISIONS.md, "The PyChess sounds' source on the
  site"). The GPL asks for the variations' corresponding source: the original WAVs (public at PyChess) and the script
  that made them, which lived only in the repository. Now `/sounds/pychess-sounds-source.tar.gz` holds both (with the
  classic mp3s the script levels against, the license and the command), rebuilds the six variations byte for byte, and
  is linked from Settings, the FAQ, `/licenses/third-party.txt` and `sounds/SOURCES.md`, so it holds when the
  repository goes private.
- Fixed in Phase 2 of the board (Oct 12): **chessground (GPL-3.0-or-later)** is gone, its CSS and its wrapper with it:
  every board is the game's own (`packages/app/src/board/`). The board lab and **cm-chessboard** (MIT) went too. The
  built app has no chessground module, class or style left (checked on the live site).
