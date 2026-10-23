/**
 * The circus tiger (Eric, Oct 23: "a circus tiger who hated his role, the loud roaring and jumping through hoops, and wanted to
 * make the silly balloon animals he saw someone making"; no name yet, his id is `tiger`). After Eric's reference picture (the one
 * "where the balloons look like balloons"), redrawn: a realistic big cat on all fours, a long body and heavy paws, orange with
 * black stripes, a cream chest, muzzle and belly, amber eyes and whiskers; a small black top hat with a red band, tipped on his
 * head; a red and gold ringmaster's vest (gold edging, buttons, an embroidered panel); one front paw raised, holding the strings of
 * a bunch of four chess-piece balloons (a red king, a blue knight, a yellow bishop and a purple pawn: shiny, round, each with a
 * highlight; Eric's picture has six, and a green rook is drawn too, for the pump's pieces to come); his long striped tail curling up behind. Facing our left (as Alfil, Sawyer, Chub & Chirp, Smudgy, Moo and
 * Puddles), so his balloons are toward the board; light from the top left.
 *
 * This is his look only: ONE still, the first frame of `idle` (docs/decisions/2026-10-23-tiger-still.md). His powers (the balloons
 * he blows up on a pump nozzle in the boss bar, and his burning hoops) and his animations come later. He isn't in `CHARACTERS`,
 * `BOSS_KITS` or the roster, and nothing in the game draws him; the preview draws him with its `extra=` option
 * (`npm run preview:characters -- <dir> extra=packages/app/src/characters/tiger.ts only=tiger`).
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
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part } from "./sprite.ts";

export const TIGER_PALETTE: Record<string, string> = {
  k: "#1f1210", // outline
  a: "#6e2c0c", // his orange: deep shadow to highlight
  b: "#a24512",
  c: "#d06a18",
  d: "#e8892a",
  e: "#f5ad55",
  f: "#a98d6e", // the cream of his chest, belly, muzzle and cheeks: shadow to highlight
  g: "#d3b996",
  h: "#ecd9b6",
  i: "#fbf1da",
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
  E: "#8f0f22", // a balloon's colors, three each: dark, round, light (the king's red)
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
const OY = 4;
const W = OX + 64 + 6;
const H = OY + GROUND + 4;
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

// ---- His head: the skull and muzzle (one part), the jaw, the ears, the eyes, the whiskers; the hat on top.

/** The head's outline in scene pixels, clockwise from the nose's tip: the muzzle at our left, the cheek ruff at the back, the jaw's line under. */
const HEAD_AT: Pt = [11, 32];
const local = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [x + HEAD_AT[0], y + HEAD_AT[1]]);
const HEAD_POLY = local([[1.2, 9.6], [0.6, 8], [1.4, 6.6], [3.8, 5.8], [6, 4.6], [8.2, 3], [10.8, 1.4], [14.2, 0.6], [17.6, 1], [20.2, 3], [21.4, 6], [21.6, 9.4], [20.6, 12], [21.6, 14.8], [18.6, 14], [18.2, 16.6], [15.2, 15.2], [13.8, 17], [11.6, 14.6], [9.4, 12.8], [5.6, 11.8], [2.8, 11.2]]);
const HEAD_INSIDE = inPoly(HEAD_POLY);
/** Where the jaw hinges (under his cheek), and the closed jaw's outline. */
const HINGE: Pt = [HEAD_AT[0] + 11, HEAD_AT[1] + 13.2];
const JAW_POLY = local([[2, 10.6], [5.6, 11.6], [9.4, 12.6], [11.8, 13.4], [10.8, 15.4], [7, 15.8], [3.4, 14.2], [1.6, 12.4]]);
/** Where the eyes go (their top left in scene pixels) and the ears (their middles). */
const EYE_N: Pt = [HEAD_AT[0] + 13, HEAD_AT[1] + 6];
const EYE_F: Pt = [HEAD_AT[0] + 6, HEAD_AT[1] + 5];
const EAR_N: Pt = [HEAD_AT[0] + 19.4, HEAD_AT[1] + 2.4];
const EAR_F: Pt = [HEAD_AT[0] + 4.4, HEAD_AT[1] + 3];

