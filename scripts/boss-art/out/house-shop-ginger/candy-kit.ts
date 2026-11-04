/**
 * Ginger's candy-shop kit (Nov 5, drawn by hand on the weekly plan usage): the colors and the candy things shared by his igloo
 * shop (house-shop-ginger.ts), his elves' props (npc-ginger-elf/) and his intro's props (house-intro-ginger/). Copy it next to
 * them in the game (town/shops/), as warehouse-kit.ts was; its canvas helpers are warehouse-kit's (already in the game).
 *
 * - The colors (CANDY_PALETTE): packed snow, glossy ice, ice blocks, wood, the candies' bright inks, clear plastic, steel.
 * - The candy: a fill of little candies in a mix of inks (jelly beans, gumballs, peppermints, sours...), a gravity-bin dispenser
 *   (a clear angled bin, a striped lid, a handle and a chute, after Eric's photo of a candy-store wall), a tall clear tube of
 *   candy with a spout, a big candy cane (white and one color), a wooden barrel (loose candy, or stuffed with canes), a sack.
 * - Ginger's Boss Crate: a present-like crate wrapped in candy stripes, a green bow on top.
 * No real brands: the dispensers are generic, their labels stripes.
 */
import { cropBit, hash, put, rect, type Bit, type Cv } from "../house-shop-grex/warehouse-kit.ts";

export { bits, cropBit, cv, get, hash, put, rect, stamp, text, textC, textWidth, whole, type Bit, type Cv, type Key, type Pt } from "../house-shop-grex/warehouse-kit.ts";

export const CANDY_PALETTE: Record<string, string> = {
  k: "#16202e", // outline: a cool near-black
  // Packed snow (the floor): seam, shade, base, light, bright.
  "1": "#a9bdd6",
  "2": "#c3d3e6",
  "3": "#d6e2ef",
  "4": "#e6eef7",
  "5": "#f7fbff",
  // Glossy ice (the battle spot, the ice table): deep, mid, light, shine, its cracks (dark, mid).
  "6": "#8cc6ea",
  "7": "#b2dcf5",
  "8": "#d6eefb",
  "9": "#f4fcff",
  "0": "#3f7fb8",
  "/": "#5f9fd2",
  // Ice blocks (the dome): mortar, deep, shade, mid, light, lit.
  a: "#5b7fa8",
  A: "#45678f",
  b: "#86a9cf",
  B: "#a7c5e4",
  c: "#c7dcf0",
  C: "#e4f0fb",
  // Frost and icicles: white, pale blue.
  "*": "#ffffff",
  "~": "#dff4ff",
  // Wood (the catwalk, the stairs, the stand, barrels): deepest, dark, mid, light, lit.
  V: "#3a1f0c",
  w: "#5e3618",
  u: "#8c5428",
  U: "#b3773b",
  v: "#d49d5e",
  // The candies' inks (mid, dark): red, white, green, yellow, orange, purple, pink, blue, mint, brown (chocolate).
  r: "#e8303a",
  R: "#a01d2a",
  x: "#fbfaf6",
  X: "#d6d1cf",
  g: "#3fb050",
  G: "#227238",
  y: "#ffd83a",
  Y: "#d89a10",
  o: "#ff8c1e",
  O: "#c55f0c",
  p: "#9a55dd",
  P: "#5c2c98",
  h: "#ff74b8",
  H: "#c43b84",
  t: "#33a4e6",
  T: "#1c5f9e",
  l: "#8ff0d0",
  L: "#3eb592",
  n: "#8a4e2a",
  N: "#5a2e14",
  // Clear plastic and glass: its edge, a pale glare, the dark of an empty bin.
  q: "#e9f7ff",
  Q: "#93aec4",
  e: "#5b6f82",
  // Steel (handles, chutes, spouts): dark, mid, light, bright.
  m: "#46505e",
  M: "#77828f",
  i: "#aeb7c3",
  I: "#e2e7ee",
  // Gold (bulbs, a bell, the crate's ribbon edge), burlap (sacks): mid, dark.
  z: "#ffe27a",
  Z: "#e0a91c",
  s: "#c9a46c",
  S: "#957240",
  // Warm bulbs: the bulb, its glow.
  F: "#fff6d6",
  f: "#ffd27a",
  // The night outside the door: deep, mid; the glow of the stockroom inside.
  E: "#141c3c",
  j: "#2b3c70",
  J: "#7a4a1e",
  // Ground shadows (see-through): core, rim.
  "-": "#0b162a66",
  "+": "#0b162a33",
};

