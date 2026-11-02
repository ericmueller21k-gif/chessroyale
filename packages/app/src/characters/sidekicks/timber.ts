/**
 * Copied as drawn from the art branch `claude/boss-art` (scripts/boss-art/out/sidekick-beaver/sidekick-beaver.ts, Nov 1, 2026; Eric approved the art: "Yes,
 * both"); only the import paths changed. The run's report: scripts/boss-art/out/timber-nov1.md on that branch.
 *
 * Timber's sidekick (id "sidekick-beaver"): a little woodpecker foreman, a town bot that wanders the square and plays
 * chess at the park's tables. No powers, never fights: busy, bossy-but-friendly. A round little bird with a red crest
 * poking out behind a tiny orange hard hat (Timber's orange), black-and-white wings, a cream belly crossed by an orange
 * safety sash with a reflective stripe, one big shiny eye and a strong chisel beak. A short plank stands beside it to
 * tap on (rat-a-tat). Three-quarters, facing our right, light from the top left.
 *
 * Rigging: everything is painted in frame space at rest and placed with an offset. The head (one per mood), the body,
 * the crest (rest / flare / flat) are painted once; the hat is painted per tilt; the wings, tail and legs are painted
 * from points per pose, so a new pose is a handful of numbers.
 */
import { canvas, toGrid, type Canvas } from "../paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#140d0b", // outline
  a: "#25242f", // black feathers: dark, mid, light
  A: "#3b3a4c",
  B: "#5c5b76",
  w: "#f7f4ec", // white feathers: light, shade
  W: "#c9c2b6",
  c: "#f3e4c4", // cream belly: light, shade
  C: "#d3bd93",
  r: "#9c1820", // red crest: dark, mid, light
  R: "#de3a32",
  P: "#ff7a5c",
  o: "#b4520c", // Timber's orange (hat, sash): shadow, mid, light, highlight
  O: "#ea7816",
  L: "#ff9d3a",
  l: "#ffc77e",
  s: "#e2e7ec", // reflective stripe
  S: "#9aa4af",
  n: "#f0e4c0", // beak: light, mid, dark
  N: "#c2af84",
  m: "#7e6e50",
  M: "#7a1e1c", // inside the beak
  x: "#120a08", // eye: pupil, lower iris, shine
  X: "#5a3220",
  v: "#ffffff",
  q: "#f2909a", // blush
  g: "#a29bb0", // legs and feet
  G: "#686378",
  H: "#f6d38e", // wood: light, mid, shade, grain
  h: "#e0aa5c",
  j: "#b47b36",
  J: "#7e5222",
  Y: "#ffd23a", // twinkles
  y: "#fff7b8",
  i: "#7fd3ff", // sweat
  d: "#9a8a72", // dust
  D: "#c4b598",
  z: "#0d0e12", // ground shadow
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;

const W = 64;
const H = 64;
const GROUND = 61;

