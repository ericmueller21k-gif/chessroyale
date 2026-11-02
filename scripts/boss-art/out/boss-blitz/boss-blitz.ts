/**
 * Blitz, the speed-chess cheetah (concept, idle only). A lanky cheetah hustler of the park's speed-chess tables: gold-tan
 * fur with black spots, black tear marks, a cocky grin, a backwards cap, a teal and orange zip jacket, a white chess clock
 * (two faces, ticks only, a red flag) tucked under his front arm, his other paw slapping its button. Facing our left.
 */
import { canvas, inEllipse, inPoly, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import { lazyParts, partSize, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../../../../packages/app/src/characters/sprite.ts";

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
  W: "#a8e4ff", // sweat (his animations only)
  V: "#4fa3e0",
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

// ---- parts for his animations (the concept's parts above stay as they are)
type Gesture = "fist" | "point" | "open";
/** The near arm again, with its paw as a fist, a finger gun (index finger toward the board, thumb up) or flat open. */
function limb(sh: Pt, el: Pt, wr: Pt, paw: Pt, dark: number, g: Gesture): P {
  const t = tube([sh, el, wr], [3.2, 2.8, 2.5]);
  const pawIn = g === "open" ? E(paw[0], paw[1], 3.5, 2.3) : E(paw[0], paw[1], 2.8, 2.6);
  const [bx, by, bw, bh] = t.box;
  const x0 = Math.min(bx, Math.floor(paw[0]) - 9);
  const y0 = Math.min(by, Math.floor(paw[1]) - 6);
  const x1 = Math.max(bx + bw, Math.ceil(paw[0]) + 5);
  const y1 = Math.max(by + bh, Math.ceil(paw[1]) + 5);
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
    const px = Math.round(paw[0]);
    const py = Math.round(paw[1]);
    if (g === "point") {
      for (let i = 2; i <= 5; i++) Px(px - i, py - 1, i === 5 ? "e" : "d");
      Px(px - 1, py - 3, "e");
      Px(px - 1, py - 2, "d");
      Px(px - 1, py + 1, "t");
    } else if (g === "open") {
      for (const dx of [-2, 0, 2]) Px(px + dx, py + 1, "t");
    } else {
      Px(paw[0] - 1, paw[1] + 1, "t");
      Px(paw[0] + 1, paw[1] + 1, "t");
    }
  });
}

type Mouth2 = Mouth | "wide" | "o" | "frown" | "yawn" | "flat" | "grimace";
const MOUTHS: Record<Exclude<Mouth2, Mouth>, string[]> = {
  wide: ["...s........", "...sssssssss", "...shhhhhhhs", "...smmmmrrs.", "....smmrrs..", ".....ssss..."],
  o: ["...s........", "....sss.....", "...smmms....", "...smrms....", "....sss....."],
  frown: ["...s........", "....s.......", ".....s.ss.s.", "......s..s.."],
  yawn: ["...s........", "...sssssss..", "...shmmmhs..", "...smmmmms..", "...smmrrms..", "....smmms...", ".....sss...."],
  flat: ["...s........", "....sssssss."],
  grimace: ["...s........", "...ssssssss.", "...shshshhs.", "...ssssssss."],
};
function mouth2(kind: Exclude<Mouth2, Mouth>): P {
  return painted(20, 35, 12, 8, (_F, S) => S(MOUTHS[kind], 20, 36), false);
}

