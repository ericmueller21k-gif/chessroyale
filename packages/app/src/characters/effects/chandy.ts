/**
 * Chandy's board art (mockup round 1, unwired): the lock-on crosshair, the scatter shot's blocked squares, the beam's cover, the
 * bubble shield, rapid fire's hits and dizzy stars, and the queen lock's piercing round. One square is SQUARE (32) art px, as every
 * boss's board art. His energy is the rifle's cyan (chandy.ts CHANDY_PALETTE's q F O Q).
 */
import type { Anim, Character, Frame, Part, Speck } from "../sprite.ts";
import { lazyAnim } from "../sprite.ts";
import { SQUARE } from "./common.ts";

export const CHANDY_FX_PALETTE: Record<string, string> = {
  k: "#06151c", // outline
  q: "#0a5470", // cyan energy: dark to white-hot
  F: "#129cc3",
  O: "#58e6ff",
  Q: "#e4ffff",
  // See-through energy (the beam's body and the shield's skin): the beam hides what's under it, the shield doesn't.
  B: "#0d3f57",
  b: "#12607e",
  s: "#58e6ff40",
  S: "#9ef2ff70",
  y: "#f2c14e", // dizzy stars: the game's gold, and their light
  Y: "#ffe58a",
  w: "#ffffff",
  G: "#2a3139", // a shard of a shattered piece: steel dark and light (the piece's own colors come from the board)
  J: "#a1aec0",
};

const S = SQUARE;
type Cv = string[][];
const cv = (w = S, h = S): Cv =>
  Array.from({ length: h }, () => Array<string>(w).fill("."));
const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const grid = (c: Cv): readonly string[] => c.map((r) => r.join(""));
const one = (name: string, c: Cv, outline = false): Record<string, Part> => ({
  [name]: { grid: grid(c), outline },
});
const at = (part: string, ms: number, extra: Partial<Frame> = {}): Frame => ({
  ms,
  layers: [{ part, x: 0, y: 0 }],
  ...extra,
});

// ---- The lock-on crosshair: four corner brackets, a ring, ticks to the square's edges; a gap in the middle so the piece shows.

function crosshair(inset: number, ring: boolean, hot: boolean): Cv {
  const c = cv();
  const a = inset;
  const z = S - 1 - inset;
  const L = 6;
  const k = hot ? "Q" : "O";
  for (let i = 0; i < L; i++)
    for (const [x, y] of [
      [a + i, a],
      [a, a + i],
      [z - i, a],
      [z, a + i],
      [a + i, z],
      [a, z - i],
      [z - i, z],
      [z, z - i],
    ] as const)
      put(c, x, y, k);
  for (let i = 0; i < L - 1; i++)
    for (const [x, y] of [
      [a + 1 + i, a + 1],
      [a + 1, a + 1 + i],
      [z - 1 - i, a + 1],
      [z - 1, a + 1 + i],
      [a + 1 + i, z - 1],
      [a + 1, z - 1 - i],
      [z - 1 - i, z - 1],
      [z - 1, z - 1 - i],
    ] as const)
      put(c, x, y, "F");
  if (ring)
    for (let t = 0; t < 360; t += 2) {
      const r = 10.5;
      const x = 15.5 + Math.cos((t * Math.PI) / 180) * r;
      const y = 15.5 + Math.sin((t * Math.PI) / 180) * r;
      if (
        Math.abs(Math.cos((t * Math.PI) / 180)) > 0.25 &&
        Math.abs(Math.sin((t * Math.PI) / 180)) > 0.25
      )
        put(c, x, y, "F");
    }
  // Ticks from the ring to the edges (N, E, S, W).
  for (let i = 0; i < 4; i++) {
    (put(c, 15, 2 + i, k), put(c, 16, 2 + i, k));
    (put(c, 15, S - 3 - i, k), put(c, 16, S - 3 - i, k));
    (put(c, 2 + i, 15, k), put(c, 2 + i, 16, k));
    (put(c, S - 3 - i, 15, k), put(c, S - 3 - i, 16, k));
  }
  return c;
}
const crossParts: Record<string, Part> = {
  ...one("x-wide", crosshair(0, false, true), true),
  ...one("x-mid", crosshair(1, true, true), true),
  ...one("x-a", crosshair(2, true, false), true),
  ...one("x-b", crosshair(3, true, true), true),
};
/** The crosshair on the locked piece: `lock` snaps it in from the square's edge, `held` pulses (in and out a pixel). */
export const CROSSHAIR: Character = {
  id: "chandy-crosshair",
  name: "Chandy's lock-on",
  w: S,
  h: S,
  foot: [16, 31],
  palette: CHANDY_FX_PALETTE,
  parts: crossParts,
  anims: {
    lock: lazyAnim(() => ({
      loop: false,
      frames: [
        at("x-wide", 60, { cue: "lock" }),
        at("x-mid", 60),
        at("x-b", 80),
        at("x-a", 200),
      ],
    })),
    held: lazyAnim(() => ({
      loop: true,
      frames: [at("x-a", 500), at("x-b", 260), at("x-a", 500)],
    })),
  },
};

