/**
 * The circus tiger (Eric, Oct 23: "a circus tiger who hated his role, the loud roaring and jumping through hoops, and wanted to
 * make the silly balloon animals he saw someone making"; no name yet, his id is `tiger`). After Eric's reference picture (the one
 * "where the balloons look like balloons"), redrawn: a realistic big cat on all fours, a long body and heavy paws, orange with
 * black stripes, a cream chest, muzzle and belly, amber eyes and whiskers; a small black top hat with a red band, tipped on his
 * head; a red and gold ringmaster's vest (gold edging, buttons, an embroidered panel); one front paw raised, holding the strings of
 * a bunch of four chess-piece balloons (a red queen, a blue knight, a green rook and a purple pawn: shiny, round, each with a
 * highlight, drawn as the pump's balloons are, tiger-bar.ts; Eric's picture has six); his long striped tail curling up behind. Facing our left (as Alfil, Sawyer, Chub & Chirp, Smudgy, Moo and
 * Puddles), so his balloons are toward the board; light from the top left.
 *
 * His still (docs/decisions/2026-10-23-tiger-still.md) is the first frame of `idle`; his animation pack, his own moments (hop, place,
 * cheer, bigCheer, wince, hoops) and his attack on a king (`TIGER_ATTACK`) are docs/decisions/2026-10-23-tiger-animations.md. Look
 * only: his powers' rules come later. He isn't in `CHARACTERS`, `BOSS_KITS` or the roster, and nothing in the game draws him; the
 * preview draws him with its `extra=` option (`npm run preview:characters -- <dir> extra=packages/app/src/characters/tiger.ts
 * only=tiger,tiger-attack`).
 *
 * Rigging, so the poses that follow are numbers (`TigerPose`), as the other bosses':
 * - the raised paw (`paw`: the fist; the elbow bends by itself) and the strings, a part of their own, redrawn from each balloon's knot
 *   through one gathering point to the fist wherever they go; **each balloon is a part of its own** (`balloons`: where each hangs, so it
 *   bobs, or is handed over to the pump; a balloon that grows from a blob to a piece, or pops, is a different drawing of the same part);
 * - the hat (`hat`: where it sits, and `hatTilt`: it tips and bounces), the head as one (`head`), with the jaw a part of its own
 *   (`jaw`: degrees open, a yawn or a grin), the ears (`earN`, `earF`: they flick), the eyes (`eyes`), the whiskers;
 * - the tail (`tail`: it swishes), the legs (`stepHN`, `stepHF`, `stepFF`: each foot's lift), and he breathes (`bob`);
 * - each leg is a tube through its joints (the pose already moves the feet and sinks the hips) and the body a tube through three spine
 *   points (constants for now), so a later pose that stands him up on his hind legs (Eric's second reference) is those points given as
 *   numbers (hips under the shoulders, forelegs hanging, head up), not a redraw of the art.
 */
import { canvas, inEllipse, inPoly, toGrid, type Canvas } from "./paint.ts";
import { KING_ATTACK } from "@chessroyale/chess";
import { groundShadow, moved } from "./attack-frame.ts";
import { sparkle } from "./effects/common.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";
import { BALLOON_COLORS, BALLOON_COLOR_NAMES, BALLOON_PIECES, BALLOON_SHAPES, balloonPartOf, knotX, type BalloonColor, type BalloonPiece, type Stage } from "./tiger-bar.ts";

export const TIGER_PALETTE: Record<string, string> = {
  k: "#1f1210", // outline
  a: "#6e2c0c", // his orange: deep shadow to highlight
  b: "#a24512",
  c: "#d06a18",
  d: "#e8892a",
  e: "#f5ad55",
  f: "#b79c78", // the cream of his chest, belly, muzzle and cheeks: shadow to highlight
  g: "#dcc7a3",
  h: "#f3e6c8",
  i: "#fff8e8",
  s: "#2a160f", // stripes: black-brown, and a softer brown for the tips and the far side
  t: "#4d2813",
  n: "#e0837e", // his nose, and the dark of it and of his mouth line
  o: "#8c3b3d",
  q: "#5a1f26", // inside his mouth, his tongue
  r: "#d4636e",
  x: "#140a08", // the pupil
  y: "#f3a81f", // the amber of his eyes: iris, lighter
  Y: "#ffd45a",
  w: "#fff6dc", // glints, the shine on a balloon
  W: "#a8987c", // whiskers
  "1": "#0f0e14", // the hat: black, dark to highlight
  "2": "#22212b",
  "3": "#3b3948",
  "4": "#62607a",
  "5": "#7d1220", // the hat's band: red, dark to light
  "6": "#c0242c",
  "7": "#ee5a4f",
  A: "#6a0e1c", // the vest: dark red to light
  B: "#a31a28",
  C: "#cf2f38",
  D: "#ef5c56",
  J: "#7a4f0e", // gold: dark to light (the game's gold at its top)
  K: "#b87a14",
  L: "#f2c14e",
  M: "#ffe58a",
  "8": "#6b4a30", // the strings
  "9": "#9a7a56",
  E: "#8f0f22", // a balloon's colors, three each: dark, round, light (the queen's red)
  F: "#dc2433",
  G: "#ff6a5e",
  H: "#b88a0a", // the bishop's yellow
  I: "#f2c31a",
  N: "#ffe566",
  O: "#1a4fa8", // the knight's blue
  P: "#2f7fe0",
  S: "#7cc0ff",
  T: "#0f6a3a", // the rook's green
  U: "#1fa856",
  V: "#6fe08e",
  X: "#5a2a96", // the pawn's purple
  Z: "#9150d6",
  "0": "#c79bf5",
  z: "#0d0e12", // ground shadow
  j: "#b02a6e", // a balloon he holds out (the limp one for the pump, one he bats): pink by default, its color a look
  l: "#ec5fa5",
  m: "#ffaed6",
  p: "#7a1a0a", // fire: the burning hoop's flames, dark red to white-hot
  u: "#e8461c",
  v: "#ff9b22",
  Q: "#ffd84a",
  R: "#fff3b0",
  "%": "#4a4756", // the hoop's steel: dark, mid, light
  "&": "#8d8a9c",
  "=": "#cfccd9",
  "~": "#7d6c5a", // dust: dark, light
  "^": "#b9a88f",
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;

const ORANGE = "abcde";
const CREAM = "fghi";

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const union = (...fs: Inside[]): Inside => (x, y) => fs.some((f) => f(x, y));
const E = inEllipse;
const rad = (deg: number) => (deg * Math.PI) / 180;

// ---- Painting: a part from shapes in the scene's own coordinates (the ground at y `GROUND`).

/** A part painted in the scene: its canvas covers (x0, y0) to (x0 + w, y0 + h). `F` fills where `inside`; `S` stamps pixel rows (`.` skips). */
function painted(
  x0: number,
  y0: number,
  w: number,
  h: number,
  draw: (F: (inside: Inside, key: Key) => void, S: (rows: readonly string[], x: number, y: number) => void) => void,
  outline = true,
): { part: Part; at: Pt } {
  const cv: Canvas = canvas(w, h);
  const F = (inside: Inside, key: Key) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
  };
  const S = (rows: readonly string[], sx: number, sy: number) =>
    rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        const X = Math.round(sx) + i - x0;
        const Y = Math.round(sy) + j - y0;
        if (k !== "." && cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
      }),
    );
  draw(F, S);
  return { part: { grid: toGrid(cv), outline }, at: [x0, y0] };
}

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}

/** For a pixel near a polyline: how far along it is (0 to 1), its distance across and the normal, the radius there. */
function along(pts: readonly Pt[], r: readonly number[], p: Pt): { s: number; d: number; nx: number; ny: number; rr: number } {
  let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: r[0]! };
  pts.slice(1).forEach((q, i) => {
    const n = nearest(p, pts[i]!, q);
    const rr = r[i]! + (r[i + 1]! - r[i]!) * n.t;
    if (n.d - rr < best.d - best.rr) best = { s: (i + n.t) / (pts.length - 1), d: n.d, nx: n.nx, ny: n.ny, rr };
  });
  return best;
}

/** A thick line through `pts`, `r` its radius at each point: an inside test, the light on it (0 dark to 1 light, from the top left) and its measures. */
function tube(pts: readonly Pt[], r: readonly number[]) {
  const at = (x: number, y: number) => along(pts, r, [x + 0.5, y + 0.5]);
  const pad = Math.ceil(Math.max(...r)) + 1;
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0]))) - pad;
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1]))) - pad;
  const w = Math.ceil(Math.max(...pts.map((p) => p[0]))) + pad - x0 + 1;
  const h = Math.ceil(Math.max(...pts.map((p) => p[1]))) + pad - y0 + 1;
  return {
    box: [x0, y0, w, h] as const,
    inside: ((x, y) => {
      const a = at(x, y);
      return a.d <= a.rr;
    }) as Inside,
    light: (x: number, y: number) => {
      const a = at(x, y);
      return 0.6 - 0.45 * (a.nx / a.rr) - 0.5 * (a.ny / a.rr);
    },
    /** -1 at the top of the tube to 1 at its bottom edge. */
    down: (x: number, y: number) => {
      const a = at(x, y);
      return a.ny / a.rr;
    },
    s: (x: number, y: number) => at(x, y).s,
  };
}

/** A tapered line (a stripe): whether (x, y) is inside it, `r` the half-width at each point. */
const taper = (pts: readonly Pt[], r: readonly number[]): Inside => (x, y) => {
  const a = along(pts, r, [x + 0.5, y + 0.5]);
  return a.d <= a.rr;
};

// ---- Where things are. The scene's ground is at y `GROUND`; the frame adds `OX`, `OY`.

const GROUND = 70;
const OX = 6;
const OY = 30;
const W = OX + 64 + 6;
const H = OY + GROUND + 6;
/** The ground point he is placed by (x): between his feet, shifted so the balloons and the tail reach as far one side as the other. */
const FOOT_X = 30;

// ---- The body: the torso, the legs and paws, the tail, the vest.

