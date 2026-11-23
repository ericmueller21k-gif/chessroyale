/**
 * Birdie's bartender (id "sidekick-birdie-bartender"): a friendly city pigeon who runs the little bar in the lobby of
 * Birdie's station and is the shop's clerk. Nobody's kid: a Chess Town local, like the Battle Tower's clerk.
 *
 * A plump blue-grey pigeon with an iridescent green-violet neck, a short dark beak with a red-orange cere, round warm
 * brown eyes, a charcoal bow tie with a train-yellow dot, a train-red vest and a white apron tied at the waist. He
 * stands behind the bar (about 31 px tall), so his head, neck, bow tie, the top of his vest and the glass he dries all
 * sit in his top 25 rows. Three-quarters, facing our right, light from the top left.
 *
 * Rigging: the body (vest and apron painted on) and the heads (one per face and tilt) are painted once; the wings are
 * painted from points (shoulder, elbow, tip) per pose; the glass rides the far wing's tip and the towel the near one's.
 */
import { canvas, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

const PAL = {
  k: "#0e1014", // outline
  S: "#5c616b", // pigeon grey: shade, mid, lit, pale (eye ring, wing bar)
  g: "#8a8f9a",
  G: "#b5bac4",
  h: "#d8dce3",
  D: "#3b3f48", // dark wing tips
  e: "#3f7d5e", // neck sheen: green, its shine, the violet flicker
  E: "#6cb48a",
  v: "#7a4d9e",
  r: "#c8372d", // train-red vest
  R: "#8e1f1a",
  p: "#e2604f",
  w: "#f3f1ec", // apron, towel
  W: "#d6d2ca",
  c: "#2b2d31", // beak, bow tie
  C: "#4b4f58",
  q: "#e0573a", // cere
  f: "#e66a3e", // feet
  F: "#a83a22",
  y: "#f4c430", // train yellow
  n: "#2e2a26", // eye
  x: "#ffffff",
  b: "#e8a0a0", // blush
  m: "#6a1b14", // inside the beak
  a: "#e6f5f9", // glass
  A: "#a9cfdc",
  i: "#6e9bb0",
  j: "#7fd3ff", // sweat
  Y: "#ffe28a", // twinkle
} as const;

type Pt = readonly [number, number];

/** The frame; the ground is the first row below the feet. Behind the bar, the counter top is at row GROUND - 31 = 25. */
const W = 52;
const H = 60;
const GROUND = 58;

const PARTS: Record<string, Part> = {};
interface Placed {
  name: string;
  at: Pt;
}
const MADE = new Map<string, Placed>();
function crop(cv: Canvas): { part: Part; at: Pt } {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  cv.forEach((row, y) =>
    row.forEach((k, x) => {
      if (k === ".") return;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }),
  );
  if (x1 < 0) return { part: { grid: ["."] }, at: [0, 0] };
  return { part: { grid: cv.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")) }, at: [x0, y0] };
}
/** A part painted on a frame-sized canvas, cropped, made once by name. */
function painted(name: string, make: () => Canvas): Placed {
  let p = MADE.get(name);
  if (!p) {
    const c = crop(make());
    PARTS[name] = c.part;
    p = { name, at: c.at };
    MADE.set(name, p);
  }
  return p;
}

// Pixel (x, y) is inside a shape if its center (x + 0.5, y + 0.5) is.
const inE = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
/** Continuous coordinates: is (u, v) inside the polygon. */
function inPolyC(pts: readonly Pt[]) {
  return (u: number, v: number) => {
    let inside = false;
    pts.forEach(([x0, y0], i) => {
      const [x1, y1] = pts[(i + 1) % pts.length]!;
      if (y0 <= v !== y1 <= v && u < x0 + ((v - y0) / (y1 - y0)) * (x1 - x0)) inside = !inside;
    });
    return inside;
  };
}
function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, y) =>
    [...row].forEach((k, i) => {
      if (k === "." || cv[y0 + y]?.[x0 + i] === undefined) return;
      cv[y0 + y]![x0 + i] = k;
    }),
  );
}

