/**
 * The circus tiger's prop in the boss bar (BossUi.barProp; the free room of docs/decisions/2026-10-23-boss-bar.md), built as
 * gardener-bar.ts is: a `Character` of its own, drawn at the bar's size (one sprite pixel to one CSS pixel, as his figure there).
 * Look only: nothing in the game draws it yet (docs/decisions/2026-10-23-tiger-animations.md).
 *
 * **The pump:** a small circus balloon pump in his vest's red and gold, the nozzle pointing up on its own little stand at the left,
 * the barrel at the right with its plunger's T-handle on top. He puts a limp balloon on the nozzle; it inflates in 4 stages (15 s each
 * in the rules), a little more of a chess piece at each; the plunger makes one stroke by itself at each step, which puffs it.
 * Then it is released on its string (and flies to the board: effects/tiger.ts), or, too big, it pops.
 *
 * **The balloons:** five pieces (pawn, knight, bishop, rook, queen; never a king), four drawings each (`BALLOON_SHAPES`):
 *   1  a small, limp, wrinkled blob, the same for every piece;
 *   2  a rounder, bigger blob in the piece's rough proportions (a round top for the pawn, a lean for the knight, tall and narrow for
 *      the bishop and the queen, a squat column for the rook): a guess, not a certainty;
 *   3  clearly the piece, its defining feature in place, still small and soft;
 *   4  the finished balloon piece, full size.
 * Each is typed by hand at its real size (a silhouette, `#` filled and `n` its knot) and shaded by one rule (`shaded`: a light rim
 * at its left, a dark one at its right and under it, a shine), with the renderer's 1 px dark outline round it. The fake queen is the
 * queen's drawings: the same pixels until it pops. The color is passed in, not tied to the piece (`BALLOON_COLORS`, a `look` of
 * this character): the shape tells the piece.
 *
 * Its animations (`pumpAnim(kind, piece)` names them; one frame per look, numbers below in ms):
 *   bare                   (loop) the pump, the nozzle bare.
 *   put<Piece>             (ends on stage1) a limp balloon dropped onto the nozzle (`squeak`). The same for every piece.
 *   stage1, stage<2-4><Piece>  (loop) holding a balloon at that stage.
 *   grow<2-4><Piece>       (ends on that stage's look, 400) the plunger strokes down (`pump`), the balloon puffs up into its next
 *                          stage with a squash and a stretch (`squeak`), the plunger comes back up.
 *   pop<2-4><Piece>        (ends bare, 400) the balloon swells past its size (`squeak`), strains (the shine stretches, a
 *                          wobble), bursts (`pop`: a flash) and its scraps fall and are gone; the nozzle is left bare.
 *   release<Piece>         (ends bare, 330) a finished balloon lifts off the nozzle on its string (`whoosh`); at its last lifted
 *                          look (`RELEASE_KNOT`, the knot's place in the frame) the flight takes over (effects/tiger.ts
 *                          `balloonFly`) and the prop shows `bare`.
 *
 * Sizes: the frame is `PUMP_W` x `PUMP_H`; everything at rest (the pump and a stage-4 balloon, outlines included) is in its bottom
 * 30 rows (`PUMP_REST_H`), the over-swell reaches 2 rows higher, the release's lift 5. Place it by its foot (`PUMP_FOOT`: the
 * ground under the nozzle).
 */
import { canvas, toGrid, type Canvas } from "./paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

// ---- The balloons.

export const BALLOON_PIECES = ["pawn", "knight", "bishop", "rook", "queen"] as const;
export type BalloonPiece = (typeof BALLOON_PIECES)[number];
export type Stage = 1 | 2 | 3 | 4;

/** A mark over the shading: `w` the shine, `d` a crease or a slit, `l` a lit spot. */
export type Mark = readonly [x: number, y: number, key: "w" | "d" | "l"];
/** A balloon drawn as a silhouette (`#` filled, `n` its knot, the bottom row) and the marks over its shading. */
export interface BalloonShape {
  readonly sil: readonly string[];
  readonly marks: readonly Mark[];
}

