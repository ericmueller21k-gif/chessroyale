/**
 * Hollow's sidekick (id "sidekick-hollow"): a baby shadow critter, a town bot that wanders the square and plays chess
 * at the park's tables. No powers, never fights: a friendly, curious kid who copies the big one, so it carries ONE
 * Christmas bulb on a short bit of wire, like a lantern, glowing softly red.
 *
 * Round and fluffy where Hollow is lanky and shaggy: a big round head of charcoal fur with big glowing gold eyes, two
 * tiny round ears, a cowlick, a small happy mouth, a round fuzzy body and stubby legs. His charcoal fur and violet
 * edge glow (a violet rim on the shadow side, and the halo) are borrowed from HOLLOW_PALETTE. Three-quarters, facing
 * our right, light from the top left.
 *
 * Rigging: the head (one per face), the body, ears, feet and bulb are painted once; the arms are painted from points
 * (shoulder, elbow, paw) per pose, so a new pose is a handful of numbers. The bulb's glow is a see-through part
 * behind everything; a frame's palette pulses it (`lamp`).
 */
import { canvas, ellipse, line, poly, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import { lieDown, partSize, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../../../../packages/app/src/characters/sprite.ts";

export const SIDEKICK_HOLLOW_PALETTE = {
  k: "#08070c", // outline
  n: "#121118", // deepest fur
  d: "#222130", // charcoal fur, dark to light
  c: "#333042",
  C: "#484459",
  h: "#675f86",
  V: "#2e1a52", // violet rim on the shadow side
  u: "#6e46bd",
  U: "#a67fff",
  x: "#f7f1ff", // white shine
  e: "#ffcf3a", // eyes: gold glow, hot core, amber rim, pupil, glow on the fur
  E: "#fff3b0",
  a: "#d9861c",
  s: "#3a1d07",
  F: "#473a24",
  q: "#8f4f9f", // blush
  T: "#d9668f", // nose, tongue
  m: "#2a0f2e", // mouth inside
  B: "#a89ec9", // brows
  R: "#ff4a3d", // the bulb: glass, shade, glint
  r: "#b3182f",
  P: "#ffe2da",
  W: "#c3bed3", // socket, wire
  w: "#6c687c",
  y: "#a9a4bc",
  N: "#ff9a78a0", // the bulb's glow: core, inner and outer rings (see-through)
  g: "#ff624466",
  G: "#ff5a3a2a",
  j: "#8fd0ff", // sweat
  t: "#ebe2ff", // thought dots
  D: "#5b576a", // dust
  Y: "#ffd23a", // sparkle gold
  l: "#93602f", // stool wood, light to dark
  o: "#684422",
  O: "#40281a",
  z: "#0d0e12", // ground shadow
} as const;

type Pt = readonly [number, number];

/** The frame, and the ground (the first row below the feet). */
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
function crop(cv: Canvas, outline = true): Painted {
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
  if (x1 < 0) return { part: { grid: ["."], outline }, at: [0, 0] };
  return { part: { grid: cv.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline }, at: [x0, y0] };
}

// ---- Small helpers.

const hash2 = (x: number, y: number, s: number) => (((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(s, 83492791)) >>> 0) % 10007) / 10007;
const tri = (u: number) => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
const FURS = "dcCh";
/** Fur by a light value (0 dark to 1 light): banded, never blended. */
const furAt = (l: number) => (l < 0.2 ? "d" : l < 0.5 ? "c" : l < 0.8 ? "C" : "h");
const isFur = (k: string | undefined) => !!k && FURS.includes(k);

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
/** Darker fur flecks, and the violet rim on the right and lower edges (the shadow side). */
function texture(cv: Canvas, seed: number): void {
  const src = cv.map((r) => [...r]);
  const h = cv.length;
  const w = cv[0]!.length;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = src[y]![x]!;
      if (k === "C" || k === "c") {
        if (hash2(x, y, seed) < 0.09) {
          cv[y]![x] = k === "C" ? "c" : "d";
          if (src[y + 1]?.[x] === k) cv[y + 1]![x] = k === "C" ? "c" : "d";
        }
      }
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = src[y]![x]!;
      if (!isFur(k)) continue;
      const open = (dx: number, dy: number) => (src[y + dy]?.[x + dx] ?? ".") === ".";
      if (open(1, 0) || open(0, 1)) cv[y]![x] = hash2(x, y, seed + 5) < 0.3 ? "u" : "V";
    }
}

// ---- Faces. Big glowing gold eyes (a near one, a far one), blush, a tiny nose, a small mouth.

export type Mood = "calm" | "blink" | "happy" | "cheer" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold" | "sleepy" | "wow";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "x" | "side";
type Brow = "up" | "worried" | "bold" | "smug";
type Mouth = "smile" | "grin" | "flat" | "smirk" | "wavy" | "o" | "tongue" | "oh";

function eyeRows(kind: Eye, w: number, h: number, near: boolean): string[] {
  const cv = canvas(w, h);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rx = w / 2;
  const ry = h / 2;
  const ins = (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const orb = (lid = 0) => {
    for (let y = lid; y < h; y++) for (let x = 0; x < w; x++) if (ins(x, y)) cv[y]![x] = ((x - cx + 0.5) / rx) ** 2 + ((y - cy + 0.5) / ry) ** 2 <= 0.34 ? "E" : "e";
    for (let y = lid; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!ins(x, y)) continue;
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !ins(x + dx!, y + dy!) || y + dy! < lid);
        if (edge) cv[y]![x] = "a";
      }
  };
  const pupil = (px: number, py: number, pr: number, qr: number) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ins(x, y) && cv[y]![x] !== "a" && ((x - px) / pr) ** 2 + ((y - py) / qr) ** 2 <= 1) cv[y]![x] = "s";
  };
  const shine = (sx: number, sy: number) => dots(cv, [[sx, sy], [sx + 1, sy], [sx, sy + 1], [sx + 1, sy + 1]], "x");
  const sx = Math.floor(cx - 0.8);
  const sy = Math.floor(cy - 2);
  switch (kind) {
    case "open":
      orb();
      pupil(cx + 0.7, cy + 0.6, 0.95, 1.5);
      shine(sx, sy);
      break;
    case "side":
      orb();
      pupil(cx + 1.3, cy + 0.3, 0.95, 1.5);
      shine(sx, sy);
      break;
    case "up":
      orb();
      pupil(cx + 0.6, cy - 1.2, 0.95, 1.4);
      shine(sx, sy + 1);
      break;
    case "wide":
      orb();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ins(x, y) && cv[y]![x] === "e" && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 0.62) cv[y]![x] = "E";
      pupil(cx + 0.3, cy + 0.4, 0.55, 1.0);
      shine(sx, sy);
      break;
    case "half": {
      const lid = Math.floor(cy);
      orb(lid);
      pupil(cx + 0.8, cy + 1.4, 0.95, 1.1);
      dots(cv, [[sx, lid + 1], [sx + 1, lid + 1]], "x");
      break;
    }
    case "arc":
      for (let x = 0; x < w; x++) {
        const y = Math.floor(cy) - 1 + Math.round(2.2 * ((x - cx) / rx) ** 2);
        cv[y]![x] = Math.abs(x - cx) < 1.5 ? "E" : "e";
      }
      break;
    case "shut":
      for (let x = 0; x < w; x++) {
        const y = Math.floor(cy) + 1 - Math.round(1.4 * ((x - cx) / rx) ** 2);
        cv[y]![x] = Math.abs(x - cx) < 2 ? "e" : "a";
      }
      break;
    case "pinch": {
      const x0 = Math.floor((w - 6) / 2);
      for (let t = -2; t <= 2; t++) {
        const xx = (2 - Math.abs(t)) * 2;
        const y = Math.floor(cy) + t;
        for (const dx of [0, 1]) cv[y]![x0 + (near ? xx + dx : 4 - xx + dx)] = "e";
      }
      break;
    }
    case "x": {
      const x0 = Math.floor((w - 5) / 2);
      const y0 = Math.floor((h - 5) / 2);
      for (let i = 0; i < 5; i++) {
        cv[y0 + i]![x0 + i] = "e";
        cv[y0 + i]![x0 + 4 - i] = "e";
      }
      break;
    }
  }
  return cv.map((r) => r.join(""));
}