// ---- The body: a plump upright pigeon, the neck's sheen, the red vest (a V at the throat), the white apron.

const NECK = inE(28, 17.5, 5.5, 5);
const CHEST = inE(25.5, 27, 11, 10);
const BELLY = inE(23.5, 40.5, 13, 12.5);
const inBody = (x: number, y: number) => NECK(x, y) || CHEST(x, y) || BELLY(x, y);
const bodyLight = (x: number, y: number) => 0.55 - 0.42 * ((x + 0.5 - 24) / 13) - 0.5 * ((y + 0.5 - 33) / 20);
const grey = (l: number) => (l < 0.3 ? "S" : l < 0.72 ? "g" : "G");
const red = (l: number) => (l < 0.36 ? "R" : l < 0.8 ? "r" : "p");
/** The vest's front (in three-quarters, right of the middle) and its V at the throat. */
const FX = 30;
const inV = (x: number, y: number) => y <= 27 && Math.abs(x - FX) <= (28 - y) * 0.45;
const vestBottom = (x: number) => 37 + Math.max(0, Math.round(2.5 - Math.abs(x - 29) * 0.6));

const BODY = painted("body", () => {
  const cv = canvas(W, H);
  const left = (y: number) => {
    let x = 0;
    while (x < W && !inBody(x, y)) x++;
    return x;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inBody(x, y)) continue;
      const l = bodyLight(x, y);
      let k = grey(l);
      if (y <= 20) {
        // The neck's sheen: green, a violet flicker at its back and lower edge.
        k = x === left(y) || y === 20 ? "v" : "e";
      } else if (y >= 38 && y <= 50 && x > left(y) + 3) {
        if (y === 38) k = "w";
        else if (y === 39 || y === 50) k = "W";
        else k = l < 0.4 || ((x === 20 || x === 27) && y >= 42) ? "W" : "w";
      } else if (y >= 51) k = "S";
      cv[y]![x] = k;
    }
  // Two pixels of shine on the neck.
  for (const [x, y] of [[24, 17], [25, 18]] as const) if (cv[y]![x] !== ".") cv[y]![x] = "E";
  // The vest over the shoulders and chest; the breast shows in its V.
  for (let y = 21; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inBody(x, y) || y > vestBottom(x)) continue;
      const l = bodyLight(x, y);
      if (inV(x, y)) {
        cv[y]![x] = l > 0.5 ? "G" : "g";
        continue;
      }
      cv[y]![x] = red(l);
      if (inV(x + 1, y) && y <= 27) cv[y]![x] = "p";
      else if (inV(x - 1, y) && y <= 27) cv[y]![x] = "R";
    }
  for (let y = 27; y <= vestBottom(FX); y++) cv[y]![FX] = "R";
  cv[31]![FX - 1] = "y";
  cv[35]![FX - 1] = "y";
  return cv;
});

PARTS["tie"] = { grid: [".ww.", "wWWw", ".wW.", "w..w", "W..W"] };
PARTS["foot"] = { grid: ["F...", "f...", "ffff"] };
PARTS["bow"] = { grid: ["cc.cc", "ccycc", "cc.cc"] };
PARTS["glass"] = { grid: ["xaAAAi", "xaAAAi", "aaAAAi", ".aAAi.", "..Ai..", "..A...", "..A...", ".aAAi."] };
PARTS["towel"] = { grid: [".ww..", "wwWw.", "wWwww", ".wwW.", "..W.."] };
PARTS["flick0"] = { grid: ["ww...", "wWw..", ".wWw.", "..wwW", "...W."] };
PARTS["flick1"] = { grid: ["ww...", "wWww.", ".wwWw", "....W"] };
/** The towel landed on his head (defeat). */
PARTS["drape"] = { grid: ["..wwwww...", ".wwwwwWww.", "wwWwwwwWWw", "wW.....wW.", "W.......W."] };

