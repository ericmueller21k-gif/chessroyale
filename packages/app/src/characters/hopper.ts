/**
 * Chub & Chirp (`hopper` in code): Chub, a brown rabbit, riding Chirp, a grasshopper, two friends drawn as one figure
 * (Eric, Oct 18: "a cute rabbit and grasshopper, they are friends. Just one sprite"). After Eric's simple reference
 * for the shapes: the rabbit, cream chest and cotton tail, sits up on the grasshopper's back holding
 * brown reins tied to a gold ring at its cheek; the grasshopper has a big black eye, long antennae and jointed legs.
 * From his detailed reference, flavor only: the rabbit's green scarf blowing back (a gold clasp) and a small brown
 * satchel, and a small brown saddle. Drawn side on, facing our left (as Alfil and Sawyer), light from the top left.
 *
 * A still for Eric's review: one pose, `idle` frame 0, and the portrait (both heads). Not in the game yet.
 *
 * Rigging, as the other bosses: the grasshopper's body, wings, thorax and head and the rabbit's body and head are
 * painted once; the legs (all six, from hip, knee and foot), the antennae, the rabbit's ears and arms, the reins and the
 * scarf's tail from their points, so the poses that follow (his hop) are numbers.
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "./paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part } from "./sprite.ts";

export const HOPPER_PALETTE: Record<string, string> = {
  k: "#1b150e", // outline
  a: "#2b5218", // the grasshopper: green, dark to light
  b: "#447a1f",
  c: "#62a02a",
  d: "#86c13a",
  e: "#b3de5f",
  l: "#6b6a1e", // his legs, belly and antennae: yellow-green, dark to light
  m: "#959431",
  n: "#c0bb49",
  o: "#e3da7a",
  x: "#0b0a08", // eyes
  w: "#ffffff", // their glints
  F: "#56392a", // the rabbit's fur, dark to light
  G: "#7b5739",
  H: "#a07a51",
  I: "#c39e70",
  C: "#cbb592", // cream (chest, muzzle, tail, the soles of his feet): shade, mid, light
  D: "#e7d8b8",
  E: "#f8f0de",
  p: "#e6939b", // pink (inside his ears, his nose), its shade
  q: "#b65f6e",
  L: "#3d1a0b", // leather (saddle, reins, satchel), dark to light: redder than his fur, so it stands apart from him
  M: "#682c13",
  N: "#90421f",
  Q: "#b6632f",
  S: "#17492f", // the scarf: a deep blue-green (not the grasshopper's), dark to light
  T: "#22694a",
  U: "#2f8c5f",
  V: "#57b47f",
  Y: "#f2c14e", // gold (the game's), its light, its shade
  y: "#ffe58a",
  O: "#b4840f",
  z: "#0d0e12", // ground shadow
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
/** A pixel's color from its drawing point (x, y) and its scene pixel (X, Y), for patterns kept even in the scene. */
type Key = (x: number, y: number, X: number, Y: number) => string;
const GREEN = "abcde";
const LEGS = "lmno";
const FUR = "FGHI";
const CREAM = "CDE";
const LEATHER = "LMNQ";
const SCARF = "STUV";

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;

/**
 * A scale from a figure's own drawing space into the scene's (the ground at y 66, his feet about x 40; the frame adds
 * OX, OY): scene = o + s * drawing. The grasshopper and the rabbit keep the numbers they were first drawn with, each
 * in a space of their own, and are scaled into the scene (`BUG`, `RIDER`): Eric's edit (Oct 18), the grasshopper
 * smaller and the rabbit bigger.
 */
type Xf = { s: number; ox: number; oy: number };
const ONE: Xf = { s: 1, ox: 0, oy: 0 };
const toScene = (xf: Xf, p: Pt): Pt => [xf.ox + xf.s * p[0], xf.oy + xf.s * p[1]];

/** The ground, and the point between his feet, in the scene. */
const GROUND = 66;
const FOOT_X = 40;
/** The line his toes stand on (the ground's top pixel row is under it). */
const TOES = 64.5;
/** The grasshopper: 0.75 of his first size, scaled about his toes between his feet. */
const BUG: Xf = { s: 0.75, ox: FOOT_X * 0.25, oy: TOES * 0.25 };
/**
 * The rabbit, saddle and all: 1.18 of his first size, the point under his seat (41, 36) on the grasshopper's back
 * (46, 35.6), a little behind his hips, so the bigger rabbit sits clear of the antennae.
 */
