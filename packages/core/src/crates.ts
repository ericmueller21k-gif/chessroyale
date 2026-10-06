import type { Rng } from "./rng.ts";

/**
 * Crates: cosmetic items in stacked layers of rarity. Every drop rolls three things independently:
 *   1. its tier, which decides the item: the strip lands on a tier's present (Novice to Sublime), which opens to one
 *      of that tier's items evenly, or on Fischer Random (Exalted and Transcendent items only),
 *   2. its colour (red and yellow common, Pearl the rarest), and
 *   3. its purity: 100% minus a blemish of 0-100% (blotches over that share of its colour). At 90%+ purity it's
 *      shiny; at 0% it's blotched all over, a darker shade of its colour.
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
  /**
   * Where it's drawn relative to the piece: in front (the default: hats, beards, weapons) or behind it ("back":
   * e.g. a cape or wings, seen around the piece).
   */
  layer?: "front" | "back";
  /** Rolls a second colour too (both with the usual colour odds), e.g. a present's box and its ribbon. */
  colors?: 2;
}

/** Whether an item is drawn behind the piece. */
export const behindPiece = (def: string) => itemDef(def)?.layer === "back";

export const ITEM_DEFS: readonly ItemDef[] = [
  { id: "santa-beard", name: "Santa Beard", tier: "novice", slot: "face", description: "Ho ho ho." },
  { id: "beanie", name: "Beanie", tier: "novice", slot: "head", description: "A plain knit beanie. Keeps the thinking warm." },
  { id: "tree-tee", name: "Christmas Tree Tee", tier: "novice", slot: "skin", description: "Your pawn in a festive T-shirt. The bulbs are the only part that's lit." },
  { id: "antlers", name: "Antlers", tier: "broad", slot: "head", description: "Guides the sleigh through the endgame." },
  { id: "santa-hat", name: "Santa Hat", tier: "paragon", slot: "head", description: "Knows who's been naughty in the opening." },
  { id: "ski-goggles", name: "Ski Goggles", tier: "paragon", slot: "face", colors: 2, description: "Frame in one colour, see-through lenses in another. For black-diamond lines." },
  { id: "snowman", name: "Snowman", tier: "sublime", slot: "skin", description: "Your pawn, built of snow, with a scarf." },
  { id: "present", name: "Present", tier: "sublime", slot: "head", colors: 2, description: "Worn as a helmet. Box in one colour, ribbon in another. Now with a visor, for peeking." },
  { id: "gingerbread", name: "Gingerbread Man", tier: "sublime", slot: "skin", description: "Run, run, as fast as you can. Iced, with gumdrop buttons." },
  { id: "chimney", name: "Chimney", tier: "sublime", slot: "skin", description: "Your pawn, sitting in a brick chimney, bricks and all in its colour. Came down the wrong one." },
  { id: "gift-tube", name: "Gift-Wrap Tube", tier: "exalted", slot: "weapon", description: "Wrapping-paper tube, tri-blend stripes. Swing responsibly." },
  { id: "candy-cane", name: "Candy Cane", tier: "exalted", slot: "weapon", description: "White, striped in its colour. Sharpened at one end (allegedly)." },
  { id: "fire-ice-crown", name: "Fire & Ice Crown", tier: "transcendent", slot: "head", description: "A crown of winter ice, burning in its own colour." },
];

export const itemDef = (id: string) => ITEM_DEFS.find((d) => d.id === id);

/** The strip's special slot: Fischer Random, a second spin for an Exalted or Transcendent item. */
export const FISCHER = "fischer";

/** The tiers that come in presents; Exalted and Transcendent come only through Fischer Random. */
export type PresentTier = "novice" | "broad" | "paragon" | "sublime";

export interface CrateDef {
  id: string;
  name: string;
  /**
   * The strip's odds out of 100: a present for each tier, in its colour, and Fischer Random. Each tier's present is
   * rarer than the one below. A present opens to one of its tier's items, evenly.
   */
  strip: readonly { tier: PresentTier | typeof FISCHER; weight: number }[];
  /** What the presents hold: the Novice to Sublime items. */
  items: readonly string[];
  /** Fischer Random's odds out of 100. */
  fischer: readonly { item: string; weight: number }[];
}

export const CRATES: readonly CrateDef[] = [
  {
    id: "winter-1",
    name: "Winter Crate · Series 1",
    // Eric (Oct 6): the strip holds presents by tier, Fischer Random 2%. Sublime stays at his 12-15% (14%).
    strip: [
      { tier: "novice", weight: 40 },
      { tier: "broad", weight: 26 },
      { tier: "paragon", weight: 18 },
      { tier: "sublime", weight: 14 },
      { tier: FISCHER, weight: 2 },
    ],
    items: ["santa-beard", "beanie", "tree-tee", "antlers", "santa-hat", "ski-goggles", "snowman", "present", "gingerbread", "chimney"],
    fischer: [
      { item: "gift-tube", weight: 40 },
      { item: "candy-cane", weight: 40 },
      { item: "fire-ice-crown", weight: 20 },
    ],
  },
];

/** The items a tier's present can hold in a crate. */
export const presentItems = (crate: CrateDef, tier: string) => crate.items.filter((id) => itemDef(id)?.tier === tier);

export const crateDef = (id: string) => CRATES.find((c) => c.id === id);

/** While testing: unlimited crates and keys, and the test switches (?fischer=1, ?shiny=1) work. */
export const CRATES_FREE = true;

