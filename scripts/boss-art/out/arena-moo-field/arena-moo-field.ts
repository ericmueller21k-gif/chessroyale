/**
 * Moo & Moon's Full Moon, scene A: the moonlit field. A full-bleed cinematic backdrop (200 x 260), not a boss.
 * One painted base (sky, moon, hills, farm, field) plus small layers: the moon's outer glow band (breathing),
 * swaying foreground tufts and flowers, and twinkling stars as specks.
 */
import type { Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";
import { canvas, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";

const W = 200;
const H = 260;
const MX = 100;
const MY = 82;
const MR = 58;

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const bay = (x: number, y: number) => BAYER[y & 3]![x & 3]! / 16;
function hash(x: number, y: number, s = 0): number {
  let h = Math.imul((x * 73856093) ^ (y * 19349663) ^ (s * 83492791), 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const palette = {
  k: "#070914",
  // sky, top to horizon, then two glow tones
  a: "#090b24",
  b: "#0e1236",
  c: "#151a47",
  d: "#1d2357",
  e: "#262d67",
  f: "#313876",
  g: "#3d4485",
  h: "#4f538f",
  i: "#67689d",
  // stars
  t: "#6f76b6",
  s: "#b8c2f0",
  w: "#ffffff",
  // the moon (pale moon-yellow)
  m: "#fffbe6",
  n: "#fff3c2",
  o: "#f6e1a0",
  p: "#e6c983",
  q: "#d0ad68",
  // far hills
  u: "#142a33",
  v: "#35585c",
  // barn
  r: "#9b3030",
  R: "#5e1d27",
  Y: "#ffd66a",
  // grass, shadow to moonlit tips
  "1": "#0a161b",
  "2": "#10232a",
  "3": "#183631",
  "4": "#22483a",
  "5": "#335f45",
  "6": "#5a8a55",
  "7": "#a3c178",
  // flowers
  W: "#eef0fa",
  V: "#a9b0d6",
  P: "#cf8fb6",
} as const;

const SKY = "abcdefghi";

const hillTop = (x: number) =>
  Math.round(137 - 9 * ((x - 100) / 100) ** 2 + 3 * Math.sin(x * 0.05 + 0.7) + 2 * Math.sin(x * 0.13 + 1.9));
const fieldTop = (x: number) => Math.round(151 - 4 * ((x - 100) / 100) ** 2 + 1.5 * Math.sin(x * 0.07 + 0.3));

function skyIdx(x: number, y: number): number {
  const t = (Math.max(0, y) / 146) * 6.4;
  let b = Math.floor(t);
  const f = t - b;
  if (f > 0.88) {
    if ((x + y) % 2 === 0) b++;
  } else if (f > 0.76) {
    if ((x & 1) === 0 && (y & 1) === 0) b++;
  }
  return Math.min(6, b);
}
/** Distance from the Milky Way's spine (it rises from the left horizon to the top). */
const milky = (x: number, y: number) => Math.abs(132 * (x + 0.5) + 62 * (y + 0.5) - 8184) / 145.8;
const moonD = (x: number, y: number) => Math.hypot(x + 0.5 - MX, y + 0.5 - MY);
const glowD = (x: number, y: number) => moonD(x, y) + (bay(x, y) - 0.5) * 2.5;

function skyKey(x: number, y: number, breath = false): string {
  let i = skyIdx(x, y);
  const md = milky(x, y);
  if ((md < 4 && bay(x, y) < 0.5) || (md < 9 && bay(x, y) < 0.19)) i++;
  const g = glowD(x, y);
  i += g < MR + 4 ? 3 : g < MR + 10 ? 2 : g < MR + 16 ? 1 : 0;
  if (breath && g >= MR + 16 && g < MR + 22) i++;
  return SKY[Math.min(8, i)]!;
}

// ---------------------------------------------------------------- the base picture
const base: Canvas = canvas(W, H);
const put = (x: number, y: number, k: string) => {
  if (x >= 0 && y >= 0 && x < W && y < H) base[y]![x] = k;
};
const get = (x: number, y: number) => base[y]?.[x] ?? ".";

// sky
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) base[y]![x] = skyKey(x, y);

// the moon
const MARIA: [number, number, number, number][] = [
  [-16, -20, 17, 11],
  [-4, -10, 9, 8],
  [8, -18, 9, 8],
  [17, -3, 11, 10],
  [35, -11, 6, 6],
  [-8, 21, 10, 6],
  [24, 15, 7, 7],
  [6, 8, 6, 5],
];
/** Oceanus Procellarum: a broad, faint sea on the left. */
const FAINT: [number, number, number, number][] = [
  [-30, 4, 13, 18],
  [-20, 14, 10, 9],
];
const moonNoise = (dx: number, dy: number) => 0.18 * Math.sin(dx * 0.45 + dy * 0.3) + 0.12 * Math.sin(dx * 0.21 - dy * 0.63 + 1.3);
const CRATERS: [number, number, number][] = [
  [30, -30, 3],
  [-34, -28, 2],
  [2, -36, 2],
  [-2, 34, 3],
  [34, 22, 2],
  [-38, 18, 2],
  [24, 36, 2],
];
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const d = moonD(x, y);
    if (d > MR) continue;
    const r = d / MR + (bay(x, y) - 0.5) * 0.06;
    let k = r < 0.55 ? "m" : r < 0.9 ? "n" : "o";
    const dx = x + 0.5 - MX;
    const dy = y + 0.5 - MY;
    let sea = 99;
    let faint = 99;
    for (const [cx, cy, rx, ry] of MARIA) sea = Math.min(sea, ((dx - cx) / rx) ** 2 + ((dy - cy) / ry) ** 2);
    for (const [cx, cy, rx, ry] of FAINT) faint = Math.min(faint, ((dx - cx) / rx) ** 2 + ((dy - cy) / ry) ** 2);
    sea += moonNoise(dx, dy);
    faint += moonNoise(dy, dx);
    if (faint < 1) k = k === "m" ? "n" : "o";
    if (sea < 0.6) k = "p";
    else if (sea < 1 || (sea < 1.25 && bay(x, y) < 0.5)) k = "o";
    for (const [cx, cy, cr] of CRATERS) {
      const cd = Math.hypot(dx - cx, dy - cy);
      if (cd < cr - 0.6) k = cd < cr - 1.6 ? "o" : "p";
      else if (cd < cr + 0.4 && dx - cx > 0 && dy - cy > 0) k = "m";
    }
    base[y]![x] = k;
  }
// a few deeper pits in the seas
for (const [px, py] of [[-20, -20], [-19, -20], [19, -2], [-9, 21], [9, -18]] as const) put(MX + px, MY + py, "q");

// stars
type Star = { x: number; y: number; kind: "dust" | "dim" | "bright" | "cross" | "big" };
const stars: Star[] = [];
const taken = (x: number, y: number, r: number) => stars.some((s) => Math.abs(s.x - x) < r && Math.abs(s.y - y) < r);
{
  const R = rng(4242);
  for (let n = 0; n < 420 && stars.length < 210; n++) {
    const x = 3 + Math.floor(R() * 194);
    const y = 2 + Math.floor(R() * 140);
    const v = R();
    if (moonD(x, y) < MR + 17 || y > hillTop(x) - 4 || taken(x, y, 5)) continue;
    const kind = v < 0.5 ? "dust" : v < 0.78 ? "dim" : v < 0.9 ? "bright" : v < 0.975 ? "cross" : "big";
    if ((kind === "big" || kind === "cross") && (moonD(x, y) < MR + 24 || x < 6 || x > 193 || y < 4)) continue;
    stars.push({ x, y, kind });
  }
  // Milky Way dust
  for (let n = 0; n < 400; n++) {
    const x = Math.floor(R() * 70);
    const y = Math.floor(R() * 140);
    if (milky(x, y) > 8 || moonD(x, y) < MR + 17 || y > hillTop(x) - 4 || taken(x, y, 2)) continue;
    stars.push({ x, y, kind: R() < 0.8 ? "dust" : "dim" });
  }
}
const skyAt = (x: number, y: number) => skyKey(x, y);
for (const s of stars) {
  if (s.kind === "dust") put(s.x, s.y, "t");
  else if (s.kind === "dim") put(s.x, s.y, "s");
  else if (s.kind === "bright") put(s.x, s.y, "w");
  else {
    put(s.x, s.y, "w");
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(s.x + dx, s.y + dy, "s");
    if (s.kind === "big") for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) put(s.x + dx, s.y + dy, "t");
  }
}

// far hills
for (let x = 0; x < W; x++) {
  const top = hillTop(x);
  const ft = fieldTop(x);
  for (let y = top; y < ft; y++) put(x, y, y === top ? "k" : y === top + 1 ? "v" : y === top + 2 && bay(x, y) < 0.5 ? "v" : "u");
}

// the farm: barn, silo, fence (far off, on the left)
const BARN = [
  "....kkkkkkk....",
  "...kuuuvvvvk...",
  "..kuuuuuuvvvk..",
  ".kuuuuuuuuuvvk.",
  "kkkkkkkkkkkkkkk",
  ".kRrrrrrrrrrrk.",
  ".kRrrrrYYrrrrk.",
  ".kRrrrrYYrrrrk.",
  ".kRrrrrrrrrrrk.",
  ".kRrrkkkkkrrrk.",
  ".kRrrkRrRkrrrk.",
  ".kRrrkrRrkrrrk.",
  ".kRrrkRrRkrrrk.",
  ".kkkkkkkkkkkkk.",
];
const SILO = [
  ".kkk.",
  "kuvvk",
  "kuuvk",
  "kkkkk",
  "kuuvk",
  "kuuvk",
  "kuuvk",
  "kkkkk",
  "kuuvk",
  "kuuvk",
  "kuuvk",
  "kuuvk",
];
const stamp = (g: string[], ox: number, oy: number) =>
  g.forEach((row, y) => [...row].forEach((c, x) => c !== "." && put(ox + x, oy + y, c)));
{
  const bx = 14;
  const gy = hillTop(bx + 7) + 3;
  stamp(SILO, bx - 6, gy - SILO.length + 1);
  stamp(BARN, bx, gy - BARN.length + 1);
  put(bx + 7, gy - BARN.length - 1, "k"); // weather vane
  // fence running off to the right along the ridge
  let prev: [number, number] | null = null;
  for (let px = bx + 18; px <= 70; px += 5) {
    const g = hillTop(px) + 1;
    for (let y = g - 4; y <= g; y++) put(px, y, "k");
    put(px, g - 4, "v");
    if (prev) {
      const [qx, qy] = prev;
      for (let x = qx + 1; x < px; x++) {
        const yy = Math.round(qy + ((g - qy) * (x - qx)) / (px - qx));
        put(x, yy - 3, "k");
        put(x, yy - 1, "k");
      }
    }
    prev = [px, g];
  }
}

// the field
function fieldL(x: number, y: number): number {
  const depth = (y - 150) / 110;
  const dx = Math.abs(x + 0.5 - 100) / 100;
  let L = 0.93 - 0.82 * depth - 0.4 * dx * dx + 0.06 * Math.sin(y * 0.2 + 2.5 * Math.sin(x * 0.03));
  const e = ((x + 0.5 - 100) / 40) ** 2 + ((y + 0.5 - 206) / 11) ** 2;
  if (e < 1) L += 0.1 + 0.2 * (1 - e);
  return L;
}
for (let x = 0; x < W; x++) {
  const ft = fieldTop(x);
  for (let y = ft; y < H; y++) {
    if (y === ft) {
      put(x, y, "k");
      continue;
    }
    const L = fieldL(x, y) + (bay(x, y) - 0.5) * 0.1;
    put(x, y, "12345"[Math.max(0, Math.min(4, Math.floor(L * 5)))]!);
  }
}
const calm = (x: number, y: number) => x >= 70 && x <= 130 && y >= 150 && y <= 214;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const ft = fieldTop(x);
    if (y < ft + 2) continue;
    const depth = (y - 150) / 110;
    let prob = 0.05 + depth * 0.03;
    if (calm(x, y)) prob *= 0.3;
    if (hash(x, y, 7) >= prob) continue;
    const b = Number(get(x, y));
    if (!(b >= 1)) continue;
    let len = 1 + Math.floor(hash(x, y, 8) * (1 + depth * 4));
    if (calm(x, y)) len = Math.min(len, 2);
    const lean = len >= 3 ? (hash(x, y, 9) < 0.5 ? -1 : 1) : 0;
    const tip = Math.min(b >= 4 && hash(x, y, 10) < 0.35 ? 7 : 6, b + (depth < 0.3 ? 1 : 2));
    if (y + 1 < H && get(x, y + 1) !== "k") put(x, y + 1, String(Math.max(1, b - 1)));
    for (let t = 0; t < len; t++) {
      const py = y - t;
      const px = t === len - 1 ? x + lean : x;
      if (py <= fieldTop(px)) break;
      put(px, py, String(t === len - 1 ? tip : Math.min(6, b + 1)));
    }
  }

