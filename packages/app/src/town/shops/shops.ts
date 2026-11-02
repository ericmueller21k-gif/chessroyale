/**
 * The homes you can go into (Nov 2, round 1: Babur's circus tent and Puddles' greenhouse, the shops' first interiors), what
 * each shop sells, and the words its cards say. Light: the town imports it to know which home's card says "Go in"; the room
 * itself (its art, its drawing) loads only when you go in (ShopRoom.tsx). docs/decisions/2026-11-02-shop-interiors-r1.md.
 *
 * Round 1 is the town side only: the crate's price and what you hold are shown, and buying goes through one function,
 * `buyBossCrate`, a stub that answers "Coming soon". Round 2 puts the stored data behind it (the tokens, the keys, the crate).
 */
import { BOSS_CRATE_PRICE, itemDef, tierInfo } from "@chessroyale/core";
import type { HomeId } from "../world.ts";
import type { Sq } from "./room.ts";

export interface ShopDef {
  /** Its home. */
  home: HomeId;
  /** The boss whose shop it is, as the town names it ("Babur"). */
  boss: string;
  /** Its crate's name, word for word ("Babur's Boss Crate"). */
  crate: string;
  /** The Shopkeeper: the boss's kid (its sheet's name in town/sidekicks/), drawn at `at` (a square, fractions allowed). */
  kid: "babur" | "puddles";
  at: readonly [number, number];
  /** The squares the Shopkeeper stands on (nobody else can): you can talk to it within `SHOP_FEEL.talkRange` of one. */
  keeper: readonly Sq[];
  /** What the crate can give (its items' ids in core's ITEM_DEFS): the boss's ride first, always. */
  prizes: readonly string[];
  /** Above the walls: a tent's canvas or a greenhouse's glass (drawn by the game, not the art: as the mockup did). */
  roof: "tent" | "glass";
}

export const SHOPS: Readonly<Partial<Record<HomeId, ShopDef>>> = {
  // Stripes stands beside the counter's east end, a little behind it: behind the counter itself its 58 px hides him (the
  // mockup's place, scripts/boss-art/shop-view.ts).
  tiger: { home: "tiger", boss: "Babur", crate: "Babur's Boss Crate", kid: "babur", at: [12.6, 2.6], keeper: [{ c: 12, r: 2 }, { c: 13, r: 2 }], prizes: ["balloon-pup"], roof: "tent" },
  // Drizzle stands behind the middle of the low potting counter (44 px: Drizzle shows over it).
  gardener: { home: "gardener", boss: "Puddles", crate: "Puddles' Boss Crate", kid: "puddles", at: [9.5, 2], keeper: [{ c: 9, r: 2 }, { c: 10, r: 2 }], prizes: ["puddles-mower"], roof: "glass" },
};

/** The shop inside a home, or null: every other home has no "Go in" yet. */
export const shopOf = (id: HomeId): ShopDef | null => SHOPS[id] ?? null;

/** "3 Babur tokens" / "1 crate key". */
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const token = (s: ShopDef) => `${s.boss} token`;

/** The crate's two prices, as its buttons say them: all tokens, or a token and a crate key. */
export type CrateWay = "tokens" | "key";
export const wayText = (s: ShopDef, way: CrateWay): string => {
  const p = BOSS_CRATE_PRICE;
  return way === "tokens" ? count(p.tokens, token(s)) : `${count(p.withKey.tokens, token(s))} + ${count(p.withKey.keys, "crate key")}`;
};
/** The price line: "3 Babur tokens, or 1 Babur token + 1 crate key". */
export const priceLine = (s: ShopDef): string => `${wayText(s, "tokens")}, or ${wayText(s, "key")}`;

/** What you hold of what the crate costs. */
export interface Holdings {
  tokens: number;
  keys: number;
}
/** "You have 0 Babur tokens and 0 crate keys." */
export const holdLine = (s: ShopDef, h: Holdings): string => `You have ${count(h.tokens, token(s))} and ${count(h.keys, "crate key")}.`;

/** A prize's row: its name, and its tier and slot ("Mythic ride"). */
export const prizeRows = (s: ShopDef): { id: string; name: string; kind: string; color: string }[] =>
  s.prizes.map((id) => {
    const d = itemDef(id)!;
    const t = tierInfo(d.tier);
    return { id, name: d.name, kind: `${t.name} ${d.slot}`, color: t.color };
  });

/**
 * What you hold of a boss's tokens and of crate keys. Round 1: nothing is stored yet (round 2 adds the tokens and the keys), so
 * none.
 */
export const bossHoldings = (_boss: HomeId): Holdings => ({ tokens: 0, keys: 0 });

/** What a buy came to: done, or why not (shown under the buttons). */
export interface BuyResult {
  ok: boolean;
  message: string;
}
/** The words a buy answers with while buying isn't built (round 1). */
export const COMING_SOON = "Coming soon";
/**
 * Buys a boss's crate one of its two ways. Every buy button goes through here, and only here. Round 1: a stub that answers
 * "Coming soon" and changes nothing; round 2 makes it the purchase (the server takes the tokens and the key and opens the crate).
 */
export async function buyBossCrate(_boss: HomeId, _way: CrateWay): Promise<BuyResult> {
  return { ok: false, message: COMING_SOON };
}
