/**
 * The Stranger's board art (docs/decisions/2026-11-27-stranger-art.md): his twin-tip cast landing on a square, fire and ice at once.
 * One square is SQUARE (32) art px, as every boss's board art. Drawn, not wired: his rules job puts it in power-art.ts EFFECTS (a
 * start, a loop, an end that ends on an empty frame) and plays it on the shared board-effects canvas.
 *
 * - `strike`: two bolts spiral in from the square's corners, ember and ice, meet at its middle in a flash, and an ice block grows
 *   over the piece (a cue `freeze`); it ends on `frozen`'s first frame.
 * - `frozen` (loop): the block, see-through so the piece shows, its edges pale, a glint running across it.
 * - `ignite`: the block cracks and bursts into flame (a cue `burn`); it ends on `burn`'s first frame.
 * - `burn` (loop): the tile burning, flames licking up its edges and corners (the middle left clear so the piece reads), embers.
 * - `burnOut`: the flames sink to embers and go; it ends empty.
 * His colors: the fire sword's reds to white-hot, the ice sword's blues to white (stranger.ts STRANGER_PALETTE's p P q Q y, s S v V W).
 */
import type { Anim, Character, Frame, Speck } from "../sprite.ts";
import { lazyAnim, lazyParts } from "../sprite.ts";
import { SQUARE } from "./common.ts";

export const STRANGER_FX_PALETTE: Record<string, string> = {
  k: "#0e1426", // outline
  p: "#5e1208", // fire: dark rim to white-hot
  P: "#bf3216",
  q: "#ff7a2a",
  Q: "#ffc45a",
  y: "#fff3b8",
  s: "#18426b", // ice: deep to white
  S: "#3a8cc4",
  v: "#7fd6ff",
  V: "#cdf5ff",
  W: "#ffffff",
  i: "#4aa8f070", // the ice block's body, see-through, and its lit face
  I: "#9adcff90",
  e: "#e6fbffdd", // its edges
  c: "#1c4f7acc", // a crack
  g: "#ff7a2a30", // the burning tile's glow (see-through)
  G: "#ffb03a55",
};

const S = SQUARE;
type Cv = string[][];
const cv = (): Cv => Array.from({ length: S }, () => Array<string>(S).fill("."));
const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < S && x >= 0 && x < S) c[y]![x] = k;
};
const grid = (c: Cv) => c.map((r) => r.join(""));
const { parts, add } = lazyParts();
const layer = (name: string, make: () => Cv, outline = false) => ({ part: add(name, () => ({ grid: grid(make()), outline })), x: 0, y: 0 });

/** The ice block over a piece: a rounded box `grow` (0..1) of its full size from the bottom, see-through, its edges pale; cracked by `crack` (0..3). */
function block(grow: number, glint: number, crack = 0): Cv {
  const c = cv();
  const top = Math.round(29 - 24 * grow);
  for (let y = top; y <= 29; y++)
    for (let x = 4; x <= 27; x++) {
      const corner = (x === 4 || x === 27) && (y === top || y === 29);
      if (corner) continue;
      const edge = x === 4 || x === 27 || y === top || y === 29;
      // (The lit face: a band from the top left.)
      const lit = x - 4 + (y - top) < 9;
      put(c, x, y, edge ? "e" : lit ? "I" : "i");
    }
  // A glint running across its face.
  if (grow >= 1 && glint >= 0) for (let d = 0; d < 4; d++) put(c, 6 + glint * 4 + d, top + 2 + d * 2, "W");
  // Cracks spreading from its middle.
  const lines: readonly (readonly [number, number])[][] = [
    [[16, 17], [12, 12], [9, 9]],
    [[16, 17], [21, 13], [24, 8]],
    [[16, 17], [13, 23], [8, 27]],
    [[16, 17], [20, 22], [25, 27]],
  ];
  for (let n = 0; n < crack; n++)
    for (const [a, b] of [
      [lines[n]![0]!, lines[n]![1]!],
      [lines[n]![1]!, lines[n]![2]!],
    ] as const) {
      const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      for (let t = 0; t <= steps; t++) put(c, a[0] + ((b[0] - a[0]) * t) / steps, a[1] + ((b[1] - a[1]) * t) / steps, "c");
    }
  return c;
}

/** A flame tongue at `x`, its base at `base`, `h` tall, leaning `lean`. */
function tongue(c: Cv, x: number, base: number, h: number, lean: number, seed: number): void {
  for (let y = 0; y < h; y++) {
    const v = y / h; // 0 at the base, 1 at the tip
    const half = Math.max(0.5, 3.2 * (1 - v) * (v < 0.25 ? 0.7 + v * 1.2 : 1));
    const cx = x + lean * v * v + Math.sin(seed * 1.7 + v * 5) * 0.6 * v;
    for (let dx = -4; dx <= 4; dx++) {
      const d = Math.abs(dx - (cx - x));
      if (d > half) continue;
      const heat = (1 - d / half) * 0.6 + (1 - v) * 0.5;
      put(c, x + dx, base - y, heat > 0.95 ? "y" : heat > 0.75 ? "Q" : heat > 0.5 ? "q" : heat > 0.3 ? "P" : "p");
    }
  }
}

