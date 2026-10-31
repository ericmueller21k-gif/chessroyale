/**
 * Blitz, the speed-chess cheetah (concept, idle only). A lanky cheetah hustler of the park's speed-chess tables: gold-tan
 * fur with black spots, black tear marks, a cocky grin, a backwards cap, a teal and orange zip jacket, a white chess clock
 * (two faces, ticks only, a red flag) tucked under his front arm, his other paw slapping its button. Facing our left.
 */
import { canvas, inEllipse, inPoly, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#1a1210",
  a: "#7a4a14", // fur: shadow to highlight
  b: "#b9781f",
  c: "#e0a53a",
  d: "#f2c665",
  e: "#fbe0a0",
  f: "#c9b48e", // cream muzzle / chin
  g: "#efe2c4",
  h: "#fffaf0",
  s: "#241610", // spots, tear marks
  t: "#5a3a1c",
  A: "#0b4a4f", // teal jacket
  B: "#137a7a",
  C: "#22a8a0",
  D: "#6fd8c8",
  E: "#8a3208", // orange
  F: "#d2601a",
  G: "#f28a2a",
  H: "#ffb860",
  I: "#5d6470", // zip / greys
  J: "#a5adb8",
  L: "#8f96a3", // clock white: shadow to bright
  M: "#c9ced8",
  N: "#eef1f5",
  O: "#ffffff",
  R: "#b01a22", // flag red
  S: "#ee3b3b",
  "1": "#262a33", // clock buttons, ticks
  "2": "#4f5562",
  y: "#c8600c", // eyes
  Y: "#f59a22",
  x: "#120a06",
  w: "#ffffff",
  n: "#3a2320", // nose
  m: "#5a1f26", // mouth inside
  r: "#d4636e", // tongue
  z: "#0d0e12", // ground shadow
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
const E = inEllipse;

const W = 72;
const H = 104;
const GROUND = 99;

type P = { part: Part; at: Pt };
function painted(
  x0: number,
  y0: number,
  w: number,
  h: number,
  draw: (F: (inside: Inside, key: Key) => void, S: (rows: readonly string[], x: number, y: number) => void, Px: (x: number, y: number, k: string) => void) => void,
  outline = true,
): P {
  const cv: Canvas = canvas(w, h);
  const F = (inside: Inside, key: Key) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
  };
  const Px = (x: number, y: number, k: string) => {
    const X = Math.round(x) - x0;
    const Y = Math.round(y) - y0;
    if (cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
  };
  const S = (rows: readonly string[], sx: number, sy: number) =>
    rows.forEach((row, j) => [...row].forEach((k, i) => k !== "." && Px(sx + i, sy + j, k)));
  draw(F, S, Px);
  return { part: { grid: toGrid(cv), outline }, at: [x0, y0] };
}

// ---- tubes (limbs, tail)
function nearest(p: Pt, a: Pt, b: Pt) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function along(pts: readonly Pt[], r: readonly number[], p: Pt) {
  let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: r[0]! };
  pts.slice(1).forEach((q, i) => {
    const n = nearest(p, pts[i]!, q);
    const rr = r[i]! + (r[i + 1]! - r[i]!) * n.t;
    if (n.d - rr < best.d - best.rr) best = { s: (i + n.t) / (pts.length - 1), d: n.d, nx: n.nx, ny: n.ny, rr };
  });
  return best;
}
function tube(pts: readonly Pt[], r: readonly number[]) {
  const at = (x: number, y: number) => along(pts, r, [x + 0.5, y + 0.5]);
  const pad = Math.ceil(Math.max(...r)) + 2;
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
    s: (x: number, y: number) => at(x, y).s,
    edge: (x: number, y: number) => {
      const a = at(x, y);
      return a.d / a.rr;
    },
  };
}
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
const spotAt = (x: number, y: number) => (x * 7 + y * 11) % 13 === 0;

