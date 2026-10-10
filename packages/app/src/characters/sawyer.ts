/**
 * Sawyer, the raccoon boss: after Eric's reference picture, redrawn. A raccoon in a wide, aggressive stance with a
 * mischievous toothy grin, a yellow hard hat, a bold black bandit mask (no goggles: Eric wanted the mask to read), white
 * gloves, a big striped tail, and a red-and-black reciprocating saw held in both hands (no brand marks). Drawn
 * three-quarters on, facing our left as in the reference, light from the top left.
 *
 * Rigging: the head (one per face), the hat, the body and the feet are painted once; the legs and arms from their
 * points (a hip and an ankle; a shoulder, an elbow and a hand), the tail from its swish, and the saw from its angle,
 * where it's held and how far the blade has slid out. The gloves ride on the saw's grips, so moving the saw moves his
 * hands. Every part is painted the first time a frame that uses it shows (sprite.ts lazyParts).
 *
 * A sprite preview only (?wip=1&kit=Sawyer): no boss, powers, lines or sounds of his own yet.
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "./paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

export const SAWYER_PALETTE: Record<string, string> = {
  k: "#1c1413", // outline
  a: "#44322e", // fur, dark to light (a warm grey-brown, as in the reference)
  b: "#5f4843",
  c: "#7e635e",
  d: "#a08883",
  e: "#c0aea5", // cream fur: shadow, mid, light
  f: "#e3d5cb",
  g: "#f8f1ea",
  m: "#140e0e", // his bandit mask, and its soft ends
  M: "#332523",
  x: "#050303", // pupils, nose, the mouth's line
  w: "#ffffff", // eye whites, teeth
  v: "#ffffff", // the glint in his pupils
  u: "#6b1f24", // inside his mouth
  Y: "#f6c21c", // the hard hat: yellow, light, highlight, shadow, deep shadow
  y: "#ffe05a",
  L: "#fff3ad",
  O: "#d39a0b",
  P: "#946404",
  j: "#fbf9f5", // gloves: white, shade, the lines between fingers
  J: "#d4cec6",
  i: "#9c948c",
  R: "#e1262c", // the saw: red, dark red, highlight
  r: "#9c141a",
  Q: "#ff6b57",
  B: "#26262c", // black, its light, its highlight
  C: "#44454e",
  D: "#6d6f7a",
  S: "#eceff3", // the blade: steel light, mid, dark (its teeth)
  s: "#b3bac3",
  T: "#6f7782",
  U: "#e2c085", // sawdust
  V: "#a97b43",
  z: "#0d0e12", // ground shadow
};

type Pt = readonly [number, number];
const FUR = "abcd";

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

// ---- The head: one face per mood. Everything in drawing space (the ground at y 64).

export type Mood = "grin" | "blink" | "smirk" | "glee" | "fierce" | "squint";

const HX = 12;
const HY = 4;
const HEAD_W = 41;
const HEAD_H = 32;

/**
 * His eyes inside the mask: [rows, top-left] for the far eye (our left) and the near one. White, the pupils glaring
 * inward with a glint, the tops cut on a slant by his brows (the white brow fur comes down to his nose): angry, up to
 * something. `.` leaves the mask.
 */
