/**
 * Wrangler's sidekick (id "sidekick-wrangler"): a little piglet cowpoke, a town bot that wanders the square and plays chess
 * at the park's tables. No powers, never fights: a friendly, curious kid who copies the big one. So it wears a brown
 * cowboy hat a size too big (a small gold star on the band), a tiny red bandana, and carries ONE short toy rope, coiled
 * in a hoof.
 *
 * Softer and rounder than Wrangler: a baby pink piglet, big round head, big shiny eyes, a round light snout, little pointy
 * ears poking up beside the hat's crown, a round tummy, stubby legs and a curly tail. No brows, no teeth, no crouch.
 * Three-quarters, facing our right, light from the top left.
 *
 * Rigging: the head (one per face), the body, the bandana, the ears are painted once; the hat is painted from its tilt
 * (so it can be tipped); the legs and arms are painted from points (hip, knee, ankle / shoulder, elbow, hand); the rope
 * is a coil (three sways) and, when it is thrown, a small loop and a line from the hoof. So a new pose is a handful of
 * numbers (see `Pose`).
 */
import { canvas, ellipse, inEllipse, line, poly, roundLight, shade, toGrid, type Canvas } from "../paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../sprite.ts";

export const SIDEKICK_PALETTE = {
  k: "#2b1411", // outline
  a: "#c0566a", // pink skin, dark to light
  b: "#e47a8a",
  c: "#f7a1aa",
  d: "#ffc9c9",
  e: "#ffe0dc", // the snout's shine
  n: "#93354a", // the snout's rim, inside the ears
  g: "#e8586d", // blush, tongue
  x: "#170909", // pupils, nostrils
  w: "#ffffff", // eye shine, white
  B: "#5b2a2a", // eye's lower iris
  u: "#6a1b29", // inside the mouth
  H: "#4a2611", // leather (the hat, hooves): dark to light
  h: "#6c3d1c",
  j: "#8f5629",
  J: "#b5733a",
  q: "#2c170e", // the hat's band
  Q: "#4b2c1b",
  O: "#a8700f", // gold: shade, mid, light, shine
  Y: "#e6ac2a",
  y: "#ffd451",
  L: "#fff3b0",
  r: "#8c5a26", // rope: dark, mid, light
  R: "#c58f4b",
  t: "#ecc47c",
  M: "#8f1f33", // the bandana: dark, mid, light
  m: "#d4364a",
  N: "#f2646e",
  W: "#c98f4e", // stool wood, light to dark
  X: "#a06a33",
  T: "#6c4222",
  U: "#c4ab8a", // dust
  V: "#6f5a44",
  s: "#bfb7b2", // thought bubbles
  S: "#f3efeb",
  v: "#8fd8ff", // sweat, a tear
  i: "#9fe8ff", // confetti
  l: "#ff9bd6",
  f: "#ff9a1f",
  z: "#0d0e12", // ground shadow
} as const;

type Pt = readonly [number, number];

/** The frame, and the ground (the first row below the hooves). */
const W = 60;
const H = 52;
/** The drawing is laid out with the ground at 54 (hat tops near 15); the frame is `SY` shorter at the top. */
const GROUND = 54;
const SY = 6;
const CX = 25;