/** Brows, [near, far], on the head grid: little pale lines over the eyes. */
const BROWS: Record<Brow, readonly [readonly Pt[], readonly Pt[]]> = {
  up: [[[10, 10], [11, 10], [12, 10], [13, 10], [14, 10]], [[20, 11], [21, 11], [22, 11], [23, 11], [24, 11]]],
  worried: [[[9, 11], [10, 11], [11, 10], [12, 10], [13, 9], [14, 9]], [[19, 9], [20, 9], [21, 10], [22, 10], [23, 11], [24, 11]]],
  bold: [[[9, 9], [10, 9], [11, 10], [12, 10], [13, 11], [14, 11]], [[19, 11], [20, 11], [21, 10], [22, 10], [23, 9], [24, 9]]],
  smug: [[[10, 10], [11, 10], [12, 10], [13, 10]], [[20, 9], [21, 9], [22, 10], [23, 10]]],
};
const MOUTHS: Record<Mouth, readonly string[]> = {
  smile: ["k...k", ".kkk."],
  grin: ["kkkkk", "kmmmk", ".kTk."],
  flat: [".kkk."],
  smirk: ["...kk", "kkkk."],
  wavy: ["k.k.k", ".k.k."],
  o: [".kk.", "kmmk", ".kk."],
  tongue: ["kkkkk", "kTTTk", ".kTk."],
  oh: ["kkk", "kmk", "kkk"],
};
const FACES: Record<Mood, { near: Eye; far: Eye; brow?: Brow; mouth: Mouth; blush?: boolean }> = {
  calm: { near: "open", far: "open", mouth: "smile", blush: true },
  blink: { near: "shut", far: "shut", mouth: "smile", blush: true },
  happy: { near: "arc", far: "arc", mouth: "grin", blush: true },
  cheer: { near: "open", far: "open", brow: "up", mouth: "grin", blush: true },
  think: { near: "up", far: "up", brow: "up", mouth: "flat" },
  thinkBlink: { near: "shut", far: "shut", brow: "up", mouth: "flat" },
  smug: { near: "half", far: "half", brow: "smug", mouth: "smirk", blush: true },
  rattled: { near: "wide", far: "wide", brow: "worried", mouth: "wavy" },
  hurt: { near: "pinch", far: "pinch", brow: "worried", mouth: "o" },
  out: { near: "x", far: "x", mouth: "tongue" },
  bold: { near: "open", far: "side", brow: "bold", mouth: "grin", blush: true },
  sleepy: { near: "half", far: "half", mouth: "smile", blush: true },
  wow: { near: "wide", far: "wide", brow: "up", mouth: "oh", blush: true },
};

const HW = 32;
const HH = 28;
const SK = { cx: 16, cy: 17.5, rx: 13.4, ry: 10.4 };