/** Stage 1, the same for every piece: small, limp, leaning over, a wrinkle in it. */
const LIMP: BalloonShape = {
  sil: [
    ".##....",
    "####...",
    "#####..",
    ".#####.",
    "..###..",
    "...#...",
    "...n...",
  ],
  marks: [[1, 1, "w"], [2, 2, "d"], [3, 3, "d"], [4, 3, "l"]],
};

export const BALLOON_SHAPES: Record<BalloonPiece, readonly [BalloonShape, BalloonShape, BalloonShape, BalloonShape]> = {
  pawn: [
    LIMP,
    {
      sil: [
        "..###..",
        ".#####.",
        ".#####.",
        ".#####.",
        "..###..",
        ".#####.",
        "#######",
        ".#####.",
        "...n...",
      ],
      marks: [[2, 1, "w"], [2, 2, "w"], [1, 6, "w"]],
    },
    {
      sil: [
        "..###..",
        ".#####.",
        ".#####.",
        "..###..",
        ".#####.",
        "..###..",
        "..###..",
        ".#####.",
        "#######",
        ".#####.",
        "...n...",
      ],
      marks: [[2, 1, "w"], [2, 2, "w"], [1, 8, "w"]],
    },
    {
      sil: [
        "...###...",
        "..#####..",
        ".#######.",
        ".#######.",
        "..#####..",
        "...###...",
        "..#####..",
        "...###...",
        "...###...",
        "..#####..",
        ".#######.",
        "#########",
        "#########",
        ".#######.",
        "....n....",
      ],
      marks: [[3, 1, "w"], [2, 2, "w"], [2, 3, "w"], [3, 9, "w"], [2, 10, "w"], [1, 11, "w"]],
    },
  ],
  knight: [
    LIMP,
    {
      sil: [
        ".####...",
        "######..",
        "#######.",
        ".#######",
        "..######",
        "...#####",
        "...#####",
        "..######",
        "..#####.",
        "....n...",
      ],
      marks: [[1, 1, "w"], [2, 1, "w"], [3, 6, "w"]],
    },
    {
      sil: [
        "....#.#..",
        "...#####.",
        "..######.",
        ".########",
        "#########",
        "#########",
        ".#..#####",
        "....#####",
        "...######",
        "....####.",
        "...######",
        "..#######",
        ".########",
        "..######.",
        ".....n...",
      ],
      marks: [[3, 2, "w"], [4, 3, "d"], [3, 12, "w"]],
    },
    {
      sil: [
        "......#.#...",
        ".....##.##..",
        "....######..",
        "...########.",
        "..#########.",
        ".###########",
        "############",
        "############",
        "#####.######",
        ".##...######",
        "......######",
        ".....#######",
        "....########",
        ".....######.",
        "....########",
        "..##########",
        ".###########",
        "############",
        ".##########.",
        "......n.....",
      ],
      marks: [[4, 3, "w"], [3, 4, "w"], [5, 4, "d"], [6, 4, "d"], [2, 6, "w"], [11, 6, "d"], [11, 8, "d"], [11, 10, "d"], [3, 15, "w"], [2, 16, "w"]],
    },
  ],
  bishop: [
    LIMP,
    {
      sil: [
        "..#..",
        ".###.",
        ".###.",
        "#####",
        "#####",
        "#####",
        ".###.",
        ".###.",
        "#####",
        "#####",
        ".###.",
        "..n..",
      ],
      marks: [[1, 2, "w"], [1, 3, "w"], [1, 8, "w"]],
    },
    {
      sil: [
        "...#...",
        "..###..",
        "...#...",
        "..###..",
        ".#####.",
        ".#####.",
        ".#####.",
        "..###..",
        ".#####.",
        "..###..",
        "..###..",
        ".#####.",
        "#######",
        ".#####.",
        "...n...",
      ],
      marks: [[2, 4, "w"], [4, 4, "d"], [3, 5, "d"], [1, 12, "w"]],
    },
    {
      sil: [
        "...###...",
        "...###...",
        "....#....",
        "...###...",
        "..#####..",
        ".#######.",
        ".#######.",
        ".#######.",
        ".#######.",
        "..#####..",
        "...###...",
        "..#####..",
        "...###...",
        "...###...",
        "..#####..",
        ".#######.",
        "#########",
        "#########",
        ".#######.",
        "....n....",
      ],
      marks: [[3, 0, "w"], [3, 4, "w"], [2, 5, "w"], [2, 6, "w"], [6, 5, "d"], [5, 6, "d"], [4, 7, "d"], [3, 15, "w"], [2, 16, "w"]],
    },
  ],
  rook: [
    LIMP,
    {
      sil: [
        "#######",
        "#######",
        ".#####.",
        ".#####.",
        ".#####.",
        "#######",
        ".#####.",
        "...n...",
      ],
      marks: [[1, 0, "w"], [1, 1, "w"], [2, 3, "w"]],
    },
    {
      sil: [
        "##.###.##",
        "#########",
        ".#######.",
        "..#####..",
        "..#####..",
        "..#####..",
        "..#####..",
        ".#######.",
        "#########",
        ".#######.",
        "....n....",
      ],
      marks: [[1, 0, "w"], [3, 0, "w"], [3, 3, "w"], [3, 4, "w"], [1, 8, "w"]],
    },
    {
      sil: [
        "###.###.###",
        "###.###.###",
        "###########",
        ".#########.",
        "..#######..",
        "..#######..",
        "..#######..",
        "..#######..",
        "..#######..",
        "..#######..",
        ".#########.",
        "###########",
        "###########",
        ".#########.",
        ".....n.....",
      ],
      marks: [[1, 0, "w"], [1, 1, "w"], [4, 0, "w"], [4, 1, "w"], [3, 5, "w"], [3, 6, "w"], [3, 7, "w"], [2, 11, "w"]],
    },
  ],
  queen: [
    LIMP,
    {
      sil: [
        "#.###.#",
        "#######",
        ".#####.",
        ".#####.",
        "..###..",
        ".#####.",
        ".#####.",
        "#######",
        ".#####.",
        "...n...",
      ],
      marks: [[2, 1, "w"], [2, 2, "w"], [1, 7, "w"]],
    },
    {
      sil: [
        "....#....",
        "...###...",
        "#...#...#",
        "#.#.#.#.#",
        "#########",
        ".#######.",
        "..#####..",
        "..#####..",
        "..#####..",
        ".#######.",
        "..#####..",
        ".#######.",
        "#########",
        ".#######.",
        "....n....",
      ],
      marks: [[3, 1, "w"], [2, 5, "w"], [3, 6, "w"], [1, 12, "w"]],
    },
    {
      sil: [
        ".....#.....",
        "....###....",
        ".#...#...#.",
        ".#.#.#.#.#.",
        ".#########.",
        "..#######..",
        "...#####...",
        "...#####...",
        "....###....",
        "....###....",
        "...#####...",
        "....###....",
        "...#####...",
        "..#######..",
        "..#######..",
        ".#########.",
        "###########",
        "###########",
        ".#########.",
        ".....n.....",
      ],
      marks: [[4, 1, "w"], [3, 5, "w"], [4, 6, "w"], [4, 7, "w"], [3, 13, "w"], [2, 14, "w"], [1, 15, "w"]],
    },
  ],
};

