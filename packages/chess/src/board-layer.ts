/**
 * The board layer: one state per square, edge and piece for every boss's marks on the board at once (the Battle Tower's
 * foundation: docs/decisions/2026-11-18-battle-tower-design.md, "The board layer"; its calls:
 * docs/decisions/2026-11-18-board-layer.md). Every boss writes its marks here, and one set of pure functions answers
 * "can this move be played now" for all of them, the same on the server, in solo and on every screen:
 *
 * - `layerStop`: the first mark that stops a legal move for the side to move (the refusal words come from its `kind`).
 * - `layerMoves`: the legal moves no mark stops, with the one lift every power keeps: none left, every legal move.
 * - `followLayer`: piece marks move with their piece (a castling rook's too) and go when it's captured.
 * - `wearLayer`: marks wear off after their last crowd turn.
 *
 * A move is allowed only if no mark stops it, so where marks overlap the most restrictive wins, with no table. Only
 * chess-legal moves are ever filtered: marks never stop an attack (pins and checks work across all of them), and check
 * is always answered.
 *
 * Not yet read by any boss: today's bosses move onto it one family a PR (held pieces, square marks, edges, shields).
 */
import type { StopReason } from "@chessroyale/core";
import { legalMoves, pieceAt, sideToMove } from "./rules.ts";

type Side = "w" | "b";

/** Whose moves a mark stops: both sides', the crowd's, or the bosses'. */
export type Binds = "both" | "crowd" | "bosses";

/** A held piece, by the dock's word for it (packages/app/src/refused.ts): Ginger's ice, Folio's fold, Moo's stun, Chandy's rapid fire. */
export type HeldKind = "frozen" | "folded" | "stunned" | "dizzy";

/** A mark that's only drawn (it stops nothing): Boingo's splat, Folio's draft, Chandy's lock. */
export type DrawnKind = "splat" | "draft" | "lock";

/** What every mark carries. */
interface MarkBase {
  binds: Binds;
  /** The last crowd turn it stands (as every power's `until`); none: until its boss takes it away. */
  until?: number;
  /** The boss (its BOSS_ROSTER id) whose power put it there. */
  by: string;
}

/**
 * A mark on a square, whatever stands there: `noLand`, nothing lands on it (a pie, a scatter shot, Don Dough's lump);
 * `noPass`, nothing passes over it (a knight jumps it, as a jump passes over nothing); both, a wall (a toy block, a plain
 * plant, the beam); `noPass` alone, Big Boy's tower from `towerEnter` (landing on it topples it); neither, no limit (fire:
 * drawn, its `stage` for the drawing and the burn).
 */
export interface SquareMark extends MarkBase {
  square: string;
  kind: StopReason | "fire";
  noLand?: boolean;
  noPass?: boolean;
  stage?: number;
}

/**
 * A mark on the edge between two neighboring squares (`a`, `b`: same rank or file, any order; edgeOf's order is the
 * usual). `across: "straight"`: no rank or file move crosses it; a diagonal passes at its corners and a knight jumps it
 * (Sawyer's saw cut). `"all"`: nothing crosses it, knights included (the board saw's d|e edges, Folio's crease); a move
 * through one of its end corners counts as crossing, so a whole line of them stops every move across it.
 */
export interface EdgeMark extends MarkBase {
  a: string;
  b: string;
  across: "straight" | "all";
  kind: StopReason;
}

/**
 * A mark on a piece, which follows it (followLayer). `held`: it doesn't move, nor castles as the rook (it still attacks,
 * defends and blocks). `shieldFrom`: it can't be taken by a pawn ("pawns": Don Dough's gold) or at all ("all": Chandy's
 * shields), en passant included. Neither: drawn only.
 */
export interface PieceMark extends MarkBase {
  square: string;
  kind: StopReason | HeldKind | DrawnKind;
  held?: boolean;
  shieldFrom?: "pawns" | "all";
}

export type LayerMark = SquareMark | EdgeMark | PieceMark;

/** Every mark on the board, and the crowd's side (a mark binding "crowd" stops this side's moves, "bosses" the other's). */
export interface BoardLayer {
  crowd: Side;
  squares: readonly SquareMark[];
  edges: readonly EdgeMark[];
  pieces: readonly PieceMark[];
}

/** One boss's marks (its part of the layer). */
export type LayerMarks = Partial<Pick<BoardLayer, "squares" | "edges" | "pieces">>;

/** A board with no marks. */
export const emptyLayer = (crowd: Side): BoardLayer => ({ crowd, squares: [], edges: [], pieces: [] });

/** Every boss's marks in one layer, in the order given (the first mark that stops a move is the one named). */
export function mergeLayers(crowd: Side, parts: readonly (LayerMarks | null | undefined)[]): BoardLayer {
  return {
    crowd,
    squares: parts.flatMap((p) => p?.squares ?? []),
    edges: parts.flatMap((p) => p?.edges ?? []),
    pieces: parts.flatMap((p) => p?.pieces ?? []),
  };
}

