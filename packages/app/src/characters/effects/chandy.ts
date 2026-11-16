/**
 * Chandy's board art (docs/decisions/2026-11-16-chandy-art.md; his design: branch stills/boss-chandy, DESIGN.md): the lock-on crosshair
 * (with its turns-left pips), the scatter shot's burst and blocked squares, the beam's cover, the bubble shield, rapid fire's hits and
 * dizzy stars, the queen lock's aim, round, trail and shatter, and Dodge's line flash and blasts. One square is SQUARE (32) art px, as
 * every boss's board art; each plays on the shared board-effects canvas as an effect (power-art.ts EFFECTS: a start, a loop, an end
 * that ends on an empty frame). His energy is the rifle's cyan (chandy.ts CHANDY_PALETTE's q F O Q); Dodge's lines are his clones'
 * pink. Every part is painted on first use (lazyParts), nothing as the app loads.
 */
import type { Anim, Character, Frame, Layer, Speck } from "../sprite.ts";
import { lazyAnim, lazyParts } from "../sprite.ts";
import { SQUARE } from "./common.ts";

export const CHANDY_FX_PALETTE: Record<string, string> = {
  k: "#06151c", // outline
  q: "#0a5470", // cyan energy: dark to white-hot
  F: "#129cc3",
  O: "#58e6ff",
  Q: "#e4ffff",
  B: "#0d3f57", // the beam's cover (opaque: you can't see what's under it)
  b: "#12607e",
  s: "#58e6ff40", // the shield's see-through skin
  S: "#9ef2ff70",
  y: "#f2c14e", // dizzy stars: the game's gold, and their light
  Y: "#ffe58a",
  w: "#ffffff",
  G: "#2a3139", // a shard of a shattered piece: steel dark and light
  J: "#a1aec0",
};

/** Dodge's colors: his clones' pink (chandy.ts CHANDY_CLONE_PALETTE's reds) over the same keys, by a frame's `pal`. */
const CLONE_FX: Record<string, string> = { O: "#ff3f5e", F: "#c4243f", Q: "#ffe0e6", q: "#7c37ff" };

const S = SQUARE;
type Cv = string[][];
const cv = (w = S, h = S): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const grid = (c: Cv): readonly string[] => c.map((r) => r.join(""));

/** Every part of his board art, made on first use. */
const P = lazyParts();
/** A part painted by `paint` the first time it's drawn. */
const one = (name: string, paint: () => Cv, outline = false): string => P.add(name, () => ({ grid: grid(paint()), outline }));
const L = (part: string, rot?: 1): Layer => ({ part, x: 0, y: 0, ...(rot ? { rot } : {}) });
const at = (part: string, ms: number, extra: Partial<Frame> = {}): Frame => ({ ms, layers: [L(part)], ...extra });
const EMPTY = (ms = 40): Frame => ({ ms, layers: [] });
const fx = (id: string, name: string, anims: Record<string, () => Anim>): Character => ({
  id,
  name,
  w: S,
  h: S,
  foot: [16, S - 1],
  palette: CHANDY_FX_PALETTE,
  parts: P.parts,
  anims: Object.fromEntries(Object.entries(anims).map(([k, make]) => [k, lazyAnim(make)])),
});
const burstSpecks = (r: number, cx = 16, cy = 16): Speck[] => {
  const out: Speck[] = [];
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y);
      if (d <= r + 0.3) out.push([cx + x, cy + y, d < r * 0.45 ? "Q" : d < r * 0.8 ? "O" : "F"]);
    }
  return out.filter(([x, y]) => x >= 1 && y >= 1 && x <= S - 2 && y <= S - 2);
};

// ---- The lock-on crosshair: four corner brackets, a ring, ticks to the square's edges, a gap in the middle so the piece shows;
// three pips along its bottom count the lock's turns left (3, 2, 1).

