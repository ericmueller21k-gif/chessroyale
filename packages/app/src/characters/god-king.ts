/**
 * The God King: the crowd's champion in boss battles, a holy knight in white plate with gold trim, after Eric's
 * reference picture: a winged crown-helmet with glowing gold eyes, a flaming golden sword, a blue tabard with gold
 * crosses, and a long torn white-and-gold cape. Drawn facing front, light from the top left.
 *
 * He plays either side: the `black` look recolours his armour to dark steel; gold, eyes, cape, cloth and the flame
 * stay the same (Eric's rule: everything he shows comes in both colours, the armour only).
 *
 * Rigging: his own drawing space is one board square, 60 x 60, his feet at the bottom centre. The sword arm (his
 * right, on the viewer's left) is drawn from its pose's shoulder, elbow and fist, and the sword (a gold hilt and a
 * blade of fire) hangs off the fist in the pose's direction, so a swing is a list of poses. The cape and tabard
 * ripple; the helmet's wings flap; his eyes glow, flare or go dark. (No back wings: Eric, Oct 9, 2026.)
 */
import { LAST_STAND, lastStandAttackHits } from "@chessroyale/chess";
import { canvas, edge, ellipse, inEllipse, line, poly, roundLight, shade, tint, toGrid } from "./paint.ts";
import { lieDown, partSize, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

export const GOD_KING_PALETTE = {
  k: "#16121b", // outline
  a: "#f7f4ec", // armour, light to dark (the black look swaps these four)
  b: "#d9d3c9",
  c: "#aca49e",
  d: "#766e7a",
  y: "#fff3b0", // gold, light to dark
  g: "#f2c14e",
  G: "#c48a2c",
  h: "#7f5119",
  u: "#6f93ea", // blue cloth and gems
  U: "#3d5fb6",
  v: "#22397a",
  w: "#ffffff", // glints
  m: "#fbf8f1", // cape and feathers
  M: "#ddd5ca",
  n: "#aea59d",
  N: "#7a716d",
  e: "#ffd23f", // eyes
  E: "#fff8d6",
  f: "#fffbe6", // flame: white-hot core to red edge (gold on both sides)
  F: "#ffe066",
  o: "#ffa62b",
  O: "#e9601d",
  q: "#9c3510", // embers
  r: "#e0342c", // the few stylised red drops
  R: "#8f1b1b",
  s: "#2b2430", // cracks
  z: "#0d0e12", // ground shadow
} as const;

/** Black: dark steel, a step lighter than black so he reads on the dark ground. Everything else stays. */
export const GOD_KING_BLACK = { a: "#a4aabd", b: "#71778c", c: "#4b5062", d: "#30333f" } as const;

type Pt = readonly [number, number];

/** Deterministic noise (no trig, so every browser draws the same pixels). */
function hash(a: number, b: number, c: number): number {
  let h = Math.imul(a + 7, 374761393) ^ Math.imul(b + 13, 668265263) ^ Math.imul(c + 3, -2048144777);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- Head: helm, crown, the helmet's wings.

const helm: Part = {
  grid: [
    "....abbbbc....",
    "..aabbbbbbcc..",
    ".aabbbbbbbccd.",
    ".abbbbbbbbbcd.",
    "abcccccccccddd",
    "akeEEkkkkEEekd",
    "abbbbbkkbbbccd",
    "abbbbbkkbbbccd",
    "aabbbbkkbbbccd",
    ".abbbbkkbbccd.",
    ".abbbbkkbbccd.",
    "..abbbkkbccd..",
    "...bccddccd...",
  ],
};

const crown: Part = {
  grid: [
    ".......yg.......",
    ".......yG.......",
    "...y...yG...g...",
    "...yg..yG..gG...",
    "y..yG.ygGG.gG..G",
    "ygggggggwgggggGG",
    "gGGGGGGuUGGGGGGh",
  ],
};

const wingHelm: Part = {
  grid: [
    "y......",
    "yg.....",
    "ygg....",
    ".ygg...",
    "yyggg..",
    ".yggGG.",
    "..yggGG",
    ".yyggGG",
    "..yggGG",
    "...ygGG",
    "....gGh",
  ],
};

// ---- Body.

function paintPauldron(left: boolean): Part {
  const cv = canvas(16, 16);
  const m = (x: number) => (left ? x : 16 - x);
  // The spike, up and outward from the top.
  poly(cv, [[m(2.5), 8], [m(0), 0], [m(7.5), 6]], "g");
  line(cv, Math.floor(m(1)), 1, Math.floor(m(2.5)), 6, "y");
  // The lower plate, gold-rimmed, under the round upper plate.
  shade(cv, inEllipse(8, 12, 7.8, 3.6), "dcba", roundLight(6.5, 10.5, 8, 4, -0.1));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ("abcd".includes(cv[y]![x]!) && !inEllipse(8, 11.3, 7, 3.3)(x, y)) cv[y]![x] = x < 7 ? "g" : x < 12 ? "G" : "h";
  shade(cv, inEllipse(8, 9, 7.2, 4.8), "dcba", roundLight(6, 7.2, 7, 5, 0.12));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ("abcd".includes(cv[y]![x]!) && inEllipse(8, 9, 7.2, 4.8)(x, y) && !inEllipse(8, 7.9, 6.2, 3.9)(x, y)) cv[y]![x] = x < 6 ? "y" : x < 12 ? "g" : "G";
  // A gold cross on the front, a blue stone at its heart.
  const gx = 8;
  for (const [x, y, k] of [[gx, 6, "y"], [gx - 1, 7, "g"], [gx, 7, "u"], [gx + 1, 7, "G"], [gx, 8, "G"]] as const) cv[y]![x] = k;
  return { grid: toGrid(cv) };
}
const pauldronL = paintPauldron(true);
const pauldronR = paintPauldron(false);

const torso: Part = (() => {
  const cv = canvas(18, 17);
  shade(cv, (x, y) => (y >= 1 && y <= 8 && (x >= 1 - (y > 2 ? 1 : 0) && x <= 16 + (y > 2 ? 1 : 0))) || (y > 8 && x >= Math.round((y - 8) * 0.4) && x <= 17 - Math.round((y - 8) * 0.4)), "dcba", roundLight(7, 5, 10, 10, 0.12));
  // Gold edging round the breastplate.
  edge(cv, -1, 0, "*", "g");
  edge(cv, 1, 0, "*", "G");
  // The gorget: a gold collar.
  for (let x = 5; x <= 12; x++) {
    cv[0]![x] = x < 8 ? "y" : "g";
    cv[1]![x] = x < 9 ? "g" : "G";
  }
  // Narrow blue banners down each side of the chest, a gold cross low on each.
  for (let y = 6; y < 17; y++) {
    cv[y]![2] = "u";
    cv[y]![3] = "U";
    cv[y]![14] = "U";
    cv[y]![15] = "v";
  }
  for (const x0 of [2, 14]) {
    cv[10]![x0] = "g";
    cv[10]![x0 + 1] = "g";
    cv[11]![x0] = "y";
    cv[11]![x0 + 1] = "G";
  }
  // The sun-cross on his breastplate, with four short rays.
  for (let y = 3; y <= 11; y++) {
    cv[y]![8] = y < 7 ? "y" : "g";
    cv[y]![9] = y < 7 ? "g" : "G";
  }
  for (let x = 5; x <= 12; x++) {
    cv[6]![x] = x < 8 ? "y" : "g";
    cv[7]![x] = x < 9 ? "g" : "G";
  }
  for (const [x, y, k] of [[6, 4, "g"], [11, 4, "g"], [6, 9, "G"], [11, 9, "G"], [7, 5, "g"], [10, 5, "g"], [7, 8, "G"], [10, 8, "G"]] as const) cv[y]![x] = k;
  // The sun's ring round the cross.
  for (let y = 0; y < 17; y++)
    for (let x = 0; x < 18; x++) {
      const d = Math.sqrt((x - 8.5) ** 2 + (y - 7) ** 2);
      if (d > 3.3 && d <= 4.3 && "abcd".includes(cv[y]![x]!)) cv[y]![x] = x + y < 15 ? "y" : x + y < 18 ? "g" : "G";
    }
  cv[6]![8] = "w";
  // The belt.
  for (let x = 3; x <= 14; x++) {
    cv[15]![x] = x === 8 || x === 9 ? "y" : "g";
    cv[16]![x] = x === 8 || x === 9 ? "g" : "G";
  }
  return { grid: toGrid(cv) };
})();

const hips: Part = (() => {
  const cv = canvas(22, 7);
  shade(cv, (x, y) => (y < 3 && x >= 1 && x <= 20) || (y >= 3 && x >= 0 && x <= 21 && !(y === 6 && (x === 0 || x === 21))), "dcba", (x, y) => 0.9 - 0.035 * x - 0.04 * (y % 3));
  for (let x = 0; x < 22; x++) {
    if (cv[2]![x] !== ".") cv[2]![x] = x < 9 ? "g" : "G";
    if (cv[6]![x] !== ".") cv[6]![x] = x < 9 ? "g" : x < 17 ? "G" : "h";
  }
  return { grid: toGrid(cv) };
})();

/** The blue tabard hanging in front, a gold border and cross, its hem torn into points. */
const tabard: Part = (() => {
  const cv = canvas(8, 17);
  poly(cv, [[0, 0], [8, 0], [8, 14], [7, 17], [5.5, 14.5], [4, 17], [2.5, 14.5], [1, 17], [0, 14]], "U");
  for (let y = 0; y < 17; y++) {
    if (cv[y]![0] !== ".") cv[y]![0] = "g";
    if (cv[y]![7] !== ".") cv[y]![7] = "G";
    if (cv[y]![1] === "U") cv[y]![1] = "u";
    if (cv[y]![6] === "U") cv[y]![6] = "v";
  }
  for (let y = 4; y <= 10; y++) cv[y]![3] = "g", (cv[y]![4] = "G");
  for (let x = 2; x <= 5; x++) cv[6]![x] = x < 4 ? "y" : "g";
  edge(cv, 0, 1, "U", "v");
  edge(cv, 0, 1, "u", "v");
  return { grid: toGrid(cv) };
})();

function paintLeg(left: boolean): Part {
  const cv = canvas(10, 18);
  const o = left ? 2 : 1; // the leg's left edge (the knee spike sits outside it)
  // Thigh and greave, lit from the left, a gold line down the outer edge.
  shade(cv, (x, y) => x >= o && x <= o + 6 && y <= 7, "dcba", (x) => 0.9 - 0.11 * (x - o));
  shade(cv, (x, y) => x >= o + 1 && x <= o + 5 && y >= 10, "dcba", (x, y) => 0.85 - 0.12 * (x - o) + (y > 15 ? -0.2 : 0));
  for (let y = 11; y < 18; y++) cv[y]![o + 3] = cv[y]![o + 3] === "a" ? "y" : "g";
  for (let x = o + 1; x <= o + 5; x++) cv[11]![x] = x < o + 3 ? "g" : "G";
  // The knee cop: a white dome in a gold ring, a spike out to the side.
  for (let y = 0; y < 18; y++)
    for (let x = 0; x < 10; x++) {
      const d = Math.sqrt((x + 0.5 - (o + 3.5)) ** 2 + ((y + 0.5 - 8.5) * 1.15) ** 2);
      if (d <= 2) cv[y]![x] = x + y < o + 11 ? "a" : "b";
      else if (d <= 3.4) cv[y]![x] = x + y < o + 11 ? "g" : "G";
    }
  const sx = left ? o - 1 : o + 7;
  cv[8]![sx] = "g";
  cv[8]![left ? sx - 1 : sx + 1] = "y";
  cv[9]![sx] = "G";
  return { grid: toGrid(cv) };
}
const legL = paintLeg(true);
const legR = paintLeg(false);

function paintBoot(left: boolean): Part {
  const cv = canvas(11, 5);
  const o = left ? 2 : 0;
  shade(cv, (x, y) => x >= o && x <= o + 8 && (y >= 1 || (x > o && x < o + 8)) && !(y === 0 && (x === o + 1 || x === o + 7)), "dcba", (x, y) => 0.95 - 0.08 * (x - o) - 0.05 * y);
  for (let x = o; x <= o + 8; x++) cv[4]![x] = x < o + 4 ? "g" : "G";
  for (let x = o + 3; x <= o + 5; x++) cv[2]![x] = "g";
  const sx = left ? 1 : 9;
  cv[3]![sx] = "g";
  cv[3]![left ? 0 : 10] = "y";
  return { grid: toGrid(cv) };
}
const bootL = paintBoot(true);
const bootR = paintBoot(false);

/** The cape: from behind his shoulders it streams out to the right and down, white with a gold edge, torn at the hem. */
const cape: Part = (() => {
  const cv = canvas(48, 38);
  poly(
    cv,
    [[6, 0], [32, 0], [36, 2.7], [40, 8.1], [43, 15.4], [46, 23.5], [48, 31.7], [45, 37.1], [43, 32.6], [40, 38], [37, 32.6], [34, 37.1], [31, 31.7], [28, 36.2], [25, 30.8], [21, 35.3], [17, 29.9], [12, 33.5], [8, 29], [4, 30.8], [3, 21.7], [3, 9]],
    "M",
  );
  shade(cv, (x, y) => cv[y]![x] !== ".", "nMmm", (x, y) => 0.98 - 0.013 * x - 0.008 * y);
  // Folds: long curved creases from the shoulders to the hem.
  for (const [x0, bend] of [[14, 5.4], [24, 8.1], [33, 8.1]] as const)
    for (let y = 4; y < 38; y++) {
      const x = Math.round(x0 + (bend * y) / 38 + (y * y) / 250);
      if (cv[y]?.[x] && cv[y]![x] !== ".") cv[y]![x] = "n";
      if (cv[y]?.[x - 1] && cv[y]![x - 1] !== "." && cv[y]![x - 1] !== "n") cv[y]![x - 1] = "m";
    }
  // A gold edge along its outer side and the torn hem, and the blue lining showing at the bottom.
  tint(cv, [[3, 25.3], [18, 28], [17, 36.2], [3, 32.6]], "*", "U");
  tint(cv, [[3, 25.3], [9, 26.2], [8, 36.2], [3, 32.6]], "U", "v");
  edge(cv, 1, 0, "*", "G", 2);
  edge(cv, 1, 0, "*", "g");
  edge(cv, 0, 1, "*", "g", 2);
  edge(cv, 0, 1, "*", "G");
  return { grid: toGrid(cv) };
})();

const fist: Part = { grid: [".bbc.", "abbcd", "abccd", "bcccd", ".cdd."] };

const shadow: Part = (() => {
  const cv = canvas(34, 3);
  ellipse(cv, 17, 1.5, 17, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

// ---- Arms: two shaded segments (upper arm, forearm with a gold cuff) from the pose's shoulder, elbow and fist.

interface Limb {
  part: Part;
  x: number;
  y: number;
}
function paintArm(s: Pt, e: Pt, f: Pt): Limb {
  const r1 = 2.9;
  const r2 = 2.5;
  const x0 = Math.floor(Math.min(s[0], e[0], f[0]) - 4);
  const y0 = Math.floor(Math.min(s[1], e[1], f[1]) - 4);
  const x1 = Math.ceil(Math.max(s[0], e[0], f[0]) + 4);
  const y1 = Math.ceil(Math.max(s[1], e[1], f[1]) + 4);
  const cv = canvas(x1 - x0 + 1, y1 - y0 + 1);
  const seg = (a: Pt, b: Pt, r: number, cuff: boolean) => {
    const bx = b[0] - a[0];
    const by = b[1] - a[1];
    const l2 = bx * bx + by * by || 1;
    for (let y = 0; y < cv.length; y++)
      for (let x = 0; x < cv[0]!.length; x++) {
        const px = x0 + x - a[0];
        const py = y0 + y - a[1];
        const t = Math.max(0, Math.min(1, (px * bx + py * by) / l2));
        const dx = px - t * bx;
        const dy = py - t * by;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        const light = 0.62 - (0.4 * dx) / r - (0.4 * dy) / r;
        const ramp = cuff && t > 0.62 && t < 0.86 ? "hGgy" : "dcba";
        cv[y]![x] = ramp[Math.max(0, Math.min(3, Math.floor(light * 4)))]!;
      }
  };
  seg(s, e, r1, false);
  seg(e, f, r2, true);
  // A gold elbow cop.
  for (let y = 0; y < cv.length; y++)
    for (let x = 0; x < cv[0]!.length; x++) {
      const d = Math.sqrt((x0 + x - e[0]) ** 2 + (y0 + y - e[1]) ** 2);
      if (d <= 1.6) cv[y]![x] = d < 0.8 ? "y" : "g";
    }
  return { part: { grid: toGrid(cv) }, x: x0, y: y0 };
}

// ---- The sword: a gold hilt with a blue gem, and a blade of golden fire, pointing along `dir` from the fist.

type Flame = "lit" | "flare" | "dim";
interface Blade {
  hilt: Part;
  blade: Part;
  /** The fist's pixel in the parts (they are square, the fist at the centre). */
  r: number;
  /** The blade's tip, from the fist. */
  tip: Pt;
}
const BLADE = 27;
function paintSword(dir: Pt, flick: number, mode: Flame, blade = BLADE): Blade {
  const len = blade + (mode === "flare" ? 4 : 0);
  const r = len + 8;
  const n = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]);
  const ux = dir[0] / n;
  const uy = dir[1] / n;
  const hilt = canvas(2 * r + 1, 2 * r + 1);
  const fire = canvas(2 * r + 1, 2 * r + 1);
  const width = mode === "flare" ? 1.45 : mode === "dim" ? 0.6 : 1.15;
  for (let y = 0; y <= 2 * r; y++)
    for (let x = 0; x <= 2 * r; x++) {
      const px = x - r;
      const py = y - r;
      const along = px * ux + py * uy;
      const across = -px * uy + py * ux;
      const ac = Math.abs(across);
      // Light from the top left: the side of the hilt facing up-left is lit.
      const lit = px + py < 0;
      if (along >= -6.5 && along < -4.5 && ac <= 1.4) hilt[y]![x] = ac < 0.6 ? "u" : lit ? "g" : "G";
      else if (along >= -4.5 && along < 2.5 && ac <= 0.8) hilt[y]![x] = "h";
      else if (along >= 2.5 && along < 4.5 && ac <= 4.6) hilt[y]![x] = ac < 0.8 ? "u" : ac > 3.6 ? "y" : across * (ux - uy) < 0 ? "g" : "G";
      else if (along >= 4.5 && along < 5.6 && ac >= 3.4 && ac <= 4.8) hilt[y]![x] = "g";
      if (along < 4.5 || along > len + 3) continue;
      // The blade: a flame, widest a third of the way up, tongues licking off both sides.
      const t = (along - 4.5) / (len - 4.5);
      const body = t > 1 ? 0 : (1.3 + 1.7 * Math.min(1, t * 3)) * (1 - t ** 4) * width;
      const side = across < 0 ? 0 : 1;
      const step = Math.floor((along + flick * 1.3) / 1.6);
      const tongue = hash(step, side, flick % 3) * (mode === "dim" ? 0.6 : 2.6) * (t > 1 ? 0.4 : 1) * width;
      const tip = t > 1 ? Math.max(0, 0.9 - (along - len) * 0.3) : 0;
      const reach = Math.max(body + tongue * (0.4 + 0.6 * t), tip);
      if (ac > reach) continue;
      const k = ac / (reach || 1);
      fire[y]![x] =
        mode === "dim" ? (k < 0.5 ? "o" : k < 0.8 ? "O" : "q") : ac <= 0.6 && t < 0.95 ? "f" : k < 0.5 ? "F" : k < 0.8 ? "o" : "O";
    }
  return { hilt: { grid: toGrid(hilt) }, blade: { grid: toGrid(fire), outline: false }, r, tip: [Math.round(ux * (len + 1)), Math.round(uy * (len + 1))] };
}

// ---- Poses.

/** Where his drawing space (60 x 60, one board square, feet at the bottom centre) sits on the frame. */
const OX = 34;
const OY = 40;
const SIZE = 60;

type ArmPose = "hold" | "mid" | "raise" | "point" | "back" | "across" | "down" | "low" | "guard" | "plant";
/** The sword arm: shoulder, elbow, fist (his drawing space) and the sword's direction. */
const SWORD_ARM: Record<ArmPose, { e: Pt; f: Pt; dir: Pt; len?: number }> = {
  hold: { e: [14, 30], f: [12, 36], dir: [-1, -2] },
  mid: { e: [11, 25], f: [8, 20], dir: [-1, -2] },
  raise: { e: [6, 14], f: [10, 4], dir: [0, -1] },
  point: { e: [10, 23], f: [5, 19], dir: [-1, -1] },
  back: { e: [12, 15], f: [17, 7], dir: [1, -1] },
  across: { e: [10, 24], f: [5, 25], dir: [-1, 0] },
  down: { e: [12, 29], f: [8, 33], dir: [-1, 1] },
  low: { e: [14, 30], f: [12, 39], dir: [0, 1], len: 15 },
  guard: { e: [14, 31], f: [19, 34], dir: [1, -1] },
  plant: { e: [14, 29], f: [14, 37], dir: [0, 1], len: 17 },
};
const SHOULDER_R: Pt = [17, 22];
const SHOULDER_L: Pt = [42, 22];
type OffPose = "hang" | "up" | "brace";
const OFF_ARM: Record<OffPose, { e: Pt; f: Pt }> = {
  hang: { e: [45, 30], f: [46, 37] },
  up: { e: [49, 15], f: [46, 7] },
  brace: { e: [45, 30], f: [41, 34] },
};

export interface KingPose {
  /** Upper body down by this much (a breath, a flinch). */
  bob?: number;
  /** Everything but the boots down (a crouch, a landing). */
  crouch?: number;
  /** Upper body sideways (a stagger). */
  dx?: number;
  arm?: ArmPose;
  off?: OffPose;
  /** The flame's flicker (0 to 2) and how it burns. */
  flick?: number;
  flame?: Flame;
  /** The helmet's wings, lifted a pixel. */
  flap?: boolean;
  /** The cape's ripple: travel (radians) and size. */
  wave?: number;
  waveAmp?: number;
  eyes?: "glow" | "hot" | "dim" | "out";
  /** Cracks in his armour, 0 to 3. */
  cracks?: number;
}

/** His frame position of a point in his drawing space. */
const at = (x: number, y: number): Pt => [OX + x, OY + y];

const EYES: Record<NonNullable<KingPose["eyes"]>, Record<string, string>> = {
  glow: {},
  hot: { e: "#fff3a8", E: "#ffffff" },
  dim: { e: "#9c6d16", E: "#d6a43a" },
  out: { e: "#2a2230", E: "#3a3040" },
};
/** A blow landing: his armour and cape flash red-white. */
const FLASH: Record<string, string> = { a: "#ffffff", b: "#ffd9d2", c: "#ff9e8f", d: "#c8453b", m: "#ffffff", M: "#ffd9d2", n: "#ff9e8f", N: "#c8453b" };

/** Cracks, worse at each level: the helm, then the chest and a shoulder, then the other shoulder and a thigh. */
const CRACKS: readonly (readonly Pt[])[] = [
  [[33, 8], [32, 9], [33, 10], [32, 11], [26, 9], [27, 10]],
  [[24, 23], [25, 24], [24, 25], [25, 26], [26, 27], [12, 20], [13, 21], [12, 22]],
  [[46, 20], [45, 21], [46, 22], [36, 29], [35, 30], [36, 31], [24, 41], [25, 42], [24, 43]],
];

const ARM_CACHE = new Map<string, Limb>();
const SWORD_CACHE = new Map<string, Blade>();
const PARTS: Record<string, Part> = {
  helm,
  crown,
  wingHelm,
  pauldronL,
  pauldronR,
  torso,
  hips,
  tabard,
  legL,
  legR,
  bootL,
  bootR,
  cape,
  fist,
  shadow,
};
function armPart(name: string, s: Pt, e: Pt, f: Pt): Limb {
  let limb = ARM_CACHE.get(name);
  if (!limb) {
    limb = paintArm(s, e, f);
    ARM_CACHE.set(name, limb);
    PARTS[name] = limb.part;
  }
  return limb;
}
function swordParts(dir: Pt, flick: number, mode: Flame, len = BLADE): { hilt: string; blade: string; sword: Blade } {
  const key = `${dir[0]},${dir[1]}:${len}:${flick % 3}:${mode}`;
  let sword = SWORD_CACHE.get(key);
  if (!sword) {
    sword = paintSword(dir, flick % 3, mode, len);
    SWORD_CACHE.set(key, sword);
    PARTS[`hilt:${key}`] = sword.hilt;
    PARTS[`blade:${key}`] = sword.blade;
  }
  return { hilt: `hilt:${key}`, blade: `blade:${key}`, sword };
}

/** Where the sword's tip is in a pose (his drawing space): his bolt and his slashes start there. */
export function swordTip(arm: ArmPose, flame: Flame = "lit"): Pt {
  const a = SWORD_ARM[arm];
  const { sword } = swordParts(a.dir, 0, flame, a.len);
  return [a.f[0] + sword.tip[0], a.f[1] + sword.tip[1]];
}

export function kingLayers(p: KingPose): { layers: Layer[]; specks: Speck[] } {
  const crouch = p.crouch ?? 0;
  const up = crouch + (p.bob ?? 0); // the upper body's drop
  const dx = p.dx ?? 0;
  const A = (part: string, x: number, y: number, extra: Partial<Layer> = {}): Layer => ({ part, x: OX + x, y: OY + y, ...extra });
  const U = (part: string, x: number, y: number, extra: Partial<Layer> = {}): Layer => A(part, x + dx, y + up, extra);
  const armPose = p.arm ?? "hold";
  const arm = SWORD_ARM[armPose];
  const fi: Pt = [arm.f[0] + dx, arm.f[1] + up];
  const limbR = armPart(`armR:${armPose}`, SHOULDER_R, arm.e, arm.f);
  const off = OFF_ARM[p.off ?? "hang"];
  const limbL = armPart(`armL:${p.off ?? "hang"}`, SHOULDER_L, off.e, off.f);
  // A sword pointing at the ground stops at the ground, however low he crouches.
  const { hilt, blade, sword } = swordParts(arm.dir, p.flick ?? 0, p.flame ?? "lit", arm.len === undefined ? undefined : arm.len - Math.max(0, up) - (p.flame === "flare" ? 4 : 0));
  const flap = p.flap ? -1 : 0;
  const amp = p.waveAmp ?? 1.5;
  const layers: Layer[] = [
    A("shadow", 13, SIZE - 2),
    A("cape", 13 + dx, 18 + Math.min(4, up), amp ? { wave: { along: "rows", amp, len: 22, phase: p.wave ?? 0, pin: "top" } } : {}),
    { part: `armL:${p.off ?? "hang"}`, x: OX + limbL.x + dx, y: OY + limbL.y + up },
    A("legL", 19, 38 + Math.ceil(crouch / 2)),
    A("legR", 32, 38 + Math.ceil(crouch / 2)),
    A("bootL", 17 - (crouch > 2 ? 1 : 0), 55),
    A("bootR", 32 + (crouch > 2 ? 1 : 0), 55),
    U("hips", 19, 34 - Math.floor((p.bob ?? 0) / 2)),
    U("torso", 21, 18),
    A("tabard", 26 + dx, 39 + Math.min(1, Math.max(0, up)), { wave: { along: "rows", amp: 1, len: 18, phase: (p.wave ?? 0) + 1, pin: "top" } }),
    { part: `armR:${armPose}`, x: OX + limbR.x + dx, y: OY + limbR.y + up },
    { part: blade, x: OX + fi[0] - sword.r, y: OY + fi[1] - sword.r },
    { part: hilt, x: OX + fi[0] - sword.r, y: OY + fi[1] - sword.r },
    A("fist", fi[0] - 2, fi[1] - 2),
    A("fist", off.f[0] + dx - 2, off.f[1] + up - 2),
    U("pauldronL", 8, 11),
    U("pauldronR", 36, 11),
    U("wingHelm", 17, 1 + flap),
    U("wingHelm", 36, 1 + flap, { flipX: true }),
    U("helm", 23, 7),
    U("crown", 22, 3),
  ];
  const specks: Speck[] = [];
  for (const crack of CRACKS.slice(0, p.cracks ?? 0))
    crack.forEach(([x, y], i) => {
      specks.push([OX + x + dx, OY + y + up, "s"]);
      if (i % 2 === 0) specks.push([OX + x + dx + 1, OY + y + up, "w"]);
    });
  return { layers, specks };
}

/** A frame from a pose; the eyes, a blow's flash and any extra specks go on top. */
function f(ms: number, p: KingPose, extra: Partial<Frame> & { hit?: boolean } = {}): Frame {
  const { layers, specks } = kingLayers(p);
  const { hit, ...rest } = extra;
  return {
    ms,
    layers,
    ...rest,
    specks: [...specks, ...(extra.specks ?? [])],
    pal: { ...EYES[p.eyes ?? "glow"], ...(hit ? FLASH : {}), ...extra.pal },
  };
}

// ---- Effects as specks.

/** Embers rising off the blade's tip, by frame. */
function embers(arm: ArmPose, i: number, n = 2, flame: Flame = "lit"): Speck[] {
  const [tx, ty] = swordTip(arm, flame);
  return Array.from({ length: n }, (_, j): Speck => {
    const age = (i + j * 3) % 6;
    const sway = [0, 1, 1, 0, -1, -1][(age + j) % 6]!;
    return [OX + tx + sway + (j % 2 ? 2 : -1), OY + ty - 1 - age * 2, age < 2 ? "F" : age < 4 ? "o" : "O"];
  });
}
/** A burst of light off the blade's tip (his sword raised, his bolt). */
function burst(arm: ArmPose, r: number, flame: Flame = "flare"): Speck[] {
  const [tx, ty] = swordTip(arm, flame);
  const out: Speck[] = [];
  for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const)
    for (let d = r - 2; d <= r; d++) out.push([OX + tx + ux * d, OY + ty + uy * d, d === r ? "F" : "f"]);
  return out;
}
/** His eyes flaring: short streaks of light either side of the visor. */
function eyeFlare(p: KingPose, long = false): Speck[] {
  const x = (p.dx ?? 0) + OX;
  const y = OY + 12 + (p.crouch ?? 0) + (p.bob ?? 0);
  const out: Speck[] = [];
  for (let d = 1; d <= (long ? 4 : 2); d++) out.push([x + 23 - d, y, d > 2 ? "e" : "E"], [x + 36 + d, y, d > 2 ? "e" : "E"]);
  return out;
}
/** The arc his sword cuts in a slash: a white-gold crescent in front of him. */
function arc(fade: number): Speck[] {
  const out: Speck[] = [];
  for (let a = 0; a <= 12; a++) {
    // A quarter circle from above his head down to his front, about his shoulder.
    const t = a / 12;
    const x = SHOULDER_R[0] - Math.round(24 * Math.sin((t * Math.PI) / 2 + 0.2));
    const y = SHOULDER_R[1] - Math.round(26 * Math.cos((t * Math.PI) / 2 + 0.2));
    if ((a + fade) % (fade ? 2 : 1)) continue;
    out.push([OX + x, OY + y, fade ? "F" : "f"], [OX + x + 1, OY + y + 1, "o"]);
  }
  return out;
}

// ---- Animations.

const FRAMES = 24;
const breath = (i: number) => (i >= 6 && i < 18 ? 1 : 0);
const wave = (i: number, n = FRAMES) => (i / n) * Math.PI * 2;

/** Idle: he breathes, his cape ripples, the flame flickers and sheds embers, his eyes glint now and then. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: FRAMES }, (_, i) =>
    f(100, { bob: breath(i), flick: i, wave: wave(i), flap: i >= 8 && i < 16, eyes: i === 10 || i === 11 ? "hot" : "glow" }, { specks: embers("hold", i) }),
  ),
};

/** Appearing on the board out of the beam: landed low, he rises. */
const appear: Anim = {
  loop: false,
  frames: [
    f(80, { crouch: 3, arm: "plant", eyes: "hot", flick: 0 }, { cue: "appear" }),
    f(80, { crouch: 1, arm: "hold", flick: 1 }),
    f(90, { arm: "hold", flick: 2 }),
  ],
};

const RAISED: KingPose = { arm: "raise", flame: "flare", eyes: "hot" };
/** Raising his sword: up over his head, the flame flares, his eyes blaze. */
const raise: Anim = {
  loop: false,
  frames: [
    f(70, { arm: "mid", eyes: "hot", flick: 0 }),
    f(70, { ...RAISED, bob: -1, flick: 1 }, { cue: "raise", specks: [...burst("raise", 3), ...eyeFlare(RAISED, true)] }),
    f(110, { ...RAISED, flick: 2 }, { specks: [...burst("raise", 5), ...eyeFlare(RAISED)] }),
  ],
};
/** Sword raised: the flame roars, his cape stirs. */
const raised: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) =>
    f(100, { ...RAISED, flick: i, wave: wave(i, 6), flap: i % 3 === 0, bob: i >= 3 ? 1 : 0, eyes: i % 3 === 1 ? "glow" : "hot" }, { specks: embers("raise", i, 3, "flare") }),
  ),
};
/** His bolt: a sweep forward, the sword pointed and blazing as the bolt leaves its tip, then up again. */
const point: Anim = {
  loop: false,
  frames: [
    f(70, { ...RAISED, arm: "back", flick: 0 }),
    f(80, { ...RAISED, arm: "point", flick: 1 }, { cue: "bolt", specks: burst("point", 4) }),
    f(160, { ...RAISED, arm: "point", flick: 2 }, { specks: burst("point", 6) }),
    f(100, { ...RAISED, arm: "point", flick: 0, eyes: "glow" }),
    f(90, { ...RAISED, arm: "mid", flick: 1 }),
  ],
};
/** One slash: back over his head, then a cut down across his front, a crescent of light behind the blade. */
const slash: Anim = {
  loop: false,
  frames: [
    f(60, { ...RAISED, arm: "back", flick: 0 }),
    f(50, { ...RAISED, arm: "across", flick: 1 }, { cue: "slash", specks: arc(0) }),
    f(80, { ...RAISED, arm: "down", flick: 2 }, { specks: arc(1) }),
    f(90, { ...RAISED, arm: "down", flick: 0, eyes: "glow" }),
    f(90, { ...RAISED, arm: "mid", flick: 1 }),
  ],
};

