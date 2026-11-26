/**
 * Dash lying down by your clock, tapping his (DashTap in components/DashStall.tsx): one extra figure of the boss, in a frame of its
 * own. Redrawn Nov 26 (Eric: "the way he's drawn now when he's like laying down, he is kind of like wonky ... that classic ... your
 * feet are up in the air ... resting one hand on his head ... lackadaisically"; docs/decisions/2026-11-26-dash-tap-bigger.md), for
 * showing about three times his old size (DASH_TAP.lieScale), hanging over the board's edge.
 *
 * The pose: on his belly along the floor, propped on his elbows, his cheek resting on the near paw; the far paw reaches out to the
 * white chess clock in front of him and taps its button; his lower legs are up behind him, sneakers' soles to the sky, kicking
 * lazily; his tail curls up behind. He zips in from our right and flops down (lieDown), taps (idle), then springs up and zips off
 * to our right with his clock (getUp).
 *
 * Drawn at twice his standing sprite's detail (R pixels a unit: the shapes are his standing sprite's, boss-blitz.ts, in units, so a
 * pose is numbers; each part painted at R pixels a unit with a dark rim of its own inside the renderer's outline, so the outlines
 * read as bold as his standing sprite's). His palette is his own (boss-blitz.ts's PALETTE); only the dust and the floor shadow
 * add theirs.
 */
import { canvas, inEllipse as E, inPoly, toGrid, type Canvas } from "./paint.ts";
import { PALETTE as HIS } from "./boss-blitz.ts";
import { lazyAnim, lazyParts, type Anim, type Character, type Frame, type Layer, type Speck } from "./sprite.ts";

/** Pixels a unit (his standing sprite's pixel is a unit). */
const R = 2;
const UW = 128;
const UH = 64;
const W = UW * R;
const H = UH * R;
/** The floor, in units. */
const FLOOR = 60;

const PALETTE: Record<string, string> = {
  ...HIS,
  u: "#8c7c68", // dust
  v: "#c8b9a0",
  Z: "#0000004d", // floor shadow
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;

const FUR = "bcde";
const CREAM = "fgh";
const TEAL = "ABCD";
const ORANGE = "EFGH";
const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const union = (...fs: Inside[]): Inside => (x, y) => fs.some((f) => f(x, y));

// ---- painting in units

interface Pen {
  /** Fill where `inside` (units, sampled at each pixel's middle) with `key`. */
  F(inside: Inside, key: Key): void;
  /** One pixel (pixel coordinates). */
  P(x: number, y: number, k: string): void;
  /** Rows of keys at a pixel (pixel coordinates). */
  S(rows: readonly string[], x: number, y: number): void;
  /** A round dot of `k` at a point (units), radius `r` units, only on what's drawn already. */
  dot(x: number, y: number, r: number, k: string): void;
  /** A line of `k` through points (units), `r` units thick each side. */
  ink(pts: readonly Pt[], r: number, k: string): void;
  cv: Canvas;
}
const unit = (p: number) => (p + 0.5) / R;

/** A painted part, cropped to its pixels, and where its top-left sits on the frame. */
type Placed = { name: string; x: number; y: number };
const { parts, add } = lazyParts();
const placedAt = new Map<string, Placed>();
/**
 * A part painted on a whole-frame canvas (in units), then given a dark rim inside its edge (`rim`, so with the renderer's own
 * outline its edge reads two of these pixels thick, as bold as his standing sprite's), cropped, and placed.
 */
function part(name: string, draw: (p: Pen) => void, o: { rim?: boolean; outline?: boolean } = {}): Placed {
  let pl = placedAt.get(name);
  if (pl) return pl;
  const cv = canvas(W, H);
  const P = (x: number, y: number, k: string) => {
    const X = Math.round(x);
    const Y = Math.round(y);
    if (Y >= 0 && Y < H && X >= 0 && X < W) cv[Y]![X] = k;
  };
  const F = (inside: Inside, key: Key) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(unit(x), unit(y))) cv[y]![x] = key(unit(x), unit(y));
  };
  const pen: Pen = {
    cv,
    F,
    P,
    S: (rows, sx, sy) => rows.forEach((row, j) => [...row].forEach((k, i) => k !== "." && P(sx + i, sy + j, k))),
    dot: (cx, cy, r, k) => F((x, y) => cv[Math.floor(y * R)]?.[Math.floor(x * R)] !== "." && (x - cx) ** 2 + (y - cy) ** 2 <= r * r, () => k),
    ink: (pts, r, k) => {
      const t = tube(pts, pts.map(() => r));
      F(t.inside, () => k);
    },
  };
  draw(pen);
  if (o.rim !== false) {
    const filled = (x: number, y: number) => y >= 0 && y < H && x >= 0 && x < W && cv[y]![x] !== ".";
    const edge: [number, number][] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) if (filled(x, y) && (!filled(x + 1, y) || !filled(x - 1, y) || !filled(x, y + 1) || !filled(x, y - 1))) edge.push([x, y]);
    for (const [x, y] of edge) cv[y]![x] = "k";
  }
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (cv[y]![x] !== ".") {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) [x0, y0, x1, y1] = [0, 0, 0, 0];
  const grid = toGrid(cv.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1)));
  add(name, () => ({ grid, outline: o.outline ?? true }));
  placedAt.set(name, (pl = { name, x: x0, y: y0 }));
  return pl;
}

