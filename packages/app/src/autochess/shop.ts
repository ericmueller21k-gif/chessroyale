import { AUTOCHESS, mulberry32, weightedIndex, type AutoChessSettings, type Rng } from "@chessroyale/core";
import { buyBlock, buyOffer, holdBlock, holdOffer, kindBlock, priceOf, usableSquares, type BuyBlock, type HoldBlock } from "./army.ts";
import { KINDS, type Army, type Kind, type Offer } from "./types.ts";

/**
 * The shop (v6): a few offers, each a piece (rolled by the odds in `AUTOCHESS.shop`) and a square on your half where it will
 * land. Only what you could use is offered: a piece the legal-position limits allow, on an empty square of your half that isn't
 * your king's (a pawn on your 2nd to 4th rank, never past three in a file). **One offer to a square** (Eric, Oct 21): a roll
 * draws its square from the squares no piece of yours, your king or another current offer is on, so no two offers ever share
 * one (in the first roll, a reroll, a refill after a buy and `replaceTaken` alike). Buying an offer rolls a new one into its slot; so
 * does an offer's square being taken by another purchase. A reroll rolls all the offers again for gold; a round starts with a
 * fresh shop, free. Pure data, and every roll is seeded by the round, how many rerolls so far and how many refills since, so a
 * round played the same way shows the same offers (tests rely on that).
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
 * One offer rolled for this army: a kind by the odds among the kinds the limits allow (so with no limit in the way the odds are
 * the settings'), then a square, evenly among the squares it could use that no other offer (`taken`) is on. Null if the army has
 * no room at all. (The square is drawn from all the usable ones first, and drawn again among the free ones only when it was
 * taken, so a roll that collides with nothing is the same as ever.)
 */
export function rollOffer(rng: Rng, army: Army, cfg: AutoChessSettings = AUTOCHESS, taken: ReadonlySet<string> = new Set()): Offer | null {
  const kinds = KINDS.filter((k) => !kindBlock(army, k, cfg));
  while (kinds.length) {
    const kind = kinds[weightedIndex(rng, kinds.map((k) => cfg.shop.odds[k]))]!;
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

const rollSlots = (rng: Rng, army: Army, cfg: AutoChessSettings): Offer[] => {
  const slots: Offer[] = [];
  for (let i = 0; i < cfg.shop.slots; i++) {
    const offer = rollOffer(rng, army, cfg, squaresOf(slots));
    if (offer) slots.push(offer);
  }
  return slots;
};

/** A round's first shop. */
export const newShop = (seed: number, army: Army, cfg: AutoChessSettings = AUTOCHESS): Shop => ({ slots: rollSlots(rngFor(seed, 0, 0), army, cfg), rerolls: 0, refills: 0 });

/** All the offers rolled again (the caller took the gold). */
export function rerollShop(shop: Shop, seed: number, army: Army, cfg: AutoChessSettings = AUTOCHESS): Shop {
  const rerolls = shop.rerolls + 1;
  return { slots: rollSlots(rngFor(seed, rerolls, 0), army, cfg), rerolls, refills: 0 };
}

/** One slot rolled again (after its offer was bought, or its square was taken). */
export function refillSlot(shop: Shop, slot: number, seed: number, army: Army, cfg: AutoChessSettings = AUTOCHESS): Shop {
  const refills = shop.refills + 1;
  const slots = [...shop.slots];
  const offer = rollOffer(rngFor(seed, shop.rerolls, refills), army, cfg, squaresOf(shop.slots, slot));
  if (offer) slots[slot] = offer;
  else slots.splice(slot, 1);
  return { ...shop, slots, refills };
}

/**
 * After the board changed: every offer whose square a piece now stands on (or that is no longer a square it could use) rolls again
 * (Eric's call: replaced, not greyed, so a slot is never dead), and so does an offer sharing its square with an earlier one, so no
 * square ever holds two. `replaced`: how many; `from`: the squares they were on, in slot order.
 */
export function replaceTaken(shop: Shop, seed: number, army: Army, cfg: AutoChessSettings = AUTOCHESS): { shop: Shop; replaced: number; from: string[] } {
  let cur = shop;
  const from: string[] = [];
  for (let slot = 0; slot < cur.slots.length; slot++) {
    const offer = cur.slots[slot]!;
    const doubled = cur.slots.slice(0, slot).some((o) => o.square === offer.square);
    if (doubled || !usableSquares(army, offer.kind, cfg).includes(offer.square)) {
      const before = cur.slots.length;
      cur = refillSlot(cur, slot, seed, army, cfg);
      from.push(offer.square);
      if (cur.slots.length < before) slot--;
    }
  }
  return { shop: cur, replaced: from.length, from };
}

export type RerollBlock = "gold";

/** Why the shop can't be rerolled now, or null. */
export const rerollBlock = (gold: number, cfg: AutoChessSettings = AUTOCHESS): RerollBlock | null => (gold < cfg.shop.rerollCost ? "gold" : null);

export const rerollWords = (gold: number, cfg: AutoChessSettings = AUTOCHESS) => `Not enough gold: a reroll costs ${cfg.shop.rerollCost} and you have ${gold}.`;

/**
 * What a buy from a slot gives: the army with the piece on its square, the gold left and the shop with the slot rolled again
 * (and any other offer that can't use its square now), or why not. `replaced`: how many other offers had their square taken and
 * rolled again, `from` the squares they were on. `limit`: how many pieces the board may hold.
 */
export function buyFromSlot(
  side: { army: Army; gold: number; shop: Shop },
  slot: number,
  seed: number,
  cfg: AutoChessSettings = AUTOCHESS,
  limit: number = cfg.levels.max,
): { army: Army; gold: number; shop: Shop; replaced: number; from: string[] } | { block: BuyBlock } {
  const offer = side.shop.slots[slot];
  if (!offer) return { block: "gold" };
  const block = buyBlock(side.army, side.gold, offer, cfg, limit);
  if (block) return { block };
  const army = buyOffer(side.army, offer);
  const refilled = refillSlot(side.shop, slot, seed, army, cfg);
  const { shop, replaced, from } = replaceTaken(refilled, seed, army, cfg);
  return { army, gold: side.gold - priceOf(offer.kind, cfg), shop, replaced, from };
}

/**
 * Buying a slot's offer to hold it on the bench: the piece waits there, keeping its square (nothing lands on the board, so no
 * other offer's square is taken), and a new offer rolls into the slot.
 */
export function holdFromSlot(
  side: { army: Army; gold: number; shop: Shop },
  slot: number,
  seed: number,
  cfg: AutoChessSettings = AUTOCHESS,
): { army: Army; gold: number; shop: Shop } | { block: HoldBlock } {
  const offer = side.shop.slots[slot];
  if (!offer) return { block: "gold" };
  const block = holdBlock(side.army, side.gold, offer, cfg);
  if (block) return { block };
  const army = holdOffer(side.army, offer);
  return { army, gold: side.gold - priceOf(offer.kind, cfg), shop: refillSlot(side.shop, slot, seed, army, cfg) };
}

/** A reroll: the gold left and the new shop, or why not. */
export function rerollFor(side: { gold: number; shop: Shop; army: Army }, seed: number, cfg: AutoChessSettings = AUTOCHESS): { gold: number; shop: Shop } | { block: RerollBlock } {
  const block = rerollBlock(side.gold, cfg);
  if (block) return { block };
  return { gold: side.gold - cfg.shop.rerollCost, shop: rerollShop(side.shop, seed, side.army, cfg) };
}