/** The spine's points and the body's depth at each: a deep chest, a waist, the hips, a little lower than his shoulders. The body is a tube through them. */
const TORSO_PTS: readonly Pt[] = [[28, 47.8], [36.5, 49], [45.5, 51.6]];
const TORSO_R = [7.4, 6, 6.6];
const TORSO = tube(TORSO_PTS, TORSO_R);

/** The top and the bottom of the torso at column x (the first and last row inside it). */
const topAt = (x: number): number => {
  for (let y = 30; y < 70; y++) if (TORSO.inside(Math.floor(x), y)) return y;
  return 43;
};
const bottomAt = (x: number): number => {
  for (let y = 69; y > 30; y--) if (TORSO.inside(Math.floor(x), y)) return y;
  return 57;
};

/**
 * His stripes: thin tapered bars down from his spine every few pixels, a little longer in the middle of his flank, leaning back at his
 * shoulders and forward at his hips, stopping short of the cream of his belly.
 */
function flankStripes(): Inside {
  const bars: Inside[] = [];
  for (let x = 25.5; x < 55; x += 2.95) {
    const top = topAt(x);
    const len = (bottomAt(x) - top) * (0.58 + 0.07 * Math.sin(x * 1.3));
    const lean = Math.max(-2.6, Math.min(2.6, (40 - x) * 0.17));
    bars.push(taper([[x, top + 0.2], [x + lean * 0.45, top + len * 0.5], [x + lean, top + len]], [0.85, 0.7, 0.3]));
  }
  return union(...bars);
}

/** His torso: orange over his back and flank with stripes, cream on his chest and belly. */
function torso(): { part: Part; at: Pt } {
  const stripe = flankStripes();
  return painted(...TORSO.box, (F) =>
    F(TORSO.inside, (x, y) => {
      const l = TORSO.light(x, y);
      const cream = TORSO.down(x, y) > 0.44 + 0.1 * Math.sin(x * 0.7) || (x < 24.5 && y > 46);
      if (!cream && stripe(x, y)) return "s";
      return cream ? ramp(CREAM, l + 0.12) : ramp(ORANGE, l + 0.12);
    }),
  );
}

/** A paw: `[x, y, rx, ry]`, and whether it is a raised fist (orange above, cream below, round) or a foot on the ground (cream, flat). */
type Paw = readonly [x: number, y: number, rx: number, ry: number, fist?: boolean];

/**
 * A leg through `pts` (the hip or shoulder, the knee or elbow, the hock or wrist, the ankle) ending in a paw: orange with a few thin
 * stripes across it (`bars`, pixels from the top, and `extra` stripes of its own), the paw cream with its toes. `dark` shades a far leg.
 */
function leg(pts: readonly Pt[], r: readonly number[], paw: Paw, bars: readonly number[], dark = 0, extra: readonly (readonly Pt[])[] = []): { part: Part; at: Pt } {
  const t = tube(pts, r);
  const [px, py, rx, ry, fist] = paw;
  const pawShape = E(px, py, rx, ry);
  const marks = union(...extra.map((pts2) => taper(pts2, [0.75, 0.65, 0.3])));
  const length = pts.slice(1).reduce((n, q, i) => n + Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]), 0);
  const [bx, by, bw, bh] = t.box;
  const x0 = Math.min(bx, Math.floor(px - rx) - 1);
  const y0 = Math.min(by, Math.floor(py - ry) - 1);
  const x1 = Math.max(bx + bw, Math.ceil(px + rx) + 1);
  const y1 = Math.max(by + bh, Math.ceil(py + ry) + 1);
  return painted(x0, y0, x1 - x0, y1 - y0, (F, S) => {
    F(union(t.inside, pawShape), (x, y) => {
      const l = (pawShape(x, y) ? 0.6 - 0.24 * ((y + 0.5 - py) / ry) - 0.2 * ((x + 0.5 - px) / rx) : t.light(x, y)) - dark;
      if (pawShape(x, y) && (!t.inside(x, y) || t.s(x, y) > 0.9)) return fist && y + 0.5 < py - 0.4 ? ramp(ORANGE, l + 0.12) : ramp(CREAM, l + 0.06);
      const s = t.s(x, y);
      if (marks(x, y) || bars.some((b) => Math.abs(s * length - b) < 0.55)) return "s";
      return ramp(ORANGE, l + 0.12);
    });
    // The toes: short lines on the paw.
    const cx = Math.round(px);
    const cy = Math.round(py);
    if (fist) {
      S(["s", "s"], cx - 1, cy + 1);
      S(["s", "s"], cx + 1, cy + 1);
    } else {
      S(["s", "s"], cx - 2, cy);
      S(["s", "s"], cx + 1, cy);
    }
  });
}

/** His tail: a long striped rope curling up behind him, ringed, with a black tip; `swish` moves the tip up and down. */
function tail(swish: number, bob = 0): { part: Part; at: Pt } {
  const pts: Pt[] = [[50, 50 + bob], [53.4, 52.6 + bob / 2], [55.8, 51], [56.4, 47], [54.8, 43.6], [52.6, 42.4 + swish]];
  const t = tube(pts, [2.2, 1.95, 1.8, 1.7, 1.6, 1.5]);
  const length = pts.slice(1).reduce((n, q, i) => n + Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]), 0);
  return painted(...t.box, (F) =>
    F(t.inside, (x, y) => {
      const s = t.s(x, y) * length;
      if (s > length - 2.4 || (s > 2.6 && (s - 2.6) % 3 < 1.25)) return "s";
      return ramp(ORANGE, t.light(x, y) + 0.1);
    }),
  );
}

/** His vest: red cloth over his shoulders and the top of his flank, edged in gold, a collar standing up behind his neck, an embroidered panel. */
const VEST_POLY: Pt[] = [[26.4, 45], [28, 42.6], [31, 40.6], [35, 40], [38.6, 41.8], [40.4, 45], [40, 49.6], [38.6, 52.6], [37.4, 54], [31, 54.6], [27.8, 54], [27.2, 51], [26.4, 48]];
function vest(): { part: Part; at: Pt } {
  const poly = inPoly(VEST_POLY);
  const inside: Inside = (x, y) => poly(x, y) && (TORSO.inside(x, y) || y < 45.5);
  return painted(25, 39, 17, 18, (F, S) => {
    F(inside, (x, y) => {
      const l = 0.64 - 0.03 * (x - 28) - 0.014 * (y - 44);
      const rim = !poly(x - 1, y) || !poly(x + 1, y) || !poly(x, y - 1) || !poly(x, y + 1);
      if (rim) return x > 33 || y > 52 ? "K" : "L";
      return ramp("ABCD", l);
    });
    // The embroidered panel: gold diamonds with a heart of light, on his shoulder.
    S([".K.", "KLK", ".K."], 33, 45);
    S([".K.", "KLK", ".K."], 33, 50);
    // Gold buttons down his front.
    for (const y of [45, 48, 51]) S(["M"], 37, y);
  });
}

// ---- His head: the skull and muzzle (one part), the jaw, the ears, the eyes, the whiskers; the hat on top. A tiger's face at a glance: an
// orange face with bold black bars across its brow, a white muzzle and white cheek ruffs flaring out at its sides, a pink nose, a dark
// mouth, amber eyes in dark rims, round dark ears with a white spot.

/** The head's outline in scene pixels, clockwise from the muzzle's tip: the muzzle at our left, the ruff's points at the back and under. */
const HEAD_AT: Pt = [10, 31];
const local = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [x + HEAD_AT[0], y + HEAD_AT[1]]);
const HEAD_POLY = local([[0.8, 12.2], [0.2, 10.4], [0.8, 8.8], [2.6, 7.6], [4.2, 5.6], [5.4, 3.6], [7.4, 1.8], [10.4, 0.6], [14, 0.2], [17.6, 0.8], [20.6, 2.6], [22.4, 5.4], [23.2, 8.2], [24.8, 10.2], [23.4, 12], [25, 14.2], [22.6, 14.4], [23.2, 17.2], [20, 15.6], [19, 18.4], [16.2, 16], [14.4, 18], [12.4, 15], [9.6, 13.8], [5, 13], [2.4, 12.6]]);
const HEAD_INSIDE = inPoly(HEAD_POLY);
/** Where the jaw hinges (under his cheek), and the closed jaw's outline. */
const HINGE: Pt = [HEAD_AT[0] + 10.6, HEAD_AT[1] + 14.8];
const JAW_POLY = local([[1.6, 12], [5, 12.6], [9, 13.6], [11.4, 14.4], [10.4, 16.6], [6.4, 17], [3, 15.4], [1.2, 13.6]]);
/** Where the eyes go (their top left in scene pixels) and the ears (their middles). */
const EYE_N: Pt = [HEAD_AT[0] + 12, HEAD_AT[1] + 6];
const EYE_F: Pt = [HEAD_AT[0] + 5, HEAD_AT[1] + 5];
const EAR_N: Pt = [HEAD_AT[0] + 20.4, HEAD_AT[1] + 2.4];
const EAR_F: Pt = [HEAD_AT[0] + 5.4, HEAD_AT[1] + 3.4];

