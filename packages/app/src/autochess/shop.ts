import { AUTOCHESS, mulberry32, weightedIndex, type AutoChessSettings, type Rng, type ShopOdds } from "@chessroyale/core";
import { buyBlock, buyOffer, halfSquares, holdBlock, holdOffer, kindBlock, priceOf, starUp, starUpTarget, starrablePieces, usableSquares, type BuyBlock, type HoldBlock, type StarTarget } from "./army.ts";
import { KINDS, type Army, type Kind, type Offer } from "./types.ts";

/**
 * The shop (v6): a few offers (four since v7), each a piece (rolled by the odds of the shop owner's level, `AUTOCHESS.shop.oddsByLevel`)
 * and a square on your half where it will land. Only what you could use is offered: a piece the legal-position limits allow, on an empty square of your half that isn't
 * your king's (a pawn on your 2nd to 4th rank, never past three in a file). **One offer to a square** (Eric, Oct 21): a roll
 * draws its square from the squares no piece of yours, your king or another current offer is on, so no two offers ever share
 * one (in the first roll, a reroll, a refill after a buy and `replaceTaken` alike). Buying an offer rolls a new one into its slot; so
 * does an offer's square being taken by another purchase. A reroll rolls all the offers again for gold (a price that climbs with each one in a round); a round starts with a
 * fresh shop, free, and the first reroll's price again. Pure data, and every roll is seeded by the round, how many rerolls so far and how many refills since, so a
 * round played the same way shows the same offers (tests rely on that).
 *
 * **Star-up offers** (v8, Eric Oct 22: "When you have a piece on a tile only that piece can appear there"; a bishop on the bench "F2, but you already have a rook on F2,
 * your shop can still find both"): an offer's square is drawn first, evenly among the squares of your half that aren't your king's and no other current offer is on; the
 * square's candidates are every piece of yours that can star up and stands on it (the board) or is held for it (the bench), plus, when the board square is empty, a new
 * piece rolled by the level's odds; the offer is one candidate, evenly. A square with no candidate (a pawn, a 3-star, and nothing held for it) offers nothing: it is
 * drawn again. An offer is a star-up when its kind and square match a piece of yours that can star up (`starUpTarget`), however it was rolled: it costs `starUpCost`
 * and merges into that piece, ignoring every limit on new pieces. With nothing of yours that can star up the roll is the old one (a kind by the odds, then a square),
 * and with something it is the same odds for the new piece (a kind the square can't take goes to a square it can).
 */

export interface Shop {
  /** The offer in each slot. */
  slots: Offer[];
  /** How many times it has been rerolled this round, and how many slots refilled since the last reroll (they seed the rolls). */
  rerolls: number;
  refills: number;
}

/** The seed for a round's own shop, from the round's seed. */
export const shopSeed = (roundSeed: number) => (roundSeed ^ 0x7f4a7c15) >>> 0;

const rngFor = (seed: number, rerolls: number, refills: number): Rng => mulberry32((seed ^ Math.imul(rerolls + 1, 0x9e3779b1) ^ Math.imul(refills + 1, 0x85ebca6b)) >>> 0);

/**
 * The odds a shop rolls by at this level (v7, Eric Oct 21): percent of each kind, from the settings' table (level 1 first). A level
 * outside the table (under 1, over its last row) takes the nearest row.
 */
export function oddsFor(level: number, cfg: AutoChessSettings = AUTOCHESS): ShopOdds {
  const rows = cfg.shop.oddsByLevel;
  return rows[Math.min(rows.length, Math.max(1, Math.floor(level))) - 1]!;
}

/**
 * One offer rolled for this army: a kind by the odds of `level` among the kinds the limits allow (so with no limit in the way the
 * odds are the table's row; a kind at 0% is never offered), then a square, evenly among the squares it could use that no other offer
 * (`taken`) is on. Null if the army has no room at all. (The square is drawn from all the usable ones first, and drawn again among
 * the free ones only when it was taken, so a roll that collides with nothing is the same as ever.)
 */
