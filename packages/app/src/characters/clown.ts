/**
 * Boingo the Clown (boss tier 2, from 1500): a grinning harlequin on a pogo stick, after Eric's reference picture,
 * redrawn. Always bouncing. Drawn facing front, light from the top left.
 *
 * Rigging: the pogo's top (handlebar, shaft, foot bar) is one rigid piece; the spring tube and rubber tip slide on it.
 * The gloves hold the handlebar and the shoes stand on the foot bar, so they ride with the pogo; the body, sleeves,
 * head, hair and hat ride on top and can crouch or stretch against it. A pose is a handful of numbers.
 */
import { canvas, ellipse, inEllipse, inPoly, roundLight, shade, toGrid, type Canvas } from "./paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "./sprite.ts";

export const CLOWN_PALETTE = {
  k: "#150c11", // outline, seams
  w: "#f6f1ea", // face paint, gloves, ruff
  W: "#d8cbc6",
  X: "#a39294",
  r: "#e2343b", // suit and hair: red
  R: "#a3202b",
  q: "#5c1521",
  p: "#7d3b93", // purple
  P: "#4b2161",
  y: "#f2c14e", // pompoms and buttons (the game's gold)
  Y: "#b58430",
  o: "#cf8038", // shoes
  O: "#7c4421",
  s: "#e4e6ec", // pogo steel
  S: "#9ca0ab",
  t: "#565b67",
  e: "#ff4434", // eyes
  E: "#ffe3d6", // glints
  m: "#2b0d13", // mouth
  n: "#fbf6ec", // teeth
  b: "#62bdf5", // sweat
  B: "#d4f0ff",
  g: "#62d06a", // confetti
  u: "#4aa3ff",
  z: "#0d0e12", // ground shadow
} as const;

/** Harlequin diamonds: true on the purple ones. */
const diamond = (x: number, y: number, size = 4) => ((Math.floor((x + y) / size) + Math.floor((x - y + 64) / size)) & 1) === 1;

/** Fills a shape with the suit: red and purple diamonds, darker to the right and below. */
function suit(cv: Canvas, inside: (x: number, y: number) => boolean, light: (x: number, y: number) => number, size = 4, shift = 0): void {
  shade(cv, inside, "12", light);
  cv.forEach((row, y) =>
    row.forEach((k, x) => {
      if (k !== "1" && k !== "2") return;
      const purple = diamond(x + shift, y, size);
      cv[y]![x] = k === "2" ? (purple ? "p" : "r") : purple ? "P" : "R";
    }),
  );
}

// ---- Head: one face per mood.

export type Mood = "grin" | "laugh" | "hurt" | "smug" | "rattled" | "think" | "honk" | "out";

const EYES: Record<string, readonly string[]> = {
  // Left eye; the right is its mirror. 4 x 4, top-left at (5, 6) on the face.
  menace: ["kk...", ".kkkk", "qeEeq", ".qqq."],
  squint: [".....", ".kkk.", "k...k", "....."],
  wide: [".qqq.", "qwwwq", "qwwek", ".qqq."],
  x: ["k...k", ".k.k.", "..k..", ".k.k."],
  half: [".....", "kkkkk", "qeeeq", "....."],
  look: ["kk...", "Ekkkk", "eeqqq", ".qqq."],
};
const MOUTHS: Record<string, readonly string[]> = {
  // Centred under the nose, top row at y 12.
  grin: ["r...........r", "rkmnnnnnnnmkr", ".rkmnnnnnmkr.", "..rrkkkkkrr.."],
  laugh: ["rkkkkkkkkkr", "kmnnnnnnnmk", "kmmmmmmmmmk", "kmmmrrrmmmk", "rkmmmmmmmkr", ".rrkkkkkrr."],
  o: [".kk.", "kmmk", "kmmk", ".kk."],
  smirk: ["........k", "kkkk..kk.", "....kk..."],
  wavy: ["kk..kk..kk", "..kk..kk.."],
};
const FACES: Record<Mood, { eyes: string; mouth: string }> = {
  grin: { eyes: "menace", mouth: "grin" },
  laugh: { eyes: "squint", mouth: "laugh" },
  hurt: { eyes: "x", mouth: "o" },
  smug: { eyes: "half", mouth: "smirk" },
  rattled: { eyes: "wide", mouth: "wavy" },
  think: { eyes: "look", mouth: "smirk" },
  honk: { eyes: "squint", mouth: "grin" },
  out: { eyes: "x", mouth: "wavy" },
};