// ---- head
const HX = 36;
const HY = 31;
const SKULL = E(HX, HY, 12.5, 11);
const MUZZLE = E(28.2, 37.4, 5.6, 3.9);
const NOSEB = E(23.6, 35, 2.2, 1.7);
const CHIN = E(30.5, 40.2, 4.4, 2.4);
const RUFF = inPoly([[44, 33], [50.5, 36], [47.5, 37.5], [49.5, 40.5], [44, 41.5], [41, 39]]);
const HEAD_SPOTS: Pt[] = [[30, 24], [40, 24], [41, 24], [44, 26], [46, 29], [47, 30], [43, 30], [47, 34], [45, 37], [41, 34], [42, 34], [39, 38], [35, 24], [27, 27], [44, 22], [38, 27], [40, 31], [44, 33], [36, 36], [38, 34]];

function head(): P {
  const light = (x: number, y: number) => 0.62 - 0.4 * ((x + 0.5 - 33) / 13) - 0.5 * ((y + 0.5 - 27) / 12);
  return painted(17, 18, 36, 27, (F, S, Px) => {
    F(union(SKULL, RUFF, MUZZLE, NOSEB, CHIN), (x, y) => {
      const l = light(x, y);
      if ((MUZZLE(x, y) || NOSEB(x, y)) && y < 36 && !CHIN(x, y)) return ramp(FUR, l + 0.25);
      if (MUZZLE(x, y) || NOSEB(x, y) || CHIN(x, y)) return ramp(CREAM, l + 0.15);
      if (RUFF(x, y) && !SKULL(x, y)) return ramp(CREAM, l + 0.05);
      return ramp(FUR, l + 0.1);
    });
    // cream under the eyes
    F(union(E(34.5, 31.2, 3, 1.3), E(25.5, 30.8, 1.8, 1.1)), () => "g");
    for (const [x, y] of HEAD_SPOTS) Px(x, y, "s");
    Px(45, 31, "s");
    Px(31, 23, "t");
    // nose
    S(["nnn", ".n."], 22, 34);
    Px(23, 33, "e");
    // tear marks: bold, from each eye's inner corner down to the mouth corner
    S(["..ss", "..ss", ".ss.", ".ss.", "ss..", "ss.."], 30, 30);
    for (const [x, y] of [[25, 30], [25, 31], [24, 32]] as Pt[]) Px(x, y, "s");
    // whisker dots
    for (const [x, y] of [[25, 37], [27, 37], [26, 38]] as Pt[]) Px(x, y, "t");
  });
}

type Mouth = "smirk" | "grin";
function mouth(kind: Mouth): P {
  return painted(20, 35, 12, 8, (_F, S) => {
    if (kind === "smirk") S(["...s........", "....s....ss.", ".....ssss..."], 20, 36);
    else S(["...s........", "...ssssssss.", "...shhhhhhs.", "....smmrrs..", ".....ssss..."], 20, 36);
  }, false);
}

type Eyes = "open" | "half" | "shut" | "wide";
function eyes(lid: Eyes, look = 0): P {
  // near eye 5 wide at (32,26), far eye 3 wide at (24,26)
  const near: Record<Eyes, string[]> = {
    open: [".sssss.", "sYxxwhs", "sYxxYhs", "syyyyhs", ".sssss."],
    wide: [".sssss.", "sYYYYws", "sYxxYYs", "syxxyys", ".sssss."],
    half: [".......", "sssssss", "sYxxYYs", "syyyyys", ".sssss."],
    shut: [".......", ".......", ".......", "sssssss", ".sssss."],
  };
  const far: Record<Eyes, string[]> = {
    open: [".ss", "sws", "sxs", "sxy", ".ss"],
    wide: [".ss", "sYs", "sxs", "sxy", ".ss"],
    half: ["...", "sss", "sxs", "sxy", ".ss"],
    shut: ["...", "...", "...", "sss", ".ss"],
  };
  return painted(22, 23, 18, 8, (_F, S) => {
    S(near[lid], 31 + look, 25);
    S(far[lid], 24, 25);
  }, false);
}

function brow(up: number): P {
  return painted(22, 21, 18, 6, (_F, S) => {
    S(["...ssss", "ssss..."], 31, 22 - up);
    S(["ss"], 24, 23 - up);
  }, false);
}

