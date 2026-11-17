/**
 * Copied as drawn from the art branch `claude/boss-art` (scripts/boss-art/out/dash-lie/dash-lie.ts, the API's run of Nov 17, $2.37):
 * Dash lying down by your clock, tapping his (DashTap in components/DashStall.tsx). Changed: the import paths, and its palette's
 * colors set to his own (boss-blitz.ts's PALETTE, color for color by what each is: fur, cream, spots, eyes, mouth, his cap's
 * and jacket's orange and teal, sneakers, the clock), since the run couldn't read his drawing; its speed lines, tap lines and
 * dust keep theirs.
 */
/**
 * Dash (Blitz) lying down by your clock: one extra figure of the boss, in a frame of its own (Eric, Nov 17).
 * Once a game he zips in, flops onto his side next to the player's clock, plunks his own white chess clock down in front
 * of his face and lies there, head propped on his paw, tapping its button with one claw, bored and sly. Then he springs
 * up and zips off to our right with it.
 *
 * Frame 128 x 60, the floor at y 57. Painted in the frame's own coordinates: every part is a full-frame canvas, placed
 * at its offset, so a pose is a set of numbers (where each part sits) and a few variants (the tapping paw's height, the
 * clock's buttons, the tail's flick, the top foot's bob, the eyes).
 */
import { canvas, edge, ellipse, line, poly, toGrid, type Canvas } from "./paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Speck } from "./sprite.ts";

const W = 128;
const H = 60;

const PALETTE: Record<string, string> = {
  k: "#1a1210", // outline
  a: "#7a4a14", // fur: deep shadow to highlight
  b: "#b9781f",
  c: "#e0a53a",
  d: "#f2c665",
  e: "#fbe0a0",
  f: "#c9b48e", // cream: muzzle, chin, cheeks
  g: "#efe2c4",
  h: "#fffaf0",
  s: "#241610", // spots, tear marks
  y: "#c8600c", // eyes: amber, light, pupil
  Y: "#f59a22",
  x: "#120a06",
  m: "#5a1f26", // mouth, tongue
  t: "#d4636e",
  "1": "#8a3208", // the cap (and the jacket's orange): dark to light
  "2": "#d2601a",
  "3": "#f28a2a",
  "4": "#ffb860",
  "5": "#0b4a4f", // teal: dark to light
  "6": "#137a7a",
  "7": "#22a8a0",
  "8": "#6fd8c8",
  r: "#8a3208", // the waistband
  z: "#a5adb8", // the zip
  w: "#ffffff", // sneakers: white, grey
  W: "#c9ced8",
  C: "#eef1f5", // the clock: body, shade, dark grey, face white, ticks
  D: "#c9ced8",
  E: "#8f96a3",
  F: "#ffffff",
  T: "#4f5562",
  B: "#262a33", // its buttons, lit top
  N: "#4f5562",
  R: "#ee3b3b", // its flag
  L: "#f0fbf9", // speed and tap lines, bright and soft
  l: "#8fd6cf",
  u: "#8c7c68", // dust
  v: "#c8b9a0",
  z0: "#000000", // (unused key guard)
  Z: "#0000004d", // floor shadow
};
delete PALETTE.z0;

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;

const { parts, add } = lazyParts();

/** A part painted on a whole-frame canvas. */
function part(name: string, draw: (cv: Canvas) => void, outline = true): string {
  return add(name, () => {
    const cv = canvas(W, H);
    draw(cv);
    return { grid: toGrid(cv), outline };
  });
}

