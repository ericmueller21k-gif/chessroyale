/**
 * Chandy's challenge in his swamp (Nov 16; Eric: "underneath it, there's going to be a platform … when you stand there, the platform …
 * rises up. It could just be like something made of like wood, you know, or like mossy covered … make the chessboard actually rise up
 * first … then that comes up from the water, but obviously like the bottom of it would still be in the water because it's touching the
 * platform, and then the rest of it rises up … for the stools, they could just be like … milk crates"). The pieces, in the room's
 * pixels (37 a square), each standing on its foot:
 *
 * - `INTRO_CHANDY_POST`: the board's stand, a squat mossy cypress post with a plank cap the board's slab rests on (the game lays the real
 *   board on it). Taller than the platform: it starts rising first. `idle` dry; `stream` (loops) water running off it in sheets and drips.
 * - `INTRO_CHANDY_PLATFORM`: the hidden platform, old planks on cross beams, moss along its edges and weed hanging off them, five
 *   squares across (the marks and the post on it), seen from the front and a little above. `stream`: water pouring off its edges.
 * - `INTRO_CHANDY_CRATE`: a milk crate, faded and mossy, the stool: `blue` (his) and `orange` (yours).
 * - `INTRO_CHANDY_STORM` and `_FRONT`: his wipe, simple (Eric: "swamp themed … not crazy"): a wall of the swamp's water rolling in over
 *   the screen from the side (as every boss's wipe sweeps), its front a wavy foamy edge, a cattail and a lily pad riding it, bubbles in it.
 */
import type { Character, Frame, Part } from "../../characters/sprite.ts";
import { grain, paint, type Pt } from "../houses/kit.ts";

export const INTRO_CHANDY_PALETTE: Record<string, string> = {
  k: "#13200f", // outline
  "1": "#2e2216", // old wet wood: deep, dark, mid, light
  "2": "#4d3a28",
  "3": "#6e5640",
  "4": "#927a5e",
  t: "#2c241c", // cypress bark (the post): deep, dark, mid, light
  T: "#463a2d",
  u: "#665645",
  U: "#8d7b65",
  q: "#3f6e26", // moss: dark, mid, light; weed hanging (dark, light)
  Q: "#5f9433",
  R: "#86b84a",
  y: "#2b4a24",
  Y: "#4a6e34",
  w: "#1d3a2c", // the water: deep, dark, mid, sheen; its streams and drips (mid, light)
  W: "#284c37",
  v: "#33604a",
  V: "#4b7d5d",
  g: "#9fd0b0",
  G: "#d6f0e0",
  b: "#2f5f9a", // a blue milk crate: dark, mid, light
  B: "#4a86c8",
  C: "#7fb2e6",
  o: "#b8541c", // an orange milk crate: dark, mid, light
  O: "#e57a2c",
  P: "#f5a95a",
  l: "#2f6c2a", // a lily pad: shade, light; reeds (shade, light)
  L: "#4c9a3a",
  r: "#4d6b26",
  h: "#82a443",
  c: "#5a3320", // a cattail's head
};

type Bit = { part: Part; at: Pt };
const ch = (id: string, w: number, h: number, foot: Pt, anims: Record<string, { ms: number; bits: Bit[] }[]>, loop: Record<string, boolean> = {}): Character => {
  const parts: Record<string, Part> = {};
  const out: Record<string, Character["anims"][string]> = {};
  for (const [name, frames] of Object.entries(anims))
    out[name] = {
      loop: loop[name] ?? true,
      frames: frames.map((f, i): Frame => ({
        ms: f.ms,
        layers: f.bits.map((b, j) => {
          const n = `${name}${i}p${j}`;
          parts[n] = b.part;
          return { part: n, x: b.at[0], y: b.at[1] };
        }),
      })),
    };
  return { id, name: id, w, h, foot, palette: INTRO_CHANDY_PALETTE, parts, anims: out };
};

// ==== The post: the board's stand. 58 px from the water's floor to the cap's top (the board's slab sits on it), 44 wide at its flared
// foot; the cap a plank square 50 wide. Its foot stays in the water once the platform has risen to it (the platform's top at its foot).