// ---- Candy: a fill of little candies.

/** A mix of candies: each a list of ink pairs [mid, dark] (one candy picks one), and its shape (`bean` 3 x 2, `ball` 2 x 2 round, `drop` 2 x 2). */
export interface Mix {
  inks: readonly (readonly [string, string])[];
  shape: "bean" | "ball" | "drop" | "swirl" | "stick";
}
export const MIXES: Readonly<Record<string, Mix>> = {
  jelly: { inks: [["r", "R"], ["y", "Y"], ["g", "G"], ["o", "O"], ["p", "P"], ["h", "H"], ["x", "X"], ["t", "T"]], shape: "bean" },
  gumRed: { inks: [["r", "R"]], shape: "ball" },
  gumBlue: { inks: [["t", "T"]], shape: "ball" },
  gumYellow: { inks: [["y", "Y"]], shape: "ball" },
  gumPink: { inks: [["h", "H"]], shape: "ball" },
  gumMix: { inks: [["r", "R"], ["y", "Y"], ["t", "T"], ["g", "G"], ["h", "H"], ["x", "X"]], shape: "ball" },
  mint: { inks: [["x", "r"]], shape: "swirl" },
  spearmint: { inks: [["x", "g"]], shape: "swirl" },
  sour: { inks: [["g", "G"], ["l", "L"], ["y", "Y"]], shape: "drop" },
  lemon: { inks: [["y", "Y"]], shape: "drop" },
  orange: { inks: [["o", "O"]], shape: "drop" },
  grape: { inks: [["p", "P"]], shape: "drop" },
  choc: { inks: [["n", "N"], ["x", "X"]], shape: "bean" },
  sprinkle: { inks: [["r", "R"], ["y", "Y"], ["t", "T"], ["g", "G"], ["h", "H"], ["p", "P"], ["o", "O"], ["x", "X"]], shape: "stick" },
  pinkWhite: { inks: [["h", "H"], ["x", "X"]], shape: "bean" },
  blueWhite: { inks: [["t", "T"], ["x", "X"]], shape: "ball" },
  redWhite: { inks: [["r", "R"], ["x", "X"]], shape: "bean" },
};

/** The candy's key at (x, y) of a fill (seed: which candies where). Little candies packed in staggered rows, each lit at its top left. */
export function candyAt(x: number, y: number, mix: Mix, seed: number): string {
  const sh = mix.shape;
  const cw = sh === "bean" ? 3 : sh === "stick" ? 3 : sh === "swirl" ? 3 : 2;
  const ch = sh === "swirl" ? 3 : 2;
  const row = Math.floor(y / ch);
  const ox = (row % 2) * Math.floor(cw / 2);
  const col = Math.floor((x + ox) / cw);
  const lx = (x + ox) - col * cw;
  const ly = y - row * ch;
  const pick = mix.inks[Math.floor(hash(col, row, seed) * mix.inks.length)]!;
  const [mid, dark] = pick;
  if (sh === "swirl") {
    // A peppermint: white with a red pinwheel.
    if (lx === 1 && ly === 1) return mid;
    return (lx + ly + row) % 2 ? dark : mid;
  }
  if (sh === "stick") {
    // Sprinkles: little bars, every other one turned.
    if (hash(col, row, seed + 5) < 0.25) return hash(col + 1, row, seed + 9) < 0.5 ? "x" : "X";
    return ly === 1 && lx < 2 ? dark : mid;
  }
  if (sh === "ball" || sh === "drop") {
    if (lx === 0 && ly === 0) return sh === "ball" ? "x" : mid;
    return lx === cw - 1 && ly === ch - 1 ? dark : mid;
  }
  // A bean: its lower edge dark, a white glint now and then.
  if (lx === cw - 1) return dark;
  if (ly === 0 && lx === 0 && hash(col, row, seed + 2) < 0.4) return "x";
  return ly === ch - 1 && lx === 1 ? dark : mid;
}

