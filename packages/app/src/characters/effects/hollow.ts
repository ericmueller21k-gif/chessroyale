/** Hollow's effects: the dark, his pour and a miss, his strand of bulbs, Lights out's night. See ../effects.ts. */
import { DEFAULT_LIGHTS, bulbColour, lightsSwap } from "../lights.ts";
import { canvas, ellipse, toGrid } from "../paint.ts";
import { lazyAnim, lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../sprite.ts";
import { SQUARE, sparkle, type Pt } from "./common.ts";

// ---- Hollow's dark: a square covered in smoke (the passive), the darkness he pours onto it, a miss, his strand of
// bulbs counting down, and Lights out: the whole board gone to night, square by square, with its found pieces and the
// lights coming back.

const DARK_PALETTE = {
  k: "#00000000",
  a: "#0b0814", // the cloud, darkest to its lit tops
  b: "#151024",
  c: "#211936",
  d: "#30254f",
  e: "#140f2499", // wisps at its rim, see-through
  f: "#22193866",
  A: "#16121f", // thinning: grayer, paler
  B: "#211b2e",
  C: "#2f273f",
  D: "#433956",
  E: "#2a223a80",
  u: "#5b36a3", // violet glints
  U: "#9c6cff",
  x: "#e9ddff",
  r: "#ff5a7a", // a miss
  R: "#b0204a",
  s: "#ffd0dc",
} as const;

/** Seeded noise in [0, 1) for a pixel and a step. */
const noise2 = (x: number, y: number, s: number) => (((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(s, 83492791)) >>> 0) % 10007) / 10007;

/**
 * The cloud over a dark square at time `t` (0-1 round its 8-frame loop), `grow` 0 (nothing) to 1 (full), `thin` for its
 * last turn: billows round a dark middle, turning slowly, lit from the top left; wisps at the rim. Its body always
 * covers the square from 2 to 29 (the piece under it hidden), leaving the outer two pixels for the selection's glow.
 */
function cloud(t: number, grow = 1, thin = false, spread = 0): Part {
  const cv = canvas(SQUARE, SQUARE);
  const [k0, k1, k2, k3, rim] = thin ? (["A", "B", "C", "D", "E"] as const) : (["a", "b", "c", "d", "e"] as const);
  const turn = t * (Math.PI / 4);
  const puffs: { x: number; y: number; r: number }[] = [{ x: 16, y: 16, r: 11.5 * grow }];
  for (let i = 0; i < 8; i++) {
    const a = turn + (i / 8) * Math.PI * 2;
    const R = (9.6 + spread * 6) * Math.max(0.3, grow);
    puffs.push({ x: 15.5 + Math.cos(a) * R, y: 15.5 + Math.sin(a) * R, r: (i % 2 ? 6.6 : 7.4) * grow * (thin ? 0.9 : 1) });
  }
  const core = (x: number, y: number) => {
    const cx = Math.max(7, Math.min(24, x));
    const cy = Math.max(7, Math.min(24, y));
    return (x - cx) ** 2 + (y - cy) ** 2 <= 30.5;
  };
  for (let y = 0; y < SQUARE; y++)
    for (let x = 0; x < SQUARE; x++) {
      // The topmost billow at this pixel (the later ones sit over the earlier), and how lit it is there.
      let lit = -1;
      for (const p of puffs) {
        const dx = x + 0.5 - p.x;
        const dy = y + 0.5 - p.y;
        if (p.r > 0 && dx * dx + dy * dy <= p.r * p.r) lit = Math.max(lit, (-dx * 0.6 - dy * 0.8) / p.r);
      }
      const inside = x >= 2 && x <= 29 && y >= 2 && y <= 29 && core(x, y);
      if (lit < -0.99 && !(inside && grow >= 1)) {
        // Wisps at the rim, now and then.
        if (grow >= 1 && noise2(x, y, Math.floor(t * 8)) < (thin ? 0.12 : 0.07) && (x <= 2 || y <= 2 || x >= 29 || y >= 29) && x > 0 && y > 0 && x < 31 && y < 31) cv[y]![x] = rim;
        continue;
      }
      if (x < 1 || y < 1 || x > 30 || y > 30) continue;
      if (x < 2 || y < 2 || x > 29 || y > 29) {
        if (noise2(x, y, 7) < (thin ? 0.35 : 0.55)) cv[y]![x] = rim;
        continue;
      }
      const swirl = Math.sin(Math.atan2(y - 15.5, x - 15.5) * 3 - turn * 2 + Math.hypot(x - 15.5, y - 15.5) * 0.45);
      const v = lit + swirl * 0.18 + (noise2(x, y, 3) - 0.5) * 0.2;
      cv[y]![x] = v > 0.62 ? k3 : v > 0.25 ? k2 : v > -0.2 ? k1 : k0;
    }
  return { grid: toGrid(cv), outline: false };
}

/** Violet glints twinkling in the cloud (`i` the frame), fewer as it thins. */
const darkGlints = (i: number, n = 3): Speck[] =>
  Array.from({ length: n }, (_, k): Speck[] => {
    const a = (k / n) * Math.PI * 2 + i * 0.5;
    const r = 5 + ((k * 5 + i) % 5);
    const x = Math.round(16 + Math.cos(a) * r);
    const y = Math.round(16 + Math.sin(a) * r);
    const on = (i + k * 3) % 4;
    return on === 0 ? [[x, y, "x"], [x - 1, y, "U"], [x + 1, y, "U"], [x, y - 1, "U"], [x, y + 1, "U"]] : on === 1 ? [[x, y, "U"]] : on === 2 ? [[x, y, "u"]] : [];
  }).flat();
/** Wisps peeling off the top of a thinning cloud and drifting up. */
const peel = (i: number): Speck[] =>
  [5, 13, 21, 27].flatMap((x, k): Speck[] => {
    const y = 6 - ((i * 2 + k * 3) % 6);
    // (Opaque, so a wisp over the cloud never lets the piece show through.)
    return y >= 1 ? [[x + ((i + k) % 2), y, "D"], [x + 1, y - 1 >= 1 ? y - 1 : y, "C"]] : [];
  });

// (Hollow's parts are made the first time they show: sprite.ts lazyParts.)
const { parts: DARK_PARTS, add: cloudPart } = lazyParts();

export const DARK_SQUARE: Character = {
  id: "dark-square",
  name: "A dark square",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: DARK_PALETTE,
  parts: DARK_PARTS,
  anims: {
    /** The darkness pours in: billows grow from the middle, swirling, and close over the square. */
    gather: lazyAnim(() => ({
      loop: false,
      frames: [0.25, 0.45, 0.65, 0.85, 1].map((g, i): Frame => ({
        ms: i === 4 ? 140 : 90,
        cue: i === 0 ? "gather" : undefined,
        layers: [{ part: cloudPart(`grow${g}`, () => cloud(i / 8, g)), x: 0, y: 0 }],
        specks: darkGlints(i, 2 + i),
      })),
    })),
    /** Dark, while it lasts: the cloud turning slowly, violet glints twinkling in it. */
    dark: lazyAnim(() => ({
      loop: true,
      frames: Array.from({ length: 8 }, (_, i): Frame => ({ ms: 160, layers: [{ part: cloudPart(`dark${i}`, () => cloud(i / 8)), x: 0, y: 0 }], specks: darkGlints(i) })),
    })),
    /** Its last turn: paler and grayer, wisps peeling off its top, fewer glints; the piece still hidden. */
    thin: lazyAnim(() => ({
      loop: true,
      frames: Array.from({ length: 8 }, (_, i): Frame => ({ ms: 160, layers: [{ part: cloudPart(`thin${i}`, () => cloud(i / 8, 1, true)), x: 0, y: 0 }], specks: [...peel(i), ...darkGlints(i, 1)] })),
    })),
    /** It clears: the billows drift apart, thin out and are gone. Ends empty. */
    clear: lazyAnim(() => ({
      loop: false,
      frames: [
        ...[0.3, 0.7, 1.1].map((sp, i): Frame => ({
          ms: 100,
          cue: i === 0 ? "clear" : undefined,
          layers: [{ part: cloudPart(`clear${i}`, () => cloud(i / 8, 1 - i * 0.22, true, sp)), x: 0, y: 0 }],
          specks: peel(i),
        })),
        { ms: 90, layers: [{ part: cloudPart("clear3", () => cloud(0.4, 0.3, true, 1.6)), x: 0, y: 0 }], pal: { A: "#16121f66", B: "#211b2e66", C: "#2f273f55", D: "#43395644" } },
        { ms: 60, layers: [] },
      ],
    })),
  },
};

/** The darkness in flight from his chest to its square: a churning blob trailing smoke, pointing right (turn it toward the square). */
const pourBlob = (i: number): Part => {
  const cv = canvas(SQUARE, SQUARE);
  for (let y = 0; y < SQUARE; y++)
    for (let x = 0; x < SQUARE; x++) {
      const dx = x + 0.5 - 21;
      const dy = y + 0.5 - 16;
      // A teardrop: round at the front (right), its tail streaming back to the left, wavering.
      const tail = dx < 0 ? 6.5 * Math.max(0, 1 + dx / 19) + Math.sin(dx * 0.7 + i * 1.6) * 0.9 : Math.sqrt(Math.max(0, 42 - dx * dx));
      const wav = dx < 0 ? Math.sin(dx * 0.5 + i * 1.3) * 1.5 : 0;
      if (Math.abs(dy - wav) > tail || dx > 6.5 || dx < -19) continue;
      const lit = (-(dy - wav) / Math.max(1, tail)) * 0.6 + (dx > 0 ? 0.2 : -0.1) + (noise2(x, y, i) - 0.5) * 0.4;
      cv[y]![x] = dx < -12 ? "e" : lit > 0.45 ? "d" : lit > 0.05 ? "c" : lit > -0.35 ? "b" : "a";
    }
  return { grid: toGrid(cv), outline: false };
};
export const DARK_POUR: Character = {
  id: "dark-pour",
  name: "Darkness in flight",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: DARK_PALETTE,
  parts: (() => {
    const { parts, add } = lazyParts();
    for (const i of [0, 1, 2, 3]) add(`pour${i}`, () => pourBlob(i));
    return parts;
  })(),
  anims: {
    fly: lazyAnim(() => ({
      loop: true,
      frames: [0, 1, 2, 3].map((i): Frame => ({ ms: 70, layers: [{ part: `pour${i}`, x: 0, y: 0 }], specks: [...darkGlints(i, 2).map(([x, y, k]): Speck => [x + 4, y, k]), [3 + ((i * 5) % 7), 12 + ((i * 3) % 8), "u"]] })),
    })),
  },
};

/** A miss (a wrong tap in the test, a wrong move into the dark): a red-violet slash flashes across the square and fades. Ends empty. */
const missX = (d: number, k: string, w = 1): Speck[] => {
  const out: Speck[] = [];
  for (let t = -d; t <= d; t++)
    for (let o = 0; o < w; o++) {
      out.push([16 + t + o, 16 + t, k], [16 + t + o, 15 - t, k]);
    }
  return out;
};
export const DARK_MISS: Character = {
  id: "dark-miss",
  name: "A miss in the dark",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: DARK_PALETTE,
  parts: {},
  anims: {
    miss: lazyAnim(() => ({
      loop: false,
      frames: [
        { ms: 60, layers: [], cue: "miss", specks: missX(4, "s", 2) },
        { ms: 80, layers: [], specks: [...missX(9, "R", 3), ...missX(8, "r", 2), ...missX(2, "s", 2)] },
        { ms: 260, layers: [], specks: [...missX(9, "R", 3), ...missX(8, "r", 2)] },
        { ms: 110, layers: [], specks: missX(8, "R", 2), pal: { R: "#b0204a99" } },
        { ms: 90, layers: [], specks: missX(7, "R", 1), pal: { R: "#b0204a55" } },
        { ms: 40, layers: [] },
      ],
    })),
  },
};

// Boss alone (Eric, Nov 5): your ten bulbs, his own strand of lights (lights.ts: each bulb the battle's color for its place
// on his strand), on a wire drooping between two hooks. One goes out with each wrong move into the dark.

/** Each of the ten bulbs' keys: [main, shade, glint, glow] (as his figure's, characters/hollow.ts BULB_KEYS). */
const LIFE_KEYS = Array.from({ length: 10 }, (_, i) => [0, 1, 2, 3].map((j) => String.fromCharCode(0xc0 + 4 * i + j)) as [string, string, string, string]);
const LIFE_PALETTE: Record<string, string> = {
  k: "#08070c",
  w: "#3b3844",
  W: "#5d5968",
  o: "#2e2a36", // out: dark glass
  O: "#1d1a23",
  g: "#463f52",
  x: "#ffffff",
  U: "#c4a2ff",
  ...Object.fromEntries(
    LIFE_KEYS.flatMap((keys, b) => {
      const c = bulbColour(DEFAULT_LIGHTS[b]!);
      return [c.glass, c.shade, c.glint, `${c.glass}66`].map((v, i) => [keys[i]!, v]);
    }),
  ),
};
export const LIFE_W = 95;
export const LIFE_H = 15;
/** The bulbs' x (their middle) along the strand. */
const LIFE_X = Array.from({ length: 10 }, (_, i) => 7 + 9 * i);
const lifeWireY = (x: number) => Math.round(2 + 2.2 * Math.sin((Math.PI * (x - 1)) / (LIFE_W - 3)) + 0.7 * Math.sin((Math.PI * 4 * (x - 1)) / (LIFE_W - 3)));
const LIFE_PARTS: Record<string, Part> = {
  wire: (() => {
    const cv = canvas(LIFE_W, LIFE_H);
    for (let x = 1; x < LIFE_W - 1; x++) cv[lifeWireY(x)]![x] = "w";
    return { grid: toGrid(cv) };
  })(),
};
for (let b = 0; b < 10; b++) {
  const [M, S, G, L] = LIFE_KEYS[b]!;
  LIFE_PARTS[`on${b}`] = { grid: [".WW..", ".ww..", `${G}${M}${M}${M}${S}`, `${M}${M}${M}${M}${S}`, `${M}${M}${M}${S}${S}`, `.${M}${S}${S}.`, `..${S}..`] };
  LIFE_PARTS[`off${b}`] = { grid: [".WW..", ".ww..", "gooOO", "ooooO", "oooOO", ".oOO.", "..O.."] };
  const glow = canvas(9, 11);
  ellipse(glow, 4.5, 6.5, 4.5, 4.5, L);
  LIFE_PARTS[`glow${b}`] = { grid: toGrid(glow), outline: false };
}
/** The strand with `lit` bulbs on (the first ones), bulb `flick` drawn the other way (flickering), a glint on frame `g`. */
function life(lit: number, ms: number, o: { flick?: number; g?: number; cue?: string; spark?: number } = {}): Frame {
  const layers: Layer[] = [];
  const on = (b: number) => (b < lit) !== (o.flick === b);
  for (let b = 0; b < 10; b++) if (on(b)) layers.push({ part: `glow${b}`, x: LIFE_X[b]! - 4, y: lifeWireY(LIFE_X[b]!) - 1 });
  layers.push({ part: "wire", x: 0, y: 0 });
  for (let b = 0; b < 10; b++) layers.push({ part: `${on(b) ? "on" : "off"}${b}`, x: LIFE_X[b]! - 2, y: lifeWireY(LIFE_X[b]!) + 1 });
  const specks: Speck[] = [];
  if (o.g !== undefined && lit > 0) {
    const b = (o.g * 3) % lit;
    specks.push([LIFE_X[b]! - 1, lifeWireY(LIFE_X[b]!) + 3, "x"]);
  }
  if (o.spark !== undefined) {
    const [x, y] = [LIFE_X[o.spark]!, lifeWireY(LIFE_X[o.spark]!) + 6];
    specks.push([x, y, "x"], [x - 2, y - 1, "U"], [x + 2, y + 1, "U"], [x + 1, y + 3, "U"]);
  }
  return { ms, layers, specks, cue: o.cue };
}
export const LIFE_STRAND: Character = {
  id: "life-strand",
  name: "Your bulbs",
  w: LIFE_W,
  h: LIFE_H,
  foot: [47, 14],
  palette: LIFE_PALETTE,
  // (Each bulb in the battle's color for its place on his strand: lights.ts.)
  swap: lightsSwap(LIFE_KEYS),
  parts: LIFE_PARTS,
  anims: {
    ...Object.fromEntries(Array.from({ length: 11 }, (_, n) => [`lit${n}`, { loop: true, frames: n ? [0, 1, 2, 3].map((i) => life(n, i === 0 ? 400 : 260, { g: i })) : [life(0, 600)] } satisfies Anim])),
    // A bulb going out (a wrong move into the dark): it flickers, fizzes, sparks and dies, ending with one fewer lit.
    ...Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => {
        const from = i + 1;
        const b = from - 1;
        return [`out${from}`, { loop: false, frames: [life(from, 70, { flick: b, cue: "fizz" }), life(from, 60), life(from, 50, { flick: b }), life(from, 60), life(from, 40, { flick: b }), life(from - 1, 90, { spark: b }), life(from - 1, 220)] } satisfies Anim];
      }),
    ),
  },
};