// ---------------------------------------------------------------- the moving bits
/** The glow ring's outer band, drawn only on the "breath in" frames. */
function glowBand(): Part {
  const cv = canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const g = glowD(x, y);
      if (g < MR + 16 || g >= MR + 22) continue;
      if (y >= hillTop(x)) continue;
      const k = get(x, y);
      if (!SKY.includes(k)) continue; // keep stars and the farm
      cv[y]![x] = skyKey(x, y, true);
    }
  return { grid: toGrid(cv), outline: false };
}

/** A clump of grass blades, lit on its right side (toward the moon); flip it for the right-hand clumps. */
function tuft(w: number, h: number, seed: number, n: number): Part {
  const R = rng(seed);
  const cv = canvas(w, h);
  // a dark mound the blades grow from
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (((x + 0.5 - w / 2) / (w * 0.42)) ** 2 + ((y + 0.5 - h) / (h * 0.3)) ** 2 <= 1) cv[y]![x] = "2";
  const blades = Array.from({ length: n }, () => {
    const bx = w * 0.12 + R() * w * 0.76;
    return { bx, len: h * (0.35 + R() * 0.65), lean: (R() - 0.5) * w * 0.3 + (bx - w / 2) * 0.6, width: Math.max(3, Math.round(w / 14)) + Math.floor(R() * 3) };
  }).sort((a, b) => b.len - a.len);
  for (const bl of blades) {
    const px: [number, number, number][] = [];
    const len = Math.round(bl.len);
    for (let t = 0; t < len; t++) {
      const y = h - 1 - t;
      const fr = t / len;
      const cx = bl.bx + bl.lean * fr ** 1.6;
      const half = bl.width * (1 - fr) * 0.5 + 0.5;
      const x0 = Math.round(cx - half);
      const x1 = Math.max(x0, Math.round(cx + half) - 1);
      for (let x = x0; x <= x1; x++) px.push([x, y, x === x1 ? 1 : 0]);
    }
    const inBlade = new Set(px.map(([x, y]) => `${x},${y}`));
    for (const [x, y] of px)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const X = x + dx;
        const Y = y + dy;
        if (!inBlade.has(`${X},${Y}`) && Y >= 0 && Y < h && X >= 0 && X < w) cv[Y]![X] = "k";
      }
    const topY = h - len;
    for (const [x, y, lit] of px) {
      if (x < 0 || x >= w) continue;
      const fr = (h - 1 - y) / len;
      let k = fr < 0.35 ? "2" : fr < 0.7 ? "3" : "4";
      if (lit) k = fr < 0.35 ? "3" : fr < 0.7 ? "5" : "6";
      if (y === topY) k = "7";
      cv[y]![x] = k;
    }
  }
  return { grid: toGrid(cv) };
}