function crosshair(inset: number, ring: boolean, hot: boolean, pips: number): Cv {
  const c = cv();
  const a = inset;
  const z = S - 1 - inset;
  const n = 6;
  const k = hot ? "Q" : "O";
  for (let i = 0; i < n; i++)
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
  for (let i = 0; i < n - 1; i++)
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
      const r = (t * Math.PI) / 180;
      if (Math.abs(Math.cos(r)) > 0.25 && Math.abs(Math.sin(r)) > 0.25) put(c, 15.5 + Math.cos(r) * 10.5, 15.5 + Math.sin(r) * 10.5, "F");
    }
  for (let i = 0; i < 4; i++) {
    (put(c, 15, 2 + i, k), put(c, 16, 2 + i, k));
    (put(c, 15, S - 3 - i, k), put(c, 16, S - 3 - i, k));
    (put(c, 2 + i, 15, k), put(c, 2 + i, 16, k));
    (put(c, S - 3 - i, 15, k), put(c, S - 3 - i, 16, k));
  }
  // The pips: 2 x 2 dots in the gap between the bottom brackets, lit for each turn left.
  if (pips > 0)
    for (let i = 0; i < 3; i++)
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const)
        put(c, 10 + i * 5 + dx + (i > 0 ? 1 : 0), 26 + dy, i < pips ? "Q" : "q");
  return c;
}
one("x-wide", () => crosshair(0, false, true, 0), true);
one("x-mid", () => crosshair(1, true, true, 0), true);
for (const pips of [0, 1, 2, 3]) {
  one(`x-a${pips}`, () => crosshair(2, true, false, pips), true);
  one(`x-b${pips}`, () => crosshair(3, true, true, pips), true);
}
const held = (pips: number): Anim => ({ loop: true, frames: [at(`x-a${pips}`, 500), at(`x-b${pips}`, 260), at(`x-a${pips}`, 500)] });
/**
 * The crosshair on a locked piece: `lock` snaps it in from the square's edge; `held` pulses (no pips), `held3`, `held2`, `held1` with its
 * turns left; `drop` (the lock moves on) dims it away.
 */
export const CROSSHAIR = fx("chandy-crosshair", "Chandy's lock-on", {
  lock: () => ({ loop: false, frames: [at("x-wide", 60, { cue: "lock" }), at("x-mid", 60), at("x-b0", 80), at("x-a0", 200)] }),
  held: () => held(0),
  held3: () => held(3),
  held2: () => held(2),
  held1: () => held(1),
  drop: () => ({
    loop: false,
    frames: [at("x-a0", 60, { cue: "unlock" }), at("x-b0", 60, { pal: { O: "#129cc3", Q: "#58e6ff" } }), EMPTY()],
  }),
});

// ---- Scatter shot: the shot's burst on its spot; its blocked squares' static (crackling cyan; Boingo's pie rule).

function staticMark(seed: number, hot: boolean): Cv {
  const c = cv();
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 18) / 11;
      const h = Math.sin(x * 1.7 + seed * 2.3) * Math.cos(y * 1.3 - seed);
      if (d > 0.82 && d < 1.02) put(c, x, y, h > 0.2 ? "O" : "F");
      else if (d < 0.82 && h > (hot ? 0.55 : 0.7)) put(c, x, y, h > 0.85 ? "Q" : "O");
      else if (d < 0.82 && (x + y + seed) % 5 === 0) put(c, x, y, "s");
    }
  for (const [x0, y0, dx] of [
    [9, 14, 1],
    [22, 21, -1],
  ] as const)
    for (let i = 0; i < 7; i++) put(c, x0 + i * dx, y0 + (i % 2 ? -1 : 1) + (seed % 2), "Q");
  return c;
}
for (const i of [0, 1, 2]) one(`st${i}`, () => staticMark(i, i === 1), true);
/** A blocked square: `land` (a spark arrives, the static opens), `held` (it crackles), `fade` (your turn's over). */
export const SCATTER_MARK = fx("chandy-scatter", "A square scatter shot has blocked", {
  land: () => ({
    loop: false,
    frames: [{ ms: 50, layers: [], specks: burstSpecks(3), cue: "spark" }, at("st1", 60, { specks: burstSpecks(2) }), at("st0", 120)],
  }),
  held: () => ({ loop: true, frames: [at("st0", 220), at("st1", 120), at("st2", 220)] }),
  fade: () => ({ loop: false, frames: [at("st2", 80, { cue: "fizz" }), at("st0", 60, { pal: { O: "#129cc3", Q: "#58e6ff" } }), EMPTY()] }),
});
/** The shot on its spot: a hot burst that throws its four sparks out. */
export const SCATTER_BURST = fx("chandy-scatter-burst", "Scatter shot's burst", {
  burst: () => ({
    loop: false,
    frames: [
      { ms: 60, layers: [], specks: burstSpecks(4), cue: "scatter" },
      { ms: 60, layers: [], specks: burstSpecks(8) },
      { ms: 60, layers: [], specks: burstSpecks(6).filter((_, i) => i % 2 === 0) },
      EMPTY(),
    ],
  }),
});

