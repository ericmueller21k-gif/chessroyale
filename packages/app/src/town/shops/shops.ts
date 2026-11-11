/**
 * The homes you can go into (Nov 2, round 1: Babur's circus tent and Puddles' greenhouse, the shops' first interiors; then Alfil's
 * pyramid and Big Boy's crib; Nov 3, Timber's lodge, Dash's sneaker store and Hollow's cave; Nov 4, Wrangler's barn and Jefferson's warehouse; Nov 5, Ginger's igloo and Folio's Folded House; Nov 6, Smudgy's Art Gallery), what
 * each shop sells, and the words its cards say. Light: the town imports it to know which home's card says "Go in"; the room
 * itself (its art, its drawing) loads only when you go in (ShopRoom.tsx). docs/decisions/2026-11-02-shop-interiors-r1.md.
 *
 * Round 2 (Nov 2, docs/decisions/2026-11-02-boss-tokens.md): what you hold is your locker's (the boss's tokens, your crate keys),
 * and `buyBossCrate` is the purchase: the server takes the price and puts the crate in your inventory, in one transaction (since
 * Eric's Nov 2 fixes it isn't opened at once: you open it in the Crates tab, as any crate).
 */
import { BOSS_CRATE_PRICE, BOSS_CRATE_POOL, BOSS_ROSTER, adminPlayable, bossCrateOf, itemDef, tierInfo } from "@chessroyale/core";
import { buyBossCrateOnServer, tokenCount } from "../../account.ts";
import type { HomeId } from "../world.ts";
import type { SkyTone } from "../sky.ts";
import type { Sq } from "./room.ts";
import { ZEBRA_BACK_LINES } from "./zebra-lines.ts";

export interface ShopDef {
  /** Its home. */
  home: HomeId;
  /** The boss whose shop it is, as the town names it ("Babur"). */
  boss: string;
  /** Its crate's name, word for word ("Babur's Boss Crate"); null: none yet (Rolling Dough, Nov 11: its Shopkeeper's chat only). */
  crate: string | null;
  /** A shop with no crate yet: what its Shopkeeper says to Talk, one at random each time, in a bubble over him (Rolling Dough's). */
  says?: readonly string[];
  /**
   * The home's second room (Rolling Dough's back room, Nov 11): reached through its door from the front room, not from the town; its
   * "Shopkeeper" is the boss himself (`name`), drawn as one of the room's people (`hideKid`), talked to from `talkAt`.
   */
  part?: "back";
  /** The talk card's name ("Don Dough"); none: "Shopkeeper". */
  name?: string;
  /** No Shopkeeper sidekick drawn (the back room: Don Dough is one of its people, shops/zebra-scene.ts). */
  hideKid?: true;
  /** Where you stand to talk (room.ts Room.talkAt: Don Dough's, the foot of his table); none: within talking range of `keeper`. */
  talkAt?: readonly Sq[];
  /** The Shopkeeper: the boss's kid (its sheet's name in town/sidekicks/), drawn at `at` (a square, fractions allowed). */
  kid: "babur" | "puddles" | "alfil" | "bigboy" | "timber" | "blitz" | "hollowdog" | "rooster" | "dealer" | "elf" | "folioturtle" | "smudgykeeper" | "funkeeper" | "zebrakeeper";
  at: readonly [number, number];
  /**
   * Drawn at the art's own size, this many of the room's pixels (37 a square) from its feet to the top of its idle, rather than the
   * kids' `sidekickSquares` (Jefferson's dealer, Nov 4: a giraffe, 79 px, drawn 1:1 as the art has him). None: the kids' size.
   */
  tall?: number;
  /** Faces west (the sheet mirrored): Jefferson's dealer, in the north-east corner, looking along the floor. None: as drawn (east). */
  flip?: true;
  /** The pieces whose squares mean "talk" when tapped, besides the counter's (a shop with no counter: Jefferson's crate and corner). */
  talk?: readonly string[];
  /**
   * How far the Shopkeeper stands raised over `at` (the room's art pixels, 37 a square): on the counter's top rather than behind it
   * (Wrangler's rooster, Nov 4: Eric's pick, "on the counter", so he reads clearly). None: on the floor, as every other.
   */
  lift?: number;
  /** The squares the Shopkeeper stands on (nobody else can): you can talk to it within `SHOP_FEEL.talkRange` of one. */
  keeper: readonly Sq[];
  /** What the crate can give (its items' ids in core's ITEM_DEFS): the boss's ride first, always. */
  prizes: readonly string[];
  /**
   * Above the walls: a tent's canvas, a greenhouse's glass, a pyramid's sandstone, a nursery's sky-blue ceiling with clouds and
   * stars, a lodge's dark planks between heavy beams, a store's white ceiling tiles and light panels, a cave's dark stone and
   * stalactites, a barn's dark rafters and cross beams, a warehouse's dark steel trusses, an igloo's dome of ice blocks arching overhead, or a
   * sanctuary's pale folded paper, its pleats running up to a fold overhead, a studio's dark beams over a skylight, or an arcade's
   * night-purple ceiling hung with strings of bulbs, a bakery's warm ceiling of light beams, or its back room's dark rafters (drawn by
   * the game, not the art: as the mockup did).
   */
  roof: "tent" | "glass" | "stone" | "nursery" | "lodge" | "store" | "cave" | "barn" | "warehouse" | "igloo" | "paper" | "studio" | "arcade" | "bakery" | "backroom";
  /**
   * The chat log's text over the room (Eric, Nov 2: "white, or black, depending on darkness of background in the shop"): "night" for
   * a dark room (white words on a dark tint: Babur's tent), "day" for a light one (dark words on a light tint: Puddles' greenhouse),
   * whatever the town's sky is doing outside. The town's own two tones (TownChat's `data-tone`).
   */
  chatTone: SkyTone;
}

