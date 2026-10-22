import { AUTOCHESS, mulberry32, type AutoChessSettings } from "@chessroyale/core";
import { KIND_NAME, KINDS, other, type Army, type Color, type Held, type Kind, type Offer, type StarCount } from "./types.ts";

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

export const emptyArmy = (color: Color, king: string, bench: Held[] = []): Army => ({ color, king, board: {}, bench });

/** How many of each kind a side owns (on the board and held on the bench). */
export function owned(army: Army): Record<Kind, number> {
  const n: Record<Kind, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  for (const k of Object.values(army.board)) n[k]++;
  for (const o of army.bench) n[o.kind]++;
  return n;
}

/** Pieces beyond the starting set (a second queen, a third rook, bishop or knight...): each would need a promoted pawn. */
export function extras(n: Record<Kind, number>): number {
  return Math.max(0, n.q - 1) + Math.max(0, n.r - 2) + Math.max(0, n.b - 2) + Math.max(0, n.n - 2);
}

/** The engine refuses a side with more than 8 pawns, or more extra pieces than the pawns it is missing. */
export const legalCounts = (n: Record<Kind, number>, cfg: AutoChessSettings = AUTOCHESS) => n.p <= cfg.maxPawns && n.p + extras(n) <= cfg.maxPawns;

export const priceOf = (kind: Kind, cfg: AutoChessSettings = AUTOCHESS) => cfg.prices[kind];
/** What a piece has cost in all: its price, and `starUpCost` for each star above the first (v8). */
export const paidFor = (kind: Kind, stars = 1, cfg: AutoChessSettings = AUTOCHESS) => cfg.prices[kind] + cfg.starUpCost * Math.max(0, stars - 1);
/** What selling gives back: a share (`sellBack`) of everything paid for the piece (its price and its star-ups), rounded down. */
export const sellValue = (kind: Kind, cfg: AutoChessSettings = AUTOCHESS, stars = 1) => Math.floor(paidFor(kind, stars, cfg) * cfg.sellBack);

// ---------------------------------------------------------------------------------------------------------------------
// Stars (v8, Eric Oct 22)

/** The stars of the piece on this square of the board: 1 (plain), 2 or 3. */
export const starsAt = (army: Army, square: string): number => army.stars?.[square] ?? 1;
/** The stars of a held piece: 1 (plain), 2 or 3. */
export const heldStars = (h: Held): number => h.stars ?? 1;

/** Whether a piece of this kind with this many stars can star up: not a pawn (nor the king), and not yet at the top. */
export const canStarUp = (kind: Kind | "k", stars: number, cfg: AutoChessSettings = AUTOCHESS) => kind !== "p" && kind !== "k" && stars < cfg.maxStars;

/** An army with these stars on its board (the key is left off when nothing is starred, so a plain army stays plain data). */
export function withStars(army: Army, stars: Record<string, StarCount>): Army {
  const { stars: _old, ...rest } = army;
  return Object.keys(stars).length ? { ...rest, stars } : rest;
}

/** The star-up an offer would be, for this army: the piece it merges into and the stars it will have. */
export type StarTarget = { where: "board"; square: string; becomes: StarCount } | { where: "bench"; index: number; becomes: StarCount };

/**
 * The piece of yours an offer would star up, or null if it is an ordinary new piece. **Any offer whose kind and square match a piece of
 * yours that can star up merges into it** (v8, Eric Oct 22), whether the shop meant it as a star-up or rolled a new piece that happens to match:
 * the piece standing on the square (the board's first), else a piece held on the bench for that square.
 */
export function starUpTarget(army: Army, offer: Offer, cfg: AutoChessSettings = AUTOCHESS): StarTarget | null {
  const onBoard = army.board[offer.square];
  if (onBoard === offer.kind && canStarUp(onBoard, starsAt(army, offer.square), cfg)) return { where: "board", square: offer.square, becomes: (starsAt(army, offer.square) + 1) as StarCount };
  const index = army.bench.findIndex((h) => h.kind === offer.kind && h.square === offer.square && canStarUp(h.kind, heldStars(h), cfg));
  return index >= 0 ? { where: "bench", index, becomes: (heldStars(army.bench[index]!) + 1) as StarCount } : null;
}

/** The star-up done: the piece gains a star where it is (the caller checked the gold). */
export function starUp(army: Army, target: StarTarget): Army {
  if (target.where === "board") return withStars(army, { ...army.stars, [target.square]: target.becomes });
  return { ...army, bench: army.bench.map((h, i) => (i === target.index ? { ...h, stars: target.becomes } : h)) };
}