const PARTS: Record<string, Part> = {};
interface Painted {
  part: Part;
  /** Top-left of the part, relative to the point it is placed at (the frame's origin for most; a center for the hat, the coil, a loop). */
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
function crop(cv: Canvas, cx = 0, cy = 0): Painted {
  let x0 = 9999;
  let y0 = 9999;
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
  return { part: { grid: cv.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")) }, at: [x0 - cx, y0 - cy] };
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

// ---- The face. A big round head: two big shiny eyes, blush, a light round snout, a little mouth.

export type Mood = "calm" | "blink" | "happy" | "cheer" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "out" | "bold";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "x";
type Mouth = "smile" | "grin" | "flat" | "smirk" | "wavy" | "o" | "tongue";

/** The near eye (5 x 6, on our left) and the far one (4 x 5, by the bridge of its snout). */
const NEAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkk.", "kwwxk", "kwxxk", "kxxxk", "kxxBk", ".kkk."],
  up: [".kkk.", "kxwxk", "kxxxk", "kwwwk", "kwwwk", ".kkk."],
  wide: [".kkk.", "kwwwk", "kwxwk", "kwxwk", "kwwwk", ".kkk."],
  half: [".....", "kkkkk", "kwxxk", "kxxBk", ".kkk.", "....."],
  arc: [".....", ".....", ".kkk.", "k...k", ".....", "....."],
  shut: [".....", ".....", ".....", "kkkkk", ".....", "....."],
  pinch: ["kk...", ".kk..", "..kk.", ".kk..", "kk...", "....."],
  x: ["k...k", ".k.k.", "..k..", ".k.k.", "k...k", "....."],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kk.", "kwxk", "kxxk", "kxBk", ".kk."],
  up: [".kk.", "kxxk", "kxxk", "kwwk", ".kk."],
  wide: [".kk.", "kwwk", "kwxk", "kwwk", ".kk."],
  half: ["....", "kkkk", "kxxk", ".kk.", "...."],
  arc: ["....", "....", ".kk.", "k..k", "...."],
  shut: ["....", "....", "....", "kkkk", "...."],
  pinch: ["..kk", ".kk.", "kk..", ".kk.", "..kk"],
  x: ["k..k", ".kk.", ".kk.", ".kk.", "k..k"],
};
const MOUTHS: Record<Mouth, readonly string[]> = {
  smile: ["k....k", ".kkkk."],
  grin: ["kkkkkk", "kuuggk", ".kkkk."],
  flat: ["kkkk"],
  smirk: ["....kk", "kkkk.."],
  wavy: ["k.k.k", ".k.k."],
  o: [".kk.", "kuuk", ".kk."],
  tongue: ["kkkkk", "kgggk", ".kkk."],
};
const FACES: Record<Mood, { near: Eye; far: Eye; mouth: Mouth; blush?: boolean }> = {
  calm: { near: "open", far: "open", mouth: "smile", blush: true },
  blink: { near: "shut", far: "shut", mouth: "smile", blush: true },
  happy: { near: "arc", far: "arc", mouth: "grin", blush: true },
  cheer: { near: "open", far: "open", mouth: "grin", blush: true },
  think: { near: "up", far: "up", mouth: "flat" },
  thinkBlink: { near: "shut", far: "shut", mouth: "flat" },
  smug: { near: "half", far: "half", mouth: "smirk", blush: true },
  rattled: { near: "wide", far: "wide", mouth: "wavy" },
  hurt: { near: "pinch", far: "pinch", mouth: "o" },
  out: { near: "x", far: "x", mouth: "tongue" },
  bold: { near: "open", far: "open", mouth: "grin", blush: true },
};

const HW = 28;
const HH = 18;
/** Where the head grid sits at rest (its top-left), on the frame; and the hat's origin (the middle of the crown's base). */
const HX0 = 15;
const HY0 = 21;
const HAT0: Pt = [28, 21];

function head(mood: Mood): Part {
  const cv = canvas(HW, HH);
  const skull = inEllipse(13, 9, 13, 9);
  const lit = roundLight(13.5, 9, 14, 10.5, 0.12);
  // The skull, lit from the top left; in the hat's shade across the brow.
  shade(cv, skull, "abcd", (x, y) => lit(x, y) - (y < 5 ? 0.18 : 0));
  // The snout, a short barrel: its side (lit), then its round front with a dark rim and two nostrils.
  const side = inEllipse(21.5, 12.2, 4.6, 3.6);
  const sideI = inEllipse(21.4, 12.1, 3.6, 2.7);
  const front = inEllipse(24.4, 12.2, 2.9, 3.7);
  const frontI = inEllipse(24.4, 12.2, 1.9, 2.7);
  shade(cv, side, "n", () => 0);
  shade(cv, sideI, "cde", roundLight(21.4, 12.1, 3.6, 2.7, 0.2));
  shade(cv, front, "n", () => 0);
  shade(cv, frontI, "bc", roundLight(24.4, 12.2, 1.9, 2.7, 0.15));
  dots(cv, [[24, 11], [24, 12], [26, 11], [26, 12]], "x");
  const face = FACES[mood];
  stamp(cv, NEAR_EYE[face.near], 6, 6);
  stamp(cv, FAR_EYE[face.far], 14, 6);
  if (face.blush) dots(cv, [[4, 13], [5, 13], [6, 13], [7, 13], [5, 14], [6, 14]], "g");
  const mx = face.mouth === "o" ? 11 : face.mouth === "smirk" ? 9 : 10;
  const rows = MOUTHS[face.mouth];
  stamp(cv, rows, mx, rows.length >= 3 ? 12 : 13);
  return { grid: toGrid(cv) };
}
const MOODS: readonly Mood[] = ["calm", "blink", "happy", "cheer", "think", "thinkBlink", "smug", "rattled", "hurt", "out", "bold"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);

// ---- Ears: little pointy ones that poke up beside the hat's crown (the far one a shade darker), three ways.

type Ear = "mid" | "up" | "down";
const EAR_NEAR: Record<Ear, { rows: readonly string[]; dx: number; dy: number }> = {
  mid: { rows: [".c.....", ".cd....", "cdnb...", "cdnnb..", "cdnnnb.", "bbbbbbb", "bbbbbbb"], dx: 0, dy: -6 },
  up: { rows: ["..c...", "..cb..", ".cdb..", ".cdnb.", "cdnnb.", "cdnnnb", "bbbbbb", "bbbbbb"], dx: 1, dy: -8 },
  down: { rows: ["bbbbbbb.", "cdnnnnbb", ".cdnnnb.", "..cnnb..", "...cb..."], dx: -5, dy: -1 },
};
const darker = (rows: readonly string[]) => rows.map((r) => [...r].map((k) => (k === "c" ? "b" : k === "d" ? "c" : k === "b" ? "a" : k)).join(""));
for (const e of ["mid", "up", "down"] as const) {
  PARTS[`ear:n:${e}`] = { grid: EAR_NEAR[e].rows };
  PARTS[`ear:f:${e}`] = { grid: darker(EAR_NEAR[e].rows) };
}

// ---- Small typed parts.

PARTS["shadow"] = (() => {
  const cv = canvas(28, 3);
  ellipse(cv, 14, 1.5, 14, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

PARTS["stool"] = {
  grid: [
    "WWWWWWWWWWWWWWWWWW",
    "XXXXXXXXXXXXXXXXXX",
    "TTTTTTTTTTTTTTTTTT",
    ".XT............XT.",
    ".XT............XT.",
    ".XTTTTTTTTTTTTTXT.",
    ".XT............XT.",
    ".XT............XT.",
    ".XT............XT.",
  ],
};

/** The bandana: a red triangle knotted under the chin, point down. */
PARTS["bandana"] = {
  grid: [
    "NNmmmmmmmmM",
    ".NmmmmmmmM.",
    "..NmmmmmM..",
    "...mmmmM...",
    "....mmM....",
    ".....M.....",
  ],
};

/** The curly tail, four wiggles (its base is the bottom right, tucked behind the body). */
const TAIL: readonly (readonly string[])[] = [
  ["..bb.", ".b..b", ".b...", "..bbb", "....."],
  ["..bb.", ".b..b", ".b.b.", "..bbb", "....."],
  [".bb..", "b..b.", "b....", ".bbbb", "....."],
  [".....", "..bb.", ".b..b", ".b.bb", "..bb."],
];
TAIL.forEach((rows, i) => (PARTS[`tail:${i}`] = { grid: rows }));

// ---- The hat: painted from its tilt, so it can be tipped. In its own space (0, 0) is the middle of the crown's base.

const HC: Pt = [24, 19];
const BRIM: readonly Pt[] = [[-17.5, -3], [-14, -0.6], [-9, 0.8], [0, 1.3], [9, 0.8], [14, -0.6], [17.5, -3], [17, -1.4], [14.5, 2.2], [9, 4], [0, 4.7], [-9, 4], [-14.5, 2.2], [-17, -1.4]];
const CROWN: readonly Pt[] = [[-6.5, 2], [-6.8, -3.2], [-5.5, -5.2], [-3, -6.4], [-1, -5.9], [0.2, -5.4], [1.6, -5.9], [3.6, -6.4], [6, -5.2], [6.8, -3.2], [6.5, 2]];
const BAND: readonly Pt[] = [[-6.8, -2.8], [6.9, -2.8], [6.9, 1.8], [-6.8, 1.8]];
const STAR = ["..y..", ".yyy.", "yyLyy", ".yYy.", ".Y.Y."];

function hatPart(deg: number): Painted & { name: string } {
  return painted(`hat:${deg}`, () => {
    const a = (deg * Math.PI) / 180;
    const rot = ([u, v]: Pt): Pt => [HC[0] + u * Math.cos(a) - v * Math.sin(a), HC[1] + u * Math.sin(a) + v * Math.cos(a)];
    const ids = canvas(48, 38);
    poly(ids, CROWN.map(rot), "c");
    poly(ids, BAND.map(rot), "b");
    poly(ids, BRIM.map(rot), "r");
    const at = (x: number, y: number) => ids[y]?.[x] ?? ".";
    const cv = canvas(48, 38);
    for (let y = 0; y < 38; y++)
      for (let x = 0; x < 48; x++) {
        const id = at(x, y);
        if (id === ".") continue;
        if (id === "r") cv[y]![x] = at(x, y - 1) !== "r" ? (x < HC[0] + 3 ? "J" : "j") : at(x, y + 1) !== "r" ? "H" : x > HC[0] + 12 ? "h" : "j";
        else if (id === "b") cv[y]![x] = at(x, y - 1) !== "b" ? "Q" : "q";
        else {
          const crown = (c: string) => c === "c" || c === "b";
          cv[y]![x] = !crown(at(x - 1, y)) || !crown(at(x, y - 1)) ? "J" : !crown(at(x + 1, y)) ? "h" : at(x + 2, y) === "." ? "h" : "j";
        }
      }
    // The crease down the crown's pinch.
    for (const v of [-4.9, -3.9]) {
      const [px, py] = rot([0.6, v]);
      if (cv[Math.floor(py)]?.[Math.floor(px)] !== undefined && at(Math.floor(px), Math.floor(py)) === "c") cv[Math.floor(py)]![Math.floor(px)] = "H";
    }
    // The gold star on the band, a little toward the face.
    const [sx, sy] = rot([1.4, -0.9]);
    stamp(cv, STAR, Math.round(sx - 2.5), Math.round(sy - 2.5));
    return crop(cv, HC[0], HC[1]);
  });
}

// ---- Painting helpers for limbs and ropes.

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
const clampKey = (ramp: string, l: number) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(l * ramp.length)))]!;

interface LimbOpts {
  far?: boolean;
  hoof?: boolean;
  /** A round hoof on the end of a leg that points sideways (radius). */
  hoofEnd?: number;
  hand?: number;
}
/** A round stroke through points, shaded like a cylinder (light from the top left); a hoof under a leg, a round hand on an arm. */
function limb(pts: readonly Pt[], r: number, o: LimbOpts = {}): Painted & { name: string } {
  return painted(`limb:${r}:${o.far ? 1 : 0}${o.hoof ? "h" : ""}${o.hoofEnd ?? ""}${o.hand ?? ""}:${pts.map((p) => p.join(",")).join(";")}`, () => {
    const cv = canvas(W, H);
    const end = pts[pts.length - 1]!;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const n = nearest([x, y], pts);
        if (n.d > r) continue;
        let k = clampKey("abcd", 0.62 - 0.42 * (n.nx / r) - 0.5 * (n.ny / r) - (o.far ? 0.15 : 0));
        if (o.hoof && y > end[1]) k = y === end[1] + 1 ? "h" : "H";
        cv[y]![x] = k;
      }
    if (o.hoofEnd) {
      // The toe: a small hoof ball, brown, lit from the top left.
      const hr = o.hoofEnd + 0.4;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const dx = x - end[0] - 1;
          const dy = y - end[1];
          if (dx * dx + dy * dy > hr * hr) continue;
          cv[y]![x] = dx + dy > 1.2 ? "H" : dx + dy > -1 ? "h" : "j";
        }
    }
    if (o.hand) {
      const hr = o.hand;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const dx = x - end[0];
          const dy = y - end[1];
          if (dx * dx + dy * dy > hr * hr) continue;
          cv[y]![x] = clampKey("abcd", 0.64 - 0.34 * (dx / hr) - 0.42 * (dy / hr));
        }
    }
    return crop(cv);
  });
}

