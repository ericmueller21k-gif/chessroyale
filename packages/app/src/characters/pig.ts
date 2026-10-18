/**
 * Wrangler, the cowboy pig who rounds up livestock (Eric named him, Oct 13, 2026; his code id stays `pig`, since
 * "wrangler" is already Cloudflare's CLI in this repo), after Eric's reference picture, redrawn. A pink pig in a wide
 * fighting crouch: a brown cowboy hat with a dark band and a gold star, pointy pink ears, angry brows, a big snout and
 * a toothy, scheming grin; a brown vest with a fringe and a gold star, a belt with a big gold buckle, brown boots with
 * gold spurs; one lasso spinning overhead in a big loop (his right hand, on our left) and a coil of rope in the other.
 * Drawn facing front, turned a little to our left as in the reference, light from the top left.
 *
 * A playable boss since Oct 13, 2026 (his kit "Wrangler" in kits.ts; his powers on screen in components/Pig.tsx; his
 * rules in packages/chess/src/bosses/pig.ts): his lasso throw's `CATCH` point lands on the piece he drags, he hops on
 * and off the board (`leap`), winds up both loops for his showdown (`windup`) and hauls its pairs in (`haul`, the board
 * drawing the ropes from his fists). His lines: PIG_LINES; his sounds: characters/pig-sounds.ts.
 *
 * Rigging: the head (one per face), the body and the boots are painted once; the legs and arms from their points (a
 * hip, a knee and an ankle; a shoulder, an elbow and a fist); the hat from its tilt (so he can tip it); every rope (the
 * spinning loop, the line to it, the coil, the slack) from its path: a loop is an ellipse (its center, radii and
 * tilt), and the line runs from his fist to the loop's nearest point. So a lasso pose is a few numbers. Every part is
 * painted the first time a frame that uses it shows (sprite.ts lazyParts).
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "./paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";
import { KING_ATTACK } from "@chessroyale/chess";
import { groundShadow, moved } from "./attack-frame.ts";

export const PIG_PALETTE: Record<string, string> = {
  k: "#2b1411", // outline
  a: "#c0566a", // pink skin, dark to light
  b: "#e47a8a",
  c: "#f7a1aa",
  d: "#ffc9c9",
  e: "#ffe0dc", // the snout's shine
  n: "#93354a", // the snout's rim, inside his ears
  x: "#170909", // pupils, nostrils, the mouth's line
  w: "#ffffff", // eye whites, teeth
  i: "#d8c6c2", // the gaps between his teeth
  u: "#6a1b29", // inside his mouth
  g: "#e8586d", // tongue
  B: "#331509", // brows
  H: "#4a2611", // leather (hat, vest, boots): dark to light
  h: "#6c3d1c",
  j: "#8f5629",
  J: "#b5733a",
  q: "#2c170e", // the hat's band, the belt
  Q: "#4b2c1b",
  O: "#a8700f", // gold: shade, mid, light, shine
  Y: "#e6ac2a",
  y: "#ffd451",
  L: "#fff3b0",
  r: "#8c5a26", // rope: dark, mid, light
  R: "#c58f4b",
  t: "#ecc47c",
  s: "#bfb7b2", // snorts: shade, puff
  S: "#f3efeb",
  U: "#c4ab8a", // dust
  V: "#6f5a44",
  z: "#0d0e12", // ground shadow
};

type Pt = readonly [number, number];
const SKIN = "abcd";
const LEATHER = "Hhj";

/** Fills every pixel of `cv` (whose top-left is drawing-space (x0, y0)) inside `inside` with `key(x, y)` (drawing space). */
function fill(cv: Canvas, x0: number, y0: number, inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string): void {
  for (let y = 0; y < cv.length; y++)
    for (let x = 0; x < cv[0]!.length; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
}
const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;

/** Rows stamped at drawing-space (x0, y0) onto a canvas whose top-left is (cx0, cy0); `.` leaves a pixel. */
function stamp(cv: Canvas, cx0: number, cy0: number, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, y) =>
    [...row].forEach((k, i) => {
      if (k === ".") return;
      const X = x0 + i - cx0;
      const Y = y0 + y - cy0;
      if (cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
    }),
  );
}

/** A gold star, 5 x 5 (the hat's badge, the vest's). */
const STAR = ["..y..", ".yyy.", "yyLyy", ".yYy.", ".Y.Y."];

// ---- The head: one face per mood. Everything in drawing space (the ground at y 70).

export type Mood = "sneer" | "blink" | "smug" | "snort" | "laugh" | "fierce" | "wild" | "grit";

const HX = 18;
const HY = 10;
const HEAD_W = 44;
const HEAD_H = 35;

/** His eyes and brows: [rows, top-left] for each; `B` brow, `w` white, `x` pupil. `.` leaves his face. */
const EYES: Record<string, { l: readonly string[]; r: readonly string[] }> = {
  /** The glare: brows down hard to his snout, the pupils turned in. */
  glare: {
    l: ["BBB.....", ".BBBBB..", "..wwBBBB", ".wwwwxxB", ".wwwwxx.", "..wwww.."],
    r: [".....BBB", "..BBBBB.", "BBBBww..", "Bxxwwww.", ".xxwwww.", "..wwww.."],
  },
  shut: {
    l: ["BBB.....", ".BBBBB..", "....BBBB", "........", ".xxxxxx.", "........"],
    r: [".....BBB", "..BBBBB.", "BBBB....", "........", ".xxxxxx.", "........"],
  },
  /** One brow cocked (his far one, our right): a knowing sneer. */
  sly: {
    l: ["BBB.....", ".BBBBB..", "..wwBBBB", ".wwwwxxB", "..wwwxx.", "........"],
    r: ["..BBBBB.", ".B....BB", "..wwww..", ".xxwwww.", ".xxwwww.", "..wwww.."],
  },
  /** Squeezed tight (a snort, a laugh): happy arcs under angry brows. */
  squeeze: {
    l: ["BBB.....", ".BBBBB..", "....BBBB", "........", "..xxxx..", ".x....x."],
    r: [".....BBB", "..BBBBB.", "BBBB....", "........", "..xxxx..", ".x....x."],
  },
  /** Wide and wild: round, the pupils small. */
  wild: {
    l: ["BBBB....", "....BBB.", "..wwww..", ".wwwwww.", ".wwwxxw.", "..wwxx.."],
    r: ["....BBBB", ".BBB....", "..wwww..", ".wwwwww.", ".wxxwww.", "..xxww.."],
  },
  /** Narrowed (the throw, the tug). */
  narrow: {
    l: ["BBB.....", ".BBBBB..", "..BBBBBB", ".wwwwxxB", "..wwwxx.", "........"],
    r: [".....BBB", "..BBBBB.", "BBBBBB..", "Bxxwwww.", ".xxwww..", "........"],
  },
};
const EYE_L: Pt = [23, 26];
const EYE_R: Pt = [38, 26];

/** The mouth, stamped from (33, 36): a wide grin rising to his near cheek (our right), full of teeth. */
const MOUTHS: Record<string, readonly string[]> = {
  grin: [
    "..............xx", //
    "............xxwx",
    ".........xxxwwwx",
    ".....xxxxwwiwwx.",
    "..xxxwwiwwwwxx..",
    "..xwwwwiwwxx....",
    "...xxxxxxx......",
  ],
  /** One side curled up, teeth that side only. */
  sneer: [
    "..............xx", //
    "............xxwx",
    "...........xwiwx",
    "..........xwwwx.",
    "..xxxxxxxxxxxx..",
    "................",
    "................",
  ],
  /** Wide open, a laugh: teeth on top, the tongue. */
  laugh: [
    "..............x.", //
    "...........xxxwx",
    "..xxxxxxxxxwiwwx",
    ".xwwiwwiwwiwwwx.",
    ".xuuuuuuuuuuux..",
    "..xuuggggguux...",
    "...xxxxxxxxx....",
  ],
  /** Gritted: both rows of teeth. */
  grit: [
    "................", //
    "............xxx.",
    "..xxxxxxxxxxwwx.",
    ".xwiwwiwwiwwiwx.",
    ".xwiwwiwwiwwix..",
    "..xxxxxxxxxxx...",
    "................",
  ],
  /** Open, a whoop (wild). */
  whoop: [
    "..............x.", //
    "..xxxxxxxxxxxxwx",
    ".xwwiwwiwwiwwwx.",
    ".xuuuuuuuuuuux..",
    "..xuuggggguux...",
    "...xxxxxxxxxx...",
    "................",
  ],
};
/** The snout's nostrils: flared for a snort. */
const NOSTRILS: Record<string, readonly string[]> = {
  plain: ["xx...xx", "xx...xx"],
  flared: [".xx.xx.", "xxx.xxx", ".x...x."],
};
const FACES: Record<Mood, { eyes: string; mouth: string; nostrils?: string; snoutDy?: number }> = {
  sneer: { eyes: "glare", mouth: "grin" },
  blink: { eyes: "shut", mouth: "grin" },
  smug: { eyes: "sly", mouth: "sneer" },
  snort: { eyes: "squeeze", mouth: "sneer", nostrils: "flared", snoutDy: -1 },
  laugh: { eyes: "squeeze", mouth: "laugh", nostrils: "flared" },
  fierce: { eyes: "narrow", mouth: "grit" },
  wild: { eyes: "wild", mouth: "whoop" },
  grit: { eyes: "narrow", mouth: "grit", nostrils: "flared" },
};

