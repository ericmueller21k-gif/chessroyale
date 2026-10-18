/**
 * Chub & Chirp (`hopper` in code): Chub, a brown rabbit, riding Chirp, a grasshopper, two friends drawn as one figure
 * (Eric, Oct 18: "a cute rabbit and grasshopper, they are friends. Just one sprite"). After Eric's simple reference
 * for the shapes: the rabbit, cream chest and cotton tail, sits up on the grasshopper's back holding
 * brown reins tied to a gold ring at its cheek; the grasshopper has a big black eye, long antennae and jointed legs.
 * From his detailed reference, flavor only: the rabbit's green scarf blowing back (a gold clasp) and a small brown
 * satchel, and a small brown saddle. Drawn side on, facing our left (as Alfil and Sawyer), light from the top left.
 *
 * His animation pack (Oct 18: docs/decisions/2026-10-18-hopper-animations.md): every animation the other bosses have,
 * his Leapfrog hop, his Carrot Patch cast, the carrot race won and lost, and his attack on a king (`HOPPER_ATTACK`:
 * carrots pelted at the king). `idle` frame 1 is the approved still. His board art (the carrots) is in
 * effects/hopper.ts. In the game (Oct 18): his kit (kits.ts), his lines (HOPPER_LINES), his sounds (hopper-sounds.ts)
 * and his powers on the board (components/Hopper.tsx), timed by HOPPER_BEATS (docs/decisions/2026-10-18-hopper-wired.md).
 *
 * Rigging, as the other bosses: the grasshopper's body, wings, thorax and head and the rabbit's body and head are
 * painted once; the legs (all six, from hip, knee and foot), the antennae, the rabbit's ears and arms, the reins, the
 * scarf's tail and a carrot from their points, so his poses are numbers.
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "./paint.ts";
import { KING_ATTACK } from "@chessroyale/chess";
import { moved } from "./attack-frame.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

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
  R: "#e8732a", // a carrot: orange, dark to light (and his leaves are the grasshopper's greens)
  K: "#a8471a",
  J: "#f79a3d",
  P: "#ffc97e",
  j: "#9fd8ff", // sweat
  g: "#4d4538", // dust, dark and light
  h: "#7d705a",
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

/** The grasshopper's big eye: open (the still), shut (a hit, a wince), or glinting with glee. */
export type BugEye = "open" | "shut" | "joy";

