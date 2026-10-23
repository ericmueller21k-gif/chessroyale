/**
 * The hippo gardener's board art (not wired in yet: drafts for Eric, Oct 21): seeds that arc in and sink, the watering's sweep of
 * spray and its wet sheen, the sprout that comes up on a square and each thing it turns into (a plain plant that goes green, then
 * fall colors, then drops its leaves and is gone; a snapping plant that eats the piece on its square; a bud that opens on one of his
 * pieces, a pawn or a grander queen; nothing, a sprout that wilts), and the splash of his jet on a king. Every sprite is a
 * `Character` as the other bosses' board art, one frame exactly the area it covers (a square is `SQUARE` = 32 frame pixels;
 * the sweep covers the whole board at the same pixel size, 256 x 256).
 *
 * Drawn to read on the light squares and the dark ones of every board color scheme (Classic #c0ad90, Green #8fb36b, Gold #e8b640;
 * the light square is the same in all three): every plant, seed and drop of water has a dark outline (a near-black green for the
 * plants, a deep navy for the water), the plants stand on a small mound of soil so a green plant on a green square still shows, and
 * the greens are darker than the Green scheme's squares and the yellow-orange of the fall leaves is outlined against the Gold's.
 *
 *   seedFly     square  fly (loop). A seed tumbling; move it from his hand to the square (a CSS transform on an arc, as carrotFly).
 *   seedPlop    square  plop (ends empty, ~430 ms, `plop` on its first frame): the seed lands with a tiny puff of dirt, dips into the
 *               soil and is gone; a faint dimple fades after it. Nothing is left on the square: the real spots are decided at the
 *               watering. Draw it over the square; it hides nothing (it is small and the dimple is see-through).
 *   waterSweep  board   sweep (ends on sheen's first look, 420 ms, `spray` on its first frame), sheen (ends empty, 760 ms): a pass of
 *               spray and droplets across the board from its left edge to its right, then a wet shine over every square that
 *               thins away. See-through: the pieces show. Drawn coming from the left; the board flips it for a hippo on the right.
 *   gardenPlant square  every outcome of a seed, in order of how a square plays them (all see-through where they must be, and drawn
 *               over the piece on the square, never under it):
 *                 sprout (ends on seedling's look, 300 ms, `sprout`): the shared start, a heave of soil and a sprout opening two leaves.
 *                 plain:  grow (ends on green's first look, `grow`), green (loop, the turn it grew), toFall (ends on fall), fall (loop,
 *                         the next turn), toDrop (ends on drop), drop (loop, the third turn: leaves dropping), gone (ends empty).
 *                 killer: kill (ends empty, `rise`, `snap`: take the piece off at `snap`, `gulp`): the plant rises, opens its jaws wide
 *                         round the piece, snaps shut on it, chews and sinks back down.
 *                 piece:  bud (ends empty; `swell`, `pop`: put the piece on its square at `pop`), budQueen (the same, grander).
 *                 nothing: wilt (ends empty, `wilt`): the sprout droops, browns and sinks.
 *   waterHit    square  hit<H|L><L|R> (ends empty, about 200 ms): his jet landing on a king's head (high) or a little lower, from the
 *               left or right edge: a burst of water, drops, a splash.
 */
import { canvas, inPoly, toGrid, type Canvas } from "../paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../sprite.ts";
import { SQUARE, hitAnims } from "./common.ts";

export const GARDEN_PALETTE: Record<string, string> = {
  k: "#10261a", // outline: a near-black green (the plants' and the soil's)
  a: "#2e1b0e", // soil: dark to light (the lightest is also a seed's top)
  b: "#4f3219",
  c: "#7a5129",
  d: "#a8763a",
  e: "#d8a85a",
  f: "#17502a", // leaf green: dark to light
  g: "#26823a",
  h: "#45ad4c",
  i: "#8edb7a",
  j: "#9c3318", // fall leaves: red-brown, orange, amber, yellow
  l: "#d1581a",
  m: "#f08c26",
  n: "#f8c23d",
  o: "#5c4126", // a dried stem and leaf: dark, light
  p: "#8a6a3c",
  r: "#6b0d27", // the snapping plant's mouth: dark, red, pink
  s: "#c4243f",
  t: "#ff7088",
  T: "#fbf4dc", // teeth, petals' white
  U: "#d3c69e",
  P: "#c2467f", // a bud's petals: deep pink to pale
  Q: "#ef8fba",
  R: "#ffd3e4",
  G: "#a86c0c", // the queen's gold: dark to pale
  H: "#e8ae26",
  I: "#ffd95a",
  J: "#fff4b8",
  "1": "#2468bd", // water: deep to pale (and the navy outline, N)
  "2": "#4fa3ee",
  "3": "#8bcdfb",
  "4": "#d8f2ff",
  N: "#123a7c",
  w: "#ffffff",
  y: "#2e1b0e44", // a dimple in the soil, see-through
  z: "#2e1b0e22",
};

type In = (x: number, y: number) => boolean;
type Pt = readonly [number, number];
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const rad = (d: number) => (d * Math.PI) / 180;
const ramp = (keys: string, l: number) => keys[Math.max(0, Math.min(keys.length - 1, Math.floor(l * keys.length)))]!;
const nz = (x: number, y: number, k = 0) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Paints a shape on `cv`: first its one-pixel ring in `ring` (on whatever is there), then its fill: so a shape painted over another is
 * always cut out from it, as the sprites' own parts are.
 */
function shape(cv: Canvas, inside: In, fill: (x: number, y: number) => string, ring: string | null = "k"): void {
  const h = cv.length;
  const w = cv[0]!.length;
  const mask = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => inside(x, y)));
  const at = (x: number, y: number) => mask[y]?.[x] === true;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (mask[y]![x]) continue;
      if (ring && N4.some(([dx, dy]) => at(x + dx, y + dy))) cv[y]![x] = ring;
    }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y]![x]) cv[y]![x] = fill(x, y);
}
const put = (cv: Canvas, x: number, y: number, k: string) => {
  const X = Math.round(x);
  const Y = Math.round(y);
  if (Y >= 0 && Y < cv.length && X >= 0 && X < cv[0]!.length) cv[Y]![X] = k;
};
const E = (cx: number, cy: number, rx: number, ry: number): In => (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
/** A thick line through `pts` (radius `r`). */
function pathIn(pts: readonly Pt[], r: number): In {
  return (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]!;
      const [bx, by] = pts[i]!;
      const vx = bx - ax;
      const vy = by - ay;
      const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1));
      if (Math.hypot(px - ax - t * vx, py - ay - t * vy) <= r) return true;
    }
    return false;
  };
}