/** Lowering his sword after commanding it from his spot, back to how he stands by. */
const lower: Anim = {
  loop: false,
  frames: [f(90, { ...RAISED, arm: "mid", flame: "lit", eyes: "glow", flick: 0 }, { cue: "lower" }), f(90, { arm: "hold", flick: 1 })],
};

/** His leap out of the dock (his Last Stand): a crouch, then up, sword raised. */
const leap: Anim = {
  loop: false,
  frames: [
    f(100, { crouch: 4, arm: "hold", eyes: "hot" }, { cue: "leap" }),
    f(120, { bob: -2, arm: "raise", flame: "flare", eyes: "hot", flick: 1 }),
    f(230, { bob: -2, arm: "raise", flame: "flare", eyes: "hot", flick: 2 }),
  ],
};

/** Fallen: on his side, cracked, eyes dark, the flame down to embers, his crown rolled off beside him. */
function fallenFrame(ms: number, i: number, extra: Partial<Frame> = {}): Frame {
  const standing = kingLayers({ arm: "low", flame: "dim", flick: i, eyes: "out", cracks: 3, waveAmp: 0 });
  // Lying on his side, head to the left: the body without its cape, sword and crown, turned a quarter, then
  // set down on the floor line, centred on his foot point.
  const keep = (l: Layer) => !/^(hilt|blade|crown|shadow|cape)/.test(l.part);
  const turned = lieDown(PARTS, { layers: standing.layers.filter(keep), specks: standing.specks }, 0, 0);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const l of turned.layers) {
    const [w, h] = partSize(PARTS[l.part]!, l.rot ?? 0);
    [x0, y0, x1, y1] = [Math.min(x0, l.x), Math.min(y0, l.y), Math.max(x1, l.x + w), Math.max(y1, l.y + h)];
  }
  const sx = OX + 31 - Math.round((x0 + x1) / 2);
  const sy = OY + SIZE - 1 - y1;
  const { hilt, blade, sword } = swordParts([-1, 0], i, "dim", 20);
  const fist: Pt = [OX + 46, OY + SIZE - 6];
  return {
    ms,
    layers: [
      { part: "shadow", x: OX + 13, y: OY + SIZE - 2 },
      ...turned.layers.map((l) => ({ ...l, x: l.x + sx, y: l.y + sy })),
      { part: "crown", x: OX - 4, y: OY + SIZE - 17, rot: 3 },
      { part: blade, x: fist[0] - sword.r, y: fist[1] - sword.r },
      { part: hilt, x: fist[0] - sword.r, y: fist[1] - sword.r },
    ],
    specks: [...turned.specks.map(([x, y, k]): Speck => [x + sx, y + sy, k]), ...(extra.specks ?? [])],
    pal: { ...EYES.out, ...extra.pal },
    ...(extra.cue ? { cue: extra.cue } : {}),
  };
}
const fallen: Anim = { loop: true, frames: [0, 1, 2, 3, 4, 5].map((i) => fallenFrame(160, i)) };

