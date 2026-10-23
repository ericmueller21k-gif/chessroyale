/**
 * The circus tiger (Eric, Oct 23: a circus tiger who hated his role, the loud roaring and the jumping through hoops, and wanted to
 * make the silly balloon animals he saw someone making). No name yet; his code id is `tiger`. His look only, this step: one still.
 * Eric's reference (the balloons look like balloons): a realistic tiger on all fours, a small black top hat with a red band, a red
 * and gold ringmaster's vest, one front paw up holding the strings of chess-piece balloons, a long striped tail. Drawn side on, facing
 * our left (toward the board), so his balloons are toward the board.
 *
 * His still is the first frame of `idle` (docs/decisions/2026-10-23-tiger-still.md). Nothing in the game draws him yet: `CHARACTERS`,
 * `BOSS_KITS` and the roster don't list him. The preview draws him with its `extra=` option.
 *
 * Rigging, so later poses are numbers: the raised paw and its strings, each balloon as its own part (they bob; one is handed to the
 * pump later and grows from a blob to a piece), the hat (it tips and bounces), the head and jaw (a yawn, a grin), the ears, the eyes,
 * the tail (it swishes), the legs (later he stands on his hind legs, as in the second reference).
 *
 * Coordinates: the frame's top-left is (MX, MY) to the figure's own origin (`local`); the feet stand on local row `GROUND`.
 */
import { canvas, inEllipse, inPoly, line, roundLight, toGrid, type Canvas } from "./paint.ts";
import { type Character, type Frame, type Grid, type Layer, type Part } from "./sprite.ts";

export const TIGER_PALETTE: Record<string, string> = {
  k: "#1d120e", // outline
  a: "#6e3311", // orange fur: dark to light
  b: "#9c5219",
  c: "#c46f25",
  d: "#de8d3d",
  e: "#f0ad5c",
  s: "#2a1510", // black stripes
  f: "#b89268", // cream (chest, muzzle, cheeks, paws): dark to light
  g: "#d6b888",
  h: "#ecd7ae",
  i: "#faf0d6",
  l: "#ffc23a", // eyes: light amber, amber; the pupil and the claws are `x`
  m: "#d8861a",
  x: "#120a07",
  n: "#d46f7a", // nose: pink, dark
  o: "#8e3b4a",
  H: "#3a3542", // the hat: crown, its shine, the brim
  I: "#5d5766",
  E: "#17141b",
  R: "#cc2a2e", // the hat's red band: bright, dark
  r: "#8c181d",
  q: "#9a1c22", // the vest's red: dark, mid, light
  Q: "#d93335",
  u: "#f25a4e",
  Y: "#f2c14e", // gold: the vest's trim and buttons, dark gold
  y: "#b8801a",
  "1": "#9a6410", // yellow balloon: dark to light
  "2": "#d9a020",
  "3": "#f5cf45",
  "4": "#fff3b0",
  "5": "#1d3f9a", // blue balloon
  "6": "#2e6fd0",
  "7": "#5ea8f0",
  "8": "#d6ecff",
  "9": "#135a30", // green balloon
  "0": "#22954d",
  "+": "#55cf7e",
  "=": "#ddffe9",
  "&": "#3a1a5c", // purple balloon
  "*": "#6b34a8",
  "^": "#9c66dc",
  "~": "#e3cdfa",
  N: "#6b4a30", // the balloons' strings
  z: "#0b0a0d", // ground shadow
};

/** The halo: a faint 1-pixel backlight, so a dark boss still reads on the dark ground (the same warm dark as the others). */
const HALO = "#2c2622";

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;
type Draw = (F: (inside: Inside, key: Key) => void, S: (rows: readonly string[], x: number, y: number) => void) => void;

const E = inEllipse;
const union = (...fs: Inside[]): Inside => (x, y) => fs.some((f) => f(x, y));
const both = (a: Inside, b: Inside): Inside => (x, y) => a(x, y) && b(x, y);
const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const FUR = "abcde";
const CREAM = "fghi";