// ---- Heads: a round grey head, one big round eye near the beak, a short dark beak with a red-orange cere.

export type Mood = "calm" | "blink" | "half" | "happy" | "grin" | "cheer" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold";
type Eye = "open" | "shut" | "half" | "arc" | "up" | "wide" | "pinch" | "x";
type Beak = "smile" | "open" | "flat" | "wavy";
type Brow = "worried" | "bold" | "smug";

const EYES: Record<Eye, readonly string[]> = {
  open: [".hhh.", "hxnnh", "hnnnh", "hnnnh", ".hhh."],
  shut: [".....", ".....", "hkkkh", ".hhh.", "....."],
  half: [".....", "kkkkk", "hnnnh", "hnnnh", ".hhh."],
  arc: [".....", ".kkk.", "k...k", ".....", "....."],
  up: [".hhh.", "hnnxh", "hnnnh", "hhhhh", ".hhh."],
  wide: [".hhh.", "hwwwh", "hwnwh", "hwwwh", ".hhh."],
  pinch: ["k....", ".kk..", "...kk", ".kk..", "k...."],
  x: ["k...k", ".k.k.", "..k..", ".k.k.", "k...k"],
};
const BROWS: Record<Brow, readonly Pt[]> = {
  worried: [[0, -1], [1, -1], [2, -2], [3, -2]],
  bold: [[0, -2], [1, -2], [2, -1], [3, -1], [4, -1]],
  smug: [[1, -2], [2, -2], [3, -2], [4, -1]],
};
const FACES: Record<Mood, { eye: Eye; beak: Beak; brow?: Brow; blush?: boolean }> = {
  calm: { eye: "open", beak: "smile", blush: true },
  blink: { eye: "shut", beak: "smile", blush: true },
  half: { eye: "half", beak: "smile", blush: true },
  happy: { eye: "arc", beak: "open", blush: true },
  grin: { eye: "arc", beak: "smile", blush: true },
  cheer: { eye: "open", beak: "open", blush: true },
  think: { eye: "up", beak: "flat" },
  thinkBlink: { eye: "shut", beak: "flat" },
  smug: { eye: "half", beak: "smile", brow: "smug", blush: true },
  rattled: { eye: "wide", beak: "wavy", brow: "worried" },
  hurt: { eye: "pinch", beak: "open", brow: "worried" },
  out: { eye: "x", beak: "open" },
  bold: { eye: "open", beak: "smile", brow: "bold", blush: true },
};

const HW = 26;
const HH = 21;
/** The head's pivot (its middle) on its own grid, and where the grid sits at rest on the frame. */
const HC: Pt = [9.5, 10];
const HX0 = 18;
const HY0 = 0;
const TILTS: Record<number, number> = { [-1]: -0.14, 0: 0, 1: 0.13, 2: 0.26 };

const SKULL = (u: number, v: number) => ((u - 9.5) / 8.6) ** 2 + ((v - 10) / 7.7) ** 2 <= 1;
const BX = 2.4;
const BY = 1;
const beakPoly = (pts: readonly Pt[]) => inPolyC(pts.map(([x, y]): Pt => [x + BX, y + BY]));
const UPPER = beakPoly([[14.6, 7.2], [20.8, 9.9], [20.4, 10.8], [14.6, 10.5]]);
const LOWER = beakPoly([[14.6, 10.5], [19.4, 10.8], [18.2, 12], [14.6, 12]]);
const LOWER_OPEN = beakPoly([[14.6, 11.3], [19, 11.9], [17.8, 13.3], [14.6, 13.2]]);
const GAPE = beakPoly([[14.6, 10.5], [20.4, 10.8], [19, 11.9], [14.6, 11.3]]);
const CERE = (u: number, v: number) => ((u - 15.8 - BX) / 1.7) ** 2 + ((v - 8.1 - BY) / 1.0) ** 2 <= 1;

