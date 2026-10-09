/**
 * Effect sprites for the bosses' powers, for the board: pixel art in the characters' format (palettes, parts,
 * frames, cues), each frame exactly the area it covers, so placing one is sizing its canvas to a square (or the whole
 * board) with `image-rendering: pixelated`. See power-art.ts for the list and how each is meant to play.
 *
 * Colours may be see-through (`#rrggbbaa`): the ice over a frozen piece lets the piece show, the blizzard's haze
 * lets the board show.
 */
import { canvas, ellipse, flame, inEllipse, inPoly, line, poly, roundLight, shade, toGrid, type Canvas } from "./paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "./sprite.ts";

/** Frame pixels per board square, for the one-square effects. */
export const SQUARE = 32;
/** Frame pixels per board square for the blizzard, which covers the whole board (8 x 8 squares). */
export const BOARD_CELL = 24;

type Pt = readonly [number, number];

const sparkle = (x: number, y: number, core = "F", ray = "f", big = false): Speck[] => [
  [x, y, core],
  [x - 1, y, ray],
  [x + 1, y, ray],
  [x, y - 1, ray],
  [x, y + 1, ray],
  ...(big ? ([[x - 2, y, ray], [x + 2, y, ray], [x, y - 2, ray], [x, y + 2, ray]] as Speck[]) : []),
];

// ---- The ice over a frozen piece.

const ICE_PALETTE = {
  k: "#1d4e7a", // outline
  a: "#c4ecff59", // the ice, see-through
  A: "#7fcfff73",
  q: "#dff6ff59", // frost forming
  i: "#d6f6ff", // rims and shine
  I: "#7fd3ff",
  J: "#3a8fd8",
  F: "#ffffff",
  f: "#a8e8ff",
  c: "#2a6fb0", // cracks
  d: "#9fdcff", // meltwater
  p: "#9fdcff80",
} as const;

/** Inside a rounded square from (x0, y0) to (x1, y1) (inclusive), corner radius r. */
const inRounded = (x0: number, y0: number, x1: number, y1: number, r: number) => (x: number, y: number) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x1 - r, x));
  const cy = Math.max(y0 + r, Math.min(y1 - r, y));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5;
};

const CRACKS: readonly (readonly Pt[])[] = [
  [[5, 4], [8, 8], [7, 10], [11, 13], [13, 16]],
  [[27, 9], [23, 12], [24, 15], [19, 17]],
  [[10, 27], [12, 23], [11, 21], [15, 18]],
];

/**
 * The block of ice, `h` pixels tall (28 whole; less as it melts, its top coming down), with `cracks` of the three
 * cracks across it.
 */
function iceBlock(h: number, cracks = 0): Part {
  const cv = canvas(28, 28);
  const top = 28 - h;
  const inside = inRounded(0, top, 27, 27, h > 10 ? 3 : 2);
  for (let y = 0; y < 28; y++)
    for (let x = 0; x < 28; x++) {
      if (!inside(x, y)) continue;
      const edgeTL = !inside(x - 1, y) || !inside(x, y - 1);
      const edgeBR = !inside(x + 1, y) || !inside(x, y + 1);
      cv[y]![x] = edgeTL ? "i" : edgeBR ? "J" : !inside(x + 2, y) || !inside(x, y + 2) ? "I" : x + (y - top) < 24 ? "a" : "A";
    }
  // Shine: two diagonal streaks across the top left.
  const streak = (x0: number, y0: number, len: number, k: string) => {
    for (let t = 0; t < len; t++) if (inside(x0 + t, y0 - t) && cv[y0 - t]![x0 + t] !== "i") cv[y0 - t]![x0 + t] = k;
  };
  streak(3, top + 11, 9, "F");
  streak(3, top + 16, 5, "i");
  streak(9, top + 10, 3, "i");
  const lines = canvas(28, 28);
  for (const crack of CRACKS.slice(0, cracks)) crack.forEach((p, n) => n > 0 && line(lines, crack[n - 1]![0], crack[n - 1]![1], p[0], p[1], "c"));
  lines.forEach((row, y) => row.forEach((k, x) => k === "c" && inside(x, y) && (cv[y]![x] = "c")));
  // Frost crystals in two corners, opaque.
  if (h >= 24) {
    for (const [x, y, k] of [[1, top + 1, "F"], [2, top + 1, "i"], [1, top + 2, "i"], [3, top + 1, "f"], [1, top + 3, "f"], [26, 26, "F"], [25, 26, "i"], [26, 25, "i"], [24, 26, "f"], [26, 24, "f"]] as const)
      cv[y]![x] = k;
  }
  return { grid: toGrid(cv) };
}

/** Frost creeping in from the edges (no outline yet): `depth` pixels deep. */
function frostEdge(depth: number): Part {
  const cv = canvas(28, 28);
  const inside = inRounded(0, 0, 27, 27, 3);
  for (let y = 0; y < 28; y++)
    for (let x = 0; x < 28; x++) {
      if (!inside(x, y)) continue;
      const d = Math.min(x, y, 27 - x, 27 - y);
      // A ragged inner edge: deeper in places, seeded by position.
      const reach = depth + ((x * 7 + y * 3) % 5 === 0 ? 1 : 0);
      if (d < reach) cv[y]![x] = d === 0 ? "i" : (x + y) % 3 === 0 ? "f" : "q";
    }
  return { grid: toGrid(cv), outline: false };
}

const puddle = (w: number): Part => {
  const cv = canvas(w, 4);
  ellipse(cv, w / 2, 2, w / 2, 2, "p");
  cv[1]![Math.floor(w / 3)] = "F";
  cv[1]![Math.floor(w / 3) + 1] = "i";
  return { grid: toGrid(cv), outline: false };
};

const ICE_PARTS: Record<string, Part> = {
  block: iceBlock(28),
  crack1: iceBlock(28, 1),
  crack2: iceBlock(28, 2),
  crack3: iceBlock(28, 3),
  melt20: iceBlock(20, 3),
  melt12: iceBlock(12, 2),
  frost2: frostEdge(2),
  frost4: frostEdge(4),
  puddle24: puddle(24),
  puddle16: puddle(16),
};
const ice = (part: string, extra: Partial<Frame> = {}, ms = 100): Frame => ({ ms, layers: [{ part, x: 2, y: 2 }], ...extra });