/** The frame's margin: `local` (0, 0) is at frame (MX, MY). The feet stand on local row GROUND, and the halo needs a row above. */
const MX = 8;
const MY = 3;
const GROUND = 62;
/** Where he stands (local x, between his feet). */
const FOOT_X = 34;

/** A part painted in the figure's own coordinates, on a canvas covering (x0, y0) to (x0 + w, y0 + h). `F` fills where `inside`; `S` stamps rows. */
function painted(x0: number, y0: number, w: number, h: number, draw: Draw, outline = true): { part: Part; at: Pt } {
  const cv: Canvas = canvas(w, h);
  const F = (inside: Inside, key: Key) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
  };
  const S = (rows: readonly string[], sx: number, sy: number) =>
    rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        const X = sx + i - x0;
        const Y = sy + j - y0;
        if (k !== "." && cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
      }),
    );
  draw(F, S);
  return { part: { grid: toGrid(cv), outline }, at: [x0, y0] };
}

/** A typed part (hand-drawn rows) at a place. */
const typed = (grid: Grid, at: Pt, outline = true): { part: Part; at: Pt } => ({ part: { grid, outline }, at });

// ---- A stroke (a limb, a tail): the same painter as the hippo's, a pixel's light from the top left across it.

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}

function along(pts: readonly Pt[], r: readonly number[], p: Pt): { s: number; d: number; nx: number; ny: number; rr: number } {
  let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: r[0]! };
  pts.slice(1).forEach((q, i) => {
    const n = nearest(p, pts[i]!, q);
    const rr = r[i]! + (r[i + 1]! - r[i]!) * n.t;
    if (n.d - rr < best.d - best.rr) best = { s: (i + n.t) / (pts.length - 1), d: n.d, nx: n.nx, ny: n.ny, rr };
  });
  return best;
}

/** A stroke through `pts`, `r` its radius at each point; `key` colors a pixel by its light (0 dark to 1 light), how far along it is and how far across. */
function stroke(pts: readonly Pt[], r: readonly number[], key: (light: number, s: number, across: number) => string, outline = true): { part: Part; at: Pt } {
  const pad = Math.ceil(Math.max(...r)) + 1;
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0]))) - pad;
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1]))) - pad;
  const w = Math.ceil(Math.max(...pts.map((p) => p[0]))) + pad - x0 + 1;
  const h = Math.ceil(Math.max(...pts.map((p) => p[1]))) + pad - y0 + 1;
  return painted(
    x0,
    y0,
    w,
    h,
    (F) => {
      const at = (x: number, y: number) => along(pts, r, [x + 0.5, y + 0.5]);
      F(
        (x, y) => {
          const s = at(x, y);
          return s.d <= s.rr;
        },
        (x, y) => {
          const s = at(x, y);
          const across = s.rr ? (s.nx + s.ny) / (s.rr * Math.SQRT2) : 0;
          return key(0.6 - 0.45 * (s.nx / s.rr) - 0.5 * (s.ny / s.rr), s.s, across);
        },
      );
    },
    outline,
  );
}

/** A stripe slanting down-left from `x` at row `top` to row `bottom`, `w` pixels wide at the top: a wedge of black along the body. */
const stripe = (x: number, w: number, top = 34, bottom = 56): Inside => (px, py) => {
  const X = px + 0.5;
  const Y = py + 0.5;
  if (Y < top || Y > bottom) return false;
  const c = x - 0.32 * (Y - top);
  return Math.abs(X - c) <= w * (1.15 - 0.45 * ((Y - top) / (bottom - top)));
};

// ---- The body: the torso (the barrel, the shoulders, the vest), the legs, the tail.