function ear(cx: number, cy: number, far: boolean): P {
  return painted(Math.floor(cx) - 4, Math.floor(cy) - 4, 9, 9, (F) => {
    F(E(cx, cy, 3, 3.4), (x, y) => {
      if (E(cx + 0.3, cy + 0.6, 1.6, 2)(x, y)) return far ? "t" : "s";
      return far ? "b" : "d";
    });
  });
}

function cap(): P {
  const dome: Inside = (x, y) => y + 0.5 <= 23.5 && E(37, 23.5, 12.6, 8.6)(x, y);
  const brim = inPoly([[46.5, 20.5], [55, 20.5], [58.5, 22], [58, 24.3], [47, 24.3]]);
  return painted(23, 12, 37, 14, (F, S, Px) => {
    F(brim, (x, y) => (y < 22 ? "C" : y < 23 ? "B" : "A"));
    F(dome, (x, y) => {
      if (y >= 22) return x < 33 ? "G" : x < 43 ? "F" : "E";
      const l = 0.6 - 0.45 * ((x + 0.5 - 35) / 12) - 0.5 * ((y + 0.5 - 17) / 7);
      return ramp(ORANGE, l);
    });
    // seams to the button, and the strap gap at the front (it's on backwards)
    for (const [x, y] of [[36, 16], [35, 17], [34, 18], [33, 19], [33, 20], [32, 21]] as Pt[]) Px(x, y, "E");
    for (const [x, y] of [[39, 16], [41, 17], [42, 18], [43, 19], [44, 20]] as Pt[]) Px(x, y, "E");
    S(["CD"], 37, 14);
    S(["kk", "ck"], 25, 22);
  });
}

// ---- body
function torso(): P {
  const poly = inPoly([[29, 45], [46, 45], [50.5, 48.5], [51, 58], [49.5, 72], [30.5, 72], [29.5, 58], [27, 49]]);
  const collar = inPoly([[30, 42.4], [44.5, 42.4], [46.5, 46.5], [29, 46.5]]);
  return painted(25, 41, 28, 33, (F, S, Px) => {
    F(poly, (x, y) => {
      const l = 0.66 - 0.035 * (x - 30) - 0.012 * (y - 50);
      if (y >= 69) return ramp(ORANGE, l);
      if (y < 53 + (x - 30) * 0.18) return ramp(ORANGE, l + 0.1);
      if (Math.abs(y - (53.6 + (x - 30) * 0.18)) < 0.6) return "D";
      return ramp(TEAL, l + 0.05);
    });
    F(collar, (x) => (x < 33 ? "D" : x < 42 ? "C" : "B"));
    for (let y = 46; y < 72; y++) Px(36, y, y < 69 ? "J" : "I");
    S(["O", "J"], 37, 49);
    S(["D"], 31, 47);
  });
}

function shorts(): P {
  const poly = inPoly([[30.5, 71], [49.5, 71], [50.5, 79.5], [41.5, 80], [40, 77], [38.5, 80], [29.5, 79.5]]);
  return painted(28, 70, 24, 12, (F) =>
    F(poly, (x, y) => {
      if (x >= 47 && x <= 48) return "G";
      return ramp(TEAL, 0.6 - 0.03 * (x - 32) - 0.02 * (y - 72));
    }),
  );
}