/** The elbow that gives each half of an arm length `len` (or straight if the hand is further than that). */
function elbow(s: Pt, h: Pt, len = 7, sign = 1): Pt {
  const dx = h[0] - s[0];
  const dy = h[1] - s[1];
  const d = Math.hypot(dx, dy) || 1;
  const half = d / 2;
  const bend = half >= len ? 0 : Math.sqrt(len * len - half * half);
  return [Math.round(s[0] + dx / 2 + (-dy / d) * sign * bend), Math.round(s[1] + dy / 2 + (dx / d) * sign * bend)];
}

/** The toy rope's coil, held at the left edge of its 10 x 8 bulk; its loose end hangs and sways (-1, 0, 1). Centered on the hoof. */
function coilPart(sway: number): Painted & { name: string } {
  return painted(`coil:${sway}`, () => {
    const cv = canvas(20, 20);
    const cx = 9;
    const cy = 8;
    const outer = inEllipse(cx, cy, 5, 4.1);
    const hole = inEllipse(cx + 0.3, cy + 0.2, 0.9, 0.6);
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 20; x++) {
        if (!outer(x, y) || hole(x, y)) continue;
        const nx = (x + 0.5 - cx) / 5;
        const ny = (y + 0.5 - cy) / 4.1;
        const d = Math.hypot(nx, ny);
        const ang = Math.atan2(ny, nx);
        const stripe = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 12) % 2 === 0;
        const litSide = -0.6 * nx - 0.8 * ny > 0.05;
        // Two turns of rope: a twisted outer one, a dark groove, an inner one.
        cv[y]![x] = d > 0.68 ? (stripe ? (litSide ? "t" : "R") : litSide ? "R" : "r") : d > 0.5 ? "r" : litSide ? "t" : "R";
      }
    if (sway === 9) {
      // Set down: the loose end lies along the floor.
      [[5, 3], [6, 3], [7, 3], [8, 2]].forEach(([i, j], n) => (cv[cy + j!]![cx + i!] = n % 2 ? "r" : "R"));
    } else {
      // The loose end hanging from the coil's lower left.
      for (let i = 0; i < 4; i++) cv[cy + 3 + i]![cx - 3 + Math.round((sway * i) / 2)] = i % 2 ? "r" : "R";
    }
    return crop(cv, 9, 8);
  });
}