/** His torso: a barrel with the shoulders in front, grey-orange fur on the back, a cream belly, black stripes, and a red ringmaster's vest with gold trim and buttons over the chest. */
function torso(): { part: Part; at: Pt } {
  const barrel = E(34, 41.5, 14.5, 7.5);
  const shoulders = E(24, 39.5, 9, 7);
  const inside = union(barrel, shoulders);
  const light = roundLight(29, 40, 16, 10, 0.08);
  const belly = both(inside, E(33, 55, 15, 5));
  const vest = inPoly([[14.5, 36], [27, 33.5], [30.5, 37.5], [30, 47.5], [21, 49.5], [14, 45]]);
  const vestEdge: Inside = (x, y) => vest(x, y) && (!vest(x - 1, y) || !vest(x + 1, y) || !vest(x, y - 1) || !vest(x, y + 1));
  const stripes = [stripe(33, 1.0, 33, 48), stripe(39, 1.0, 33, 48), stripe(45, 0.9, 33, 47)];
  return painted(12, 31, 38, 19, (F, S) => {
    F(inside, (x, y) => ramp(FUR, light(x, y)));
    for (const st of stripes) F((x, y) => inside(x, y) && !belly(x, y) && st(x, y), () => "s");
    F(belly, (x, y) => ramp(CREAM, light(x, y) + 0.1));
    F(vest, (x, y) => ramp("qQu", light(x, y)));
    F(vestEdge, () => "Y");
    S(["Y"], 21, 42);
    S(["Y"], 21, 46);
  });
}

/** A leg and its foot, its middle at `cx`, from `top` down to the foot at `bottom`: fur, black bands at the rows of `bands`, a cream foot with three dark nails. */
function leg(cx: number, top: number, bottom: number, half: number, footHalf: number, bands: readonly number[]): { part: Part; at: Pt } {
  const column: Inside = (x, y) => Math.abs(x + 0.5 - cx) <= half && y >= top && y < bottom - 2;
  const foot = E(cx, bottom - 1.6, footHalf, 2.2);
  const inside = union(column, foot);
  const light = roundLight(cx - 1, (top + bottom) / 2, half + 2, (bottom - top) / 2 + 2, 0.05);
  const x0 = Math.floor(cx - footHalf) - 1;
  const y0 = top - 1;
  return painted(x0, y0, Math.ceil(footHalf * 2) + 4, bottom + 2 - y0, (F) => {
    F(inside, (x, y) => ramp(FUR, light(x, y)));
    for (const by of bands) F((x, y) => column(x, y) && y >= by && y < by + 1, () => "s");
    F((x, y) => inside(x, y) && y >= bottom - 4, (x, y) => ramp(CREAM, light(x, y) + 0.2));
    F((x, y) => inside(x, y) && y === bottom - 1 && (x + 0.5 - cx) % 2 !== 0, () => "x");
  });
}

/** His tail: a long paddle off his rump, curling up at the tip, black bands, a black tip. */
function tail(): { part: Part; at: Pt } {
  const pts: Pt[] = [[46, 34], [51, 35], [55, 31], [57, 25], [55, 20]];
  return stroke(pts, [2.3, 2.0, 1.8, 1.6, 1.4], (l, s) => (s > 0.86 || (s > 0.2 && s < 0.3) || (s > 0.48 && s < 0.56) || (s > 0.7 && s < 0.78) ? "s" : ramp(FUR, l)));
}

// ---- The head: the skull and muzzle, the cream cheeks, the jaw, the ears, the eyes, the hat.