function head(mood: Mood): Part {
  const cv = canvas(HW, HH);
  const mask = canvas(HW, HH);
  for (let y = 0; y < HH; y++)
    for (let x = 0; x < HW; x++) {
      const dx = (x - SK.cx) / SK.rx;
      const dy = (y - SK.cy) / SK.ry;
      const a = Math.atan2(dy, dx);
      if (Math.hypot(dx, dy) <= 1 + 0.075 * tri((a / (2 * Math.PI)) * 22)) mask[y]![x] = "#";
    }
  poly(mask, [[4.8, 19], [4.2, 26], [1.4, 23.2]], "#"); // the near cheek tuft
  poly(mask, [[26.2, 19.5], [27.2, 26], [30.6, 23]], "#"); // the far one
  poly(mask, [[15, 9], [19.5, 9], [21.5, 2.5]], "#"); // the cowlick
  const muzzle = (x: number, y: number) => ((x - 21) / 5.2) ** 2 + ((y - 23.4) / 3.6) ** 2 <= 1;
  for (let y = 0; y < HH; y++)
    for (let x = 0; x < HW; x++) {
      if (mask[y]![x] !== "#") continue;
      const nx = (x - SK.cx) / (SK.rx * 1.12);
      const ny = (y - SK.cy) / (SK.ry * 1.12);
      let k = furAt(0.5 - 0.42 * nx - 0.5 * ny);
      if (muzzle(x, y)) k = k === "d" ? "c" : k === "c" ? "C" : k === "C" ? "h" : k;
      cv[y]![x] = k;
    }
  texture(cv, 17);
  const face = FACES[mood];
  const near = eyeRows(face.near, 8, 9, true);
  const far = eyeRows(face.far, 7, 8, false);
  stamp(cv, near, 9, 12);
  stamp(cv, far, 19, 13);
  // A faint gold glow on the fur right round the eyes.
  const src = cv.map((r) => [...r]);
  for (let y = 0; y < HH; y++)
    for (let x = 0; x < HW; x++) {
      if (!isFur(src[y]![x])) continue;
      if (face.near === "x" || face.near === "pinch" || face.near === "shut" || face.near === "arc") continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => "eEa".includes(src[y + dy!]?.[x + dx!] ?? "."))) cv[y]![x] = "F";
    }
  if (face.brow) for (const side of BROWS[face.brow]) dots(cv, side, "B");
  stamp(cv, ["TT"], 19, 22); // the nose
  if (face.blush) dots(cv, [[9, 22], [10, 22], [11, 22], [24, 22], [25, 22], [26, 22]], "q");
  const mouth = MOUTHS[face.mouth];
  const mx = mouth[0]!.length === 5 ? 18 : mouth[0]!.length === 4 ? 18 : 19;
  stamp(cv, mouth, mx, 24);
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["calm", "blink", "happy", "cheer", "think", "thinkBlink", "smug", "rattled", "hurt", "out", "bold", "sleepy", "wow"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);

// ---- Small fixed parts.