const set = (cv: Canvas, x: number, y: number, k: string) => {
  if (y >= 0 && y < H && x >= 0 && x < W) cv[y]![x] = k;
};
const at = (cv: Canvas, x: number, y: number) => cv[y]?.[x] ?? ".";
/** A filled ellipse by pixel centers. */
const disc = (cv: Canvas, x: number, y: number, rx: number, ry: number, k: string) => ellipse(cv, x + 0.5, y + 0.5, rx, ry, k);
const inDisc = (cx: number, cy: number, rx: number, ry: number): Inside => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
/** A turned ellipse: `ang` degrees; `u` across (rx), `v` along (ry). */
const inRot = (cx: number, cy: number, rx: number, ry: number, ang: number) => {
  const c = Math.cos((ang * Math.PI) / 180);
  const s = Math.sin((ang * Math.PI) / 180);
  return (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * c + dy * s;
    const v = -dx * s + dy * c;
    return { u: u / rx, v: v / ry, in: (u / rx) ** 2 + (v / ry) ** 2 <= 1 };
  };
};
const fill = (cv: Canvas, inside: Inside, key: (x: number, y: number) => string) => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) cv[y]![x] = key(x, y);
};
const stamp = (cv: Canvas, rows: readonly string[], x: number, y: number) =>
  rows.forEach((row, j) => [...row].forEach((k, i) => k !== "." && set(cv, x + i, y + j, k)));

/** Distance from a point to a polyline, and how far along (0-1). */
function along(pts: readonly Pt[], x: number, y: number): { d: number; s: number; ny: number } {
  let best = { d: Infinity, s: 0, ny: 0 };
  let total = 0;
  const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]));
  const sum = lens.reduce((a, b) => a + b, 0) || 1;
  pts.slice(1).forEach((q, i) => {
    const p = pts[i]!;
    const vx = q[0] - p[0];
    const vy = q[1] - p[1];
    const l2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - p[0]) * vx + (y - p[1]) * vy) / l2));
    const nx = x - (p[0] + t * vx);
    const ny = y - (p[1] + t * vy);
    const d = Math.hypot(nx, ny);
    if (d < best.d) best = { d, s: (total + t * lens[i]!) / sum, ny };
    total += lens[i]!;
  });
  return best;
}
/** A thick line through `pts` (pixel centers), radius `r`; `key` picks each pixel's color from how far along it is and its height across (-1 top, 1 bottom). */
function tube(cv: Canvas, pts: readonly Pt[], r: number, key: (s: number, across: number, x: number, y: number) => string) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = along(pts, x, y);
      if (a.d <= r) cv[y]![x] = key(a.s, a.ny / r, x, y);
    }
}

/** Light from the top left on a filled shape of `base`: top and left edges lighter, bottom and right darker. */
function rim(cv: Canvas, base: string, light: string, dark: string, deep?: string) {
  edge(cv, 0, 1, base, dark);
  edge(cv, 1, 0, base, dark);
  if (deep) edge(cv, 0, 1, dark, deep);
  edge(cv, 0, -1, base, light);
  edge(cv, -1, 0, base, light);
}

/** Cheetah spots on the fur keys: a loose lattice of dots. */
function spots(cv: Canvas, seed: number, where: Inside = () => true) {
  const fur = new Set(["c", "d", "b"]);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const row = Math.floor(y / 3);
      if (y % 3 !== seed % 3) continue;
      if ((x + row * 2 + seed) % 4 !== 0) continue;
      const hsh = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + seed * 3.1) * 43758.5453) % 1;
      if (hsh < 0.25 || !where(x, y)) continue;
      if (!fur.has(at(cv, x, y))) continue;
      // keep a spot off the edge so the outline stays clean
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(cv, x + dx!, y + dy!) === ".")) continue;
      cv[y]![x] = "s";
      if (hsh > 0.7 && fur.has(at(cv, x + 1, y)) && at(cv, x + 2, y) !== ".") cv[y]![x + 1] = "s";
    }
}

// ---- The parts, at rest (the idle's place).

part("shadow", (cv) => {
  for (let x = 6; x <= 123; x++) {
    set(cv, x, 56, "Z");
    if (x > 10 && x < 120) set(cv, x, 57, "Z");
  }
}, false);