// His six bulbs counting down to his next cover (Eric, Nov 12): one for each move, yours and his, until he covers a square;
// a wire between two hooks, scalloped between the bulbs, under his rage meter and as wide as it. Two drawings, each pixel
// for pixel at its size (no stretch): a phone's 44 x 11 (its meter's 44 px), a computer's 88 x 11 (its meter's 88 px, in
// the 11 px under it). The bulbs are his strand's first six (LIFE_KEYS: each the battle's color for its place on his strand).

/** How many bulbs the countdown has: one for each move between two covers (his darkEvery 3 and the crowd's 3). */
export const STRIP_BULBS = 6;
export const STRIP_H = 11;
/** The two drawings' widths: a phone's and a computer's (each its rage meter's width in px). */
export const STRIP_W = { phone: 44, computer: 88 } as const;
const STRIP_KEYS = LIFE_KEYS.slice(0, STRIP_BULBS);

/** A strip `w` wide: its bulbs' x (their middle), the wire's y along it, its parts, and its frames. */
function sixStrip(w: number) {
  // (The bulbs evenly spread, 5 px each with their outline inside the hooks: on a phone's 44 px every 7 px, nearly touching.)
  const xs = Array.from({ length: STRIP_BULBS }, (_, i) => Math.round(4 + (i * (w - 9)) / (STRIP_BULBS - 1)));
  const anchors = [1, ...xs, w - 2];
  /** The wire's row at `x`: hooks at row 1, a gentle droop to the middle, and a scallop between each two bulbs. */
  const wireY = (x: number) => {
    const i = Math.max(0, anchors.findIndex((a, j) => x >= a && x <= anchors[j + 1]!));
    const [a, b] = [anchors[i]!, anchors[i + 1]!];
    // (Deeper as the span is longer: a computer's hangs a little between its bulbs, a phone's barely.)
    const sag = Math.min(1.8, (b - a) / 9) * (i === 0 || i === anchors.length - 2 ? 0.6 : 1);
    return Math.round(1 + 0.9 * Math.sin((Math.PI * (x - 1)) / (w - 3)) + sag * Math.sin((Math.PI * (x - a)) / (b - a)));
  };
  const parts: Record<string, Part> = {
    wire: (() => {
      const cv = canvas(w, STRIP_H);
      for (let x = 1; x < w - 1; x++) cv[wireY(x)]![x] = "w";
      return { grid: toGrid(cv) };
    })(),
  };
  for (let b = 0; b < STRIP_BULBS; b++) {
    const [M, S, G, L] = STRIP_KEYS[b]!;
    parts[`on${b}`] = { grid: [".WW..", ".ww..", `${G}${M}${M}${M}${S}`, `${M}${M}${M}${M}${S}`, `${M}${M}${M}${S}${S}`, `.${M}${S}${S}.`, `..${S}..`] };
    parts[`off${b}`] = { grid: [".WW..", ".ww..", "gooOO", "ooooO", "oooOO", ".oOO.", "..O.."] };
    const glow = canvas(9, 11);
    ellipse(glow, 4.5, 6.5, 4.5, 4.5, L);
    parts[`glow${b}`] = { grid: toGrid(glow), outline: false };
  }
  /** The strip with `lit` bulbs on (the first ones), bulb `flick` drawn the other way (flickering), a glint on frame `g`. */
  const frame = (lit: number, ms: number, o: { flick?: number; g?: number; cue?: string; spark?: number } = {}): Frame => {
    const layers: Layer[] = [];
    const on = (b: number) => (b < lit) !== (o.flick === b);
    for (let b = 0; b < STRIP_BULBS; b++) if (on(b)) layers.push({ part: `glow${b}`, x: xs[b]! - 4, y: wireY(xs[b]!) - 1 });
    layers.push({ part: "wire", x: 0, y: 0 });
    for (let b = 0; b < STRIP_BULBS; b++) layers.push({ part: `${on(b) ? "on" : "off"}${b}`, x: xs[b]! - 2, y: wireY(xs[b]!) + 1 });
    const specks: Speck[] = [];
    if (o.g !== undefined && lit > 0) {
      const b = (o.g * 2) % lit;
      specks.push([xs[b]! - 1, wireY(xs[b]!) + 3, "x"]);
    }
    if (o.spark !== undefined) {
      const [x, y] = [xs[o.spark]!, wireY(xs[o.spark]!) + 5];
      specks.push([x, y, "x"], [x - 2, y - 1, "U"], [x + 2, y + 1, "U"], [x + 1, y + 3, "U"]);
    }
    return { ms, layers, specks, cue: o.cue };
  };
  return { xs, wireY, parts, frame };
}

