/**
 * The Battle Tower's clerk (id "sidekick-tower-clerk"): a penguin bellhop who stands behind the lobby's front counter
 * and sends players up the elevator. Nobody's kid: he belongs to HunChess itself, so he wears the house colors, a slate
 * jacket with gold piping and a double row of gold buttons, a gold pillbox cap with a chin strap and a gold bow tie,
 * over a penguin's own black and white coat. Calm, polite, unhurried: half-lidded serene eyes, a tiny smile in the beak.
 *
 * Three-quarters, facing our right, light from the top left. The face, cap and bow tie sit in his top 24 px so they show
 * over a 30 px counter.
 *
 * Rigging: the head (one per face), the body (jacket painted on), the cap and the bow tie are painted once; the
 * flippers are painted from points (shoulder, elbow, tip) per pose, so a new pose is a handful of numbers.
 */
import { canvas, ellipse, toGrid, type Canvas } from "../paint.ts";
import { lieDown, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../sprite.ts";

export const CLERK_PALETTE = {
  k: "#0e1014", // outline
  b: "#16181d", // penguin black, dark to light
  B: "#272b34",
  h: "#3d4352",
  s: "#2a2e37", // slate jacket
  S: "#4a5163",
  t: "#1d2027",
  g: "#f4b740", // HunChess gold
  G: "#c8860d",
  D: "#8a5c08",
  y: "#ffe39a",
  w: "#f3f1ec", // warm white front
  W: "#cfcbc2",
  o: "#f5a524", // beak and feet
  O: "#c46a12",
  p: "#ffd27a",
  e: "#101216", // eyes
  x: "#ffffff",
  q: "#f0a29c", // blush
  m: "#5a1a14", // inside the beak
  j: "#7fd3ff", // sweat
  c: "#b8b0b8", // dust, thought puffs
  C: "#7d7580",
  r: "#c98f4e", // stool wood
  R: "#a06a33",
  n: "#6c4222",
  z: "#0b0c10", // ground shadow
} as const;

type Pt = readonly [number, number];

const W = 64;
/** Drawn on a 64 x 64 grid (ground at 61), then set OY lower in a taller frame, for headroom when he hops. */
const OY = 4;
const H = 64 + OY;
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

const ell = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
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

// ---- The head: round and black, a white face mask, an orange-gold bill pointing right, a gold chin strap.

export type Mood = "calm" | "blink" | "open" | "happy" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "gasp";
type Eye = "calm" | "open" | "shut" | "arc" | "up" | "tiny" | "pinch" | "x";
type Beak = "smile" | "flat" | "grin" | "smirk" | "wavy" | "gasp";

/** Near eye (3 x 4, at 10,8) and far eye (2 x 4, at 16,8). */
const NEAR_EYE: Record<Eye, readonly string[]> = {
  calm: ["...", "kkk", "ee.", "ee."],
  open: ["ee.", "xe.", "ee.", "..."],
  shut: ["...", "...", "kkk", "..."],
  arc: ["...", ".k.", "k.k", "..."],
  up: [".ee", ".xe", "...", "..."],
  tiny: [".e.", "exe", "exe", ".e."],
  pinch: ["k..", ".kk", "k..", "..."],
  x: ["k.k", ".k.", "k.k", "..."],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  calm: ["..", "kk", "e.", "e."],
  open: ["e.", "x.", "e.", ".."],
  shut: ["..", "..", "kk", ".."],
  arc: ["..", "k.", ".k", ".."],
  up: [".e", ".e", "..", ".."],
  tiny: ["e.", "xe", "xe", "e."],
  pinch: [".k", "k.", ".k", ".."],
  x: ["k.", ".k", "k.", ".."],
};
const BEAKS: Record<Beak, readonly string[]> = {
  smile: ["..pp....", ".ppooo..", "koooooOO", ".kkkkkO.", "..OOO..."],
  flat: ["..pp....", ".ppooo..", ".oooooOO", ".kkkkkO.", "..OOO..."],
  grin: ["..pp....", ".ppooo..", "koooooOO", ".kmmmkO.", "..kkO..."],
  smirk: ["..pp....", "kppooo..", ".kooooOO", "..kkkkO.", "..OOO..."],
  wavy: ["..pp....", ".ppooo..", ".oooooOO", ".kokokO.", "..kOk..."],
  gasp: ["..pp....", ".ppooo..", ".oooooOO", ".kmmmkO.", ".kmmk...", "..OO...."],
};
const FACES: Record<Mood, { near: Eye; far: Eye; beak: Beak; blush?: boolean }> = {
  calm: { near: "calm", far: "calm", beak: "smile", blush: true },
  blink: { near: "shut", far: "shut", beak: "smile", blush: true },
  open: { near: "open", far: "open", beak: "smile", blush: true },
  happy: { near: "arc", far: "arc", beak: "grin", blush: true },
  think: { near: "up", far: "up", beak: "flat" },
  thinkBlink: { near: "shut", far: "shut", beak: "flat" },
  smug: { near: "calm", far: "calm", beak: "smirk", blush: true },
  rattled: { near: "tiny", far: "tiny", beak: "wavy" },
  hurt: { near: "pinch", far: "pinch", beak: "gasp" },
  out: { near: "x", far: "x", beak: "wavy" },
  gasp: { near: "open", far: "open", beak: "gasp" },
};

const HX0 = 20;
const HY0 = 8;

function head(mood: Mood): Part {
  const cv = canvas(28, 22);
  const skull = ell(11.5, 10.5, 10.4, 9.5);
  for (let y = 0; y < 22; y++)
    for (let x = 0; x < 28; x++) {
      if (!skull(x, y)) continue;
      const l = 0.5 - 0.45 * ((x - 11.5) / 10.4) - 0.55 * ((y - 10.5) / 9.5);
      cv[y]![x] = l > 1.02 ? "h" : l > 0.7 ? "B" : "b";
    }
  // The white face mask: round around each eye, wide under them.
  const mask = (x: number, y: number) => skull(x, y) && (ell(11.8, 10.2, 3.8, 3.8)(x, y) || ell(17.5, 9.8, 3.4, 3.6)(x, y) || ell(15.5, 14.8, 7, 4.8)(x, y));
  for (let y = 0; y < 22; y++) for (let x = 0; x < 28; x++) if (mask(x, y)) cv[y]![x] = x >= 20 || y >= 18 ? "W" : "w";
  // The chin strap: from the cap down the cheek, round under the bill.
  dots(cv, [[5, 3], [5, 4], [5, 5], [6, 6], [6, 7], [6, 8], [7, 9], [7, 10], [7, 11], [8, 12], [8, 13], [8, 14], [9, 15], [10, 16], [11, 17], [12, 17], [13, 18], [14, 18], [15, 18], [16, 18]], "G");
  const face = FACES[mood];
  stamp(cv, NEAR_EYE[face.near], 11, 8);
  stamp(cv, FAR_EYE[face.far], 17, 8);
  if (face.blush) dots(cv, [[11, 13], [12, 13]], "q");
  stamp(cv, BEAKS[face.beak], 19, 10);
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["calm", "blink", "open", "happy", "think", "thinkBlink", "smug", "rattled", "hurt", "out", "gasp"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);

/** The gold pillbox cap: a lit top, a gold band, a darker trim at the bottom. */
PARTS["cap"] = {
  grid: [
    "..yyyyy...",
    ".yyyyyyyg.",
    "ygggggggGD",
    "ygggggggGD",
    "yggggggGGD",
    "GDDDDDDDDD",
  ],
};
/** The cap knocked crooked. */
PARTS["cap:tilt"] = {
  grid: [
    ".....yyy..",
    "..yyyyyyy.",
    ".yyyyyyyGD",
    "ygggggggGD",
    "ygggggggGD",
    "yggggggGD.",
    "GDDDDDD...",
  ],
};
PARTS["tie"] = { grid: ["yy...gG", "yggDggG", "gG...GD"] };
PARTS["tie:tilt"] = { grid: [".....gG", "yy..ggG", "yggDGD.", "gG....."] };
PARTS["foot"] = { grid: ["..pp...", ".pooooo", "ooooooO", "OOOOOO."] };
PARTS["foot:far"] = { grid: ["..oo...", ".oOOOOO", "OOOOOO."] };
PARTS["tail"] = { grid: ["...bb", "..bbb", ".bbb.", "bbb.."] };
PARTS["shadow"] = (() => {
  const cv = canvas(30, 3);
  ellipse(cv, 15, 1.5, 15, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();
PARTS["stool"] = {
  grid: [
    "rrrrrrrrrrrrrrrrrrrrrr",
    "RRRRRRRRRRRRRRRRRRRRRR",
    "..rn..............rn..",
    "..rn..............rn..",
    "..rn..............rn..",
    "..rnnnnnnnnnnnnnnnrn..",
    "..rn..............rn..",
    "..rn..............rn..",
  ],
};

// ---- The body: a penguin's bean, the slate jacket painted on (gold hem, piping, buttons), the white front below.

function bodyPart(): Painted {
  const cv = canvas(W, H);
  const cx = 30;
  const cy = 43;
  const ry = 15;
  const rx = (y: number) => 11 + (2 * (y - cy)) / ry;
  const inside = (x: number, y: number) => ((x - cx) / rx(y)) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const belly = ell(36, 50, 8, 10);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      const l = 0.52 - 0.45 * ((x - cx) / 12) - 0.5 * ((y - cy) / ry);
      const hem = 40 + Math.round(1.2 * (1 - ((x - 32) / 12) ** 2));
      let k: string;
      if (y < hem) k = l > 0.66 ? "S" : l > 0.22 ? "s" : "t";
      else if (y === hem) k = l > 0.45 ? "g" : "G";
      else if (belly(x, y)) k = l > 0.12 ? "w" : "W";
      else k = l > 0.66 ? "B" : "b";
      cv[y]![x] = k;
    }
  // The white shirt front in the jacket's V, and the gold piping down its edges.
  for (let y = 27; y <= 32; y++)
    for (let x = 30; x <= 41; x++) {
      if (!inside(x, y)) continue;
      const half = (32 - y) * 0.8;
      const d = Math.abs(x - 35.5);
      if (d <= half) cv[y]![x] = "w";
      else if (d <= half + 1) cv[y]![x] = x < 36 ? "g" : "G";
    }
  // The front closure (piping) and the double row of gold buttons.
  dots(cv, [[36, 33], [36, 34], [36, 35], [37, 36], [37, 37], [37, 38], [37, 39]], "G");
  dots(cv, [[34, 34], [34, 37], [35, 40]], "g");
  dots(cv, [[39, 34], [39, 37]], "G");
  return crop(cv);
}
const BODY = painted("body", bodyPart);

// ---- Flippers: a tapering stroke from the shoulder: slate sleeve, gold cuff, black flipper.

function flipper(pts: readonly Pt[], far: boolean): Painted & { name: string } {
  return painted(`flip:${far ? 1 : 0}:${pts.map((p) => p.join(",")).join(";")}`, () => {
    const cv = canvas(W, H);
    const lens: number[] = [];
    let total = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const l = Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]);
      lens.push(l);
      total += l;
    }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let best = { d: Infinity, t: 0, nx: 0, ny: 0 };
        let acc = 0;
        for (let i = 0; i + 1 < pts.length; i++) {
          const [ax, ay] = pts[i]!;
          const [bx, by] = pts[i + 1]!;
          const vx = bx - ax;
          const vy = by - ay;
          const u = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1)));
          const nx = x - (ax + u * vx);
          const ny = y - (ay + u * vy);
          const d = Math.hypot(nx, ny);
          if (d < best.d) best = { d, t: (acc + u * lens[i]!) / total, nx, ny };
          acc += lens[i]!;
        }
        const r = 2.5 - 1.5 * best.t;
        if (best.d > r) continue;
        const l = 0.5 - 0.45 * (best.nx / r) - 0.35 * (best.ny / r) - (far ? 0.12 : 0);
        let k: string;
        if (best.t < 0.36) k = l > 0.66 ? "S" : l > 0.25 ? "s" : "t";
        else if (best.t < 0.47) k = l > 0.45 ? "g" : "G";
        else k = l > 0.95 ? "h" : l > 0.62 ? "B" : "b";
        cv[y]![x] = k;
      }
    return crop(cv);
  });
}