// ---- Soil: a small mound the plants stand on, and the specks of dirt.

/** A mound of soil centered at (cx, `ground`), `rx` wide each way and `ry` high: dark at the bottom right, a lit top left, a few clods. */
function mound(cv: Canvas, rx: number, ry: number, cx = 15.5, ground = 27.5, ring: string | null = "k"): void {
  if (rx < 1 || ry < 0.5) return;
  const inside = E(cx, ground, rx, ry);
  shape(cv, inside, (x, y) => {
    const nx = (x + 0.5 - cx) / rx;
    const ny = (y + 0.5 - ground) / ry;
    const l = 0.55 - 0.3 * nx - 0.45 * ny + (nz(x, y, 2) > 0.86 ? 0.2 : 0) - (nz(x, y, 3) > 0.9 ? 0.2 : 0);
    return ramp("bcde", l * 0.85);
  }, ring);
}

/** Specks of dirt thrown up round (cx, cy), `spread` how far (frame pixels), `n` of them, `seed` which. */
function dirt(cv: Canvas, cx: number, cy: number, spread: number, n: number, seed: number, up = 1): void {
  for (let i = 0; i < n; i++) {
    const a = nz(i, seed, 1) * Math.PI * 2;
    const d = spread * (0.4 + 0.6 * nz(i, seed, 2));
    put(cv, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7 - up * d * 0.3, i % 3 === 0 ? "e" : i % 3 === 1 ? "d" : "c");
  }
}

// ---- Plants: leaves and stems.

interface Leaf {
  /** Where along the stem it grows (0 at the soil, 1 at the top), which side (-1 left, 1 right, 0 straight up), its angle off the stem, its length and width. */
  t: number;
  s: -1 | 0 | 1;
  a: number;
  L: number;
  W: number;
}
const LEAVES: readonly Leaf[] = [
  { t: 0.22, s: -1, a: 76, L: 10, W: 6.6 },
  { t: 0.22, s: 1, a: 72, L: 10, W: 6.6 },
  { t: 0.5, s: -1, a: 50, L: 9.5, W: 6.2 },
  { t: 0.5, s: 1, a: 54, L: 9.5, W: 6.2 },
  { t: 0.76, s: -1, a: 28, L: 8, W: 5.2 },
  { t: 0.76, s: 1, a: 32, L: 8, W: 5.2 },
  { t: 1, s: 0, a: 0, L: 8, W: 5.4 },
];

/** One leaf from (bx, by) along `ang` (degrees, 0 pointing up, positive clockwise): a lens with a lit upper left side and a pale midrib. */
function leaf(cv: Canvas, bx: number, by: number, ang: number, len: number, wid: number, keys: string, edge: string | null = "k"): void {
  const th = rad(ang);
  const ax = Math.sin(th);
  const ay = -Math.cos(th);
  const nx = -ay;
  const ny = ax;
  const local = (x: number, y: number) => {
    const px = x + 0.5 - bx;
    const py = y + 0.5 - by;
    return { u: px * ax + py * ay, v: px * nx + py * ny };
  };
  const half = (u: number) => (wid / 2) * Math.sin(Math.PI * clamp(u / len) ** 0.75);
  const inside: In = (x, y) => {
    const { u, v } = local(x, y);
    return u >= -0.2 && u <= len && Math.abs(v) <= half(u) + 0.01;
  };
  // Light from the top left: which side of the leaf faces it.
  const lit = Math.sign(nx * -0.6 + ny * -0.8) || 1;
  shape(cv, inside, (x, y) => {
    const { u, v } = local(x, y);
    const hw = Math.max(0.5, half(u));
    const l = 0.5 + 0.38 * lit * (v / hw) - 0.1 * (u / len);
    if (Math.abs(v) < 0.55 && u > len * 0.15 && u < len * 0.85) return keys[keys.length - 1]!;
    return ramp(keys, clamp(l, 0, 0.99));
  }, edge);
}

/** The ramps leaves are drawn in. */
const GREEN = "fghi";
const FALL = ["jlm", "lmn", "mnn", "jlm", "lmn"] as const;
const DRY = "opp";

type Season = "green" | "fall" | "dry";
const leafKeys = (season: Season, i: number): string => (season === "green" ? GREEN : season === "fall" ? FALL[i % FALL.length]! : DRY);

interface PlantLook {
  /** How tall the stem is (0 a stub, 1 full), and how far the leaves have come out. */
  grow: number;
  season: Season;
  /** The sway of the leaves, in degrees. */
  sway?: number;
  /** The leaves left, of 7 (the lowest drop first). */
  leaves?: number;
  /** Mound size. */
  mound?: number;
  droop?: number;
}

/** The plain plant on its soil, drawn into `cv`. */
function plant(cv: Canvas, o: PlantLook): void {
  const m = o.mound ?? 1;
  mound(cv, 10 * m, 3.6 * m);
  const top = 27 - 4 - 8.5 * o.grow;
  const sway = o.sway ?? 0;
  const bend = (o.droop ?? 0) * 3;
  const stem: Pt[] = [[15.5, 26.5], [15.5 + sway * 0.1 - bend * 0.4, (26.5 + top) / 2], [15.5 + sway * 0.3 - bend, top]];
  shape(cv, pathIn(stem, 1.15), (x, y) => ramp(o.season === "dry" ? "op" : "fgh", 0.5 - (x + 0.5 - 15.5 - sway * 0.2) * 0.12 - (y - top) * 0.004), "k");
  const n = o.leaves ?? 7;
  // The lowest leaves go first: it is the top ones that are left.
  LEAVES.forEach((lf, i) => {
    if (i < LEAVES.length - n) return;
    const grown = clamp((o.grow - lf.t * 0.5) / 0.55);
    if (grown <= 0.05) return;
    const by = 26.5 - (26.5 - top) * lf.t;
    const bx = 15.5 + sway * 0.3 * lf.t - bend * lf.t;
    const ang = lf.s * lf.a * (0.5 + 0.5 * grown) + sway * (lf.s || 1) * 0.6 + lf.s * (o.droop ?? 0) * 22 + (lf.s === 0 ? sway * 1.5 : 0);
    leaf(cv, bx, by, ang, lf.L * (0.35 + 0.65 * grown), lf.W * (0.4 + 0.6 * grown), leafKeys(o.season, i));
  });
}