/** His head: round, a big black eye at its front, his face sloping in to the mouth, two little palps under it. */
function hopperHead(eye: BugEye = "open"): { part: Part; at: Pt } {
  return painted(1, 28, 22, 26, (F, S) => {
    const skull = inEllipse(12.2, 39, 8.4, 8.8);
    const jaw = inPoly([[4.4, 41], [12, 42], [13.4, 50], [8.6, 52], [4.8, 48.8]]);
    const head = (x: number, y: number) => skull(x, y) || jaw(x, y);
    const light = roundLight(9, 33, 12, 14, 0.08);
    F(head, (x, y) => (jaw(x, y) && !skull(x, y) && y >= 47 ? ramp("lmn", light(x, y) + 0.2) : ramp(GREEN, light(x, y))));
    // The mouth: a dark notch, the yellow-green mandible over it.
    S(["mmn", "kmm"], 5, 49);
    // The eye: big and black, a glint at its top left.
    const ball = inEllipse(9.2, 37, 3.7, 4.3);
    if (eye === "shut") {
      // Shut: the lid (his green) over it, a dark crease across.
      F(ball, (x, y) => (Math.abs(y - 37.6) < 0.7 ? "x" : y < 37.6 ? "c" : "b"));
      return;
    }
    F(ball, () => "x");
    if (eye === "joy") S(["w.", ".w", "w."], 7, 34);
    else S(["ww", "w."], 7, 34);
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
  return merged([shin, t]);
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

/**
 * The rabbit's eye for each mood, stamped at (26, 9) in his drawing space (`at` moves it): `x` dark, `w` its glint, a
 * `.` leaves the fur showing. He faces our left, so his front is the left of each row.
 */
export type Mood = "open" | "blink" | "joy" | "shut" | "wide" | "smug" | "up" | "aim" | "out" | "sad";
const RABBIT_EYES: Record<Mood, { rows: readonly string[]; at?: Pt }> = {
  // The still: big and dark, a glint at its top left.
  open: { rows: [".xx", "wxx", "xxx", ".x."] },
  blink: { rows: ["...", "...", "xxx", ".x."] },
  // Happy: shut in an arc (a capture, a cheer).
  joy: { rows: [".x.", "x.x"], at: [26, 10] },
  // Squeezed shut (a hit).
  shut: { rows: ["x..", ".xx", "x.."], at: [26, 10] },
  // Rattled: the white showing round a small pupil.
  wide: { rows: [".xx.", "xwwx", "xwxx", "xwwx", ".xx."], at: [25, 8] },
  // Smug: the lid down over the top of it.
  smug: { rows: ["xxx", "wxx", ".x."], at: [26, 10] },
  // Thinking: looking up, the glint at its top.
  up: { rows: [".wx", "xxx", "xxx", ".x."] },
  // Looking forward and down at a target (the God King, the square), a brow set over it.
  aim: { rows: ["..xx", "xx..", ".xxx", "xxxw", "xxww", ".xx."], at: [25, 7] },
  // Beaten: shut and drooping.
  out: { rows: ["...", "xx.", "..x"], at: [26, 10] },
  // Sad (the race lost): looking down, a brow up over it.
  sad: { rows: ["xx..", "..x.", ".xx.", "xxx.", "xwx.", ".x.."], at: [25, 7] },
};

/** His head: round and big (a big head reads small), a cream muzzle and cheek, a pink nose, a big dark eye. */
function rabbitHead(mood: Mood = "open"): { part: Part; at: Pt } {
  return painted(19, 3, 21, 18, (F, S) => {
    const skull = inEllipse(30.6, 12, 8, 7.2);
    const muzzle = inEllipse(24.4, 14.4, 3.9, 3.2);
    const head = (x: number, y: number) => skull(x, y) || muzzle(x, y);
    const light = roundLight(27, 7, 12, 11, 0.1);
    const cheek = inEllipse(25.2, 16, 5, 3);
    F(head, (x, y) => (cheek(x, y) ? ramp(CREAM, light(x, y) + 0.15) : ramp(FUR, light(x, y))));
    // The eye: big and dark, a glint at its top left; the nose a pink dot at the muzzle's tip.
    const eye = RABBIT_EYES[mood];
    S(eye.rows, eye.at?.[0] ?? 26, eye.at?.[1] ?? 9);
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

/**
 * A carrot (scene pixels): its body from `top` (its shoulder, where the leaves sprout) tapering to `tip`, ridged across
 * and lit from the top left, and three leaves (the grasshopper's greens) fanning out of its top, away from the tip.
 */
function carrotPart(top: Pt, tip: Pt): { part: Part; at: Pt } {
  const len = Math.hypot(tip[0] - top[0], tip[1] - top[1]) || 1;
  const back = Math.atan2(top[1] - tip[1], top[0] - tip[0]);
  const body = strokePart([top, [top[0] + (tip[0] - top[0]) * 0.45, top[1] + (tip[1] - top[1]) * 0.45], tip], [1.6, 1.25, 0.45], (l, s) =>
    Math.round(s * len) % 3 === 2 && l < 0.85 ? "K" : ramp("KRJP", l + 0.05),
  );
  const leaves = [-0.55, 0, 0.55].map((turn, i) => {
    const a = back + turn;
    const l = i === 1 ? 4.6 : 3.6;
    return strokePart([top, [top[0] + Math.cos(a) * l * 0.5, top[1] + Math.sin(a) * l * 0.5], [top[0] + Math.cos(a) * l, top[1] + Math.sin(a) * l]], [0.75, 0.7, 0.5], (lt) => ramp("bcd", lt + (i === 1 ? 0.1 : -0.05)));
  });
  return merged([...leaves, body]);
}

/** Parts painted in the same space, as one part: each over the ones before it. */
function merged(ps: readonly { part: Part; at: Pt }[]): { part: Part; at: Pt } {
  const x0 = Math.min(...ps.map((q) => q.at[0]));
  const y0 = Math.min(...ps.map((q) => q.at[1]));
  const w = Math.max(...ps.map((q) => q.at[0] + q.part.grid[0]!.length)) - x0;
  const h = Math.max(...ps.map((q) => q.at[1] + q.part.grid.length)) - y0;
  return painted(x0, y0, w, h, (_F, S) => ps.forEach((q) => S(q.part.grid, q.at[0], q.at[1])));
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
  /** The rabbit's eye, and the grasshopper's. */
  mood?: Mood;
  bugEye?: BugEye;
  /** The rabbit's head (and his ears with it) nodded down this many pixels (scene), and leaning sideways. */
  nod?: number;
  lean?: number;
  /** His near elbow (the rabbit's space); left out, it bends by itself between his shoulder and paw. */
  elbowN?: Pt;
  /**
   * A carrot in his near paw: pointing `deg` from it (0 down, 90 to our left, 180 up, 270 to our right), held near its
   * top (its shoulder and leaves showing past his paw) or by its tip (`byTip`: the leaves out at the far end, held up
   * to show).
   */
  carrot?: { deg: number; byTip?: boolean } | null;
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
  mood: "open",
  bugEye: "open",
  nod: 0,
  lean: 0,
  elbowN: [30, 24.6],
  carrot: null,
} as const satisfies Required<HopperPose>;

/** Where a point of the rabbit's (his drawing space) is in the scene. */
const riderPt = (q: Pt): Pt => toScene(RIDER, q);
/** His near shoulder (the rabbit's space). */
const SHOULDER_N: Pt = [34, 21];

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
  /** A point on the rabbit's head (it nods and leans). */
  const hd = (q: Pt): Pt => {
    const [x, y] = r(q);
    return [x + p.lean, y + p.nod];
  };
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
  // The rabbit's ears, from the top of his head (they ride his bounce and his nod), a little curved.
  const earPts = (root: Pt, tip: Pt): Pt[] => [hd(root), hd([(root[0] + tip[0]) / 2 - 0.6, (root[1] + tip[1]) / 2]), hd(tip)];
  const earN = earPts([33, 6.5], p.earN);
  const earF = earPts([36.5, 6], p.earF);
  // Arms from his shoulders to his paws; the reins from his paws to the ring, sagging between. The near elbow, unless
  // given, bends down between his shoulder and paw (straight when he reaches far).
  const elbowN: Pt =
    pose.elbowN ??
    (pose.pawN
      ? (() => {
          const [sx, sy] = SHOULDER_N;
          const [px, py] = p.pawN;
          const d = Math.hypot(px - sx, py - sy) || 1;
          const bend = Math.sqrt(Math.max(0, 5.5 ** 2 - (d / 2) ** 2));
          let nx = -(py - sy) / d;
          let ny = (px - sx) / d;
          if (ny < 0) [nx, ny] = [-nx, -ny];
          return [(sx + px) / 2 + nx * bend, (sy + py) / 2 + ny * bend];
        })()
      : REST.elbowN);
  const armN: Pt[] = [r(SHOULDER_N), r(elbowN), r(p.pawN)];
  const armF: Pt[] = [r([32.6, 20.6]), r([28.4, 23.6]), r(p.pawF)];
  const ringAt = g([14.4, 43.6], b).map(Math.round) as unknown as Pt;
  const rein = (paw: Pt): Pt[] => {
    const a = r(paw, rb + 0.5);
    const z: Pt = [ringAt[0] + 1.5, ringAt[1] + 1.5];
    return bezier(a, [a[0] - 2, a[1] + 3 + p.sag], [z[0] + 3, z[1] - 4 + p.sag], z, 24);
  };
  // His near paw away from the reins (reaching, throwing, cheering): both reins are in his far paw.
  const oneHand = Math.hypot(p.pawN[0] - REST.pawN[0], p.pawN[1] - REST.pawN[1]) > 3;
  const reinN = rein(oneHand ? [p.pawF[0] - 0.5, p.pawF[1] + 0.6] : [p.pawN[0] - 1, p.pawN[1]]);
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
  // A carrot in his near paw.
  const carrot: Layer[] = [];
  if (p.carrot) {
    const a = (p.carrot.deg * Math.PI) / 180;
    const u: Pt = [-Math.sin(a), Math.cos(a)];
    const paw = r(p.pawN);
    const [top, tip]: [Pt, Pt] = p.carrot.byTip
      ? [[paw[0] + u[0] * 9.5, paw[1] + u[1] * 9.5], [paw[0] - u[0] * 0.5, paw[1] - u[1] * 0.5]]
      : [[paw[0] - u[0] * 2.5, paw[1] - u[1] * 2.5], [paw[0] + u[0] * 6.5, paw[1] + u[1] * 6.5]];
    carrot.push(L(placed(`carrot:${key([top, tip])}`, () => carrotPart(top, tip)), 0));
  }
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
    L(placed(`hopperHead:${p.bugEye}`, () => hopperHead(p.bugEye))),
    L(placed(`antN:${key(antN)}`, () => antenna(antN, false)), 0),
    hind("hindN", p.hindN, false),
    L(placed("girth", girth)),
    L(placed("saddle", saddle)),
    // The rabbit: far ear and arm, tail, body, foot, satchel, the scarf's tail over his back, head, near ear, the
    // scarf's knot, a carrot, near arm.
    L(placed(`earF:${key(earF)}`, () => ear(earF, true)), 0),
    L(placed(`armF:${key(armF)}`, () => arm(armF, true)), 0),
    L(placed("cottonTail", cottonTail), rb),
    L(placed("rabbitBody", rabbitBody), rb),
    L(placed("rabbitFoot", rabbitFoot), rb),
    L(placed("satchel", satchel), rb),
    L(placed(`scarf:${key(scarf)}`, () => scarfTail(scarf, 1.2 * k, 0.4 * k)), 0),
    L(placed(`rabbitHead:${p.mood}`, () => rabbitHead(p.mood)), rb + p.nod, p.lean),
    L(placed(`earN:${key(earN)}`, () => ear(earN, false)), 0),
    L(placed("scarfKnot", scarfKnot), rb),
    at("ring", ringAt[0], ringAt[1]),
    ...carrot,
    L(placed(`armN:${key(armN)}`, () => arm(armN, false)), 0),
    L(placed(`reinF:${key(reinF)}`, () => reinPart(reinF, "M")), 0),
    L(placed(`reinN:${key(reinN)}`, () => reinPart(reinN, "N")), 0),
  ];
  return [at(sh, Math.round(FOOT_X - sw / 2 + p.dx), GROUND - 2), ...layers.map((l) => ({ ...l, x: l.x + p.dx, y: l.y - p.air }))];
}

/** A loose carrot (in flight), its middle at `c` on the frame, pointing `deg` (as a held one's). */
function carrotAt(c: Pt, deg: number): Layer {
  const a = (deg * Math.PI) / 180;
  const u: Pt = [-Math.sin(a), Math.cos(a)];
  const top: Pt = [-u[0] * 3.5, -u[1] * 3.5];
  const tip: Pt = [u[0] * 3.5, u[1] * 3.5];
  const pl = placed(`flyCarrot:${key([top, tip])}`, () => carrotPart(top, tip));
  return { part: pl.name, x: Math.round(c[0] + pl.at[0]), y: Math.round(c[1] + pl.at[1]) };
}

const f = (ms: number, pose: HopperPose = {}, extra: Partial<Frame> = {}): Frame => ({ ms, layers: hopperLayers(pose), ...extra });

/** Where a point of the rabbit's (his drawing space) is on the frame, in a pose. */
const riderOnFrame = (q: Pt, p: HopperPose = {}, head = false): Pt => {
  const [x, y] = riderPt(q);
  return [OX + x + (p.dx ?? 0) + (head ? (p.lean ?? 0) : 0), OY + y + (p.bob ?? 0) + (p.ride ?? 0) + (head ? (p.nod ?? 0) : 0) - (p.air ?? 0)];
};

// ---- Things drawn on his frames: dust, sparkles, thoughts, sweat, fur.

/** Dust kicked up either side of his feet (`t` frames after he lands): `n` puffs a side rolling outward and up. */
const dust = (t: number, n = 3, cx = OX + FOOT_X, spread = 36): Speck[] => {
  const out: Speck[] = [];
  for (let side = -1; side <= 1; side += 2)
    for (let i = 0; i < n; i++) {
      const x = Math.round(cx + side * (spread * 0.5 + i * 3.5 + t * (2 + (i % 2))));
      const y = OY + GROUND - 1 - Math.round(t * (0.6 + (i % 3) * 0.5) + (i % 2));
      const cloud: [number, number, string][] = t < 2 ? [[0, 0, "g"], [side, 0, "g"], [0, -1, "h"], [side, -1, "h"]] : [[0, 0, "h"], [side, -1, "g"]];
      for (const [ox, oy, k] of cloud) if (x + ox >= 3 && x + ox <= W - 4) out.push([x + ox, y + oy, k]);
    }
  return out;
};
/** A gold four-point sparkle, white at its heart. */
const sparkle = ([x, y]: Pt, big = false): Speck[] => {
  const X = Math.round(x);
  const Y = Math.round(y);
  return [[X, Y, "w"], [X - 1, Y, "y"], [X + 1, Y, "y"], [X, Y - 1, "y"], [X, Y + 1, "y"], ...(big ? ([[X - 2, Y, "Y"], [X + 2, Y, "Y"], [X, Y - 2, "Y"], [X, Y + 2, "Y"]] as Speck[]) : [])];
};
/** Thoughts: gold dots rising off the rabbit's head, ahead of his ears, one more each beat (the third a spark). */
const thoughts = (n: number): Speck[] =>
  ([[OX + 22, OY - 1], [OX + 18, OY - 5], [OX + 13, OY - 9]] as Pt[]).slice(0, n).flatMap((q, i): Speck[] => (i === 2 ? sparkle(q) : [[q[0], q[1], "Y"], [q[0] + 1, q[1], "O"], [q[0], q[1] - 1, "y"]]));
/** Sweat flying off the rabbit's brow, both ways. */
const sweat = (i: number, p: HopperPose): Speck[] => {
  const t = i % 4;
  const [x, y] = riderOnFrame([24, 6], p, true);
  const [x2, y2] = riderOnFrame([38, 5], p, true);
  return [[Math.round(x - t), Math.round(y + t * 2), "j"], [Math.round(x2 + t), Math.round(y2 + t * 2), "j"]];
};
/** Tufts of fur knocked off the rabbit (`t` frames after a hit). */
const tufts = (t: number, p: HopperPose = {}): Speck[] => {
  const [x, y] = riderOnFrame([38, 18], p);
  return [[-1, -1.2], [1.2, -1.4], [1.6, -0.4], [-1.7, -0.3]].flatMap(([vx, vy], i): Speck[] => {
    const px = Math.round(x + vx! * t * 2.4);
    const py = Math.round(y + vy! * t * 2.4 + 0.5 * t * t);
    return [[px, py, i % 2 ? "H" : "I"], [px + 1, py, "E"]];
  });
};
/** His shadow alone on the ground (he's above the frame, or about to come down), `r` its half-width. */
const groundShadow = (r: number, cx = OX + FOOT_X): Speck[] => {
  const out: Speck[] = [];
  for (let x = -r; x <= r; x++) for (let y = -1; y <= 0; y++) if (Math.abs(x) < r - (y === -1 ? 2 : 0)) out.push([cx + x, OY + GROUND - 1 + y, "z"]);
  return out;
};

/** A hit: both flash pale. */
const FLASH: Record<string, string> = {
  F: "#8d6f5d", G: "#b4917a", H: "#d6b596", I: "#efd6b6", C: "#efe3cc", D: "#fbf4e6", E: "#ffffff",
  a: "#557a3c", b: "#79a457", c: "#9cc76d", d: "#c0e38f", e: "#e4f7bd",
};

// ---- His poses: the grasshopper's legs (his drawing space), the rabbit's ears, paws and scarf (the rabbit's).

/** A leg with its foot (ankle and toe) lowered by `air` scene pixels: it stays on the ground as he lifts. */
const grounded = ([hip, knee, ankle, toe]: Leg, air: number): Leg => [hip, knee, [ankle[0], ankle[1] + air / BUG.s], [toe[0], toe[1] + air / BUG.s]];
const legsAt = (air: number, l: Partial<HopperPose>): HopperPose => {
  const out: HopperPose = {};
  for (const n of ["frontN", "frontF", "midN", "midF", "hindN", "hindF"] as const) out[n] = grounded((l[n] ?? REST[n]) as Leg, air);
  return out;
};
/** Pushing off: the hind legs straightening behind him, the front ones lifting off and reaching forward. */
const LAUNCH: HopperPose = {
  hindN: [[43, 47.5], [58, 43], [71, 60], [77, 64.5]],
  hindF: [[47, 46.5], [57, 44.5], [64, 60], [70, 64.5]],
  midN: [[31, 52], [37, 57.5], [37, 62.5], [34, 64]],
  midF: [[33, 52], [40, 57.5], [41, 62.5], [38, 64]],
  frontN: [[21, 49], [14, 53], [9, 57.5], [5, 58.5]],
  frontF: [[23, 49.5], [17, 54], [13, 58.5], [9, 59.5]],
};
/** In the air: the hind legs stretched out behind, the others reaching forward. */
const FLY: HopperPose = {
  hindN: [[43, 47.5], [59, 42], [75, 53], [80, 56]],
  hindF: [[47, 46.5], [58, 43], [69, 54], [74, 57]],
  midN: [[31, 52], [36, 57], [37, 61.5], [34, 63]],
  midF: [[33, 52], [39, 57], [41, 61.5], [38, 63]],
  frontN: [[21, 49], [13, 52], [8, 56.5], [4, 57]],
  frontF: [[23, 49.5], [16, 53], [12, 57], [8, 58]],
};
/** Coming down: the front legs reaching for the ground ahead, the hind ones folding under. */
const TOUCH: HopperPose = {
  frontN: [[21, 49], [14, 55], [10, 61.5], [6, 64.5]],
  frontF: [[23, 49.5], [18, 55.5], [16, 62], [12, 64.5]],
  midN: [[31, 52], [36, 57], [34, 62], [30, 63.5]],
  midF: [[33, 52], [40, 57], [40, 62], [37, 63.5]],
  hindN: [[43, 47.5], [62, 36], [70, 59], [75, 62]],
  hindF: [[47, 46.5], [60, 38], [63, 59], [67, 62]],
};
/** Reared up on his hind legs and middle ones, his front legs pawing the air. */
const REAR: HopperPose = {
  bob: -3,
  frontN: [[21, 49], [15, 51], [11, 53.5], [8, 52]],
  frontF: [[23, 49.5], [18, 52], [15, 54.5], [12, 53.5]],
};
/** Slumped flat, legs splayed. */
const SPLAY: HopperPose = {
  frontN: [[21, 49], [12, 56], [6, 61.5], [2, 64.5]],
  frontF: [[23, 49.5], [17, 57], [14, 62], [11, 64.5]],
  midN: [[31, 52], [38, 58], [40, 63], [38, 64.5]],
  midF: [[33, 52], [41, 58], [44, 63], [43, 64.5]],
  hindN: [[43, 47.5], [62, 41], [72, 61], [77, 64.5]],
  hindF: [[47, 46.5], [59, 42], [64, 61], [69, 64.5]],
};
/** The rabbit's ears: flopped back in the wind, perked up, drooping, one bent. */
const EARS_BACK: HopperPose = { earN: [48.5, 4], earF: [52, 6.5] };
const EARS_UP: HopperPose = { earN: [36.5, -2], earF: [41.5, -1.5] };
const EARS_DROOP: HopperPose = { earN: [42, 13.5], earF: [45.5, 13.5] };
const EARS_BENT: HopperPose = { earN: [37, -1], earF: [47, 3.5] };
/** The scarf streaming out behind (in the wind of a hop), and hanging limp. */
const STREAM: HopperPose = { scarfEnd: [64, 15], billow: -3.4 };
const LIMP: HopperPose = { scarfEnd: [51, 28], billow: -0.8 };
/** His near paw: in the satchel, behind his head with a carrot, thrown forward, held up high, at his chin. */
const IN_SATCHEL: HopperPose = { pawN: [47, 22.5], elbowN: [41, 17.5], carrot: { deg: 15 } };
const WOUND: HopperPose = { pawN: [37, 5], elbowN: [39.5, 13], carrot: { deg: 188 } };
const THROWN: HopperPose = { pawN: [18, 18.5], elbowN: [26, 21] };
const HELD_UP: HopperPose = { pawN: [29, 3.5], elbowN: [33, 12], carrot: { deg: 180, byTip: true } };
const AT_CHIN: HopperPose = { pawN: [25.5, 19.5], elbowN: [31, 25] };
const POINTING: HopperPose = { pawN: [15.5, 21], elbowN: [25, 22] };

// ---- His animations. Frame counts and timings follow Alfil's and Hollow's.

/** Breathing: [bob] per frame. */
const BREATH = [0, 0, 0, 0, 1, 1, 1, 1] as const;

/**
 * Idle: they breathe (the grasshopper settling a pixel, the rabbit with him), the scarf flutters, the antennae sway,
 * the rabbit's near ear twitches and he blinks; the grasshopper rubs a hind leg (his chirp, silent here). Frame 1 is
 * the approved still.
 */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const sway = [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1, 0, 0, 0][i]!;
    const flutter = [0, 0, 1, 1, 0, 0, -1, -1][i % 8]!;
    const p: HopperPose = {
      bob: BREATH[i % 8]!,
      antN: [-4 + sway, 13 - sway * 0.5],
      antF: [1 + sway, 9.5 - sway * 0.5],
      scarfEnd: [61, 19 + flutter],
      billow: -2.6 - flutter * 0.5,
      mood: i === 13 ? "blink" : "open",
      earN: i === 8 || i === 9 ? [37.5, 0.5] : REST.earN,
      hindF: i === 5 || i === 6 ? [[47, 46.5], [61, 34], [62.5, 62], [66.5, 64.5]] : REST.hindF,
    };
    return f(125, p);
  }),
};

/**
 * Entrance: his shadow spreads, they drop in from above in one long hop and land (a thump, dust), the rabbit bounced on
 * the saddle; then the rabbit tips a wave and the grasshopper chirps.
 */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 100, layers: [], specks: groundShadow(8), cue: "chirp" },
    { ms: 100, layers: [], specks: groundShadow(16) },
    f(70, { air: 14, ...FLY, ...EARS_BACK, ...STREAM, mood: "joy" }),
    f(70, { air: 6, ...TOUCH, ...EARS_BACK, ...STREAM, ...legsAt(2, TOUCH) }),
    f(130, { bob: 3, ride: 1, ...EARS_UP, mood: "shut", bugEye: "shut" }, { cue: "thump", shake: [0, 2], specks: dust(0) }),
    f(110, { bob: 1, ride: -2, ...EARS_BACK }, { specks: dust(1) }),
    f(110, { bob: 0, ride: 0 }, { specks: dust(2) }),
    f(160, { pawN: [27, 7], elbowN: [32, 15], ...EARS_UP, mood: "joy", bugEye: "joy" }, { cue: "squeak" }),
    f(160, { pawN: [24, 8.5], elbowN: [31, 15], ...EARS_UP, mood: "joy", bugEye: "joy", antN: [-5, 11], antF: [0, 8] }, { cue: "chirp" }),
    f(300, {}),
  ],
};