function head(mood: Mood, tilt: number): Part {
  const t = TILTS[tilt] ?? 0;
  const cs = Math.cos(t);
  const sn = Math.sin(t);
  /** From the tilted picture back to the upright head. */
  const back = (X: number, Y: number): Pt => [HC[0] + (X - HC[0]) * cs + (Y - HC[1]) * sn, HC[1] - (X - HC[0]) * sn + (Y - HC[1]) * cs];
  /** From the upright head to the tilted picture (a pixel). */
  const to = (u: number, v: number): Pt => [Math.round(HC[0] + (u - HC[0]) * cs - (v - HC[1]) * sn - 0.5), Math.round(HC[1] + (u - HC[0]) * sn + (v - HC[1]) * cs - 0.5)];
  const face = FACES[mood];
  const cv = canvas(HW, HH);
  for (let y = 0; y < HH; y++)
    for (let x = 0; x < HW; x++) {
      const [u, v] = back(x + 0.5, y + 0.5);
      let k = ".";
      if (SKULL(u, v)) {
        const l = 0.56 - 0.45 * ((u - 9.5) / 8.6) - 0.55 * ((v - 10) / 8.2);
        k = l < 0.22 ? "S" : l < 0.75 ? "g" : "G";
        if (v > 14.4 && u < 10.5 - (v - 14.4)) k = u < 4.5 ? "v" : u > 6.5 && u < 7.6 && v < 15.6 ? "E" : "e";
      }
      if (face.beak === "open") {
        if (GAPE(u, v)) k = "m";
        if (LOWER_OPEN(u, v)) k = "c";
      } else if (LOWER(u, v)) k = "c";
      if (UPPER(u, v)) k = v < 9.9 + BY ? "C" : "c";
      if (CERE(u, v)) k = "q";
      cv[y]![x] = k;
    }
  // The eye, the blush and the line of the beak.
  const [ex, ey] = to(14.6, 9.6);
  stamp(cv, EYES[face.eye], ex - 2, ey - 2);
  if (face.brow) for (const [bx, by] of BROWS[face.brow]) cv[ey - 2 + by]![ex - 2 + bx] = "k";
  if (face.blush) {
    const [bx, by] = to(13, 14.2);
    cv[by]![bx] = "b";
    cv[by]![bx + 1] = "b";
  }
  if (face.beak === "smile") {
    const [mx, my] = to(16.6, 12.2);
    cv[my]![mx] = "k";
    cv[my - 1]![mx - 1] = "k";
  } else if (face.beak === "wavy") {
    const [mx, my] = to(16.6, 12.6);
    cv[my]![mx] = "k";
  }
  return { grid: toGrid(cv) };
}
function headName(mood: Mood, tilt: number): string {
  const name = `head:${mood}:${tilt}`;
  if (!PARTS[name]) PARTS[name] = head(mood, tilt);
  return name;
}

// ---- Wings: a round stroke through shoulder, elbow and tip, tapering; a pale bar across, the tip dark.

function wing(pts: readonly Pt[], far: boolean): Placed {
  return painted(`wing:${far ? "f" : "n"}:${pts.map((p) => p.join(",")).join(";")}`, () => {
    const cv = canvas(W, H);
    const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
    const L = lens.reduce((a, b) => a + b, 0) || 1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let best = { d: Infinity, s: 0, nx: 0, ny: 0 };
        let acc = 0;
        for (let i = 0; i + 1 < pts.length; i++) {
          const [ax, ay] = [pts[i]![0] + 0.5, pts[i]![1] + 0.5];
          const [bx, bz] = [pts[i + 1]![0] + 0.5, pts[i + 1]![1] + 0.5];
          const vx = bx - ax;
          const vy = bz - ay;
          const tt = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
          const nx = px - (ax + tt * vx);
          const ny = py - (ay + tt * vy);
          const d = Math.hypot(nx, ny);
          if (d < best.d) best = { d, s: acc + tt * lens[i]!, nx, ny };
          acc += lens[i]!;
        }
        const t = best.s / L;
        const r = 2.3 - 1.1 * t;
        if (best.d > r) continue;
        let k: string;
        if (t > 0.74) k = "D";
        else if (t > 0.46 && t < 0.58) k = "h";
        else {
          const lit = -(best.nx + best.ny) / r;
          k = lit > 0.35 ? "G" : lit < -0.45 ? "S" : "g";
        }
        if (far) k = k === "G" ? "g" : k === "g" ? "S" : k === "h" ? "G" : k;
        cv[y]![x] = k;
      }
    return cv;
  });
}