// ---- A big candy cane, from its foot (x0, y0) up a line to (x1, y1), its hook curling `curl` (1: toward +x), white striped with `ink`.

/** Paints a candy cane: a shaft `r` px thick (radius), diagonal stripes of `ink` [mid, dark] every 4 px, a hook of radius `hook` at the top. */
export function caneOn(c: Cv, x0: number, y0: number, x1: number, y1: number, ink: readonly [string, string], r = 1.4, hook = 4, curl: 1 | -1 = 1): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  const nx = -uy;
  const ny = ux;
  // The hook's middle: past the top, to the curl's side.
  const hcx = x1 + nx * hook * curl;
  const hcy = y1 + ny * hook * curl;
  const pts: { x: number; y: number; s: number; side: number }[] = [];
  for (let s = 0; s <= len; s += 0.25) pts.push({ x: x0 + ux * s, y: y0 + uy * s, s, side: 0 });
  // The hook: half a turn round its middle, from the shaft's top.
  const a0 = Math.atan2(y1 - hcy, x1 - hcx);
  for (let t = 0; t <= Math.PI * 1.05; t += 0.05) {
    const a = a0 + t * curl;
    pts.push({ x: hcx + Math.cos(a) * hook, y: hcy + Math.sin(a) * hook, s: len + t * hook, side: 0 });
  }
  const X0 = Math.floor(Math.min(...pts.map((p) => p.x)) - r - 1);
  const X1 = Math.ceil(Math.max(...pts.map((p) => p.x)) + r + 1);
  const Y0 = Math.floor(Math.min(...pts.map((p) => p.y)) - r - 1);
  const Y1 = Math.ceil(Math.max(...pts.map((p) => p.y)) + r + 1);
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      let best = Infinity;
      let bs = 0;
      let bdx = 0;
      let bdy = 0;
      for (const p of pts) {
        const d = (x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2;
        if (d < best) ((best = d), (bs = p.s), (bdx = x + 0.5 - p.x), (bdy = y + 0.5 - p.y));
      }
      if (best > r * r) continue;
      const stripe = Math.floor((bs + (bdx - bdy) * 0.6) / 2.2) % 2 === 0;
      const shadeSide = bdx + bdy > 0.4; // lit from the top left
      put(c, x, y, stripe ? (shadeSide ? ink[1] : ink[0]) : shadeSide ? "X" : "x");
    }
}

// ---- A gravity-bin dispenser (Eric's photo, lower row): a clear bin tipped toward us, a striped lid, candy inside, a handle on its
//      right, a steel chute under it. Top left (x, y), `w` wide, `h` tall (bin and lid; the chute hangs under it, 4 px).

