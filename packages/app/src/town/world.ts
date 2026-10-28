/**
 * The town square's world: where the homes stand, who walks where, and the little lives of the bosses and bots (no
 * drawing, no DOM). Everyone in the square, you and the bots, is a Person in one list (`people`): the drawing and the
 * taps only read that list, so real players (a room of up to about a hundred, fed by a server, later) can replace the
 * bots without touching either. The bots are one source that moves its people. Ported from the prototype Eric tested (docs/mockups/town-square/prototype.html): the same
 * square-to-square walk, the same hobble, the same pauses. Every number that shapes the feel is in feel.ts.
 */
import type { ItemLook } from "@chessroyale/core";
import { SELECT_LINES } from "../characters/boss-select.ts";
import { N, wrapF, wrapI } from "./camera.ts";
import { TOWN_FEEL } from "./feel.ts";
import { SIDEKICK_SHEETS, type SidekickSheet } from "./sidekick-sheets.ts";

export interface Sq {
  c: number;
  r: number;
}

/**
 * The Colosseum's ground in the world's middle (12 x 12 squares since slice 6, which made it about twice its size; slice 5
 * built it on 6 x 6: solid, you walk round it). `c0`, `r0` its first column and row. Its gate faces south, over the park
 * toward your start. (Row 28 since the park moved away from it: `WALK_ROWS`.)
 */
export const COLISEUM = { c0: 17, r0: 28, size: 12 } as const;
/** Whether (c, r) is the Colosseum's ground. */
export const onColiseum = (c: number, r: number): boolean => {
  const i = wrapI(c) - COLISEUM.c0;
  const j = wrapI(r) - COLISEUM.r0;
  return i >= 0 && i < COLISEUM.size && j >= 0 && j < COLISEUM.size;
};
/**
 * The apron: the open squares in front of the Colosseum's gate, as wide as the Colosseum and `APRON_ROWS` deep, where people
 * gather (nothing is built there; your start is on it). Nearest the gate first: a tap on the Colosseum ends you on the
 * first free one (`destFor`), so a crowd at the gate grows outward from it in a half ring.
 */
export const APRON_ROWS = 3;
/**
 * Between the apron and the park's north walk, the promenade carries on across this many rows of the town's board, so
 * the park stands back from the Colosseum (Eric, Oct 26: "It shouldn't literally be right next to it… 8 to 10 tiles away";
 * its nearest tables are 8 rows from its wall).
 */
export const WALK_ROWS = 4;
/** The middle of the gate's sill, on the Colosseum's front edge (between its two middle columns). */
const GATE_X = COLISEUM.c0 + (COLISEUM.size - 1) / 2;
const GATE_Y = COLISEUM.r0 - 0.5;
export const APRON: readonly Sq[] = Array.from({ length: COLISEUM.size * APRON_ROWS }, (_, i) => ({ c: COLISEUM.c0 + (i % COLISEUM.size), r: COLISEUM.r0 - 1 - Math.floor(i / COLISEUM.size) })).sort(
  (a, b) => Math.hypot(a.c - GATE_X, a.r - GATE_Y) - Math.hypot(b.c - GATE_X, b.r - GATE_Y),
);

/** The two statues on the Colosseum's front (houses/statues.ts draws them): the marble statue and the bronze statue. */
export type StatueId = "marble" | "bronze";
/**
 * A statue, and the apron square right in front of it (c, r) where you stand to look at it: stopping there (or where a
 * tap on the statue sent you) brings the camera in close on it, and its quote renders in on its pedestal.
 */
export interface Statue {
  id: StatueId;
  c: number;
  r: number;
  /** Its quote, word for word (no attribution: Eric). */
  quote: string;
}
/**
 * The marble statue (the Hidden Boss in stone) before the Colosseum ground's first column, on the gate's left; the bronze
 * statue before its last, on the gate's right (from the ground's size, so they follow it if it grows). Quotes: Eric's,
 * Oct 26.
 */
export const STATUES: readonly Statue[] = [
  { id: "marble", c: COLISEUM.c0, r: COLISEUM.r0 - 1, quote: "Nothing is so healing as the human touch" },
  { id: "bronze", c: COLISEUM.c0 + COLISEUM.size - 1, r: COLISEUM.r0 - 1, quote: "Concrete considerations always take precedence over general principles" },
];
/** The statue whose viewing square (c, r) is, or null. */
export const statueAt = (c: number, r: number): Statue | null => STATUES.find((s) => s.c === wrapI(c) && s.r === wrapI(r)) ?? null;

// ---- The park (slice 6; Eric, Oct 26: "a little park… filled with chess boards on little tables where you can walk up
// and sit… benches, sidewalks, even a water fountain in the middle, trees… a very cozy city park feel. I'd say 10 chess
// boards to start with… open up the space in front of the coliseum and it can go there").

/**
 * The park in front of the Colosseum's gate, south of its apron and the walk: 20 squares across (the Colosseum's 12 and 4
 * more each side), 11 deep. `c0` its first column, `r1` its row nearest the gate (the camera looks north, r rising).
 */
export const PARK = { c0: COLISEUM.c0 - 4, r1: COLISEUM.r0 - APRON_ROWS - WALK_ROWS - 1, w: 20, d: 11 } as const;
/**
 * Its plan, a row a line from the gate's side (north) to the plaza's (south), a square a letter: `=` paving, `.` grass,
 * `t` a tree (on grass), `b` a bench (on grass, facing south), `B` a bench on paving, `T` a chess table (its two stools
 * `s` either side, facing each other across it), `F` the fountain (2 x 2, on paving; `f` its other squares). A paved
 * walk all round; the promenade (4 wide) runs up the middle from the plaza to the gate, round the fountain in the
 * middle; five tables either side of it; lawns with trees and benches outside them.
 */
const PARK_PLAN = [
  "====================",
  "=.t..sTs====sTs..t.=",
  "=...b...====...b...=",
  "=t...sTs====sTs...t=",
  "=......B====B......=",
  "=.t..sTs=Ff=sTs..t.=",
  "=......==ff==......=",
  "=t...sTs====sTs...t=",
  "=...b...====...b...=",
  "=.t..sTs====sTs..t.=",
  "====================",
] as const;

/** What a square of ground is: the town's board, paving (the park's walks, the Colosseum's apron) or the park's grass. */
export const BOARD_GROUND = 0;
export const PAVING = 1;
export const GRASS = 2;
/** Each square's ground (index r * N + c). */
export const groundAt = new Uint8Array(N * N);