/** A strip of six, `w` wide (STRIP_W): lit6 … lit0 (loops), out6 … out1 (a bulb going out, its `pop`), relight (ends on lit6). */
function sixStrand(id: string, w: number): Character {
  const s = sixStrip(w);
  const f = s.frame;
  return {
    id,
    name: "Hollow's bulbs",
    w,
    h: STRIP_H,
    foot: [w >> 1, STRIP_H - 1],
    palette: LIFE_PALETTE,
    // (Each bulb in the battle's color for its place on his strand: lights.ts.)
    swap: lightsSwap(STRIP_KEYS),
    parts: s.parts,
    anims: {
      ...Object.fromEntries(Array.from({ length: STRIP_BULBS + 1 }, (_, n) => [`lit${n}`, { loop: true, frames: n ? [0, 1, 2, 3].map((i) => f(n, i === 0 ? 400 : 260, { g: i })) : [f(0, 600)] } satisfies Anim])),
      // A bulb going out (a move made): it flickers, sparks and dies, ending with one fewer lit.
      ...Object.fromEntries(
        Array.from({ length: STRIP_BULBS }, (_, i) => {
          const from = i + 1;
          const b = from - 1;
          return [`out${from}`, lazyAnim(() => ({ loop: false, frames: [f(from, 80, { flick: b, cue: "pop" }), f(from, 70), f(from, 60, { flick: b }), f(from, 50), f(from - 1, 90, { spark: b }), f(from - 1, 200)] }))];
        }),
      ),
      /** The strip lighting again after the last bulb went out (his cover lands): one by one, each flickering on. Ends all lit. */
      relight: lazyAnim(() => ({
        loop: false,
        frames: [f(0, 120, { cue: "relight" }), ...Array.from({ length: STRIP_BULBS }, (_, b) => [f(b + 1, 50), f(b, 40), f(b + 1, 90, { g: b })]).flat()],
      })),
    },
  };
}
/** The countdown's strip on a phone (44 x 11) and on a computer (88 x 11). */
export const BULB_STRAND = sixStrand("bulb-strand", STRIP_W.phone);
export const BULB_STRAND_WIDE = sixStrand("bulb-strand-wide", STRIP_W.computer);