const PARTS: Record<string, Part> = {};
interface Painted {
  part: Part;
  at: Pt;
}
const PAINTED = new Map<string, Painted>();
function painted(name: string, make: () => Painted): Painted & { name: string } {
  let p = PAINTED.get(name);
  if (!p) {
    p = make();
    PAINTED.set(name, p);
    PARTS[name] = p.part;
  }
  return { ...p, name };
}
function crop(cv: Canvas): Painted {
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
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

// ---- Painting helpers (pixel-center coordinates: an integer is the middle of that pixel).

const ell = (cx: number, cy: number, rx: number, ry: number): Inside => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => 0.52 + bias - 0.45 * ((x - cx) / rx) - 0.55 * ((y - cy) / ry);
function paint(cv: Canvas, inside: Inside, key: (x: number, y: number) => string): void {
  for (let y = 0; y < cv.length; y++) for (let x = 0; x < cv[0]!.length; x++) if (inside(x, y)) cv[y]![x] = key(x, y);
}
function inPoly(pts: readonly Pt[]): Inside {
  return (x, y) => {
    let inside = false;
    pts.forEach(([x0, y0], i) => {
      const [x1, y1] = pts[(i + 1) % pts.length]!;
      if (y0 <= y !== y1 <= y && x < x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)) inside = !inside;
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
function dots(cv: Canvas, pts: readonly Pt[], k: string): void {
  for (const [x, y] of pts) if (cv[y]?.[x] !== undefined) cv[y]![x] = k;
}
const blackT = (l: number) => (l < 0.3 ? "a" : l < 0.78 ? "A" : "B");
const orangeT = (l: number) => (l < 0.28 ? "o" : l < 0.62 ? "O" : l < 0.9 ? "L" : "l");
const redT = (l: number) => (l < 0.32 ? "r" : l < 0.78 ? "R" : "P");

/** A tapered stroke from S (radius r0) to T (radius r1): inside, how far along, and the offset from the axis. */
function taper(S: Pt, T: Pt, r0: number, r1: number) {
  const vx = T[0] - S[0];
  const vy = T[1] - S[1];
  const L2 = vx * vx + vy * vy || 1;
  return (x: number, y: number) => {
    const t = Math.max(0, Math.min(1, ((x - S[0]) * vx + (y - S[1]) * vy) / L2));
    const nx = x - (S[0] + t * vx);
    const ny = y - (S[1] + t * vy);
    const r = r0 + (r1 - r0) * t;
    return { inside: Math.hypot(nx, ny) <= r, t, nx, ny, r };
  };
}

// ---- The head: one per mood. Black back of the head, a white face, a big shiny eye, the chisel beak.

export type Mood = "calm" | "blink" | "happy" | "cheer" | "focus" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold" | "half";
type Eye = "open" | "bold" | "half" | "shut" | "arc" | "wide" | "up" | "pinch" | "x" | "sleepy";
type Beak = "shut" | "smile" | "open" | "o";

const EYES: Record<Eye, readonly string[]> = {
  open: [".kkkk.", "kvvxxk", "kvxxxk", "kxxxXk", "kxxXXk", ".kkkk."],
  bold: ["kk....", "kkkkk.", "kvxkkk", "kxxxXk", "kxxXXk", ".kkkk."],
  half: ["......", "......", "kkkkkk", "kvxxXk", ".kkkk.", "......"],
  sleepy: ["......", "kkkkkk", "kkkkkk", "kvxxXk", "kxxXXk", ".kkkk."],
  shut: ["......", "......", "......", "kkkkkk", ".k..k.", "......"],
  arc: ["......", ".kkkk.", "kk..kk", "k....k", "......", "......"],
  wide: [".kkkk.", "kvvvvk", "kvvxxk", "kvvxxk", "kvvvvk", ".kkkk."],
  up: [".kkkk.", "kxxvxk", "kxxxxk", "kvvvvk", "kvvvvk", ".kkkk."],
  pinch: ["kk....", ".kkk..", "...kkk", ".kkk..", "kk....", "......"],
  x: ["k....k", ".k..k.", "..kk..", "..kk..", ".k..k.", "k....k"],
};
const FACES: Record<Mood, { eye: Eye; beak: Beak; blush?: boolean }> = {
  calm: { eye: "open", beak: "smile", blush: true },
  blink: { eye: "shut", beak: "smile", blush: true },
  half: { eye: "sleepy", beak: "smile", blush: true },
  happy: { eye: "arc", beak: "open", blush: true },
  cheer: { eye: "open", beak: "open", blush: true },
  focus: { eye: "bold", beak: "shut" },
  think: { eye: "up", beak: "shut" },
  thinkBlink: { eye: "shut", beak: "shut" },
  smug: { eye: "half", beak: "smile", blush: true },
  rattled: { eye: "wide", beak: "o" },
  hurt: { eye: "pinch", beak: "o" },
  out: { eye: "x", beak: "o" },
  bold: { eye: "bold", beak: "open" },
};

function headPart(mood: Mood): Painted {
  const cv = canvas(W, H);
  const skull = ell(30, 29, 9.5, 8.5);
  const L = roundL(30, 29, 9.5, 8.5, 0.05);
  paint(cv, skull, (x, y) => blackT(L(x, y)));
  // The white face, and a white cheek stripe running back through the black.
  const face = ell(35, 30.5, 6.8, 7);
  paint(cv, (x, y) => skull(x, y) && face(x, y), (x, y) => (L(x, y) < 0.12 ? "W" : "w"));
  for (let x = 22; x <= 29; x++) {
    if (skull(x, 32)) cv[32]![x] = "w";
    if (skull(x, 33)) cv[33]![x] = "W";
  }
  const f = FACES[mood];
  // The beak: a strong chisel pointing our right.
  if (f.beak === "open" || f.beak === "o") {
    const wide = f.beak === "open";
    paint(cv, inPoly([[37.5, 29.5], [wide ? 44 : 42, 31.5], [37.5, 34]]), () => "M");
    const up = inPoly([[37.5, 27.6], [wide ? 47 : 46.6, wide ? 29 : 29.6], [37.5, 30.9]]);
    paint(cv, up, (x, y) => (!up(x, y - 1) ? "n" : "N"));
    const lo = wide ? inPoly([[37.5, 32.4], [44.5, 34.4], [37.5, 35.2]]) : inPoly([[37.5, 31.8], [43.5, 32.6], [37.5, 34.3]]);
    paint(cv, lo, () => "m");
  } else {
    const beak = inPoly([[37.5, 28.4], [47.6, 30.6], [37.5, 33.3]]);
    paint(cv, beak, (x, y) => (y <= 29 ? "n" : y === 30 ? "N" : "m"));
    if (f.beak === "smile") dots(cv, [[37, 30], [38, 31], [39, 31]], "k");
    else dots(cv, [[38, 31], [39, 31]], "k");
  }
  stamp(cv, EYES[f.eye], 29, 24);
  if (f.blush) dots(cv, [[31, 31], [32, 31]], "q");
  return crop(cv);
}
const MOODS: readonly Mood[] = ["calm", "blink", "half", "happy", "cheer", "focus", "think", "thinkBlink", "smug", "rattled", "hurt", "out", "bold"];
for (const m of MOODS) painted(`head:${m}`, () => headPart(m));

/** The red crest at the back of the head, poking out from under the hat. */
type Crest = "rest" | "flare" | "flat";
const CREST_PTS: Record<Crest, readonly Pt[]> = {
  rest: [[27, 20], [21, 18], [15.5, 15.5], [19, 20.5], [13.5, 21], [19.5, 23.5], [15.5, 26.5], [22, 26.5], [26.5, 26]],
  flare: [[27, 20], [24, 11], [21.5, 17.5], [16.5, 11.5], [19.5, 20], [13, 16.5], [18.5, 23], [14, 24.5], [22, 26.5], [26.5, 26]],
  flat: [[27, 20], [20, 20], [13.5, 22.5], [19, 23], [14.5, 26.5], [20, 26], [17.5, 29], [23, 27.5], [26.5, 26]],
};
for (const c of ["rest", "flare", "flat"] as const)
  painted(`crest:${c}`, () => {
    const cv = canvas(W, H);
    const L = roundL(22, 20, 7, 7);
    paint(cv, inPoly(CREST_PTS[c]), (x, y) => redT(L(x, y)));
    return crop(cv);
  });

/** The tiny hard hat, painted per tilt (degrees, clockwise) about the middle of its brim. */
function hatPart(tilt: number): Painted & { name: string } {
  return painted(`hat:${tilt}`, () => {
    const cv = canvas(W, H);
    const px = 30.5;
    const py = 19.5;
    const a = (tilt * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const dx = x - px;
        const dy = y - py;
        const u = c * dx + s * dy;
        const v = -s * dx + c * dy;
        if (v <= 0 && (u / 9.6) ** 2 + (v / 7.2) ** 2 <= 1) {
          let l = 0.62 - 0.42 * (u / 9.6) - 0.45 * ((v + 3.5) / 3.6);
          if (Math.abs(u - 1) <= 0.9 && v < -1) l += 0.35;
          if (Math.abs(u - 2.5) <= 0.5 && v < -1) l -= 0.3;
          cv[y]![x] = orangeT(l);
        } else if (v > 0 && v <= 2.2 && u >= -10.8 && u <= 12.8) {
          cv[y]![x] = v <= 1.1 ? (u < 4 ? "l" : "L") : "o";
        }
      }
    return crop(cv);
  });
}

// ---- The body: black back, cream belly, an orange safety sash with a reflective stripe.

const BODY_PART = painted("body", () => {
  const cv = canvas(W, H);
  const body = ell(27.5, 46, 11.5, 9.6);
  const L = roundL(27.5, 46, 11.5, 9.6);
  paint(cv, body, (x, y) => blackT(L(x, y)));
  const belly = ell(32.5, 48, 7.8, 8.2);
  paint(cv, (x, y) => body(x, y) && belly(x, y), (x, y) => (L(x, y) < 0.22 ? "C" : "c"));
  // The sash, from the far shoulder down across the belly.
  const sash = taper([21, 36], [39, 55], 2.2, 2.2);
  paint(cv, (x, y) => body(x, y) && sash(x, y).inside, (x, y) => {
    const q = sash(x, y);
    const off = q.nx * 0.7 - q.ny * 0.7;
    return Math.abs(off) < 0.5 ? (L(x, y) < 0.25 ? "S" : "s") : orangeT(L(x, y) + 0.15);
  });
  return crop(cv);
});

// ---- Wings, tail, legs: painted from points.

/** A wing: a black teardrop from the shoulder to the tip, a lit leading edge, rows of white spots. */
function wingPart(S: Pt, T: Pt, far: boolean): Painted & { name: string } {
  return painted(`wing:${far ? 1 : 0}:${S}:${T}`, () => {
    const cv = canvas(W, H);
    const r0 = 3.7;
    const tp = taper(S, T, r0, 1.1);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const q = tp(x, y);
        if (!q.inside) continue;
        const l = 0.5 - 0.5 * ((0.6 * q.nx + 0.8 * q.ny) / Math.max(q.r, 1)) + 0.15 * (1 - q.t);
        let k = l > 0.78 ? "B" : l > 0.36 ? "A" : "a";
        if (far) k = k === "B" ? "A" : "a";
        cv[y]![x] = k;
      }
    const len = Math.hypot(T[0] - S[0], T[1] - S[1]);
    const ux = (T[0] - S[0]) / len;
    const uy = (T[1] - S[1]) / len;
    for (const t of [0.4, 0.6, 0.8]) {
      const r = r0 + (1.1 - r0) * t;
      for (const side of t > 0.7 ? [0] : [-1, 1]) {
        const X = Math.round(S[0] + ux * len * t - uy * side * r * 0.5);
        const Y = Math.round(S[1] + uy * len * t + ux * side * r * 0.5);
        if (cv[Y]?.[X] && cv[Y]![X] !== ".") cv[Y]![X] = far ? "W" : "w";
      }
    }
    return crop(cv);
  });
}

/** The stiff tail feathers, from the rump down and back. */
function tailPart(S: Pt, T: Pt): Painted & { name: string } {
  return painted(`tail:${S}:${T}`, () => {
    const cv = canvas(W, H);
    const tp = taper(S, T, 2.6, 1.9);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const q = tp(x, y);
        if (!q.inside) continue;
        const l = 0.5 - 0.5 * ((0.6 * q.nx + 0.8 * q.ny) / q.r);
        cv[y]![x] = l > 0.8 ? "B" : l > 0.35 ? "A" : "a";
      }
    return crop(cv);
  });
}

/** A thin bird leg (2 px) from hip to ankle. */
function legPart(hip: Pt, ankle: Pt, near: boolean): Painted & { name: string } {
  return painted(`leg:${near ? 1 : 0}:${hip}:${ankle}`, () => {
    const cv = canvas(W, H);
    const tp = taper([hip[0] + 0.5, hip[1]], [ankle[0] + 0.5, ankle[1]], 1, 1);
    paint(cv, (x, y) => tp(x, y).inside, (x, y) => (near ? (tp(x, y).nx < 0 ? "g" : "G") : "G"));
    return crop(cv);
  });
}

PARTS["foot"] = { grid: ["Gggggg"] };
PARTS["footF"] = { grid: ["GGGGGG"] };
PARTS["toes"] = { grid: ["g.g", "g.g", "ggG"] };
PARTS["toesF"] = { grid: ["G.G", "G.G", "GGG", "GGG"] };
PARTS["shadow"] = (() => {
  const cv = canvas(30, 3);
  paint(cv, ell(14.5, 1, 15, 1.6), () => "z");
  return { grid: toGrid(cv), outline: false };
})();

/** The plank it taps on: standing on end, lit from the left, a few grain lines and peck marks near the top. */
const PLANK_H = 34;
PARTS["plank"] = {
  grid: Array.from({ length: PLANK_H }, (_, y) => {
    if (y === 0) return "HHHHh";
    const row = ["H", "h", "h", "h", "j"];
    if (y >= 9 && y <= 13) row[2] = "j";
    if (y >= 18 && y <= 23) row[3] = "j";
    if (y >= 26 && y <= 29) row[1] = "j";
    if (y === 4 || y === 6) row[1] = "J";
    if (y === 5) row[2] = "J";
    if (y === PLANK_H - 1) row[4] = "J";
    return row.join("");
  }),
};
PARTS["stool"] = {
  grid: [
    "HHHHHHHHHHHHHHHHHHHHHHHH",
    "hhhhhhhhhhhhhhhhhhhhhhhh",
    "jjjjjjjjjjjjjjjjjjjjjjjj",
    "..hj................hj..",
    "..hj................hj..",
    "..hj................hj..",
    "..hj................hj..",
    "..hJJJJJJJJJJJJJJJJJJj..",
    "..hj................hj..",
    "..hj................hj..",
    "..hj................hj..",
    "..hj................hj..",
    "..hj................hj..",
  ],
};

// ---- Poses.

type WingName = "fold" | "waveA" | "waveB" | "point" | "pointUp" | "up" | "hat" | "chin" | "flail" | "tuck" | "droop" | "hip";
/** Wing tips, relative to the shoulder. */
const WINGS: Record<WingName, Pt> = {
  fold: [-8, 11],
  tuck: [-7, 11],
  droop: [-10, 13],
  waveA: [-13, -7],
  waveB: [-11, -13],
  up: [-9, -16],
  point: [19, -3],
  pointUp: [17, -10],
  hat: [-9, -19],
  chin: [12, -8],
  flail: [-13, -3],
  hip: [-11, 8],
};
const FAR_WINGS: Partial<Record<WingName, Pt>> = {
  up: [16, -18],
  waveA: [18, -11],
  waveB: [17, -15],
  flail: [12, -5],
};

export interface Pose {
  mood?: Mood;
  /** The body and head down this many pixels (a breath, a crouch). */
  bob?: number;
  air?: number;
  dx?: number;
  /** The head on the body. */
  hx?: number;
  hy?: number;
  wing?: WingName;
  /** The far wing, raised behind the body (wave, victory). */
  far?: WingName | null;
  /** The tail tip: up (+) or down (-). */
  tail?: number;
  hat?: { dx?: number; dy?: number; tilt?: number };
  crest?: Crest;
  feet?: { n?: { x?: number; lift?: number }; f?: { x?: number; lift?: number } };
  plank?: boolean;
  sit?: boolean;
  /** Plopped on the ground (defeat). */
  plop?: boolean;
  noShadow?: boolean;
}

function build(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const sit = p.sit ?? false;
  const plop = p.plop ?? false;
  const by = (p.bob ?? 0) - air + (sit ? -7 : 0) + (plop ? 5 : 0);
  const layers: Layer[] = [];
  const add = (l: { name: string; at: Pt }, ox = 0, oy = 0) => layers.push({ part: l.name, x: l.at[0] + ox, y: l.at[1] + oy });
  const put = (part: string, x: number, y: number) => layers.push({ part, x, y });

  if (!p.noShadow) put("shadow", 12 + dx, GROUND - 2);
  if (sit) put("stool", 15 + dx, 48);
  if (p.plank ?? !sit) put("plank", 49, GROUND - PLANK_H);

  // The tail.
  const tl = p.tail ?? 0;
  const tipY = plop ? 59 : Math.min(59, 59 + by - tl * 2);
  add(tailPart([19 + dx, 50 + by], sit ? [9 + dx, 49 + by - tl] : [plop ? 7 + dx : 11 + dx - Math.abs(tl), tipY]));

  // The far wing, behind everything else of the body.
  const sh: Pt = [24 + dx, 41 + by];
  const farSh: Pt = [30 + dx, 40 + by];
  if (p.far) {
    const t = FAR_WINGS[p.far] ?? FAR_WINGS.up!;
    add(wingPart(farSh, [farSh[0] + t[0], farSh[1] + t[1]], true));
  }

  // Legs.
  const fx = (k: "n" | "f") => p.feet?.[k]?.x ?? 0;
  const lift = (k: "n" | "f") => p.feet?.[k]?.lift ?? 0;
  if (sit) {
    const sb = p.bob ?? 0;
    add(legPart([27 + dx, 46 + sb], [32 + dx + fx("f"), 53 - lift("f")], false));
    put("footF", 31 + dx + fx("f"), 54 - lift("f"));
  } else if (plop) {
    add(legPart([28 + dx, 57], [36 + dx, 58], false));
    put("toesF", 36 + dx, 55);
  } else {
    const a: Pt = [24 + dx + fx("f"), 59 - air - lift("f")];
    add(legPart([25 + dx, 54 + by], a, false));
    put("footF", a[0] - 1, a[1] + 1);
  }

  add(BODY_PART, dx, by);

  if (sit) {
    const sb = p.bob ?? 0;
    add(legPart([31 + dx, 46 + sb], [36 + dx + fx("n"), 54 - lift("n")], true));
    put("foot", 35 + dx + fx("n"), 55 - lift("n"));
  } else if (plop) {
    add(legPart([31 + dx, 58], [40 + dx, 58], true));
    put("toes", 40 + dx, 56);
  } else {
    const a: Pt = [30 + dx + fx("n"), 59 - air - lift("n")];
    add(legPart([30 + dx, 54 + by], a, true));
    put("foot", a[0] - 1, a[1] + 1);
  }

  // Crest, head, hat.
  const hx = (p.hx ?? 0) + dx;
  const hy = (p.hy ?? 0) + by;
  add(painted(`crest:${p.crest ?? "rest"}`, () => ({ part: { grid: ["."] }, at: [0, 0] })), hx, hy);
  add(painted(`head:${p.mood ?? "calm"}`, () => headPart(p.mood ?? "calm")), hx, hy);
  const ht = p.hat ?? {};
  add(hatPart(ht.tilt ?? 0), hx + (ht.dx ?? 0), hy + (ht.dy ?? 0));

  // The near wing, in front.
  const t = WINGS[p.wing ?? "fold"];
  add(wingPart(sh, [sh[0] + t[0], Math.min(59, sh[1] + t[1])], false));
  return layers;
}

// ---- Little effects.

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}
/** Wood chips flying off the plank where the beak hits. */
function chips(seed: number, n = 4): Speck[] {
  const rnd = seeded(seed + 11);
  return Array.from({ length: n }, (_, i): Speck => {
    const a = -Math.PI * (0.15 + rnd() * 0.7);
    const d = 4 + rnd() * 4;
    return [Math.round(51 + Math.cos(a) * d * 1.3), Math.round(29 + Math.sin(a) * d), i % 2 ? "H" : "h"];
  });
}
const star = (x: number, y: number, k = "Y"): Speck[] => [[x, y, "y"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
function twinkles(t: number, n = 3, box: readonly [number, number, number, number] = [6, 4, 56, 40]): Speck[] {
  const rnd = seeded(t * 31 + 5);
  return Array.from({ length: n }, () => star(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])))).flat();
}
/** Sawdust confetti. */
function sawdust(t: number, n = 8): Speck[] {
  const rnd = seeded(t * 17 + 3);
  return Array.from({ length: n }, (_, i): Speck => [Math.round(4 + rnd() * 54), Math.round(2 + ((rnd() * 30 + t * 3) % 34)), ["H", "h", "O", "R"][i % 4]!]);
}
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) => [0, 1, 2].map((i): Speck => [Math.round(27 + side * (10 + i * 3 + t * 2)), GROUND - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "d" : "D"]));
const dropShadow = (r: number): Speck[] => Array.from({ length: r * 2 + 1 }, (_, i): Speck => [27 - r + i, GROUND - 1, "z"]);
const thoughts = (n: number): Speck[] =>
  ([[47, 15], [51, 11], [56, 6]] as const).slice(0, n).flatMap(([x, y], k): Speck[] => {
    const big = k === 2;
    return [[x, y, "w"], [x + 1, y, "w"], [x, y + 1, "w"], [x + 1, y + 1, "W"], ...(big ? ([[x - 1, y, "w"], [x + 2, y, "w"], [x, y - 1, "w"], [x + 1, y - 1, "w"], [x - 1, y + 1, "W"], [x + 2, y + 1, "W"], [x, y + 2, "W"], [x + 1, y + 2, "W"]] as Speck[]) : [])];
  });
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[15 - t, 24 + t, "i"], [15 - t, 25 + t, "v"], [46 + t, 13 + t, "i"], [46 + t, 14 + t, "v"]];
};
/** Dizzy stars circling over the head. */
function dizzy(t: number, cx = 30, cy = 12): Speck[] {
  return [0, 1, 2].flatMap((i) => {
    const a = t * 0.9 + (i * Math.PI * 2) / 3;
    return star(Math.round(cx + Math.cos(a) * 9), Math.round(cy + Math.sin(a) * 2.5), i === 1 ? "R" : "Y");
  });
}
/** Little shout lines off the beak tip (giving orders). */
const shout = (dx = 0): Speck[] => [[43 + dx, 23, "y"], [44 + dx, 22, "y"], [46 + dx, 24, "y"], [47 + dx, 23, "y"], [49 + dx, 25, "y"], [50 + dx, 24, "y"]];

