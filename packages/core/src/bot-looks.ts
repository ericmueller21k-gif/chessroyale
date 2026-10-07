import { ITEM_COLORS, itemDef, type ItemLook } from "./crates.ts";
import { mulberry32, weightedIndex, type Rng } from "./rng.ts";
import { BOT_LOOKS } from "./settings.ts";
import { idHash } from "./votes.ts";

/** What a bot wears: a shop hat ("none" for none) and crate items, drawn like anyone's (the app's Avatar). */
export interface BotLook {
  hat: string;
  look: ItemLook;
}

type Kind = keyof typeof BOT_LOOKS.odds;
const KINDS = Object.keys(BOT_LOOKS.odds) as Kind[];

const pickOne = <T>(rng: Rng, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rng() * list.length))]!;
/** A colour by the crates' odds (red and yellow common, Pearl rare). */
const colour = (rng: Rng) => ITEM_COLORS[weightedIndex(rng, ITEM_COLORS.map((c) => c.weight))]!.id;

/**
 * A bot's outfit, seeded by its name (or id): the same bot always looks the same, in every match. Mostly one thing (a
 * shop hat, or one crate head piece, face piece or weapon), rarely two, plenty plain, at the odds in BOT_LOOKS
 * (settings.ts). Only items that already exist. Nothing here changes how a match is played.
 */
export function botLook(seed: string): BotLook {
  const rng = mulberry32(idHash(`look:${seed}`));
  const kind = KINDS[weightedIndex(rng, KINDS.map((k) => BOT_LOOKS.odds[k]))]!;
  const look: ItemLook = {};
  let hat = "none";
  /** A crate item in its slot: a colour (two for two-colour items) and a purity in BOT_LOOKS.purity. */
  const wear = (slot: "head" | "face" | "weapon", def: string) => {
    const [lo, hi] = BOT_LOOKS.purity;
    const blemish = Math.round((100 - (lo + rng() * (hi - lo))) * 10) / 10;
    const color = colour(rng);
    const color2 = itemDef(def)?.colors === 2 ? { color2: colour(rng) } : {};
    look[slot] = { def, color, ...color2, blemish, seed: Math.floor(rng() * 2 ** 31) };
  };
  /** Something on its head: a shop hat, or a crate head piece. */
  const topper = (crate: boolean) => {
    if (crate) wear("head", pickOne(rng, BOT_LOOKS.head));
    else hat = pickOne(rng, BOT_LOOKS.shopHats);
  };
  switch (kind) {
    case "shopHat":
      topper(false);
      break;
    case "head":
      topper(true);
      break;
    case "face":
      wear("face", pickOne(rng, BOT_LOOKS.face));
      break;
    case "weapon":
      wear("weapon", pickOne(rng, BOT_LOOKS.weapon));
      break;
    case "two":
      topper(rng() < 0.5);
      if (rng() < BOT_LOOKS.twoWeaponShare) wear("weapon", pickOne(rng, BOT_LOOKS.weapon));
      else wear("face", pickOne(rng, BOT_LOOKS.face));
      break;
    case "plain":
      break;
  }
  return { hat, look };
}