const NS: Pt = [19, 24];
const FS: Pt = [31, 23];
export type NearW = "polish" | "rest" | "chin" | "point" | "waveA" | "waveB" | "waveC";
export type FarW = "hold" | "rest" | "high" | "lift";
const NEAR: Record<NearW, readonly [Pt, Pt, Pt]> = {
  polish: [NS, [27, 31], [39, 20]],
  rest: [NS, [15, 33], [16, 42]],
  chin: [NS, [27, 30], [37, 18]],
  point: [NS, [29, 27], [44, 21]],
  waveA: [NS, [13, 21], [12, 11]],
  waveB: [NS, [12, 22], [8, 13]],
  waveC: [NS, [14, 22], [15, 13]],
};
const FAR: Record<FarW, readonly [Pt, Pt, Pt]> = {
  hold: [FS, [38, 28], [43, 23]],
  lift: [FS, [39, 26], [44, 20]],
  high: [FS, [40, 21], [44, 14]],
  rest: [FS, [35, 32], [36, 40]],
};
/** The towel's little circles round the glass. */
const CIRCLE: readonly Pt[] = [[0, 0], [1, -1], [2, 0], [1, 1]];

// ---- Poses.

export interface Pose {
  mood?: Mood;
  tilt?: number;
  /** The whole bird down this many pixels (a breath, a crouch; negative: a hop). Feet stay. */
  bob?: number;
  hx?: number;
  hy?: number;
  dx?: number;
  near?: NearW;
  far?: FarW;
  /** The towel's place in its circle round the glass. */
  tw?: number;
  /** Where the glass is: in the far wing, set down on the counter, or put away. */
  glass?: "held" | "down" | "none";
  /** The towel flicking at a raised wing's tip (0 or 1), or draped on his head. */
  flick?: number;
  drape?: boolean;
  /** Feet: lift off the ground (a hop). */
  air?: number;
}

const sh = (p: Pt, dx: number, dy: number): Pt => [p[0] + dx, p[1] + dy];

function build(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const by = p.bob ?? 0;
  const air = p.air ?? 0;
  const layers: Layer[] = [];
  const add = (pl: Placed, ox = 0, oy = 0) => layers.push({ part: pl.name, x: pl.at[0] + ox, y: pl.at[1] + oy });
  const put = (part: string, x: number, y: number) => layers.push({ part, x, y });

  const farW = p.far ?? "hold";
  const farPts = FAR[farW].map((q, i) => sh(q, dx, by + (i === 2 ? 0 : 0)));
  add(wing(farPts, true));
  put("foot", 25 + dx, 53 - air);
  put("foot", 17 + dx, 53 - air);
  add(BODY, dx, by);
  put("tie", 8 + dx, 37 + by);
  const hx = HX0 + (p.hx ?? 0) + dx;
  // (Never above its rest place: the frame's top is right there.)
  const hy = HY0 + Math.max(0, (p.hy ?? 0) + by);
  put(headName(p.mood ?? "calm", p.tilt ?? 1), hx, hy);
  if (p.drape) put("drape", hx + 2, hy + 1);
  put("bow", 28 + dx, 18 + by);

  const glass = p.glass ?? (farW === "rest" ? "none" : "held");
  const ftip = farPts[2]!;
  if (glass === "held") put("glass", ftip[0] - 3, ftip[1] - 9);
  else if (glass === "down") put("glass", 39 + dx, 17);

  const nearW = p.near ?? "polish";
  const off = nearW === "polish" ? CIRCLE[(p.tw ?? 0) % 4]! : ([0, 0] as Pt);
  const nearPts = NEAR[nearW].map((q, i) => (i === 2 ? sh(q, dx + off[0], by + off[1]) : sh(q, dx, by)));
  add(wing(nearPts, false));
  const ntip = nearPts[2]!;
  if (nearW === "polish" || nearW === "chin") put("towel", ntip[0] - 2, ntip[1] - 3);
  else if (nearW !== "rest") put(`flick${(p.flick ?? 0) % 2}`, ntip[0] - 1, ntip[1] - 2);
  return layers;
}