/** A part from a canvas. */
const asPart = (cv: Canvas): Part => ({ grid: toGrid(cv), outline: false });
const parts: Record<string, Part> = {};
const L0 = (name: string): Layer => ({ part: name, x: 0, y: 0 });
const fr = (ms: number, name: string | null, extra: Partial<Frame> = {}): Frame => ({ ms, layers: name ? [L0(name)] : [], ...extra });
/** Makes a frame's part from a painter, once, under `name`. */
function draw(name: string, painter: (cv: Canvas) => void): string {
  const cv = canvas(SQUARE, SQUARE);
  painter(cv);
  parts[name] = asPart(cv);
  return name;
}

// ---- The seedling: the shared start of every outcome.

/** The seedling: a short stem and two small leaves open on the mound (the look every outcome starts from). */
function seedling(cv: Canvas, open = 1, mnd = 1): void {
  mound(cv, 8.5 * mnd, 3 * mnd);
  const top = 26 - 6 * open;
  shape(cv, pathIn([[15.5, 26], [15.5, top]], 1.0), () => "g");
  leaf(cv, 15.5, top + 1, -62 * open, 5.5 * open, 3.2 * open, GREEN);
  leaf(cv, 15.5, top + 1, 58 * open, 5.5 * open, 3.2 * open, GREEN);
}
const SEEDLING = draw("seedling", (cv) => seedling(cv));

/** Everything starts here: the soil heaves, a sprout pokes up and opens two leaves. */
const sprout: Anim = {
  loop: false,
  frames: [
    fr(60, draw("sp0", (cv) => { mound(cv, 6, 2); dirt(cv, 15.5, 25, 7, 5, 1); }), { cue: "sprout" }),
    fr(70, draw("sp1", (cv) => { mound(cv, 7.5, 2.6); shape(cv, pathIn([[15.5, 26], [15.5, 22]], 0.9), () => "g"); dirt(cv, 15.5, 24, 8, 4, 2); })),
    fr(70, draw("sp2", (cv) => { mound(cv, 8, 2.8); shape(cv, pathIn([[15.5, 26], [15.5, 20]], 1.0), () => "g"); leaf(cv, 15.5, 21, -25, 3.5, 2.2, GREEN); leaf(cv, 15.5, 21, 25, 3.5, 2.2, GREEN); })),
    fr(100, SEEDLING),
  ],
};

// ---- The plain plant: green, then fall colors, then its leaves drop, then gone.

const gParts = [0, 1].map((i) => draw(`green${i}`, (cv) => plant(cv, { grow: 1, season: "green", sway: i ? 2.5 : -1.5 })));
const fParts = [0, 1].map((i) => draw(`fall${i}`, (cv) => plant(cv, { grow: 1, season: "fall", sway: i ? 2 : -1, droop: 0.12 })));

const plainGrow: Anim = {
  loop: false,
  frames: [
    fr(70, draw("gr0", (cv) => plant(cv, { grow: 0.4, season: "green" })), { cue: "grow" }),
    fr(70, draw("gr1", (cv) => plant(cv, { grow: 0.6, season: "green", sway: 1 }))),
    fr(70, draw("gr2", (cv) => plant(cv, { grow: 0.82, season: "green", sway: -1.5 }))),
    fr(80, gParts[0]!),
  ],
};
const green: Anim = { loop: true, frames: [fr(520, gParts[0]!), fr(520, gParts[1]!)] };

/** One leaf mid-fall at (x, y), turned `a`, in a fall ramp. */
const fallingLeaf = (cv: Canvas, x: number, y: number, a: number, i: number): void => leaf(cv, x, y, a, 4.2, 2.6, FALL[i % FALL.length]!);

const toFall: Anim = {
  loop: false,
  frames: [
    fr(80, draw("tf0", (cv) => plant(cv, { grow: 1, season: "green", sway: 1 }))),
    fr(90, draw("tf1", (cv) => {
      plant(cv, { grow: 1, season: "green", sway: -1 });
      // The tips go yellow first: a few leaves turn.
      LEAVES.slice(4).forEach((lf, i) => {
        const by = 26.5 - 9 * lf.t;
        leaf(cv, 15.5, by, lf.s * lf.a + (lf.s || 1) * -0.6, lf.L, lf.W, ["mnn", "lmn", "mnn"][i]!);
      });
    })),
    fr(90, draw("tf2", (cv) => {
      plant(cv, { grow: 1, season: "fall", sway: 1.5 });
    })),
    fr(80, fParts[0]!),
  ],
};
const fall: Anim = { loop: true, frames: [fr(520, fParts[0]!), fr(520, fParts[1]!)] };