const SHN: Pt = [25, 32];
const SHF: Pt = [38, 32];
export type NearFlip = "side" | "out" | "fold" | "tie" | "chin" | "up";
export type FarFlip = "side" | "out" | "wave1" | "wave2" | "wave3" | "present" | "point" | "high";
const NEAR: Record<NearFlip, readonly Pt[]> = {
  side: [SHN, [23, 39], [22, 46]],
  out: [SHN, [20, 38], [16, 42]],
  fold: [SHN, [27, 39], [34, 41]],
  tie: [SHN, [29, 37], [33, 31]],
  chin: [SHN, [30, 36], [37, 28]],
  up: [SHN, [20, 29], [18, 22]],
};
const FAR: Record<FarFlip, readonly Pt[]> = {
  side: [SHF, [40, 38], [41, 45]],
  out: [SHF, [43, 37], [47, 40]],
  wave1: [SHF, [46, 27], [51, 16]],
  wave2: [SHF, [46, 28], [55, 19]],
  wave3: [SHF, [46, 27], [48, 14]],
  present: [SHF, [45, 35], [53, 33]],
  point: [SHF, [46, 29], [53, 22]],
  high: [SHF, [46, 26], [50, 13]],
};

// ---- Poses.

export interface Pose {
  mood?: Mood;
  /** Upper body down this many pixels (a breath, a bow). */
  bob?: number;
  hx?: number;
  hy?: number;
  /** The whole figure sideways. */
  dx?: number;
  /** Upper body sideways over the feet (the waddle). */
  lean?: number;
  air?: number;
  near?: NearFlip;
  far?: FarFlip;
  tie?: "ok" | "tilt";
  /** The cap: lifted off the head, sideways, knocked crooked, or gone. */
  capY?: number;
  capX?: number;
  capTilt?: boolean;
  noCap?: boolean;
  feet?: { n?: { x?: number; lift?: number }; f?: { x?: number; lift?: number } };
  sit?: boolean;
  noShadow?: boolean;
  noTail?: boolean;
}

