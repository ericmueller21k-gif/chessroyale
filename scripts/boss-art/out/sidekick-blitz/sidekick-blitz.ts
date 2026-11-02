/**
 * Blitz's sidekick (id "sidekick-blitz"): a tiny, very slow tortoise, a town bot that plods round the square and plays
 * chess at the park's tables. No powers, never fights. The joke: Blitz is fast, his buddy is not.
 *
 * A round domed shell of chunky plates, Blitz's white chess clock (two faces with ticks only, two buttons, the red flag)
 * strapped on top with orange straps, a teal-and-orange sweatband, a wrinkly head on a stretchy neck, heavy sleepy lids,
 * a deadpan flat mouth and four stubby feet. Three-quarters, facing our right, light from the top left.
 *
 * Rigging: the shell, the clock, its buttons and flag, and the head (one per face) are painted once; the neck, the legs
 * and the waving foot are painted from points per pose, so a pose is a handful of numbers.
 */
import { canvas, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#1a1210", // outline
  a: "#3b2a12", // shell: seams, dark to light
  b: "#6b4b20",
  c: "#93702e",
  d: "#bf9a44",
  e: "#e2c271",
  v: "#4a6136", // skin: dark to light
  w: "#6e8a4a",
  W: "#97b065",
  V: "#c3d68f",
  u: "#ecdca0", // belly plates, toenails
  U: "#bfa766",
  t: "#f6f1e2", // eye white
  x: "#120a06", // pupil
  m: "#5a1f26", // mouth inside
  q: "#e48a7a", // blush
  A: "#0b4a4f", // teal (Blitz's jacket)
  B: "#137a7a",
  C: "#22a8a0",
  D: "#6fd8c8",
  E: "#8a3208", // orange
  F: "#d2601a",
  G: "#f28a2a",
  H: "#ffb860",
  L: "#8f96a3", // clock white: shadow to bright
  M: "#c9ced8",
  N: "#eef1f5",
  O: "#ffffff",
  R: "#b01a22", // flag red
  S: "#ee3b3b",
  "1": "#262a33", // clock buttons, ticks
  "2": "#4f5562",
  y: "#fff3b0", // ding spark
  Y: "#ffd23a",
  j: "#7fd3ff", // sweat
  g: "#b8b0b8", // dust, sleepy bubbles
  z: "#0d0e12", // ground shadow
};

type Pt = readonly [number, number];

/** The frame, and the ground (the first row below the feet). */
const W = 70;
const H = 52;
const GROUND = 49;

const PARTS: Record<string, Part> = {};
const AT = new Map<string, Pt>();
/** A part painted on a frame-sized canvas (rest coordinates), cropped, made once by name. */
function painted(name: string, paint: (cv: Canvas) => void, outline = true): { name: string; at: Pt } {
  let at = AT.get(name);
  if (!at) {
    const cv = canvas(W + 16, H + 16);
    paint(cv);
    let x0 = 1e9;
    let y0 = 1e9;
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
    if (x1 < 0) {
      PARTS[name] = { grid: ["."], outline: false };
      at = [0, 0];
    } else {
      PARTS[name] = { grid: cv.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline };
      at = [x0, y0];
    }
    AT.set(name, at);
  }
  return { name, at };
}

const ell = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const rk = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
function fill(cv: Canvas, inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string): void {
  for (let y = 0; y < cv.length; y++) for (let x = 0; x < cv[0]!.length; x++) if (inside(x, y)) cv[y]![x] = key(x, y);
}
function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, y) =>
    [...row].forEach((k, i) => {
      if (k === "." || cv[y0 + y]?.[x0 + i] === undefined) return;
      cv[y0 + y]![x0 + i] = k;
    }),
  );
}
function dot(cv: Canvas, x: number, y: number, k: string): void {
  if (cv[y]?.[x] !== undefined) cv[y]![x] = k;
}
function nearSeg(p: Pt, a: Pt, b: Pt) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function nearest(p: Pt, pts: readonly Pt[]) {
  let best = { d: Infinity, nx: 0, ny: 0, s: 0 };
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = nearSeg(p, a, b);
    if (n.d < best.d) best = { d: n.d, nx: n.nx, ny: n.ny, s: acc + n.t * len };
    acc += len;
  }
  return best;
}

// ---- The shell: a high dome of chunky plates over a rim of edge plates and a cream belly, two orange straps.

