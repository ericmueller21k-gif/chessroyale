/**
 * Armored Birdie (variant B, chunky), Eric's design, Nov 23: after the train hits him in his ultimate, Birdie takes on the
 * train's colors and stands up on both legs like a classic armored robot-boss. Still clearly the same dove: the round
 * grey-brown head, buff face, small grey beak, the big dark eye in its pale ring with a glint (the head paint copied from
 * boss-birdie.ts), the navy conductor's cap (now with a gold visor) and the burgundy tie. The train became his armor:
 * yellow plates, the roof's charcoal, the thin red stripe. Big domed shoulder plates with a headlight on each, armored
 * wings hanging like arms (scalloped yellow plates over the coverts, his dark flight feathers behind) ending in heavy
 * armored claws, a wide chest plate with the red stripe down its middle, charcoal thighs, and heavy boots on wheel soles.
 * No train under him. Facing a little to our left (his beak and eye to the left), light from the top left.
 *
 * Rigging (`ArmorPose`, all numbers): the legs and boots stay planted; everything above the hips (body, head, wings,
 * shoulder plates, cap, tie) rises with a breath; the head (with its cap) moves on its own; the lid; and a headlight
 * glint (which lamp, how bright) drawn as specks over the lamp.
 *
 * Only the idle is drawn (the brief): a breath, a blink, a glance, the headlights glinting one after the other.
 */
import { canvas, inEllipse, inPoly, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#1d1411", // outline
  a: "#3d2e27", // his brown: deep shadow to light
  b: "#5c4638",
  c: "#7c624f",
  d: "#9c8069",
  e: "#bfa58b",
  f: "#8f6c5b", // face and breast: warm buff, dark to light
  g: "#b08773",
  h: "#cea58c",
  i: "#e6c6ac",
  s: "#2b1f1b", // dark marks
  o: "#cfd8d6", // the pale ring round his eye
  x: "#0d0909", // the eye
  w: "#fffaf0", // the glint
  B: "#3e373c", // beak
  C: "#7a7075",
  "1": "#0f1328", // the cap: navy, dark to light
  "2": "#1c2850",
  "3": "#2d3f7c",
  "4": "#4a60a8",
  K: "#a87414", // gold
  L: "#f2c14e",
  R: "#6a1222", // tie: burgundy, dark to light
  T: "#a52238",
  U: "#d64a5a",
  u: "#9a6a08", // the train's yellow armor: dark to light
  v: "#d49a12",
  y: "#f4c21e",
  Y: "#ffe27a",
  m: "#23232b", // the roof's charcoal: dark to light
  n: "#3b3b46",
  N: "#5a5a68",
  q: "#cc2a2a", // the red stripe, and its shadow
  Q: "#8a1a1e",
  j: "#4a4f5a", // the train's silver: dark, mid, light (lamp rims, wheels)
  l: "#8d94a1",
  J: "#d3d8e0",
  W: "#fff3b8", // headlights
  G: "#0b0c10", // ground shadow
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;

const E = inEllipse;
const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const union = (...fs: Inside[]): Inside => (x, y) => fs.some((f) => f(x, y));
const and = (a: Inside, b: Inside): Inside => (x, y) => a(x, y) && b(x, y);

/** A part painted in frame pixels: its canvas covers (x0, y0) to (x0 + w, y0 + h). */
function painted(
  x0: number,
  y0: number,
  w: number,
  h: number,
  draw: (F: (inside: Inside, key: Key) => void, S: (rows: readonly string[], x: number, y: number) => void, cv: Canvas) => void,
  outline = true,
): { part: Part; at: Pt } {
  const cv: Canvas = canvas(w, h);
  const F = (inside: Inside, key: Key) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
  };
  const S = (rows: readonly string[], sx: number, sy: number) =>
    rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        const X = Math.round(sx) + i - x0;
        const Y = Math.round(sy) + j - y0;
        if (k !== "." && cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
      }),
    );
  draw(F, S, cv);
  return { part: { grid: toGrid(cv), outline }, at: [x0, y0] };
}

/** A yellow armor plate's paint: lit rim on its top and left, dark rim on its bottom and right, banded inside by the light. */
const plate = (inside: Inside, cx: number, cy: number, rx: number, ry: number, bias = 0): Key => (x, y) => {
  const top = !inside(x, y - 1);
  const left = !inside(x - 1, y);
  const right = !inside(x + 1, y);
  const bot = !inside(x, y + 1);
  if (bot || right) return "u";
  if (top || left) return "Y";
  const nx = (x + 0.5 - cx) / rx;
  const ny = (y + 0.5 - cy) / ry;
  return ramp("uvyyY", 0.55 + bias - 0.4 * nx - 0.45 * ny);
};
/** Charcoal, banded by the light (lit top left). */
const coal = (inside: Inside, cx: number, cy: number, rx: number, ry: number): Key => (x, y) => {
  if (!inside(x - 1, y) || !inside(x, y - 1)) return "N";
  const nx = (x + 0.5 - cx) / rx;
  const ny = (y + 0.5 - cy) / ry;
  return ramp("mnnN", 0.5 - 0.4 * nx - 0.4 * ny);
};