/** A chess table: its square (solid) and its two stools (walkable), west and east of it, facing each other across it. */
export interface Table {
  i: number;
  c: number;
  r: number;
  stools: readonly [Sq, Sq];
}
/** Something standing in the park: a tree, a bench, the fountain, a chess table (with its stools) or a lamp. */
export interface Prop {
  kind: "tree" | "bench" | "fountain" | "table" | "lamp";
  /** Its square (the fountain's: its front left one). */
  c: number;
  r: number;
  /** Where its picture's foot stands (the fountain's: the middle of its front edge). */
  x: number;
  y: number;
  /** Its variant (the trees differ a little: 0 to 2). */
  v: number;
  /** A table's index in TABLES (-1: not a table). */
  table: number;
}
const tables: Table[] = [];
const props: Prop[] = [];
/** Squares something in the park stands on (walked round). */
const parkSolid = new Uint8Array(N * N);
PARK_PLAN.forEach((line, v) => {
  const r = PARK.r1 - v;
  for (let u = 0; u < PARK.w; u++) {
    const ch = line[u]!;
    const c = PARK.c0 + u;
    const k = r * N + c;
    groundAt[k] = ch === "." || ch === "t" || ch === "b" ? GRASS : PAVING;
    if (ch === "t" || ch === "b" || ch === "B") {
      parkSolid[k] = 1;
      props.push({ kind: ch === "t" ? "tree" : "bench", c, r, x: c, y: r, v: (u * 7 + v * 3) % 3, table: -1 });
    } else if (ch === "T") {
      parkSolid[k] = 1;
      const t: Table = { i: tables.length, c, r, stools: [{ c: c - 1, r }, { c: c + 1, r }] };
      tables.push(t);
      props.push({ kind: "table", c, r, x: c, y: r, v: 0, table: t.i });
    } else if (ch === "F" || ch === "f") {
      parkSolid[k] = 1;
      if (ch === "F" && line[u + 1] === "f") props.push({ kind: "fountain", c, r: r - 1, x: c + 0.5, y: r - 1.5, v: 0, table: -1 });
    }
  }
});
// The Colosseum's apron is paved too, and the promenade's 4 squares across the walk between them.
for (let r = COLISEUM.r0 - APRON_ROWS; r < COLISEUM.r0; r++) for (let c = COLISEUM.c0; c < COLISEUM.c0 + COLISEUM.size; c++) groundAt[r * N + c] = PAVING;
for (let r = PARK.r1 + 1; r < COLISEUM.r0 - APRON_ROWS; r++) for (let c = PARK.c0 + 8; c < PARK.c0 + 12; c++) groundAt[r * N + c] = PAVING;

/**
 * The park's lamps (Oct 27, Eric: "street lamps or like park style lamps, so when it's night and also dusk that they turn
 * on for the little park"): ten, each on a square of its own, solid (walked round) and on paving, where no path needs the
 * square. A pair flanking the promenade where it leaves the park toward the Colosseum and where it comes in from the
 * plaza (on the board's square just outside the park's walk either side of it, paved for its foot), a pair beside the
 * fountain (on the paving either side of its front row, between the tables' stools), and one at each corner of the
 * park's walk (a corner square: walking round it on the grass inside is no longer). The first is the one ahead on your
 * left as the page opens (the e2e test finds it there).
 */
export const LAMPS: readonly Sq[] = [
  { c: PARK.c0 + 7, r: PARK.r1 + 1 },
  { c: PARK.c0 + 12, r: PARK.r1 + 1 },
  { c: PARK.c0 + 7, r: PARK.r1 - 6 },
  { c: PARK.c0 + 12, r: PARK.r1 - 6 },
  { c: PARK.c0, r: PARK.r1 },
  { c: PARK.c0 + PARK.w - 1, r: PARK.r1 },
  { c: PARK.c0 + 7, r: PARK.r1 - PARK.d },
  { c: PARK.c0 + 12, r: PARK.r1 - PARK.d },
  { c: PARK.c0, r: PARK.r1 - PARK.d + 1 },
  { c: PARK.c0 + PARK.w - 1, r: PARK.r1 - PARK.d + 1 },
];
for (const l of LAMPS) {
  const k = l.r * N + l.c;
  parkSolid[k] = 1;
  groundAt[k] = PAVING;
  props.push({ kind: "lamp", c: l.c, r: l.r, x: l.c, y: l.r, v: 0, table: -1 });
}
/** The ten chess tables, in the plan's order (north to south, west to east). */
export const TABLES: readonly Table[] = tables;
/** Everything standing in the park. */
export const PROPS: readonly Prop[] = props;
/** The table whose stool (c, r) is, or null. */
export const stoolAt = (c: number, r: number): Table | null => {
  const wc = wrapI(c);
  const wr = wrapI(r);
  return TABLES.find((t) => t.stools.some((s) => s.c === wc && s.r === wr)) ?? null;
};
/** The table on square (c, r), or null. */
export const tableAt = (c: number, r: number): Table | null => TABLES.find((t) => t.c === wrapI(c) && t.r === wrapI(r)) ?? null;

/**
 * Your square when the page opens: in the park on its promenade, between its two rows of tables nearest the Colosseum,
 * facing it (the camera looks north, r rising): the tables round you, the fountain behind you, and the walk across to
 * the Colosseum looming beyond (near enough to stand inside the view's rim, not on its horizon).
 */
export const START: Sq = { c: PARK.c0 + 9, r: PARK.r1 - 3 };

export type HomeId = "tiger" | "gingerbread" | "grex" | "hollow" | "moo" | "clown" | "bigboy" | "sawyer" | "pig" | "smudgy" | "hopper" | "gardener" | "alfil" | "folio";

/**
 * A place with a picture, a name (floating over it and on its sign) and an edge chip: a boss's home, or the Colosseum.
 * (cx, cy) is its ground's middle.
 */
export interface Place {
  id: HomeId | "coliseum";
  /** Its name: written by the game (floating over it, and on its sign), never drawn into the art. */
  name: string;
  /** The chip's ring color. */
  color: string;
  cx: number;
  cy: number;
  /** Half its ground's side, in squares (a home's 3 x 3 plot: 1.5). */
  half: number;
  /** Where its picture's foot stands, in squares in front of (cx, cy) (a home's: half a square). */
  foot: number;
}

/** A boss's home: a 3 x 3 plot. (cx, cy) is its middle square. */
export interface Home extends Place {
  id: HomeId;
  /** The boss's name. */
  boss: string;
}

/**
 * The Colosseum as a place: its name, its chip's ring (the game's navy), its ground's middle; its picture's foot (the
 * gate's sill) stands on its ground's front edge.
 */
export const COLISEUM_PLACE: Place = { id: "coliseum", name: "The Colosseum", color: "#1f2530", cx: GATE_X, cy: COLISEUM.r0 + (COLISEUM.size - 1) / 2, half: COLISEUM.size / 2, foot: COLISEUM.size / 2 };

/**
 * The fourteen homes, spread evenly round the middle (the Colosseum and its park) over the 46 x 46 world that wraps: every
 * home's nearest neighbor is 8 to 10 squares away, as on slice 3's smaller map, and no home's roaming ground reaches the
 * park or the Colosseum (docs/decisions/2026-10-26-town-square-slice-6.md has the map). Pairs that play off each other
 * stand side by side: Ginger Igloo and Jefferson's Fireworks (ice and fire), Hollow Peak and Moo & Moon Meadow (dark and
 * night). Names: "Ginger Igloo", "Hollow Peak" and "Moo & Moon Meadow" are Eric's; the rest the director's.
 */