function head(mood: Mood): Part {
  const cv = canvas(HEAD_W, HEAD_H);
  const F = (inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string) => fill(cv, HX, HY, inside, key);
  const light = roundLight(33, 26, 18, 14, 0.24);
  // The ears: the far one (our left) up behind his hat's brim, the near one out from under it to our right.
  F(inPoly([[22, 26], [21.5, 12], [32, 21]]), (x, y) => ramp("bcd", light(x, y)));
  F(inPoly([[23.5, 23.5], [23, 15.5], [28.5, 20.5]]), () => "n");
  F(inPoly([[48, 22], [60.5, 17], [55, 31]]), (x, y) => ramp("abc", light(x, y) - 0.1));
  F(inPoly([[50.5, 23], [58, 19.5], [54.5, 27.5]]), () => "n");
  // His head: broad, with heavy jowls; in shadow under the brim.
  const skull = (x: number, y: number) => inEllipse(37.5, 31, 16, 11)(x, y) || inEllipse(37.5, 36.2, 15, 7.6)(x, y);
  F(skull, (x, y) => ramp(SKIN, light(x, y) - (y < 24 ? 0.3 : 0)));
  const f = FACES[mood];
  const eyes = EYES[f.eyes]!;
  stamp(cv, HX, HY, eyes.l, EYE_L[0], EYE_L[1]);
  stamp(cv, HX, HY, eyes.r, EYE_R[0], EYE_R[1]);
  stamp(cv, HX, HY, MOUTHS[f.mouth]!, 33, 36);
  // The snout: a big light disc with a dark rim, a shine at its top left, two nostrils.
  const sy = f.snoutDy ?? 0;
  F(inEllipse(33.5, 35 + sy, 6.2, 4), () => "n");
  F(inEllipse(33.5, 34.8 + sy, 5.2, 3.1), (x, y) => (inEllipse(31.5, 33.4 + sy, 2.6, 1.4)(x, y) ? "e" : y > 36.5 + sy ? "c" : "d"));
  const nos = NOSTRILS[f.nostrils ?? "plain"]!;
  stamp(cv, HX, HY, nos, 30, 34 + sy - (nos.length > 2 ? 1 : 0));
  return { grid: toGrid(cv) };
}

// ---- The hat: painted from its tilt, so he can tip it.

/** A piece of a part in its own space (u across, v down from its anchor), colored by (u, v). Later pieces cover earlier. */
type Piece = { pts: readonly Pt[]; key: (u: number, v: number, inside: (u: number, v: number) => boolean) => string };

/** The hat in its own space: (0, 0) the middle of the crown's base. The brim sweeps up to our right, as in the reference. */
const HAT_PIECES: readonly Piece[] = [
  // The brim: its top lit, its edge and underside dark, curling up at our right.
  {
    pts: [[-21, 4.5], [-15.5, 1.2], [-9, -0.2], [9, -1.4], [15, -3.4], [19.5, -6.6], [22.5, -6.6], [21.5, -2.6], [16.5, 1.6], [8, 3.4], [-6, 4.4], [-14, 5.6], [-19.5, 6.8]],
    key: (u, v, inside) => (!inside(u, v + 1) ? "H" : !inside(u, v - 1) ? (u < 8 ? "J" : "j") : u > 16 ? "h" : !inside(u, v + 2) ? "h" : "j"),
  },
  // The crown: a pinched top with a dent, lit on our left.
  {
    pts: [[-9, 0.5], [-8.6, -7.5], [-7, -11], [-3.6, -12.2], [-0.6, -10.6], [2.6, -12.6], [6, -11.8], [8.4, -8.6], [9.6, -1.4]],
    key: (u, v, inside) => (!inside(u, v - 1) && u < 0 ? "J" : u < -6.6 ? "J" : Math.abs(u + 0.3 - v * 0.05) < 0.6 && v < -7 ? "h" : u > 6.4 ? "h" : "j"),
  },
  // The band: dark, along the crown's base.
  { pts: [[-9.1, -2.6], [9.5, -3.6], [9.7, -0.6], [-9.1, 0.6]], key: (_u, v) => (v < -2.6 ? "Q" : "q") },
];
/** The badge on the band, in the hat's own space (its top left). */
const BADGE_AT: Pt = [-4, -4];
const HAT_AT: Pt = [38, 20];

const rot = (a: number, [u, v]: Pt): Pt => [u * Math.cos(a) - v * Math.sin(a), u * Math.sin(a) + v * Math.cos(a)];

/** Pieces turned by `deg` about `at` (drawing space): the part and its top-left. */
function paintPieces(pieces: readonly Piece[], at: Pt, deg: number, extra?: (cv: Canvas, x0: number, y0: number) => void): { part: Part; at: Pt } {
  const a = (deg * Math.PI) / 180;
  const pts = pieces.flatMap((pc) => pc.pts.map((q) => { const [x, y] = rot(a, q); return [at[0] + x, at[1] + y] as Pt; }));
  const b = boxOf(pts, 1);
  const cv = canvas(b.w, b.h);
  const tests = pieces.map((pc) => inPoly(pc.pts));
  const toUV = (x: number, y: number): Pt => rot(-a, [x + 0.5 - at[0], y + 0.5 - at[1]]);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const [u, v] = toUV(b.x0 + x, b.y0 + y);
      for (let i = pieces.length - 1; i >= 0; i--) {
        const t = tests[i]!;
        const inside = (uu: number, vv: number) => t(uu - 0.5, vv - 0.5);
        if (inside(u, v)) {
          cv[y]![x] = pieces[i]!.key(u, v, inside);
          break;
        }
      }
    }
  extra?.(cv, b.x0, b.y0);
  return { part: { grid: toGrid(cv) }, at: [b.x0, b.y0] };
}

function hat(deg: number): { part: Part; at: Pt } {
  return paintPieces(HAT_PIECES, HAT_AT, deg, (cv, x0, y0) => {
    // The badge: a gold star on the band, placed by where its middle lands.
    const a = (deg * Math.PI) / 180;
    const [mx, my] = rot(a, [BADGE_AT[0] + 2.5, BADGE_AT[1] + 2.5]);
    const sx = Math.round(HAT_AT[0] + mx - 2.5) - x0;
    const sy = Math.round(HAT_AT[1] + my - 2.5) - y0;
    STAR.forEach((row, y) => [...row].forEach((k, x) => k !== "." && cv[sy + y]?.[sx + x] !== undefined && (cv[sy + y]![sx + x] = k)));
  });
}

// ---- The body: the torso, the vest and its fringe, the belt and its buckle.