// Lights out: the board gone to night, one tile a square (so found pieces can show through), drawn on the shared
// board canvas. The smoke drifting over it is one field across the board, repeating every 4 squares, so each square's
// tile is one of 16 by where it is on screen (NIGHT_TILES).

const NIGHT_PALETTE = {
  k: "#00000000",
  n: "#06050c", // deep night, a dark square
  N: "#0e0b1c", // deep night, a light square
  m: "#151028", // smoke, faint to clearer
  M: "#1e1738",
  l: "#2c2052", // the squares' edges: faint violet
  L: "#45337d", // where they cross
  t: "#8a70d8", // coordinates
  a: "#06050c73", // dimming, steps 1 and 2 (see-through)
  b: "#06050cc0",
  c: "#100c1fc0",
  u: "#5b36a3",
  U: "#9c6cff",
  x: "#e9ddff",
  v: "#9c6cff59", // a found square's rim
  V: "#c4a2ff99",
  g: "#f2c14e66", // an answer's rim (gold)
  G: "#f2c14eaa",
} as const;

/** How dark the board is in each step of the smashes: no light, then dim, dimmer, night. */
export const NIGHT_TILES = 16;
/**
 * The night's smoke: wavering wisps, broken into drifting lengths, over a 4 x 4 block of squares (128 px; the field
 * repeats with it), `t` 0-1 round the loop: 0 (none) to 1 (a wisp's core).
 */
