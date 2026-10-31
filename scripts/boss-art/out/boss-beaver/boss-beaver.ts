/**
 * The beaver builder (boss-beaver): Eric's design. A stout brown beaver standing upright, facing a little to our left
 * (toward the board): big buck teeth, whiskers, small round ears, a dark nose; an orange hard hat and an orange safety
 * vest; a yellow tool belt and harness with a red-handled hammer, a tape measure, a wrench and pouches; two crossed
 * wooden planks strapped on his back (their ends over his shoulders); a flat crosshatched paddle tail behind him.
 * Light from the top left.
 *
 * Rigging: every part is painted in drawing space (the frame's own pixels, the ground at y GROUND) and placed where it
 * was painted, plus an offset: `breath` lifts his chest, arms, head and hat; the tail is painted from its angle.
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#1e130d", // outline
  a: "#3e2415", // fur, dark to light
  b: "#5d361d",
  c: "#7d4a27",
  d: "#9c6334",
  e: "#b97f4a",
  m: "#9a6e4f", // muzzle and belly: shade, mid, light
  n: "#b88b66",
  N: "#d4ad86",
  x: "#140c08", // eyes, nose, mouth
  v: "#ffffff", // eye glint
  X: "#6a5a54", // nose glint
  w: "#fff6dc", // teeth
  W: "#d6c49a",
  o: "#b4520c", // orange (hat, vest): shadow, mid, light, highlight
  O: "#ea7816",
  L: "#ff9d3a",
  l: "#ffc77e",
  s: "#e2e7ec", // reflective stripe / steel light
  S: "#9aa4af", // steel mid
  T: "#5c6570", // steel dark
  Y: "#f2c230", // yellow belt and harness: mid, shadow, light, deep
  y: "#c48f18",
  Z: "#ffe47c",
  P: "#7e5b0e",
  R: "#d8302c", // hammer handle
  r: "#8c1916",
  B: "#2a2a30", // tape measure's dark ring
  H: "#f6d38e", // wood: light, mid, shade, grain
  h: "#e0aa5c",
  j: "#b47b36",
  J: "#7e5222",
  g: "#3e2c22", // the planks' strap
  t: "#2c2522", // tail: hatch, dark, mid, light
  u: "#4e423c",
  U: "#6b5c53",
  V: "#887667",
  i: "#eadcc4", // whiskers
  D: "#9a8a72", // dust
  z: "#0d0e12", // ground shadow
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;
interface Painted {
  part: Part;
  at: Pt;
}

const W = 88;
const H = 88;
const GROUND = 82;
/** Headroom: the drawing sits this far down the frame. */
const OY = 2;

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const and = (...fs: Inside[]): Inside => (x, y) => fs.every((f) => f(x, y));
const not = (f: Inside): Inside => (x, y) => !f(x, y);

/** A canvas whose top-left is drawing-space (x0, y0): fill shapes and stamp rows in drawing space. */
function pic(x0: number, y0: number, w: number, h: number) {
  const cv: Canvas = canvas(w, h);
  const F = (inside: Inside, key: Key) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
  };
  const S = (rows: readonly string[], sx: number, sy: number) =>
    rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        if (k === ".") return;
        const X = sx + i - x0;
        const Y = sy + j - y0;
        if (cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
      }),
    );
  const at = (x: number, y: number) => cv[y - y0]?.[x - x0] ?? ".";
  const done = (outline = true): Painted => ({ part: { grid: toGrid(cv), ...(outline ? {} : { outline: false }) }, at: [x0, y0] });
  return { cv, F, S, at, done };
}

// ---- The head: one per mood.

type Mood = "smile" | "blink" | "proud";

const EYES: Record<Mood, { far: readonly string[]; near: readonly string[] }> = {
  smile: { far: ["vx", "xx", "xx"], near: [".xx.", "xvxx", "xvxx", "xxxx", ".xx."] },
  blink: { far: ["..", "..", "xx"], near: ["....", "....", "....", "xxxx", "...."] },
  /** Eyes shut in a happy arch: pleased with his work. */
  proud: { far: ["..", "xx", "x."], near: ["....", ".xx.", "x..x", "....", "...."] },
};