function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number, mirror = false): void {
  rows.forEach((row, y) =>
    [...row].forEach((k, i) => {
      if (k === ".") return;
      const x = mirror ? x0 + row.length - 1 - i : x0 + i;
      if (cv[y0 + y]?.[x] !== undefined) cv[y0 + y]![x] = k;
    }),
  );
}

function head(mood: Mood): Part {
  const cv = canvas(21, 19);
  shade(cv, (x, y) => inEllipse(10.5, 8.5, 10.5, 8.5)(x, y) || inEllipse(10.5, 12, 7.5, 7)(x, y), "XWww", roundLight(10.5, 9, 10.5, 10, 0.05));
  // Clown paint: red marks through each eye.
  for (const x of [6, 14]) {
    for (const y of [2, 3, 4]) cv[y]![x] = "r";
    cv[11]![x] = "r";
  }
  const f = FACES[mood];
  stamp(cv, EYES[f.eyes]!, 3, 6);
  stamp(cv, EYES[f.eyes]!, 13, 6, true);
  // The nose (squashed flat for a honk).
  stamp(cv, mood === "honk" ? ["rrrr", "rErR", "RRRR"] : [".rr.", "rErR", ".RR."], 9, 9);
  const mouth = MOUTHS[f.mouth]!;
  stamp(cv, mouth, Math.round(10.5 - mouth[0]!.length / 2), 12);
  return { grid: toGrid(cv) };
}

// ---- The rest of him.

const hair: Part = (() => {
  const cv = canvas(46, 17);
  const left = [[13, 3], [8, 1], [9, 3], [3, 2], [6, 5], [0, 6], [5, 8], [1, 11], [6, 11], [4, 15], [10, 13], [13, 15]] as const;
  const right = left.map(([x, y]) => [45 - x, y] as const);
  shade(cv, inPoly(left), "qRr", (x, y) => 1.05 - 0.03 * (13 - x) - 0.04 * y);
  shade(cv, inPoly(right), "qRr", (x, y) => 0.9 - 0.04 * (x - 32) - 0.04 * y);
  return { grid: toGrid(cv) };
})();

const hat: Part = (() => {
  const cv = canvas(17, 13);
  const cone = inPoly([[1, 12], [16, 12], [13, 7], [11, 3], [9, 3], [5, 7]]);
  shade(cv, cone, "12", (x, y) => 0.75 - 0.04 * x + 0.01 * y);
  cv.forEach((row, y) => row.forEach((k, x) => {
    if (k !== "1" && k !== "2") return;
    const purple = Math.floor((x + y * 0.6) / 3) % 2 === 0;
    cv[y]![x] = k === "2" ? (purple ? "p" : "r") : purple ? "P" : "R";
  }));
  ellipse(cv, 10, 2, 2.2, 2.2, "y");
  cv[1]![9] = "E";
  cv[3]![11] = "Y";
  return { grid: toGrid(cv) };
})();

const ruff: Part = (() => {
  const cv = canvas(25, 7);
  shade(cv, inEllipse(12.5, 3.5, 12.5, 3.5), "XWw", (x, y) => 0.8 - 0.25 * ((x - 12.5) / 12.5) - 0.2 * ((y - 3.5) / 3.5));
  // Frills: a dark pleat every other pixel below the top edge.
  cv.forEach((row, y) => row.forEach((k, x) => k !== "." && y >= 2 && x % 2 === 0 && (cv[y]![x] = y >= 5 ? "k" : "X")));
  return { grid: toGrid(cv) };
})();

const body: Part = (() => {
  const cv = canvas(20, 14);
  suit(cv, inPoly([[2, 0], [18, 0], [20, 6], [19, 14], [1, 14], [0, 6]]), (x, y) => 0.8 - 0.035 * x - 0.01 * y);
  for (const y of [4, 8]) {
    cv[y]![9] = "y";
    cv[y]![10] = "y";
    cv[y + 1]![9] = "Y";
    cv[y + 1]![10] = "Y";
  }
  return { grid: toGrid(cv) };
})();

const sleeve: Part = (() => {
  const cv = canvas(7, 8);
  suit(cv, inEllipse(3.5, 4, 3.5, 4), (x, y) => 0.85 - 0.06 * x - 0.03 * y, 3);
  return { grid: toGrid(cv) };
})();

const glove: Part = (() => {
  const cv = canvas(6, 5);
  shade(cv, inEllipse(3, 2.5, 3, 2.5), "XWw", roundLight(3, 2.5, 3, 2.5, 0.15));
  cv[3]![1] = "W";
  cv[3]![3] = "W";
  return { grid: toGrid(cv) };
})();