const PW = 60;
const PH = 72;
const PF = PH - 2;
export const CHANDY_POST_TOP = 14; // the cap's top (the board's slab on it), from the frame's top
const postBits = (): Bit[] => {
  const trunk = paint(6, 20, PW - 12, PF - 19, (x, y) => {
    const j = (PF - y) / (PF - 20);
    const half = 12 + 10 * Math.pow(Math.max(0, 1 - j * 2.5), 2);
    const X = x + 0.5 - PW / 2;
    if (Math.abs(X) > half) return null;
    const u = X / half;
    if (grain(x >> 1, y >> 1, 3) > 0.78 && (u < -0.3 || y > PF - 14)) return grain(x, y, 4) > 0.5 ? "Q" : "q"; // moss
    const l = 0.62 - u * 0.45 + (Math.sin(u * 5 + y * 0.12) > 0.5 ? 0.15 : 0) + (grain(x, y >> 1, 5) - 0.5) * 0.2;
    return l > 0.8 ? "U" : l > 0.5 ? "u" : l > 0.25 ? "T" : "t";
  });
  const cap = paint(4, CHANDY_POST_TOP, PW - 8, 8, (x, y) => {
    const j = y - CHANDY_POST_TOP;
    if (j === 0) return "4";
    if (j < 4) return (x + 1) % 13 === 0 ? "1" : "3";
    if (j === 7) return "1";
    return grain(x >> 2, j, 7) > 0.8 ? "Q" : "2"; // the cap's front edge, a little moss
  });
  // Weed hanging off the cap's edge.
  const weed = paint(4, CHANDY_POST_TOP + 7, PW - 8, 10, (x, y) => {
    const len = [0, 5, 0, 8, 0, 0, 4, 0, 9, 0, 3][(x * 3) % 11]!;
    return y - (CHANDY_POST_TOP + 7) < len ? ((x + y) % 3 ? "y" : "Y") : null;
  }, false);
  return [trunk, cap, weed];
};
/** Water running off: sheets down its sides and drips, frame `i` of four (they fall a few pixels a frame). */
const streamBit = (x0: number, y0: number, w: number, h: number, i: number, seed: number): Bit =>
  paint(x0, y0, w, h, (x, y) => {
    const col = grain(x >> 1, 0, seed);
    if (col < 0.55) return null;
    const run = (y - y0 + i * 4 + Math.floor(col * 20)) % 13;
    if (run < 5) return run < 2 ? "G" : "g";
    return null;
  }, false);
export const INTRO_CHANDY_POST: Character = ch("intro-chandy-post", PW, PH, [PW / 2, PF], {
  idle: [{ ms: 1000, bits: postBits() }],
  stream: [0, 1, 2, 3].map((i) => ({ ms: 90, bits: [...postBits(), streamBit(6, CHANDY_POST_TOP + 6, PW - 12, PF - CHANDY_POST_TOP - 6, i, 11)] })),
});

// ==== The platform: eight squares across (4.5 west of the battle spot's middle, 3.5 east: Chandy's clear place and his tail, yours and a
// margin, round 2: "the battleground seems a little short"), its deck 10 px thick. Moss along its front edge.

const FW = 8 * 37;
const FD = 40; // its deck seen from a little above: how tall its top face shows
const FT = 10; // its front edge's thickness
const FH = FD + FT + 18;
const FF = FD + FT; // its foot: the front edge's bottom (the waterline once it's up)
export const CHANDY_PLATFORM_TOP = Math.round(FD * 0.55); // where things stand on it (from the frame's top: the battle spot's row)
/** Its foot (where the battle spot's middle stands on it): 4.5 squares from its west end. */
export const CHANDY_PLATFORM_FOOT: Pt = [Math.round(4.5 * 37), CHANDY_PLATFORM_TOP];
/** How far its front edge's foot lies under its foot (its pixels): where the water first hides it. */
export const CHANDY_PLATFORM_WET = FF - CHANDY_PLATFORM_TOP;
const platformBits = (): Bit[] => {
  const top = paint(0, 0, FW, FD, (x, y) => {
    const inset = Math.round((FD - y) * 0.35);
    if (x < inset || x > FW - 1 - inset) return null;
    // Planks across (along x), their joints; moss in patches.
    if (grain(x >> 3, y >> 2, 21) > 0.86) return grain(x, y, 22) > 0.5 ? "R" : "Q";
    // Planks running across, seen flat: each 4 px of the face, a dark seam between, lit toward the back.
    if (y % 4 === 3) return "2";
    if ((x + (Math.floor(y / 4) % 2) * 23) % 46 === 0) return "2";
    return y < FD / 2 ? (grain(x >> 2, y, 23) > 0.8 ? "3" : "4") : grain(x >> 2, y, 23) > 0.85 ? "2" : "3";
  });
  const edge = paint(0, FD, FW, FT, (x, y) => {
    const j = y - FD;
    if (grain(x >> 1, j, 25) > 0.7 && j < 4) return "Q";
    return j === 0 ? "4" : j === FT - 1 ? "1" : x % 23 === 0 ? "1" : "2";
  });
  // Weed and moss hanging off its front edge.
  const weed = paint(0, FF, FW, 16, (x, y) => {
    const len = Math.round(16 * grain(x >> 1, 0, 27) ** 3);
    return y - FF < len ? (y % 3 ? "y" : "Y") : null;
  }, false);
  return [top, edge, weed];
};
export const INTRO_CHANDY_PLATFORM: Character = ch("intro-chandy-platform", FW, FH, CHANDY_PLATFORM_FOOT, {
  idle: [{ ms: 1000, bits: platformBits() }],
  stream: [0, 1, 2, 3].map((i) => ({ ms: 90, bits: [...platformBits(), streamBit(0, FD, FW, FT + 16, i, 29)] })),
});

