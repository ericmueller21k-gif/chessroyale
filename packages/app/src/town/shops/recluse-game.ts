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

/** The steps of one half-move, in order. */
export type Step = "think" | "reach" | "carry" | "back" | "look";
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
/** One half-move's length (ms). */
export const PLY_MS = F.think + F.reach + F.carry + F.back + F.look;
/** The whole loop: every half-move, the pause on the mate, the fade back to the start, and its hold. */
export const LOOP_MS = F.first + RECLUSE_GAME_UCI.length * PLY_MS + F.end + F.fade;

/** Where the child is in his loop at `t` (ms on the room's clock). */
export function kidAt(t: number): KidNow {
  const { plies, boards } = RECLUSE_GAME;
  let u = ((t % LOOP_MS) + LOOP_MS) % LOOP_MS;
  if (u < F.first) return { ply: -1, step: "look", u: u / F.first, board: boards[0]!, fade: 0 };
  u -= F.first;
  const i = Math.floor(u / PLY_MS);
  if (i < plies.length) {
    let w = u - i * PLY_MS;
    const steps: [Step, number][] = [["think", F.think], ["reach", F.reach], ["carry", F.carry], ["back", F.back], ["look", F.look]];
    for (const [step, ms] of steps) {
      if (w < ms) return { ply: i, step, u: w / ms, board: step === "back" || step === "look" ? boards[i + 1]! : boards[i]!, fade: 0 };
      w -= ms;
    }
  }
  const after = u - plies.length * PLY_MS;
  if (after < F.end) return { ply: plies.length, step: "end", u: after / F.end, board: boards[plies.length]!, fade: 0 };
  // The fade: the mate's pieces fade out, the start's fade in (the same pieces' see-through-ness, the board swapped at its middle).
  const v = Math.min(1, (after - F.end) / F.fade);
  return { ply: plies.length, step: "fade", u: v, board: v < 0.5 ? boards[plies.length]! : boards[0]!, fade: v < 0.5 ? v * 2 : (1 - v) * 2 };
}