type Eyes2 = Eyes | "us" | "up" | "down" | "joy" | "wink" | "sly";
const OLD_EYES: readonly string[] = ["open", "half", "shut", "wide"];
const NEAR2: Record<Exclude<Eyes2, Eyes>, string[]> = {
  us: [".sssss.", "sYwxxhs", "sYYxxYs", "syyyyys", ".sssss."],
  up: [".sssss.", "sYYxxws", "sYYYYYs", "syyyyys", ".sssss."],
  down: [".sssss.", "sYYYwhs", "sxxYYYs", "sxxyyys", ".sssss."],
  joy: [".......", "..sss..", ".s...s.", "s.....s", "......."],
  wink: [".......", "..sss..", ".s...s.", "s.....s", "......."],
  sly: [".......", "sssssss", "sYYxxYs", "syyxxys", ".sssss."],
};
const FAR2: Record<Exclude<Eyes2, Eyes>, string[]> = {
  us: [".ss", "sws", "sxs", "sxy", ".ss"],
  up: [".ss", "sxs", "sws", "syy", ".ss"],
  down: [".ss", "sYs", "sws", "sxx", ".ss"],
  joy: ["...", ".s.", "s.s", "...", "..."],
  wink: [".ss", "sws", "sxs", "sxy", ".ss"],
  sly: ["...", "sss", "sxs", "sxy", ".ss"],
};
function eyes2(lid: Exclude<Eyes2, Eyes>, look = 0): P {
  return painted(22, 23, 18, 8, (_F, S) => {
    S(NEAR2[lid], 31 + look, 25);
    S(FAR2[lid], 24, 25);
  }, false);
}
/** Worried brows: the inner ends up. */
function browWorry(): P {
  return painted(22, 21, 18, 6, (_F, S) => {
    S(["sss....", "..sssss"], 31, 23);
    S([".s", "s."], 24, 23);
  }, false);
}
/** The flag fallen: out of time, hanging down over the left face. */
function flagDown(): P {
  return painted(10, 56, 7, 7, (_F, S) => S(["..R", ".R.", "SS.", "SR."], 12, 58), true);
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
  mouth?: Mouth2;
  head?: Pt;
  /** For his animations: the near paw anywhere, and its shape. */
  at?: Pt;
  gesture?: Gesture;
  /** A second near arm, its blur (the frenzy). */
  blur?: Pt;
  /** The right button down (default: when the hand is "down"). */
  press?: boolean;
  /** The flag jumps up this many pixels; or it has fallen (out of time). */
  flagY?: number;
  fallen?: boolean;
  /** The clock (and the far paw under it) moved; spun by quarter turns about its middle. */
  clock?: Pt;
  spin?: number;
  /** The far paw away from the clock. */
  pawF?: Pt;
  eyes2?: Eyes2;
  worry?: boolean;
  /** Ears back: 0 up, 3 flat. */
  ears?: number;
  /** The cap knocked about. */
  capAt?: Pt;
  /** The whole of him moved sideways (zipping in). */
  dx?: number;
}
const r2 = (v: number) => Math.round(v * 2) / 2;
const toward = (p: Pt, q: Pt, d: number): Pt => {
  const n = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  return [p[0] + ((q[0] - p[0]) / n) * d, p[1] + ((q[1] - p[1]) / n) * d];
};
/** A layer turned by quarter turns (clockwise) about the pixel corner (cx, cy). */
function turnAbout(l: Layer, cx: number, cy: number, q: number): Layer {
  let [w, h] = partSize(PARTS[l.part]!);
  let x = l.x;
  let y = l.y;
  for (let i = 0; i < q; i++) {
    const nx = cx + cy - y - h;
    const ny = cy - cx + x;
    x = nx;
    y = ny;
    [w, h] = [h, w];
  }
  return { ...l, x: Math.round(x), y: Math.round(y), rot: (q % 4) as 0 | 1 | 2 | 3 };
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
  const pressed = pose.press ?? pose.hand === "down";
  const g = pose.gesture ?? "fist";
  // the near arm: the concept's own for a named hand, or anywhere (`at`) with a gesture
  const nearArm = (paw: Pt | undefined): Layer => {
    if (!paw && g === "fist") return B(placed(`armN:${pose.hand ?? "rest"}`, () => arm(sh, el, wr, hand, 0)));
    const p = paw ?? hand;
    const w2: Pt = paw ? toward(p, sh, 2.3) : wr;
    const bone = Math.max(11, Math.hypot(w2[0] - sh[0], w2[1] - sh[1]) / 2 + 0.4);
    const e2 = elbowOf(sh, w2, [bone, bone]);
    return B(placed(`armN:${r2(p[0])},${r2(p[1])}:${g}`, () => limb(sh, e2, w2, p, 0, g)));
  };
  // the far arm: the concept's own, or reaching wherever the clock (or the paw) is
  const clk = pose.clock ?? [0, 0];
  const farArm = (): Layer => {
    if (!pose.clock && !pose.pawF) return B(placed("armF", () => arm([30, 50], [24, 59], [17, 67.5], [14.5, 69], 0.2)));
    const shF: Pt = [30, 50];
    const paw: Pt = pose.pawF ?? [14.5 + clk[0], 69 + clk[1]];
    const w2 = toward(paw, shF, 2.5);
    const bone = Math.max(11, Math.hypot(w2[0] - shF[0], w2[1] - shF[1]) / 2 + 0.4);
    const e2 = elbowOf(shF, w2, [bone, bone], paw[1] > shF[1] - 6);
    return B(placed(`armF:${r2(paw[0])},${r2(paw[1])}`, () => arm(shF, e2, w2, paw, 0.2)));
  };
  const C = (pl: { name: string; at: Pt }, y = 0) => at(pl, clk[0], dy + clk[1] + y);
  let clockL: Layer[] = [
    C(placed("clock", clockBody)),
    C(placed("btnL", () => button(11, false))),
    C(placed(`btnR:${pressed}`, () => button(22, pressed))),
    pose.fallen ? C(placed("flagDown", flagDown)) : C(placed(`flag:${pose.flag ?? 0}`, () => flag(pose.flag ?? 0)), -(pose.flagY ?? 0)),
  ];
  if (pose.spin) clockL = clockL.map((l) => turnAbout(l, 19.5 + clk[0], 63.5 + dy + clk[1], pose.spin!));
  const ears = pose.ears ?? 0;
  const Ear = (pl: { name: string; at: Pt }) => at(pl, hd[0] + Math.round(ears * 0.7), dy + hd[1] + ears);
  const mk = pose.mouth ?? "smirk";
  const lid = pose.eyes2 ?? pose.eyes ?? "open";
  const look = pose.look ?? 0;
  const cp = pose.capAt ?? [0, 0];
  const out: Layer[] = [
    { part: "shadow", x: 22, y: GROUND - 2 },
    B(placed(`tail:${pose.tail ?? 0}`, () => tail(pose.tail ?? 0))),
    legOf([37, 76], [35, ankleY], 0.18, "legF"),
    at(placed(`shoeF:${lift > 0}`, () => shoe(35, lift > 0, true))),
    legOf([44, 76], [45, ankleY], 0, "legN"),
    at(placed(`shoeN:${lift > 0}`, () => shoe(45, lift > 0, false))),
    B(placed("shorts", shorts)),
    farArm(),
    B(placed("torso", torso)),
    Ear(placed("earF", () => ear(26.5, 17, true))),
    Ear(placed("earN", () => ear(46.5, 15.5, false))),
    Hd(placed("head", head)),
    Hd(placed(`mouth:${mk}`, () => (mk === "smirk" || mk === "grin" ? mouth(mk) : mouth2(mk)))),
    Hd(placed(`eyes:${lid}:${look}`, () => (OLD_EYES.includes(lid) ? eyes(lid as Eyes, look) : eyes2(lid as Exclude<Eyes2, Eyes>, look)))),
    pose.worry ? Hd(placed("browWorry", browWorry)) : Hd(placed(`brow:${pose.brow ?? 0}`, () => brow(pose.brow ?? 0))),
    at(placed("cap", cap), hd[0] + cp[0], dy + hd[1] + cp[1]),
    ...clockL,
    ...(pose.blur ? [nearArm(pose.blur)] : []),
    nearArm(pose.at),
  ];
  const dx = pose.dx ?? 0;
  return dx ? out.map((l) => ({ ...l, x: l.x + dx })) : out;
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

// ---- His animations. Fast guy: short frames, snappy moves, clear held poses.

/** A hit: every color goes pale. */
const FLASH: Record<string, string> = Object.fromEntries(
  Object.entries(PALETTE)
    .filter(([k]) => !["k", "z", "x", "s"].includes(k))
    .map(([k, c]) => {
      const n = parseInt(c.slice(1), 16);
      const mix = (v: number) => Math.round(v + (255 - v) * 0.55).toString(16).padStart(2, "0");
      return [k, `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`];
    }),
);
const sp = (x: number, y: number, k: string): Speck => [Math.round(x), Math.round(y), k];
const shift = (s: readonly Speck[], dx: number, dy: number): Speck[] => s.map(([x, y, k]) => [x + dx, y + dy, k]);
/** The idle's click, for a clock moved by (ox, oy). */
const clickAt = (ox: number, oy: number): Speck[] => shift(click(0), ox, oy);
/** A twinkle: a white dot with four arms. */
const star = (x: number, y: number, big = false): Speck[] => [
  sp(x, y, "O"),
  ...[[-1, 0], [1, 0], [0, -1], [0, 1]].map(([a, b]) => sp(x + a!, y + b!, "Y")),
  ...(big ? [[-2, 0], [2, 0], [0, -2], [0, 2]].map(([a, b]) => sp(x + a!, y + b!, "H")) : []),
];
/** A speed streak from (x, y), `len` long, toward `dir` (1 right, -1 left): bright at its head, fading. */
const streak = (x: number, y: number, len: number, dir: number): Speck[] =>
  Array.from({ length: len }, (_, i) => sp(x + i * dir, y, i < len * 0.2 ? "O" : i < len * 0.5 ? "N" : i < len * 0.8 ? "M" : "J")).filter(([px]) => px >= 1 && px < W - 1);
/** Speed lines across him as he zips in, starting at x0 and running off to the right. */
const zip = (x0: number, ys: readonly number[]): Speck[] => ys.flatMap((y, i) => streak(x0 + (i % 3) * 3, y, 20 + (i % 2) * 8, 1));
/** The big slap's sparks off the button (clock at its place, the body down dy): `t` 0 the burst, 1 spread. */
const bigClick = (dy: number, t: number, ox = 0): Speck[] => {
  const cx = 24 + ox;
  const cy = 53 + dy;
  const rays: Pt[] = [[-1, -1], [1, -1], [0, -1], [-1.6, -0.3], [1.6, -0.3]];
  const out: Speck[] = [];
  for (const [rx, ry] of rays) for (let d = 0; d < 4; d++) out.push(sp(cx + rx * (3 + t * 3 + d), cy + ry * (3 + t * 3 + d), t ? ["Y", "H", "H", "J"][d]! : ["O", "O", "Y", "H"][d]!));
  if (!t) out.push(...star(cx - 8, cy - 6), ...star(cx + 8, cy - 7));
  else out.push(sp(cx - 10, cy - 9, "Y"), sp(cx + 10, cy - 10, "Y"));
  return out;
};
/** Dust kicked up in front of his feet as he skids, `t` a frame (it spreads and settles). */
const dust = (t: number, dx = 0): Speck[] => {
  const out: Speck[] = [];
  for (let i = 0; i < (t > 1 ? 3 : 4); i++) {
    const x = 29 + dx - i * 3 - t * 2;
    const y = 97 - (i % 2) - Math.floor(t / 2);
    out.push(sp(x, y, t < 2 ? "N" : "M"), sp(x - 1, y, "M"), sp(x, y - 1, t < 2 ? "M" : "J"));
  }
  return out;
};
/** A drop of sweat. */
const sweat = (x: number, y: number): Speck[] => [sp(x, y, "W"), sp(x - 1, y + 1, "W"), sp(x, y + 1, "O"), sp(x - 1, y + 2, "V"), sp(x, y + 2, "W")];
/** The stolen time: a tiny clock face (a ring of gold, a white hand at `ph` 0-3) with a trail behind it. */
const tinyClock = (x: number, y: number, ph: number, from?: Pt): Speck[] => {
  const ring: Pt[] = [[-1, -2], [0, -2], [1, -2], [2, -1], [2, 0], [2, 1], [1, 2], [0, 2], [-1, 2], [-2, 1], [-2, 0], [-2, -1]];
  const hand: Pt = ([[0, -1], [1, 0], [0, 1], [-1, 0]] as Pt[])[ph % 4]!;
  const trail: Speck[] = from ? [0.25, 0.5, 0.75].map((f, i) => sp(from[0] + (x - from[0]) * f, from[1] + (y - from[1]) * f, ["J", "M", "H"][i]!)) : [];
  return [...trail, ...ring.map(([a, b]) => sp(x + a, y + b, "Y")), sp(x, y, "O"), sp(x + hand[0], y + hand[1], "O")];
};
/** The finger gun's speed streaks, back from the fingertip toward the board. */
const POINT: Pt = [21, 48];
const pointLines = (dy: number, len = 1): Speck[] => {
  const tx = Math.round(POINT[0]) - 7;
  const ty = Math.round(POINT[1]) - 1 + dy;
  return [...streak(tx, ty, Math.round(14 * len), -1), ...streak(tx - 2, ty - 3, Math.round(8 * len), -1), ...streak(tx - 2, ty + 3, Math.round(8 * len), -1)];
};

/** Entrance: speed lines, he zips in from the right in a blur, skids to a stop in a cloud of dust, slaps the clock, a grin at us. */
const ZIP_YS = [32, 40, 50, 58, 70, 80, 90];
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 90, layers: [], specks: zip(6, ZIP_YS), cue: "zip" },
    F(60, { dx: 36, lift: 2, tail: 4, ears: 2, eyes: "wide", head: [1, 0], hand: "up" }, { specks: zip(30, ZIP_YS) }),
    F(60, { dx: 14, lift: 1, tail: 4, ears: 2, eyes: "wide", head: [1, 0], hand: "up" }, { specks: zip(40, [36, 52, 66, 84]) }),
    F(100, { dx: -3, sink: 2, head: [2, 0], ears: 1, eyes: "wide", mouth: "o", tail: 3, hand: "up" }, { cue: "skid", shake: [-1, 0], specks: [...dust(0, -3), ...streak(58, 60, 10, 1), ...streak(60, 76, 8, 1)] }),
    F(90, { dx: -1, sink: 1, head: [1, 0], tail: 2, hand: "high" }, { specks: dust(1, -1) }),
    F(90, { tail: 1 }, { specks: dust(2) }),
    F(80, { hand: "high", lift: 1, brow: 1 }, { specks: dust(3) }),
    F(80, { hand: "up", lift: 2, brow: 1 }),
    F(130, { hand: "down", sink: 1, head: [0, 1], mouth: "grin", brow: 1, flag: 1 }, { cue: "click", specks: click(1) }),
    F(110, { hand: "down", head: [0, 1], mouth: "grin", flag: -1 }),
    F(420, { mouth: "wide", eyes2: "us", brow: 1, flag: 1 }),
    F(180, { mouth: "grin" }),
  ],
};