const RIDER: Xf = (() => {
  const k = 1.18;
  const [sx, sy] = toScene(BUG, [46, 35.6]);
  return { s: k, ox: sx - 41 * k, oy: sy - 36 * k };
})();
/** A one-pixel line's half width in the grasshopper's drawing space, so it stays one pixel in the scene. */
const LINE = 0.5 / BUG.s;

/**
 * A part painted in a drawing space (`xf` scales it into the scene's): it covers (x0, y0) to (x0 + w, y0 + h) there.
 * `F` fills where `inside` (in drawing space) with `key`'s colors (given the drawing point and the scene pixel); `S`
 * stamps pixel rows (unscaled) at a drawing point.
 */
function painted(
  x0: number,
  y0: number,
  w: number,
  h: number,
  draw: (F: (inside: Inside, key: Key) => void, S: (rows: readonly string[], x: number, y: number) => void) => void,
  xf: Xf = ONE,
): { part: Part; at: Pt } {
  const [fx0, fy0] = toScene(xf, [x0, y0]);
  const [fx1, fy1] = toScene(xf, [x0 + w, y0 + h]);
  const X0 = xf.s === 1 ? fx0 : Math.floor(fx0) - 1;
  const Y0 = xf.s === 1 ? fy0 : Math.floor(fy0) - 1;
  const cw = xf.s === 1 ? w : Math.ceil(fx1) + 1 - X0;
  const ch = xf.s === 1 ? h : Math.ceil(fy1) + 1 - Y0;
  const cv: Canvas = canvas(cw, ch);
  // A scene pixel's point in drawing space (its center maps to the drawing point's center).
  const back = (X: number, Y: number): Pt => [(X + 0.5 - xf.ox) / xf.s - 0.5, (Y + 0.5 - xf.oy) / xf.s - 0.5];
  const F = (inside: Inside, key: Key) => {
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        const [dx, dy] = back(x + X0, y + Y0);
        if (inside(dx, dy)) cv[y]![x] = key(dx, dy, x + X0, y + Y0);
      }
  };
  const S = (rows: readonly string[], sx: number, sy: number) => {
    const [fx, fy] = toScene(xf, [sx, sy]);
    rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        const X = Math.round(fx) + i - X0;
        const Y = Math.round(fy) + j - Y0;
        if (k !== "." && cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
      }),
    );
  };
  draw(F, S);
  return { part: { grid: toGrid(cv) }, at: [X0, Y0] };
}

// ---- Strokes: legs, antennae, ears, arms, reins, painted along a few points and shaded like a cylinder.

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
/** For a pixel near a stroke: how far along it is (0 to 1), its distance across and the normal, the radius there. */
function along(pts: readonly Pt[], r: readonly number[], p: Pt): { s: number; d: number; nx: number; ny: number; rr: number } {
  let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: r[0]! };
  pts.slice(1).forEach((q, i) => {
    const n = nearest(p, pts[i]!, q);
    const rr = r[i]! + (r[i + 1]! - r[i]!) * n.t;
    if (n.d - rr < best.d - best.rr) best = { s: (i + n.t) / (pts.length - 1), d: n.d, nx: n.nx, ny: n.ny, rr };
  });
  return best;
}
/** A cubic curve as points. */
const bezier = (a: Pt, b: Pt, c: Pt, d: Pt, n = 12): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0], u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1]];
  });

/**
 * A stroke through `pts`, `r` its radius at each point; `key` colors a pixel from its light (0 dark to 1 light, lit
 * from the top left across the stroke) and how far along it is.
 */
function strokePart(pts: readonly Pt[], r: readonly number[], key: (light: number, s: number, across: number) => string, lift = 0): { part: Part; at: Pt } {
  const b = boxOf(pts, Math.ceil(Math.max(...r)) + 1);
  return painted(b.x0, b.y0, b.w, b.h, (F) => {
    const at = (x: number, y: number) => along(pts, r, [x + 0.5, y + 0.5]);
    F(
      (x, y) => {
        const s = at(x, y);
        return s.d <= s.rr;
      },
      (x, y) => {
        const s = at(x, y);
        // The signed distance across (toward our upper left, negative), for stripes along a stroke.
        const across = s.rr ? (s.nx + s.ny) / (s.rr * Math.SQRT2) : 0;
        return key(0.6 + lift - 0.45 * (s.nx / s.rr) - 0.5 * (s.ny / s.rr), s.s, across);
      },
    );
  });
}