/**
 * A silhouette shaded, as an inflated balloon is lit from the top left: `d` its shade (a dark rim at its right and under it), `b`
 * the balloon, `l` its light (a light rim at its left and top, and a band inside it), `w` shine, `n` the knot; `marks` over it.
 */
export function shaded(sil: readonly string[], marks: readonly Mark[]): string[] {
  const at = (x: number, y: number) => sil[y]?.[x] ?? ".";
  const solid = (x: number, y: number) => at(x, y) !== ".";
  const grid = sil.map((row, y) =>
    [...row]
      .map((c, x) => {
        if (c === "." || c === "n") return c;
        const [L, R, U, D] = [!solid(x - 1, y), !solid(x + 1, y), !solid(x, y - 1), !solid(x, y + 1)];
        if (D || (R && !solid(x, y + 1))) return "d";
        if (R || (!solid(x + 1, y + 1) && !L)) return "d";
        if (L || (U && !R)) return "l";
        if (!solid(x - 2, y) || (!solid(x - 1, y - 1) && !solid(x - 2, y))) return "l";
        return "b";
      })
      .join(""),
  );
  for (const [x, y, k] of marks) if (grid[y]?.[x] && grid[y]![x] !== ".") grid[y] = grid[y]!.slice(0, x) + k + grid[y]!.slice(x + 1);
  return grid;
}