// ---- Scatter shot: the shot's burst on its square, four sparks flying out, and the blocked squares' static (crackling cyan).

function staticMark(seed: number, hot: boolean): Cv {
  const c = cv();
  // A low ring of static round the square's middle, sparks in it, its corners lit (it reads on light and dark squares).
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 18) / 11;
      const h = Math.sin(x * 1.7 + seed * 2.3) * Math.cos(y * 1.3 - seed);
      if (d > 0.82 && d < 1.02) put(c, x, y, h > 0.2 ? "O" : "F");
      else if (d < 0.82 && h > (hot ? 0.55 : 0.7))
        put(c, x, y, h > 0.85 ? "Q" : "O");
      else if (d < 0.82 && (x + y + seed) % 5 === 0) put(c, x, y, "s");
    }
  // Two little zigzag arcs across it.
  const zig = (x0: number, y0: number, dx: number) => {
    for (let i = 0; i < 7; i++)
      put(c, x0 + i * dx, y0 + (i % 2 ? -1 : 1) + (seed % 2), "Q");
  };
  zig(9, 14, 1);
  zig(22, 21, -1);
  return c;
}
const scatterParts: Record<string, Part> = {
  ...one("st0", staticMark(0, false), true),
  ...one("st1", staticMark(1, true), true),
  ...one("st2", staticMark(2, false), true),
};
const burstSpecks = (r: number): Speck[] => {
  const out: Speck[] = [];
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (Math.hypot(x, y) <= r + 0.3)
        out.push([
          16 + x,
          16 + y,
          Math.hypot(x, y) < r * 0.45
            ? "Q"
            : Math.hypot(x, y) < r * 0.8
              ? "O"
              : "F",
        ]);
  return out;
};
/** The blocked squares: `land` (a spark arrives and the static opens), `held` (the static crackles). */
export const SCATTER_MARK: Character = {
  id: "chandy-scatter",
  name: "A square scatter shot has blocked",
  w: S,
  h: S,
  foot: [16, 31],
  palette: CHANDY_FX_PALETTE,
  parts: scatterParts,
  anims: {
    land: lazyAnim(() => ({
      loop: false,
      frames: [
        { ms: 50, layers: [], specks: burstSpecks(3) },
        {
          ms: 60,
          layers: [{ part: "st1", x: 0, y: 0 }],
          specks: burstSpecks(2),
        },
        at("st0", 120),
      ],
    })),
    held: lazyAnim(() => ({
      loop: true,
      frames: [at("st0", 220), at("st1", 120), at("st2", 220)],
    })),
  },
};
/** The shot itself on the target square: a hot burst that throws its four sparks out. */
export const SCATTER_BURST: Character = {
  id: "chandy-scatter-burst",
  name: "Scatter shot's burst",
  w: S,
  h: S,
  foot: [16, 31],
  palette: CHANDY_FX_PALETTE,
  parts: {},
  anims: {
    burst: lazyAnim(() => ({
      loop: false,
      frames: [
        { ms: 60, layers: [], specks: burstSpecks(4), cue: "scatter" },
        { ms: 60, layers: [], specks: burstSpecks(8) },
        {
          ms: 60,
          layers: [],
          specks: burstSpecks(6).filter((_, i) => i % 2 === 0),
        },
        { ms: 40, layers: [] },
      ],
    })),
  },
};