// ---- The beam's cover: one square of the rank or file under the beam, opaque, scanlines moving; where they cross, a hot spot.

function beamTile(phase: number, across: boolean, cross: boolean): Cv {
  const c = cv();
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const t = across ? y : x;
      const a = across ? x : y;
      const rim = t < 4 || t > S - 5;
      let k = t < 2 || t > S - 3 ? "O" : rim ? "F" : (a + phase) % 6 < 1 ? "b" : "B";
      if (!rim && Math.abs(t - 15.5) < 1.2) k = "F";
      if (cross && !rim) k = (x + y + phase) % 6 < 1 ? "b" : "B";
      put(c, x, y, k);
    }
  if (cross)
    for (let y = 10; y < 22; y++)
      for (let x = 10; x < 22; x++) if (Math.hypot(x - 15.5, y - 15.5) < 6) put(c, x, y, Math.hypot(x - 15.5, y - 15.5) < 3 ? "Q" : "O");
  return c;
}
for (const p of [0, 2, 4]) {
  one(`row${p}`, () => beamTile(p, true, false));
  one(`col${p}`, () => beamTile(p, false, false));
  one(`x${p}`, () => beamTile(p, false, true));
}
const beamLoop = (k: string): Anim => ({ loop: true, frames: [at(`${k}0`, 90), at(`${k}2`, 90), at(`${k}4`, 90)] });
const beamIn = (k: string): Anim => ({
  loop: false,
  frames: [{ ms: 50, layers: [L(`${k}0`)], pal: { B: "#58e6ff", b: "#e4ffff" }, cue: "beam" }, at(`${k}2`, 60)],
});
const beamOut = (k: string): Anim => ({ loop: false, frames: [at(`${k}4`, 60, { pal: { B: "#12607e" }, cue: "beamOff" }), EMPTY()] });
/** A square under the beam: `row`, `col` or `cross` (`…In` flashes it on, the loop holds, `…Out` lifts it). Opaque: it hides the piece. */
export const BEAM_TILE = fx("chandy-beam", "A square under Chandy's beam", {
  rowIn: () => beamIn("row"),
  row: () => beamLoop("row"),
  rowOut: () => beamOut("row"),
  colIn: () => beamIn("col"),
  col: () => beamLoop("col"),
  colOut: () => beamOut("col"),
  crossIn: () => beamIn("x"),
  cross: () => beamLoop("x"),
  crossOut: () => beamOut("x"),
});

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
      const hx = (x + shimmer * 2) % 6;
      const hy = (y + (Math.floor((x + shimmer * 2) / 6) % 2) * 3) % 6;
      if (d < 12.2 && (hx === 0 || hy === 0) && (x + y + shimmer) % 3 === 0) k = "S";
      const ang = Math.atan2(dy, dx);
      if (d > 9.5 && d < 11.5 && ang > -2.6 && ang < -1.7) k = "Q";
      put(c, x, y, k);
    }
  put(c, 9, 9, "w");
  put(c, 10, 8, "w");
  return c;
}
for (const i of [0, 1, 2]) one(`sh${i}`, () => bubble(i));
/** His shielded piece: `up` (the bubble grows over it), `held` (it shimmers), `pop` (your turn's over). It doesn't hide the piece. */
export const SHIELD = fx("chandy-shield", "Chandy's bubble shield", {
  up: () => ({ loop: false, frames: [{ ms: 50, layers: [], specks: burstSpecks(3), cue: "shield" }, at("sh1", 60), at("sh0", 120)] }),
  held: () => ({ loop: true, frames: [at("sh0", 300), at("sh1", 300), at("sh2", 300)] }),
  pop: () => ({
    loop: false,
    frames: [at("sh2", 60, { cue: "pop" }), { ms: 60, layers: [], specks: burstSpecks(6).filter((_, i) => i % 3 === 0) }, EMPTY()],
  }),
});

// ---- Rapid fire: a hit (a little cyan splash), then dizzy stars circling over the piece's head (Moo & Moon's stun rule).