/** Where a silhouette's knot is (its column in the bottom row). */
export const knotX = (sil: readonly string[]): number => sil[sil.length - 1]!.indexOf("n");

/** A silhouette's body (every row but the knot's) as cells, and its knot's column. */
const split = (sil: readonly string[]) => ({ body: sil.slice(0, -1).map((r) => [...r].map((c) => c !== ".")), kx: knotX(sil) });
const join = (body: boolean[][], kx: number): string[] => {
  const w = body[0]!.length;
  return [...body.map((r) => r.map((c) => (c ? "#" : ".")).join("")), ".".repeat(kx) + "n" + ".".repeat(Math.max(0, w - kx - 1))];
};

/** Each row's runs of filled pixels, as [from, to] pairs. */
const runs = (row: readonly boolean[]): [number, number][] => {
  const out: [number, number][] = [];
  row.forEach((c, x) => {
    if (!c) return;
    const last = out[out.length - 1];
    if (last && last[1] === x - 1) last[1] = x;
    else out.push([x, x]);
  });
  return out;
};

/**
 * The silhouette swelling past its size, `n` steps: each row as wide as the widest of its neighbors and `n` pixels more each side,
 * its notches filled (a rook's merlons, a queen's points: a balloon blown too hard rounds out), and `n` rows more on top, rounded;
 * never lower (the knot stays on the nozzle).
 */
export function swell(sil: readonly string[], n: number): string[] {
  const { body, kx } = split(sil);
  const h = body.length;
  const ext = body.map((r) => {
    const rs = runs(r);
    return rs.length ? [rs[0]![0], rs[rs.length - 1]![1]] : null;
  });
  const near = (y: number) => [ext[y - 1], ext[y], ext[y + 1]].filter((e): e is number[] => !!e);
  const rows: [number, number][] = [];
  for (let i = n; i >= 1; i--) {
    const e = ext[0]!;
    rows.push([e[0]! - n + 2 * i, e[1]! + n - 2 * i]);
  }
  for (let y = 0; y < h; y++) {
    const ns = near(y);
    rows.push([Math.min(...ns.map((e) => e[0]!)) - n, Math.max(...ns.map((e) => e[1]!)) + n]);
  }
  const w = body[0]!.length + 2 * n;
  const out = rows.filter(([a, b]) => b >= a).map(([a, b]) => Array.from({ length: w }, (_, x) => x - n >= a && x - n <= b));
  return join(out, kx + n);
}

/** Each row of the silhouette `n` pixels wider at its outer ends (a puffed-out frame; the gaps inside it kept), the frame `n` columns wider each side. */
const fatten = (body: boolean[][], n: number): boolean[][] =>
  body.map((r) => {
    const out = Array<boolean>(r.length + 2 * n).fill(false);
    const rs = runs(r);
    rs.forEach(([a, b], i) => {
      for (let x = a + n - (i === 0 ? n : 0); x <= b + n + (i === rs.length - 1 ? n : 0); x++) out[x] = true;
    });
    return out;
  });
const same = (a: readonly boolean[], b: readonly boolean[]) => a.every((c, i) => c === b[i]);
/** A row that repeats the one under it (the lowest such, or the middle one), so dropping or doubling it keeps every feature. */
const plainRow = (body: boolean[][]): number => {
  for (let y = body.length - 2; y >= 0; y--) if (same(body[y]!, body[y + 1]!)) return y;
  return Math.floor(body.length / 2);
};

/** A squash (`dh` -1: a pixel wider each side, a plain row shorter) or a stretch (`dh` 1: a plain row doubled), for a frame or two. */
export function squash(sil: readonly string[], dh: -1 | 1): string[] {
  const { body, kx } = split(sil);
  if (dh === 1) {
    const y = plainRow(body);
    return join([...body.slice(0, y + 1), [...body[y]!], ...body.slice(y + 1)], kx);
  }
  const fat = fatten(body, 1);
  const y = plainRow(fat);
  return join([...fat.slice(0, y), ...fat.slice(y + 1)], kx + 1);
}