/** The tail: out from behind his rump, up behind his legs, curling over at the far right. `t` flicks the tip. */
const TAIL_TIPS: readonly (readonly Pt[])[] = [
  [[120, 29], [121, 24], [118, 20], [114, 20]],
  [[120, 29], [121, 23], [119, 18], [115, 17]],
  [[120, 29], [120, 23], [117, 19], [112, 20]],
];
for (let t = 0; t < 3; t++)
  part(`tail${t}`, (cv) => {
    const pts: Pt[] = [[90, 44], [99, 39], [107, 36], [114, 34], ...TAIL_TIPS[t]!];
    tube(cv, pts, 2.3, (s, ac) => (s > 0.9 ? (ac < -0.2 ? "h" : "g") : (s > 0.7 && s < 0.75) || (s > 0.8 && s < 0.85) ? "s" : ac < -0.35 ? "d" : ac > 0.45 ? "b" : "c"));
    spots(cv, 2, (x, y) => along(pts, x, y).s < 0.66);
  });

/** A sneaker turned up on its heel: the toe up, the laces to our left, the orange sole down its right side. Top-left (x, y). */
const SNEAKER = [
  "..www3.",
  ".wwwww3",
  "wwwwww3",
  "Wwwwww3",
  "w4wwww3",
  "wwwwww3",
  "w4wwww3",
  "Wwwwww3",
  "wwwwww2",
  "WWwww22",
  ".WWWW2.",
];
const sneaker = (cv: Canvas, x: number, y: number) => stamp(cv, SNEAKER, x, y);

part("legLow", (cv) => {
  tube(cv, [[97, 51], [107, 52], [114, 51]], 3.4, (_s, ac) => (ac < -0.4 ? "d" : ac > 0.5 ? "b" : "c"));
  spots(cv, 1);
  sneaker(cv, 115, 45);
});

for (let b = 0; b >= -2; b--)
  part(`legTop${-b}`, (cv) => {
    tube(cv, [[94, 44], [104, 42], [112, 45 + b]], 3.4, (_s, ac) => (ac < -0.4 ? "d" : ac > 0.5 ? "b" : "c"));
    spots(cv, 0);
    sneaker(cv, 111, 35 + b);
  });

part("body", (cv) => {
  // the jacket, lying along the floor: his front toward us
  poly(cv, [[55, 42], [60, 37], [72, 36], [82, 37], [85, 39], [85, 56], [57, 56], [54, 50]], "7");
  rim(cv, "7", "8", "6", "5");
  // the orange yoke across his shoulders and chest
  for (let y = 0; y < H; y++)
    for (let x = 0; x < 72; x++) if (at(cv, x, y) !== "." && y < 46 && x < 69 - (y - 36) * 0.3) cv[y]![x] = y === 36 || x < 57 ? "4" : "3";
  // the zip
  line(cv, 57, 47, 80, 47, "z");
  line(cv, 57, 48, 80, 48, "6");
  // the waistband
  for (let y = 38; y <= 55; y++) for (let x = 81; x <= 84; x++) if (at(cv, x, y) !== ".") cv[y]![x] = x === 81 ? "2" : "r";
  // the shorts
  poly(cv, [[85, 39], [94, 39], [97, 42], [97, 56], [85, 56]], "7");
  for (let y = 39; y < 57; y++)
    for (let x = 85; x <= 97; x++) {
      const k = at(cv, x, y);
      if (k === ".") continue;
      if (y <= 41) cv[y]![x] = y === 39 ? "4" : "3";
      else if (y >= 54) cv[y]![x] = "5";
      else if (y >= 51 || x >= 96) cv[y]![x] = "6";
    }
});