const hips: Part = (() => {
  const cv = canvas(26, 10);
  const inside = (x: number, y: number) => inEllipse(5.5, 5.5, 5.8, 4.5)(x, y) || inEllipse(20.5, 5.5, 5.8, 4.5)(x, y) || (x >= 6 && x < 20 && y < 3);
  suit(cv, inside, (x, y) => 0.8 - 0.03 * x - 0.03 * y, 4, 1);
  return { grid: toGrid(cv) };
})();

const shins: Part = (() => {
  const cv = canvas(18, 9);
  suit(cv, (x) => (x >= 1 && x <= 5) || (x >= 12 && x <= 16), (x) => 0.7 - 0.03 * x, 3);
  return { grid: toGrid(cv) };
})();

const shoe: Part = (() => {
  const cv = canvas(10, 4);
  shade(cv, inEllipse(5, 2.2, 5, 2.2), "Oo", roundLight(5, 2, 5, 2.2, 0.15));
  cv[1]![2] = "E";
  return { grid: toGrid(cv) };
})();

/** The pogo's rigid top: handlebar, shaft (into the spring tube) and foot bar. */
const pogoTop: Part = (() => {
  const cv = canvas(20, 22);
  for (let x = 0; x < 20; x++) {
    cv[0]![x] = "s";
    cv[1]![x] = "S";
  }
  for (let y = 2; y < 22; y++) {
    cv[y]![9] = "s";
    cv[y]![10] = "S";
  }
  return { grid: toGrid(cv) };
})();

/** The foot bar, under the shoes. */
const footBar: Part = { grid: ["rrrrrrrrrrrrrrrrrrrr", "RRRRRRRRRRRRRRRRRRRR"] };

/** The spring tube and the rubber tip. */
const pogoBottom: Part = { grid: [".tSSt.", ".tSSt.", ".tttt.", ".tSSt.", ".tSSt.", ".tttt.", ".tSSt.", "rrrrrr", "rrrrRR", ".RRRR."] };