const EYES: Record<string, { l: readonly string[]; r: readonly string[] }> = {
  glare: { l: ["ww...", "wwvx.", "wwxxw", ".www."], r: ["...www", ".vxwww", "wxxwww", ".wwww."] },
  shut: { l: [".....", ".....", "wwwww", "....."], r: ["......", "......", "wwwwww", "......"] },
  /** His near brow up, a knowing look: the near eye open, the far one narrowed. */
  sly: { l: [".....", "wwvx.", "wwxxw", "....."], r: ["..wwww", "wvxwww", "wxxwww", ".wwww."] },
  /** Wide and wild (revving): round, the pupils small and fixed on you. */
  wild: { l: [".www.", "wwvxw", "wwxxw", ".www."], r: [".wwww.", "wwvxww", "wwxxww", ".wwww."] },
  /** Narrowed (the cut). */
  narrow: { l: [".....", "wwvxw", ".wxx.", "....."], r: ["......", "wvxwww", ".xxww.", "......"] },
};
const EYE_L: Pt = [23, 19];
const EYE_R: Pt = [35, 19];
/** The mouth under his snout, stamped from (19, 26): a wide grin full of teeth, rising to his near cheek. */
const MOUTHS: Record<string, readonly string[]> = {
  grin: ["................xx", ".xxxxxxxxxxxxxxxx.", "..xwwwwwwwwwwwwx..", "...xwewwewwewwx...", "....xxuuuuuuxx....", "......xxxxxx......"],
  /** Lopsided: the far side pressed shut, the near corner pulled right up, a crease, teeth on that side. */
  smirk: ["...............x.x", ".xxxxxxxx......xx.", ".........xxxxwwwx..", "..........xwwwex...", "...........xxxx....", ".................."],
  /** Wide open, teeth top and bottom (revving). */
  glee: ["................xx", ".xxxxxxxxxxxxxxxx.", "..xwwwwwwwwwwwwwx.", "..xuuuuuuuuuuuux..", "...xwwwwwwwwwwx...", "....xxxxxxxxxx...."],
  /** Teeth gritted. */
  grit: ["................xx", ".xxxxxxxxxxxxxxxx.", "..xwxwwxwwxwwxwx..", "..xwxwwxwwxwwxwx..", "...xxxxxxxxxxxx...", ".................."],
};
const FACES: Record<Mood, { eyes: string; mouth: string }> = {
  grin: { eyes: "glare", mouth: "grin" },
  blink: { eyes: "shut", mouth: "grin" },
  smirk: { eyes: "sly", mouth: "smirk" },
  glee: { eyes: "wild", mouth: "glee" },
  fierce: { eyes: "narrow", mouth: "grit" },
  squint: { eyes: "narrow", mouth: "glee" },
};

function head(mood: Mood): Part {
  const cv = canvas(HEAD_W, HEAD_H);
  const F = (inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string) => fill(cv, HX, HY, inside, key);
  const skull = inEllipse(34.5, 21.5, 14.8, 11.6);
  const light = roundLight(31, 17, 16, 12, 0.08);
  // The ears, behind the hat: white-rimmed, dark inside.
  F(inPoly([[19.5, 16], [21, 5.5], [28.5, 12]]), () => "f");
  F(inPoly([[21, 14.5], [21.8, 8.5], [26, 12.5]]), () => "a");
  F(inPoly([[41, 11.5], [47.5, 6], [50, 16]]), () => "d");
  F(inPoly([[43.5, 12], [47, 8.5], [48.5, 14.5]]), () => "a");
  F(skull, (x, y) => ramp(FUR, light(x, y)));
  // White fur: a brow patch over each eye (their lower edges slant down to his nose: the angry brows), his cheeks and
  // the long pointed snout, with a spiky white tuft on his near cheek. A dark stripe runs down his forehead between the
  // brows into the mask.
  F(inPoly([[20, 16.5], [24, 14.6], [31, 15], [31.4, 18.6], [27.5, 17.4], [22, 17.8]]), (x) => (x < 25 ? "g" : "f"));
  F(inPoly([[35.4, 15], [44, 14.4], [48, 16.4], [47.4, 18.2], [39.5, 17.3], [35, 18.6]]), (x) => (x > 44 ? "e" : "f"));
  F(inPoly([[46.5, 19], [52.5, 21.5], [49.5, 23], [52.5, 25.5], [49, 26.5], [50.5, 29], [44.5, 30]]), (x) => (x > 50 ? "e" : "f"));
  F(
    inPoly([[13.5, 25.2], [17, 23.2], [22.5, 22.8], [27, 24.6], [31, 24.4], [34, 23], [38, 23.6], [42, 24.6], [46.5, 24], [49, 23], [49.5, 27], [46, 30.6], [39, 33.2], [29, 33.4], [22, 31.4], [16.5, 27.6]]),
    (x, y) => (y >= 32 || x > 44 ? "e" : y < 26 && x < 30 ? "g" : "f"),
  );
  // The bandit mask: a bold black band across his eyes, from cheek to cheek, dipping at its ends; a thinner bridge over
  // his nose meets the forehead stripe.
  F(
    inPoly([[17.6, 19.6], [22, 17.8], [27.5, 17.4], [31.4, 18.6], [33.2, 17.2], [35, 18.6], [39.5, 17.3], [47.4, 18.2], [50, 20], [49.6, 22.6], [46.6, 24.6], [42, 24.8], [37.6, 23.6], [34, 23.2], [31, 24.6], [27, 25], [22.6, 23.4], [18.4, 22.6]]),
    (x, y) => (x > 48 || x < 19 ? "M" : "m"),
  );
  F(inPoly([[31.6, 9], [34.6, 9], [34.2, 18], [32.2, 18]]), () => "a");
  const f = FACES[mood];
  const eyes = EYES[f.eyes]!;
  stamp(cv, HX, HY, eyes.l, EYE_L[0], EYE_L[1]);
  stamp(cv, HX, HY, eyes.r, EYE_R[0], EYE_R[1]);
  // The nose: black, at the snout's tip, a grey glint.
  stamp(cv, HX, HY, [".xxx", "xdxx", "xxxx", ".xx."], 13, 23);
  // The mouth.
  stamp(cv, HX, HY, MOUTHS[f.mouth]!, 19, 26);
  return { grid: toGrid(cv) };
}