export const HOMES: readonly Home[] = (
  [
    { id: "gingerbread", boss: "Ginger", name: "Ginger Igloo", color: "#3fae4f", cx: 39, cy: 11 },
    { id: "grex", boss: "Jefferson", name: "Jefferson's Fireworks", color: "#e5566a", cx: 39, cy: 3 },
    { id: "tiger", boss: "Babur", name: "Babur's Circus", color: "#2f7fe0", cx: 28, cy: 4 },
    { id: "bigboy", boss: "Big Boy", name: "Big Boy's Crib", color: "#23a8a8", cx: 43, cy: 31 },
    { id: "hollow", boss: "Hollow", name: "Hollow Peak", color: "#7a4fd0", cx: 0, cy: 43 },
    { id: "moo", boss: "Moo & Moon", name: "Moo & Moon Meadow", color: "#5d7ad8", cx: 8, cy: 40 },
    { id: "alfil", boss: "Alfil", name: "Alfil's Pyramid", color: "#b4840f", cx: 23, cy: 43 },
    { id: "smudgy", boss: "Smudgy", name: "Smudgy's Art Gallery", color: "#f5832d", cx: 35, cy: 40 },
    { id: "clown", boss: "Boingo", name: "Boingo's Funhouse", color: "#7d3b93", cx: 5, cy: 27 },
    { id: "hopper", boss: "Chub & Chirp", name: "Chub & Chirp's Grassland", color: "#447a1f", cx: 6, cy: 8 },
    { id: "gardener", boss: "Puddles", name: "Puddles' Botanical Garden", color: "#d6747b", cx: 16, cy: 2 },
    { id: "sawyer", boss: "Sawyer", name: "Sawyer's Woodshed", color: "#d39a0b", cx: 40, cy: 23 },
    { id: "pig", boss: "Wrangler", name: "Wrangler's Stall", color: "#8f5629", cx: 4, cy: 17 },
    // (Oct 27: Folio's, east of the Colosseum, the gap between Big Boy's Crib, Sawyer's Woodshed and Smudgy's Gallery; its ring
    // the vermilion of its seal. docs/decisions/2026-10-27-folio-wired.md.)
    { id: "folio", boss: "Folio", name: "Folio's Folded House", color: "#d8432a", cx: 33, cy: 30 },
  ] satisfies Omit<Home, "half" | "foot">[]
).map((h) => ({ ...h, half: 1.5, foot: 0.5 }));
/** Every place: the homes (in the bosses' order), then the Colosseum. */
export const PLACES: readonly Place[] = [...HOMES, COLISEUM_PLACE];

/**
 * What a home's card says, in turn, the next line each time it opens (a tap on the boss or on its home). Only Hollow's
 * (Eric, Oct 28: his sidekick is stronger than he is, "his boss says something about it … something eerie"; these three
 * approved word for word, "lol perfect").
 */
export const TOWN_LINES: Readonly<Partial<Record<HomeId, readonly string[]>>> = {
  hollow: [
    "The little one plays in the dark. Even I don't sit across from him.",
    "Don't let the eyes fool you. He's stronger than I ever was.",
    "I found him in the dark. The dark had been teaching him.",
  ],
};
/** The line a home's card shows the `n`th time it opens (from 0), or null: none for this home. */
export const townLine = (id: HomeId, n: number): string | null => {
  const own = TOWN_LINES[id];
  return own?.length ? own[n % own.length]! : null;
};

/**
 * How a person looks: a pawn (its side, white or black, a tint for a few, and what it wears: crate items, as your own
 * pawn wears them; null, nothing), or a sprite (a boss's sidekick: its `idle`, `walk`, `sit` and `wave`, baked from its
 * art into a sheet: `scripts/bake-sidekicks.ts`). One field on a person, so anything that reads people never asks which.
 */
export type Look = PawnLook | SpriteLook;
export interface PawnLook {
  side: "light" | "dark";
  tint: string | null;
  wear: ItemLook | null;
}
export interface SpriteLook {
  sprite: SidekickSheet;
}
/** Whether a look is a sprite's (a sidekick), not a pawn's. */
export const isSprite = (l: Look): l is SpriteLook => "sprite" in l;

/** A crate item a bot wears (a color from the crates' palette, clean: no blemish, never shiny). */
const item = (def: string, color: string, seed: number, color2?: string) => ({ def, color, ...(color2 ? { color2 } : {}), blemish: 0, seed });

/** A town bot: its short name, its fixed rating (Maia plays it at this rating), its look and, a sidekick, whose. */
export interface TownBot {
  name: string;
  rating: number;
  look: Look;
  /** A boss's sidekick: that boss's home (its card says "<Boss>'s sidekick"). */
  boss?: HomeId;
}

/**
 * The town's bots: a ladder from 600 to 2500 in steps of 100 (Eric, Oct 28: "from the lowest to the highest and just up
 * each … bot by 100"). The six pawns of Oct 27 keep their names and clothes, one every three rungs; the bosses' fourteen
 * sidekicks take the rest, an easier boss's kid lower (the crowd's score against its boss in that boss's latest sim:
 * docs/decisions/2026-10-28-sidekicks-in-town.md), and Hollow's on top, stronger than Hollow (Eric's twist). Names and
 * ratings live here and nowhere else: the tags, the cards and the game all read this table. Names at most 10
 * characters. Shown everywhere as "<name> (bot)" (`botLabel`).
 */
export const BOTS: readonly TownBot[] = [
  { name: "Pin Pete", rating: 600, look: { side: "dark", tint: null, wear: { head: item("beanie", "red", 11) } } },
  { name: "Squirt", rating: 700, look: { sprite: SIDEKICK_SHEETS.boingo }, boss: "clown" },
  { name: "Tex", rating: 800, look: { sprite: SIDEKICK_SHEETS.wrangler }, boss: "pig" },
  { name: "Rook Rita", rating: 900, look: { side: "light", tint: "#ffb3c6", wear: { head: item("party-hat", "cobalt", 12), face: item("scarf", "yellow", 13) } } },
  { name: "Dabble", rating: 1000, look: { sprite: SIDEKICK_SHEETS.smudgy }, boss: "smudgy" },
  { name: "Blocky", rating: 1100, look: { sprite: SIDEKICK_SHEETS.bigboy }, boss: "bigboy" },
  { name: "Fork Frank", rating: 1200, look: { side: "light", tint: "#9fd3ff", wear: { head: item("bandana", "red", 14), face: item("fake-mustache", "midnight", 15) } } },
  { name: "Bun & Bug", rating: 1300, look: { sprite: SIDEKICK_SHEETS.chubchirp }, boss: "hopper" },
  { name: "Pleat", rating: 1400, look: { sprite: SIDEKICK_SHEETS.folio }, boss: "folio" },
  { name: "Tempo Tess", rating: 1500, look: { side: "dark", tint: "#3c6e5a", wear: { head: item("wizard-hat", "sage", 16) } } },
  { name: "Twinkle", rating: 1600, look: { sprite: SIDEKICK_SHEETS.moo }, boss: "moo" },
  { name: "Drizzle", rating: 1700, look: { sprite: SIDEKICK_SHEETS.puddles }, boss: "gardener" },
  { name: "Bishop Bo", rating: 1800, look: { side: "light", tint: null, wear: { head: item("fedora", "midnight", 17), face: item("dark-shades", "midnight", 18) } } },
  { name: "Chip", rating: 1900, look: { sprite: SIDEKICK_SHEETS.sawyer }, boss: "sawyer" },
  { name: "Stripes", rating: 2000, look: { sprite: SIDEKICK_SHEETS.babur }, boss: "tiger" },
  { name: "Gambit Gus", rating: 2100, look: { side: "dark", tint: null, wear: { head: item("little-crown", "yellow", 19) } } },
  { name: "Woolly", rating: 2200, look: { sprite: SIDEKICK_SHEETS.alfil }, boss: "alfil" },
  { name: "Crumb", rating: 2300, look: { sprite: SIDEKICK_SHEETS.ginger }, boss: "gingerbread" },
  { name: "Sparky", rating: 2400, look: { sprite: SIDEKICK_SHEETS.jefferson }, boss: "grex" },
  { name: "Glim", rating: 2500, look: { sprite: SIDEKICK_SHEETS.hollow }, boss: "hollow" },
];
/** A bot's name as the town and the game show it: "Pin Pete (bot)" (Eric: "in parentheses like bot after their name"). */
export const botLabel = (b: TownBot): string => `${b.name} (bot)`;
/** A bot's rating as its card says it. */
export const ratingText = (b: TownBot): string => `Rating ${b.rating}`;
/** The first button of a table's card where a bot waits: "Play Tempo Tess (bot) · 1500". */
export const playAtTableText = (b: TownBot): string => `Play ${botLabel(b)} · ${b.rating}`;
/** A sidekick's line on its card, under its name: "Hollow's sidekick" ("Puddles' sidekick", as his home's sign has it); null for a pawn. */
export const sidekickText = (b: TownBot): string | null => {
  const boss = b.boss && HOMES.find((h) => h.id === b.boss)?.boss;
  return boss ? `${boss}${boss.endsWith("s") ? "'" : "'s"} sidekick` : null;
};