/** Every piece of yours that can star up, by the square it stands on or is held for (the board's and the bench's, one entry each): where the shop may offer a star-up. */
export function starrablePieces(army: Army, cfg: AutoChessSettings = AUTOCHESS): { square: string; kind: Kind }[] {
  const out: { square: string; kind: Kind }[] = [];
  for (const [square, kind] of Object.entries(army.board)) if (canStarUp(kind, starsAt(army, square), cfg)) out.push({ square, kind });
  for (const h of army.bench) if (canStarUp(h.kind, heldStars(h), cfg)) out.push({ square: h.square, kind: h.kind });
  return out;
}

/** What buying this offer costs now: `starUpCost` for a star-up, else the piece's price. */
export const offerPrice = (army: Army, offer: Offer, cfg: AutoChessSettings = AUTOCHESS) => (starUpTarget(army, offer, cfg) ? cfg.starUpCost : cfg.prices[offer.kind]);

/** The number of star-ups paid for in a set of stars (a 2-star is one, a 3-star two): what the survivors' refund counts besides the prices. */
export const starUpsIn = (stars: Readonly<Record<string, number>> | undefined): number => Object.values(stars ?? {}).reduce((n, s) => n + (s - 1), 0);

/** How many starred pieces stand on the board. */
export const starredCount = (army: Army): number => Object.keys(army.stars ?? {}).filter((sq) => army.board[sq]).length;

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

/**
 * Why this offer can't be bought onto the board now, or null. The limits come first (they hold all round), then the square, then
 * the board's room (`limit`: how many pieces it may hold), then gold.
 */
export function buyBlock(army: Army, gold: number, offer: Offer, cfg: AutoChessSettings = AUTOCHESS, limit: number = cfg.levels.max): BuyBlock | null {
  // A star-up adds no piece, so no limit applies to it (a queen's with your one queen out, a full board's): only the gold.
  if (starUpTarget(army, offer, cfg)) return gold < cfg.starUpCost ? "gold" : null;
  const kind = kindBlock(army, offer.kind, cfg);
  if (kind) return kind;
  // (An offer is rolled onto a usable square; if it has stopped being one, a piece stands on it now.)
  if (squareBlock(army, offer.kind, offer.square, undefined, cfg)) return "taken";
  if (boardCount(army) >= limit) return "limit";
  if (gold < cfg.prices[offer.kind]) return "gold";
  return null;
}

export type HoldBlock = KindBlock | "bench" | "gold" | "starup";

/** Why this offer can't be bought to be held on the bench, or null: the limits, then the bench's room, then gold. */
export function holdBlock(army: Army, gold: number, offer: Offer, cfg: AutoChessSettings = AUTOCHESS): HoldBlock | null {
  // (A star-up merges where the piece is: there is nothing to hold.)
  if (starUpTarget(army, offer, cfg)) return "starup";
  const kind = kindBlock(army, offer.kind, cfg);
  if (kind) return kind;
  if (army.bench.length >= cfg.benchSlots) return "bench";
  if (gold < cfg.prices[offer.kind]) return "gold";
  return null;
}

/** An offer's label under its piece: "Bishop c2". */
export const offerLabel = (offer: Offer) => `${KIND_NAME[offer.kind][0]!.toUpperCase()}${KIND_NAME[offer.kind].slice(1)} ${offer.square}`;

/**
 * The shop's words for an offer that can't be bought: `short` (a card's reason, for its label) and `line` (what the small spot under
 * the board says when it is tapped: short words, about 15 characters a line, never an explanation).
 */