function build(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const sit = p.sit ?? false;
  const ux = dx + (p.lean ?? 0);
  const uy = (p.bob ?? 0) - air + (sit ? -6 : 0);
  const layers: Layer[] = [];
  const add = (l: { name: string; at: Pt }, ox = 0, oy = 0) => layers.push({ part: l.name, x: l.at[0] + ox, y: l.at[1] + oy });
  const put = (part: string, x: number, y: number) => layers.push({ part, x, y });
  const mv = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [x + ux, y + uy]);

  if (!p.noShadow) put("shadow", 15 + dx, GROUND - 2);
  if (sit) put("stool", 19 + dx, 53);
  const fl = p.feet?.f ?? {};
  const nl = p.feet?.n ?? {};
  if (sit) put("foot:far", 38 + dx, 51);
  else put("foot:far", 33 + dx + (fl.x ?? 0), 57 - air - (fl.lift ?? 0));
  add(flipper(mv(FAR[p.far ?? "side"]), true));
  if (!p.noTail) put("tail", 14 + ux, 52 + uy);
  add(BODY, ux, uy);
  if (sit) put("foot", 34 + dx, 53);
  else put("foot", 26 + dx + (nl.x ?? 0), 57 - air - (nl.lift ?? 0));
  const hx = HX0 + (p.hx ?? 0) + ux;
  const hy = HY0 + (p.hy ?? 0) + uy + (sit ? 5 : 0);
  put(`head:${p.mood ?? "calm"}`, hx, hy);
  if (!p.noCap) put(p.capTilt ? "cap:tilt" : "cap", hx + 3 + (p.capX ?? 0), hy - 4 - (p.capTilt ? 1 : 0) - (p.capY ?? 0));
  put(p.tie === "tilt" ? "tie:tilt" : "tie", 33 + ux + (sit ? 1 : 0), 27 + uy - (p.tie === "tilt" ? 1 : 0) + (sit ? 5 : 0));
  add(flipper(mv(NEAR[p.near ?? "side"]), false));
  return layers;
}