/** The hard hat: a yellow dome with three ridges and a brim, lower at the front (our left). */
function hat(): Part {
  const X0 = 17;
  const Y0 = -1;
  const cv = canvas(34, 18);
  const F = (inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string) => fill(cv, X0, Y0, inside, key);
  const dome = (x: number, y: number) => inEllipse(35.5, 12, 12.5, 12.5)(x, y) && y < 12;
  const light = roundLight(31, 4, 13, 11, 0.12);
  F(dome, (x, y) => ramp("OYyL", light(x, y)));
  // The ridges down the dome: a lit edge and a shadow beside each.
  for (let y = 0; y < 12; y++) {
    const c = Math.round(35 - y * 0.15);
    for (const [x, k] of [[c - 6 + Math.round(y * 0.25), "O"], [c, "L"], [c + 1, "O"], [c + 6 - Math.round(y * 0.2), "O"]] as const) if (dome(x, y)) stamp(cv, X0, Y0, [k], x, y);
  }
  // The brim: lower at the front, a highlight along its top and its underside in shadow.
  const brim = inPoly([[18, 14.5], [20.5, 11], [49.5, 9.8], [50, 12], [47, 13.3], [21, 15.2]]);
  F(brim, (x, y) => (y <= 11 || (y === 12 && x < 26) ? "y" : brim(x, y + 1) ? "Y" : "O"));
  return { grid: toGrid(cv) };
}
const HAT_AT: Pt = [17, -1];

/** His body: grey-brown fur, a cream chest and belly. */
function body(): Part {
  const X0 = 23;
  const Y0 = 27;
  const cv = canvas(28, 28);
  const torso = inPoly([[25.5, 28], [46, 27.5], [49.5, 33], [50, 46], [48.5, 54], [28, 54.5], [24.5, 47], [24, 36]]);
  const light = roundLight(34, 36, 14, 16, 0.05);
  fill(cv, X0, Y0, torso, (x, y) => ramp(FUR, light(x, y)));
  const belly = inEllipse(36, 43, 8.5, 11);
  fill(cv, X0, Y0, (x, y) => torso(x, y) && belly(x, y), (x, y) => ramp("efg", light(x, y) + 0.15));
  return { grid: toGrid(cv) };
}
const BODY_AT: Pt = [23, 27];

/** A foot: a big dark paw, lit on top. */
function foot(): Part {
  const cv = canvas(17, 6);
  fill(cv, 0, 0, inEllipse(8.5, 3.2, 8.5, 3.2), (x, y) => ramp("abc", roundLight(7, 1.5, 8.5, 3.5, 0.0)(x, y)));
  return { grid: toGrid(cv) };
}