function body(): Part {
  const X0 = 22;
  const Y0 = 38;
  const cv = canvas(36, 24);
  const F = (inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string) => fill(cv, X0, Y0, inside, key);
  const torso = inPoly([[26, 39.5], [51, 39], [54.5, 43.5], [55.5, 51], [55.2, 58], [24, 58], [23.5, 51], [24, 44.5]]);
  const light = roundLight(35, 44, 16, 13, 0.08);
  F(torso, (x, y) => ramp(SKIN, light(x, y)));
  F((x, y) => torso(x, y) && inEllipse(37.5, 48.5, 8.5, 6.5)(x, y), (x, y) => ramp("cd", light(x, y) + 0.2));
  // The vest: a panel each side, the near one (our right) wide, a fringe along their hems.
  const vestR = inPoly([[44, 39], [51, 39], [54.5, 43.5], [55.5, 51], [55, 52.6], [45.5, 52.6], [44.6, 46]]);
  const vestL = inPoly([[25.5, 39.6], [30.5, 39.4], [31, 45], [30, 51.6], [24, 51.6], [23.6, 45]]);
  F(vestR, (x, y) => (!vestR(x - 1, y) ? "J" : !vestR(x + 1, y) || y > 51 ? "H" : x > 52 ? "h" : "j"));
  F(vestL, (x, y) => (!vestL(x + 1, y) ? "h" : x < 25 ? "J" : "j"));
  for (let x = 24; x <= 55; x += 2) if (x <= 30 || x >= 46) stamp(cv, X0, Y0, ["H", "H"], x, x <= 30 ? 52 : 53);
  stamp(cv, X0, Y0, STAR, 47, 44);
  // The belt, and its big buckle.
  const belt = inPoly([[23.6, 54], [55.4, 53.6], [55.4, 57], [23.8, 57.4]]);
  F(belt, (_x, y) => (y > 56.4 ? "q" : "Q"));
  F(inEllipse(36, 55.5, 4.8, 3), () => "O");
  F(inEllipse(36, 55.5, 3.8, 2.1), (x, y) => (inEllipse(34.8, 54.8, 1.6, 0.9)(x, y) ? "L" : x + y < 90.5 ? "y" : "Y"));
  return { grid: toGrid(cv) };
}

/** A boot (the left one: its toe to our left, its spur at the heel, to our right). */
function boot(): Part {
  const cv = canvas(22, 10);
  const shaft = inPoly([[10, 0], [18.6, 0], [19, 6], [10, 6]]);
  const foot = inPoly([[0.6, 7.6], [2, 5], [5, 4], [10, 3.8], [19, 4.4], [19.4, 9], [1.2, 9]]);
  const light = roundLight(8, 2, 10, 6, 0.1);
  fill(cv, 0, 0, (x, y) => shaft(x, y) || foot(x, y), (x, y) => (y >= 8 ? "H" : y === 0 ? "J" : ramp(LEATHER + "J", light(x, y))));
  // The heel, darker; a seam where the shaft meets the foot.
  fill(cv, 0, 0, (x, y) => x >= 15 && y >= 7 && foot(x, y), () => "H");
  stamp(cv, 0, 0, ["hhhhhhhhh"], 10, 5);
  // The spur: a gold strap round the heel and its rowel out behind.
  stamp(cv, 0, 0, ["OYYO"], 16, 6);
  stamp(cv, 0, 0, [".y.", "yOy", ".y."], 19, 5);
  return { grid: toGrid(cv) };
}

function shadow(): Part {
  const cv = canvas(66, 3);
  fill(cv, 0, 0, inEllipse(33, 1.5, 33, 1.6), () => "z");
  return { grid: toGrid(cv), outline: false };
}

// ---- Limbs: a thick round stroke along a few points, shaded like a cylinder.

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function boxOf(pts: readonly Pt[], pad: number): { x0: number; y0: number; w: number; h: number } {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - pad;
  const y0 = Math.floor(Math.min(...ys)) - pad;
  return { x0, y0, w: Math.ceil(Math.max(...xs)) + pad - x0 + 1, h: Math.ceil(Math.max(...ys)) + pad - y0 + 1 };
}
function paintLimb(pts: readonly Pt[], r: number, r1: number): Part {
  const b = boxOf(pts, Math.ceil(Math.max(r, r1)) + 1);
  const cv = canvas(b.w, b.h);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const p: Pt = [b.x0 + x + 0.5, b.y0 + y + 0.5];
      let best = { d: Infinity, nx: 0, ny: 0, rr: r };
      pts.slice(1).forEach((q, i) => {
        const n = nearest(p, pts[i]!, q);
        const rr = r + (r1 - r) * ((i + n.t) / (pts.length - 1));
        if (n.d - rr < best.d - best.rr) best = { d: n.d, nx: n.nx, ny: n.ny, rr };
      });
      if (best.d > best.rr) continue;
      cv[y]![x] = ramp(SKIN, 0.62 - 0.42 * (best.nx / best.rr) - 0.5 * (best.ny / best.rr));
    }
  return { grid: toGrid(cv) };
}

/** A fist, knuckles to the front: 6 x 6. */
function fist(): Part {
  const cv = canvas(6, 6);
  fill(cv, 0, 0, inEllipse(3, 3, 3.1, 3.1), (x, y) => ramp(SKIN, roundLight(2.4, 2.2, 3.2, 3.2, 0.12)(x, y)));
  stamp(cv, 0, 0, ["b.b.b"], 1, 2);
  return { grid: toGrid(cv) };
}

// ---- Rope: a 2-pixel cord along a path, twisted (a darker tick every 3 pixels), its far side in shade.

/**
 * Paints a rope along `path` (drawing space). `phase` slides the twist along it (a spinning loop's twist runs round);
 * `shade(i)` says whether the i-th point is on the far side (darker).
 */
function rope(path: readonly Pt[], phase: number, shade?: (i: number) => boolean, knot?: (i: number) => boolean): { part: Part; at: Pt } {
  const b = boxOf(path, 2);
  const cv = canvas(b.w, b.h);
  let s = 0;
  path.forEach((p, i) => {
    if (i > 0) s += Math.hypot(p[0] - path[i - 1]![0], p[1] - path[i - 1]![1]);
    const u = (((s + phase) % 3) + 3) % 3;
    const far = shade?.(i) ?? false;
    const k = u < 1 ? "r" : far ? "R" : u < 2 ? "R" : "t";
    const X = Math.floor(p[0] - 0.5) - b.x0;
    const Y = Math.floor(p[1] - 0.5) - b.y0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const row = cv[Y + dy];
      if (row && row[X + dx] !== undefined) row[X + dx] = dy === 1 && k === "t" ? "R" : k;
    }
  });
  // The knot (the honda): a fat dark lump on the rope, painted over it.
  path.forEach((p, i) => {
    if (!knot?.(i)) return;
    const X = Math.floor(p[0] - 0.5) - b.x0;
    const Y = Math.floor(p[1] - 0.5) - b.y0;
    for (const [dx, dy] of [[-1, 0], [0, -1], [1, -1], [2, 0], [-1, 1], [0, 2], [1, 2], [2, 1], [0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const row = cv[Y + dy];
      if (row && row[X + dx] !== undefined) row[X + dx] = dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1 ? "t" : "R";
    }
  });
  return { part: { grid: toGrid(cv) }, at: [b.x0, b.y0] };
}

/** A path sampled every ~0.25 px along a polyline. */
function densify(pts: readonly Pt[], closed = false): Pt[] {
  const out: Pt[] = [];
  const all = closed ? [...pts, pts[0]!] : pts;
  for (let i = 1; i < all.length; i++) {
    const [a, c] = [all[i - 1]!, all[i]!];
    const n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / 0.25));
    for (let j = 0; j < n; j++) out.push([a[0] + ((c[0] - a[0]) * j) / n, a[1] + ((c[1] - a[1]) * j) / n]);
  }
  if (!closed) out.push(all.at(-1)!);
  return out;
}

/** A loop of rope: an ellipse, its center, radii and tilt (degrees, positive turns its right end down). */
export interface Loop {
  c: Pt;
  rx: number;
  ry: number;
  tilt: number;
}
function loopPoints(l: Loop, n = 72): { p: Pt; far: boolean }[] {
  const a = (l.tilt * Math.PI) / 180;
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI;
    const [x, y] = rot(a, [l.rx * Math.cos(t), l.ry * Math.sin(t)]);
    return { p: [l.c[0] + x, l.c[1] + y] as Pt, far: Math.sin(t) < 0 };
  });
}
/** A quadratic curve from a to c bowing through b (its control point). */
const curve = (a: Pt, b: Pt, c: Pt, n = 24): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]];
  });