/** Thinking: the rabbit's paw to his chin, his eye rolled up, an ear bent; the grasshopper's antennae tapping; gold dots. */
const thinking: Anim = {
  loop: true,
  frames: [0, 1, 2, 3].flatMap((n) =>
    [0, 1, 2, 3].map((i) =>
      f(130, { ...AT_CHIN, ...EARS_BENT, mood: "up", antN: i % 2 ? [-3, 15] : [-4, 13], antF: i % 2 ? [1, 9.5] : [2, 11], bob: i === 2 ? 1 : 0 }, { specks: thoughts(n) }),
    ),
  ),
};

/** His move: a small hop, the grasshopper crouching and springing, the rabbit bounced, then they settle. */
const move: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 2, ride: 1 }),
    f(90, { air: 2, ...LAUNCH, ...legsAt(2, LAUNCH), ...EARS_BACK }),
    f(110, { air: 5, ...FLY, ...EARS_BACK, ...STREAM, ride: -1 }),
    f(130, { bob: 2, ride: 1, ...TOUCH, ...legsAt(0, TOUCH) }, { cue: "thump", shake: [0, 1], specks: dust(0, 2) }),
    f(120, { bob: 1 }, { specks: dust(1, 2) }),
    f(160, {}),
  ],
};

/** A capture: the rabbit pumps his fist and cheers, the grasshopper bouncing and chirping. */
const capture: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 1, ride: 1 }),
    ...Array.from({ length: 10 }, (_, i) => {
      const p: HopperPose = { mood: "joy", bugEye: "joy", ...EARS_UP, pawN: i % 2 ? [28, 5] : [27, 9], elbowN: [32, 14], air: i % 2 ? 0 : 2, ride: i % 2 ? 0 : -1, antN: i % 2 ? [-5, 11] : [-4, 13], ...(i % 2 ? {} : legsAt(2, {})) };
      return f(85, p, { cue: i === 0 ? "squeak" : i === 4 ? "chirp" : undefined, specks: i < 6 && i % 2 === 0 ? sparkle(riderOnFrame([27, 2], p)) : [] });
    }),
    f(160, { mood: "smug" }),
  ],
};