export const BIN_CHUTE_H = 4;
export function gravityBin(c: Cv, x: number, y: number, w: number, h: number, mix: Mix, seed: number, lidInk = "r", empty = 0): void {
  const lid = 3;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const X = x + i;
      const Y = y + j;
      // The bin's front leans back toward its top: its left and right edges come in a px over the top third.
      const inset = j < h / 3 ? 1 : 0;
      if (i < inset || i >= w - inset) continue;
      if (j < lid) {
        // The lid: a clear rim and a striped label (lidInk and white diagonals), its front lit.
        if (j === 0) put(c, X, Y, "Q");
        else put(c, X, Y, Math.floor((i + j) / 2) % 2 ? "x" : lidInk);
        continue;
      }
      const edge = i === inset || i === w - 1 - inset || j === h - 1;
      if (edge) {
        put(c, X, Y, j === h - 1 ? "Q" : i === inset ? "q" : "Q");
        continue;
      }
      // Inside: candy up to its fill line (empty: the top rows are clear), a glare down its left.
      if (j < lid + 1 + empty) {
        put(c, X, Y, "e");
        continue;
      }
      const glare = i === inset + 2 && j > lid + 1 && j < h - 3;
      put(c, X, Y, glare ? "q" : candyAt(i, j, mix, seed));
    }
  // The chute: a steel spout under the middle, and the handle (a lever on the right side, pointing down-right).
  const cx = x + Math.floor(w / 2);
  rect(c, cx - 2, y + h, 5, 2, (i) => (i === 0 ? "i" : i === 4 ? "m" : "M"));
  rect(c, cx - 1, y + h + 2, 3, BIN_CHUTE_H - 2, (i) => (i === 0 ? "i" : "m"));
  put(c, x + w - 2, y + h - 5, "m");
  put(c, x + w - 1, y + h - 5, "M");
  put(c, x + w - 1, y + h - 4, "i");
  put(c, x + w, y + h - 4, "I");
}

// ---- A tall clear tube of candy (Eric's photo, upper row): its top-left (x, y), `w` wide, `h` tall; a steel cap; a spout with a
//      little lever at its foot (3 px, below y + h).

export const TUBE_SPOUT_H = 4;
export function candyTube(c: Cv, x: number, y: number, w: number, h: number, mix: Mix, seed: number): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const X = x + i;
      const Y = y + j;
      if (j < 2) {
        put(c, X, Y, j === 0 ? "i" : i === 0 ? "I" : i === w - 1 ? "m" : "M"); // the cap
        continue;
      }
      if (i === 0) put(c, X, Y, "q");
      else if (i === w - 1) put(c, X, Y, "Q");
      else if (i === 1 && j % 7 < 5) put(c, X, Y, "q"); // the glass's glare
      else if (i === w - 2 && j % 9 === 4) put(c, X, Y, "q");
      else put(c, X, Y, candyAt(i + x, j, mix, seed));
    }
  // The foot ring and the spout.
  rect(c, x, y + h, w, 1, (i) => (i === 0 ? "I" : "M"));
  const cx = x + Math.floor(w / 2);
  rect(c, cx - 1, y + h + 1, 3, TUBE_SPOUT_H - 1, (i, j) => (i === 0 ? "i" : j === TUBE_SPOUT_H - 2 ? "m" : "M"));
  put(c, cx + 2, y + h + 1, "m"); // the lever
  put(c, cx + 3, y + h + 1, "i");
}

// ---- A wooden barrel: its foot's middle (fx, fy), `w` wide, `h` tall; open at the top, showing what's in it.

export function barrel(c: Cv, fx: number, fy: number, w: number, h: number, seed: number): void {
  const x0 = fx - Math.floor(w / 2);
  const y0 = fy - h + 1;
  for (let j = 0; j < h; j++) {
    // Bulging a px at its middle.
    const t = j / (h - 1);
    const bulge = Math.round(Math.sin(t * Math.PI) * 1.4);
    for (let i = -bulge; i < w + bulge; i++) {
      const X = x0 + i;
      const Y = y0 + j;
      const u = (i + bulge) / (w + 2 * bulge - 1); // 0 left to 1 right
      const hoop = j === 2 || j === 3 || j === h - 4 || j === h - 3 || j === Math.floor(h / 2);
      if (hoop) {
        put(c, X, Y, u < 0.25 ? "i" : u < 0.75 ? "M" : "m");
        continue;
      }
      const stave = Math.floor(u * 5 + 0.2);
      const seam = Math.abs(u * 5 + 0.2 - Math.round(u * 5 + 0.2)) < 0.09;
      const base = u < 0.22 ? "v" : u < 0.55 ? "U" : u < 0.85 ? "u" : "w";
      put(c, X, Y, seam ? "w" : hash(stave, j >> 2, seed) < 0.12 ? "u" : base);
    }
  }
  // The rim, seen from a little above: a dark inside ellipse.
  for (let i = 0; i < w; i++) {
    put(c, x0 + i, y0 - 1, i === 0 || i === w - 1 ? "w" : "V");
    put(c, x0 + i, y0, "u");
  }
}
/** Loose candy heaped in a barrel's top (its rim at y0, `w` wide from x0): a mound a few px over the rim. */
export function heap(c: Cv, x0: number, y0: number, w: number, mix: Mix, seed: number, high = 4): void {
  for (let i = 1; i < w - 1; i++) {
    const t = (i - w / 2) / (w / 2);
    const top = Math.round(high * (1 - t * t));
    for (let j = -top; j <= 1; j++) put(c, x0 + i, y0 + j, candyAt(i, j + 10, mix, seed));
  }
}