// ---- Parts and poses.

const { parts: PARTS, add } = lazyParts();
const MOODS: readonly Mood[] = ["sneer", "blink", "smug", "snort", "laugh", "fierce", "wild", "grit"];
for (const m of MOODS) add(`head:${m}`, () => head(m));
add("body", body);
add("boot", boot);
add("shadow", shadow);
add("fist", fist);

const r2 = (v: number) => Math.round(v * 2) / 2;
type Placed = { name: string; at: Pt };
function limb(kind: "arm" | "leg", pts: readonly Pt[]): Placed {
  const q = pts.map((p): Pt => [r2(p[0]), r2(p[1])]);
  const name = `${kind}:${q.map((p) => p.join(",")).join(";")}`;
  const [r, r1] = kind === "arm" ? [3.2, 2.6] : [5.4, 4.2];
  add(name, () => paintLimb(q, r, r1));
  const b = boxOf(q, Math.ceil(Math.max(r, r1)) + 1);
  return { name, at: [b.x0, b.y0] };
}
const placedCache = new Map<string, Pt>();
/** A part painted with its own top-left (a rope, the hat): registered by name, its top-left worked out once. */
function placedPart(name: string, make: () => { part: Part; at: Pt }): Placed {
  let at = placedCache.get(name);
  if (!at) {
    const made = make();
    add(name, () => made.part);
    placedCache.set(name, (at = made.at));
  }
  return { name, at };
}
const hatLayer = (deg: number) => placedPart(`hat:${deg}`, () => hat(deg));
const q2 = (l: Loop): Loop => ({ c: [r2(l.c[0]), r2(l.c[1])], rx: r2(l.rx), ry: r2(l.ry), tilt: Math.round(l.tilt) });
const loopKey = (l: Loop) => `${l.c.join(",")};${l.rx};${l.ry};${l.tilt}`;
/** A loop's rope; `knot` puts its knot that far round it (turns, from its right end, clockwise), or none. */
function loopLayer(l0: Loop, phase: number, knot: number | null = null): Placed {
  const l = q2(l0);
  const ph = ((Math.round(phase) % 3) + 3) % 3;
  const kn = knot === null ? null : Math.round((((knot % 1) + 1) % 1) * 72) % 72;
  return placedPart(`loop:${loopKey(l)};${ph};${kn ?? "-"}`, () => {
    const pts = loopPoints(l);
    const path = densify(pts.map((q) => q.p), true);
    // Far side: the samples between the far points (the path is densified evenly between the ellipse's points).
    const per = path.length / pts.length;
    const at = kn === null ? -1 : kn * per;
    return rope(path, ph, (i) => pts[Math.floor(i / per) % pts.length]!.far, kn === null ? undefined : (i) => Math.abs(i - at) < per * 0.6);
  });
}
/** The line from a fist to a loop: it leaves the fist upward (or toward the loop) and bows a little. */
function lineLayer(from: Pt, to: Pt, bow: Pt): Placed {
  const a: Pt = [r2(from[0]), r2(from[1])];
  const c: Pt = [r2(to[0]), r2(to[1])];
  const b: Pt = [r2(bow[0]), r2(bow[1])];
  return placedPart(`line:${a.join(",")};${b.join(",")};${c.join(",")}`, () => rope(densify(curve(a, b, c)), 0));
}
/** Where a loop's rope comes nearest a point (its honda, where the line joins it). */
function nearestOnLoop(l: Loop, p: Pt): Pt {
  let best: Pt = l.c;
  let d = Infinity;
  for (const { p: q } of loopPoints(q2(l))) {
    const dd = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (dd < d) [d, best] = [dd, q];
  }
  return best;
}

/** Where his own drawing space (the ground at y 70) sits on the frame, and the frame's size (room to throw, to our right). */
const OX = 3;
const OY = 3;
const GROUND = 70;
const W = OX + 112;
const H = OY + GROUND + 4;

const SHOULDER_L: Pt = [27, 42.5];
const SHOULDER_R: Pt = [52.5, 43];
/** His spinning arm at rest: the fist up by his head (our left), the loop over it. */
const FIST_L: Pt = [15, 32];
const ELBOW_L: Pt = [20, 40.5];
const FIST_R: Pt = [61, 46];
const ELBOW_R: Pt = [57, 47];
/** The loop at rest (spin 0): up to our left, its right end rising. */
export const LOOP_REST: Loop = { c: [19, 12], rx: 15, ry: 6.6, tilt: -14 };

/** The loop over his head at a point of its spin (eighths of a turn): it swings round, foreshortening as it goes. */
export function spinLoop(spin: number, grow = 0): Loop {
  const t = (spin / 8) * 2 * Math.PI;
  return {
    c: [LOOP_REST.c[0] + 2.5 * Math.cos(t) + grow * 0.5, LOOP_REST.c[1] + 1 * Math.sin(t) + grow * 0.5],
    rx: LOOP_REST.rx - 1 + Math.cos(t) * 2 + grow,
    ry: LOOP_REST.ry + 0.8 * Math.sin(t),
    tilt: LOOP_REST.tilt + 7 * Math.sin(t),
  };
}

/** The second loop, spinning over his other side (the big double lasso): the first one's mirror, half a turn on. */
export function spinLoop2(spin: number, grow = 0): Loop {
  const l = spinLoop(spin + 4, grow);
  return { c: [78 - l.c[0], l.c[1]], rx: l.rx, ry: l.ry, tilt: -l.tilt };
}

export interface PigPose {
  mood?: Mood;
  /** Down at the knees: everything above the boots down a pixel or two. */
  bob?: number;
  /** Everything above the boots sideways (a lean). */
  lean?: number;
  headDx?: number;
  headDy?: number;
  /** The hat: tipped (degrees, its right end down when positive) and lifted. */
  hat?: { tilt?: number; dx?: number; dy?: number };
  /** The spinning loop's point in its spin (eighths of a turn), when it's overhead; `grow` widens it (a wind-up). */
  spin?: number;
  grow?: number;
  /** The loop somewhere else (thrown), or null: no loop. Left out: spinning overhead. */
  loop?: Loop | null;
  /** The loops in front of him (thrown across), not behind his head. */
  front?: boolean;
  /** The line to the loop bowing (a thrown loop's sag): its control point; else it rises from the fist. */
  bow?: Pt;
  /** His spinning arm: its fist and elbow (drawing space). */
  fistL?: Pt;
  elbowL?: Pt;
  /** His coil arm: its fist and elbow. */
  fistR?: Pt;
  elbowR?: Pt;
  /** The coil: hanging from his fist, swaying (px), or null (shaken out into a second loop). */
  coil?: number | null;
  /** The second loop (the big double lasso): somewhere, or "spin" (spinning over his other side), and its line's bow. */
  loop2?: Loop | "spin" | null;
  bow2?: Pt;
  /** His feet moved (a stomp): each foot's offset, its leg following. */
  feet?: { l?: Pt; r?: Pt };
}

/** A fist circling a little as it spins its loop (eighths of a turn). */
const circling = (fist: Pt, spin: number, dir = 1): Pt => {
  const t = (spin / 8) * 2 * Math.PI;
  return [fist[0] + dir * Math.cos(t), fist[1] + 0.8 * Math.sin(t)];
};
const SPIN_FIST_R: Pt = [62, 32];
const SPIN_ELBOW_R: Pt = [57, 40.5];