/** The plant with its leaves dropping: the top leaves gone, falling past it. */
const dropParts = [0, 1].map((i) =>
  draw(`drop${i}`, (cv) => {
    plant(cv, { grow: 1, season: "fall", leaves: 4, droop: 0.28, sway: i ? 1 : -1 });
    // Falling leaves, and the ones already down on the soil.
    fallingLeaf(cv, 8 + i * 2, 12 + i * 4, 20 - i * 40, 0);
    fallingLeaf(cv, 24 - i * 3, 9 + i * 5, -30 + i * 50, 1);
    fallingLeaf(cv, 12 + i * 3, 19 + i * 2, 70, 2);
    shape(cv, E(6.5, 27.5, 2.6, 1.1), () => "m");
    shape(cv, E(24.5, 27, 2.4, 1), () => "l");
  }),
);
const toDrop: Anim = {
  loop: false,
  frames: [
    fr(80, draw("td0", (cv) => { plant(cv, { grow: 1, season: "fall", leaves: 6, droop: 0.15 }); fallingLeaf(cv, 25, 11, -20, 1); })),
    fr(90, draw("td1", (cv) => { plant(cv, { grow: 1, season: "fall", leaves: 5, droop: 0.2, sway: 1 }); fallingLeaf(cv, 8, 14, 40, 0); fallingLeaf(cv, 24, 17, -40, 1); })),
    fr(90, draw("td2", (cv) => { plant(cv, { grow: 1, season: "fall", leaves: 4, droop: 0.25, sway: -1 }); fallingLeaf(cv, 7, 18, 60, 2); fallingLeaf(cv, 23, 22, -70, 0); shape(cv, E(24.5, 27, 2.4, 1), () => "l"); })),
    fr(80, dropParts[0]!),
  ],
};
const drop: Anim = { loop: true, frames: [fr(480, dropParts[0]!), fr(480, dropParts[1]!)] };
const gone: Anim = {
  loop: false,
  frames: [
    fr(90, draw("gn0", (cv) => {
      plant(cv, { grow: 0.9, season: "dry", leaves: 2, droop: 0.5 });
      fallingLeaf(cv, 9, 21, 80, 0);
      shape(cv, E(6.5, 27.5, 2.6, 1.1), () => "m");
      shape(cv, E(24.5, 27, 2.4, 1), () => "l");
      shape(cv, E(20, 27.5, 2, 0.9), () => "j");
    })),
    fr(90, draw("gn1", (cv) => {
      plant(cv, { grow: 0.55, season: "dry", leaves: 0, droop: 0.7, mound: 0.9 });
      shape(cv, E(6.5, 27.5, 2.2, 1), () => "o");
      shape(cv, E(24.5, 27, 2.2, 0.9), () => "p");
    })),
    fr(90, draw("gn2", (cv) => { plant(cv, { grow: 0.2, season: "dry", leaves: 0, droop: 0.9, mound: 0.8 }); })),
    fr(90, draw("gn3", (cv) => { mound(cv, 6, 2, 15.5, 27.5); dirt(cv, 15.5, 26, 5, 3, 9); })),
    fr(80, draw("gn4", (cv) => mound(cv, 3.2, 1.2, 15.5, 27.5))),
    fr(40, null),
  ],
};

// ---- The snapping plant: rises, opens its jaws round the piece, snaps shut on it, chews, sinks.

interface Trap {
  /** How tall its stalk stands (the soil to where the jaws are hinged), pixels. */
  stalk: number;
  /** How far each jaw is open from shut, degrees (0 shut). */
  open: number;
  /** Its size (1 full) and the squash of the shut pod: wider (+) or taller (-). */
  size?: number;
  squash?: number;
  mound?: number;
  /** Which way the pod leans (a shake), pixels. */
  lean?: number;
}

/** The shut pod: a green egg with a seam down its middle, a zigzag of teeth along the seam, a red gap that widens as it opens. */
function pod(cv: Canvas, cx: number, cy: number, rx: number, ry: number, gap: number, bite = false): void {
  shape(cv, E(cx, cy, rx, ry), (x, y) => {
    const nx = (x + 0.5 - cx) / rx;
    const ny = (y + 0.5 - cy) / ry;
    const l = 0.55 - 0.32 * nx - 0.42 * ny;
    // The seam: dark, the gap red; teeth either side.
    const d = Math.abs(x + 0.5 - cx);
    if (d < 0.7 + gap / 2) return gap >= 1.6 ? (d < gap / 2 - 0.3 ? "r" : "s") : "r";
    if (d < 1.7 + gap / 2 && (y + (x < cx ? 1 : 0)) % 2 === 0 && ny > -0.8 && ny < 0.75) return "T";
    return ramp("fggh", clamp(l, 0, 0.99));
  });
  // A bright lip on the lit side, and veins.
  for (let i = 0; i < 3; i++) put(cv, cx - rx * 0.55 - i * 0.2, cy - ry * 0.35 + i * 2.6, "i");
  if (bite) for (const [dx, dy] of [[-rx - 2, -2], [rx + 2, -3], [-rx - 1, 4], [rx + 1, 3]] as const) put(cv, cx + dx, cy + dy, "w");
}

/** A jaw (one lobe, hinged at (hx, hy), pointing `ang` degrees off straight up, `side` -1 or 1): red inside, a green rim, teeth along its free edge. */
function jaw(cv: Canvas, hx: number, hy: number, ang: number, side: -1 | 1, len: number, wid: number): void {
  const th = rad(ang);
  const ax = Math.sin(th);
  const ay = -Math.cos(th);
  const nx = -ay;
  const ny = ax;
  const local = (x: number, y: number) => {
    const px = x + 0.5 - hx;
    const py = y + 0.5 - hy;
    return { u: px * ax + py * ay, v: px * nx + py * ny };
  };
  const half = (u: number) => (wid / 2) * Math.sin(Math.PI * clamp(u / len) ** 0.8);
  const inside: In = (x, y) => {
    const { u, v } = local(x, y);
    return u >= -0.4 && u <= len && Math.abs(v) <= half(u) + 0.01;
  };
  // The free edge is the side toward the middle (the other jaw): the v sign pointing at it.
  const toward = Math.sign(nx * -side) || 1;
  shape(cv, inside, (x, y) => {
    const { u, v } = local(x, y);
    const hw = Math.max(0.5, half(u));
    const edge = hw - Math.abs(v);
    const free = Math.sign(v) === toward;
    if (edge < 1.6 && !free) return "g";
    if (edge < 1.3 && free) return Math.round(u + Math.abs(v)) % 2 === 0 ? "T" : "U";
    const l = 0.35 + 0.5 * (u / len) - 0.18 * (Math.abs(v) / hw);
    return ramp("rst", clamp(l, 0, 0.99));
  });
}

function trap(cv: Canvas, o: Trap): void {
  const size = o.size ?? 1;
  const ground = 27.5;
  mound(cv, 10 * (o.mound ?? 1), 3.6 * (o.mound ?? 1));
  const hy = ground - 3 - o.stalk;
  const cx = 15.5 + (o.lean ?? 0);
  shape(cv, pathIn([[15.5, ground - 1], [cx - 0.5, (ground + hy) / 2], [cx, hy + 1]], 1.4), (x) => (x < cx ? "h" : "g"));
  // A leaf on the stalk.
  if (o.stalk >= 5) leaf(cv, 15.5, ground - 3, -68, 6, 3.4, GREEN);
  if (o.stalk >= 7) leaf(cv, 15.5, ground - 5, 62, 6, 3.4, GREEN);
  if (o.open < 8) {
    const sq = o.squash ?? 0;
    const rx = (9.5 + sq) * size;
    const ry = (9.2 - sq * 0.8) * size;
    pod(cv, cx, hy - ry + 2.5, rx, ry, o.open >= 3 ? 2 : 0);
  } else {
    jaw(cv, cx - 1.5, hy + 1, -o.open, -1, 16 * size, 10.5 * size);
    jaw(cv, cx + 1.5, hy + 1, o.open, 1, 16 * size, 10.5 * size);
  }
}