/** Rising again (the result screen, if the crowd won): from the ground to one knee, up, and his sword raised. */
const rise: Anim = {
  loop: false,
  frames: [
    fallenFrame(200, 0, { cue: "rise" }),
    f(160, { crouch: 5, bob: 2, arm: "plant", flame: "dim", eyes: "dim", cracks: 1 }),
    f(160, { crouch: 3, arm: "plant", flame: "lit", eyes: "glow" }),
    f(140, { crouch: 1, arm: "mid", eyes: "hot" }),
    f(200, { ...RAISED, flick: 1 }, { specks: [...burst("raise", 5), ...eyeFlare(RAISED, true)] }),
  ],
};

/**
 * His Last Stand, from the moment he starts to fall onto the piece's square (LAST_STAND.fallAt): the dive, the
 * crash, standing guard over the square through the banner and the piece sliding back, the 25 blows (each a flash
 * and a jolt; his armour cracks at LAST_STAND.crackAt), the stagger, the collapse, and lying fallen. Built from the
 * shared timings, so the picture stays in step with the effects and sounds.
 */
function lastStandAnim(blows: readonly number[], cracks: readonly number[]): Anim {
  const L = LAST_STAND;
  const t0 = L.fallAt;
  const frames: Frame[] = [];
  let t = t0;
  const push = (ms: number, p: KingPose, extra: Partial<Frame> & { hit?: boolean } = {}) => {
    frames.push(f(ms, p, extra));
    t += ms;
  };
  const cracksAt = (ms: number) => cracks.filter((c) => ms >= c).length;
  // The dive: sword point down.
  push(L.crashAt - t0, { arm: "low", flame: "flare", eyes: "hot", bob: -2, flick: 1 });
  // The crash: landed low, sword planted.
  push(130, { crouch: 4, arm: "plant", flame: "flare", eyes: "hot", flick: 2 }, { cue: "crash", shake: [1, 0] });
  push(170, { crouch: 2, arm: "plant", eyes: "hot", flick: 0 }, { shake: [-1, 0] });
  // Standing guard over the square, sword across him.
  let i = 0;
  while (t + 100 <= L.slashAt) push(100, { arm: "guard", flick: i, wave: wave(i++), eyes: i % 8 === 0 ? "hot" : "glow" });
  if (blows[0]! > t) push(blows[0]! - t, { arm: "guard", flick: i, eyes: "hot" });
  // The blows: each lands with a red-white flash and a jolt, and he holds his guard till the next.
  for (let b = 0; b < blows.length; b++) {
    const c = cracksAt(t);
    const p: KingPose = { arm: "guard", flick: b, cracks: c, eyes: b % 3 === 0 ? "hot" : "glow", flame: b > blows.length * 0.75 ? "dim" : "lit" };
    const gap = (blows[b + 1] ?? blows[b]! + L.slashEveryMs) - blows[b]!;
    push(50, { ...p, bob: 1 }, { hit: true, shake: [b % 2 ? 1 : -1, 0], ...(b === 0 ? { cue: "blows" } : {}) });
    push(gap - 50, p);
  }
  // Until the stagger: braced, hurt.
  if (L.staggerAt > t) push(L.staggerAt - t, { arm: "low", flame: "dim", cracks: 3, eyes: "dim", bob: 1 });
  // The stagger: he reels one way, then the other, sword dropping.
  const stagger = L.collapseAt - L.staggerAt;
  push(Math.round(stagger / 3), { arm: "low", flame: "dim", cracks: 3, eyes: "dim", dx: -2, bob: 1 }, { cue: "stagger" });
  push(Math.round(stagger / 3), { arm: "low", flame: "dim", cracks: 3, eyes: "dim", dx: 2, bob: 1 });
  push(L.collapseAt - t, { arm: "low", flame: "dim", cracks: 3, eyes: "dim", dx: -1, bob: 2 });
  // The collapse: to one knee, slumping, then down on his side.
  push(140, { crouch: 5, bob: 2, arm: "plant", flame: "dim", cracks: 3, eyes: "dim" }, { cue: "collapse" });
  push(140, { crouch: 6, bob: 4, dx: 1, arm: "plant", flame: "dim", cracks: 3, eyes: "out" });
  frames.push(fallenFrame(Math.max(100, L.fadeAt + L.fadeMs - t - 280), 0), fallenFrame(1000, 1));
  return { loop: false, frames };
}
/** The 25 blows, one every LAST_STAND.slashEveryMs from slashAt; his armour cracks at crackAt. */
const lastStand = lastStandAnim(
  Array.from({ length: LAST_STAND.slashes }, (_, b) => LAST_STAND.slashAt + b * LAST_STAND.slashEveryMs),
  LAST_STAND.crackAt,
);
/**
 * Against a boss that attacks him itself (its kit's `kingAttack`: Hollow lashing him with his strand), the blows are its
 * lashes (lastStandAttackHits), and his armour cracks at the 2nd, 6th and 9th.
 */