/** Thinking: he doesn't think. Bouncing faster than his idle, drumming on the clock, a glance at us, an eye-roll, a yawn. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 20 }, (_, i) => {
    const yawn = i >= 12 && i <= 15;
    const lift = yawn ? 0 : [0, 1, 2, 1][i % 4]!;
    const tap = !yawn && i % 2 === 1;
    const eyes2: Eyes2 = i >= 5 && i <= 8 ? "us" : i >= 9 && i <= 11 ? "up" : yawn ? (i === 12 ? "half" : "shut") : i === 18 ? "half" : "open";
    return F(
      90,
      {
        lift,
        tail: TAIL[(i * 2) % 8]!,
        ...(yawn ? { at: [30, 49] as Pt } : tap ? { at: [27, 53] as Pt } : { hand: "rest" as const }),
        mouth: yawn ? (i === 12 || i === 15 ? "o" : "yawn") : i >= 9 && i <= 11 ? "flat" : "smirk",
        eyes2,
        brow: i >= 5 && i <= 8 ? 1 : 0,
        ears: yawn ? 1 : 0,
        head: yawn ? [1, -1] : [0, 0],
      },
      tap ? { specks: [sp(21, 52 - lift, "J"), sp(22, 51 - lift, "M")], ...(i % 4 === 1 ? { cue: "tick" } : {}) } : i === 13 ? { cue: "yawn" } : {},
    );
  }),
};

/** Move: a snap-point, a finger gun at the board with speed streaks, then a quick slap of the clock. */
const move: Anim = {
  loop: false,
  frames: [
    F(70, { hand: "up", lift: 1, brow: 1 }),
    F(90, { at: POINT, gesture: "point", head: [-1, 0], mouth: "grin", brow: 1, lift: 1, tail: 3 }, { cue: "snap", specks: pointLines(-1) }),
    F(170, { at: POINT, gesture: "point", head: [-1, 0], mouth: "grin", brow: 1, tail: 2 }, { specks: [...pointLines(0, 0.5), ...star(POINT[0] - 10, POINT[1] - 1)] }),
    F(70, { hand: "up", lift: 1 }),
    F(120, { hand: "down", sink: 1, head: [0, 1], mouth: "grin", flag: 1 }, { cue: "click", specks: click(1) }),
    F(90, { hand: "high", flag: -1 }),
    F(130, { flag: 1 }),
  ],
};