// ---- Little effects.

const star = (x: number, y: number, k = "Y"): Speck[] => [[x, y, "x"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
/** A glint on the glass. */
const glint = (x: number, y: number): Speck[] => [[x, y, "x"], [x - 1, y - 1, "a"], [x + 1, y + 1, "a"], [x + 1, y - 1, "a"], [x - 1, y + 1, "a"]];
const thoughts = (n: number): Speck[] =>
  ([[42, 7], [45, 4], [47, 1]] as const).slice(0, n).flatMap(([x, y], i): Speck[] => [[x, y, "w"], [x + 1, y, "w"], [x, y + 1, "W"], [x + 1, y + 1, "W"], ...(i === 2 ? ([[x - 1, y, "w"], [x + 2, y, "w"], [x, y + 2, "W"], [x + 1, y + 2, "W"], [x - 1, y + 1, "W"], [x + 2, y + 1, "W"]] as Speck[]) : [])]);
const sweat = (i: number): Speck[] => {
  const t = i % 3;
  return [[19 - t, 6 + t, "j"], [19 - t, 7 + t, "x"], [34 + t, 1 + t, "j"]];
};
/** A loose feather drifting. */
const feather = (x: number, y: number): Speck[] => [[x, y, "G"], [x + 1, y, "g"], [x + 2, y - 1, "g"]];

const FLASH: Record<string, string> = { S: "#9aa0ab", g: "#cfd3da", G: "#eef0f3", r: "#ec7a6c", R: "#c0453b", e: "#78b894" };

/** Everything is drawn two rows down from where it's laid out, for headroom. */
const OY = 1;
function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const specks = (extra.specks ?? []).map(([x, y, k]): Speck => [x, y + OY, k]).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, ...extra, layers: build(p).map((l) => ({ ...l, y: l.y + OY })), specks };
}

// ---- Animations.

/** Idle (4 s): dries a glass, the towel going round in little strokes; breathes; a slow blink; a friendly nod. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 32 }, (_, i) => {
    const blink = i === 10 || i === 13 ? "half" : i === 11 || i === 12 ? "blink" : null;
    const nod = [0, 1, 2, 1][i - 22] ?? 0;
    const mood: Mood = blink ?? (i === 23 || i === 24 ? "grin" : "calm");
    return f(125, { mood, tw: i, bob: i % 16 >= 8 ? 1 : 0, hy: nod, tilt: nod === 2 ? 2 : 1 });
  }),
};

/** Wave (1.2 s): sets the glass down, waves hello with the towel flicking, picks the glass back up. */
const wave: Anim = {
  loop: false,
  frames: [
    f(110, { mood: "calm", near: "rest", far: "rest", glass: "down" }),
    f(110, { mood: "cheer", near: "waveC", far: "rest", glass: "down", hy: -1, tilt: 0 }, { cue: "flap" }),
    f(120, { mood: "happy", near: "waveA", flick: 0, far: "rest", glass: "down", hy: -1, tilt: 0 }),
    f(120, { mood: "happy", near: "waveB", flick: 1, far: "rest", glass: "down", tilt: 1 }),
    f(120, { mood: "happy", near: "waveA", flick: 0, far: "rest", glass: "down", hy: -1, tilt: 0 }),
    f(120, { mood: "happy", near: "waveB", flick: 1, far: "rest", glass: "down", tilt: 1 }),
    f(120, { mood: "grin", near: "waveC", flick: 0, far: "rest", glass: "down", tilt: 1 }),
    f(110, { mood: "grin", near: "rest", far: "rest", glass: "down", bob: 1 }),
    f(110, { mood: "calm", near: "polish", far: "hold" }),
    f(110, { mood: "calm", near: "polish", far: "hold", tw: 1 }),
  ],
};