const corners = (big: boolean): Speck[] => [...sparkle(4, 4, "F", "i", big), ...sparkle(27, 27, "F", "i", big)];
/** A glint sweeping across the block along the diagonal (`t` 0 to 1). */
const glint = (t: number): Speck[] => {
  const out: Speck[] = [];
  const c = Math.round(6 + t * 44);
  for (let x = 4; x <= 27; x++) {
    const y = c - x;
    if (y >= 4 && y <= 27) out.push([x, y, "F"], [x + 1, y, "i"]);
  }
  return out;
};
const drips = (n: number, y0: number): Speck[] =>
  [6, 13, 21, 25].slice(0, n).flatMap((x, i): Speck[] => [
    [x, y0 + (i % 2), "d"],
    [x, y0 + 1 + (i % 2), "F"],
  ]);
/** Chips of ice flying off as it cracks. */
const chips = (t: number): Speck[] =>
  [[-1, -1], [1, -1.2], [1.3, 0.3], [-1.2, 0.5]].map(([vx, vy], i): Speck => [Math.round(16 + vx! * (8 + t * 4)), Math.round(16 + vy! * (8 + t * 4) + t * t), i % 2 ? "i" : "F"]);

const fadeIce = (alpha: string): Record<string, string> => ({
  p: `#9fdcff${alpha}`,
  F: `#ffffff${alpha}`,
  i: `#d6f6ff${alpha}`,
});

const ICE_OVERLAY: Character = {
  id: "ice-overlay",
  name: "Ice over a frozen piece",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: ICE_PALETTE,
  parts: ICE_PARTS,
  anims: {
    /** The piece freezes: frost creeps in from the edges, the ice closes over it and flashes. */
    freeze: {
      loop: false,
      frames: [
        ice("frost2", { cue: "crackle", specks: corners(false) }, 70),
        ice("frost4", { specks: corners(true) }, 70),
        ice("block", { pal: { a: "#c4ecff30", A: "#7fcfff40" } }, 80),
        ice("block", { pal: { i: "#ffffff", I: "#d6f6ff" }, specks: [...glint(0.35), ...corners(true)] }, 90),
        ice("block", {}, 140),
      ],
    },
    /** Frozen, while it lasts: still, with a glint sweeping across now and then and the corners twinkling. */
    frozen: {
      loop: true,
      frames: [
        ...Array.from({ length: 6 }, (_, i) => ice("block", { specks: i % 3 === 1 ? corners(false) : undefined }, 220)),
        ice("block", { specks: glint(0) }, 70),
        ice("block", { specks: glint(0.3) }, 70),
        ice("block", { specks: glint(0.6) }, 70),
        ice("block", { specks: glint(0.9) }, 70),
      ],
    },
    /** The ice thaws: it cracks, chips fly, it melts down to a puddle and dries up. The last frame is empty. */
    thaw: {
      loop: false,
      frames: [
        ice("crack1", { cue: "crackle" }, 90),
        ice("crack2", { specks: chips(0), shake: [1, 0] }, 90),
        ice("crack3", { specks: chips(1), shake: [-1, 0] }, 90),
        { ms: 100, layers: [{ part: "melt20", x: 2, y: 2 }], specks: [...chips(2), ...drips(2, 29)] },
        { ms: 100, layers: [{ part: "melt12", x: 2, y: 2 }], specks: drips(4, 29) },
        { ms: 110, layers: [{ part: "puddle24", x: 4, y: 26 }], specks: drips(3, 24) },
        { ms: 110, layers: [{ part: "puddle16", x: 8, y: 26 }], pal: fadeIce("80") },
        { ms: 60, layers: [] },
      ],
    },
  },
};

// ---- The ice bolt in flight (Ginger's freeze), pointing right; turn it towards its target.

const BOLT_PALETTE = { k: "#1d4e7a", i: "#d6f6ff", I: "#7fd3ff", J: "#3a8fd8", F: "#ffffff", f: "#a8e8ff", g: "#7fd3ff66" } as const;
const boltPart: Part = {
  grid: [
    "..........iii.....", //
    ".....JIIIiiiFFF...",
    "..JJJIIIiiiFFFFFF.",
    "JJJIIIiiiFFFFFFFFF",
    "..JJJIIIiiiFFFFFF.",
    ".....JIIIiiiFFF...",
    "..........iii.....",
  ],
};
const boltGlow: Part = (() => {
  const cv = canvas(26, 13);
  ellipse(cv, 15, 6.5, 11, 6.5, "g");
  return { grid: toGrid(cv), outline: false };
})();
const trail = (i: number): Speck[] =>
  [0, 1, 2, 3].flatMap((n): Speck[] => {
    const x = 6 - n * 2 - ((i + n) % 2);
    const y = 16 + (n % 2 ? -2 : 2) * ((i + n) % 3 === 0 ? 1 : 0);
    return n === 0 ? sparkle(x + 1, y, "F", "f") : [[x, y, n % 2 ? "f" : "i"]];
  });
const ICE_BOLT: Character = {
  id: "ice-bolt",
  name: "Ice bolt",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: BOLT_PALETTE,
  parts: { bolt: boltPart, glow: boltGlow },
  anims: {
    /** In flight: shimmering, sparkles trailing. Loops while it flies. */
    fly: {
      loop: true,
      frames: [0, 1, 2, 3].map((i) => ({
        ms: 60,
        layers: [
          { part: "glow", x: 5, y: 10 },
          { part: "bolt", x: 11, y: 13 },
        ],
        pal: i % 2 ? { F: "#e8fbff", i: "#ffffff" } : undefined,
        specks: trail(i),
      })),
    },
  },
};

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