// ==== A milk crate: plastic, open grid sides, faded, a little moss on its rim; seen from the front and a little above.

const XW = 26;
const XH = 26;
const crateBits = (dark: string, mid: string, light: string): Bit[] => [
  paint(0, 0, XW, XH, (x, y) => {
    // The rim, seen from above (a slim parallelogram).
    if (y < 5) {
      if (x < 4 - y || x > XW - 1 - (4 - y)) return null;
      if (y === 0 || y === 4) return light;
      return x > 3 && x < XW - 4 && y > 1 && y < 4 ? dark : mid; // its open top
    }
    if (y === XH - 1) return dark;
    // The sides: a grid of holes; a band of solid plastic at the top and the bottom.
    if (y < 8 || y > XH - 4) return grain(x >> 1, y, 31) > 0.85 && y < 8 ? "Q" : mid;
    const hx = (x - 2) % 6;
    const hy = (y - 8) % 5;
    if (x > 1 && x < XW - 2 && hx > 0 && hx < 4 && hy > 0 && hy < 4) return "1";
    return x < 2 ? light : mid;
  }),
];
export const INTRO_CHANDY_CRATE: Character = ch("intro-chandy-crate", XW, XH, [XW / 2, XH - 1], {
  idle: [{ ms: 1000, bits: crateBits("b", "B", "C") }],
  blue: [{ ms: 1000, bits: crateBits("b", "B", "C") }],
  orange: [{ ms: 1000, bits: crateBits("o", "O", "P") }],
});

// ==== The wipe: the swamp's water rolling in (a tile that fills behind its front), bubbles rising in it; 74 px, repeating.

export const INTRO_CHANDY_STORM: Character = ch("intro-chandy-storm", 74, 74, [37, 73], {
  idle: [0, 1, 2, 3].map((i) => ({
    ms: 110,
    bits: [
      paint(0, 0, 74, 74, (x, y) => {
        // Bubbles rising.
        const bx = (x * 7 + 3) % 37;
        if (bx < 2 && (y + i * 6 + x * 3) % 29 < 2) return "G";
        if ((y + Math.floor(x / 9) * 3 + i * 2) % 11 === 0 && grain(x >> 3, y, 41) > 0.6) return "V";
        return grain(x >> 2, y >> 2, 43) > 0.75 ? "w" : "W";
      }, false),
    ],
  })),
});
/**
 * The wipe's front: the leading edge of a wall of swamp water rolling in from the side (as every boss's wipe sweeps: round 2), 48 x 74,
 * repeating down the screen: the water on its left carrying on from the tile, a wavy foamy edge, a lily pad and a cattail riding it.
 */
export const INTRO_CHANDY_FRONT: Character = ch("intro-chandy-front", 48, 74, [24, 73], {
  idle: [0, 1, 2, 3].map((i) => ({
    ms: 110,
    bits: [
      paint(0, 0, 48, 74, (x, y) => {
        const wave = 30 + Math.round(5 * Math.sin(((y + i * 5) * 2 * Math.PI) / 74) + 2 * Math.sin(((y - i * 4) * 4 * Math.PI) / 74));
        // A cattail riding the edge, leaning out ahead of it, and a lily pad on the water just behind.
        const cy = 20;
        if (Math.abs(y - (cy + (x - wave) * 0.15)) < 0.8 && x > wave && x < wave + 12) return "h";
        if (Math.abs(y - (cy + (x - wave) * 0.15)) < 1.3 && x >= wave + 9 && x < wave + 14) return "c";
        if (x > wave) return null;
        if (x > wave - 2) return "G";
        if (x > wave - 5) return "g";
        const ly = 52;
        if (Math.hypot((x - (wave - 14)) / 7, (y - ly) / 4) < 1) return x < wave - 14 ? "L" : "l";
        return x > wave - 8 ? "V" : grain(x >> 2, y >> 2, 45) > 0.7 ? "w" : "W";
      }, false),
    ],
  })),
});