// ---- Little effects.

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}
const star = (x: number, y: number, k = "g"): Speck[] => [[x, y, "y"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
function twinkles(t: number, n = 3, box: readonly [number, number, number, number] = [6, 4, 58, 40]): Speck[] {
  const rnd = seeded(t * 31 + 5);
  return Array.from({ length: n }, (_, i) => star(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])), (i + t) % 2 ? "g" : "x")).flat();
}
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) => [0, 1, 2].map((i): Speck => [Math.round(31 + side * (10 + i * 3 + t * 2)), GROUND - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "C" : "c"]));
const thoughts = (n: number): Speck[] =>
  ([[47, 14], [51, 10], [55, 6]] as const).slice(0, n).flatMap(([x, y], k): Speck[] => {
    const big = k === 2;
    return [[x, y, "w"], [x + 1, y, "w"], [x, y + 1, "w"], [x + 1, y + 1, "c"], ...(big ? ([[x - 1, y, "w"], [x + 2, y, "w"], [x, y - 1, "w"], [x + 1, y - 1, "w"], [x - 1, y + 1, "c"], [x + 2, y + 1, "C"], [x, y + 2, "c"], [x + 1, y + 2, "C"]] as Speck[]) : [])];
  });
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[19 - t, 12 + t, "j"], [19 - t, 13 + t, "x"], [47 + t, 9 + t, "j"], [47 + t, 10 + t, "x"]];
};
/** A little gold "!" over his head. */
const bang = (x: number, y: number): Speck[] => [[x, y, "y"], [x + 1, y, "g"], [x, y + 1, "g"], [x + 1, y + 1, "G"], [x, y + 2, "g"], [x + 1, y + 2, "G"], [x, y + 4, "g"], [x + 1, y + 4, "G"]];

