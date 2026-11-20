/** Boingo's effects: the pie, flying and splatting. See ../effects.ts. */
import { canvas, ellipse, inEllipse, roundLight, shade, toGrid, type Canvas } from "../paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../sprite.ts";
import { SQUARE, type Pt } from "./common.ts";
import { lazyAnim, lazyParts } from "../sprite.ts";

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
    splat: lazyAnim(() => ({
      loop: false,
      frames: [
        { ms: 60, layers: [{ part: "top10", x: 11, y: 11 }] },
        { ms: 60, layers: [{ part: "top16", x: 8, y: 8 }] },
        { ms: 80, cue: "splat", layers: [{ part: "splatBig", x: 1, y: 1 }], specks: spatter(0), shake: [0, 1] },
        { ms: 90, layers: [{ part: "splatBig", x: 1, y: 1 }], specks: spatter(1) },
        { ms: 140, layers: [{ part: "splat", x: 1, y: 1 }] },
      ],
    })),
    /** Pied, while it lasts: the cherry glints now and then. */
    pied: lazyAnim(() => ({
      loop: true,
      frames: Array.from({ length: 8 }, (_, i) => ({ ms: 220, layers: [{ part: "splat", x: 1, y: 1 }], pal: i === 5 ? { E: "#ffffff", r: "#ff5a5f" } : undefined })),
    })),
    /** It clears: the pie fades away. The last frame is empty. */
    fade: lazyAnim(() => ({
      loop: false,
      frames: [
        { ms: 110, layers: [{ part: "splat", x: 1, y: 1 }], pal: fadePie("c0") },
        { ms: 110, layers: [{ part: "splat", x: 1, y: 1 }], pal: fadePie("80") },
        { ms: 110, layers: [{ part: "splat", x: 1, y: 1 }], pal: fadePie("40") },
        { ms: 60, layers: [] },
      ],
    })),
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
    fly: lazyAnim(() => ({
      loop: true,
      frames: ([0, 1, 2, 3] as const).map((rot): Frame => {
        const across = rot % 2 ? [13, 11] : [11, 13];
        return { ms: 70, layers: [{ part: "pie", x: across[0]!, y: across[1]!, rot }] };
      }),
    })),
  },
};

// ---- His attack on a king: a pie in the king's face, side on.

/**
 * A pie hitting the king from the left edge at (x, y), `step` 0 to 2: the pie arriving (its tin edge on and the cream
 * bursting), the splat spread wide with cream flying on past him, the cream sliding down.
 */