const DAISY: Part = {
  grid: [".WPW.", "WWPWV", "WWWWV", ".WWV.", "..V..", "..4..", "..4..", "..3..", "..3..", "..3..", "..3.."],
};
const DAISY2: Part = {
  grid: [".W.", "WWV", "WWV", ".V.", ".4.", ".4.", ".3.", ".3."],
};
const CLOVER: Part = {
  grid: [
    ".PP.",
    "PPWP",
    "PPPP",
    ".PP.",
    "..4.",
    "56.4",
    "554.",
    "..4.",
    "..3.",
  ],
};

const parts: Record<string, Part> = {
  base: { grid: toGrid(base), outline: false },
  glow: glowBand(),
  tuftL: tuft(64, 50, 11, 34),
  tuftR: tuft(60, 46, 29, 30),
  tuftML: tuft(26, 20, 5, 10),
  tuftMR: tuft(24, 18, 77, 9),
  daisy: DAISY,
  daisy2: DAISY2,
  clover: CLOVER,
};

const sway = (part: string, x: number, y: number, f: number, off: number, flipX = false): Layer => ({
  part,
  x,
  y,
  flipX,
  wave: { along: "rows", amp: 1, len: 400, phase: ((f + off) % 4) * (Math.PI / 2), pin: "bottom" },
});