function shadow(): Part {
  const cv = canvas(62, 3);
  fill(cv, 0, 0, inEllipse(31, 1.5, 31, 1.6), () => "z");
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
        // Thicker at the start (a thigh, an upper arm), tapering to r1.
        const rr = r + (r1 - r) * ((i + n.t) / (pts.length - 1));
        if (n.d - rr < best.d - best.rr) best = { d: n.d, nx: n.nx, ny: n.ny, rr };
      });
      if (best.d > best.rr) continue;
      cv[y]![x] = ramp(FUR, 0.6 - 0.42 * (best.nx / best.rr) - 0.5 * (best.ny / best.rr));
    }
  return { grid: toGrid(cv) };
}

// ---- The tail: a big bushy crescent behind him, ringed dark and light.

/** The tail's spine (drawing space) for a swish (-2 to 2: the tip to our left or right), from its base to its tip. */
function tailSpine(swish: number): Pt[] {
  const p0: Pt = [50, 58];
  const p1: Pt = [70.5 + swish, 47 - Math.abs(swish) * 0.3];
  const p2: Pt = [56 + swish * 2, 25.5 + Math.abs(swish) * 0.4];
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    return [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
  });
}
function tail(swish: number): { part: Part; at: Pt } {
  const spine = tailSpine(swish);
  const radius = (t: number) => 6 + 4 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - (t > 0.85 ? (t - 0.85) * 12 : 0);
  const b = boxOf(spine, 12);
  const cv = canvas(b.w, b.h);
  const lens = spine.slice(1).map((q, i) => Math.hypot(q[0] - spine[i]![0], q[1] - spine[i]![1]));
  const total = lens.reduce((s, l) => s + l, 0);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const p: Pt = [b.x0 + x + 0.5, b.y0 + y + 0.5];
      let best = { d: Infinity, s: 0, nx: 0, ny: 0 };
      let run = 0;
      spine.slice(1).forEach((q, i) => {
        const n = nearest(p, spine[i]!, q);
        if (n.d < best.d) best = { d: n.d, s: run + n.t * lens[i]!, nx: n.nx, ny: n.ny };
        run += lens[i]!;
      });
      // Past the tip: round it off.
      const t = best.s / total;
      const r = radius(t);
      if (best.d > r) continue;
      // Rings: across the tail, a little curved (further along at its edges), dark and light; light at the tip.
      const along = (total - best.s) + (best.d / r) ** 2 * 2.5;
      const dark = Math.floor((along + 2) / 5.2) % 2 === 1;
      const l = 0.55 - 0.42 * (best.nx / r) - 0.5 * (best.ny / r);
      cv[y]![x] = dark ? ramp("aab", l) : ramp("bcdd", l);
    }
  return { part: { grid: toGrid(cv) }, at: [b.x0, b.y0] };
}

// ---- The saw: painted from its angle, so it can swing; the gloves ride on its grips.

/**
 * The saw in its own space: u along it (the blade at negative u, to our left at rest), v across it (down at rest),
 * from where his front hand grips it. Each piece is a polygon and a colour by (u, v); later pieces cover earlier ones.
 */
