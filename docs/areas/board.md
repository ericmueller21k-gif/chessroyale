# The board

Lane: the director (every screen draws it; a boss's powers draw over it). How each mode uses it: [crowd.md](crowd.md),
[squads.md](squads.md), [bosses.md](bosses.md).

## How it works today

- **Two boards, one switch** (Oct 12, 2026): the game is replacing chessground (GPL-3, which doesn't fit a game whose
  source stays closed) with a board of its own. `BOARD.impl` in settings.ts says which every screen draws:
  `"chessground"` (today's default) or `"own"`. Both take the same props (`board/types.ts`) and look and feel the same:
  Eric tried both side by side in the board lab and couldn't tell them apart.
  - **Admins** switch their own device in Settings → Testing (admins) → "Our own board".
  - **Any device:** `?board=own` in the address (or `?board=cg`; `?board=default` forgets the choice). It's kept on the
    device (`brc.board`), so a link works through every screen. A board keeps the one it was made with; the next
    screen's board draws the new choice.
  - **Tests:** `VITE_BOARD=own npm run e2e` builds with our board as the default and runs the whole suite on it.
- **What every screen gets** (`components/Board.tsx`, the switch): the position, either way up, Boingo's quarter turns
  (`turn`, board-view.ts), the last move and (switched off, as always: `BOARD.checkHighlight`) the check glow, the
  selected square, the move dots and capture rings, tap-tap and drag (touch and mouse), view-only (`small`) and
  whose-turn locking (`interactive`, `moves`), the promotion picker, arrows with labels (power-up hints, the Last
  Stand's, Squads' picks and blocks), square marks (`marks`), Hollow's dark (`dark`, `onDarkTry`), and a knock for
  every move that appears (the switch plays it, for either board).
- **Our board** (`board/OwnBoard.tsx`, its pure logic in `board/logic.ts`):
  - **Feel:** a move slides 220 ms on a cubic ease in and out (`SLIDE_MS`); a captured piece fades as the taker slides
    on; a press becomes a drag at 3 px (`DRAG_DISTANCE_PX`), and after a dragged move the next drag starts at once;
    a dragged piece's centre follows the finger; a drop lands at once; a drop where it can't go goes straight back.
    A tap-tap move is made as the second press goes down. A touch on a piece, near one or with one selected doesn't
    scroll the page; one on an empty stretch with nothing selected still can.
  - **A move you make** stays on the board until the game next tells the board anything (as chessground's did): a
    screen that keeps the position (the Crowd, where everyone's picks show as ghosts) sees the piece go back; one that
    plays it keeps it.
  - **Pieces keep their identity** between positions (`follow`): a move slides the piece that moved (castling's rook
    too); a promoted pawn fades and its new piece appears; a new way up or turn of the board, or `animate={false}`,
    puts every piece straight on its square.
  - **Its size:** a whole multiple of 8 device pixels (crisp squares), up to 8 device pixels smaller than the wrap,
    measured without transforms (a board in a turning or jolting row keeps its size) and written on the wrap as
    `---cg-width` (read as `--cg-size`, styles.css): **everything drawn over the squares sizes and places itself in
    eighths of `--cg-size`**, never in % of the wrap, on either board.
  - **The same elements and stacking as before,** so everything drawn over the board works unchanged: `<piece
    class="white pawn">` (z-index 2; sliding `anim` 8; `dragging` 11; a captured one `fading` 1), `<square>`
    highlights (`last-move`, `selected`, `move-dest`, `oc`, and each `marks` class), arrows in `svg.hb-shapes`
    (see-through, z-index 2) and their labels (`svg.hb-labels`, 9), the coordinates (`.hb-coords`) under the pieces.
    The board's own boxes: `.board.hb` (with `orientation-white`/`-black`), `.hb-container` (exactly the board),
    `.hb-board` (the squares). Nothing in it makes a stacking layer of its own.
- **The pieces** are the cburnett set (Colin M.L. Burnett) from Wikimedia Commons under the BSD licence
  (`board/pieces/`: the files, `LICENSE.txt`, `SOURCES.md`), drawn by `board/pieces.css` for both boards, everything
  drawn over them, and the promotion picker (which showed empty buttons before, Oct 12: chessground's art was only for
  its own board). The black pieces' details are toned to the light grey the game always showed.
- **What overlays may rely on** (`board/dom.ts`): `BOARD_SQUARES` / `boardSquares(el)` for the squares' box (the God
  King's strike, Lights out's taps), `boardPieces(wrap)` for the piece elements and their squares (Sawyer's split
  pawns). Never one board's own element names.
- **The board lab** (`/boardlab`): `?board=cg` and `?board=own` are the game's two real boards as the game sets them up;
  `?board=cm` is cm-chessboard, for comparison. Throwaway: remove or admin-gate before a public launch.

## Where the code is

| What | Where |
| --- | --- |
| The switch (which board; the knock) | `packages/app/src/components/Board.tsx`, `board/impl.ts`, `BOARD` in `packages/core/src/settings.ts` |
| Our board | `packages/app/src/board/OwnBoard.tsx`; its logic `board/logic.ts`; props `board/types.ts` |
| Chessground's (until it goes) | `packages/app/src/components/CgBoard.tsx`, its CSS imported in `main.tsx` |
| The pieces | `packages/app/src/board/pieces/` (files, licence, sources), `board/pieces.css` |
| Our board's styles | `styles.css`, "Our own board" (beside chessground's coordinates) |
| A turned board's squares | `packages/app/src/board-view.ts` |
| What overlays look up | `packages/app/src/board/dom.ts` |
| The admin switch | `packages/app/src/screens/Settings.tsx` ("Testing (admins)") |

## Settings

`BOARD` (`impl`, `checkHighlight`) in settings.ts.

## Tests and tools

- Unit: `packages/app/test/board-logic.test.ts` (every square's place at every orientation and turn, against
  `squareXY`; the square under a point; the board's size; the 3 px drag threshold; taps, tap-tap, drags, drops and
  what each lets go of; the move dots, a power's moves and Hollow's dark; which piece slides where, a capture's fade,
  castling, a promotion; arrows; the switch), `board-view.test.ts`.
- e2e: the whole suite runs on either board (`VITE_BOARD=own npm run e2e` for ours). Selectors that match both boards
  are in `e2e/helpers.ts` (`BOARD_SEL`): use them, never one board's own names.
- Frames: every `npm run frames:*` script works on either board (`VITE_BOARD=own npm run frames:… -- …`).
- The lab's measurements (slide, easing, threshold, lift, trail, drop, illegal drop, capture fade, sound, first board):
  run the lab measuring script against `/boardlab?board=cg` and `?board=own` (DECISIONS.md, "Our own board").

## Rules for this area (from `.claude/LESSONS.md`)

- Anything drawn over the squares sizes and places itself in eighths of `--cg-size`, never % of the wrap.
- Board coordinates sit inside their edge squares, either way up and turned; `expectCoordsInSquares` measures them.
- Anything that draws what a player sees on a screen's first frame is set up in a layout effect (the board's size is).
- Never change what the board draws (its way up, its size) while a transform is on it or an ancestor: animate, then
  change it once the transform is gone. (Our board measures its size without transforms, but the rule stands.)
- Watch any board, move or animation change frame by frame with real taps, the plain move included
  (`npm run frames:boss`), on both boards while there are two.
