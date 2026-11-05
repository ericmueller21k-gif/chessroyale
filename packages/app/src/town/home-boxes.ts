/**
 * The 16 boss homes as boxes (Nov 5, final art; drawn by hand on the weekly plan usage). Their fronts stay the game's
 * (town/houses/*.ts, Timber's and Dash's too since the street town's copy, Nov 5); this gives each its own sides and roof
 * in its own material, replacing the mockup's guessed ones (box.ts, which worked them out from the front's pixels).
 *
 * Each home's body columns, eave and ridge were measured from its front's silhouette (the tallest opaque pixel in each
 * column above its foot), so the roof faces meet the front's outline exactly.
 *
 *   gardener   Puddles' Botanical Garden   glass walls in green frames, a glass gable roof (panes catching the sky)
 *   smudgy     Smudgy's Art Gallery         pale stone, framed pictures for windows, a turf roof garden behind its hedge
 *   folio      Folio's Folded House         folded paper walls, a striped paper gable
 *   alfil      Alfil's Pyramid              sandstone courses, a stepped pyramid running back to its point (no walls)
 *   timber     Timber's Lumber Lodge        logs, a hipped shingle roof along the street
 *   sawyer     Sawyer's Woodshed            logs (its front is a log cabin; the mockup guessed planks), a shingle gable
 *   gingerbread Ginger Igloo                a gingerbread dome iced on top, gumdrops in the crumb (the front is gingerbread;
 *                                           the mockup guessed ice)
 *   grex       Jefferson's Fireworks        orange-and-yellow striped booth walls, a striped canvas pyramid top (the mockup
 *                                           guessed brick; the front is a painted booth)
 *   clown      Boingo's Funhouse            pink plaster, a striped barrel-vault roof, its blue corner towers carried back
 *   tiger      Babur's Circus               red-and-white canvas walls, a striped tent roof narrowing to its pole
 *   bigboy     Big Boy's Crib               wooden crib slats round, a quilt on the mattress inside, the back rail
 *   blitz      Dash's Kicks                 dark brick, a flat tar roof with its parapet and an air-con box
 *   hopper     Chub & Chirp's Grassland     a turf mound carried back as a dome (the mockup guessed planks)
 *   pig        Wrangler's Stall             a plank counter round, a striped canvas awning roof, posts at the back
 *   moo        Moo & Moon Meadow            a rail fence round a grass paddock, the back fence
 *   hollow     Hollow Peak                  dark crystal rock rising to its peak (no walls)
 */
import type { Character } from "../characters/sprite.ts";
import type { LightSpot } from "./houses/kit.ts";
import { HOUSES } from "./houses/index.ts";
import {
  BASE, blockF, domeRoof, flatRoof, gableRoof, hipRoof, hipWideRoof, quadF, sideArt, SQ, vaultRoof,
  type Face, type SideSpec, type TownBox,
} from "./town-kit.ts";

export type HomeId = "tiger" | "gingerbread" | "grex" | "hollow" | "moo" | "clown" | "bigboy" | "sawyer" | "pig" | "smudgy" | "hopper" | "gardener" | "alfil" | "folio" | "timber" | "blitz";

/** A home's box: its sides (null: its roof runs to the ground there), roof, palette, and where its door is on its front. */
interface HomeSpec {
  body: [number, number];
  eave: [number, number] | null;
  side?: SideSpec;
  back?: { h: number; side: SideSpec };
  roof: Face[];
  pal: Record<string, string>;
  taper?: number;
  /** The door's middle on the front (px): the door square is the sidewalk square in front of it. */
  door: number;
}
const ramp = (a: string, b: string, c: string) => ({ a, b, c });
/** Ginger Igloo's dome: its faces high up iced, the rest gingerbread crumb. */
const iced = (faces: Face[]): Face[] => faces.map((f) => (f.pts.reduce((s, p) => s + p[2], 0) / f.pts.length > 62 ? { ...f, tex: "icing" as const } : f));
const roofRamp = (d: string, e: string, f: string) => ({ d, e, f });

