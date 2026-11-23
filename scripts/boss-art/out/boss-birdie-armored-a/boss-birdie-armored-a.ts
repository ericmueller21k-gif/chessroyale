/**
 * Armored Birdie, variant A (sleek): after the train hits him in his ultimate, Birdie wears the train. The same young
 * mourning dove's head (round grey-brown crown, buff face, small grey beak, the big dark eye in its pale ring with a
 * glint), his navy conductor's cap now with a gold visor, the burgundy tie at his throat; he stands upright on both
 * legs like an armored robot-boss hero. The train's colors: yellow plates, the roof's charcoal, the thin red stripe.
 * Sleek: plates fitted close, a clean line from shoulder to boot; the wings hang at his sides like arms, thin yellow
 * plates laid over the feathers (a pale feather fringe peeking between them), the dark flight feathers below; a
 * rounded pauldron on each shoulder (a charcoal roof over a yellow band, the red stripe between) with a headlight.
 * Facing a little to our left: his right side (screen left) a touch farther, behind the chest plate.
 *
 * Rig (`ArmorPose`): the upper body (head, cap, tie, chest plate, pauldrons, wings) rises with a breath while the hips
 * and legs stay; the head moves on its own; the lid; the headlights glint by a frame's palette and specks.
 * Only the idle is drawn (the brief).
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
  f: "#8f6c5b", // face and throat: warm buff, dark to light
  g: "#b08773",
  h: "#cea58c",
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
  t: "#5e4206", // the armor: the train's yellow, a darker shadow, dark to light
  u: "#9a6a08",
  v: "#d49a12",
  y: "#f4c21e",
  Y: "#ffe27a",
  m: "#23232b", // the roof's charcoal
  n: "#3b3b46",
  N: "#5a5a68",
  q: "#cc2a2a", // the red stripe
  W: "#fff3b8", // headlights (the near one's glass, the far one's: the same color, keys of their own so each can glint)
  V: "#fff3b8",
  G: "#0b0c10", // ground shadow
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;
type Fill = (inside: Inside, key: Key) => void;
type Stamp = (rows: readonly string[], x: number, y: number) => void;

const E = inEllipse;
const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;

const W = 74;
const H = 88;
/** The ground (the boots' soles sit on the row above). */
const GROUND = 85;

/** A part painted in frame pixels: its canvas covers (x0, y0) to (x0 + w, y0 + h). */
function painted(x0: number, y0: number, w: number, h: number, draw: (F: Fill, S: Stamp) => void, outline = true): { part: Part; at: Pt } {
  const cv: Canvas = canvas(w, h);
  const F: Fill = (inside, key) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
  };
  const S: Stamp = (rows, sx, sy) =>
    rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        const X = Math.round(sx) + i - x0;
        const Y = Math.round(sy) + j - y0;
        if (k !== "." && cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
      }),
    );
  draw(F, S);
  return { part: { grid: toGrid(cv), outline }, at: [x0, y0] };
}

const PARTS: Record<string, Part> = {};
const AT: Record<string, Pt> = {};
function add(name: string, p: { part: Part; at: Pt }) {
  PARTS[name] = p.part;
  AT[name] = p.at;
}

// ---- The head (Birdie's, as approved).

export type Lid = "open" | "half" | "shut";
const EYES: Record<Lid, string[]> = {
  open: [".ooo.", "owxxo", "oxxxo", "oxxxo", ".ooo."],
  half: [".ooo.", "occco", "oxxxo", "oxxxo", ".ooo."],
  shut: [".ooo.", "occco", "occco", "osssc", ".ooo."],
};

/** The head's middle at rest. */
const HEAD: Pt = [35, 17];

function paintHead(F: Fill, S: Stamp, hx: number, hy: number, lid: Lid) {
  const shape = E(hx, hy, 7.6, 7.2);
  F(shape, (x, y) => {
    const nx = (x + 0.5 - hx) / 7.6;
    const ny = (y + 0.5 - hy) / 7.2;
    const l = 0.62 - 0.38 * nx - 0.5 * ny;
    if (nx < -0.1 && ny > -0.25) return ramp("fgh", l + 0.05);
    return ramp("bcde", l - 0.05);
  });
  S(["CCB", ".BB"], hx - 10, hy + 1);
  S(EYES[lid], hx - 6, hy - 4);
  S(["s", "s"], hx - 1, hy + 3);
}