/** The head: a round skull with a short muzzle in front, orange with a cream muzzle and cheek ruff, three black bars on the forehead and two on the cheek, the pink nose. */
function head(): { part: Part; at: Pt } {
  const skull = E(21.5, 30.5, 10, 9);
  const muzzle = E(13, 34.5, 6, 4.5);
  const inside = union(skull, muzzle);
  const light = roundLight(19, 28, 12, 11, 0.06);
  const ruff = both(inside, E(27, 35, 5.5, 3.8));
  const bars = [barAt(18.5, 22.5, 25.5, 0.9), barAt(22.5, 21.5, 25, 0.9), barAt(26.5, 22.5, 25.5, 0.8), barAt(17.5, 29.5, 32.5, 0.7), barAt(24.5, 30, 34, 0.7)];
  return painted(5, 19, 34, 24, (F, S) => {
    F(inside, (x, y) => ramp(FUR, light(x, y)));
    F(ruff, (x, y) => ramp(CREAM, light(x, y) + 0.1));
    F(muzzle, (x, y) => ramp(CREAM, light(x, y) + 0.2));
    for (const b of bars) F((x, y) => inside(x, y) && b(x, y), () => "s");
    S(["nn", "on"], 8, 31);
  });
}

/** A vertical bar from y `y0` to `y1` centered at `cx`, `w` pixels wide. */
const barAt = (cx: number, y0: number, y1: number, w: number): Inside => (x, y) => y + 0.5 >= y0 && y + 0.5 <= y1 && Math.abs(x + 0.5 - cx) <= w;

/** His jaw: the cream chin under the mouth line. Its own part, so a yawn or a grin is a number later. */
function jaw(): { part: Part; at: Pt } {
  const inside = E(13, 38.8, 5, 2.1);
  const light = roundLight(13, 38.8, 5.5, 3, 0.1);
  return painted(7, 36, 14, 8, (F) => F(inside, (x, y) => ramp(CREAM, light(x, y))));
}

/** A round ear, orange with a cream inside, `cx`, `cy` its middle, `r` its radius. */
function ear(cx: number, cy: number, r: number): { part: Part; at: Pt } {
  const outer = E(cx, cy, r, r);
  const inner = E(cx, cy + 0.3, r * 0.45, r * 0.45);
  const light = roundLight(cx, cy, r, r, 0.05);
  return painted(Math.floor(cx - r) - 1, Math.floor(cy - r) - 1, Math.ceil(r * 2) + 3, Math.ceil(r * 2) + 3, (F) => {
    F(outer, (x, y) => ramp(FUR, light(x, y)));
    F(inner, () => "h");
  });
}

/** His near eye (3 x 3) and far eye (2 x 3, foreshortened): amber, a black slit, a dark lid on top. */
const EYE_NEAR: Grid = ["lxl", "lxl", "mxm"];
const EYE_FAR: Grid = ["lx", "lx", "mx"];

/** The hat: a small black top hat with a red band, sitting on the crown of his head. */
const HAT: Grid = ["..HHHHHH..", "..HIHHHH..", "..HIHHHH..", "..HIHHHH..", "..RRRRRR..", ".EEEEEEEE.", "EEEEEEEEEE"];

// ---- The raised paw (the near front leg's end) and the strings tied to it.

/** The paw: a cream fist with dark knuckle lines. */
const PAW: Grid = [".hhhh.", "ihhhhg", "ghgfhf", "gffgff", ".xxxx."];

/** The near front leg, raised: a shoulder, an elbow under the chest, a forearm up in front of the chin. */
function arm(): { part: Part; at: Pt } {
  const pts: Pt[] = [[25, 44], [17, 50], [5, 45]];
  return stroke(pts, [4.0, 3.4, 3.0], (l, s) => (s > 0.3 && s < 0.37) ? "s" : ramp(FUR, l));
}

// ---- The balloons: chess pieces, each its own part, drawn in a round shape with a shine (light from the top left).

/** A round balloon piece from shapes: its shape `inside` in its own `w` x `h` cells, shaded in four colors (dark to the shine). */
function balloon(w: number, h: number, inside: Inside, colors: string): { part: Part; at: Pt } {
  const cv: Canvas = canvas(w, h);
  const light = roundLight(w / 2, h / 2, w / 2, h / 2, -0.12);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) cv[y]![x] = ramp(colors, light(x, y));
  return { part: { grid: toGrid(cv) }, at: [0, 0] };
}