export const HOME_SPECS: Record<HomeId, HomeSpec> = {
  gardener: {
    body: [24, 120], eave: [84, 84], door: 70,
    side: { mat: "glass", corner: true, plinth: 6 },
    roof: gableRoof(22, 122, 84, 70, 118, "glass"),
    pal: { ...ramp("#3f6b48", "#bfe3ea", "#e6f6f8"), j: "#bfe3ea", I: "#f2fbfc", g: "#5d8f5f", G: "#3f6b48" },
  },
  smudgy: {
    body: [20, 124], eave: [68, 68], door: 72,
    side: { mat: "stone", rows: [{ y: 22, h: 18, w: 16 }], every: 34, trim: [0], plinth: 5 },
    roof: [...blockF(14, 130, 0, 0.3, 64, 94, "hedge"), ...flatRoof(20, 124, 68, "turf", 0.3, 1), ...blockF(26, 46, 0.55, 0.85, 68, 80, "hedge")],
    pal: { ...ramp("#9c9384", "#cfc6b4", "#ece6d8") },
  },
  folio: {
    body: [16, 112], eave: [52, 62], door: 47,
    side: { mat: "paper", rows: [{ y: 14, h: 14 }], every: 36, corner: false },
    roof: gableRoof(14, 112, 54, 60, 128, "paper"),
    pal: { ...ramp("#c9b89a", "#efe4cf", "#faf5ea"), g: "#faf5ea", G: "#c9b89a" },
  },
  alfil: {
    body: [34, 176], eave: null, door: 104, taper: 0.3,
    roof: hipRoof(30, 180, 0, 104, 142, 0.5, "sand"),
    pal: { ...ramp("#a77a3c", "#d6a95e", "#ecca88") },
  },
  timber: {
    body: [26, 118], eave: [62, 62], door: 66,
    side: { mat: "log", rows: [{ y: 14, h: 14 }], every: 32, corner: false },
    roof: hipWideRoof(20, 122, 60, 58, 98, 95, 0.35, "shingle"),
    pal: { ...ramp("#5a3518", "#8a5428", "#b27a40"), ...roofRamp("#4f3520", "#6e4a2c", "#8f6640") },
  },
  sawyer: {
    body: [20, 114], eave: [62, 62], door: 58,
    side: { mat: "log", rows: [{ y: 16, h: 14 }], every: 34, corner: false },
    roof: [...gableRoof(16, 118, 62, 65, 104, "shingle"), ...blockF(84, 92, 0.25, 0.35, 90, 112, "metal")],
    pal: { ...ramp("#5a3518", "#8a5428", "#b27a40"), ...roofRamp("#4f3520", "#6e4a2c", "#8f6640") },
  },
  gingerbread: {
    body: [28, 104], eave: null, door: 71,
    roof: iced(domeRoof(28, 104, 4, 89, "crumb", 10, 5)),
    pal: { ...ramp("#7a4320", "#a8622f", "#c9884a"), t: "#ff6f9a", u: "#7fd36a", j: "#9fd4ff", G: "#e9e1f0" },
  },
  grex: {
    body: [18, 122], eave: [74, 74], door: 72,
    side: { mat: "stripe", corner: false, trim: [0] },
    roof: hipRoof(16, 124, 74, 72, 124, 0.5, "canvas"),
    pal: { ...ramp("#b8461c", "#ef7a1f", "#f7c23a"), n: "#ef6b1f", o: "#f8c43c" },
  },
  clown: {
    body: [28, 116], eave: [90, 90], door: 72,
    side: { mat: "plaster", rows: [{ y: 24, h: 14, w: 12, arch: true }], every: 30, trim: [0] },
    roof: [
      ...vaultRoof(28, 116, 90, 111, "canvas"),
      ...blockF(14, 28, 0, 0.22, 0, 104, "slate"),
      ...blockF(116, 130, 0, 0.22, 0, 104, "slate"),
    ],
    pal: { ...ramp("#b0365a", "#e8577f", "#f58aa6"), ...roofRamp("#2f4f9a", "#4a6fc8", "#7c9be6"), n: "#e8577f", o: "#f7b2c6", g: "#f7d24a", G: "#c99a2a" },
  },
  tiger: {
    body: [28, 116], eave: [60, 60], door: 70, taper: 0.7,
    side: { mat: "canvas", corner: false, trim: [0] },
    roof: hipRoof(26, 118, 62, 71, 108, 0.5, "canvas"),
    pal: { ...ramp("#9e2a2a", "#d63a3a", "#f6efe4"), n: "#d63a3a", o: "#f6efe4" },
  },
  bigboy: {
    body: [18, 126], eave: [86, 86], door: 72,
    side: { mat: "slat", corner: false, trim: [0, 1, 2, 80] },
    back: { h: 86, side: { mat: "slat", corner: false, trim: [0, 1, 2, 80] } },
    roof: [
      quadF([22, 0.08, 30], [122, 0.08, 30], [122, 0.92, 30], [22, 0.92, 30], "quilt", "u"),
      ...blockF(16, 22, 0.92, 1, 0, 94, "plank"),
      ...blockF(122, 128, 0.92, 1, 0, 94, "plank"),
    ],
    pal: { ...ramp("#5e3b22", "#8f5a32", "#b47a45"), n: "#9fc3e6", o: "#f2f6fb", g: "#b47a45", G: "#8f5a32" },
  },
  blitz: {
    body: [22, 122], eave: [98, 98], door: 95,
    side: { mat: "brick", rows: [{ y: 22, h: 14 }, { y: 50, h: 14 }], every: 30, trim: [0, 3] },
    roof: [...flatRoof(22, 122, 98), ...blockF(100, 116, 0.06, 0.3, 98, 109, "metal", "tar")],
    pal: { ...ramp("#1f2030", "#33354a", "#4a4d66"), g: "#2fd6c8", G: "#1a8f86" },
  },
  hopper: {
    body: [4, 140], eave: null, door: 87,
    roof: domeRoof(4, 140, 0, 68, "turf", 10, 5),
    pal: {},
  },
  pig: {
    body: [12, 128], eave: [40, 40], door: 72,
    side: { mat: "plank", corner: false, trim: [0] },
    back: { h: 70, side: { mat: "plank", corner: false } },
    roof: [
      quadF([10, 0, 95], [130, 0, 95], [130, 1, 82], [10, 1, 82], "canvas", "t"),
      ...blockF(12, 16, 0.9, 0.95, 0, 84, "plank"),
      ...blockF(124, 128, 0.9, 0.95, 0, 84, "plank"),
    ],
    pal: { ...ramp("#5e3b22", "#8c5a33", "#ad7744"), n: "#f1e6cf", o: "#c8423a" },
  },
  moo: {
    body: [8, 136], eave: [22, 22], door: 72, taper: 0.8,
    side: { mat: "log", corner: false, trim: [0] },
    back: { h: 22, side: { mat: "log", corner: false } },
    roof: flatRoof(10, 134, 12, "grass").map((f) => ({ ...f, rim: false })),
    pal: { ...ramp("#5e3b22", "#8a5a33", "#b07a48") },
  },
  hollow: {
    body: [28, 124], eave: null, door: 81, taper: 0.55,
    roof: hipRoof(28, 124, 0, 56, 128, 0.4, "crystal"),
    pal: { ...ramp("#1d1530", "#3a2b57", "#8a78c8") },
  },
};