export function pigLayers(p: PigPose): Layer[] {
  const bob = p.bob ?? 0;
  const lean = p.lean ?? 0;
  const spin = p.spin ?? 0;
  const grow = p.grow ?? 0;
  const at = (part: string, x: number, y: number, flipX = false): Layer => ({ part, x: OX + Math.round(x), y: OY + Math.round(y), ...(flipX ? { flipX } : {}) });
  const L = (l: Placed) => at(l.name, l.at[0], l.at[1]);
  const up = (q: Pt): Pt => [q[0] + lean, q[1] + bob];
  const fl = p.feet?.l ?? [0, 0];
  const fr = p.feet?.r ?? [0, 0];
  // Legs: from the hips (riding the bob) to the boots' tops.
  const legL = limb("leg", [up([32, 56]), [23 + lean / 2 + fl[0] / 2, 59 + bob / 2 + fl[1] / 2], [20.5 + fl[0], 63 + fl[1]]]);
  const legR = limb("leg", [up([44, 56]), [53 + lean / 2 + fr[0] / 2, 59 + bob / 2 + fr[1] / 2], [55 + fr[0], 63 + fr[1]]]);
  // The spinning arm, its loop and the line to it (the line joins the loop where the loop comes nearest his fist).
  const spinning = p.loop === undefined;
  const fL = up(p.fistL ?? (spinning ? circling(FIST_L, spin) : FIST_L));
  const eL = up(p.elbowL ?? ELBOW_L);
  const armL = limb("arm", [up(SHOULDER_L), eL, fL]);
  const loop = spinning ? spinLoop(spin, grow) : p.loop;
  const loopL = loop ? loopLayer(loop, -spin, spinning ? spin / 8 + 0.25 : null) : null;
  const grip: Pt = [fL[0], fL[1] - 2];
  const honda = loop ? nearestOnLoop(loop, grip) : null;
  const line = loop && honda ? lineLayer(grip, honda, p.bow ?? [(grip[0] + honda[0]) / 2 - 1.5, (grip[1] + honda[1]) / 2]) : null;
  // The slack hanging from his spinning fist (paid out when he throws).
  const slack = spinning ? placedPart(`slack:${r2(fL[0])},${r2(fL[1])}`, () => rope(densify(loopPoints({ c: [fL[0] - 2.5, fL[1] + 5.5], rx: 2.2, ry: 5.2, tilt: 12 }, 40).map((q) => q.p), true), 1)) : null;
  // The coil arm: the coil hanging from its fist, or the second loop.
  const spinning2 = p.loop2 === "spin";
  const fR = up(p.fistR ?? (spinning2 ? circling(SPIN_FIST_R, spin + 4, -1) : FIST_R));
  const eR = up(p.elbowR ?? (spinning2 ? SPIN_ELBOW_R : ELBOW_R));
  const armR = limb("arm", [up(SHOULDER_R), eR, fR]);
  const coilRings =
    p.coil === null || p.loop2
      ? []
      : [0, 1, 2].map((i) => {
          const sway = p.coil ?? 0;
          const ring: Loop = { c: [fR[0] + 5.5 + i * 1.4 + sway * (0.4 + i * 0.3), fR[1] + 7.6 + i * 0.4], rx: 5.8 - i * 0.2, ry: 8 - i * 0.2, tilt: 6 + sway * 2 };
          return loopLayer(ring, i);
        });
  const l2 = p.loop2 === "spin" ? spinLoop2(spin, grow) : (p.loop2 ?? null);
  const loop2 = l2 ? loopLayer(l2, spin, spinning2 ? (spin + 4) / 8 + 0.25 : null) : null;
  const grip2: Pt = [fR[0], fR[1] - 2];
  const honda2 = l2 ? nearestOnLoop(l2, grip2) : null;
  const line2 = l2 && honda2 ? lineLayer(grip2, honda2, p.bow2 ?? [(grip2[0] + honda2[0]) / 2 + 1.5, (grip2[1] + honda2[1]) / 2]) : null;
  const hx = lean + (p.headDx ?? 0);
  const hy = bob + (p.headDy ?? 0);
  const ht = p.hat ?? {};
  const hatL = hatLayer(Math.round(ht.tilt ?? 0));
  const back = (l: Placed | null) => (l && !p.front ? [L(l)] : []);
  const ahead = (l: Placed | null) => (l && p.front ? [L(l)] : []);
  return [
    at("shadow", 4, GROUND - 2),
    ...back(loopL),
    ...back(loop2),
    L(legL),
    L(legR),
    at("boot", 6 + fl[0], GROUND - 9 + fl[1]),
    at("boot", 48 + fr[0], GROUND - 9 + fr[1], true),
    at("body", 22 + lean, 38 + bob),
    ...(slack ? [L(slack)] : []),
    ...(p.front ? [] : [L(armL)]),
    ...back(line),
    at(`head:${p.mood ?? "sneer"}`, HX + hx, HY + hy),
    at(hatL.name, hatL.at[0] + hx + (ht.dx ?? 0), hatL.at[1] + hy + (ht.dy ?? 0)),
    ...(p.front ? [] : [at("fist", fL[0] - 3, fL[1] - 3)]),
    L(armR),
    ...coilRings.map(L),
    ...back(line2),
    ...(p.front ? [] : [at("fist", fR[0] - 3, fR[1] - 3)]),
    // Thrown: the arms, the lines and the loops across the front of him, the fists over the lines.
    ...(p.front ? [L(armL)] : []),
    ...ahead(line),
    ...ahead(loopL),
    ...ahead(line2),
    ...ahead(loop2),
    ...(p.front ? [at("fist", fL[0] - 3, fL[1] - 3), at("fist", fR[0] - 3, fR[1] - 3)] : []),
  ];
}

// ---- Animations.

/** A frame of a pose; its specks stay a pixel inside the frame. */
const f = (ms: number, p: PigPose, extra: Partial<Frame> = {}): Frame => ({
  ms,
  layers: pigLayers(p),
  ...extra,
  ...(extra.specks ? { specks: extra.specks.filter(([x, y]) => x >= 2 && y >= 2 && x <= W - 3 && y <= H - 3) } : {}),
});

/** A snort: two puffs out of his nostrils, `t` frames on (0 to 3), blowing out and down (his head moved by (dx, dy)). */
function puffs(t: number, dx = 0, dy = 0): Speck[] {
  if (t < 0 || t > 3) return [];
  return [-1, 1].flatMap((side): Speck[] => {
    const X = Math.round(OX + (side < 0 ? 29 : 38) + dx + side * t * 1.7);
    const Y = Math.round(OY + 37 + dy + t * 0.8);
    return t < 2
      ? [[X, Y, "S"], [X + side, Y, "S"], [X, Y + 1, "s"], [X + side, Y - 1, "s"], [X - side, Y, "s"]]
      : t < 3
        ? [[X, Y, "S"], [X + side, Y, "s"]]
        : [[X, Y, "s"]];
  });
}
/** Dust kicked up at a spot on the ground (drawing space), `t` frames on. */
function dust([x, y]: Pt, t: number, n = 8): Speck[] {
  return Array.from({ length: n }, (_, i): Speck[] => {
    const side = i % 2 ? 1 : -1;
    const d = 1.5 + t * (1.1 + (i >> 1) * 0.45);
    const X = Math.round(OX + x + side * d);
    const Y = Math.round(OY + y - (i % 3) * 0.7 - t * 0.5 + t * t * 0.18);
    if (t > 2 && i % 2) return [];
    return [[X, Y, i % 3 ? "U" : "V"]];
  }).flat();
}
/** The stomp's dust, out from under both ends of his boot (the toe and the heel), `t` frames on. */
const stompDust = (t: number): Speck[] => [...dust([4, 70], t, 6), ...dust([29, 70], t, 6)];
/** A glint off a spur (drawing space): a little four-point star. */
const glint = ([x, y]: Pt, big: boolean): Speck[] => {
  const X = OX + x;
  const Y = OY + y;
  return big ? [[X, Y - 2, "L"], [X, Y + 2, "L"], [X - 2, Y, "L"], [X + 2, Y, "L"], [X, Y - 1, "y"], [X, Y + 1, "y"], [X - 1, Y, "y"], [X + 1, Y, "y"]] : [[X, Y - 1, "L"], [X - 1, Y, "L"], [X + 1, Y, "L"], [X, Y + 1, "L"]];
};
/** Where each spur's rowel is (drawing space), at rest. */
const SPUR_L: Pt = [26, 67];
const SPUR_R: Pt = [48, 67];

/** Idle: the loop spins overhead the whole time (a turn every 8 frames); he bobs, blinks, sneers and snorts. Silent. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 48 }, (_, i) => {
    const mood: Mood = i === 9 || i === 43 ? "blink" : i >= 18 && i < 26 ? "smug" : i >= 31 && i < 35 ? "snort" : "sneer";
    const bob = Math.floor(i / 4) % 4 === 3 ? 1 : 0;
    const snort = i >= 31 && i < 33 ? -1 : 0;
    return f(85, { mood, bob, headDy: snort, spin: i % 8 }, i >= 31 && i < 35 ? { specks: puffs(i - 31, 0, bob + snort) } : {});
  }),
};

/** The spin back into the idle: the rest of a turn (so its last frame leads into the idle's first), at its pace. */
const settle = (from: number, p: PigPose = {}): Frame[] => Array.from({ length: 8 - (from % 8) }, (_, i) => f(85, { mood: "smug", ...p, spin: (from + i) % 8 }));