PARTS["ear:mid"] = { grid: ["..cc..", ".cCCc.", "cCVuCc", "cCVVCc", ".cccc."] };
PARTS["ear:up"] = { grid: ["..cC..", ".cCCc.", ".cCuc.", "cCVuCc", "cCVVCc", ".cccc."] };
PARTS["ear:down"] = { grid: [".cCCc.", "cCVuCc", "cCVVcc", ".cccc."] };
PARTS["tail"] = { grid: [".Cc..", "CChc.", "cCCcd", ".cccd", "..dd."] };
PARTS["foot"] = { grid: [".cCcd.", ".cCcd.", "cCCccd", "ccccdd", "cdcdcd", "nnnnnn"] };
PARTS["bulb"] = { grid: [".wWw.", ".wWw.", "RPRRr", "RPRRr", "RRRRr", ".RRr.", "..r.."] };
PARTS["shadow"] = (() => {
  const cv = canvas(34, 3);
  ellipse(cv, 17, 1.5, 17, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();
PARTS["stool"] = {
  grid: [
    "llllllllllllllllllllllllll",
    "oooooooooooooooooooooooooo",
    "OOOOOOOOOOOOOOOOOOOOOOOOOO",
    "...oO................oO...",
    "...oO................oO...",
    "...oOOOOOOOOOOOOOOOOOOoO...",
    "...oO................oO...",
    "...oO................oO...",
    "...oO................oO...",
  ],
};
/** The bulb's glow: see-through rings round the glass, in three sizes. */
const GLOWS: readonly (readonly [number, number])[] = [[3.4, 5.2], [4.3, 6.8], [5.3, 8.6]];
GLOWS.forEach(([r1, r2], i) => {
  const c = Math.ceil(r2);
  const n = c * 2 + 1;
  const cv = canvas(n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - c, (y - c) / 0.8);
      if (d <= r1 * 0.6) cv[y]![x] = "N";
      else if (d <= r1) cv[y]![x] = "g";
      else if (d <= r2 && (x + y) % 2 === 0) cv[y]![x] = "G";
    }
  PARTS[`glow:${i}`] = { grid: toGrid(cv), outline: false };
});
const GLOW_C = GLOWS.map(([, r2]) => Math.ceil(r2));

// ---- Body: a round fuzzy ball with a lighter tummy.

function bodyPart(): Painted {
  const cv = canvas(W, H);
  const cx = 10;
  const cy = 9;
  for (let y = 0; y < 18; y++)
    for (let x = 0; x < 21; x++) {
      const dx = (x - cx) / 9.6;
      const dy = (y - cy) / 7.6;
      const a = Math.atan2(dy, dx);
      if (Math.hypot(dx, dy) > 1 + 0.09 * tri((a / (2 * Math.PI)) * 16 + 0.3)) continue;
      let k = furAt(0.48 - 0.4 * (dx / 1.1) - 0.5 * (dy / 1.1));
      if (((x - 12.5) / 5.4) ** 2 + ((y - 11) / 4.4) ** 2 <= 1) k = k === "d" ? "c" : k === "c" ? "C" : k;
      cv[y]![x] = k;
    }
  texture(cv, 29);
  // Two little fur chevrons on the tummy.
  dots(cv, [[11, 12], [12, 13], [13, 12]], "h");
  dots(cv, [[15, 13], [16, 14], [17, 13]], "C");
  return crop(cv);
}
const BODY = painted("body", bodyPart);

// ---- Arms: a round fuzzy stroke through a few points, a paw ball at the end.

function nearest(p: Pt, pts: readonly Pt[]): { d: number; nx: number; ny: number } {
  let best = { d: Infinity, nx: 0, ny: 0 };
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
    const nx = p[0] - (a[0] + t * vx);
    const ny = p[1] - (a[1] + t * vy);
    const d = Math.hypot(nx, ny);
    if (d < best.d) best = { d, nx, ny };
  }
  return best;
}
function stroke(pts: readonly Pt[], r: number, ball: number): Painted {
  const cv = canvas(W, H);
  const end = pts[pts.length - 1]!;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const de = Math.hypot(x - end[0], y - end[1]);
      if (de <= ball) {
        cv[y]![x] = furAt(0.58 - 0.42 * ((x - end[0]) / ball) - 0.48 * ((y - end[1]) / ball));
        continue;
      }
      const n = nearest([x, y], pts);
      if (n.d > r) continue;
      cv[y]![x] = furAt(0.56 - 0.45 * (n.nx / r) - 0.5 * (n.ny / r));
    }
  // The shadow side of the paw: a violet rim.
  const src = cv.map((row) => [...row]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (isFur(src[y]![x]) && ((src[y]![x + 1] ?? ".") === "." || (src[y + 1]?.[x] ?? ".") === ".") && hash2(x, y, 3) < 0.55) cv[y]![x] = "V";
  return crop(cv);
}
function arm(pts: readonly Pt[]): Painted & { name: string } {
  return painted(`arm:${pts.map((p) => p.join(",")).join(";")}`, () => stroke(pts, 1.9, 2.5));
}
function wire(from: Pt, to: Pt): Painted & { name: string } {
  return painted(`wire:${from}:${to}`, () => {
    const cv = canvas(W, H);
    line(cv, from[0], from[1], to[0], to[1], "y");
    return crop(cv, false);
  });
}

// ---- Poses.

const SH: Pt = [33, 46];
export type ArmName = "hold" | "low" | "fwd" | "point" | "up" | "high" | "waveL" | "waveM" | "waveR" | "down" | "lap" | "swing";
const ARMS: Record<ArmName, readonly [Pt, Pt, Pt]> = {
  hold: [SH, [37, 48], [41, 46]],
  low: [SH, [36, 50], [39, 52]],
  fwd: [SH, [38, 48], [45, 46]],
  point: [SH, [40, 47], [48, 44]],
  up: [SH, [38, 45], [43, 40]],
  high: [SH, [39, 43], [45, 35]],
  waveL: [SH, [38, 44], [42, 37]],
  waveM: [SH, [39, 44], [45, 36]],
  waveR: [SH, [40, 44], [48, 37]],
  down: [SH, [36, 50], [38, 52]],
  lap: [SH, [37, 50], [39, 52]],
  swing: [SH, [38, 49], [44, 49]],
};
export type FreeName = "hang" | "up" | "chin" | "out" | "scratchA" | "scratchB";
const FREE: Record<FreeName, { pts: readonly [Pt, Pt, Pt]; front: boolean }> = {
  hang: { pts: [[18, 46], [14, 49], [14, 53]], front: false },
  out: { pts: [[18, 46], [13, 48], [10, 52]], front: false },
  up: { pts: [[18, 45], [13, 40], [12, 34]], front: false },
  chin: { pts: [[20, 47], [23, 50], [28, 43]], front: true },
  scratchA: { pts: [[18, 46], [10, 38], [16, 29]], front: true },
  scratchB: { pts: [[18, 46], [10, 37], [17, 27]], front: true },
};

export interface Pose {
  mood?: Mood;
  /** The whole upper body down this many pixels (a breath, a crouch). */
  bob?: number;
  hx?: number;
  hy?: number;
  dx?: number;
  /** Off the ground. */
  air?: number;
  feet?: { b?: { x?: number; lift?: number }; f?: { x?: number; lift?: number } };
  arm?: ArmName;
  free?: FreeName;
  /** The bulb swings this many pixels sideways; the wire's length. */
  sway?: number;
  len?: number;
  /** Where the bulb's socket hangs (its top middle), if it's set down rather than carried. */
  bulb?: Pt;
  /** How bright the bulb glows: 0 out, 0.5 as drawn, up to about 1.3. */
  lamp?: number;
  ear?: "mid" | "up" | "down";
  tail?: number;
  sit?: boolean;
  /** The sitter's dangling feet swing. */
  swingFeet?: number;
}

const mixc = (a: string, b: string, t: number) => {
  const ch = (c: string, i: number) => parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, "0")).join("")}`;
};
const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
/** The bulb's colors for a brightness: the glass, its shade, its glint, and the two rings of glow. */
function lampPal(l: number): Record<string, string> {
  if (l <= 0.02) return { R: "#4a3040", r: "#2a1822", P: "#6a4e5c", N: "#00000000", g: "#00000000", G: "#00000000" };
  const glass = l <= 0.5 ? mixc("#6a2a36", "#ff4a3d", l / 0.5) : mixc("#ff4a3d", "#ff8068", (l - 0.5) / 0.7);
  const shade = l <= 0.5 ? mixc("#3c1a26", "#b3182f", l / 0.5) : mixc("#b3182f", "#d9304a", (l - 0.5) / 0.7);
  const glint = l <= 0.5 ? mixc("#8a6470", "#ffe2da", l / 0.5) : mixc("#ffe2da", "#ffffff", (l - 0.5) / 0.7);
  return { R: glass, r: shade, P: glint, N: `#ffa585${hex2(0x50 + 0x70 * l)}`, g: `#ff6a4a${hex2(0x28 + 0x60 * l)}`, G: `#ff6a4a${hex2(0x20 + 0x40 * l)}` };
}
const glowSize = (l: number) => (l < 0.12 ? -1 : l < 0.42 ? 0 : l < 0.9 ? 1 : 2);