const shadow: Part = (() => {
  const cv = canvas(22, 3);
  ellipse(cv, 11, 1.5, 11, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();

/** A cream pie (his passive power), side on: a cherry, the cream, the crust and the tin. */
const pie: Part = { grid: ["....rr....", "..wwEwww..", ".wwwwwwWW.", "oooooooooo", ".OSSSSSSO."] };

const PARTS = {
  pie,
  head: head("grin"),
  headLaugh: head("laugh"),
  headHurt: head("hurt"),
  headSmug: head("smug"),
  headRattled: head("rattled"),
  headThink: head("think"),
  headHonk: head("honk"),
  headOut: head("out"),
  hair,
  hat,
  ruff,
  body,
  sleeve,
  glove,
  hips,
  shins,
  shoe,
  pogoTop,
  footBar,
  pogoBottom,
  shadow,
};
const HEADS: Record<Mood, keyof typeof PARTS> = {
  grin: "head",
  laugh: "headLaugh",
  hurt: "headHurt",
  smug: "headSmug",
  rattled: "headRattled",
  think: "headThink",
  honk: "headHonk",
  out: "headOut",
};

/** Where his own drawing space (48 x 60, the pogo's tip on the ground at y 59) sits on the frame. */
const OX = 12;
const OY = 30;
const GROUND = 60;

export interface ClownPose {
  /** Height of the pogo's tip off the ground. */
  air?: number;
  /** Spring squeezed (tip on the ground, everything above sinks). */
  squeeze?: number;
  /** Body against the pogo: + crouches, - stretches. */
  crouch?: number;
  /** Sideways, for the whole of him. */
  dx?: number;
  mood?: Mood;
  /** Head and hat nudges (a laugh throws the head back; a hit knocks the hat up). */
  headDy?: number;
  headDx?: number;
  hatDy?: number;
  hatDx?: number;
  /** A glove off the handlebar: to the chin (thinking), to the nose (a honk), out (pointing) or up (cheering). */
  right?: "bar" | "chin" | "nose" | "point" | "up" | "back";
  left?: "bar" | "up";
  /** Shoes off the foot bar, kicked out to the sides (a big jump's split). */
  kick?: number;
  /** Mirror him (half of a spin). */
  flip?: boolean;
  /** Knocked off his pogo: sitting on the ground, the pogo lying beside him, his hat fallen off. */
  fallen?: boolean;
}

const at = (part: keyof typeof PARTS, x: number, y: number, extra: Partial<Layer> = {}): Layer => ({ part, x: OX + x, y: OY + y, ...extra });

export function clownLayers(p: ClownPose): Layer[] {
  if (p.fallen) return fallenLayers(p);
  const air = p.air ?? 0;
  const sq = p.squeeze ?? 0;
  const dx = p.dx ?? 0;
  const top = sq - air; // the pogo top's offset from rest
  const b = top + (p.crouch ?? 0); // the body's
  const kick = p.kick ?? 0;
  const hx = p.headDx ?? 0;
  const hy = b + (p.headDy ?? 0);
  const m = (x: number, w: number) => (p.flip ? 48 - x - w : x) + dx;
  const L = (part: keyof typeof PARTS, x: number, w: number, y: number, extra: Partial<Layer> = {}) => at(part, m(x, w), y, { flipX: p.flip, ...extra });
  const right = p.right ?? "bar";
  const left = p.left ?? "bar";
  const gloveR: Record<string, [number, number]> = { bar: [30, 30 + top], chin: [26, 20 + b], nose: [24, 13 + hy], point: [39, 23 + b], up: [36, 8 + b], back: [40, 6 + b] };
  const sleeveR: Record<string, [number, number]> = { bar: [30, 26 + b], chin: [29, 23 + b], nose: [29, 22 + b], point: [34, 22 + b], up: [34, 16 + b], back: [36, 15 + b] };
  const gloveL: Record<string, [number, number]> = { bar: [12, 30 + top], up: [6, 8 + b] };
  const sleeveL: Record<string, [number, number]> = { bar: [11, 26 + b], up: [7, 16 + b] };
  return [
    at("shadow", 13 + dx, GROUND - 1),
    L("pogoBottom", 21, 6, 49 - air),
    L("shins", 15, 18, 38 + top + Math.min(0, p.crouch ?? 0)),
    L("footBar", 14, 20, 47 + top),
    L("shoe", 12 - kick, 10, 44 + top - (kick ? 2 : 0)),
    L("shoe", 26 + kick, 10, 44 + top - (kick ? 2 : 0)),
    L("hips", 11, 26, 34 + b),
    L("hair", 1 + hx, 46, 6 + hy),
    L("body", 14, 20, 25 + b),
    L("sleeve", sleeveL[left]![0], 7, sleeveL[left]![1]),
    L("sleeve", sleeveR[right]![0], 7, sleeveR[right]![1]),
    L("ruff", 12, 25, 23 + b),
    L(HEADS[p.mood ?? "grin"], 14 + hx, 21, 5 + hy),
    L("hat", 16 + hx + (p.hatDx ?? 0), 17, -4 + hy + (p.hatDy ?? 0)),
    L("pogoTop", 14, 20, 31 + top),
    L("glove", gloveL[left]![0], 6, gloveL[left]![1]),
    L("glove", gloveR[right]![0], 6, gloveR[right]![1]),
  ];
}

/** Sitting on the ground, legs out, the pogo lying behind him and his hat beside it. */
function fallenLayers(p: ClownPose): Layer[] {
  const dx = p.dx ?? 0;
  const b = 13; // the body sunk to the ground
  const hy = b + 1 + (p.headDy ?? 0);
  const L = (part: keyof typeof PARTS, x: number, y: number, extra: Partial<Layer> = {}) => at(part, x + dx, y, extra);
  return [
    at("shadow", 11 + dx, GROUND - 1),
    L("pogoTop", 26, GROUND - 21, { rot: 1 }),
    L("pogoBottom", 2, GROUND - 7, { rot: 3 }),
    L("shoe", 2, GROUND - 4),
    L("shoe", 36, GROUND - 4),
    L("hips", 11, 34 + b),
    L("hair", 1, 6 + hy),
    L("body", 14, 25 + b),
    L("sleeve", 9, 27 + b),
    L("sleeve", 32, 27 + b),
    L("ruff", 12, 23 + b),
    L(HEADS[p.mood ?? "out"], 14, 5 + hy),
    L("glove", 7, 33 + b),
    L("glove", 35, 33 + b),
    L("hat", 34 + (p.hatDx ?? 0), GROUND - 17 + (p.hatDy ?? 0), { rot: 1 }),
  ];
}

const pose = clownLayers;

// ---- Animations. Frames are built from poses; `cue`s are his sounds (see sound.ts).

const f = (ms: number, p: ClownPose, extra: Partial<Frame> = {}): Frame => ({ ms, layers: pose(p), ...extra });

/** One bounce: [air, squeeze, crouch] per frame, landing first. */
const BOUNCE: readonly (readonly [number, number, number])[] = [
  [0, 3, 2],
  [0, 1, 0],
  [3, 0, -2],
  [6, 0, -1],
  [7, 0, 0],
  [6, 0, 0],
  [3, 0, 0],
  [0, 1, 1],
];
const bounce = (ms: number, extra: (i: number) => Partial<ClownPose> & { specks?: Speck[]; pal?: Record<string, string> } = () => ({}), scale = 1): Frame[] =>
  BOUNCE.map(([air, squeeze, crouch], i) => {
    const { specks, pal, ...more } = extra(i);
    return { ms, layers: pose({ air: Math.round(air * scale), squeeze, crouch, ...more }), specks, pal };
  });

/** The big jump: a deep squeeze, up high with a split kick, a hard landing. */
const BIG: readonly ClownPose[] = [
  { squeeze: 4, crouch: 3 },
  { squeeze: 4, crouch: 4 },
  { air: 6, crouch: -3 },
  { air: 14, crouch: -2 },
  { air: 20, kick: 3 },
  { air: 23, kick: 5 },
  { air: 23, kick: 5 },
  { air: 20, kick: 3 },
  { air: 14 },
  { air: 7, crouch: -1 },
  { squeeze: 4, crouch: 3 },
  { squeeze: 2, crouch: 1 },
  { air: 3 },
  { air: 3 },
  { squeeze: 1, crouch: 1 },
];
const bigJump = (extra: (i: number) => ClownPose = () => ({}), height = 1): Frame[] =>
  BIG.map((p, i) => f(90, { ...p, air: Math.round((p.air ?? 0) * height), ...extra(i) }, i === 1 || i === 10 ? { cue: "boing" } : {}));

/**
 * Idle: six bounces, then a big jump (about every 6 s), lower than his victory leaps so on a phone he stays clear
 * of the bar above. Quiet: only the big jump makes a sound.
 */
const idle: Anim = { loop: true, frames: [...Array.from({ length: 6 }, () => bounce(90)).flat(), ...bigJump(() => ({}), 0.6)] };

/** Three thought dots popping up beside his head, one by one. */
const thoughtDots = (n: number): Speck[] =>
  [[46, 8], [50, 4], [55, 1]].slice(0, n).flatMap(([x, y], i): Speck[] => {
    const r = i === 2 ? 2 : 1;
    const out: Speck[] = [];
    for (let dy = 0; dy <= r; dy++) for (let dx = 0; dx <= r; dx++) out.push([OX + x! + dx, OY + y! + dy, "w"]);
    return out;
  });
const thinking: Anim = {
  loop: true,
  frames: [0, 1, 2, 3].flatMap((n) => bounce(110, () => ({ mood: "think", right: "chin", specks: thoughtDots(n) }), 0.5)),
};

const smug: Anim = { loop: true, frames: [...bounce(130, () => ({ mood: "smug", hatDx: 1 }), 0.6), ...bounce(130, () => ({ mood: "smug", hatDx: 1, headDx: 1 }), 0.6)] };

/** Sweat drops flying off his head. */
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [
    [OX + 13 - t, OY + 8 + t * 2, "b"],
    [OX + 13 - t, OY + 9 + t * 2, "B"],
    [OX + 35 + t, OY + 7 + t * 2, "b"],
    [OX + 35 + t, OY + 8 + t * 2, "B"],
  ];
};
const rattled: Anim = { loop: true, frames: [...bounce(70, (i) => ({ mood: "rattled", dx: i % 2 ? 1 : -1, specks: sweat(i) }), 0.4), ...bounce(70, (i) => ({ mood: "rattled", dx: i % 2 ? -1 : 1, specks: sweat(i + 4) }), 0.4)] };

/** His move: a hop, pointing at the board. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { squeeze: 3, crouch: 2 }),
    f(90, { squeeze: 4, crouch: 3, right: "point" }, { cue: "squeak" }),
    f(90, { air: 6, crouch: -2, right: "point" }),
    f(90, { air: 11, right: "point" }),
    f(120, { air: 12, right: "point", mood: "laugh" }),
    f(90, { air: 9, right: "point" }),
    f(90, { air: 4, right: "point" }),
    f(90, { squeeze: 3, crouch: 2, right: "point" }, { cue: "boing" }),
    f(90, { squeeze: 1, right: "point" }),
    f(160, { right: "point" }),
  ],
};

/** A capture: he throws his head back and laughs, shaking on his pogo. */
const capture: Anim = {
  loop: false,
  frames: [
    f(90, { squeeze: 2, crouch: 1 }),
    ...Array.from({ length: 12 }, (_, i) => f(80, { mood: "laugh", headDy: -1, dx: i % 2 ? 1 : -1, air: [0, 2, 3, 2][i % 4], squeeze: i % 4 === 0 ? 2 : 0 }, i === 0 ? { cue: "laugh" } : {})),
    f(120, { mood: "grin" }),
  ],
};

/** A white flash for the frame he's hit. */
const FLASH: Record<string, string> = { r: "#ffffff", R: "#ffe0e0", p: "#ffffff", P: "#f0e0ff", o: "#ffffff", O: "#ffe8d0", q: "#ffd0d0" };
/** Hurt: hit, squashed, eyes crossed, his hat knocked up off his head; it lands crooked. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { squeeze: 4, crouch: 4, mood: "hurt", hatDy: -4 }, { cue: "squeak", pal: FLASH, shake: [1, 0] }),
    f(80, { squeeze: 4, crouch: 4, mood: "hurt", hatDy: -9 }, { shake: [-1, 0] }),
    f(90, { squeeze: 3, crouch: 3, mood: "hurt", hatDy: -12, hatDx: 1 }),
    f(90, { squeeze: 2, crouch: 2, mood: "hurt", hatDy: -11, hatDx: 2 }),
    f(90, { squeeze: 1, crouch: 1, mood: "hurt", hatDy: -7, hatDx: 2 }),
    f(90, { mood: "hurt", hatDy: -2, hatDx: 2, dx: -1 }),
    f(110, { mood: "rattled", hatDx: 2, dx: 1 }),
    f(110, { mood: "rattled", hatDx: 2, dx: -1, air: 1 }),
    f(160, { mood: "rattled", hatDx: 1 }),
  ],
};

/** A golden "honk!" burst off his nose. */
const honkBurst = (big: boolean): Speck[] => {
  const x = OX + 25;
  const y = OY + 14;
  const rays: Speck[] = [];
  for (const [ux, uy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [-1, 0], [1, 0]] as const)
    for (let d = 3; d <= (big ? 7 : 5); d++) if (d % 2 === 1 || big) rays.push([x + ux * (d + 4), y + uy * d, d > 5 ? "Y" : "y"]);
  return rays;
};
/** Check: he squeezes his nose and honks twice. */
const check: Anim = {
  loop: false,
  frames: [
    f(90, { squeeze: 2, crouch: 1, right: "nose" }),
    f(110, { right: "nose", mood: "honk" }, { cue: "honk", specks: honkBurst(true) }),
    f(90, { right: "nose", mood: "honk" }, { specks: honkBurst(false) }),
    f(120, { right: "nose", mood: "laugh" }),
    f(110, { right: "nose", mood: "honk", air: 1 }, { cue: "honk", specks: honkBurst(true) }),
    f(90, { right: "nose", mood: "honk", air: 1 }, { specks: honkBurst(false) }),
    ...bounce(90, () => ({ mood: "laugh" }), 0.6),
  ],
};

/** Defeat: hit, a last wobbly bounce or two, then off the pogo onto the ground (the last frame holds). */
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { squeeze: 4, crouch: 4, mood: "hurt", hatDy: -5 }, { cue: "squeak", pal: FLASH, shake: [1, 0] }),
    f(90, { squeeze: 3, crouch: 3, mood: "hurt", hatDy: -8 }),
    f(90, { air: 4, mood: "rattled", hatDy: -6, dx: 1 }),
    f(90, { air: 6, mood: "rattled", hatDy: -3, dx: 2 }),
    f(90, { air: 3, mood: "rattled", dx: 3 }, { cue: "slideDown" }),
    f(110, { squeeze: 4, crouch: 5, mood: "hurt", dx: 2 }),
    f(110, { fallen: true, mood: "hurt", hatDy: -8, headDy: -2 }),
    f(110, { fallen: true, mood: "out", hatDy: -3, headDy: -1 }),
    f(140, { fallen: true, mood: "out" }),
    f(1000, { fallen: true, mood: "out" }),
  ],
};