const SHELL = { cx: 25, cy: 36, rx: 15.5, ry: 15 };
const dome = ell(SHELL.cx, SHELL.cy, SHELL.rx, SHELL.ry);
const rim = ell(25.5, 37, 17.4, 3.3);
const belly = ell(26, 39.6, 13, 2.4);
/** The seam round the middle of the dome, by x. */
const seamY = (x: number) => Math.round(29.5 + ((x - 25) / 15) ** 2 * 4);

function shell(cv: Canvas): void {
  fill(cv, belly, (x, y) => (y >= 41 || x > 34 ? "U" : "u"));
  fill(cv, rim, (x, y) => {
    const edge = (x - 7) % 5 === 0 && y >= 37;
    if (edge) return "a";
    return y <= 36 ? "d" : y === 37 ? (x < 26 ? "d" : "c") : x < 20 ? "c" : "b";
  });
  fill(cv, (x, y) => dome(x, y) && y <= 35, (x, y) => {
    const l = 0.62 - 0.42 * ((x - 21) / SHELL.rx) - 0.5 * ((y - 27) / SHELL.ry);
    return rk("bcde", l);
  });
  // Seams: round the middle, then the plates above and below it.
  for (let x = 10; x <= 40; x++) {
    const y = seamY(x);
    if (dome(x, y) && y <= 35) dot(cv, x, y, "a");
  }
  const vSeam = (x0: number, ya: number, yb: number, lean: number) => {
    for (let y = ya; y <= yb; y++) {
      const x = Math.round(x0 + (y - ya) * lean);
      if (dome(x, y) && y <= 35) dot(cv, x, y, "a");
    }
  };
  vSeam(19, 21, seamY(19) - 1, -0.25);
  vSeam(31, 21, seamY(31) - 1, 0.25);
  vSeam(15, seamY(15) + 1, 35, -0.3);
  vSeam(25, seamY(25) + 1, 35, 0);
  vSeam(35, seamY(35) + 1, 35, 0.3);
  // A lighter heart to each lower plate (lit from the top left).
  for (const [px, py] of [[19, 31], [29, 31], [12, 31], [38, 32]] as const) {
    fill(cv, (x, y) => ell(px + 0.5, py + 0.5, 2.2, 1.5)(x, y) && "bcd".includes(cv[y]![x]!), (x, y) => {
      const k = cv[y]![x]!;
      return k === "b" ? "c" : k === "c" ? "d" : "e";
    });
  }
  // The rim's lip: a dark line where the dome meets it.
  for (let x = 9; x <= 42; x++) if (rim(x, 36) && cv[36]![x] !== ".") dot(cv, x, 36, x < 12 || x > 39 ? "b" : "a");
  // Orange straps from the clock's feet down round the shell, with teal buckles.
  const strap = (pts: readonly Pt[]) =>
    fill(cv, (x, y) => (dome(x, y) || rim(x, y)) && nearest([x, y], pts).d <= 1.0, (x, y) => (nearest([x, y], pts).nx < 0 ? "G" : "F"));
  strap([[17.5, 21], [14.5, 30], [12.5, 38]]);
  strap([[33, 21], [36, 30], [37.5, 38]]);
  stamp(cv, ["DC", "BA"], 14, 30);
  stamp(cv, ["DC", "BA"], 35, 30);
}
const SHELL_PART = painted("shell", shell);

PARTS["tail"] = { grid: [".WW", "Www", "wv."] };

PARTS["shadow"] = (() => {
  const cv = canvas(40, 3);
  fill(cv, ell(19.5, 1, 20, 1.6), () => "z");
  return { grid: toGrid(cv), outline: false };
})();

// ---- The chess clock: Blitz's own, two faces with ticks, two buttons and the red flag.

const FACE_A = ["..222..", ".2O1O2.", "2OO1OO2", "21O1O12", "2OOOOO2", ".2O1O2.", "..222.."];
const FACE_B = ["..222..", ".2O1O2.", "2OOOOO2", "21O1112", "2OOOOO2", ".2O1O2.", "..222.."];
PARTS["clock"] = (() => {
  const cv = canvas(19, 10);
  fill(cv, () => true, (x, y) => (y === 0 ? (x === 18 ? "M" : "O") : x === 18 || y === 9 ? "L" : x === 17 || y === 8 ? "M" : "N"));
  stamp(cv, FACE_A, 1, 1);
  stamp(cv, FACE_B, 10, 1);
  dot(cv, 9, 2, "M");
  dot(cv, 9, 6, "M");
  return { grid: toGrid(cv) };
})();
PARTS["button"] = { grid: ["2221", "1111"] };
PARTS["flag:0"] = { grid: ["SS", "SR", "1.", "1."] };
PARTS["flag:1"] = { grid: [".SS", "1SR", "1.."] };
PARTS["flag:-1"] = { grid: ["1.", "1S", "SR"] };
/** The clock's top-left at rest, on the shell. */
const CLOCK: Pt = [16, 13];

