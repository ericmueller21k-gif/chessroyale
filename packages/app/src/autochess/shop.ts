import { AUTOCHESS, mulberry32, weightedIndex, type AutoChessSettings, type Rng } from "@chessroyale/core";
import { buy, buyBlock, priceOf, type BuyBlock } from "./army.ts";
import { KINDS, type Army, type Kind } from "./types.ts";

/**
 * The shop (v5): a few random slots, each rolling a piece by the odds in `AUTOCHESS.shop`. Buying a piece rolls a new one
 * into its slot; a reroll rolls all the slots again for gold; a round starts with a fresh shop, free. Pure data, and every
 * roll is seeded by the round, how many rerolls so far and how many refills since, so a round played the same way shows
 * the same pieces (tests rely on that).
 */

export interface Shop {
  /** The piece in each slot. */
  slots: Kind[];
  /** How many times it has been rerolled this round, and how many slots refilled since the last reroll (they seed the rolls). */
  rerolls: number;
  refills: number;
}

/** The seed for a round's own shop, from the round's seed. */
export const shopSeed = (roundSeed: number) => (roundSeed ^ 0x7f4a7c15) >>> 0;

/** One piece rolled by the odds. */
export const rollKind = (rng: Rng, cfg: AutoChessSettings = AUTOCHESS): Kind => KINDS[weightedIndex(rng, KINDS.map((k) => cfg.shop.odds[k]))]!;

const rngFor = (seed: number, rerolls: number, refills: number): Rng => mulberry32((seed ^ Math.imul(rerolls + 1, 0x9e3779b1) ^ Math.imul(refills + 1, 0x85ebca6b)) >>> 0);

const rollSlots = (rng: Rng, cfg: AutoChessSettings): Kind[] => Array.from({ length: cfg.shop.slots }, () => rollKind(rng, cfg));

/** A round's first shop. */
export const newShop = (seed: number, cfg: AutoChessSettings = AUTOCHESS): Shop => ({ slots: rollSlots(rngFor(seed, 0, 0), cfg), rerolls: 0, refills: 0 });

/** All the slots rolled again (the caller took the gold). */
export function rerollShop(shop: Shop, seed: number, cfg: AutoChessSettings = AUTOCHESS): Shop {
  const rerolls = shop.rerolls + 1;
  return { slots: rollSlots(rngFor(seed, rerolls, 0), cfg), rerolls, refills: 0 };
}

/** One slot rolled again (after its piece was bought). */
export function refillSlot(shop: Shop, slot: number, seed: number, cfg: AutoChessSettings = AUTOCHESS): Shop {
  const refills = shop.refills + 1;
  const slots = [...shop.slots];
  slots[slot] = rollKind(rngFor(seed, shop.rerolls, refills), cfg);
  return { ...shop, slots, refills };
}

export type RerollBlock = "gold";

/** Why the shop can't be rerolled now, or null. */
export const rerollBlock = (gold: number, cfg: AutoChessSettings = AUTOCHESS): RerollBlock | null => (gold < cfg.shop.rerollCost ? "gold" : null);

export const rerollWords = (gold: number, cfg: AutoChessSettings = AUTOCHESS) => `Not enough gold: a reroll costs ${cfg.shop.rerollCost} and you have ${gold}.`;

/** What a buy from a slot gives: the army with the piece on its bench, the gold left and the shop with the slot rolled again, or why not. */
export function buyFromSlot(
  side: { army: Army; gold: number; shop: Shop },
  slot: number,
  seed: number,
  cfg: AutoChessSettings = AUTOCHESS,
): { army: Army; gold: number; shop: Shop } | { block: BuyBlock } {
  const kind = side.shop.slots[slot];
  if (!kind) return { block: "gold" };
  const block = buyBlock(side.army, side.gold, kind, cfg);
  if (block) return { block };
  return { army: buy(side.army, kind), gold: side.gold - priceOf(kind, cfg), shop: refillSlot(side.shop, slot, seed, cfg) };
}

/** A reroll: the gold left and the new shop, or why not. */
export function rerollFor(side: { gold: number; shop: Shop }, seed: number, cfg: AutoChessSettings = AUTOCHESS): { gold: number; shop: Shop } | { block: RerollBlock } {
  const block = rerollBlock(side.gold, cfg);
  if (block) return { block };
  return { gold: side.gold - cfg.shop.rerollCost, shop: rerollShop(side.shop, seed, cfg) };
}