function head(mood: Mood): Painted {
  const p = pic(10, 10, 48, 32);
  const light = roundLight(33, 20, 16, 14, 0.08);
  const fur: Key = (x, y) => ramp("abcde", light(x, y));
  // Small round ears at the sides, under the hat's brim.
  p.F(inEllipse(25, 21, 3.4, 3.4), () => "c");
  p.F(inEllipse(25.3, 21.3, 1.7, 1.7), () => "a");
  p.F(inEllipse(53, 21, 3.6, 3.6), () => "c");
  p.F(inEllipse(52.7, 21.3, 1.8, 1.8), () => "a");
  // A round skull and chubby cheeks.
  p.F(inEllipse(38.5, 27, 14.5, 12.5), fur);
  p.F(inEllipse(31, 32, 10, 7.5), fur);
  p.F(inEllipse(45, 32.5, 8.5, 6.5), fur);
  // The muzzle: pale, pointing to our left.
  const ml = roundLight(23, 28, 8, 6, 0.12);
  p.F(inEllipse(25.5, 31, 7.6, 5.6), (x, y) => ramp("mnN", ml(x, y)));
  // Whisker pores on the muzzle, and a couple of whiskers over the near cheek.
  p.S(["m.m", ".m."], 28, 30);
  p.S(["...aa", "aa..."], 33, 31);
  p.S(["aaa"], 34, 33);
  // Brows, cheerful.
  p.S([".bb", "b.."], 27, 19);
  p.S([".aaa.", "a...a"], 35, 18);
  // Eyes.
  const e = EYES[mood];
  p.S(e.far, 28, 22);
  p.S(e.near, 36, 21);
  // The nose: dark and round at the snout's tip, a glint.
  p.S([".xxxx.", "xXXxxx", "xxxxxx", ".xxxx."], 17, 25);
  p.S(["x", "x"], 21, 29);
  // The mouth (corners up) and the big buck teeth.
  p.S(["x.......x", ".xxxxxxx.", ".wwwxwww.", ".wwwxwww.", ".wwwxwwW.", ".WWWxWWW."], 18, 31);
  return p.done();
}

/** The hard hat: an orange dome with a ridge, a brim lower at the front (our left). */
function hat(): Painted {
  const p = pic(17, 2, 42, 20);
  const dome = and(inEllipse(39, 17.5, 14.5, 13.5), (_x, y) => y < 16);
  const light = roundLight(33, 7, 14, 10, 0.12);
  p.F(dome, (x, y) => ramp("oOLl", light(x, y)));
  // The ridge down the middle: lit on its left, shadowed on its right.
  p.F(and(dome, (x) => x === 38), (_x, y) => (y < 8 ? "l" : "L"));
  p.F(and(dome, (x) => x === 39), () => "o");
  p.F(and(dome, (x, y) => x === 31 && y > 6), () => "L");
  p.F(and(dome, (x, y) => x === 47 && y > 5), () => "o");
  const brim = inPoly([[18.5, 20], [20.5, 15.5], [55, 14.5], [57, 16], [55, 17.6], [24, 20.4]]);
  p.F(brim, (x, y) => (!brim(x, y - 1) ? (x < 44 ? "l" : "L") : !brim(x, y + 1) ? "o" : "O"));
  return p.done();
}

// ---- The body: fur, the orange vest, the yellow harness straps.

function body(): Painted {
  const p = pic(20, 32, 42, 46);
  const torso = inEllipse(40, 55.5, 17.5, 21);
  const light = roundLight(35, 45, 18, 22, 0.05);
  p.F(torso, (x, y) => ramp("abcd", light(x, y)));
  p.F(and(torso, inEllipse(37.5, 57, 9.5, 15)), (x, y) => ramp("mnN", light(x, y) + 0.1));
  // The vest, open down the front.
  const opening = inPoly([[31, 33], [44, 33], [43, 47], [42.5, 62], [33.5, 62], [32.5, 47]]);
  const vest = and(torso, (_x, y) => y < 63, not(opening));
  p.F(vest, (x, y) => (opening(x - 1, y) || opening(x + 1, y) ? "o" : ramp("oOOL", light(x, y) + 0.08)));
  // Its reflective stripe.
  p.F(and(vest, (_x, y) => y === 53), () => "s");
  p.F(and(vest, (_x, y) => y === 54), () => "S");
  // The harness straps over the shoulders, down to the belt, each with a buckle.
  const strapL = inPoly([[28, 35], [31.5, 34.6], [32, 63], [29, 63]]);
  const strapR = inPoly([[45, 34.6], [48.5, 35], [48, 63], [45, 63]]);
  for (const st of [strapL, strapR]) {
    p.F(and(torso, st), (x, y) => (!st(x - 1, y) ? "Z" : !st(x + 1, y) ? "y" : "Y"));
  }
  p.S(["PPPP", "P..P", "PPPP"], 28, 45);
  p.S(["PPPP", "P..P", "PPPP"], 45, 45);
  return p.done();
}

