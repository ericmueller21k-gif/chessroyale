/** G-REX's effects: his fire tiles, a piece burning, the sparkler, the Roman candle's rockets and fireballs, their shadows. See ../effects.ts. */
import { canvas, ellipse, flame, line, poly, toGrid, type Canvas } from "../paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../sprite.ts";
import { SQUARE, type Pt } from "./common.ts";

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

export const FIRE_TILE: Character = {
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

export const PIECE_BURN: Character = {
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
export const SPARK_FLY: Character = {
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
export const CANDLE_SHOT: Character = {
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
export const FIREBALL_FALL: Character = {
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
export const CANDLE_SHOTS: Character = {
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
export const FIRE_SHADOW: Character = {
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
