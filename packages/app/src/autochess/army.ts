import { AUTOCHESS, mulberry32, type AutoChessSettings } from "@chessroyale/core";
import { KIND_NAME, KINDS, other, type Army, type Color, type Kind, type Offer } from "./types.ts";

/**
 * The squares, the shop's and the board's limits, and the buying, placing and selling that follow them. Every check
 * returns why it said no (a code the screen turns into words: `buyWords`, `placeWords`), or null for yes.
 */

export const FILES = "abcdefgh";
const rankOf = (sq: string) => Number(sq[1]);
const fileOf = (sq: string) => sq.charCodeAt(0) - 97;
export const squareOf = (file: number, rank: number) => `${FILES[file]}${rank}`;
export const onBoard = (file: number, rank: number) => file >= 0 && file < 8 && rank >= 1 && rank <= 8;

/** A side's half: White's is ranks 1 to 4, Black's 5 to 8. */
export const inHalf = (sq: string, color: Color) => (color === "w" ? rankOf(sq) <= 4 : rankOf(sq) >= 5);
export const backRank = (color: Color) => (color === "w" ? 1 : 8);

/** Every square of a side's half. */
export function halfSquares(color: Color): string[] {
  const out: string[] = [];
  for (let rank = 1; rank <= 8; rank++) for (let f = 0; f < 8; f++) if (inHalf(squareOf(f, rank), color)) out.push(squareOf(f, rank));
  return out;
}

/**
 * Where the game puts both kings in a round: one random file, on one of each side's back `kingRanks` ranks, mirrored (the
 * same file, the rank mirrored), seeded by the round.
 */
export function kingSquares(seed: number, cfg: AutoChessSettings = AUTOCHESS): { w: string; b: string } {
  const rng = mulberry32(seed);
  const file = Math.floor(rng() * 8);
  const rank = 1 + Math.floor(rng() * cfg.kingRanks);
  return { w: squareOf(file, rank), b: squareOf(file, 9 - rank) };
}

export const emptyArmy = (color: Color, king: string): Army => ({ color, king, board: {} });

/** How many of each kind a side owns (on the board). */
export function owned(army: Army): Record<Kind, number> {
  const n: Record<Kind, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  for (const k of Object.values(army.board)) n[k]++;
  return n;
}

/** Pieces beyond the starting set (a second queen, a third rook, bishop or knight...): each would need a promoted pawn. */
export function extras(n: Record<Kind, number>): number {
  return Math.max(0, n.q - 1) + Math.max(0, n.r - 2) + Math.max(0, n.b - 2) + Math.max(0, n.n - 2);
}

/** The engine refuses a side with more than 8 pawns, or more extra pieces than the pawns it is missing. */
export const legalCounts = (n: Record<Kind, number>, cfg: AutoChessSettings = AUTOCHESS) => n.p <= cfg.maxPawns && n.p + extras(n) <= cfg.maxPawns;

export const priceOf = (kind: Kind, cfg: AutoChessSettings = AUTOCHESS) => cfg.prices[kind];
/** What selling gives back: a share (`sellBack`) of the price, rounded down. */
export const sellValue = (kind: Kind, cfg: AutoChessSettings = AUTOCHESS) => Math.floor(cfg.prices[kind] * cfg.sellBack);

/** Why a piece of this kind can't be owned now (the legal-position limits count what you own): a limit, or null. */
export type KindBlock = "queen" | "pawns" | "extras";

export function kindBlock(army: Army, kind: Kind, cfg: AutoChessSettings = AUTOCHESS): KindBlock | null {
  const n = owned(army);
  if (kind === "q" && n.q >= cfg.queenLimit) return "queen";
  if (kind === "p" && n.p >= cfg.maxPawns) return "pawns";
  n[kind]++;
  if (!legalCounts(n, cfg)) return "extras";
  return null;
}

/** How many pieces stand on the board (the king not counted). */
export const boardCount = (army: Army) => Object.keys(army.board).length;

export type BuyBlock = KindBlock | "limit" | "taken" | "gold";

/** Why this offer can't be bought now, or null. The limits come first (they hold all round), then the board, then gold. */
export function buyBlock(army: Army, gold: number, offer: Offer, cfg: AutoChessSettings = AUTOCHESS): BuyBlock | null {
  const limit = kindBlock(army, offer.kind, cfg);
  if (limit) return limit;
  // (An offer is rolled onto a usable square; if it has stopped being one, a piece stands on it now.)
  if (squareBlock(army, offer.kind, offer.square, undefined, cfg)) return "taken";
  if (boardCount(army) >= cfg.boardLimit) return "limit";
  if (gold < cfg.prices[offer.kind]) return "gold";
  return null;
}