const smokeAt = (X: number, Y: number, t: number) => {
  const T = t * Math.PI * 2;
  const k = (Math.PI * 2) / 128;
  const layer = (w: number, env: number) => Math.max(0, (w - 0.72) / 0.28) * Math.max(0, env);
  const a = layer(Math.sin(Y * k * 2 + 1.3 * Math.sin(X * k + T) + 0.5 * Math.sin(X * k * 3 - 2 * T + 1) - T), Math.sin(X * k + Y * k - T + 0.5));
  const b = layer(Math.sin(Y * k * 3 + 1.1 * Math.sin(X * k * 2 - T + 1.7) + 0.4 * Math.sin(X * k - T + 0.3) + T + 2.4), Math.sin(-X * k + Y * k * 2 + T + 2));
  const c = layer(Math.sin(X * k + Y * k * 2 + 0.9 * Math.sin(Y * k - T) + T + 4), Math.sin(X * k * 2 - Y * k + T));
  return Math.max(a, b * 0.9, c * 0.7);
};
/** A night tile: square `tile` (col % 4 + 4 * (row % 4), on screen) at `t`; `light` for a light square. */
function nightTile(tile: number, t: number, light: boolean): Part {
  const cv = canvas(SQUARE, SQUARE);
  const bx = (tile % 4) * SQUARE;
  const by = Math.floor(tile / 4) * SQUARE;
  for (let y = 0; y < SQUARE; y++)
    for (let x = 0; x < SQUARE; x++) {
      const v = smokeAt(bx + x, by + y, t);
      cv[y]![x] = v > 0.6 ? "M" : v > 0.22 ? "m" : light ? "N" : "n";
      if (x === 0 || y === 0) cv[y]![x] = x === 0 && y === 0 ? "L" : "l";
    }
  return { grid: toGrid(cv), outline: false };
}
const { parts: NIGHT_PARTS, add: addNight } = lazyParts();
const nightPart = (tile: number, f: number, light: boolean) => addNight(`night${tile}:${f}:${light ? 1 : 0}`, () => nightTile(tile, f / 8, light));
/** A uniform layer of `key` over the square (the dims, a found square's rim). */
const fill = (key: string, inset = 0, ring = false): Part => {
  const cv = canvas(SQUARE, SQUARE);
  for (let y = inset; y < SQUARE - inset; y++)
    for (let x = inset; x < SQUARE - inset; x++) if (!ring || x < inset + 2 || y < inset + 2 || x >= SQUARE - inset - 2 || y >= SQUARE - inset - 2) cv[y]![x] = key;
  return { grid: toGrid(cv), outline: false };
};
addNight("dim1", () => fill("a"));
addNight("dim2", () => fill("b"));
addNight("dim2s", () => fill("c"));
addNight("rimV", () => fill("v", 0, true));
addNight("rimVV", () => fill("V", 0, true));
addNight("rimG", () => fill("g", 0, true));
addNight("rimGG", () => fill("G", 0, true));
/** Smoke blown out to the square's edges as a piece shows (`r` how far the clear middle reaches). */
const blown = (r: number): Part => {
  const cv = canvas(SQUARE, SQUARE);
  for (let y = 0; y < SQUARE; y++)
    for (let x = 0; x < SQUARE; x++) {
      const d = Math.max(Math.abs(x + 0.5 - 16), Math.abs(y + 0.5 - 16)) + (noise2(x, y, 5) - 0.5) * 3;
      if (d > r) cv[y]![x] = d > r + 3 ? "n" : "m";
    }
  return { grid: toGrid(cv), outline: false };
};
for (const r of [4, 9, 14, 18]) addNight(`blown${r}`, () => blown(r));
const tileLayer = (part: string): Layer => ({ part, x: 0, y: 0 });
/** A sparkle (core and rays) at (x, y). */
const nightGlint = (x: number, y: number, big = false): Speck[] => [[x, y, "x"], [x - 1, y, "U"], [x + 1, y, "U"], [x, y - 1, "U"], [x, y + 1, "U"], ...(big ? ([[x - 2, y, "u"], [x + 2, y, "u"], [x, y - 2, "u"], [x, y + 2, "u"]] as Speck[]) : [])];