/** A burlap sack of candy, its neck tied, a few candies spilled at its foot: foot (fx, fy), `w` wide, `h` tall. */
export function sack(c: Cv, fx: number, fy: number, w: number, h: number, mix: Mix, seed: number): void {
  const cx = fx;
  for (let y = fy - h + 1; y <= fy; y++) {
    const t = (fy - y) / h; // 0 foot to 1 top
    const half = t > 0.82 ? 2 + (t - 0.82) * 14 : (w / 2) * Math.sin(Math.min(1, (1 - t) * 1.25 + 0.15) * Math.PI * 0.62);
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const u = (x - (cx - half)) / (2 * half + 0.01);
      const tie = t > 0.74 && t < 0.82;
      put(c, x, y, tie ? "r" : hash(x, y, seed) < 0.1 ? "S" : u < 0.3 ? "s" : u > 0.75 ? "S" : hash(x >> 1, y >> 1, seed + 1) < 0.25 ? "S" : "s");
    }
  }
  // Candy peeking out of the open top, and two spilled.
  for (let i = -2; i <= 2; i++) put(c, cx + i, fy - h, candyAt(i + 4, 1, mix, seed));
  put(c, cx + Math.round(w / 2) + 1, fy, mix.inks[0]![0]);
  put(c, cx + Math.round(w / 2) + 3, fy - 1, mix.inks[Math.min(1, mix.inks.length - 1)]![0]);
}

// ---- Ginger's Boss Crate: a present-like wooden crate wrapped in candy stripes (red and white), a green ribbon both ways and a
//      green bow on top, a gold tag. Foot (fx, fy), `w` wide, `h` tall (the box), the bow over it.

export function bossCrate(c: Cv, fx: number, fy: number, w: number, h: number, glint = -1): void {
  const x0 = fx - Math.floor(w / 2);
  const y0 = fy - h + 1;
  const lid = 4;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const X = x0 + i;
      const Y = y0 + j;
      const side = i >= w - 4; // its right side, in shade
      const ribbonV = Math.abs(i - Math.floor((w - 4) / 2)) <= 1;
      const ribbonH = j >= Math.floor(h / 2) && j <= Math.floor(h / 2) + 2;
      if (j < lid) {
        // The lid's top (seen from a little above) and its lip.
        const k = j === lid - 1 ? "R" : ribbonV ? (j === 0 ? "j" : "g") : Math.floor((i + j * 2) / 3) % 2 ? "x" : "r";
        put(c, X, Y, side ? (k === "x" ? "X" : k === "r" ? "R" : "G") : k);
        continue;
      }
      if (ribbonV || ribbonH) {
        put(c, X, Y, side ? "G" : ribbonV && i === Math.floor((w - 4) / 2) - 1 ? "j" : "g");
        continue;
      }
      // Candy stripes, diagonal; a plank seam every 6 rows (it's a crate under the wrap).
      const stripe = Math.floor((i - j) / 3) % 2 === 0;
      const k = stripe ? "r" : "x";
      put(c, X, Y, side ? (stripe ? "R" : "X") : (j - lid) % 6 === 5 && hash(i, j, 3) < 0.6 ? (stripe ? "R" : "X") : k);
    }
  // The bow: two loops and two tails, green, on the lid's middle.
  const bx = x0 + Math.floor((w - 4) / 2);
  const by = y0 - 1;
  const BOW = [
    ".ggg...ggg.",
    "gjjgg.ggjjg",
    "gjggGgGggjg",
    ".gggGGGggg.",
    "...gG.Gg...",
    "..gG...Gg..",
  ];
  BOW.forEach((row, j) => [...row].forEach((k, i) => k !== "." && put(c, bx - 5 + i, by - 4 + j, k)));
  // A gold tag on its front corner.
  rect(c, x0 + 2, y0 + lid + 2, 4, 3, (i, j) => (j === 0 || i === 0 ? "z" : "Z"));
  if (glint >= 0) {
    // A frost glint running along its lid (idle).
    const gx = x0 + 1 + (glint % (w - 2));
    put(c, gx, y0 + 1, "*");
    put(c, gx - 1, y0 + 1, "~");
    put(c, gx + 1, y0 + 1, "~");
    put(c, gx, y0, "~");
  }
}