const PIE_SPLAT: Character = {
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

const PIE_FLY: Character = {
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

// ---- The blizzard (Ginger's ultimate): a bank of cloud and snow sweeping across the whole board.

const SNOW_PALETTE = {
  k: "#41566e", // cloud outline
  c: "#f4f8fc",
  C: "#d3e1ee",
  D: "#9db3c8",
  n: "#ffffff",
  N: "#cfe6f7",
  h: "#eaf6ff80", // haze behind the front, see-through
  H: "#eaf6ff48",
  G: "#eaf6ff20",
} as const;

const BOARD = 8 * BOARD_CELL;

/**
 * The front: a wall of puffs taller than the board, in three ragged columns, drawn back to front (left to right) so
 * each puff's shaded lower right shows against the next.
 */
const cloudBank: Part = (() => {
  const W = 76;
  const H = BOARD + 24;
  const cv = canvas(W, H);
  const puffs: { x: number; y: number; r: number }[] = [];
  for (let y = -6, n = 0; y < H + 16; y += 9, n++) {
    const h = (n * 2654435761) >>> 0;
    puffs.push({ x: 14 + (h % 7), y, r: 12 + (h % 4) });
    puffs.push({ x: 34 + ((h >>> 3) % 9), y: y + 4, r: 11 + ((h >>> 6) % 5) });
    if (n % 3 !== 1) puffs.push({ x: 50 + ((h >>> 9) % 15), y: y + ((h >>> 15) % 7), r: 6 + ((h >>> 12) % 8) });
  }
  puffs.sort((a, b) => a.x - b.x);
  for (const p of puffs) shade(cv, inEllipse(p.x, p.y, p.r, p.r * 0.85), "DCccc", roundLight(p.x - 2, p.y - 2, p.r, p.r * 0.85, 0.12));
  return { grid: toGrid(cv) };
})();
/** The haze behind it, thinning out in three steps. */
const haze: Part = (() => {
  const cv = canvas(90, BOARD + 24);
  cv.forEach((row) => row.forEach((_, x) => (row[x] = x >= 66 ? "h" : x >= 36 ? "H" : "G")));
  return { grid: toGrid(cv), outline: false };
})();

/** Driven snow, blowing right and a little down: streaks near the front, flakes in the haze behind it. */
const drift = (i: number, bx: number, n = 170): Speck[] =>
  Array.from({ length: n }, (_, k): Speck[] => {
    const h = (k * 2654435761) >>> 0;
    const x = bx - 120 + ((h % 260) + i * 6) % 260;
    const y = ((h >>> 8) % BOARD + i * 5) % BOARD;
    if (x < 0 || x > BOARD - 4 || y > BOARD - 2) return [];
    const ahead = x > bx + 50;
    if (ahead && x > bx + 110) return [];
    if (!ahead && x < bx - 100 && k % 2) return [];
    const c = k % 3 ? "n" : "N";
    return ahead || k % 4 === 0 ? [[x, y, c], [x + 1, y, c], [x + 2, y + 1, "N"], [x + 3, y + 1, "N"]] : k % 5 === 0 ? [[x, y, "n"], [x + 1, y, "n"], [x, y + 1, "n"], [x + 1, y + 1, "N"]] : [[x, y, c]];
  }).flat();

const SWEEP_FRAMES = 18;
const BLIZZARD_SWEEP: Character = {
  id: "blizzard-sweep",
  name: "Blizzard sweep",
  w: BOARD,
  h: BOARD,
  foot: [BOARD / 2, BOARD - 1],
  palette: SNOW_PALETTE,
  parts: { cloudBank, haze },
  anims: {
    /** The storm crosses the board, left to right, in about 1.3 s: snow ahead, the cloud front, haze behind. The last frame is empty. */
    sweep: {
      loop: false,
      frames: [
        ...Array.from({ length: SWEEP_FRAMES }, (_, i): Frame => {
          const bx = -70 + Math.round((i * (BOARD + 90)) / (SWEEP_FRAMES - 2));
          const layers: Layer[] = [
            { part: "haze", x: bx - 80, y: -12 },
            { part: "cloudBank", x: bx, y: -12 },
          ];
          return { ms: 70, cue: i === 0 ? "wind" : undefined, layers, specks: drift(i, bx) };
        }),
        { ms: 60, layers: [] },
      ],
    },
  },
};

// ---- G-REX's fire: a tile that burns up in three stages, a piece burnt to ash, his thrown sparkler, the Roman
// candle's rockets, the fireballs that fall from them, and the count of shots still up there.

const FIRE_PALETTE = {
  k: "#2a0d05", // outline
  y: "#fff7b8", // flames: core to rim
  Y: "#ffd23a",
  f: "#ff9a1f",
  F: "#f2541b",
  R: "#b3270f",
  x: "#ffffff",
  a: "#ff8a1a30", // heat on the tile, see-through: faint, warm, hot
  A: "#ff6a1a50",
  H: "#ff5a1a78",
  b: "#4a200c55", // scorch, see-through: singe, burn, char
  B: "#3a160888",
  C: "#220c04b0",
  e: "#ff6a1a", // embers
  s: "#5c565f99", // smoke and ash
  S: "#8d8792",
  T: "#c4bec8",
  c: "#2b2226", // charred piece, its cracks glowing
  d: "#463a3e",
  w: "#9a9aa6", // sparkler wire
  W: "#55555f",
  q: "#e5566a", // the rocket's paper
  v: "#3f74d6",
} as const;

/** Lays a flame tongue onto a canvas, its base's middle at (cx, base); where flames overlap, the hotter colour wins. */
function putFlame(cv: Canvas, cx: number, base: number, w: number, h: number, seed: number, lean = 0): void {
  const g = flame(w, h, seed, lean);
  const HEAT = "RFfYy";
  g.forEach((row, y) =>
    [...row].forEach((k, x) => {
      if (k === ".") return;
      const X = cx - Math.floor(w / 2) + x;
      const Y = base - h + 1 + y;
      const cur = cv[Y]?.[X];
      if (cur === undefined) return;
      if (!HEAT.includes(cur) || HEAT.indexOf(k) > HEAT.indexOf(cur)) cv[Y]![X] = k;
    }),
  );
}

/** A seeded random number generator. */
function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}

/** How the tile looks at each stage (1 a singe at its borders, 2 more burn, 3 ablaze). */
const STAGE = {
  1: { scorch: 3, heat: "", flames: 4, tall: 5, sides: 0 },
  2: { scorch: 4, heat: "a", flames: 5, tall: 7, sides: 2 },
  3: { scorch: 6, heat: "A", flames: 7, tall: 13, sides: 4 },
} as const;
type Stage = keyof typeof STAGE;

/** The scorch round a burning tile, `depth` pixels in from its edges, darkest at the edge, ragged on the inside. */
function scorch(depth: number): Part {
  const cv = canvas(SQUARE, SQUARE);
  for (let y = 0; y < SQUARE; y++)
    for (let x = 0; x < SQUARE; x++) {
      const d = Math.min(x, y, SQUARE - 1 - x, SQUARE - 1 - y);
      const reach = depth + (((x * 7 + y * 13) >>> 0) % 3 === 0 ? 1 : 0) - ((x * 5 + y * 3) % 4 === 0 ? 1 : 0);
      if (d < reach) cv[y]![x] = d < depth / 3 ? "C" : d < (depth * 2) / 3 ? "B" : "b";
    }
  return { grid: toGrid(cv), outline: false };
}
/** The heat on a tile, see-through, over its middle. */
function heat(k: string): Part {
  const cv = canvas(SQUARE, SQUARE);
  cv.forEach((row) => row.fill(k));
  return { grid: toGrid(cv), outline: false };
}

/**
 * The flames on a burning tile at a stage, flicker `i`: tongues along its bottom edge (taller in the middle at stage 3,
 * so a piece still shows above them), some up its sides, and corner flickers. No outline: they glow.
 */
function tileFlames(stage: Stage, i: number, boost = 0): Part {
  const cv = canvas(SQUARE, SQUARE);
  const st = STAGE[stage];
  const rnd = seeded(stage * 100 + i * 7 + boost * 1000 + 1);
  const n = st.flames;
  for (let t = 0; t < n; t++) {
    const cx = Math.round(3 + ((SQUARE - 7) * (t + 0.5)) / n + (rnd() - 0.5) * 2);
    const h = Math.max(3, Math.round(st.tall * (0.6 + rnd() * 0.5) + boost * 3 - (stage === 3 ? Math.abs(cx - 16) / 6 : 0)));
    putFlame(cv, cx, SQUARE - 1, Math.max(3, Math.round(h / 2) + 1), h, i * 1.7 + t * 2.3, (rnd() - 0.5) * 3);
  }
  for (let t = 0; t < st.sides; t++) {
    const y = SQUARE - 6 - Math.round(((SQUARE - 10) * (t + 0.5)) / st.sides);
    const h = 3 + Math.round(rnd() * (2 + stage)) + boost * 2;
    putFlame(cv, t % 2 ? SQUARE - 2 : 1, y, 3, h, i + t * 3.1, t % 2 ? -1 : 1);
    putFlame(cv, t % 2 ? 1 : SQUARE - 2, y + 3, 3, h - 1, i + t * 1.3 + 2, t % 2 ? 1 : -1);
  }
  if (stage === 1) {
    // A singe: flickers in two corners and a smoulder along the top edge.
    putFlame(cv, 2, 4 + (i % 2), 3, 3 + (i % 2), i + 5);
    putFlame(cv, SQUARE - 3, 3 + ((i + 1) % 2), 3, 3 + ((i + 1) % 2), i + 9);
  }
  return { grid: toGrid(cv), outline: false };
}

/** Embers rising off a tile (`t` frames in), more at higher stages. */
const tileEmbers = (stage: number, t: number): Speck[] =>
  Array.from({ length: stage * 2 }, (_, i): Speck => {
    const h = ((i + 1) * 2654435761) >>> 0;
    const x = 3 + (h % 26);
    const y = SQUARE - 4 - ((((h >>> 8) % 24) + t * 3) % 26);
    return [x, Math.max(1, y), i % 3 === 0 ? "Y" : "e"];
  });

const FIRE_PARTS: Record<string, Part> = {};
for (const st of [1, 2, 3] as const) {
  FIRE_PARTS[`scorch${st}`] = scorch(STAGE[st].scorch);
  for (let i = 0; i < 4; i++) FIRE_PARTS[`flames${st}:${i}`] = tileFlames(st, i);
  FIRE_PARTS[`flare${st}`] = tileFlames(st, 0, 1);
}
FIRE_PARTS.heata = heat("a");
FIRE_PARTS.heatA = heat("A");
FIRE_PARTS.heatH = heat("H");

/** A burning tile at a stage, flicker `i`. */
const tileLayers = (st: Stage, i: number): Layer[] => [
  ...(STAGE[st].heat ? [{ part: `heat${STAGE[st].heat}`, x: 0, y: 0 }] : []),
  { part: `scorch${st}`, x: 0, y: 0 },
  { part: `flames${st}:${i % 4}`, x: 0, y: 0 },
];
const stageLoop = (st: Stage): Anim => ({
  loop: true,
  frames: [0, 1, 2, 3].map((i): Frame => ({ ms: 130, layers: tileLayers(st, i), specks: st > 1 ? tileEmbers(st, i) : i % 2 ? [[4 + i * 6, 2, "s"]] : undefined })),
});

/** A white-hot star (a spark landing, a burst). */
const star = (x: number, y: number, r: number): Speck[] => [
  [x, y, "x"],
  ...[1, 2, 3, 4, 5, 6].filter((d) => d <= r).flatMap((d): Speck[] => {
    const k = d <= 1 ? "y" : d <= r / 2 ? "Y" : "f";
    return [[x + d, y, k], [x - d, y, k], [x, y + d, k], [x, y - d, k], ...(d <= r / 2 ? ([[x + d, y + d, "f"], [x - d, y - d, "f"], [x + d, y - d, "f"], [x - d, y + d, "f"]] as Speck[]) : [])];
  }),
];
/** A ring of fire running out from the middle to the tile's edges (`r` 0 to 15). */
const ring = (r: number): Speck[] =>
  Array.from({ length: 20 }, (_, i): Speck[] => {
    const a = (i / 20) * Math.PI * 2;
    const x = Math.round(16 + Math.cos(a) * r);
    const y = Math.round(16 + Math.sin(a) * r);
    return x < 1 || y < 1 || x > 30 || y > 30 ? [] : [[x, y, i % 2 ? "f" : "Y"]];
  }).flat();
/** Smoke curling up (`t` frames in), from `n` points along the tile. */
const smoke = (t: number, n = 3, y0 = 26): Speck[] =>
  Array.from({ length: n }, (_, i): Speck[] => {
    const x = 6 + Math.round((i * 20) / Math.max(1, n - 1)) + Math.round(Math.sin(t + i) * 1.5);
    const y = y0 - t * 3 - (i % 2) * 2;
    return y < 1 ? [] : [[x, y, "S"], [x + 1, y, "s"], [x, y - 1, "s"], [x + 1, y + 1, "T"]];
  }).flat();
/** A whole palette made see-through by `alpha` (two hex digits): fading out. */
const fadeFire = (alpha: string): Record<string, string> =>
  Object.fromEntries(Object.entries(FIRE_PALETTE).filter(([k]) => k !== "k").map(([k, v]) => [k, v.length === 9 ? `${v.slice(0, 7)}${Math.round((parseInt(v.slice(7), 16) * parseInt(alpha, 16)) / 255).toString(16).padStart(2, "0")}` : `${v}${alpha}`]));

/** Steps a tile up a stage: the flames leap up and flash, then settle at the new stage. */
const spread = (to: 2 | 3): Anim => ({
  loop: false,
  frames: [
    { ms: 70, cue: "crackle", layers: [...tileLayers((to - 1) as Stage, 0).slice(0, -1), { part: `flare${(to - 1) as Stage}`, x: 0, y: 0 }], specks: tileEmbers(to, 0) },
    { ms: 90, layers: [{ part: "heatH", x: 0, y: 0 }, { part: `scorch${to}`, x: 0, y: 0 }, { part: `flare${to}`, x: 0, y: 0 }], specks: tileEmbers(to + 1, 1) },
    { ms: 110, layers: tileLayers(to, 1), specks: tileEmbers(to, 2) },
  ],
});

const FIRE_TILE: Character = {
  id: "fire-tile",
  name: "A tile on fire",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: FIRE_PALETTE,
  parts: FIRE_PARTS,
  anims: {
    /** The sparkler lands in the middle: a white-hot star, a ring of fire runs out to the edges, and the borders singe. */
    ignite: {
      loop: false,
      frames: [
        { ms: 70, cue: "crackle", layers: [], specks: star(16, 16, 3) },
        { ms: 70, layers: [{ part: "heata", x: 0, y: 0 }], specks: [...star(16, 16, 5), ...ring(6)] },
        { ms: 80, layers: [{ part: "heata", x: 0, y: 0 }], specks: [...star(16, 16, 2), ...ring(11)] },
        { ms: 90, layers: [{ part: "scorch1", x: 0, y: 0 }, { part: "flare1", x: 0, y: 0 }], specks: ring(15) },
        { ms: 110, layers: tileLayers(1, 0) },
      ],
    },
    /** Stage 1, while it lasts: a light singe at the tile's borders, a few small flickers. */
    stage1: stageLoop(1),
    /** Up to stage 2: the flames leap, then settle. */
    spread2: spread(2),
    /** Stage 2, while it lasts: the scorch creeps in, flames along the bottom and up the sides, embers. */
    stage2: stageLoop(2),
    spread3: spread(3),
    /** Stage 3, while it lasts: ablaze. The tile glows, flames climb its sides and burn tall along the bottom (lower in the middle, where a piece stands). */
    stage3: stageLoop(3),
    /** It burns out (after a piece burnt up on it, or none was there): the flames die to embers and smoke, the scorch fades. The last frame is empty. */
    burnOut: {
      loop: false,
      frames: [
        { ms: 90, cue: "crackle", layers: [{ part: "heata", x: 0, y: 0 }, { part: "scorch3", x: 0, y: 0 }, { part: "flames2:0", x: 0, y: 0 }], specks: tileEmbers(3, 0) },
        { ms: 100, layers: [{ part: "scorch3", x: 0, y: 0 }, { part: "flames1:1", x: 0, y: 0 }], specks: [...tileEmbers(2, 1), ...smoke(0)] },
        { ms: 110, layers: [{ part: "scorch2", x: 0, y: 0 }], specks: [...tileEmbers(1, 2), ...smoke(1)] },
        { ms: 120, layers: [{ part: "scorch2", x: 0, y: 0 }], pal: fadeFire("90"), specks: smoke(2) },
        { ms: 120, layers: [{ part: "scorch1", x: 0, y: 0 }], pal: fadeFire("50"), specks: smoke(3, 2) },
        { ms: 120, layers: [{ part: "scorch1", x: 0, y: 0 }], pal: fadeFire("20"), specks: smoke(4, 2) },
        { ms: 60, layers: [] },
      ],
    },
    /** The king is fireproof: the fire just fizzles out under him, a puff of smoke and a couple of sparks. The last frame is empty. */
    fizzle: {
      loop: false,
      frames: [
        { ms: 80, cue: "fizzle", layers: [{ part: "scorch2", x: 0, y: 0 }, { part: "flames1:0", x: 0, y: 0 }], specks: [[8, 20, "x"], [24, 18, "x"]] },
        { ms: 90, layers: [{ part: "scorch1", x: 0, y: 0 }], specks: [...smoke(0, 2, 28), [6, 16, "Y"], [26, 14, "Y"]] },
        { ms: 110, layers: [{ part: "scorch1", x: 0, y: 0 }], pal: fadeFire("60"), specks: smoke(1, 2, 28) },
        { ms: 110, layers: [], specks: smoke(2, 2, 28) },
        { ms: 60, layers: [] },
      ],
    },
  },
};

// ---- A piece burnt up: flames engulf it, it chars, then crumbles into ash and embers.

/** The silhouettes of the pieces that can burn (never the king), base at the bottom middle of a square. */
function silhouette(piece: "p" | "n" | "b" | "r" | "q"): Canvas {
  const cv = canvas(SQUARE, SQUARE);
  const base = () => ellipse(cv, 16, 26.5, 9, 2.6, "c");
  base();
  switch (piece) {
    case "p":
      poly(cv, [[12.5, 25], [19.5, 25], [17.6, 16], [14.4, 16]], "c");
      ellipse(cv, 16, 15.5, 4.6, 1.6, "c");
      ellipse(cv, 16, 11, 3.8, 3.8, "c");
      break;
    case "r":
      poly(cv, [[10.5, 25], [21.5, 25], [20.5, 13], [11.5, 13]], "c");
      poly(cv, [[9, 13], [23, 13], [23, 6], [9, 6]], "c");
      for (const x of [12, 13, 18, 19]) for (const y of [6, 7, 8]) cv[y]![x] = ".";
      break;
    case "b":
      poly(cv, [[11.5, 25], [20.5, 25], [18, 16], [14, 16]], "c");
      ellipse(cv, 16, 15.5, 4.8, 1.6, "c");
      ellipse(cv, 16, 10.5, 3.9, 5.2, "c");
      ellipse(cv, 16, 4.5, 1.4, 1.4, "c");
      line(cv, 17, 8, 18, 11, ".");
      break;
    case "n":
      poly(cv, [[10, 25], [22, 25], [21.5, 17], [20.5, 10], [17.5, 5.5], [13.5, 5], [10, 7.5], [7, 11.5], [7.5, 14], [11, 13], [13.5, 13.5], [11, 19]], "c");
      cv[6]![15] = ".";
      break;
    case "q":
      poly(cv, [[11, 25], [21, 25], [18.5, 13], [13.5, 13]], "c");
      poly(cv, [[10, 13], [22, 13], [23, 6], [20, 9.5], [18, 5], [16, 9], [14, 5], [12, 9.5], [9, 6]], "c");
      for (const [x, y] of [[9, 5], [14, 4], [18, 4], [23, 5], [16, 7]] as const) ellipse(cv, x + 0.5, y + 0.5, 1.2, 1.2, "c");
      break;
  }
  return cv;
}
/** A charred piece with glowing cracks, its top `gone` rows crumbled away. */
function charred(piece: "p" | "n" | "b" | "r" | "q", gone: number): Part {
  const cv = silhouette(piece);
  const rnd = seeded(piece.charCodeAt(0));
  // Shading (lighter on the left), then glowing cracks zigzagging down it.
  cv.forEach((row, y) => row.forEach((k, x) => k === "c" && x < 14 && (x + y) % 5 !== 0 && (cv[y]![x] = "d")));
  for (let c = 0; c < 3; c++) {
    let x = 12 + Math.round(rnd() * 8);
    for (let y = 6 + c * 6; y < 24; y++) {
      if (cv[y]![x] === "c" || cv[y]![x] === "d") cv[y]![x] = y % 3 ? "e" : "f";
      x += rnd() < 0.5 ? -1 : 1;
      if (rnd() < 0.3) break;
    }
  }
  const top = cv.findIndex((row) => row.some((k) => k !== "."));
  for (let y = 0; y < top + gone && y < SQUARE; y++) cv[y]!.fill(".");
  // The crumbling edge glows.
  const edgeRow = top + gone;
  if (gone > 0 && cv[edgeRow]) cv[edgeRow]!.forEach((k, x) => k !== "." && (cv[edgeRow]![x] = x % 2 ? "e" : "f"));
  return { grid: toGrid(cv) };
}
/** Ash falling from the crumbling edge, and embers rising from it (`t` frames into the crumble). */
const ashFall = (t: number, edge: number): Speck[] =>
  Array.from({ length: 10 }, (_, i): Speck => {
    const up = i % 3 === 0;
    const x = 9 + ((i * 7) % 15);
    const y = up ? edge - 2 - ((t + i) % 4) * 3 : edge + 1 + ((t * 2 + i) % 6);
    return [x, Math.max(1, Math.min(30, y)), up ? (i % 2 ? "Y" : "e") : i % 2 ? "S" : "T"];
  });
/** The heap of ash left behind, with embers in it. */
const ASH_HEAP: Part = (() => {
  const cv = canvas(16, 5);
  ellipse(cv, 8, 4.5, 8, 4, "S");
  ellipse(cv, 7, 4, 4.5, 2.4, "T");
  for (const [x, y] of [[4, 3], [10, 2], [12, 3]] as const) cv[y]![x] = "e";
  return { grid: toGrid(cv) };
})();

const PIECES = ["p", "n", "b", "r", "q"] as const;
const BURN_PARTS: Record<string, Part> = { ash: ASH_HEAP, heatH: FIRE_PARTS.heatH!, flare3: FIRE_PARTS.flare3!, "flames3:0": FIRE_PARTS["flames3:0"]!, "flames2:1": FIRE_PARTS["flames2:1"]! };
/** Engulfing flames: tall tongues right across the square. */
const engulf = (i: number): Part => {
  const cv = canvas(SQUARE, SQUARE);
  for (let t = 0; t < 6; t++) putFlame(cv, 4 + t * 5, SQUARE - 1, 7, 18 + ((t * 5 + i * 3) % 9), i * 2 + t * 1.9, ((t % 3) - 1) * 2);
  return { grid: toGrid(cv), outline: false };
};
BURN_PARTS.engulf0 = engulf(0);
BURN_PARTS.engulf1 = engulf(1);
for (const pc of PIECES) for (const g of [0, 4, 8, 12, 16, 20]) BURN_PARTS[`char:${pc}:${g}`] = charred(pc, g);

/**
 * A piece burning up, played over it: flames engulf it (the real piece still under them), a white flash (the frame with
 * the "poof" cue: take the piece off the board there), its charred shape glowing through the flames, crumbling from the
 * top into ash and embers, a heap of ash, gone. `piece` none: the same without a shape (any piece, or none).
 */
function burnUp(piece?: (typeof PIECES)[number]): Anim {
  const ch = (g: number): Layer[] => (piece ? [{ part: `char:${piece}:${g}`, x: 0, y: 0 }] : []);
  // Where the crumbling edge is, for the ash (the shapes' tops are about row 4).
  const edge = (g: number) => 4 + g;
  return {
    loop: false,
    frames: [
      { ms: 80, layers: [{ part: "heatH", x: 0, y: 0 }, { part: "engulf0", x: 0, y: 0 }] },
      { ms: 90, cue: "poof", layers: [{ part: "heatH", x: 0, y: 0 }, { part: "engulf1", x: 0, y: 0 }], specks: star(16, 14, 6) },
      { ms: 100, layers: [...ch(0), { part: "flare3", x: 0, y: 0 }], specks: tileEmbers(3, 0) },
      { ms: 100, layers: [...ch(0), { part: "flames3:0", x: 0, y: 0 }], specks: tileEmbers(3, 1) },
      ...[4, 8, 12, 16, 20].map((g, i): Frame => ({ ms: 100, layers: [...ch(g), ...(i < 2 ? [{ part: "flames2:1", x: 0, y: 0 }] : [])], specks: ashFall(i, edge(g)) })),
      { ms: 140, layers: [{ part: "ash", x: 8, y: 25 }], specks: [...ashFall(5, 26).filter((s) => s[2] === "e" || s[2] === "Y"), ...smoke(0, 2)] },
      { ms: 160, layers: [{ part: "ash", x: 8, y: 25 }], specks: smoke(1, 2) },
      { ms: 140, layers: [{ part: "ash", x: 8, y: 25 }], pal: fadeFire("80"), specks: smoke(2, 2) },
      { ms: 120, layers: [{ part: "ash", x: 8, y: 25 }], pal: { ...fadeFire("30"), k: "#2a0d0540" } },
      { ms: 60, layers: [] },
    ],
  };
}

const PIECE_BURN: Character = {
  id: "piece-burn",
  name: "A piece burning up",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: FIRE_PALETTE,
  parts: BURN_PARTS,
  anims: { burn: burnUp(), ...Object.fromEntries(PIECES.map((pc) => [pc, burnUp(pc)])) },
};

// ---- G-REX's sparkler, thrown, tumbling end over end to its square.

const sparklerPart = (dir: Pt): Part => {
  const cv = canvas(13, 13);
  for (let d = -5; d <= 3; d++) {
    const x = 6 + Math.round(dir[0] * d);
    const y = 6 + Math.round(dir[1] * d);
    cv[y]![x] = d >= 2 ? "f" : d % 3 ? "w" : "W";
  }
  return { grid: toGrid(cv) };
};
const SPARK_DIRS: readonly Pt[] = [[1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7]];
/** The sparkler's fizzing head: a white core, rays and loose sparks, seeded. */
const fizz = (x: number, y: number, seed: number): Speck[] => {
  const rnd = seeded(seed);
  const out: Speck[] = [...star(x, y, 2 + (seed % 2))];
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 3 + rnd() * 4;
    out.push([Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), d > 5.5 ? "F" : "f"]);
  }
  return out;
};
const SPARK_FLY: Character = {
  id: "spark-fly",
  name: "Sparkler in flight",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: FIRE_PALETTE,
  parts: Object.fromEntries(SPARK_DIRS.map((d, i) => [`s${i}`, sparklerPart(d)])),
  anims: {
    /** In flight, tumbling end over end (an eighth of a turn a frame), its head fizzing. Loops while it flies; move it, no need to turn it. */
    fly: {
      loop: true,
      frames: SPARK_DIRS.map((d, i): Frame => ({
        ms: 50,
        layers: [{ part: `s${i}`, x: 10, y: 10 }],
        specks: [...fizz(16 + Math.round(d[0] * 4), 16 + Math.round(d[1] * 4), i + 1), ...([[16 - Math.round(d[0] * 9), 16 - Math.round(d[1] * 9), "e"]] as Speck[])],
      })),
    },
  },
};