/**
 * The lasso throw (for his passive: he ropes a piece and drags it a square): the spin quickens and widens, he hurls
 * the loop out to our right (cue `throw`), it drops over its mark on the ground (cue `catch`), he yanks it tight and
 * hauls it back a little way (cue `tug`), then flicks the loop home over his head and spins on. `CATCH` is where it
 * lands (drawing space), for the board to aim at later.
 */
export const CATCH: Pt = [96, 66];
const THROW_ARM = { fistL: [24, 27] as Pt, elbowL: [22, 36] as Pt };
const CAST_ARM = { fistL: [37, 44] as Pt, elbowL: [31, 46.5] as Pt };
const HAUL_ARM = { fistL: [18, 48] as Pt, elbowL: [22, 49.5] as Pt };
const lasso: Anim = (() => {
  const frames: Frame[] = [];
  // Wind-up: two quick turns, the loop widening, a lean back.
  [0, 2, 4, 6, 0, 2, 4, 6].forEach((s, i) => frames.push(f(55, { mood: i < 4 ? "sneer" : "fierce", spin: s, grow: Math.min(2, i * 0.5), lean: i > 3 ? -1 : 0 }, i === 0 ? { cue: "whirl" } : {})));
  // The throw: overhead, out across him, the loop flying out to our right and dropping onto its mark.
  frames.push(f(70, { mood: "fierce", ...THROW_ARM, loop: { c: [40, 7], rx: 13, ry: 3.5, tilt: 4 }, front: true }, { cue: "throw" }));
  frames.push(f(55, { mood: "wild", fistL: [31, 34], elbowL: [27, 41], loop: { c: [56, 11], rx: 12.5, ry: 4.5, tilt: 10 }, front: true, bow: [44, 16] }));
  frames.push(f(70, { mood: "wild", ...CAST_ARM, loop: { c: [68, 20], rx: 11.5, ry: 6, tilt: 18 }, front: true, bow: [52, 22] }));
  frames.push(f(70, { mood: "wild", ...CAST_ARM, loop: { c: [86, 38], rx: 10, ry: 6.5, tilt: 20 }, front: true, bow: [62, 30] }));
  frames.push(f(70, { mood: "wild", ...CAST_ARM, loop: { c: [94, 56], rx: 9.5, ry: 4.5, tilt: 8 }, front: true, bow: [66, 46] }));
  frames.push(f(140, { mood: "wild", ...CAST_ARM, loop: { c: CATCH, rx: 9, ry: 2.6, tilt: 0 }, front: true, bow: [70, 64] }, { cue: "catch" }));
  frames.push(f(120, { mood: "smug", ...CAST_ARM, loop: { c: CATCH, rx: 9, ry: 2.6, tilt: 0 }, front: true, bow: [68, 62] }));
  // The tug: he hauls back, the rope snaps taut, the loop closes on its catch and drags it a little way (a square).
  const haul = (dx: number, t: number, extra: Partial<Frame> = {}) =>
    f(95, { mood: "grit", lean: -2, bob: 1, ...HAUL_ARM, loop: { c: [CATCH[0] - dx, CATCH[1]], rx: 6, ry: 2.2, tilt: 0 }, front: true, bow: [(16 + CATCH[0] - dx) / 2, 56 + dx * 0.1] }, { ...extra, specks: dust([CATCH[0] - dx, CATCH[1] + 1], t, 10) });
  frames.push(f(60, { mood: "grit", lean: -1, fistL: [28, 47], elbowL: [27, 49], loop: { c: CATCH, rx: 7.5, ry: 2.4, tilt: 0 }, front: true }, { cue: "tug" }));
  frames.push(haul(0, 0, { shake: [-1, 0] }));
  frames.push(haul(5, 1, { shake: [1, 0] }));
  frames.push(haul(10, 2));
  // The flick home: the loop springs up off its catch and back over his head.
  frames.push(f(60, { mood: "sneer", lean: -1, fistL: [17, 39], elbowL: [21, 45], loop: { c: [78, 46], rx: 6, ry: 3.5, tilt: -10 }, bow: [44, 36] }));
  frames.push(f(75, { mood: "sneer", fistL: [17, 30], elbowL: [21, 38], loop: { c: [60, 18], rx: 7, ry: 4, tilt: -12 }, bow: [40, 12] }));
  frames.push(f(75, { mood: "sneer", fistL: [16, 31], loop: { c: [24, 9], rx: 12, ry: 5, tilt: -10 } }));
  frames.push(...settle(4));
  return { loop: false, frames };
})();

/**
 * The taunt: a nod that tips his hat down over his eyes, then he throws his head back, the hat hopping up, and laughs:
 * snorting (cues `laugh`, `snort`), belly shaking; then a spur stomp (cue `stomp`) with a glint off the spur. The loop
 * spins on the whole time.
 */
const taunt: Anim = (() => {
  const frames: Frame[] = [];
  let s = 0;
  const F = (ms: number, p: PigPose, extra: Partial<Frame> = {}) => frames.push(f(ms, { spin: s++ % 8, ...p }, extra));
  // The hat tip: a slow nod, the brim down over his eyes, held; a sly look up from under it.
  F(85, { mood: "smug" }, { cue: "tip" });
  F(85, { mood: "smug", headDy: 1, hat: { tilt: 4, dy: 1 } });
  F(140, { mood: "blink", headDy: 1, bob: 1, hat: { tilt: 8, dy: 2 } });
  F(140, { mood: "smug", headDy: 1, bob: 1, hat: { tilt: 8, dy: 2 } });
  F(140, { mood: "smug", headDy: 1, bob: 1, hat: { tilt: 8, dy: 2 } });
  F(85, { mood: "smug", hat: { tilt: 4, dy: 1 } });
  // The laugh: his head back, the hat hopping, snorts, his belly bouncing.
  for (let i = 0; i < 10; i++) {
    const hop = i % 2 === 0;
    F(85, { mood: i === 3 || i === 7 ? "snort" : "laugh", headDy: hop ? -1 : 0, bob: hop ? 0 : 1, hat: { tilt: hop ? -6 : -2, dy: hop ? -2 : -1 }, coil: hop ? 1 : -1 }, { ...(i === 0 ? { cue: "laugh" } : i === 3 ? { cue: "snort" } : {}), specks: [...puffs(i - 3, 0, hop ? -1 : 1), ...puffs(i - 7, 0, hop ? -1 : 1)] });
  }
  // The spur stomp: a foot up, and down hard, dust and a glint off the spur.
  F(90, { mood: "fierce", feet: { l: [-1, -3] } });
  F(70, { mood: "fierce", feet: { l: [-1, -4] }, bob: -1 });
  F(100, { mood: "sneer", bob: 1 }, { cue: "stomp", shake: [0, 1], specks: [...stompDust(0), ...glint(SPUR_L, true)] });
  F(90, { mood: "sneer" }, { specks: [...stompDust(1), ...glint(SPUR_L, false)] });
  F(90, { mood: "smug" }, { specks: stompDust(2) });
  while (s % 8) F(85, { mood: "smug" });
  return { loop: false, frames };
})();

/**
 * The ultimate's wind-up (his ultimate isn't designed yet: a generic big double lasso). He shakes the coil out into a
 * second loop (cue `windup`) and spins both over his head, faster and wider, then hurls both out to our right (cue
 * `throw`), they drop (cue `catch`) and he hauls both in with a mighty yank (cue `tug`); then gathers up and spins on.
 */