/** The skull and the muzzle. */
function head(): { part: Part; at: Pt } {
  const [hx, hy] = HEAD_AT;
  const light = (x: number, y: number) => 0.64 - 0.34 * ((x - (hx + 11)) / 12) - 0.5 * ((y - (hy + 7)) / 10);
  const bar = (pts: readonly Pt[], r: readonly number[] = [1, 0.85, 0.4]) => taper(pts.map(([x, y]): Pt => [hx + x, hy + y]), r);
  const marks = union(
    // The brow: bold bars running down from the crown, the middle ones longest, the outer ones short and leaning out; they stop above his eyes.
    bar([[10.4, 1.4], [10.8, 3.2], [10.4, 4.8]], [0.85, 0.75, 0.4]),
    bar([[13.4, 1], [13.8, 3.2], [13.4, 5]], [0.85, 0.75, 0.4]),
    bar([[16.4, 1.6], [16.4, 3.4], [15.8, 4.8]], [0.85, 0.75, 0.4]),
    bar([[7.8, 3.2], [8.2, 4.2], [8, 5]], [0.7, 0.6, 0.3]),
    bar([[19.4, 2.6], [18.8, 4], [18.2, 5]], [0.75, 0.65, 0.35]),
    // From the outer corner of his eye back across his cheek.
    bar([[18.6, 7.8], [20.8, 8.2], [23, 9.2]], [0.65, 0.65, 0.35]),
    // The ruff's stripes, pointing in from the back of his cheek.
    bar([[25.2, 10.8], [22, 11.2], [18.4, 12.2]], [0.95, 0.85, 0.4]),
    bar([[25, 13.8], [22, 14], [19.2, 14.8]], [0.9, 0.8, 0.4]),
  );
  return painted(hx - 1, hy - 1, 28, 21, (F, S) => {
    F(HEAD_INSIDE, (x, y) => {
      const lx = x + 0.5 - hx;
      const ly = y + 0.5 - hy;
      const l = light(x, y);
      if (marks(x, y)) return "s";
      // White: the muzzle, the cheek under each eye and the whole ruff. Orange: the crown, the brow and the bridge between his eyes.
      const white = (lx < 11.6 && ly > 8.6 + 0.4 * Math.sin(lx * 1.1)) || (lx < 14.8 && ly > 9.6) || (lx >= 14.8 && ly > 8.4);
      return white ? ramp(CREAM, l + 0.34) : ramp(ORANGE, l + 0.2);
    });
    // The nose: dark above, pink below, a line down to his lip; and the dots his whiskers grow from.
    S(["oooo", "nnnn", ".nn."], hx + 0.8, hy + 8.6);
    S(["s", "s"], hx + 2, hy + 11.2);
    for (const [x, y] of [[4.4, 9.8], [6.6, 10.2], [5.2, 11.6], [7.6, 11.8]] as Pt[]) S(["s"], hx + x, hy + y);
  });
}

/** His lower jaw, hinged at `HINGE`, `open` degrees down: white, and a dark mouth showing as it opens. */
function jaw(open: number): { part: Part; at: Pt } {
  const th = rad(open);
  const [c, s] = [Math.cos(th), Math.sin(th)];
  const turn = ([x, y]: Pt): Pt => [HINGE[0] + (x - HINGE[0]) * c + (y - HINGE[1]) * s, HINGE[1] - (x - HINGE[0]) * s + (y - HINGE[1]) * c];
  const poly = JAW_POLY.map(turn);
  const inside = inPoly(poly);
  const x0 = Math.floor(Math.min(...poly.map((p) => p[0]))) - 1;
  const y0 = Math.floor(Math.min(...poly.map((p) => p[1]))) - 1;
  const x1 = Math.ceil(Math.max(...poly.map((p) => p[0]))) + 1;
  const y1 = Math.ceil(Math.max(...poly.map((p) => p[1]))) + 1;
  return painted(x0, y0, x1 - x0 + 1, y1 - y0 + 1, (F) =>
    F(inside, (x, y) => {
      const ly = y + 0.5 - HEAD_AT[1];
      return ramp(CREAM, 0.86 - 0.26 * ((ly - 12) / 5) - 0.1 * ((x - HEAD_AT[0]) / 11));
    }),
  );
}

/** An ear (`cx`, `cy` its middle), `tilt` pixels leaning: round, dark at the back with a white spot, an orange rim along its top and front. */
function ear(cx: number, cy: number, tilt: number, far = false): { part: Part; at: Pt } {
  const [rx, ry] = [3.4, 3.5];
  return painted(Math.floor(cx) - 5, Math.floor(cy) - 5, 11, 11, (F) => {
    const lean = (y: number) => (tilt * (cy + 2 - y)) / 4;
    const shape: Inside = (x, y) => ((x + 0.5 - cx - lean(y)) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
    const spot: Inside = (x, y) => ((x + 0.5 - cx - lean(y) + 0.3) / 1.3) ** 2 + ((y + 0.5 - cy + 0.2) / 1.4) ** 2 <= 1;
    F(shape, (x, y) => {
      const nx = (x + 0.5 - cx - lean(y)) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (spot(x, y)) return far ? "h" : "i";
      if (nx + ny < -0.45 || ny < -0.5) return far ? "b" : "d";
      return nx + ny > 0.5 ? "s" : "t";
    });
  });
}

export type Eyes = "open" | "half" | "shut" | "wide" | "joy";
/** An eye (`x0`, `y0` its top left): amber in a dark rim, with a pupil; `w` its width (the far eye, seen at an angle, is narrower). */
function eye(x0: number, y0: number, w: number, lid: Eyes): { part: Part; at: Pt } {
  const rows: Record<Eyes, string[]> = {
    open: w >= 6 ? ["ssssss", "sYxyYs", ".ssss."] : ["sssss", "sYxYs", ".sss."],
    half: w >= 6 ? ["ssssss", "ssxyss", ".ssss."] : ["sssss", "ssxss", ".sss."],
    shut: w >= 6 ? ["ssssss", ".ssss."] : ["sssss", ".sss."],
    wide: w >= 6 ? ["ssssss", "sYYYYs", "syxyYs", ".ssss."] : ["sssss", "sYYYs", "syxys", ".sss."],
    joy: w >= 6 ? ["......", ".ssss.", "s....s"] : [".....", ".sss.", "s...s"],
  };
  return painted(x0, y0, 6, 5, (_F, S) => S(rows[lid], x0, y0), false);
}

/** His whiskers: a few fine strands out from his muzzle toward his front. */
function whiskers(): { part: Part; at: Pt } {
  return painted(3, 38, 12, 12, (_F, S) => {
    const strand = (pts: readonly Pt[]) => pts.forEach(([x, y]) => S(["W"], x, y));
    strand([[11, 42], [10, 42], [9, 41], [8, 41], [7, 40]]);
    strand([[11, 43], [10, 43], [9, 43], [8, 43], [7, 43]]);
    strand([[11, 44], [10, 44], [9, 45], [8, 45], [7, 46]]);
  }, false);
}

/** His top hat, a small one tipped back on the top of his head, so his brow shows under it: a black crown with a shine down one side, a red band and a brim, tipped `tilt` degrees (positive: clockwise, its front up). */
function hat(tilt: number): { part: Part; at: Pt } {
  const [cx, cy] = [23.6, 31.8];
  const th = rad(tilt);
  const [cs, sn] = [Math.cos(th), Math.sin(th)];
  /** A pixel in the hat's own frame: u across it (negative toward his front), v along it (negative up). */
  const lc = (x: number, y: number): Pt => [(x + 0.5 - cx) * cs + (y + 0.5 - cy) * sn, -(x + 0.5 - cx) * sn + (y + 0.5 - cy) * cs];
  const crown: Inside = (x, y) => {
    const [u, v] = lc(x, y);
    return Math.abs(u) <= 3.4 && v >= -6.4 && v <= 0.6;
  };
  const brim: Inside = (x, y) => {
    const [u, v] = lc(x, y);
    return (u / 5.6) ** 2 + ((v - 0.4) / 1.4) ** 2 <= 1;
  };
  return painted(14, 23, 20, 13, (F) =>
    F(union(crown, brim), (x, y) => {
      const [u, v] = lc(x, y);
      if (!crown(x, y) || v > 0.1) return u < -2 ? "3" : u > 2.6 ? "1" : "2";
      if (v < -5.8) return "3";
      if (v > -3.2 && v < -1.4) return u < -2 ? "7" : u > 1.8 ? "5" : "6";
      return u < -2.2 ? "4" : u < -0.8 ? "3" : u > 1.8 ? "1" : "2";
    }),
  );
}

// ---- The balloons: chess pieces, four in his bunch, shiny and round, each a part of its own. They are the pump's drawings (tiger-bar.ts:
// a silhouette per piece and stage, shaded by one rule, with the 1 px outline every part gets), in the colors of his palette, and
// they hang with a clear gap between them so their shapes never merge (Eric, Oct 23: "if they could be slightly sharper"). His bunch:
// a red queen, a blue knight, a green rook and a purple pawn (no king: he never makes one); the bishop is drawn too, in yellow.

export type Piece = BalloonPiece;
/** Every balloon he can hold: the bunch's four and the bishop. */
export const PIECES: readonly Piece[] = BALLOON_PIECES;
/** Each balloon's three keys (dark, round, light) in the palette. */
const BALLOON_KEYS: Record<Piece, string> = { queen: "EFG", bishop: "HIN", knight: "OPS", rook: "TUV", pawn: "XZ0" };
/** The bunch: each balloon's stage (the pawn a small one, by his brow) and its top left (scene pixels); its knot follows from its drawing. */
const BUNCH: Partial<Record<Piece, { stage: Stage; at: Pt }>> = {
  rook: { stage: 4, at: [3, 2] },
  pawn: { stage: 3, at: [3, 20] },
  queen: { stage: 4, at: [16, 2] },
  knight: { stage: 4, at: [30, 2] },
};
const knotOf = (n: Piece): Pt => {
  const { stage, at } = BUNCH[n]!;
  const sil = BALLOON_SHAPES[n][stage - 1]!.sil;
  return [at[0] + knotX(sil), at[1] + sil.length - 1];
};
/** The bunch, back to front. */
const BALLOON_ORDER = ["knight", "queen", "rook", "pawn"] as const satisfies readonly Piece[];

/** One balloon, as a part at `at` (a finished one unless `stage` says). */
export function balloon(piece: Piece, at: Pt, stage: Stage = 4): { part: Part; at: Pt } {
  const k = BALLOON_KEYS[piece];
  const shape = BALLOON_SHAPES[piece][stage - 1]!;
  return { part: balloonPartOf(shape.sil, shape.marks, { d: k[0]!, b: k[1]!, l: k[2]!, w: "w", n: k[0]! }), at };
}

/** The strings: from each balloon's knot, swinging out ahead of his muzzle, to one gathering point, and from there down into his fist; the ends hang below it. */
const GATHER: Pt = [6, 46.5];
/** Where his raised paw is (its middle), holding the strings. */
const FIST: Pt = [8, 52];
function strings(knots: readonly Pt[], fist: Pt, gather: Pt = GATHER, loose = false): { part: Part; at: Pt } {
  const all = [...knots, fist, gather];
  const x0 = Math.floor(Math.min(...all.map((p) => p[0]))) - 4;
  const y0 = Math.floor(Math.min(...all.map((p) => p[1]))) - 2;
  const cv = canvas(Math.ceil(Math.max(...all.map((p) => p[0]))) + 6 - x0, Math.ceil(Math.max(...all.map((p) => p[1]))) + 10 - y0);
  const draw = (a: Pt, b: Pt, k: string) => {
    const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 2);
    for (let i = 0; i <= n; i++) {
      const x = Math.floor(a[0] + ((b[0] - a[0]) * i) / n) - x0;
      const y = Math.floor(a[1] + ((b[1] - a[1]) * i) / n) - y0;
      if (cv[y]?.[x] !== undefined) cv[y]![x] = k;
    }
  };
  if (loose) {
    // Let go: each string trails a few pixels under its balloon.
    knots.forEach((k, i) => {
      draw(k, [k[0] + (i % 2 ? 1 : -1), k[1] + 3], "8");
      draw([k[0] + (i % 2 ? 1 : -1), k[1] + 3], [k[0], k[1] + 6], "8");
    });
    return { part: { grid: toGrid(cv), outline: false }, at: [x0, y0] };
  }
  const top: Pt = [fist[0] - 0.5, fist[1] - 3];
  // Each string hangs in a curve: down and out toward his front first, then down to the gathering point.
  for (const k of knots) {
    const c: Pt = [(gather[0] + k[0]) / 2 - 1, (gather[1] + k[1]) / 2];
    let prev = k;
    for (let i = 1; i <= 14; i++) {
      const q = bez(k, c, gather, i / 14);
      draw(prev, q, "8");
      prev = q;
    }
  }
  draw(gather, top, "9");
  // A loose end under his fist.
  draw([fist[0] - 1, fist[1] + 3], [fist[0] - 2, fist[1] + 6], "8");
  return { part: { grid: toGrid(cv), outline: false }, at: [x0, y0] };
}