/** What a home's palette falls back to (wood for posts and planks, a red-and-cream canvas). */
const HOME_DEFAULTS = { a: "#8a6a4a", b: "#a8875f", c: "#c8aa7e", d: "#5e3b22", e: "#8a5a33", f: "#b07a48", n: "#d84545", o: "#fbf3e6", l: "#7a4a2c" };
/** The homes' depth from the front line back (squares) and the front's inset on its lot. */
export const HOME_DEPTH = 2.3;
export const HOME_INSET = 0.45;

// (Copied in for the street town, Nov 5: Timber's and Dash's fronts are the game's own copies of the drafts, town/houses/timber.ts and
// blitz.ts, the same pictures with their signs' faces added, so their names show on their signs; the game's home id for Dash's is "dash".)
function frontOf(id: HomeId): { ch: Character; lights: readonly LightSpot[]; sign?: TownBox["sign"] } {
  const h = HOUSES[id === "blitz" ? "dash" : id];
  return { ch: h.ch, lights: h.lights, sign: h.sign };
}
/**
 * The domes with fewer faces, for the 2D fallback (the art's notes, Nov 5: "draw each as one mesh in WebGL. On the 2D fallback, cut them
 * to 6 x 3 faces"; code round 3).
 */
const LOW_ROOF: Partial<Record<HomeId, Face[]>> = {
  gingerbread: iced(domeRoof(28, 104, 4, 89, "crumb", 6, 3)),
  hopper: domeRoof(4, 140, 0, 68, "turf", 6, 3),
};
const cache = new Map<string, TownBox>();
/** A home as a box (its lot is 4 squares across, Alfil's 6; 3 deep). `low`: its dome with fewer faces (the 2D fallback's). */
export function homeBox(id: HomeId, low = false): TownBox {
  low &&= !!LOW_ROOF[id];
  const hit = cache.get(low ? `${id}-low` : id);
  if (hit) return hit;
  const s = HOME_SPECS[id];
  const f = frontOf(id);
  const pal = { ...BASE, ...HOME_DEFAULTS, ...s.pal };
  const L = Math.round(HOME_DEPTH * SQ);
  const side = s.side ?? { mat: "plaster" };
  // A tapered home's sides run in toward the back, so each is a little longer than the depth.
  const slant = s.taper && s.taper < 1 ? Math.hypot(L, ((s.body[1] - s.body[0]) / 2) * (1 - s.taper)) : L;
  const b: TownBox = {
    id: `home-${id}`,
    front: f.ch,
    lights: f.lights,
    sign: f.sign,
    lot: { w: id === "alfil" ? 6 : 4, d: 3 },
    inset: HOME_INSET,
    depth: HOME_DEPTH,
    body: { x0: s.body[0], x1: s.body[1] },
    left: s.eave ? sideArt(`home-${id}-L`, pal, side, Math.round(slant), s.eave[0], true) : null,
    right: s.eave ? sideArt(`home-${id}-R`, pal, side, Math.round(slant), s.eave[1], false) : null,
    back: s.back ? sideArt(`home-${id}-B`, pal, s.back.side, Math.round((s.body[1] - s.body[0]) * (s.taper ?? 1)), s.back.h, false) : undefined,
    roof: (low && LOW_ROOF[id]) || s.roof,
    roofPal: pal,
    taper: s.taper ?? 1,
  };
  cache.set(low ? `${id}-low` : id, b);
  return b;
}
export const HOME_DOOR_PX: Record<HomeId, number> = Object.fromEntries(Object.entries(HOME_SPECS).map(([k, v]) => [k, v.door])) as Record<HomeId, number>;