const lastStandAttacked = (() => {
  const hits = lastStandAttackHits();
  return lastStandAnim(hits, [hits[1]!, hits[5]!, hits[8]!]);
})();

/** His portraits for the banners: sword raised, eyes blazing; and battle-worn (cracked, eyes dim, a few red drops). */
const portrait: Anim = { loop: true, frames: [f(1000, { ...RAISED, flick: 1, wave: 0 }, { specks: eyeFlare(RAISED) })] };
const portraitHurt: Anim = {
  loop: true,
  frames: [
    f(1000, { arm: "hold", flame: "dim", cracks: 3, eyes: "dim", bob: 1, wave: 0 }, {
      specks: [[OX + 34, OY + 12, "r"], [OX + 34, OY + 13, "R"], [OX + 25, OY + 27, "r"], [OX + 26, OY + 28, "R"], [OX + 13, OY + 24, "r"]],
    }),
  ],
};

const ANIMS = { idle, appear, raise, raised, point, slash, lower, leap, lastStand, lastStandAttacked, fallen, rise, portrait, portraitHurt };
export type GodKingAnim = keyof typeof ANIMS;

export const GOD_KING: Character = {
  id: "god-king",
  name: "The God King",
  w: 108,
  h: 104,
  foot: [OX + 30, OY + SIZE - 1],
  palette: GOD_KING_PALETTE,
  halo: "#3b3322",
  looks: { black: GOD_KING_BLACK },
  parts: PARTS,
  anims: ANIMS,
};