/** A point of a quadratic curve from `a` through the control point `c` to `b`, `t` from 0 to 1. */
const bez = (a: Pt, c: Pt, b: Pt, t: number): Pt => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];

/** His shadow on the ground, `w` wide. */
function shadow(w: number): Part {
  const cv = canvas(w, 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < w; x++) if (E(w / 2, 2, w / 2, 2.1)(x, y)) cv[y]![x] = "z";
  return { grid: toGrid(cv), outline: false };
}

/** Inside his mouth as the jaw opens `open` degrees: dark, a pink tongue low in it (drawn under the jaw and the head, which frame it). */
function mouth(open: number): { part: Part; at: Pt } {
  const turn = (deg: number) => {
    const th = rad(deg);
    const [c, s] = [Math.cos(th), Math.sin(th)];
    return JAW_POLY.map(([x, y]): Pt => [HINGE[0] + (x - HINGE[0]) * c + (y - HINGE[1]) * s, HINGE[1] - (x - HINGE[0]) * s + (y - HINGE[1]) * c]);
  };
  const shapes = [0, 0.25, 0.5, 0.75, 1].map((f) => inPoly(turn(open * f)));
  const tongue = inPoly(turn(open * 0.8));
  return painted(HEAD_AT[0], HEAD_AT[1] + 9, 16, 14, (F) => F(union(...shapes), (x, y) => (tongue(x, y) ? "r" : "q")));
}

/**
 * A part turned `deg` degrees (positive: clockwise on the screen) about `pivot` (scene pixels): his body rearing up onto his hind legs
 * (Eric's second picture). The part's pixels are read back nearest-neighbor, so it stays pixel art (no smoothing).
 */
function turned(src: { part: Part; at: Pt }, deg: number, pivot: Pt): { part: Part; at: Pt } {
  if (!deg) return src;
  const th = rad(deg);
  const [c, s] = [Math.cos(th), Math.sin(th)];
  const g = src.part.grid;
  const [w, h] = [g[0]!.length, g.length];
  const fwd = ([x, y]: Pt): Pt => [pivot[0] + c * (x - pivot[0]) - s * (y - pivot[1]), pivot[1] + s * (x - pivot[0]) + c * (y - pivot[1])];
  const corners = ([[0, 0], [w, 0], [0, h], [w, h]] as Pt[]).map(([x, y]) => fwd([src.at[0] + x, src.at[1] + y]));
  const x0 = Math.floor(Math.min(...corners.map((p) => p[0]))) - 1;
  const y0 = Math.floor(Math.min(...corners.map((p) => p[1]))) - 1;
  const cv = canvas(Math.ceil(Math.max(...corners.map((p) => p[0]))) + 2 - x0, Math.ceil(Math.max(...corners.map((p) => p[1]))) + 2 - y0);
  for (let y = 0; y < cv.length; y++)
    for (let x = 0; x < cv[0]!.length; x++) {
      const [px, py] = [x0 + x + 0.5 - pivot[0], y0 + y + 0.5 - pivot[1]];
      const gx = Math.floor(pivot[0] + c * px + s * py - src.at[0]);
      const gy = Math.floor(pivot[1] - s * px + c * py - src.at[1]);
      const k = g[gy]?.[gx];
      if (k && k !== ".") cv[y]![x] = k;
    }
  return { part: { grid: toGrid(cv), outline: src.part.outline }, at: [x0, y0] };
}

/**
 * A burning hoop held up (his old act), seen edge-on: a ring of steel with tongues of fire licking up and outward all round it, in the
 * board ring's colors (white-hot at the ring to red at the tips); `seed` flickers them frame to frame.
 */
const HOOP_W = 21;
const HOOP_H = 27;
function hoopPart(seed: number): Part {
  const cv = canvas(HOOP_W, HOOP_H);
  const [cx, cy, rx, ry] = [10.5, 16, 3.8, 6.6];
  for (let y = 0; y < HOOP_H; y++)
    for (let x = 0; x < HOOP_W; x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d >= 0.5 && d <= 1.05) cv[y]![x] = x < cx - 1 ? "=" : x > cx + 1 ? "%" : "&";
    }
  const hash = (n: number) => ((Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453) % 1 + 1) % 1;
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = ((i + hash(i + 20) * 0.5) / n) * Math.PI * 2;
    const [ox, oy] = [Math.cos(a), Math.sin(a)];
    const [bx, by] = [cx + ox * (rx + 0.3), cy + oy * (ry + 0.3)];
    let [dx, dy] = [ox, oy * 0.6 - 0.9];
    const dl = Math.hypot(dx, dy) || 1;
    [dx, dy] = [dx / dl, dy / dl];
    const len = 3.2 + 3.2 * hash(i) - (oy > 0.6 ? 1.6 : 0);
    const width = 1.5;
    for (let y = 0; y < HOOP_H; y++)
      for (let x = 0; x < HOOP_W; x++) {
        if (cv[y]![x] !== "." && !"pu".includes(cv[y]![x]!)) continue;
        const [px, py] = [x + 0.5 - bx, y + 0.5 - by];
        const along = px * dx + py * dy;
        const across = Math.abs(-px * dy + py * dx + Math.sin(along + i + seed) * 0.4);
        if (along < -0.6 || along > len) continue;
        const f = Math.max(0, along) / len;
        if (across > width * (1 - f * 0.8)) continue;
        cv[y]![x] = f < 0.2 && across < 0.8 ? "R" : f < 0.45 ? "Q" : f < 0.72 ? "v" : f < 0.9 ? "u" : "p";
      }
  }
  return { grid: toGrid(cv) };
}

/** A small round balloon (his limp one for the pump, or one to bat at a king), in one color's keys. */
const smallBalloon = (piece: Piece, stage: Stage, keys: string): Part => {
  const shape = BALLOON_SHAPES[piece][stage - 1]!;
  return balloonPartOf(shape.sil, shape.marks, { d: keys[0]!, b: keys[1]!, l: keys[2]!, w: "w", n: keys[0]! });
};

// ---- Parts and the pose.

const { parts: PARTS, add } = lazyParts();
add("shadow", () => shadow(46));
for (let i = 0; i < 4; i++) add(`hoop:${i}`, () => hoopPart(i));
add("limp", () => smallBalloon("pawn", 1, "jlm"));
const BAT_KEYS = ["EFG", "HIN", "OPS", "TUV", "XZ0", "jlm"] as const;
BAT_KEYS.forEach((k, i) => add(`bat:${i}`, () => smallBalloon("pawn", 2, k)));

type Placed = { name: string; at: Pt };
const placedAt = new Map<string, Pt>();
/** A part painted at a place of its own (its `at`), made the first time it's drawn, by a name that says how. */
function placed(name: string, make: () => { part: Part; at: Pt }): Placed {
  let at = placedAt.get(name);
  if (!at) {
    const m = make();
    add(name, () => m.part);
    placedAt.set(name, (at = m.at));
  }
  return { name, at };
}

/** A pose: the numbers that move him (scene pixels, or degrees). */
export interface TigerPose {
  /** He sinks this many pixels (a breath, a crouch): his body, head and raised arm go down; his feet stay on the ground. */
  bob?: number;
  /** All of him off the ground this many pixels (a hop, a drop in; his shadow stays), and moved across (negative: to our left). */
  air?: number;
  dx?: number;
  /** Reared up onto his hind legs, degrees (0 on all fours, about 65 standing): his body turns about his hips, his head and arms go with it. */
  rear?: number;
  /** His head (skull, jaw, ears, eyes, whiskers and the hat on it) moved from where it stands: a nod, a lean (negative x: to our left). */
  head?: Pt;
  /** The jaw: degrees open (0 closed, about 30 a great yawn). */
  jaw?: number;
  /** The ears' lean, in pixels at the tips (negative: toward his front; positive: laid back flat), and the eyes. */
  earN?: number;
  earF?: number;
  eyes?: Eyes;
  /** The hat moved from where it sits on his head (a bounce, a lift), and tipped (degrees: positive, its front up). */
  hat?: Pt;
  hatTilt?: number;
  /** The tail's tip, up or down (a swish). */
  tail?: number;
  /** The raised paw (its middle); the strings go into it and the elbow bends by itself. */
  paw?: Pt;
  /** The far forepaw lifted off the ground (its middle), as an arm: standing, or holding the strings (`holdF`). */
  pawF?: Pt;
  holdF?: boolean;
  /** Each balloon of the bunch moved from where it hangs (a bob, or handed over: out of the bunch with `gone`), the whole bunch moved (`bunch`), or let go (`loose`: the strings trail under the balloons). */
  balloons?: Partial<Record<Piece, Pt>>;
  bunch?: Pt;
  gone?: readonly Piece[];
  loose?: boolean;
  /** In his raised paw: a burning hoop (its flicker, 0 to 3), a limp balloon (for the pump), or a balloon to bat (its color, 0 to 5). */
  hoop?: number;
  limp?: boolean;
  bat?: number;
  /** The feet's lift (a step): near hind, far hind, far front. */
  stepHN?: number;
  stepHF?: number;
  stepFF?: number;
}