const trapPart = (name: string, o: Trap, extra?: (cv: Canvas) => void) => draw(name, (cv) => { trap(cv, o); extra?.(cv); });
const kill: Anim = {
  loop: false,
  frames: [
    fr(60, draw("kl0", (cv) => { seedling(cv); shape(cv, E(15.5, 19.5, 3, 3.6), (x, y) => ramp("ggh", (x - 13 + (y - 16) * 0.3) / 6)); dirt(cv, 15.5, 25, 8, 4, 4); }), { cue: "rise" }),
    fr(70, trapPart("kl1", { stalk: 2, open: 0, size: 0.5 }, (cv) => dirt(cv, 15.5, 25, 9, 4, 5))),
    fr(70, trapPart("kl2", { stalk: 4, open: 0, size: 0.8, lean: -1 })),
    fr(70, trapPart("kl3", { stalk: 5, open: 16, size: 1, lean: 1 })),
    fr(80, trapPart("kl4", { stalk: 5, open: 58, size: 1 }), { cue: "open" }),
    fr(50, trapPart("kl5", { stalk: 5, open: 0, size: 1.04, squash: 0.8 }, (cv) => { for (const [x, y] of [[2, 12], [29, 11], [2, 19], [29, 18], [15, 1]] as const) put(cv, x, y, "w"); }), { cue: "snap", shake: [0, 1] }),
    fr(70, trapPart("kl6", { stalk: 5, open: 0, size: 1, squash: 1.4, lean: -1 }, (cv) => dirt(cv, 15.5, 10, 11, 4, 6, -1))),
    fr(70, trapPart("kl7", { stalk: 5, open: 0, size: 1, squash: -1, lean: 1 }), { cue: "gulp" }),
    fr(80, trapPart("kl8", { stalk: 3, open: 0, size: 0.78 })),
    fr(80, trapPart("kl9", { stalk: 1, open: 0, size: 0.5, mound: 0.9 })),
    fr(70, draw("kl10", (cv) => { mound(cv, 6.5, 2.2); dirt(cv, 15.5, 26, 6, 3, 7); })),
    fr(60, draw("kl11", (cv) => mound(cv, 3.4, 1.2))),
    fr(40, null),
  ],
};

// ---- A bud that opens on one of his pieces (a pawn, or grander, a queen).

interface Bloom {
  /** The stalk's height. */
  stalk: number;
  /** The bud's size (0 to 1) while it's shut, then how far its petals are out (0 shut to 1 spread) once `open`. */
  size: number;
  open?: number;
  queen?: boolean;
  /** A shake. */
  lean?: number;
  /** Whether the petals' ring has a clear middle (the piece shows there) and how far the petals have scattered (0 to 1). */
  scatter?: number;
}

/** A closed bud: a green egg with a pink tip, sepals folded over it. */
function closedBud(cv: Canvas, cx: number, cy: number, size: number, queen: boolean, peek: number): void {
  const rx = 2 + 4.2 * size;
  const ry = 2.6 + 5.4 * size;
  shape(cv, E(cx, cy, rx, ry), (x, y) => {
    const nx = (x + 0.5 - cx) / rx;
    const ny = (y + 0.5 - cy) / ry;
    const l = 0.55 - 0.3 * nx - 0.4 * ny;
    // The tip: pink (gold for the queen), showing more as it opens.
    if (ny < -0.15 + peek * 0.5 - 0.4 && Math.abs(nx) < 0.75) return queen ? ramp("HIJ", clamp(l, 0, 0.99)) : ramp("PQR", clamp(l, 0, 0.99));
    if (Math.abs(nx) < 0.1 && ny > -0.6) return "f";
    return ramp("fgh", clamp(l, 0, 0.99));
  });
}

/** `n` petals round (cx, cy) from radius `r0` to `r1`, a ring: pink or gold. */
function petals(cv: Canvas, cx: number, cy: number, n: number, r0: number, r1: number, wid: number, keys: string, turn = 0): void {
  for (let i = 0; i < n; i++) {
    const a = turn + (i * 360) / n;
    const th = rad(a);
    leaf(cv, cx + Math.sin(th) * r0, cy - Math.cos(th) * r0, a, r1 - r0, wid, keys);
  }
}

function bloom(cv: Canvas, o: Bloom): void {
  const ground = 27.5;
  mound(cv, 10, 3.6);
  const cx = 15.5 + (o.lean ?? 0);
  const open = o.open ?? 0;
  const hy = ground - 3 - o.stalk;
  if (o.open === undefined) {
    shape(cv, pathIn([[15.5, ground - 1], [cx, hy + 2]], 1.2), () => "g");
    if (o.stalk >= 6) leaf(cv, 15.5, ground - 3, -66, 5.5, 3.2, GREEN);
    if (o.stalk >= 8) leaf(cv, 15.5, ground - 4, 62, 5.5, 3.2, GREEN);
    closedBud(cv, cx, hy - 2, o.size, !!o.queen, 0);
    return;
  }
  // Open: the petals ring the middle of the square (the piece stands there), on the stalk with its sepals folded back below them.
  const cy = 15.5;
  const sc = o.scatter ?? 0;
  const keys = o.queen ? "GHIJ" : "PQRR";
  const r0 = 5.4 + 3.2 * sc;
  const r1 = (o.queen ? 14 : 12.8) * (0.55 + 0.45 * open) + 2.2 * sc;
  if (sc < 1.1) {
    shape(cv, pathIn([[15.5, ground - 1], [cx, 22]], 1.2), () => "g");
    leaf(cv, 15.5, 23, -82, 7, 3.6, GREEN);
    leaf(cv, 15.5, 23, 82, 7, 3.6, GREEN);
  }
  if (o.queen) petals(cv, 15.5, cy, 8, r0 + 0.5, r1 * 0.8, 4.2, "PQRR", 22.5);
  petals(cv, 15.5, cy, o.queen ? 8 : 6, r0, r1, o.queen ? 5 : 6.2, keys, o.queen ? 0 : 30);
}