/** What a sidekick shows now: sitting at a table, its wave (once, from a tap), walking, or standing. */
export type SpriteAnim = "idle" | "walk" | "sit" | "wave";
/** How long a sprite's wave lasts (ms: its frames once through). */
export function waveMs(sheet: SidekickSheet): number {
  let t = 0;
  for (const ms of sheet.ms.wave) t += Math.max(16, ms);
  return t;
}
/**
 * Which of its animations a sidekick plays at `now`: `sit` on a stool, else its `wave` for one time through after a tap
 * (`Person.waved`), else `walk` while it walks, else `idle`. (Sitting wins: it waves on its feet, not off its stool.)
 */
export function spriteAnim(p: Person, now: number): SpriteAnim {
  if (seated(p)) return "sit";
  if (isSprite(p.look) && now - p.waved < waveMs(p.look.sprite)) return "wave";
  return p.walker.moving() ? "walk" : "idle";
}

/** Which home stands on each square (index r * N + c), or null. */
export const plotAt: (Home | null)[] = new Array(N * N).fill(null);
for (const h of HOMES) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) plotAt[wrapI(h.cy + dr) * N + wrapI(h.cx + dc)] = h;

/** A square you can stand on: not a home's plot, not the Colosseum's ground, nothing in the park standing on it (a stool is a square you stand on). */
export const walkable = (c: number, r: number): boolean => {
  const k = wrapI(r) * N + wrapI(c);
  return plotAt[k] === null && !parkSolid[k] && !onColiseum(c, r);
};
/** Steps between two squares, the short way round. */
export const tdist = (a: Sq, b: Sq): number => Math.abs(wrapF(a.c - b.c)) + Math.abs(wrapF(a.r - b.r));
/** How far a square is from a home's plot (0 on it, 1 on the ring around it). */
export const plotDist = (h: Home, c: number, r: number): number => Math.max(0, Math.abs(wrapF(c - h.cx)) - 1, Math.abs(wrapF(r - h.cy)) - 1);

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** The shortest path (4 ways, wrapping) from `from` to the nearest square that `isGoal` takes, through squares `ok` takes. */
export function findPath(from: Sq, isGoal: (c: number, r: number) => boolean, ok: (c: number, r: number) => boolean): Sq[] | null {
  const start = from.r * N + from.c;
  const prev = new Int32Array(N * N).fill(-1);
  prev[start] = start;
  const q = [start];
  let found = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const k = q[qi]!;
    const c = k % N;
    const r = (k - c) / N;
    if (k !== start && isGoal(c, r)) {
      found = k;
      break;
    }
    for (const [dc, dr] of DIRS) {
      const nc = wrapI(c + dc);
      const nr = wrapI(r + dr);
      const nk = nr * N + nc;
      if (prev[nk] !== -1 || !ok(nc, nr)) continue;
      prev[nk] = k;
      q.push(nk);
    }
  }
  if (found < 0) return null;
  const path: Sq[] = [];
  for (let k = found; k !== start; k = prev[k]!) path.push({ c: k % N, r: (k - (k % N)) / N });
  return path.reverse();
}

/** Where a walker is this frame: its position in squares (unwrapped near its square) and the hobble. */
export interface Pose {
  x: number;
  y: number;
  /** 0 to 1 to 0 over a step. */
  hop: number;
  /** -1 to 1 over a step. */
  tilt: number;
}

/** Claims are numbered in the order they're made: the earlier claim on a square keeps it (keepApart). */
let claims = 0;

/** Someone who walks square to square: you, a bot or a boss. */
export class Walker {
  c: number;
  r: number;
  facing: 1 | -1 = 1;
  /** When it claimed the square it will end on (its goal): the order of `go`s, 0 for where it first stood. */
  claim = 0;
  private queue: Sq[] = [];
  /** The step being taken: from, to, when it began, and whether it eases off from standing and eases into a stop. */
  private step: { fc: number; fr: number; to: Sq; dc: number; dr: number; t0: number; first: boolean; last: boolean } | null = null;
  constructor(
    sq: Sq,
    readonly stepMs: number,
    readonly hobble: boolean,
    /** How much the walk eases into its first step and out of its last (TOWN_FEEL.walkEase; 0 = even steps). */
    readonly ease = 0,
  ) {
    this.c = sq.c;
    this.r = sq.r;
  }
  /** The square it's on, or stepping onto. */
  here(): Sq {
    return this.step ? this.step.to : { c: this.c, r: this.r };
  }
  hereC(): number {
    return this.step ? this.step.to.c : this.c;
  }
  hereR(): number {
    return this.step ? this.step.to.r : this.r;
  }
  moving(): boolean {
    return !!this.step || this.queue.length > 0;
  }
  /** The square it will end on: its path's last, or where it's stepping, or where it stands. */
  goalC(): number {
    return this.queue.length ? this.queue[this.queue.length - 1]!.c : this.hereC();
  }
  goalR(): number {
    return this.queue.length ? this.queue[this.queue.length - 1]!.r : this.hereR();
  }
  goal(): Sq {
    return { c: this.goalC(), r: this.goalR() };
  }
  /** Walk this path (after the step it's on), claiming its last square. */
  go(path: Sq[]): void {
    this.queue = path.slice();
    this.claim = ++claims;
  }
  update(now: number): void {
    for (let g = 0; g < 64; g++) {
      if (this.step) {
        const end = this.step.t0 + this.stepMs;
        if (now < end) return;
        this.c = this.step.to.c;
        this.r = this.step.to.r;
        // (A step that eased into a stop, then got a new path, sets off again as from standing: no jolt.)
        const stopped = this.step.last;
        this.step = null;
        if (!this.queue.length) return;
        this.begin(this.queue.shift()!, end, stopped);
      } else {
        if (!this.queue.length) return;
        this.begin(this.queue.shift()!, now, true);
      }
    }
  }
  /** `first`: a step off from standing still. Whether it's the last is known now (a new path later doesn't change it). */
  private begin(to: Sq, t0: number, first: boolean): void {
    const dc = wrapF(to.c - this.c);
    const dr = wrapF(to.r - this.r);
    if (dc) this.facing = dc < 0 ? -1 : 1;
    this.step = { fc: this.c, fr: this.r, to, dc, dr, t0, first, last: this.queue.length === 0 };
  }
  /** Its pose at `now`, into `out`. */
  pose(now: number, out: Pose): Pose {
    const s = this.step;
    if (!s) {
      out.x = this.c;
      out.y = this.r;
      out.hop = 0;
      out.tilt = 0;
      return out;
    }
    const t = Math.max(0, Math.min(1, (now - s.t0) / this.stepMs));
    const e = this.ease ? ease(t, s.first, s.last, this.ease) : t;
    out.x = s.fc + s.dc * e;
    out.y = s.fr + s.dr * e;
    out.hop = this.hobble ? Math.sin(Math.PI * t) : 0;
    out.tilt = this.hobble ? Math.sin(2 * Math.PI * t) : 0;
    return out;
  }
}

