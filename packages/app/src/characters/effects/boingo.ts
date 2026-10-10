/** Boingo's effects: the pie, flying and splatting. See ../effects.ts. */
import { canvas, ellipse, inEllipse, roundLight, shade, toGrid, type Canvas } from "../paint.ts";
import type { Character, Frame, Part, Speck } from "../sprite.ts";
import { SQUARE, type Pt } from "./common.ts";

// ---- The pie (Boingo's passive): flying, splatting on a square, staying, fading.

const PIE_PALETTE = {
  k: "#2b1810",
  w: "#fff8ef", // cream
  W: "#f1dccb",
  X: "#d9b9a8",
  o: "#d99a4e", // crust
  O: "#9c5f28",
  r: "#e2343b", // cherry
  R: "#a3202b",
  E: "#ffe3d6",
  s: "#e4e6ec", // tin
  S: "#9ca0ab",
} as const;

/** The pie seen from above as it comes down, `r` pixels across. */
function pieTop(d: number): Part {
  const cv = canvas(d, d);
  const c = d / 2;
  shade(cv, inEllipse(c, c, c, c), "Oo", roundLight(c, c, c, c, 0.1));
  shade(cv, inEllipse(c, c, c - 2, c - 2), "XWw", roundLight(c, c, c - 2, c - 2, 0.1));
  ellipse(cv, c, c, 1.6, 1.6, "r");
  cv[Math.floor(c) - 1]![Math.floor(c) - 1] = "E";
  return { grid: toGrid(cv) };
}

/** The splat: a blob of cream with lobes, crust bits on it and the cherry in the middle. `size` 1 big, 0 settled. */
function splatPart(big: boolean): Part {
  const cv: Canvas = canvas(30, 30);
  const lobes: Pt[] = big
    ? [[15, 4], [25, 8], [26, 19], [18, 26], [6, 23], [4, 11]]
    : [[15, 6], [23, 9], [24, 18], [17, 24], [8, 21], [6, 12]];
  const r = big ? 4.5 : 3.6;
  const inside = (x: number, y: number) => inEllipse(15, 15, big ? 10.5 : 9.5, big ? 10 : 9)(x, y) || lobes.some(([lx, ly]) => inEllipse(lx, ly, r, r)(x, y));
  shade(cv, inside, "XWw", (x, y) => 0.95 - 0.022 * x - 0.022 * y);
  // A drip running down from the bottom lobe.
  if (!big) for (const y of [27, 28]) cv[y]![17] = "W";
  for (const [x, y] of [[9, 9], [20, 7], [21, 20], [8, 17]] as const) {
    cv[y]![x] = "o";
    cv[y]![x + 1] = "O";
    cv[y + 1]![x] = "O";
  }
  ellipse(cv, 15, 14, 2.2, 2.2, "r");
  cv[14]![16] = "R";
  cv[15]![16] = "R";
  cv[13]![14] = "E";
  return { grid: toGrid(cv) };
}

/** Cream spattered out from the splat (`t` frames after). */
const spatter = (t: number): Speck[] =>
  Array.from({ length: 10 }, (_, i): Speck[] => {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const d = 12 + t * 2 + (i % 3);
    const x = Math.round(16 + Math.cos(a) * d);
    const y = Math.round(16 + Math.sin(a) * d);
    return x < 1 || y < 1 || x > 30 || y > 30 ? [] : [[x, y, i % 2 ? "w" : "W"]];
  }).flat();

const fadePie = (alpha: string): Record<string, string> =>
  Object.fromEntries(Object.entries(PIE_PALETTE).map(([k, v]) => [k, `${v}${alpha}`]));

const pieFlyPart: Part = { grid: ["....rr....", "..wwEwww..", ".wwwwwwWW.", "oooooooooo", ".OSSSSSSO."] };

export const PIE_SPLAT: Character = {
  id: "pie-splat",
  name: "Pie on a square",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: PIE_PALETTE,
  parts: { top10: pieTop(10), top16: pieTop(16), splatBig: splatPart(true), splat: splatPart(false) },
  anims: {
    /** The pie lands: it comes down (seen from above, growing), then SPLAT, cream flying, and it settles. */
    splat: {
      loop: false,
      frames: [
        { ms: 60, layers: [{ part: "top10", x: 11, y: 11 }] },
        { ms: 60, layers: [{ part: "top16", x: 8, y: 8 }] },
        { ms: 80, cue: "splat", layers: [{ part: "splatBig", x: 1, y: 1 }], specks: spatter(0), shake: [0, 1] },
        { ms: 90, layers: [{ part: "splatBig", x: 1, y: 1 }], specks: spatter(1) },
        { ms: 140, layers: [{ part: "splat", x: 1, y: 1 }] },
      ],
    },
    /** Pied, while it lasts: the cherry glints now and then. */
    pied: {
      loop: true,
      frames: Array.from({ length: 8 }, (_, i) => ({ ms: 220, layers: [{ part: "splat", x: 1, y: 1 }], pal: i === 5 ? { E: "#ffffff", r: "#ff5a5f" } : undefined })),
    },
    /** It clears: the pie fades away. The last frame is empty. */
    fade: {
      loop: false,
      frames: [
        { ms: 110, layers: [{ part: "splat", x: 1, y: 1 }], pal: fadePie("c0") },
        { ms: 110, layers: [{ part: "splat", x: 1, y: 1 }], pal: fadePie("80") },
        { ms: 110, layers: [{ part: "splat", x: 1, y: 1 }], pal: fadePie("40") },
        { ms: 60, layers: [] },
      ],
    },
  },
};

export const PIE_FLY: Character = {
  id: "pie-fly",
  name: "Pie in flight",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: PIE_PALETTE,
  parts: { pie: pieFlyPart },
  anims: {
    /** In flight, tumbling (a quarter turn a frame). Loops while it flies. */
    fly: {
      loop: true,
      frames: ([0, 1, 2, 3] as const).map((rot): Frame => {
        const across = rot % 2 ? [13, 11] : [11, 13];
        return { ms: 70, layers: [{ part: "pie", x: across[0]!, y: across[1]!, rot }] };
      }),
    },
  },
};