const FLASH: Record<string, string> = { b: "#5a5f6c", B: "#6c7282", s: "#6a7186", S: "#8a93a8", t: "#4a5163", w: "#ffffff", W: "#ffffff" };

/** Lowers a frame drawn on the 64 x 64 grid into the taller frame. */
function low(fr: Frame): Frame {
  const specks = (fr.specks ?? []).map(([x, y, k]): Speck => [x, y + OY, k]).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ...fr, layers: fr.layers.map((l) => ({ ...l, y: l.y + OY })), specks };
}
function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  return low({ ms, layers: build(p), ...extra });
}

// ---- Animations.

/** Idle (3 s): breathes, a slow blink, straightens his bow tie with a flipper, a small polite nod. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const bob = i % 15 >= 8 ? 1 : 0;
    const blink = i === 5 || i === 6 || i === 28;
    const tieFix = i >= 12 && i <= 16;
    const nod = i === 20 ? 1 : i === 21 || i === 22 ? 2 : i === 23 ? 1 : 0;
    const mood: Mood = blink || (nod >= 2) ? "blink" : i === 16 ? "happy" : "calm";
    return f(100, {
      bob,
      mood,
      hy: nod,
      hx: nod > 1 ? 1 : 0,
      near: tieFix ? (i === 12 ? "fold" : "tie") : "side",
      tie: i >= 10 && i <= 13 ? "tilt" : "ok",
    });
  }),
};

/** Walk (0.6 s): a dignified waddle, rocking side to side, flippers out for balance, cap steady. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const lean = [-1, -1, 0, 1, 1, 0][i]!;
    return f(100, {
      lean,
      bob: i % 3 === 2 ? 0 : 1,
      mood: "calm",
      near: "out",
      far: "out",
      feet: { n: { lift: [2, 1, 0, 0, 0, 0][i]!, x: [1, 1, 0, 0, 0, 0][i]! }, f: { lift: [0, 0, 0, 2, 1, 0][i]!, x: [0, 0, 0, 1, 1, 0][i]! } },
    }, i === 2 || i === 5 ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool facing the board, flippers folded, a slow blink, leaning in to think now and then. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    return f(200, { sit: true, near: "fold", mood: blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : "calm", bob: i % 8 >= 4 ? 1 : 0, hx: lean ? 1 : 0, hy: lean ? 1 : 0 });
  }),
};

/** Wave (once, 1.2 s): raises a flipper in a courteous wave, a small bow, then back to his idle pose. */
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { mood: "open", far: "out" }),
    f(100, { mood: "happy", far: "wave1", hy: -1 }, { cue: "wave" }),
    f(100, { mood: "happy", far: "wave2", hy: -1 }),
    f(100, { mood: "happy", far: "wave1" }),
    f(100, { mood: "happy", far: "wave3", hy: -1 }),
    f(100, { mood: "happy", far: "wave1" }),
    f(100, { mood: "open", far: "out", near: "fold" }),
    f(100, { mood: "blink", near: "fold", bob: 1, hy: 1, hx: 1 }),
    f(150, { mood: "blink", near: "fold", bob: 1, hy: 2, hx: 2, lean: 1 }),
    f(100, { mood: "blink", near: "fold", bob: 1, hy: 1, hx: 1 }),
    f(150, { mood: "calm" }),
  ],
};