/**
 * Where a step has got to at t (0 to 1): even, or eased into a first step from standing and out of a last one by
 * `amount`. The eased curves meet the even steps at the same speed, so a walk never jolts between squares.
 */
export function ease(t: number, first: boolean, last: boolean, amount: number): number {
  const e = first && last ? t * t * (3 - 2 * t) : first ? t * t * (2 - t) : last ? t * (1 + t - t * t) : t;
  return t + amount * (e - t);
}

/**
 * Someone in the square: you, a bot, later a real player. Their square and the path they're walking are their walker's.
 * The drawing and the taps read only this.
 */
export interface Person {
  id: string;
  name: string;
  look: Look;
  /** This device's player (a gold tag; the camera follows them). */
  you: boolean;
  walker: Walker;
  /**
   * Sits down when it stops on a chess table's stool (`seated`): a bot always does; you do when a tap on a table sent you
   * there, until you walk on or its card closes.
   */
  sit: boolean;
  /** A town bot's entry in BOTS (its name, rating and look); null for you (and, later, real players). */
  bot: TownBot | null;
  /** When it last waved (a sidekick, as you tap it: its `wave` plays once from then); -Infinity: never. */
  waved: number;
  /**
   * A bot at home (Oct 28: `botsOut` are in the square at once, the others take turns): not drawn, not tapped, on no
   * square (its walker isn't among the town's). `came`: when it last came out (it fades in); `leaves`: when it goes home
   * (it fades out until then; Infinity: it stays).
   */
  home: boolean;
  came: number;
  leaves: number;
}

/** Whether a person sits at a chess table now: stopped on one of its stools, meaning to sit. Its table, or null. */
export function seated(p: Person): Table | null {
  const w = p.walker;
  return p.sit && !w.moving() ? stoolAt(w.c, w.r) : null;
}

/**
 * A chess table's state, from who sits at it (Eric, Oct 27): two people, neither of them you, play (its pieces move, its
 * clock above it runs); one, not you, waits for a game (a soft green ring under the free stool: `free`, the stool's index);
 * otherwise its pieces stand set up. You at a table aren't playing or searching yet: Casual and Ranked come with the
 * tables' matchmaking, and then you searching shows the ring too.
 */
export type TableState = { kind: "still" } | { kind: "waiting"; free: 0 | 1 } | { kind: "playing" };

/** Every table's state now (TABLES' order), from the people sitting. */
export function tableStates(people: readonly Person[]): TableState[] {
  const seats = TABLES.map(() => [false, false]);
  const yours = TABLES.map(() => false);
  for (const p of people) {
    const t = seated(p);
    if (!t) continue;
    const w = p.walker;
    const k = t.stools.findIndex((s) => s.c === wrapI(w.c) && s.r === wrapI(w.r));
    if (k < 0) continue;
    seats[t.i]![k] = true;
    if (p.you) yours[t.i] = true;
  }
  return seats.map(([a, b], i): TableState => {
    if (yours[i]) return { kind: "still" };
    if (a && b) return { kind: "playing" };
    if (a !== b) return { kind: "waiting", free: a ? 1 : 0 };
    return { kind: "still" };
  });
}

export interface Boss {
  home: Home;
  walker: Walker;
  /** When it next walks (null: pick a pause). */
  nextAt: number | null;
  /** Whether it was drawn on screen, near enough to talk, last frame (render.ts sets it). */
  onScreen: boolean;
  /** Held where it is (its card is open): it doesn't roam off. */
  held: boolean;
  lastLine: string | null;
}

export interface Town {
  /** Everyone in the square, you first. */
  people: Person[];
  you: Person;
  /** The people the bot source moves (a part of `people`). */
  bots: Person[];
  bosses: Boss[];
  all: Walker[];
  rnd: () => number;
  /** The line being said now: who, what, until when; and when the next may start. */
  speech: { boss: Boss | null; line: string; until: number; next: number };
  nextBotAt: number;
  /** A bot held where it is (its card is open, or its table's card with you across): it doesn't wander off. */
  hold: Person | null;
  /** You and a bot on your way to a table for a game (its card's Play); the game opens once both sit (`meetReady`). */
  meet: Meeting | null;
  /** Back from a game: the bot across gets up and wanders off at `at`. */
  leave: { bot: Person; at: number } | null;
  /** When a bot out next goes home and another comes out (`botTurnMs`). */
  nextTurnAt: number;
}

/** A small seeded generator (the prototype's), in [0, 1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Where you land back in the town after a game with a bot: the table (its index in TABLES), your stool (0 west, 1
 * east) and the bot (its index in BOTS), who sits on the other.
 */
export interface Seat {
  table: number;
  stool: 0 | 1;
  bot: number;
}
/** A seat as the address carries it ("6.0.3"), and back (null: not one). */
export const seatText = (s: Seat): string => `${s.table}.${s.stool}.${s.bot}`;
export function seatOf(text: string | null | undefined): Seat | null {
  const m = /^(\d+)\.([01])\.(\d+)$/.exec(text ?? "");
  if (!m) return null;
  const table = Number(m[1]);
  const bot = Number(m[3]);
  return table < TABLES.length && bot < BOTS.length ? { table, stool: Number(m[2]) as 0 | 1, bot } : null;
}

/**
 * The town as the page opens. `now`: the clock the loop runs on (performance.now). `seat`: back from a game with a bot,
 * you sit on your stool at that table and the bot across (it gets up after `botLeaveAfterGameMs`). `outN`: how many bots
 * are out in the square (`botsOut`; the tests may have them all out).
 */