/** The face. `eyes`: "half" (lidded, sly), "wide", "shut". */
function drawHead(cv: Canvas, eyes: "half" | "wide" | "shut") {
  // ears, behind the cap
  disc(cv, 34, 13, 3, 3.2, "c");
  disc(cv, 59, 11, 3, 3.2, "c");
  disc(cv, 34, 13, 1.4, 1.6, "a");
  disc(cv, 59, 11, 1.4, 1.6, "a");
  // the head and its jowls
  const head = (x: number, y: number) => inDisc(46, 24, 11.6, 10.6)(x, y) || inDisc(45, 30, 10, 5.6)(x, y);
  fill(cv, head, () => "c");
  rim(cv, "c", "d", "b");
  spots(cv, 1, (x, y) => !inDisc(42, 29, 6, 5)(x, y));
  spots(cv, 2, (x, y) => y < 21 && !inDisc(42, 29, 6, 5)(x, y));
  // cream: the muzzle and chin, a little under each eye
  fill(cv, inDisc(41.5, 29, 4.8, 3.4), () => "g");
  fill(cv, inDisc(42.5, 33.5, 4.5, 1.8), (x, y) => (y >= 35 ? "f" : "g"));
  // eyes
  if (eyes === "half") {
    stamp(cv, ["akkkk", "yYxxk", ".ggg."], 35, 21);
    stamp(cv, ["kkkka", "kxxYy", ".ggg."], 45, 21);
    stamp(cv, ["aaa.."], 35, 19);
    stamp(cv, ["..aaa", ".....a"], 45, 18);
  } else if (eyes === "wide") {
    stamp(cv, [".kkk.", "kYxxk", "kyxxk", ".ggg."], 35, 20);
    stamp(cv, [".kkk.", "kxxYk", "kxxyk", ".ggg."], 45, 20);
  } else {
    stamp(cv, ["k...k", ".kkk."], 35, 22);
    stamp(cv, ["k...k", ".kkk."], 45, 22);
  }
  // tear marks: from each eye's inner corner down beside the muzzle to the mouth
  stamp(cv, ["s", "s", ".s", ".s", "..s"], 38, 24);
  stamp(cv, ["s", "s", "s", "s", "s"], 45, 24);
  // nose and the sly, lopsided grin (its right corner up)
  stamp(cv, ["kkk", "kkk", ".k."], 40, 25);
  stamp(cv, ["k.....k", ".kkkkk.", "..m...."], 40, 28);
  set(cv, 47, 27, "k");
}

for (const e of ["half", "wide", "shut"] as const) part(`head_${e}`, (cv) => drawHead(cv, e));

part("cap", (cv) => {
  // backwards: the orange dome over his head, the teal brim out at the back
  fill(cv, (x, y) => inDisc(47, 17.5, 12.8, 8)(x, y) && y <= 18, (x, y) => (y === 18 ? "2" : "3"));
  rim(cv, "3", "4", "2");
  line(cv, 47, 10, 42, 17, "2");
  line(cv, 48, 10, 53, 17, "2");
  set(cv, 47, 9, "2");
  set(cv, 48, 9, "2");
  poly(cv, [[58, 15], [67, 16], [69, 18], [67, 20], [58, 19]], "7");
  for (let x = 58; x <= 69; x++) {
    if (at(cv, x, 15) === "7") cv[15]![x] = "8";
    if (at(cv, x, 16) === "7" && x < 66) cv[16]![x] = "8";
    for (let y = 19; y <= 20; y++) if (at(cv, x, y) === "7") cv[y]![x] = "6";
  }
});

part("armProp", (cv) => {
  // the near arm: elbow on the floor, forearm up, paw cupping his cheek
  tube(cv, [[63, 46], [54, 51], [55, 39]], 3.3, (_s, ac) => (ac < -0.45 ? "8" : ac > 0.5 ? "6" : "7"));
  disc(cv, 55, 39, 3, 1.4, "2");
  fill(cv, inDisc(55, 35.5, 4.2, 2.8), (x, y) => (y <= 34 ? "d" : "c"));
  set(cv, 53, 34, "b");
  set(cv, 56, 34, "b");
});

/** The free arm, reaching under his chin to the clock's button. `d`: the paw's height, 0 pressing, below 0 lifted. */
for (const d of [0, -1, -3, -6])
  part(`armTap${-d}`, (cv) => {
    tube(cv, [[65, 41], [48, 44], [33, 36 + d * 0.6]], 3, (_s, ac) => (ac < -0.4 ? "8" : ac > 0.5 ? "6" : "7"));
    disc(cv, 31, 35 + d * 0.8, 2.2, 2.6, "2");
    fill(cv, inDisc(26, 33 + d, 3.8, 2.7), (x, y) => (y <= 32 + d ? "d" : y >= 35 + d ? "b" : "c"));
    set(cv, 27, 33 + d, "b");
    set(cv, 25, 33 + d, "b");
    // the one claw out
    set(cv, 23, 36 + d, "h");
    set(cv, 23, 37 + d, "h");
  });