/** His drawing space on the frame: one board square (60 x 60), for placing him on the board and in the dock. */
export const GOD_KING_BOX = { x: OX, y: OY, size: SIZE } as const;

/** The part of him a portrait shows (sword, crown to chest), in frame pixels. */
export const GOD_KING_PORTRAIT = { x: OX + 5, y: OY - 7, w: 50, h: 37 } as const;


// ---- Which frame shows when (pure, so the screens and the tests agree).

const animLength = (a: Anim) => a.frames.reduce((t, fr) => t + fr.ms, 0);
function frameIn(a: Anim, t: number): number {
  let acc = 0;
  for (let i = 0; i < a.frames.length; i++) if (t < (acc += a.frames[i]!.ms)) return i;
  return a.frames.length - 1;
}

/**
 * The frame of his that shows at `now`: a one-shot animation plays once from `since`, then `then` loops (or its last
 * frame holds if there's no `then`); a loop runs by the clock, so every figure of him on screen is in step.
 */
export function kingFrameAt(anim: GodKingAnim, now: number, since = 0, then?: GodKingAnim): { anim: GodKingAnim; frame: number } {
  const a = GOD_KING.anims[anim]!;
  if (!a.loop) {
    if (now - since < animLength(a) || !then) return { anim, frame: frameIn(a, Math.max(0, now - since)) };
    anim = then;
  }
  const loop = GOD_KING.anims[anim]!;
  const total = animLength(loop);
  return { anim, frame: frameIn(loop, ((now % total) + total) % total) };
}