// ---- The head: a round blunt tortoise head, a sweatband, heavy sleepy lids, a flat deadpan mouth.

export type Mood = "sleepy" | "droop" | "doze" | "awake" | "blink" | "up" | "smile" | "happy" | "smug" | "wide" | "hurt" | "o" | "chew";
type Eye = "half" | "low" | "droop" | "shut" | "open" | "wide" | "up" | "arc" | "pinch";
type Mouth = "flat" | "smile" | "smirk" | "o" | "wavy" | "chew" | "grin";

const NEAR_EYE: Record<Eye, readonly string[]> = {
  half: [".vvvv.", "kkkkkk", "ktxxOk", "ktxxxk", ".kkkk."],
  low: ["......", ".vvvv.", "kkkkkk", "ktxxOk", ".kkkk."],
  droop: ["......", ".vvvv.", "kkkkkk", "ktxxxk", ".kkkk."],
  shut: ["......", "......", ".vvvv.", "kkkkkk", "......"],
  open: [".kkkk.", "ktxxOk", "ktxxxk", "ktxxxk", ".kkkk."],
  wide: [".kkkk.", "kttttk", "kttxtk", "kttttk", ".kkkk."],
  up: [".kkkk.", "ktxxOk", "ktxxxk", "kttttk", ".kkkk."],
  arc: ["......", "..kk..", ".k..k.", "k....k", "......"],
  pinch: ["......", "kk....", "..kkkk", "kk....", "......"],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  half: [".vv.", "kkkk", "kxxk", ".kk."],
  low: ["....", ".vv.", "kkkk", "kxxk"],
  droop: ["....", ".vv.", "kkkk", ".kk."],
  shut: ["....", ".vv.", "kkkk", "...."],
  open: [".kk.", "kxOk", "kxxk", ".kk."],
  wide: [".kk.", "kttk", "ktxk", ".kk."],
  up: [".kk.", "kxOk", "kttk", ".kk."],
  arc: ["....", ".kk.", "k..k", "...."],
  pinch: ["....", "k...", ".kkk", "k..."],
};
const MOUTHS: Record<Mouth, { rows: readonly string[]; at: Pt }> = {
  flat: { rows: ["kkkkkk"], at: [10, 12] },
  smile: { rows: ["k.....", ".kkkkk"], at: [9, 11] },
  smirk: { rows: ["k......", ".k.....", "..kkkkk"], at: [8, 10] },
  grin: { rows: ["k......", "kkkkkkk", ".kmmmk."], at: [9, 11] },
  o: { rows: [".kk.", "kmmk", ".kk."], at: [13, 10] },
  wavy: { rows: ["k.k.k.", ".k.k.k"], at: [10, 11] },
  chew: { rows: ["kkkkkk", ".kmmk."], at: [10, 12] },
};
const FACES: Record<Mood, { near: Eye; far: Eye; mouth: Mouth; blush?: boolean }> = {
  sleepy: { near: "half", far: "half", mouth: "flat" },
  droop: { near: "droop", far: "droop", mouth: "flat" },
  doze: { near: "shut", far: "shut", mouth: "flat" },
  awake: { near: "open", far: "open", mouth: "flat" },
  blink: { near: "shut", far: "shut", mouth: "flat" },
  up: { near: "up", far: "up", mouth: "flat" },
  smile: { near: "half", far: "half", mouth: "smile", blush: true },
  happy: { near: "arc", far: "arc", mouth: "smile", blush: true },
  smug: { near: "low", far: "low", mouth: "smirk" },
  wide: { near: "wide", far: "wide", mouth: "wavy" },
  hurt: { near: "pinch", far: "pinch", mouth: "o" },
  o: { near: "open", far: "open", mouth: "o" },
  chew: { near: "half", far: "half", mouth: "chew" },
};