const nightAnims: Record<string, Anim> = {
  /** Each bulb smashed: the lights flicker, then settle a step darker (the pieces still show at 1 and 2). */
  dim1: lazyAnim(() => ({ loop: false, frames: [{ ms: 60, layers: [tileLayer("dim2")] }, { ms: 60, layers: [] }, { ms: 70, layers: [tileLayer("dim1")] }, { ms: 50, layers: [] }, { ms: 300, layers: [tileLayer("dim1")] }] })),
  dim2: lazyAnim(() => ({ loop: false, frames: [{ ms: 60, layers: [tileLayer("dim2s")] }, { ms: 60, layers: [tileLayer("dim1")] }, { ms: 70, layers: [tileLayer("dim2s")] }, { ms: 50, layers: [tileLayer("dim1")] }, { ms: 300, layers: [tileLayer("dim2")] }] })),
};
for (let tile = 0; tile < NIGHT_TILES; tile++)
  for (const light of [false, true]) {
    const sfx = `${tile}${light ? "L" : "D"}`;
    /** Night, while it lasts: deep dark, the squares' edges faint violet, smoke drifting across. */
    nightAnims[`night${sfx}`] = { loop: true, frames: Array.from({ length: 8 }, (_, f): Frame => ({ ms: 220, layers: [tileLayer(nightPart(tile, f, light))] })) };
    /** The last smash: the lights flicker out and it's night (ends on the night's first look). */
    nightAnims[`dim3${sfx}`] = {
      loop: false,
      frames: [
        { ms: 60, layers: [tileLayer(nightPart(tile, 0, light))] },
        { ms: 60, layers: [tileLayer("dim2")] },
        { ms: 70, layers: [tileLayer(nightPart(tile, 0, light))] },
        { ms: 50, layers: [tileLayer("dim2s")] },
        { ms: 200, layers: [tileLayer(nightPart(tile, 0, light))] },
      ],
    };
    /** The smoke closing back over a square that showed its piece (ends on the night's first look). */
    nightAnims[`close${sfx}`] = {
      loop: false,
      frames: [
        { ms: 70, layers: [tileLayer("blown14")] },
        { ms: 70, layers: [tileLayer("blown9")] },
        { ms: 70, layers: [tileLayer("blown4")] },
        { ms: 120, layers: [tileLayer(nightPart(tile, 0, light))] },
      ],
    };
    /** The lights coming back: the night lifts in steps, a glint as it goes. Ends empty. */
    nightAnims[`dawn${sfx}`] = {
      loop: false,
      frames: [
        { ms: 80, layers: [tileLayer(nightPart(tile, 2, light))], specks: nightGlint(16, 16) },
        { ms: 80, layers: [tileLayer("dim2s")], specks: nightGlint(16, 16, true) },
        { ms: 90, layers: [tileLayer("dim2")] },
        { ms: 100, layers: [tileLayer("dim1")] },
        { ms: 60, layers: [] },
      ],
    };
  }