const pieHitSpecks = (x: number, y: number, step: 0 | 1 | 2): Speck[] => {
  const out: Speck[] = [];
  const blob = (r: number, ry: number, cx: number, cy: number) => {
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++)
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) if ((dx / r) ** 2 + (dy / ry) ** 2 <= 1) out.push([cx + dx, cy + dy, dx + dy < -1 ? "w" : dx + dy > 2 ? "X" : "W"]);
  };
  if (step === 0) {
    blob(2.6, 3.2, x, y);
    // The tin's edge, side on, and its crust, just behind the cream.
    for (let dy = -3; dy <= 3; dy++) out.push([x - 3, y + dy, "S"], [x - 4, y + dy, "o"]);
    out.push([x, y - 1, "r"], [x + 1, y - 1, "R"]);
  } else if (step === 1) {
    blob(4.6, 4.2, x + 1, y);
    for (const [dx, dy] of [[-2, -5], [3, -5], [5, 3], [-1, 5]] as const) blob(1.6, 1.6, x + 1 + dx, y + dy);
    out.push([x + 1, y, "r"], [x + 2, y, "R"]);
    // Cream flying on past him.
    for (let i = 0; i < 7; i++) out.push([x + 7 + (i % 3) * 2, Math.round(y - 4 + i * 1.5), i % 2 ? "w" : "W"]);
  } else {
    blob(3.6, 3.2, x + 1, y + 1);
    for (const dx of [-2, 1, 3]) for (let d = 3; d <= 6 - (dx & 1); d++) out.push([x + 1 + dx, y + 1 + d, d > 4 ? "X" : "W"]);
    for (let i = 0; i < 4; i++) out.push([x + 11 + i * 2, y - 1 + i * 2, "W"]);
  }
  return out.filter(([px, py]) => px > 0 && py > 0 && px < SQUARE - 1 && py < SQUARE - 1);
};
const pieHitAnims: Record<string, Anim> = {};
for (const [kind, y] of [["H", 8], ["L", 13]] as const)
  for (const side of ["L", "R"] as const) {
    const sp = (step: 0 | 1 | 2): Speck[] => pieHitSpecks(18, y, step).map(([x, yy, k]): Speck => [side === "L" ? x : SQUARE - 1 - x, yy, k]);
    pieHitAnims[`hit${kind}${side}`] = {
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
 * A pie in a king's face (Boingo's attack on a king): `hit<H|L><L|R>`, at his head or a little lower, thrown in from
 * the left or the right edge: the pie hits side on, the cream splats wide and flies on past him, then slides down.
 * About 200 ms; ends empty. Over the piece (or the God King standing there). Silent: the attack's own cues are its sound.
 */
export const PIE_HIT: Character = {
  id: "pie-hit",
  name: "A pie in a king's face",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: PIE_PALETTE,
  parts: {},
  anims: pieHitAnims,
};

/**
 * His pie in a piece's face (Nov 12, Boingo.tsx's FaceSplash): the same art as PIE_HIT, its first frame cueing `splat` (the pie's
 * splat sound, EFFECTS.pieFace). A copy, so the king attack's PIE_HIT stays silent.
 */
export const PIE_FACE: Character = {
  ...PIE_HIT,
  id: "pie-face",
  name: "A pie in a piece's face",
  anims: Object.fromEntries(
    Object.entries(pieHitAnims).map(([k, a]) => [k, { ...a, frames: a.frames.map((f, i) => (i === 0 ? { ...f, cue: "splat" } : f)) }]),
  ),
};

// ---- A piece his pie froze (its second splat; Eric, Nov 20: "its own animation, not an ice cube"): buried in pie.

/**
 * The heap of whipped cream a frozen piece stands in, 30 x 18, its flat bottom on the square's bottom edge: a low dome
 * (about to the piece's waist, so its head still shows which piece it is) with a dollop each side, the right one higher
 * (the cherry sits on it), swirls, and bits of crust in the cream. `rise`: how tall it has heaped up so far (18 whole).
 */
function creamHeap(rise: number): Part {
  const cv: Canvas = canvas(30, 18);
  const dome = inEllipse(15, 19, 14, 10.5);
  const lumps = [inEllipse(6.5, 8, 4.6, 4.4), inEllipse(23.5, 6, 5, 4.8), inEllipse(11.5, 10, 3.4, 3), inEllipse(17.5, 9.5, 3.2, 3)];
  // (Heaping up: the whole heap squashed down to `rise` rows, its lumps and all.)
  const whole = (x: number, y: number) => dome(x, y) || lumps.some((l) => l(x, y));
  const inside = (x: number, y: number) => y >= 18 - rise && whole(x, Math.floor(17 - ((17 - y) * 18) / rise));
  shade(cv, inside, "XWw", (x, y) => 1.45 - 0.022 * x - 0.045 * y);
  const on = (x: number, y: number, k: string) => inside(x, y) && (cv[y]![x] = k);
  // The swirls: a curl under each dollop's top, and a fold across the dome.
  for (const [x, y] of [[4, 9], [5, 10], [6, 10], [8, 9], [20, 7], [21, 8], [22, 8], [24, 8], [25, 7], [10, 12], [11, 13], [13, 12], [16, 11], [17, 12], [18, 11]] as const) on(x, y, "W");
  for (const [x, y] of [[2, 16], [3, 15], [27, 14], [26, 15], [8, 16], [21, 15]] as const) on(x, y, "X");
  // Bits of crust in the cream.
  for (const [x, y] of [[9, 14], [18, 11], [3, 13], [25, 12], [14, 16]] as const) {
    on(x, y, "o");
    on(x + 1, y, "O");
    on(x, y + 1, "O");
  }
  return { grid: toGrid(cv) };
}

/** The cherry on top, with its stem. */
const cherryPart: Part = { grid: ["...O", "..O.", ".rr.", "rErr", "rrrR", ".RR."] };

const { parts: FREEZE_PARTS, add: addFreezePart } = lazyParts();
for (const rise of [5, 10, 18]) addFreezePart(`cream${rise}`, () => creamHeap(rise));
addFreezePart("cherry", () => cherryPart);

/** Where the heap and its cherry stand when settled (the heap's top-left; the cherry on the right dollop). */
const HEAP: Pt = [1, 12];
const CHERRY: Pt = [22, 8];
const heap = (dx = 0, dy = 0, cherry: Pt | null = [0, 0], part = "cream18"): Layer[] => [
  { part, x: HEAP[0] + dx, y: HEAP[1] + dy },
  ...(cherry ? [{ part: "cherry", x: CHERRY[0] + dx + cherry[0], y: CHERRY[1] + dy + cherry[1] }] : []),
];
/** A drip of cream running down the heap's face from (x, y0), `t` frames on (a streak behind it), then off its bottom edge. */
const creamDrip = (x: number, y0: number, t: number): Speck[] => {
  const y = Math.min(29, y0 + t * 2);
  const streak: Speck[] = Array.from({ length: y - y0 }, (_, i): Speck => [x, y0 + i, "W"]);
  return [...streak, [x, y, "w"], [x + 1, y, "X"], [x, y + 1, "X"], ...(y0 + t * 2 > 29 ? [[x, 31, "W"] as Speck] : [])];
};

export const PIE_FREEZE: Character = {
  id: "pie-freeze",
  name: "A piece buried in pie",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: PIE_PALETTE,
  parts: FREEZE_PARTS,
  anims: {
    /**
     * The pie's cream heaps up over the piece (as the second splat lands, just after the pie in its face): a low splat at
     * its feet with cream flying, rising round it, a bounce past its height as the cherry drops in, and it settles.
     */
    heap: lazyAnim(() => ({
      loop: false,
      frames: [
        { ms: 70, layers: heap(0, 0, null, "cream5"), specks: spatter(0), shake: [0, 1] },
        { ms: 70, layers: heap(0, 0, null, "cream10"), specks: spatter(1) },
        { ms: 80, layers: heap(0, -1, [0, -6]) },
        { ms: 90, layers: heap(0, 0, [0, -1]), shake: [0, 1] },
        { ms: 140, layers: heap(), pal: { E: "#ffffff", r: "#ff5a5f" } },
      ],
    })),
    /** Buried, while the freeze lasts: a small wobble now and then, cream dripping down its face and off its bottom edge. */
    buried: lazyAnim(() => ({
      loop: true,
      frames: [
        ...[0, 1, 2, 3, 4].map((t): Frame => ({ ms: 160, layers: heap(), specks: creamDrip(19, 21, t) })),
        { ms: 90, layers: heap(1, 0) },
        { ms: 90, layers: heap(-1, 0) },
        { ms: 90, layers: heap(1, 0) },
        { ms: 120, layers: heap(), pal: { E: "#ffffff" } },
        ...[0, 1, 2, 3, 4].map((t): Frame => ({ ms: 160, layers: heap(), specks: creamDrip(8, 23, t) })),
        { ms: 260, layers: heap() },
      ],
    })),
    /** The freeze wears off: the cream slides down off the piece and off the square, the cherry rolling away. Ends empty. */
    slide: lazyAnim(() => ({
      loop: false,
      frames: [
        { ms: 80, cue: "slide", layers: heap(0, 1, [1, 0]) },
        { ms: 80, layers: heap(0, 3, [3, 1]) },
        { ms: 80, layers: heap(0, 6, [5, 4]), specks: creamDrip(8, 25, 0) },
        { ms: 90, layers: heap(0, 10, [8, 8]), specks: creamDrip(8, 25, 1) },
        { ms: 90, layers: heap(0, 14, null), specks: creamDrip(8, 25, 2) },
        { ms: 90, layers: heap(0, 17, null) },
        { ms: 60, layers: [] },
      ],
    })),
  },
};