export const CATCH2: Pt = [80, 66];
const windup: Anim = (() => {
  const frames: Frame[] = [];
  let s = 0;
  const F = (ms: number, p: PigPose, extra: Partial<Frame> = {}) => frames.push(f(ms, { spin: s % 8, ...p }, extra));
  // The coil shaken out into a loop, swung up over his other side.
  F(90, { mood: "wild", coil: 2 }, { cue: "windup" });
  s++;
  F(80, { mood: "wild", coil: -2 });
  s++;
  F(80, { mood: "wild", fistR: [63, 40], elbowR: [59, 45], loop2: { c: [68, 52], rx: 4.5, ry: 8.5, tilt: 0 } });
  s++;
  F(75, { mood: "wild", fistR: [63, 34], elbowR: [59, 41], loop2: { c: [70, 22], rx: 8, ry: 5, tilt: 25 } });
  s++;
  // Both spinning, faster and wider: three turns.
  for (let i = 0; i < 24; i++) {
    const g = Math.min(2.5, i * 0.15);
    F(i < 12 ? 70 : 50, { mood: i % 6 === 5 ? "grit" : "wild", loop2: "spin", grow: g, bob: i % 4 === 3 ? 1 : 0 }, i >= 16 ? { shake: [i % 2 ? 1 : -1, 0] } : {});
    s++;
  }
  // Both thrown, out to our right, dropping onto their marks.
  const cast = { mood: "wild" as Mood, ...CAST_ARM, fistR: [60, 40] as Pt, elbowR: [57, 44] as Pt, front: true };
  F(70, { ...cast, ...THROW_ARM, fistR: [56, 26], elbowR: [56, 36], loop: { c: [30, 7.5], rx: 12, ry: 3.5, tilt: 4 }, loop2: { c: [52, 7.5], rx: 12, ry: 3.5, tilt: -4 } }, { cue: "throw" });
  F(55, { ...cast, fistL: [31, 34], elbowL: [27, 41], fistR: [58, 32], elbowR: [57, 40], loop: { c: [44, 10], rx: 12, ry: 4.5, tilt: 8 }, loop2: { c: [66, 10], rx: 12, ry: 4.5, tilt: 8 }, bow: [38, 18], bow2: [62, 18] });
  F(70, { ...cast, loop: { c: [60, 22], rx: 11, ry: 5.5, tilt: 16 }, loop2: { c: [80, 18], rx: 11, ry: 5.5, tilt: 16 }, bow: [46, 26], bow2: [70, 24] });
  F(70, { ...cast, loop: { c: [74, 46], rx: 9.5, ry: 5, tilt: 12 }, loop2: { c: [94, 40], rx: 9.5, ry: 5, tilt: 12 }, bow: [56, 40], bow2: [80, 36] });
  F(150, { ...cast, loop: { c: CATCH2, rx: 8, ry: 2.5, tilt: 0 }, loop2: { c: [CATCH[0] + 2, CATCH[1] - 2], rx: 8, ry: 2.5, tilt: 0 }, bow: [52, 62], bow2: [80, 58] }, { cue: "catch" });
  // The mighty yank: both hauled in, the ground shaking.
  const yank = (dx: number, t: number, extra: Partial<Frame> = {}) =>
    F(110, { mood: "grit", lean: -2, bob: 1, ...HAUL_ARM, fistR: [52, 50], elbowR: [55, 47], front: true, loop: { c: [CATCH2[0] - dx, CATCH2[1]], rx: 5.5, ry: 2, tilt: 0 }, loop2: { c: [CATCH[0] + 2 - dx, CATCH[1] - 2], rx: 5.5, ry: 2, tilt: 0 } }, { ...extra, specks: [...dust([CATCH2[0] - dx, CATCH2[1] + 1], t, 8), ...dust([CATCH[0] + 2 - dx, CATCH[1] - 1], t, 8)] });
  yank(0, 0, { cue: "tug", shake: [-1, 1] });
  yank(6, 1, { shake: [1, 0] });
  yank(12, 2, { shake: [-1, 0] });
  // Gathered up: the loops flicked home, the second one back into its coil; he spins on, smug.
  F(60, { mood: "sneer", lean: -1, fistL: [17, 39], elbowL: [21, 45], fistR: [60, 46], elbowR: [57, 48], loop: { c: [70, 46], rx: 6, ry: 3.5, tilt: -10 }, loop2: { c: [88, 52], rx: 5, ry: 3, tilt: -10 }, bow: [40, 36], bow2: [74, 44] });
  F(80, { mood: "sneer", fistL: [19, 28], elbowL: [21, 37], fistR: [63, 40], elbowR: [59, 45], loop: { c: [62, 18], rx: 7, ry: 4, tilt: -12 }, loop2: { c: [72, 50], rx: 4.5, ry: 7, tilt: 10 }, bow: [42, 12] });
  F(80, { mood: "sneer", fistL: [18, 29], loop: { c: [36, 9], rx: 11, ry: 4.5, tilt: -8 }, coil: 1 });
  frames.push(...settle(s % 8, { mood: "laugh" }));
  return { loop: false, frames };
})();

/**
 * Ready (Eric, Oct 13: his meter full, until he fires his showdown): the wind-up's spin, looped: both loops whirling
 * over his head, steady and wide, a bob every half turn, a glare; no throw. Two turns a loop, at the wind-up's pace.
 */
const ready: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => f(70, { mood: i % 8 === 7 ? "grit" : "wild", loop2: "spin", grow: 1.5, spin: i % 8, bob: i % 4 === 3 ? 1 : 0 })),
};

/**
 * A hop on or off the board (the board moves him along his arc): a crouch, off the ground at PIG_LEAP.upAt with his
 * boots tucked up and the loop spinning, down at PIG_LEAP.landAt (cue `hop`, dust off his boots), then he steadies.
 */
export const PIG_LEAP = { upAt: 100, landAt: 600 } as const;
const leap: Anim = (() => {
  const frames: Frame[] = [f(100, { mood: "fierce", bob: 2, spin: 0 })];
  for (let i = 0; i < 4; i++) frames.push(f(125, { mood: i < 2 ? "wild" : "fierce", feet: { l: [1, -4], r: [-1, -4] }, spin: (i * 2 + 1) % 8, coil: i % 2 ? 1 : -1 }));
  frames.push(f(90, { mood: "grit", bob: 2, spin: 1 }, { cue: "hop", shake: [0, 1], specks: stompDust(0) }));
  frames.push(f(110, { mood: "smug", bob: 1, spin: 2 }, { specks: stompDust(1) }));
  return { loop: false, frames };
})();

/**
 * Hauling his showdown's pairs in (the board draws the ropes, from his fists to the pieces): both fists low and pulling,
 * leaning back, a heave every half second (cue `tug` on each, a little dust), no loop in his hands (they're out on the
 * board). Loops: the board plays it for as long as the pairs come in.
 */
export const HAUL_FISTS: readonly Pt[] = [
  [18 + OX, 48 + OY],
  [52 + OX, 50 + OY],
];
const haul: Anim = (() => {
  const frames: Frame[] = [];
  const pose = (lean: number, bob: number, mood: Mood): PigPose => ({ mood, lean, bob, ...HAUL_ARM, fistR: [52, 50], elbowR: [55, 47], loop: null, loop2: null, coil: null });
  for (let i = 0; i < 2; i++) {
    frames.push(f(110, pose(-2, 1, "grit"), { cue: "tug", shake: [-1, 0], specks: dust([30, 70], 0, 6) }));
    frames.push(f(110, pose(-2, 1, "grit"), { specks: dust([30, 70], 1, 6) }));
    frames.push(f(140, pose(-1, 0, i ? "smug" : "fierce")));
    frames.push(f(140, pose(-1, 0, "fierce")));
  }
  return { loop: true, frames };
})();

/** Where his lasso's loop lands (CATCH) in his frame (frame pixels, as `foot` is): the board puts it on the piece he drags. */
export const CATCH_AT: Pt = [CATCH[0] + OX, CATCH[1] + OY];

export const PIG: Character = {
  id: "pig",
  name: "Wrangler",
  w: W,
  h: H,
  foot: [OX + 40, OY + GROUND],
  palette: PIG_PALETTE,
  halo: "#2c2624",
  parts: PARTS,
  anims: { idle, lasso, taunt, windup, leap, haul, ready },
};