// ---- The beam's cover: one square of a row or column under the beam, opaque (you can't see what's under it), scanlines moving.

function beamTile(phase: number, across: boolean, cross: boolean): Cv {
  const c = cv();
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const t = across ? y : x; // across the beam: its edges bright, its middle hot
      const a = across ? x : y; // along it: scanlines moving
      const edge = t < 2 || t > S - 3;
      const rim = t < 4 || t > S - 5;
      let k = edge ? "O" : rim ? "F" : (a + phase) % 6 < 1 ? "b" : "B";
      if (!rim && Math.abs(t - 15.5) < 1.2) k = "F";
      if (cross && !rim) k = (x + y + phase) % 6 < 1 ? "b" : "B";
      put(c, x, y, k);
    }
  if (cross) {
    // Where the row and the column cross: a hot spot.
    for (let y = 10; y < 22; y++)
      for (let x = 10; x < 22; x++)
        if (Math.hypot(x - 15.5, y - 15.5) < 6)
          put(c, x, y, Math.hypot(x - 15.5, y - 15.5) < 3 ? "Q" : "O");
  }
  return c;
}
const beamParts: Record<string, Part> = {};
for (const p of [0, 2, 4]) {
  Object.assign(
    beamParts,
    one(`row${p}`, beamTile(p, true, false)),
    one(`col${p}`, beamTile(p, false, false)),
    one(`x${p}`, beamTile(p, false, true)),
  );
}
const beamLoop = (k: string): Anim => ({
  loop: true,
  frames: [at(`${k}0`, 90), at(`${k}2`, 90), at(`${k}4`, 90)],
});
/** A beam square: `row` (the beam runs left-right), `col` (up-down), `cross` (where they meet). Opaque: it hides the piece. */
export const BEAM_TILE: Character = {
  id: "chandy-beam",
  name: "A square under Chandy's beam",
  w: S,
  h: S,
  foot: [16, 31],
  palette: CHANDY_FX_PALETTE,
  parts: beamParts,
  anims: {
    row: lazyAnim(() => beamLoop("row")),
    col: lazyAnim(() => beamLoop("col")),
    cross: lazyAnim(() => beamLoop("x")),
  },
};

// ---- The bubble shield: a see-through sphere over his piece, a bright rim, a highlight arc at its top left, a hex shimmer.