/** Confetti drifting down, seeded by frame. */
const CONFETTI = "ygurpw";
const confetti = (i: number): Speck[] =>
  Array.from({ length: 16 }, (_, n): Speck => {
    const x = (n * 37 + 11) % 70;
    const y = ((n * 23 + i * 3) % 60) + 2;
    return [x + 1, y, CONFETTI[n % CONFETTI.length]!];
  });
/** Victory: a big spinning jump, arms up, confetti, a laugh and a honk; then again. */
const victory: Anim = {
  loop: true,
  frames: [
    ...bigJump((i) => ({ mood: i < 2 ? "grin" : "laugh", left: i >= 2 && i < 10 ? "up" : "bar", right: i >= 2 && i < 10 ? "up" : "bar", flip: i >= 5 && i <= 6 })).map((fr, i) => ({ ...fr, specks: confetti(i), cue: i === 2 ? "laugh" : i === 10 ? "honk" : fr.cue })),
    ...bounce(90, (i) => ({ mood: "laugh", specks: confetti(i + 15) })),
  ],
};

/** A puff of smoke where he pops up from. */
const puff = (r: number): Speck[] => {
  const out: Speck[] = [];
  for (let a = 0; a < 12; a++) {
    const x = OX + 24 + Math.round(Math.cos((a / 12) * Math.PI * 2) * r * 1.6);
    const y = OY + GROUND - 6 + Math.round(Math.sin((a / 12) * Math.PI * 2) * r * 0.7);
    out.push([x, y, a % 2 ? "W" : "w"], [x + 1, y, "X"]);
  }
  return out;
};
/** Entrance: a puff of smoke, he springs up out of it, lands, bounces and honks his nose. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: puff(2), cue: "slideUp" },
    { ms: 90, layers: [], specks: puff(4) },
    f(90, { air: 16, crouch: -3, kick: 2 }, { specks: puff(6) }),
    f(90, { air: 22, kick: 4, left: "up", right: "up" }),
    f(110, { air: 23, kick: 4, left: "up", right: "up", mood: "laugh" }),
    f(90, { air: 19, kick: 2 }),
    f(90, { air: 12 }),
    f(90, { air: 4 }),
    f(90, { squeeze: 4, crouch: 4 }, { cue: "boing" }),
    f(90, { squeeze: 2, crouch: 1 }),
    f(90, { air: 5, crouch: -1 }),
    f(90, { air: 7 }),
    f(90, { air: 5 }),
    f(90, { squeeze: 3, crouch: 2 }),
    f(100, { right: "nose", mood: "honk" }, { cue: "honk", specks: honkBurst(true) }),
    f(100, { right: "nose", mood: "honk" }, { specks: honkBurst(false) }),
    f(300, { mood: "grin" }),
  ],
};

/** His pose with a pie held up at (x, y) (his drawing space). */
const withPie = (ms: number, p: ClownPose, x: number, y: number, extra: Partial<Frame> = {}): Frame => ({ ms, layers: [...pose(p), at("pie", x, y)], ...extra });
/** Speed lines where the pie flew off. */
const whoosh: Speck[] = [0, 2, 4].flatMap((dy) => [0, 1, 2, 3].map((i): Speck => [OX + 46 + i + dy, OY + 16 + dy, i < 2 ? "W" : "w"]));