/** Hurt: a flash, fur flies, both knocked back a step, eyes squeezed shut, ears flung back; then the rabbit glares. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 2, dx: 1, ...EARS_BACK, mood: "shut", bugEye: "shut" }, { cue: "oof", pal: FLASH, shake: [1, 0], specks: tufts(0) }),
    f(80, { bob: 2, dx: 1, ...EARS_BACK, mood: "shut", bugEye: "shut" }, { shake: [-1, 0], specks: tufts(1) }),
    f(90, { bob: 1, dx: 2, ...EARS_BACK, mood: "wide" }, { specks: tufts(2) }),
    f(90, { bob: 1, dx: 1, mood: "wide" }, { specks: tufts(3) }),
    f(110, { mood: "aim", nod: 1 }),
    f(120, { mood: "aim", ...EARS_UP, antN: [-5, 11], antF: [0, 8] }),
    f(160, {}),
  ],
};

/** Check: the grasshopper rears up, the rabbit points ahead (at the king), ears up, his look set; twice. */
const LOOM: HopperPose = { ...REAR, ...POINTING, ...EARS_UP, mood: "aim", antN: [-6, 10], antF: [-1, 7] };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 2, ride: 1 }),
    f(120, LOOM, { cue: "chirp", specks: sparkle(riderOnFrame([13, 20], LOOM)) }),
    f(100, { ...LOOM, ride: 1 }),
    f(100, { ...POINTING, mood: "aim" }),
    f(120, LOOM, { specks: sparkle(riderOnFrame([13, 20], LOOM), true) }),
    f(100, { ...LOOM, ride: 1 }),
    f(150, { mood: "smug" }),
    f(160, { mood: "smug" }),
  ],
};