function head(mood: Mood): Part {
  const cv = canvas(19, 15);
  const skull = ell(8, 7.2, 8, 6.8);
  const snout = ell(13, 8.6, 5.2, 5);
  const inside = (x: number, y: number) => skull(x, y) || snout(x, y);
  fill(cv, inside, (x, y) => rk("vwWV", 0.66 - 0.32 * ((x - 7) / 8) - 0.5 * ((y - 6) / 7)));
  // The sweatband: teal with an orange stripe, round the top of the head.
  for (let x = 0; x < 19; x++) {
    const top = [0, 1, 2].map((d) => Math.round(1 + d + (x > 10 ? (x - 10) * 0.5 : 0)));
    top.forEach((y, i) => {
      if (inside(x, y) && x <= 14) dot(cv, x, y, i === 1 ? (x < 5 ? "H" : "G") : i === 0 ? (x < 6 ? "D" : "C") : x < 7 ? "B" : "A");
    });
  }
  // Wrinkles under the chin and a nostril.
  for (const [x, y] of [[4, 12], [6, 13], [8, 13], [5, 14]] as const) if (inside(x, y)) dot(cv, x, y, "v");
  dot(cv, 17, 8, "v");
  const face = FACES[mood];
  stamp(cv, NEAR_EYE[face.near], 3, 5);
  stamp(cv, FAR_EYE[face.far], 11, 5);
  if (face.blush) stamp(cv, ["qq"], 3, 11);
  const m = MOUTHS[face.mouth];
  stamp(cv, m.rows, m.at[0], m.at[1]);
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["sleepy", "droop", "doze", "awake", "blink", "up", "smile", "happy", "smug", "wide", "hurt", "o", "chew"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);
/** The head's top-left at rest. */
const HEAD: Pt = [44, 19];

// ---- Limbs from points: a stubby tube, three bands of light, a round foot with pale toenails.

function limbPaint(cv: Canvas, pts: readonly Pt[], r: number, far: boolean, foot: boolean): void {
  const ramp = far ? "vvwW" : "vwWV";
  const end = pts[pts.length - 1]!;
  const footIn = ell(end[0] + 0.6, end[1] + 0.3, 3.2, 2.1);
  fill(
    cv,
    (x, y) => nearest([x, y], pts).d <= r || (foot && footIn(x, y)),
    (x, y) => {
      const n = nearest([x, y], pts);
      const l = n.d <= r ? 0.55 - 0.45 * (n.nx / r) - 0.15 * (n.ny / r) : 0.5 - 0.3 * (x - end[0]) / 3 - 0.4 * (y - end[1]) / 2;
      return rk(ramp, l - (far ? 0.1 : 0));
    },
  );
  if (foot) {
    const ny = Math.round(end[1] + 1);
    for (const nx of [end[0] + 1, end[0] + 3]) if (cv[ny]?.[nx] && cv[ny]![nx] !== ".") dot(cv, Math.round(nx), ny, far ? "U" : "u");
  }
}
function limb(pts: readonly Pt[], r: number, far: boolean, foot = true): { name: string; at: Pt } {
  return painted(`limb:${far ? 1 : 0}:${foot ? 1 : 0}:${r}:${pts.map((p) => p.join(",")).join(";")}`, (cv) => limbPaint(cv, pts, r, far, foot));
}
function neck(end: Pt): { name: string; at: Pt } {
  const pts: Pt[] = [[37, 35], end];
  return painted(`neck:${end.join(",")}`, (cv) =>
    fill(cv, (x, y) => nearest([x, y], pts).d <= 2.9, (x, y) => {
      const n = nearest([x, y], pts);
      const l = 0.58 - 0.35 * (n.nx / 2.9) - 0.45 * (n.ny / 2.9);
      // wrinkles: rings every three pixels along the neck, on its shaded underside
      if (Math.round(n.s) % 3 === 1 && n.ny > 0.3) return "v";
      return rk("vwWV", l);
    }),
  );
}

type Leg = "fh" | "ff" | "nh" | "nf";
const HIP: Record<Leg, Pt> = { fh: [18, 37], ff: [38, 37], nh: [13, 38], nf: [33, 38] };
const ANKLE: Record<Leg, Pt> = { fh: [17, 45], ff: [39, 45], nh: [12, 46], nf: [34, 46] };

// ---- Poses.

export interface Pose {
  mood?: Mood;
  /** The body (shell, clock, head) down this many pixels. */
  by?: number;
  /** Everything sideways. */
  dx?: number;
  /** The head on its neck. */
  hx?: number;
  hy?: number;
  /** The head pulled into the shell (drawn behind it). */
  hide?: boolean;
  /** Feet: sideways and up, per leg. */
  feet?: Partial<Record<Leg, { x?: number; lift?: number }>>;
  /** All legs pulled up into the shell by this many pixels. */
  tuck?: number;
  /** The near front foot lifted to this point (a wave, a press), instead of standing. */
  paw?: Pt | null;
  /** The clock on the shell: a wobble. */
  cx?: number;
  cy?: number;
  /** Which button is down: 1 the left, 2 the right. */
  press?: 0 | 1 | 2;
  flag?: 0 | 1 | -1;
  /** At the table: settled on its belly, the clock set down on the table in front. */
  sit?: boolean;
  tail?: number;
  noShadow?: boolean;
}

function build(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const by = p.by ?? 0;
  const tuck = p.tuck ?? 0;
  const L: Layer[] = [];
  const put = (part: string, x: number, y: number) => L.push({ part, x, y });
  const add = (l: { name: string; at: Pt }, ox = 0, oy = 0) => put(l.name, l.at[0] + ox, l.at[1] + oy);
  if (!p.noShadow) put("shadow", 6 + dx, GROUND - 2);

  put("tail", 7 + dx + (p.tail ?? 0), 37 + by);

  // Legs, the far pair behind the near, all tucked under the shell's rim.
  const leg = (k: Leg) => {
    const f = p.feet?.[k] ?? {};
    const far = k[0] === "f";
    const hip: Pt = [HIP[k][0], HIP[k][1] + by - 1];
    const ankle: Pt = [ANKLE[k][0] + (f.x ?? 0), Math.min(ANKLE[k][1] - (f.lift ?? 0) - tuck, 46)];
    if (ankle[1] < hip[1] + 1) return;
    add(limb([hip, ankle], 2.6, far), dx);
  };
  if (!p.sit) {
    leg("fh");
    leg("ff");
    leg("nh");
    if (!p.paw) leg("nf");
  } else {
    // Settled on its belly: stubby feet poke out, splayed flat.
    add(limb([[16, 40 + by], [14, 46]], 2.4, true), dx);
    add(limb([[37, 40 + by], [40, 46]], 2.4, true), dx);
    add(limb([[12, 41 + by], [9, 46]], 2.6, false), dx);
  }

  // The neck and head.
  const hx = HEAD[0] + (p.hx ?? 0) + dx;
  const hy = HEAD[1] + (p.hy ?? 0) + by;
  add(neck([HEAD[0] + (p.hx ?? 0) + 4, HEAD[1] + (p.hy ?? 0) + 10]), dx, by);
  const headLayer = `head:${p.mood ?? "sleepy"}`;
  if (p.hide) put(headLayer, hx, hy);

  add(SHELL_PART, dx, by);

  // The clock rides on the shell (or sits on the table, in front).
  const clockAt: Pt = p.sit ? [45 + dx, 39] : [CLOCK[0] + dx + (p.cx ?? 0), CLOCK[1] + by + (p.cy ?? 0)];
  const clock = () => {
    const [x, y] = clockAt;
    put("button", x + 2, y - (p.press === 1 ? 1 : 2));
    put("button", x + 13, y - (p.press === 2 ? 1 : 2));
    const fl = p.flag ?? 0;
    put(`flag:${fl}`, x + 7 + (fl === 1 ? -1 : 0), y - (fl === 0 ? 4 : 3));
    put("clock", x, y);
  };
  if (!p.sit) clock();
  else clock();
  if (!p.hide) put(headLayer, hx, hy);

  // The near front foot, lifted in front of everything.
  if (p.paw) add(limb([[36, 35 + by], [p.paw[0], p.paw[1] + by]], 2.5, false, true), dx);
  return L;
}

// ---- Little effects.

/** A ding: a bright little star. */
const ding = (x: number, y: number, big = false): Speck[] => [
  [x, y, "y"],
  [x - 1, y, "Y"],
  [x + 1, y, "Y"],
  [x, y - 1, "Y"],
  [x, y + 1, "Y"],
  ...(big ? ([[x - 2, y - 2, "Y"], [x + 2, y - 2, "Y"], [x - 2, y + 2, "Y"], [x + 2, y + 2, "Y"], [x, y - 3, "y"]] as Speck[]) : []),
];
/** Sleepy bubbles drifting up off the head (no letters). */
const bubbles = (n: number, x = 58, y = 17): Speck[] =>
  ([[x, y], [x + 2, y - 3], [x + 4, y - 7]] as const).slice(0, n).flatMap(([bx, by], i): Speck[] =>
    i < 2
      ? [[bx, by, "g"]]
      : [[bx, by, "g"], [bx + 1, by, "g"], [bx - 1, by + 1, "g"], [bx + 2, by + 1, "g"], [bx, by + 2, "g"], [bx + 1, by + 2, "g"]],
  );
/** Thought dots above the head. */
const thoughts = (n: number): Speck[] =>
  ([[58, 14], [61, 10], [63, 4]] as const).slice(0, n).flatMap(([x, y], i): Speck[] =>
    i === 0
      ? [[x, y, "t"], [x + 1, y, "t"], [x, y + 1, "t"], [x + 1, y + 1, "g"]]
      : i === 1
        ? [[x, y, "t"], [x + 1, y, "t"], [x - 1, y + 1, "t"], [x, y + 1, "t"], [x + 1, y + 1, "t"], [x + 2, y + 1, "g"], [x, y + 2, "g"], [x + 1, y + 2, "g"]]
        : [
            ...[0, 1, 2].map((d): Speck => [x + d, y, "t"]),
            ...[-1, 0, 1, 2, 3].map((d): Speck => [x + d, y + 1, d === 3 ? "g" : "t"]),
            ...[-1, 0, 1, 2, 3].map((d): Speck => [x + d, y + 2, d >= 2 ? "g" : "t"]),
            ...[0, 1, 2].map((d): Speck => [x + d, y + 3, "g"]),
          ],
  );
const sweat = (i: number): Speck[] => {
  const t = i % 3;
  return [[42 - t, 17 + t, "j"], [42 - t, 18 + t, "t"], [61 + t, 16 + t, "j"], [61 + t, 17 + t, "t"]];
};
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) => [0, 1].map((i): Speck => [Math.round(26 + side * (19 + i * 2 + t * 2)), GROUND - 1 - i, t > 0 ? "g" : "g"]));
const sparkle = (t: number): Speck[] => {
  const spots: Pt[] = [[8, 16], [48, 11], [3, 36], [4, 26], [40, 5], [64, 12]];
  return spots.filter((_, i) => (i + t) % 3 === 0).flatMap(([x, y]) => ding(x, y));
};