const bloomPart = (name: string, o: Bloom, extra?: (cv: Canvas) => void) => draw(name, (cv) => { bloom(cv, o); extra?.(cv); });
const spark = (cv: Canvas, x: number, y: number, big: boolean, core = "w", ray = "J") => {
  put(cv, x, y, core);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(cv, x + dx, y + dy, ray);
  if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) put(cv, x + dx, y + dy, ray);
};
const sparksAt = (cv: Canvas, pts: readonly (readonly [number, number, boolean])[], core?: string, ray?: string) => pts.forEach(([x, y, b]) => spark(cv, x, y, b, core, ray));
const BURST: readonly (readonly [number, number, boolean])[] = [[4, 6, true], [27, 5, false], [3, 22, false], [28, 21, true], [16, 2, false]];

const budAnim = (queen: boolean): Anim => {
  const n = queen ? "q" : "b";
  const K = (name: string) => `${n}${name}`;
  const fade = (f: number): Record<string, string> => {
    const a = Math.round(255 * f).toString(16).padStart(2, "0");
    return Object.fromEntries(Object.entries(GARDEN_PALETTE).filter(([k]) => "PQRGHIJTUwfghik".includes(k)).map(([k, v]) => [k, `${v.slice(0, 7)}${a}`]));
  };
  return {
    loop: false,
    frames: [
      fr(70, draw(K("0"), (cv) => { seedling(cv); shape(cv, E(15.5, 19.5, 2.6, 3.4), (x, y) => (y < 19 ? (queen ? "I" : "Q") : "g")); }), { cue: "swell" }),
      fr(70, bloomPart(K("1"), { stalk: 8, size: 0.75, queen })),
      fr(70, bloomPart(K("2"), { stalk: 10, size: 1, queen, lean: -1 })),
      fr(60, bloomPart(K("3"), { stalk: 10, size: 1, queen, lean: 1 }, (cv) => cv && sparksAt(cv, queen ? [[8, 8, false], [23, 7, false]] : [])), { shake: [1, 0] }),
      fr(80, bloomPart(K("4"), { stalk: 10, size: 1, open: 1, queen }, (cv) => sparksAt(cv, queen ? [...BURST, [8, 12, true], [24, 13, true]] : BURST, "w", queen ? "J" : "R")), { cue: "pop", shake: [0, -1] }),
      fr(80, bloomPart(K("5"), { stalk: 10, size: 1, open: 1, queen, scatter: 0.6 }, (cv) => sparksAt(cv, queen ? [[5, 10, true], [26, 9, true], [10, 3, false], [22, 24, false]] : [[5, 11, false], [26, 10, false]], "w", queen ? "J" : "R")), { pal: fade(0.85) }),
      fr(80, bloomPart(K("6"), { stalk: 10, size: 1, open: 1, queen, scatter: 1 }, (cv) => sparksAt(cv, queen ? [[4, 16, false], [27, 14, false]] : [], "w", "J")), { pal: fade(0.5) }),
      ...(queen ? [fr(80, bloomPart(K("7"), { stalk: 10, size: 1, open: 1, queen, scatter: 1.3 }), { pal: fade(0.25) })] : []),
      fr(40, null),
    ],
  };
};

// ---- Nothing: the sprout pokes up and wilts away.

/** A sprout drooping: its top at `top`, the stem arching there from the soil, its two leaves turned `a1` and `a2` degrees (0 up) and drying (0 green to 1 brown). */
function wilting(cv: Canvas, top: Pt, a1: number, a2: number, dry: number, size: number, mnd = 1): void {
  mound(cv, 8.5 * mnd, 3 * mnd);
  const mid: Pt = [15.5 + (top[0] - 15.5) * 0.25, 26 - (26 - top[1]) * 0.6];
  shape(cv, pathIn([[15.5, 26], mid, top], 1.0), () => (dry > 0.5 ? "p" : "g"));
  const keys = dry < 0.3 ? GREEN : dry < 0.7 ? "lmn" : DRY;
  leaf(cv, top[0], top[1] + 1, a1, 5.8 * size, 3.4 * size, keys);
  leaf(cv, top[0], top[1] + 1, a2, 5.8 * size, 3.4 * size, keys);
}
const wilt: Anim = {
  loop: false,
  frames: [
    fr(70, draw("wl0", (cv) => wilting(cv, [16.2, 20.5], -66, 56, 0, 1)), { cue: "wilt" }),
    fr(80, draw("wl1", (cv) => wilting(cv, [18, 21.2], -92, 40, 0.35, 1))),
    fr(90, draw("wl2", (cv) => wilting(cv, [20.5, 22.6], -118, 88, 0.7, 0.95))),
    fr(80, draw("wl3", (cv) => { mound(cv, 8.5, 3); shape(cv, pathIn([[15.5, 25.2], [19, 24.4], [22.5, 25.4]], 0.9), () => "p"); leaf(cv, 22, 25.2, 100, 3.6, 2.2, DRY); leaf(cv, 22, 25.2, 160, 3.2, 2, DRY); })),
    fr(70, draw("wl4", (cv) => { mound(cv, 7.5, 2.6); shape(cv, pathIn([[16, 25.4], [20, 25]], 0.8), () => "o"); dirt(cv, 15.5, 26, 5, 2, 11); })),
    fr(60, draw("wl5", (cv) => mound(cv, 3.4, 1.2))),
    fr(40, null),
  ],
};

// ---- Seeds: they arc in, plop, and sink; nothing is left.

/** A seed: a small tan lens with a dark brown outline (it reads on the light squares and the dark), lit on its upper side, `ang` degrees (0 lying flat). */
function seedShape(cv: Canvas, cx: number, cy: number, ang: number, len = 6.4, wid = 3.6): void {
  const th = rad(ang);
  const ax = Math.cos(th);
  const ay = Math.sin(th);
  const local = (x: number, y: number) => {
    const px = x + 0.5 - cx;
    const py = y + 0.5 - cy;
    return { u: px * ax + py * ay, v: -px * ay + py * ax };
  };
  const half = (u: number) => (wid / 2) * Math.sqrt(Math.max(0, 1 - (u / (len / 2)) ** 2));
  shape(cv, (x, y) => {
    const { u, v } = local(x, y);
    return Math.abs(u) <= len / 2 && Math.abs(v) <= half(u) + 0.02;
  }, (x, y) => {
    const { u, v } = local(x, y);
    return v < -0.3 && u < 1 ? "e" : v > 0.5 ? "c" : "d";
  }, "a");
}

