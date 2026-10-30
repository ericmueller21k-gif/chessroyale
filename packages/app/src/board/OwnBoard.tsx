/**
 * HunChess's board (docs/areas/board.md): plain elements, CSS transitions and pointer events. It replaced chessground
 * (GPL-3) on Oct 12, 2026, with the same look and feel, measured side by side in the board lab: 220 ms slides on a
 * cubic ease in and out, a captured piece fading, a 3 px drag threshold, a dropped piece landing at once and an illegal
 * one going straight back, the same dots, rings, highlights, arrows and coordinates. Its behavior, where the game
 * relies on it:
 * - Taps and drags: a tap selects a piece of the side to move (its dots show), a second tap on a dot moves it (as the
 *   press goes down); or drag it. A move you make stays on the board until the game next tells the board anything
 *   (`local`): a game that keeps the position (the Crowd) sees it go back, one that plays it keeps it.
 * - Pieces keep their identity between positions, so a move slides the piece that moved (castling's rook too).
 * - The board is drawn a whole multiple of 8 device pixels wide (crisp squares) and writes that size on the wrap
 *   (--board-width, read as --board-size by everything drawn over the squares, styles.css).
 * - Boingo's quarter turns are built in: every square is drawn where the turned board shows it (board-view.ts), taps
 *   are turned back, and the coordinates name the real squares.
 * - Hollow's dark: a dark square tapped is selected (no piece lifted, no dots); any attempt touching the dark goes to
 *   onDarkTry unchecked.
 * - chess.com's habits (docs/decisions/2026-10-28-arrows-and-premoves.md): with a mouse, a right-drag draws an arrow and a
 *   right-click colors a square (Ctrl, Alt and Shift for other colors), a left-click clears them, and the browser's menu
 *   never opens over the board; and premoves, on a board whose screen opts in (`premove`): your piece moved ahead while
 *   it's the other side's turn, played the moment your turn comes (board/yours.ts keeps them, by the game's key).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { BOARD } from "@chessroyale/core";
import { applyMove, inCheck, isChess960Fen, pieceAt, sideToMove, touchesDark } from "@chessroyale/chess";
import { BoardTurn, coordLabel, type QuarterTurn } from "../board-view.ts";
import { BRUSHES, FILES, NO_MARKS, SLIDE_MS, arrowColor, boardInputs, boardSize, cellOf, destsFor, drawArrows, follow, gestureMoves, highlightColor, marksEmpty, pieceClass, pieceCloseTo, positionKey, premoveDests, premovePieces, premoveQueueTurn, premoveSquares, pressDown, pressMove, pressUp, readPieces, refusedMove, slidePiece, squareAtPoint, stillRunning, toggleArrow, toggleSquare, userArrowShape, USER_ARROW, type BoardPiece, type Box, type PieceCode, type Premove, type Press, type PressBoard } from "./logic.ts";
import type { BoardProps } from "./types.ts";
import { boardMarksOn, premovesOn } from "../prefs.ts";
import { addPremove, dropYours, onYours, setMarks, setQueue, yours } from "./yours.ts";

let nextPieceId = 1;
let boards = 0;
const NONE: readonly string[] = [];
const NO_QUEUE: readonly Premove[] = [];

/** A piece's place on the board: its column and row as a share of its own size (a square), so any size fits. */
const place = (square: string, orientation: "white" | "black", turn: QuarterTurn) => {
  const { col, row } = cellOf(square, orientation, turn);
  return `translate(${col * 100}%, ${row * 100}%)`;
};

interface Track {
  key: string | null;
  pieces: BoardPiece[];
  fading: { piece: BoardPiece; until: number }[];
  /** Pieces sliding (drawn over the others meanwhile), until when. */
  sliding: Map<number, number>;
  orientation: string;
  turn: QuarterTurn;
  /** Alfil's elephants among them (or fading), by piece id: drawn with their own art. */
  elephants: Set<number>;
}

/**
 * Whether the side to move is in check on the position the board draws. A position drawn for a moment that isn't one chess
 * can read (Smudgy's revealed rook, still a pawn on the back rank until the paint drips off it) has no check to ring.
 */
function inCheckDrawn(fen: string): boolean {
  try {
    return inCheck(fen);
  } catch {
    return false;
  }
}

/** A move you made, shown until the game next tells the board anything new. */
type Local = { pieces: Map<string, PieceCode>; last: [string, string] };
/** A pawn taken to its last rank, its piece still to pick (`premove`: one moved ahead, kept under `key`). */
type Promotion = { from: string; to: string; dark?: boolean; premove?: { key: string; side: "w" | "b"; many: boolean } };