function arm(sh: Pt, el: Pt, wr: Pt, paw: Pt, dark: number): P {
  const t = tube([sh, el, wr], [3.2, 2.8, 2.5]);
  const pawIn = E(paw[0], paw[1], 2.8, 2.6);
  const [bx, by, bw, bh] = t.box;
  const x0 = Math.min(bx, Math.floor(paw[0]) - 4);
  const y0 = Math.min(by, Math.floor(paw[1]) - 4);
  const x1 = Math.max(bx + bw, Math.ceil(paw[0]) + 4);
  const y1 = Math.max(by + bh, Math.ceil(paw[1]) + 4);
  return painted(x0, y0, x1 - x0, y1 - y0, (F, _S, Px) => {
    F(union(t.inside, pawIn), (x, y) => {
      if (pawIn(x, y) && (!t.inside(x, y) || t.s(x, y) > 0.95)) {
        const l = 0.6 - 0.3 * ((x + 0.5 - paw[0]) / 2.8) - 0.3 * ((y + 0.5 - paw[1]) / 2.6) - dark;
        return ramp(FUR, l + 0.1);
      }
      const l = t.light(x, y) - dark;
      if (t.s(x, y) > 0.82) return ramp(ORANGE, l);
      if (Math.abs(t.edge(x, y)) < 0.3 && t.s(x, y) > 0.1 && t.light(x, y) > 0.55) return dark ? "C" : "D";
      return ramp(TEAL, l);
    });
    Px(paw[0] - 1, paw[1] + 1, "t");
    Px(paw[0] + 1, paw[1] + 1, "t");
  });
}

function leg(hip: Pt, knee: Pt, ankle: Pt, dark: number): P {
  const t = tube([hip, knee, ankle], [3, 2.4, 2]);
  return painted(...t.box, (F) =>
    F(t.inside, (x, y) => {
      const l = t.light(x, y) - dark;
      if (t.s(x, y) > 0.86) return ramp("MNO", l);
      if (spotAt(x, y) && t.edge(x, y) < 0.8) return "s";
      return ramp(FUR, l + 0.05);
    }),
  );
}

function shoe(ax: number, tip: boolean, dark: boolean): P {
  const n = dark ? "M" : "N";
  const o = dark ? "N" : "O";
  const flat = [`...${o}${o}${o}${n}..`, `.${o}${o}${o}${o}${n}${n}${n}M`, `${o}${o}G${n}${n}${n}${n}MM`, "FFFFFFFFF"];
  const toe = [`....${o}${o}${n}.`, `..${o}${o}${o}${n}${n}M`, `.${o}${o}G${n}${n}MM`, `${o}${o}${n}${n}${n}MF.`, "FFFFF...."];
  const rows = tip ? toe : flat;
  const x0 = Math.round(ax) - 5;
  const y0 = GROUND - rows.length;
  return painted(x0, y0, 10, rows.length, (_F, S) => S(rows, x0, y0));
}

function tail(flick: number): P {
  const a = flick * 0.32;
  const base: Pt[] = [[49, 70], [55, 72.5], [60.5, 69.5], [62.5, 63]];
  const [px, py] = base[3]!;
  const ext: Pt[] = [
    [px + Math.sin(a) * 1 - 0.3, py - 4.5 * Math.cos(a * 0.6)],
    [px + Math.sin(a) * 4 - 1.5, py - 8.5 + Math.abs(a) * 1.2],
  ];
  const pts = [...base, ...ext];
  const t = tube(pts, [2.4, 2.2, 2, 1.8, 1.6, 1.5]);
  const len = pts.slice(1).reduce((n, q, i) => n + Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]), 0);
  return painted(...t.box, (F) =>
    F(t.inside, (x, y) => {
      const s = t.s(x, y) * len;
      if (s > len - 1.6) return "h";
      if (s > len - 9 && (s - (len - 9)) % 2.6 < 1.2) return "s";
      if (s < len - 9 && spotAt(x, y) && t.edge(x, y) < 0.8) return "s";
      return ramp(FUR, t.light(x, y) + 0.05);
    }),
  );
}