const FLASH: Record<string, string> = { a: "#6a6980", A: "#8a89a2", B: "#b0afc8", w: "#ffffff", W: "#f0ece4", c: "#fff6e4", C: "#f3e4c4", R: "#ff7a6a", O: "#ffb060" };

function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const specks = (extra.specks ?? []).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: build(p), ...extra, specks };
}

// ---- Animations.

/** Idle (~3 s): breathes and blinks, leans in and taps rat-a-tat on its plank (chips fly, the hat jiggles askew),
 * nods, satisfied, and pushes the hat straight with a wing tip. */
const idle: Anim = {
  loop: true,
  frames: [
    ...[0, 0, 1, 1, 0, 0].map((bob, i) => f(110, { bob, mood: i === 4 ? "blink" : "calm" })),
    f(120, { hx: 1, mood: "focus" }),
    f(60, { hx: 3, mood: "focus" }, { cue: "tap", specks: chips(0) }),
    f(60, { hx: 1, mood: "focus" }),
    f(60, { hx: 3, mood: "focus", hat: { tilt: 6 } }, { cue: "tap", specks: chips(1) }),
    f(60, { hx: 1, mood: "focus", hat: { tilt: 6 } }),
    f(60, { hx: 3, mood: "focus", hat: { tilt: 10 } }, { cue: "tap", specks: chips(2) }),
    f(120, { hy: 1, mood: "happy", hat: { tilt: 10 } }),
    f(120, { mood: "happy", hat: { tilt: 10 } }),
    f(120, { hy: 1, mood: "happy", hat: { tilt: 10 } }),
    f(140, { mood: "calm", wing: "hat", hat: { tilt: 10 } }),
    f(140, { mood: "calm", wing: "hat", hat: { dy: -1 } }),
    f(140, { mood: "calm", wing: "fold" }),
    ...[0, 0, 1, 1, 0, 0, 1, 1, 0, 0].map((bob, i) => f(120, { bob, mood: i === 6 ? "blink" : "calm", tail: i === 2 ? 1 : i === 3 ? -1 : 0 })),
  ],
};