/** Entrance: waddles in from the left, stops, a small bow. */
const entrance: Anim = {
  loop: false,
  frames: [
    ...[-10, -8, -6, -4, -3, -1].map((dx, i) =>
      f(90, {
        dx,
        lean: [-1, 0, 1, -1, 0, 1][i]!,
        bob: i % 3 === 1 ? 0 : 1,
        mood: "calm",
        near: "out",
        far: "out",
        feet: { n: { lift: i % 3 === 0 ? 2 : 0 }, f: { lift: i % 3 === 2 ? 2 : 0 } },
      }, i % 3 === 1 ? { cue: "step" } : {}),
    ),
    f(120, { mood: "open" }, { cue: "step" }),
    f(100, { mood: "blink", near: "fold", bob: 1, hy: 1, hx: 1 }),
    f(250, { mood: "blink", near: "fold", bob: 1, hy: 2, hx: 2, lean: 1 }),
    f(100, { mood: "happy", near: "fold", hy: 1 }),
    f(300, { mood: "calm" }),
  ],
};

/** Thinking (loops): a flipper to his chin, eyes up, a foot tapping, thought puffs rising. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", near: "chin", hx: 1, hy: -1, bob: i % 6 >= 3 ? 1 : 0, feet: { f: i % 4 === 1 ? { lift: 1 } : {} } }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** His move: an "after you" sweep of the flipper toward the board. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { mood: "calm", bob: 1, far: "out" }),
    f(90, { mood: "open", far: "point", hy: -1 }),
    f(110, { mood: "open", far: "present", dx: 1, hx: 1 }, { cue: "whoosh" }),
    f(220, { mood: "happy", far: "present", dx: 1, hx: 1, near: "fold" }),
    f(110, { mood: "calm", far: "out", near: "fold" }),
    f(150, { mood: "calm" }),
  ],
};

/** A capture: a tidy little hop of delight, a flipper up, gold twinkles; then a satisfied smirk. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { mood: "open", bob: 2, far: "out" }),
    f(80, { mood: "happy", air: 3, far: "high", feet: { n: { lift: 1 }, f: { lift: 1 } } }, { cue: "ding", specks: twinkles(1) }),
    f(90, { mood: "happy", air: 4, far: "wave2", feet: { n: { lift: 1 }, f: { lift: 1 } } }, { specks: twinkles(2) }),
    f(80, { mood: "happy", air: 2, far: "high" }, { specks: twinkles(3) }),
    f(90, { mood: "happy", bob: 2, far: "out" }, { specks: dust(0) }),
    f(120, { mood: "happy", near: "tie", tie: "ok" }, { specks: twinkles(4, 2) }),
    f(250, { mood: "smug", near: "fold", hy: -1 }),
  ],
};

/** Hurt: a jolt that pops his cap up and knocks his tie askew; he winces, then puts himself back in order. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { mood: "hurt", bob: 2, capY: 4, capTilt: true, tie: "tilt", near: "out", far: "out" }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(80, { mood: "hurt", bob: 2, capY: 5, capTilt: true, tie: "tilt", near: "out", far: "out", dx: -1 }, { shake: [-1, 0], specks: [[18, 13, "j"], [18, 14, "x"]] }),
    f(90, { mood: "hurt", bob: 1, capY: 2, capTilt: true, tie: "tilt", dx: -1 }),
    f(110, { mood: "rattled", capTilt: true, tie: "tilt" }),
    f(110, { mood: "blink", capTilt: true, tie: "tilt", near: "fold" }),
    f(120, { mood: "calm", tie: "tilt", near: "tie" }),
    f(120, { mood: "calm", near: "tie" }),
    f(160, { mood: "calm" }),
  ],
};

/** Check: a raised flipper and a bright look, a little gold "!" - he announces it politely, twice. */
const check: Anim = {
  loop: false,
  frames: [
    f(100, { mood: "open", far: "out", bob: 1 }),
    f(140, { mood: "open", far: "high", hy: -1 }, { cue: "ding", specks: bang(52, 6) }),
    f(90, { mood: "open", far: "point" }, { specks: bang(52, 6) }),
    f(140, { mood: "happy", far: "high", hy: -1 }, { cue: "ding", specks: bang(52, 5) }),
    f(150, { mood: "smug", far: "point", near: "fold" }),
    f(160, { mood: "calm", near: "fold" }),
  ],
};