const FLASH: Record<string, string> = { v: "#7d9468", w: "#a3ba86", W: "#c9dba8", V: "#eef5d8", b: "#9a7a48", c: "#c4a05c", d: "#e2c47c", e: "#fbe6b0" };

function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const specks = (extra.specks ?? []).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: build(p), ...extra, specks };
}

// ---- Animations.

/** Idle (3.6 s): slow breaths, a very slow blink, nods off (head droops, lids fall), jerks awake; the flag twitches once. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 24 }, (_, i) => {
    const by = i % 8 >= 4 ? 1 : 0;
    const nod = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 3, -1, 0, 0, 0, 0, 0, 0, 0][i]!;
    const mood: Mood = i === 4 || i === 5 ? "blink" : nod === 1 ? "droop" : nod >= 2 ? "doze" : nod < 0 ? "awake" : i === 17 ? "awake" : "sleepy";
    const flag = i === 19 ? 1 : i === 20 ? -1 : 0;
    return f(150, { by, mood, hy: Math.max(-1, nod), hx: nod >= 2 ? -1 : 0, flag, cy: i === 16 ? -1 : 0 }, { specks: nod >= 3 ? bubbles(i - 12) : [] });
  }),
};

/** Walk (1.2 s): a ponderous plod, one foot at a time, the head bobbing, the clock wobbling. */
const STEPS: readonly Leg[] = ["nf", "fh", "ff", "nh"];
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const leg = STEPS[Math.floor(i / 2)]!;
    const up = i % 2 === 0;
    const feet: Pose["feet"] = { [leg]: { lift: up ? 3 : 1, x: up ? 1 : 2 } };
    return f(150, { mood: "sleepy", feet, by: up ? 0 : 1, hy: up ? 0 : 1, hx: up ? 0 : 1, cx: i % 4 === 1 ? 1 : i % 4 === 3 ? -1 : 0, cy: up ? 0 : 0, flag: i % 4 === 1 ? 1 : 0, tail: i % 4 < 2 ? 0 : -1 }, up ? {} : { cue: "step" });
  }),
};