/** A star 9 px across: a bright middle, gold arms, a white tip at the top. */
const star = (x: number, y: number, k = "y", l = "Y"): Speck[] => {
  const out: Speck[] = [];
  for (let d = -4; d <= 4; d++) out.push([x + d, y, Math.abs(d) < 2 ? l : k]);
  for (let d = -4; d <= 3; d++) out.push([x, y + d, d === -4 ? "w" : Math.abs(d) < 2 ? l : k]);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 2], [2, 2], [-3, 3], [3, 3]] as const) out.push([x + dx, y + dy, Math.abs(dx) < 2 ? l : k]);
  return out;
};
const dizzy = (t: number): Speck[] =>
  [0, 1, 2]
    .flatMap((i) => {
      const a = t * 0.9 + (i * Math.PI * 2) / 3;
      return star(Math.round(16 + Math.cos(a) * 10), Math.round(7 + Math.sin(a) * 2), "y", Math.sin(a) > 0 ? "w" : "Y");
    })
    .filter(([x, y]) => x >= 1 && y >= 1 && x <= S - 2 && y <= S - 2);
const hitSpecks = (step: number): Speck[] =>
  step === 0
    ? burstSpecks(2, 20, 12)
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
/** Rapid fire on one piece: `hit` (three quick zaps), `dizzy` (the stars circle over it while it can't move), `clear`. */
export const DIZZY = fx("chandy-dizzy", "Rapid fire's hits and dizzy stars", {
  hit: () => ({
    loop: false,
    frames: [
      { ms: 40, layers: [], specks: hitSpecks(0), cue: "zap" },
      { ms: 50, layers: [], specks: hitSpecks(1) },
      { ms: 40, layers: [], specks: hitSpecks(2) },
      EMPTY(30),
    ],
  }),
  dizzy: () => ({ loop: true, frames: Array.from({ length: 6 }, (_, i) => ({ ms: 110, layers: [], specks: dizzy(i) })) }),
  clear: () => ({ loop: false, frames: [{ ms: 80, layers: [], specks: dizzy(0).filter((_, i) => i % 2 === 0), cue: "clear" }, EMPTY()] }),
});

// ---- The queen lock: the aim down her file (cyan, dashed), the round flying down it, its trail, and the shatter of the piece it hits.

/** A dashed line across a square, left to right (a quarter turn for a file), with a dark edge so it reads on light and dark squares. */
function dashed(): Cv {
  const c = cv();
  for (let x = 0; x < S; x++) {
    if (x % 8 >= 5) continue;
    (put(c, x, 15, "O"), put(c, x, 16, "O"), put(c, x, 14, "q"), put(c, x, 17, "q"));
  }
  return c;
}
/** The round, pointing down (it always comes from his side): a hot head at the bottom, a tapering tail up. */
function bolt(len: number): Cv {
  const c = cv();
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const fromHead = S - 1 - y;
      const half = fromHead < 3 ? 2.6 : fromHead < len ? 2.2 * (1 - (fromHead - 3) / len) + 0.6 : -1;
      const d = Math.abs(x + 0.5 - 16);
      if (d > half) continue;
      put(c, x, y, d < half * 0.4 ? "Q" : d < half * 0.75 ? "O" : "F");
    }
  return c;
}
/** The round's trail down a square it crossed: a hot core and a fading glow. */
function trail(): Cv {
  const c = cv();
  for (let y = 0; y < S; y++)
    for (let x = 10; x < 22; x++) {
      const d = Math.abs(x + 0.5 - 16);
      put(c, x, y, d < 1.2 ? "Q" : d < 2.6 ? "O" : d < 4 ? "F" : (y + x) % 3 === 0 ? "S" : "s");
    }
  return c;
}
one("aim", dashed);
one("bolt", () => bolt(26));
one("trail", trail);
/** The queen lock's aim: one square of the dashed cyan line down her file (`on`, then the `aim` loop; `fade`). */
export const QUEEN_AIM = fx("chandy-queen-aim", "The queen lock's aim", {
  on: () => ({ loop: false, frames: [{ ms: 80, layers: [L("aim", 1)], cue: "aim" }] }),
  aim: () => ({
    loop: true,
    frames: [
      { ms: 400, layers: [L("aim", 1)] },
      { ms: 400, layers: [L("aim", 1)], pal: { O: "#e4ffff" } },
    ],
  }),
  fade: () => ({ loop: false, frames: [{ ms: 60, layers: [L("aim", 1)], pal: { O: "#129cc3" }, cue: "aimOff" }, EMPTY()] }),
});
/** The round flying down a square (`fly`, a flicker), and the trail it leaves (`trail`, fading to nothing). */
export const PIERCING_ROUND = fx("chandy-round", "The queen lock's piercing round", {
  fly: () => ({ loop: true, frames: [at("bolt", 60), at("bolt", 60, { pal: { O: "#e4ffff" } })] }),
  trail: () => ({
    loop: false,
    frames: [
      at("trail", 80, { cue: "whoosh" }),
      at("trail", 120, { pal: { Q: "#58e6ff", O: "#129cc3", F: "#0a5470" } }),
      at("trail", 80, { pal: { Q: "#129cc3", O: "#0a5470", F: "#0a547080" } }),
      EMPTY(),
    ],
  }),
});
const shards = (t: number): Speck[] => {
  const out: Speck[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.3;
    const r = 4 + t * 9 + (i % 3);
    const x = Math.round(16 + Math.cos(a) * r);
    const y = Math.round(17 + Math.sin(a) * r * 0.8 + t * t * 4);
    out.push([x, y, i % 3 === 0 ? "J" : i % 3 === 1 ? "G" : "O"], [x + 1, y, i % 2 ? "G" : "J"]);
  }
  return out.filter(([x, y]) => x >= 1 && y >= 1 && x <= S - 2 && y <= S - 2);
};
/** A piece the round hits shatters: a flash, its shards flying out and falling. */
export const SHATTER = fx("chandy-shatter", "A piece shattered by the piercing round", {
  shatter: () => ({
    loop: false,
    frames: [
      { ms: 60, layers: [], specks: burstSpecks(7), cue: "shatter" },
      { ms: 70, layers: [], specks: [...burstSpecks(3), ...shards(0.2)] },
      { ms: 90, layers: [], specks: shards(0.6) },
      { ms: 110, layers: [], specks: shards(1) },
      EMPTY(),
    ],
  }),
});