/**
 * His passive power, the pie: he pulls a pie up behind his head, winds up and throws it (the frame with the "throw"
 * cue: the pie leaves his glove there, and the board's flying pie takes over), then laughs.
 */
const pieThrow: Anim = {
  loop: false,
  frames: [
    f(90, { squeeze: 2, crouch: 1 }),
    withPie(110, { right: "up", mood: "grin" }, 34, 2),
    withPie(110, { right: "back", mood: "laugh", squeeze: 1 }, 38, 0, { cue: "squeak" }),
    withPie(110, { right: "back", mood: "laugh", squeeze: 3, crouch: 2 }, 38, 3),
    withPie(80, { right: "point", air: 3, crouch: -2 }, 40, 19, { cue: "throw" }),
    f(80, { right: "point", air: 5 }, { specks: whoosh }),
    f(90, { right: "point", air: 4, mood: "laugh" }),
    ...Array.from({ length: 6 }, (_, i) => f(80, { mood: "laugh", headDy: -1, dx: i % 2 ? 1 : -1, air: [0, 2, 3, 2][i % 4], squeeze: i % 4 === 0 ? 2 : 0 }, i === 0 ? { cue: "laugh" } : {})),
    f(140, { mood: "grin" }),
  ],
};

/** A shadow on the ground, growing as he drops onto it from above. */
const dropShadow = (r: number): Speck[] => {
  const out: Speck[] = [];
  for (let x = -r * 2; x <= r * 2; x++) for (const y of [-1, 0]) if ((x / (r * 2)) ** 2 + (y / 1.5) ** 2 <= 1) out.push([OX + 24 + x, OY + GROUND - 1 + y, "z"]);
  return out;
};
/** A ring of dust where he lands. */
const dust = (r: number): Speck[] =>
  Array.from({ length: 10 }, (_, a): Speck[] => {
    const x = OX + 24 + Math.round(Math.cos((a / 10) * Math.PI * 2) * r * 1.8);
    const y = OY + GROUND - 3 + Math.round(Math.sin((a / 10) * Math.PI * 2) * r * 0.5);
    return [[x, y, a % 2 ? "W" : "X"]];
  }).flat();