// ---------------- The geometry ----------------

const from = (m: string) => m.slice(0, 2);
const to = (m: string) => m.slice(2, 4);
const file = (sq: string) => sq.charCodeAt(0) - 97;
const rank = (sq: string) => Number(sq[1]);
const square = (f: number, r: number) => `${"abcdefgh"[f]}${r}`;

/** An edge between two orthogonally neighboring squares, in order (the lower file first, or the lower rank on one file). */
export function edgeOf(s1: string, s2: string): { a: string; b: string } {
  return file(s1) < file(s2) || (file(s1) === file(s2) && rank(s1) < rank(s2)) ? { a: s1, b: s2 } : { a: s2, b: s1 };
}

/**
 * The edges a move crosses straight on its way: every edge between the squares of a slide along a rank or file (a
 * rook, a queen, a king's step, a pawn's push or double step), and a castling king's way on to his rook's corner (the
 * king's path and the rook's, as Big Boy's toy block counts it; `fen` says it's a king). A diagonal move passes at the
 * corners and a knight jumps: neither crosses an edge.
 */
export function moveEdges(move: string, fen?: string): { a: string; b: string }[] {
  const a = from(move);
  const b = to(move);
  const df = file(b) - file(a);
  const dr = rank(b) - rank(a);
  if (df !== 0 && dr !== 0) return [];
  let end = b;
  if (fen && dr === 0 && Math.abs(df) === 2 && pieceAt(fen, a)?.type === "k") end = square(df > 0 ? 7 : 0, rank(a));
  const n = Math.max(Math.abs(file(end) - file(a)), Math.abs(rank(end) - rank(a)));
  const sf = Math.sign(file(end) - file(a));
  const sr = Math.sign(rank(end) - rank(a));
  const out: { a: string; b: string }[] = [];
  for (let k = 0; k < n; k++) out.push(edgeOf(square(file(a) + sf * k, rank(a) + sr * k), square(file(a) + sf * (k + 1), rank(a) + sr * (k + 1))));
  return out;
}

/** One piece's way in a move: where it stands and where it lands. */
export interface PiecePath {
  from: string;
  to: string;
}

/**
 * The pieces a move moves (`fen`: before it), each from its square to where it lands: one piece, or castling's king and
 * rook. Castling is the king's move two files along his rank (a normal board: the rook from its corner) or onto his own
 * rook (Chess960, as UCI writes it): the king lands on the g- or c-file, the rook beside him on the f- or d-file (a Chess960
 * king already on his square goes nowhere, but still takes part: held, he doesn't castle).
 */
export function movePaths(move: string, fen: string): PiecePath[] {
  const a = from(move);
  const b = to(move);
  const king = pieceAt(fen, a);
  if (king?.type === "k" && a[1] === b[1]) {
    const there = pieceAt(fen, b);
    const df = file(b) - file(a);
    const rook = there?.type === "r" && there.color === king.color ? b : Math.abs(df) === 2 ? square(df > 0 ? 7 : 0, rank(a)) : null;
    if (rook) {
      const side = file(rook) > file(a);
      return [
        { from: a, to: `${side ? "g" : "c"}${a[1]}` },
        { from: rook, to: `${side ? "f" : "d"}${a[1]}` },
      ];
    }
  }
  return [{ from: a, to: b }];
}

/** The squares a piece passes over on its way (a slide along a rank, file or diagonal; a pawn's double step); a knight's jump passes none. */
function passedOn(p: PiecePath): string[] {
  const df = file(p.to) - file(p.from);
  const dr = rank(p.to) - rank(p.from);
  if (df !== 0 && dr !== 0 && Math.abs(df) !== Math.abs(dr)) return [];
  const n = Math.max(Math.abs(df), Math.abs(dr));
  const out: string[] = [];
  for (let k = 1; k < n; k++) out.push(square(file(p.from) + Math.sign(df) * k, rank(p.from) + Math.sign(dr) * k));
  return out;
}

/**
 * A piece's way crosses an edge: the line between the two squares' middles meets the edge (its end corners included).
 * `straight`: only a way along a rank or file counts (it meets an edge at its middle; a diagonal only ever at corners, a
 * knight anywhere). Squares' middles sit on halves, so every number here is exact.
 */