export function createTown(now: number, seed = 20261025, seat: Seat | null = null, outN = TOWN_FEEL.botsOut): Town {
  const rnd = lcg(seed);
  const f = TOWN_FEEL;
  const table = seat ? TABLES[seat.table]! : null;
  const yours = table ? table.stools[seat!.stool]! : START;
  const theirs = table ? table.stools[1 - seat!.stool]! : null;
  const you: Person = { id: "you", name: "", look: { side: "light", tint: null, wear: null }, you: true, walker: new Walker(yours, f.youStepMs, true, f.walkEase), sit: !!seat, bot: null, waved: -Infinity, home: false, came: -Infinity, leaves: Infinity };
  // Each boss starts on the square in front of its home's middle (toward the camera).
  const bosses: Boss[] = HOMES.map((home) => ({ home, walker: new Walker({ c: home.cx, r: wrapI(home.cy - 2) }, f.bossStepMs, false), nextAt: null, onScreen: false, held: false, lastLine: null }));
  // Who's out (`botsOut` of them, at random; back from a game, the bot you played among them); the others are at home.
  const order = BOTS.map((_, i) => i).sort(() => Math.random() - 0.5);
  if (seat) order.unshift(...order.splice(order.indexOf(seat.bot), 1));
  const out = new Set(order.slice(0, outN));
  // The bots out stand around you in the park, apart (`freeSpot`).
  const bots: Person[] = [];
  for (const [i, b] of BOTS.entries()) {
    // (Back from a game: the bot you played sits across from you.)
    const sq = seat && i === seat.bot ? theirs! : out.has(i) ? freeSpot(rnd, yours, 3, [...(theirs ? [theirs] : []), ...bots.filter((o) => !o.home).map((o) => o.walker.here())]) : START;
    bots.push({ id: `bot:${bots.length}`, name: botLabel(b), look: b.look, you: false, walker: new Walker(sq, f.botStepMs, true), sit: true, bot: b, waved: -Infinity, home: !out.has(i), came: -Infinity, leaves: Infinity });
  }
  const met = seat ? bots[seat.bot]! : null;
  return {
    people: [you, ...bots],
    you,
    bots,
    bosses,
    all: [you.walker, ...bots.filter((b) => !b.home).map((b) => b.walker), ...bosses.map((b) => b.walker)],
    rnd,
    speech: { boss: null, line: "", until: 0, next: now + f.speechFirstMs },
    nextBotAt: now + f.botFirstMs,
    hold: null,
    meet: null,
    leave: met ? { bot: met, at: now + f.botLeaveAfterGameMs } : null,
    nextTurnAt: now + f.botTurnMs[0],
  };
}

/**
 * A square for a bot to stand on in the park (16 x 14 squares round your start): walkable, off the statues' squares and
 * the tables' stools (bots sit down as they wander), off the bosses' roaming ground, at least `fromYou` steps from you and
 * 3 from anyone in `others`, and (`t`) on no one's square.
 */
function freeSpot(rnd: () => number, you: Sq, fromYou: number, others: readonly Sq[], t: Town | null = null): Sq {
  let c = 0;
  let r = 0;
  for (let tries = 0; tries < 800; tries++) {
    c = wrapI(START.c - 8 + Math.floor(rnd() * 16));
    r = wrapI(START.r - 4 + Math.floor(rnd() * 14));
    const sq = { c, r };
    if (walkable(c, r) && !statueAt(c, r) && !stoolAt(c, r) && tdist(sq, you) >= fromYou && !HOMES.some((h) => plotDist(h, c, r) <= TOWN_FEEL.bossRoam) && !others.some((o) => tdist(sq, o) < 3) && !(t && taken(t, c, r, null))) break;
  }
  return { c, r };
}

const between = (t: Town, [a, b]: readonly [number, number]) => a + t.rnd() * (b - a);
const pick = <T>(t: Town, a: readonly T[]): T => a[Math.floor(t.rnd() * a.length)]!;

/**
 * Whether (c, r) is someone else's: the square another walker stands on or will end on (one pawn a square, like chess).
 * Passing over a square doesn't claim it: people walk through each other; only where they stop counts.
 */
export function taken(t: Town, c: number, r: number, except: Walker | null): boolean {
  for (const w of t.all) if (w !== except && w.goalC() === c && w.goalR() === r) return true;
  return false;
}

/** Steps from `from` to every square (-1: no way there), around the homes; people don't block. */
export function stepsFrom(from: Sq, ok: (c: number, r: number) => boolean = walkable): Int16Array {
  const d = new Int16Array(N * N).fill(-1);
  const start = from.r * N + from.c;
  d[start] = 0;
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const k = q[qi]!;
    const c = k % N;
    const r = (k - c) / N;
    for (const [dc, dr] of DIRS) {
      const nk = wrapI(r + dr) * N + wrapI(c + dc);
      if (d[nk] !== -1 || !ok(wrapI(c + dc), wrapI(r + dr))) continue;
      d[nk] = d[k]! + 1;
      q.push(nk);
    }
  }
  return d;
}

/** How far out a ring around a spot is looked for a free square (the rings fill nearest first). */
const RINGS = 6;

/**
 * Where `w` should end up to stand at `at` (`beside`: next to it), one pawn a square: `at` itself if it's free (and not
 * `beside`), else the nearest free square around it, ring by ring (the 8 squares touching it, then the 16 round those,
 * ...), and in a ring the one `w` reaches in fewest steps. Null if there's none (or no way there).
 */
export function spotNear(t: Town, w: Walker, at: Sq, beside: boolean): Sq | null {
  const d = stepsFrom(w.here());
  for (let k = beside ? 1 : 0; k <= RINGS; k++) {
    let best: Sq | null = null;
    let bestD = Infinity;
    for (let dr = -k; dr <= k; dr++)
      for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== k) continue;
        const c = wrapI(at.c + dc);
        const r = wrapI(at.r + dr);
        const s = d[r * N + c]!;
        if (s < 0 || s >= bestD || !walkable(c, r) || taken(t, c, r, w)) continue;
        best = { c, r };
        bestD = s;
      }
    if (best) return best;
  }
  return null;
}

/** What a tap asks for: a square, the squares beside someone, the ring around a home, the Colosseum's apron, a statue's square or a chess table's stool. */
export type Target = { kind: "square"; c: number; r: number } | { kind: "beside"; at: Sq } | { kind: "home"; home: Home } | { kind: "coliseum" } | { kind: "statue"; statue: Statue } | { kind: "table"; table: Table };

/**
 * The square `w` would end on for a target (null: none; where it stands already counts). A square: itself if free, else
 * the nearest free one next to it. Someone: the nearest free square beside them. A home: the nearest free square on the
 * ring around its plot. The Colosseum (or its ground): the free square of its apron nearest the gate (of two as near, the
 * one `w` reaches in fewer steps); a full apron, the nearest free square round the gate.
 */
