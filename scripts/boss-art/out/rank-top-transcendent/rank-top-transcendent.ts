/**
 * Transcendent: the rank emblem for the top 100 players. A king of starlight with a white-gold halo, standing in
 * front of a faceted indigo-violet octagon badge, with studs at its corners, starlight wings at its sides, a crest at
 * its top and a glow round it (a division-1 emblem, and a little more: stars that twinkle, a shine that travels round
 * the halo and round the badge's facets).
 *
 * One animation: idle (8 frames, 2 s, loops). The emblem is still; its light moves.
 */
import { canvas, edge, inPoly, line, poly, shade, toGrid } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE = {
  k: "#0a051c", // outline
  // the badge's eight facets, clockwise from the top (light from the top left)
  "1": "#8e68f0",
  "2": "#6a45cf",
  "3": "#4d2fa6",
  "4": "#33207a",
  "5": "#412893",
  "6": "#5c3bbb",
  "7": "#8059e4",
  "8": "#b9a1ff",
  W: "#efe7ff", // bright rim
  d: "#20105a", // facet seams and the dark rim
  // the badge's table: deep cosmic indigo
  n: "#0f0829",
  N: "#190e44",
  m: "#271766",
  M: "#36228a",
  // glow round the halo, on the table
  i: "#241567",
  h: "#5a3cc4",
  H: "#33217f",
  // starlight (the king, the wings, the crest)
  w: "#ffffff",
  s: "#e9e2ff",
  t: "#bcaaf3",
  u: "#8a76d6",
  U: "#5e4aa8",
  // white-gold (the halo, the gems)
  y: "#fff6c4",
  Y: "#ffdf72",
  g: "#eab53e",
  G: "#b0802a",
  p: "#b6a4ff", // a dim star
  // the see-through glow round the badge (pulses)
  o: "#a77cff90",
  O: "#9468ff48",
} as const;

const parse = (c: string): number[] => {
  const s = c.replace("#", "");
  const out = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  if (s.length === 8) out.push(parseInt(s.slice(6, 8), 16));
  return out;
};
const mix = (a: string, b: string, t: number): string => {
  const A = parse(a);
  const B = parse(b);
  return "#" + A.map((v, j) => Math.round(v + ((B[j] ?? v) - v) * t).toString(16).padStart(2, "0")).join("");
};

// ---- The badge.

/** The badge, 32 x 32: an octagon of eight facets round a table. */
const OUT: readonly (readonly [number, number])[] = [[9, 0], [23, 0], [32, 9], [32, 23], [23, 32], [9, 32], [0, 23], [0, 9]];
const INN: readonly (readonly [number, number])[] = [[10.66, 4], [21.34, 4], [28, 10.66], [28, 21.34], [21.34, 28], [10.66, 28], [4, 21.34], [4, 10.66]];
const BX = 8; // the badge's top-left on the frame
const BY = 11;

function badge(): Part {
  const cv = canvas(32, 32);
  shade(cv, inPoly(INN), "nNmM", (x, y) => 0.98 - 1.0 * ((x + y - 8) / 48));
  for (let i = 0; i < 8; i++) poly(cv, [OUT[i]!, OUT[(i + 1) % 8]!, INN[(i + 1) % 8]!, INN[i]!], String(i + 1));
  edge(cv, 0, -1, "1", "W");
  edge(cv, -1, 0, "7", "W");
  edge(cv, -1, 0, "8", "W");
  edge(cv, 0, -1, "8", "W");
  edge(cv, 1, 0, "3", "d");
  edge(cv, 1, 0, "4", "d");
  edge(cv, 0, 1, "4", "d");
  edge(cv, 0, 1, "5", "d");
  // seams between facets
  for (let i = 0; i < 8; i++) {
    const [ox, oy] = OUT[i]!;
    const [ix, iy] = INN[i]!;
    const x0 = Math.min(31, Math.max(0, Math.round(ox - (ox > 16 ? 1 : 0))));
    const y0 = Math.min(31, Math.max(0, Math.round(oy - (oy > 16 ? 1 : 0))));
    line(cv, x0, y0, Math.round(ix - 0.5), Math.round(iy - 0.5), "d");
  }
  return { grid: toGrid(cv) };
}

/** Four round gems for the badge's corners. */
const STUD: Part = { grid: [".wy.", "wyYg", "yYgg", ".gG."] };