/** Capture: a wink and a double fist pump, then a slap of the clock. */
const PUMP_UP: Pt = [56, 35];
const PUMP_DN: Pt = [55, 42];
const capture: Anim = {
  loop: false,
  frames: [
    F(80, { at: PUMP_DN, eyes: "wide", mouth: "wide", lift: 1 }, { cue: "yes" }),
    F(90, { at: PUMP_UP, eyes2: "wink", mouth: "wide", lift: 2, brow: 1, tail: 3 }),
    F(90, { at: PUMP_DN, eyes2: "wink", mouth: "wide", lift: 1, tail: 1 }),
    F(110, { at: PUMP_UP, eyes2: "wink", mouth: "wide", lift: 2, brow: 1, tail: 3 }, { specks: star(55, 31) }),
    F(80, { hand: "up", mouth: "grin", lift: 1 }),
    F(130, { hand: "down", sink: 1, head: [0, 1], mouth: "grin", flag: 1 }, { cue: "click", specks: click(1) }),
    F(100, { hand: "down", head: [0, 1], mouth: "grin", flag: -1 }),
    F(220, { eyes2: "wink", mouth: "grin", brow: 1, flag: 1 }),
    F(150, {}),
  ],
};

/** Clock Slap (his passive): the paw wound up high, a slam, big sparks, the flag jumps; a tiny clock zips from the clock to his chest. */
const WIND: Pt = [53, 32];
const WIND2: Pt = [55, 30];
const clockSlap: Anim = {
  loop: false,
  frames: [
    F(90, { at: WIND, gesture: "open", lift: 2, eyes2: "sly", mouth: "grin", brow: 1, head: [1, -1], tail: 3 }, { cue: "windup" }),
    F(130, { at: WIND2, gesture: "open", lift: 3, eyes2: "sly", mouth: "wide", brow: 2, head: [1, -1], tail: 4 }),
    F(50, { at: [36, 43], gesture: "open", lift: 1, mouth: "wide", brow: 1, tail: 2 }, { specks: [sp(50, 33, "N"), sp(47, 35, "N"), sp(44, 37, "M"), sp(41, 39, "J"), sp(52, 36, "M"), sp(49, 38, "J")] }),
    F(150, { hand: "down", gesture: "open", sink: 2, head: [0, 2], eyes: "shut", mouth: "wide", flag: 1, flagY: 3, ears: 1, tail: -2 }, { cue: "slam", shake: [0, 2], specks: bigClick(2, 0) }),
    F(90, { hand: "down", gesture: "open", sink: 1, head: [0, 1], eyes2: "joy", mouth: "wide", flag: -1, flagY: 1 }, { specks: [...bigClick(1, 1), ...tinyClock(19, 50, 0)] }),
    F(90, { hand: "high", eyes2: "sly", mouth: "grin", flag: 1 }, { specks: tinyClock(22, 42, 1, [19, 50]) }),
    F(90, { eyes2: "sly", mouth: "grin", flag: -1, lift: 1 }, { specks: tinyClock(31, 41, 2, [22, 42]) }),
    F(110, { eyes2: "joy", mouth: "wide", brow: 1, lift: 1 }, { cue: "steal", specks: [...star(39, 48, true), ...star(34, 44), ...star(44, 46)] }),
    F(180, { eyes2: "sly", mouth: "grin", brow: 1 }, { specks: star(40, 49) }),
    F(150, {}),
  ],
};