// ---- The Roman candle's rocket, streaking up.

const ROCKET: Part = { grid: [".x.", "xyx", "qYq", "qvq", "qqq"] };
const rocketTrail = (i: number): Speck[] =>
  Array.from({ length: 18 }, (_, d): Speck[] => {
    const y = 15 + d;
    if (y > 30) return [];
    const wob = ((d + i) % 3) - 1;
    const k = d < 3 ? "y" : d < 6 ? "Y" : d < 10 ? "f" : d < 14 ? "F" : "R";
    return d % 4 === 3 ? [[16 + wob * 2, y, k]] : [[16 + wob, y, k], ...(d < 8 ? ([[16 - wob, y, "f"]] as Speck[]) : [])];
  }).flat();
const CANDLE_SHOT: Character = {
  id: "candle-shot",
  name: "Roman candle rocket",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: FIRE_PALETTE,
  parts: { rocket: ROCKET },
  anims: {
    /** Streaking up, its trail sparkling below it. Loops while it flies; move it up (it points up). */
    fly: { loop: true, frames: [0, 1, 2].map((i): Frame => ({ ms: 60, layers: [{ part: "rocket", x: 15, y: 9 }], specks: [...rocketTrail(i), ...(i === 1 ? ([[13, 6, "x"], [19, 7, "Y"]] as Speck[]) : [])] })) },
    /** It bursts high up (a little star, then sparks falling away). The last frame is empty. */
    pop: {
      loop: false,
      frames: [
        { ms: 70, layers: [], specks: star(16, 12, 4) },
        { ms: 80, layers: [], specks: [...star(16, 12, 2), ...ring(8).map(([x, y, k]): Speck => [x, y - 4, k])] },
        { ms: 90, layers: [], specks: ring(12).map(([x, y]): Speck => [x, y - 2, "F"]) },
        { ms: 60, layers: [] },
      ],
    },
  },
};