function thigh(cx: number): Painted {
  const p = pic(cx - 9, 62, 18, 14);
  const light = roundLight(cx - 2, 67, 8, 7, 0);
  p.F(inEllipse(cx, 70, 7.6, 6.2), (x, y) => ramp("abcd", light(x, y)));
  return p.done();
}

function foot(cx: number): Painted {
  const p = pic(cx - 10, 74, 20, 8);
  const light = roundLight(cx - 2, 77, 9, 3.5, 0);
  p.F(inEllipse(cx, 78.6, 8.6, 3.1), (x, y) => ramp("abc", light(x, y)));
  // Webbed toes to the front (our left).
  p.S(["a..a..a", "a..a..a"], cx - 7, 79);
  return p.done();
}

function shadow(): Painted {
  const p = pic(10, GROUND - 2, 68, 4);
  p.F(inEllipse(44, GROUND, 33, 1.8), () => "z");
  return p.done(false);
}

// ---- The planks on his back: wood from a top end to a bottom end, a strap across each.

function plank(top: Pt, bot: Pt, hw: number, strapAt: number): Painted {
  const x0 = Math.floor(Math.min(top[0], bot[0]) - hw - 1);
  const y0 = Math.floor(Math.min(top[1], bot[1]) - hw - 1);
  const p = pic(x0, y0, Math.ceil(Math.abs(top[0] - bot[0]) + 2 * hw + 3), Math.ceil(Math.abs(top[1] - bot[1]) + 2 * hw + 3));
  const len = Math.hypot(bot[0] - top[0], bot[1] - top[1]);
  const ux = (bot[0] - top[0]) / len;
  const uy = (bot[1] - top[1]) / len;
  // The across direction, and how much it faces the light (top left).
  const nx = -uy;
  const ny = ux;
  const lit = -0.6 * nx - 0.8 * ny; // >0: positive across faces the light
  p.F(
    (x, y) => {
      const rx = x + 0.5 - top[0];
      const ry = y + 0.5 - top[1];
      const al = rx * ux + ry * uy;
      const ac = rx * nx + ry * ny;
      return al >= 0 && al <= len && Math.abs(ac) <= hw;
    },
    (x, y) => {
      const rx = x + 0.5 - top[0];
      const ry = y + 0.5 - top[1];
      const al = rx * ux + ry * uy;
      const ac = rx * nx + ry * ny;
      if (al < 1.6) return Math.abs(ac) < 1.2 ? "j" : "H";
      if (al >= strapAt && al < strapAt + 2.4) return Math.abs(ac) > hw - 1.2 ? "g" : al < strapAt + 1 ? "J" : "g";
      const l = 0.5 + 0.5 * (ac / hw) * Math.sign(lit);
      // Grain: two broken lines along the plank.
      if (Math.abs(ac + 1) < 0.5 && Math.floor((al + 2) / 7) % 3 !== 0) return "j";
      if (Math.abs(ac - 1.6) < 0.5 && Math.floor(al / 5) % 2 === 0) return "J";
      return l > 0.78 ? "H" : l > 0.22 ? "h" : "j";
    },
  );
  return p.done();
}

// ---- The tail: a flat paddle on the ground behind him, crosshatched, turned about its root.

const TAIL_ROOT: Pt = [55, 71];
function tail(deg: number): Painted {
  const a = (deg * Math.PI) / 180;
  const p = pic(TAIL_ROOT[0] - 2, TAIL_ROOT[1] - 18, 34, 28);
  const local = (x: number, y: number): Pt => {
    const dx = x + 0.5 - TAIL_ROOT[0];
    const dy = y + 0.5 - TAIL_ROOT[1];
    return [dx * Math.cos(a) + dy * Math.sin(a), -dx * Math.sin(a) + dy * Math.cos(a)];
  };
  const inside: Inside = (x, y) => {
    const [u, v] = local(x, y);
    return ((u - 14) / 14) ** 2 + (v / 6.6) ** 2 <= 1;
  };
  p.F(inside, (x, y) => {
    const [u, v] = local(x, y);
    const r = ((u - 14) / 14) ** 2 + (v / 6.6) ** 2;
    if (r > 0.72) return v < -2 ? "U" : "u";
    const hatch = Math.abs(((u + v * 1.2) % 5 + 5) % 5 - 2.5) < 0.5 || Math.abs(((u - v * 1.2) % 5 + 5) % 5 - 2.5) < 0.5;
    if (hatch) return "t";
    const l = 0.55 - 0.3 * ((u - 14) / 14) - 0.6 * (v / 6.6);
    return ramp("uUV", l);
  });
  return p.done();
}

