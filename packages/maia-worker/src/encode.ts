// Maia box (AGPL-3.0, see LICENSE): the model's input and output vocabulary, as the official Maia-3 code defines
// them (CSSLab/maia3: maia3/dataset.py tokenize_board, maia3/utils.py get_all_possible_moves and mirror_move).
// Checked against the official tokenizer's own output in test/fixtures/encoding.json.

/** Boards of history the model takes; the official engine repeats the current board when it has none. */
export const HISTORY = 8;
/** Planes per square: the mover's P N B R Q K, then the opponent's. */
export const PLANES = 12;
/** 64 × 64 from-to moves, then 8 × 8 × 4 promotions. */
export const VOCAB = 4096 + 256;

const PIECES = "pnbrqk";
const PROMOTIONS = "qrbn";

const square = (name: string): number => name.charCodeAt(0) - 97 + (Number(name[1]) - 1) * 8;

/** Whether Black is to move in a FEN. */
export const blackToMove = (fen: string): boolean => fen.split(" ")[1] === "b";

/**
 * One board as the model sees it: 64 squares × 12 planes (index square × 12 + plane), a1 = 0 … h8 = 63, from the
 * mover's side: when Black is to move the board is mirrored top to bottom and the colours swapped, so the mover is
 * always "White" moving up the board.
 */
export function encodeBoard(fen: string): Float32Array {
  const [placement = "", turn] = fen.trim().split(/\s+/);
  const black = turn === "b";
  const out = new Float32Array(64 * PLANES);
  const rows = placement.split("/");
  if (rows.length !== 8) throw new Error(`bad FEN: ${fen}`);
  rows.forEach((row, r) => {
    const rank = 7 - r;
    let file = 0;
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") {
        file += Number(ch);
        continue;
      }
      const type = PIECES.indexOf(ch.toLowerCase());
      if (type < 0 || file > 7) throw new Error(`bad FEN: ${fen}`);
      const white = ch !== ch.toLowerCase();
      const mine = white !== black;
      const sq = file + 8 * (black ? 7 - rank : rank);
      out[sq * PLANES + type + (mine ? 0 : 6)] = 1;
      file++;
    }
  });
  return out;
}

/** The model's whole input for a position: the current board repeated for every board of history (64 × 96). */
export function encodeTokens(fen: string, history = HISTORY): Float32Array {
  const board = encodeBoard(fen);
  const out = new Float32Array(64 * PLANES * history);
  for (let sq = 0; sq < 64; sq++) {
    for (let h = 0; h < history; h++) out.set(board.subarray(sq * PLANES, sq * PLANES + PLANES), sq * PLANES * history + h * PLANES);
  }
  return out;
}

/** A move (UCI, as played on the real board) to its index in the model's output, seen from the mover's side. */
export function moveIndex(uci: string, black: boolean): number {
  let from = square(uci.slice(0, 2));
  let to = square(uci.slice(2, 4));
  if (black) {
    from ^= 56;
    to ^= 56;
  }
  const promo = uci[4];
  if (promo) return 4096 + ((from % 8) * 8 + (to % 8)) * 4 + PROMOTIONS.indexOf(promo);
  return from * 64 + to;
}

/** The move an output index stands for, on the real board (the inverse of moveIndex). */
export function indexMove(index: number, black: boolean): string {
  const name = (sq: number) => String.fromCharCode(97 + (sq % 8)) + String(Math.floor(sq / 8) + 1);
  const flip = (sq: number) => (black ? sq ^ 56 : sq);
  if (index >= 4096) {
    const k = index - 4096;
    const piece = PROMOTIONS[k % 4]!;
    const toFile = Math.floor(k / 4) % 8;
    const fromFile = Math.floor(k / 32);
    return name(flip(48 + fromFile)) + name(flip(56 + toFile)) + piece;
  }
  return name(flip(Math.floor(index / 64))) + name(flip(index % 64));
}