/**
 * One item a player owns: which item, its colour (and a second colour for two-colour items), its blemish (0-100,
 * to one decimal place; items rolled before Oct 5, 2026 are all 0-49) and the seed that shapes its blotches.
 */
export interface ItemInstance {
  id: string;
  def: string;
  color: string;
  color2?: string | null;
  blemish: number;
  seed: number;
}

/** Purity as shown: 100% minus the blemish, to one decimal place. */
export const purity = (blemish: number) => Math.round((100 - blemish) * 10) / 10;

/** Shiny: 90% purity or more (as shown). */
export const isShiny = (blemish: number) => purity(blemish) >= 90;

/**
 * The purity roll: the chance of each band of purity (`low` to `high`, as shown, to one decimal place), even within
 * a band. Most items land between 30% and 70%; shiny (90%+) is 1 in 250, and 99%+ 1 in 25,000; under 5% (blotched
 * nearly all over) is 1 in 100. The bands run from 100% down to 0% with no gaps, and the weights add up to 100.
 */
export const PURITY_BANDS: readonly { low: number; high: number; weight: number }[] = [
  { low: 99, high: 100, weight: 0.004 },
  { low: 90, high: 98.9, weight: 0.396 },
  { low: 70, high: 89.9, weight: 9.6 },
  { low: 30, high: 69.9, weight: 80 },
  { low: 5, high: 29.9, weight: 9 },
  { low: 0, high: 4.9, weight: 1 },
];

/** A blemish (0-100, to one decimal place) by the purity bands. One draw of `rng`. */
export function rollBlemish(rng: Rng): number {
  let r = rng() * PURITY_BANDS.reduce((s, b) => s + b.weight, 0);
  let i = 0;
  while (i < PURITY_BANDS.length - 1 && r >= PURITY_BANDS[i]!.weight) r -= PURITY_BANDS[i++]!.weight;
  const b = PURITY_BANDS[i]!;
  // Purity in tenths, evenly over the band's values (from its top down, so a lower draw is always purer).
  const high = Math.round(b.high * 10);
  const steps = high - Math.round(b.low * 10) + 1;
  const tenths = high - Math.min(steps - 1, Math.floor((r / b.weight) * steps));
  return (1000 - tenths) / 10;
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
  /** Two-colour items only. */
  color2?: string;
  blemish: number;
  seed: number;
}

/**
 * Opens a crate: the strip lands on a tier's present (which opens to one of its items, evenly) or Fischer Random.
 * `force` (testing only): land on Fischer Random, and/or a shiny purity.
 */
export function rollCrate(rng: Rng, crate: CrateDef, force: { fischer?: boolean; shiny?: boolean } = {}): CrateRoll {
  const first = force.fischer ? FISCHER : pick(rng, crate.strip).tier;
  const fischer = first === FISCHER;
  const inside = fischer ? [] : presentItems(crate, first);
  const def = fischer ? pick(rng, crate.fischer).item : inside[Math.min(inside.length - 1, Math.floor(rng() * inside.length))]!;
  const color = pick(rng, ITEM_COLORS).id;
  const blemish = force.shiny ? Math.round(rng() * 99) / 10 : rollBlemish(rng);
  const seed = Math.floor(rng() * 2 ** 31);
  const roll: CrateRoll = { fischer, def, color, blemish, seed };
  if (itemDef(def)?.colors === 2) roll.color2 = pick(rng, ITEM_COLORS).id;
  return roll;
}

/** Chance of landing on a tier's present (or Fischer Random), out of 1. */
export function presentChance(crate: CrateDef, tier: string): number {
  const total = crate.strip.reduce((s, x) => s + x.weight, 0);
  return (crate.strip.find((x) => x.tier === tier)?.weight ?? 0) / total;
}

/** Chance of a drop's item, out of 1 (for the crate page): its present's chance, shared evenly, or via Fischer Random. */
export function itemChance(crate: CrateDef, def: string): number {
  const tier = itemDef(def)?.tier;
  if (tier && crate.items.includes(def)) return presentChance(crate, tier) / presentItems(crate, tier).length;
  const ft = crate.fischer.reduce((s, x) => s + x.weight, 0);
  const inner = crate.fischer.find((x) => x.item === def);
  return inner ? (presentChance(crate, FISCHER) * inner.weight) / ft : 0;
}

/** What a player wears (votes and the cut screen): an item instance per slot, as sent to others online. */
export type ItemLook = Partial<Record<ItemSlot, { def: string; color: string; color2?: string; blemish: number; seed: number }>>;

/** Keeps only well-formed slots (a look from another player, or from storage). */
export function cleanLook(raw: unknown): ItemLook {
  const out: ItemLook = {};
  if (!raw || typeof raw !== "object") return out;
  for (const slot of ["head", "face", "skin", "weapon"] as const) {
    const v = (raw as Record<string, unknown>)[slot] as Record<string, unknown> | undefined;
    if (!v || typeof v !== "object") continue;
    const d = itemDef(String(v.def));
    if (!d || d.slot !== slot) continue;
    const blemish = Math.max(0, Math.min(100, Number(v.blemish) || 0));
    const item: NonNullable<ItemLook[typeof slot]> = { def: d.id, color: itemColor(String(v.color)).id, blemish, seed: Math.abs(Math.floor(Number(v.seed) || 0)) % 2 ** 31 };
    if (d.colors === 2) item.color2 = itemColor(String(v.color2 ?? v.color)).id;
    out[slot] = item;
  }
  return out;
}