/** A shine for a drawn-on-the-fly silhouette (a swell, a squash): a streak of `len` down its upper left, inside the rim. */
export function autoShine(sil: readonly string[], len: number): Mark[] {
  const rows = sil.slice(0, -1);
  const top = rows.findIndex((r) => (r.match(/#/g) ?? []).length >= 4);
  const marks: Mark[] = [];
  for (let i = 0; i < len; i++) {
    const y = top + 1 + i;
    const x = (rows[y] ?? "").indexOf("#") + 2 - (i === 0 ? 0 : Math.min(1, i - 1));
    if (rows[y]?.[x] === "#") marks.push([x, y, "w"]);
  }
  return marks;
}

/** The colors a balloon can be (Eric's reference: yellow, red, blue, green, purple, pink), three each: dark, round, light. */
export const BALLOON_COLORS = {
  yellow: ["#b88a0a", "#f2c31a", "#ffe566"],
  red: ["#8f0f22", "#dc2433", "#ff6a5e"],
  blue: ["#1a4fa8", "#2f7fe0", "#7cc0ff"],
  green: ["#0f6a3a", "#1fa856", "#6fe08e"],
  purple: ["#5a2a96", "#9150d6", "#c79bf5"],
  pink: ["#b02a6e", "#ec5fa5", "#ffaed6"],
} as const satisfies Record<string, readonly [string, string, string]>;
export type BalloonColor = keyof typeof BALLOON_COLORS;
export const BALLOON_COLOR_NAMES = Object.keys(BALLOON_COLORS) as BalloonColor[];

/** The balloon's palette keys in this file's characters (and the shine), and each color as a look over them. */
export const BALLOON_KEYS = { d: "1", b: "2", l: "3", w: "w", n: "1" } as const;
export const balloonLooks = (): Record<BalloonColor, Record<string, string>> =>
  Object.fromEntries(BALLOON_COLOR_NAMES.map((c): [string, Record<string, string>] => [c, { "1": BALLOON_COLORS[c][0], "2": BALLOON_COLORS[c][1], "3": BALLOON_COLORS[c][2] }])) as Record<BalloonColor, Record<string, string>>;

/** A shaded silhouette as a part in the keys of `keys` (dark, round, light, shine, knot). */
export function balloonPartOf(sil: readonly string[], marks: readonly Mark[], keys: Readonly<Record<"d" | "b" | "l" | "w" | "n", string>> = BALLOON_KEYS): Part {
  return { grid: shaded(sil, marks).map((row) => [...row].map((c) => (c === "." ? "." : keys[c as keyof typeof keys])).join("")) };
}

/** How a balloon is drawn for a frame: its stage's drawing, or that swollen (`swell` steps), then squashed (-1) or stretched (1). */
export interface BalloonLook {
  piece: BalloonPiece;
  stage: Stage;
  swell?: number;
  squash?: -1 | 1;
}

/** The silhouette and marks for a look (the hand-drawn one as it is, or reshaped with a shine of its own). */
export function balloonDrawing(b: BalloonLook): { sil: string[]; marks: Mark[] } {
  const shape = BALLOON_SHAPES[b.piece][b.stage - 1]!;
  if (!b.swell && !b.squash) return { sil: [...shape.sil], marks: [...shape.marks] };
  let sil = [...shape.sil];
  if (b.swell) sil = swell(sil, b.swell);
  if (b.squash) sil = squash(sil, b.squash);
  return { sil, marks: autoShine(sil, b.swell ? 2 + b.swell : 2) };
}

export const lookName = (b: BalloonLook): string => `balloon:${b.piece}:${b.stage}:${b.swell ?? 0}:${b.squash ?? 0}`;

// ---- The pump.

export const PUMP_PALETTE: Record<string, string> = {
  k: "#1f1210", // outline (his)
  A: "#6a0e1c", // red, dark to light (his vest's)
  B: "#a31a28",
  C: "#cf2f38",
  D: "#ef5c56",
  J: "#7a4f0e", // gold, dark to light (his vest's edge; the game's gold)
  K: "#b87a14",
  L: "#f2c14e",
  M: "#ffe58a",
  g: "#5d5a6e", // the nozzle's tip: steel, dark and light
  h: "#b9b6c8",
  "8": "#6b4a30", // a balloon's string
  "1": BALLOON_COLORS.yellow[0], // the balloon (a look recolors it)
  "2": BALLOON_COLORS.yellow[1],
  "3": BALLOON_COLORS.yellow[2],
  w: "#fff6dc", // shine
  f: "#ffffff", // the pop's flash: white, yellow
  y: "#ffe27a",
};

/** The frame: 34 wide, 36 high; at rest everything is in the bottom 30 rows (the widest swell reaches 10 left of the knot, 9 right). */
export const PUMP_W = 34;
export const PUMP_H = 36;
export const PUMP_REST_H = 30;
/** Where a balloon's knot sits on the nozzle (frame pixels). */
const KNOT: readonly [number, number] = [11, 26];
/** The ground under the nozzle: where the prop is placed by. */
export const PUMP_FOOT: readonly [number, number] = [11, PUMP_H];

const rect = (cv: Canvas, x0: number, y0: number, x1: number, y1: number, k: string, ox: number, oy: number) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (cv[y - oy]?.[x - ox] !== undefined) cv[y - oy]![x - ox] = k;
};

/** The pump's body, at (6, 21): the nozzle on its stand at the left, the hose along the bottom, the barrel at the right on its base. */
const BODY_AT: readonly [number, number] = [6, 21];
function pumpBody(): Part {
  const [ox, oy] = BODY_AT;
  const cv = canvas(26, 14);
  const R = (x0: number, y0: number, x1: number, y1: number, k: string) => rect(cv, x0, y0, x1, y1, k, ox, oy);
  // The nozzle's stand: a gold post on a little foot, a collar, and the steel tip (under the knot).
  R(8, 33, 14, 34, "K");
  R(8, 33, 14, 33, "L");
  R(10, 28, 12, 32, "K");
  R(10, 28, 10, 32, "L");
  R(12, 28, 12, 32, "J");
  R(9, 28, 13, 28, "L");
  R(13, 28, 13, 28, "K");
  R(11, 27, 11, 27, "h");
  // The hose: red, from the barrel's foot to the stand.
  R(13, 31, 22, 31, "C");
  R(13, 32, 22, 32, "A");
  // The barrel: red, lit from the left, gold bands at its top, middle and foot (clear of the biggest swell's reach).
  for (let x = 23; x <= 28; x++) R(x, 22, x, 31, "DCCBBA"[x - 23]!);
  R(22, 21, 29, 21, "L");
  R(22, 21, 22, 21, "M");
  R(29, 21, 29, 21, "K");
  R(23, 26, 28, 26, "K");
  R(23, 26, 24, 26, "L");
  R(28, 26, 28, 26, "J");
  R(22, 32, 29, 32, "K");
  R(22, 32, 23, 32, "L");
  // Its base plate.
  R(20, 33, 31, 34, "J");
  R(20, 33, 31, 33, "K");
  R(21, 33, 23, 33, "L");
  return { grid: toGrid(cv) };
}

/** The plunger: the T-handle and the rod into the barrel, `down` pixels into its stroke (0 up, 3 home). */
function plunger(down: number): { part: Part; at: readonly [number, number] } {
  const cv = canvas(8, 4);
  const y0 = 17 + down;
  rect(cv, 22, y0, 29, y0, "L", 22, y0);
  rect(cv, 22, y0, 22, y0, "M", 22, y0);
  rect(cv, 28, y0, 29, y0, "K", 22, y0);
  rect(cv, 25, y0 + 1, 26, y0 + 3, "g", 22, y0);
  rect(cv, 25, y0 + 1, 25, y0 + 3, "h", 22, y0);
  return { part: { grid: toGrid(cv) }, at: [22, y0] };
}

/** A balloon's string, `len` pixels down from its knot, swaying `sway` pixels at its end (outline-free). */
export function stringPart(len: number, sway = 0, phase = 0, key = "8"): { part: Part; dx: number } {
  const pts = Array.from({ length: len }, (_, i) => Math.round(Math.sin(phase + i * 0.7) * sway * (i / Math.max(1, len - 1))));
  const lo = Math.min(0, ...pts);
  const w = Math.max(0, ...pts) - lo + 1;
  const cv = canvas(w, len);
  pts.forEach((x, y) => (cv[y]![x - lo] = key));
  return { part: { grid: toGrid(cv), outline: false }, dx: lo };
}

/** The pop's flash: a burst star round (`cx`, `cy`), `r` across. */
function flash(r: number): Part {
  const n = 2 * r + 1;
  const cv = canvas(n, n);
  for (let i = -r; i <= r; i++) {
    const a = Math.abs(i);
    if (a <= r) {
      cv[r]![r + i] = a <= 1 ? "f" : "y";
      cv[r + i]![r] = a <= 1 ? "f" : "y";
    }
    const d = Math.round(i * 0.7);
    if (a <= r - 1 && a > 0) {
      cv[r + d]![r + d] = "y";
      cv[r + d]![r - d] = "y";
    }
  }
  cv[r]![r] = "f";
  return { grid: toGrid(cv) };
}

const { parts: PUMP_PARTS, add } = lazyParts();
add("pump", pumpBody);
const plungerAt = new Map<number, readonly [number, number]>();
for (const d of [0, 1, 2, 3]) {
  const p = plunger(d);
  add(`plunger:${d}`, () => p.part);
  plungerAt.set(d, p.at);
}
add("flash:3", () => flash(3));
add("flash:5", () => flash(5));
add("scrap:a", () => ({ grid: ["22"] }));
add("scrap:b", () => ({ grid: ["2", "1"] }));
add("scrap:c", () => ({ grid: ["2.", "21"] }));

/** A balloon on the nozzle (its knot at `KNOT`, `lift` pixels up), as a layer; registers its part the first time. */
function balloonLayer(b: BalloonLook, lift = 0): Layer {
  const name = lookName(b);
  const { sil, marks } = balloonDrawing(b);
  add(name, () => balloonPartOf(sil, marks));
  return { part: name, x: KNOT[0] - knotX(sil), y: KNOT[1] - lift - (sil.length - 1) };
}

/** The pump with its plunger `down` pixels, then whatever is on the nozzle. */
const pumpLayers = (down: number, ...on: Layer[]): Layer[] => [
  { part: `plunger:${down}`, x: plungerAt.get(down)![0], y: plungerAt.get(down)![1] },
  { part: "pump", x: BODY_AT[0], y: BODY_AT[1] },
  ...on,
];
const fr = (ms: number, layers: Layer[], extra: Partial<Frame> = {}): Frame => ({ ms, layers, ...extra });

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
/** The name of an animation of the pump: `bare`, `put`, `stage` (with the stage), `grow` (into the stage), `pop` (from the stage), `release`. */
export function pumpAnim(kind: "bare" | "put" | "stage" | "grow" | "pop" | "release", piece: BalloonPiece, stage: Stage = 4): string {
  if (kind === "bare") return "bare";
  if (kind === "stage" && stage === 1) return "stage1";
  if (kind === "put") return `put${cap(piece)}`;
  if (kind === "release") return `release${cap(piece)}`;
  return `${kind}${stage}${cap(piece)}`;
}

/** Where a released balloon's knot is at the release's last lifted look (frame pixels): the flight starts there. */
export const RELEASE_KNOT: readonly [number, number] = [KNOT[0], KNOT[1] - 5];

/** The pump's animations for one piece. */
function pieceAnims(piece: BalloonPiece): Record<string, Anim> {
  const at = (stage: Stage, more: Partial<BalloonLook> = {}, lift = 0) => balloonLayer({ piece, stage, ...more }, lift);
  const out: Record<string, Anim> = {};
  out[pumpAnim("put", piece)] = {
    loop: false,
    frames: [fr(90, pumpLayers(0, at(1, {}, 3))), fr(70, pumpLayers(0, at(1, { squash: -1 })), { cue: "squeak" }), fr(1000, pumpLayers(0, at(1)))],
  };
  for (const s of [2, 3, 4] as const) {
    out[pumpAnim("stage", piece, s)] = { loop: true, frames: [fr(1000, pumpLayers(0, at(s)))] };
    const prev = (s - 1) as Stage;
    out[pumpAnim("grow", piece, s)] = {
      loop: false,
      frames: [
        fr(70, pumpLayers(1, at(prev)), { cue: "pump" }),
        fr(70, pumpLayers(3, at(prev, { squash: -1 }))),
        fr(80, pumpLayers(3, at(s, { squash: -1 })), { cue: "squeak" }),
        fr(80, pumpLayers(2, at(s, { squash: 1 }))),
        fr(100, pumpLayers(0, at(s))),
      ],
    };
    // Too big: it swells, strains, wobbles and bursts; the scraps fall and are gone.
    const { sil } = balloonDrawing({ piece, stage: s, swell: 2 });
    const cy = KNOT[1] - Math.round(sil.length / 2);
    const cx = KNOT[0];
    const scraps = (spread: number, drop: number): Layer[] => [
      { part: "scrap:a", x: cx - 3 - spread, y: cy - 2 + drop },
      { part: "scrap:b", x: cx + 3 + spread, y: cy - 3 + drop },
      { part: "scrap:c", x: cx - 2 - spread, y: cy + 3 + drop },
      { part: "scrap:a", x: cx + 2 + spread, y: cy + 2 + drop },
      { part: "scrap:b", x: cx - 1, y: cy - 5 - spread + drop },
    ];
    const bits = (spread: number, drop: number): Speck[] => [
      [cx - 4 - spread, cy + drop, "1"],
      [cx + 4 + spread, cy - 1 + drop, "1"],
      [cx - 3 - spread, cy + 5 + drop, "1"],
      [cx + 3 + spread, cy + 4 + drop, "1"],
    ];
    out[pumpAnim("pop", piece, s)] = {
      loop: false,
      frames: [
        fr(60, pumpLayers(0, at(s, { swell: 1 })), { cue: "squeak" }),
        fr(60, pumpLayers(0, at(s, { swell: 2 }))),
        fr(45, pumpLayers(0, at(s, { swell: 2, squash: -1 }))),
        fr(45, pumpLayers(0, at(s, { swell: 2, squash: 1 }))),
        fr(50, pumpLayers(0, { part: s === 4 ? "flash:5" : "flash:3", x: cx - (s === 4 ? 5 : 3), y: cy - (s === 4 ? 5 : 3) }), { cue: "pop" }),
        fr(50, pumpLayers(0, ...scraps(1, 0))),
        fr(50, pumpLayers(0, ...scraps(2, 3))),
        fr(40, pumpLayers(0), { specks: bits(2, 6) }),
        fr(1000, pumpLayers(0)),
      ],
    };
  }
  // The release: a finished balloon lifts off the nozzle on its string; then the flight takes over and the nozzle is bare.
  const lifted = (lift: number): Layer[] => {
    const s = stringPart(lift + 1, lift > 3 ? 1 : 0, lift);
    const name = `string:${lift}`;
    add(name, () => s.part);
    return [{ part: name, x: KNOT[0] + s.dx, y: KNOT[1] - lift + 1 }, at(4, {}, lift)];
  };
  out[pumpAnim("release", piece)] = {
    loop: false,
    frames: [fr(70, pumpLayers(0, ...lifted(1)), { cue: "whoosh" }), fr(80, pumpLayers(0, ...lifted(3))), fr(80, pumpLayers(0, ...lifted(5))), fr(100, pumpLayers(0))],
  };
  return out;
}

const anims: Record<string, Anim> = {
  bare: { loop: true, frames: [fr(1000, pumpLayers(0))] },
  stage1: { loop: true, frames: [fr(1000, pumpLayers(0, balloonLayer({ piece: "pawn", stage: 1 })))] },
  ...Object.assign({}, ...BALLOON_PIECES.map(pieceAnims)),
};

/** The pump and its balloon, for the boss bar. Its looks are the balloon's colors (`BALLOON_COLORS`). */
export const TIGER_PUMP: Character = {
  id: "tigerPump",
  name: "Balloon pump",
  w: PUMP_W,
  h: PUMP_H,
  foot: PUMP_FOOT,
  palette: PUMP_PALETTE,
  looks: balloonLooks(),
  parts: PUMP_PARTS,
  anims,
};
