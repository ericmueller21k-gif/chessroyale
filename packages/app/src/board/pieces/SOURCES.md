# The chess pieces: where each file comes from

The game's pieces (the board's, and every piece drawn over it or elsewhere) are the "cburnett" set by Colin M.L. Burnett,
the same drawings the game has always shown (they used to come in through chessground's CSS, which is GPL-3; Oct 12,
2026 they come from their own source instead). Each file is taken from Wikimedia Commons, where the author
offers it under a choice of the GFDL, the **BSD license** or the GPL (`{{self|GFDL|migration=relicense|BSD|GPL}}` on
each file's page). HunChess uses them under the BSD license (Commons' `{{BSD}}`: the 3-clause BSD license), whose text is
in `LICENSE.txt` beside this file. The credit is in the app (Settings, and the FAQ's "Credits and licenses").

Drawn by `pieces.css` (`piece.<color>.<kind>`), inlined into the stylesheet by the build.

**Changed for the game (one color):** in the five black pieces with light details (bishop, knight, rook, queen,
king), the details' white (`#ffffff`) is toned to a light gray (`#ececec`), as the game has always drawn them (measured
against the old board, Oct 12, 2026: otherwise the same). Nothing else is changed; the white pieces and the black pawn
are byte for byte as downloaded. The SHA-1 below is of the file as downloaded.

| File | Piece | Commons page | File URL (downloaded Oct 12, 2026) | SHA-1 (as downloaded) |
| --- | --- | --- | --- | --- |
| `cburnett/Chess_plt45.svg` | white pawn | https://commons.wikimedia.org/wiki/File:Chess_plt45.svg | https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg | 09d59e2770fcee23722ac53b26e875f76d2c1eb1 |
| `cburnett/Chess_pdt45.svg` | black pawn | https://commons.wikimedia.org/wiki/File:Chess_pdt45.svg | https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg | 0a6d2f3dc6327a02ca591bc489d701fbff228138 |
| `cburnett/Chess_nlt45.svg` | white knight | https://commons.wikimedia.org/wiki/File:Chess_nlt45.svg | https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg | 3a2253429c0e39863b3f5ecf447209dccecdc337 |
| `cburnett/Chess_ndt45.svg` | black knight | https://commons.wikimedia.org/wiki/File:Chess_ndt45.svg | https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg | 3c79cbbda76bcf1d4e4062cef6dd3b58a250a562 |
| `cburnett/Chess_blt45.svg` | white bishop | https://commons.wikimedia.org/wiki/File:Chess_blt45.svg | https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg | 35dd477dc22636bfcc559a01f75b00369205ffda |
| `cburnett/Chess_bdt45.svg` | black bishop | https://commons.wikimedia.org/wiki/File:Chess_bdt45.svg | https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg | da6dd1b5ef629bacebbd2ce26c7d81ba8a205587 |
| `cburnett/Chess_rlt45.svg` | white rook | https://commons.wikimedia.org/wiki/File:Chess_rlt45.svg | https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg | 126b7779885b87e87acc713474587732711bc8d3 |
| `cburnett/Chess_rdt45.svg` | black rook | https://commons.wikimedia.org/wiki/File:Chess_rdt45.svg | https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg | bd0e866f1e6da8e3d6f9c0b356b60fc58391aff6 |
| `cburnett/Chess_qlt45.svg` | white queen | https://commons.wikimedia.org/wiki/File:Chess_qlt45.svg | https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg | e638eb28ec25007b9f8fac8476bdf6ae1fc5a0ee |
| `cburnett/Chess_qdt45.svg` | black queen | https://commons.wikimedia.org/wiki/File:Chess_qdt45.svg | https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg | ed72e75b7bdbf880a3c9bee053c8786cfab8bdb9 |
| `cburnett/Chess_klt45.svg` | white king | https://commons.wikimedia.org/wiki/File:Chess_klt45.svg | https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg | 2c7569b837971207e40f7148e2b2086aaf8e4bbd |
| `cburnett/Chess_kdt45.svg` | black king | https://commons.wikimedia.org/wiki/File:Chess_kdt45.svg | https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg | b1165ef85a3df6f1af2549ab0af78ab21b540e8a |

The author: Colin M.L. Burnett (https://commons.wikimedia.org/wiki/User:Cburnett), 2006 (each page dates its file Dec 27,
2006). Checked Oct 12, 2026: no scripts or outside references in any file (plain paths and groups).