// ---- A fireball falling onto a square (the Roman candle's shots coming down), becoming a stage-1 fire tile.

const FIREBALL: Part = (() => {
  const cv = canvas(13, 22);
  // The trail above (flames streaming up), then the ball at the bottom.
  for (let t = 0; t < 4; t++) putFlame(cv, 6 + ((t % 3) - 1) * 2, 14, 5, 12 - t * 2, t * 1.7, 0);
  for (let y = 0; y < 22; y++)
    for (let x = 0; x < 13; x++) {
      const d = Math.hypot(x - 6, (y - 15.5) * 1.05);
      if (d <= 5.6) cv[y]![x] = d < 2 ? "x" : d < 3.4 ? "y" : d < 4.6 ? "Y" : "f";
    }
  return { grid: toGrid(cv), outline: false };
})();
const FALL_PARTS: Record<string, Part> = { ...FIRE_PARTS, fireball: FIREBALL, fireballF: { grid: FIREBALL.grid.map((r) => [...r].reverse().join("")), outline: false } };
const FIREBALL_FALL: Character = {
  id: "fireball-fall",
  name: "Fireball falling",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: FIRE_PALETTE,
  parts: FALL_PARTS,
  anims: {
    /** Falling: a fireball, its flames streaming up behind it. Loops while it falls; move it down onto the square. */
    fall: { loop: true, frames: [0, 1, 2, 3].map((i): Frame => ({ ms: 60, layers: [{ part: i % 2 ? "fireballF" : "fireball", x: 10, y: 6 }], specks: tileEmbers(1, i).map(([x, y, k]): Speck => [x, Math.min(30, y + 4), k]) })) },
    /**
     * It lands on the square: a burst of flame and embers, then it settles into a stage-1 fire tile (its last frame is
     * the fire tile's `stage1` first frame: carry on with fireTile `stage1` on the square).
     */
    land: {
      loop: false,
      frames: [
        { ms: 70, cue: "land", layers: [{ part: "heatH", x: 0, y: 0 }, { part: "flare3", x: 0, y: 0 }], specks: star(16, 20, 6) },
        { ms: 80, layers: [{ part: "heatA", x: 0, y: 0 }, { part: "scorch2", x: 0, y: 0 }, { part: "flare2", x: 0, y: 0 }], specks: [...ring(12), ...tileEmbers(3, 1)] },
        { ms: 100, layers: [{ part: "scorch1", x: 0, y: 0 }, { part: "flare1", x: 0, y: 0 }], specks: [...ring(15), ...tileEmbers(2, 2)] },
        { ms: 110, layers: tileLayers(1, 0) },
      ],
    },
  },
};