/** What the board's drawing layer tells the board around it (the same object for the board's life). */
interface BoardActs {
  move(uci: string, how?: { premove?: boolean }): void;
  darkTry(uci: string): void;
  /** A legal move that `moves` doesn't allow, tried: the board's onRefused (none: nothing to work out). */
  refused: { current?: (uci: string) => void };
  /** A move the board offers that the game refuses (BoardProps.stopped): it goes to `refused` instead of `move`. */
  stopped: { current?: (uci: string) => boolean };
  promote(p: Promotion): void;
  selectDark(sq: string | null): void;
  /** The move you made, while it's shown (OwnBoard clears it). */
  local: { current: Local | null };
}

/**
 * The board: its wrap, what the screen draws over it (`children`), the promotion picker, and its drawing layer
 * (BoardLayer: the squares, pieces, highlights, arrows and coordinates). A screen that draws every frame (a boss's
 * effect playing over the board) draws this every frame too, so it stays cheap: the drawing layer is drawn again only
 * when what it shows changes (`boardInputs` in logic.ts), or by itself (a tap, a drag, a slide or a fade ending).
 */
export function OwnBoard(props: BoardProps) {
  const { fen, orientation, lastMove, interactive, moves, onMove, arrows, small, animate = true, children, marks, dark, onDarkTry, turn = 0, elephants, decor, premove } = props;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onDarkRef = useRef(onDarkTry);
  onDarkRef.current = onDarkTry;
  const onRefusedRef = useRef(props.onRefused);
  onRefusedRef.current = props.onRefused;
  const stoppedRef = useRef(props.stopped);
  stoppedRef.current = props.stopped;
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  // Hollow's dark: a dark square tapped (selected without picking anything up).
  const [darkSel, setDarkSel] = useState<string | null>(null);
  const darkOn = !!interactive && !!dark?.length && !!onDarkTry;

  // A move you made, shown until the game next tells the board anything new (any of these changing; `arrows` by
  // identity), as before. Clearing it draws the layer again.
  const local = useRef<Local | null>(null);
  const cleared = useRef(0);
  const deps = [fen, orientation, lastMove, interactive, arrows, animate, moves?.join(), JSON.stringify(marks ?? null), darkOn, dark?.join(), darkSel, turn];
  const seen = useRef(deps);
  if (seen.current.length !== deps.length || seen.current.some((d, i) => d !== deps[i])) {
    seen.current = deps;
    if (local.current) {
      local.current = null;
      cleared.current++;
    }
  }
  // A new position or the dark changing: no dark square stays selected.
  useLayoutEffect(() => setDarkSel(null), [fen, dark?.join(), interactive]);

  const acts = useMemo<BoardActs>(() => ({ move: (uci, how) => onMoveRef.current?.(uci, how), darkTry: (uci) => onDarkRef.current?.(uci), refused: onRefusedRef, stopped: stoppedRef, promote: setPromotion, selectDark: setDarkSel, local }), []);
  // (The same element while nothing it shows has changed: Preact leaves it, and everything in it, alone.)
  const layer = useMemo(
    () => <BoardLayer fen={fen} orientation={orientation} lastMove={lastMove} interactive={interactive} moves={moves} arrows={arrows} small={small} animate={animate} marks={marks} dark={dark} darkOn={darkOn} darkSel={darkSel} turn={turn} elephants={elephants} decor={decor} premove={premove} acts={acts} />,
    [...boardInputs(props), darkOn, darkSel, cleared.current],
  );
  const promoWhite = promotion?.premove ? promotion.premove.side === "w" : sideToMove(fen) === "w";

  // (The browser's menu never opens over the board, nor over what the screen draws on it: a right-click there is yours.)
  return (
    <div class={`board-wrap ${small ? "board-small" : ""}`} data-dark-sel={darkSel ?? undefined} data-turn={turn || undefined} onContextMenu={(e) => e.preventDefault()}>
      {layer}
      <BoardTurn.Provider value={turn}>{children}</BoardTurn.Provider>
      {promotion && (
        <div class="promo" role="dialog" aria-label="Promote to">
          {(["q", "r", "b", "n"] as const).map((p) => (
            <button
              type="button"
              key={p}
              class={`promo-piece ${promoWhite ? "white" : "black"} ${p}`}
              onClick={() => {
                const pr = promotion;
                setPromotion(null);
                const uci = pr.from + pr.to + p;
                if (pr.premove) addPremove(pr.premove.key, { from: pr.from, to: pr.to, promo: p }, pr.premove.many);
                else if (pr.dark) onDarkRef.current?.(uci);
                else if (stoppedRef.current?.(uci)) onRefusedRef.current?.(uci);
                else onMoveRef.current?.(uci);
              }}
              aria-label={{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[p]}
            >
              <piece class={`${promoWhite ? "white" : "black"} ${{ q: "queen", r: "rook", b: "bishop", n: "knight" }[p]}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type LayerProps = Omit<BoardProps, "children" | "silent" | "onMove" | "onDarkTry" | "onRefused"> & { darkOn: boolean; darkSel: string | null; acts: BoardActs };

/**
 * The board's drawing: the squares and their highlights, the pieces (sliding, fading, following a drag), the arrows and
 * the coordinates, and the taps and drags on them. Drawn again only when what it shows changes (see OwnBoard).
 */
function BoardLayer({ fen, orientation, lastMove, interactive, moves, arrows, small, animate = true, marks, dark, darkOn, darkSel, turn = 0, elephants, decor, premove, acts }: LayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const redraw = () => setTick((n) => n + 1);
  const darkList = darkOn ? dark! : NONE;
  const uid = useMemo(() => `hb${++boards}`, []);
  const { local, selectDark: setDarkSel, promote: setPromotion } = acts;
  // Your arrows, highlights and premoves (board/yours.ts): kept under the game's key when the screen gives one (they stay
  // through its other screens), else under this board's own, forgotten as it goes. Drawn again as they change.
  const ykey = premove?.key ?? `board:${uid}`;
  useEffect(() => onYours((k) => k === ykey && redraw()), [ykey]);
  useEffect(() => () => dropYours(`board:${uid}`), []);
  const mine = yours(ykey);
  const queue = premove && !small ? mine.queue : NO_QUEUE;
  // (How many times it has drawn, kept on its squares' element: e2e/perf.spec.ts checks that a boss's effect playing
  // over the board doesn't draw it again every frame.)
  useLayoutEffect(() => {
    const el = boardRef.current as (HTMLElement & { hbDraws?: number }) | null;
    if (el) el.hbDraws = (el.hbDraws ?? 0) + 1;
  });

  // The next change of position lands at once (a dropped piece), rather than sliding.
  const landNext = useRef(false);

  const propPieces = useMemo(() => readPieces(fen), [fen]);
  // (With premoves waiting, each piece moved ahead stands on its new square.)
  const base = local.current?.pieces ?? propPieces;
  const shown = queue.length ? premovePieces(base, queue) : base;
  const shownLast = local.current ? local.current.last : lastMove ? ([lastMove.slice(0, 2), lastMove.slice(2, 4)] as [string, string]) : null;
  const turnColor = sideToMove(fen);
  const canAct = !!interactive && !small && !local.current;
  // Premoves: your pieces moved ahead while the other side is to move (a screen that opts in; Settings → Board).
  const premoving = !!premove && !premove.watch && !small && !local.current && turnColor !== premove.side && premovesOn();
  const castling = isChess960Fen(fen) ? "" : (fen.split(" ")[2] ?? "");
  const dests = useMemo(() => (interactive && !small ? destsFor(fen, moves, darkList) : new Map<string, string[]>()), [fen, interactive, small, moves?.join(), darkList.join()]);

  // ---------------- Which piece is which ----------------
  const track = useRef<Track>({ key: null, pieces: [], fading: [], sliding: new Map(), orientation, turn, elephants: new Set() });
  const tr = track.current;
  // (A new way up or a new turn of the board: every piece jumps to its new square, never flies there.)
  const turned = tr.orientation !== orientation || tr.turn !== turn;
  let jump = !animate || turned;
  // (Pieces put straight on new squares in this drawing: the browser must take them before anything slides again.)
  let jumped = turned;
  const key = positionKey(shown);
  const now = performance.now();
  if (tr.key !== key) {
    const first = tr.key === null;
    const { pieces, gone, moved } = follow(first ? [] : tr.pieces, shown, () => nextPieceId++);
    const slide = !first && animate && !turned && !landNext.current;
    tr.fading = slide ? [...tr.fading.filter((f) => f.until > now), ...gone.map((piece) => ({ piece, until: now + SLIDE_MS }))] : [];
    if (slide) for (const id of moved) tr.sliding.set(id, now + SLIDE_MS);
    else {
      tr.sliding.clear();
      jump = true;
      jumped = !first;
    }
    tr.pieces = pieces;
    tr.key = key;
  }
  // (A drop lands at once only as it's made: if the game puts the position back instead, that slides as usual.)
  landNext.current = false;
  tr.orientation = orientation;
  tr.turn = turn;
  // (The fades and slides that are over let go: a finished fade kept would draw the board again every 20 ms.)
  const run = stillRunning(tr.fading, tr.sliding, now);
  tr.fading = run.fading;
  tr.sliding = run.sliding;
  const fading = run.fading;
  // Alfil's elephants: the bishops on their squares now; one taken keeps its art as it fades.
  if (elephants?.length || tr.elephants.size) {
    const on = new Set(elephants ?? []);
    for (const p of tr.pieces) if (p.code[1] === "b" && on.has(p.square)) tr.elephants.add(p.id);
    else tr.elephants.delete(p.id);
    for (const id of tr.elephants) if (!tr.pieces.some((p) => p.id === id) && !fading.some((f) => f.piece.id === id)) tr.elephants.delete(id);
  }
  const look = (p: BoardPiece) => `${pieceClass(p.code)}${tr.elephants.has(p.id) ? " elephant" : ""}`;

  // Captured pieces fade and sliding ones settle: drawn again once they're done.
  useEffect(() => {
    if (run.next === null) return;
    const t = setTimeout(redraw, Math.max(0, run.next - performance.now()) + 20);
    return () => clearTimeout(t);
  });
  // After a jump, the browser takes the new places before anything slides again (else the next change, in the same
  // frame, would slide from the old ones).
  useLayoutEffect(() => {
    if (jumped) void boardRef.current?.offsetWidth;
  });

  // ---------------- Selecting and moving ----------------
  const selected = useRef<string | null>(null);
  const press = useRef<Press | null>(null);
  const pressBox = useRef<Box | null>(null);
  const pressPointer = useRef<number | null>(null);
  /** The piece the press holds. */
  const pressId = useRef<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  // (The player's last move here was dragged: the next drag starts at once, as before.)
  const dragged = useRef(false);
  /** The press being made is a mouse's (a computer: premoves queue up). */
  const pressMouse = useRef(false);
  /** A right-drag (an arrow, or a square's color where it started), and the square and color under it now. */
  const right = useRef<{ from: string; at: string | null; pointer: number; box: Box; mods: PointerEvent } | null>(null);
  const pieceEls = useRef(new Map<number, HTMLElement>());

  // A new way up or turn of the board: nothing stays selected or held.
  const lastView = useRef(`${orientation}${turn}`);
  if (lastView.current !== `${orientation}${turn}`) {
    lastView.current = `${orientation}${turn}`;
    selected.current = null;
    press.current = null;
  }

  const movable = (sq: string) => (canAct ? shown.get(sq)?.[0] === turnColor : premoving && shown.get(sq)?.[0] === premove!.side);
  const board: PressBoard = {
    piece: (sq) => shown.get(sq),
    movable,
    canMove: (from, to) => from !== to && movable(from) && (premoving ? premoveDests(shown, from, castling).includes(to) : darkList.length > 0 || !!dests.get(from)?.includes(to)),
    interactive: !!interactive || premoving,
  };
  const live = useRef({ board, shown, orientation, turn, darkOn, darkList, darkSel, fen, ykey, queue, premoving, premove });
  live.current = { board, shown, orientation, turn, darkOn, darkList, darkSel, fen, ykey, queue, premoving, premove };

  /** A move from the board (tap-tap or a drop): what it is, as the game sees it. */
  const userMove = (from: string, to: string, dropped: boolean) => {
    const s = live.current;
    if (s.darkList.length && touchesDark(from + to, s.darkList, s.fen)) {
      const piece = pieceAt(s.fen, from);
      // (A pawn you can see reaching the last rank: you pick its piece. From the dark: a queen.)
      if (piece?.type === "p" && !s.darkList.includes(from) && (to[1] === "8" || to[1] === "1")) return setPromotion({ from, to, dark: true });
      return acts.darkTry(from + to);
    }
    const legal = gestureMoves(s.fen, moves, from, to);
    // (Hollow's dark takes a drop anywhere: an ordinary move that isn't on stays where it was.)
    if (!legal.length) return;
    // (A move the board offers that the game refuses, Smudgy's painted piece: it stays put, and the screen says why.)
    if (acts.stopped.current?.(legal[0]!)) return acts.refused.current?.(legal[0]!);
    landNext.current = dropped;
    dragged.current = dropped;
    if (legal.length > 1) {
      local.current = { pieces: slidePiece(s.shown, from, to), last: [from, to] };
      redraw();
      return setPromotion({ from, to });
    }
    let after: Map<string, PieceCode>;
    try {
      after = readPieces(applyMove(s.fen, legal[0]!));
    } catch {
      after = slidePiece(s.shown, from, to);
    }
    local.current = { pieces: after, last: [from, to] };
    redraw();
    acts.move(legal[0]!);
  };

  /** A move made ahead (a premove): its piece shows at once on its new square, both squares in the premove color. */
  const premoveMade = (from: string, to: string, dropped: boolean) => {
    const s = live.current;
    const side = s.premove!.side;
    landNext.current = dropped;
    dragged.current = dropped;
    const many = pressMouse.current;
    if (s.shown.get(from)?.[1] === "p" && to[1] === (side === "w" ? "8" : "1")) return setPromotion({ from, to, premove: { key: s.ykey, side, many } });
    addPremove(s.ykey, { from, to }, many);
  };

  /** A move from the board's gestures: made now, or ahead. */
  const made = (from: string, to: string, dropped: boolean) => (live.current.premoving ? premoveMade(from, to, dropped) : userMove(from, to, dropped));

  /** Every premove cancelled: the pieces back where they are at once, no colors left. */
  const cancelPremoves = () => {
    selected.current = null;
    landNext.current = true;
    setQueue(live.current.ykey, []);
  };

  // Your turn has come with premoves waiting: the first plays at once, a normal move from then on (marked as a premove
  // for the screen); one the game doesn't allow now is cancelled with every one after it, and a power's refusal goes to
  // the screen as a move you tried would (premoveTurn).
  useLayoutEffect(() => {
    if (!premove || premove.watch || !canAct || turnColor !== premove.side || !premovesOn()) return;
    const q = yours(ykey).queue;
    if (!q.length) return;
    const first = q[0]!;
    const r = premoveQueueTurn(fen, moves, q, { dark: darkList, stopped: acts.stopped.current });
    if (r.play) {
      let after: Map<string, PieceCode>;
      try {
        after = readPieces(applyMove(fen, r.play));
      } catch {
        after = slidePiece(propPieces, first.from, first.to);
      }
      local.current = { pieces: after, last: [first.from, first.to] };
      // (The move first, then the queue: an online crowd tells its server the next premove after this one's pick.)
      acts.move(r.play, { premove: true });
      setQueue(ykey, r.rest);
      redraw();
    } else {
      landNext.current = true;
      setQueue(ykey, r.rest);
      if (r.refused) acts.refused.current?.(r.refused);
    }
  });

  /** A move tried that chess allows but `moves` doesn't (a boss power stops it): it stays put, and the screen says why. */
  const refusedTry = (from: string, to: string) => {
    const s = live.current;
    const onRefused = acts.refused.current;
    if (!onRefused || !canAct || s.darkList.length) return;
    const move = refusedMove(s.fen, moves, from, to);
    if (move) onRefused(move);
  };

  const boxOf = (): Box => {
    const r = boardRef.current!.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };

  /** The element of the piece a press holds. */
  const heldEl = () => (pressId.current !== null ? pieceEls.current.get(pressId.current) : undefined);

  /** Puts the dragged piece's center under the pointer. */
  const dragTo = (p: Press) => {
    const el = heldEl();
    const b = pressBox.current;
    if (!el || !b) return;
    el.style.transform = `translate(${p.x - b.left - b.width / 16}px, ${p.y - b.top - b.height / 16}px)`;
  };

  const startDrag = () => {
    // (No slide while it follows the pointer.)
    heldEl()?.classList.add("dragging");
    setDragId(pressId.current);
  };

  /** Ends a drag: the piece back on its square at once (a move made meanwhile puts it on its new one). */
  const endDrag = (p: Press) => {
    const el = heldEl();
    if (el) {
      el.style.transform = place(p.from, live.current.orientation, live.current.turn);
      void el.offsetWidth;
    }
    setDragId(null);
  };

  /**
   * A right-click (chess.com's): with premoves waiting, it cancels them all; else it starts an arrow (dropped on another
   * square) or a square's color (let go where it started).
   */
  const rightDown = (e: PointerEvent) => {
    e.preventDefault();
    const s = live.current;
    if (s.queue.length) return cancelPremoves();
    if (!boardMarksOn()) return;
    const box = boxOf();
    const sq = squareAtPoint(e.clientX, e.clientY, box, s.orientation, s.turn);
    if (!sq) return;
    right.current = { from: sq, at: sq, pointer: e.pointerId, box, mods: e };
    boardRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onDown = (e: PointerEvent) => {
    if (small) return;
    // (A second finger: the drag in progress is let go.)
    if (press.current) {
      cancelPress();
      return;
    }
    const mouse = e.pointerType === "mouse";
    if (mouse && e.button === 2 && !right.current) return rightDown(e);
    if (!e.isPrimary || (mouse && e.button !== 0)) return;
    const s = live.current;
    const box = boxOf();
    const sq = squareAtPoint(e.clientX, e.clientY, box, s.orientation, s.turn);
    if (!sq) return;
    // (A mouse press on the board starts no text selection; a touch's scrolling is decided in onTouch, below.)
    if (mouse) e.preventDefault();
    pressMouse.current = mouse;
    // A left-click anywhere clears your arrows and highlights (so does a move made with the mouse: it starts with one).
    if (!marksEmpty(yours(s.ykey).marks)) setMarks(s.ykey, NO_MARKS);
    // A phone's premove (chess.com's app holds one): a tap anywhere but the move of a piece you've picked up cancels it.
    if (!mouse && s.queue.length && !s.premove?.watch && !(selected.current && s.board.canMove(selected.current, sq))) return void (cancelPremoves(), redraw());
    // Hollow's dark, before anything else: a dark square tapped is selected; with one selected, the next tap is the
    // attempt from it (your own piece in plain sight picks that one up instead; the same square lets go).
    if (s.darkOn) {
      const mine = s.shown.get(sq)?.[0] === turnColor && !s.darkList.includes(sq);
      if (s.darkSel) {
        if (sq === s.darkSel) return void setDarkSel(null);
        setDarkSel(null);
        if (!mine) return void acts.darkTry(s.darkSel + sq);
      } else {
        const held = selected.current;
        if (held && sq !== held && mine) selected.current = null;
        if (s.darkList.includes(sq) && !held) {
          selected.current = null;
          setDarkSel(sq);
          return;
        }
      }
    }
    const before = selected.current;
    const r = pressDown(s.board, before, sq, e.clientX, e.clientY, dragged.current);
    selected.current = r.selected;
    if (r.move) {
      dragged.current = false;
      made(r.move[0], r.move[1], false);
    } else if (r.press) {
      press.current = r.press;
      pressBox.current = box;
      pressPointer.current = e.pointerId;
      pressId.current = tr.pieces.find((q) => q.square === sq)?.id ?? null;
      boardRef.current?.setPointerCapture?.(e.pointerId);
      if (r.press.started) {
        startDrag();
        dragTo(r.press);
      }
    } else if (before && before !== sq) refusedTry(before, sq);
    redraw();
  };

  const onMovePointer = (e: PointerEvent) => {
    // A right-drag: the arrow follows it, square by square.
    const rd = right.current;
    if (rd && e.pointerId === rd.pointer) {
      const s = live.current;
      const at = squareAtPoint(e.clientX, e.clientY, rd.box, s.orientation, s.turn);
      const color = arrowColor(e) !== arrowColor(rd.mods);
      rd.mods = e;
      if (at !== rd.at || color) {
        rd.at = at;
        redraw();
      }
      return;
    }
    const p = press.current;
    if (!p || e.pointerId !== pressPointer.current) return;
    const s = live.current;
    const next = pressMove(p, e.clientX, e.clientY, squareAtPoint(e.clientX, e.clientY, pressBox.current!, s.orientation, s.turn));
    press.current = next;
    if (next.started && !p.started) startDrag();
    if (next.started) dragTo(next);
  };

  const onUp = (e: PointerEvent) => {
    // A right-click let go: on its own square, that square's color; on another, an arrow; off the board, nothing.
    const rd = right.current;
    if (rd && e.pointerId === rd.pointer) {
      right.current = null;
      const s = live.current;
      const to = e.type === "pointerup" ? squareAtPoint(e.clientX, e.clientY, rd.box, s.orientation, s.turn) : null;
      const m = yours(s.ykey).marks;
      if (to && boardMarksOn()) setMarks(s.ykey, to === rd.from ? toggleSquare(m, to, highlightColor(e)) : toggleArrow(m, { from: rd.from, to, color: arrowColor(e) }));
      redraw();
      return;
    }
    const p = press.current;
    if (!p || e.pointerId !== pressPointer.current) return;
    press.current = null;
    pressPointer.current = null;
    const s = live.current;
    const to = e.type === "pointerup" ? squareAtPoint(e.clientX, e.clientY, pressBox.current!, s.orientation, s.turn) : null;
    const r = pressUp(s.board, selected.current, p, to);
    selected.current = r.selected;
    if (p.started) endDrag(p);
    if (r.move) made(r.move[0], r.move[1], true);
    else if (p.started && to && to !== p.from) refusedTry(p.from, to);
    redraw();
  };

  /** A press let go without a move (a second finger, or its piece gone from under it). */
  const cancelPress = () => {
    const p = press.current;
    if (!p) return;
    press.current = null;
    pressPointer.current = null;
    selected.current = null;
    if (p.started) endDrag(p);
    redraw();
  };

  // The piece being held left its square (a new position): the press is let go.
  useLayoutEffect(() => {
    const p = press.current;
    if (p && !tr.pieces.some((q) => q.id === pressId.current && q.square === p.from)) cancelPress();
  });

  // A touch that means the board (on a piece, near one, or with one selected) doesn't scroll the page; one on an empty
  // stretch with nothing selected still can.
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el || small) return;
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 1 || !e.cancelable) return;
      const t = e.touches[0]!;
      const s = live.current;
      const box = boxOf();
      const sq = squareAtPoint(t.clientX, t.clientY, box, s.orientation, s.turn);
      if (!sq) return;
      if (s.shown.has(sq) || selected.current || s.darkSel || pieceCloseTo(s.shown, t.clientX, t.clientY, box, s.orientation, s.turn)) e.preventDefault();
    };
    el.addEventListener("touchstart", onTouch, { passive: false });
    return () => el.removeEventListener("touchstart", onTouch);
  }, [small]);

  // ---------------- Its size ----------------
  // Before the first paint (a layout effect), and again whenever the wrap changes size: a whole multiple of 8 device
  // pixels, written on the wrap for everything drawn over the squares. (Measured without transforms: a board inside a
  // turning or shaking row keeps its size.)
  useLayoutEffect(() => {
    const root = rootRef.current!;
    const box = containerRef.current!;
    const wrap = root.parentElement!;
    const size = (w: number, h: number) => {
      if (!(w > 0)) return;
      const width = boardSize(w, window.devicePixelRatio || 1);
      const height = h > 0 ? width * (h / w) : width;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
      wrap.style.setProperty("--board-width", `${width}px`);
      wrap.style.setProperty("--board-height", `${height}px`);
    };
    const cs = getComputedStyle(root);
    size(parseFloat(cs.width), parseFloat(cs.height));
    const watch = new ResizeObserver((entries) => {
      const r = entries[entries.length - 1]!.contentRect;
      size(r.width, r.height);
    });
    watch.observe(root);
    return () => watch.disconnect();
  }, []);

  // ---------------- Drawing ----------------
  const sel = selected.current;
  const squares = new Map<string, string>();
  const mark = (sq: string, cls: string) => squares.set(sq, squares.has(sq) ? `${squares.get(sq)} ${cls}` : cls);
  if (shownLast) for (const sq of shownLast) mark(sq, "last-move");
  for (const sq of premoveSquares(queue)) mark(sq, "premove");
  if (BOARD.checkHighlight && !local.current && inCheckDrawn(fen)) {
    const king = [...shown].find(([, p]) => p === `${turnColor}k`)?.[0];
    if (king) mark(king, "check");
  }
  if (sel) {
    mark(sel, "selected");
    if (canAct) for (const d of dests.get(sel) ?? []) mark(d, shown.has(d) ? "move-dest oc" : "move-dest");
    else if (premoving) for (const d of premoveDests(shown, sel, castling)) mark(d, shown.has(d) ? "move-dest oc" : "move-dest");
  }
  for (const [sq, cls] of Object.entries(marks ?? {})) mark(sq, cls);
  if (darkSel && darkOn) mark(darkSel, "selected");

  const drawn = useMemo(() => drawArrows(arrows ?? [], orientation, turn), [arrows, orientation, turn]);
  // Your own (never on a small board), under the screen's: your squares under its highlights, your arrows under its.
  const own = small ? NO_MARKS : mine.marks;
  const rd = right.current;
  const drawing = rd?.at && rd.at !== rd.from ? { from: rd.from, to: rd.at, color: arrowColor(rd.mods) } : null;
  const ownArrows = [...own.arrows.map((a) => userArrowShape(a, orientation, turn)), ...(drawing ? [{ ...userArrowShape(drawing, orientation, turn), key: "drawing" }] : [])];
  const brushes = [...new Set(drawn.filter((a) => !a.circle).map((a) => a.brush))];
  const ghost = dragId !== null && press.current ? tr.pieces.find((q) => q.id === dragId) : undefined;
  const white = orientation === "white";

  return (
    <div ref={rootRef} class={`board hb orientation-${orientation}${small ? "" : " hb-manipulable"}${jump ? " hb-jump" : ""}`} data-board="own">
      <div ref={containerRef} class="hb-container">
        <div ref={boardRef} class="hb-board" onPointerDown={onDown} onPointerMove={onMovePointer} onPointerUp={onUp} onPointerCancel={onUp}>
          {Object.entries(own.squares).map(([sq, color]) => (
            <square key={`u${sq}`} class={`uh uh-${color}`} style={{ transform: place(sq, orientation, turn) }} />
          ))}
          {[...squares].map(([sq, cls]) => (
            <square key={sq} class={cls} style={{ transform: place(sq, orientation, turn) }} />
          ))}
          {fading.map(({ piece }) => (
            <piece key={`f${piece.id}`} class={`${look(piece)} fading`} style={{ transform: place(piece.square, orientation, turn) }} />
          ))}
          {tr.pieces.map((p) => {
            const extra = decor?.of(p.square, p.code);
            return (
              <piece
                key={p.id}
                ref={(el: HTMLElement | null) => {
                  if (el) pieceEls.current.set(p.id, el);
                  else pieceEls.current.delete(p.id);
                }}
                data-square={p.square}
                class={`${look(p)}${tr.sliding.has(p.id) ? " anim" : ""}${p.id === dragId ? " dragging" : ""}${extra?.cls ? ` ${extra.cls}` : ""}`}
                style={{ transform: place(p.square, orientation, turn) }}
              >
                {extra?.kids}
              </piece>
            );
          })}
        </div>
        {ownArrows.length > 0 && (
          <svg class="hb-user-arrows" viewBox="-4 -4 8 8" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {ownArrows.map((a) => (
              <g key={a.key} class={`ua-${a.color}`} data-arrow={a.key}>
                <polyline points={a.shaft} stroke-width={USER_ARROW.width} />
                <polygon points={a.head} />
              </g>
            ))}
          </svg>
        )}
        {drawn.length > 0 && (
          <svg class="hb-shapes" viewBox="-4 -4 8 8" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              {brushes.map((b) => (
                <marker key={b} id={`${uid}-${b}`} orient="auto" overflow="visible" markerWidth="4" markerHeight="4" refX="2.05" refY="2">
                  <path d="M0,0 V4 L3,2 Z" fill={BRUSHES[b].color} />
                </marker>
              ))}
            </defs>
            <g>
              {drawn.map((a) =>
                a.circle ? (
                  <circle key={a.key} stroke={BRUSHES[a.brush].color} stroke-width={4 / 64} fill="none" opacity={BRUSHES[a.brush].opacity} cx={a.circle.x} cy={a.circle.y} r={a.circle.r} />
                ) : (
                  <line key={a.key} stroke={BRUSHES[a.brush].color} stroke-width={BRUSHES[a.brush].width / 64} stroke-linecap="round" marker-end={`url(#${uid}-${a.brush})`} opacity={BRUSHES[a.brush].opacity} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />
                ),
              )}
            </g>
          </svg>
        )}
        {drawn.some((a) => a.label) && (
          <svg class="hb-labels" viewBox="-4 -4 8 8" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {drawn.map(
              (a) =>
                a.label && (
                  <g key={a.key} transform={`translate(${a.label.x},${a.label.y})`}>
                    <circle r={0.2} fill-opacity={0.8} stroke-opacity={0.7} stroke-width={0.03} fill={BRUSHES[a.brush].color} stroke="white" />
                    <text font-size={a.label.size} font-family="Noto Sans" text-anchor="middle" fill="white" y={a.label.textY}>
                      {a.label.text}
                    </text>
                  </g>
                ),
            )}
          </svg>
        )}
        {!small && (
          <div class="hb-coords hb-ranks" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
              <span key={row} class={`hb-coord ${row % 2 ? "hb-on-dark" : "hb-on-light"}`}>
                {coordLabel(String(white ? 8 - row : row + 1), "ranks", turn)}
              </span>
            ))}
          </div>
        )}
        {!small && (
          <div class="hb-coords hb-files" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((col) => (
              <span key={col} class={`hb-coord ${(col + 7) % 2 ? "hb-on-dark" : "hb-on-light"}`}>
                {coordLabel(FILES[white ? col : 7 - col]!, "files", turn)}
              </span>
            ))}
          </div>
        )}
        {ghost && <piece class={`ghost ${look(ghost)}`} style={{ transform: place(ghost.square, orientation, turn) }} />}
      </div>
    </div>
  );
}
