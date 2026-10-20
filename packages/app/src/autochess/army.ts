import { AUTOCHESS, mulberry32, type AutoChessSettings } from "@chessroyale/core";
import { KIND_NAME, KINDS, other, type Army, type Color, type Kind } from "./types.ts";

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

export const emptyArmy = (color: Color, king: string): Army => ({ color, king, board: {}, bench: [] });

/** How many of each kind a side owns (the board and the bench). */
export function owned(army: Army): Record<Kind, number> {
  const n: Record<Kind, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  for (const k of Object.values(army.board)) n[k]++;
  for (const k of army.bench) n[k]++;
  return n;
}

/** Pieces beyond the starting set (a second queen, a third rook, bishop or knight...): each would need a promoted pawn. */
export function extras(n: Record<Kind, number>): number {
  return Math.max(0, n.q - 1) + Math.max(0, n.r - 2) + Math.max(0, n.b - 2) + Math.max(0, n.n - 2);
}

/** The engine refuses a side with more than 8 pawns, or more extra pieces than the pawns it is missing. */
export const legalCounts = (n: Record<Kind, number>, cfg: AutoChessSettings = AUTOCHESS) => n.p <= cfg.maxPawns && n.p + extras(n) <= cfg.maxPawns;

export const priceOf = (kind: Kind, cfg: AutoChessSettings = AUTOCHESS) => cfg.prices[kind];
/** What selling gives back: 90%, rounded down (P9 N27 B28 R45 Q81). */
export const sellValue = (kind: Kind, cfg: AutoChessSettings = AUTOCHESS) => Math.floor(cfg.prices[kind] * cfg.sellBack);

export type BuyBlock = "queen" | "pawns" | "extras" | "bench" | "gold";

/** Why this piece can't be bought now, or null. The limits come first (they hold all round), then the bench, then gold. */
export function buyBlock(army: Army, gold: number, kind: Kind, cfg: AutoChessSettings = AUTOCHESS): BuyBlock | null {
  const n = owned(army);
  if (kind === "q" && n.q >= cfg.queenLimit) return "queen";
  if (kind === "p" && n.p >= cfg.maxPawns) return "pawns";
  n[kind]++;
  if (!legalCounts(n, cfg)) return "extras";
  if (army.bench.length >= cfg.benchSlots) return "bench";
  if (gold < cfg.prices[kind]) return "gold";
  return null;
}

/** The shop's words for a piece that can't be bought: short (under its price) and whole (the line over the bench). */
export function buyWords(block: BuyBlock, kind: Kind, gold: number, cfg: AutoChessSettings = AUTOCHESS): { short: string; line: string } {
  const name = KIND_NAME[kind];
  switch (block) {
    case "gold":
      return { short: "No gold", line: `Not enough gold: a ${name} costs ${cfg.prices[kind]} and you have ${gold}.` };
    case "bench":
      return { short: "Bench full", line: "Your bench is full. Place or sell a piece first." };
    case "queen":
      return { short: "Max 1", line: cfg.queenLimit === 1 ? "One queen a round." : `${cfg.queenLimit} queens a round at most.` };
    case "pawns":
      return { short: "Max 8", line: `${cfg.maxPawns} pawns at most.` };
    case "extras":
      return { short: "Too many", line: `Too many pieces: pawns plus extra pieces (past 1 queen, 2 rooks, 2 bishops and 2 knights) can't pass ${cfg.maxPawns}.` };
  }
}

/** How many pieces stand on the board (the king not counted). */
export const boardCount = (army: Army) => Object.keys(army.board).length;

export type PlaceBlock = "fixed" | "half" | "king" | "taken" | "limit" | "backrank" | "file";

/** A pawn on this square has had its one pick-up: it can't be moved again (selling it is still allowed). */
export const pawnFixed = (army: Army, square: string) => army.board[square] === "p" && !!army.fixed?.includes(square);
/** The pawn in this bench slot has had its one pick-up: its next placement is final. */
export const benchFixed = (army: Army, index: number) => !!army.benchFixed?.includes(index);

/** The army with these marks (a key only when it has something, so plain armies stay plain). */
function marked(army: Army, fixed: string[], benchFixedSlots: number[]): Army {
  const { fixed: _f, benchFixed: _b, ...rest } = army;
  return { ...rest, ...(fixed.length ? { fixed } : {}), ...(benchFixedSlots.length ? { benchFixed: benchFixedSlots } : {}) };
}

/**
 * Why `kind` can't stand on `square` of this army's half now, or null. `from`: the square it's moving from (so a pawn
 * moving along its own file isn't counted twice, and a piece already on the board doesn't count against the board's limit).
 */
export function placeBlock(army: Army, kind: Kind, square: string, from?: string, cfg: AutoChessSettings = AUTOCHESS): PlaceBlock | null {
  if (from !== undefined && pawnFixed(army, from)) return "fixed";
  if (!inHalf(square, army.color)) return "half";
  if (square === army.king) return "king";
  if (army.board[square] && square !== from) return "taken";
  if (from === undefined && boardCount(army) >= cfg.boardLimit) return "limit";
  if (kind === "p") {
    if (rankOf(square) === backRank(army.color)) return "backrank";
    const inFile = Object.entries(army.board).filter(([sq, k]) => k === "p" && sq !== from && fileOf(sq) === fileOf(square)).length;
    if (inFile >= cfg.pawnsPerFile) return "file";
  }
  return null;
}