function bubble(shimmer: number): Cv {
  const c = cv();
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - 16;
      const dy = y + 0.5 - 16.5;
      const d = Math.hypot(dx, dy);
      if (d > 14.6) continue;
      let k = d > 13.4 ? "O" : d > 12.2 ? "S" : "s";
      // A faint hex net that shimmers across it.
      const hx = (x + shimmer * 2) % 6;
      const hy = (y + (Math.floor((x + shimmer * 2) / 6) % 2) * 3) % 6;
      if (d < 12.2 && (hx === 0 || hy === 0) && (x + y + shimmer) % 3 === 0)
        k = "S";
      // The highlight: an arc at the top left, and a glint.
      const ang = Math.atan2(dy, dx);
      if (d > 9.5 && d < 11.5 && ang > -2.6 && ang < -1.7) k = "Q";
      put(c, x, y, k);
    }
  put(c, 9, 9, "w");
  put(c, 10, 8, "w");
  return c;
}
const shieldParts: Record<string, Part> = {
  ...one("sh0", bubble(0)),
  ...one("sh1", bubble(1)),
  ...one("sh2", bubble(2)),
};
/** His shielded piece: `up` (the bubble grows over it), `held` (it shimmers). It doesn't hide the piece. */
export const SHIELD: Character = {
  id: "chandy-shield",
  name: "Chandy's bubble shield",
  w: S,
  h: S,
  foot: [16, 31],
  palette: CHANDY_FX_PALETTE,
  parts: shieldParts,
  anims: {
    up: lazyAnim(() => ({
      loop: false,
      frames: [
        { ms: 50, layers: [], specks: burstSpecks(3) },
        { ms: 60, layers: [{ part: "sh1", x: 0, y: 0 }], cue: "shield" },
        at("sh0", 120),
      ],
    })),
    held: lazyAnim(() => ({
      loop: true,
      frames: [at("sh0", 300), at("sh1", 300), at("sh2", 300)],
    })),
  },
};

// ---- Rapid fire: a hit (a little cyan splash), then dizzy stars circling over the piece's head.

/** A five-point-ish star, 7 px across: a bright middle, gold arms, a white tip at the top. */
const star = (x: number, y: number, k = "y", l = "Y"): Speck[] => [
  [x, y, l],
  [x - 1, y, l],
  [x + 1, y, l],
  [x, y - 1, l],
  [x, y + 1, k],
  [x - 2, y, k],
  [x + 2, y, k],
  [x - 3, y, k],
  [x + 3, y, k],
  [x, y - 2, k],
  [x, y - 3, "w"],
  [x - 1, y + 2, k],
  [x + 1, y + 2, k],
  [x - 2, y + 3, k],
  [x + 2, y + 3, k],
  [x - 1, y + 1, k],
  [x + 1, y + 1, k],
];
function dizzy(t: number): Speck[] {
  const out: Speck[] = [];
  for (let i = 0; i < 3; i++) {
    const a = t * 0.9 + (i * Math.PI * 2) / 3;
    const x = 16 + Math.cos(a) * 10;
    const y = 6 + Math.sin(a) * 3;
    out.push(
      ...star(Math.round(x), Math.round(y), "y", Math.sin(a) > 0 ? "w" : "Y"),
    );
  }
  return out;
}
const hitSpecks = (step: number): Speck[] =>
  step === 0
    ? burstSpecks(2).map(([x, y, k]): Speck => [x + 4, y - 4, k])
    : step === 1
      ? [
          [17, 11, "Q"],
          [23, 9, "O"],
          [21, 15, "O"],
          [25, 13, "F"],
          [19, 7, "F"],
        ]
      : [
          [24, 8, "F"],
          [26, 14, "F"],
        ];
/** Rapid fire on one piece: `hit` (three quick zaps), then `dizzy` (the stars circle over it while it can't move). */
export const DIZZY: Character = {
  id: "chandy-dizzy",
  name: "Rapid fire's hits and dizzy stars",
  w: S,
  h: S,
  foot: [16, 31],
  palette: CHANDY_FX_PALETTE,
  parts: {},
  anims: {
    hit: lazyAnim(() => ({
      loop: false,
      frames: [
        { ms: 40, layers: [], specks: hitSpecks(0), cue: "zap" },
        { ms: 50, layers: [], specks: hitSpecks(1) },
        { ms: 40, layers: [], specks: hitSpecks(2) },
        { ms: 30, layers: [] },
      ],
    })),
    dizzy: lazyAnim(() => ({
      loop: true,
      frames: Array.from({ length: 6 }, (_, i) => ({
        ms: 110,
        layers: [],
        specks: dizzy(i),
      })),
    })),
  },
};

// ---- The queen lock's piercing round: a bolt of energy flying along a file or a rank, and the shatter of the piece it hits.