export function rollOffer(rng: Rng, army: Army, cfg: AutoChessSettings = AUTOCHESS, taken: ReadonlySet<string> = new Set(), level: number = cfg.levels.start): Offer | null {
  const ups = starrablePieces(army, cfg).filter((p) => p.square !== army.king && !taken.has(p.square));
  if (!ups.length) return rollNewPiece(rng, army, cfg, taken, level);
  const odds = oddsFor(level, cfg);
  // The new pieces the odds and the limits allow, each with a square no other offer is on.
  const fresh = KINDS.filter((k) => odds[k] > 0 && !kindBlock(army, k, cfg) && usableSquares(army, k, cfg).some((sq) => !taken.has(sq)));
  // Each square with something to offer on it: the star-ups there, and a new piece when no piece of yours stands on it.
  const choices = halfSquares(army.color)
    .filter((sq) => sq !== army.king && !taken.has(sq))
    .map((square) => ({ square, ups: ups.filter((p) => p.square === square).map((p) => p.kind), fresh: fresh.length > 0 && !army.board[square] }))
    .filter((c) => c.ups.length > 0 || c.fresh);
  if (!choices.length) return null;
  const at = choices[Math.floor(rng() * choices.length)]!;
  const pick = Math.floor(rng() * (at.ups.length + (at.fresh ? 1 : 0)));
  if (pick < at.ups.length) return { kind: at.ups[pick]!, square: at.square };
  const kind = fresh[weightedIndex(rng, fresh.map((k) => odds[k]))]!;
  const squares = usableSquares(army, kind, cfg).filter((sq) => !taken.has(sq));
  return { kind, square: squares.includes(at.square) ? at.square : squares[Math.floor(rng() * squares.length)]! };
}

/** The old roll, for an army with nothing that can star up: a kind by the odds of `level`, then a square it could use. */
function rollNewPiece(rng: Rng, army: Army, cfg: AutoChessSettings, taken: ReadonlySet<string>, level: number): Offer | null {
  const odds = oddsFor(level, cfg);
  const kinds = KINDS.filter((k) => odds[k] > 0 && !kindBlock(army, k, cfg));
  while (kinds.length) {
    const kind = kinds[weightedIndex(rng, kinds.map((k) => odds[k]))]!;
    const squares = usableSquares(army, kind, cfg);
    if (squares.length) {
      const square = squares[Math.floor(rng() * squares.length)]!;
      if (!taken.has(square)) return { kind, square };
      const free = squares.filter((sq) => !taken.has(sq));
      if (free.length) return { kind, square: free[Math.floor(rng() * free.length)]! };
    }
    kinds.splice(kinds.indexOf(kind), 1);
  }
  return null;
}

/** The squares of the offers in a shop, but for the slot `except` (the one being rolled). */
const squaresOf = (slots: readonly Offer[], except = -1): Set<string> => new Set(slots.flatMap((o, i) => (i === except ? [] : [o.square])));

const rollSlots = (rng: Rng, army: Army, cfg: AutoChessSettings, level: number): Offer[] => {
  const slots: Offer[] = [];
  for (let i = 0; i < cfg.shop.slots; i++) {
    const offer = rollOffer(rng, army, cfg, squaresOf(slots), level);
    if (offer) slots.push(offer);
  }
  return slots;
};

/**
 * A round's first shop. Every roll takes the `level` of the shop's owner as it is then (the player's, or the bot's): the shop already
 * on show keeps its offers when a level is gained, and the next roll (a refill, a reroll) uses the new row.
 */
export const newShop = (seed: number, army: Army, cfg: AutoChessSettings = AUTOCHESS, level: number = cfg.levels.start): Shop => ({ slots: rollSlots(rngFor(seed, 0, 0), army, cfg, level), rerolls: 0, refills: 0 });

/** All the offers rolled again (the caller took the gold). */
export function rerollShop(shop: Shop, seed: number, army: Army, cfg: AutoChessSettings = AUTOCHESS, level: number = cfg.levels.start): Shop {
  const rerolls = shop.rerolls + 1;
  return { slots: rollSlots(rngFor(seed, rerolls, 0), army, cfg, level), rerolls, refills: 0 };
}

/** One slot rolled again (after its offer was bought, or its square was taken). */
export function refillSlot(shop: Shop, slot: number, seed: number, army: Army, cfg: AutoChessSettings = AUTOCHESS, level: number = cfg.levels.start): Shop {
  const refills = shop.refills + 1;
  const slots = [...shop.slots];
  const offer = rollOffer(rngFor(seed, shop.rerolls, refills), army, cfg, squaresOf(shop.slots, slot), level);
  if (offer) slots[slot] = offer;
  else slots.splice(slot, 1);
  return { ...shop, slots, refills };
}

/**
 * After the board changed: every offer whose square a piece now stands on (or that is no longer a square it could use) rolls again
 * (Eric's call: replaced, not greyed, so a slot is never dead), and so does an offer sharing its square with an earlier one, so no
 * square ever holds two. `replaced`: how many; `from`: the squares they were on, in slot order.
 */