/** The skull and the muzzle: orange crown and brow, a cream muzzle and a cream cheek ruff with dark stripes, the nose, the cheek's bars. */
function head(): { part: Part; at: Pt } {
  const [hx, hy] = HEAD_AT;
  const light = (x: number, y: number) => 0.62 - 0.36 * ((x - (hx + 10)) / 11) - 0.5 * ((y - (hy + 7)) / 9);
  const bar = (pts: readonly Pt[], r: readonly number[] = [0.75, 0.65, 0.35]) => taper(pts.map(([x, y]): Pt => [hx + x, hy + y]), r);
  const marks = union(
    // The brow's bars, running down from under his hat.
    bar([[7.4, 3.4], [7.8, 4.4], [8, 5.2]], [0.6, 0.55, 0.3]),
    bar([[10.2, 1.6], [10.6, 3], [10.6, 4]], [0.6, 0.55, 0.3]),
    bar([[17.8, 1.6], [17.4, 3], [17, 4.2]], [0.6, 0.55, 0.3]),
    // Out from his eye, across his cheek.
    bar([[17.6, 6.8], [19.4, 7.2], [21.8, 7.4]], [0.6, 0.6, 0.35]),
    // Under the eye: a line down his cheek.
    bar([[14.8, 9.4], [14.8, 11], [14.2, 12.4]], [0.6, 0.6, 0.35]),
    // The ruff's stripes, pointing in from the back of his cheek.
    bar([[21.8, 9.6], [19.2, 10.2], [16.8, 11.4]], [0.8, 0.7, 0.35]),
    bar([[21.6, 12.8], [19.2, 12.8], [17, 13.4]], [0.7, 0.6, 0.3]),
  );
  return painted(hx - 1, hy - 1, 24, 20, (F, S) => {
    F(HEAD_INSIDE, (x, y) => {
      const lx = x + 0.5 - hx;
      const ly = y + 0.5 - hy;
      const l = light(x, y);
      if (marks(x, y)) return "s";
      // Cream: the muzzle, the cheeks under his eyes and the whole ruff. Orange: the crown, the brow and the bridge between his eyes.
      const cream = ly > 8.6 + 0.4 * Math.sin(lx * 0.9) || (lx > 10.4 && ly > 8) || lx > 19.2;
      return cream ? ramp(CREAM, l + 0.2) : ramp(ORANGE, l + 0.14);
    });
    // His nose: pink at the muzzle's tip with a dark line under it; and the spots on his muzzle where the whiskers grow.
    S([".nn.", "nnnn", ".oo."], hx + 0.8, hy + 6.8);
    for (const [x, y] of [[4, 9], [6, 9], [5, 10.4]] as Pt[]) S(["s"], hx + x, hy + y);
  });
}

/** His lower jaw, hinged at `HINGE`, `open` degrees down: cream. */
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
      return ramp(CREAM, 0.72 - 0.25 * ((ly - 11) / 4) - 0.15 * ((x - HEAD_AT[0]) / 11));
    }),
  );
}

/** An ear (`cx`, `cy` its middle), `tilt` pixels leaning: orange outside, a cream inner ear. */
function ear(cx: number, cy: number, tilt: number, far = false): { part: Part; at: Pt } {
  return painted(Math.floor(cx) - 4, Math.floor(cy) - 4, 9, 9, (F) => {
    const lean = (y: number) => (tilt * (cy + 2 - y)) / 4;
    const shape: Inside = (x, y) => ((x + 0.5 - cx - lean(y)) / 3.1) ** 2 + ((y + 0.5 - cy) / 3.2) ** 2 <= 1;
    const inner: Inside = (x, y) => ((x + 0.5 - cx - lean(y) + 0.2) / 1.6) ** 2 + ((y + 0.5 - cy - 0.4) / 2) ** 2 <= 1;
    F(shape, (x, y) => (inner(x, y) ? ramp(CREAM, 0.5 + 0.2 * ((cy - y) / 2)) : ramp(ORANGE, (far ? 0.4 : 0.55) - 0.12 * ((x - cx) / 3) - 0.1 * ((y - cy) / 3))));
  });
}

