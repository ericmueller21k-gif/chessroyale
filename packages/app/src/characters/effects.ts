/**
 * Effect sprites for the bosses' powers, for the board: pixel art in the characters' format (palettes, parts,
 * frames, cues), each frame exactly the area it covers, so placing one is sizing its canvas to a square (or the whole
 * board) with `image-rendering: pixelated`. See power-art.ts for the list and how each is meant to play.
 *
 * Colours may be see-through (`#rrggbbaa`): the ice over a frozen piece lets the piece show, the blizzard's haze
 * lets the board show.
 */
import { canvas, ellipse, flame, inEllipse, inPoly, line, poly, roundLight, shade, toGrid, type Canvas } from "./paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

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
  A: "#16121f", // thinning: greyer, paler
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

const DARK_SQUARE: Character = {
  id: "dark-square",
  name: "A dark square",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: DARK_PALETTE,
  parts: DARK_PARTS,
  anims: {
    /** The darkness pours in: billows grow from the middle, swirling, and close over the square. */
    gather: {
      loop: false,
      frames: [0.25, 0.45, 0.65, 0.85, 1].map((g, i): Frame => ({
        ms: i === 4 ? 140 : 90,
        cue: i === 0 ? "gather" : undefined,
        layers: [{ part: cloudPart(`grow${g}`, () => cloud(i / 8, g)), x: 0, y: 0 }],
        specks: darkGlints(i, 2 + i),
      })),
    },
    /** Dark, while it lasts: the cloud turning slowly, violet glints twinkling in it. */
    dark: {
      loop: true,
      frames: Array.from({ length: 8 }, (_, i): Frame => ({ ms: 160, layers: [{ part: cloudPart(`dark${i}`, () => cloud(i / 8)), x: 0, y: 0 }], specks: darkGlints(i) })),
    },
    /** Its last turn: paler and greyer, wisps peeling off its top, fewer glints; the piece still hidden. */
    thin: {
      loop: true,
      frames: Array.from({ length: 8 }, (_, i): Frame => ({ ms: 160, layers: [{ part: cloudPart(`thin${i}`, () => cloud(i / 8, 1, true)), x: 0, y: 0 }], specks: [...peel(i), ...darkGlints(i, 1)] })),
    },
    /** It clears: the billows drift apart, thin out and are gone. Ends empty. */
    clear: {
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
    },
  },
};

