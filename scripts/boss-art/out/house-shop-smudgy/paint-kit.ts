/**
 * The paint kit for Smudgy's studio (house-shop-smudgy), its gallery owner (sidekick-smudgy-keeper), its life class's painters and its
 * intro props (house-intro-smudgy): one palette, moody and deep (Eric, Nov 6: "darker teal, blue, darker reds, purples … as opposed to
 * a very bright clownish feel"), with a few warm highlights, and the few ways paint is laid down here:
 * - `splat`: a round blot with a ragged edge and droplets flung round it;
 * - `drip`: a run of paint down a surface, a bead at its end;
 * - `skein`: a thin line of poured paint looping across a canvas (the layered, abstract drip-painting look, every canvas its own
 *   seed; no real artist's work is copied or named);
 * - `abstract`: a whole canvas: a dark ground, washes, skeins in three or four colors over each other, splats and drips.
 * Light from the top left, as everywhere in the game. Pixel art: every pixel one palette key, nothing smoothed. Drawn by hand in code
 * (Nov 6); its generic helpers (`cv`, `put`, `rect`, `ellipse`, `line`, `hash`, `crop`, `face`) are the paper kit's.
 */
import { crop, cv, ellipse, face, get, hash, inPoly, line, put, rect, type Cv, type Pt } from "../../../../packages/app/src/town/shops/paper-kit.ts";

export { crop, cv, ellipse, face, get, hash, inPoly, line, put, rect, type Cv, type Pt };

/** One palette for every piece of the studio. */
export const PAINT_PALETTE: Record<string, string> = {
  k: "#120f17", // outline
  // The floor: dark stained planks, a gap, dark, mid, lit.
  "1": "#1d1722",
  "2": "#2f2533",
  "3": "#3d3040",
  "4": "#4d3d4c",
  // Drop cloth and tarp: canvas cream-gray, lit, mid, a fold's shade, deep.
  "5": "#d8cfbd",
  "6": "#bdb39e",
  "7": "#958b77",
  "8": "#6e6556",
  // The walls: dark teal-gray plaster, deep, mid, lit.
  "9": "#1c272c",
  "0": "#283840",
  "!": "#35484f",
  // Paint, deep and light: teal, blue, oxblood, plum; the warm highlights (ochre, its light, burnt orange); a cool white.
  T: "#165a5a",
  t: "#2a8c86",
  B: "#1d3561",
  b: "#3a62a3",
  R: "#5e1a26",
  r: "#9c2f3d",
  P: "#41204f",
  p: "#74408a",
  Y: "#c98d2e",
  y: "#efcd7e",
  O: "#c0602f",
  w: "#e9e4d8",
  // Raw canvas (unpainted) and its shade; stretcher and easel wood: light, mid, dark.
  c: "#e6dcc6",
  C: "#c4b89e",
  W: "#9a6d45",
  V: "#6f4b2e",
  v: "#45301e",
  // White cloth: lit, mid, fold, deep fold.
  h: "#f3f0e9",
  H: "#dcd7cc",
  i: "#bbb4a6",
  I: "#958e80",
  // Metal (pots, ferrules, the counter's fittings): light, mid, dark.
  n: "#b3bac4",
  m: "#7e8691",
  M: "#4c525d",
  // Brass: gold, deep, a glint.
  G: "#c99a45",
  g: "#86612a",
  L: "#ffe3a3",
  // Glass (the brush jars' water, murky): light, mid.
  q: "#7f9fa0",
  Q: "#4f6e72",
  // Shadows on the floor (see-through): core, rim.
  "-": "#05030866",
  "+": "#05030833",
};

/** The paint colors, deep and light, in pairs: teal, blue, oxblood, plum, ochre, orange. */
export const PAINTS: readonly (readonly [string, string])[] = [
  ["T", "t"],
  ["B", "b"],
  ["R", "r"],
  ["P", "p"],
  ["Y", "y"],
  ["O", "y"],
];

/** A blot of paint: round with a ragged edge (`r` its radius), its lit side `lit`, droplets flung round it. Stays inside `only`. */
export function splat(c: Cv, cx: number, cy: number, r: number, deep: string, lit: string, seed: number, only?: (x: number, y: number) => boolean) {
  const ok = (x: number, y: number) => !only || only(x, y);
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++)
    for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      const a = Math.atan2(y - cy, x - cx);
      const edge = r * (0.75 + 0.35 * hash(Math.round((a + Math.PI) * 3), 0, seed));
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= edge && ok(x, y)) put(c, x, y, d < edge * 0.5 && x < cx && y < cy ? lit : deep);
    }
  // Droplets.
  const n = 3 + Math.floor(hash(seed, 1, 7) * 4);
  for (let i = 0; i < n; i++) {
    const a = hash(seed, i, 11) * Math.PI * 2;
    const d = r * (1.3 + hash(seed, i, 13) * 1.2);
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d);
    if (ok(x, y)) put(c, x, y, deep);
    if (hash(seed, i, 17) < 0.4 && ok(x + 1, y)) put(c, x + 1, y, deep);
  }
}