/**
 * Wrangler's lines in his text box (a cowboy pig: short, drawled, a snort now and then), by moment; how often each
 * moment gets one is PIG_CHANCE (a power's moment always has its line). The same line for everyone (picked by the
 * moment). `pull`: his long pull; `tug`: the drag that stands in for the test trigger's showdown when the board can't
 * hold one; `ready`: his meter full (Eric, Oct 13), said once a fill.
 */
export const PIG_LINES: Partial<Record<import("./boss-beats.ts").Beat, readonly string[]>> = {
  entrance: ["Howdy, varmints.", "Saddle up!", "Yee-haw!"],
  pull: ["Giddy-up, pawn!", "Yank!"],
  move: ["Giddy-up.", "Easy now.", "Mosey on."],
  capture: ["Roped!", "Hog-tied!", "Got 'im!"],
  check: ["Reach for the sky!", "Hands up!", "Corralled!"],
  hurt: ["Oink!", "Dang varmints!", "My hat!"],
  thinking: ["Hmm, reckon…", "Lemme think…", "Snort…"],
  smug: ["Heh heh. Snort.", "Easy pickin's.", "Like roping fence posts."],
  rattled: ["Uh oh…", "Rustlers!", "This ain't good…"],
  defeat: ["I'll be danged…", "Back to the barn…", "Outdrawn…"],
  victory: ["Yee-haw!", "Rodeo's over!", "Snort snort!"],
  strike: ["Git along!", "Yer outta here!", "Yee-haw!"],
  power: ["Git over here!", "C'mere, little doggie.", "Yoink!"],
  tug: ["Fine. Just a tug, then.", "Yoink, anyhow.", "A tug'll do."],
  ready: ["I've got you in my sights."],
  ultimate: ["This board ain't big enough for the six of us.", "It's high noon!"],
  kingAttack: ["Dance, little king!", "Crack! Crack! Yee-haw!", "Git along, your majesty!"],
};
export const PIG_CHANCE: Partial<Record<import("./boss-beats.ts").Beat, number>> = {
  entrance: 1,
  move: 0.12,
  capture: 0.6,
  check: 0.75,
  hurt: 0.6,
  thinking: 0.08,
  smug: 0.8,
  rattled: 0.8,
  defeat: 1,
  victory: 1,
  strike: 0.8,
  power: 1,
  ready: 1,
  ultimate: 1,
  kingAttack: 1,
};

/** The part of him a portrait shows (his hat and face), in frame pixels. */
export const PIG_PORTRAIT = { x: OX + 17, y: OY + 6, w: 46, h: 40 } as const;

// ---- His attack on a king (kits.ts: his kit's `kingAttack`; Eric, Oct 18: "a relentless assault", the lasso swung
// and cracked at the king over and over, never wrapped round him).

/**
 * Room ahead of him (to our left, where his snout points: his art faces our left, as Sawyer's does) for the rope cracked
 * at the king, and headroom to drop in from. (Oct 18: it first went out to our right, so on the board, mirrored to reach
 * the king, he looked away from it.) His throws to our right need none of his frame's room on that side.
 */
const ATTACK_REACH = 38;
const ATTACK_TOP = 16;
const AW = ATTACK_REACH + 88;
const AH = H + ATTACK_TOP;
/** Where the rope's end cracks, as far as the king's square's middle and a little past (drawing space). */
const KING_X = 40 - 1.95 * 36;
/** A frame of his in the attack's bigger frame, `lift` pixels up in the air. */
const fa = (ms: number, p: PigPose, extra: Partial<Frame> = {}, lift = 0, ground: readonly Speck[] = []): Frame => moved({ ms, layers: pigLayers(p), ...extra }, ATTACK_REACH, ATTACK_TOP, AW, AH, lift, ground);
const landShadow = (r: number): Speck[] => groundShadow(OX + 40 + ATTACK_REACH, OY + GROUND + ATTACK_TOP - 1, r);

/**
 * A crack of the lasso at the king: his lasso arm (on our left) flung out and the rope straight out to our left, where
 * he faces, its loop snapped shut at the end, high (at the king's chest) or low in turn; or, between cracks, the rope
 * whipped back up, spinning over his head.
 */
const crack = (i: number): PigPose => {
  const low = i % 2 === 1;
  const y = low ? 55 : 47;
  const fist: Pt = low ? [13, 54] : [14, 49];
  // (Eyes open on every crack, on the king: his laugh squeezes them shut, so he laughs as he whips it back.)
  return { mood: i % 2 ? "grit" : "wild", lean: -1, bob: low ? 1 : 0, fistL: fist, elbowL: low ? [21, 53] : [21, 50], front: true, loop: { c: [KING_X + 3, y], rx: 3.5, ry: 2, tilt: low ? 8 : -6 }, bow: [(fist[0] + KING_X) / 2, (fist[1] + y) / 2 - 0.5], coil: low ? 1 : -1 };
};
const whipBack = (i: number): PigPose => ({ mood: i % 4 === 3 ? "laugh" : "fierce", spin: (i * 3 + 2) % 8, grow: 1, lean: 1, coil: i % 2 ? -1 : 1 });

/**
 * His attack on a king, the king to our left, where he faces (the board mirrors him when it's to his right), on the
 * shared beats (KING_ATTACK, boss-timing.ts): his shadow spreads, he drops in with the lasso whirling overhead and lands, swings it
 * wider, then cracks it at the king ten times, one on each hit, its end snapping in the king's square high and low in
 * turn and whipping back overhead between (cues `crack` and `lash` in turn, so the repeats don't pile up); he snorts
 * with laughter and leaps off. The last frame is empty.
 */
const kingAttack: Anim = (() => {
  const A = KING_ATTACK;
  const frames: Frame[] = [
    { ms: 100, layers: [], specks: landShadow(6) },
    { ms: 100, layers: [], specks: landShadow(14) },
    fa(80, { mood: "wild", spin: 0, grow: 1, feet: { l: [1, -4], r: [-1, -4] } }, { cue: "whirl" }, 16, landShadow(20)),
    fa(80, { mood: "wild", spin: 2, grow: 1, feet: { l: [1, -3], r: [-1, -3] } }, {}, 7, landShadow(22)),
    fa(A.landAt - 360, { mood: "grit", bob: 2, spin: 4, grow: 1 }, { cue: "hop", shake: [0, 1], specks: stompDust(0) }),
    fa(A.lashAt - A.landAt, { mood: "fierce", spin: 6, grow: 2, lean: 1 }, { specks: stompDust(1) }),
  ];
  const crackMs = 90;
  for (let i = 0; i < A.lashes; i++) {
    frames.push(fa(crackMs, crack(i), { cue: i % 2 ? "lash" : "crack", shake: [i % 2 ? -1 : 1, 0] }));
    frames.push(fa(A.lashEveryMs - crackMs, whipBack(i)));
  }
  const laugh = A.leaveAt - (A.lashAt + A.lashes * A.lashEveryMs);
  frames.push(fa(laugh, { mood: "laugh", headDy: -1, spin: 1, grow: 1, hat: { tilt: -6, dy: -2 } }, { cue: "laugh" }));
  const leave = A.ms - A.leaveAt;
  frames.push(
    fa(leave - 300, { mood: "smug", bob: 2, spin: 3 }),
    fa(80, { mood: "wild", spin: 5, feet: { l: [1, -4], r: [-1, -4] } }, {}, 7, landShadow(18)),
    fa(80, { mood: "wild", spin: 7, feet: { l: [1, -4], r: [-1, -4] } }, {}, 16, landShadow(12)),
    { ms: 80, layers: [], specks: landShadow(8) },
    { ms: 60, layers: [] },
  );
  return { loop: false, frames };
})();

/**
 * Wrangler for his attack on a king (his kit's `kingAttack`): his own drawing, parts and palette, facing our left as
 * always, in a frame with `ATTACK_REACH` of room on the left (the rope cracked at the king) and `ATTACK_TOP` taller (he
 * drops in). Its `idle`,
 * one still, is for the preview, which starts every reel from one.
 */
export const PIG_ATTACK: Character = {
  ...PIG,
  id: "pig-attack",
  name: "Wrangler (his attack)",
  w: AW,
  h: AH,
  foot: [PIG.foot[0] + ATTACK_REACH, PIG.foot[1] + ATTACK_TOP],
  anims: { idle: { loop: true, frames: [fa(1000, {})] }, kingAttack },
};