// ---- The shots still up there: a column of 24 little rockets by the board's right edge, lit while they're up, spent
// once they've fallen (lit from the bottom: the column empties from the top down as they come down).

const SHOTS = 24;
const PIP_H = 6;
const pipLit: Part = { grid: [".Y.", "yxy", "qYq", "qvq", "qqq"] };
const pipSpent: Part = { grid: ["...", ".s.", "sss", "sSs", "sss"], outline: false };
const CANDLE_SHOTS: Character = {
  id: "candle-shots",
  name: "Shots still up there",
  w: 7,
  h: SHOTS * PIP_H + 2,
  foot: [3, SHOTS * PIP_H + 1],
  palette: FIRE_PALETTE,
  parts: { lit: pipLit, spent: pipSpent },
  anims: Object.fromEntries(
    Array.from({ length: SHOTS + 1 }, (_, left): [string, Anim] => [
      `left${left}`,
      {
        loop: true,
        frames: [0, 1, 2, 3].map((i): Frame => ({
          ms: 140,
          // (Pip n from the top; the bottom `left` are lit.)
          layers: Array.from({ length: SHOTS }, (_, n): Layer => ({ part: n >= SHOTS - left ? "lit" : "spent", x: 2, y: 2 + n * PIP_H })),
          // Each lit one's little flame flickers above it, out of step with its neighbours.
          specks: Array.from({ length: left }, (_, j): Speck => {
            const n = SHOTS - 1 - j;
            return [3, 1 + n * PIP_H - ((n + i) % 2), (n + i) % 3 ? "f" : "Y"];
          }),
        })),
      },
    ]),
  ),
};