export const SHOPS: Readonly<Partial<Record<HomeId, ShopDef>>> = {
  // Stripes stands beside the counter's east end, a little behind it: behind the counter itself its 58 px hides him (the
  // mockup's place, scripts/boss-art/shop-view.ts).
  tiger: { home: "tiger", boss: "Babur", crate: "Babur's Boss Crate", kid: "babur", at: [12.6, 2.6], keeper: [{ c: 12, r: 2 }, { c: 13, r: 2 }], prizes: ["balloon-pup"], roof: "tent", chatTone: "night" },
  // Drizzle stands behind the middle of the low potting counter (44 px: Drizzle shows over it).
  gardener: { home: "gardener", boss: "Puddles", crate: "Puddles' Boss Crate", kid: "puddles", at: [9.5, 2], keeper: [{ c: 9, r: 2 }, { c: 10, r: 2 }], prizes: ["puddles-mower"], roof: "glass", chatTone: "day" },
  // Woolly stands behind the middle of the low counter (its body 29 px: Woolly shows over it), as the mockup has him.
  alfil: { home: "alfil", boss: "Alfil", crate: "Alfil's Boss Crate", kid: "alfil", at: [9.5, 2], keeper: [{ c: 9, r: 2 }, { c: 10, r: 2 }], prizes: ["alfil-howdah"], roof: "stone", chatTone: "day" },
  // Blocky stands behind the middle of the low letter-block counter (29 px: Blocky shows over it), as the mockup has him.
  bigboy: { home: "bigboy", boss: "Big Boy", crate: "Big Boy's Boss Crate", kid: "bigboy", at: [9.5, 2], keeper: [{ c: 9, r: 2 }, { c: 10, r: 2 }], prizes: ["bigboy-buggy"], roof: "nursery", chatTone: "day" },
  // Rivet stands behind the middle of the 30 px workbench (his 50 px show over it), as the art's notes have him. A light room (honey
  // planks, big windows): the day tone. (Timber's home is in an admin's town only for now: world.ts ADMIN_TOWN.)
  timber: { home: "timber", boss: "Timber", crate: "Timber's Boss Crate", kid: "timber", at: [9.5, 2], keeper: [{ c: 9, r: 2 }, { c: 10, r: 2 }], prizes: ["log-roller"], roof: "lodge", chatTone: "day" },
  // Tick stands behind the 30 px sneaker counter, on its squares as Rivet does, but drawn half a square further back and west
  // (`at`): a low tortoise, his head out front at his right, which on row 2 behind the counter's middle hid under its shoe boxes and
  // top; from there his head and the clock on his shell show over it. A light room (pale terrazzo, white walls, sunny windows): the
  // day tone. (Dash's home is in an admin's town only for now: world.ts ADMIN_TOWN.)
  dash: { home: "dash", boss: "Dash", crate: "Dash's Boss Crate", kid: "blitz", at: [9, 1.5], keeper: [{ c: 9, r: 2 }, { c: 10, r: 2 }], prizes: ["cheetah-shoes"], roof: "store", chatTone: "day" },
  // Hollow's dog stands behind the 30 px counter in the cave's back hollow, round the bend (the counter on columns 4-7 of row 4), on
  // his squares and drawn at the art's place for him (shop-hollow-nov3.md). He has no name: "Shopkeeper". A dark cave: the night tone.
  hollow: { home: "hollow", boss: "Hollow", crate: "Hollow's Boss Crate", kid: "hollowdog", at: [5.5, 2.4], keeper: [{ c: 5, r: 2 }, { c: 6, r: 2 }], prizes: ["hollow-bulb"], roof: "cave", chatTone: "night" },
  // Wrangler's rooster stands ON the 30 px counter (Eric's pick, Nov 4), on its middle (column 9.5 of row 3, its own row, between
  // the corn basket and the rope coil), raised to its plank top (`lift`: the counter's foot is 27 px under it, shop-pig-nov4.md);
  // his squares are behind it, as every Shopkeeper's. He has no name: "Shopkeeper". A plank barn in the evening light: the day tone.
  pig: { home: "pig", boss: "Wrangler", crate: "Wrangler's Boss Crate", kid: "rooster", at: [9.5, 3], lift: 27, keeper: [{ c: 9, r: 2 }, { c: 10, r: 2 }], prizes: ["pen-pony"], roof: "barn", chatTone: "day" },
  // Jefferson's shop is "literally just a guy in the corner" (Eric, Nov 4): the shady dealer giraffe in the floor's north-east corner
  // by the taped SHOP sign, facing west, drawn at his art's size (79 px: shop-grex-nov4.md), on his squares; no counter, so a tap on
  // his Boss Crate (on the floor beside him) or the bare corner behind him means talk too. He has no name: "Shopkeeper". Bright
  // concrete under high-bay lamps: the day tone.
  // Ginger's igloo candy shop (Nov 5): the shopkeeper elf in his Santa hat behind the little half-round stand at the back middle,
  // under the CANDY sign, drawn at his art's size (25 px: shop-ginger-nov5.md), facing our right, on his squares. He has no name:
  // "Shopkeeper". Packed snow under warm candy-shop light: the day tone. The room's second walking level (the catwalk and its two
  // staircases) is its art's (shops/levels.ts).
  gingerbread: { home: "gingerbread", boss: "Ginger", crate: "Ginger's Boss Crate", kid: "elf", at: [9.5, 5.2], tall: 25, keeper: [{ c: 9, r: 5 }, { c: 10, r: 5 }], prizes: ["ginger-sled"], roof: "igloo", chatTone: "day" },
  // Folio's sanctuary (Nov 5): its paper turtle behind the middle of the low (19 px) writing counter, at the art's keeper spot
  // (shop-folio-nov5.md: its squares 9 and 10 of row 2, drawn at 9.5, 2.4). It has no name: "Shopkeeper". A room of pale paper: the
  // day tone. Its Paper Crane first in its crate (its ride).
  folio: { home: "folio", boss: "Folio", crate: "Folio's Boss Crate", kid: "folioturtle", at: [9.5, 2.4], keeper: [{ c: 9, r: 2 }, { c: 10, r: 2 }], prizes: ["folio-crane"], roof: "paper", chatTone: "day" },
  // Smudgy's studio (Nov 6): its gallery owner (an older chameleon in a smock and glasses) behind the middle of the low counter, as
  // Folio's turtle. It has no name: "Shopkeeper". A dark room of deep paint: the night tone. His Brush Ride first in his crate (his ride).
  smudgy: { home: "smudgy", boss: "Smudgy", crate: "Smudgy's Boss Crate", kid: "smudgykeeper", at: [9.5, 2.4], keeper: [{ c: 9, r: 2 }, { c: 10, r: 2 }], prizes: ["smudgy-brush"], roof: "studio", chatTone: "night" },
  // Boingo's Funhouse (Nov 6): the clown attendant behind the middle of the glass prize counter (columns 9-12 of row 3, its
  // squares 10 and 11 of row 2), the pogo on its pedestal beside him. He has no name: "Shopkeeper". A dark arcade full of lights:
  // the night tone. His pogo first in his crate (his ride). The room is 24 x 24 (boingo-art.ts SHOP_BOINGO_N).
  clown: { home: "clown", boss: "Boingo", crate: "Boingo's Boss Crate", kid: "funkeeper", at: [10.5, 2.2], keeper: [{ c: 10, r: 2 }, { c: 11, r: 2 }], prizes: ["boingo-pogo"], roof: "arcade", chatTone: "night" },
  grex: { home: "grex", boss: "Jefferson", crate: "Jefferson's Boss Crate", kid: "dealer", at: [16.8, 3.2], tall: 79, flip: true, talk: ["crate", "corner-shop"], keeper: [{ c: 16, r: 3 }, { c: 17, r: 3 }], prizes: ["jefferson-giraffe"], roof: "warehouse", chatTone: "day" },
  // Rolling Dough (Nov 11, Don Dough's bakery; an admin's town only while he's in the game for admins first): the counter zebra in his
  // baker's cap behind the counter, left of the register, facing into the room (the art's SHOP_ZEBRA_KEEPER), drawn at his art's size
  // (73 px). He has no name: "Shopkeeper". No crate yet (his items come later): Talk has him say one of his lines. A bright bakery:
  // the day tone. Its back room is BACK_ROOMS'.
  zebra: { home: "zebra", boss: "Don Dough", crate: null, says: ZEBRA_BACK_LINES, kid: "zebrakeeper", at: [12.5, 7.3], tall: 73, flip: true, keeper: [{ c: 12, r: 7 }, { c: 13, r: 7 }], prizes: [], roof: "bakery", chatTone: "day" },
};