/** Scramble warning: he holds the clock up toward us, taps it twice, eyebrows up, a sly wide grin. Holds on the last frame. */
const RAISE: Pt = [2, -10];
/** His finger taps the clock's right face, like tapping a wristwatch: "time's ticking". */
const TAP: Pt = [34, 54];
const TAP_UP: Pt = [36, 50];
const tapLines: Speck[] = [sp(29, 49, "O"), sp(28, 48, "Y"), sp(31, 48, "O"), sp(32, 47, "Y"), sp(26, 52, "O"), sp(25, 52, "Y")];
const scrambleWarn: Anim = {
  loop: false,
  frames: [
    F(100, { clock: [1, -5], lift: 1, eyes2: "sly", brow: 1, mouth: "grin" }, { cue: "warn" }),
    F(130, { clock: RAISE, at: TAP_UP, gesture: "point", eyes2: "us", brow: 2, mouth: "wide" }),
    F(110, { clock: RAISE, at: TAP, gesture: "point", eyes2: "us", brow: 2, mouth: "wide", head: [0, 1] }, { cue: "tap", specks: tapLines }),
    F(160, { clock: RAISE, at: TAP_UP, gesture: "point", eyes2: "sly", brow: 2, mouth: "wide", flag: 1 }),
    F(110, { clock: RAISE, at: TAP, gesture: "point", eyes2: "us", brow: 2, mouth: "wide", flag: -1, head: [0, 1] }, { cue: "tap", specks: tapLines }),
    F(160, { clock: RAISE, at: TAP_UP, gesture: "point", eyes2: "sly", brow: 2, mouth: "wide", flag: 1 }),
    F(700, { clock: RAISE, at: TAP_UP, gesture: "point", eyes2: "us", brow: 2, mouth: "wide" }, { specks: [...star(4, 44), ...star(36, 42)] }),
  ],
};