// ---- The grasshopper. Drawing space: the ground at y 66; he faces our left.

/** His head: round, a big black eye at its front, his face sloping in to the mouth, two little palps under it. */
function hopperHead(): { part: Part; at: Pt } {
  return painted(1, 28, 22, 26, (F, S) => {
    const skull = inEllipse(12.2, 39, 8.4, 8.8);
    const jaw = inPoly([[4.4, 41], [12, 42], [13.4, 50], [8.6, 52], [4.8, 48.8]]);
    const head = (x: number, y: number) => skull(x, y) || jaw(x, y);
    const light = roundLight(9, 33, 12, 14, 0.08);
    F(head, (x, y) => (jaw(x, y) && !skull(x, y) && y >= 47 ? ramp("lmn", light(x, y) + 0.2) : ramp(GREEN, light(x, y))));
    // The mouth: a dark notch, the yellow-green mandible over it.
    S(["mmn", "kmm"], 5, 49);
    // The eye: big and black, a glint at its top left.
    F(inEllipse(9.2, 37, 3.7, 4.3), () => "x");
    S(["ww", "w."], 7, 34);
  }, BUG);
}

/** The shield behind his head (the pronotum): a ridge along its side, lighter below it. */
function pronotum(): { part: Part; at: Pt } {
  return painted(15, 31, 22, 21, (F) => {
    const shield = inPoly([[17, 33], [31, 32], [34.5, 38], [34, 49], [18.5, 50], [20.2, 42]]);
    const light = roundLight(20, 32, 14, 16, 0.05);
    F(shield, (x, y) => {
      const ridge = Math.abs(y - (38.4 + (x - 18) * 0.05)) < LINE && x > 19 && x < 34;
      return ridge ? "b" : ramp(GREEN, light(x, y) + (y > 39 ? 0.12 : 0));
    });
  }, BUG);
}

/** His abdomen: green above, the yellow-green belly below it ringed with segments. */
function abdomen(): { part: Part; at: Pt } {
  return painted(26, 33, 52, 24, (F) => {
    const body = inPoly([[28, 37], [50, 35.5], [66, 38.5], [75.8, 43.4], [70.5, 48.5], [57, 53], [41, 55.2], [30.5, 53.8], [27, 46]]);
    const light = roundLight(40, 38, 30, 17, 0.02);
    F(body, (x, y, X) => {
      const belly = y > 48.4 - (x - 30) * 0.08;
      if (!belly) return ramp(GREEN, light(x, y));
      // A segment line every three pixels (the scene's, so they stay even).
      return X % 3 === 0 ? "m" : ramp("mno", light(x, y) + 0.25);
    });
  }, BUG);
}

/** His wings folded along his back: a long leaf, a vein down its middle and a few slanting back from it. */
function wings(): { part: Part; at: Pt } {
  return painted(28, 32, 51, 16, (F) => {
    const wing = inPoly([[29.5, 35.4], [47, 33.6], [63, 36], [77.6, 42.4], [72, 45.2], [57, 45.4], [42, 46.2], [31, 44.4]]);
    const light = roundLight(40, 33, 34, 12, 0.08);
    const vein = (x: number, y: number) => Math.abs(y - (39.6 + (x - 31) * 0.085)) < LINE;
    // A rib every five pixels (the scene's).
    const ribs = (x: number, y: number, X: number, Y: number) => y < 39.6 + (x - 31) * 0.085 && x > 36 && x < 70 && (X - Y * 1.1 + 200) % 5 < 0.9;
    F(wing, (x, y, X, Y) => (vein(x, y) ? "b" : ribs(x, y, X, Y) ? ramp(GREEN, light(x, y) - 0.2) : ramp(GREEN, light(x, y))));
  }, BUG);
}