// ---- tubes (limbs, tail), as his standing sprite's
function nearest(p: Pt, a: Pt, b: Pt) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function tube(pts: readonly Pt[], r: readonly number[]) {
  const at = (x: number, y: number) => {
    let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: r[0]! };
    pts.slice(1).forEach((q, i) => {
      const n = nearest([x, y], pts[i]!, q);
      const rr = r[i]! + (r[i + 1]! - r[i]!) * n.t;
      if (n.d - rr < best.d - best.rr) best = { s: (i + n.t) / Math.max(1, pts.length - 1), d: n.d, nx: n.nx, ny: n.ny, rr };
    });
    return best;
  };
  return {
    inside: ((x, y) => {
      const a = at(x, y);
      return a.d <= a.rr;
    }) as Inside,
    light: (x: number, y: number) => {
      const a = at(x, y);
      return 0.6 - 0.45 * (a.nx / a.rr) - 0.5 * (a.ny / a.rr);
    },
    s: (x: number, y: number) => at(x, y).s,
  };
}
/** The elbow (or knee) between `s` and `t` for bones `l1`, `l2`: the one lower down (`down`) or further left. */
function elbowOf(s: Pt, t: Pt, [l1, l2]: Pt, down = true): Pt {
  const dist = Math.hypot(t[0] - s[0], t[1] - s[1]) || 0.01;
  const d = Math.min(dist, l1 + l2 - 0.01);
  const [ux, uy] = [(t[0] - s[0]) / dist, (t[1] - s[1]) / dist];
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const [mx, my] = [s[0] + ux * a, s[1] + uy * a];
  const c1: Pt = [mx - uy * h, my + ux * h];
  const c2: Pt = [mx + uy * h, my - ux * h];
  return down ? (c1[1] >= c2[1] ? c1 : c2) : c1[0] <= c2[0] ? c1 : c2;
}
/** Cheetah spots: a loose lattice of round dots, on fur only. */
const spotAt = (x: number, y: number) => {
  const gx = Math.floor(x / 3.2);
  const gy = Math.floor(y / 3);
  const h = Math.abs(Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453) % 1;
  if (h < 0.35) return false;
  const cx = gx * 3.2 + 1.2 + (h * 1.3 - 0.6) + (gy % 2) * 1.4;
  const cy = gy * 3 + 1.4 + ((h * 7) % 1) * 0.6;
  return (x - cx) ** 2 + (y - cy) ** 2 <= 0.62;
};
const toward = (p: Pt, q: Pt, d: number): Pt => {
  const n = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  return [p[0] + ((q[0] - p[0]) / n) * d, p[1] + ((q[1] - p[1]) / n) * d];
};
const r2 = (v: number) => Math.round(v * 2) / 2;

// ---- the parts

const shadow = () =>
  part("shadow", ({ F }) => F((x, y) => E(64, FLOOR, 58, 1.3)(x, y) && y >= FLOOR - 0.6, () => "Z"), { rim: false, outline: false });