/** Time Scramble: the clock tossed up and spun in a blur between his paws, speed lines, sparks, cap and ears ruffled; a catch, a slam, a triumphant pose. */
const SPIN_C: Pt = [0, -10];
const frenzy = (i: number): Frame => {
  const lift = i % 2 ? 2 : 0;
  const clock: Pt = [SPIN_C[0], SPIN_C[1] - (i % 2)];
  const cx = 19.5 + clock[0];
  const cy = 63.5 + clock[1] - lift;
  const arcs: Speck[] = [];
  for (const base of [i * 1.3, i * 1.3 + Math.PI]) for (let j = 0; j < 5; j++) {
    const a = base + j * 0.22;
    arcs.push(sp(cx + Math.cos(a) * 15, cy + Math.sin(a) * 14, ["O", "N", "M", "M", "J"][j]!));
  }
  const SPARKS: Pt[] = [[4, 40], [36, 36], [6, 66], [34, 62], [12, 34], [4, 54]];
  return F(
    80,
    {
      lift,
      clock,
      spin: (i + 1) % 4,
      at: i % 2 ? [29.5, 47] : [29, 56],
      blur: i % 2 ? [29, 56] : [29.5, 47],
      pawF: i % 2 ? [9, 52] : [10, 58],
      eyes2: i % 3 === 2 ? "joy" : undefined,
      eyes: "wide",
      mouth: "wide",
      brow: 2,
      ears: [0, 2, 1, 2][i % 4]!,
      capAt: ([[1, -1], [2, -2], [0, -1], [1, -2]] as Pt[])[i % 4]!,
      head: [i % 2, 0],
      tail: [4, -2, 3, -3][i % 4]!,
    },
    {
      shake: [i % 2 ? 1 : -1, 0],
      specks: [...arcs, ...star(...SPARKS[i % 6]!), ...star(...SPARKS[(i + 3) % 6]!), ...streak(57, 29 + (i % 3) * 6, 12, 1), ...streak(59, 33 + ((i + 1) % 3) * 6, 9, 1)],
      ...(i === 0 ? { cue: "whirr" } : {}),
    },
  );
};
const timeScramble: Anim = {
  loop: false,
  frames: [
    F(100, { sink: 2, clock: [0, -2], eyes: "wide", mouth: "wide", brow: 2, ears: 1, hand: "high" }, { cue: "whoosh" }),
    F(80, { lift: 2, clock: SPIN_C, pawF: [10, 50], at: [30, 45], eyes2: "us", mouth: "wide", brow: 2, tail: 3 }, { specks: [...streak(19, 66, 6, 1), ...streak(14, 68, 5, 1)] }),
    ...Array.from({ length: 10 }, (_, i) => frenzy(i)),
    F(80, { lift: 2, clock: [0, -3], hand: "up", eyes: "wide", mouth: "wide", capAt: [1, -1], flag: 1 }),
    F(150, { hand: "down", gesture: "open", sink: 2, head: [0, 2], eyes: "shut", mouth: "wide", flag: 1, flagY: 3, ears: 1, capAt: [1, 0] }, { cue: "slam", shake: [0, 2], specks: bigClick(2, 0) }),
    F(110, { hand: "down", gesture: "open", sink: 1, head: [0, 1], eyes2: "joy", mouth: "wide", flag: -1, flagY: 1 }, { specks: bigClick(1, 1) }),
    F(500, { at: PUMP_UP, lift: 2, eyes2: "sly", mouth: "wide", brow: 2, tail: 3, flag: 1 }, { cue: "ta-da", specks: [...star(56, 30, true), ...star(8, 46), ...star(30, 12)] }),
    F(180, { mouth: "grin" }),
  ],
};

