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
  Stand's, Squads' picks and blocks), square marks (`marks`), Hollow's dark (`dark`, `onDarkTry`), a move tried that
  chess allows but `moves` doesn't (`onRefused`: a boss power stops it, so the screen can say why; `refusedMove` in
  logic.ts; Oct 17), and a knock for every move that appears (`components/Board.tsx` plays it).
- **How it behaves** (`board/OwnBoard.tsx`, its pure logic in `board/logic.ts`):
  - **Feel:** a move slides 220 ms on a cubic ease in and out (`SLIDE_MS`); a captured piece fades as the taker slides
    on; a press becomes a drag at 3 px (`DRAG_DISTANCE_PX`), and after a dragged move the next drag starts at once;
    a dragged piece's center follows the finger; a drop lands at once; a drop where it can't go goes straight back
    (a legal one a power stops, by a drop or a tap-tap, tells the screen: `onRefused`).
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
  - **When it draws** (Oct 14, 2026; DECISIONS.md, "The board draws its pieces only when they change"): the board is
    two parts. `OwnBoard` is the wrap, what the screen draws over the board (`children`, under the `BoardTurn`
    context) and the promotion picker; it's drawn again whenever the screen is (a boss screen draws every frame while an
    effect plays). Its drawing layer (`BoardLayer`: the squares and highlights, the pieces, the arrows, the coordinates,
    taps and drags) is drawn again only when what it shows changes: `boardInputs` (logic.ts) lists those, as plain
    values (the position, the way up and turn, the last move, the moves allowed, the arrows, the marks, the dark,
    `interactive`, `small`, `animate`); lists and objects count by what's in them, so a screen building fresh ones each
    time changes nothing. Or by itself: a tap, a drag, a slide or a fade ending (its own timer), a move you made. A move
    you made still goes back as before: the first time the screen hands the board anything new (`arrows` by identity
    too), it's let go and the layer draws again. The layer counts its drawings on `.hb-board` (`hbDraws`, read by
    `e2e/perf.spec.ts`).
  - **Its elements and stacking:** `<piece class="white pawn">` (z-index 2; sliding `anim` 8; `dragging` 11; a
    captured one `fading` 1), `<square>` highlights (`last-move`, `selected`, `move-dest`, `oc`, and each `marks` class), arrows in `svg.hb-shapes`
    (see-through, z-index 2) and their labels (`svg.hb-labels`, 9), the coordinates (`.hb-coords`) under the pieces.
    The board's own boxes: `.board.hb` (with `orientation-white`/`-black`), `.hb-container` (exactly the board),
    `.hb-board` (the squares). Nothing in it makes a stacking layer of its own.
- **Chess960's castling** (DECISIONS.md, "Chess960's rules"), only for a Chess960 position (its FEN names castling
  rooks by file): the move is written as the king taking its own rook (e1h1), so the king dragged or tapped onto its
  rook castles; the king dragged onto the square it castles to (g1 or c1, as in normal chess) castles too wherever that
  can't mean anything else (the king isn't there already, its rook isn't standing there, no ordinary king move goes
  there). The dots show both. `destsFor` adds those squares and `gestureMoves` turns a gesture into its move
  (`board/logic.ts`); a normal FEN gets exactly what it always did. Both pieces slide (`follow`), swaps included, and
  the sound is castling's (`move-sound.ts`).
- **Four boards in one square** (the Hidden Boss's phase 2, `screens/Recluse2.tsx`): each board is an ordinary board in
  a cell of the square (`.rc-stage`; its board-wrap forced to the cell's width, since `.board-area .board-wrap` sizes
  boards to the screen). The phase change grows four full boards out of quarters with a transform and a clip only, so
  each board keeps the size it measured; the shuffle is the board's own slide from one FEN to the next.
- **The pieces** are the cburnett set (Colin M.L. Burnett) from Wikimedia Commons under the BSD license
  (`board/pieces/`: the files, `LICENSE.txt`, `SOURCES.md`), drawn by `board/pieces.css` on the board, on anything
  else drawn with them (a layer marked `.hb-pieces`: ghosts, the bounce, the split, the Last Stand's piece, the God
  King's targets, avatars; it also gives their pieces the board's base: a square each, z-index 2, never taking a tap)
  and in the promotion picker. The black pieces' details are toned to the light gray the game always showed.
- **What overlays may rely on** (`board/dom.ts`): `BOARD_SQUARES` / `boardSquares(el)` for the squares' box (the God
  King's strike, Lights out's taps), `boardPieces(wrap)` for the piece elements and their real squares (Sawyer's split
  pawns).