function build(p: Pose): { layers: Layer[]; bulbC: Pt | null } {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const bob = p.bob ?? 0;
  const sit = p.sit ?? false;
  const by = bob - air;
  const ux = (sit ? -2 : 0) + dx;
  const uy = (sit ? -3 : 0) + by;
  const layers: Layer[] = [];
  const add = (l: { name: string; at: Pt }, ox = 0, oy = 0) => layers.push({ part: l.name, x: l.at[0] + ox, y: l.at[1] + oy });
  const put = (part: string, x: number, y: number) => layers.push({ part, x, y });
  const shift = (pts: readonly Pt[]) => pts.map((q): Pt => [q[0] + ux, q[1] + uy]);
  put("shadow", 9 + dx, GROUND - 2);
  if (sit) put("stool", 10 + dx, 52);
  // The tail, a little ball behind.
  put("tail", 10 + ux, 46 + uy - (p.tail ?? 0) * 2);
  // Feet (a sitter's dangle in front of the body, after it).
  if (!sit) {
    const b = p.feet?.b;
    const f2 = p.feet?.f;
    put("foot", 18 + dx + (b?.x ?? 0), 55 - air - (b?.lift ?? 0));
    put("foot", 28 + dx + (f2?.x ?? 0), 55 - air - (f2?.lift ?? 0));
  }
  const free = FREE[p.free ?? "hang"];
  if (!free.front) add(arm(shift(free.pts)));
  put(BODY.name, 15 + BODY.at[0] + ux, 39 + BODY.at[1] + uy);
  if (sit) {
    const sw = p.swingFeet ?? 0;
    put("foot", 28 + dx, 52 + sw);
    put("foot", 32 + dx, 52 - sw);
  }
  const ear = p.ear ?? "mid";
  const hx = 13 + (p.hx ?? 0) + ux;
  const hy = 14 + (p.hy ?? 0) + uy;
  const eo = ear === "up" ? -1 : ear === "down" ? 1 : 0;
  put(`ear:${ear}`, hx + 21, hy + 4 + (ear === "down" ? 3 : 0) + eo);
  put(`ear:${ear}`, hx + 4, hy + 5 + (ear === "down" ? 3 : 0) + eo);
  put(`head:${p.mood ?? "calm"}`, hx, hy);
  if (free.front) add(arm(shift(free.pts)));
  // The near arm, the wire and the bulb.
  const a = shift(ARMS[p.arm ?? "hold"]);
  const paw = a[2]!;
  add(arm(a));
  const sock: Pt = p.bulb ?? [paw[0] + (p.sway ?? 0), Math.min(54 - air, paw[1] + 3 + (p.len ?? 3))];
  const w0: Pt = [paw[0], paw[1] + 3];
  const w1: Pt = [sock[0], sock[1] - 1];
  if (w1[1] >= w0[1]) add(wire(w0, w1));
  put("bulb", sock[0] - 2, sock[1]);
  const lamp = p.lamp ?? 0.5;
  const bulbC: Pt = [sock[0], sock[1] + 4];
  let gs = glowSize(lamp);
  while (gs >= 0 && bulbC[1] + Math.floor(GLOWS[gs]![1] * 0.8) > 62) gs--;
  if (gs >= 0) layers.unshift({ part: `glow:${gs}`, x: bulbC[0] - GLOW_C[gs]!, y: bulbC[1] - GLOW_C[gs]! });
  return { layers, bulbC };
}

/** One frame: the pose, and anything extra. */
function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const b = build(p);
  const specks = (extra.specks ?? []).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, ...extra, layers: b.layers, pal: { ...lampPal(p.lamp ?? 0.5), ...(extra.pal ?? {}) }, specks };
}

// ---- Specks: sparkles and little effects.

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}
const star = (x: number, y: number, k = "Y"): Speck[] => [[x, y, "x"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
function twinkles(t: number, n = 4, box: readonly [number, number, number, number] = [6, 6, 58, 44]): Speck[] {
  const rnd = seeded(t * 31 + 5);
  const cols = ["Y", "U", "R", "Y"];
  return Array.from({ length: n }, (_, i) => star(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])), cols[(i + t) % 4]!)).flat();
}
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) => [0, 1, 2].map((i): Speck => [Math.round(26 + side * (9 + i * 3 + t * 2)), GROUND - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "n" : "D"]));
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  const drop = (x: number, y: number): Speck[] => [[x, y, "j"], [x - 1, y + 1, "j"], [x, y + 1, "x"], [x + 1, y + 1, "j"], [x, y + 2, "j"]];
  return [...drop(14 - t, 21 + t), ...drop(47 + t, 19 + t)];
};
const thoughts = (n: number): Speck[] =>
  ([[47, 17], [51, 13], [55, 9]] as const).slice(0, n).flatMap(([x, y], k): Speck[] => {
    const base: Speck[] = [[x, y, "t"], [x + 1, y, "t"], [x, y + 1, "t"], [x + 1, y + 1, "B"]];
    return k === 2 ? [...base, [x - 1, y, "t"], [x + 2, y, "t"], [x, y - 1, "t"], [x + 1, y - 1, "t"], [x - 1, y + 1, "B"], [x + 2, y + 1, "B"], [x, y + 2, "B"], [x + 1, y + 2, "B"]] : base;
  });
/** Darkness curling up off the critter: wisps of violet. */
const wisps = ([x, y]: Pt, t: number, n = 4, spread = 8): Speck[] =>
  Array.from({ length: n }, (_, i): Speck[] => {
    const px = Math.round(x + Math.sin(i * 2.1 + t * 0.6) * spread * (0.4 + (i % 3) * 0.3));
    const py = Math.round(y - ((t * 2 + i * 4) % 12));
    return [[px, py, i % 2 ? "u" : "U"], [px + (i % 2 ? 1 : -1), py - 1, "V"]];
  }).flat();
