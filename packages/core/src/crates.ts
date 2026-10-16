import { mulberry32, type Rng } from "./rng.ts";

/**
 * Crates: cosmetic items in stacked layers of rarity. Every drop rolls three things independently:
 *   1. its tier, which decides the item: the strip lands on a tier's box (Common to Epic: a present in Winter, a
 *      supply box in Beta), which opens to one of that tier's items evenly, or on Fischer Random (Legendary and
 *      Mythic items only),
 *   2. its color (red and yellow common, Pearl the rarest), and
 *   3. its purity: 100% minus a blemish of 0-100% (blotches over that share of its color). At 90%+ purity it's
 *      shiny; at 0% it's blotched all over, a darker shade of its color.
 * Nothing here changes how a match is played or scored. The tiers run Common to Mythic, the ladder players know (the
 * Puzzle Pirates names went to player ranks, Oct 6, 2026).
 */

export type ItemTier = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export const TIERS: readonly { id: ItemTier; name: string; color: string }[] = [
  { id: "common", name: "Common", color: "#9ca3af" },
  { id: "uncommon", name: "Uncommon", color: "#4ade80" },
  { id: "rare", name: "Rare", color: "#60a5fa" },
  { id: "epic", name: "Epic", color: "#c084fc" },
  { id: "legendary", name: "Legendary", color: "#fbbf24" },
  { id: "mythic", name: "Mythic", color: "#f43f5e" },
];

export const tierInfo = (id: ItemTier) => TIERS.find((t) => t.id === id)!;

/** Where an item goes on your pawn. A skin replaces the pawn itself (votes and the cut screen, not the board). */
export type ItemSlot = "head" | "face" | "skin" | "weapon";

export const SLOT_NAMES: Record<ItemSlot, string> = { head: "Head", face: "Face", skin: "Skin", weapon: "Weapon" };

/**
 * Colors, commonest first: `weight` is the chance out of 100. `hex` paints the item; Opal, Oceanic and Pearl
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

/**
 * Items whose second color isn't stored but drawn from the item's own seed: the Gift-Wrap Tube's second stripe color
 * (Eric, Oct 15, 2026: white and two random colors). Every tube, old or new, keeps one look on every device, and no
 * stored data changes.
 */
const SEEDED_SECOND_COLOR: ReadonlySet<string> = new Set(["gift-tube"]);

/**
 * An item's second color: the stored one (two-color items), the one its seed gives (the tube: by the usual color
 * odds, never its first color), or none.
 */
export function secondColor(it: { def: string; color: string; color2?: string | null; seed: number }): string | undefined {
  if (it.color2) return it.color2;
  if (!SEEDED_SECOND_COLOR.has(it.def)) return undefined;
  const first = itemColor(it.color).id;
  // (Its own stream, apart from the blotches' (seeded by the same number), so the two don't line up.)
  return pick(mulberry32((it.seed ^ 0x5eed2c01) >>> 0), ITEM_COLORS.filter((c) => c.id !== first)).id;
}

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
  /** Rolls a second color too (both with the usual color odds), e.g. a present's box and its ribbon. */
  colors?: 2;
}

/** Whether an item is drawn behind the piece. */
export const behindPiece = (def: string) => itemDef(def)?.layer === "back";