/** His white chess clock: two faces (ticks, no numerals), a red flag, two buttons. `p`: the right button pressed. `f`: the flag nudged. */
function drawClock(cv: Canvas, p: boolean, f: boolean) {
  // buttons on top
  const lb = p ? 36 : 37;
  const rb = p ? 38 : 37;
  for (let y = lb; y <= 39; y++) for (let x = 8; x <= 12; x++) set(cv, x, y, y === lb ? "N" : "B");
  for (let y = rb; y <= 39; y++) for (let x = 20; x <= 24; x++) set(cv, x, y, y === rb ? "N" : "B");
  // the body
  poly(cv, [[4, 41], [5, 40], [31, 40], [32, 41], [32, 56], [4, 56]], "C");
  for (let x = 4; x <= 31; x++) {
    set(cv, x, 55, "D");
    set(cv, x, 54, "D");
  }
  for (let y = 40; y <= 55; y++) set(cv, 31, y, "D");
  for (let x = 5; x <= 30; x++) set(cv, x, 40, "F");
  for (let y = 41; y <= 53; y++) set(cv, 4, y, "F");
  // the faces
  for (const cx of [11, 24]) {
    disc(cv, cx, 47, 5.6, 5.6, "T");
    disc(cv, cx, 47, 4.6, 4.6, "F");
    for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]] as const) set(cv, cx + dx, 47 + dy, "E");
    for (const [dx, dy] of [[3, -3], [3, 3], [-3, 3], [-3, -3]] as const) set(cv, cx + dx, 47 + dy, "D");
    set(cv, cx, 47, "T");
  }
  // hands
  line(cv, 11, 47, 11, 44, "T");
  line(cv, 11, 47, 13, 48, "T");
  line(cv, 24, 47, 24, 45, "T");
  line(cv, 24, 47, 22, 46, "T");
  // the flag, hanging by the left face's top
  const fx = f ? 13 : 12;
  stamp(cv, ["RR", "R."], fx, 41);
}
for (const p of [false, true]) for (const f of [false, true]) part(`clock${p ? 1 : 0}${f ? 1 : 0}`, (cv) => drawClock(cv, p, f));

/** The zip blur: him as a smear, the leading edge rounded, the rest trailing off. `dir` -1 moving left (lieDown), 1 right. */
function smearPart(name: string, lead: number, len: number, dir: 1 | -1): string {
  return part(name, (cv) => {
    for (let y = 12; y <= 55; y++) {
      const hsh = Math.abs(Math.sin(y * 91.7 + lead * 3.3) * 43758.5453) % 1;
      let key: (i: number) => string;
      let e: number;
      let l: number;
      if (y <= 35) {
        // his head: the cap on top, the face with an eye and the cream muzzle at the front
        const t = (y - 23.5) / 12.5;
        e = Math.round(8 * (1 - Math.sqrt(Math.max(0, 1 - t * t))));
        l = Math.round(len * 0.4 + hsh * 6);
        key = (i) =>
          y <= 13 ? "4" : y <= 18 ? "3" : y === 19 ? "2" : y === 22 && i >= 3 && i <= 5 ? "k" : y >= 27 && y <= 32 && i < 6 ? "g" : y >= 33 ? "b" : (i + y * 3) % 11 === 5 && y % 4 === 1 && i < l - 4 ? "s" : "c";
      } else {
        // his jacket, the zip, the shorts, his sneakers trailing last
        const t = (y - 46) / 10;
        e = Math.round(5 * (1 - Math.sqrt(Math.max(0, 1 - t * t)))) + 5;
        l = Math.round(len * (0.75 + 0.25 * hsh));
        key = (i) =>
          i > l - 6 && y >= 46 ? "w" : y <= 37 ? "8" : y <= 41 && i < 14 ? "3" : y === 47 ? "z" : y >= 53 ? "5" : y >= 50 ? "6" : "7";
      }
      for (let i = 0; i < l; i++) {
        const x = lead - dir * (e + i);
        if (x >= 2 && x <= 123) set(cv, x, y, key(i));
      }
    }
  });
}