## Where the code is

| What | Where |
| --- | --- |
| The board, and the knock for each move | `packages/app/src/components/Board.tsx`, `board/OwnBoard.tsx` |
| Its logic (squares, the size, taps and drags, which piece slides where, the dots, arrows) | `packages/app/src/board/logic.ts`; props `board/types.ts` |
| The pieces, and the base for anything drawn with them | `packages/app/src/board/pieces/` (files, license, sources), `board/pieces.css` |
| Its styles | `styles.css`, "The board" (after `.board-wrap`) |
| A turned board's squares and coordinates | `packages/app/src/board-view.ts` |
| What overlays look up | `packages/app/src/board/dom.ts` |

## Settings

`BOARD` (`checkHighlight`) in settings.ts.

## Tests and tools

- Unit: `packages/app/test/board-logic.test.ts` (when it draws again: the same board from fresh lists and handlers
  doesn't, every input it shows does; every square's place at every orientation and turn, against
  `squareXY`; the square under a point; the board's size; the 3 px drag threshold; taps, tap-tap, drags, drops and
  what each lets go of; the move dots, a power's moves and Hollow's dark; which piece slides where, a capture's fade,
  castling, a promotion; Chess960's castling: the dots, both gestures, a swap, the king or rook already on its square,
  a screen's limited moves, tap and drag, both pieces sliding, normal castling untouched; arrows), `board-view.test.ts`,
  `pieces.test.ts` (the pieces' files, sources and license), `refused.test.ts` (a legal move a power refuses: found
  for a capture or a promotion, never for an allowed one or a turn nothing limits; the dock's words for it).
- e2e: every test that touches the board finds its parts through `BOARD_SEL` in `e2e/helpers.ts`. `e2e/perf.spec.ts`
  checks the board isn't drawn every frame while Jefferson's Roman candle plays over it (`hbDraws`).
  `e2e/castling.spec.ts` castles by tap-tap and drag, normal chess and Chess960 (both gestures).
- Perf: `npm run perf:boss -- <dir> <boss id> [phone|desktop|both] [moves] [power]` reports each boss effect's frames
  and long tasks (`fxBy`); `PERF_DIST`, `PERF_NO_BUILD` compare two builds.
- Frames: every `npm run frames:*` script.

## Rules for this area (from `.claude/LESSONS.md`)

- **The rendering rule:** the board's pieces are drawn only when the position, the way up or turn, the size or the
  highlights change, never once a frame. Anything that animates over the board does it in its own layer: a child of
  `Board` (it may take `now` and draw every frame), one of `BoardEffects`' shared canvas (bosses.md), or a CSS
  animation or transform. Never animate by handing the board a new value each frame (a `fen`, `lastMove`, `marks`,
  `arrows` or `animate` that changes every frame redraws every piece every frame). A new prop the board draws from goes
  in `boardInputs` (and its test in `board-logic.test.ts`), or the board won't show it changing.

- Anything drawn over the squares sizes and places itself in eighths of `--board-size`, never % of the wrap.
- Board coordinates sit inside their edge squares, either way up and turned; `expectCoordsInSquares` measures them.
- The line above the board keeps one height through a match: Classic's opening name is one line, cut with "…" when
  long (`.opening-title`), since a wrapped name moved the board down a line as a round changed boards
  (`docs/decisions/2026-10-15-flaky-e2e-batch.md`; `crowd.spec.ts` checks the library's longest name).
- Anything that draws what a player sees on a screen's first frame is set up in a layout effect (the board's size is).
- Never change what the board draws (its way up, its size) while a transform is on it or an ancestor: animate, then
  change it once the transform is gone. (The board measures its size without transforms, but the rule stands.)
- Watch any board, move or animation change frame by frame with real taps, the plain move included
  (`npm run frames:boss`).