/**
 * The homes' second rooms (Nov 11: Rolling Dough's back room, through the door at the front room's back left). Don Dough sits in his
 * wingback at the head of the table; you talk to him from its foot (the art's challenge mark, facing him across it), or by tapping him
 * or the table. A dim room: the night tone.
 */
export const BACK_ROOMS: Readonly<Partial<Record<HomeId, ShopDef>>> = {
  zebra: {
    home: "zebra",
    part: "back",
    boss: "Don Dough",
    name: "Don Dough",
    crate: null,
    kid: "zebrakeeper",
    hideKid: true,
    at: [4.3, 6.82],
    keeper: [{ c: 4, r: 7 }],
    talk: ["table", "armchair", "bench"],
    talkAt: [{ c: 8, r: 6 }, { c: 8, r: 7 }],
    prizes: [],
    roof: "backroom",
    chatTone: "night",
  },
};
/**
 * A boss met inside his home can be fought (Don Dough, Nov 11): his boss is in the game (core's roster, with his character and powers;
 * in the game for admins first, so his home is in an admin's town only). Until his boss lands (another helper's round), his card's
 * Challenge stays greyed, "Coming soon", and the talk beat still plays.
 */
export const canChallengeInside = (id: HomeId): boolean => BOSS_ROSTER.some((b) => b.id === id && adminPlayable(b));
/** A home's room: its front (the shop, from the town) or its back room. */
export const roomDef = (id: HomeId, part: "front" | "back" = "front"): ShopDef | null => (part === "back" ? BACK_ROOMS[id] : SHOPS[id]) ?? null;

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
/** The rest of a boss crate's prizes, in a line under its ride: "+ 24 Beta Crate items, Common to Epic". */
export const POOL_LINE = `+ ${BOSS_CRATE_POOL.length} Beta Crate items, Common to Epic`;