/** His white chess clock on the floor in front of him: two faces (ticks, no numerals), the red flag, two buttons on top. */
function clock(pressed: boolean, flag: boolean): Placed {
  return part(`clock:${pressed}:${flag}`, ({ F, P, S }) => {
    const [x0, x1, y0, y1] = [4, 30, 45, 59.5];
    // buttons (the right one his)
    F((x, y) => x >= 8 && x <= 13 && y >= 42.6 && y < 45.5, (_x, y) => (y < 43.6 ? "2" : "1"));
    const top = pressed ? 43.6 : 42.6;
    F((x, y) => x >= 20 && x <= 25 && y >= top && y < 45.5, (_x, y) => (y < top + 1 ? "2" : "1"));
    F((x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1, (x, y) => (y < y0 + 1 ? "O" : x > x1 - 1 || y > y1 - 1 ? "L" : x > x1 - 2 || y > y1 - 2 ? "M" : "N"));
    for (const cx of [11, 23]) {
      const cy = 52;
      F(E(cx, cy, 5, 5), (x, y) => (Math.hypot(x - cx, y - cy) > 4 ? "2" : "O"));
      // ticks and the middle
      for (const [dx, dy] of [[0, -3.2], [3.2, 0], [0, 3.2], [-3.2, 0], [0, 0]] as const) S(["11", "11"], (cx + dx) * R - 1, (cy + dy) * R - 1);
    }
    // the hands
    for (let i = 0; i < 5; i++) P(11 * R - 1, 52 * R - 2 - i, "1");
    for (let i = 0; i < 4; i++) P(11 * R + i, 52 * R + Math.floor(i / 2), "1");
    for (let i = 0; i < 5; i++) P(23 * R - 1, 52 * R - 2 - i, "1");
    for (let i = 0; i < 4; i++) P(23 * R - 2 - i, 52 * R - 2 - Math.floor(i / 2), "1");
    // the divider between the faces
    for (let y = 46; y <= 58; y += 1) P(17 * R, y * R, "M");
    // the flag, standing from the left face's top
    S(flag ? ["..SS", ".SR.", "SR..", "R..."] : ["SS..", "SR..", "R...", "R..."], 11 * R + 1, 46 * R - 1);
  });
}

/** The far arm, out to the clock: the elbow on the floor, the paw on (or over) its right button. `lift` units over it. */
function tapArm(lift: number): Placed {
  return part(`tapArm:${lift}`, ({ F, P }) => {
    const sh: Pt = [60, 46];
    const paw: Pt = [23, 41.2 - lift];
    const wr = toward(paw, sh, 2.4);
    const el: Pt = [43, 56.6];
    const t = tube([sh, el, wr], [3.2, 2.8, 2.4]);
    const pawIn = E(paw[0], paw[1], 3.2, 2.7);
    const dark = 0.2;
    F(union(t.inside, pawIn), (x, y) => {
      if (pawIn(x, y) && (!t.inside(x, y) || t.s(x, y) > 0.95)) return ramp(FUR, 0.65 - 0.3 * ((x - paw[0]) / 3) - 0.35 * ((y - paw[1]) / 2.6) - dark);
      const l = t.light(x, y) - dark;
      if (t.s(x, y) > 0.86) return ramp(ORANGE, l);
      return ramp(TEAL, l);
    });
    // the one claw out, onto the button
    const cx = Math.round(paw[0] * R) - 4;
    const cy = Math.round((paw[1] + 2.4) * R);
    P(cx, cy, "h");
    P(cx, cy + 1, "h");
    P(cx + 1, cy, "g");
    // the toes' creases
    P(Math.round(paw[0] * R) - 1, Math.round(paw[1] * R) + 3, "t");
    P(Math.round(paw[0] * R) + 2, Math.round(paw[1] * R) + 3, "t");
  });
}

/** The tail: out from his rump, along the floor and up in a lazy curl behind his legs. `flick` 0 to 2: the tip. */
const TIPS: readonly (readonly Pt[])[] = [
  [[123, 38], [120.5, 33.5]],
  [[123.5, 37], [122, 32]],
  [[122, 38.5], [118, 35.5]],
];
function tail(flick: number): Placed {
  return part(`tail:${flick}`, ({ F }) => {
    const pts: Pt[] = [[96, 52], [106, 53.5], [115, 51], [121, 45], ...TIPS[flick]!];
    const t = tube(pts, [2.6, 2.4, 2.2, 2, 1.8, 1.6]);
    F(t.inside, (x, y) => {
      const s = t.s(x, y);
      if (s > 0.9) return ramp(CREAM, t.light(x, y) + 0.2);
      if ((s > 0.62 && s < 0.68) || (s > 0.75 && s < 0.81)) return "s";
      if (s < 0.6 && spotAt(x, y)) return "s";
      return ramp(FUR, t.light(x, y) + 0.05);
    });
  });
}

/** A lower leg's angle from straight up (degrees: below 0 toward his head), and its knee. */
const KNEE_N: Pt = [110, 56.2];
const KNEE_F: Pt = [113.5, 55.2];
const SHIN = 19;
const ankleOf = (knee: Pt, a: number): Pt => [knee[0] + SHIN * Math.sin((a * Math.PI) / 180), knee[1] - SHIN * Math.cos((a * Math.PI) / 180)];

/** A leg: the thigh along the floor from his hip to the knee, the lower leg up in the air at angle `a`, his white sock at the top. */
function leg(near: boolean, a: number): Placed {
  return part(`leg:${near}:${a}`, ({ F }) => {
    const hip: Pt = near ? [93, 54.5] : [94, 52.5];
    const knee = near ? KNEE_N : KNEE_F;
    const ankle = ankleOf(knee, a);
    const t = tube([hip, knee, ankle], [3.8, 3, 2.1]);
    const dark = near ? 0 : 0.2;
    F(t.inside, (x, y) => {
      const l = t.light(x, y) - dark;
      if (t.s(x, y) > 0.9) return ramp("MNO", l + 0.1);
      if (spotAt(x, y)) return "s";
      return ramp(FUR, l + 0.05);
    });
  });
}

/**
 * A sneaker on top of a lower leg, its sole to the sky (Eric: "your feet are up in the air"): the heel on the ankle, the toe toward
 * our right, the orange sole on top, the white upper with its laces below.
 */
function sneaker(near: boolean, a: number): Placed {
  return part(`shoe:${near}:${a}`, ({ F }) => {
    const knee = near ? KNEE_N : KNEE_F;
    const ankle = ankleOf(knee, a);
    const up: Pt = [Math.sin((a * Math.PI) / 180), -Math.cos((a * Math.PI) / 180)];
    // the foot's way: up turned 78 degrees toward our right
    const th = (78 * Math.PI) / 180;
    const f: Pt = [up[0] * Math.cos(th) - up[1] * Math.sin(th), up[0] * Math.sin(th) + up[1] * Math.cos(th)];
    const base: Pt = [ankle[0] + up[0] * 1.4, ankle[1] + up[1] * 1.4];
    const heel: Pt = [base[0] - f[0] * 1.2, base[1] - f[1] * 1.2];
    const toe: Pt = [base[0] + f[0] * 6.4, base[1] + f[1] * 6.4];
    const t = tube([heel, toe], [3, 2.7]);
    const dark = near ? 0 : 0.18;
    F(t.inside, (x, y) => {
      // across: toward the sole (up) 1, toward the laces -1; along: heel 0, toe 1
      const dx = x - heel[0];
      const dy = y - heel[1];
      const along = (dx * f[0] + dy * f[1]) / 7.6;
      const across = (dx * up[0] + dy * up[1]) / 2.85;
      if (across > 0.5) return along > 0.15 && along < 0.75 && across < 0.8 ? "G" : across > 0.85 ? "E" : "F";
      if (across < -0.15 && across > -0.75 && along > 0.3 && along < 0.75 && Math.floor(along * 12) % 2 === 0) return "J";
      if (along > 0.85) return dark ? "M" : "N";
      const l = t.light(x, y) - dark;
      return ramp("MNO", l + 0.15);
    });
  });
}

/** His jacket and shorts, lying along the floor, his chest propped up on his elbows. */
const body = () =>
  part("body", ({ F, P }) => {
    const jacket = inPoly([[49, 44], [53, 38.5], [60, 36.5], [67, 37], [77, 41], [86, 45.5], [86, 59.6], [51, 59.6], [48.5, 52]]);
    // the orange yoke over his shoulders: left of a line slanting down from (66, 37) to (60, 60)
    const yokeAt = (x: number, y: number) => x < 66.5 - (y - 37) * 0.28;
    F(jacket, (x, y) => {
      const l = 0.72 - 0.012 * (x - 50) - 0.035 * (y - 38);
      if (x >= 82.5) return x < 83.6 ? "G" : ramp(ORANGE, l - 0.15);
      if (yokeAt(x, y)) return Math.abs(x - (66.5 - (y - 37) * 0.28)) < 0.6 ? "D" : ramp(ORANGE, l + 0.1);
      return ramp(TEAL, l + 0.05);
    });
    // the zip's pull, peeking out under his chest
    for (const [x, y] of [[53, 57.5], [53, 58]] as Pt[]) P(x * R, y * R, "J");
    const shorts = inPoly([[85.5, 45.5], [93, 46.5], [98, 49.5], [99.5, 59.6], [85.5, 59.6]]);
    F(shorts, (x, y) => (y >= 51.6 && y < 53 ? "G" : ramp(TEAL, 0.6 - 0.02 * (x - 86) - 0.035 * (y - 47))));
  });

// ---- the head: his standing sprite's (boss-blitz.ts), moved 10 units right and 5 up, at twice the detail
const HX = 46;
const HY = 26;
const SKULL = E(HX, HY, 12.5, 11);
const MUZZLE = E(38.2, 32.4, 5.6, 3.9);
const NOSEB = E(33.6, 30, 2.2, 1.7);
const CHIN = E(40.5, 35.2, 4.4, 2.4);
const RUFF = inPoly([[54, 28], [60.5, 31], [57.5, 32.5], [59.5, 35.5], [54, 36.5], [51, 34]]);
const HEAD_SPOTS: Pt[] = [[40, 19], [50, 19], [51.5, 19.5], [54, 21], [56, 24], [57, 25.5], [53, 25], [57, 29], [55, 32], [51, 29], [52.5, 29.5], [49, 33], [45, 19], [37, 22], [54, 17.5], [48, 22], [50, 26], [54, 28], [46, 31], [48, 29.5]];

const head = () =>
  part("head", ({ F, dot, ink, S }) => {
    const light = (x: number, y: number) => 0.62 - 0.4 * ((x - 43) / 13) - 0.5 * ((y - 22) / 12);
    F(union(SKULL, RUFF, MUZZLE, NOSEB, CHIN), (x, y) => {
      const l = light(x, y);
      if ((MUZZLE(x, y) || NOSEB(x, y)) && y < 31 && !CHIN(x, y)) return ramp(FUR, l + 0.25);
      if (MUZZLE(x, y) || NOSEB(x, y) || CHIN(x, y)) return ramp(CREAM, l + 0.15);
      if (RUFF(x, y) && !SKULL(x, y)) return ramp(CREAM, l + 0.05);
      return ramp(FUR, l + 0.1);
    });
    // cream under the eyes
    F(union(E(44.5, 26.4, 3.2, 1.3), E(35.5, 26, 1.8, 1.1)), () => "g");
    for (const [x, y] of HEAD_SPOTS) dot(x, y, 0.75, "s");
    // tear marks: bold, from each eye's inner corner down beside the muzzle to the mouth's corner
    ink([[42.2, 25], [41.6, 27.5], [40.2, 30.2], [39.6, 31.6]], 0.6, "s");
    ink([[35.2, 25.5], [34.8, 27.2]], 0.5, "s");
    // the nose, its shine
    S([".nnnnn.", "nnnnnnn", "nnnnnnn", ".nnnnn.", "..nnn..", "...n..."], 64, 57);
    S(["e"], 66, 57);
    // whisker dots
    for (const [x, y] of [[36, 31.6], [38, 31.8], [37, 33]] as Pt[]) dot(x, y, 0.45, "t");
  });

/** His smirk: from under the nose, round to a corner turned up. */
const mouth = () =>
  part("mouth", ({ ink }) => ink([[34.2, 31.4], [34.9, 32.7], [36.6, 33.5], [38.8, 33.3], [40.6, 32.2], [41.1, 31.4]], 0.5, "s"), { rim: false, outline: false });

type Eyes = "half" | "wide" | "shut";
/** His eyes at twice the detail: the near one 14 pixels wide, the far one in profile. "half": lidded, bored and sly. */
const NEAR: Record<Eyes, string[]> = {
  half: [
    "..............",
    "ssssssssssssss",
    "ssssssssssssss",
    "sYYYYxxxxYYYYs",
    "syyyyxxxxyyyys",
    ".syyyyyyyyyys.",
    "..ssssssssss..",
  ],
  wide: [
    "..ssssssssss..",
    ".sYYYYYYYYwws.",
    "sYYYYxxxxwwYYs",
    "sYYYxxxxxxYYYs",
    "syyyxxxxxxyyys",
    ".syyyyxxyyyys.",
    "..ssssssssss..",
  ],
  shut: ["..............", "..............", "..............", "..............", "ssssssssssssss", ".ssssssssssss.", "..............",],
};
const FAR: Record<Eyes, string[]> = {
  half: ["......", "ssssss", "ssssss", "sxxYs.", "sxyys.", ".sss.."],
  wide: [".ssss.", "sYwws.", "sxxYs.", "sxxys.", "sxyys.", ".sss.."],
  shut: ["......", "......", "......", "......", "sssss.", ".sss.."],
};
const eyes = (lid: Eyes) =>
  part(`eyes:${lid}`, ({ S }) => {
    S(NEAR[lid], 81, 41);
    S(FAR[lid], 67, 41);
    // brows: lazy and flat when lidded, up when wide
    if (lid === "wide") {
      S(["....ssssss", "ssssss...."], 82, 35);
      S(["ss", "ss"], 67, 37);
    } else {
      S(["..........ss", "ssssssssss.."], 82, 37);
      S(["sss"], 66, 38);
    }
  }, { rim: false, outline: false });

const ear = (far: boolean) =>
  part(`ear:${far}`, ({ F }) => {
    const [cx, cy] = far ? [36.5, 12] : [56.5, 10.5];
    F(E(cx, cy, 3.2, 3.6), (x, y) => (E(cx + 0.3, cy + 0.6, 1.7, 2.1)(x, y) ? (far ? "t" : "s") : far ? "b" : ramp(FUR, 0.8 - (y - cy) * 0.1)));
  });

/** His cap, on backwards: the orange dome, the teal brim out at the back. */
const cap = () =>
  part("cap", ({ F, ink, S }) => {
    const dome: Inside = (x, y) => y <= 18.5 && E(47, 18.5, 12.6, 8.6)(x, y);
    const brim = inPoly([[56.5, 15.5], [65, 15.5], [68.5, 17], [68, 19.3], [57, 19.3]]);
    F(brim, (_x, y) => (y < 17 ? "C" : y < 18 ? "B" : "A"));
    F(dome, (x, y) => {
      if (y >= 17) return x < 43 ? "G" : x < 53 ? "F" : "E";
      return ramp(ORANGE, 0.6 - 0.45 * ((x - 45) / 12) - 0.5 * ((y - 12) / 7));
    });
    // seams to the button, and the strap's gap at the front (it's on backwards)
    ink([[46.5, 10.6], [43, 16.6]], 0.45, "E");
    ink([[49, 10.8], [54.5, 15.8]], 0.45, "E");
    S(["CCDD", "CCDD"], 47 * R - 1, 9 * R);
    S(["kkkk", "kkkk", "ccdk", "ccdk"], 35 * R, 17 * R);
  });

/** The near arm: elbow on the floor, forearm up, his cheek resting on the paw. `low`: the paw a unit lower (his head lifting off). */
function propArm(low = 0): Placed {
  return part(`propArm:${low}`, ({ F, P }) => {
    const sh: Pt = [66, 44];
    const el: Pt = [61, 56.8];
    const paw: Pt = [51.5, 37.8 + low];
    const wr = toward(paw, el, 2.6);
    const t = tube([sh, el, wr], [3.4, 3, 2.6]);
    const pawIn = E(paw[0], paw[1], 3.6, 2.9);
    F(union(t.inside, pawIn), (x, y) => {
      if (pawIn(x, y) && (!t.inside(x, y) || t.s(x, y) > 0.95)) return ramp(FUR, 0.72 - 0.3 * ((x - paw[0]) / 3.6) - 0.35 * ((y - paw[1]) / 2.9));
      const l = t.light(x, y);
      if (t.s(x, y) > 0.86) return ramp(ORANGE, l);
      if (t.s(x, y) > 0.08 && t.s(x, y) < 0.8 && l > 0.85) return "D";
      return ramp(TEAL, l);
    });
    // the toes curled against his cheek
    for (const dx of [-2.2, -0.6, 1]) P(Math.round((paw[0] + dx) * R), Math.round((paw[1] - 1.6) * R), "t");
  });
}

// ---- the zip blur (his zipping in and off): him as a smear, the leading edge round, the rest trailing off. `dir` -1 leftward.
function smear(name: string, lead: number, len: number, dir: 1 | -1): Placed {
  return part(name, ({ F }) => {
    F((x, y) => {
      if (y < 12 || y > 59.5) return false;
      const hsh = Math.abs(Math.sin(Math.floor(y) * 91.7 + lead * 3.3) * 43758.5453) % 1;
      const head = y <= 37;
      const t = head ? (y - 25) / 12.5 : (y - 49) / 11;
      const e = (head ? 8 : 5) * (1 - Math.sqrt(Math.max(0, 1 - t * t))) + (head ? 0 : 5);
      const l = head ? len * 0.4 + hsh * 6 : len * (0.75 + 0.25 * hsh);
      const i = (x - lead) * -dir - e;
      return i >= 0 && i < l && x > 2 && x < UW - 2;
    }, (x, y) => {
      const head = y <= 37;
      const i = Math.abs(x - lead);
      if (head) return y <= 14 ? "H" : y <= 18.5 ? "G" : y < 19.5 ? "F" : y > 22.5 && y < 24 && i > 3 && i < 6 ? "s" : y > 28 && y < 34 && i < 7 ? "g" : y > 34 ? "b" : "c";
      return y > 49 && i > len * 0.6 ? "N" : y <= 40 ? "D" : y < 44 && i < 14 ? "G" : y > 56 ? "A" : y > 52 ? "B" : "C";
    });
  });
}

// ---- poses

interface Pose {
  /** The whole figure (not the clock), units. */
  dx?: number;
  dy?: number;
  /** The head, cap and ears against the figure, units. */
  hy?: number;
  eyes?: Eyes;
  /** The tapping paw over the button, units: 0 pressing. */
  lift?: number;
  tail?: number;
  /** His lower legs' angles (degrees from straight up; below 0 toward his head). */
  near?: number;
  far?: number;
  /** The clock: where (units; null: not drawn), pressed, its flag nudged. */
  clock?: Pt | null;
  pressed?: boolean;
  flag?: boolean;
}

function layers(p: Pose): Layer[] {
  const dx = Math.round((p.dx ?? 0) * R);
  const dy = Math.round((p.dy ?? 0) * R);
  const hy = Math.round((p.hy ?? 0) * R);
  const L = (pl: Placed, y = 0): Layer => ({ part: pl.name, x: pl.x + dx, y: pl.y + dy + y });
  const near = Math.round(p.near ?? -8);
  const far = Math.round(p.far ?? -2);
  const out: Layer[] = [];
  if (dy === 0) out.push(L(shadow()));
  if (p.clock !== null) {
    const [cx, cy] = p.clock ?? [0, 0];
    const c = clock(!!p.pressed, !!p.flag);
    out.push({ part: c.name, x: c.x + Math.round(cx * R), y: c.y + Math.round(cy * R) });
  }
  out.push(L(tapArm(r2(p.lift ?? 3))));
  out.push(L(tail(p.tail ?? 0)), L(leg(false, far)), L(sneaker(false, far)), L(leg(true, near)), L(sneaker(true, near)));
  out.push(L(body()));
  out.push(L(ear(true), hy), L(ear(false), hy), L(head(), hy), L(mouth(), hy), L(eyes(p.eyes ?? "half"), hy), L(cap(), hy));
  out.push(L(propArm()));
  return out;
}

const frame = (p: Pose, ms: number, extra: Partial<Frame> = {}): Frame => ({ layers: layers(p), ms, ...extra });

/** Specks in units, to pixels. */
const px = (s: readonly (readonly [number, number, string])[]): Speck[] => s.map(([x, y, k]) => [Math.round(x * R), Math.round(y * R), k] as Speck);

/** Little tap lines flying off the button. */
const TAP: readonly Speck[] = px([
  [19.5, 41, "H"], [19, 40.5, "G"], [18.5, 40, "H"],
  [20, 38, "O"], [19.5, 37.5, "O"], [19, 37, "H"],
  [22.5, 36.5, "O"], [22.5, 36, "O"], [22.5, 35.5, "H"],
  [27, 38, "O"], [27.5, 37.5, "H"],
]);

/** Speed lines: `n` of them in a box (units), from a seed: white, light teal, every third grey (reads on a light ground too). */
function speedLines(seed: number, n: number, x0: number, x1: number, y0: number, y1: number): Speck[] {
  const out: Speck[] = [];
  for (let i = 0; i < n; i++) {
    const r = (j: number) => Math.abs(Math.sin(seed * 17.1 + i * 31.7 + j * 7.3) * 43758.5453) % 1;
    const len = (5 + Math.floor(r(1) * 14)) * R;
    const x = x0 * R + Math.floor(r(2) * Math.max(1, (x1 - x0) * R - len));
    const y = y0 * R + Math.floor(r(3) * (y1 - y0) * R);
    const k = i % 3 === 2 ? "M" : i % 3 === 1 ? "D" : "O";
    for (let j = 0; j < len; j++) if (x + j >= 2 && x + j <= W - 3 && y >= 2 && y <= H - 3) out.push([x + j, y, k]);
  }
  return out;
}
/** A puff of dust at (x, y) units, `size` 0 to 2. */
function dust(x: number, y: number, size: number, flip = false): Speck[] {
  const pts: [number, number, string][] = [
    [0, 0, "v"], [1, 0, "v"], [2, 0, "u"], [1, -1, "v"], [-1, 0, "u"],
    [3, -1, "v"], [2, -2, "u"], [4, 0, "v"], [-2, -1, "v"], [5, -2, "u"], [3, -3, "v"], [-3, 0, "u"],
  ];
  const out: Speck[] = [];
  for (const [a, b, k] of pts.slice(0, 5 + size * 4)) {
    const X = Math.round((x + (flip ? -a : a)) * R);
    const Y = Math.round((y + b) * R);
    for (const [ex, ey] of [[0, 0], [1, 0], [0, -1], [1, -1]]) if (X + ex! >= 2 && X + ex! <= W - 3 && Y + ey! >= 2 && Y + ey! <= H - 3) out.push([X + ex!, Y + ey!, k]);
  }
  return out;
}

// ---- animations

/** A lazy kick: his lower legs swinging past each other, a cycle of the tap loop (8 frames). */
const kick = (i: number) => {
  const s = Math.sin((i / 8) * 2 * Math.PI);
  return { near: -9 + 9 * s, far: -3 - 9 * s };
};
const TAILS = [0, 0, 1, 1, 2, 2, 1, 1];
/** The tapping paw a frame: tap, up, up high, high, tap, ... (two taps a loop, as before: his tap sounds' rhythm). */
const LIFTS = [3, 0, 1.5, 3, 3, 0, 1.5, 3];

const IDLE: Anim = lazyAnim(() => ({
  loop: true,
  frames: LIFTS.map((lift, i) => {
    const tap = lift === 0;
    return frame({ lift, ...kick(i), tail: TAILS[i], pressed: tap, flag: tap }, 100, tap ? { cue: "tap", specks: TAP } : {});
  }),
}));

const LIE_DOWN: Anim = lazyAnim(() => ({
  loop: false,
  frames: [
    {
      layers: [L0(smear("smearIn0", 110, 26, -1), 0, 0), L0(clock(false, false), 90, -5)],
      ms: 70,
      cue: "zip",
      specks: speedLines(1, 9, 100, 126, 14, 58),
    },
    {
      layers: [L0(smear("smearIn1", 46, 70, -1), 0, 0), L0(clock(false, false), 26, -7)],
      ms: 70,
      specks: speedLines(2, 12, 84, 126, 12, 58),
    },
    frame({ dy: -2, hy: -1, eyes: "wide", lift: 6, near: -20, far: 8, tail: 2, clock: [2, -6] }, 90, {
      specks: [...speedLines(3, 6, 100, 126, 30, 58), ...dust(112, 59.5, 1), ...dust(84, 59.5, 0)],
    }),
    frame({ hy: -1, eyes: "wide", lift: 6, near: -16, far: 4, tail: 1, clock: [0, -3] }, 90, { specks: [...dust(66, 59.5, 2), ...dust(116, 59.5, 1)] }),
    frame({ eyes: "half", lift: 3, near: -12, far: 0, tail: 0 }, 100, { specks: [...dust(3, 59.5, 1), ...dust(34, 59.5, 1)] }),
    frame({ lift: 3, ...kick(0) }, 120),
  ],
}));

const GET_UP: Anim = lazyAnim(() => ({
  loop: false,
  frames: [
    frame({ dy: -3, hy: -1, eyes: "wide", lift: 6, near: -20, far: 8, tail: 2, clock: [2, -7] }, 70, {
      cue: "zip",
      specks: [...dust(60, 59.5, 2), ...dust(104, 59.5, 1), ...dust(22, 59.5, 0)],
    }),
    {
      layers: [L0(smear("smearOut0", 98, 66, 1), 0, 0), L0(clock(false, false), 70, -9)],
      ms: 70,
      specks: [...speedLines(4, 12, 4, 38, 12, 58), ...dust(26, 59.5, 2)],
    },
    {
      layers: [L0(smear("smearOut1", 125, 30, 1), 0, 0), L0(clock(false, false), 94, -9)],
      ms: 70,
      specks: speedLines(5, 12, 20, 98, 12, 58),
    },
    { layers: [], ms: 80, specks: speedLines(6, 8, 52, 126, 14, 58) },
    { layers: [], ms: 80, specks: speedLines(7, 4, 88, 126, 20, 56) },
    { layers: [], ms: 60 },
  ],
}));

/** A placed part moved by (x, y) units. */
function L0(pl: Placed, x: number, y: number): Layer {
  return { part: pl.name, x: pl.x + Math.round(x * R), y: pl.y + Math.round(y * R) };
}

export const DASH_LIE: Character = {
  id: "dash-lie",
  name: "Dash, lying down",
  w: W,
  h: H,
  foot: [64 * R, FLOOR * R],
  palette: PALETTE,
  halo: "#fff3d62e",
  parts,
  anims: { idle: IDLE, lieDown: LIE_DOWN, getUp: GET_UP },
};

/**
 * Where he is in his frame, in its pixels, for placing him (DashStall.tsx): the floor his belly and clock lie on (their outline's row),
 * and his top (his ear's tip, its halo) as he lies tapping (a unit test measures both from the drawn frames).
 */
export const DASH_LIE_AT = { floor: FLOOR * R - 1, top: 11 } as const;