/** A small loop of rope (a lasso): a ring of its own, tilted. Centered on its middle. */
function loopPart(rx: number, ry: number, tilt: number): Painted & { name: string } {
  return painted(`loop:${rx}:${ry}:${tilt}`, () => {
    const cv = canvas(32, 24);
    const a = (tilt * Math.PI) / 180;
    const n = 90;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const u = rx * Math.cos(t);
      const v = ry * Math.sin(t);
      const x = Math.floor(16 + u * Math.cos(a) - v * Math.sin(a));
      const y = Math.floor(12 + u * Math.sin(a) + v * Math.cos(a));
      cv[y]![x] = Math.floor(i / 3) % 2 ? "r" : Math.sin(t) < 0 ? "t" : "R";
    }
    return crop(cv, 16, 12);
  });
}

/** A line of rope from one point to another (the lasso's line, from the hoof to its loop). */
function ropeLine(a: Pt, b: Pt): Painted & { name: string } {
  return painted(`rope:${a};${b}`, () => {
    const cv = canvas(W, H);
    line(cv, a[0], a[1], b[0], b[1], "R");
    cv.forEach((row, y) => row.forEach((k, x) => k === "R" && (x + y) % 3 === 0 && (cv[y]![x] = "r")));
    return crop(cv);
  });
}

// ---- The body: a round tummy, a lighter belly.

const BODY = { cx: 25, cy: 42, rx: 10.5, ry: 6 };
function bodyPart(): Painted {
  const cv = canvas(W, H);
  const inside = inEllipse(BODY.cx, BODY.cy, BODY.rx, BODY.ry);
  shade(cv, inside, "abcd", roundLight(BODY.cx - 1, BODY.cy - 1, BODY.rx + 1, BODY.ry + 1, 0.1));
  // A lighter tummy toward the front.
  const belly = inEllipse(28.5, 43.8, 5.8, 3.4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y) && belly(x, y)) cv[y]![x] = clampKey("cde", 0.45 + (cv[y]![x] === "d" ? 0.3 : 0));
  return crop(cv);
}
const BODY_PART = painted("body", bodyPart);

// ---- Poses.

type ArmName = "hold" | "low" | "lift" | "high" | "point" | "tuck" | "lap" | "wave1" | "wave2" | "wave3" | "hide";
/** The rope arm's hoof, at rest (the arm's elbow works itself out). */
const ARM_A: Record<ArmName, Pt> = {
  hold: [36, 45],
  low: [33, 49],
  lift: [39, 40],
  high: [42, 34],
  point: [43, 42],
  tuck: [34, 46],
  lap: [33, 46],
  wave1: [40, 37],
  wave2: [43, 35],
  wave3: [45, 37],
  hide: [32, 46],
};
const SHOULDER_A: Pt = [30, 40];
const SHOULDER_B: Pt = [34, 40];
type ArmB = "tip" | "wave1" | "wave2" | "wave3" | "up";
const ARM_B: Record<Exclude<ArmB, "tip">, Pt> = {
  wave1: [44, 30],
  wave2: [46, 28],
  wave3: [47, 31],
  up: [46, 24],
};

export interface Pose {
  mood?: Mood;
  /** The whole upper body down this many pixels (a breath, a crouch). */
  bob?: number;
  dx?: number;
  /** Off the ground. */
  air?: number;
  /** The head on the body. */
  hx?: number;
  hy?: number;
  /** The hat: tipped (degrees: its right end down when positive), and moved. */
  hat?: { tilt?: number; dx?: number; dy?: number };
  noHat?: boolean;
  ear?: Ear;
  earF?: Ear;
  tail?: number;
  /** Feet: sideways shift and lift off the ground, per leg (n near, f far). */
  feet?: Partial<Record<"n" | "f", { x?: number; lift?: number }>>;
  /** The rope arm (null: that arm just hangs), where the rope's loose end sways (-1 to 1), or no coil at all. */
  arm?: ArmName | null;
  coil?: number | false;
  /** The coil set down somewhere (its center), not held. */
  coilAt?: Pt;
  /** Slumped on its bottom on the ground, legs stuck out in front (defeat). */
  slump?: boolean;
  /** The other arm: tipping the hat (its hoof meets the brim), or waving. */
  armB?: ArmB | null;
  /** A small lasso loop spinning: its center, radii and tilt, and a line to it from the rope hoof. */
  loop?: { c: Pt; rx: number; ry: number; tilt: number } | null;
  sit?: boolean;
  noShadow?: boolean;
}