// ---- Where things are (frame pixels). The ground is at y 85.

const W = 74;
const H = 90;
const GROUND = 85;
const HEAD: Pt = [36, 18];

// ---- The head: Birdie's own (copied from boss-birdie.ts).

export type Lid = "open" | "half" | "shut";
/** Birdie's eye a size up (the head is scaled to sit on the armor): dark, big, in a pale ring, a glint at its top left. */
const EYES: Record<Lid, string[]> = {
  open: [".oooo.", "owxxxo", "oxxxxo", "oxxxxo", "oxxxxo", ".oooo."],
  half: [".oooo.", "occcco", "osssso", "oxxxxo", "oxxxxo", ".oooo."],
  shut: [".oooo.", "occcco", "occcco", "occcco", "ossssc", ".oooo."],
};
const HR: Pt = [9.4, 9];

function paintHead(F: (inside: Inside, key: Key) => void, S: (rows: readonly string[], x: number, y: number) => void, hx: number, hy: number, lid: Lid) {
  const shape = E(hx, hy, HR[0], HR[1]);
  F(shape, (x, y) => {
    const nx = (x + 0.5 - hx) / HR[0];
    const ny = (y + 0.5 - hy) / HR[1];
    const l = 0.62 - 0.38 * nx - 0.5 * ny;
    if (nx < -0.1 && ny > -0.25) return ramp("fgh", l + 0.05);
    return ramp("bcde", l - 0.05);
  });
  S(["CCCB", "..BB"], hx - 13, hy + 1);
  S(EYES[lid], hx - 8, hy - 5);
  S(["s", "s"], hx - 1, hy + 4);
}

/** His head with a bit of buff neck under it. */
function head(lid: Lid): { part: Part; at: Pt } {
  const [hx, hy] = HEAD;
  return painted(hx - 14, hy - 10, 25, 22, (F, S) => {
    F(E(hx + 1, hy + 8, 6.5, 4), (x) => ramp("fgh", 0.6 - 0.3 * ((x - hx) / 5)));
    paintHead(F, S, hx, hy, lid);
  });
}

/** The conductor's cap: the navy crown, the gold band and now a gold visor to the front. */
const CAP: readonly string[] = [
  "......2333332...",
  ".....234444332..",
  "....23444443321.",
  "...2344444433211",
  "...2333333333211",
  "...LLLLLLLLLLLKK",
  "LLLLLLK.........",
];
const CAP_AT: Pt = [HEAD[0] - 11, HEAD[1] - 15];

/** The tie at his collar. */
const TIE: readonly string[] = [".TU.", ".RT.", "RTUT", "RTTU", ".RTT", "..RT", "...R"];
const TIE_AT: Pt = [33, 26];

// ---- The body: the charcoal under-suit, the wide chest plate with the red stripe, the belt and the hip plates.

function torso(): { part: Part; at: Pt } {
  return painted(18, 23, 38, 36, (F, S) => {
    const suit = inPoly([[21, 29], [53, 29], [51, 44], [48, 51], [26, 51], [23, 44]]);
    F(suit, coal(suit, 37, 40, 16, 12));
    // The buff of his breast at the collar.
    F(E(36.5, 28, 6, 3), (x) => ramp("fgh", 0.6 - 0.05 * (x - 34)));
    const chest = inPoly([[22, 31], [29, 27.5], [33, 28.5], [40, 28.5], [45, 27.5], [52, 31], [51, 40], [45, 46], [29, 46], [23, 40]]);
    F(chest, plate(chest, 33, 33, 16, 12, 0.05));
    // The seam between the upper plate and the belly plate.
    F((x, y) => chest(x, y) && y === 39 && x > 24 && x < 50 && chest(x - 1, y) && chest(x + 1, y), () => "u");
    F((x, y) => chest(x, y) && y === 40 && x > 25 && x < 49 && chest(x, y + 1), () => "Y");
    // The red stripe down the middle.
    F((x, y) => (x === 35 || x === 36) && y >= 29 && y <= 45, (x) => (x === 35 ? "q" : "Q"));
    // The belt: charcoal, a gold buckle.
    const belt = (x: number, y: number) => y >= 46 && y <= 49 && x >= 27 && x <= 47;
    F(belt, (x, y) => (y === 46 ? "N" : y === 49 ? "m" : x < 31 ? "N" : "n"));
    S(["LLLL", "LKKK", "KKKK"], 34, 46);
    // Hip plates.
    const hipL = inPoly([[25.5, 50], [33, 50], [32.5, 56], [27, 56]]);
    const hipR = inPoly([[41, 50], [48.5, 50], [47, 56], [41.5, 56]]);
    F(hipL, plate(hipL, 29, 52, 4, 3));
    F(hipR, plate(hipR, 44, 52, 4, 3, -0.15));
    F((x, y) => (hipL(x, y) || hipR(x, y)) && y === 54, () => "q");
  });
}