/** Walk (0.6 s): quick little hop-steps, the head bobbing forward, the tail flicking. */
const walk: Anim = {
  loop: true,
  frames: [
    f(100, { plank: false, air: 1, hx: 2, feet: { n: { x: 3, lift: 3 }, f: { x: -2 } }, tail: 1, wing: "tuck" }),
    f(100, { plank: false, bob: 1, hx: 1, feet: { n: { x: 2 }, f: { x: -1 } }, tail: -1 }, { cue: "step" }),
    f(100, { plank: false, bob: 0, hx: 0, tail: 0 }),
    f(100, { plank: false, air: 1, hx: 2, feet: { f: { x: 3, lift: 3 }, n: { x: -2 } }, tail: 1, wing: "tuck" }),
    f(100, { plank: false, bob: 1, hx: 1, feet: { f: { x: 2 }, n: { x: -1 } }, tail: -1 }, { cue: "step" }),
    f(100, { plank: false, bob: 0, hx: 0, tail: 0 }),
  ],
};

/** Sit (loops): perched on a stool facing the board, feet dangling and swinging, a slow blink, a thoughtful peck at the air. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const mood: Mood = i === 4 || i === 6 ? "half" : i === 5 ? "blink" : i >= 10 && i <= 12 ? "focus" : "calm";
    const swing = i % 4 < 2 ? 0 : 1;
    const hx = i === 11 ? 2 : i === 10 || i === 12 ? 1 : 0;
    return f(i === 11 ? 120 : 200, { sit: true, wing: "tuck", mood, hx, bob: i % 8 >= 4 ? 1 : 0, feet: { n: { x: swing ? 1 : -1 }, f: { x: swing ? -1 : 1 } } }, i === 11 ? { cue: "tap" } : {});
  }),
};

/** Wave (1.2 s): a happy wing wave with the hat wobbling, a rat-a-tat hello peck at the air, back to idle. */
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "happy", wing: "waveA" }),
    f(110, { mood: "cheer", wing: "waveB", hat: { dy: -1, tilt: 6 }, crest: "flare" }),
    f(110, { mood: "happy", wing: "waveA", hat: { tilt: -6 } }),
    f(110, { mood: "cheer", wing: "waveB", hat: { dy: -1, tilt: 6 }, crest: "flare" }),
    f(110, { mood: "happy", wing: "waveA", hat: { tilt: -6 } }),
    f(70, { hx: 2, mood: "focus", wing: "waveB" }, { cue: "tap" }),
    f(70, { hx: 0, mood: "focus", wing: "waveB" }),
    f(70, { hx: 2, mood: "focus", wing: "waveB" }, { cue: "tap" }),
    f(70, { hx: 0, mood: "focus", wing: "waveB" }),
    f(140, { mood: "happy", wing: "hat" }),
    f(160, { mood: "calm", wing: "fold" }),
  ],
};