// ---- A fireball's shadow on the square it will hit: small three turns out, bigger the next turn, bigger again the turn
// before it lands. Drawn under the pieces (so a piece on the square stands on it), see-through.

const SHADOW_PALETTE = {
  k: "#00000000",
  o: "#140a0640", // the soft rim
  p: "#140a0666",
  q: "#140a0690", // the dark core
  h: "#ff6a1a3a", // the fireball's glow on the ground (the biggest only)
} as const;
/** Its radius at each size (1 to 3), in the square's 32 pixels. */
export const SHADOW_R = [0, 5, 8.5, 12] as const;
function shadowPart(r: number, glow: boolean): Part {
  const cv = canvas(SQUARE, SQUARE);
  if (glow) ellipse(cv, 16, 16, r + 1.6, r + 1.6, "h");
  ellipse(cv, 16, 16, r, r, "o");
  ellipse(cv, 16, 16, r * 0.72, r * 0.72, "p");
  ellipse(cv, 16, 16, r * 0.42, r * 0.42, "q");
  return { grid: toGrid(cv), outline: false };
}
const SHADOW_PARTS: Record<string, Part> = {};
const shadowFrames = (from: number, to: number, glow: boolean): Frame[] =>
  [0.34, 0.67, 1].map((t, i): Frame => {
    const r = Math.round((from + (to - from) * t) * 2) / 2;
    const name = `r${r}${glow ? "g" : ""}`;
    SHADOW_PARTS[name] ??= shadowPart(r, glow);
    return { ms: i === 2 ? 90 : 70, layers: [{ part: name, x: 0, y: 0 }] };
  });