export function placeWords(block: PlaceBlock, cfg: AutoChessSettings = AUTOCHESS): string {
  switch (block) {
    case "fixed":
      return "This pawn can't move again. You can still sell it.";
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

/** Buys a piece onto the bench (the caller checked `buyBlock`). */
export const buy = (army: Army, kind: Kind): Army => ({ ...army, bench: [...army.bench, kind] });

/** The bench slots' marks after slot `index` leaves the bench (the later slots move up). */
const afterLeaving = (slots: readonly number[] | undefined, index: number) => (slots ?? []).filter((i) => i !== index).map((i) => (i > index ? i - 1 : i));

/** Puts the bench piece at `index` on `square` (the caller checked `placeBlock`). A pawn that had been picked up is final there. */
export function placeFromBench(army: Army, index: number, square: string): Army {
  const kind = army.bench[index]!;
  const next = { ...army, board: { ...army.board, [square]: kind }, bench: army.bench.filter((_, i) => i !== index) };
  return marked(next, benchFixed(army, index) ? [...(army.fixed ?? []), square] : (army.fixed ?? []), afterLeaving(army.benchFixed, index));
}

/** Moves a piece already on the board to another square of the half (the caller checked `placeBlock`). A pawn's move is its one pick-up: it is final there. */
export function moveOnBoard(army: Army, from: string, to: string): Army {
  const { [from]: kind, ...rest } = army.board;
  const fixed = (army.fixed ?? []).filter((sq) => sq !== from);
  return marked({ ...army, board: { ...rest, [to]: kind! } }, kind === "p" ? [...fixed, to] : fixed, army.benchFixed ?? []);
}

/** Takes a piece off the board onto the bench (the caller checked there is room and, for a pawn, that it wasn't final). A pawn's next placement is final. */
export function toBench(army: Army, from: string): Army {
  const { [from]: kind, ...rest } = army.board;
  const slots = army.benchFixed ?? [];
  return marked({ ...army, board: rest, bench: [...army.bench, kind!] }, (army.fixed ?? []).filter((sq) => sq !== from), kind === "p" ? [...slots, army.bench.length] : slots);
}

/**
 * Where a piece goes when it drops by itself: the first good empty square, pawns in front (the third rank from home, then the
 * fourth, then the second) and pieces behind (home, then the second, then the third), files from the left of the screen (your
 * half is at the bottom: White's a to h, Black's h to a), by the usual placement rules. Null if there is none.
 */
export function firstGoodSquare(army: Army, kind: Kind, cfg: AutoChessSettings = AUTOCHESS): string | null {
  const home = backRank(army.color);
  const dir = army.color === "w" ? 1 : -1;
  const ranks = kind === "p" ? [home + 2 * dir, home + 3 * dir, home + dir] : [home, home + dir, home + 2 * dir];
  const files = army.color === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const squares = [...ranks.flatMap((rank) => files.map((f) => squareOf(f, rank))), ...halfSquares(army.color)];
  return squares.find((sq) => !placeBlock(army, kind, sq, undefined, cfg)) ?? null;
}

/**
 * When the buying step ends: the pieces still on the bench drop onto the board by themselves, left to right in bench order,
 * each on its first good square, until the board has `autoDropTo` pieces (Eric: "if you already have 8 and then you have 2
 * sitting on your rack, then they won't drop in"). The rest stay on the bench. `dropped`: how many went.
 */
export function autoDrop(army: Army, cfg: AutoChessSettings = AUTOCHESS): { army: Army; dropped: number } {
  let cur = army;
  let dropped = 0;
  let i = 0;
  while (i < cur.bench.length && boardCount(cur) < cfg.autoDropTo) {
    const square = firstGoodSquare(cur, cur.bench[i]!, cfg);
    if (square) {
      cur = placeFromBench(cur, i, square);
      dropped++;
    } else i++;
  }
  return { army: cur, dropped };
}

/** Sells a piece (the bench slot `index`, or the board's `square`): the army without it, and the gold it gives. */
export function sellPiece(army: Army, at: { bench: number } | { square: string }, cfg: AutoChessSettings = AUTOCHESS): { army: Army; gold: number } {
  if ("bench" in at) {
    const kind = army.bench[at.bench]!;
    return { army: marked({ ...army, bench: army.bench.filter((_, i) => i !== at.bench) }, army.fixed ?? [], afterLeaving(army.benchFixed, at.bench)), gold: sellValue(kind, cfg) };
  }
  const { [at.square]: kind, ...rest } = army.board;
  return { army: marked({ ...army, board: rest }, (army.fixed ?? []).filter((sq) => sq !== at.square), army.benchFixed ?? []), gold: sellValue(kind!, cfg) };
}

/** The pieces standing on the board, in a steady order (square names sorted). */
export const boardPieces = (army: Army): { square: string; kind: Kind }[] =>
  Object.entries(army.board)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([square, kind]) => ({ square, kind }));

export { KINDS, other };
