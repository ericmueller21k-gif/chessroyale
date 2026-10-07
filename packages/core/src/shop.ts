/**
 * The shop: cosmetic items players can get and equip. Shared by the app (to show
 * and use them) and the server (to sell and equip them). Nothing here changes
 * how a match is played or scored.
 *
 * Each category fills one slot: you own any number of its items and equip one.
 * Every category has a free default that everyone owns.
 */

import { CHAT_PACKS, chatPackItem } from "./chat.ts";
import { QUICK_CHAT } from "./settings.ts";

export type ShopSlot = "king" | "hat" | "chat";
/** The slots you equip one item in (chat packs aren't equipped: you use every one you own). */
export type EquipSlot = Exclude<ShopSlot, "chat">;

export interface ShopCategory {
  slot: ShopSlot;
  name: string;
  blurb: string;
  /** Nothing to equip: everything you own in it is yours to use (quick chat packs). */
  ownOnly?: boolean;
}

export const SHOP_CATEGORIES: readonly ShopCategory[] = [
  { slot: "king", name: "God King effects", blurb: "The colour of his lightning, beam and halo when he answers your call." },
  { slot: "hat", name: "Pawn hats", blurb: "A hat for your pawn in the pre-game votes." },
  {
    slot: "chat",
    name: "Chat packs",
    blurb: "More lines and emoji for quick chat in online matches. A pack is yours to use as soon as you get it.",
    ownOnly: true,
  },
];

export interface ShopItem {
  id: string;
  slot: ShopSlot;
  name: string;
  description: string;
  /** In coins. While SHOP_FREE is on, everything is free anyway. */
  price: number;
  /** Everyone owns it from the start (one per slot, equipped until you choose another). */
  starter?: boolean;
  /** How it looks, for the app: colours for King effects, a hat's id for hats, a chat pack's id. */
  look: Record<string, string>;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  // God King effects: his bolts, beam and glow.
  { id: "king-holy", slot: "king", name: "Holy Light", description: "Gold and white, as the heavens intended.", price: 0, starter: true, look: { bolt: "#fff6c2", glow: "#ffd54a", beam: "#fff3c4" } },
  { id: "king-storm", slot: "king", name: "Stormcaller", description: "Crackling blue lightning.", price: 400, look: { bolt: "#e0f2fe", glow: "#38bdf8", beam: "#bae6fd" } },
  { id: "king-hellfire", slot: "king", name: "Hellfire", description: "He descends wreathed in flame.", price: 600, look: { bolt: "#ffedd5", glow: "#f97316", beam: "#fdba74" } },
  { id: "king-void", slot: "king", name: "Voidborn", description: "Purple light from beyond the board.", price: 600, look: { bolt: "#f3e8ff", glow: "#a855f7", beam: "#d8b4fe" } },
  { id: "king-emerald", slot: "king", name: "Emerald Oath", description: "Green fire of an ancient order.", price: 500, look: { bolt: "#dcfce7", glow: "#22c55e", beam: "#bbf7d0" } },
  // Pawn hats.
  { id: "hat-none", slot: "hat", name: "No hat", description: "A pawn, unadorned.", price: 0, starter: true, look: { hat: "none" } },
  { id: "hat-party", slot: "hat", name: "Party Hat", description: "Every move is a celebration.", price: 150, look: { hat: "party" } },
  { id: "hat-crown", slot: "hat", name: "Little Crown", description: "Dreaming of promotion.", price: 300, look: { hat: "crown" } },
  { id: "hat-wizard", slot: "hat", name: "Wizard Hat", description: "Knows things.", price: 250, look: { hat: "wizard" } },
  { id: "hat-top", slot: "hat", name: "Top Hat", description: "A pawn of means.", price: 250, look: { hat: "top" } },
  { id: "hat-viking", slot: "hat", name: "Viking Helm", description: "Pushes into any zone.", price: 300, look: { hat: "viking" } },
  // Quick chat packs (core/chat.ts holds their lines; prices are in settings.ts). The free ones everyone has.
  ...CHAT_PACKS.map((p) => ({
    id: chatPackItem(p.id),
    slot: "chat" as const,
    name: p.name,
    description: p.blurb,
    price: p.free ? 0 : (QUICK_CHAT.packPrices[p.id] ?? 0),
    ...(p.free ? { starter: true } : {}),
    look: { pack: p.id },
  })),
];

/** While testing: every item costs nothing. */
export const SHOP_FREE = true;

export function shopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}

/** The item everyone starts with in a slot. */
export function starterItem(slot: ShopSlot): ShopItem {
  return SHOP_ITEMS.find((i) => i.slot === slot && i.starter)!;
}

/** What a player has: coins, items owned (starters included) and what's equipped in each slot. */
export interface ShopState {
  coins: number;
  owned: string[];
  equipped: Record<EquipSlot, string>;
}

/** The look of what's equipped in a slot (the starter if nothing valid is). */
export function equippedLook(state: Pick<ShopState, "equipped"> | null | undefined, slot: EquipSlot): Record<string, string> {
  const item = shopItem(state?.equipped?.[slot] ?? "");
  return (item && item.slot === slot ? item : starterItem(slot)).look;
}