/** What you hold of a boss's tokens and of crate keys: your locker's, as the server last said. */
export const bossHoldings = (boss: HomeId): Holdings => tokenCount(boss);

/** You hold enough to buy the crate that way (its button is greyed otherwise; the server checks again). */
export const canAfford = (h: Holdings, way: CrateWay): boolean => {
  const p = way === "tokens" ? { tokens: BOSS_CRATE_PRICE.tokens, keys: 0 } : BOSS_CRATE_PRICE.withKey;
  return h.tokens >= p.tokens && h.keys >= p.keys;
};

/** What a buy came to: done, or why not (shown under the buttons). */
export interface BuyResult {
  ok: boolean;
  message: string;
}
/** A buy's answer (Eric, Nov 2: "it says when you buy it it's in your inventory"): "Babur's Boss Crate is in your inventory." */
export const inInventoryLine = (crate: string) => `${crate} is in your inventory.`;
/**
 * Buys a boss's crate one of its two ways. Every buy button goes through here, and only here: the server takes the price (the
 * tokens, and the key) and puts the crate in your inventory, unopened, in one transaction (server/boss-tokens.ts), or says why not.
 */
export async function buyBossCrate(boss: HomeId, way: CrateWay): Promise<BuyResult> {
  const crate = bossCrateOf(boss);
  if (!crate) return { ok: false, message: "This crate isn't sold yet." };
  try {
    await buyBossCrateOnServer(crate.id, way);
    return { ok: true, message: inInventoryLine(crate.name) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
  }
}