/**
 * A balloon from a typed silhouette: `X` cells are the piece, `.` is the air. It is shaded in four colors (dark to the shine) by a
 * light from the top left, and given its glints (`glint`: cells at the lit top of a lobe, the shine) and any `eye` cell.
 */
function fromMask(rows: readonly string[], colors: string, opts: { glint?: readonly Pt[]; eye?: Pt } = {}): { part: Part; at: Pt } {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const cv: Canvas = canvas(w, h);
  const light = roundLight(w / 2, h / 2, w / 2, h / 2, -0.12);
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === "X") cv[y]![x] = ramp(colors, light(x, y));
    }),
  );
  for (const [x, y] of opts.glint ?? []) cv[y]![x] = colors[colors.length - 1]!;
  if (opts.eye) cv[opts.eye[1]]![opts.eye[0]] = colors[0]!;
  return { part: { grid: toGrid(cv) }, at: [0, 0] };
}

/** A bishop: a knob, a mitre with a notch down its middle, a collar, a round body and a flared foot. */
const BISHOP = fromMask(
  [
    "...XXX...",
    "..XXXXX..",
    "..XXXXX..",
    ".XXXXXXX.",
    ".XXX.XXX.",
    "..XX.XX..",
    "...XXX...",
    "..XXXXX..",
    ".XXXXXXX.",
    ".XXXXXXX.",
    ".XXXXXXX.",
    "XXXXXXXXX",
    ".XXXXXXX.",
  ],
  "1234",
  { glint: [[3, 1], [2, 8]] },
);

/** A knight: a horse's head looking our way (left), its ear, its mane notched down the back of the neck, an eye and a foot. */
const KNIGHT = fromMask(
  [
    "....XX....",
    "...XXXX...",
    "..XXXXXX..",
    ".XXXXXXXX.",
    "XXXXXXXXX.",
    "XXXXXXXXXX",
    "XXXXXXXXXX",
    ".XXXXXXXXX",
    "..XXXXXXXX",
    "...XXXXXXX",
    "..XXXXXXXX",
    ".XXXXXXXXX",
  ],
  "5678",
  { glint: [[4, 1], [2, 4]], eye: [3, 3] },
);

/** A rook: a castle, three battlements with two notches, a body and a wide base. */
const ROOK = fromMask(
  [
    "XXX.XX.XX",
    "XXX.XX.XX",
    "XXXXXXXXX",
    ".XXXXXXX.",
    "..XXXXX..",
    "..XXXXX..",
    "..XXXXX..",
    "..XXXXX..",
    "..XXXXX..",
    ".XXXXXXX.",
    ".XXXXXXX.",
    "XXXXXXXXX",
  ],
  "90+=",
  { glint: [[1, 2], [2, 6]] },
);

/** A pawn: a round head, a collar, a cone of body and a foot. */
const PAWN = balloon(
  7,
  9,
  union(E(3.5, 2.2, 2.1, 2.1), E(3.5, 4.8, 2.3, 0.9), inPoly([[2.0, 5.6], [5.0, 5.6], [5.9, 7.8], [1.1, 7.8]]), E(3.5, 8.1, 2.9, 1.0)),
  "&*^~",
);

// The balloons' places (local): each box's top-left. Their knots (the bottom middle) are where the strings are tied.
const BALLOON_AT = {
  bishop: [11, 1] as Pt,
  knight: [-3, 0] as Pt,
  pawn: [-1, 15] as Pt,
  rook: [-5, 27] as Pt,
};
/** The grip: the top of the paw, where the strings are tied. */
const GRIP: Pt = [4, 42];

