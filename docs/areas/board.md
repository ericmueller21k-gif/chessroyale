# The board

Lane: the director (every screen draws it; a boss's powers draw over it). How each mode uses it: [crowd.md](crowd.md),
[squads.md](squads.md), [bosses.md](bosses.md).

## How it works today

- **Our own board** (Oct 12, 2026), on every screen that draws one: Crowd, raids, Boss alone, Squads, replays, votes,
  the finals, the God King's moments, Classic, the mini boards and the live window (the tiny boards are an SVG of their
  own). It replaced chessground, which is GPL-3 and doesn't fit a game whose source stays closed: Eric played both side
  by side and couldn't tell them apart. If it ever has to go back, `DECISIONS.md` ("Our own board, the only board")
  says how.
- **What every screen gets** (`components/Board.tsx`): the position, either way up, Boingo's quarter turns
  (`turn`, board-view.ts), the last move and (switched off, as always: `BOARD.checkHighlight`) the check glow, the
  selected square, the move dots and capture rings, tap-tap and drag (touch and mouse), view-only (`small`) and
  whose-turn locking (`interactive`, `moves`), the promotion picker, arrows with labels (power-up hints, the Last
  Stand's, Squads' picks and blocks), square marks (`marks`), Hollow's dark (`dark`, `onDarkTry`), and a knock for
  every move that appears (`components/Board.tsx` plays it).
- **How it behaves** (`board/OwnBoard.tsx`, its pure logic in `board/logic.ts`):
  - **Feel:** a move slides 220 ms on a cubic ease in and out (`SLIDE_MS`); a captured piece fades as the taker slides
    on; a press becomes a drag at 3 px (`DRAG_DISTANCE_PX`), and after a dragged move the next drag starts at once;
    a dragged piece's centre follows the finger; a drop lands at once; a drop where it can't go goes straight back.
    A tap-tap move is made as the second press goes down. A touch on a piece, near one or with one selected doesn't
    scroll the page; one on an empty stretch with nothing selected still can.
  - **A move you make** stays on the board until the game next tells the board anything (as the old board's did): a
    screen that keeps the position (the Crowd, where everyone's picks show as ghosts) sees the piece go back; one that
    plays it keeps it.
  - **Pieces keep their identity** between positions (`follow`): a move slides the piece that moved (castling's rook
    too); a promoted pawn fades and its new piece appears; a new way up or turn of the board, or `animate={false}`,
    puts every piece straight on its square.
  - **Its size:** a whole multiple of 8 device pixels (crisp squares), up to 8 device pixels smaller than the wrap,
    measured without transforms (a board in a turning or jolting row keeps its size) and written on the wrap as
    `--board-width` (read as `--board-size`, styles.css): **everything drawn over the squares sizes and places itself
    in eighths of `--board-size`**, never in % of the wrap.
  - **Its elements and stacking:** `<piece class="white pawn">` (z-index 2; sliding `anim` 8; `dragging` 11; a
    captured one `fading` 1), `<square>` highlights (`last-move`, `selected`, `move-dest`, `oc`, and each `marks` class), arrows in `svg.hb-shapes`
    (see-through, z-index 2) and their labels (`svg.hb-labels`, 9), the coordinates (`.hb-coords`) under the pieces.
    The board's own boxes: `.board.hb` (with `orientation-white`/`-black`), `.hb-container` (exactly the board),
    `.hb-board` (the squares). Nothing in it makes a stacking layer of its own.
- **The pieces** are the cburnett set (Colin M.L. Burnett) from Wikimedia Commons under the BSD licence
  (`board/pieces/`: the files, `LICENSE.txt`, `SOURCES.md`), drawn by `board/pieces.css` on the board, on anything
  else drawn with them (a layer marked `.hb-pieces`: ghosts, the bounce, the split, the Last Stand's piece, the God
  King's targets, avatars; it also gives their pieces the board's base: a square each, z-index 2, never taking a tap)
  and in the promotion picker. The black pieces' details are toned to the light grey the game always showed.
- **What overlays may rely on** (`board/dom.ts`): `BOARD_SQUARES` / `boardSquares(el)` for the squares' box (the God
  King's strike, Lights out's taps), `boardPieces(wrap)` for the piece elements and their real squares (Sawyer's split
  pawns).

## Where the code is

| What | Where |
| --- | --- |
| The board, and the knock for each move | `packages/app/src/components/Board.tsx`, `board/OwnBoard.tsx` |
| Its logic (squares, the size, taps and drags, which piece slides where, the dots, arrows) | `packages/app/src/board/logic.ts`; props `board/types.ts` |
| The pieces, and the base for anything drawn with them | `packages/app/src/board/pieces/` (files, licence, sources), `board/pieces.css` |
| Its styles | `styles.css`, "The board" (after `.board-wrap`) |
| A turned board's squares and coordinates | `packages/app/src/board-view.ts` |
| What overlays look up | `packages/app/src/board/dom.ts` |

## Settings

`BOARD` (`checkHighlight`) in settings.ts.

## Tests and tools

- Unit: `packages/app/test/board-logic.test.ts` (every square's place at every orientation and turn, against
  `squareXY`; the square under a point; the board's size; the 3 px drag threshold; taps, tap-tap, drags, drops and
  what each lets go of; the move dots, a power's moves and Hollow's dark; which piece slides where, a capture's fade,
  castling, a promotion; arrows), `board-view.test.ts`, `pieces.test.ts` (the pieces' files, sources and licence).
- e2e: every test that touches the board finds its parts through `BOARD_SEL` in `e2e/helpers.ts`.
- Frames: every `npm run frames:*` script.

## Rules for this area (from `.claude/LESSONS.md`)

- Anything drawn over the squares sizes and places itself in eighths of `--board-size`, never % of the wrap.
- Board coordinates sit inside their edge squares, either way up and turned; `expectCoordsInSquares` measures them.
- Anything that draws what a player sees on a screen's first frame is set up in a layout effect (the board's size is).
- Never change what the board draws (its way up, its size) while a transform is on it or an ancestor: animate, then
  change it once the transform is gone. (The board measures its size without transforms, but the rule stands.)
- Watch any board, move or animation change frame by frame with real taps, the plain move included
  (`npm run frames:boss`).
