# Licences: everything third-party the app ships

The game's source isn't published (Eric, Oct 11, 2026), so nothing GPL, AGPL, LGPL, non-commercial or share-alike may be
compiled into the app's own code. This is the full list of what reaches a player's device, from the build's own module
list (every module in every built chunk) and every file in `packages/app/public/`, with how each is credited. Audited
Oct 12, 2026; update it in the same PR as anything that adds or removes a third-party piece.

## Compiled into the app's code (the built JS and CSS)

| What | Version | Licence | Where | Credit / notice |
| --- | --- | --- | --- | --- |
| The game's own code (`packages/app`, `core`, `chess`) | | HunChess's own | every chunk | |
| Preact | 10.29.8 | MIT | main chunk | `/licenses/third-party.txt`, linked from Settings and the FAQ |
| chess.js | 1.4.0 | BSD-2-Clause | main chunk (its licence comment kept in it too) | `/licenses/third-party.txt` |
| Vite's runtime helper (module preloading) | 5.4.21 | MIT | main chunk | `/licenses/third-party.txt` |
| The cburnett pieces (Colin M.L. Burnett) | Commons, 2006 | BSD (3-clause), chosen from the author's GFDL / BSD / GPL | the CSS (inlined) | `/licenses/pieces.txt`, Settings and the FAQ; `packages/app/src/board/pieces/SOURCES.md` |

Nothing else: the build's module list has no other package (`npm run build`; the audit script lists each module's
package, version, licence and size).

## Files the app serves (`packages/app/public/`)

| What | Licence | Credit / notice |
| --- | --- | --- |
| Stockfish 19 (stockfish.js lite single-threaded WebAssembly build, npm `stockfish` 19.0.0), `engine/` | GPL-3.0 | A separate program in a Web Worker, never compiled into the game. Its licence: `/engine/COPYING.txt`; credited in Settings and the FAQ with its source. |
| The Maia box (Maia-3 by CSSLab, onnxruntime-web, chess.js), `engine/maia/` | AGPL-3.0 (its bundled parts MIT and BSD) | A separate program (Eric's decision, Oct 11): `/engine/maia/LICENSE.txt`, `NOTICE.txt` (with onnxruntime's and chess.js's notices); credited in Settings and the FAQ; its source on request |
| Fonts: Archivo, Archivo Black, Press Start 2P, `fonts/` | SIL OFL 1.1 | `fonts/LICENSE.md`; each copyright notice and the licence in `/licenses/third-party.txt` |
| Piece sounds, `sounds/pieces/` | CC0 1.0 (Kenney's *Impact Sounds*) and ours | `sounds/SOURCES.md` (all wood since Oct 12; the PyChess GPL knocks are gone) |
| The God King's, banner and menu sounds, `sounds/god-king/`, `banner/`, `menu/` | CC0 1.0 (Juhani Junkala, HaelDB, wintuh) and ours | each folder's `CREDITS.md` (CC0: no credit owed) |
| Icons, `icons/`; the landing page's demo video and still, `media/`; bot-match replays, `replays/` | ours (made for the game: the icons, a recording of the game, its own bot matches) | |
| The pieces' and third-party licences, `licenses/` | (the notices themselves) | |

## Flagged

- **Maia's source "on request"**: AGPL-3.0 asks that users who interact with it over a network be offered its source;
  the box runs on the player's own device, and Eric decided how it's offered (DECISIONS.md, the Maia prototype). Not
  changed here.
- Fixed in this audit: the PyChess knocks (GPL-3) removed (all-wood CC0 sounds instead); the cburnett pieces
  re-sourced under BSD (they came in through chessground's GPL CSS); the fonts' copyright notices and licence, and the
  notices for Preact, chess.js and Vite's helper, now ship with the app (`/licenses/third-party.txt`) and are linked
  from Settings and the FAQ.
- Fixed in Phase 2 of the board (Oct 12): **chessground (GPL-3.0-or-later)** is gone, its CSS and its wrapper with it:
  every board is the game's own (`packages/app/src/board/`). The board lab and **cm-chessboard** (MIT) went too. The
  built app has no chessground module, class or style left (checked on the live site).