/** A string from a knot down to the grip, through any `via` points (to keep it off his face): 1-pixel lines, no outline of their own. */
function string(from: Pt, via: readonly Pt[], to: Pt): { part: Part; at: Pt } {
  const pts = [from, ...via, to];
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0]))) - 1;
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1]))) - 1;
  const w = Math.ceil(Math.max(...pts.map((p) => p[0]))) - x0 + 2;
  const h = Math.ceil(Math.max(...pts.map((p) => p[1]))) - y0 + 2;
  const cv: Canvas = canvas(w, h);
  pts.slice(1).forEach((b, i) => {
    const a = pts[i]!;
    line(cv, Math.round(a[0]) - x0, Math.round(a[1]) - y0, Math.round(b[0]) - x0, Math.round(b[1]) - y0, "N");
  });
  return { part: { grid: toGrid(cv), outline: false }, at: [x0, y0] };
}

/** The shadow on the ground under his feet. */
function shadow(): { part: Part; at: Pt } {
  return painted(12, GROUND, 44, 3, (F) => F(E(FOOT_X, GROUND + 0.6, 22, 1.4), () => "z"), false);
}

// ---- The still: every part, back to front, placed by its own numbers.

interface Built {
  parts: Record<string, Part>;
  layers: Layer[];
}

/** Everything drawn, in the order it stacks (back to front). The still's layers are the frame's idle. */
function build(): Built {
  const pieces: [string, { part: Part; at: Pt }][] = [
    ["shadow", shadow()],
    ["tail", tail()],
    ["legHF", leg(47, 45, GROUND, 3.6, 4.6, [53])],
    ["legHN", leg(40, 45, GROUND, 3.8, 5.0, [53])],
    ["legFF", leg(24, 45, GROUND, 3.6, 4.4, [52])],
    ["torso", torso()],
    ["earF", ear(29, 21.5, 2.5)],
    ["earN", ear(16, 22.5, 2.6)],
    ["head", head()],
    ["jaw", jaw()],
    ["eyeF", typed(EYE_FAR, [21, 23])],
    ["eyeN", typed(EYE_NEAR, [15, 26])],
    ["hat", typed(HAT, [21, 15])],
    ["arm", arm()],
    ["paw", typed(PAW, [2, 42])],
    ["string:knight", string([BALLOON_AT.knight[0] + 2, BALLOON_AT.knight[1] + 12], [], GRIP)],
    ["string:pawn", string([BALLOON_AT.pawn[0] + 3, BALLOON_AT.pawn[1] + 9], [], GRIP)],
    ["string:rook", string([BALLOON_AT.rook[0] + 4, BALLOON_AT.rook[1] + 12], [], GRIP)],
    // Level above his head, then down in front of the nose, so it never crosses his face.
    ["string:bishop", string([BALLOON_AT.bishop[0] + 4, BALLOON_AT.bishop[1] + 13], [[3, 14]], GRIP)],
    ["bishop", { part: BISHOP.part, at: BALLOON_AT.bishop }],
    ["knight", { part: KNIGHT.part, at: BALLOON_AT.knight }],
    ["pawn", { part: PAWN.part, at: BALLOON_AT.pawn }],
    ["rook", { part: ROOK.part, at: BALLOON_AT.rook }],
  ];
  const parts: Record<string, Part> = {};
  const layers: Layer[] = pieces.map(([name, { part, at }]) => {
    parts[name] = part;
    return { part: name, x: MX + at[0], y: MY + at[1] };
  });
  return { parts, layers };
}

const BUILT = build();

/** The frame's size: the figure with its halo and a margin (the balloons reach the left and top edges). */
const TIGER_W = 78;
const TIGER_H = 70;

export const TIGER: Character = {
  id: "tiger",
  name: "Tiger",
  w: TIGER_W,
  h: TIGER_H,
  foot: [MX + FOOT_X, MY + GROUND],
  palette: TIGER_PALETTE,
  halo: HALO,
  parts: BUILT.parts,
  anims: {
    idle: { loop: true, frames: [{ ms: 1000, layers: BUILT.layers } satisfies Frame] },
  },
};

/** The part of him a portrait shows (his hat and head, in frame pixels). */
export const TIGER_PORTRAIT = { x: MX + 7, y: MY + 14, w: 30, h: 31 } as const;