/** The darkness in flight from his chest to its square: a churning blob trailing smoke, pointing right (turn it towards the square). */
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
const DARK_POUR: Character = {
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
    fly: {
      loop: true,
      frames: [0, 1, 2, 3].map((i): Frame => ({ ms: 70, layers: [{ part: `pour${i}`, x: 0, y: 0 }], specks: [...darkGlints(i, 2).map(([x, y, k]): Speck => [x + 4, y, k]), [3 + ((i * 5) % 7), 12 + ((i * 3) % 8), "u"]] })),
    },
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
const DARK_MISS: Character = {
  id: "dark-miss",
  name: "A miss in the dark",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: DARK_PALETTE,
  parts: {},
  anims: {
    miss: {
      loop: false,
      frames: [
        { ms: 60, layers: [], cue: "miss", specks: missX(4, "s", 2) },
        { ms: 80, layers: [], specks: [...missX(9, "R", 3), ...missX(8, "r", 2), ...missX(2, "s", 2)] },
        { ms: 260, layers: [], specks: [...missX(9, "R", 3), ...missX(8, "r", 2)] },
        { ms: 110, layers: [], specks: missX(8, "R", 2), pal: { R: "#b0204a99" } },
        { ms: 90, layers: [], specks: missX(7, "R", 1), pal: { R: "#b0204a55" } },
        { ms: 40, layers: [] },
      ],
    },
  },
};

// The strand of bulbs counting down: a wire drooping between two hooks, three bulbs hanging off it.

const STRAND_PALETTE = {
  k: "#08070c",
  w: "#3b3844",
  W: "#5d5968",
  "1": "#ff4a4a", // red, gold, blue: main, shade, glint, glow
  "4": "#b3172c",
  "7": "#ffe0da",
  "!": "#ff4a4a66",
  "2": "#ffc93a",
  "5": "#c2830f",
  "8": "#fff8d6",
  "^": "#ffc93a66",
  "3": "#4ab3ff",
  "6": "#1d5fd0",
  "9": "#e0f4ff",
  "~": "#4ab3ff66",
  o: "#2e2a36", // out: dark glass
  O: "#1d1a23",
  g: "#463f52",
  x: "#ffffff",
  U: "#c4a2ff",
} as const;
const STRAND_KEYS = [["1", "4", "7", "!"], ["2", "5", "8", "^"], ["3", "6", "9", "~"]] as const;
export const STRAND_W = 44;
export const STRAND_H = 15;
/** The bulbs' x (their middle) along the strip. */
const STRAND_X = [9, 22, 35] as const;
const strandWire: Part = (() => {
  const cv = canvas(STRAND_W, STRAND_H);
  for (let x = 1; x < STRAND_W - 1; x++) {
    const y = Math.round(2 + 2.2 * Math.sin((Math.PI * (x - 1)) / (STRAND_W - 3)) + 0.6 * Math.sin((Math.PI * 3 * (x - 1)) / (STRAND_W - 3)));
    cv[y]![x] = "w";
  }
  return { grid: toGrid(cv) };
})();
/** A bulb, 5 x 8 (a socket and a pointed glass), lit (its own colours) or out (dark glass). */
const stripBulb = (b: number, lit: boolean): Part => {
  const [M, S, G] = lit ? STRAND_KEYS[b]! : (["o", "O", "g"] as const);
  return { grid: [".WW..", ".ww..", `${G}${M}${M}${M}${S}`, `${M}${M}${M}${M}${S}`, `${M}${M}${M}${S}${S}`, `.${M}${S}${S}.`, `..${S}..`] };
};
const STRIP_PARTS: Record<string, Part> = { wire: strandWire };
for (const b of [0, 1, 2]) {
  STRIP_PARTS[`on${b}`] = stripBulb(b, true);
  STRIP_PARTS[`off${b}`] = stripBulb(b, false);
  const glow = canvas(9, 11);
  ellipse(glow, 4.5, 6.5, 4.5, 4.5, STRAND_KEYS[b]![3]);
  STRIP_PARTS[`glow${b}`] = { grid: toGrid(glow), outline: false };
}
/** Where a bulb's socket hangs off the wire. */
const bulbY = (b: number) => {
  const x = STRAND_X[b]!;
  return Math.round(2 + 2.2 * Math.sin((Math.PI * (x - 1)) / (STRAND_W - 3)) + 0.6 * Math.sin((Math.PI * 3 * (x - 1)) / (STRAND_W - 3)));
};
/** The strip with `lit` bulbs on (the first ones), bulb `flick` drawn the other way (flickering), glints on frame `g`. */
function strip(lit: number, ms: number, o: { flick?: number; g?: number; cue?: string; spark?: number } = {}): Frame {
  const layers: Layer[] = [];
  const on = (b: number) => (b < lit) !== (o.flick === b);
  for (const b of [0, 1, 2]) if (on(b)) layers.push({ part: `glow${b}`, x: STRAND_X[b]! - 4, y: bulbY(b) - 1 });
  layers.push({ part: "wire", x: 0, y: 0 });
  for (const b of [0, 1, 2]) layers.push({ part: `${on(b) ? "on" : "off"}${b}`, x: STRAND_X[b]! - 2, y: bulbY(b) + 1 });
  const specks: Speck[] = [];
  if (o.g !== undefined && lit > 0) {
    const b = o.g % lit;
    specks.push([STRAND_X[b]! - 1, bulbY(b) + 3, "x"]);
  }
  if (o.spark !== undefined) {
    const [x, y] = [STRAND_X[o.spark]!, bulbY(o.spark) + 6];
    specks.push([x, y, "x"], [x - 2, y - 1, "U"], [x + 2, y + 1, "U"], [x + 1, y + 3, "U"]);
  }
  return { ms, layers, specks, cue: o.cue };
}
/** A bulb going out (its countdown ticks down): it flickers, sparks and dies, ending with one fewer lit. */
const goOut = (from: number): Anim => {
  const b = from - 1;
  return {
    loop: false,
    frames: [strip(from, 80, { flick: b, cue: "pop" }), strip(from, 70), strip(from, 60, { flick: b }), strip(from, 50), strip(from - 1, 90, { spark: b }), strip(from - 1, 200)],
  };
};
const BULB_STRAND: Character = {
  id: "bulb-strand",
  name: "Hollow's bulbs",
  w: STRAND_W,
  h: STRAND_H,
  foot: [22, 14],
  palette: STRAND_PALETTE,
  parts: STRIP_PARTS,
  anims: {
    ...Object.fromEntries([3, 2, 1, 0].map((n) => [`lit${n}`, { loop: true, frames: n ? [0, 1, 2, 3].map((i) => strip(n, i === 0 ? 400 : 260, { g: i })) : [strip(0, 600)] } satisfies Anim])),
    out3: goOut(3),
    out2: goOut(2),
    out1: goOut(1),
    /** The strand lighting again after the last bulb went out: one by one, each flickering on. Ends with all three lit. */
    relight: {
      loop: false,
      frames: [
        strip(0, 120, { cue: "relight" }),
        strip(1, 60),
        strip(0, 50),
        strip(1, 140, { g: 0 }),
        strip(2, 60),
        strip(1, 50),
        strip(2, 140, { g: 1 }),
        strip(3, 60),
        strip(2, 50),
        strip(3, 200, { g: 2 }),
      ],
    },
  },
};

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
  dim1: { loop: false, frames: [{ ms: 60, layers: [tileLayer("dim2")] }, { ms: 60, layers: [] }, { ms: 70, layers: [tileLayer("dim1")] }, { ms: 50, layers: [] }, { ms: 300, layers: [tileLayer("dim1")] }] },
  dim2: { loop: false, frames: [{ ms: 60, layers: [tileLayer("dim2s")] }, { ms: 60, layers: [tileLayer("dim1")] }, { ms: 70, layers: [tileLayer("dim2s")] }, { ms: 50, layers: [tileLayer("dim1")] }, { ms: 300, layers: [tileLayer("dim2")] }] },
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

const NIGHT_SQUARE: Character = {
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
const NIGHT_LABEL: Character = {
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

// ---- Big Boy's toys: the toy block (an ABC block on an empty square), its flight, his bounce's dust and crash.

const TOY_PALETTE = {
  k: "#2a1712",
  o: "#f6d08e", // wood: top, front, side
  O: "#d9a159",
  D: "#a26f33",
  r: "#e2483f", // the letters' panels: red (A), blue (B), green (C); each darker on the side
  R: "#a52a26",
  u: "#3d7fe0",
  U: "#2554a8",
  g: "#3cb24c",
  G: "#24782f",
  Y: "#fff4d0", // the letter and its shade
  y: "#c9b98e",
  F: "#ffffff",
  z: "#0000004d", // its shadow on the board
  s: "#cfc6b4cc", // dust
  S: "#f3ecdccc",
} as const;

/** The block's letters, 7 x 9 (and 3 x 5 for the little one in flight), with their panel's colour key. */
const TOY_LETTERS = {
  A: { panel: "r", side: "U", big: ["..###..", ".##.##.", "##...##", "##...##", "##...##", "#######", "##...##", "##...##", "##...##"], small: [".#.", "#.#", "###", "#.#", "#.#"] },
  B: { panel: "u", side: "G", big: ["######.", "##...##", "##...##", "##...##", "######.", "##...##", "##...##", "##...##", "######."], small: ["##.", "#.#", "##.", "#.#", "##."] },
  C: { panel: "g", side: "R", big: [".#####.", "##...##", "##.....", "##.....", "##.....", "##.....", "##.....", "##...##", ".#####."], small: [".##", "#..", "#..", "#..", ".##"] },
} as const;
export type ToyLetter = keyof typeof TOY_LETTERS;
export const TOY_LETTER_NAMES = Object.keys(TOY_LETTERS) as ToyLetter[];

/**
 * A toy block seen from the front and a little above (light from the top left): a wooden cube, its front `w` x `h`
 * with a coloured panel and its letter, its top and right side `d` deep, the side's panel another colour.
 */
function toyCube(letter: ToyLetter, w: number, h: number, d: number): Part {
  const L = TOY_LETTERS[letter];
  const cv = canvas(w + d, h + d);
  // The top: light wood, slanting back to the right.
  for (let j = 0; j < d; j++) for (let x = 0; x < w; x++) cv[j]![x + d - j] = j === d - 1 || x === 0 ? "O" : "o";
  // The side: dark wood, its own panel.
  for (let i = 0; i < d; i++)
    for (let y = d - 1 - i; y < d - 1 - i + h; y++) {
      const inner = i > 0 && i < d - 1 && y > d - i + 1 && y < d - 1 - i + h - 2;
      cv[y]![w + i] = inner ? L.side : "D";
    }
  // The front: a wooden rim, the panel, the letter (with a shade down and to its right).
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cv[d + y]![x] = x < 2 || y < 2 || x >= w - 2 || y >= h - 2 ? (x === 0 || y === 0 ? "o" : "O") : L.panel;
  const glyph = w >= 14 && h >= 13 ? L.big : L.small;
  const gx = Math.floor((w - glyph[0]!.length) / 2);
  const gy = d + Math.floor((h - glyph.length) / 2);
  glyph.forEach((row, y) => [...row].forEach((c, x) => c === "#" && cv[gy + y + 1]?.[gx + x + 1] === L.panel && (cv[gy + y + 1]![gx + x + 1] = "y")));
  glyph.forEach((row, y) => [...row].forEach((c, x) => c === "#" && (cv[gy + y]![gx + x] = "Y")));
  return { grid: toGrid(cv) };
}

/** Its shadow on the board, `w` wide. */
function toyShadow(w: number): Part {
  const cv = canvas(w, 4);
  ellipse(cv, w / 2, 2, w / 2, 2, "z");
  return { grid: toGrid(cv), outline: false };
}
/** A puff of dust, `r` across. */
function dustPuff(r: number, k: "s" | "S"): Part {
  const cv = canvas(2 * r + 1, 2 * r + 1);
  shade(cv, inEllipse(r + 0.5, r + 0.5, r + 0.4, r + 0.4), k === "s" ? "sS" : "S", (x, y) => 0.9 - 0.05 * x - 0.05 * y);
  return { grid: toGrid(cv), outline: false };
}

const TOY_PARTS = (() => {
  const { parts, add } = lazyParts();
  for (const l of TOY_LETTER_NAMES) {
    add(`${l}:n`, () => toyCube(l, 18, 18, 5));
    add(`${l}:sq`, () => toyCube(l, 21, 14, 5));
    add(`${l}:st`, () => toyCube(l, 15, 21, 5));
    add(`${l}:14`, () => toyCube(l, 14, 14, 4));
    add(`${l}:9`, () => toyCube(l, 9, 9, 3));
  }
  for (const w of [8, 14, 20, 24]) add(`shadow${w}`, () => toyShadow(w));
  for (const r of [2, 3, 4, 5]) for (const k of ["s", "S"] as const) add(`puff${r}${k}`, () => dustPuff(r, k));
  return parts;
})();

/** The block's place in its square: its front's bottom-left corner on the board, `w` x `h`, `d` deep, `lift` up off it. */
const cubeAt = (l: ToyLetter, kind: "n" | "sq" | "st" | "14" | "9", lift = 0): Layer[] => {
  const [w, h, d] = ({ n: [18, 18, 5], sq: [21, 14, 5], st: [15, 21, 5], "14": [14, 14, 4], "9": [9, 9, 3] } as const)[kind];
  const x = Math.round(14 - w / 2 - d / 2 + 2);
  const y = 28 - h - d - lift;
  return [{ part: `${l}:${kind}`, x, y }];
};
const shadowAt = (w: number): Layer => ({ part: `shadow${w}`, x: Math.round(16 - w / 2), y: 27 });
/** Dust puffing out round the block's foot, `t` frames on. */
const toyDust = (t: number): Layer[] =>
  t > 3
    ? []
    : [
        { part: `puff${2 + Math.min(3, t)}s`, x: 3 - t * 2, y: 24 - t },
        { part: `puff${2 + Math.min(3, t)}S`, x: 23 + t * 2, y: 24 - t },
      ];
/** A glint running along the block's top edge (`i` of 6). */
const toyGlint = (i: number): Speck[] => (i < 3 ? [[8 + i * 6, 6 + (i === 0 ? 0 : 0), "F"], [9 + i * 6, 6, "F"]] : []);

const toyAnims: Record<string, Anim> = {};
for (const l of TOY_LETTER_NAMES) {
  /** It lands: thrown in from above (stretched as it falls), clacks down squashed, bounces a little, and settles. */
  toyAnims[`land${l}`] = {
    loop: false,
    frames: [
      { ms: 50, layers: [shadowAt(8), ...cubeAt(l, "st", 13)] },
      { ms: 50, layers: [shadowAt(14), ...cubeAt(l, "st", 5)] },
      { ms: 70, cue: "clack", shake: [0, 1], layers: [shadowAt(24), ...cubeAt(l, "sq"), ...toyDust(0)] },
      { ms: 70, layers: [shadowAt(20), ...cubeAt(l, "n", 2), ...toyDust(1)] },
      { ms: 60, layers: [shadowAt(20), ...cubeAt(l, "n"), ...toyDust(2)] },
      { ms: 100, layers: [shadowAt(20), ...cubeAt(l, "n"), ...toyDust(3)] },
    ],
  };
  /** Sitting there while it lasts; a glint runs along its top now and then. */
  toyAnims[`sit${l}`] = { loop: true, frames: Array.from({ length: 8 }, (_, i): Frame => ({ ms: i < 3 ? 90 : 300, layers: [shadowAt(20), ...cubeAt(l, "n")], specks: toyGlint(i) })) };
  /** It goes: a puff of dust and it shrinks away (ends empty). */
  toyAnims[`poof${l}`] = {
    loop: false,
    frames: [
      { ms: 70, cue: "poof", layers: [shadowAt(20), ...cubeAt(l, "14"), ...toyDust(0)] },
      { ms: 70, layers: [shadowAt(14), ...cubeAt(l, "9"), ...toyDust(1)] },
      { ms: 80, layers: [...toyDust(2)] },
      { ms: 80, layers: [...toyDust(3)] },
      { ms: 40, layers: [] },
    ],
  };
  /** In flight (on its own sprite, blockFly): tumbling end over end. */
  toyAnims[`fly${l}`] = {
    loop: true,
    frames: ([0, 1, 2, 3] as const).map((rot): Frame => ({ ms: 70, layers: [{ part: `${l}:9`, x: 10, y: 10, rot }] })),
  };
}

const TOY_BLOCK: Character = {
  id: "toy-block",
  name: "A toy block on a square",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: TOY_PALETTE,
  parts: TOY_PARTS,
  anims: Object.fromEntries(Object.entries(toyAnims).filter(([k]) => !k.startsWith("fly"))),
};
const BLOCK_FLY: Character = {
  id: "block-fly",
  name: "A toy block in flight",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: TOY_PALETTE,
  parts: TOY_PARTS,
  anims: Object.fromEntries(Object.entries(toyAnims).filter(([k]) => k.startsWith("fly"))),
};

/** Dust puffing up off a square as he lands on it (one of his bounce's 2x2 block, each square its own). */
const BOUNCE_PUFF: Character = {
  id: "bounce-puff",
  name: "Dust off a bounce",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: TOY_PALETTE,
  parts: TOY_PARTS,
  anims: {
    puff: {
      loop: false,
      frames: [0, 1, 2, 3, 4].map((t): Frame => ({
        ms: t < 4 ? 70 : 40,
        layers:
          t < 4
            ? [
                { part: `puff${Math.min(5, 3 + t)}s`, x: 2 - t * 2, y: 18 - t * 2 },
                { part: `puff${Math.min(5, 2 + t)}S`, x: 20 + t * 2, y: 20 - t * 2 },
                { part: `puff${Math.min(5, 2 + t)}S`, x: 11, y: 22 - t * 3 },
              ]
            : [],
      })),
    },
  },
};

/** The crash's shockwave: a ring `r` from the board's middle, 3 pixels thick, bright inside, gold outside. */
function shockRing(r: number, fade: number): Speck[] {
  const out: Speck[] = [];
  const c = BOARD / 2;
  const seen = new Set<string>();
  for (let k = 0; k < 3; k++) {
    const rr = r - k;
    if (rr <= 0) continue;
    const steps = Math.ceil(2 * Math.PI * rr * 1.3);
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * 2 * Math.PI;
      const x = Math.round(c + Math.cos(a) * rr);
      const y = Math.round(c + Math.sin(a) * rr);
      if (x < 0 || y < 0 || x >= BOARD || y >= BOARD || seen.has(`${x},${y}`)) continue;
      // (A broken ring as it thins out at the board's edges.)
      if (fade > 0 && (i * 7 + k * 3) % 10 < fade) continue;
      seen.add(`${x},${y}`);
      out.push([x, y, k === 0 ? "W" : k === 1 ? "A" : "Q"]);
    }
  }
  return out;
}
/** Debris and specks of dust flying out from the crash, `t` frames on. */
const debris = (t: number): Speck[] =>
  Array.from({ length: 28 }, (_, i): Speck[] => {
    const a = (i / 28) * 2 * Math.PI + (i % 3) * 0.07;
    const d = 18 + t * (9 + (i % 4) * 3);
    const x = Math.round(BOARD / 2 + Math.cos(a) * d);
    const y = Math.round(BOARD / 2 + Math.sin(a) * d - t * (i % 2));
    return x < 1 || y < 1 || x > BOARD - 2 || y > BOARD - 2 ? [] : [[x, y, i % 3 ? "s" : "S"], [x + 1, y, "s"]];
  }).flat();

const CRASH_PALETTE = { ...TOY_PALETTE, W: "#fffbeeee", A: "#ffe08acc", Q: "#f2c14e88" } as const;
/** The crash's dust cloud round the middle: puffs in a ring, `t` frames on (bigger and further out, then thinning). */
const crashCloud = (t: number): Layer[] =>
  t > 6
    ? []
    : Array.from({ length: 10 }, (_, i): Layer => {
        const a = (i / 10) * 2 * Math.PI;
        const d = 10 + t * 4;
        const r = Math.min(5, 3 + Math.floor(t / 2));
        return { part: `puff${r}${i % 2 ? "s" : "S"}`, x: Math.round(BOARD / 2 + Math.cos(a) * d - r), y: Math.round(BOARD / 2 + Math.sin(a) * d * 0.8 - r - t) };
      });

/**
 * The Big Bounce's crash on the board's four middle squares: a shockwave across the whole board (a bright ring
 * racing out to its corners), a cloud of dust puffing up round the middle, debris flying. Ends empty.
 */
const BOUNCE_CRASH: Character = {
  id: "bounce-crash",
  name: "The Big Bounce's crash",
  w: BOARD,
  h: BOARD,
  foot: [BOARD / 2, BOARD - 1],
  palette: CRASH_PALETTE,
  parts: TOY_PARTS,
  anims: {
    crash: {
      loop: false,
      frames: [14, 30, 48, 68, 90, 112, 134, 0].map((r, t): Frame => ({
        ms: t < 7 ? 75 : 60,
        layers: crashCloud(t),
        specks: r ? [...shockRing(r, t >= 5 ? (t - 4) * 3 : 0), ...debris(t)] : [],
      })),
    },
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
  darkSquare: DARK_SQUARE,
  darkPour: DARK_POUR,
  darkMiss: DARK_MISS,
  bulbStrand: BULB_STRAND,
  nightSquare: NIGHT_SQUARE,
  nightLabel: NIGHT_LABEL,
  toyBlock: TOY_BLOCK,
  blockFly: BLOCK_FLY,
  bouncePuff: BOUNCE_PUFF,
  bounceCrash: BOUNCE_CRASH,
} as const satisfies Record<string, Character>;