/** Hurt: a pale flash, a flinch, ears back, eyes wide, the clock jolts and the cap jumps; he shakes it off fast. */
const hurt: Anim = {
  loop: false,
  frames: [
    F(70, { dx: 1, lift: 1, head: [2, -1], ears: 3, eyes: "wide", mouth: "o", clock: [1, -3], flag: 1, flagY: 1, tail: 4, capAt: [1, -2], hand: "up" }, { cue: "oof", pal: FLASH, shake: [2, 0] }),
    F(80, { dx: 1, sink: 1, head: [1, 0], ears: 3, eyes: "wide", mouth: "o", clock: [0, -1], flag: -1, tail: 3, capAt: [1, -1], worry: true }, { specks: sweat(19, 22) }),
    F(90, { dx: 1, ears: 2, eyes: "wide", mouth: "frown", flag: 1, worry: true, tail: 2 }, { specks: sweat(18, 25) }),
    F(100, { ears: 1, eyes: "half", flag: -1 }),
    F(130, { eyes: "open", brow: 1, lift: 1 }),
    F(140, {}),
  ],
};

/** Check: a cocky finger gun at the board, held with a sly look, then a slap. */
const check: Anim = {
  loop: false,
  frames: [
    F(80, { hand: "up", lift: 1, brow: 1, eyes2: "sly" }),
    F(110, { at: POINT, gesture: "point", head: [-1, 0], mouth: "wide", brow: 2, lift: 1, tail: 3 }, { cue: "point", specks: pointLines(-1, 1.3) }),
    F(260, { at: POINT, gesture: "point", head: [-1, 0], mouth: "grin", eyes2: "sly", brow: 2, tail: 2 }, { specks: [...star(POINT[0] - 11, POINT[1] - 1, true), ...pointLines(0, 0.4)] }),
    F(70, { hand: "up", lift: 1, mouth: "grin" }),
    F(130, { hand: "down", sink: 1, head: [0, 1], mouth: "grin", flag: 1 }, { cue: "click", specks: click(1) }),
    F(100, { hand: "down", head: [0, 1], mouth: "grin", flag: -1 }),
    F(160, { mouth: "grin", brow: 1, flag: 1 }),
    F(140, {}),
  ],
};