// ---- Ice blocks: a wall of packed-snow blocks (the dome's inside), lit from the top left, frost in the mortar.

/** The ice block wall's key at (x, y) (room pixels, so neighbouring pieces join), `rowH` px a course, `bw` px a block. */
export function iceBlock(x: number, y: number, rowH = 9, bw = 15, seed = 1): string {
  const course = Math.floor(y / rowH);
  const ly = y - course * rowH;
  const off = (course % 2) * Math.floor(bw / 2) + Math.floor(hash(course, 0, seed) * 4);
  const bx = Math.floor((x + off) / bw);
  const lx = x + off - bx * bw;
  if (ly === 0 || lx === 0) return hash(x, y, seed) < 0.2 ? "B" : "a"; // the mortar line, a little frost in it
  if (ly === 1 || lx === 1) return "C"; // the block's lit top and left edge
  if (ly === rowH - 1 || lx === bw - 1) return "b"; // its shaded foot and right
  const v = hash(bx, course, seed + 3);
  const s = hash(x >> 1, y >> 1, seed + 7);
  if (s < 0.05) return "C";
  return v < 0.3 ? "B" : v < 0.8 ? "c" : "B";
}
/** Icicles hanging from a lip at `y` (x across `w` px from x0): their lengths vary, white with a pale-blue side. */
export function icicles(c: Cv, x0: number, y: number, w: number, seed: number, max = 7): void {
  for (let i = 0; i < w; i++) {
    const h = hash(i >> 1, 0, seed);
    if (h < 0.45 || i % 2) continue;
    const len = 2 + Math.floor(hash(i, 1, seed) * max);
    for (let j = 0; j < len; j++) {
      put(c, x0 + i, y + j, j === len - 1 ? "~" : "*");
      if (j < len - 2) put(c, x0 + i + 1, y + j, "~");
    }
  }
}

/** A string of little warm bulbs along a line (x0..x1 at y, sagging between hooks every `every` px), the bulbs in candy inks. */
export function bulbs(c: Cv, x0: number, x1: number, y: number, every = 12, seed = 1, lit = true): void {
  const inks = ["r", "y", "g", "t", "h", "o"];
  for (let x = x0; x <= x1; x++) {
    const t = ((x - x0) % every) / every;
    const sag = Math.round(Math.sin(t * Math.PI) * 2);
    put(c, x, y + sag, "N");
    if ((x - x0) % 4 === 2) {
      const ink = inks[Math.floor(hash(x, y, seed) * inks.length)]!;
      put(c, x, y + sag + 1, lit ? "F" : ink);
      put(c, x, y + sag + 2, ink);
    }
  }
}

/** A canvas cropped to what's on it (an outlined Bit), or a blank 1-px one. */
export const bit = (c: Cv, outline = true): Bit => cropBit(c, outline) ?? { part: { grid: ["."], outline: false }, at: [0, 0] };

/** Draw a canvas `src` onto `dst` at (x, y), skipping empty pixels. */
export function paste(dst: Cv, src: Cv, x: number, y: number): void {
  src.forEach((row, j) => row.forEach((k, i) => k !== "." && put(dst, x + i, y + j, k)));
}