/** Sit (loops): at the table on its belly, the clock set down before it, half asleep over the board; a slow blink, now and then a slow press of the clock. */
const SIT: Pose = { sit: true, by: 4, dx: -4, hx: 2, hy: -3, mood: "sleepy" };
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 20 }, (_, i) => {
    const blink = i === 3 || i === 4 || i === 5;
    const reach = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 0][i]!;
    const paws: Pt[] = [[38, 36], [41, 33], [46, 30], [47, 31]];
    const breathe = i % 10 >= 5 ? 1 : 0;
    return f(220, { ...SIT, by: 4 + breathe, hy: -3 + (i >= 6 && i <= 9 ? 1 : 0) - breathe, mood: blink ? "blink" : i >= 6 && i <= 9 ? "droop" : "sleepy", paw: reach ? paws[reach]! : null, press: reach === 3 ? 1 : 0 }, reach === 3 && i === 13 ? { cue: "ding", specks: ding(51, 35, true) } : {});
  }),
};

/** Wave (once, 1.5 s): slowly lifts a stubby foot, a sleepy wave and a tiny deadpan smile, the clock dings, back to idle. */
const wave: Anim = {
  loop: false,
  frames: [
    f(150, { mood: "sleepy" }),
    f(150, { mood: "sleepy", paw: [39, 34], hy: -1 }),
    f(150, { mood: "sleepy", paw: [40, 29], hy: -2 }),
    f(150, { mood: "smile", paw: [40, 25], hy: -2 }),
    f(140, { mood: "smile", paw: [38, 25], hy: -2 }),
    f(140, { mood: "smile", paw: [41, 25], hy: -2 }),
    f(140, { mood: "smile", paw: [38, 25], hy: -2 }),
    f(180, { mood: "happy", paw: [40, 26], hy: -2, press: 2, flag: 1 }, { cue: "ding", specks: ding(31, 9, true) }),
    f(150, { mood: "smile", paw: [39, 33], hy: -1, flag: 0 }, { specks: ding(31, 10) }),
    f(200, { mood: "sleepy" }),
  ],
};