const REST = {
  bob: 0,
  air: 0,
  dx: 0,
  rear: 0,
  head: [0, 0] as Pt,
  jaw: 0,
  earN: 0,
  earF: 0,
  eyes: "open" as Eyes,
  hat: [0, 0] as Pt,
  hatTilt: 12,
  tail: 0,
  paw: FIST,
  pawF: undefined as Pt | undefined,
  holdF: false,
  balloons: {} as Partial<Record<Piece, Pt>>,
  bunch: [0, 0] as Pt,
  gone: [] as readonly Piece[],
  loose: false,
  hoop: undefined as number | undefined,
  limp: false,
  bat: undefined as number | undefined,
  stepHN: 0,
  stepHF: 0,
  stepFF: 0,
};

/** The raised arm's bones: shoulder to elbow, elbow to wrist; and where the wrist is from the paw's middle. */
const SHOULDER: Pt = [27, 49.8];
const BONES: Pt = [10.6, 8.2];
const WRIST_FROM_PAW: Pt = [2.4, 2.6];
/** What he rears up about (his hips), and the base of his neck (his head rides on it) and of his tail. */
const PIVOT: Pt = [42, 54];
const NECK: Pt = [26, 46];
const TAIL_BASE: Pt = [50, 50];

/** An elbow for an arm of two bones `l1` and `l2` from `s` to `t`, bent down (or as far out as it reaches). */
function elbowOf(s: Pt, t: Pt, [l1, l2]: Pt): Pt {
  const dist = Math.hypot(t[0] - s[0], t[1] - s[1]) || 0.01;
  const d = Math.min(dist, l1 + l2 - 0.01);
  const [ux, uy] = [(t[0] - s[0]) / dist, (t[1] - s[1]) / dist];
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const [mx, my] = [s[0] + ux * a, s[1] + uy * a];
  const c1: Pt = [mx - uy * h, my + ux * h];
  const c2: Pt = [mx + uy * h, my - ux * h];
  return c1[1] >= c2[1] ? c1 : c2;
}

const r2 = (v: number) => Math.round(v * 2) / 2;
const key = (pts: readonly Pt[]) => pts.map((p) => `${r2(p[0])},${r2(p[1])}`).join(";");
const up = (p: Pt, dy: number): Pt => [p[0], p[1] + dy];

/** The layers of a pose, back to front. */
export function tigerLayers(pose: TigerPose = {}): Layer[] {
  const p = { ...REST, ...pose };
  const b = p.bob;
  const th = rad(p.rear);
  /** A point of his body as he rears (it turns about his hips). */
  const rr = ([x, y]: Pt): Pt => (p.rear ? [PIVOT[0] + Math.cos(th) * (x - PIVOT[0]) - Math.sin(th) * (y - PIVOT[1]), PIVOT[1] + Math.sin(th) * (x - PIVOT[0]) + Math.cos(th) * (y - PIVOT[1])] : [x, y]);
  const neck = rr(NECK);
  const hd: Pt = [p.head[0] + neck[0] - NECK[0], p.head[1] + neck[1] - NECK[1]];
  const tb = rr(TAIL_BASE);
  const at = (pl: Placed, dx = 0, dy = 0): Layer => ({ part: pl.name, x: OX + pl.at[0] + dx, y: OY + pl.at[1] + dy });
  /** A part of his head: it moves with it. */
  const H = (pl: Placed) => at(pl, Math.round(hd[0]), b + Math.round(hd[1]));
  const paw: Pt = up(p.paw, b);
  const wrist: Pt = [paw[0] + WRIST_FROM_PAW[0], paw[1] + WRIST_FROM_PAW[1]];
  const shoulder = up(rr(SHOULDER), b);
  const elbow = elbowOf(shoulder, wrist, BONES);
  const bunch = BALLOON_ORDER.filter((n) => !p.gone.includes(n));
  const offset = (n: Piece): Pt => [Math.round(p.bunch[0] + (p.balloons[n]?.[0] ?? 0)), b + Math.round(p.bunch[1] + (p.balloons[n]?.[1] ?? 0))];
  const knots = bunch.map((n) => [knotOf(n)[0] + offset(n)[0], knotOf(n)[1] + offset(n)[1]] as Pt);
  const gather: Pt = [GATHER[0] + p.bunch[0], GATHER[1] + p.bunch[1] + b];
  // The far forepaw: on the ground (a leg), or lifted as an arm.
  const shoulderF = up(rr([27, 50.2]), b);
  const pawF = p.pawF ? up(p.pawF, b) : p.rear ? up([shoulderF[0] - 4, shoulderF[1] + 10], 0) : undefined;
  const fist = p.holdF && pawF ? pawF : paw;
  // (A leg's top joints sink with the body; its foot and the lower joints lift with the step.)
  const hipF = up(rr([39.4, 52.6]), b);
  const hipN = up(rr([44.6, 51.8]), b);
  const hindFar = (): Pt[] => [hipF, [36.2, 59 + b / 2 - p.stepHF / 2], [39.4, 64 - p.stepHF], [38, 67.2 - p.stepHF]];
  const hindNear = (): Pt[] => [hipN, [41.2, 59 + b / 2 - p.stepHN / 2], [45.6, 64 - p.stepHN], [44.2, 67.2 - p.stepHN]];
  const frontFar = (): Pt[] => [shoulderF, [26.4, 58 + b / 2 - p.stepFF / 2], [25.4, 64.2 - p.stepFF]];
  const R = (name: string, make: () => { part: Part; at: Pt }) => placed(p.rear ? `${name}@${p.rear}` : name, () => turned(make(), p.rear, PIVOT));
  const STRIPES_N: readonly (readonly Pt[])[] = [[[46.6, 46], [44.4, 50], [43.2, 54]], [[49.2, 48.2], [46.8, 52], [45.4, 56]], [[42.4, 47], [40.4, 50.6], [39.6, 54]]];
  const stripesN = STRIPES_N.map((s) => s.map((q) => up(rr(q), b)));
  const farArm = (): { part: Part; at: Pt } => {
    const wristF: Pt = [pawF![0] + WRIST_FROM_PAW[0], pawF![1] + WRIST_FROM_PAW[1]];
    return leg([shoulderF, elbowOf(shoulderF, wristF, BONES), wristF], [4.4, 3.3, 3], [pawF![0], pawF![1], 3.4, 3.1, true], [6, 10.5], 0.2);
  };
  const inPaw: Layer[] = [];
  // (A hoop is held out ahead of him, toward the board, its foot in his fist: clear of his muzzle.)
  if (p.hoop !== undefined) inPaw.push({ part: `hoop:${p.hoop % 4}`, x: OX + Math.round(paw[0]) - HOOP_W + 1, y: OY + Math.round(paw[1]) - HOOP_H + 6 });
  if (p.limp) inPaw.push({ part: "limp", x: OX + Math.round(paw[0]) - 4, y: OY + Math.round(paw[1]) - 9 });
  if (p.bat !== undefined) inPaw.push({ part: `bat:${p.bat % BAT_KEYS.length}`, x: OX + Math.round(paw[0]) - 5, y: OY + Math.round(paw[1]) - 11 });
  const layers: Layer[] = [
    { part: "shadow", x: OX + 12, y: OY + GROUND - 3 },
    at(placed(`tail:${r2(p.tail)}:${b}`, () => tail(p.tail, b)), Math.round(tb[0] - TAIL_BASE[0]), Math.round(tb[1] - TAIL_BASE[1])),
    at(placed(`legHF:${key(hindFar())}`, () => leg(hindFar(), [4.4, 3.4, 2.3, 2.7], [38, 67.2 - p.stepHF, 5, 2.6], [6, 10], 0.2))),
    at(pawF ? placed(`armFF:${key([shoulderF, pawF])}`, farArm) : placed(`legFF:${key(frontFar())}`, () => leg(frontFar(), [4.4, 3.3, 3], [24.6, 67.2 - p.stepFF, 5.4, 2.7], [6, 10.5], 0.2))),
    at(R("torso", torso), 0, b),
    at(R("vest", vest), 0, b),
    at(placed(`legHN:${key(hindNear())}`, () => leg(hindNear(), [5.4, 3.9, 2.6, 3], [44.2, 67.2 - p.stepHN, 5.4, 2.7], [9.4, 13], 0, stripesN))),
    at(placed(`legFN:${key([shoulder, elbow, wrist, paw])}`, () => leg([shoulder, elbow, wrist], [5, 3.8, 3], [paw[0], paw[1], 3.7, 3.4, true], [4.5, 8.5, 12.5]))),
    at(placed(`strings:${bunch.join()}:${p.loose ? "loose" : key([fist, gather])}:${key(knots)}`, () => strings(knots, fist, gather, p.loose))),
    H(placed(`earF:${p.earF}`, () => ear(EAR_F[0], EAR_F[1], p.earF, true))),
    H(placed(`earN:${p.earN}`, () => ear(EAR_N[0], EAR_N[1], p.earN))),
    ...(p.jaw > 0 ? [H(placed(`mouth:${p.jaw}`, () => mouth(p.jaw)))] : []),
    H(placed(`jaw:${p.jaw}`, () => jaw(p.jaw))),
    H(placed("head", head)),
    H(placed(`eyeF:${p.eyes}`, () => eye(EYE_F[0], EYE_F[1], 5, p.eyes))),
    H(placed(`eyeN:${p.eyes}`, () => eye(EYE_N[0], EYE_N[1], 6, p.eyes))),
    H(placed("whiskers", whiskers)),
    at(placed(`hat:${p.hatTilt}`, () => hat(p.hatTilt)), Math.round(hd[0] + p.hat[0]), b + Math.round(hd[1] + p.hat[1])),
    ...bunch.map((n) => at(placed(`balloon:${n}`, () => balloon(n, BUNCH[n]!.at, BUNCH[n]!.stage)), offset(n)[0], offset(n)[1])),
    ...inPaw,
  ];
  if (!p.air && !p.dx) return layers;
  return layers.map((l) => ({ ...l, x: l.x + Math.round(p.dx), y: l.part === "shadow" ? l.y : l.y - Math.round(p.air) }));
}