// ---- Dodge: no lines while the vote runs (Eric, Nov 16: you read his aim from where he stands); once it locks, each clone's line
// flashes three times, then the blast, a big pop the whole rank or file, edge to edge. In his clones' pink.

function beamLine(phase: number, pop: boolean): Cv {
  const c = cv();
  const r = pop ? 13 : 8;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.abs(y + 0.5 - 16);
      const wob = Math.sin((x + phase * 5) * 0.6) * 0.8;
      if (d > r + wob) continue;
      put(c, x, y, d < (pop ? 5 : 2.2) ? "Q" : d < (pop ? 9 : 4.6) + wob * 0.5 ? "O" : d < r - 1 ? "F" : "q");
    }
  return c;
}
one("blast0", () => beamLine(0, false));
one("blast1", () => beamLine(1, false));
one("pop", () => beamLine(0, true));
const lineAnims = (rot?: 1): Record<string, () => Anim> => ({
  /** The flash after the vote locks: the line blinks three times (dashed), then it's gone (the blast comes). */
  flash: () => ({
    loop: false,
    frames: [0, 1, 2].flatMap((i): Frame[] => [
      { ms: 110, layers: [L("aim", rot)], pal: CLONE_FX, ...(i === 0 ? { cue: "flash" } : {}) },
      EMPTY(90),
    ]),
  }),
  /** The blast: the pop (thick, white-hot), then the beam crackling, then gone. */
  blast: () => ({
    loop: false,
    frames: [
      { ms: 90, layers: [L("pop", rot)], pal: { ...CLONE_FX, O: "#ffe0e6" }, cue: "blast" },
      { ms: 70, layers: [L("pop", rot)], pal: CLONE_FX },
      ...[0, 1, 0, 1, 0].map((i): Frame => ({ ms: 70, layers: [L(`blast${i}`, rot)], pal: CLONE_FX })),
      { ms: 60, layers: [L("blast1", rot)], pal: { ...CLONE_FX, O: "#c4243f", Q: "#ff3f5e" } },
      EMPTY(),
    ],
  }),
});
/** One square of a Dodge line along a rank (`flash`, `blast`). */
export const DODGE_ROW = fx("chandy-dodge-row", "Dodge's line along a rank", lineAnims());
/** One square of a Dodge line along a file (the same, turned a quarter). */
export const DODGE_COL = fx("chandy-dodge-col", "Dodge's line along a file", lineAnims(1));

/** Every one of Chandy's board sprites (registered in effects.ts EFFECT_SPRITES; played as power-art.ts EFFECTS). */
export const CHANDY_FX = {
  CROSSHAIR,
  SCATTER_MARK,
  SCATTER_BURST,
  BEAM_TILE,
  SHIELD,
  DIZZY,
  QUEEN_AIM,
  PIERCING_ROUND,
  SHATTER,
  DODGE_ROW,
  DODGE_COL,
} as const;