function bolt(len: number): Cv {
  const c = cv(S, S);
  for (let x = 0; x < S; x++)
    for (let y = 0; y < S; y++) {
      const fromHead = S - 1 - x;
      const half =
        fromHead < 3
          ? 2.6
          : fromHead < len
            ? 2.2 * (1 - (fromHead - 3) / len) + 0.6
            : -1;
      const d = Math.abs(y + 0.5 - 16);
      if (d > half) continue;
      put(c, x, y, d < half * 0.4 ? "Q" : d < half * 0.75 ? "O" : "F");
    }
  return c;
}
/** The round's trail down a whole square (its file, top to bottom): a hot core and a fading glow. */
function trail(): Cv {
  const c = cv();
  for (let y = 0; y < S; y++)
    for (let x = 10; x < 22; x++) {
      const d = Math.abs(x + 0.5 - 16);
      put(
        c,
        x,
        y,
        d < 1.2
          ? "Q"
          : d < 2.6
            ? "O"
            : d < 4
              ? "F"
              : (y + x) % 3 === 0
                ? "S"
                : "s",
      );
    }
  return c;
}
const boltParts: Record<string, Part> = {
  ...one("bolt", bolt(26)),
  ...one("trail", trail()),
};
/** The round in flight (pointing our right; the board turns it to its way: up, down, left or right), `fly` a two-frame flicker. */
export const PIERCING_ROUND: Character = {
  id: "chandy-round",
  name: "The queen lock's piercing round",
  w: S,
  h: S,
  foot: [16, 31],
  palette: CHANDY_FX_PALETTE,
  parts: boltParts,
  anims: {
    fly: lazyAnim(() => ({
      loop: true,
      frames: [
        at("bolt", 60),
        {
          ms: 60,
          layers: [{ part: "bolt", x: 0, y: 0 }],
          pal: { O: "#e4ffff" },
        },
      ],
    })),
    /** The trail it leaves down a square it crossed (a column; turned for a rank). */
    trail: lazyAnim(() => ({
      loop: false,
      frames: [
        at("trail", 120),
        {
          ms: 120,
          layers: [{ part: "trail", x: 0, y: 0 }],
          pal: { Q: "#58e6ff", O: "#129cc3", F: "#0a5470" },
        },
      ],
    })),
  },
};
const shards = (t: number): Speck[] => {
  const out: Speck[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.3;
    const r = 4 + t * 9 + (i % 3);
    const x = Math.round(16 + Math.cos(a) * r);
    const y = Math.round(17 + Math.sin(a) * r * 0.8 + t * t * 4);
    out.push(
      [x, y, i % 3 === 0 ? "J" : i % 3 === 1 ? "G" : "O"],
      [x + 1, y, i % 2 ? "G" : "J"],
    );
  }
  return out;
};
/** A piece the round hits shatters: a flash, its shards flying out and falling. */
export const SHATTER: Character = {
  id: "chandy-shatter",
  name: "A piece shattered by the piercing round",
  w: S,
  h: S,
  foot: [16, 31],
  palette: CHANDY_FX_PALETTE,
  parts: {},
  anims: {
    shatter: lazyAnim(() => ({
      loop: false,
      frames: [
        { ms: 60, layers: [], specks: burstSpecks(7), cue: "shatter" },
        { ms: 70, layers: [], specks: [...burstSpecks(3), ...shards(0.2)] },
        { ms: 90, layers: [], specks: shards(0.6) },
        { ms: 110, layers: [], specks: shards(1) },
        { ms: 40, layers: [] },
      ],
    })),
  },
};

/** Every one of Chandy's board sprites (for the preview and the mockup). */
export const CHANDY_FX = {
  CROSSHAIR,
  SCATTER_MARK,
  SCATTER_BURST,
  BEAM_TILE,
  SHIELD,
  DIZZY,
  PIERCING_ROUND,
  SHATTER,
} as const;