/** The glow round the badge: see-through, three pixels thick. Drawn first, no outline. */
function glowRound(): Part {
  const S = 44;
  const cv = canvas(S, S);
  const c = S / 2;
  const oct = (d: number): [number, number][] => {
    const half = 16 + d;
    const cut = 9 + d * 0.586;
    return [[c - half + cut, c - half], [c + half - cut, c - half], [c + half, c - half + cut], [c + half, c + half - cut], [c + half - cut, c + half], [c - half + cut, c + half], [c - half, c + half - cut], [c - half, c - half + cut]];
  };
  poly(cv, oct(4), "O");
  poly(cv, oct(3), "O");
  poly(cv, oct(2), "o");
  poly(cv, oct(0), "o");
  return { grid: toGrid(cv), outline: false };
}

// ---- The halo and the glow behind the king.

const HX = 24; // the halo's centre on the frame
const HY = 23;
function haloRing(step: number): Part {
  const cv = canvas(22, 22);
  const hl = ((-135 + step * 45) * Math.PI) / 180;
  for (let y = 0; y < 22; y++)
    for (let x = 0; x < 22; x++) {
      const dx = x + 0.5 - 11;
      const dy = y + 0.5 - 11;
      const r = Math.hypot(dx, dy);
      if (r > 10.6 || r < 7.7) continue;
      const l = 0.5 - 0.42 * (dx / 10) - 0.5 * (dy / 10);
      let tone = l > 0.62 ? 3 : l > 0.3 ? 2 : 1;
      if (r < 9.2) tone += 1; // the inner edge glows whiter
      let da = Math.abs(Math.atan2(dy, dx) - hl);
      if (da > Math.PI) da = 2 * Math.PI - da;
      if (da < 0.5) tone += 1;
      else if (da < 0.95 && tone < 3) tone += 1;
      cv[y]![x] = "GgYyw"[Math.min(4, tone)]!;
    }
  return { grid: toGrid(cv), outline: false };
}

/** The soft glow on the table round the halo, and the disc inside it. */
function haloGlow(): Part {
  const S = 28;
  const cv = canvas(S, S);
  const inTable = inPoly(INN.map(([x, y]) => [x + BX - (HX - 14), y + BY - (HY - 14)] as const));
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!inTable(x, y)) continue;
      const r = Math.hypot(x + 0.5 - 14, y + 0.5 - 14);
      if (r < 8) cv[y]![x] = "i";
      else if (r >= 10.4 && r < 12) cv[y]![x] = "h";
      else if (r >= 12 && r < 13.6) cv[y]![x] = "H";
    }
  // dim stars in the disc, beside the cross
  for (const [fx, fy] of [[20, 21], [29, 20], [17, 24], [30, 23]] as const) cv[fy - (HY - 14)]![fx - (HX - 14)] = "p";
  return { grid: toGrid(cv), outline: false };
}

// ---- The king of starlight.

const KING_WIDTHS = [2, 2, 8, 8, 2, 2, 2, 2, 6, 8, 10, 12, 12, 8, 6, 12, 14, 10, 10, 12, 12, 14, 14, 18, 18];
const KING_MASK = KING_WIDTHS.map((w) => ".".repeat((18 - w) / 2) + "X".repeat(w) + ".".repeat((18 - w) / 2));
function king(): Part {
  const H = KING_MASK.length;
  const W = 18;
  const cv = canvas(W, H);
  const ramp = ["U", "u", "t", "s", "w"];
  const on = (x: number, y: number) => KING_MASK[y]?.[x] === "X";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!on(x, y)) continue;
      let a = x;
      while (on(a - 1, y)) a--;
      let b = x;
      while (on(b + 1, y)) b++;
      const w = b - a + 1;
      const f = (x - a + 0.5) / w;
      let i = f < 0.1 ? 3 : f < 0.45 ? 4 : f < 0.65 ? 3 : f < 0.8 ? 2 : f < 0.92 ? 1 : 0;
      if (!on(x, y - 1)) i = Math.min(4, i + 1);
      if (!on(x, y + 1)) i = Math.max(0, i - 1);
      cv[y]![x] = ramp[i]!;
    }
  }
  // the crown's jewels
  cv[11]![8] = "y";
  cv[11]![9] = "Y";
  cv[12]![8] = "g";
  cv[12]![9] = "G";
  cv[11]![5] = "Y";
  cv[11]![12] = "g";
  // a few stars of the king's own
  cv[16]![6] = "y";
  cv[18]![11] = "Y";
  cv[20]![7] = "y";
  cv[21]![12] = "g";
  return { grid: toGrid(cv) };
}