/** Its loop at a size: it breathes a little (half a pixel), so it reads as something above, coming. */
const shadowLoop = (size: 1 | 2 | 3): Anim => ({
  loop: true,
  frames: [SHADOW_R[size], SHADOW_R[size] + 0.5].map((r, i): Frame => {
    const name = `r${r}${size === 3 ? "g" : ""}`;
    SHADOW_PARTS[name] ??= shadowPart(r, size === 3);
    return { ms: i ? 260 : 300, layers: [{ part: name, x: 0, y: 0 }] };
  }),
});
const FIRE_SHADOW: Character = {
  id: "fire-shadow",
  name: "A fireball's shadow",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: SHADOW_PALETTE,
  parts: SHADOW_PARTS,
  anims: {
    /** It appears (small), grows to the middle size, grows to the biggest; each then loops at that size. */
    grow1: { loop: false, frames: shadowFrames(1, SHADOW_R[1], false) },
    grow2: { loop: false, frames: shadowFrames(SHADOW_R[1], SHADOW_R[2], false) },
    grow3: { loop: false, frames: shadowFrames(SHADOW_R[2], SHADOW_R[3], true) },
    shadow1: shadowLoop(1),
    shadow2: shadowLoop(2),
    shadow3: shadowLoop(3),
  },
};

/** Every effect sprite, by name. */
export const EFFECT_SPRITES = {
  iceOverlay: ICE_OVERLAY,
  iceBolt: ICE_BOLT,
  blizzardSweep: BLIZZARD_SWEEP,
  pieSplat: PIE_SPLAT,
  pieFly: PIE_FLY,
  fireTile: FIRE_TILE,
  pieceBurn: PIECE_BURN,
  sparkFly: SPARK_FLY,
  candleShot: CANDLE_SHOT,
  fireballFall: FIREBALL_FALL,
  candleShots: CANDLE_SHOTS,
  fireShadow: FIRE_SHADOW,
} as const satisfies Record<string, Character>;