/** The balloon he holds out (the limp one, one he bats) in each of the pump's colors: a look over its keys. */
const tigerLooks = (): Record<BalloonColor, Record<string, string>> =>
  Object.fromEntries(BALLOON_COLOR_NAMES.map((c): [string, Record<string, string>] => [c, { j: BALLOON_COLORS[c][0], l: BALLOON_COLORS[c][1], m: BALLOON_COLORS[c][2] }])) as Record<BalloonColor, Record<string, string>>;

// ---- His animations (docs/decisions/2026-10-23-tiger-animations.md). Frame counts and times are the other bosses' (Smudgy's,
// Puddles'); every frame is a pose. His attitude: a bored, grumpy circus cat who hated the roaring and the hoops: he yawns where
// another boss would roar, watches through half-shut eyes, and only his balloons make him smile.

const sp = (x: number, y: number, k: string): Speck => [OX + Math.round(x), OY + Math.round(y), k];
const F = (ms: number, pose: TigerPose = {}, extra: Partial<Frame> = {}): Frame => ({ ms, layers: tigerLayers(pose), ...extra });
const ALL_GONE: readonly Piece[] = ["queen", "knight", "rook", "pawn"];
/** His shadow on the ground alone (before he drops in, after he's gone). */
const shadowOnly = (r: number): Speck[] => groundShadow(OX + 35, OY + GROUND - 1, r);
/** Dust kicked up at his feet, `t` a frame number (it spreads and settles). */
const dust = (t: number, n = 3): Speck[] =>
  Array.from({ length: n * 2 }, (_, i): Speck => {
    const side = i % 2 ? 1 : -1;
    return sp(35 + side * (12 + t * 3 + (i >> 1) * 4), GROUND - 1 - ((i + t) % 3) - (t === 1 ? 1 : 0), (i + t) % 2 ? "^" : "~");
  });
/** Each balloon of the bunch bobbing a pixel, out of step with the others (`i` a frame number of 16). */
const bobbing = (i: number): Partial<Record<Piece, Pt>> => ({
  queen: [0, i >= 2 && i <= 7 ? -1 : 0],
  knight: [0, i >= 6 && i <= 11 ? -1 : 0],
  rook: [0, i >= 10 && i <= 15 ? -1 : 0],
  pawn: [i >= 4 && i <= 9 ? 1 : 0, 0],
});
/** A hit: every color goes pale. */
const FLASH: Record<string, string> = Object.fromEntries(
  Object.entries(TIGER_PALETTE)
    .filter(([k]) => !["k", "z", "x", "s", "w"].includes(k))
    .map(([k, c]) => {
      const n = parseInt(c.slice(1), 16);
      const mix = (v: number) => Math.round(v + (255 - v) * 0.55).toString(16).padStart(2, "0");
      return [k, `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`];
    }),
);
const twinkle = (x: number, y: number): Speck[] => sparkle(OX + x, OY + y, "w", "Y");

/** On his hind legs (Eric's second picture), the bunch held up in his raised paw. */
const STAND: TigerPose = { rear: 65, paw: [24, 30], bunch: [16, -18] };
/** Standing with a hoop: the strings in his far paw up behind his head, the near paw free for the hoop. */
const HOOP_STAND: TigerPose = { rear: 65, pawF: [33, 30], holdF: true, bunch: [18, -17], eyes: "half", hatTilt: 6 };

/** Idle: frame 1 is the still. He breathes slowly, his balloons bob out of step, his tail swishes, an ear flicks, he blinks. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) =>
    F(125, {
      bob: i >= 5 && i <= 12 ? 1 : 0,
      balloons: bobbing(i),
      earN: i === 3 ? -2 : i === 4 ? -1 : 0,
      earF: i === 3 ? -1 : 0,
      tail: i >= 8 && i <= 11 ? [2, 3, 3, 1][i - 8]! : 0,
      eyes: i === 11 ? "shut" : i === 12 ? "half" : "open",
      head: [0, i >= 6 && i <= 9 ? 1 : 0],
    }),
  ),
};

/** Entrance: his shadow spreads, he drops in, lands in a crouch with dust, straightens, and gives the crowd a big bored yawn. */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 100, layers: [], specks: shadowOnly(8), cue: "drop" },
    { ms: 100, layers: [], specks: shadowOnly(16) },
    F(70, { air: 22, eyes: "wide", earN: -2, earF: -2, tail: 4, stepHN: 3, stepHF: 3, stepFF: 3, hat: [0, -3], balloons: { queen: [0, 2], knight: [0, 2], rook: [0, 2] } }),
    F(70, { air: 7, eyes: "wide", earN: -2, earF: -2, tail: 3, stepHN: 1, stepHF: 1, stepFF: 1, hat: [0, -1] }),
    F(130, { bob: 3, eyes: "shut", earN: 3, earF: 3, hat: [0, 1], balloons: { queen: [0, 2], knight: [0, 1], rook: [0, 2], pawn: [0, 1] } }, { cue: "thump", shake: [0, 2], specks: dust(0) }),
    F(110, { bob: 1, earN: 1, earF: 1 }, { specks: dust(1) }),
    F(110, { eyes: "half" }, { specks: dust(2) }),
    F(160, { head: [1, -1], jaw: 22, eyes: "shut", earN: 2, earF: 2, tail: 2 }, { cue: "yawn" }),
    F(160, { head: [1, -1], jaw: 30, eyes: "shut", earN: 3, earF: 3, tail: 3 }),
    F(300, { eyes: "half" }),
  ],
};

/** Thinking: bored, eyes half shut on the board, his tail tip tapping, an ear turning; a slow yawn in the third round. */
const THINK_JAW = [0, 0, 0, 0, 0, 0, 0, 0, 8, 18, 24, 10, 0, 0, 0, 0] as const;
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) =>
    F(130, {
      head: [-1, 1],
      eyes: THINK_JAW[i] ? "shut" : i % 4 === 3 ? "shut" : "half",
      jaw: THINK_JAW[i]!,
      earN: [0, 1, 0, -1][i % 4]!,
      earF: i >= 12 ? 1 : 0,
      tail: [0, 2, 0, -1][i % 4]!,
      balloons: bobbing(i),
      bob: i >= 8 && i <= 11 ? 1 : 0,
    }),
  ),
};

/** His move: a crouch, a step with the front foot and one with the hind, each with a thump of dust, and a settle. */
const move: Anim = {
  loop: false,
  frames: [
    F(100, { bob: 2, earN: 1, earF: 1, eyes: "half" }),
    F(90, { stepFF: 3, bob: 1, head: [-1, 0], eyes: "half", balloons: { queen: [0, 1], knight: [0, 1] } }),
    F(110, { bob: 2, eyes: "half" }, { cue: "thump", shake: [0, 1], specks: dust(0, 2) }),
    F(130, { stepHN: 3, stepHF: 1, bob: 1, head: [-1, 0], tail: 2, eyes: "half", balloons: { rook: [0, 1], pawn: [0, 1] } }),
    F(120, { bob: 2, eyes: "half" }, { cue: "thump", shake: [0, 1], specks: dust(1, 2) }),
    F(160, { eyes: "half" }),
  ],
};

/** A capture: a lazy swat at the board with his raised paw (the balloons jerk on their strings), then a pleased little grin. */
const capture: Anim = {
  loop: false,
  frames: [
    F(90, { bob: 2, earN: 2, earF: 2, eyes: "half" }),
    F(85, { bob: 1, paw: [13, 44], head: [1, 0], eyes: "half", balloons: { queen: [1, -1], knight: [1, -1], rook: [1, 0], pawn: [1, 0] } }),
    F(85, { bob: 2, paw: [8, 57], head: [-2, 1], eyes: "wide", earN: -2, earF: -2, balloons: { queen: [-1, 1], knight: [-1, 1], rook: [-1, 1], pawn: [-2, 1] } }, { cue: "swat", shake: [-1, 0] }),
    F(85, { bob: 2, paw: [9, 56], head: [-2, 1], eyes: "open", balloons: { queen: [-1, 0], knight: [-1, 0], rook: [0, 1], pawn: [-1, 1] } }),
    F(85, { bob: 1, paw: [7, 53], head: [-1, 0], eyes: "half" }),
    ...Array.from({ length: 6 }, (_, i) => F(85, { eyes: i < 4 ? "joy" : "half", jaw: i < 4 ? 6 : 0, tail: [2, 4, 2, 4, 2, 0][i]!, earN: -1, earF: -1, head: [0, -1], balloons: bobbing(i * 2) })),
    F(160, { eyes: "half" }),
  ],
};

/** Hurt: every color pale, knocked back with his eyes shut and ears flat, the hat jolted up, the balloons yanked; a glare. */
const hurt: Anim = {
  loop: false,
  frames: [
    F(70, { dx: 2, head: [2, -1], eyes: "shut", earN: 3, earF: 3, hat: [1, -3], hatTilt: 20, tail: 4, balloons: { queen: [2, -2], knight: [2, -1], rook: [1, -2], pawn: [2, -1] } }, { cue: "oof", pal: FLASH, shake: [2, 0] }),
    F(80, { dx: 2, bob: 1, head: [2, 0], eyes: "shut", earN: 3, earF: 3, hat: [1, -2], hatTilt: 18, tail: 3, balloons: { queen: [1, -1], knight: [1, 0], rook: [1, -1], pawn: [1, 0] } }),
    F(90, { dx: 1, bob: 2, head: [1, 1], eyes: "shut", earN: 2, earF: 2, hat: [0, -1], hatTilt: 14 }),
    F(90, { dx: 1, bob: 1, head: [0, 1], eyes: "half", earN: 2, earF: 2 }),
    F(110, { bob: 1, head: [-1, 1], eyes: "half", earN: 3, earF: 3, tail: -2 }),
    F(120, { head: [-1, 0], eyes: "half", earN: 2, earF: 2, tail: -1 }),
    F(160, { eyes: "half" }),
  ],
};