function build(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const sit = p.sit ?? false;
  const bob = (p.bob ?? 0) + (sit ? -3 : 0);
  const ux = dx;
  const uy = bob - air;
  const hx = p.hx ?? 0;
  const hy = p.hy ?? 0;
  const L: Layer[] = [];
  const put = (part: string, x: number, y: number) => L.push({ part, x, y: y - SY });
  const add = (pt: Painted & { name: string }, ox = 0, oy = 0) => put(pt.name, pt.at[0] + ox, pt.at[1] + oy);
  if (!p.noShadow) put("shadow", CX - 14 + dx, GROUND - 2);
  if (sit) put("stool", CX - 11 + dx, 45);

  // The tail, behind everything.
  put(`tail:${p.tail ?? 0}`, 10 + ux, 38 + uy);

  // Legs.
  const hipX = { n: 21, f: 29 } as const;
  const footAt = (k: "n" | "f"): Pt => [hipX[k] + (p.feet?.[k]?.x ?? 0) + dx, 51 - air - (p.feet?.[k]?.lift ?? 0)];
  if (p.slump) {
    add(limb([[26 + dx, 49], [33 + dx, 50], [40 + dx, 50]], 2.2, { far: true, hoofEnd: 2 }));
  } else if (sit) {
    // Dangling off the stool: the far leg behind the body, the near thigh folded in front of it.
    const sx = p.feet?.f?.x ?? 0;
    add(limb([[29 + dx, 42], [36 + dx, 44], [38 + dx + sx, 49]], 2.2, { far: true, hoof: true }));
  } else {
    for (const k of ["f", "n"] as const) {
      const hip: Pt = [hipX[k] + dx, 45 + uy];
      const a = footAt(k);
      const knee: Pt = [Math.round((hip[0] + a[0]) / 2 + (k === "n" ? -0.5 : 0.5)), Math.round((hip[1] + a[1]) / 2)];
      add(limb([hip, knee, a], 2.4, { far: k === "f", hoof: true }));
    }
  }

  add(BODY_PART, ux, uy);
  if (p.slump) {
    add(limb([[22 + dx, 50], [30 + dx, 51], [37 + dx, 51]], 2.4, { hoofEnd: 2 }));
  } else if (sit) {
    const sx = p.feet?.n?.x ?? 0;
    add(limb([[25 + dx, 43], [31 + dx, 44], [34 + dx + sx, 49]], 2.4, { hoof: true }));
  }

  // The ears (behind the head and the hat), the head, the bandana, the hat.
  const hox = HX0 + ux + hx;
  const hoy = HY0 + uy + hy;
  const earN = p.ear ?? "mid";
  const earF = p.earF ?? p.ear ?? "mid";
  put(`ear:f:${earF}`, hox + 21 - (earF === "down" ? 0 : 0) + (earF === "down" ? 1 : 0), hoy + (earF === "down" ? -2 : EAR_NEAR[earF].dy));
  put(`ear:n:${earN}`, hox + EAR_NEAR[earN].dx, hoy + EAR_NEAR[earN].dy);
  put(`head:${p.mood ?? "calm"}`, hox, hoy);
  put("bandana", 22 + ux + hx, 38 + uy + hy);
  const ht = p.hat ?? {};
  const tilt = Math.round(ht.tilt ?? 0);
  const hatO: Pt = [HAT0[0] + ux + hx + (ht.dx ?? 0), HAT0[1] + uy + hy + (ht.dy ?? 0)];
  if (!p.noHat) add(hatPart(tilt), hatO[0], hatO[1]);

  // The rope arm: coil first, then the arm and its hoof over the coil's edge.
  const arm = p.arm === undefined ? "hold" : p.arm;
  const sA: Pt = [SHOULDER_A[0] + ux, SHOULDER_A[1] + uy];
  if (arm !== null) {
    const base = ARM_A[arm];
    const hand: Pt = [base[0] + ux, Math.min(base[1] + uy, 50)];
    if (p.coil !== false && !p.loop) {
      if (p.coilAt) add(coilPart(9), p.coilAt[0] + ux, p.coilAt[1]);
      else add(coilPart(Math.round(p.coil ?? 0)), hand[0] + 3, Math.min(hand[1] + 1, 47));
    }
    if (p.loop) {
      const l = loopPart(p.loop.rx, p.loop.ry, p.loop.tilt);
      // The loop stays up where it spins (it doesn't ride the hop); the line to it stretches.
      const ly = p.loop.c[1] + Math.max(0, uy);
      add(ropeLine([hand[0], hand[1] - 1], [Math.round(p.loop.c[0] + ux), Math.round(ly + p.loop.ry)]));
      add(l, Math.round(p.loop.c[0] + ux), Math.round(ly));
    }
    add(limb([sA, elbow(sA, hand, 4.5, 1), hand], 1.6, { hand: 2.2 }));
  } else {
    add(limb([sA, [sA[0] - 1 + 0, sA[1] + 5], [sA[0] + 1, sA[1] + 9]], 1.9, { hand: 2.3 }));
  }
  // The other arm: tips the hat, or waves.
  if (p.armB) {
    const sB: Pt = [SHOULDER_B[0] + ux, SHOULDER_B[1] + uy];
    if (p.armB === "tip") {
      const a = (tilt * Math.PI) / 180;
      const hand: Pt = [Math.round(hatO[0] + 12 * Math.cos(a) - 2.5 * Math.sin(a)), Math.round(hatO[1] + 12 * Math.sin(a) + 2.5 * Math.cos(a))];
      const el: Pt = [Math.max(hand[0] + 3, sB[0] + 8), Math.round((sB[1] + hand[1]) / 2 + 3)];
      add(limb([sB, el, hand], 1.6, { hand: 2.2 }));
    } else {
      const hand: Pt = [ARM_B[p.armB][0] + ux, ARM_B[p.armB][1] + uy];
      const el: Pt = [Math.max(hand[0] - 1, sB[0] + 8), Math.round((sB[1] + hand[1]) / 2 + 4)];
      add(limb([sB, el, hand], 1.6, { hand: 2.2 }));
    }
  }
  return L;
}