export const ITEM_DEFS: readonly ItemDef[] = [
  // Winter Crate · Series 1.
  { id: "santa-beard", name: "Santa Beard", tier: "common", slot: "face", description: "Ho ho ho." },
  { id: "beanie", name: "Beanie", tier: "common", slot: "head", description: "A plain knit beanie. Keeps the thinking warm." },
  { id: "tree-tee", name: "Christmas Tree Tee", tier: "common", slot: "skin", description: "Your pawn in a festive T-shirt. The bulbs are the only part that's lit." },
  { id: "antlers", name: "Antlers", tier: "uncommon", slot: "head", description: "Guides the sleigh through the endgame." },
  { id: "scarf", name: "Scarf", tier: "uncommon", slot: "face", description: "A long knit scarf. Your pawn's mom insisted." },
  { id: "santa-hat", name: "Santa Hat", tier: "rare", slot: "head", description: "Knows who's been naughty in the opening." },
  { id: "ski-goggles", name: "Ski Goggles", tier: "rare", slot: "face", colors: 2, description: "Frame in one color, see-through lenses in another. For black-diamond lines." },
  { id: "snowman", name: "Snowman", tier: "epic", slot: "skin", description: "Your pawn, built of snow, with a scarf." },
  { id: "present", name: "Present", tier: "epic", slot: "head", colors: 2, description: "Worn as a helmet. Box in one color, ribbon in another. Now with a visor, for peeking." },
  { id: "gingerbread", name: "Gingerbread Man", tier: "epic", slot: "skin", description: "Run, run, as fast as you can. Iced, with gumdrop buttons." },
  { id: "chimney", name: "Chimney", tier: "epic", slot: "skin", description: "Your pawn, sitting in a brick chimney, bricks and all in its color. Came down the wrong one." },
  { id: "gift-tube", name: "Gift-Wrap Tube", tier: "legendary", slot: "weapon", description: "Wrapping-paper tube, tri-blend stripes. Swing responsibly." },
  { id: "candy-cane", name: "Candy Cane", tier: "legendary", slot: "weapon", description: "White, striped in its color. Sharpened at one end (allegedly)." },
  { id: "fire-ice-crown", name: "Fire & Ice Crown", tier: "mythic", slot: "head", description: "A crown of winter ice, burning in its own color." },
  // Beta Crate · Series 001 (Eric, Oct 11): the old shop's pawn hats, then themes split across the tiers (secret agent,
  // pirate, ninja) and a one-off Smiley Face. The full plan is in DECISIONS.md; it ships in batches.
  { id: "party-hat", name: "Party Hat", tier: "common", slot: "head", description: "Every move is a celebration. Even the blunders." },
  { id: "wizard-hat", name: "Wizard Hat", tier: "common", slot: "head", description: "Knows things. Mostly opening theory." },
  { id: "top-hat", name: "Top Hat", tier: "common", slot: "head", description: "A pawn of means. Monocle sold separately." },
  { id: "viking-helm", name: "Viking Helm", tier: "uncommon", slot: "head", description: "Pushes into any zone. The horns are for show; so is the plan." },
  { id: "little-crown", name: "Little Crown", tier: "uncommon", slot: "head", description: "Dreaming of promotion." },
  { id: "eyepatch", name: "Eyepatch", tier: "uncommon", slot: "face", description: "Half the vision, twice the swagger." },
  { id: "dark-shades", name: "Dark Shades", tier: "rare", slot: "face", description: "Can't see the board. Looks great, though." },
  { id: "suit-and-tie", name: "Suit and Tie", tier: "epic", slot: "skin", colors: 2, description: "A sharp suit in one color, the tie in another. License to promote." },
  { id: "smiley-face", name: "Smiley Face", tier: "legendary", slot: "face", description: "Have a nice game." },
  { id: "tommy-gun", name: "Tommy Gun", tier: "mythic", slot: "weapon", colors: 2, description: "A classic drum-fed Tommy gun, metal in one color, wood in another. For settling the endgame." },
  // Batch 2 (Oct 14): the rest of the secret agent, and the pirate.
  { id: "fake-mustache", name: "Fake Mustache", tier: "common", slot: "face", description: "A flawless disguise. Nobody will ever know it's you." },
  { id: "fedora", name: "Fedora", tier: "common", slot: "head", description: "For trench-coat weather and shadowy endgames." },
  { id: "briefcase", name: "Briefcase", tier: "uncommon", slot: "weapon", description: "Contents classified. Mostly sandwiches." },
  { id: "wire-earpiece", name: "Wire Earpiece", tier: "rare", slot: "head", description: "\"The pawn is moving. Repeat: the pawn is moving.\"" },
  { id: "bandana", name: "Bandana", tier: "common", slot: "head", description: "Tied tight for high seas and long games." },
  { id: "hook", name: "Hook", tier: "uncommon", slot: "weapon", description: "Terrible for moving pieces. Great for drama." },
  { id: "cutlass", name: "Cutlass", tier: "rare", slot: "weapon", description: "Curved, polished, and strictly for show." },
  { id: "spyglass", name: "Spyglass", tier: "rare", slot: "weapon", description: "Spots a fork from three boards away." },
  { id: "captains-coat", name: "Captain's Coat", tier: "epic", slot: "skin", description: "Long, gold-buttoned and made for shouting orders." },
  { id: "pirate-hat", name: "Pirate Hat", tier: "legendary", slot: "head", description: "A captain's tricorn, skull and all. Arr." },
  { id: "parrot", name: "Parrot", tier: "mythic", slot: "weapon", colors: 2, description: "Perches on your shoulder and repeats your moves back to you." },
  // Batch 3 (Oct 14): the ninja.
  { id: "ninja-headband", name: "Ninja Headband", tier: "common", slot: "head", description: "Long tails, for dramatic wind." },
  { id: "shuriken", name: "Shuriken", tier: "common", slot: "weapon", description: "A throwing star. Not for throwing at the board." },
  { id: "ninja-mask", name: "Ninja Mask", tier: "uncommon", slot: "face", description: "Covers everything below the eyes, including your thinking face." },
  { id: "nunchucks", name: "Nunchucks", tier: "uncommon", slot: "weapon", description: "Two sticks, one chain, zero hand-eye coordination." },
  { id: "katana", name: "Katana", tier: "rare", slot: "weapon", description: "Folded a thousand times. Still can't cut through a fortress." },
  { id: "ninja-hood", name: "Ninja Hood", tier: "epic", slot: "head", description: "Only the eyes show, and they're calculating." },
  { id: "ninja-gi", name: "Ninja Gi", tier: "epic", slot: "skin", description: "A wrap-front gi. The belt is black; you've earned it." },
];

