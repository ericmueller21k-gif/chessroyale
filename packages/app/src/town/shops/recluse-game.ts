/**
 * The game the Hidden Boss plays against himself on his bedroom floor (Nov 12, Eric: "It would be even better if it was an actual move
 * that he played"): his famous 1956 game, the one he won at 13 with Black, all 41 moves to the mate, stored as a fixed list (no engine
 * in the room: no lag). Pure: the positions after each move, the move list's squares, and where the child is in his loop at a time.
 * `packages/app/test/recluse-room.test.ts` plays the list through chess.js: every move legal, the SAN matching, a mate at the end.
 */
import { HIDDEN_ROOM_FEEL } from "../feel.ts";

/** The moves as he played them, in SAN (82 half-moves; White first). */
export const RECLUSE_GAME_SAN: readonly string[] = (
  "Nf3 Nf6 c4 g6 Nc3 Bg7 d4 O-O Bf4 d5 Qb3 dxc4 Qxc4 c6 e4 Nbd7 Rd1 Nb6 Qc5 Bg4 Bg5 Na4 Qa3 Nxc3 bxc3 Nxe4 Bxe7 Qb6 Bc4 Nxc3 " +
  "Bc5 Rfe8+ Kf1 Be6 Bxb6 Bxc4+ Kg1 Ne2+ Kf1 Nxd4+ Kg1 Ne2+ Kf1 Nc3+ Kg1 axb6 Qb4 Ra4 Qxb6 Nxd1 h3 Rxa2 Kh2 Nxf2 Re1 Rxe1 " +
  "Qd8+ Bf8 Nxe1 Bd5 Nf3 Ne4 Qb8 b5 h4 h5 Ne5 Kg7 Kg1 Bc5+ Kf1 Ng3+ Ke1 Bb4+ Kd1 Bb3+ Kc1 Ne2+ Kb1 Nc3+ Kc1 Rc2#"
).split(" ");

/** The same moves as from and to squares (UCI), what the room plays: no rules needed to show them. */
export const RECLUSE_GAME_UCI: readonly string[] = (
  "g1f3 g8f6 c2c4 g7g6 b1c3 f8g7 d2d4 e8g8 c1f4 d7d5 d1b3 d5c4 b3c4 c7c6 e2e4 b8d7 a1d1 d7b6 c4c5 c8g4 f4g5 b6a4 c5a3 a4c3 b2c3 " +
  "f6e4 g5e7 d8b6 f1c4 e4c3 e7c5 f8e8 e1f1 g4e6 c5b6 e6c4 f1g1 c3e2 g1f1 e2d4 f1g1 d4e2 g1f1 e2c3 f1g1 a7b6 a3b4 a8a4 b4b6 c3d1 " +
  "h2h3 a4a2 g1h2 d1f2 h1e1 e8e1 b6d8 g7f8 f3e1 c4d5 e1f3 f2e4 d8b8 b7b5 h3h4 h7h5 f3e5 g8g7 h2g1 f8c5 g1f1 e4g3 f1e1 c5b4 e1d1 " +
  "d5b3 d1c1 g3e2 c1b1 e2c3 b1c1 a2c2"
).split(" ");

/** A piece on the board: its color ("w" or "b") and kind ("P", "N", "B", "R", "Q", "K"), as "wN". */
export type Piece = string;
/** A board: 64 squares, a1 = 0, b1 = 1 ... h8 = 63; null where empty. */
export type Board = readonly (Piece | null)[];

/** The square's index from its name ("e4" -> 28). */
export const sqOf = (name: string): number => (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97);

/** The start position. */
export function startBoard(): (Piece | null)[] {
  const b: (Piece | null)[] = new Array(64).fill(null);
  const back = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let f = 0; f < 8; f++) {
    b[f] = `w${back[f]}`;
    b[8 + f] = "wP";
    b[48 + f] = "bP";
    b[56 + f] = `b${back[f]}`;
  }
  return b;
}

/** One half-move as the room shows it: from, to, the rook's hop when castling, and what it took (null: nothing). */
export interface Ply {
  from: number;
  to: number;
  piece: Piece;
  took: Piece | null;
  /** Castling: the rook's from and to. */
  rook: readonly [number, number] | null;
}

/** Every half-move, and the board before each (`boards[i]` before ply i; `boards[82]` the mate). Worked out once. */
export const RECLUSE_GAME: { plies: readonly Ply[]; boards: readonly Board[] } = (() => {
  const plies: Ply[] = [];
  const boards: Board[] = [];
  let b = startBoard();
  for (const m of RECLUSE_GAME_UCI) {
    boards.push(b);
    const from = sqOf(m.slice(0, 2));
    const to = sqOf(m.slice(2, 4));
    const piece = b[from]!;
    const next = b.slice();
    // (No en passant or promotion in this game; castling moves its rook too.)
    const rook: readonly [number, number] | null = piece[1] === "K" && Math.abs(to - from) === 2 ? (to > from ? [from + 3, from + 1] : [from - 4, from - 1]) : null;
    next[to] = piece;
    next[from] = null;
    if (rook) {
      next[rook[1]] = next[rook[0]]!;
      next[rook[0]] = null;
    }
    plies.push({ from, to, piece, took: b[to] ?? null, rook });
    b = next;
  }
  boards.push(b);
  return { plies, boards };
})();