/** Head and neck, the head moved `hd` from rest. */
function head(hd: Pt, lid: Lid) {
  const hx = HEAD[0] + hd[0];
  const hy = HEAD[1] + hd[1];
  return painted(22, 6, 26, 26, (F, S) => {
    F(E(36, 25, 5.5, 4.5), (x, y) => (x < 35 ? ramp("fgh", 0.75 - 0.08 * (y - 22)) : ramp("bcd", 0.7 - 0.1 * (x - 35))));
    paintHead(F, S, hx, hy, lid);
  });
}

/** The cap: a short round navy crown, the gold band, and now a gold visor, sat jaunty. */
const CAP: readonly string[] = [
  ".....233332..",
  "....23444332.",
  "...2344443321",
  "..23333333211",
  "..LLLLLLLLKK.",
  "LLLLK........",
];
const CAP_AT: Pt = [HEAD[0] - 9, HEAD[1] - 12];
PARTS.cap = { grid: CAP };
AT.cap = CAP_AT;

/** The tie at his throat, over the chest plate's collar. */
PARTS.tie = { grid: [".TU.", ".RT.", "RTUT", "RTTU", ".RTT", "..RT"] };
AT.tie = [33, 26];

// ---- The armor.

/** The chest plate: a locomotive's rounded nose, yellow, the red stripe down the middle, a seam across the belly. */
const CHEST: Pt[] = [[27, 27], [45, 27], [48, 30], [47, 37], [43, 46], [40, 50.5], [32, 50.5], [29, 46], [25, 37], [25, 30]];
add(
  "chest",
  painted(22, 26, 30, 28, (F) => {
    const inside = inPoly(CHEST);
    F(inside, (x, y) => {
      const nx = (x + 0.5 - 36) / 11;
      const ny = (y + 0.5 - 37) / 12;
      const l = 0.6 - 0.4 * nx - 0.45 * ny;
      // The collar: the roof's charcoal, lit along its top.
      if (y <= 28) return y === 27 && x < 40 ? "N" : "n";
      if (x === 35 && y >= 33) return "q";
      if (x === 36 && y >= 33) return "T";
      // The seam across the belly plate, curving down at the sides.
      if (y === 43 + Math.round(Math.abs(x + 0.5 - 36) / 5)) return "u";
      // The pectoral seams, sweeping from the collar out to the sides.
      if (y >= 30 && y <= 38 && (x === 30 - Math.round((y - 30) / 4) || x === 42 + Math.round((y - 30) / 4))) return x < 36 ? "v" : "u";
      // The rim: top lit, the right side and bottom in shadow.
      if (y === 29) return x < 40 ? "Y" : "y";
      if (!inside(x + 1, y) || !inside(x, y + 1)) return "u";
      return ramp("tuvyY", l + 0.05);
    });
  }),
);

/** The waist and hips: charcoal like the roof, a gold buckle. */
add(
  "hips",
  painted(26, 46, 22, 13, (F, S) => {
    const inside = inPoly([[30, 45], [43, 45], [46, 51], [47, 57.5], [27, 57.5], [28, 51]]);
    F(inside, (x, y) => (y === 50 || y === 51 ? "m" : ramp("mnN", 0.8 - 0.06 * (x - 30) - 0.04 * (y - 46))));
    S(["KLLK", "KKKK"], 34, 50);
  }),
);

/** A leg: a charcoal thigh, a yellow knee plate, a yellow boot with a red stripe and a charcoal sole, its toe to our left. */
function leg(x0: number, far: boolean) {
  const top = 55;
  return painted(x0 - 4, top, 16, GROUND - top, (F) => {
    const thigh = inPoly([[x0 + 1, top], [x0 + 7.5, top], [x0 + 7, 70], [x0 + 1.5, 70]]);
    F(thigh, (x) => ramp("mnN", 0.85 - 0.12 * (x - x0)));
    const boot = inPoly([[x0, 67.5], [x0 + 8.5, 67.5], [x0 + 8, 73], [x0 + 8.5, 79], [x0 + 9, GROUND - 1], [x0 - 3, GROUND - 1], [x0 - 3, 81.5], [x0, 79.5]]);
    F(boot, (x, y) => {
      if (y >= GROUND - 1) return "m";
      // The toe cap: the roof's charcoal, like the locomotive's pilot.
      if (x < x0 + 1 && y >= 80) return y === 80 || x === x0 - 3 ? "N" : "n";
      if (y === 79) return "q";
      if (y === 68) return x < x0 + 5 ? "Y" : "y";
      const l = 0.75 - 0.08 * (x - x0) - 0.015 * (y - 68) - (far ? 0.12 : 0);
      if (!boot(x + 1, y)) return "u";
      return ramp("tuvyY", l);
    });
    const knee = E(x0 + 4.5, 64.5, 3.6, 2.8);
    F(knee, (x, y) => ramp("uvyY", 0.8 - 0.1 * (x - x0) - 0.15 * (y - 63) - (far ? 0.1 : 0)));
  });
}
add("legF", leg(27, true));
add("legN", leg(41, false));