// ---- Specks and little effects.

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}
const star = (x: number, y: number, k = "y"): Speck[] => [[x, y, "w"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
function twinkles(t: number, n = 3, box: readonly [number, number, number, number] = [5, 5, 50, 40]): Speck[] {
  const rnd = seeded(t * 31 + 5);
  return Array.from({ length: n }, (_, i) => star(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])), (i + t) % 2 ? "y" : "i")).flat();
}
/** A pop of confetti over the figure. */
function confetti(t: number, n = 9): Speck[] {
  const rnd = seeded(t * 17 + 3);
  const keys = ["y", "l", "i", "m", "f"];
  return Array.from({ length: n }, (_, i): Speck => [Math.round(4 + rnd() * 52), Math.round(8 + rnd() * 28), keys[(i + t) % keys.length]!]);
}
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) => [0, 1, 2].map((i): Speck => [Math.round(CX + side * (8 + i * 3 + t * 2)), GROUND - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "V" : "U"]));
const dropShadow = (r: number): Speck[] => Array.from({ length: r * 2 + 1 }, (_, i): Speck => [CX - r + i, GROUND - 1, "z"]);
/** Thought dots up and to the right of the hat. */
const BUBBLES: readonly (readonly [number, number, readonly string[]])[] = [
  [48, 22, ["SS", "Ss"]],
  [49, 16, [".SS.", "SSSs", ".ss."]],
  [49, 7, ["..SSSS..", ".SSSSSs.", "SSSSSSss", ".SSssss."]],
];
const thoughts = (n: number): Speck[] =>
  BUBBLES.slice(0, n).flatMap(([x, y, rows]): Speck[] => rows.flatMap((row, j) => [...row].flatMap((k, i): Speck[] => (k === "." ? [] : [[x + i, y + j, k]]))));
/** Sweat flying off the head. */
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [[13 - t, 28 + t, "v"], [13 - t, 29 + t, "w"], [44 + t, 30 + t, "v"], [44 + t, 31 + t, "w"]];
};
/** Dizzy stars wheeling round the head. */
const dizzy = (t: number, cx = 28, cy = 14): Speck[] =>
  [0, 1, 2].flatMap((k): Speck[] => {
    const a = (t / 8) * Math.PI * 2 + (k / 3) * Math.PI * 2;
    return [[Math.round(cx + Math.cos(a) * 13), Math.round(cy + Math.sin(a) * 3), k === 1 ? "w" : "y"], [Math.round(cx + Math.cos(a) * 13) + 1, Math.round(cy + Math.sin(a) * 3), "y"]];
  });

const FLASH: Record<string, string> = { a: "#ffd9d9", b: "#ffe9e6", c: "#fff3f0", d: "#ffffff", e: "#ffffff", n: "#ffcfcf", H: "#a58468", h: "#c8a07a", j: "#e0bd96", J: "#f3dcc0" };

/** One frame: the pose and anything extra (its specks stay inside the frame). */
function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  return { ms, layers: build(p), ...extra, specks: framed(extra.specks) };
}
/** Specks are laid out in the drawing's space: shifted to the frame, and kept inside it. */
function framed(specks: readonly Speck[] = []): Speck[] {
  return specks.map(([x, y, k]): Speck => [x, y - SY, k]).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
}

// ---- Animations.

/** Idle (3 s): breathes, blinks, wiggles its tail and flicks an ear, and now and then tips its hat back. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const bob = (i >= 8 && i <= 13) || (i >= 23 && i <= 28) ? 1 : 0;
    const blink = i === 11 || i === 12 || i === 27;
    const back = i >= 17 && i <= 23;
    const tilt = i === 17 || i === 23 ? -4 : back ? -9 : 0;
    const tail = i >= 3 && i <= 8 ? (i % 2 ? 1 : 2) : i >= 21 && i <= 24 ? 3 : 0;
    const ear: Ear = i === 5 || i === 6 ? "down" : i === 19 || i === 20 ? "up" : "mid";
    const mood: Mood = blink ? "blink" : back && i >= 19 && i <= 22 ? "cheer" : "calm";
    const hx = i >= 25 && i <= 28 ? 1 : 0;
    // A glint off the hat's star, once.
    const glint = i === 14 ? star(29, 20, "L") : i === 15 ? [[29, 20, "L"] as Speck] : [];
    return f(100, { bob, mood, ear, tail, hx, coil: bob ? 1 : i % 15 >= 4 && i % 15 < 7 ? -1 : 0, hat: back ? { tilt, dx: -1, dy: -1 } : {} }, { specks: glint });
  }),
};

/** Walk (0.6 s): a bouncy little trot, the head bobbing, the hat wobbling, the rope swinging. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const th = (i / 6) * Math.PI * 2;
    const leg = (off: number) => ({ x: Math.round(3 * Math.sin(th + off * Math.PI * 2)), lift: Math.max(0, Math.round(2.5 * Math.cos(th + off * Math.PI * 2))) });
    const down = i % 3 === 0;
    return f(100, { bob: down ? 1 : 0, air: i % 3 === 1 ? 1 : 0, hy: down ? 0 : -1, hx: 1, mood: "calm", feet: { n: leg(0), f: leg(0.5) }, tail: i % 2 ? 1 : 2, ear: down ? "down" : "mid", hat: { tilt: [3, 0, -3, -3, 0, 3][i]!, dy: down ? 0 : -1 }, coil: i < 3 ? 1 : -1, arm: down ? "hold" : "tuck" }, i % 3 === 0 ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the chess table, facing the board, legs dangling, the rope low in its lap, thinking about a move. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    const swing = i % 8 < 4 ? 0 : 1;
    return f(200, { sit: true, arm: "lap", coilAt: [47, 50], mood: blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : "calm", bob: i % 8 >= 4 ? 1 : 0, hx: lean ? 2 : 0, hy: lean ? 1 : 0, hat: lean ? { tilt: 3 } : {}, ear: i === 9 ? "down" : "mid", tail: swing, feet: { n: { x: swing }, f: { x: -swing } } });
  }),
};

/** Wave (once, 1.2 s): a hoof up to the brim, it tips its hat hello and grins, then settles back to its idle pose. */
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "happy", ear: "up" }),
    f(100, { mood: "cheer", armB: "wave1", hy: 1, hat: { dy: 1 } }, { cue: "hello" }),
    f(110, { mood: "happy", armB: "tip", hy: 1, hat: { tilt: 2, dy: 1 } }),
    f(110, { mood: "happy", armB: "tip", hy: 1, hat: { tilt: -10, dx: 1, dy: -1 } }),
    f(150, { mood: "cheer", armB: "tip", hy: 1, hat: { tilt: -14, dx: 2, dy: -2 }, ear: "up" }, { specks: star(36, 12) }),
    f(120, { mood: "happy", armB: "tip", hy: 1, hat: { tilt: -14, dx: 2, dy: -2 }, ear: "up" }),
    f(110, { mood: "happy", armB: "tip", hy: 1, hat: { tilt: -5, dx: 1, dy: -1 } }),
    f(100, { mood: "happy", armB: "tip", hy: 1, hat: { tilt: 1, dy: 1 } }),
    f(100, { mood: "cheer", armB: "wave1", hy: 0 }),
    f(100, { mood: "happy", bob: 1 }),
    f(140, { mood: "calm" }),
  ],
};