export type Eyes = "open" | "half" | "shut" | "wide";
/** An eye (`x0`, `y0` its top left): amber under a dark lid, with a pupil and a glint; `w` its width (the far eye, seen at an angle, is narrower). */
function eye(x0: number, y0: number, w: number, lid: Eyes): { part: Part; at: Pt } {
  const rows: Record<Eyes, string[]> = {
    open: w >= 4 ? ["ssss", "yxYy", ".yy."] : ["sss", "xYy"],
    half: w >= 4 ? ["ssss", "yxss"] : ["sss", "sxs"],
    shut: w >= 4 ? ["ssss"] : ["sss"],
    wide: w >= 4 ? ["ssss", "yYxy", "yYYy"] : ["sss", "YxY", "yYy"],
  };
  return painted(x0, y0, 5, 5, (_F, S) => S(rows[lid], x0, y0), false);
}

/** His whiskers: a few fine strands out from his muzzle toward his front. */
function whiskers(): { part: Part; at: Pt } {
  return painted(2, 38, 16, 14, (_F, S) => {
    const strand = (pts: readonly Pt[]) => pts.forEach(([x, y]) => S(["W"], x, y));
    strand([[14, 42], [13, 42], [12, 41], [11, 41], [10, 40]]);
    strand([[14, 43], [13, 43], [12, 43], [11, 43], [10, 44]]);
    strand([[14, 44], [13, 44], [12, 45], [11, 45], [10, 46]]);
  }, false);
}

/** His top hat: a black crown with a shine down one side, a red band and a brim, tipped `tilt` degrees (positive: clockwise, its front up). */
function hat(tilt: number): { part: Part; at: Pt } {
  const [cx, cy] = [24.4, 34];
  const th = rad(tilt);
  const [cs, sn] = [Math.cos(th), Math.sin(th)];
  /** A pixel in the hat's own frame: u across it (negative toward his front), v along it (negative up). */
  const lc = (x: number, y: number): Pt => [(x + 0.5 - cx) * cs + (y + 0.5 - cy) * sn, -(x + 0.5 - cx) * sn + (y + 0.5 - cy) * cs];
  const crown: Inside = (x, y) => {
    const [u, v] = lc(x, y);
    return Math.abs(u) <= 3.6 && v >= -6.8 && v <= 0.6;
  };
  const brim: Inside = (x, y) => {
    const [u, v] = lc(x, y);
    return (u / 6) ** 2 + ((v - 0.4) / 1.5) ** 2 <= 1;
  };
  return painted(15, 24, 20, 14, (F) =>
    F(union(crown, brim), (x, y) => {
      const [u, v] = lc(x, y);
      if (!crown(x, y) || v > 0.1) return u < -2.5 ? "3" : u > 3 ? "1" : "2";
      if (v < -6.1) return "3";
      if (v > -3.3 && v < -1.5) return u < -2.4 ? "7" : u > 2.1 ? "5" : "6";
      return u < -2.7 ? "4" : u < -1.1 ? "3" : u > 2.2 ? "1" : "2";
    }),
  );
}

// ---- The balloons: chess pieces, four in his bunch and a rook for later, shiny and round, each a part of its own. Each is drawn as a silhouette (`#` filled, `n` its knot) and
// shaded by rule, as an inflated balloon is lit from the top left: a light rim on its left, a dark one at its right and under it, a round
// light band inside the rim, and `marks` over it (the shine, the king's cross lines, the knight's eye, the bishop's slit).