/** The burning tile at step `i` (0..3) and strength `s` (0..1): a glow over it, flames up its sides and corners, embers rising. */
function fire(i: number, s: number): Cv {
  const c = cv();
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) put(c, x, y, (x + y + i) % 9 === 0 ? "G" : "g");
  const spots: readonly (readonly [number, number])[] = [
    [5, 1.0],
    [11, 0.6],
    [16, 0.45],
    [21, 0.6],
    [27, 1.0],
  ];
  spots.forEach(([x, k], n) => {
    // (The middle tongues lower, so the piece reads through them.)
    const h = Math.round((7 + 6 * k + ((n + i) % 3) * 2) * s);
    if (h > 1) tongue(c, x, 30, h, n < 3 ? -1 : 1, n + i);
  });
  // The side flames, up the left and right edges.
  for (const x of [2, 29]) {
    const h = Math.round((10 + ((i + x) % 3) * 3) * s);
    if (h > 1) tongue(c, x, 30, h, x < 16 ? 1 : -1, i + x);
  }
  // Embers.
  for (let n = 0; n < 4; n++) put(c, 5 + ((n * 7 + i * 5) % 22), 18 - ((i * 4 + n * 5) % 14) * s, n % 2 ? "Q" : "y");
  return c;
}

/** The bolts spiraling in from opposite corners, at step `t` (0..1): fire from the top left, ice from the top right. */
function boltSpecks(t: number): Speck[] {
  const out: Speck[] = [];
  for (const [kind, a0, dir] of [
    ["fire", (-3 * Math.PI) / 4, -1],
    ["ice", -Math.PI / 4, 1],
  ] as const) {
    for (let j = 0; j < 7; j++) {
      const u = Math.max(0, t - j * 0.05);
      const a = a0 + (1 - u) * 1.3 * dir;
      const r = (1 - u) * 15;
      const x = Math.round(16 + Math.cos(a) * r);
      const y = Math.round(16 + Math.sin(a) * r);
      const k = kind === "fire" ? (j === 0 ? "y" : j < 3 ? "q" : "P") : j === 0 ? "W" : j < 3 ? "v" : "S";
      out.push([x, y, k]);
      if (j < 4) out.push([x + 1, y, k], [x, y + 1, k]);
    }
  }
  return out.filter(([x, y]) => x >= 0 && y >= 0 && x < S && y < S);
}

/** A flash at the middle: a star of `r` px, ember on one half and ice on the other. */
function flash(r: number): Speck[] {
  const out: Speck[] = [];
  for (let d = -r; d <= r; d++) {
    out.push([16 + d, 16, Math.abs(d) < 2 ? "W" : d < 0 ? "Q" : "V"]);
    out.push([16, 16 + d, Math.abs(d) < 2 ? "W" : d < 0 ? "Q" : "V"]);
  }
  for (let d = 1; d <= r - 2; d++)
    out.push([16 - d, 16 - d, "q"], [16 + d, 16 - d, "v"], [16 - d, 16 + d, "q"], [16 + d, 16 + d, "v"]);
  return out;
}

const F = (ms: number, layers: Frame["layers"], o: Partial<Frame> = {}): Frame => ({ ms, layers, ...o });
const glints = [-1, 0, 1, 2, 3, 4, -1, -1];

const anims: Record<string, Anim> = {
  strike: lazyAnim(() => ({
    loop: false,
    frames: [
      F(70, [], { specks: boltSpecks(0.15) }),
      F(70, [], { specks: boltSpecks(0.45) }),
      F(70, [], { specks: boltSpecks(0.8) }),
      F(60, [], { specks: flash(5), cue: "freeze" }),
      F(60, [layer("blk:0.3", () => block(0.3, -1))], { specks: flash(8) }),
      F(70, [layer("blk:0.7", () => block(0.7, -1))], { specks: flash(4) }),
      F(70, [layer("blk:1:-1", () => block(1, -1))]),
    ],
  })),
  frozen: lazyAnim(() => ({ loop: true, frames: glints.map((g) => F(g < 0 ? 300 : 70, [layer(`blk:1:${g}`, () => block(1, g))])) })),
  ignite: lazyAnim(() => ({
    loop: false,
    frames: [
      F(90, [layer("blk:c1", () => block(1, -1, 1))], { shake: [1, 0] }),
      F(90, [layer("blk:c2", () => block(1, -1, 2))], { shake: [-1, 0] }),
      F(90, [layer("blk:c4", () => block(1, -1, 4))], { shake: [1, 0] }),
      F(70, [layer("fire:0:0.5", () => fire(0, 0.5))], { specks: flash(9), cue: "burn" }),
      F(80, [layer("fire:1:0.8", () => fire(1, 0.8))]),
      F(80, [layer("fire:0:1", () => fire(0, 1))]),
    ],
  })),
  burn: lazyAnim(() => ({ loop: true, frames: [0, 1, 2, 3].map((i) => F(110, [layer(`fire:${i}:1`, () => fire(i, 1))])) })),
  burnOut: lazyAnim(() => ({
    loop: false,
    frames: [
      F(100, [layer("fire:1:0.6", () => fire(1, 0.6))]),
      F(100, [layer("fire:2:0.3", () => fire(2, 0.3))]),
      F(100, [], { specks: [[9, 26, "q"], [20, 24, "Q"], [15, 28, "P"]] }),
      F(60, []),
    ],
  })),
};

/** His square's fire and ice: one square (SQUARE px), its animations above. */
export const STRANGER_SQUARE: Character = {
  id: "stranger-square",
  name: "The Stranger's fire and ice",
  w: S,
  h: S,
  foot: [16, 31],
  palette: STRANGER_FX_PALETTE,
  parts,
  anims,
};

/** The board art's cues and their sounds (sound.ts names). */
export const STRANGER_FX_SOUNDS = { freeze: "strangerFreeze", burn: "strangerBurn" } as const;
