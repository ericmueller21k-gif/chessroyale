/**
 * The board's logic, kept pure so it can be tested without a page (packages/app/test/board-logic.test.ts): which square
 * is drawn where (either way up, and on a board turned a quarter of the way round: board-view.ts), the square under a
 * point, the board's size, which pieces slide where when the position changes, the moves a tap or a drag may make, and
 * the arrows' geometry.
 *
 * The behavior and numbers follow the board the game used before (its 3 px drag threshold, its 220 ms slides with a
 * cubic ease in and out, its arrows' widths and colors), measured against it side by side (Oct 12, 2026), so a player
 * couldn't tell the two apart.
 */
import { castleShortcuts960, isChess960Fen, legalMoves, touchesDark } from "@chessroyale/chess";
import { realSquare, viewSquare, type QuarterTurn } from "../board-view.ts";
import type { BoardProps } from "./types.ts";

export type Orientation = "white" | "black";
/** A piece: its color and kind, as "wp", "bk", ... */
export type PieceCode = string;

export const FILES = "abcdefgh";

/** How long a piece takes to slide, and how a captured one fades (ms). */
export const SLIDE_MS = 220;
/** A press becomes a drag once the pointer has moved this far (px). */
export const DRAG_DISTANCE_PX = 3;

/** Every square, in the order the old board went through them (a1, a2, ... a8, b1, ...): ties go to the first. */
export const ALL_SQUARES: readonly string[] = [...FILES].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`));

const ROLE_NAME: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/** A piece's classes, as every piece in the game is drawn (`<piece class="white pawn">`). */
export const pieceClass = (code: PieceCode) => `${code[0] === "w" ? "white" : "black"} ${ROLE_NAME[code[1]!] ?? "pawn"}`;

/** The position's pieces by square, from a FEN (only its placement is read). */
export function readPieces(fen: string): Map<string, PieceCode> {
  const out = new Map<string, PieceCode>();
  const rows = fen.split(" ")[0]!.split("/");
  for (let i = 0; i < 8 && i < rows.length; i++) {
    let f = 0;
    for (const ch of rows[i]!) {
      if (ch >= "1" && ch <= "8") f += Number(ch);
      else {
        if (f < 8) out.set(`${FILES[f]}${8 - i}`, (ch === ch.toUpperCase() ? "w" : "b") + ch.toLowerCase());
        f++;
      }
    }
  }
  return out;
}

/** A position as a short string (equal positions, equal strings). */
export const positionKey = (pieces: ReadonlyMap<string, PieceCode>) => [...pieces].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([s, p]) => s + p).join("");

/** Where a square is drawn: its column and row from the board's top-left (0 to 7), either way up, turned or not. */
export function cellOf(square: string, orientation: Orientation, turn: QuarterTurn = 0): { col: number; row: number } {
  const v = viewSquare(square, turn);
  const f = v.charCodeAt(0) - 97;
  const r = Number(v[1]) - 1;
  return orientation === "white" ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
}

/** The square drawn in a column and row (cellOf's inverse). */
export function squareAt(col: number, row: number, orientation: Orientation, turn: QuarterTurn = 0): string {
  const f = orientation === "white" ? col : 7 - col;
  const r = orientation === "white" ? 7 - row : row;
  return realSquare(`${FILES[f]}${r + 1}`, turn);
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The square under a point (page pixels) of the board's box, or null off the board. */
export function squareAtPoint(x: number, y: number, box: Box, orientation: Orientation, turn: QuarterTurn = 0): string | null {
  const col = Math.floor((8 * (x - box.left)) / box.width);
  const row = Math.floor((8 * (y - box.top)) / box.height);
  if (!(col >= 0 && col < 8 && row >= 0 && row < 8)) return null;
  return squareAt(col, row, orientation, turn);
}

/** A square's center in page pixels. */
export function squareCentre(square: string, box: Box, orientation: Orientation, turn: QuarterTurn = 0): { x: number; y: number } {
  const { col, row } = cellOf(square, orientation, turn);
  return { x: box.left + ((col + 0.5) * box.width) / 8, y: box.top + ((row + 0.5) * box.height) / 8 };
}

/**
 * The board's drawn size for a box `width` px wide on a screen of `dpr` device pixels a CSS pixel: a whole multiple of
 * 8 device pixels (every square a whole number of them, so square edges are crisp), up to 8 device pixels smaller than
 * the box. Everything drawn over the squares sizes itself by it (--board-size).
 */
export const boardSize = (width: number, dpr: number) => (Math.floor((width * dpr) / 8) * 8) / dpr;

/** Whether a press that has moved (dx, dy) px has become a drag. */
export const dragStarted = (dx: number, dy: number) => dx * dx + dy * dy >= DRAG_DISTANCE_PX * DRAG_DISTANCE_PX;

/** Whether any piece's center is within a square's width of a point: a touch there means the board, not a scroll. */
export function pieceCloseTo(pieces: ReadonlyMap<string, PieceCode>, x: number, y: number, box: Box, orientation: Orientation, turn: QuarterTurn = 0): boolean {
  const r2 = (box.width / 8) ** 2;
  for (const sq of pieces.keys()) {
    const c = squareCentre(sq, box, orientation, turn);
    if ((c.x - x) ** 2 + (c.y - y) ** 2 <= r2) return true;
  }
  return false;
}

/**
 * Where each piece may go (from square to squares), from the moves allowed (default: every legal move). Hollow's dark:
 * nothing from, onto or past a dark square (its dots would give the piece away). Chess960: the king may also go onto
 * the square it castles to, where that can mean nothing else (`gestureMoves`).
 */
export function destsFor(fen: string, only?: readonly string[], dark: readonly string[] = []): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  const add = (from: string, to: string) => {
    const list = dests.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    dests.set(from, list);
  };
  const all = only ?? legalMoves(fen);
  for (const m of all) if (!touchesDark(m, dark, fen)) add(m.slice(0, 2), m.slice(2, 4));
  if (isChess960Fen(fen)) for (const [g, m] of castleShortcuts960(fen, all)) if (!touchesDark(m, dark, fen)) add(g.slice(0, 2), g.slice(2, 4));
  return dests;
}

/**
 * The moves a piece taken from one square to another makes, from the moves allowed (default: every legal move); more
 * than one is a promotion still to pick. Chess960's castling is written as the king taking its own rook (e1h1), so
 * the king dragged onto its rook castles; so does the king dragged onto the square it castles to (g1 or c1, as in
 * normal chess) wherever no other king move goes there and it isn't already there (castleShortcuts960).
 */
export function gestureMoves(fen: string, only: readonly string[] | undefined, from: string, to: string): string[] {
  const all = only ?? legalMoves(fen);
  const direct = all.filter((m) => m.startsWith(from + to));
  if (direct.length || !isChess960Fen(fen)) return direct;
  const castle = castleShortcuts960(fen, all).get(from + to);
  return castle ? [castle] : [];
}

/**
 * A piece taken from one square to another that chess allows but `moves` doesn't (a boss power stops it: Sawyer's saw,
 * a pie, a toy block, a frozen piece): that move (a promotion's first), for the screen to say why; null for anything
 * else (allowed, not a move at all, or nothing limits the moves).
 */
export function refusedMove(fen: string, moves: readonly string[] | undefined, from: string, to: string): string | null {
  if (!moves) return null;
  const legal = gestureMoves(fen, undefined, from, to);
  return legal.length && !gestureMoves(fen, moves, from, to).length ? legal[0]! : null;
}

/** The position after a piece is moved from one square to another, nothing else changed (a promotion still to pick). */
export function slidePiece(pieces: ReadonlyMap<string, PieceCode>, from: string, to: string): Map<string, PieceCode> {
  const out = new Map(pieces);
  const p = out.get(from);
  if (!p) return out;
  out.delete(from);
  out.set(to, p);
  return out;
}

// ---------------- Which piece went where ----------------

export interface BoardPiece {
  /** Kept while the piece is on the board, so a move slides it (the same element) rather than drawing a new one. */
  id: number;
  code: PieceCode;
  square: string;
}

const dist2 = (a: string, b: string) => (a.charCodeAt(0) - b.charCodeAt(0)) ** 2 + (Number(a[1]) - Number(b[1])) ** 2;

/**
 * The pieces of a new position, following the old one: a piece still on its square keeps its id; a piece on a new
 * square takes the id of the nearest piece of the same color and kind that left its square (it slides there); the
 * rest are new. Pieces that left and went nowhere were taken (they fade). As the old board did it: a promoted pawn
 * fades and its new piece appears.
 */
export function follow(prev: readonly BoardPiece[], next: ReadonlyMap<string, PieceCode>, newId: () => number): { pieces: BoardPiece[]; gone: BoardPiece[]; moved: Set<number> } {
  const before = new Map(prev.map((p) => [p.square, p]));
  const pieces: BoardPiece[] = [];
  const missing: BoardPiece[] = [];
  const arrived: { square: string; code: PieceCode }[] = [];
  for (const sq of ALL_SQUARES) {
    const now = next.get(sq);
    const was = before.get(sq);
    if (now && was && was.code === now) pieces.push(was);
    else {
      if (was) missing.push(was);
      if (now) arrived.push({ square: sq, code: now });
    }
  }
  const moved = new Set<number>();
  const taken = new Set<number>();
  for (const a of arrived) {
    let best: BoardPiece | null = null;
    for (const m of missing) if (m.code === a.code && !taken.has(m.id) && (!best || dist2(m.square, a.square) < dist2(best.square, a.square))) best = m;
    if (best) {
      taken.add(best.id);
      moved.add(best.id);
      pieces.push({ id: best.id, code: a.code, square: a.square });
    } else pieces.push({ id: newId(), code: a.code, square: a.square });
  }
  // (In id order: an element that moved in the page would lose its slide, a re-inserted element having nothing to
  // slide from.)
  pieces.sort((a, b) => a.id - b.id);
  return { pieces, gone: missing.filter((m) => !taken.has(m.id)), moved };
}

/**
 * The captured pieces still fading and the pieces still sliding at `now` (those that are over are let go), and when the
 * next of them ends (null: none), when the board draws again by itself. (A fade kept after it ended had the board drawn
 * again every 20 ms until the next move: Oct 14, 2026.)
 */
export function stillRunning<F extends { until: number }>(fading: readonly F[], sliding: ReadonlyMap<number, number>, now: number): { fading: F[]; sliding: Map<number, number>; next: number | null } {
  const f = fading.filter((x) => x.until > now);
  const s = new Map([...sliding].filter(([, until]) => until > now));
  const next = Math.min(...f.map((x) => x.until), ...s.values());
  return { fading: f, sliding: s, next: Number.isFinite(next) ? next : null };
}

// ---------------- Taps and drags ----------------

/** What a press needs to know about the board as it is. */
export interface PressBoard {
  /** The piece on a square, if any. */
  piece(square: string): PieceCode | undefined;
  /** A piece of the side to move, which may move now. */
  movable(square: string): boolean;
  /** A move the board takes now (a destination of the piece, or anywhere in Hollow's dark). */
  canMove(from: string, to: string): boolean;
  /** Moving is on (a big board while it's your move). */
  interactive: boolean;
}

/** A press on a piece that may become a drag. */
export interface Press {
  from: string;
  x0: number;
  y0: number;
  x: number;
  y: number;
  /** It has moved DRAG_DISTANCE_PX: the piece follows the pointer. */
  started: boolean;
  /** It has been over another square. */
  left: boolean;
  /** The square selected before this press. */
  before: string | null;
}

/**
 * A press on a square (`selected`: the square selected before it). A selected piece goes to a destination pressed (a
 * tap-tap move, made as the second press goes down); a piece of the side to move is selected (and may be dragged);
 * anything else lets go of the selection. `dragging`: the player's last move on this board was dragged, so the next
 * drag starts at once (no threshold), as the old board did.
 */
export function pressDown(b: PressBoard, selected: string | null, square: string, x: number, y: number, dragging = false): { selected: string | null; move: [string, string] | null; press: Press | null } {
  if (selected && b.canMove(selected, square)) return { selected: null, move: [selected, square], press: null };
  let sel = selected;
  // (Not your move: a press changes nothing, as before.)
  if (sel && sel !== square && b.interactive) sel = null;
  if (b.movable(square)) sel = square;
  const press = b.movable(square) && sel === square ? { from: square, x0: x, y0: y, x, y, started: dragging, left: false, before: selected } : null;
  return { selected: sel, move: null, press };
}

/** The pointer moved during a press (`at`: the square under it, or null off the board). */
export function pressMove(p: Press, x: number, y: number, at: string | null): Press {
  const started = p.started || dragStarted(x - p.x0, y - p.y0);
  return { ...p, x, y, started, left: p.left || (started && at !== p.from) };
}

/**
 * The press ends over `to` (null: off the board). A drag dropped on another square tries that move; the selection is
 * let go after a drag dropped back where it started or off the board, after a tap on the piece already selected, and
 * whenever moving is off.
 */
export function pressUp(b: PressBoard, selected: string | null, p: Press, to: string | null): { selected: string | null; move: [string, string] | null } {
  let sel = selected;
  let move: [string, string] | null = null;
  if (to && p.started && to !== p.from) {
    if (b.canMove(p.from, to)) move = [p.from, to];
    sel = null;
  }
  if ((p.from === p.before || p.left) && (to === p.from || !to)) sel = null;
  else if (!b.interactive) sel = null;
  return { selected: sel, move };
}

// ---------------- Arrows ----------------

export type Brush = "green" | "blue" | "red" | "yellow" | "paleGrey" | "paleBlue";

/** Each arrow color: its color, see-through-ness and line width (in 64ths of a square). */
export const BRUSHES: Record<Brush, { color: string; opacity: number; width: number }> = {
  green: { color: "#15781B", opacity: 1, width: 10 },
  red: { color: "#882020", opacity: 1, width: 10 },
  blue: { color: "#003088", opacity: 1, width: 10 },
  yellow: { color: "#e68f00", opacity: 1, width: 10 },
  paleBlue: { color: "#003088", opacity: 0.4, width: 15 },
  paleGrey: { color: "#4a4a4a", opacity: 0.35, width: 15 },
};

export interface ArrowShape {
  move: string;
  brush: Brush;
  label?: string;
}

export interface DrawnArrow {
  key: string;
  brush: Brush;
  /** From and to the squares' centers, in squares from the board's center (-4 to 4); the line stops short of the head. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** A label at the junction of shaft and head. */
  label?: { text: string; x: number; y: number; size: number; textY: number };
  /** A circle on one square (an arrow from a square to itself). */
  circle?: { x: number; y: number; r: number };
}

/** An arrow's direction as one of 16 slots (arrows into one square from directions this close shorten). */
const slot = (dx: number, dy: number) => (Math.round(((Math.atan2(dy, dx) + Math.PI) * 8) / Math.PI) + 16) % 16;

/** The arrows drawn for a list of moves, in squares from the board's center (the old board's arrows, measured). */
export function drawArrows(arrows: readonly ArrowShape[], orientation: Orientation, turn: QuarterTurn = 0): DrawnArrow[] {
  const at = (sq: string) => {
    const { col, row } = cellOf(sq, orientation, turn);
    return { x: col - 3.5, y: row - 3.5 };
  };
  const into = new Map<string, Set<number>>();
  for (const a of arrows) {
    const f = at(a.move.slice(0, 2));
    const t = at(a.move.slice(2, 4));
    const set = into.get(a.move.slice(2, 4)) ?? new Set();
    set.add(slot(t.x - f.x, t.y - f.y));
    into.set(a.move.slice(2, 4), set);
  }
  return arrows.map((a, i) => {
    const f = at(a.move.slice(0, 2));
    const t = at(a.move.slice(2, 4));
    const slots = into.get(a.move.slice(2, 4))!;
    const short = slots.size > 1;
    const key = `${i}:${a.move}:${a.brush}:${a.label ?? ""}`;
    const out: DrawnArrow = { key, brush: a.brush, x1: f.x, y1: f.y, x2: t.x, y2: t.y };
    if (f.x === t.x && f.y === t.y) out.circle = { x: f.x, y: f.y, r: 0.5 - 4 / 64 / 2 };
    else {
      const angle = Math.atan2(t.y - f.y, t.x - f.x);
      const m = (short ? 20 : 10) / 64;
      out.x2 = t.x - Math.cos(angle) * m;
      out.y2 = t.y - Math.sin(angle) * m;
    }
    if (a.label) {
      // At the junction of the shaft and the head (further back with another arrow into the square, and further for a
      // knight's beside another's).
      let mag = Math.hypot(t.x - f.x, t.y - f.y);
      const back = Math.atan2(t.y - f.y, t.x - f.x) + Math.PI;
      mag -= 33 / 64;
      if (short) {
        mag -= 10 / 64;
        const s = slot(t.x - f.x, t.y - f.y);
        if ((slots.has((s + 1) % 16) || slots.has((s + 15) % 16)) && s & 1) mag -= 0.4;
      }
      const size = 0.4 * 0.75 ** a.label.length;
      out.label = { text: a.label, x: f.x - Math.cos(back) * mag, y: f.y - Math.sin(back) * mag, size, textY: 0.13 * 0.75 ** a.label.length };
    }
    return out;
  });
}

// ---------------- When the board draws again ----------------

/**
 * Everything the board's own drawing (its squares, pieces, highlights, arrows and coordinates) is made from, as plain
 * values: equal lists, the same drawing. The board draws its pieces again only when one of these changes, or on its own
 * (a tap, a drag, a slide or a fade ending), never just because the screen around it drew again: a boss screen draws
 * every frame while an effect plays over the board (Oct 14, 2026; docs/areas/board.md). Lists and objects count by
 * what's in them, not by identity (a screen that builds a fresh `arrows` array each time hasn't changed the board);
 * the move handlers aren't here (the board calls whichever is current), only whether Hollow's dark takes attempts.
 */
export function boardInputs(p: Omit<BoardProps, "children" | "silent" | "onMove">): unknown[] {
  return [
    p.fen,
    p.orientation,
    p.lastMove ?? null,
    !!p.interactive,
    p.moves ? p.moves.join() : null,
    p.arrows ? p.arrows.map((a) => `${a.move}:${a.brush}:${a.label ?? ""}`).join(" ") : null,
    !!p.small,
    p.animate !== false,
    p.marks ? JSON.stringify(p.marks) : null,
    p.dark ? p.dark.join() : null,
    !!p.onDarkTry,
    p.turn ?? 0,
    p.elephants?.length ? p.elephants.join() : null,
    p.decor?.key ?? null,
  ];
}