type Mark = readonly [x: number, y: number, key: "w" | "d" | "l"];
const BALLOONS = {
  king: {
    sil: [
      "....###....",
      "....###....",
      "..#######..",
      "..#######..",
      "....###....",
      "....###....",
      "...#####...",
      "..#######..",
      ".#########.",
      ".#########.",
      "..#######..",
      "...#####...",
      "....###....",
      "....###....",
      "...#####...",
      "..#######..",
      ".#########.",
      "###########",
      "###########",
      ".#########.",
      ".....n.....",
    ],
    marks: [[3, 2, "w"], [3, 3, "w"], [4, 7, "w"], [2, 9, "w"], [3, 16, "w"], [1, 17, "w"]] as Mark[],
  },
  bishop: {
    sil: [
      "...###...",
      "...###...",
      "..#####..",
      "..#####..",
      ".#######.",
      ".#######.",
      ".#######.",
      "..#####..",
      "...###...",
      "..#####..",
      "...###...",
      "...###...",
      "...###...",
      "..#####..",
      ".#######.",
      "#########",
      ".#######.",
      "....n....",
    ],
    marks: [[3, 0, "w"], [3, 4, "w"], [5, 3, "d"], [4, 4, "d"], [3, 5, "d"], [2, 14, "w"], [2, 15, "w"]] as Mark[],
  },
  knight: {
    sil: [
      "......#.#....",
      ".....##.##...",
      "....########.",
      "...##########",
      "...##########",
      "..###########",
      "..###########",
      ".############",
      "#############",
      "#########....",
      ".#########...",
      "...######....",
      "...#######...",
      "..#########..",
      ".###########.",
      "#############",
      ".###########.",
      "......n......",
    ],
    marks: [[6, 2, "w"], [4, 5, "w"], [5, 5, "d"], [5, 6, "d"], [1, 8, "d"], [3, 9, "d"], [4, 9, "d"], [10, 3, "d"], [11, 4, "d"], [10, 5, "d"], [11, 6, "d"], [10, 7, "d"], [11, 8, "d"], [3, 14, "w"], [2, 15, "w"]] as Mark[],
  },
  rook: {
    sil: [
      "###.###.###",
      "###.###.###",
      "###########",
      ".#########.",
      "..#######..",
      "...#####...",
      "...#####...",
      "...#####...",
      "..#######..",
      ".#########.",
      "###########",
      "###########",
      ".#########.",
      ".....n.....",
    ],
    marks: [[1, 0, "w"], [1, 1, "w"], [4, 0, "w"], [4, 1, "w"], [8, 0, "l"], [8, 1, "l"], [4, 5, "w"], [4, 6, "w"], [2, 10, "w"]] as Mark[],
  },
  pawn: {
    sil: [
      "...###...",
      "..#####..",
      "..#####..",
      "..#####..",
      "...###...",
      "..#####..",
      "...###...",
      "...###...",
      "..#####..",
      ".#######.",
      "#########",
      ".#######.",
      "....n....",
    ],
    marks: [[3, 1, "w"], [3, 2, "w"], [3, 5, "w"], [2, 9, "w"], [1, 10, "w"]] as Mark[],
  },
};