/** Entrance: a shell with a clock on it sits there; feet come out, then, very slowly, the head; a sleepy look, the flag pops up. */
const entrance: Anim = {
  loop: false,
  frames: [
    f(300, { hide: true, hx: -16, hy: 5, by: 3, tuck: 6, mood: "doze", flag: -1 }),
    f(200, { hide: true, hx: -16, hy: 5, by: 2, tuck: 4, mood: "doze", flag: -1 }),
    f(200, { hide: true, hx: -14, hy: 4, by: 1, tuck: 2, mood: "doze", flag: -1 }, { cue: "step" }),
    f(220, { hide: true, hx: -11, hy: 3, mood: "droop", flag: -1 }),
    f(220, { hide: true, hx: -7, hy: 2, mood: "droop", flag: -1 }),
    f(220, { hide: true, hx: -4, hy: 1, mood: "droop", flag: -1 }),
    f(220, { hx: -1, mood: "sleepy", flag: -1 }),
    f(160, { mood: "awake", flag: 1, cy: -1 }, { cue: "ding", specks: ding(23, 7) }),
    f(400, { mood: "sleepy", flag: 0 }),
  ],
};

/** Thinking (loops): chin up, eyes rolled up under heavy lids, thought dots rising, very slowly. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(200, { mood: i === 9 ? "blink" : "up", hy: -2, hx: -1, by: i % 6 >= 3 ? 1 : 0, feet: { nf: i % 6 === 1 ? { lift: 1 } : {} } }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: stretches its neck out toward the board, nudges, and draws it slowly back. */
const move: Anim = {
  loop: false,
  frames: [
    f(150, { mood: "awake", hy: -1 }),
    f(150, { mood: "sleepy", hx: 2, hy: 0 }),
    f(150, { mood: "sleepy", hx: 3, hy: 1, feet: { nf: { lift: 2, x: 1 } } }),
    f(200, { mood: "smug", hx: 3, hy: 3, feet: { nf: { x: 2 } } }, { cue: "step" }),
    f(150, { mood: "sleepy", hx: 2, hy: 1, feet: { nf: { x: 2 } } }),
    f(150, { mood: "sleepy", hx: 1 }),
    f(250, { mood: "sleepy" }),
  ],
};

/** A capture: a slow chomp at the board, a satisfied chew, a little smile. */
const capture: Anim = {
  loop: false,
  frames: [
    f(150, { mood: "awake", hy: -1 }),
    f(130, { mood: "o", hx: 3, hy: 1 }),
    f(160, { mood: "o", hx: 3, hy: 3 }, { cue: "chomp" }),
    f(160, { mood: "chew", hx: 3, hy: 1 }, { specks: sparkle(1) }),
    f(160, { mood: "sleepy", hx: 3, hy: 1 }),
    f(160, { mood: "chew", hx: 2 }, { specks: sparkle(2) }),
    f(160, { mood: "sleepy", hx: 1 }),
    f(220, { mood: "smile", press: 1 }, { cue: "ding", specks: ding(20, 10) }),
    f(300, { mood: "smile" }),
  ],
};