/** A wing hanging at his side: thin yellow plates over the feathers, a pale fringe between them, the dark flight feathers below. */
function wing(poly: Pt[], far: boolean) {
  const inside0 = inPoly(poly);
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const x1 = Math.ceil(Math.max(...xs));
  const y1 = Math.ceil(Math.max(...ys));
  const cx = (x0 + x1) / 2;
  // The flight feathers' fingers: notches along the bottom.
  const inside: Inside = (x, y) => inside0(x, y) && !(y >= y1 - 2 && !inside0(x, y + 2) && x % 2 === 0);
  return painted(x0, y0, x1 - x0 + 1, y1 - y0 + 1, (F) => {
    F(inside, (x, y) => {
      const v = y - y0;
      const l = 0.6 - 0.09 * (x + 0.5 - cx) - 0.008 * v - (far ? 0.08 : 0);
      // Each plate's lower edge scalloped (the feathers' scallops, now armor): a rounded dip every 3 pixels.
      const sc = [0, 1, 1, 0][(((x - x0 + (far ? 2 : 0)) % 4) + 4) % 4]!;
      const vv = v - sc;
      if (vv < 14) {
        const band = Math.floor(Math.max(0, vv) / 7);
        const r = Math.max(0, vv) % 7;
        // Between the plates, the feathers' pale fringe.
        if (r === 6) return sc ? "e" : "d";
        if (r === 5) return "u";
        if (r === 0 && v > 0) return ramp("vyY", l + 0.3);
        if (r === 0) return ramp("yY", l + 0.3);
        if (band === 0 && r === 3 && !far) return "q";
        if (!inside(x + 1, y)) return "u";
        return ramp("tuvyY", l + 0.05);
      }
      return (x + (far ? 1 : 0)) % 2 === 0 ? "a" : ramp("bcd", l + 0.1);
    });
  });
}
add("wingF", wing([[18, 34], [25, 34], [27, 40], [26, 50], [23, 58], [20, 64], [18, 57], [16, 46], [16, 39]], true));
add("wingN", wing([[47, 34], [55, 34], [57, 39], [57, 48], [55, 56], [53, 64], [51, 58], [49, 50], [46, 41]], false));

/** A pauldron: a rounded charcoal roof over a yellow band, the red stripe between, a headlight in the band. */
const LAMP_F: Pt = [21, 33];
const LAMP_N: Pt = [50, 33];
function pauldron(cx: number, cy: number, rx: number, ry: number, lamp: Pt, far: boolean) {
  return painted(Math.floor(cx - rx) - 1, Math.floor(cy - ry) - 1, Math.ceil(rx * 2) + 3, Math.ceil(ry * 2) + 3, (F, S) => {
    const inside = E(cx, cy, rx, ry);
    F(inside, (x, y) => {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const l = 0.62 - 0.4 * nx - 0.4 * ny - (far ? 0.08 : 0);
      const band = y - Math.round(cy - 1 + nx * 0.8);
      if (band < 0) return ramp("mnN", l + 0.1);
      if (band === 0) return "q";
      if (!inside(x, y + 1)) return "u";
      return ramp("tuvyY", l + 0.15);
    });
    const g = far ? "V" : "W";
    S([".nn.", `n${g}${g}n`, `n${g}Yn`, ".nn."], lamp[0] - 1, lamp[1] - 1);
  });
}
add("pauldronF", pauldron(23, 31, 5.6, 4.4, LAMP_F, true));
add("pauldronN", pauldron(50.5, 31, 6.6, 4.8, LAMP_N, false));