// ---- Wings: a fan of outlined feathers at each side.

interface Feather {
  part: Part;
  ox: number;
  oy: number;
}
/** A feather grown from the origin at `ang` degrees (0 = right, -90 = up), `len` long and `wid` wide. */
function feather(len: number, wid: number, ang: number, dark: boolean): Feather {
  const S = 40;
  const C = 20;
  const cv = canvas(S, S);
  const a = (ang * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const vx = -uy;
  const vy = ux;
  const side: [number, number][] = [];
  const other: [number, number][] = [];
  for (let n = 0; n <= 10; n++) {
    const t = n / 10;
    const hw = Math.max(t === 0 ? 0.7 : 0.4, (wid / 2) * Math.sin(Math.PI * Math.pow(t, 0.75)));
    const px = C + ux * len * t;
    const py = C + uy * len * t;
    side.push([px + vx * hw, py + vy * hw]);
    other.push([px - vx * hw, py - vy * hw]);
  }
  poly(cv, [...side, ...other.reverse()], "t");
  // trim to the feather
  let x0 = S;
  let y0 = S;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (cv[y]![x] !== ".") (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  const rows: string[] = [];
  const ramp = dark ? ["U", "U", "u", "t", "s"] : ["u", "t", "s", "s", "w"];
  for (let y = y0; y <= y1; y++) {
    let row = "";
    for (let x = x0; x <= x1; x++) {
      if (cv[y]![x] === ".") {
        row += ".";
        continue;
      }
      const up = cv[y - 1]?.[x] !== "." && y > 0;
      const down = cv[y + 1]?.[x] !== "." && y < S - 1;
      const dist = Math.hypot(x - C, y - C) / len; // 0 at the root, 1 at the tip
      let i = dist > 0.55 ? 2 : 1;
      if (!up) i += 1;
      if (!down) i -= 1;
      row += ramp[Math.max(0, Math.min(4, i))];
    }
    rows.push(row);
  }
  return { part: { grid: rows }, ox: x0 - C, oy: y0 - C };
}

const WING_FEATHERS = [
  { len: 14, wid: 4.4, ang: -106 },
  { len: 13, wid: 4.4, ang: -128 },
  { len: 11, wid: 4.2, ang: -150 },
  { len: 9, wid: 4, ang: -172 },
];
const WING_PIVOT_L: readonly [number, number] = [13, 30];
const WING_PIVOT_R: readonly [number, number] = [35, 30];

// ---- The crest.

/** The crest's centre: a cut white-gold gem (6 x 9), the left side light, the right dark. */
const GEM: Part = {
  grid: ["..yY..", ".yyYY.", "yyyYYg", "yyYYgg", "yYYggG", ".YgGGg", "..gGG.", "...G.."],
};

const parts: Record<string, Part> = {
  glow: glowRound(),
  gem: GEM,
  badge: badge(),
  stud: STUD,
  haloGlow: haloGlow(),
  king: king(),
};
for (let i = 0; i < 8; i++) parts[`ring${i}`] = haloRing(i);

const wingLayers = (right: boolean): Layer[] =>
  WING_FEATHERS.map((f, n) => {
    const ang = right ? -180 - f.ang : f.ang;
    const fe = feather(f.len, f.wid, ang, right);
    const name = `feather${right ? "R" : "L"}${n}`;
    parts[name] = fe.part;
    const [px, py] = right ? WING_PIVOT_R : WING_PIVOT_L;
    return { part: name, x: px + fe.ox, y: py + fe.oy };
  });
const WING_L = wingLayers(false);
const WING_R = wingLayers(true);

// two horns of starlight leaning out from behind the crest's gem
const CREST_FEATHERS = [
  { len: 9, wid: 4, ang: -110 },
  { len: 8, wid: 3.6, ang: -140 },
];
const crestLayers = (right: boolean): Layer[] =>
  CREST_FEATHERS.map((f, n) => {
    const ang = right ? -180 - f.ang : f.ang;
    const fe = feather(f.len, f.wid, ang, right);
    const name = `horn${right ? "R" : "L"}${n}`;
    parts[name] = fe.part;
    const px = right ? 26 : 22;
    return { part: name, x: px + fe.ox, y: 12 + fe.oy };
  });
const CREST_L = crestLayers(false);
const CREST_R = crestLayers(true);

// ---- Twinkling stars (loose pixels on top).

interface Star {
  x: number;
  y: number;
  phase: number;
  big: boolean;
  key: string; // centre
  arm: string;
}
const PROFILE = [0, 1, 2, 3, 2, 1, 0, 0];
const STARS: readonly Star[] = [
  { x: 6, y: 8, phase: 0, big: true, key: "y", arm: "Y" },
  { x: 41, y: 6, phase: 3, big: true, key: "y", arm: "Y" },
  { x: 5, y: 42, phase: 5, big: true, key: "y", arm: "Y" },
  { x: 42, y: 41, phase: 1, big: true, key: "y", arm: "Y" },
  { x: 3, y: 31, phase: 2, big: false, key: "w", arm: "p" },
  { x: 44, y: 24, phase: 6, big: false, key: "w", arm: "p" },
  { x: 14, y: 3, phase: 4, big: false, key: "w", arm: "p" },
  { x: 34, y: 3, phase: 7, big: false, key: "w", arm: "p" },
  { x: 18, y: 21, phase: 1, big: false, key: "w", arm: "p" },
  { x: 31, y: 25, phase: 4, big: false, key: "w", arm: "p" },
  { x: 14, y: 35, phase: 6, big: false, key: "w", arm: "p" },
  { x: 33, y: 34, phase: 2, big: false, key: "w", arm: "p" },
];

function starSpecks(x: number, y: number, state: number, key: string, arm: string): Speck[] {
  if (state <= 0) return [];
  const out: Speck[] = [[x, y, key]];
  if (state >= 2) out.push([x - 1, y, arm], [x + 1, y, arm], [x, y - 1, arm], [x, y + 1, arm]);
  if (state >= 3) out.push([x - 2, y, arm], [x + 2, y, arm], [x, y - 2, arm], [x, y + 2, arm]);
  if (state >= 4) out.push([x - 3, y, arm], [x + 3, y, arm], [x, y - 3, arm], [x, y + 3, arm]);
  return out;
}

// ---- The idle.

const FRAMES = 8;
const FACET_SHINE = "#f4eeff";

function frame(i: number): Frame {
  const pulse = 0.5 + 0.5 * Math.sin((2 * Math.PI * i) / FRAMES - Math.PI / 2);
  const pal: Record<string, string> = {
    o: mix("#a77cff60", "#bd96ffc0", pulse),
    O: mix("#9468ff28", "#a47aff60", pulse),
    h: mix("#5a3cc4", "#8260ec", pulse),
    H: mix("#33217f", "#4f37b4", pulse),
    Y: mix("#ffd85a", "#ffeb9a", pulse),
  };
  // a shine runs round the facets, one a frame, with a tail
  for (let j = 0; j < 8; j++) {
    const d = (i - j + 8) % 8;
    const level = d === 0 ? 0.62 : d === 1 ? 0.3 : 0;
    if (level > 0) pal[String(j + 1)] = mix(PALETTE[String(j + 1) as "1"], FACET_SHINE, level);
  }
  const L = (part: string, x: number, y: number): Layer => ({ part, x, y });
  const layers: Layer[] = [
    L("glow", 2, 5),
    ...WING_L,
    ...WING_R,
    ...CREST_L,
    ...CREST_R,
    L("badge", BX, BY),
    L("gem", 21, 3),
    L("stud", 11, 14),
    L("stud", 33, 14),
    L("stud", 11, 36),
    L("stud", 33, 36),
    L("haloGlow", HX - 14, HY - 14),
    L(`ring${i}`, HX - 11, HY - 11),
    L("king", 15, 15),
  ];
  const specks: Speck[] = [];
  for (const s of STARS) {
    const st = PROFILE[(i + s.phase) % PROFILE.length]!;
    specks.push(...starSpecks(s.x, s.y, s.big ? st : Math.min(st, 2), s.key, s.arm));
  }
  // the glint on the king's cross
  const g = PROFILE[(i + 2) % PROFILE.length]!;
  specks.push(...starSpecks(20, 17, g === 3 ? 4 : g, "w", "y"));
  return { layers, ms: 250, pal, specks };
}

const idle: Anim = { loop: true, frames: Array.from({ length: FRAMES }, (_, i) => frame(i)) };

export const RANK_TOP_TRANSCENDENT: Character = {
  id: "rank-top-transcendent",
  name: "Transcendent",
  w: 48,
  h: 48,
  foot: [24, 44],
  palette: PALETTE,
  halo: "#9b7cff40",
  parts,
  anims: { idle },
};