// ---- The tool belt and what hangs on it.

function belt(): Painted {
  const p = pic(20, 58, 41, 10);
  const band = inPoly([[21.5, 60], [30, 61.6], [40, 62], [50, 61.6], [58.5, 60], [58.8, 64.4], [50, 66], [40, 66.4], [30, 66], [21.2, 64.4]]);
  p.F(band, (x, y) => (!band(x, y - 1) ? "Z" : !band(x, y + 1) ? "y" : x > 54 ? "y" : "Y"));
  p.S(["TTTTTT", "TSxxST", "TSxxST", "TTTTTT"], 35, 62);
  return p.done();
}

/** The hammer, hung through a loop at his hip: a steel head, a red handle. */
function hammer(): Painted {
  const p = pic(15, 54, 14, 23);
  p.S(
    [
      "sss........",
      "sSSssssssss",
      "SSSSSSSSSSS",
      "TTT..Rr...T",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....Rr....",
      ".....rr....",
    ],
    16,
    55,
  );
  return p.done();
}

function tape(): Painted {
  const p = pic(40, 60, 9, 9);
  p.S([".ZYYy.", "ZYBBYy", "YBssBy", "YBSsBy", "yYBByy", ".yyyy."], 41, 61);
  return p.done();
}

function pouches(): Painted {
  const p = pic(48, 62, 14, 12);
  p.S(["ZZZZZZ", "YYYYYy", "yyPyyy", "YYYYYy", "YYYYYy", "YYYYYy", "YYYYyy", "yyyyyy"], 49, 64);
  return p.done();
}
function pouch2(): Painted {
  const p = pic(54, 61, 8, 10);
  p.S(["ZZZZ", "YYYy", "yPyy", "YYYy", "YYyy", "yyyy"], 56, 63);
  return p.done();
}
function wrench(): Painted {
  const p = pic(49, 52, 8, 14);
  p.S(["s..s", "sssS", ".sS.", ".sS.", ".sS.", ".sS.", ".sS.", ".ST.", ".ST.", ".ST."], 51, 54);
  return p.done();
}

// ---- Arms: a thick round stroke from the shoulder by the elbow to the paw.

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function arm(pts: readonly Pt[], r: number, r1: number, sleeve: number): Painted {
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const pad = Math.ceil(Math.max(r, r1)) + 1;
  const x0 = Math.floor(Math.min(...xs)) - pad;
  const y0 = Math.floor(Math.min(...ys)) - pad;
  const p = pic(x0, y0, Math.ceil(Math.max(...xs)) + pad - x0 + 1, Math.ceil(Math.max(...ys)) + pad - y0 + 1);
  p.F(
    () => true,
    (x, y) => {
      const q: Pt = [x + 0.5, y + 0.5];
      let best = { d: Infinity, nx: 0, ny: 0, rr: r, s: 0 };
      pts.slice(1).forEach((b, i) => {
        const n = nearest(q, pts[i]!, b);
        const s = (i + n.t) / (pts.length - 1);
        const rr = r + (r1 - r) * s;
        if (n.d - rr < best.d - best.rr) best = { d: n.d, nx: n.nx, ny: n.ny, rr, s };
      });
      if (best.d > best.rr) return ".";
      const l = 0.6 - 0.42 * (best.nx / best.rr) - 0.5 * (best.ny / best.rr);
      // The vest's armhole: orange at the shoulder.
      return best.s < sleeve ? ramp("oOL", l) : ramp("abcd", l);
    },
  );
  return p.done();
}
function paw(cx: number, cy: number): Painted {
  const p = pic(cx - 4, cy - 4, 9, 9);
  const light = roundLight(cx - 1, cy - 1, 3.4, 3, 0.05);
  p.F(inEllipse(cx + 0.5, cy + 0.5, 3.4, 3.1), (x, y) => ramp("abc", light(x, y)));
  p.S(["a.a"], cx - 1, cy + 1);
  return p.done();
}

// ---- Parts and poses.

const PARTS: Record<string, Part> = {};
const AT: Record<string, Pt> = {};
function use(name: string, make: () => Painted): string {
  if (!PARTS[name]) {
    const r = make();
    PARTS[name] = r.part;
    AT[name] = r.at;
  }
  return name;
}

const SHOULDER_L: Pt = [25.5, 40];
const SHOULDER_R: Pt = [54.5, 40];
const HAND_L: Pt = [30, 46];
const HAND_R: Pt = [46.5, 46];