/** A silhouette shaded: `d` shade, `b` the balloon, `l` light, `w` shine, `n` knot. */
function shaded(sil: readonly string[], marks: readonly Mark[]): string[] {
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

export type Piece = keyof typeof BALLOONS;
/** Every balloon drawn: the bunch's four and the rook, which isn't in it (it is for the pieces the pump makes). */
export const PIECES = Object.keys(BALLOONS) as readonly Piece[];
/** Each balloon's three keys (dark, round, light) in the palette. */
const BALLOON_KEYS: Record<Piece, string> = { king: "EFG", bishop: "HIN", knight: "OPS", rook: "TUV", pawn: "XZ0" };
/** Where each balloon of his bunch hangs: its top left, and the knot its string is tied at (scene pixels). The rook (drawn for the pump's pieces to come) isn't in the bunch. */
const BALLOON_AT: Partial<Record<Piece, { at: Pt; knot: Pt }>> = {
  king: { at: [12, 2], knot: [17, 22] },
  bishop: { at: [19, 6], knot: [23, 23] },
  knight: { at: [3, 9], knot: [9, 26] },
  pawn: { at: [3, 31], knot: [7, 43] },
};
/** The bunch, back to front. */
const BALLOON_ORDER = ["bishop", "knight", "king", "pawn"] as const satisfies readonly Piece[];

/** One balloon, as a part at `at`. */
export function balloon(piece: Piece, at: Pt): { part: Part; at: Pt } {
  const k = BALLOON_KEYS[piece];
  const keys: Record<string, string> = { d: k[0]!, b: k[1]!, l: k[2]!, w: "w", n: k[0]! };
  return { part: { grid: shaded(BALLOONS[piece].sil, BALLOONS[piece].marks).map((row) => [...row].map((c) => (c === "." ? "." : keys[c]!)).join("")) }, at };
}

/** The strings: from each balloon's knot, swinging out ahead of his muzzle, to one gathering point, and from there down into his fist; the ends hang below it. */
const GATHER: Pt = [8, 45.5];
/** Where his raised paw is (its middle), holding the strings. */
const FIST: Pt = [11, 51];
function strings(knots: readonly Pt[], fist: Pt): { part: Part; at: Pt } {
  const cv = canvas(34, 50);
  const [x0, y0] = [0, 20];
  const draw = (a: Pt, b: Pt, k: string) => {
    const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 2);
    for (let i = 0; i <= n; i++) {
      const x = Math.floor(a[0] + ((b[0] - a[0]) * i) / n) - x0;
      const y = Math.floor(a[1] + ((b[1] - a[1]) * i) / n) - y0;
      if (cv[y]?.[x] !== undefined) cv[y]![x] = k;
    }
  };
  const top: Pt = [fist[0] - 0.5, fist[1] - 3];
  // Each string hangs in a curve: down and out toward his front first, then down to the gathering point.
  for (const k of knots) {
    const c: Pt = [GATHER[0] + 3, k[1] + 5];
    let prev = k;
    for (let i = 1; i <= 14; i++) {
      const q = bez(k, c, GATHER, i / 14);
      draw(prev, q, "8");
      prev = q;
    }
  }
  draw(GATHER, top, "9");
  draw(GATHER, [top[0] + 1, top[1]], "8");
  // The loose ends under his fist.
  draw([fist[0] - 1, fist[1] + 3], [fist[0] - 2, fist[1] + 7], "8");
  draw([fist[0] + 1, fist[1] + 3], [fist[0] + 2, fist[1] + 8], "9");
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

// ---- Parts and the pose.

const { parts: PARTS, add } = lazyParts();
add("shadow", () => shadow(46));

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
  /** His head (skull, jaw, ears, eyes, whiskers and the hat on it) moved from where it stands: a nod, a lean (negative x: to our left). */
  head?: Pt;
  /** The jaw: degrees open (0 closed, about 30 a great yawn or a roar). */
  jaw?: number;
  /** The ears' lean, in pixels at the tips (negative: toward his front), and the eyes. */
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
  /** Each balloon of the bunch moved from where it hangs (a bob, or handed over: out of the bunch with `gone`). */
  balloons?: Partial<Record<Piece, Pt>>;
  gone?: readonly Piece[];
  /** The feet's lift (a step): near hind, far hind, far front. */
  stepHN?: number;
  stepHF?: number;
  stepFF?: number;
}

const REST = {
  bob: 0,
  head: [0, 0] as Pt,
  jaw: 0,
  earN: 0,
  earF: 0,
  eyes: "open" as Eyes,
  hat: [0, 0] as Pt,
  hatTilt: -7,
  tail: 0,
  paw: FIST,
  balloons: {} as Partial<Record<Piece, Pt>>,
  gone: [] as readonly Piece[],
  stepHN: 0,
  stepHF: 0,
  stepFF: 0,
};