/** Entrance: drops in from above on its shadow, lands with a squash and a puff of dust, then tips its hat to the board. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: framed(dropShadow(4)) },
    { ms: 80, layers: [], specks: framed(dropShadow(8)) },
    f(60, { air: 4, mood: "cheer", arm: "lift", feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up" }, { specks: dropShadow(11) }),
    f(60, { air: 2, mood: "cheer", arm: "lift", feet: { n: { lift: 1 }, f: { lift: 2 } }, ear: "up", hat: { dy: -1 } }),
    f(100, { bob: 3, mood: "blink", ear: "down", hat: { dy: 1, tilt: 2 } }, { cue: "step", specks: dust(0) }),
    f(70, { air: 2, mood: "happy", ear: "up", feet: { n: { lift: 1 }, f: { lift: 1 } } }, { specks: dust(1) }),
    f(80, { bob: 1, mood: "happy", ear: "mid" }, { specks: dust(2) }),
    f(110, { mood: "cheer", armB: "wave1", hat: { dy: 0 } }, { specks: dust(2) }),
    f(110, { mood: "happy", armB: "tip", hy: 1, hat: { tilt: -10, dx: 1, dy: -1 } }),
    f(130, { mood: "cheer", armB: "tip", hy: 1, hat: { tilt: -14, dx: 2, dy: -2 }, ear: "up" }, { specks: twinkles(1, 2, [8, 8, 48, 28]) }),
    f(110, { mood: "happy", armB: "tip", hy: 1, hat: { tilt: -3, dy: 0 } }),
    f(300, { mood: "calm" }),
  ],
};

/** Thinking (loops): head tipped up, eyes rolled up, it pushes its hat back and scratches under it, a foot tapping, thought dots. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const scratch = i % 4 < 2;
    return f(150, { mood: i === 8 ? "thinkBlink" : "think", armB: "tip", hx: 1, hy: -1, bob: i % 6 >= 3 ? 1 : 0, hat: { tilt: scratch ? -9 : -6, dx: -1, dy: -1 }, feet: { f: i % 4 === 1 ? { lift: 2 } : {} }, tail: i % 6 < 3 ? 1 : 0, ear: i === 5 ? "down" : "mid", coil: 0 }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) });
  }),
};

/** Its move: a hop toward the board and a flick of the rope at it. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, mood: "bold", arm: "hold", hat: { dy: 1 } }),
    f(80, { air: 3, dx: 1, mood: "bold", arm: "point", feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up", hat: { tilt: -4, dy: -1 }, coil: 1 }, { cue: "flick" }),
    f(80, { air: 4, dx: 2, mood: "bold", arm: "point", feet: { n: { lift: 2 }, f: { lift: 2 } }, hat: { tilt: -4, dy: -1 }, coil: -1 }),
    f(100, { bob: 2, dx: 2, mood: "happy", arm: "point", coil: 1 }, { specks: dust(0) }),
    f(100, { bob: 1, dx: 2, mood: "happy", arm: "point", coil: 0 }),
    f(110, { dx: 1, mood: "happy", arm: "hold" }),
    f(150, { mood: "calm" }),
  ],
};

/** A capture: two excited hops, a little lasso spinning overhead, twinkles everywhere. */
const LASSO = (i: number) => ({ c: [45, 13] as Pt, rx: [7, 5, 3, 5][i % 4]!, ry: 2.5, tilt: [-8, 0, 8, 0][i % 4]! });
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "bold", arm: "hold" }),
    f(80, { air: 4, mood: "cheer", arm: "high", loop: LASSO(0), feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up" }, { cue: "whirl", specks: twinkles(1) }),
    f(80, { air: 4, mood: "happy", arm: "high", loop: LASSO(1), feet: { n: { lift: 3 }, f: { lift: 3 } }, hat: { tilt: -4 } }, { specks: twinkles(2) }),
    f(80, { air: 2, mood: "happy", arm: "high", loop: LASSO(2) }, { specks: twinkles(3) }),
    f(80, { bob: 2, mood: "cheer", arm: "high", loop: LASSO(3) }, { specks: dust(0) }),
    f(80, { air: 4, mood: "happy", arm: "high", loop: LASSO(0), feet: { n: { lift: 2 }, f: { lift: 3 } }, ear: "up" }, { specks: twinkles(4) }),
    f(80, { air: 4, mood: "happy", arm: "high", loop: LASSO(1), feet: { n: { lift: 3 }, f: { lift: 3 } }, hat: { tilt: -4 } }, { specks: twinkles(5) }),
    f(80, { air: 2, mood: "happy", arm: "high", loop: LASSO(2) }, { specks: twinkles(6) }),
    f(90, { bob: 2, mood: "cheer", arm: "high", coil: 1 }, { specks: dust(1) }),
    f(120, { bob: 1, mood: "happy", arm: "lift" }),
    f(160, { mood: "smug" }),
  ],
};