/** Smug: the rabbit leaning back, heavy-lidded, ears laid back; the grasshopper rubbing a hind leg (a lazy chirp). */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const rub = i % 4 === 1 || i % 4 === 2;
    return f(150, {
      mood: "smug",
      lean: 1,
      earN: [44, 0.5],
      earF: [48, 3],
      hindF: rub ? [[47, 46.5], [61, 33.5], [62.5, 62], [66.5, 64.5]] : REST.hindF,
      scarfEnd: [61, 19 + (i % 4 < 2 ? 0 : 1)],
      antN: [-4 + (i < 4 ? 0 : 1), 13],
    });
  }),
};

/** Rattled: shaking, the rabbit's eye wide and ears stiff, sweat flying; the grasshopper's antennae quivering. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const p: HopperPose = { mood: "wide", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, earN: [37 + (i % 2), -2], earF: [42 - (i % 2), -1.5], antN: [-4 + (i % 2 ? 1 : -1), 13], antF: [1 + (i % 2 ? -1 : 1), 9.5] };
    return f(80, p, { specks: sweat(i, p) });
  }),
};

/**
 * Defeat: a flash; the grasshopper's legs give way and he sinks flat, antennae drooping; the rabbit slumps over the
 * saddle, ears hanging, the scarf limp.
 */