/** Darkness gathering to a point (`t` 0 to 1). */
const gather = ([x, y]: Pt, t: number, n = 9): Speck[] =>
  Array.from({ length: n }, (_, i): Speck => {
    const a = (i / n) * Math.PI * 2 + t * 3;
    const r = 15 * (1 - t) + 2;
    return [Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.7), i % 3 === 0 ? "U" : i % 2 ? "u" : "V"];
  });
/** Dizzy stars circling over the head. */
const dizzy = (cx: number, cy: number, t: number): Speck[] =>
  [0, 1, 2].flatMap((i): Speck[] => {
    const a = (i / 3) * Math.PI * 2 + t * 1.3;
    const x = Math.round(cx + Math.cos(a) * 9);
    const y = Math.round(cy + Math.sin(a) * 3);
    return star(x, y, i % 2 ? "Y" : "U");
  });
const confetti = (t: number): Speck[] => {
  const rnd = seeded(t * 13 + 7);
  const cols = ["R", "Y", "U", "x", "e"];
  return Array.from({ length: 10 }, (_, i): Speck[] => {
    const x = Math.round(4 + rnd() * 54);
    const y = Math.round(((rnd() * 50 + t * 6) % 50) + 3);
    const k = cols[i % 5]!;
    return i % 2 ? [[x, y, k], [x + 1, y, k]] : [[x, y, k], [x, y + 1, k]];
  }).flat();
};
const FLASH: Record<string, string> = { d: "#6a6478", c: "#8f899e", C: "#b9b3c6", h: "#ffffff", V: "#8a72c0", u: "#b79cff" };

// ---- Animations.

/** Idle (3 s): breathes, blinks, flicks an ear and its tail, glances ahead; the bulb pulses and sways. */
const SWAY15 = [0, 0, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1, 0, 0] as const;
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const bob = i % 15 >= 8 ? 1 : 0;
    const blink = i === 11 || i === 12 || i === 27;
    const ear = i === 20 || i === 21 ? "down" : i === 22 ? "up" : "mid";
    const tail = i >= 4 && i <= 7 ? (i % 2 ? 1 : -1) : 0;
    const hx = i >= 24 ? 1 : 0;
    return f(100, { bob, mood: blink ? "blink" : "calm", ear, tail, hx, sway: SWAY15[i % 15]!, lamp: 0.55 + 0.3 * Math.sin((i / 15) * Math.PI * 2) }, { specks: i === 17 || i === 18 ? star(49, 25, i === 17 ? "U" : "u").slice(0, i === 17 ? 5 : 1) : [] });
  }),
};

/** Walk (0.64 s): a soft hop-step, the head bobbing a beat behind, the bulb swinging. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const th = (i / 8) * Math.PI * 2;
    const air = [0, 1, 2, 1, 0, 1, 2, 1][i]!;
    const leg = (off: number) => ({ x: Math.round(2.5 * Math.sin(th + off * Math.PI)), lift: Math.max(0, Math.round(2 * Math.cos(th + off * Math.PI))) });
    return f(80, { air, bob: i % 4 === 0 ? 1 : 0, hy: i % 4 === 1 || i % 4 === 2 ? -1 : 0, hx: 1, mood: "calm", feet: { b: leg(0), f: leg(1) }, tail: i < 4 ? 1 : -1, ear: air > 1 ? "up" : "mid", sway: Math.round(2 * Math.sin(th - 1.2)), lamp: 0.6 + 0.15 * Math.sin(th) }, i % 4 === 0 ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the chess table facing the board, legs dangling, the bulb set down by the stool; thinks about a move. */
const SIT: Pose = { sit: true, arm: "lap", bulb: [42, 54], lamp: 0.35 };
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    const slow = i === 14 || i === 15;
    const mood: Mood = blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : slow ? "sleepy" : "calm";
    return f(200, { ...SIT, mood, bob: i % 8 >= 4 ? 1 : 0, hx: lean ? 2 : 0, hy: lean ? 1 : 0, ear: i === 9 ? "down" : "mid", tail: i % 8 < 4 ? 0 : 1, swingFeet: i % 8 < 4 ? 0 : 1, lamp: 0.32 + 0.12 * Math.sin((i / 8) * Math.PI * 2) }, {});
  }),
};

/** Wave (once, 1.2 s): lifts the bulb and waves it hello, glowing brighter, then settles back to its idle pose. */
const WAVES: readonly ArmName[] = ["waveL", "waveM", "waveR", "waveM", "waveL", "waveM", "waveR", "waveM"];
const wave: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 1, mood: "happy", arm: "hold", lamp: 0.6 }),
    f(100, { mood: "cheer", arm: "up", hy: -1, ear: "up", lamp: 1.0 }, { cue: "twinkle" }),
    ...WAVES.map((a, i) =>
      f(100, { mood: i % 2 ? "cheer" : "happy", arm: a, hx: a === "waveL" ? -1 : a === "waveR" ? 1 : 0, hy: i % 2 ? 0 : -1, bob: i % 2 ? 1 : 0, tail: i % 2 ? 1 : -1, ear: i % 4 === 1 ? "up" : "mid", sway: a === "waveL" ? -2 : a === "waveR" ? 2 : 0, lamp: 1.25 - 0.04 * i }, { specks: i % 3 === 0 ? star(44 + (i % 5) * 2, 22 + (i % 4) * 2, i % 2 ? "U" : "Y") : [] }),
    ),
    f(110, { mood: "happy", arm: "hold", lamp: 0.8 }),
    f(120, { mood: "calm", arm: "hold", lamp: 0.6 }),
  ],
};