/**
 * The steps of one half-move, in order (round 3, Nov 13: the board turned sideways, White's side on our left, Black's on our right).
 * Each half-move he gets up from the side he just played (`rise`), walks round behind the board to the side whose move it is
 * (`walk`), sits back on his heels centered on that side (`sit`), thinks, leans in and plays (reach, carry, back), and looks up.
 */
export type Step = "rise" | "walk" | "sit" | "think" | "reach" | "carry" | "back" | "look";
/** Where the child is in his loop. */
export interface KidNow {
  /** The half-move being played (or just played, while he looks); -1 before the first; 82 once the game's over. */
  ply: number;
  step: Step | "end" | "fade";
  /** How far through the step (0 to 1). */
  u: number;
  /** The board shown: before `ply` until the piece is put down, after it from then. */
  board: Board;
  /** The fade back to the start (0 to 1 to 0): the pieces' see-through-ness; 0 at any other time. */
  fade: number;
}

const F = HIDDEN_ROOM_FEEL.play;
const K = HIDDEN_ROOM_FEEL.kid;
const HALF = K.board / 2;
/**
 * His places round the board, in squares from its middle (+y toward us): `seat`, how far out from the middle he sits on each side
 * (his knees 8 of his drawing's pixels from his foot, just short of the board's edge: recluse-ages.ts `sideBody`); `lane`, how far out
 * he walks past the board's sides; `behind`, the row he walks along behind it (never between us and the board).
 */
export const KID_SPOTS = { seat: HALF + (8 * K.scale) / 37, lane: HALF + 0.4, behind: HALF + 0.38 } as const;
/** Which side he plays half-move `i` from: -1 White's (our left), 1 Black's (our right). Before the first move he's on Black's. */
export const sideOf = (i: number): -1 | 1 => (i % 2 ? 1 : -1);
/** His way from the side he last played to half-move `i`'s side, round behind the board, in squares from its middle. */
export function walkPath(i: number): readonly (readonly [number, number])[] {
  const { seat, lane, behind } = KID_SPOTS;
  const s = sideOf(i);
  return [[-s * seat, 0], [-s * lane, -0.25], [-s * lane, -behind], [s * lane, -behind], [s * lane, -0.25], [s * seat, 0]];
}
const pathLen = (pts: readonly (readonly [number, number])[]) => pts.slice(1).reduce((n, q, i) => n + Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]), 0);
/** Each half-move's own think (ms): each move different, 0.6 to 1.6 times the setting (a fixed pattern, no randomness). */
export const thinkOf = (i: number): number => Math.round(F.think * (0.6 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1));
/** The steps of half-move `i` and their lengths (ms). */
export function stepsOf(i: number): readonly (readonly [Step, number])[] {
  const walk = Math.round((pathLen(walkPath(i)) / F.walk) * 1000);
  return [["rise", F.rise], ["walk", walk], ["sit", F.sit], ["think", thinkOf(i)], ["reach", F.reach], ["carry", F.carry], ["back", F.back], ["look", F.look]];
}
/** When each half-move starts in the loop (ms), and the last one's end: `PLY_AT[82]`. */
export const PLY_AT: readonly number[] = (() => {
  const out: number[] = [F.first];
  for (let i = 0; i < RECLUSE_GAME_UCI.length; i++) out.push(out[i]! + stepsOf(i).reduce((n, [, ms]) => n + ms, 0));
  return out;
})();
/** The whole loop: every half-move, the pause on the mate, the fade back to the start, and its hold. */
export const LOOP_MS = PLY_AT[RECLUSE_GAME_UCI.length]! + F.end + F.fade;
const PUT_DOWN = new Set<Step>(["back", "look"]);

/** Where the child is in his loop at `t` (ms on the room's clock). */
export function kidAt(t: number): KidNow {
  const { plies, boards } = RECLUSE_GAME;
  const u = ((t % LOOP_MS) + LOOP_MS) % LOOP_MS;
  if (u < F.first) return { ply: -1, step: "look", u: u / F.first, board: boards[0]!, fade: 0 };
  const n = plies.length;
  if (u < PLY_AT[n]!) {
    // (The half-move: the last start at or before now.)
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (PLY_AT[mid]! <= u) lo = mid;
      else hi = mid - 1;
    }
    let w = u - PLY_AT[lo]!;
    for (const [step, ms] of stepsOf(lo)) {
      if (w < ms) return { ply: lo, step, u: w / ms, board: PUT_DOWN.has(step) ? boards[lo + 1]! : boards[lo]!, fade: 0 };
      w -= ms;
    }
  }
  const after = u - PLY_AT[n]!;
  if (after < F.end) return { ply: n, step: "end", u: after / F.end, board: boards[n]!, fade: 0 };
  // The fade: the mate's pieces fade out, the start's fade in (the same pieces' see-through-ness, the board swapped at its middle).
  const v = Math.min(1, (after - F.end) / F.fade);
  return { ply: n, step: "fade", u: v, board: v < 0.5 ? boards[n]! : boards[0]!, fade: v < 0.5 ? v * 2 : (1 - v) * 2 };
}