type Piece = { pts: readonly Pt[]; key: (u: number, v: number) => string };
function sawPieces(stroke: number): Piece[] {
  const s = stroke;
  return [
    // The blade, slid out by `stroke`: a straight back, teeth along its edge, the tip angled up to the back.
    {
      pts: [[-9, -2.4], [-24.6 - s, -2.4], [-25.6 - s, -1.6], [-22.4 - s, 2.4], [-9, 2.4]],
      key: (u, v) => (v > 1.3 ? ((Math.floor(u - s) & 1) === 0 ? "T" : "s") : v < -1 ? "S" : v < 0.4 ? "s" : "S"),
    },
    // The shoe: a black plate where the blade comes out, a screw in it.
    {
      pts: [[-11.6, -6.2], [-8.8, -7.4], [-6.2, -7], [-6.2, 4.8], [-8.6, 5.8], [-11.6, 4.8]],
      key: (u, v) => (Math.abs(u + 9) < 0.6 && Math.abs(v + 1) < 0.6 ? "D" : u < -10.6 ? "C" : "B"),
    },
    // The nose: black, rounded, ribbed where his front hand holds it.
    {
      pts: [[-6.6, -3.6], [-2, -4.8], [9.4, -5], [9.4, 5.4], [-2, 5.4], [-6.6, 4]],
      key: (u, v) => (v < -3.6 ? "D" : v < -2.2 ? "C" : u > -4 && u < 6 && v > 0.5 && Math.floor(u) % 2 === 0 ? "C" : "B"),
    },
    // The motor: red, a highlight along its top, vents.
    {
      pts: [[9, -5.4], [21, -5.8], [23.4, -4.4], [23.4, 7.6], [9, 7.6]],
      key: (u, v) => (v < -4.2 ? "Q" : v > 6.2 ? "r" : v > -1.6 && v < 1.6 && [12.5, 14.6, 16.7].some((c) => Math.abs(u - c) < 0.55) ? "r" : "R"),
    },
    // The collar between the nose and the motor.
    { pts: [[8, -5.4], [10.2, -5.4], [10.2, 7.4], [8, 7.4]], key: (u, v) => (v < -3.8 ? "D" : "B") },
    // The rear handle: a red loop up behind the motor and down into the battery, a black grip on its top.
    {
      pts: [[21, -6], [28.2, -6.4], [30.8, -4.8], [32.6, 7.6], [26.4, 7.6], [23, 1]],
      key: (u, v) => (v < -5.2 ? "Q" : u > 30 + v * 0.15 ? "r" : "R"),
    },
    // The battery: red on top, black below, under the handle.
    {
      pts: [[20.6, 6], [33.4, 6], [35, 7.6], [35, 13], [33.2, 14], [20.6, 14]],
      key: (u, v) => (v < 7.4 ? "Q" : v < 10 ? (u > 33.4 ? "r" : "R") : v < 11.2 ? "C" : "B"),
    },
  ];
}
/** Where the hands hold it, in its own space: under the nose, and on top of the rear handle. */
const GRIP_FRONT: Pt = [-0.6, 3.6];
const GRIP_REAR: Pt = [25.6, -2.8];

export interface SawPose {
  /** Where the front grip is, in drawing space. */
  at: Pt;
  /** Degrees, the blade's end up (positive) or down. At rest 14. */
  tilt: number;
  /** How far the blade has slid out (0-2 px). */
  stroke: number;
}
const rot = (a: number, [u, v]: Pt): Pt => [u * Math.cos(a) - v * Math.sin(a), u * Math.sin(a) + v * Math.cos(a)];
/** The saw's angle in drawing space: at a positive tilt its blade (at negative u) is up to our left. */
const angleOf = (tilt: number) => (tilt * Math.PI) / 180;
const sawPoint = (p: SawPose, q: Pt): Pt => {
  const [x, y] = rot(angleOf(p.tilt), q);
  return [p.at[0] + x, p.at[1] + y];
};
function saw(p: SawPose): Part {
  const pieces = sawPieces(p.stroke);
  const pts = pieces.flatMap((pc) => pc.pts.map((q) => sawPoint(p, q)));
  const b = boxOf(pts, 1);
  const cv = canvas(b.w, b.h);
  const tests = pieces.map((pc) => inPoly(pc.pts));
  const a = angleOf(p.tilt);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      // Back into the saw's own space (inPoly tests pixel centres: undo its half-pixel).
      const [u, v] = rot(-a, [b.x0 + x + 0.5 - p.at[0], b.y0 + y + 0.5 - p.at[1]]);
      for (let i = pieces.length - 1; i >= 0; i--)
        if (tests[i]!(u - 0.5, v - 0.5)) {
          cv[y]![x] = pieces[i]!.key(u, v);
          break;
        }
    }
  return { grid: toGrid(cv) };
}
const sawBox = (p: SawPose) => boxOf(sawPieces(p.stroke).flatMap((pc) => pc.pts.map((q) => sawPoint(p, q))), 1);

/** His gloves: a fist under the saw's nose (cuff to our right), and one over the rear handle. */
const GLOVE_FRONT: Part = {
  grid: [
    "...jjjjj.jj", //
    "..jjjjjjjjJ",
    ".jjjjjjjjjJ",
    "jjijjijjijJ",
    "jjijjijjijJ",
    "jjjjjjjjjJJ",
    ".jJjjJjjJJ.",
    "..JJJJJJJ..",
  ],
};
const GLOVE_REAR: Part = {
  grid: [
    "...jjjjjjj", //
    "..jjjjjjjJ",
    ".jjjjjjjjJ",
    "jjjjjjjjjJ",
    "jijjijjijJ",
    "jijjijjiJJ",
    "jjjjjjjjJ.",
    ".JJjJJjJ..",
  ],
};