/** Entrance: pops up from behind the bar, glass and towel in hand, and gives a nod hello. */
const entrance: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 16, mood: "calm", near: "rest", far: "rest" }),
    f(80, { bob: 11, mood: "calm", near: "rest", far: "rest" }),
    f(80, { bob: 6, mood: "cheer", near: "polish", far: "lift" }),
    f(80, { bob: 1, mood: "cheer", near: "polish", far: "hold", hy: -1, tilt: 0 }),
    f(90, { bob: -1, air: 0, mood: "happy", near: "polish", far: "hold", hy: -1, tilt: 0 }, { cue: "flap" }),
    f(110, { mood: "grin", near: "polish", far: "hold", hy: 1, tilt: 2 }),
    f(120, { mood: "grin", near: "polish", far: "hold", hy: 2, tilt: 2 }),
    f(120, { mood: "calm", near: "polish", far: "hold", hy: 1, tw: 1 }),
    f(300, { mood: "calm", near: "polish", far: "hold", tw: 2 }),
  ],
};

/** Thinking (loops): the glass held still, towel at his chin, head tipped back, eye up, thought dots popping. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(160, { mood: i === 8 ? "thinkBlink" : "think", near: "chin", tilt: -1, hy: -1, hx: -1, bob: i % 6 >= 3 ? 1 : 0 }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** His move: a little lean and a towel flick toward the board, then back to the glass. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { mood: "bold", bob: 1, tw: 0 }),
    f(90, { mood: "bold", near: "point", flick: 0, dx: 1, hx: 1 }, { cue: "flap" }),
    f(110, { mood: "cheer", near: "point", flick: 1, dx: 1, hx: 1 }),
    f(110, { mood: "grin", near: "point", flick: 0, dx: 1 }),
    f(120, { mood: "calm", tw: 1 }),
    f(150, { mood: "calm", tw: 2 }),
  ],
};

/** A capture: two happy hops, the glass lifted, the towel flicking, a glint and twinkles. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { mood: "bold", bob: 2 }),
    f(90, { mood: "happy", bob: -2, air: 1, near: "waveA", flick: 0, far: "lift", hy: -1, tilt: 0 }, { cue: "flap", specks: [...glint(41, 13), ...star(10, 6)] }),
    f(90, { mood: "happy", bob: -1, near: "waveB", flick: 1, far: "lift", tilt: 0 }, { specks: star(46, 6, "a") }),
    f(80, { mood: "grin", bob: 2, near: "waveC", flick: 0, far: "lift" }),
    f(90, { mood: "happy", bob: -2, air: 1, near: "waveA", flick: 1, far: "lift", hy: -1, tilt: 0 }, { specks: [...glint(42, 13), ...star(7, 9, "a")] }),
    f(90, { mood: "happy", bob: -1, near: "waveB", flick: 0, far: "lift", tilt: 0 }, { specks: star(47, 4) }),
    f(100, { mood: "grin", bob: 1, near: "polish", far: "hold" }),
    f(160, { mood: "smug", near: "polish", far: "hold", tw: 1 }),
  ],
};

/** Hurt: a jolt (a flash, a feather flies), eye screwed shut, head back; then he blinks it off and smiles. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { mood: "hurt", bob: 2, hx: -2, tilt: -1, near: "rest", far: "lift" }, { cue: "poof", pal: FLASH, shake: [-1, 0], specks: feather(14, 12) }),
    f(80, { mood: "hurt", bob: 2, hx: -2, tilt: -1, near: "rest", far: "lift" }, { shake: [1, 0], specks: feather(12, 9) }),
    f(100, { mood: "hurt", bob: 1, hx: -1, tilt: 0, near: "rest", far: "lift" }, { specks: feather(10, 7) }),
    f(110, { mood: "rattled", bob: 1, hx: -1, tilt: 0, near: "polish" }, { specks: feather(9, 6) }),
    f(120, { mood: "blink", near: "polish", tw: 1 }),
    f(160, { mood: "calm", near: "polish", tw: 2 }),
  ],
};

/** Check: two brisk points of the towel at the board, eye bright. */
const check: Anim = {
  loop: false,
  frames: [
    f(100, { mood: "bold", bob: 1 }),
    f(110, { mood: "bold", near: "point", flick: 0, dx: 1, hx: 1, tilt: 0 }, { cue: "flap" }),
    f(90, { mood: "bold", near: "polish", bob: 1 }),
    f(110, { mood: "bold", near: "point", flick: 1, dx: 1, hx: 1, tilt: 0 }, { cue: "flap" }),
    f(120, { mood: "cheer", near: "point", flick: 0, dx: 1 }),
    f(160, { mood: "smug", near: "polish", tw: 1 }),
  ],
};