export const itemDef = (id: string) => ITEM_DEFS.find((d) => d.id === id);

/** The strip's special slot: Fischer Random, a second spin for a Legendary or Mythic item. */
export const FISCHER = "fischer";

/** The tiers that come in a crate's boxes (presents, supply boxes); Legendary and Mythic come only through Fischer Random. */
export type PresentTier = "common" | "uncommon" | "rare" | "epic";
export type FischerTier = "legendary" | "mythic";

/** How a crate looks in the app: its own box on the crate page, and the box each tier comes in on the strip. */
export type CrateLook = "winter" | "beta";

export interface CrateDef {
  id: string;
  name: string;
  /** One line under its name, to tell crates apart. */
  blurb: string;
  look: CrateLook;
  /**
   * The strip's odds out of 100: a box for each tier, in its color, and Fischer Random. Each tier's box is rarer
   * than the one below. A box opens to one of its tier's items, evenly.
   */
  strip: readonly { tier: PresentTier | typeof FISCHER; weight: number }[];
  /**
   * Everything the crate holds. Each item's own tier says where it is: in that tier's box (Common to Epic) or behind
   * Fischer Random (Legendary, Mythic). So changing an item's tier is one field, in ITEM_DEFS.
   */
  items: readonly string[];
  /** Fischer Random's odds out of 100, by tier; a tier's items share its weight evenly. */
  fischer: readonly { tier: FischerTier; weight: number }[];
}

export const CRATES: readonly CrateDef[] = [
  {
    id: "beta-001",
    name: "Beta Crate · Series 001",
    blurb: "Secret agents, pirates, ninjas, classic hats and a smile",
    look: "beta",
    // Eric (Oct 11): the same odds as Winter.
    strip: [
      { tier: "common", weight: 40 },
      { tier: "uncommon", weight: 26 },
      { tier: "rare", weight: 18 },
      { tier: "epic", weight: 14 },
      { tier: FISCHER, weight: 2 },
    ],
    items: [
      // The Classics (the old shop's hats).
      "party-hat",
      "wizard-hat",
      "top-hat",
      "viking-helm",
      "little-crown",
      // Secret agent.
      "fake-mustache",
      "fedora",
      "briefcase",
      "dark-shades",
      "wire-earpiece",
      "suit-and-tie",
      "tommy-gun",
      // Pirate.
      "bandana",
      "eyepatch",
      "hook",
      "cutlass",
      "spyglass",
      "captains-coat",
      "pirate-hat",
      "parrot",
      // Ninja.
      "ninja-headband",
      "shuriken",
      "ninja-mask",
      "nunchucks",
      "katana",
      "ninja-hood",
      "ninja-gi",
      // A one-off.
      "smiley-face",
    ],
    fischer: [
      { tier: "legendary", weight: 80 },
      { tier: "mythic", weight: 20 },
    ],
  },
  {
    id: "winter-1",
    name: "Winter Crate · Series 1",
    blurb: "Santa, snowmen and a crown of fire and ice",
    look: "winter",
    // Eric (Oct 6): the strip holds presents by tier, Fischer Random 2%. Epic stays at his 12-15% (14%).
    strip: [
      { tier: "common", weight: 40 },
      { tier: "uncommon", weight: 26 },
      { tier: "rare", weight: 18 },
      { tier: "epic", weight: 14 },
      { tier: FISCHER, weight: 2 },
    ],
    items: [
      "santa-beard",
      "beanie",
      "tree-tee",
      "antlers",
      "scarf",
      "santa-hat",
      "ski-goggles",
      "snowman",
      "present",
      "gingerbread",
      "chimney",
      "gift-tube",
      "candy-cane",
      "fire-ice-crown",
    ],
    // (The tube and the cane share Legendary's 80, 40 each; the crown has Mythic's 20.)
    fischer: [
      { tier: "legendary", weight: 80 },
      { tier: "mythic", weight: 20 },
    ],
  },
];