/** Entrance: drops in on its shadow, lands with a squash and dust, the hat lands a beat later, a salute. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: dropShadow(4) },
    { ms: 80, layers: [], specks: dropShadow(8) },
    f(70, { air: 6, mood: "cheer", wing: "waveA", far: "waveA", feet: { n: { lift: 1 }, f: { lift: 1 } }, hat: { dy: -4 }, crest: "flare" }, { specks: dropShadow(11) }),
    f(70, { air: 3, mood: "cheer", wing: "waveB", far: "waveB", hat: { dy: -7 }, crest: "flare" }),
    f(100, { bob: 2, mood: "blink", wing: "flail", hat: { dy: -6, tilt: -8 } }, { cue: "step", specks: dust(0) }),
    f(90, { bob: 1, mood: "rattled", wing: "fold", hat: { dy: -3, tilt: -4 } }, { specks: dust(1) }),
    f(90, { bob: 1, mood: "blink", hat: { dy: 1 } }, { cue: "tap", specks: dust(2) }),
    f(130, { mood: "happy", wing: "hat" }),
    f(160, { mood: "cheer", wing: "hat", hat: { dy: -1 } }, { specks: twinkles(1, 2) }),
    f(300, { mood: "calm" }),
  ],
};

/** Thinking (loops): eyes up, a wing tip on its chin, a foot tapping, thought dots. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", wing: "chin", hy: -1, bob: i % 6 >= 3 ? 1 : 0, feet: { n: i % 4 === 1 ? { lift: 2, x: 1 } : {} }, tail: i % 6 < 3 ? 1 : 0, hat: { tilt: -4 } }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a wing points at the board (orders!), a hop toward it, a nod. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "focus" }),
    f(80, { air: 3, mood: "bold", wing: "pointUp", feet: { n: { lift: 1 }, f: { lift: 1 } } }, { cue: "step" }),
    f(80, { air: 4, mood: "bold", wing: "point", hat: { dy: -1 } }, { specks: shout(0) }),
    f(110, { bob: 2, mood: "bold", wing: "point" }, { specks: [...dust(0), ...shout(1)] }),
    f(140, { bob: 1, mood: "calm", wing: "point" }),
    f(110, { hy: 1, mood: "happy" }),
    f(150, { mood: "calm" }),
  ],
};

/** A capture: a furious rat-a-tat on the plank, chips everywhere, then a proud little hop. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { hx: 1, mood: "focus", crest: "flare" }),
    ...Array.from({ length: 8 }, (_, i) => f(55, { hx: i % 2 ? 1 : 3, mood: "focus", crest: "flare", hat: { tilt: i >= 4 ? 8 : 0 } }, i % 2 ? { specks: chips(i, 2) } : { cue: "tap", specks: chips(i, 6) })),
    f(90, { bob: 2, mood: "happy", hat: { tilt: 8 } }),
    f(90, { air: 5, mood: "cheer", wing: "up", far: "up", feet: { n: { lift: 1 }, f: { lift: 1 } }, hat: { dy: -2 } }, { specks: twinkles(2) }),
    f(90, { air: 3, mood: "happy", wing: "waveA", far: "waveA", hat: { dy: -1 } }, { specks: twinkles(3) }),
    f(100, { bob: 2, mood: "happy" }, { specks: dust(0) }),
    f(160, { mood: "smug", crest: "flare" }),
  ],
};

/** Hurt: a flash, eyes screwed shut, the hat pops up and lands askew; it shakes it off and puts the hat straight. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, hx: -1, mood: "hurt", wing: "flail", crest: "flare", hat: { dy: -4 } }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(80, { bob: 3, dx: -1, mood: "hurt", wing: "flail", crest: "flare", hat: { dy: -3, tilt: -10 } }, { shake: [-1, 0], specks: sweat(0) }),
    f(90, { bob: 2, dx: -1, mood: "rattled", wing: "fold", hat: { tilt: -10 } }, { specks: sweat(1) }),
    f(110, { bob: 1, mood: "rattled", hat: { tilt: -10 } }),
    f(120, { mood: "blink", wing: "hat", hat: { tilt: -10 } }),
    f(120, { mood: "focus", wing: "hat" }),
    f(160, { mood: "calm" }),
  ],
};

/** Check: points at the board twice like giving orders, beak open, shout lines. */
const check: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 1, mood: "focus", wing: "pointUp" }),
    f(120, { bob: 1, hx: 1, mood: "bold", wing: "point", crest: "flare", hat: { tilt: 4 } }, { cue: "tap", specks: shout(0) }),
    f(90, { mood: "focus", wing: "pointUp" }),
    f(120, { bob: 1, hx: 1, mood: "bold", wing: "point", crest: "flare", hat: { tilt: 4 } }, { cue: "tap", specks: shout(1) }),
    f(150, { hx: 1, mood: "bold", wing: "point", crest: "flare" }),
    f(170, { mood: "smug", wing: "hip", crest: "flare" }),
  ],
};