export function buyWords(
  block: BuyBlock | HoldBlock,
  offer: Offer,
  gold: number,
  cfg: AutoChessSettings = AUTOCHESS,
  limit: number = cfg.levels.max,
  price: number = cfg.prices[offer.kind],
): { short: string; line: string } {
  switch (block) {
    case "starup":
      return { short: "Star up", line: "Tap to star up" };
    case "gold":
      return { short: "No gold", line: `Need ${price - gold} more` };
    case "limit":
      return { short: "Level full", line: placeWords("limit", cfg, limit) };
    case "bench":
      return { short: "Bench full", line: "Bench full" };
    case "taken":
      return { short: "Taken", line: `${offer.square} is taken` };
    case "queen":
      return { short: "Max 1", line: cfg.queenLimit === 1 ? "One queen max" : `${cfg.queenLimit} queens max` };
    case "pawns":
      return { short: "Max 8", line: `${cfg.maxPawns} pawns max` };
    case "extras":
      return { short: "Too many", line: "Too many pieces" };
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

/** Why `kind` can't be put on `square` now, or null: the square's rules, then the board's room (`limit`; a piece already on the board, `from`, doesn't count against it). */
export function placeBlock(army: Army, kind: Kind, square: string, from?: string, cfg: AutoChessSettings = AUTOCHESS, limit: number = cfg.levels.max): PlaceBlock | null {
  const block = squareBlock(army, kind, square, from, cfg);
  if (block) return block;
  if (from === undefined && boardCount(army) >= limit) return "limit";
  return null;
}

export function placeWords(block: PlaceBlock, cfg: AutoChessSettings = AUTOCHESS, limit: number = cfg.levels.max): string {
  switch (block) {
    case "half":
      return "Your half only";
    case "king":
      return "King's square";
    case "taken":
      return "Square taken";
    case "limit":
      return "Board full: buy XP";
    case "backrank":
      return "Not on back rank";
    case "file":
      return `${cfg.pawnsPerFile} pawns a file`;
  }
}

/**
 * The squares an offer of this kind may be rolled onto: the empty squares of your half you could use (not your king's; a pawn
 * never on your back rank or a fourth in its file, so its ranks are the 2nd to the 4th).
 */
export const usableSquares = (army: Army, kind: Kind, cfg: AutoChessSettings = AUTOCHESS): string[] => halfSquares(army.color).filter((sq) => !squareBlock(army, kind, sq, undefined, cfg));

/** Buys an offer: the piece lands on its square (the caller checked `buyBlock`). */
export const buyOffer = (army: Army, offer: Offer): Army => ({ ...army, board: { ...army.board, [offer.square]: offer.kind } });

/**
 * Sells a piece standing on the board: the army without it, and the gold it gives. Only a piece of yours that is there now, of the
 * kind the seller says, is sold; anything else (a square that has emptied, another kind there now, the king, an offer) is null and
 * pays nothing.
 */
export function sellPiece(army: Army, square: string, kind: Kind | "k", cfg: AutoChessSettings = AUTOCHESS): { army: Army; gold: number } | null {
  if (kind === "k" || army.board[square] !== kind) return null;
  const board = { ...army.board };
  delete board[square];
  const { [square]: _gone, ...stars } = army.stars ?? {};
  return { army: withStars({ ...army, board }, stars), gold: sellValue(kind, cfg, starsAt(army, square)) };
}

/** Buys an offer to hold: it goes on the bench, keeping its square (the caller checked `holdBlock`). */
export const holdOffer = (army: Army, offer: Offer): Army => ({ ...army, bench: [...army.bench, offer] });

/** Sells a held piece (the bench's `index`th): the army without it, and the gold it gives; null, no gold, unless that kind of piece is held in that slot now. */
export function sellHeld(army: Army, index: number, kind: Kind | "k", cfg: AutoChessSettings = AUTOCHESS): { army: Army; gold: number } | null {
  const held = army.bench[index];
  if (!held || held.kind !== kind) return null;
  return { army: { ...army, bench: army.bench.filter((_, i) => i !== index) }, gold: sellValue(held.kind, cfg, heldStars(held)) };
}

/** Why a held piece can't be placed now, or null: its square isn't free (taken, the king's), or the board has no room (`limit`). */
export function heldBlock(army: Army, index: number, cfg: AutoChessSettings = AUTOCHESS, limit: number = cfg.levels.max): PlaceBlock | null {
  const held = army.bench[index]!;
  return placeBlock(army, held.kind, held.square, undefined, cfg, limit);
}

/** Places a held piece on the square it kept (the caller checked `heldBlock`). */
export function placeHeld(army: Army, index: number): Army {
  const held = army.bench[index]!;
  const placed: Army = { ...army, board: { ...army.board, [held.square]: held.kind }, bench: army.bench.filter((_, i) => i !== index) };
  // (Its stars go down with it.)
  return held.stars ? withStars(placed, { ...army.stars, [held.square]: held.stars }) : placed;
}

/** The words for a held piece that can't be placed, with its square named (short, as the others). */
export function heldWords(block: PlaceBlock, square: string, cfg: AutoChessSettings = AUTOCHESS, limit: number = cfg.levels.max): string {
  if (block === "taken") return `${square} is taken`;
  if (block === "king") return `King is on ${square}`;
  return placeWords(block, cfg, limit);
}

/**
 * A bench carried into the next round. The colors turn each round, so a held piece's square is turned with them: the same file,
 * the rank mirrored (as the kings are), so it is still on its owner's half, the same way round.
 */
export const carryBench = (bench: readonly Held[]): Held[] => bench.map((o) => ({ kind: o.kind, square: `${o.square[0]}${9 - rankOf(o.square)}`, ...(o.stars ? { stars: o.stars } : {}) }));

/** The pieces standing on the board, in a steady order (square names sorted). */
export const boardPieces = (army: Army): { square: string; kind: Kind }[] =>
  Object.entries(army.board)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([square, kind]) => ({ square, kind }));

export { KINDS, other };
