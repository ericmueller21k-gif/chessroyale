import type { Rng } from "./rng.ts";

/**
 * Crates: cosmetic items in stacked layers of rarity. Every drop rolls three things independently:
 *   1. its tier, which decides the item (Novice to Sublime from the strip; Exalted and Transcendent only through
 *      Fischer Random),
 *   2. its colour (red and yellow common, Pearl the rarest), and
 *   3. its purity: 100% minus a blemish of 0-49% (blotches over that share of its colour). Under 10% blemish
 *      (90%+ purity) it's shiny.
 * Nothing here changes how a match is played or scored. The tier names honour Puzzle Pirates.
 */

export type ItemTier = "novice" | "broad" | "paragon" | "sublime" | "exalted" | "transcendent";

export const TIERS: readonly { id: ItemTier; name: string; color: string }[] = [
  { id: "novice", name: "Novice", color: "#9ca3af" },
  { id: "broad", name: "Broad", color: "#4ade80" },
  { id: "paragon", name: "Paragon", color: "#60a5fa" },
  { id: "sublime", name: "Sublime", color: "#c084fc" },
  { id: "exalted", name: "Exalted", color: "#fbbf24" },
  { id: "transcendent", name: "Transcendent", color: "#f43f5e" },
];

export const tierInfo = (id: ItemTier) => TIERS.find((t) => t.id === id)!;

/** Where an item goes on your pawn. A skin replaces the pawn itself (votes and the cut screen, not the board). */
export type ItemSlot = "head" | "face" | "skin" | "weapon";

export const SLOT_NAMES: Record<ItemSlot, string> = { head: "Head", face: "Face", skin: "Skin", weapon: "Weapon" };

/**
 * Colours, commonest first: `weight` is the chance out of 100. `hex` paints the item; Opal, Oceanic and Pearl
 * also have a second tone for a sheen (`hex2`).
 */
export const ITEM_COLORS: readonly { id: string; name: string; hex: string; hex2?: string; weight: number }[] = [
  { id: "red", name: "Red", hex: "#d6342f", weight: 30 },
  { id: "yellow", name: "Yellow", hex: "#f2c14e", weight: 30 },
  { id: "sage", name: "Sage", hex: "#93a982", weight: 14 },
  { id: "opal", name: "Opal", hex: "#a7d8d0", hex2: "#f0c9de", weight: 9 },
  { id: "cobalt", name: "Cobalt", hex: "#2352c9", weight: 7 },
  { id: "midnight", name: "Midnight", hex: "#1e2748", weight: 4.5 },
  { id: "emerald", name: "Emerald", hex: "#0f9d58", weight: 3 },
  { id: "oceanic", name: "Oceanic", hex: "#0b7fa8", hex2: "#38d6c8", weight: 2 },
  { id: "pearl", name: "Pearl", hex: "#f5f2ec", hex2: "#d9c8f2", weight: 0.5 },
];

export const itemColor = (id: string) => ITEM_COLORS.find((c) => c.id === id) ?? ITEM_COLORS[0]!;

export interface ItemDef {
  id: string;
  name: string;
  tier: ItemTier;
  slot: ItemSlot;
  description: string;
}

export const ITEM_DEFS: readonly ItemDef[] = [
  { id: "santa-beard", name: "Santa Beard", tier: "novice", slot: "face", description: "Ho ho ho." },
  { id: "antlers", name: "Antlers", tier: "broad", slot: "head", description: "Guides the sleigh through the endgame." },
  { id: "santa-hat", name: "Santa Hat", tier: "paragon", slot: "head", description: "Knows who's been naughty in the opening." },
  { id: "snowman", name: "Snowman", tier: "sublime", slot: "skin", description: "Your pawn, built of snow, with a scarf." },
  { id: "gift-tube", name: "Gift-Wrap Tube", tier: "exalted", slot: "weapon", description: "Wrapping-paper tube, tri-blend stripes. Swing responsibly." },
  { id: "fire-ice-crown", name: "Fire & Ice Crown", tier: "transcendent", slot: "head", description: "A crown of winter ice, burning in its own colour." },
];

export const itemDef = (id: string) => ITEM_DEFS.find((d) => d.id === id);

/** The strip's special slot: Fischer Random, a second spin for an Exalted or Transcendent item. */
export const FISCHER = "fischer";

export interface CrateDef {
  id: string;
  name: string;
  /** The strip's odds out of 100: the four common items and Fischer Random. */
  strip: readonly { item: string; weight: number }[];
  /** Fischer Random's odds out of 100. */
  fischer: readonly { item: string; weight: number }[];
}