/** A found piece flashes back into view: a violet flash, the smoke blown out to the edges, a violet rim while it shows. */
nightAnims.found = {
  loop: false,
  frames: [
    { ms: 50, layers: [tileLayer("rimVV")], cue: "found", specks: nightGlint(16, 16, true) },
    { ms: 60, layers: [tileLayer("blown4"), tileLayer("rimVV")], specks: [...nightGlint(8, 8), ...nightGlint(24, 24), ...nightGlint(24, 8), ...nightGlint(8, 24)] },
    { ms: 70, layers: [tileLayer("blown9"), tileLayer("rimVV")], specks: [...nightGlint(5, 5), ...nightGlint(27, 27), ...nightGlint(27, 5), ...nightGlint(5, 27)] },
    { ms: 80, layers: [tileLayer("blown14"), tileLayer("rimV")] },
    { ms: 120, layers: [tileLayer("blown18"), tileLayer("rimV")] },
  ],
};
/** While a found piece shows: the square clear, its rim glowing violet. */
nightAnims.shown = { loop: true, frames: [{ ms: 400, layers: [tileLayer("rimV")] }, { ms: 300, layers: [tileLayer("rimVV")] }] };
/** An answer shown at the end of a round (a piece nobody found): the smoke parts without the flash, a gold rim. */
nightAnims.answer = {
  loop: false,
  frames: [
    { ms: 80, layers: [tileLayer("blown4"), tileLayer("rimG")], cue: "answer" },
    { ms: 80, layers: [tileLayer("blown9"), tileLayer("rimG")] },
    { ms: 90, layers: [tileLayer("blown14"), tileLayer("rimGG")] },
    { ms: 140, layers: [tileLayer("blown18"), tileLayer("rimGG")] },
  ],
};
nightAnims.answered = { loop: true, frames: [{ ms: 400, layers: [tileLayer("rimG")] }, { ms: 300, layers: [tileLayer("rimGG")] }] };

export const NIGHT_SQUARE: Character = {
  id: "night-square",
  name: "A square in the night",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: NIGHT_PALETTE,
  parts: NIGHT_PARTS,
  anims: nightAnims,
};

/** A 3 x 5 pixel font for the night's coordinates. */
const GLYPHS: Record<string, readonly string[]> = {
  a: ["...", ".tt", "t.t", "t.t", ".tt"],
  b: ["t..", "tt.", "t.t", "t.t", "tt."],
  c: ["...", ".tt", "t..", "t..", ".tt"],
  d: ["..t", ".tt", "t.t", "t.t", ".tt"],
  e: ["...", ".t.", "ttt", "t..", ".tt"],
  f: [".tt", "t..", "ttt", "t..", "t.."],
  g: [".tt", "t.t", ".tt", "..t", "tt."],
  h: ["t..", "tt.", "t.t", "t.t", "t.t"],
  "1": [".t.", "tt.", ".t.", ".t.", "ttt"],
  "2": ["tt.", "..t", ".t.", "t..", "ttt"],
  "3": ["tt.", "..t", ".t.", "..t", "tt."],
  "4": ["t.t", "t.t", "ttt", "..t", "..t"],
  "5": ["ttt", "t..", "tt.", "..t", "tt."],
  "6": [".tt", "t..", "tt.", "t.t", ".t."],
  "7": ["ttt", "..t", ".t.", ".t.", ".t."],
  "8": [".t.", "t.t", ".t.", "t.t", ".t."],
};
/** The night's coordinates, one per square: a file's letter at the bottom right, a rank's number at the top left. */
export const NIGHT_LABEL: Character = {
  id: "night-label",
  name: "The night's coordinates",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: NIGHT_PALETTE,
  parts: (() => {
    const { parts, add } = lazyParts();
    for (const [c, rows] of Object.entries(GLYPHS))
      add(c, () => {
        const cv = canvas(SQUARE, SQUARE);
        const [x0, y0] = /\d/.test(c) ? [2, 2] : [SQUARE - 5, SQUARE - 7];
        rows.forEach((row, y) => [...row].forEach((k, x) => k !== "." && (cv[y0 + y]![x0 + x] = k)));
        return { grid: toGrid(cv), outline: false };
      });
    return parts;
  })(),
  anims: Object.fromEntries(Object.keys(GLYPHS).map((c) => [c, { loop: true, frames: [{ ms: 1000, layers: [{ part: c, x: 0, y: 0 }] }] } satisfies Anim])),
};