const SEED_FLY: Character = (() => {
  const seeds: Record<string, Part> = {};
  const angles = [0, 45, 90, 135];
  const frames = angles.map((a, i): Frame => {
    const cv = canvas(SQUARE, SQUARE);
    seedShape(cv, 15.5, 15.5, a);
    seeds[`s${i}`] = asPart(cv);
    return { ms: 55, layers: [L0(`s${i}`)] };
  });
  return { id: "seed-fly", name: "A seed tumbling", w: SQUARE, h: SQUARE, foot: [16, 16], palette: GARDEN_PALETTE, parts: seeds, anims: { fly: { loop: true, frames } } };
})();

/** The dimple in the soil where it went in: a see-through darker ring, `r` wide (frame pixels). */
function dimple(cv: Canvas, r: number, strong: boolean): void {
  const inside = E(15.5, 19, r, r * 0.42);
  const inner = E(15.5, 19, r * 0.62, r * 0.25);
  for (let y = 0; y < SQUARE; y++)
    for (let x = 0; x < SQUARE; x++) if (inside(x, y)) cv[y]![x] = inner(x, y) ? (strong ? "y" : "z") : strong ? "y" : "z";
}

const SEED_PLOP: Character = (() => {
  const ps: Record<string, Part> = {};
  const mk = (name: string, f: (cv: Canvas) => void): Layer => {
    const cv = canvas(SQUARE, SQUARE);
    f(cv);
    ps[name] = asPart(cv);
    return L0(name);
  };
  const frames: Frame[] = [
    // It lands, squashed flat, in a puff of dirt.
    { ms: 55, layers: [mk("p0", (cv) => { dimple(cv, 4.5, true); dirt(cv, 15.5, 18, 7, 7, 21); seedShape(cv, 15.5, 17, 8); })], cue: "plop" },
    // It dips into the soil: only its top shows, the dirt falling back.
    { ms: 70, layers: [mk("p1", (cv) => { dimple(cv, 6.2, true); dirt(cv, 15.5, 17, 9, 6, 22); seedShape(cv, 15.5, 18.6, 8, 5, 2.4); })] },
    // Gone in: a ring of crumbs round a dimple.
    { ms: 80, layers: [mk("p2", (cv) => { dimple(cv, 6.8, true); dirt(cv, 15.5, 18, 7, 3, 23, 0); })] },
    { ms: 90, layers: [mk("p3", (cv) => dimple(cv, 7, false))] },
    { ms: 90, layers: [mk("p4", (cv) => dimple(cv, 6.4, false))], pal: { z: "#2e1b0e0f" } },
    { ms: 40, layers: [] },
  ];
  return { id: "seed-plop", name: "A seed landing and sinking in", w: SQUARE, h: SQUARE, foot: [16, 22], palette: GARDEN_PALETTE, parts: ps, anims: { plop: { loop: false, frames } } };
})();

export { SEED_FLY, SEED_PLOP };

// ---- The watering: a pass of spray across the whole board, then a wet shine that fades.

const BOARD = SQUARE * 8;
/** The spray's colors: the tint over every square, and the water's. */
const WATER_PALETTE: Record<string, string> = { ...GARDEN_PALETTE, v: "#3a86d41a", u: "#e6f5ff80" };

/** How the spray falls: each streak runs down and to the right, steeply. */
const FALL_DIR: Pt = [0.5, 0.86];

/**
 * One frame of the pass: the front of the spray at x `front` (leaning: the lower rows are ahead of the upper by `LEAN` pixels, a hose
 * sweeping from the near squares to the far), spray streaks and drops behind it thinning out, and the tint where it has been.
 */
const LEAN = 0.35;
function sweepPart(front: number, seed: number, tint: boolean): Part {
  const cv = canvas(BOARD, BOARD);
  const edgeAt = (y: number) => front + (y - BOARD / 2) * LEAN;
  if (tint)
    for (let y = 0; y < BOARD; y++) {
      const e = edgeAt(y) - 10;
      for (let x = 0; x < Math.min(BOARD, e); x++) cv[y]![x] = "v";
    }
  // A haze of spray right at the front, dithered so the squares show through.
  const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]] as const;
  for (let y = 0; y < BOARD; y++) {
    const e = edgeAt(y);
    for (let x = Math.max(0, Math.floor(e - 20)); x <= Math.min(BOARD - 1, e + 4); x++) {
      const d = e - x;
      const dens = d < 0 ? 0.5 * (1 - -d / 5) : 0.55 * (1 - d / 20);
      if (dens * 16 > BAYER4[(y >> 1) & 3]![(x >> 1) & 3]!) cv[y]![x] = "u";
    }
  }
  // Streaks, by cell: each cell may hold one, more of them near the front.
  const CELL = 6;
  const outline: [number, number][] = [];
  const cores: [number, number, string][] = [];
  for (let cy = 0; cy < BOARD / CELL; cy++)
    for (let cx = 0; cx < BOARD / CELL; cx++) {
      const x0 = cx * CELL + Math.floor(nz(cx, cy, seed) * CELL);
      const y0 = cy * CELL + Math.floor(nz(cx, cy, seed + 7) * CELL);
      const behind = edgeAt(y0) - x0;
      if (behind < -12 || behind > 96) continue;
      const p = behind < 0 ? 0.35 * (1 - -behind / 12) : 0.4 * (1 - behind / 96) ** 1.4 + 0.02;
      if (nz(cx, cy, seed + 13) > p) continue;
      const big = nz(cx, cy, seed + 21) > 0.93;
      const len = 4 + Math.floor(nz(cx, cy, seed + 5) * 5);
      for (let t = 0; t < (big ? 2 : len); t++) {
        const px = Math.round(x0 + FALL_DIR[0] * t);
        const py = Math.round(y0 + FALL_DIR[1] * t);
        const key = big ? (t === 0 ? "4" : "3") : t === 0 ? "4" : t < len - 1 ? "3" : "2";
        cores.push([px, py, key]);
        if (big) cores.push([px + 1, py, "3"], [px, py + 1, "2"], [px + 1, py + 1, "2"]);
        outline.push([px - 1, py], [px + 1, py], [px, py + 1], [px, py - 1], ...(big ? ([[px + 2, py], [px + 2, py + 1], [px - 1, py + 1], [px, py + 2], [px + 1, py + 2]] as [number, number][]) : []));
      }
    }
  for (const [x, y] of outline) put(cv, x, y, "N");
  for (const [x, y, k] of cores) put(cv, x, y, k);
  return asPart(cv);
}