/** Check: a growl he can't be bothered to make a roar (a crouch, the jaw open, ears back), then he shakes his bunch at the board. */
const check: Anim = {
  loop: false,
  frames: [
    F(100, { bob: 2, head: [-1, 1], earN: 2, earF: 2, eyes: "half" }),
    F(120, { bob: 2, head: [-2, 1], jaw: 18, earN: 3, earF: 3, eyes: "half", tail: 3 }, { cue: "growl" }),
    F(100, { bob: 2, head: [-2, 1], jaw: 14, earN: 3, earF: 3, eyes: "half", tail: 4 }),
    F(100, { bob: 1, head: [-1, 0], earN: 1, earF: 1, eyes: "half" }),
    F(120, { bob: 1, paw: [6, 48], earN: -1, eyes: "half", balloons: { queen: [-1, -1], knight: [-1, -1], rook: [-2, -1], pawn: [-2, 0] } }, { cue: "squeak" }),
    F(100, { bob: 1, paw: [9, 51], eyes: "half", balloons: { queen: [1, 0], knight: [1, 0], rook: [0, 1], pawn: [1, 0] } }),
    F(150, { paw: [7, 50], eyes: "half", balloons: { queen: [-1, 0], rook: [-1, 0] } }),
    F(160, { eyes: "half" }),
  ],
};

/** Smug: head back, eyes half shut, a thin grin, the hat tipped further, his tail swishing slowly, the balloons bobbing. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    F(150, { head: [1, -1], eyes: i === 5 ? "shut" : "half", jaw: i % 4 === 1 ? 4 : 0, hatTilt: 16, tail: [0, 2, 3, 2, 0, -1, -2, -1][i]!, earN: i === 2 ? -1 : 0, balloons: bobbing(i * 2) }),
  ),
};

/** Rattled: shaking a pixel either way, eyes wide, ears back, tail up and bristling, the balloons jittering on their strings. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    F(80, { dx: i % 2 ? 1 : -1, bob: i % 4 === 0 ? 1 : 0, eyes: "wide", earN: 3, earF: 3, tail: 5, hat: [0, i % 2 ? -1 : 0], balloons: { queen: [i % 2 ? 1 : 0, 0], knight: [0, i % 2 ? 0 : -1], rook: [i % 2 ? 0 : -1, 0], pawn: [0, i % 2 ? 1 : 0] } }),
  ),
};

/** Defeat: a flash and a reel; he lets go of his balloons (they float up and away) and slumps down, ears limp, the hat tipped over his eyes. */
const defeat: Anim = {
  loop: false,
  frames: [
    F(80, { dx: 2, head: [2, -1], eyes: "shut", earN: 3, earF: 3, hat: [1, -2], tail: 3 }, { cue: "oof", pal: FLASH, shake: [2, 0] }),
    F(100, { dx: 1, bob: 1, head: [1, 0], eyes: "wide", earN: 2, earF: 2, paw: [10, 54], loose: true, bunch: [0, -5] }),
    F(110, { bob: 3, head: [0, 2], eyes: "half", earN: 3, earF: 3, paw: [12, 58], loose: true, bunch: [1, -12], hat: [-1, 1], hatTilt: 0 }, { cue: "flop", specks: dust(0, 2) }),
    F(120, { bob: 4, head: [0, 3], eyes: "shut", earN: 3, earF: 3, paw: [12, 60], loose: true, bunch: [2, -20], hat: [-2, 2], hatTilt: -8, tail: -2 }, { specks: dust(1, 2) }),
    F(140, { bob: 4, head: [0, 3], eyes: "shut", earN: 3, earF: 3, paw: [12, 60], loose: true, bunch: [3, -27], hat: [-2, 2], hatTilt: -10, tail: -3 }),
    F(1000, { bob: 4, head: [0, 3], eyes: "shut", earN: 3, earF: 3, paw: [12, 60], gone: ALL_GONE, hat: [-2, 2], hatTilt: -10, tail: -3 }),
  ],
};

/** Victory: up on his hind legs (the old act's bow, without the enthusiasm), the bunch held high, a smug look, a foot tap. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    F(110, {
      ...STAND,
      bob: i % 6 === 2 || i % 6 === 3 ? 1 : 0,
      eyes: i === 9 ? "shut" : i < 6 ? "half" : "joy",
      jaw: i >= 6 && i <= 8 ? 6 : 0,
      paw: [24, 30 - (i % 6 === 2 || i % 6 === 3 ? 0 : 1)],
      tail: [0, 2, 4, 2, 0, -2][i % 6]!,
      hatTilt: i >= 6 ? 20 : 12,
      balloons: bobbing(i),
      stepHN: i === 8 ? 2 : 0,
    }, i === 2 ? { cue: "huff" } : i === 8 ? { cue: "thump" } : {}),
  ),
};

// ---- His own moments.

/** The hop to the pump and back (one animation; mirror it for the way back): a crouch, a spring, in the air (`air`: hold it while the hop moves him), down, a landing with dust, a settle. */
const hop: Anim = {
  loop: false,
  frames: [
    F(110, { bob: 3, earN: 2, earF: 2, eyes: "half", tail: -2 }),
    F(70, { air: 4, bob: -1, stepHF: 2, stepHN: 2, tail: 3, eyes: "open", balloons: { queen: [0, 2], knight: [0, 2], rook: [0, 2], pawn: [0, 1] } }, { cue: "spring" }),
    F(120, { air: 10, bob: -1, stepHF: 4, stepHN: 4, stepFF: 4, tail: 4, earN: -1, earF: -1, eyes: "half", hat: [0, -1], balloons: { queen: [0, 3], knight: [0, 3], rook: [0, 3], pawn: [0, 2] } }),
    F(70, { air: 4, stepHF: 1, stepHN: 1, stepFF: 2, tail: 2, eyes: "half", balloons: { queen: [0, 1], knight: [0, 1], rook: [0, 1] } }),
    F(100, { bob: 3, earN: 2, earF: 2, eyes: "shut", balloons: { queen: [0, -1], knight: [0, -1], rook: [0, -1] } }, { cue: "thump", specks: dust(0, 2) }),
    F(150, { bob: 1, eyes: "half" }, { specks: dust(1, 2) }),
  ],
};
/** The frame of `hop` that holds while he is moved through the air. */
export const TIGER_HOP_AIR = 2;

/** Place: he pulls a limp balloon from his vest pocket and sets it on the nozzle in front of him (`touch`: it is on the nozzle). */
const place: Anim = {
  loop: false,
  frames: [
    F(110, { paw: [30, 48], head: [1, 1], eyes: "half" }),
    F(100, { paw: [31, 47], head: [1, 1], eyes: "half", limp: true }, { cue: "rustle" }),
    F(110, { paw: [18, 50], head: [0, 1], eyes: "half", limp: true }),
    F(120, { bob: 2, paw: [9, 58], head: [-2, 2], eyes: "half", limp: true }),
    F(120, { bob: 2, paw: [9, 59], head: [-2, 2], eyes: "half" }, { cue: "touch" }),
    F(120, { bob: 1, paw: [7, 55], head: [-1, 1], eyes: "half" }),
    F(140, { eyes: "half" }),
  ],
};

/** Cheer (a balloon landed on the board): a small pleased grin, the tail up, the balloons bobbing. */
const cheer: Anim = {
  loop: false,
  frames: [
    F(90, { eyes: "open", earN: -1, earF: -1 }, { cue: "cheer" }),
    ...Array.from({ length: 6 }, (_, i) => F(90, { eyes: "joy", jaw: i % 2 ? 4 : 7, tail: [3, 5, 4, 5, 3, 2][i]!, head: [0, -1], earN: -2, earF: -2, bob: i % 2, balloons: bobbing(i * 2 + 1) })),
    F(90, { eyes: "half", jaw: 0 }),
  ],
};

/** Big cheer (a real queen landed): he half rears up, a wide grin, the balloons swinging, sparkles; then down again, still pleased. */
const bigCheer: Anim = {
  loop: false,
  frames: [
    F(90, { bob: 2, eyes: "wide", earN: -2, earF: -2 }, { cue: "cheer" }),
    F(90, { rear: 20, paw: [12, 44], bunch: [2, -4], eyes: "joy", jaw: 10, tail: 4 }),
    ...Array.from({ length: 7 }, (_, i) =>
      F(110, { rear: 32, paw: [16, 38], bunch: [6, -8], eyes: "joy", jaw: i % 2 ? 10 : 14, tail: [4, 6, 4, 6, 4, 6, 4][i]!, earN: -2, earF: -2, hatTilt: 18, balloons: bobbing(i * 2) }, {
        ...(i === 2 ? { cue: "whoop" } : {}),
        specks: i % 2 ? [...twinkle(2, 14), ...twinkle(40, 8)] : [...twinkle(8, 6), ...twinkle(34, 18)],
      }),
    ),
    F(110, { rear: 16, paw: [11, 46], bunch: [2, -3], eyes: "joy", jaw: 6 }),
    F(100, { bob: 1, eyes: "joy", jaw: 4 }),
  ],
};

/** Wince (a balloon popped): ears flat, eyes shut, a flinch, then an annoyed look and a lash of his tail. */
const wince: Anim = {
  loop: false,
  frames: [
    F(80, { dx: 1, bob: 1, head: [1, 0], eyes: "shut", earN: 3, earF: 3, tail: 3, hat: [0, -1] }, { cue: "wince", shake: [1, 0] }),
    F(100, { dx: 1, bob: 2, head: [2, 1], eyes: "shut", earN: 3, earF: 3, tail: 2 }),
    F(110, { bob: 1, head: [1, 1], eyes: "shut", earN: 3, earF: 2 }),
    F(130, { head: [0, 1], eyes: "half", earN: 2, earF: 2, tail: -2 }),
    F(130, { head: [-1, 1], eyes: "half", earN: 2, earF: 2, tail: 4 }, { cue: "huff" }),
    F(120, { head: [-1, 0], eyes: "half", earN: 1, earF: 1, tail: -1 }),
    F(110, { eyes: "half" }),
  ],
};