// ---- the chess clock
function clockBody(): P {
  const faceL = E(14, 63.5, 4.6, 4.6);
  const faceR = E(24.5, 63.5, 4.6, 4.6);
  return painted(7, 56, 25, 15, (F, S, Px) => {
    F((x, y) => x >= 8 && x <= 30 && y >= 57 && y <= 69, (x, y) => (y === 57 ? "O" : x === 30 || y === 69 ? "L" : x === 29 || y === 68 ? "M" : "N"));
    F(union(faceL, faceR), (x, y) => {
      const L = faceL(x, y);
      const cx = L ? 14 : 24.5;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 63.5);
      return d > 3.6 ? "2" : "O";
    });
    // ticks (no numerals) and hands
    for (const cx of [14, 24]) {
      const c = cx === 14 ? 14 : 24;
      Px(c, 60, "1");
      Px(c, 66, "1");
      Px(c - 3, 63, "1");
      Px(c + 3, 63, "1");
      Px(c, 63, "1");
    }
    S(["1", "1"], 14, 61);
    Px(15, 64, "1");
    S(["1", "1"], 24, 61);
    Px(23, 64, "1");

    // a little divider between faces
    Px(19, 59, "M");
    Px(19, 67, "M");
  });
}
function button(x: number, pressed: boolean): P {
  const y = pressed ? 55 : 54;
  return painted(x, y, 5, 2, (_F, S) => S(["21111", "11111"].slice(0, pressed ? 2 : 2), x, y));
}
/** The red flag on the left face, hanging from its top: -1, 0, 1 its wobble. */
function flag(w: number): P {
  // a red flag standing up from the top of the left face, pivoting at its foot
  const rows = w === 0 ? ["SS", "SR", "R."] : w > 0 ? [".SS", "SR.", "R.."] : ["SS.", ".SR", ".R."];
  return painted(12, 55, 5, 5, (_F, S) => S(rows, w < 0 ? 13 : 14, 57), true);
}
function shadow(): Part {
  const cv = canvas(36, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 36; x++) if (E(18, 1.5, 18, 1.6)(x, y)) cv[y]![x] = "z";
  return { grid: toGrid(cv), outline: false };
}

// ---- rig
const { parts: PARTS, add } = lazyParts();
add("shadow", shadow);
const placedAt = new Map<string, Pt>();
function placed(name: string, make: () => P): { name: string; at: Pt } {
  let at = placedAt.get(name);
  if (!at) {
    const m = make();
    add(name, () => m.part);
    placedAt.set(name, (at = m.at));
  }
  return { name, at };
}

interface Pose {
  /** On his toes: everything but the shoes up this many pixels. */
  lift?: number;
  /** A knee bend: body down this many pixels. */
  sink?: number;
  tail?: number;
  /** The slapping paw: rest (hovering), up (wound up), down (on the button). */
  hand?: "rest" | "up" | "high" | "down";
  flag?: number;
  eyes?: Eyes;
  look?: number;
  brow?: number;
  mouth?: Mouth;
  head?: Pt;
}

const HANDS: Record<string, Pt> = { rest: [28, 52], up: [30, 44], high: [27, 47], down: [25.5, 54] };

function layers(pose: Pose = {}): Layer[] {
  const lift = pose.lift ?? 0;
  const sink = pose.sink ?? 0;
  const dy = sink - lift;
  const hd = pose.head ?? [0, 0];
  const at = (pl: { name: string; at: Pt }, x = 0, y = 0): Layer => ({ part: pl.name, x: pl.at[0] + x, y: pl.at[1] + y });
  const B = (pl: { name: string; at: Pt }) => at(pl, 0, dy);
  const Hd = (pl: { name: string; at: Pt }) => at(pl, hd[0], dy + hd[1]);
  // legs: ankles on the ground (or up with the heels), knees bend forward when he sinks
  const legOf = (hip: Pt, ankle: Pt, dark: number, nm: string) => {
    const h: Pt = [hip[0], hip[1] + sink];
    const kn = elbowOf(h, ankle, [10, 10.2], false);
    const key = `${nm}:${sink}`;
    return at(placed(key, () => leg(h, kn, ankle, dark)), 0, -lift);
  };
  const ankleY = 94;
  const hand = HANDS[pose.hand ?? "rest"]!;
  const sh: Pt = [47, 50];
  const wr: Pt = [hand[0] + 2.2, hand[1] + 0.6];
  const el = elbowOf(sh, wr, [11, 11]);
  const pressed = pose.hand === "down";
  return [
    { part: "shadow", x: 22, y: GROUND - 2 },
    B(placed(`tail:${pose.tail ?? 0}`, () => tail(pose.tail ?? 0))),
    legOf([37, 76], [35, ankleY], 0.18, "legF"),
    at(placed(`shoeF:${lift > 0}`, () => shoe(35, lift > 0, true))),
    legOf([44, 76], [45, ankleY], 0, "legN"),
    at(placed(`shoeN:${lift > 0}`, () => shoe(45, lift > 0, false))),
    B(placed("shorts", shorts)),
    B(placed("armF", () => arm([30, 50], [24, 59], [17, 67.5], [14.5, 69], 0.2))),
    B(placed("torso", torso)),
    Hd(placed("earF", () => ear(26.5, 17, true))),
    Hd(placed("earN", () => ear(46.5, 15.5, false))),
    Hd(placed("head", head)),
    Hd(placed(`mouth:${pose.mouth ?? "smirk"}`, () => mouth(pose.mouth ?? "smirk"))),
    Hd(placed(`eyes:${pose.eyes ?? "open"}:${pose.look ?? 0}`, () => eyes(pose.eyes ?? "open", pose.look ?? 0))),
    Hd(placed(`brow:${pose.brow ?? 0}`, () => brow(pose.brow ?? 0))),
    Hd(placed("cap", cap)),
    B(placed("clock", clockBody)),
    B(placed("btnL", () => button(11, false))),
    B(placed(`btnR:${pressed}`, () => button(22, pressed))),
    B(placed(`flag:${pose.flag ?? 0}`, () => flag(pose.flag ?? 0))),
    B(placed(`armN:${pose.hand ?? "rest"}`, () => arm(sh, el, wr, hand, 0))),
  ];
}