// twinkling stars: a few at a time swell or fade
const twinklers = stars.filter((s) => s.kind !== "dust" && s.kind !== "big");
const picked = Array.from({ length: 16 }, (_, i) => twinklers[Math.floor((i * twinklers.length) / 16)]!);
const bigs = stars.filter((s) => s.kind === "big");
function twinkle(f: number): Speck[] {
  const out: Speck[] = [];
  const arms = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  picked.forEach((s, i) => {
    const st = (f + i) % 4;
    if (s.kind === "cross") {
      if (st === 1) for (const [dx, dy] of arms) out.push([s.x + dx, s.y + dy, "t"]);
      if (st === 2) {
        out.push([s.x, s.y, "s"]);
        for (const [dx, dy] of arms) out.push([s.x + dx, s.y + dy, skyAt(s.x + dx, s.y + dy)]);
      }
    } else {
      if (st === 1) out.push([s.x, s.y, "w"]);
      if (st === 2) {
        out.push([s.x, s.y, "w"]);
        for (const [dx, dy] of arms) out.push([s.x + dx, s.y + dy, "t"]);
      }
      if (st === 3 && s.kind === "bright") out.push([s.x, s.y, "s"]);
    }
  });
  bigs.forEach((s, i) => {
    const st = (f + i * 2) % 4;
    if (st === 1 || st === 2) for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]] as const) out.push([s.x + dx, s.y + dy, "t"]);
    if (st === 2) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) out.push([s.x + dx, s.y + dy, "s"]);
  });
  return out;
}