// ---- The shoulder plates: domes with the roof's charcoal on top, yellow below, the red stripe, a headlight.

const LAMP_N: Pt = [57, 31];
const LAMP_F: Pt = [15, 31];

function pauldron(cx: number, cy: number, rx: number, ry: number, lamp: Pt): { part: Part; at: Pt } {
  return painted(Math.floor(cx - rx - 1), Math.floor(cy - ry - 1), Math.ceil(rx * 2 + 3), Math.ceil(ry * 2 + 3), (F, S) => {
    const dome = and(E(cx, cy, rx, ry), (_x, y) => y < cy + ry * 0.62);
    F(dome, (x, y) => {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const l = 0.55 - 0.4 * nx - 0.45 * ny;
      if (!dome(x, y + 1)) return "u";
      if (ny < -0.45) return !dome(x, y - 1) || !dome(x - 1, y) ? "N" : ramp("mnN", l);
      if (ny < -0.3) return "m";
      if (Math.abs(y + 0.5 - (cy + ry * 0.42)) < 0.6) return nx > 0.4 ? "Q" : "q";
      if (!dome(x - 1, y)) return "Y";
      return ramp("uvyyY", l + 0.05);
    });
    // The headlight: a silver rim, the lamp, a glint at its top left.
    S([".lll.", "lwWWj", "lWWWj", "lWWWj", ".jjj."], lamp[0] - 2, lamp[1] - 2);
  });
}

// ---- The wings, armored, hanging like arms; each ends in a heavy claw.

/** One covert plate's tile (5 x 4): yellow scales, lit at the top, a charcoal gap between, staggered row to row. */
const SCALE = ["YYYYyv", "yyyyyu", "yyyyvu", "mvyvum", "mmuumm"];

/**
 * A wing hanging from the shoulder (`side` -1 our left, the far one; 1 our right, the near one): its outer edge at `ox`,
 * the dark flight feathers fanned behind it, the forearm plated with scales, and the claw at the bottom.
 */
function wingArm(side: -1 | 1): { part: Part; at: Pt } {
  // Mirror x about the body's middle for the far wing (the near wing is drawn at our right).
  const MX = 37;
  const mx = (x: number) => (side === 1 ? x : 2 * MX - x);
  const P = (pts: Pt[]) => inPoly(pts.map(([x, y]): Pt => [mx(x), y]));
  const x0 = side === 1 ? 46 : 4;
  return painted(x0, 30, 25, 34, (F) => {
    // Flight feathers: long and dark, hanging behind the forearm, their tips fingered at the bottom.
    const feathers = P([[55, 33], [63, 33], [68, 40], [69.5, 50], [68.5, 56], [62, 55], [57, 46]]);
    F(
      (x, y) => feathers(x, y) && !(y >= 53 && (mx(x) % 3 === 0)),
      (x, y) => {
        const u = mx(x);
        if ((u + Math.floor(y / 6)) % 3 === 0) return "a";
        if (y > 50) return "b";
        return side === 1 ? ramp("bc", 0.7 - 0.05 * (u - 60)) : ramp("bc", 0.4);
      },
    );
    // The forearm: scalloped yellow plates over the coverts.
    const arm = P([[51, 34], [61, 34], [64, 42], [63, 51], [55, 51], [52, 44]]);
    F(arm, (x, y) => {
      const u = mx(x) - 50;
      const v = y - 34;
      const row = Math.floor(v / 5);
      const cu = (((u + (row % 2) * 3) % 6) + 6) % 6;
      const cv = ((v % 5) + 5) % 5;
      let k = SCALE[cv]![side === 1 ? cu : 5 - cu]!;
      // The far wing a step darker; its lit edge is the inner one.
      if (side === -1) k = ({ Y: "y", y: "v", v: "u", u: "u", m: "m" } as Record<string, string>)[k] ?? k;
      if (!arm(x - 1, y) && k !== "m") return side === 1 ? "Y" : "y";
      if (!arm(x + 1, y) && k !== "m") return "u";
      return k;
    });
    // The claw: a charcoal cuff with the red stripe, a heavy yellow knuckle block, three thick talons.
    const cx = mx(59) + (side === 1 ? 0 : -1);
    const cuff = (x: number, y: number) => y >= 50 && y <= 52 && x >= cx - 5 && x <= cx + 5;
    F(cuff, (x, y) => (y === 51 ? (x > cx + 3 ? "Q" : "q") : y === 50 ? (x < cx - 3 ? "N" : "n") : "m"));
    const fist = and(E(cx, 55.5, 6, 3.6), (_x, y) => y >= 53);
    F(fist, plate(fist, cx - 1, 54, 6, 3, side === 1 ? 0 : -0.12));
    for (const t of [-5, -1, 3]) {
      const tx = cx + t;
      // Each talon two wide, curling in toward the middle at its silver tip.
      const inward = tx + 1 < cx ? 1 : tx > cx ? 0 : side === 1 ? 0 : 1;
      F(
        (x, y) => (y >= 58 && y <= 61 && x >= tx && x <= tx + 1) || (y === 62 && x === tx + inward),
        (x, y) => (y >= 61 ? (y === 62 ? "J" : "l") : x === tx ? "N" : "n"),
      );
    }
  });
}