/** A crate's items of one tier: what that tier's box holds, or (Legendary, Mythic) its share of Fischer Random. */
export const tierItems = (crate: CrateDef, tier: string) => crate.items.filter((id) => itemDef(id)?.tier === tier);
/** The items a tier's box can hold in a crate. */
export const presentItems = (crate: CrateDef, tier: string) => (tier === FISCHER ? [] : tierItems(crate, tier));

/** Fischer Random's odds per item (out of 100): each tier's weight shared evenly by its items; empty tiers left out. */
export function fischerOdds(crate: CrateDef): { item: string; weight: number }[] {
  const live = crate.fischer.filter((f) => tierItems(crate, f.tier).length > 0);
  const total = live.reduce((s, f) => s + f.weight, 0);
  return live.flatMap((f) => {
    const list = tierItems(crate, f.tier);
    return list.map((item) => ({ item, weight: (100 * f.weight) / total / list.length }));
  });
}

/**
 * The strip as it rolls: a tier whose box holds nothing (or Fischer Random with nothing behind it) is left out, so a
 * crate that's still being filled can't land on an empty box. (A test keeps every live crate's tiers filled.)
 */
export const liveStrip = (crate: CrateDef) => crate.strip.filter((x) => (x.tier === FISCHER ? fischerOdds(crate).length > 0 : presentItems(crate, x.tier).length > 0));

export const crateDef = (id: string) => CRATES.find((c) => c.id === id);

/**
 * While testing: unlimited crates and keys, and the test switches (?fischer=1, ?shiny=1) work for those allowed them
 * (an admin, or TEST_SWITCHES: docs/areas/ops.md, "Test switches").
 */
export const CRATES_FREE = true;

/**
 * One item a player owns: which item, its color (and a second color for two-color items), its blemish (0-100,
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

/**
 * The locker's stacks: copies of the same item in the same color (both colors, for two-color items and the tube)
 * shown as one, the purest on top (Eric, Oct 8). `items` are purest first, so `items[0]` is the top.
 */
export interface ItemStack {
  key: string;
  items: ItemInstance[];
}
export const stackKey = (it: Pick<ItemInstance, "def" | "color" | "color2" | "seed">) => `${it.def}|${it.color}|${secondColor(it) ?? ""}`;
export function stackItems(items: readonly ItemInstance[]): ItemStack[] {
  const stacks = new Map<string, ItemInstance[]>();
  for (const it of items) {
    const key = stackKey(it);
    const list = stacks.get(key);
    if (list) list.push(it);
    else stacks.set(key, [it]);
  }
  return [...stacks].map(([key, list]) => ({ key, items: list.sort((a, b) => a.blemish - b.blemish) }));
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
  /** Two-color items only. */
  color2?: string;
  blemish: number;
  seed: number;
}

/**
 * Opens a crate: the strip lands on a tier's present (which opens to one of its items, evenly) or Fischer Random.
 * `force` (testing only): land on Fischer Random, and/or a shiny purity.
 */
export function rollCrate(rng: Rng, crate: CrateDef, force: { fischer?: boolean; shiny?: boolean } = {}): CrateRoll {
  const odds = fischerOdds(crate);
  const first = force.fischer && odds.length ? FISCHER : pick(rng, liveStrip(crate)).tier;
  const fischer = first === FISCHER;
  const inside = fischer ? [] : presentItems(crate, first);
  const def = fischer ? pick(rng, odds).item : inside[Math.min(inside.length - 1, Math.floor(rng() * inside.length))]!;
  const color = pick(rng, ITEM_COLORS).id;
  const blemish = force.shiny ? Math.round(rng() * 99) / 10 : rollBlemish(rng);
  const seed = Math.floor(rng() * 2 ** 31);
  const roll: CrateRoll = { fischer, def, color, blemish, seed };
  if (itemDef(def)?.colors === 2) roll.color2 = pick(rng, ITEM_COLORS).id;
  return roll;
}

/** Chance of landing on a tier's box (or Fischer Random), out of 1. */
export function presentChance(crate: CrateDef, tier: string): number {
  const strip = liveStrip(crate);
  const total = strip.reduce((s, x) => s + x.weight, 0);
  return (strip.find((x) => x.tier === tier)?.weight ?? 0) / total;
}

/** Chance of a drop's item, out of 1 (for the crate page): its box's chance, shared evenly, or via Fischer Random. */
export function itemChance(crate: CrateDef, def: string): number {
  const tier = itemDef(def)?.tier;
  if (!tier || !crate.items.includes(def)) return 0;
  if (tier !== "legendary" && tier !== "mythic") return presentChance(crate, tier) / presentItems(crate, tier).length;
  return (presentChance(crate, FISCHER) * (fischerOdds(crate).find((x) => x.item === def)?.weight ?? 0)) / 100;
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