/** How long one of his animations runs. */
export const kingAnimMs = (anim: GodKingAnim) => animLength(GOD_KING.anims[anim]!);

/** When his summoned moments land (ms after the summon starts): mirrors KingSummon's timeline. */
export interface SummonTimes {
  appearAt: number;
  raiseAt: number;
  /** His bolt to the piece he moves, or the strike's slashes. */
  boltAt?: number;
  slashAt?: readonly number[];
}

/** How long an animation runs before its cue frame (the bolt leaving, the cut landing). */
export function cueLead(anim: GodKingAnim): number {
  const frames = GOD_KING.anims[anim]!.frames;
  const i = frames.findIndex((fr) => fr.cue);
  return frames.slice(0, Math.max(0, i)).reduce((t, fr) => t + fr.ms, 0);
}

/**
 * What he does on the board at `t` ms into his summon: appear out of the beam, raise his sword (and hold it up
 * through the cut-in), then point it as his bolt leaves the tip, or cut once for each of the strike's slashes. The
 * frame with the bolt or the cut (its cue) lands exactly on the effect's time.
 */
export function summonMoment(times: SummonTimes, t: number): { anim: GodKingAnim; at: number; then: GodKingAnim } {
  let best: { anim: GodKingAnim; at: number; then: GodKingAnim } = { anim: "appear", at: times.appearAt, then: "idle" };
  if (t >= times.raiseAt) best = { anim: "raise", at: times.raiseAt, then: "raised" };
  if (times.boltAt !== undefined && t >= times.boltAt - cueLead("point")) best = { anim: "point", at: times.boltAt - cueLead("point"), then: "raised" };
  for (const at of times.slashAt ?? []) if (t >= at - cueLead("slash")) best = { anim: "slash", at: at - cueLead("slash"), then: "raised" };
  return best;
}