// ---- Poses: where each part sits, and which variant.

interface Pose {
  /** The whole figure (not the clock). */
  dx?: number;
  dy?: number;
  /** The head and cap, against the figure. */
  hx?: number;
  hy?: number;
  eyes?: "half" | "wide" | "shut";
  /** The tapping paw: 0 pressing, 1, 3, 6 lifted. */
  paw?: 0 | 1 | 3 | 6;
  tail?: 0 | 1 | 2;
  /** The top foot's lift. */
  bob?: 0 | 1 | 2;
  /** The clock: where (null: not drawn), pressed, flag nudged. */
  clock?: readonly [number, number] | null;
  pressed?: boolean;
  flag?: boolean;
  /** No prop arm (head not yet on the paw). */
  noProp?: boolean;
}

function layers(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const dy = p.dy ?? 0;
  const L = (part: string, x = 0, y = 0): Layer => ({ part, x: dx + x, y: dy + y });
  const out: Layer[] = [];
  if (dy === 0) out.push({ part: "shadow", x: 0, y: 0 });
  out.push(L(`tail${p.tail ?? 0}`), L("legLow"), L("body"), L(`legTop${p.bob ?? 0}`));
  out.push(L(`head_${p.eyes ?? "half"}`, p.hx ?? 0, p.hy ?? 0), L("cap", p.hx ?? 0, p.hy ?? 0));
  if (!p.noProp) out.push(L("armProp"));
  if (p.clock !== null) {
    const [cx, cy] = p.clock ?? [0, 0];
    out.push({ part: `clock${p.pressed ? 1 : 0}${p.flag ? 1 : 0}`, x: cx, y: cy });
  }
  out.push(L(`armTap${p.paw ?? 3}`));
  return out;
}

const frame = (p: Pose, ms: number, extra: Partial<Frame> = {}): Frame => ({ layers: layers(p), ms, ...extra });

/** Little tap lines by the button. */
const TAP: readonly Speck[] = [[18, 37, "Y"], [17, 37, "3"], [19, 35, "Y"], [18, 34, "3"], [21, 34, "Y"], [21, 33, "3"]];

/** Horizontal speed lines: `n` of them in a box, from a seed. */
function speedLines(seed: number, n: number, x0: number, x1: number, y0: number, y1: number, keys = "LLl"): Speck[] {
  const out: Speck[] = [];
  for (let i = 0; i < n; i++) {
    const r = (j: number) => Math.abs(Math.sin(seed * 17.1 + i * 31.7 + j * 7.3) * 43758.5453) % 1;
    const len = 5 + Math.floor(r(1) * 14);
    const x = x0 + Math.floor(r(2) * Math.max(1, x1 - x0 - len));
    const y = y0 + Math.floor(r(3) * (y1 - y0));
    // every third line grey, so they read on a light ground as well as a dark one
    const k = i % 3 === 2 ? "D" : keys[i % keys.length]!;
    for (let j = 0; j < len; j++) if (x + j >= 2 && x + j <= 125 && y >= 2 && y <= 57) out.push([x + j, y, k]);
  }
  return out;
}
/** A puff of dust at (x, y), `size` 0 to 2. */
function dust(x: number, y: number, size: number, flip = false): Speck[] {
  const pts: [number, number, string][] = [
    [0, 0, "v"], [1, 0, "v"], [2, 0, "u"], [1, -1, "v"], [-1, 0, "u"],
    [3, -1, "v"], [2, -2, "u"], [4, 0, "v"], [-2, -1, "v"], [5, -2, "u"], [3, -3, "v"], [-3, 0, "u"],
  ];
  return pts.slice(0, 5 + size * 4).map(([a, b, k]) => [x + (flip ? -a : a), y + b, k] as Speck).filter(([sx, sy]) => sx >= 2 && sx <= 125 && sy >= 2 && sy <= 57);
}

// ---- Animations.

const REST: Pose = { paw: 3, tail: 0, bob: 0 };