// ---- The tail: his long tapered tail, hanging behind him to our right, pale at the tip with a dark band.

function tail(): { part: Part; at: Pt } {
  const shape = inPoly([[41, 50], [49, 50], [60, 64], [61, 69], [56, 70], [44, 58]]);
  return painted(40, 49, 23, 23, (F) =>
    F(shape, (x, y) => {
      const d = x + y;
      if (d >= 122) return "e";
      if (d >= 120) return "s";
      return !shape(x - 1, y) ? "c" : (x + 2 * y) % 5 === 0 ? "a" : "b";
    }),
  );
}

// ---- The legs: charcoal thighs, a yellow knee plate, heavy boots on wheel soles.

function leg(cx: number, near: boolean): { part: Part; at: Pt } {
  return painted(cx - 10, 50, 20, 36, (F, S) => {
    const thigh = (x: number, y: number) => y >= 51 && y <= 66 && x >= cx - 4 && x <= cx + 3;
    F(thigh, coal(thigh, cx, 58, 4, 8));
    // The boot: yellow, a charcoal cuff, the red stripe, the toe out front (to our left), a charcoal sole.
    const boot = inPoly([[cx - 6, 66], [cx + 5, 66], [cx + 6.5, 81], [cx - 10, 81], [cx - 10, 77], [cx - 6.5, 73]]);
    F(boot, plate(boot, cx - 2, 70, 7, 6, near ? 0 : -0.12));
    F((x, y) => boot(x, y) && y >= 66 && y <= 67, (x, y) => (y === 66 ? (x < cx - 3 ? "N" : "n") : "m"));
    F((x, y) => boot(x, y) && y === 72 && boot(x - 1, y) && boot(x + 1, y), (x) => (x > cx + 3 ? "Q" : "q"));
    F((x, y) => boot(x, y) && y >= 80, () => "m");
    // The wheel sole under the heel: a dark rim, a silver face, the hub, a bright spot on the rim.
    const wcx = cx;
    const wcy = 79.5;
    const wr = 5.3;
    const wheel = E(wcx, wcy, wr, wr);
    F(wheel, (x, y) => {
      const nx = (x + 0.5 - wcx) / wr;
      const ny = (y + 0.5 - wcy) / wr;
      const r = Math.hypot(nx, ny);
      if (r > 0.74) return nx + ny < -0.7 ? "n" : "m";
      if (r < 0.3) return "J";
      if (r < 0.48) return "j";
      return nx + ny < -0.2 ? "l" : "j";
    });
    S(["J"], wcx - 3, wcy - 3);
    // The knee plate.
    const knee = E(cx - 0.5, 63.5, 5, 3);
    F(knee, plate(knee, cx - 1.5, 62.5, 5, 3, near ? 0 : -0.12));
  });
}

// ---- Parts.