export const CRATES: readonly CrateDef[] = [
  {
    id: "winter-1",
    name: "Winter Crate · Series 1",
    strip: [
      { item: "santa-beard", weight: 55 },
      { item: "antlers", weight: 25 },
      { item: "santa-hat", weight: 12 },
      { item: "snowman", weight: 6 },
      { item: FISCHER, weight: 2 },
    ],
    fischer: [
      { item: "gift-tube", weight: 80 },
      { item: "fire-ice-crown", weight: 20 },
    ],
  },
];

export const crateDef = (id: string) => CRATES.find((c) => c.id === id);

/** While testing: unlimited crates and keys, and the test switches (?fischer=1, ?shiny=1) work. */
export const CRATES_FREE = true;

/** One item a player owns: which item, its colour, its blemish (0-49) and the seed that shapes its blotches. */
export interface ItemInstance {
  id: string;
  def: string;
  color: string;
  blemish: number;
  seed: number;
}

/** Purity as shown: 100% minus the blemish, to one decimal place. */
export const purity = (blemish: number) => Math.round((100 - blemish) * 10) / 10;

/** Shiny: under 10% blemish. */
export const isShiny = (blemish: number) => blemish < 10;

/**
 * The blemish roll, 0 to 49: 49 × u^0.431, so most items are well blemished and a shiny one (under 10) is
 * about 2.5% of rolls; under 1 is about 1 in 8,000.
 */
export const BLEMISH_POWER = 0.431;
export function rollBlemish(rng: Rng): number {
  return Math.round(49 * Math.pow(rng(), BLEMISH_POWER) * 10) / 10;
}

function pick<T extends { weight: number }>(rng: Rng, list: readonly T[]): T {
  let r = rng() * list.reduce((s, x) => s + x.weight, 0);
  for (const x of list) if ((r -= x.weight) < 0) return x;
  return list[list.length - 1]!;
}

export interface CrateRoll {
  /** Landed on Fischer Random first (then the second spin gave the item). */
  fischer: boolean;
  def: string;
  color: string;
  blemish: number;
  seed: number;
}

/** Opens a crate. `force` (testing only): land on Fischer Random, and/or a shiny purity. */
export function rollCrate(rng: Rng, crate: CrateDef, force: { fischer?: boolean; shiny?: boolean } = {}): CrateRoll {
  const first = force.fischer ? FISCHER : pick(rng, crate.strip).item;
  const fischer = first === FISCHER;
  const def = fischer ? pick(rng, crate.fischer).item : first;
  const color = pick(rng, ITEM_COLORS).id;
  const blemish = force.shiny ? Math.round(rng() * 99) / 10 : rollBlemish(rng);
  const seed = Math.floor(rng() * 2 ** 31);
  return { fischer, def, color, blemish, seed };
}

/** Chance of a drop's item, out of 1 (for the crate page). */
export function itemChance(crate: CrateDef, def: string): number {
  const total = crate.strip.reduce((s, x) => s + x.weight, 0);
  const direct = crate.strip.find((x) => x.item === def);
  if (direct) return direct.weight / total;
  const fischer = (crate.strip.find((x) => x.item === FISCHER)?.weight ?? 0) / total;
  const ft = crate.fischer.reduce((s, x) => s + x.weight, 0);
  const inner = crate.fischer.find((x) => x.item === def);
  return inner ? (fischer * inner.weight) / ft : 0;
}

/** What a player wears (votes and the cut screen): an item instance per slot, as sent to others online. */
export type ItemLook = Partial<Record<ItemSlot, Pick<ItemInstance, "def" | "color" | "blemish" | "seed">>>;

/** Keeps only well-formed slots (a look from another player, or from storage). */
export function cleanLook(raw: unknown): ItemLook {
  const out: ItemLook = {};
  if (!raw || typeof raw !== "object") return out;
  for (const slot of ["head", "face", "skin", "weapon"] as const) {
    const v = (raw as Record<string, unknown>)[slot] as Record<string, unknown> | undefined;
    if (!v || typeof v !== "object") continue;
    const d = itemDef(String(v.def));
    if (!d || d.slot !== slot) continue;
    const blemish = Math.max(0, Math.min(49, Number(v.blemish) || 0));
    out[slot] = { def: d.id, color: itemColor(String(v.color)).id, blemish, seed: Math.abs(Math.floor(Number(v.seed) || 0)) % 2 ** 31 };
  }
  return out;
}