/** Smug: lids half down, a pleased little smile, polishing slowly; the glass gleams. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(160, { mood: "smug", tw: Math.floor(i / 2), hy: i < 4 ? -1 : 0, tilt: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0 }, { specks: i === 5 || i === 6 ? glint(40, 16) : [] })),
};

/** Rattled: wide eye, worried brow, sweat flying, polishing far too fast, trembling. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", tw: i, dx: i % 2 ? 1 : 0, bob: i % 4 === 2 ? 1 : 0, tilt: 0 }, { specks: sweat(i) })),
};

/** Defeat: a jolt, dizzy eyes, he sinks down behind the bar and his towel lands on his head (the last frame holds). */
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { mood: "hurt", bob: 2, hx: -2, tilt: -1, near: "rest", far: "lift" }, { cue: "poof", pal: FLASH, shake: [1, 0], specks: feather(13, 10) }),
    f(100, { mood: "out", bob: 2, hx: -1, tilt: 0, near: "rest", far: "rest" }, { specks: [...feather(11, 7), ...star(39, 3, "a")] }),
    f(120, { mood: "out", bob: 3, tilt: 2, hy: 1, near: "rest", far: "rest" }, { specks: star(14, 4) }),
    f(120, { mood: "out", bob: 5, tilt: 2, hy: 2, near: "rest", far: "rest" }, { specks: star(40, 6, "a") }),
    f(140, { mood: "out", bob: 6, tilt: 2, hy: 2, near: "rest", far: "rest", drape: true }, { cue: "poof" }),
    f(1000, { mood: "out", bob: 6, tilt: 2, hy: 2, near: "rest", far: "rest", drape: true }, { specks: [...star(16, 8), ...star(41, 9, "a")] }),
  ],
};

/** Victory: raises the glass in a toast, waving the towel, hopping happily; twinkles. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const hop = [0, -1, -2, -1, 0, 1][i % 6]!;
    const near: NearW = (["waveA", "waveB", "waveA", "waveC"] as const)[i % 4]!;
    return f(110, { mood: i % 6 < 4 ? "happy" : "grin", bob: hop, air: hop < -1 ? 1 : 0, near, flick: i % 2, far: "high", hy: i % 2 ? 0 : -1, tilt: i % 6 < 3 ? 0 : 1 }, { specks: i % 3 === 0 ? [...glint(41, 5), ...star(5 + (i % 4) * 3, 4 + (i % 5))] : star(46, 8 + (i % 4), "a"), cue: i === 1 ? "flap" : undefined });
  }),
};


export const SIDEKICK_BIRDIE_BARTENDER: Character = {
  id: "sidekick-birdie-bartender",
  name: "Bartender",
  w: W,
  h: H,
  foot: [24, GROUND],
  palette: PAL,
  halo: "#2b3040",
  parts: PARTS,
  anims: { idle, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