function crossesEdge(p: PiecePath, e: Pick<EdgeMark, "a" | "b">, straight: boolean): boolean {
  const x1 = file(p.from) + 0.5;
  const y1 = rank(p.from) - 0.5;
  const x2 = file(p.to) + 0.5;
  const y2 = rank(p.to) - 0.5;
  if (straight && x1 !== x2 && y1 !== y2) return false;
  const { a, b } = edgeOf(e.a, e.b);
  if (rank(a) === rank(b) && file(b) - file(a) === 1) {
    // (Between files: the line x = file(b), from y = rank - 1 to rank.)
    const x = file(b);
    if ((x - x1) * (x - x2) >= 0) return false;
    const y = y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
    return y >= rank(a) - 1 && y <= rank(a);
  }
  if (file(a) === file(b) && rank(b) - rank(a) === 1) {
    // (Between ranks: the line y = rank(a), from x = file to file + 1.)
    const y = rank(a);
    if ((y - y1) * (y - y2) >= 0) return false;
    const x = x1 + ((y - y1) * (x2 - x1)) / (y2 - y1);
    return x >= file(a) && x <= file(a) + 1;
  }
  return false;
}

/** The square of the piece a move takes (`fen`: before it), if any: where it lands, or en passant the pawn beside (a pawn's diagonal step onto an empty square). */
function takenSquare(fen: string, move: string): string | null {
  const mover = pieceAt(fen, from(move));
  const there = pieceAt(fen, to(move));
  if (there) return mover && there.color !== mover.color ? to(move) : null;
  return mover?.type === "p" && move[0] !== move[2] ? `${move[2]}${move[1]}` : null;
}

// ---------------- The rules ----------------

/** A mark binds the side to move (`mover`) on a board where the crowd plays `crowd`. */
const bindsMover = (m: MarkBase, mover: Side, crowd: Side): boolean => m.binds === "both" || (m.binds === "crowd") === (mover === crowd);

/**
 * The first mark that stops `move` (legal in chess) for the side to move in `fen`, or null: a held piece moving (castling's
 * rook included); then a square mark (in the layer's order) it lands on (`noLand`) or passes over (`noPass`); then an edge it
 * crosses; then a shielded piece it takes. Its `kind` names the refusal words (refused.ts).
 */
export function layerStop(layer: BoardLayer, fen: string, move: string): LayerMark | null {
  if (!layer.squares.length && !layer.edges.length && !layer.pieces.length) return null;
  const mover = sideToMove(fen);
  const binds = (m: MarkBase) => bindsMover(m, mover, layer.crowd);
  const paths = movePaths(move, fen);
  for (const m of layer.pieces) if (m.held && binds(m) && paths.some((p) => p.from === m.square)) return m;
  if (layer.squares.length) {
    const lands = paths.map((p) => p.to);
    const passes = paths.flatMap(passedOn);
    for (const m of layer.squares) if (binds(m) && ((m.noLand && lands.includes(m.square)) || (m.noPass && passes.includes(m.square)))) return m;
  }
  for (const m of layer.edges) if (binds(m) && paths.some((p) => crossesEdge(p, m, m.across === "straight"))) return m;
  const shields = layer.pieces.filter((m) => m.shieldFrom && binds(m));
  if (shields.length) {
    const taken = takenSquare(fen, move);
    const pawn = pieceAt(fen, from(move))?.type === "p";
    for (const m of shields) if (m.square === taken && (m.shieldFrom === "all" || pawn)) return m;
  }
  return null;
}

/**
 * The legal moves (`legal`: of `fen`, the side to move's) no mark stops, and the lift in one place (every power's ground rule:
 * none left, every legal move, `lifted`). Only legal moves are filtered, so check is always answered.
 */
export function layerMoves(layer: BoardLayer, fen: string, legal: readonly string[] = legalMoves(fen)): { moves: string[]; lifted: boolean } {
  const moves = legal.filter((m) => !layerStop(layer, fen, m));
  return moves.length || !legal.length ? { moves, lifted: false } : { moves: [...legal], lifted: true };
}

/**
 * The layer after `move` (`fenBefore`: the position before it): each piece mark moves with its piece (castling's rook too, a
 * pawn on to the piece it becomes) and goes when its piece is taken (en passant too). Square and edge marks stay where they
 * are (their boss's rules take them away).
 */
export function followLayer(layer: BoardLayer, move: string, fenBefore: string): BoardLayer {
  if (!layer.pieces.length) return layer;
  const paths = movePaths(move, fenBefore);
  const taken = takenSquare(fenBefore, move);
  const pieces = layer.pieces.flatMap((m) => {
    const p = paths.find((x) => x.from === m.square);
    if (p) return [{ ...m, square: p.to }];
    return m.square === taken ? [] : [m];
  });
  return { ...layer, pieces };
}

/** The layer as crowd turn `turn` begins: every mark whose last turn (`until`) is past has worn off. */
export function wearLayer(layer: BoardLayer, turn: number): BoardLayer {
  const stays = (m: MarkBase) => m.until === undefined || m.until >= turn;
  return { ...layer, squares: layer.squares.filter(stays), edges: layer.edges.filter(stays), pieces: layer.pieces.filter(stays) };
}