// ---- Parts and poses.

const { parts: PARTS, add } = lazyParts();
const MOODS: readonly Mood[] = ["grin", "blink", "smirk", "glee", "fierce", "squint"];
for (const m of MOODS) add(`head:${m}`, () => head(m));
add("hat", hat);
add("body", body);
add("foot", foot);
add("shadow", shadow);
add("gloveF", () => GLOVE_FRONT);
add("gloveR", () => GLOVE_REAR);

const r2 = (v: number) => Math.round(v * 2) / 2;
function limb(kind: "arm" | "leg", pts: readonly Pt[]): { name: string; at: Pt } {
  const q = pts.map((p): Pt => [r2(p[0]), r2(p[1])]);
  const name = `${kind}:${q.map((p) => p.join(",")).join(";")}`;
  const [r, r1] = kind === "arm" ? [2.8, 2.3] : [5.4, 3.8];
  add(name, () => paintLimb(q, r, r1));
  const b = boxOf(q, Math.ceil(Math.max(r, r1)) + 1);
  return { name, at: [b.x0, b.y0] };
}
const tailAt = new Map<number, Pt>();
function tailLayer(swish: number): { name: string; at: Pt } {
  const name = `tail:${swish}`;
  add(name, () => tail(swish).part);
  let at = tailAt.get(swish);
  if (!at) {
    const b = boxOf(tailSpine(swish), 12);
    tailAt.set(swish, (at = [b.x0, b.y0]));
  }
  return { name, at };
}
function sawLayer(p: SawPose): { name: string; at: Pt } {
  const q: SawPose = { at: [r2(p.at[0]), r2(p.at[1])], tilt: Math.round(p.tilt), stroke: p.stroke };
  const name = `saw:${q.at.join(",")};${q.tilt};${q.stroke}`;
  add(name, () => saw(q));
  const b = sawBox(q);
  return { name, at: [b.x0, b.y0] };
}

/** Where his own drawing space (the ground at y 64) sits on the frame, and the frame's size. */
const OX = 7;
const OY = 5;
const GROUND = 64;
const W = OX + 76;
const H = OY + GROUND + 4;

/** The saw at rest: held across him, the blade up to our left. */
export const SAW_REST: SawPose = { at: [27.5, 37], tilt: 14, stroke: 0 };

export interface SawyerPose {
  mood?: Mood;
  /** Down at the knees: head, body, arms and saw down a pixel or two (the feet stay put). */
  bob?: number;
  /** Head, body, arms and saw sideways (a lean). */
  lean?: number;
  /** The head a little further. */
  headDx?: number;
  headDy?: number;
  /** The hat jolted down a pixel over his brow (revving). */
  hatDrop?: number;
  saw?: Partial<SawPose>;
  /** The tail's swish, -2 to 2. */
  swish?: number;
}

const SHOULDER_F: Pt = [29, 31.5];
const SHOULDER_R: Pt = [45.5, 31];

/** The saw's pose in drawing space for a pose of his (it rides his bob and lean). */
const sawOf = (p: SawyerPose): SawPose => {
  const at = p.saw?.at ?? SAW_REST.at;
  return { ...SAW_REST, ...p.saw, at: [at[0] + (p.lean ?? 0), at[1] + (p.bob ?? 0)] };
};