/** Entrance: darkness gathers, two gold eyes open in it, the critter pops out and its bulb flickers on: ta-da. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 100, layers: [], specks: gather([27, 46], 0, 9), cue: "hum" },
    { ms: 100, layers: [], specks: [...gather([27, 46], 0.5, 9), [26, 44, "e"], [26, 45, "e"], [31, 44, "e"], [31, 45, "e"]] },
    f(90, { bob: 4, mood: "blink", arm: "low", lamp: 0, ear: "down" }, { specks: wisps([27, 56], 0, 4, 8) }),
    f(70, { air: 5, mood: "cheer", arm: "up", lamp: 0, feet: { b: { lift: 2 }, f: { lift: 2 } }, ear: "up" }, { specks: wisps([27, 52], 1, 4, 8) }),
    f(70, { air: 2, mood: "cheer", arm: "up", lamp: 0.15, feet: { b: { lift: 1 }, f: { lift: 1 } }, ear: "up" }),
    f(100, { bob: 3, mood: "blink", arm: "hold", lamp: 0.1, ear: "down" }, { cue: "step", specks: dust(0) }),
    f(80, { bob: 1, mood: "calm", arm: "hold", lamp: 0.5 }, { specks: dust(1) }),
    f(80, { mood: "wow", arm: "hold", lamp: 0.05 }),
    f(110, { mood: "cheer", arm: "up", hy: -1, lamp: 1.3 }, { cue: "twinkle", specks: [...dust(2), ...twinkles(1, 3)] }),
    f(110, { mood: "happy", arm: "waveL", hx: -1, sway: -2, lamp: 1.15 }, { specks: twinkles(2, 3) }),
    f(110, { mood: "happy", arm: "waveR", hx: 1, sway: 2, lamp: 1.0 }),
    f(120, { mood: "happy", arm: "hold", lamp: 0.75 }),
    f(300, { mood: "calm", arm: "hold", lamp: 0.55 }),
  ],
};

/** Thinking (loops): head tipped up, eyes rolled up, a paw on its chin, a foot tapping, thought dots popping up. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", arm: "low", free: i % 4 < 2 ? "scratchA" : "scratchB", hx: 2, hy: -1, bob: i % 6 >= 3 ? 1 : 0, feet: { f: i % 4 === 1 ? { lift: 2 } : {} }, tail: i % 6 < 3 ? 1 : 0, ear: i === 5 ? "down" : "mid", sway: i % 6 < 3 ? 0 : 1, lamp: 0.4 + 0.12 * Math.sin((i / 6) * Math.PI * 2) }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a hop toward the board and a flourish of the bulb. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "bold", arm: "hold", lamp: 0.6 }),
    f(80, { air: 4, dx: 1, mood: "bold", arm: "fwd", feet: { b: { lift: 2 }, f: { lift: 2 } }, sway: 2, ear: "up", lamp: 0.9 }, { cue: "twinkle" }),
    f(80, { air: 5, dx: 2, mood: "bold", arm: "point", feet: { b: { lift: 2 }, f: { lift: 2 } }, sway: 3, lamp: 1.1 }),
    f(100, { bob: 2, dx: 2, mood: "happy", arm: "point", sway: 1, lamp: 1.2 }, { specks: dust(0) }),
    f(100, { bob: 1, dx: 2, mood: "happy", arm: "fwd", sway: -1, lamp: 0.9 }),
    f(110, { dx: 1, mood: "happy", arm: "hold", lamp: 0.7 }),
    f(150, { mood: "calm", arm: "hold", lamp: 0.55 }),
  ],
};

/** A capture: two excited hops, the bulb waving high, twinkles everywhere. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "bold", arm: "hold", lamp: 0.7 }),
    f(80, { air: 5, mood: "cheer", arm: "high", feet: { b: { lift: 2 }, f: { lift: 2 } }, ear: "up", lamp: 1.2 }, { cue: "twinkle", specks: twinkles(1) }),
    f(80, { air: 6, mood: "happy", arm: "waveL", free: "up", feet: { b: { lift: 3 }, f: { lift: 3 } }, hy: -1, sway: -2, lamp: 1.3 }, { specks: twinkles(2) }),
    f(80, { air: 4, mood: "happy", arm: "waveR", free: "up", sway: 2, lamp: 1.3 }, { specks: twinkles(3) }),
    f(80, { bob: 2, mood: "cheer", arm: "high", lamp: 1.1 }, { specks: dust(0) }),
    f(80, { air: 6, mood: "happy", arm: "waveM", free: "up", feet: { b: { lift: 2 }, f: { lift: 3 } }, ear: "up", lamp: 1.3 }, { specks: twinkles(4) }),
    f(80, { air: 6, mood: "happy", arm: "waveR", free: "up", feet: { b: { lift: 3 }, f: { lift: 3 } }, hy: -1, sway: 2, lamp: 1.3 }, { specks: twinkles(5) }),
    f(80, { air: 4, mood: "happy", arm: "waveL", free: "up", sway: -2, lamp: 1.2 }, { specks: twinkles(6) }),
    f(90, { bob: 2, mood: "cheer", arm: "high", lamp: 1.0 }, { specks: dust(1) }),
    f(120, { bob: 1, mood: "happy", arm: "up", lamp: 0.85 }),
    f(160, { mood: "smug", arm: "hold", lamp: 0.65 }),
  ],
};

/** Hurt: hit, a flash, eyes screwed shut, the bulb flickers out; then it shakes it off with a brave little grin. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, mood: "hurt", arm: "down", ear: "down", lamp: 0.05 }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(80, { bob: 3, mood: "hurt", arm: "down", ear: "down", lamp: 0.1 }, { shake: [-1, 0], specks: [[13, 22, "j"], [13, 23, "x"]] }),
    f(90, { bob: 2, dx: -1, mood: "hurt", arm: "down", ear: "down", lamp: 0.2 }, { specks: [[11, 25, "j"], [11, 26, "x"]] }),
    f(100, { bob: 1, dx: -1, mood: "rattled", arm: "low", lamp: 0.3 }),
    f(110, { mood: "blink", arm: "hold", lamp: 0.45 }),
    f(120, { mood: "bold", arm: "up", lamp: 0.9 }),
    f(160, { mood: "calm", arm: "hold", lamp: 0.55 }),
  ],
};

/** Check: two sharp jabs of the bulb at the board, eyes bright. */
const JAB: Pose = { bob: 2, dx: 1, mood: "bold", arm: "point", sway: 2, lamp: 1.3 };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "bold", arm: "up", lamp: 0.8 }),
    f(110, { ...JAB }, { cue: "twinkle", specks: star(57, 38, "Y") }),
    f(90, { bob: 1, mood: "bold", arm: "up", lamp: 0.8 }),
    f(110, { ...JAB }, { cue: "twinkle", specks: star(58, 36, "U") }),
    f(90, { bob: 1, dx: 1, mood: "bold", arm: "point", lamp: 0.9 }),
    f(150, { dx: 1, mood: "happy", arm: "point", sway: 1, lamp: 1.0 }),
    f(160, { mood: "smug", arm: "hold", lamp: 0.65 }),
  ],
};