interface Pose {
  mood?: Mood;
  /** His chest up a pixel (breathing in): body, arms, planks, head and hat. */
  breath?: number;
  /** The head a little further (a proud chin up). */
  headDy?: number;
  /** The tail's angle in degrees (negative: its end up). */
  tail?: number;
  /** Dust off the tail's slap, frames since it. */
  dust?: number;
}

function layers(p: Pose): Layer[] {
  const b = -(p.breath ?? 0);
  const hy = b + (p.headDy ?? 0);
  const L = (name: string, dx = 0, dy = 0): Layer => ({ part: name, x: AT[name]![0] + dx, y: AT[name]![1] + dy + OY });
  const tailDeg = Math.round(p.tail ?? -8);
  return [
    L(use("shadow", shadow)),
    L(use(`tail:${tailDeg}`, () => tail(tailDeg))),
    L(use("plankL", () => plank([13, 7], [63, 62], 4.2, 9)), 0, b),
    L(use("plankR", () => plank([72, 6], [30, 50], 4.2, 11)), 0, b),
    L(use("body", body), 0, b),
    L(use("thighR", () => thigh(50))),
    L(use("thighL", () => thigh(31))),
    L(use("footR", () => foot(51))),
    L(use("footL", () => foot(26))),
    L(use("hammer", hammer)),
    L(use("belt", belt)),
    L(use("tape", tape)),
    L(use("wrench", wrench)),
    L(use("pouches", pouches)),
    L(use("pouch2", pouch2)),
    L(use("armL", () => arm([SHOULDER_L, [21.5, 49], HAND_L], 3.2, 2.5, 0)), 0, b),
    L(use("armR", () => arm([SHOULDER_R, [59, 49.5], HAND_R], 3.2, 2.5, 0)), 0, b),
    L(use("pawL", () => paw(HAND_L[0], HAND_L[1])), 0, b),
    L(use("pawR", () => paw(HAND_R[0], HAND_R[1])), 0, b),
    L(use(`head:${p.mood ?? "smile"}`, () => head(p.mood ?? "smile")), 0, hy),
    L(use("hat", hat), 0, hy),
  ];
}

/** Whiskers off his snout (loose pixels, no outline), riding the head. */
function whiskers(dy: number): Speck[] {
  const w: Pt[] = [[15, 29], [14, 29], [13, 28], [12, 28], [15, 31], [14, 31], [13, 31], [12, 32]];
  return w.map(([x, y]): Speck => [x, y + dy, "i"]);
}
/** Dust puffing up off the ground where the tail slapped, `t` frames on. */
function dust(t: number): Speck[] {
  const out: Speck[] = [];
  const pts: Pt[] = [[74, GROUND - 2], [80, GROUND - 2], [70, GROUND - 1], [83, GROUND - 1], [77, GROUND - 3]];
  pts.forEach(([x, y], i) => {
    const dx = (i % 2 ? 1 : -1) * t;
    out.push([x + dx, y - t - (i % 3 === 0 ? 1 : 0), "D"]);
  });
  return out.filter(([x, y]) => x >= 1 && x < W - 1 && y >= 1 && y < H - 1);
}

const f = (ms: number, p: Pose): Frame => {
  const hy = -(p.breath ?? 0) + (p.headDy ?? 0);
  return { ms, layers: layers(p), specks: [...whiskers(hy + OY), ...(p.dust !== undefined ? dust(p.dust).map(([x, y, k]): Speck => [x, y + OY, k]) : [])] };
};

/**
 * Idle (about 4 s): he breathes slowly (his chest, arms, head and hat rise a pixel and settle), blinks, then gives
 * his tail a pat on the ground (up, and down with a puff of dust), and shuts his eyes a moment, pleased with himself.
 */
const BREATH = [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const TAIL = [-8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -12, -18, -22, -22, 0, -4, -7, -8, -8, -8, -8, -8, -8, -8];
const idle: Anim = {
  loop: true,
  frames: BREATH.map((br, i) => {
    const mood: Mood = i === 5 ? "blink" : i >= 15 && i <= 19 ? "proud" : "smile";
    return f(i === 5 ? 130 : i === 14 ? 120 : 170, {
      mood,
      breath: br,
      headDy: i >= 16 && i <= 18 ? -1 : 0,
      tail: TAIL[i],
      dust: i >= 14 && i <= 16 ? i - 14 : undefined,
    });
  }),
};

export const BOSS_BEAVER: Character = {
  id: "boss-beaver",
  name: "The Beaver Builder",
  w: W,
  h: H,
  foot: [40, GROUND + OY],
  palette: PALETTE,
  halo: "#2e2620",
  parts: PARTS,
  anims: { idle },
};