const SLUMP: HopperPose = { bob: 6, ...SPLAY, ...EARS_DROOP, ...LIMP, mood: "out", bugEye: "shut", nod: 2, lean: -1, ride: 1, antN: [-6, 26], antF: [-2, 24], pawN: [26, 28], pawF: [24.5, 27], sag: 3 };
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, dx: 1, ...EARS_BACK, mood: "shut", bugEye: "shut" }, { cue: "oof", pal: FLASH, shake: [1, 0], specks: tufts(0) }),
    f(100, { bob: 2, dx: 2, mood: "wide", ...EARS_UP }, { specks: tufts(1) }),
    f(110, { bob: 4, dx: 1, mood: "wide", ...EARS_BACK, antN: [-5, 18], antF: [-1, 16], ...SPLAY }, { specks: tufts(2) }),
    f(120, { ...SLUMP, bob: 5 }, { cue: "flop", shake: [0, 1], specks: dust(0) }),
    f(140, SLUMP, { specks: dust(1) }),
    f(1000, SLUMP),
  ],
};

/** Victory: the grasshopper hops in place, the rabbit waving a carrot over his head, ears flapping, the scarf streaming. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 2, 5, 6, 5, 2, 0, 0, 0, 0, 0, 0][i]!;
    const up = air > 0;
    const p: HopperPose = {
      ...HELD_UP,
      // (Up in the air, his paw comes down to his ear, so the carrot stays inside the frame.)
      pawN: up ? [28, 8.5] : [29 + (i % 2 ? -1.5 : 0), 3.5 + (i % 2)],
      ...(up ? { elbowN: [32.5, 15] } : {}),
      mood: "joy",
      bugEye: "joy",
      air,
      bob: i === 0 || i === 6 ? 2 : 0,
      ...(up ? { ...FLY, ...EARS_BACK, ...STREAM } : { ...EARS_UP, earN: [36.5 + (i % 2), -2], scarfEnd: [61, 19 + (i % 2)] }),
      ride: i === 6 ? 1 : 0,
    };
    return f(110, p, { cue: i === 2 ? "chirp" : i === 6 ? "thump" : undefined, specks: [...(i === 6 ? dust(0, 2) : i === 7 ? dust(1, 2) : []), ...(i % 3 === 0 ? sparkle(riderOnFrame([p.pawN![0] + 1, p.pawN![1] - 7.5], p)) : [])] });
  }),
};

/**
 * Leapfrog, his passive (the pawn hopping over yours on the board is the board's): the grasshopper crouches back on his
 * haunches, springs (`takeoff`: the pawn leaves its square) in a short arc forward, the rabbit hanging on to the reins,
 * ears flopped back and the scarf streaming, and lands (`land`: the pawn comes down beyond yours), dust; then they
 * step back to their place.
 */
const leapfrog: Anim = {
  loop: false,
  frames: [
    f(120, { bob: 3, dx: 2, ride: 1, mood: "aim", sag: 0.5 }),
    f(90, { bob: 4, dx: 2, ride: 1, mood: "aim", sag: 0, ...EARS_UP }),
    f(60, { air: 3, dx: 0, ...LAUNCH, ...legsAt(3, LAUNCH), ...EARS_BACK, mood: "wide", sag: 0 }, { cue: "takeoff", specks: dust(0, 2, OX + FOOT_X + 6) }),
    f(70, { air: 7, dx: -2, ...FLY, ...EARS_BACK, ...STREAM, mood: "wide", ride: 1, sag: 0 }, { specks: dust(1, 2, OX + FOOT_X + 6) }),
    f(80, { air: 9, dx: -3, ...FLY, ...EARS_BACK, ...STREAM, mood: "joy", ride: -1, sag: 0.5 }),
    f(70, { air: 6, dx: -4, ...FLY, ...EARS_BACK, ...STREAM, mood: "joy", ride: -2 }),
    f(50, { air: 2, dx: -5, ...TOUCH, ...legsAt(2, TOUCH), ...EARS_BACK, scarfEnd: [63, 16], billow: -3, ride: -2 }),
    f(130, { bob: 3, dx: -5, ride: 1, ...EARS_UP, mood: "shut" }, { cue: "land", shake: [0, 1], specks: dust(0, 3, OX + FOOT_X - 5) }),
    f(110, { bob: 1, dx: -3, mood: "joy" }, { specks: dust(1, 3, OX + FOOT_X - 5) }),
    f(140, { dx: -1, mood: "smug" }),
    f(160, { mood: "smug" }),
  ],
};

/**
 * Carrot Patch, his ultimate (the carrots flying to their squares and landing are the board's): the grasshopper bounds
 * in place five times; on each, the rabbit pulls a carrot from his satchel as they come down, winds it up over his head
 * as they rise, and tosses it at the top (`toss1` ... `toss5`: the carrot leaves his paw; the board flies it to its
 * square, carrotFly); each lands on its square 300 ms later (`plant1` ... `plant5`: the board plays carrotPatch's
 * `plant` there), two bounds on, while he keeps tossing. Then they settle, smug.
 */
const bound = (n: number): Frame[] => {
  const crouch: HopperPose = { bob: 3, ride: 1, ...IN_SATCHEL, mood: "aim", ...EARS_UP };
  const rise: HopperPose = { air: 4, ...LAUNCH, ...legsAt(4, LAUNCH), ...WOUND, ...EARS_BACK, ...STREAM, mood: "aim", ride: -1 };
  const top: HopperPose = { air: 6, ...FLY, ...THROWN, ...EARS_BACK, ...STREAM, mood: "joy", bugEye: "joy", ride: -1 };
  // The carrot just out of his paw, on its way (the board flies it from here).
  const [hx, hy] = riderOnFrame([12, 13], top);
  return [
    // (The carrot tossed two bounds ago lands as they come down.)
    f(60, crouch, { cue: n > 2 ? `plant${n - 2}` : undefined, specks: n > 1 ? dust(0, 2) : [] }),
    f(60, rise),
    { ...f(90, top, { cue: `toss${n}`, specks: [[Math.round(hx + 5), Math.round(hy + 2), "P"], [Math.round(hx + 7), Math.round(hy + 3), "J"], [Math.round(hx + 9), Math.round(hy + 3), "R"]] }), layers: [...hopperLayers(top), carrotAt([hx, hy], 120)] },
  ];
};
const carrotPatch: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 2, ride: 1, ...IN_SATCHEL, mood: "aim" }),
    ...[1, 2, 3, 4, 5].flatMap(bound),
    f(100, { bob: 3, ride: 1, ...TOUCH, ...legsAt(0, TOUCH), ...EARS_UP, mood: "joy" }, { cue: "plant4", shake: [0, 1], specks: dust(0, 3) }),
    f(110, { bob: 1, mood: "joy", ...EARS_UP }, { specks: dust(1, 3) }),
    f(130, { mood: "smug" }, { cue: "plant5" }),
  ],
};