const F = (ms: number, pose: Pose = {}, extra: Partial<Frame> = {}): Frame => ({ ms, layers: layers(pose), ...extra });

/** A click: little white tick marks flying off the slapped button. */
const click = (dy: number): Speck[] => [
  [21, 52 + dy, "O"],
  [20, 51 + dy, "O"],
  [28, 51 + dy, "O"],
  [29, 50 + dy, "O"],
  [24, 50 + dy, "Y"],
];

// Idle, 32 frames of 110 ms (3.5 s): bouncing on his toes every 4 frames, his tail flicking fast, two slaps of the
// clock (the button clicks down, the flag wobbles), a grin and an eyebrow wiggle between them, a blink near the end.
const LIFT = [0, 1, 2, 1];
const TAIL = [0, 2, 3, 1, -1, -2, -1, 1];
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 32 }, (_, i) => {
    const slapAt = i >= 4 && i <= 8 ? i - 4 : i >= 20 && i <= 24 ? i - 20 : -1;
    const hand = slapAt === 0 ? "high" : slapAt === 1 ? "up" : slapAt === 2 || slapAt === 3 ? "down" : slapAt === 4 ? "high" : "rest";
    const since = i >= 6 && i <= 11 ? i - 6 : i >= 22 && i <= 27 ? i - 22 : -1;
    const flagW = since >= 0 ? [1, -1, 1, -1, 1, 0][since]! : 0;
    const grin = i >= 12 && i <= 17;
    const brow = i >= 13 && i <= 16 ? [1, 0, 1, 0][i - 13]! : slapAt === 2 ? 1 : 0;
    const lift = hand === "down" ? 0 : LIFT[i % 4]!;
    return F(
      110,
      {
        lift,
        sink: hand === "down" && slapAt === 2 ? 1 : 0,
        tail: TAIL[i % 8]!,
        hand,
        flag: flagW,
        mouth: grin || slapAt >= 2 ? "grin" : "smirk",
        brow,
        eyes: i === 29 ? "shut" : i === 30 ? "half" : "open",
        look: grin ? 0 : 0,
        head: [0, hand === "down" ? 1 : 0],
      },
      slapAt === 2 ? { cue: "click", specks: click(1) } : {},
    );
  }),
};

export const BOSS_BLITZ: Character = {
  id: "boss-blitz",
  name: "Blitz",
  w: W,
  h: H,
  foot: [40, GROUND],
  palette: PALETTE,
  halo: "#3a2e22",
  parts: PARTS,
  anims: { idle },
};