/** His long tapered tail hanging behind him, seen between his legs: grey-brown, a dark band and a pale tip. */
add(
  "tail",
  painted(38, 50, 32, 25, (F) => {
    // Sweeping back (to our right) and down behind his near leg, tapering to a point.
    const inside = inPoly([[39, 52], [46, 51], [55, 59], [64, 66.5], [67.5, 70.5], [62, 69.5], [53, 65], [43, 59]]);
    const ux = 0.75;
    const uy = 0.66;
    F(inside, (x, y) => {
      const along = (x + 0.5 - 40) * ux + (y + 0.5 - 52) * uy;
      if (along > 29) return "e";
      if (along > 27.5) return "s";
      const across = (x + 0.5 - 40) * uy - (y + 0.5 - 52) * ux;
      return Math.floor(along) % 4 === 0 && across < 1 ? "a" : ramp("bcd", 0.5 + 0.15 * across);
    });
  }),
);

/** His shadow on the ground. */
add(
  "shadow",
  painted(18, GROUND - 1, 38, 3, (F) => F(E(37, GROUND + 0.5, 19, 1.6), () => "G"), false),
);

// ---- The pose.

export interface ArmorPose {
  /** The upper body risen (a breath: 1). */
  breath?: number;
  /** The head moved from rest. */
  head?: Pt;
  lid?: Lid;
}

const heads = new Set<string>();
function layers(p: ArmorPose = {}): Layer[] {
  const up = -(p.breath ?? 0);
  const hd = p.head ?? [0, 0];
  const lid = p.lid ?? "open";
  const hname = `head:${hd[0]},${hd[1]}:${lid}`;
  if (!heads.has(hname)) {
    heads.add(hname);
    add(hname, head(hd, lid));
  }
  const L = (name: string, dy = 0, dx = 0): Layer => ({ part: name, x: AT[name]![0] + dx, y: AT[name]![1] + dy });
  return [
    L("shadow"),
    L("tail"),
    L("wingF", up),
    L("pauldronF", up),
    L("legF"),
    L("legN"),
    L("hips"),
    L(hname, up),
    L("chest", up),
    L("tie", up),
    L("wingN", up),
    L("pauldronN", up),
    L("cap", up + hd[1], hd[0]),
  ];
}

/** A headlight's glint: the glass whiter and a little four-point star round it (`n` 1 small, 2 bigger). */
function glint(lamp: Pt, n: 1 | 2, up = 0): Speck[] {
  const [x, y] = [lamp[0], lamp[1] + up];
  // A plus-shaped twinkle out of the glass's top left pixel: short, then long.
  const short: Speck[] = [[x, y - 2, "w"], [x - 2, y, "w"], [x + 3, y, "W"], [x, y + 3, "W"]];
  const long: Speck[] = [[x, y - 3, "W"], [x, y - 4, "W"], [x - 3, y, "W"], [x - 4, y, "W"], [x + 4, y, "W"], [x, y + 4, "W"]];
  return n === 1 ? short : [...short, ...long];
}
const BRIGHT_N: Record<string, string> = { W: PALETTE.w! };
const BRIGHT_F: Record<string, string> = { V: PALETTE.w! };

const F = (ms: number, pose: ArmorPose = {}, extra: Partial<Frame> = {}): Frame => ({ ms, layers: layers(pose), ...extra });

/**
 * Idle (about 5.3 s): he stands, breathing (the upper body rises a pixel and settles); the near headlight glints; a
 * blink; a small turn of the head toward the board and back; another breath; the far headlight glints.
 */
const idle: Anim = {
  loop: true,
  frames: [
    F(520),
    F(560, { breath: 1 }),
    F(380),
    F(90, {}, { pal: BRIGHT_N, specks: glint(LAMP_N, 1) }),
    F(120, {}, { pal: BRIGHT_N, specks: glint(LAMP_N, 2) }),
    F(90, {}, { specks: glint(LAMP_N, 1) }),
    F(420),
    F(70, { lid: "half" }),
    F(110, { lid: "shut" }),
    F(70, { lid: "half" }),
    F(500, { breath: 1 }),
    F(420, { head: [-1, 0] }),
    F(520, { head: [-1, 0], breath: 1 }),
    F(300),
    F(90, {}, { pal: BRIGHT_F, specks: glint(LAMP_F, 1) }),
    F(120, {}, { pal: BRIGHT_F, specks: glint(LAMP_F, 2) }),
    F(90, {}, { specks: glint(LAMP_F, 1) }),
    F(500, { breath: 1 }),
    F(340),
  ],
};

export const BOSS_BIRDIE_ARMORED: Character = {
  id: "boss-birdie-armored-a",
  name: "Birdie",
  w: W,
  h: H,
  foot: [37, GROUND],
  palette: PALETTE,
  halo: "#3a3026",
  parts: PARTS,
  anims: { idle },
};