/** He wins the carrot race (before the spin): the rabbit holds a carrot high, cheering, the grasshopper bouncing. */
const raceWon: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 2, ride: 1, ...IN_SATCHEL, mood: "joy" }),
    f(90, { ...HELD_UP, pawN: [30, 8], elbowN: [33, 15], mood: "joy", ...EARS_UP }),
    ...Array.from({ length: 6 }, (_, i) => {
      const p: HopperPose = { ...HELD_UP, pawN: [29 - (i % 2), 3.5 + (i % 2)], mood: "joy", bugEye: "joy", ...EARS_UP, bob: i % 2 ? 2 : 0, ride: i % 2 ? 1 : -1 };
      return f(110, p, { cue: i === 0 ? "cheer" : i === 3 ? "chirp" : undefined, specks: i % 2 === 0 ? sparkle(riderOnFrame([29, -6], p), i === 0) : [] });
    }),
    f(160, { ...HELD_UP, mood: "joy" }),
  ],
};

/** He loses the race: the rabbit's ears droop, a sigh, the scarf going limp; the grasshopper's antennae sag. */
const raceLost: Anim = {
  loop: false,
  frames: [
    f(120, { mood: "wide", ...EARS_UP }, { cue: "sigh" }),
    f(140, { mood: "sad", earN: [40, 4], earF: [45, 6], scarfEnd: [58, 22], billow: -2 }),
    f(160, { mood: "sad", nod: 1, earN: [41.5, 10], earF: [45.5, 11], scarfEnd: [55, 25], billow: -1.4, antN: [-5, 18], antF: [0, 15] }),
    f(180, { mood: "sad", nod: 1, bob: 1, ...EARS_DROOP, ...LIMP, antN: [-6, 22], antF: [-1, 20] }),
    f(400, { mood: "out", nod: 1, bob: 1, ...EARS_DROOP, ...LIMP, antN: [-6, 22], antF: [-1, 20] }),
  ],
};

export const HOPPER: Character = {
  id: "hopper",
  name: "Chub & Chirp",
  w: W,
  h: H,
  foot: [OX + FOOT_X, OY + GROUND],
  palette: HOPPER_PALETTE,
  halo: "#2a2a20",
  parts: PARTS,
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, leapfrog, carrotPatch, raceWon, raceLost },
};

/**
 * Their lines (Eric's draft, Oct 18: the `CHC-*` lines, as written): Chub does the talking, Chirp answers in chirps.
 * Each at most 42 characters. How often a moment speaks: HOPPER_CHANCE; a power's moment always has its line. `power`
 * is Leapfrog's hop, `ultimateWarn` the Carrot Patch coming, `ultimate` its cast; the race's own keys: `carrotHis` (he
 * pulls one), `carrotYours` (you do), `spinBig` (his spin on 3 or 4 carrots), `spinSmall` (1 or 2), `spinEmpty` (none)
 * and `carrotsAll` (his fifth: the battle is his).
 */
export const HOPPER_LINES: Partial<Record<import("./boss-beats.ts").Beat, readonly string[]>> = {
  entrance: ["Chub and Chirp, reporting for hops!", "Ready, Chirp? (Chirp!)", "Two friends. One saddle. Big plans."],
  move: ["Hup!", "Easy, Chirp. Easy.", "Nice and springy.", "Hop to it!"],
  capture: ["Nibbled!", "Into the satchel!", "Chirp, look what I got!"],
  hurt: ["Not the ears!", "Chirp! You okay, buddy?", "My scarf!"],
  strike: ["Hop along now!", "Bounced out!"],
  power: ["Leapfrog!", "Pardon us! Coming over!", "Mind your head!", "Up, over, and hello!", "Chirp never walks around."],
  thinking: ["Chirp? …Chirp. Good point.", "Thinking with my ears…"],
  check: ["Check! Thump, thump!", "Check! Chirp says hi!"],
  smug: ["Best team in the meadow!", "High five, Chirp! Er, high six!"],
  rattled: ["Chirp, hop faster!", "Uh-oh. Ears down."],
  victory: ["Victory lap, Chirp!", "Carrots for everyone! Well, us."],
  defeat: ["Chirp… carry me home…", "Out of hops…"],
  ultimateWarn: ["I smell carrots…", "Chirp, start digging."],
  ultimate: ["Carrot Patch! Race you!", "Five carrots. Ready, set, HOP!", "Dinner's planted. Hands off."],
  carrotHis: ["Pulled one!", "Ooh, a big one!", "Count it, Chirp!", "Crunchy! That's ours."],
  carrotYours: ["Those are OUR carrots!", "Carrot thief!", "Put that back!", "Chirp, they took one!"],
  spinBig: ["Come on… come on… YES!", "Look at that haul!"],
  spinSmall: ["A little something. Thanks!", "Small prize. Still a prize."],
  spinEmpty: ["Nothing? Not even a pawn?", "Empty reel. Empty tummy.", "Well, it was fun to spin."],
  carrotsAll: ["Five carrots! That's the game!", "All five! Good game, everyone!"],
  kingAttack: ["Eat your veggies, your majesty!", "Carrots away! And away! And away!", "Open wide, King!"],
};
/** How often each moment speaks (the lines' draft: about 5 moves, 5 captures and 5 lost pieces a game have a line). */
export const HOPPER_CHANCE: Partial<Record<import("./boss-beats.ts").Beat, number>> = {
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
  kingAttack: 1,
};

/** The part of them a portrait shows (the rabbit's head and the grasshopper's), in frame pixels. */
export const HOPPER_PORTRAIT = { x: OX + 4, y: OY - 3, w: 48, h: 60 } as const;

// ---- His attack on a king (for his kit's `kingAttack` once he's wired in: perSquare 36, stand 1.8, facesLeft).