export function destFor(t: Town, w: Walker, target: Target): Sq | null {
  if (target.kind === "coliseum" || (target.kind === "square" && onColiseum(target.c, target.r))) {
    const d = stepsFrom(w.here());
    let best: Sq | null = null;
    let bestK = Infinity;
    for (const s of APRON) {
      const k = Math.round(Math.hypot(s.c - GATE_X, s.r - GATE_Y) * 1000) * 1000 + d[s.r * N + s.c]!;
      if (d[s.r * N + s.c]! >= 0 && k < bestK && !taken(t, s.c, s.r, w)) {
        best = s;
        bestK = k;
      }
    }
    return best ?? spotNear(t, w, APRON[0]!, false);
  }
  if (target.kind === "home") {
    const h = target.home;
    const here = w.here();
    if (plotDist(h, here.c, here.r) === 1 && !taken(t, here.c, here.r, w)) return here;
    const path = findPath(here, (c, r) => plotDist(h, c, r) === 1 && walkable(c, r) && !taken(t, c, r, w), walkable);
    return path ? path[path.length - 1]! : null;
  }
  if (target.kind === "beside") return spotNear(t, w, target.at, true);
  // A chess table: its free stool `w` reaches in fewer steps (where it sits already counts); both taken, the nearest free
  // square beside the table.
  if (target.kind === "table") {
    const d = stepsFrom(w.here());
    let best: Sq | null = null;
    for (const s of target.table.stools) {
      const k = d[s.r * N + s.c]!;
      if (k >= 0 && !taken(t, s.c, s.r, w) && (!best || k < d[best.r * N + best.c]!)) best = s;
    }
    return best ?? spotNear(t, w, target.table, true);
  }
  // A statue: its viewing square, or (someone stands there) the nearest free square beside it.
  if (target.kind === "statue") return spotNear(t, w, target.statue, false);
  if (plotAt[target.r * N + target.c]) {
    const h = plotAt[target.r * N + target.c]!;
    return destFor(t, w, { kind: "home", home: h });
  }
  return spotNear(t, w, { c: target.c, r: target.r }, false);
}

/** `w` walks to `to` the shortest way round the homes (through people). False if there's no way. */
export function walkWalker(w: Walker, to: Sq): boolean {
  const h = w.here();
  if (h.c === to.c && h.r === to.r) {
    w.go([]);
    return true;
  }
  const path = findPath(h, (c, r) => c === to.c && r === to.r, walkable);
  if (!path) return false;
  w.go(path);
  return true;
}

/**
 * One pawn a square: when two walkers will end on the same square, the later claim gives way to the nearest free square
 * beside it (someone stepped onto your last square while you walked).
 */
export function keepApart(t: Town): void {
  const all = t.all;
  for (let i = 0; i < all.length; i++) {
    const w = all[i]!;
    const gc = w.goalC();
    const gr = w.goalR();
    for (let j = 0; j < all.length; j++) {
      const o = all[j]!;
      if (o === w || o.goalC() !== gc || o.goalR() !== gr || o.claim > w.claim || (o.claim === w.claim && j > i)) continue;
      // `o` was there first: `w` stops beside it instead.
      const to = spotNear(t, w, { c: gc, r: gr }, true);
      if (to) walkWalker(w, to);
      break;
    }
  }
}

/** One tick of the town's life: everyone steps, the bosses roam, a bot may walk, a boss may talk. */
export function tick(t: Town, now: number): void {
  for (const w of t.all) w.update(now);
  keepApart(t);
  bossesRoam(t, now);
  botsWander(t, now);
  updateSpeech(t, now);
}

function bossesRoam(t: Town, now: number): void {
  const f = TOWN_FEEL;
  for (const b of t.bosses) {
    const w = b.walker;
    if (w.moving() || b.held) continue;
    if (b.nextAt === null) {
      b.nextAt = now + between(t, f.bossPauseMs);
      continue;
    }
    if (now < b.nextAt) continue;
    b.nextAt = null;
    // A free square of its roaming ground (around its plot), one to a few steps away.
    const h = w.here();
    const near = (c: number, r: number) => walkable(c, r) && plotDist(b.home, c, r) <= f.bossRoam;
    const targets: Sq[] = [];
    const n = f.bossWalkSquares;
    for (let dc = -n; dc <= n; dc++)
      for (let dr = -n; dr <= n; dr++) {
        const d = Math.abs(dc) + Math.abs(dr);
        const c = wrapI(h.c + dc);
        const r = wrapI(h.r + dr);
        if (d >= 1 && d <= n && near(c, r) && !taken(t, c, r, w)) targets.push({ c, r });
      }
    if (!targets.length) continue;
    const to = pick(t, targets);
    const path = findPath(h, (c, r) => c === to.c && r === to.r, (c, r) => near(c, r) && !taken(t, c, r, w));
    if (path && path.length <= n) w.go(path);
  }
}

function botsWander(t: Town, now: number): void {
  const f = TOWN_FEEL;
  // Back from a game: the bot you played gets up and goes (not while held: its table's card is open with you across).
  const lv = t.leave;
  if (lv && now >= lv.at && t.hold !== lv.bot && t.meet?.bot !== lv.bot) {
    t.leave = null;
    if (!lv.bot.walker.moving()) wander(t, lv.bot, false);
  }
  // A bot fading out goes home (its walker leaves the town's: it stands on no square).
  for (const b of t.bots)
    if (!b.home && now >= b.leaves) {
      b.home = true;
      b.leaves = Infinity;
      t.all.splice(t.all.indexOf(b.walker), 1);
    }
  if (now < t.nextBotAt) return;
  t.nextBotAt = now + between(t, f.botGapMs);
  if (now >= t.nextTurnAt) return takeTurns(t, now);
  // (Not one that's held, or on its way to a game with you.)
  const free = t.bots.filter((b) => !b.home && b.leaves === Infinity && !b.walker.moving() && b !== t.hold && b !== t.meet?.bot);
  if (!free.length) return;
  const bot = pick(t, free);
  // Now and then one goes to sit at a chess table nearby (a free stool), and one sitting may stay a while longer.
  if (seated(bot) && t.rnd() < f.botStaySeated) return;
  wander(t, bot, t.rnd() < f.botSitChance);
}

/**
 * Bots take turns in the square (Oct 28: `botsOut` out at once, Eric's frame-rate rule): one out, standing, free (not
 * held, not on its way to a game, not the one you just played) and a few steps from you, starts home (it fades out over
 * `botFadeMs`), and one from home comes out on a free square in the park away from you (it fades in).
 */
function takeTurns(t: Town, now: number): void {
  const f = TOWN_FEEL;
  t.nextTurnAt = now + between(t, f.botTurnMs);
  const me = t.you.walker.here();
  const going = t.bots.filter((b) => !b.home && b.leaves === Infinity && !b.walker.moving() && !seated(b) && b !== t.hold && b !== t.meet?.bot && b !== t.leave?.bot && tdist(b.walker.here(), me) >= f.botTurnAway);
  const coming = t.bots.filter((b) => b.home);
  if (!going.length || !coming.length) return;
  pick(t, going).leaves = now + f.botFadeMs;
  comeOut(t, pick(t, coming), now, f.botTurnAway);
}