/** Hurt: hit, a flash, it ducks halfway into its shell, the clock jolts; then pokes back out, unbothered. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(80, { mood: "hurt", hide: true, hx: -3, hy: 1, by: 1, cy: -2, flag: 1 }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(100, { mood: "hurt", hide: true, hx: -6, hy: 2, by: 2, tuck: 2, cy: -1, flag: -1 }, { shake: [-1, 0] }),
    f(160, { mood: "hurt", hide: true, hx: -6, hy: 2, by: 2, tuck: 2, flag: -1 }),
    f(160, { mood: "wide", hide: true, hx: -3, hy: 1, by: 1, tuck: 1, flag: -1 }),
    f(160, { mood: "sleepy", hx: -1, flag: 0 }),
    f(250, { mood: "sleepy" }),
  ],
};

/** Check: its eyes actually open, the neck stretches at the board, and it slaps... slowly... the clock: ding. */
const check: Anim = {
  loop: false,
  frames: [
    f(150, { mood: "awake", hy: -1 }),
    f(150, { mood: "awake", hx: 1, hy: -1, paw: [39, 34] }),
    f(150, { mood: "awake", hx: 2, hy: -2, paw: [40, 28] }),
    f(150, { mood: "smug", hx: 3, hy: -2, paw: [40, 24] }),
    f(200, { mood: "smug", hx: 3, hy: -1, paw: [39, 23], press: 2, flag: 1, cy: 1 }, { cue: "ding", specks: ding(31, 9, true) }),
    f(200, { mood: "smug", hx: 2, hy: -1, paw: [40, 24], flag: -1 }, { specks: ding(32, 8) }),
    f(200, { mood: "smug", hx: 1, paw: [39, 33] }),
    f(250, { mood: "sleepy" }),
  ],
};

/** Smug: lids at half mast, a tiny smile, chin up, a slow nod; the flag gives a little flick. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(200, { mood: i === 6 ? "blink" : "smug", hy: i < 3 ? -2 : i < 5 ? -1 : -2, hx: -1, by: i % 4 === 2 ? 1 : 0, flag: i === 3 ? 1 : 0 })),
};

/** Rattled: wide awake for once, sweat flying, trembling, the clock rattling on its back, the flag flapping. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    f(90, { mood: "wide", dx: i % 2 ? 1 : 0, hx: -2, by: i % 4 === 2 ? 1 : 0, cx: i % 2 ? -1 : 1, cy: i % 3 === 0 ? -1 : 0, flag: i % 2 ? 1 : -1, feet: { nf: { lift: i % 4 === 1 ? 1 : 0 }, nh: { lift: i % 4 === 3 ? 1 : 0 } } }, { specks: sweat(i) }),
  ),
};

/** Defeat: a jolt, then it pulls everything into its shell and goes to sleep; the flag falls (the last frame holds). */
const defeat: Anim = {
  loop: false,
  frames: [
    f(90, { mood: "hurt", hx: -2, cy: -2, flag: 1 }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(150, { mood: "wide", hide: true, hx: -3, flag: 1 }),
    f(160, { mood: "droop", hide: true, hx: -6, hy: 1, by: 1, tuck: 1, flag: 0 }),
    f(160, { mood: "doze", hide: true, hx: -9, hy: 2, by: 2, tuck: 3, flag: 0 }),
    f(180, { mood: "doze", hide: true, hx: -16, hy: 5, by: 3, tuck: 6, flag: -1 }, { cue: "step", specks: dust(0) }),
    f(400, { mood: "doze", hide: true, hx: -16, hy: 5, by: 3, tuck: 6, flag: -1 }, { specks: bubbles(1, 47, 31) }),
    f(400, { mood: "doze", hide: true, hx: -16, hy: 5, by: 3, tuck: 6, flag: -1 }, { specks: bubbles(2, 47, 31) }),
    f(1000, { mood: "doze", hide: true, hx: -16, hy: 5, by: 3, tuck: 6, flag: -1 }, { specks: bubbles(3, 47, 31) }),
  ],
};

/** Victory: a slow happy stomp-stomp, a big content smile, the clock dinging away, sparkles. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const up = i % 4 < 2;
    const near = i < 4;
    return f(180, { mood: i % 4 === 1 ? "smile" : "happy", hy: up ? -2 : -1, by: up ? 0 : 1, feet: up ? { [near ? "nf" : "ff"]: { lift: 2 } } : {}, press: i % 4 === 2 ? (near ? 1 : 2) : 0, flag: i % 2 ? 1 : 0, cy: up ? -1 : 0 }, { specks: [...sparkle(i), ...(i % 4 === 2 ? ding(near ? 20 : 31, 9) : [])], cue: i % 4 === 2 ? "ding" : undefined });
  }),
};

export const sidekickBlitz: Character = {
  id: "sidekick-blitz",
  name: "Blitz's sidekick",
  w: W,
  h: H,
  foot: [26, GROUND],
  palette: PALETTE,
  halo: "#2e2a1c",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