/** Hurt: hit, a flash, eyes screwed shut, its hat knocked crooked; then it shakes it off with a brave little grin. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, mood: "hurt", arm: "low", ear: "down", hat: { tilt: 12, dx: 2, dy: 0 }, coil: 1 }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(80, { bob: 3, mood: "hurt", arm: "low", ear: "down", hat: { tilt: 14, dx: 3, dy: 1 }, coil: -1 }, { shake: [-1, 0], specks: [[11, 27, "v"], [11, 28, "w"]] }),
    f(90, { bob: 2, dx: -1, mood: "hurt", arm: "low", ear: "down", hat: { tilt: 10, dx: 2, dy: 0 } }, { specks: [[10, 29, "v"], [10, 30, "w"]] }),
    f(100, { bob: 1, dx: -1, mood: "rattled", arm: "low", ear: "down", hat: { tilt: 7, dx: 1 } }),
    f(110, { mood: "blink", arm: "hold", hat: { tilt: 4 } }),
    f(120, { mood: "bold", arm: "hold", hat: { tilt: 1 } }),
    f(160, { mood: "calm" }),
  ],
};

/** Check: two sharp flicks of a little lasso at the board, eyes bright. */
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, mood: "bold", arm: "lift", hat: { dy: 1 } }),
    f(100, { dx: 1, mood: "bold", arm: "point", loop: { c: [47, 43], rx: 3, ry: 2, tilt: 0 }, hat: { tilt: -3 } }, { cue: "flick" }),
    f(110, { dx: 1, mood: "bold", arm: "point", loop: { c: [50, 43], rx: 5, ry: 3, tilt: 6 }, hat: { tilt: -3 } }),
    f(90, { bob: 1, mood: "bold", arm: "lift" }),
    f(100, { dx: 1, mood: "bold", arm: "point", loop: { c: [47, 43], rx: 3, ry: 2, tilt: 0 }, hat: { tilt: -3 } }, { cue: "flick" }),
    f(110, { dx: 1, mood: "bold", arm: "point", loop: { c: [50, 43], rx: 5, ry: 3, tilt: -6 }, hat: { tilt: -3 } }),
    f(130, { dx: 1, mood: "happy", arm: "point" }),
    f(160, { mood: "smug", arm: "hold" }),
  ],
};

/** Smug: chin up, eyes half shut, a little smirk, a slow nod, the hat brim low. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "smug", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, bob: i % 4 === 2 ? 1 : 0, hat: { tilt: 3, dy: i < 3 || i > 5 ? -1 : 0 }, ear: i === 5 ? "up" : "mid", coil: i % 4 === 2 ? 1 : 0 })),
};

/** Rattled: wide eyes, sweat flying, trembling where it stands, the rope shaking, a hoof up. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", arm: "low", armB: i % 4 < 2 ? "wave1" : "wave2", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, ear: "down", tail: i % 2 ? 1 : 2, hat: { tilt: i % 2 ? 3 : -2, dy: i % 2 ? -1 : 0 }, coil: i % 2 ? 1 : -1 }, { specks: sweat(i) })),
};

/** Defeat: hit, dizzy eyes, the hat flies off, and it keels over onto its back with stars wheeling round its head (the last frame holds). */
const SLUMP: Pose = { slump: true, bob: 6, mood: "out", ear: "down", arm: "low", coilAt: [46, 50] };
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, mood: "hurt", arm: "low", ear: "down", hat: { tilt: 12, dx: 2 } }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(90, { bob: 2, dx: -1, mood: "out", arm: "low", ear: "down", hat: { tilt: 18, dx: 3, dy: -2 } }, { specks: dizzy(0, 28, 17) }),
    f(100, { bob: 3, mood: "out", arm: "low", ear: "down", hat: { tilt: 24, dx: 5, dy: -6 } }, { specks: dizzy(2, 28, 17) }),
    f(100, { bob: 4, dx: 1, mood: "out", arm: "low", ear: "down", hat: { tilt: 20, dx: 3, dy: -3 } }, { specks: dizzy(4, 28, 17) }),
    f(120, { ...SLUMP, hx: 1, hy: 1, hat: { tilt: 14, dx: 1, dy: 1 } }, { cue: "poof", shake: [0, 1], specks: dust(0) }),
    f(160, { ...SLUMP, hx: 1, hy: 2, hat: { tilt: 16, dx: 1, dy: 2 } }, { specks: dizzy(1, 29, 22) }),
    f(200, { ...SLUMP, hx: 1, hy: 2, hat: { tilt: 16, dx: 1, dy: 2 }, tail: 1 }, { specks: dizzy(3, 29, 22) }),
    f(1000, { ...SLUMP, hx: 1, hy: 2, hat: { tilt: 16, dx: 1, dy: 2 }, tail: 2 }, { specks: dizzy(5, 29, 22) }),
  ],
};

/** Victory: jumping for joy, tossing its hat and catching it, confetti popping all round. Then again. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 4, 4, 3, 0, 0, 0, 0, 3, 4, 0][i]!;
    const arms: ArmName[] = ["high", "wave1", "wave2", "wave3", "wave2", "wave1", "high", "high", "high", "wave3", "wave2", "high"];
    // The hat pops off its head while it stands, spins, and drops back on.
    const toss = i >= 6 && i <= 8;
    const hat = toss ? [{ tilt: -8, dy: -3 }, { tilt: -16, dy: -5, dx: 1 }, { tilt: 10, dy: -3 }][i - 6]! : { dy: i === 0 || i === 5 ? 1 : 0, tilt: 0 };
    return f(110, { bob: i === 0 || i === 5 || i === 9 ? 2 : 0, air, mood: air > 2 ? "happy" : "cheer", arm: arms[i]!, feet: air > 2 ? { n: { lift: 3 }, f: { lift: 3 } } : {}, hy: i % 2 && air < 3 && !toss ? -1 : 0, ear: air > 3 || toss ? "up" : "mid", tail: i % 2 ? 2 : 1, hat }, { specks: [...confetti(i), ...twinkles(i, 1, [5, 8, 52, 38])], cue: i === 2 ? "cheer" : undefined });
  }),
};

export const sidekickWrangler: Character = {
  id: "sidekick-wrangler",
  name: "Wrangler's sidekick",
  w: W,
  h: H,
  foot: [CX, GROUND - SY],
  palette: SIDEKICK_PALETTE,
  halo: "#2c2624",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