export function sawyerLayers(p: SawyerPose): Layer[] {
  const bob = p.bob ?? 0;
  const lean = p.lean ?? 0;
  const at = (part: string, x: number, y: number): Layer => ({ part, x: OX + x, y: OY + y });
  const L = (l: { name: string; at: Pt }) => at(l.name, l.at[0], l.at[1]);
  const up = (q: Pt): Pt => [q[0] + lean, q[1] + bob];
  const sp = sawOf(p);
  const gF = sawPoint(sp, GRIP_FRONT);
  const gR = sawPoint(sp, GRIP_REAR);
  // The arms reach from the shoulders to the gloves, the elbows out (the front one tucked behind the saw).
  const sF = up(SHOULDER_F);
  const sR = up(SHOULDER_R);
  const armF = limb("arm", [sF, [Math.min(sF[0], gF[0]) - 1.5, (sF[1] + gF[1]) / 2 + 1], gF]);
  const armR = limb("arm", [sR, [Math.max(sR[0], gR[0]) + 3, (sR[1] + gR[1]) / 2 + 0.5], gR]);
  const legL = limb("leg", [up([31.5, 49]), [27 + lean / 2, 54], [23, 58.5]]);
  const legR = limb("leg", [up([45, 50]), [50.5 + lean / 2, 54], [55, 58.5]]);
  const hx = lean + (p.headDx ?? 0);
  const hy = bob + (p.headDy ?? 0);
  return [
    at("shadow", 9, GROUND - 2),
    L(tailLayer(p.swish ?? 0)),
    L(legR),
    at("body", BODY_AT[0] + lean, BODY_AT[1] + bob),
    L(legL),
    at("foot", 13, GROUND - 6),
    at("foot", 51.5, GROUND - 6),
    L(armF),
    at(`head:${p.mood ?? "grin"}`, HX + hx, HY + hy),
    at("hat", HAT_AT[0] + hx, HAT_AT[1] + hy + (p.hatDrop ?? 0)),
    L(armR),
    L(sawLayer(sp)),
    at("gloveF", Math.round(gF[0] - 5), Math.round(gF[1] - 4)),
    at("gloveR", Math.round(gR[0] - 5), Math.round(gR[1] - 3)),
  ];
}

// ---- Animations.

/** A frame of a pose; its specks stay a pixel inside the frame (sawdust flies to its edge, never past it). */
const f = (ms: number, p: SawyerPose, extra: Partial<Frame> = {}): Frame => ({
  ms,
  layers: sawyerLayers(p),
  ...extra,
  ...(extra.specks ? { specks: extra.specks.filter(([x, y]) => x >= 2 && y >= 2 && x <= W - 3 && y <= H - 3) } : {}),
});

/** The blade's strokes, in and out: it buzzes. */
const STROKES = [0, 2, 1, 2] as const;
/** The tail's swish over the loop: a slow sway, further in behind him than out (on a phone the boss's name is out there). */
const SWISH = [0, 0, 1, 1, 1, 1, 0, 0, -1, -1, -2, -2, -2, -2, -1, -1, 0, 0] as const;

/**
 * Idle: the blade buzzes in and out the whole time, his tail swishes slowly side to side, he bobs on his knees; he
 * blinks, and halfway through he smirks (one brow up, the grin pulled to one side). Silent.
 */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 54 }, (_, i) => {
    const mood: Mood = i === 9 || i === 40 ? "blink" : i >= 22 && i < 32 ? "smirk" : "grin";
    const bob = Math.floor(i / 6) % 3 === 2 ? 1 : 0;
    return f(90, { mood, bob, swish: SWISH[Math.floor(i / 3) % SWISH.length]!, saw: { stroke: STROKES[i % 4]! } });
  }),
};

/** Sawdust spraying off the blade's teeth, down and forward, `t` frames on (frame pixels). */
function spray(p: SawyerPose, t: number, n = 12): Speck[] {
  const sp = sawOf(p);
  return Array.from({ length: n }, (_, i): Speck[] => {
    const [ox, oy] = sawPoint(sp, [-12 - ((i * 5) % 13) - sp.stroke, 2.6]);
    const age = (t + i * 2) % 5;
    const x = Math.round(OX + ox - (1 + (i % 3) * 0.6) * age * 1.5);
    const y = Math.round(OY + oy + (0.4 + (i % 2) * 0.5) * age * 1.3 + age * age * 0.2);
    const k = i % 3 ? "U" : "V";
    return i % 2 ? [[x, y, k], [x - 1, y, "U"]] : [[x, y, k]];
  }).flat();
}
/** Sawdust bursting up and out of the cut where the blade's tip bites (drawing space), `t` frames on. */
function burst([tx, ty]: Pt, t: number, n = 14): Speck[] {
  return Array.from({ length: n }, (_, i): Speck[] => {
    const a = (-170 + (i * 160) / (n - 1)) * (Math.PI / 180);
    const d = 2 + t * (1.2 + (i % 3) * 0.5);
    const x = Math.round(OX + tx + Math.cos(a) * d);
    const y = Math.round(OY + ty + Math.sin(a) * d * 0.8 + t * t * 0.35);
    const k = i % 3 ? "U" : "V";
    return y > OY + GROUND + 2 ? [] : i % 2 ? [[x, y, k], [x, y - 1, "U"]] : [[x, y, k]];
  }).flat();
}
const tipOf = (p: SawyerPose): Pt => {
  const sp = sawOf(p);
  return sawPoint(sp, [-24.5 - sp.stroke, 0]);
};