/** Smug: chin up, eyes half shut, a little smirk, a slow nod, the bulb held just so. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "smug", arm: "hold", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0, ear: i === 5 ? "up" : "mid", sway: [0, 1, 1, 0, 0, -1, -1, 0][i]!, lamp: 0.65 + 0.2 * Math.sin((i / 8) * Math.PI * 2) })),
};

/** Rattled: wide eyes, worried brows, sweat flying, trembling where it stands, the bulb flickering. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", arm: "low", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, ear: "down", tail: i % 2 ? 1 : -1, sway: i % 2 ? 1 : -1, lamp: i % 3 === 0 ? 0.2 : 0.6 }, { specks: sweat(i) })),
};

/** Defeat: hit, dizzy eyes, the bulb sputters, and it keels over onto its side (the last frame holds). */
function flop(p: Pose, shiftX = 0): { layers: Layer[] } {
  const b = build({ mood: "out", ear: "down", ...p });
  const standing = b.layers.filter((l) => l.part !== "shadow");
  const lying = lieDown(PARTS, { layers: standing }, 0, 0, "right").layers;
  const solid = lying.filter((l) => PARTS[l.part]!.outline !== false);
  const box = solid.map((l) => {
    const [w, h] = partSize(PARTS[l.part]!, l.rot ?? 0);
    return [l.x, l.y, l.x + w, l.y + h] as const;
  });
  const x0 = Math.min(...box.map((q) => q[0]));
  const x1 = Math.max(...box.map((q) => q[2]));
  const y1 = Math.max(...box.map((q) => q[3]));
  const sx = 30 - Math.round((x0 + x1) / 2) + shiftX;
  const sy = GROUND - y1;
  return { layers: [{ part: "shadow", x: 9, y: GROUND - 2 }, ...lying.map((l) => ({ ...l, x: l.x + sx, y: l.y + sy }))] };
}
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", arm: "down", ear: "down", lamp: 0.05 }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(90, { bob: 2, dx: -1, mood: "out", arm: "down", ear: "down", lamp: 0.3 }, { specks: dizzy(30, 17, 0) }),
    f(110, { bob: 3, dx: 1, mood: "out", arm: "down", ear: "down", lamp: 0.1 }, { specks: dizzy(31, 19, 1) }),
    f(110, { bob: 4, dx: 0, mood: "out", arm: "down", ear: "down", lamp: 0.25, hx: 1 }, { specks: dizzy(31, 21, 2) }),
    { ms: 120, cue: "poof", shake: [1, 0], pal: lampPal(0.2), ...flop({ arm: "low", lamp: 0.2 }), specks: [...dust(0), ...wisps([30, 54], 0, 3, 8)] },
    { ms: 160, pal: lampPal(0.05), ...flop({ arm: "low", lamp: 0.05 }), specks: dizzy(40, 36, 3) },
    { ms: 200, pal: lampPal(0.3), ...flop({ arm: "low", lamp: 0.3 }), specks: dizzy(40, 36, 4) },
    { ms: 1000, pal: lampPal(0.1), ...flop({ arm: "low", lamp: 0.1 }), specks: wisps([18, 52], 3, 2, 4) },
  ],
};

/** Victory: jumping for joy, the bulb waving high and bright, confetti all round. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 5, 6, 5, 3, 0, 0, 3, 5, 3, 0][i]!;
    const arms: ArmName[] = ["high", "waveL", "waveM", "waveR", "waveM", "waveL", "high", "high", "waveR", "waveM", "waveL", "high"];
    return f(110, { bob: i === 0 || i === 6 || i === 7 ? 2 : 0, air, mood: air > 2 ? "happy" : "cheer", arm: arms[i]!, free: "up", feet: air > 2 ? { b: { lift: 3 }, f: { lift: 3 } } : {}, hy: i % 2 ? -1 : 0, ear: air > 3 ? "up" : "mid", tail: i % 2 ? 1 : -1, sway: arms[i] === "waveL" ? -2 : arms[i] === "waveR" ? 2 : 0, lamp: 1.2 + 0.1 * (i % 2) }, { specks: confetti(i), cue: i === 2 ? "twinkle" : undefined });
  }),
};

export const sidekickHollow: Character = {
  id: "sidekick-hollow",
  name: "Hollow's sidekick",
  w: W,
  h: H,
  foot: [26, GROUND],
  palette: SIDEKICK_HOLLOW_PALETTE,
  halo: "#6a46c4",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