/** A thin jointed leg: hip, knee, foot and the foot's last joint lying on the ground. */
const insectLeg = (pts: readonly Pt[], r: readonly number[], far: boolean) =>
  strokePart(pts, r, (l) => ramp(LEGS, l - (far ? 0.3 : 0)));

/**
 * The big hind leg: the drumstick thigh (green, a yellow-green stripe along its underside) from his hip up to the knee
 * over his back, then the thin shin down to the ground and the foot along it.
 */
function hindLeg(hip: Pt, knee: Pt, ankle: Pt, toe: Pt, far: boolean): { part: Part; at: Pt } {
  const thigh = [hip, [hip[0] + (knee[0] - hip[0]) * 0.45, hip[1] + (knee[1] - hip[1]) * 0.45 - 0.6] as Pt, knee];
  const t = strokePart(thigh, [3.5, 2.9, 1.3].map((v) => Math.max(1, v * BUG.s)), (l, _s, across) => (across > 0.35 ? ramp("mn", l) : ramp(GREEN, l - (far ? 0.35 : 0))));
  const shin = strokePart([knee, ankle, toe], [1, 0.9, 0.8], (l) => ramp(LEGS, l - (far ? 0.3 : 0)));
  // One part: the thigh over the shin at the knee.
  const x0 = Math.min(t.at[0], shin.at[0]);
  const y0 = Math.min(t.at[1], shin.at[1]);
  const w = Math.max(t.at[0] + t.part.grid[0]!.length, shin.at[0] + shin.part.grid[0]!.length) - x0;
  const h = Math.max(t.at[1] + t.part.grid.length, shin.at[1] + shin.part.grid.length) - y0;
  return painted(x0, y0, w, h, (_F, S) => {
    S(shin.part.grid, shin.at[0], shin.at[1]);
    S(t.part.grid, t.at[0], t.at[1]);
  });
}

/** An antenna: long and thin, yellow-green. */
const antenna = (pts: readonly Pt[], far: boolean) => strokePart(pts, pts.map((_, i) => (i === 0 ? 0.75 : 0.55)), (l) => ramp("mno", l - (far ? 0.35 : 0)));

/** The gold ring at his cheek, where the reins are tied. */
const RING: Part = { grid: [".yY.", "y..O", "Y..O", ".OO."] };

/**
 * The small saddle: a leather pad over his back under the rabbit, its back edge raised behind the rabbit's tail, a
 * light stitched rim and a gold stud.
 */
function saddle(): { part: Part; at: Pt } {
  return painted(30, 31, 24, 11, (F, S) => {
    const pad = inPoly([[31.6, 35.2], [47, 34], [51.6, 31.8], [52.6, 34.6], [49.4, 38.4], [44, 40.2], [35, 40.6], [31.2, 38.4]]);
    F(pad, (x, y) => (y < 35.6 && x < 49 ? "Q" : ramp(LEATHER, 0.78 - (x - 32) * 0.012 - (y - 35) * 0.12)));
    S(["y", "O"], 35, 36);
  }, RIDER);
}

/** The girth: a strap from the saddle round his belly, lying on him (no outline of its own). */
function girth(): { part: Part; at: Pt } {
  const g = painted(38, 35, 7, 21, (F) => {
    F(inPoly([[39.6, 36], [42.2, 35.8], [44.2, 54.8], [41.8, 55.2]]), (x) => (x < 41.6 ? "N" : "M"));
  }, BUG);
  return { part: { ...g.part, outline: false }, at: g.at };
}

// ---- The rabbit, sitting up on the saddle, facing our left.

/** His head: round and big (a big head reads small), a cream muzzle and cheek, a pink nose, a big dark eye. */
function rabbitHead(): { part: Part; at: Pt } {
  return painted(19, 3, 21, 18, (F, S) => {
    const skull = inEllipse(30.6, 12, 8, 7.2);
    const muzzle = inEllipse(24.4, 14.4, 3.9, 3.2);
    const head = (x: number, y: number) => skull(x, y) || muzzle(x, y);
    const light = roundLight(27, 7, 12, 11, 0.1);
    const cheek = inEllipse(25.2, 16, 5, 3);
    F(head, (x, y) => (cheek(x, y) ? ramp(CREAM, light(x, y) + 0.15) : ramp(FUR, light(x, y))));
    // The eye: big and dark, a glint at its top left; the nose a pink dot at the muzzle's tip.
    S([".xx", "wxx", "xxx", ".x."], 26, 9);
    S(["p", "q"], 20, 13);
 }, RIDER);
}