/** The wet shine after the pass: the tint, glints twinkling on it and a few drops sliding down, `i` which frame (0 to 5). */
function sheenPart(i: number): Part {
  const cv = canvas(BOARD, BOARD);
  for (let y = 0; y < BOARD; y++) for (let x = 0; x < BOARD; x++) cv[y]![x] = "v";
  // Glints: about one in each square, a cross that swells and shrinks as it twinkles.
  for (let sy = 0; sy < 8; sy++)
    for (let sx = 0; sx < 8; sx++) {
      if (nz(sx, sy, 31) > 0.82) continue;
      const gx = sx * SQUARE + 5 + Math.floor(nz(sx, sy, 32) * 20);
      const gy = sy * SQUARE + 5 + Math.floor(nz(sx, sy, 33) * 20);
      const phase = (i + Math.floor(nz(sx, sy, 34) * 6)) % 6;
      const size = [0, 1, 2, 2, 1, 0][phase]!;
      if (size === 0) continue;
      put(cv, gx, gy, "w");
      if (size >= 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(cv, gx + dx, gy + dy, "3");
      if (size >= 2) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) put(cv, gx + dx, gy + dy, "2");
    }
  // Drops sliding down the squares' faces.
  for (let k = 0; k < 9; k++) {
    const dx = 8 + Math.floor(nz(k, 3, 41) * (BOARD - 16));
    const dy = Math.floor(nz(k, 4, 42) * (BOARD - 30)) + i * 3;
    for (let t = 0; t < 3; t++) { put(cv, dx - 1, dy + t, "N"); put(cv, dx + 1, dy + t, "N"); put(cv, dx, dy + t, t === 0 ? "4" : "3"); }
    put(cv, dx, dy - 1, "N");
    put(cv, dx, dy + 3, "N");
  }
  return asPart(cv);
}

const WATER_SWEEP: Character = (() => {
  const ps: Record<string, Part> = {};
  const fronts = [-24, 26, 76, 126, 176, 226, 276];
  const sweepFrames = fronts.map((f, i): Frame => {
    ps[`w${i}`] = sweepPart(f, 100 + i * 3, true);
    return { ms: 60, layers: [L0(`w${i}`)], ...(i === 0 ? { cue: "spray" } : {}) };
  });
  const SHEEN_ALPHA = ["1a", "17", "12", "0d", "08", "04"] as const;
  const sheenFrames = SHEEN_ALPHA.map((a, i): Frame => {
    ps[`h${i}`] = sheenPart(i);
    // Everything in it thins away together: the tint and the glints.
    const fadeTo = [1, 0.95, 0.8, 0.6, 0.38, 0.18][i]!;
    const al = Math.round(255 * fadeTo).toString(16).padStart(2, "0");
    return { ms: 120, layers: [L0(`h${i}`)], pal: { v: `#3a86d4${a}`, w: `#ffffff${al}`, "4": `#d8f2ff${al}`, "3": `#8bcdfb${al}`, N: `#123a7c${al}` } };
  });
  return {
    id: "water-sweep",
    name: "The watering's sweep across the board",
    w: BOARD,
    h: BOARD,
    foot: [BOARD / 2, BOARD - 1],
    palette: WATER_PALETTE,
    parts: ps,
    anims: { sweep: { loop: false, frames: sweepFrames }, sheen: { loop: false, frames: [...sheenFrames, { ms: 40, layers: [] }] } },
  };
})();
/** The spray's front crosses the board's columns at this pace (ms for the whole board), so the sprout on a column can start as it passes. */
export const SWEEP_MS = 420;

// ---- His jet landing on a king.

/** The jet landing at (`x`, `y`) on the king, as specks with a navy outline: a burst, a crown of drops, the drops falling; the stream coming in from the left edge. */
function splash([x, y]: [number, number], step: 0 | 1 | 2): Speck[] {
  const cv = canvas(SQUARE, SQUARE);
  // The stream coming in.
  const reach = [x - 2, x - 5, x - 8][step]!;
  for (let sx = 0; sx <= reach; sx++) {
    const sy = Math.round(y + 3 - (3 * sx) / Math.max(1, x));
    cv[sy]![sx] = sx % 5 === 0 ? "4" : "3";
    if (step < 2) cv[sy + 1]![sx] = "2";
  }
  const r = [3.4, 5, 3][step]!;
  if (step < 2) {
    const disc = E(x, y, r, r * 0.9);
    for (let py = 0; py < SQUARE; py++) for (let px = 0; px < SQUARE; px++) if (disc(px, py)) cv[py]![px] = Math.hypot(px + 0.5 - x, py + 0.5 - y) < r * 0.5 ? "4" : "3";
  }
  const drops = step === 0 ? 4 : step === 1 ? 8 : 6;
  for (let i = 0; i < drops; i++) {
    const a = (i / drops) * Math.PI * 2 + step * 0.4;
    const d = [6.5, 9, 10][step]! + (i % 2) * 1.5;
    const dx = Math.round(x + Math.cos(a) * d);
    const dy = Math.round(y + Math.sin(a) * d * 0.8 + step * 2.2);
    if (cv[dy]?.[dx] === ".") {
      cv[dy]![dx] = i % 2 ? "3" : "4";
      if (step < 2 && cv[dy + 1]?.[dx] === ".") cv[dy + 1]![dx] = "2";
    }
  }
  const filled = (px: number, py: number) => cv[py]?.[px] !== undefined && cv[py]![px] !== ".";
  const out: Speck[] = [];
  for (let py = 0; py < SQUARE; py++)
    for (let px = 0; px < SQUARE; px++) {
      if (filled(px, py)) out.push([px, py, cv[py]![px]!]);
      else if (N4.some(([dx, dy]) => filled(px + dx, py + dy))) out.push([px, py, "N"]);
    }
  return out;
}
const WATER_HIT: Character = {
  id: "water-hit",
  name: "His jet landing on a king",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: GARDEN_PALETTE,
  parts: {},
  anims: hitAnims([["H", 9], ["L", 15]], (y, step) => splash([15, y], step)),
};

export { WATER_SWEEP, WATER_HIT };

export const GARDEN_PLANT: Character = {
  id: "garden-plant",
  name: "A sprout and what it turns into",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 28],
  palette: GARDEN_PALETTE,
  parts,
  anims: { sprout, grow: plainGrow, green, toFall, fall, toDrop, drop, gone, kill, bud: budAnim(false), budQueen: budAnim(true), wilt },
};