function frame(f: number): Frame {
  const layers: Layer[] = [{ part: "base", x: 0, y: 0 }];
  if (f === 1 || f === 2) layers.push({ part: "glow", x: 0, y: 0 });
  layers.push(
    sway("tuftML", 20, 187, f, 1),
    sway("tuftMR", 158, 185, f, 3, true),
    sway("tuftL", -6, 214, f, 0),
    sway("tuftR", 148, 218, f, 2, true),
    sway("daisy", 44, 221, f, 0),
    sway("daisy2", 54, 229, f, 1),
    sway("daisy2", 10, 224, f, 2),
    sway("clover", 26, 229, f, 0),
    sway("daisy", 150, 225, f, 2, true),
    sway("daisy2", 186, 222, f, 0, true),
    sway("clover", 168, 229, f, 3, true),
    sway("daisy2", 64, 236, f, 3),
    sway("clover", 136, 236, f, 1, true),
  );
  return { layers, ms: 400, specks: twinkle(f) };
}

export const ARENA_MOO_FIELD: Character = {
  id: "arena-moo-field",
  name: "Moonlit field",
  w: W,
  h: H,
  foot: [100, 205],
  palette,
  parts,
  anims: {
    idle: { frames: [0, 1, 2, 3].map(frame), loop: true },
  },
};