/** His body: a round sitting back, the big haunch, a cream chest. */
function rabbitBody(): { part: Part; at: Pt } {
  return painted(29, 15, 25, 22, (F) => {
    const torso = inPoly([[32.6, 17.4], [39.6, 16.4], [46, 20], [50.6, 26], [52, 33], [41, 35], [33.6, 32], [31.2, 24]]);
    const haunch = inEllipse(45, 29, 7.5, 6.5);
    const body = (x: number, y: number) => torso(x, y) || haunch(x, y);
    const light = roundLight(38, 19, 14, 15, 0.06);
    const chest = inPoly([[31, 18], [36.6, 18], [37.8, 26], [36.8, 33], [33, 32]]);
    // The haunch's front edge, a shade darker where it turns from the light.
    const thigh = (x: number, y: number) => haunch(x, y) && !inEllipse(45.4, 29.4, 6.6, 5.6)(x, y) && y < 30 && x < 45;
    F(body, (x, y) => (chest(x, y) ? ramp(CREAM, light(x, y) + 0.1) : thigh(x, y) ? "G" : ramp(FUR, light(x, y))));
 }, RIDER);
}

/** His hind foot, long along the saddle, its cream sole to us. */
function rabbitFoot(): { part: Part; at: Pt } {
  return painted(29, 32, 17, 6, (F) => {
    const foot = inPoly([[31, 33.2], [44, 32.8], [44.2, 36.4], [30.4, 36.4]]);
    F(foot, (x, y) => (y >= 35.4 ? "C" : x < 34 ? "D" : ramp(FUR, 0.68 - (x - 34) * 0.03)));
 }, RIDER);
}

/** An ear: long, wide in the middle, rounded at its tip; the near one pink inside. */
const ear = (pts: readonly Pt[], far: boolean) =>
  strokePart(pts, [2, 2.6, 1.4].map((v) => v * RIDER.s), (l, s, across) => (!far && s > 0.14 && s < 0.84 && Math.abs(across) < 0.42 ? (l > 0.55 ? "p" : "q") : ramp(FUR, l - (far ? 0.3 : 0))));

/** An arm, reaching forward to the reins, its paw a lighter knob. */
const arm = (pts: readonly Pt[], far: boolean) => strokePart(pts, [2.2, 1.8, 2].map((v) => v * RIDER.s), (l, s) => (s > 0.8 ? ramp(CREAM, l - (far ? 0.4 : 0)) : ramp(FUR, l - (far ? 0.3 : 0))));

/** His cotton tail. */
function cottonTail(): { part: Part; at: Pt } {
  return painted(49, 27, 9, 9, (F) => {
    const t = inEllipse(53.4, 31, 2.9, 2.8);
    F(t, (x, y) => ramp(CREAM, roundLight(52.4, 29.8, 3.2, 3.2, 0.1)(x, y)));
 }, RIDER);
}

/** The satchel on his hip: a leather bag, its flap darker, a gold buckle. */
function satchel(): { part: Part; at: Pt } {
  return painted(44, 21, 10, 10, (F, S) => {
    const bag = inPoly([[45.4, 22.4], [52.2, 22.2], [52.6, 29.2], [45.8, 29.4]]);
    F(bag, (x, y) => (y < 25 ? ramp(LEATHER, 0.55 - (x - 45) * 0.04) : ramp(LEATHER, 0.85 - (x - 45) * 0.05 - (y - 25) * 0.06)));
    S(["Y", "O"], 48, 24);
 }, RIDER);
}

/** The scarf knotted round his neck, a gold clasp at its front. */
function scarfKnot(): { part: Part; at: Pt } {
  return painted(28, 15, 13, 9, (F, S) => {
    const band = inPoly([[29.6, 17.6], [38.6, 16.4], [39.8, 19.8], [30.2, 22]]);
    F(band, (x, y) => ramp(SCARF, 0.85 - (x - 30) * 0.04 - (y - 16) * 0.1));
    S([".y", "YO"], 30, 18);
 }, RIDER);
}