/** An offer's label under its piece: "Bishop c2". */
export const offerLabel = (offer: Offer) => `${KIND_NAME[offer.kind][0]!.toUpperCase()}${KIND_NAME[offer.kind].slice(1)} ${offer.square}`;

/** The shop's words for an offer that can't be bought: short (under its price) and whole (the line under the board). */
export function buyWords(block: BuyBlock, offer: Offer, gold: number, cfg: AutoChessSettings = AUTOCHESS): { short: string; line: string } {
  const name = KIND_NAME[offer.kind];
  switch (block) {
    case "gold":
      return { short: "No gold", line: `Not enough gold: a ${name} costs ${cfg.prices[offer.kind]} and you have ${gold}.` };
    case "limit":
      return { short: "Board full", line: placeWords("limit", cfg) };
    case "taken":
      return { short: "Taken", line: `${offer.square} is taken.` };
    case "queen":
      return { short: "Max 1", line: cfg.queenLimit === 1 ? "One queen a round." : `${cfg.queenLimit} queens a round at most.` };
    case "pawns":
      return { short: "Max 8", line: `${cfg.maxPawns} pawns at most.` };
    case "extras":
      return { short: "Too many", line: `Too many pieces: pawns plus extra pieces (past 1 queen, 2 rooks, 2 bishops and 2 knights) can't pass ${cfg.maxPawns}.` };
  }
}

export type SquareBlock = "half" | "king" | "taken" | "backrank" | "file";
export type PlaceBlock = SquareBlock | "limit";

/**
 * Why `kind` can't stand on `square` of this army's half now, whatever the board's limit says, or null: the square is not on
 * the half, is the king's, is taken, or (a pawn) is the back rank or a fourth in its file. `from`: the square the piece is
 * moving from (so a pawn moving along its own file isn't counted twice).
 */
export function squareBlock(army: Army, kind: Kind, square: string, from?: string, cfg: AutoChessSettings = AUTOCHESS): SquareBlock | null {
  if (!inHalf(square, army.color)) return "half";
  if (square === army.king) return "king";
  if (army.board[square] && square !== from) return "taken";
  if (kind === "p") {
    if (rankOf(square) === backRank(army.color)) return "backrank";
    const inFile = Object.entries(army.board).filter(([sq, k]) => k === "p" && sq !== from && fileOf(sq) === fileOf(square)).length;
    if (inFile >= cfg.pawnsPerFile) return "file";
  }
  return null;
}

/** Why `kind` can't be put on `square` now, or null: the square's rules, then the board's limit (a piece already on the board, `from`, doesn't count against it). */
export function placeBlock(army: Army, kind: Kind, square: string, from?: string, cfg: AutoChessSettings = AUTOCHESS): PlaceBlock | null {
  const block = squareBlock(army, kind, square, from, cfg);
  if (block) return block;
  if (from === undefined && boardCount(army) >= cfg.boardLimit) return "limit";
  return null;
}

export function placeWords(block: PlaceBlock, cfg: AutoChessSettings = AUTOCHESS): string {
  switch (block) {
    case "half":
      return "Pieces go on your half of the board.";
    case "king":
      return "That's your king's square.";
    case "taken":
      return "That square is taken.";
    case "limit":
      return `Your board is full: ${cfg.boardLimit} pieces and your king at most.`;
    case "backrank":
      return "Pawns can't stand on your back rank.";
    case "file":
      return `${cfg.pawnsPerFile} pawns a file at most.`;
  }
}

/**
 * The squares an offer of this kind may be rolled onto: the empty squares of your half you could use (not your king's; a pawn
 * never on your back rank or a fourth in its file, so its ranks are the 2nd to the 4th).
 */
export const usableSquares = (army: Army, kind: Kind, cfg: AutoChessSettings = AUTOCHESS): string[] => halfSquares(army.color).filter((sq) => !squareBlock(army, kind, sq, undefined, cfg));

/** Buys an offer: the piece lands on its square (the caller checked `buyBlock`). */
export const buyOffer = (army: Army, offer: Offer): Army => ({ ...army, board: { ...army.board, [offer.square]: offer.kind } });

/** Sells a piece standing on the board: the army without it, and the gold it gives. */
export function sellPiece(army: Army, square: string, cfg: AutoChessSettings = AUTOCHESS): { army: Army; gold: number } {
  const { [square]: kind, ...rest } = army.board;
  return { army: { ...army, board: rest }, gold: sellValue(kind!, cfg) };
}

/** The pieces standing on the board, in a steady order (square names sorted). */
export const boardPieces = (army: Army): { square: string; kind: Kind }[] =>
  Object.entries(army.board)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([square, kind]) => ({ square, kind }));

export { KINDS, other };