/** Rev: he squeezes the trigger, the saw shakes in his hands and screams, sawdust flies; a wild grin. */
const rev: Anim = (() => {
  const frames: Frame[] = [f(120, { mood: "smirk", bob: 1, saw: { tilt: 12 } })];
  for (let i = 0; i < 12; i++) {
    const p: SawyerPose = { mood: "glee", saw: { tilt: 17 + (i % 2), stroke: i % 2 ? 2 : 0 }, hatDrop: i % 2, swish: i % 4 < 2 ? 0 : -1 };
    frames.push(f(60, p, { ...(i === 0 ? { cue: "rev" } : {}), shake: [i % 2 ? 1 : -1, i % 3 === 0 ? 1 : 0], specks: i > 0 ? spray(p, i) : [] }));
  }
  frames.push(f(120, { mood: "glee", saw: { tilt: 15, stroke: 1 } }, { specks: spray({ saw: { tilt: 15, stroke: 1 } }, 13, 5) }));
  frames.push(f(200, { mood: "smirk" }));
  return { loop: false, frames };
})();

/**
 * Saw down: he lifts the saw, leans in and drives it straight down in front of him (`swing`), the blade biting at the
 * ground (`cut`: where the powers will cut a pawn, then the board), sawdust spraying as it buzzes, then pulls it back.
 */
const DOWN: SawyerPose = { mood: "squint", bob: 2, lean: -2, headDx: -1, saw: { at: [31, 44], tilt: -36 } };
/** Where the blade's tip bites, driven down (drawing space). */
export const CUT: Pt = tipOf({ ...DOWN, saw: { ...DOWN.saw, stroke: 2 } });
const sawDown: Anim = {
  loop: false,
  frames: [
    f(110, { mood: "fierce", bob: 1, saw: { at: [26.5, 35], tilt: 20 } }),
    f(150, { mood: "fierce", lean: 1, headDx: 1, saw: { at: [27, 32], tilt: 26 } }),
    f(60, { mood: "fierce", lean: -1, saw: { at: [28, 39], tilt: -6, stroke: 1 } }, { cue: "swing" }),
    f(90, { ...DOWN, saw: { ...DOWN.saw, stroke: 2 } }, { cue: "cut", shake: [0, 1], specks: burst(CUT, 0) }),
    ...[1, 2, 3, 4, 5].map((t) => f(70, { ...DOWN, saw: { ...DOWN.saw, stroke: t % 2 ? 0 : 2 } }, { shake: [t % 2 ? 1 : 0, 0], specks: burst(CUT, t, t > 3 ? 8 : 14) })),
    f(120, { mood: "glee", bob: 1, lean: -1, saw: { at: [28, 41], tilt: -12, stroke: 1 } }, { specks: burst(CUT, 6, 6) }),
    f(150, { mood: "smirk", bob: 1, saw: { tilt: 10 } }),
    f(200, { mood: "smirk" }),
  ],
};

export const SAWYER: Character = {
  id: "sawyer",
  name: "Sawyer",
  w: W,
  h: H,
  foot: [OX + 38, OY + GROUND],
  palette: SAWYER_PALETTE,
  halo: "#2c2624",
  parts: PARTS,
  anims: { idle, rev, sawDown },
};

/** The part of him a portrait shows (his head and hat), in frame pixels. */
export const SAWYER_PORTRAIT = { x: OX + 12, y: OY - 2, w: 44, h: 36 } as const;