/**
 * The scarf's tail, blowing back from the knot: a thin band along `pts` (in the scene), tapering from `r0` to a point,
 * lit along its top edge and darker toward its tip, so it reads as cloth in the wind rather than a tube.
 */
function scarfTail(pts: readonly Pt[], r0: number, r1: number): { part: Part; at: Pt } {
  const r = pts.map((_, i) => r0 + ((r1 - r0) * i) / (pts.length - 1));
  return strokePart(pts, r, (l, s) => ramp(SCARF, l + 0.05 - 0.3 * s));
}

/** His shadow on the ground, `w` wide. */
function shadow(w: number): Part {
  const cv = canvas(w, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < w; x++) if (inEllipse(w / 2, 1.5, w / 2, 1.6)(x, y)) cv[y]![x] = "z";
  return { grid: toGrid(cv), outline: false };
}

// ---- Parts and the pose.

const { parts: PARTS, add } = lazyParts();
add("ring", () => RING);

type Placed = { name: string; at: Pt };
const placedAt = new Map<string, Pt>();
/** A part painted at a place of its own (its at), made the first time it's drawn, by a name that says how. */
function placed(name: string, make: () => { part: Part; at: Pt }): Placed {
  let at = placedAt.get(name);
  if (!at) {
    const m = make();
    add(name, () => m.part);
    placedAt.set(name, (at = m.at));
  }
  return { name, at };
}
const r2 = (v: number) => Math.round(v * 2) / 2;
const key = (pts: readonly Pt[]) => pts.map((p) => `${r2(p[0])},${r2(p[1])}`).join(";");

/** Where the scene (the ground at y 66) sits on the frame, and the frame's size (headroom for his hop). */
const OX = 4;
const OY = 14;
const W = OX + 80;
const H = OY + GROUND + 4;

/** A leg's hip, knee, ankle and toe. */
type Leg = readonly [hip: Pt, knee: Pt, ankle: Pt, toe: Pt];

/**
 * A pose. The legs, antennae and the ring are in the grasshopper's drawing space and the ears, paws and scarf in the
 * rabbit's (each scaled into the scene: `BUG`, `RIDER`); `bob`, `air`, `dx`, `ride` and `sag` are scene pixels.
 */
export interface HopperPose {
  /** The grasshopper crouched (his body this many pixels lower, the rabbit with him; negative: stretched up). */
  bob?: number;
  /** Off the ground (a hop): the whole of them this many pixels up; the shadow stays. */
  air?: number;
  /** The whole of them moved sideways. */
  dx?: number;
  /** The rabbit bounced on the saddle (up is negative), on top of the grasshopper's bob. */
  ride?: number;
  /** The legs, near and far: front, middle and hind, each from the hip (which rides his bob) to the toe. */
  frontN?: Leg;
  frontF?: Leg;
  midN?: Leg;
  midF?: Leg;
  hindN?: Leg;
  hindF?: Leg;
  /** The antennae's tips. */
  antN?: Pt;
  antF?: Pt;
  /** The rabbit's ears' tips (the near one and the far one), which ride his head. */
  earN?: Pt;
  earF?: Pt;
  /** His paws on the reins (the near one and the far one). */
  pawN?: Pt;
  pawF?: Pt;
  /** How far the reins sag between his paws and the ring (0: taut). */
  sag?: number;
  /**
   * The scarf's tail: its tip (blowing back), and its wave: how far it rises (negative) and then dips the other way, as
   * cloth in the wind (0: straight). Flutter is these two moving.
   */
  scarfEnd?: Pt;
  billow?: number;
}

/** At rest: standing on all six, the rabbit sitting up, reins in both paws, his scarf out behind him. */
const REST = {
  bob: 0,
  air: 0,
  dx: 0,
  ride: 0,
  frontN: [[21, 49], [15, 56], [14, 63], [10, 64.5]],
  frontF: [[23, 49.5], [19.5, 56.5], [20.5, 63], [17.5, 64.5]],
  midN: [[31, 52], [36.5, 57.5], [34, 63], [30, 64.5]],
  midF: [[33, 52], [40.5, 57], [40.5, 63], [37.5, 64.5]],
  hindN: [[43, 47.5], [64, 33.5], [70, 62], [74.5, 64.5]],
  hindF: [[47, 46.5], [61, 35.5], [62.5, 62], [66.5, 64.5]],
  antN: [-4, 13],
  antF: [1, 9.5],
  earN: [39, -0.5],
  earF: [44, 1],
  pawN: [25.6, 25.6],
  pawF: [24, 24.4],
  sag: 1.5,
  scarfEnd: [61, 19],
  billow: -2.6,
} as const satisfies Required<HopperPose>;