/** Room ahead of him (to our left, where he faces) for the carrots' flight to the king, and headroom to drop in from. */
const ATTACK_REACH = 34;
const ATTACK_TOP = 18;
const AW = W + ATTACK_REACH;
const AH = H + ATTACK_TOP;
/** Where each carrot reaches the king (frame pixels): at his head, or a little lower, in turn, past his square's middle. */
const STAND = 1.8 * 36;
const KING_X = OX + FOOT_X + ATTACK_REACH - STAND - 4;
const kingY = (i: number) => OY + GROUND + ATTACK_TOP - 1 - (i % 2 ? 21 : 27);
/** A frame of his in the attack's bigger frame. */
const fa = (fr: Frame): Frame => moved(fr, ATTACK_REACH, ATTACK_TOP, AW, AH);
const landShadow = (r: number): Speck[] => groundShadow(r, OX + FOOT_X + ATTACK_REACH).map(([x, y, k]): Speck => [x, y + ATTACK_TOP, k]);

/** A carrot's flight from his paw to the king (attack frame pixels): a short lob, the point `t` (0 to 1) along it. */
function lob(from: Pt, i: number, t: number): Pt {
  const to: Pt = [KING_X, kingY(i)];
  const c: Pt = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - 8];
  return [(1 - t) ** 2 * from[0] + 2 * (1 - t) * t * c[0] + t * t * to[0], (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * c[1] + t * t * to[1]];
}
/** Speed lines behind the carrot, from his paw, brighter toward it. */
function trail(from: Pt, i: number): Speck[] {
  const out: Speck[] = [];
  for (let n = 4; n <= 22; n++) {
    const t = n / 30;
    if (t < 0.45 && n % 2) continue;
    const [x, y] = lob(from, i, t);
    out.push([Math.round(x), Math.round(y), t > 0.55 ? "w" : t > 0.35 ? "P" : "J"]);
  }
  return out;
}

/**
 * A throw: the grasshopper braced, the rabbit's arm flung out at the king, his eye on the king (forward and down, his
 * head nodded toward him), the carrot just reaching the king at the end of a lob of speed lines (the board bonks it on
 * his square).
 */
const throwAt = (i: number): Frame => {
  const p: HopperPose = { ...THROWN, mood: "aim", nod: 2, lean: -1, ...EARS_UP, bob: 1, ride: i % 2 ? 0 : 1, earN: [36 + (i % 2), -2], antN: [-5, 13], antF: [0, 9.5] };
  const fr = fa(f(90, p, { cue: i % 2 ? "bonk" : "toss", shake: [i % 2 ? -1 : 1, 0] }));
  const [hx, hy] = riderOnFrame(THROWN.pawN!, p).map((v, j) => v + (j ? ATTACK_TOP : ATTACK_REACH)) as unknown as Pt;
  const [cx, cy] = lob([hx, hy], i, 0.86);
  return { ...fr, specks: [...(fr.specks ?? []), ...trail([hx, hy], i)], layers: [...fr.layers, carrotAt([cx, cy], 70 + (i % 3) * 25)] };
};
/** Between throws: his paw back in the satchel for the next carrot, his eye still on the king. */
const reload = (i: number): Frame => fa(f(80, { ...IN_SATCHEL, mood: "aim", nod: 2, lean: -1, ...EARS_UP, earN: [36.5, -2 + (i % 2)], ride: 0, bob: 0, antN: [-4, 13], antF: [1, 9.5] }));

/**
 * His attack on a king, the king to our left (where he faces; the board mirrors him when it's to his right), on the
 * shared beats (KING_ATTACK, boss-timing.ts): his shadow spreads, the grasshopper drops in from above in a long hop
 * and lands (`land`); the rabbit's paw goes to the satchel, then he pelts the king nonstop: ten carrots, one on each hit
 * (cues `toss` and `bonk` in turn, so the repeats don't pile up), each landing on the king's head (the board's carrot
 * bonk), his eye on the king throughout; he cheers, a carrot held up, and they hop off. The last frame is empty.
 */
const kingAttack: Anim = (() => {
  const A = KING_ATTACK;
  const frames: Frame[] = [
    { ms: 100, layers: [], specks: landShadow(8) },
    { ms: 100, layers: [], specks: landShadow(16) },
    fa(f(80, { air: 24, ...FLY, ...EARS_BACK, ...STREAM, mood: "joy" }, { cue: "hop" })),
    fa(f(80, { air: 9, ...TOUCH, ...EARS_BACK, ...STREAM, mood: "aim" })),
    fa(f(A.landAt - 360, { bob: 3, ride: 1, ...EARS_UP, mood: "aim", nod: 1 }, { cue: "land", shake: [0, 1], specks: dust(0) })),
    fa(f(A.lashAt - A.landAt, { ...IN_SATCHEL, mood: "aim", nod: 1, ...EARS_UP }, { specks: dust(1) })),
  ];
  for (let i = 0; i < A.lashes; i++) frames.push(throwAt(i), reload(i));
  const cheer = A.leaveAt - (A.lashAt + A.lashes * A.lashEveryMs);
  frames.push(fa(f(cheer, { ...HELD_UP, mood: "joy", bugEye: "joy", ...EARS_UP }, { cue: "cheer" })));
  const leave = A.ms - A.leaveAt;
  frames.push(
    fa(f(leave - 300, { bob: 3, ride: 1, mood: "smug" })),
    fa(f(80, { air: 8, ...LAUNCH, ...legsAt(2, LAUNCH), ...EARS_BACK, ...STREAM, mood: "joy" }, { cue: "hop" })),
    fa(f(80, { air: 24, ...FLY, ...EARS_BACK, ...STREAM, mood: "joy" })),
    { ms: 80, layers: [], specks: landShadow(10) },
    { ms: 60, layers: [] },
  );
  return { loop: false, frames };
})();

/**
 * Chub & Chirp for their attack on a king: the same drawing, parts and palette, facing our left as always (as Sawyer),
 * in a frame `ATTACK_REACH` wider on the left (the carrots' flight) and `ATTACK_TOP` taller (they drop in). Its `idle`,
 * one still, is for the preview, which starts every reel from one.
 */
export const HOPPER_ATTACK: Character = {
  ...HOPPER,
  id: "hopper-attack",
  name: "Chub & Chirp (their attack)",
  w: AW,
  h: AH,
  foot: [HOPPER.foot[0] + ATTACK_REACH, HOPPER.foot[1] + ATTACK_TOP],
  anims: { idle: { loop: true, frames: [fa(f(1000))] }, kingAttack },
};