/** When his commanded moments land (ms after he starts), acting from his spot by the board: see KING_COMMAND. */
export interface CommandTimes {
  raiseAt: number;
  /** His bolt to the piece he moves, or the strike's slashes. */
  boltAt?: number;
  slashAt?: readonly number[];
  /** He lowers his sword, and stands by again. */
  lowerAt: number;
}

/**
 * What he does in his spot at `t` ms into a command: stand by until he raises his sword (and holds it up through the
 * cut-in), point it as his bolt leaves the tip or cut once for each of the strike's slashes, then lower it and stand
 * by. The frame with the bolt or the cut (its cue) lands exactly on the effect's time.
 */
export function commandMoment(times: CommandTimes, t: number): { anim: GodKingAnim; at: number; then: GodKingAnim } {
  let best: { anim: GodKingAnim; at: number; then: GodKingAnim } = { anim: "idle", at: 0, then: "idle" };
  if (t >= times.raiseAt) best = { anim: "raise", at: times.raiseAt, then: "raised" };
  if (times.boltAt !== undefined && t >= times.boltAt - cueLead("point")) best = { anim: "point", at: times.boltAt - cueLead("point"), then: "raised" };
  for (const at of times.slashAt ?? []) if (t >= at - cueLead("slash")) best = { anim: "slash", at: at - cueLead("slash"), then: "raised" };
  if (t >= times.lowerAt) best = { anim: "lower", at: times.lowerAt, then: "idle" };
  return best;
}

/**
 * Where his sword's tip is when his bolt leaves it (pointing) and when he holds it up (a strike's bolts), from the
 * top-left of his square, in squares.
 */
const inSquares = ([x, y]: Pt): Pt => [x / SIZE, y / SIZE];
export const KING_TIP = { point: inSquares(swordTip("point", "flare")), raised: inSquares(swordTip("raise", "flare")) };