// ---- A lash of his strand landing on a king (his attack: the God King in his Last Stand, the crowd's king at his
// mate), one square: the strand's crack across it in one of its bulbs' colors, sparks bursting off its tip.

/** The lash's colors, in the lights' default colors (lights.ts): color `b` takes the battle's color of his strand's bulb `b`. */
const STRIP_LIT = [0, 1, 2].map((b) => bulbColour(DEFAULT_LIGHTS[b]!));
const LASH_PALETTE = {
  k: "#00000000",
  "1": STRIP_LIT[0]!.glass, // the first three bulbs' colors: the crack's color, its edge, its spark
  "4": STRIP_LIT[0]!.shade,
  "7": STRIP_LIT[0]!.glint,
  "2": STRIP_LIT[1]!.glass,
  "5": STRIP_LIT[1]!.shade,
  "8": STRIP_LIT[1]!.glint,
  "3": STRIP_LIT[2]!.glass,
  "6": STRIP_LIT[2]!.shade,
  "9": STRIP_LIT[2]!.glint,
  u: "#5b36a3", // violet, as everything of his
  U: "#9c6cff",
  x: "#e9ddff",
  y: "#e9ddff88",
  z: "#5b36a366",
} as const;
const LASH_COLOURS = [["1", "4", "7"], ["2", "5", "8"], ["3", "6", "9"]] as const;

/**
 * The crack across the square, coming in from the left edge: `kind` "F" a forehand (straight, a little down, high on
 * the square), "B" a backhand (low, rising). `n` pixels of it so far (it sweeps in), each with a jag. Returns its points.
 */
const crackLine = (kind: "F" | "B", n: number): Pt[] => {
  const [y0, y1] = kind === "F" ? [11, 16] : [22, 13];
  const out: Pt[] = [];
  for (let x = 0; x <= Math.min(26, n); x++) out.push([x, Math.round(y0 + ((y1 - y0) * x) / 26 + (x % 5 === 2 ? 1 : x % 5 === 4 ? -1 : 0))]);
  return out;
};
const lashFrame = (kind: "F" | "B", c: number, step: 0 | 1 | 2): Speck[] => {
  const [main, edge, hot] = LASH_COLOURS[c]!;
  const pts = crackLine(kind, step === 0 ? 18 : 26);
  const tip = pts[pts.length - 1]!;
  const out: Speck[] = [];
  if (step < 2)
    for (const [x, y] of pts) {
      out.push([x, y, step === 0 ? hot : main], [x, y + 1, step === 0 ? main : edge]);
      if (step === 0 && x % 3 === 0) out.push([x, y - 1, "x"]);
    }
  else for (const [x, y] of pts) if (x % 2 === 0 && x > 6) out.push([x, y, "z"]);
  // Sparks off the tip: a burst, then flying apart and dimming.
  const r = [2, 5, 8][step]!;
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2 + c;
    const px = Math.round(tip[0] + Math.cos(ang) * r);
    const py = Math.round(tip[1] + Math.sin(ang) * r * 0.8);
    if (px < 0 || py < 0 || px > 31 || py > 31) continue;
    out.push([px, py, step === 2 ? "y" : a % 2 ? hot : "U"]);
    if (step === 0) out.push([px + (a % 2 ? 1 : -1), py, main]);
  }
  if (step === 0) out.push(...sparkle(tip[0], tip[1], "x", "U", true));
  return out;
};
/** Mirrored left to right (the lash coming in from the right edge: he stands to the king's right). */
const flipSpecks = (sp: Speck[]): Speck[] => sp.map(([x, y, k]) => [SQUARE - 1 - x, y, k] as Speck);
const lashAnims: Record<string, Anim> = {};
for (const kind of ["F", "B"] as const)
  for (const side of ["L", "R"] as const)
    for (let c = 0; c < 3; c++) {
      const sp = (step: 0 | 1 | 2) => (side === "L" ? lashFrame(kind, c, step) : flipSpecks(lashFrame(kind, c, step)));
      lashAnims[`hit${kind}${side}${c}`] = {
        loop: false,
        frames: [
          { ms: 50, layers: [], specks: sp(0) },
          { ms: 70, layers: [], specks: sp(1) },
          { ms: 60, layers: [], specks: sp(2) },
          { ms: 20, layers: [] },
        ],
      };
    }
/**
 * A lash landing on a king's square: `hit<F|B><L|R><c>`: a forehand (straight, high) or backhand (rising, low), coming
 * in from the left or the right edge, in bulb color c (the color of the strand's bulb c: 0, 1 or 2, the battle's
 * lights; red, yellow and blue before a battle's are known). About 200 ms; ends empty. Over the
 * piece (or the God King standing there), see-through round its line.
 */
export const LASH_HIT: Character = {
  id: "lash-hit",
  name: "A lash of Hollow's strand",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: LASH_PALETTE,
  // (In the battle's colors: lights.ts.)
  swap: lightsSwap(LASH_COLOURS),
  parts: {},
  anims: lashAnims,
};