export function hopperLayers(pose: HopperPose = {}): Layer[] {
  const p = { ...REST, ...pose };
  const b = p.bob;
  const rb = b + p.ride;
  const k = RIDER.s;
  const at = (part: string, x: number, y: number): Layer => ({ part, x: OX + x, y: OY + y });
  const L = (l: Placed, dy = b, dx = 0) => at(l.name, l.at[0] + dx, l.at[1] + dy);
  const up = (q: Pt, dy: number): Pt => [q[0], q[1] + dy];
  /** Points of the grasshopper's and the rabbit's, in the scene. */
  const g = (q: Pt, dy = 0): Pt => up(toScene(BUG, q), dy);
  const r = (q: Pt, dy = rb): Pt => up(toScene(RIDER, q), dy);
  /** A leg: its hip rides his bob, its knee half of it, its foot stays on the ground. */
  const legPts = ([hip, knee, ankle, toe]: Leg): Leg => [g(hip, b), g(knee, b / 2), g(ankle), g(toe)];
  const leg = (name: string, l: Leg, rr: readonly number[], far: boolean) => {
    const pts = legPts(l);
    return L(placed(`${name}:${key(pts)}`, () => insectLeg(pts, rr, far)), 0);
  };
  const hind = (name: string, l: Leg, far: boolean) => {
    const [hip, knee, ankle, toe] = legPts(l);
    return L(placed(`${name}:${key([hip, knee, ankle, toe])}`, () => hindLeg(hip, knee, ankle, toe, far)), 0);
  };
  // The antennae, from the top of his head, curving forward: a gentle arc, bowed up and back.
  const antPts = (root: Pt, tip: Pt): Pt[] => {
    const bow = (t: number): Pt => [root[0] + (tip[0] - root[0]) * t + 1.6, root[1] + (tip[1] - root[1]) * t - 1.2];
    return bezier(g(root, b), g(bow(0.33), b * 0.67), g(bow(0.66), b * 0.33), g(tip), 10);
  };
  const antN = antPts([11, 31.5], p.antN);
  const antF = antPts([13.5, 32], p.antF);
  // The rabbit's ears, from the top of his head (they ride his bounce), a little curved.
  const earPts = (root: Pt, tip: Pt): Pt[] => [r(root), r([(root[0] + tip[0]) / 2 - 0.6, (root[1] + tip[1]) / 2]), r(tip)];
  const earN = earPts([33, 6.5], p.earN);
  const earF = earPts([36.5, 6], p.earF);
  // Arms from his shoulders to his paws; the reins from his paws to the ring, sagging between.
  const armN: Pt[] = [r([34, 21]), r([30, 24.6]), r(p.pawN)];
  const armF: Pt[] = [r([32.6, 20.6]), r([28.4, 23.6]), r(p.pawF)];
  const ringAt = g([14.4, 43.6], b).map(Math.round) as unknown as Pt;
  const rein = (paw: Pt): Pt[] => {
    const a = r(paw, rb + 0.5);
    const z: Pt = [ringAt[0] + 1.5, ringAt[1] + 1.5];
    return bezier(a, [a[0] - 2, a[1] + 3 + p.sag], [z[0] + 3, z[1] - 4 + p.sag], z, 24);
  };
  const reinN = rein([p.pawN[0] - 1, p.pawN[1]]);
  const reinF = rein([p.pawF[0] - 1, p.pawF[1]]);
  // The scarf's tail: from the back of his neck to its tip, rising and then dipping (an S, as cloth in the wind),
  // the wave growing toward the tip.
  const neck: Pt = [39.5, 18];
  const sEnd: Pt = p.scarfEnd;
  const len = Math.hypot(sEnd[0] - neck[0], sEnd[1] - neck[1]) || 1;
  const nx = (sEnd[1] - neck[1]) / len;
  const ny = -(sEnd[0] - neck[0]) / len;
  const scarf = Array.from({ length: 17 }, (_, i): Pt => {
    const t = i / 16;
    const w = -p.billow * Math.sin(2 * Math.PI * t) * (0.5 + 0.5 * t);
    return r([neck[0] + (sEnd[0] - neck[0]) * t + nx * w, neck[1] + (sEnd[1] - neck[1]) * t + ny * w]);
  });
  const sw = Math.max(26, 42 - 2 * p.air);
  const sh = `shadow:${sw}`;
  add(sh, () => shadow(sw));
  // The reins: one-pixel leather lines with no outline of their own (an outlined one read as a pole).
  const reinPart = (pts: readonly Pt[], c: string): { part: Part; at: Pt } => {
    const bx = boxOf(pts, 0);
    const cv = canvas(bx.w, bx.h);
    for (const [x, y] of pts) cv[Math.floor(y) - bx.y0]![Math.floor(x) - bx.x0] = c;
    return { part: { grid: toGrid(cv), outline: false }, at: [bx.x0, bx.y0] };
  };
  const layers: Layer[] = [
    // Far side first, darker: his far antenna and legs.
    L(placed(`antF:${key(antF)}`, () => antenna(antF, true)), 0),
    hind("hindF", p.hindF, true),
    leg("midF", p.midF, [1.2, 0.9, 0.8, 0.7], true),
    leg("frontF", p.frontF, [1.1, 0.9, 0.8, 0.7], true),
    L(placed("abdomen", abdomen)),
    L(placed("wings", wings)),
    L(placed("pronotum", pronotum)),
    leg("midN", p.midN, [1.3, 1, 0.9, 0.8], false),
    leg("frontN", p.frontN, [1.2, 1, 0.9, 0.8], false),
    L(placed("hopperHead", hopperHead)),
    L(placed(`antN:${key(antN)}`, () => antenna(antN, false)), 0),
    hind("hindN", p.hindN, false),
    L(placed("girth", girth)),
    L(placed("saddle", saddle)),
    // The rabbit: far ear and arm, tail, body, foot, satchel, the scarf's tail over his back, head, near ear, the
    // scarf's knot, near arm.
    L(placed(`earF:${key(earF)}`, () => ear(earF, true)), 0),
    L(placed(`armF:${key(armF)}`, () => arm(armF, true)), 0),
    L(placed("cottonTail", cottonTail), rb),
    L(placed("rabbitBody", rabbitBody), rb),
    L(placed("rabbitFoot", rabbitFoot), rb),
    L(placed("satchel", satchel), rb),
    L(placed(`scarf:${key(scarf)}`, () => scarfTail(scarf, 1.2 * k, 0.4 * k)), 0),
    L(placed("rabbitHead", rabbitHead), rb),
    L(placed(`earN:${key(earN)}`, () => ear(earN, false)), 0),
    L(placed("scarfKnot", scarfKnot), rb),
    at("ring", ringAt[0], ringAt[1]),
    L(placed(`armN:${key(armN)}`, () => arm(armN, false)), 0),
    L(placed(`reinF:${key(reinF)}`, () => reinPart(reinF, "M")), 0),
    L(placed(`reinN:${key(reinN)}`, () => reinPart(reinN, "N")), 0),
  ];
  return [at(sh, Math.round(FOOT_X - sw / 2 + p.dx), GROUND - 2), ...layers.map((l) => ({ ...l, x: l.x + p.dx, y: l.y - p.air }))];
}

const frame = (ms: number, pose: HopperPose = {}): Frame => ({ ms, layers: hopperLayers(pose) });

/** Idle: for now one still (frame 0), for Eric's review; his breathing, blinks and hops come with the animations. */
const idle: Anim = { loop: true, frames: [frame(1000)] };

export const HOPPER: Character = {
  id: "hopper",
  name: "Chub & Chirp",
  w: W,
  h: H,
  foot: [OX + FOOT_X, OY + GROUND],
  palette: HOPPER_PALETTE,
  halo: "#2a2a20",
  parts: PARTS,
  anims: { idle },
};

/** The part of them a portrait shows (the rabbit's head and the grasshopper's), in frame pixels. */
export const HOPPER_PORTRAIT = { x: OX + 4, y: OY - 3, w: 48, h: 60 } as const;