export function replaceTaken(shop: Shop, seed: number, army: Army, cfg: AutoChessSettings = AUTOCHESS, level: number = cfg.levels.start): { shop: Shop; replaced: number; from: string[] } {
  let cur = shop;
  const from: string[] = [];
  for (let slot = 0; slot < cur.slots.length; slot++) {
    const offer = cur.slots[slot]!;
    const doubled = cur.slots.slice(0, slot).some((o) => o.square === offer.square);
    // (A star-up stands on a square a piece of yours holds: that is no reason to roll it again.)
    if (doubled || !(starUpTarget(army, offer, cfg) || usableSquares(army, offer.kind, cfg).includes(offer.square))) {
      const before = cur.slots.length;
      cur = refillSlot(cur, slot, seed, army, cfg, level);
      from.push(offer.square);
      if (cur.slots.length < before) slot--;
    }
  }
  return { shop: cur, replaced: from.length, from };
}

export type RerollBlock = "gold";

/**
 * What the next reroll costs (v7.1, Eric Oct 22: "5+1 per roll up to 10 max per round"): `shop.reroll.first` for the first of a round, `step`
 * more for each one after it, up to `max` (5, 6, 7, 8, 9, 10, 10, ...). `done`: how many rerolls this round's shop has had (`shop.rerolls`);
 * the next round's shop starts at 0 again.
 */
export const rerollPrice = (done: number, cfg: AutoChessSettings = AUTOCHESS) => Math.min(cfg.shop.reroll.max, cfg.shop.reroll.first + cfg.shop.reroll.step * Math.max(0, done));

/** Why the shop can't be rerolled now, or null. */
export const rerollBlock = (gold: number, done: number, cfg: AutoChessSettings = AUTOCHESS): RerollBlock | null => (gold < rerollPrice(done, cfg) ? "gold" : null);

/** (Short, as the other words under the board.) */
export const rerollWords = (gold: number, done: number, cfg: AutoChessSettings = AUTOCHESS) => `Need ${rerollPrice(done, cfg) - gold} more`;

/**
 * What a buy from a slot gives: the army with the piece on its square, the gold left and the shop with the slot rolled again
 * (and any other offer that can't use its square now), or why not. `replaced`: how many other offers had their square taken and
 * rolled again, `from` the squares they were on. `limit`: how many pieces the board may hold. `side.level`: the level the new offers
 * roll at (the player's level, which is also `limit` in the game; the start level if left out).
 */
export function buyFromSlot(
  side: { army: Army; gold: number; shop: Shop; level?: number },
  slot: number,
  seed: number,
  cfg: AutoChessSettings = AUTOCHESS,
  limit: number = cfg.levels.max,
): { army: Army; gold: number; shop: Shop; replaced: number; from: string[]; starUp?: StarTarget } | { block: BuyBlock } {
  const offer = side.shop.slots[slot];
  if (!offer) return { block: "gold" };
  const block = buyBlock(side.army, side.gold, offer, cfg, limit);
  if (block) return { block };
  // A star-up (an offer that matches a piece of yours that can star up) merges into that piece for `starUpCost`; any other offer lands on its square.
  const target = starUpTarget(side.army, offer, cfg);
  const army = target ? starUp(side.army, target) : buyOffer(side.army, offer);
  const refilled = refillSlot(side.shop, slot, seed, army, cfg, side.level);
  const { shop, replaced, from } = replaceTaken(refilled, seed, army, cfg, side.level);
  return { army, gold: side.gold - (target ? cfg.starUpCost : priceOf(offer.kind, cfg)), shop, replaced, from, ...(target ? { starUp: target } : {}) };
}

/**
 * Buying a slot's offer to hold it on the bench: the piece waits there, keeping its square (nothing lands on the board, so no
 * other offer's square is taken), and a new offer rolls into the slot.
 */
export function holdFromSlot(
  side: { army: Army; gold: number; shop: Shop; level?: number },
  slot: number,
  seed: number,
  cfg: AutoChessSettings = AUTOCHESS,
): { army: Army; gold: number; shop: Shop } | { block: HoldBlock } {
  const offer = side.shop.slots[slot];
  if (!offer) return { block: "gold" };
  const block = holdBlock(side.army, side.gold, offer, cfg);
  if (block) return { block };
  const army = holdOffer(side.army, offer);
  return { army, gold: side.gold - priceOf(offer.kind, cfg), shop: refillSlot(side.shop, slot, seed, army, cfg, side.level) };
}

/** A reroll: the gold left (the climbing price, `rerollPrice`) and the new shop, or why not. */
export function rerollFor(side: { gold: number; shop: Shop; army: Army; level?: number }, seed: number, cfg: AutoChessSettings = AUTOCHESS): { gold: number; shop: Shop } | { block: RerollBlock } {
  const block = rerollBlock(side.gold, side.shop.rerolls, cfg);
  if (block) return { block };
  return { gold: side.gold - rerollPrice(side.shop.rerolls, cfg), shop: rerollShop(side.shop, seed, side.army, cfg, side.level) };
}