/** The raised arm's bones: shoulder to elbow, elbow to wrist; and where the wrist is from the paw's middle. */
const SHOULDER: Pt = [27, 49.8];
const BONES: Pt = [10.6, 8.2];
const WRIST_FROM_PAW: Pt = [2.4, 2.6];

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
  const at = (pl: Placed, dx = 0, dy = 0): Layer => ({ part: pl.name, x: OX + pl.at[0] + dx, y: OY + pl.at[1] + dy });
  /** A part of his head: it moves with it. */
  const H = (pl: Placed) => at(pl, Math.round(p.head[0]), b + Math.round(p.head[1]));
  const paw: Pt = up(p.paw, b);
  const wrist: Pt = [paw[0] + WRIST_FROM_PAW[0], paw[1] + WRIST_FROM_PAW[1]];
  const shoulder = up(SHOULDER, b);
  const elbow = elbowOf(shoulder, wrist, BONES);
  const bunch = BALLOON_ORDER.filter((n) => !p.gone.includes(n));
  const offset = (n: Piece): Pt => [Math.round(p.balloons[n]?.[0] ?? 0), b + Math.round(p.balloons[n]?.[1] ?? 0)];
  // (A leg's top joints sink with the body; its foot and the lower joints lift with the step.)
  const hindFar = (): Pt[] => [[39.4, 52.6 + b], [36.2, 59 + b / 2 - p.stepHF / 2], [39.4, 64 - p.stepHF], [38, 67.2 - p.stepHF]];
  const hindNear = (): Pt[] => [[44.6, 51.8 + b], [41.2, 59 + b / 2 - p.stepHN / 2], [45.6, 64 - p.stepHN], [44.2, 67.2 - p.stepHN]];
  const frontFar = (): Pt[] => [[27, 50.2 + b], [26.4, 58 + b / 2 - p.stepFF / 2], [25.4, 64.2 - p.stepFF]];
  return [
    { part: "shadow", x: OX + 12, y: OY + GROUND - 3 },
    at(placed(`tail:${r2(p.tail)}:${b}`, () => tail(p.tail, b))),
    at(placed(`legHF:${key(hindFar())}`, () => leg(hindFar(), [4.4, 3.4, 2.3, 2.7], [38, 67.2 - p.stepHF, 5, 2.6], [6, 10], 0.2))),
    at(placed(`legFF:${key(frontFar())}`, () => leg(frontFar(), [4.4, 3.3, 3], [24.6, 67.2 - p.stepFF, 5.4, 2.7], [6, 10.5], 0.2))),
    at(placed("torso", torso), 0, b),
    at(placed("vest", vest), 0, b),
    at(
      placed(`legHN:${key(hindNear())}`, () =>
        leg(hindNear(), [5.4, 3.9, 2.6, 3], [44.2, 67.2 - p.stepHN, 5.4, 2.7], [9.4, 13], 0, [[[46.6, 46 + b], [44.4, 50 + b], [43.2, 54 + b]], [[49.2, 48.2 + b], [46.8, 52 + b], [45.4, 56 + b]], [[42.4, 47 + b], [40.4, 50.6 + b], [39.6, 54 + b]]]),
      ),
    ),
    at(placed(`strings:${bunch.join()}:${key([paw, ...bunch.map(offset)])}`, () => strings(bunch.map((n) => [BALLOON_AT[n]!.knot[0] + offset(n)[0], BALLOON_AT[n]!.knot[1] + offset(n)[1]] as Pt), paw))),
    H(placed(`earF:${p.earF}`, () => ear(EAR_F[0], EAR_F[1], p.earF, true))),
    H(placed(`earN:${p.earN}`, () => ear(EAR_N[0], EAR_N[1], p.earN))),
    H(placed(`jaw:${p.jaw}`, () => jaw(p.jaw))),
    H(placed("head", head)),
    H(placed(`eyeF:${p.eyes}`, () => eye(EYE_F[0], EYE_F[1], 3, p.eyes))),
    H(placed(`eyeN:${p.eyes}`, () => eye(EYE_N[0], EYE_N[1], 4, p.eyes))),
    H(placed("whiskers", whiskers)),
    at(placed(`hat:${p.hatTilt}`, () => hat(p.hatTilt)), Math.round(p.head[0] + p.hat[0]), b + Math.round(p.head[1] + p.hat[1])),
    ...bunch.map((n) => at(placed(`balloon:${n}`, () => balloon(n, BALLOON_AT[n]!.at)), offset(n)[0], offset(n)[1])),
    at(placed(`legFN:${key([shoulder, elbow, wrist, paw])}`, () => leg([shoulder, elbow, wrist], [5, 3.8, 3], [paw[0], paw[1], 3.7, 3.4, true], [4.5, 8.5, 12.5]))),
  ];
}

const idle: Anim = { loop: true, frames: [{ ms: 1000, layers: tigerLayers() } as Frame] };

export const TIGER: Character = {
  id: "tiger",
  name: "Tiger",
  w: W,
  h: H,
  foot: [OX + FOOT_X, OY + GROUND],
  palette: TIGER_PALETTE,
  halo: "#3a2a22",
  parts: PARTS,
  anims: { idle },
};

/** The part of him a portrait shows (his head, ears and hat, a bit of his shoulders and vest collar), in frame pixels. */
export const TIGER_PORTRAIT = { x: OX + 12, y: OY + 26, w: 29, h: 25 } as const;