/** The hoops (his ultimate's cast, Alfil's Slam's length): up on his hind legs with a burning hoop, the old act and a sour look; three throws. */
const HOOP_HOLD: Pt = [25, 34];
const HOOP_BACK: Pt = [38, 18];
const HOOP_THROW: Pt = [22, 42];
const hoops: Anim = {
  loop: false,
  frames: [
    F(90, { rear: 30, paw: [14, 46], eyes: "half", bunch: [6, -6] }),
    F(110, { ...HOOP_STAND, paw: HOOP_HOLD, hoop: 0 }, { cue: "flame" }),
    F(100, { ...HOOP_STAND, paw: HOOP_BACK, hoop: 1, head: [1, 0] }),
    F(90, { ...HOOP_STAND, paw: HOOP_THROW, head: [-1, 1] }, { cue: "throw1" }),
    F(100, { ...HOOP_STAND, paw: HOOP_HOLD, hoop: 2 }),
    F(90, { ...HOOP_STAND, paw: HOOP_BACK, hoop: 3, head: [1, 0] }),
    F(90, { ...HOOP_STAND, paw: HOOP_THROW, head: [-1, 1] }, { cue: "throw2" }),
    F(100, { ...HOOP_STAND, paw: HOOP_HOLD, hoop: 0 }),
    F(90, { ...HOOP_STAND, paw: HOOP_BACK, hoop: 1, head: [1, 0] }),
    F(90, { ...HOOP_STAND, paw: HOOP_THROW, head: [-1, 1] }, { cue: "throw3" }),
    F(150, { ...HOOP_STAND, paw: [26, 38], eyes: "shut", jaw: 0 }, { cue: "huff" }),
    F(90, { rear: 30, paw: [14, 46], eyes: "half", bunch: [6, -6] }),
    F(170, { bob: 2, eyes: "half" }, { cue: "thump", specks: dust(0, 2) }),
  ],
};

export const TIGER_ANIMS = ["idle", "entrance", "thinking", "move", "capture", "hurt", "check", "smug", "rattled", "defeat", "victory", "hop", "place", "cheer", "bigCheer", "wince", "hoops"] as const;

export const TIGER: Character = {
  id: "tiger",
  name: "Tiger",
  w: W,
  h: H,
  foot: [OX + FOOT_X, OY + GROUND],
  palette: TIGER_PALETTE,
  halo: "#3a2a22",
  looks: tigerLooks(),
  parts: PARTS,
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, hop, place, cheer, bigCheer, wince, hoops },
};

/** The part of him a portrait shows (his head, ears and hat, a bit of his shoulders and vest collar), in frame pixels. */
export const TIGER_PORTRAIT = { x: OX + 10, y: OY + 24, w: 27, h: 27 } as const;
/** Where the approved still's 76 x 78 frame is in his frame (the headroom above it is new): a test keeps those pixels. */
export const TIGER_STILL_BOX = { x: OX - 6, y: OY - 4, w: 76, h: 78 } as const;

// ---- His attack on a king (the ten shared beats): he drops in beside the king and bats a balloon at him each beat; it bonks on the
// king and pops (the board's `balloonHit` on the king's square at each `bonk`).

/** The king, to our left: as far as Puddles' (1.8 squares of 36 px), so the frame is this much wider on the left. */
const ATTACK_REACH = 44;
const AW = W + ATTACK_REACH;
const STAND_OFF = 1.8 * 36;
/** Where each balloon meets the king (scene pixels): at his head, or a little lower, in turn. */
const KING_AT = (i: number): Pt => [FOOT_X - STAND_OFF - 4, GROUND - 1 - (i % 2 ? 21 : 27)];
const fa = (fr: Frame): Frame => moved(fr, ATTACK_REACH, 0, AW, H);
const landShadow = (r: number): Speck[] => shadowOnly(r).map(([x, y, k]): Speck => [x + ATTACK_REACH, y, k]);
/** A balloon's colors in turn (his palette's: red, yellow, blue, green, purple, pink). */
const BAT_COLORS = ["EFG", "HIN", "OPS", "TUV", "XZ0", "jlm"] as const;
/** The balloon at the king (scene pixels): squashed against him (`bonk`), or burst (a flash, scraps). */
function atKing(i: number, burst: boolean): Speck[] {
  const [kx, ky] = KING_AT(i);
  const [d, b, l] = [...BAT_COLORS[i % BAT_COLORS.length]!];
  if (!burst) {
    const out: Speck[] = [];
    // A squashed round balloon, 7 wide and 5 high, flat on the king's side (its right), outlined.
    for (let y = -3; y <= 3; y++)
      for (let x = -1; x <= 7; x++) {
        const e = ((x - 3) / 4.2) ** 2 + (y / 3.2) ** 2;
        if (e <= 1) out.push(sp(kx + x, ky + y, e > 0.62 ? "k" : x < 3 && y < 0 ? l! : x > 4 || y > 1 ? d! : b!));
      }
    out.push(sp(kx + 2, ky - 1, "w"), sp(kx + 7, ky + 3, d!), sp(kx + 8, ky + 4, "8"), sp(kx + 9, ky + 5, "8"));
    return out;
  }
  return [
    ...sparkle(OX + Math.round(kx + 2), OY + Math.round(ky), "w", "Y", true),
    sp(kx - 3, ky - 4, b!), sp(kx - 2, ky - 4, d!), sp(kx + 6, ky - 3, b!), sp(kx + 6, ky - 2, d!),
    sp(kx - 2, ky + 4, b!), sp(kx + 5, ky + 4, b!), sp(kx + 5, ky + 5, d!), sp(kx + 2, ky - 6, l!),
  ];
}
/** A beat: the swat lands and the balloon bonks on the king (the cue frame is where the board marks the king's square). */
const batBeat = (i: number): Frame => {
  const fr = fa(F(90, { bob: 2, paw: [8, 56], head: [-2, 1], eyes: "half", earN: 1, earF: 1, tail: i % 2 ? 3 : -1, balloons: { queen: [-1, 1], knight: [-1, 1], rook: [-1, 0], pawn: [-1, 1] } }, { cue: "bonk", shake: [i % 2 ? -1 : 1, 0] }));
  return { ...fr, specks: [...(fr.specks ?? []), ...atKing(i, false).map(([x, y, k]): Speck => [x + ATTACK_REACH, y, k])] };
};
/** Between beats: it pops on the king; his paw is back with the next balloon. */
const popBeat = (i: number): Frame => {
  const fr = fa(F(80, { bob: 1, paw: [14, 46], bat: i + 1, head: [-1, 0], eyes: "half", tail: i % 2 ? -1 : 2, balloons: bobbing(i) }, { cue: "pop" }));
  return { ...fr, specks: [...(fr.specks ?? []), ...atKing(i, true).map(([x, y, k]): Speck => [x + ATTACK_REACH, y, k])] };
};

/**
 * His attack on a king, the king to our left (the board mirrors him when it's to his right), on the shared beats (KING_ATTACK,
 * boss-timing.ts): his shadow spreads, he drops in (`drop`), lands (`land`), takes a balloon in his paw, then bats it at the king,
 * ten times: each lands on a hit's own time (`bonk`: the cue frame is where the board marks the king's square) and pops there (`pop`)
 * as the next one comes up in his paw; a bored huff (`huff`), and he hops out of the frame. The last frame is empty.
 */
const kingAttack: Anim = (() => {
  const A = KING_ATTACK;
  const frames: Frame[] = [
    { ms: 100, layers: [], specks: landShadow(8) },
    { ms: 100, layers: [], specks: landShadow(16) },
    fa(F(80, { air: 22, eyes: "wide", earN: -2, earF: -2, tail: 4, stepHN: 3, stepHF: 3, stepFF: 3, hat: [0, -3] }, { cue: "drop" })),
    fa(F(80, { air: 7, eyes: "wide", earN: -2, earF: -2, stepHN: 1, stepHF: 1, stepFF: 1 })),
    fa(F(A.landAt - 360, { bob: 3, eyes: "shut", earN: 3, earF: 3 }, { cue: "land", shake: [0, 2], specks: dust(0) })),
    fa(F(A.lashAt - A.landAt, { bob: 1, paw: [14, 46], bat: 0, eyes: "half" }, { specks: dust(1) })),
  ];
  for (let i = 0; i < A.lashes; i++) frames.push(batBeat(i), popBeat(i));
  const done = A.leaveAt - (A.lashAt + A.lashes * A.lashEveryMs);
  frames.push(fa(F(done, { head: [1, -1], eyes: "shut", jaw: 4, earN: 1, earF: 1, tail: 3 }, { cue: "huff" })));
  const leave = A.ms - A.leaveAt;
  frames.push(
    fa(F(leave - 300, { bob: 3, eyes: "half", earN: 2, earF: 2 })),
    fa(F(80, { air: 8, eyes: "half", stepHN: 2, stepHF: 2, stepFF: 2 }, { cue: "drop" })),
    fa(F(80, { air: 24, eyes: "half", stepHN: 4, stepHF: 4, stepFF: 4, tail: 4 })),
    { ms: 80, layers: [], specks: landShadow(10) },
    { ms: 60, layers: [] },
  );
  return { loop: false, frames };
})();

/**
 * The tiger for his attack on a king: the same drawing, parts and palette, facing our left as always, in a frame `ATTACK_REACH`
 * wider on the left (the balloon's reach to the king). Its `idle`, one still, is for the preview, which starts every reel from one.
 */
export const TIGER_ATTACK: Character = {
  ...TIGER,
  id: "tiger-attack",
  name: "Tiger (his attack)",
  w: AW,
  foot: [TIGER.foot[0] + ATTACK_REACH, TIGER.foot[1]],
  anims: { idle: { loop: true, frames: [fa(F(1000))] }, kingAttack },
};