/** A bot at home comes out on a free square in the park, at least `fromYou` steps from you (it fades in). */
export function comeOut(t: Town, b: Person, now: number, fromYou: number): void {
  if (!b.home) return;
  const at = freeSpot(t.rnd, t.you.walker.here(), fromYou, t.bots.filter((o) => !o.home).map((o) => o.walker.goal()), t);
  b.walker = new Walker(at, TOWN_FEEL.botStepMs, true);
  b.walker.go([]); // (its claim the newest: anyone headed there already keeps it)
  b.home = false;
  b.came = now;
  b.leaves = Infinity;
  t.all.push(b.walker);
}

/** A bot walks a few squares, or (`sitting`) to a free stool nearby. */
function wander(t: Town, bot: Person, sitting: boolean): void {
  const f = TOWN_FEEL;
  const w = bot.walker;
  const h = w.here();
  const [lo, hi] = f.botWalk;
  // (Never on a statue's viewing square: it's kept free for whoever comes to look.)
  const ok = (c: number, r: number) => walkable(c, r) && !taken(t, c, r, w) && !t.bosses.some((b) => plotDist(b.home, c, r) === 1) && !statueAt(c, r);
  const targets: Sq[] = [];
  const reach = sitting ? f.botSitReach : hi;
  for (let dc = -reach; dc <= reach; dc++)
    for (let dr = -reach; dr <= reach; dr++) {
      const d = Math.abs(dc) + Math.abs(dr);
      const c = wrapI(h.c + dc);
      const r = wrapI(h.r + dr);
      if (d >= lo && d <= reach && ok(c, r) && (!sitting || stoolAt(c, r)) && (sitting || d <= hi)) targets.push({ c, r });
    }
  if (!targets.length) return;
  const to = pick(t, targets);
  const path = findPath(h, (c, r) => c === to.c && r === to.r, ok);
  if (path) w.go(path);
}

function updateSpeech(t: Town, now: number): void {
  const f = TOWN_FEEL;
  const s = t.speech;
  if (s.boss && now >= s.until) {
    s.boss = null;
    s.next = now + between(t, f.speechGapMs);
  }
  if (s.boss || now < s.next) return;
  s.next = now + between(t, f.speechGapMs);
  const cands = t.bosses.filter((b) => b.onScreen);
  if (!cands.length) return;
  const b = pick(t, cands);
  const pool = SELECT_LINES[b.home.id] ?? [];
  if (!pool.length) return;
  const line = pool.length > 1 ? pick(t, pool.filter((l) => l !== b.lastLine)) : pool[0]!;
  b.lastLine = line;
  s.boss = b;
  s.line = line.replace("{heart}", "♥").replace("{question}", "?"); // (Moo's pixel icons, as plain characters here)
  s.until = now + f.speechMs;
}

/** You walk to a target (a square, someone, a home): to the square `destFor` gives. False if there's none. */
export function walkYou(t: Town, target: Target): boolean {
  const to = destFor(t, t.you.walker, target);
  return !!to && walkWalker(t.you.walker, to);
}

// ---- Playing a town bot (Oct 27, Eric: "if you tap them you can invite them to a game and then you both run over to the
// chessboard"). Pure: Town.tsx opens the cards and the game; this says where everyone goes and when both sit.

/** You and a bot on your way to a table: its stools, yours and theirs. */
export interface Meeting {
  bot: Person;
  table: Table;
  yours: Sq;
  theirs: Sq;
}

/** Holds a bot where it is (its card is open): it stops at the square it's stepping onto and doesn't wander off. Null lets it go. */
export function holdBot(t: Town, bot: Person | null): void {
  t.hold = bot;
  // (A bot fading out on its way home stays: its card is open.)
  if (bot && bot.leaves < Infinity) bot.leaves = Infinity;
  if (bot?.walker.moving()) bot.walker.go([]);
}

/** Whether nobody but `a` or `b` stands on or is headed for square `s`. */
function freeFor(t: Town, s: Sq, a: Walker, b: Walker): boolean {
  for (const w of t.all) if (w !== a && w !== b && w.goalC() === s.c && w.goalR() === s.r) return false;
  return true;
}

/** Whether some table has both stools free for you and `bot` (its card's Play; greyed with "Tables are full" when not). Cheap: no search. */
export function anyTableFree(t: Town, bot: Person): boolean {
  for (const tb of TABLES) if (freeFor(t, tb.stools[0], t.you.walker, bot.walker) && freeFor(t, tb.stools[1], t.you.walker, bot.walker)) return true;
  return false;
}

/**
 * The table you and `bot` play at: of the tables with both stools free (nobody else on them or headed there), the
 * nearest to the two of you (your steps to your stool plus its steps to its own); you take the stool nearer you, the bot
 * the other. Null: every table is taken.
 */
export function tableFor(t: Town, bot: Person): Meeting | null {
  const dy = stepsFrom(t.you.walker.here());
  const db = stepsFrom(bot.walker.here());
  let best: Meeting | null = null;
  let bestD = Infinity;
  for (const tb of TABLES) {
    const [s0, s1] = tb.stools;
    if (!freeFor(t, s0, t.you.walker, bot.walker) || !freeFor(t, s1, t.you.walker, bot.walker)) continue;
    const y0 = dy[s0.r * N + s0.c]!;
    const y1 = dy[s1.r * N + s1.c]!;
    const [yours, theirs] = y1 >= 0 && (y0 < 0 || y1 < y0) ? [s1, s0] : [s0, s1];
    const a = dy[yours.r * N + yours.c]!;
    const b = db[theirs.r * N + theirs.c]!;
    if (a < 0 || b < 0 || a + b >= bestD) continue;
    bestD = a + b;
    best = { bot, table: tb, yours, theirs };
  }
  return best;
}

/** You and the bot set off for the meeting's stools, to sit (the bot held on its way). */
export function meet(t: Town, m: Meeting): void {
  t.meet = m;
  holdBot(t, m.bot);
  t.you.sit = true;
  m.bot.sit = true;
  walkWalker(t.you.walker, m.yours);
  walkWalker(m.bot.walker, m.theirs);
}

/** Calls the meeting off (you walked elsewhere): the bot is free again. */
export function cancelMeet(t: Town): void {
  if (t.meet && t.hold === t.meet.bot) t.hold = null;
  t.meet = null;
}

/** Whether you and the bot both sit at the meeting's table: the game opens. */
export function meetReady(t: Town): boolean {
  const m = t.meet;
  return !!m && seated(t.you) === m.table && seated(m.bot) === m.table;
}

/** The meeting as a seat to come back to after the game (null: none, or not seated yet). */
export function meetSeat(t: Town): Seat | null {
  const m = t.meet;
  if (!m || !m.bot.bot) return null;
  const h = t.you.walker.here();
  const stool = m.table.stools.findIndex((s) => s.c === h.c && s.r === h.r);
  return stool < 0 ? null : { table: m.table.i, stool: stool as 0 | 1, bot: BOTS.indexOf(m.bot.bot) };
}

/** The bot sitting at a table with nobody else there (but you, across from it), or null. */
export function waitingBot(t: Town, table: Table): Person | null {
  let found: Person | null = null;
  for (const p of t.people) {
    if (p.you || seated(p) !== table) continue;
    if (!p.bot || found) return null;
    found = p;
  }
  return found;
}
