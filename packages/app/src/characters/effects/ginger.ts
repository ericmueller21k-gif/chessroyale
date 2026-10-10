/** Ginger's effects: the ice over a frozen piece, the ice bolt in flight, the blizzard. See ../effects.ts. */
import { canvas, ellipse, inEllipse, line, roundLight, shade, toGrid } from "../paint.ts";
import type { Character, Frame, Layer, Part, Speck } from "../sprite.ts";
import { BOARD, sparkle, SQUARE, type Pt } from "./common.ts";

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

export const ICE_OVERLAY: Character = {
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
export const ICE_BOLT: Character = {
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
export const BLIZZARD_SWEEP: Character = {
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