const IDLE: Anim = {
  loop: true,
  frames: [
    frame({ ...REST, paw: 3, tail: 0, bob: 0 }, 100),
    frame({ ...REST, paw: 0, tail: 0, bob: 1, pressed: true, flag: true }, 100, { cue: "tap", specks: TAP }),
    frame({ ...REST, paw: 1, tail: 1, bob: 2 }, 100),
    frame({ ...REST, paw: 3, tail: 2, bob: 1 }, 100),
    frame({ ...REST, paw: 3, tail: 2, bob: 0 }, 100),
    frame({ ...REST, paw: 0, tail: 2, bob: 1, pressed: true, flag: true }, 100, { cue: "tap", specks: TAP }),
    frame({ ...REST, paw: 1, tail: 1, bob: 2 }, 100),
    frame({ ...REST, paw: 3, tail: 0, bob: 1 }, 100),
  ],
};

const LIE_DOWN: Anim = {
  loop: false,
  frames: [
    {
      layers: [{ part: smearPart("smearIn0", 100, 26, -1), x: 0, y: 0 }, { part: "clock00", x: 88, y: -4 }],
      ms: 70,
      cue: "zip",
      specks: speedLines(1, 9, 104, 125, 14, 56, "Ll"),
    },
    {
      layers: [{ part: smearPart("smearIn1", 40, 66, -1), x: 0, y: 0 }, { part: "clock00", x: 26, y: -6 }],
      ms: 70,
      specks: speedLines(2, 12, 80, 125, 12, 56, "Ll"),
    },
    {
      layers: layers({ dy: -3, hy: 4, eyes: "wide", noProp: true, paw: 6, tail: 2, bob: 2, clock: [2, -6] }),
      ms: 90,
      specks: [...speedLines(3, 6, 96, 125, 30, 56, "l"), ...dust(110, 57, 1), ...dust(80, 57, 0)],
    },
    {
      layers: layers({ hy: 3, eyes: "wide", noProp: true, paw: 6, tail: 1, bob: 1, clock: [0, -3] }),
      ms: 90,
      specks: [...dust(60, 57, 2), ...dust(112, 57, 1)],
    },
    {
      layers: layers({ hy: 1, eyes: "half", paw: 3, tail: 0, bob: 0, clock: [0, 0] }),
      ms: 100,
      specks: [...dust(2, 57, 1, false), ...dust(33, 57, 1)],
    },
    frame({ ...REST }, 120),
  ],
};

const GET_UP: Anim = {
  loop: false,
  frames: [
    {
      layers: layers({ dy: -4, hy: 0, eyes: "wide", noProp: true, paw: 6, tail: 2, bob: 2, clock: [2, -7] }),
      ms: 70,
      cue: "zip",
      specks: [...dust(56, 57, 2), ...dust(100, 57, 1), ...dust(20, 57, 0)],
    },
    {
      layers: [{ part: smearPart("smearOut0", 92, 62, 1), x: 0, y: 0 }, { part: "clock00", x: 66, y: -8 }],
      ms: 70,
      specks: [...speedLines(4, 12, 4, 36, 12, 56, "Ll"), ...dust(24, 57, 2)],
    },
    {
      layers: [{ part: smearPart("smearOut1", 123, 30, 1), x: 0, y: 0 }, { part: "clock00", x: 88, y: -8 }],
      ms: 70,
      specks: speedLines(5, 12, 20, 92, 12, 56, "Ll"),
    },
    { layers: [], ms: 80, specks: speedLines(6, 8, 50, 125, 14, 56, "Ll") },
    { layers: [], ms: 80, specks: speedLines(7, 4, 84, 125, 20, 54, "l") },
    { layers: [], ms: 60 },
  ],
};

export const DASH_LIE: Character = {
  id: "dash-lie",
  name: "Dash, lying down",
  w: W,
  h: H,
  foot: [64, 57],
  palette: PALETTE,
  halo: "#fff3d62e",
  parts,
  anims: { idle: IDLE, lieDown: LIE_DOWN, getUp: GET_UP },
};