/** Smug: chin up, eyes half shut, a smirk, a flipper folded, a slow nod. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: i === 5 ? "blink" : "smug", near: "fold", hy: i < 3 || i > 5 ? -1 : 0, bob: i % 4 === 2 ? 1 : 0 })),
};

/** Rattled: pinprick eyes, a wobbly beak, trembling, cap and tie askew, sweat flying. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    f(80, { mood: "rattled", near: "out", far: "out", dx: i % 2 ? 1 : 0, bob: i % 4 === 2 ? 1 : 0, capTilt: true, capX: i % 2 ? 0 : 1, tie: "tilt" }, { specks: sweat(i) }),
  ),
};

/** Defeat: a jolt, the cap flies off, he wobbles and topples onto his back; the cap lands on his tummy. */
const LIE_CX = 38;
const LIE_CY = 40;
function lying(cap: Pt | null, extra: Speck[] = []): Frame["layers"] {
  const body = lieDown(PARTS, { layers: build({ mood: "out", noShadow: true, noTail: true, noCap: true, tie: "tilt", near: "side", far: "side" }) }, LIE_CX, LIE_CY, "left").layers;
  void extra;
  return [{ part: "shadow", x: 18, y: GROUND - 2 }, ...body, ...(cap ? [{ part: "cap:tilt", x: cap[0], y: cap[1] }] : [])];
}
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { mood: "hurt", bob: 2, capY: 5, capTilt: true, tie: "tilt", near: "out", far: "out" }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(100, { mood: "out", bob: 1, capY: 5, capX: 5, capTilt: true, tie: "tilt", near: "out", far: "out", lean: -1 }),
    f(110, { mood: "out", bob: 2, noCap: true, tie: "tilt", near: "out", far: "out", lean: 1 }, { specks: star(52, 4) }),
    f(110, { mood: "out", bob: 2, noCap: true, tie: "tilt", near: "up", far: "out", lean: -2 }),
    low({ ms: 120, layers: lying([40, 20]), cue: "poof", shake: [1, 0], specks: dust(0) }),
    low({ ms: 160, layers: lying([38, 26]), specks: [...star(14, 30), ...star(24, 26, "x")] }),
    low({ ms: 1000, layers: lying([37, 29]), specks: [...star(16, 28, "x"), ...star(26, 25)] }),
  ],
};

/** Victory: happy hops, waving, gold twinkles all round. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 2, 4, 4, 2, 0, 0, 2, 4, 4, 2, 0][i]!;
    const far: FarFlip[] = ["out", "wave1", "wave2", "wave3", "wave1", "out", "out", "high", "wave2", "wave1", "high", "out"];
    return f(110, {
      air,
      bob: air === 0 ? 1 : 0,
      mood: air > 1 ? "happy" : "open",
      far: far[i]!,
      near: air > 1 ? "out" : "fold",
      feet: air > 1 ? { n: { lift: 1 }, f: { lift: 1 } } : {},
      hy: air > 2 ? -1 : 0,
    }, { specks: twinkles(i, 3), cue: i === 2 || i === 8 ? "ding" : undefined });
  }),
};

export const SIDEKICK_TOWER_CLERK: Character = {
  id: "sidekick-tower-clerk",
  name: "Clerk",
  w: W,
  h: H,
  foot: [30, GROUND + OY],
  palette: CLERK_PALETTE,
  halo: "#323846",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