/** A run of paint down from (x, y0), `len` long, a bead at its end; stays inside `only`. */
export function drip(c: Cv, x: number, y0: number, len: number, k: string, only?: (x: number, y: number) => boolean) {
  for (let y = y0; y < y0 + len; y++) if (!only || only(x, y)) put(c, x, y, k);
  const yb = y0 + len;
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0]] as const) if (!only || only(x + dx, yb + dy)) put(c, x + dx, yb + dy, k);
}

/**
 * A skein of poured paint: a thin line wandering across the box (x0, y0)-(x1, y1), looping now and then, `steps` long, from a
 * seeded start; stays inside `only`.
 */
export function skein(c: Cv, x0: number, y0: number, x1: number, y1: number, k: string, seed: number, steps = 120, only?: (x: number, y: number) => boolean) {
  let x = x0 + hash(seed, 0, 3) * (x1 - x0);
  let y = y0 + hash(seed, 0, 5) * (y1 - y0);
  let a = hash(seed, 0, 7) * Math.PI * 2;
  for (let i = 0; i < steps; i++) {
    a += (hash(seed, i, 9) - 0.5) * 1.1 + (hash(seed, i >> 4, 19) - 0.5) * 0.5;
    x += Math.cos(a) * 1.2;
    y += Math.sin(a) * 1.2;
    if (x < x0 || x > x1) a = Math.PI - a;
    if (y < y0 || y > y1) a = -a;
    x = Math.max(x0, Math.min(x1, x));
    y = Math.max(y0, Math.min(y1, y));
    if (!only || only(Math.round(x), Math.round(y))) put(c, x, y, k);
  }
}

/**
 * A whole abstract canvas in the box (x, y, w, h): a dark ground (`ground`), a wash or two, skeins of three or four of the paints
 * over each other (a layer at a time), a few splats and drips; seeded, so every canvas is its own.
 */
export function abstract(c: Cv, x: number, y: number, w: number, h: number, seed: number, ground = "B") {
  const inside = (xx: number, yy: number) => xx >= x && xx < x + w && yy >= y && yy < y + h;
  rect(c, x, y, w, h, ground);
  // Washes: a big soft patch or two of another deep color.
  for (let i = 0; i < 2; i++) {
    const [deep] = PAINTS[Math.floor(hash(seed, i, 23) * 4)]!;
    const cx = x + hash(seed, i, 29) * w;
    const cy = y + hash(seed, i, 31) * h;
    const rr = Math.max(w, h) * (0.25 + 0.2 * hash(seed, i, 37));
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (Math.hypot(xx - cx, (yy - cy) * 1.3) < rr && (xx + yy) % 2 === 0) put(c, xx, yy, deep);
  }
  // Skeins, layered: deep first, then light, then a warm highlight on top.
  const steps = Math.round((w * h) / 9);
  const order = [0, 1, 2, 3].map((i) => PAINTS[Math.floor(hash(seed, i, 41) * PAINTS.length)]!);
  order.forEach(([deep, lit], i) => {
    skein(c, x, y, x + w - 1, y + h - 1, deep, seed * 7 + i, steps, inside);
    if (i % 2) skein(c, x, y, x + w - 1, y + h - 1, lit, seed * 11 + i, Math.round(steps * 0.6), inside);
  });
  skein(c, x, y, x + w - 1, y + h - 1, hash(seed, 3, 43) < 0.5 ? "y" : "w", seed * 13, Math.round(steps * 0.35), inside);
  // Splats and drips.
  const n = 1 + Math.floor((w * h) / 400);
  for (let i = 0; i < n; i++) {
    const [deep, lit] = PAINTS[Math.floor(hash(seed, i, 47) * PAINTS.length)]!;
    splat(c, x + 2 + hash(seed, i, 53) * (w - 4), y + 2 + hash(seed, i, 59) * (h - 6), 1.5 + hash(seed, i, 61) * 2.5, deep, lit, seed + i, inside);
  }
  for (let i = 0; i < n + 1; i++) {
    const [deep] = PAINTS[Math.floor(hash(seed, i, 67) * PAINTS.length)]!;
    drip(c, Math.round(x + 1 + hash(seed, i, 71) * (w - 3)), Math.round(y + hash(seed, i, 73) * h * 0.6), Math.round(3 + hash(seed, i, 79) * h * 0.3), deep, inside);
  }
}

/** A soft see-through shadow on the floor: an ellipse of `-` with a `+` rim. */
export function shadow(c: Cv, cx: number, cy: number, rx: number, ry: number) {
  ellipse(c, cx, cy, rx + 1, ry + 1, (x, y) => (get(c, x, y) === "." ? "+" : null));
  ellipse(c, cx, cy, rx, ry, (x, y) => (get(c, x, y) === "." || get(c, x, y) === "+" ? "-" : null));
}

/** A picture frame (stretcher seen edge on: a wood rim) round the box. */
export function frame(c: Cv, x: number, y: number, w: number, h: number) {
  rect(c, x - 1, y - 1, w + 2, 1, "W");
  rect(c, x - 1, y - 1, 1, h + 2, "W");
  rect(c, x + w, y - 1, 1, h + 2, "V");
  rect(c, x - 1, y + h, w + 2, 1, "v");
}

/** A polygon filled in one key (the paper kit's `face`, unlit). */
export const poly = (c: Cv, pts: readonly Pt[], k: string) => face(c, pts, k);