/** Smug: crest flared, chin up, eyes half shut, a wing on its hip, a slow nod. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: i === 6 ? "blink" : "smug", wing: "hip", crest: "flare", hy: i < 3 || i > 5 ? -1 : 0, hx: -1, bob: i % 4 === 2 ? 1 : 0, hat: { tilt: -5 } })),
};

/** Rattled: wide eyes, crest flat, sweat flying, trembling, the hat rattling on its head. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", wing: i % 2 ? "flail" : "hip", crest: "flat", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, hat: { tilt: i % 2 ? 6 : -6, dy: i % 4 === 0 ? -1 : 0 } }, { specks: sweat(i) })),
};

/** Defeat: a flash, the hat slides down over its eyes, it wobbles and plops down, stars circling (the last frame holds). */
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", wing: "flail", crest: "flare", hat: { dy: -4 } }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(110, { bob: 1, hx: -1, mood: "out", wing: "droop", crest: "flat", hat: { dy: 1, tilt: -8 } }),
    f(120, { bob: 1, dx: 1, mood: "out", wing: "droop", crest: "flat", hat: { dy: 4 } }, { specks: dizzy(0, 31, 13) }),
    f(120, { bob: 2, dx: -1, mood: "out", wing: "droop", crest: "flat", hat: { dy: 5 } }, { specks: dizzy(1, 29, 14) }),
    f(140, { plop: true, mood: "out", wing: "droop", crest: "flat", hat: { dy: 5 }, plank: true }, { cue: "poof", shake: [1, 0], specks: [...dust(0), ...dizzy(2, 30, 18)] }),
    f(180, { plop: true, mood: "out", wing: "droop", crest: "flat", hat: { dy: 5, tilt: 4 } }, { specks: dizzy(3, 30, 18) }),
    f(180, { plop: true, mood: "out", wing: "droop", crest: "flat", hat: { dy: 5 } }, { specks: dizzy(4, 30, 18) }),
    f(1000, { plop: true, mood: "out", wing: "droop", crest: "flat", hat: { dy: 5, tilt: 4 } }, { specks: dizzy(5, 30, 18) }),
  ],
};

/** Victory: hopping with joy, both wings up, the hat bouncing, sawdust confetti. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 5, 6, 5, 3, 0, 0, 3, 5, 3, 0][i]!;
    const wings: WingName[] = ["up", "waveA", "waveB", "up", "waveB", "waveA", "up", "up", "waveA", "waveB", "waveA", "up"];
    return f(100, { bob: air === 0 ? 2 : 0, air, mood: air > 2 ? "happy" : "cheer", wing: wings[i]!, far: wings[i]!, crest: "flare", feet: air > 2 ? { n: { lift: 1 }, f: { lift: 1 } } : {}, hat: { dy: air >= 5 ? -2 : air > 0 ? -1 : 0, tilt: i % 4 < 2 ? 5 : -5 }, tail: air > 3 ? 1 : 0 }, { specks: sawdust(i), cue: i === 1 || i === 8 ? "tap" : undefined });
  }),
};

export const sidekickBeaver: Character = {
  id: "sidekick-beaver",
  name: "Timber's sidekick",
  w: W,
  h: H,
  foot: [27, GROUND],
  palette: PALETTE,
  halo: "#2e2218",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