/**
 * His ultimate, the funhouse, played on the board where he lands: his shadow grows, he drops in from above, lands
 * with a boing, springs up into a spin (the frame with the "flip" cue: the board flips there) and lands laughing,
 * pointing at the crowd's side. The last frame holds.
 */
const funhouse: Anim = {
  loop: false,
  frames: [
    { ms: 100, layers: [], specks: dropShadow(2) },
    { ms: 100, layers: [], specks: dropShadow(4) },
    f(80, { air: 23, kick: 2, left: "up", right: "up", mood: "laugh" }),
    f(80, { air: 12, kick: 1 }),
    f(90, { squeeze: 4, crouch: 4 }, { cue: "boing", shake: [0, 1], specks: dust(5) }),
    f(90, { squeeze: 2, crouch: 2 }, { specks: dust(8) }),
    f(80, { air: 8, crouch: -2, mood: "laugh" }),
    f(90, { air: 16, left: "up", right: "up", mood: "laugh", flip: true }, { cue: "flip", specks: confetti(0) }),
    f(90, { air: 20, left: "up", right: "up", mood: "laugh" }, { specks: confetti(1) }),
    f(90, { air: 20, left: "up", right: "up", mood: "laugh", flip: true }, { specks: confetti(2) }),
    f(90, { air: 14, left: "up", right: "up", mood: "laugh" }, { specks: confetti(3) }),
    f(80, { air: 6 }, { specks: confetti(4) }),
    f(90, { squeeze: 4, crouch: 3, mood: "laugh" }, { cue: "laugh", specks: dust(5) }),
    ...bounce(90, () => ({ mood: "laugh" }), 0.6),
    f(400, { right: "point", mood: "grin" }),
  ],
};