const PARTS: Record<string, Part> = {};
const placedAt: Record<string, Pt> = {};
function put(name: string, m: { part: Part; at: Pt }) {
  PARTS[name] = m.part;
  placedAt[name] = m.at;
}
put("legF", leg(28, false));
put("legN", leg(46, true));
put("wingF", wingArm(-1));
put("wingN", wingArm(1));
put("torso", torso());
put("pauldronF", pauldron(16, 30, 8.2, 6.6, LAMP_F));
put("pauldronN", pauldron(56.5, 29.5, 9.6, 7.6, LAMP_N));
for (const lid of ["open", "half", "shut"] as const) put(`head:${lid}`, head(lid));
PARTS.cap = { grid: CAP };
placedAt.cap = CAP_AT;
PARTS.tie = { grid: TIE };
placedAt.tie = TIE_AT;
{
  const cv = canvas(48, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 48; x++) if (E(24, 1.5, 24, 1.6)(x, y)) cv[y]![x] = "G";
  PARTS.shadow = { grid: toGrid(cv), outline: false };
  placedAt.shadow = [13, GROUND - 1];
}

// ---- The pose.

export interface ArmorPose {
  /** A breath: everything above the hips rises this many pixels. */
  breath?: number;
  /** The head (and cap) moved from rest. */
  head?: Pt;
  lid?: Lid;
  /** A headlight glint: which lamp, and how bright (1 a small star, 2 a big one). */
  glint?: { lamp: "near" | "far"; level: 1 | 2 };
}

/** Everything sits this far down the frame (room for the cap on a breath). */
const OY = 2;
const L = (name: string, dx = 0, dy = 0): Layer => ({ part: name, x: placedAt[name]![0] + dx, y: placedAt[name]![1] + dy + OY });

export function armorLayers(p: ArmorPose = {}): Layer[] {
  const b = -(p.breath ?? 0);
  const [hx, hy] = p.head ?? [0, 0];
  return [
    L("shadow"),
    L("wingF", 0, b),
    L("legF"),
    L("legN"),
    L(`head:${p.lid ?? "open"}`, hx, b + hy),
    L("torso", 0, b),
    L("tie", 0, b),
    L("pauldronF", 0, b),
    L("wingN", 0, b),
    L("pauldronN", 0, b),
    L("cap", hx, b + hy),
  ];
}

/** A headlight's glint: a little four-point star round the lamp. */
function glint(lamp: Pt, level: 1 | 2, dy: number): Speck[] {
  const [cx, cy] = [lamp[0], lamp[1] + dy + OY];
  const out: Speck[] = [[cx, cy, "w"], [cx - 1, cy - 1, "w"]];
  for (const [ux, uy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    out.push([cx + ux * 3, cy + uy * 3, "w"]);
    if (level === 2) out.push([cx + ux * 4, cy + uy * 4, "W"], [cx + ux * 5, cy + uy * 5, "Y"]);
  }
  if (level === 2) out.push([cx - 3, cy - 3, "W"], [cx + 3, cy - 3, "W"], [cx - 3, cy + 3, "W"], [cx + 3, cy + 3, "W"]);
  return out;
}

const Fr = (ms: number, p: ArmorPose = {}): Frame => {
  const f: Frame = { ms, layers: armorLayers(p) };
  if (!p.glint) return f;
  const lamp = p.glint.lamp === "near" ? LAMP_N : LAMP_F;
  return { ...f, pal: { W: PALETTE.w! }, specks: glint(lamp, p.glint.level, -(p.breath ?? 0)) };
};

/**
 * Idle (about 5.3 s, loops): standing tall, he breathes (the body rises a pixel and settles), blinks, glances down the
 * board a pixel, and the headlights glint one after the other, the near one then the far one.
 */
const idle: Anim = {
  loop: true,
  frames: [
    Fr(520),
    Fr(520, { breath: 1 }),
    Fr(420),
    Fr(110, { lid: "shut" }),
    Fr(380),
    Fr(520, { breath: 1 }),
    Fr(360, { head: [-1, 0] }),
    Fr(90, { head: [-1, 0], glint: { lamp: "near", level: 1 } }),
    Fr(120, { head: [-1, 0], glint: { lamp: "near", level: 2 } }),
    Fr(90, { head: [-1, 0], glint: { lamp: "far", level: 1 } }),
    Fr(110, { head: [-1, 0], glint: { lamp: "far", level: 2 } }),
    Fr(300, { head: [-1, 0] }),
    Fr(520, { breath: 1 }),
    Fr(420),
    Fr(110, { lid: "shut" }),
    Fr(700),
  ],
};

export const BOSS_BIRDIE_ARMORED: Character = {
  id: "boss-birdie-armored-b",
  name: "Birdie",
  w: W,
  h: H,
  foot: [37, GROUND + OY],
  palette: PALETTE,
  halo: "#3a3026",
  parts: PARTS,
  anims: { idle },
};