/** Smug (loop): leaning back, half-lidded, polishing his nails on his jacket, then a look at them (a glint). */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    F(
      150,
      {
        head: [1, -1],
        ...(i < 6 ? { at: (i % 2 ? [41, 53] : [39, 51]) as Pt } : i < 10 ? { at: [25, 46] as Pt } : { hand: "rest" as const }),
        eyes: i === 11 ? "shut" : "half",
        mouth: i >= 7 && i <= 9 ? "grin" : "smirk",
        brow: i >= 6 && i <= 9 ? 1 : 0,
        tail: [0, 1, 2, 2, 1, 0, -1, -2, -2, -1, 0, 0][i]!,
      },
      i === 7 ? { specks: star(21, 43) } : {},
    ),
  ),
};

/** Rattled (loop): ears flat, worried brows, sweat, fast nervous taps on the clock, glancing at it. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const down = i % 2 === 1;
    return F(
      75,
      {
        ...(down ? { hand: "down" as const } : { at: [28, 51] as Pt }),
        head: [0, down ? 1 : 0],
        eyes2: i % 6 < 3 ? "down" : undefined,
        eyes: "wide",
        ears: 3,
        worry: true,
        mouth: "grimace",
        flag: down ? 1 : -1,
        tail: down ? -2 : -1,
      },
      {
        shake: [i % 4 === 0 ? 1 : 0, 0],
        specks: [...sweat(20, 20 + (i % 6) * 2), ...sweat(43, 26 + ((i + 3) % 6)), ...(down ? clickAt(0, 1).slice(0, 4) : [])],
        ...(i % 4 === 1 ? { cue: "tap" } : {}),
      },
    );
  }),
};

/** Defeat: the flag falls (a pale flash), a stare at it, then he slumps, the cap slipping over his eyes, the clock drooping. Holds. */
const defeat: Anim = {
  loop: false,
  frames: [
    F(90, { fallen: true, eyes: "wide", ears: 2, mouth: "o", hand: "rest" }, { cue: "flag", pal: FLASH, shake: [1, 0] }),
    F(160, { fallen: true, eyes2: "down", ears: 3, mouth: "o", worry: true, head: [0, 1] }),
    F(140, { fallen: true, sink: 1, eyes: "half", ears: 3, mouth: "frown", worry: true, head: [0, 2], capAt: [-1, 2], clock: [2, 3], at: [32, 60] }, { cue: "slump" }),
    F(160, { fallen: true, sink: 2, eyes: "shut", ears: 3, mouth: "frown", worry: true, head: [0, 3], capAt: [-1, 4], clock: [3, 5], at: [34, 64], tail: -2 }),
    F(1200, { fallen: true, sink: 3, eyes: "shut", ears: 3, mouth: "frown", worry: true, head: [0, 3], capAt: [-2, 7], clock: [3, 6], at: [35, 66], tail: -3 }),
  ],
};

/** Victory (loop): the clock raised overhead, a bounce on his toes, a fist pump then a finger gun at the board, speed sparkles. */
const OVERHEAD: Pt = [-5, -44];
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    F(
      110,
      {
        lift: [1, 2, 2, 1, 0, 0][i % 6]!,
        clock: OVERHEAD,
        ...(i < 6 ? { at: (i % 3 === 1 ? PUMP_DN : PUMP_UP) as Pt } : { at: POINT, gesture: "point" as const }),
        eyes2: i < 6 ? "joy" : "sly",
        mouth: "wide",
        brow: i < 6 ? 1 : 2,
        flag: [0, 1, 0, -1][i % 4]!,
        tail: [0, 2, 3, 2, 0, -1][i % 6]!,
      },
      { specks: i % 2 ? [...star(5, 7), ...star(31, 9, true)] : [...star(4, 32), ...star(29, 5)], ...(i === 0 ? { cue: "cheer" } : {}) },
    ),
  ),
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
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, clockSlap, scrambleWarn, timeScramble },
};