export const CLOWN: Character = {
  id: "clown",
  name: "Boingo the Clown",
  w: 72,
  h: 94,
  foot: [OX + 24, OY + GROUND],
  palette: CLOWN_PALETTE,
  halo: "#2a2630",
  parts: PARTS,
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, pieThrow, funhouse },
};

/** The part of him a portrait shows (hat to ruff), in frame pixels. */
export const CLOWN_PORTRAIT = { x: OX, y: OY - 6, w: 48, h: 36 } as const;

/**
 * His taunts: short, never instructions, rare (each moment's chance of a line is in CLOWN_CHANCE). The God King's
 * rules hold: the chess comes first.
 */
export const CLOWN_LINES: Partial<Record<import("./boss-beats.ts").Beat, readonly string[]>> = {
  entrance: ["Honk honk! Showtime!", "Step right up!", "Who ordered a clown?"],
  move: ["Boing!", "Hee hee!", "Your turn, chumps!", "Watch my feet!"],
  capture: ["Mine now! Honk!", "Into the hat it goes!", "Snatched it! Hee hee!", "Whoopsie! For me!"],
  check: ["Honk! Check!", "Knock knock!", "Peekaboo, king!"],
  hurt: ["Hey! That was mine!", "Ow! My nose!", "No fair!"],
  thinking: ["Eeny, meeny…", "Hmm, hmm, hmm…", "Spin the wheel…"],
  smug: ["Too easy!", "Is this chess or a circus?", "Boingo's on a roll!"],
  rattled: ["Not funny anymore…", "Uh-oh…", "Nobody laughs at Boingo!"],
  defeat: ["Waaah! My pogo!", "Show's over…", "Not… funny…"],
  victory: ["Ta-da! Honk honk!", "Boingo wins! Hee hee!", "Send in the next clowns!"],
  strike: ["Pie in your face!", "Hee hee! Gotcha!"],
  power: ["Pie time!", "Special delivery!", "Extra cream for you!", "Splat! Hee hee!"],
  ultimateWarn: ["Something funny's coming…", "Get ready to laugh…", "Boingo's big finale…"],
  ultimate: ["Welcome to the funhouse!", "Topsy-turvy!", "Boingo's turn! Hee hee!"],
};
export const CLOWN_CHANCE: Partial<Record<import("./boss-beats.ts").Beat, number>> = {
  entrance: 1,
  move: 0.12,
  capture: 0.6,
  check: 0.75,
  hurt: 0.6,
  thinking: 0.08,
  smug: 0.8,
  rattled: 0.8,
  defeat: 1,
  victory: 1,
  strike: 0.8,
  power: 0.5,
  ultimateWarn: 1,
  ultimate: 1,
};
