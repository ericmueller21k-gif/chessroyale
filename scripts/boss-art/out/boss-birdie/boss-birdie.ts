/**
 * Birdie (variant B, a touch more charming): a young mourning dove, Eric's own bird, riding a miniature toy diesel
 * locomotive. A real dove (soft brown and grey-brown plumage, scalloped wing feathers with dark edges, a smooth round
 * head, a small dark beak, a big dark eye in a pale ring, coral-pink feet, a long tapered tail), the head a little big
 * and the eye a little large for warmth at phone size; a navy conductor's cap with a gold band, worn jaunty, and a
 * small burgundy tie. The train: a yellow toy diesel seen from the side, its nose to our left, a dark roof with an open
 * hatch he perches in, a thin red stripe, round headlights, silver trucks and wheels. No letters, numbers or markings.
 *
 * Rigging (`BirdiePose`, all numbers): the dove's body and head are painted together for each head offset, lid, beak,
 * chest puff and ruffle (so the neck stays one smooth piece); the folded wing, tail, tie, cap and feet are parts of
 * their own; an open wing (near, and the far one behind him) is painted for an angle and a length from his shoulder;
 * the cap tilts and lifts, comes off, or flies loose on its own; he leans out of the hatch (his feet stay), sinks into
 * it, hops, or tumbles out of it a quarter turn at a time. The train is one part (its wheels turn), and its near side
 * (every row from the hatch's lip down) is drawn again in front of him, so he can sink into the hatch; the whole train
 * (him with it) moves. Crouched, only his head (a part of its own, mirrored to look the other way) and cap show above
 * the lip. The idle (Eric's approved variant B) is drawn by the same rig with every new number at rest.
 */
import { canvas, inEllipse, inPoly, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import { lazyParts, lieDown, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#1d1411", // outline
  a: "#3d2e27", // his brown: deep shadow to light
  b: "#5c4638",
  c: "#7c624f",
  d: "#9c8069",
  e: "#bfa58b",
  f: "#8f6c5b", // breast: warm buff with a pink cast, dark to light
  g: "#b08773",
  h: "#cea58c",
  i: "#e6c6ac",
  s: "#2b1f1b", // the dark spots and edges on his wing
  o: "#cfd8d6", // the pale ring round his eye
  x: "#0d0909", // the eye
  w: "#fffaf0", // the glint
  B: "#3e373c", // beak
  C: "#7a7075",
  p: "#a84852", // feet: coral, dark to light
  P: "#de7570",
  Q: "#f7a396",
  "1": "#0f1328", // the cap: navy, dark to light
  "2": "#1c2850",
  "3": "#2d3f7c",
  "4": "#4a60a8",
  K: "#a87414", // gold
  L: "#f2c14e",
  R: "#6a1222", // tie: burgundy, dark to light
  T: "#a52238",
  U: "#d64a5a",
  u: "#9a6a08", // the train: yellow, dark to light
  v: "#d49a12",
  y: "#f4c21e",
  Y: "#ffe27a",
  m: "#23232b", // roof: dark grey
  n: "#3b3b46",
  N: "#5a5a68",
  O: "#0f0d12", // inside the hatch
  q: "#cc2a2a", // the red stripe
  j: "#4a4f5a", // silver: dark, mid, light
  l: "#8d94a1",
  J: "#d3d8e0",
  W: "#fff3b8", // headlights
  z: "#24303e", // windows
  Z: "#6d8aa2",
  G: "#0b0c10", // ground shadow
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;

const E = inEllipse;
const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const union = (...fs: Inside[]): Inside => (x, y) => fs.some((f) => f(x, y));
const rad = (deg: number) => (deg * Math.PI) / 180;

/** A part painted in scene pixels: its canvas covers (x0, y0) to (x0 + w, y0 + h). */
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

// ---- Where things are (scene pixels; the frame adds OX, OY). The ground is at y 72; the hatch's lip is row 47.

const OX = 3;
const OY = 2;
const W = 74;
const H = 78;
const LIP = 47;
/** The head's middle at rest. */
const HEAD: Pt = [25, 22];

// ---- The train.

const TRAIN_X0 = 0;
const TRAIN_Y0 = 40;
/** The body's side: a long box, the cab roof sloping down at the front into the windshield, then the round "bulldog" nose. */
const TRAIN_BODY: Pt[] = [[17, 44], [66, 44], [67, 45], [67, 62], [5, 62], [2.5, 60], [2, 56], [2.6, 52.6], [4.4, 50.4], [8, 49], [11, 48.4], [14, 45.2]];
/** The headlights' middles: the one on the nose's top, the one low on its front. */
const LAMPS: readonly Pt[] = [[6, 51], [3, 55]];

/** The train, its wheels turned `turn` quarter steps (0 as in the still; 1 to 3 a bright spoke goes round). */
function trainCanvas(turn = 0): Canvas {
  return painted(TRAIN_X0, TRAIN_Y0, 70, 33, (F, S) => {
    const body = inPoly(TRAIN_BODY);
    F(body, (x, y) => {
      if (y <= 46 && x >= 16) return y === 44 ? "N" : "n";
      if (y === LIP) return "Y";
      if (y >= 60 || x >= 66) return "v";
      if (x < 8 && y < 54) return "Y";
      if (x < 4) return "v";
      return "y";
    });
    // The hatch, open in the roof.
    F((x, y) => (y === 45 && x >= 23 && x <= 45) || (y === 46 && x >= 22 && x <= 46), () => "O");
    // The windshield on the cab's slope, the cab's side window and door, the portholes behind.
    S(["..zz", ".zZz", "zzzz"], 12, 45);
    S([".zZz", "zzzz", ".zzz"], 16, 48);
    F((x, y) => x === 21 && y >= 48 && y <= 58, () => "v");
    S(["zZ", "zz"], 51, 50);
    S(["zZ", "zz"], 58, 50);
    // The thin red stripe along the side, sweeping down the nose.
    F((x, y) => y === 56 && x >= 8 && x <= 66 && body(x, y), () => "q");
    S(["....qq", "..qq..", "qq...."], 3, 56);
    // Headlights: one on the nose's top, one low on its front.
    S([".l.", "lWl", ".l."], 5, 50);
    S([".l.", "lWl", ".l."], 2, 54);
    // The pilot under the nose, the dark underframe, the silver trucks and the wheels.
    S(["jjjjjj", ".jlllj", "..jjjj"], 1, 62);
    F((x, y) => y >= 62 && y <= 63 && x >= 7 && x <= 66, () => "m");
    const truck = (x: number, y: number) => y >= 63 && y <= 66 && ((x >= 9 && x <= 25) || (x >= 45 && x <= 61));
    F(truck, (x, y) => (y === 63 ? "J" : y === 66 ? "j" : x % 4 === 0 ? "j" : "l"));
    for (const cx of [13, 21, 49, 57]) {
      const wheel = E(cx, 68, 3, 3);
      F(wheel, (x, y) => {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - 68;
        if (Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6) return "J";
        const r = Math.hypot(dx, dy);
        if (r > 2.2) return dx + dy < -1.5 ? "l" : "j";
        return dx + dy < -0.5 ? "l" : r < 1.3 ? "j" : "m";
      });
      // A bright spot on the rim going round as it rolls (to our left: anticlockwise).
      if (turn % 4) {
        const ring: Pt[] = [[cx - 3, 67], [cx - 1, 70], [cx + 1, 67], [cx - 1, 65]];
        const [rx, ry] = ring[turn % 4]!;
        S(["J"], rx, ry);
      }
    }
  }).part.grid.map((r) => [...r]);
}

const { parts: PARTS, add } = lazyParts();

const trainName = (turn: number) => (turn % 4 ? `train:${turn % 4}` : "train");
const frontName = (turn: number) => (turn % 4 ? `trainFront:${turn % 4}` : "trainFront");
for (const t of [0, 1, 2, 3]) {
  add(trainName(t), () => ({ grid: toGrid(trainCanvas(t)) }));
  /** The near side again (from the lip down), drawn in front of him. */
  add(frontName(t), () => {
    const cv = trainCanvas(t);
    for (let y = 0; y < cv.length; y++) if (y + TRAIN_Y0 < LIP) cv[y]!.fill(".");
    return { grid: toGrid(cv), outline: false };
  });
}
add("shadow", () => {
  const cv = canvas(66, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 66; x++) if (E(33, 1.5, 33, 1.6)(x, y)) cv[y]![x] = "G";
  return { grid: toGrid(cv), outline: false };
});

// ---- The dove.

export type Lid = "open" | "half" | "shut" | "joy" | "wide" | "up" | "back" | "sad" | "smug";

const EYES: Record<Lid, string[]> = {
  open: [".ooo.", "owxxo", "oxxxo", "oxxxo", ".ooo."],
  half: [".ooo.", "occco", "oxxxo", "oxxxo", ".ooo."],
  shut: [".ooo.", "occco", "occco", "osssc", ".ooo."],
  // Smiling shut: a little arch.
  joy: [".....", ".ooo.", "oxxxo", "x...x", "....."],
  // Startled: the pupil small, the ring wide.
  wide: [".ooo.", "owxoo", "oxxoo", "ooooo", ".ooo."],
  // Looking up, and back over his shoulder.
  up: [".ooo.", "owxxo", "oxxxo", "ooooo", ".ooo."],
  back: [".ooo.", "oowxo", "ooxxo", "ooxxo", ".ooo."],
  // Sad: the lid low and heavy.
  sad: [".ooo.", "occco", "occco", "oxxxo", ".ooo."],
  // Heavy-lidded and pleased: the lid's dark edge low over the eye.
  smug: [".ooo.", "occco", "ossso", "oxxxo", ".ooo."],
};

/** His head at (hx, hy): round, grey-brown on the crown, buff on the face, the beak, the big eye, a dark cheek spot. */
function paintHead(F: (inside: Inside, key: Key) => void, S: (rows: readonly string[], x: number, y: number) => void, hx: number, hy: number, lid: Lid, open = false) {
  const shape = E(hx, hy, 7.6, 7.2);
  F(shape, (x, y) => {
    const nx = (x + 0.5 - hx) / 7.6;
    const ny = (y + 0.5 - hy) / 7.2;
    const l = 0.62 - 0.38 * nx - 0.5 * ny;
    if (nx < -0.1 && ny > -0.25) return ramp("fgh", l + 0.05);
    return ramp("bcde", l - 0.05);
  });
  // Beak (open: a call, "all aboard").
  if (open) S(["CCB", ".xx", ".BB"], hx - 10, hy);
  else S(["CCB", ".BB"], hx - 10, hy + 1);
  // Eye: dark, big, in a pale ring, a glint at its top left.
  S(EYES[lid], hx - 6, hy - 4);
  // The little dark mark under his eye.
  S(["s", "s"], hx - 1, hy + 3);
}

/** A cheap stable hash of a pixel, for ruffled edges. */
const hash = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 7;

interface BirdLook {
  /** His chest puffed out (pixels). */
  puff?: number;
  /** His feathers ruffled: tufts stick out round his edge. */
  ruffle?: boolean;
  /** The beak open. */
  open?: boolean;
}

/** Body and head together (one smooth piece), the head moved `hd` from rest. */
function bird(hd: Pt, lid: Lid, look: BirdLook = {}): { part: Part; at: Pt } {
  const hx = HEAD[0] + hd[0];
  const hy = HEAD[1] + hd[1];
  const p = look.puff ?? 0;
  return painted(10, 8, 40, 40, (F, S) => {
    const main = E(35.5, 37.5, 11.5, 8.2);
    const breast = E(27.5 - p * 0.6, 36.5 - p * 0.3, 7.2 + p, 8.6 + p * 0.5);
    const neck = E(26.5 - p * 0.3, 29.5, 5.2 + p * 0.5, 5.2);
    let shape = union(main, breast, neck);
    if (look.ruffle) {
      const wider = union(E(35.5, 37.5, 13, 9.6), E(27.5, 36.5, 8.7, 9.8));
      const base = shape;
      shape = (x, y) => base(x, y) || (y < 44 && wider(x, y) && hash(x, y) < 2);
      // Tufts standing up off his back, nape and breast.
      const tufts: Pt[] = [[38, 28], [39, 27], [38, 27], [44, 30], [45, 29], [49, 33], [50, 32], [32, 26], [33, 25], [19, 33], [18, 32], [19, 39], [18, 40], [21, 29], [20, 28]];
      for (const [x, y] of tufts) S([x < 30 ? "h" : "d"], x, y);
    }
    F(shape, (x, y) => {
      const nx = (x + 0.5 - 32) / 13;
      const ny = (y + 0.5 - 36) / 10;
      const l = 0.6 - 0.35 * nx - 0.5 * ny;
      const front = x + 0.5 < 31 - (y - 30) * 0.2 || y > 42;
      // Soft scaly fringes on his breast, as a young dove's.
      const fleck = y > 30 && y % 3 === 0 && (x + y) % 4 === 0;
      if (front) return ramp("fgh", l - (fleck ? 0.3 : 0));
      return ramp("bcde", l - 0.05);
    });
    paintHead(F, S, hx, hy, lid, look.open);
  });
}

/** His head alone (crouched in the hatch), with a bit of neck. */
function headOnly(lid: Lid): { part: Part; at: Pt } {
  const [hx, hy] = HEAD;
  return painted(hx - 11, hy - 8, 20, 18, (F, S) => {
    F(E(hx + 1, hy + 6, 5.5, 4), (x, y) => ramp("fgh", 0.6 - 0.3 * ((x - hx) / 5)));
    paintHead(F, S, hx, hy, lid);
  });
}

/** His folded wing: scalloped feathers with pale fringes and dark edges, black spots, the long dark flight feathers behind. */
function wing(): { part: Part; at: Pt } {
  const poly: Pt[] = [[29, 30.5], [36, 29.5], [43, 31], [48, 35], [54, 41.5], [51, 43.5], [41, 44.5], [33, 43], [28.5, 38]];
  const inside = inPoly(poly);
  return painted(26, 27, 32, 20, (F, S) => {
    F(inside, (x, y) => {
      const l = 0.62 - 0.02 * (x - 30) - 0.04 * (y - 31);
      if (x >= 45) {
        // Flight feathers: long, dark, lined along their length.
        return (x + y * 2) % 4 === 0 ? "a" : ramp("bc", l + 0.2);
      }
      // Each feather a rounded scale, staggered row to row: warm grey-brown inside, a pale buff fringe at its tip, dark between.
      const u = x - 27;
      const v = y - 30;
      const row = Math.floor(v / 4);
      const cu = (((u + (row % 2) * 3) % 5) + 5) % 5;
      const cv = ((v % 4) + 4) % 4;
      const k = FEATHER[cv]![cu]!;
      return k === "*" ? ramp("cd", l + 0.1) : k;
    });
    S(["ss"], 37, 37);
    S(["ss"], 41, 40);
  });
}

/** The far wing folded on his back (seen when the near one opens): the folded wing a shade darker. */
function wingBack(): { part: Part; at: Pt } {
  const w = wing();
  return { part: { grid: w.part.grid.map((r) => [...r].map((k) => DARKER[k] ?? k).join("")) }, at: w.at };
}

/** One covert feather's tile (5 x 4): `*` is its body, lit by where it is. */
const FEATHER = ["b***c", "b***b", "ab*ba", "aeeea"];

/** His shoulder, where an open wing grows from. */
const SHOULDER: Pt = [31, 32];
/** The far wing's shoulder sits this far behind and above the near one's. */
const FAR_OFF: Pt = [4, -2];
const DARKER: Record<string, string> = { e: "d", d: "c", c: "b", b: "a", a: "a", s: "s" };

/**
 * An open wing from his shoulder, heading `deg` degrees (180 toward the board, 270 straight up) for `len` pixels: the
 * scalloped coverts by the shoulder, the long dark flight feathers out to the tip, fingered along the trailing edge,
 * a pale fringe on the secondaries. The far wing (behind him) is a shade darker.
 */
function openWing(deg: number, len: number, far: boolean): { part: Part; at: Pt } {
  const a = rad(deg);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  let nx = -uy;
  let ny = ux;
  // The leading edge (n) is the side toward the top left.
  if (-nx - ny < -0.01) {
    nx = -nx;
    ny = -ny;
  }
  const [sx, sy] = SHOULDER;
  const pad = Math.ceil(len) + 6;
  const lead = (f: number) => 0.8 + 3 * (1 - f * f);
  const trail = (f: number) => 5.4 * Math.sin(Math.PI * (0.2 + 0.8 * Math.min(1, f) ** 1.3));
  const at = (x: number, y: number) => {
    const px = x + 0.5 - sx;
    const py = y + 0.5 - sy;
    return { s: px * ux + py * uy, t: px * nx + py * ny };
  };
  const inside: Inside = (x, y) => {
    const { s, t } = at(x, y);
    if (s < 0) return s * s + t * t <= 10 && t <= lead(0) && t >= -trail(0);
    if (s > len) return false;
    const f = s / len;
    if (t > lead(f) || t < -trail(f)) return false;
    // The flight feathers' fingers: notches in the trailing edge of the outer half.
    if (f > 0.5 && t < -trail(f) + 1.3 && Math.floor(s) % 3 === 0) return false;
    return true;
  };
  return painted(Math.floor(sx - pad), Math.floor(sy - pad), pad * 2 + 1, pad * 2 + 1, (F, S) => {
    F(inside, (x, y) => {
      const { s, t } = at(x, y);
      const f = Math.max(0, s / len);
      const l = 0.55 + 0.08 * t - 0.25 * f;
      let k: string;
      if (f > 0.55 || t < -trail(f) * 0.3) {
        // Flight feathers: long vanes along the wing, dark lines between, darkest at the tip; the secondaries' pale fringe.
        if (f <= 0.6 && t < -trail(f) + 1.2) k = "e";
        else if (Math.floor(t + 20) % 2 === 0) k = f > 0.8 ? "s" : "a";
        else k = f > 0.85 ? "b" : ramp("bc", l + 0.3);
      } else if (t > lead(f) - 1) {
        // The leading edge, lit.
        k = "e";
      } else {
        const u = x - 27;
        const v = y - 30;
        const row = Math.floor(v / 4);
        const cu = (((u + (((row % 2) + 2) % 2) * 3) % 5) + 5) % 5;
        const cv = ((v % 4) + 4) % 4;
        const c = FEATHER[cv]![cu]!;
        k = c === "*" ? ramp("cde", l + 0.2) : c;
      }
      return far ? DARKER[k] ?? k : k;
    });
    // Two dark spots on the coverts.
    const spot = (d: number, o: number) => S(["s"], Math.floor(sx + ux * d + nx * o), Math.floor(sy + uy * d + ny * o));
    spot(len * 0.22, 0.5);
    spot(len * 0.22 + 1, 0.5);
    spot(len * 0.36, -1);
  });
}

/** His long tapered tail, over the roof behind him: grey-brown, pale at the tip with a dark band before it. */
function tail(): { part: Part; at: Pt } {
  const poly: Pt[] = [[42, 37], [50, 39.5], [65, 44.2], [65, 46.4], [50, 46], [41, 44]];
  const inside = inPoly(poly);
  return painted(39, 35, 28, 13, (F) =>
    F(inside, (x, y) => {
      if (x >= 63) return "e";
      if (x === 62) return "s";
      const top = !inside(x, y - 1);
      return top ? "c" : y >= 45 ? "a" : "b";
    }),
  );
}

/** The conductor's cap: a short round navy crown, a gold band, a small stiff black brim to the front, sat jaunty. */
const CAP: readonly string[] = [
  ".....233332..",
  "....23444332.",
  "...2344443321",
  "..23333333211",
  "..LLLLLLLLKK.",
  "1111.........",
];
const CAP_AT: Pt = [HEAD[0] - 9, HEAD[1] - 12];
const capPart = (): Part => ({ grid: CAP });

/** A grid turned `deg` degrees clockwise about its middle (each pixel sampled from the one it came from), and how far its top left moves. */
function turnGrid(grid: readonly string[], deg: number): { grid: string[]; off: Pt } {
  const h = grid.length;
  const w = Math.max(...grid.map((r) => r.length));
  const cx = w / 2;
  const cy = h / 2;
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  const corners = ([[0, 0], [w, 0], [0, h], [w, h]] as Pt[]).map(([x, y]): Pt => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
  const x0 = Math.floor(Math.min(...corners.map((p) => p[0])));
  const x1 = Math.ceil(Math.max(...corners.map((p) => p[0])));
  const y0 = Math.floor(Math.min(...corners.map((p) => p[1])));
  const y1 = Math.ceil(Math.max(...corners.map((p) => p[1])));
  const rows: string[] = [];
  for (let Y = y0; Y < y1; Y++) {
    let row = "";
    for (let X = x0; X < x1; X++) {
      const dx = X + 0.5 - cx;
      const dy = Y + 0.5 - cy;
      const gx = Math.floor(cx + dx * c + dy * s);
      const gy = Math.floor(cy - dx * s + dy * c);
      const k = grid[gy]?.[gx] ?? ".";
      row += k === " " ? "." : k;
    }
    rows.push(row);
  }
  return { grid: rows, off: [x0, y0] };
}

/** The cap turned `deg` degrees (positive: knocked back, the brim up; negative: tipped forward): its part name and offset. */
const capOffs = new Map<number, Pt>();
function capTurned(deg: number): { name: string; off: Pt } {
  const d = Math.round(deg);
  if (d === 0) return { name: "cap", off: [0, 0] };
  const name = `cap:${d}`;
  let off = capOffs.get(d);
  if (!off) {
    const t = turnGrid(CAP, d);
    add(name, () => ({ grid: t.grid }));
    capOffs.set(d, (off = t.off));
  }
  return { name, off };
}

/** The tie at his throat. */
const TIE: readonly string[] = [".TU.", ".RT.", "RTUT", "RTTU", ".RTT", "..RT", "...R"];
const TIE_AT: Pt = [20, 29];

/** His feet on the hatch's lip: a short leg each, toes gripping the edge, the front toe curled over it. */
const FOOT_N: readonly string[] = ["..PP", ".PPp", "QPPPp", "P...."];
const FOOT_F: readonly string[] = ["..pp", ".ppp", "pppp", "p..."];
const FOOT_N_AT: Pt = [28, 45];
const FOOT_F_AT: Pt = [34, 45];

const placedAt = new Map<string, Pt>();
function placed(name: string, make: () => { part: Part; at: Pt }): { name: string; at: Pt } {
  let at = placedAt.get(name);
  if (!at) {
    const m = make();
    add(name, () => m.part);
    placedAt.set(name, (at = m.at));
  }
  return { name, at };
}
add("cap", capPart);
add("tie", () => ({ grid: TIE }));
add("footN", () => ({ grid: FOOT_N }));
add("footF", () => ({ grid: FOOT_F }));

// ---- The pose.

export interface BirdiePose {
  /** Sunk into the hatch (0 perched; about 19 only his head shows; negative: a little hop up). */
  dy?: number;
  /** Moved across (positive: to our right, toward the hatch's middle as he crouches). */
  dx?: number;
  /** A breath: body and head sink a pixel, the feet stay. */
  breath?: number;
  /** The head moved from rest (a bob, a cock). */
  head?: Pt;
  lid?: Lid;
  /** Crouched only: which way he looks. */
  look?: "left" | "right";
  /** His body leaning out (to our left: negative x), his feet staying on the lip. */
  lean?: Pt;
  /** The near wing open, heading this many degrees (180 toward the board, 270 straight up), `wingLen` long. */
  wing?: number;
  wingLen?: number;
  /** The far wing open too (behind him), at its own angle. */
  far?: number;
  /** Chest puffed (pixels), feathers ruffled, beak open. */
  puff?: number;
  ruffle?: boolean;
  beak?: boolean;
  /** The cap turned (degrees: positive knocked back, negative tipped forward) and lifted off his head (pixels). */
  capTilt?: number;
  capLift?: Pt;
  /** The cap off his head; `capFree` puts it loose somewhere (its top left in scene pixels, and its turn). */
  capOff?: boolean;
  capFree?: readonly [number, number, number];
  capBehind?: boolean;
  /** He isn't there (ducked right down in the cab, or gone). */
  hidden?: boolean;
  /** Tumbling: him turned `q` quarter turns clockwise (backward) about his middle, and moved `at`. */
  tumble?: { q: number; at: Pt };
  /** The whole train (and him) moved, and its wheels turned. */
  train?: Pt;
  wheel?: number;
}

/** Mirrors a part of width `w` at `x0` about the head's middle (pixel x maps to A - x). */
const MIRROR_A = 2 * HEAD[0] - 1;
/** His middle, for tumbling (scene pixels). */
const MIDDLE: Pt = [33, 34];

export function birdieLayers(pose: BirdiePose = {}): Layer[] {
  const dy = pose.dy ?? 0;
  const dx = pose.dx ?? 0;
  const br = pose.breath ?? 0;
  const hd = pose.head ?? [0, 0];
  const lid = pose.lid ?? "open";
  const [lx, ly] = pose.lean ?? [0, 0];
  const turn = pose.wheel ?? 0;
  const L = (pl: { name: string; at: Pt }, ox = 0, oy = 0, flipX = false): Layer => ({ part: pl.name, x: OX + pl.at[0] + ox, y: OY + pl.at[1] + oy, ...(flipX ? { flipX } : {}) });
  const base: Layer[] = [
    { part: "shadow", x: OX + 2, y: OY + 71 },
    { part: trainName(turn), x: OX + TRAIN_X0, y: OY + TRAIN_Y0 },
  ];
  const him: Layer[] = [];
  const after: Layer[] = [];
  const feet: Layer[] = [
    { part: "footF", x: OX + FOOT_F_AT[0] + dx, y: OY + FOOT_F_AT[1] + Math.min(0, dy) },
    { part: "footN", x: OX + FOOT_N_AT[0] + dx, y: OY + FOOT_N_AT[1] + Math.min(0, dy) },
  ];
  /** The cap on his head (unless off), at the head's place (ox, oy from rest). */
  const capOn = (ox: number, oy: number, flip = false): Layer[] => {
    if (pose.capOff) return [];
    const [cx, cy] = pose.capLift ?? [0, 0];
    const c = capTurned(pose.capTilt ?? 0);
    if (flip) {
      const cw = Math.max(...CAP.map((r) => r.length));
      return [{ part: "cap", x: OX + MIRROR_A - CAP_AT[0] - (cw - 1) + ox, y: OY + CAP_AT[1] + oy, flipX: true }];
    }
    return [{ part: c.name, x: OX + CAP_AT[0] + c.off[0] + ox + cx, y: OY + CAP_AT[1] + c.off[1] + oy + cy }];
  };
  if (!pose.hidden) {
    if (dy <= 13) {
      const y = dy + br + ly;
      const x = dx + lx;
      const look: BirdLook = { puff: pose.puff, ruffle: pose.ruffle, open: pose.beak };
      const tag = `${pose.puff ? `:p${pose.puff}` : ""}${pose.ruffle ? ":r" : ""}${pose.beak ? ":o" : ""}`;
      him.push(
        ...(dy < 8 ? [L(placed("tail", tail), x, y)] : []),
        ...(dy > 0 ? feet : []),
        ...(pose.far !== undefined ? [L(placed(`wingO:${pose.far}:${pose.wingLen ?? 18}:1`, () => openWing(pose.far!, pose.wingLen ?? 18, true)), x + FAR_OFF[0], y + FAR_OFF[1])] : []),
        L(placed(`bird:${hd[0]},${hd[1]}:${lid}${tag}`, () => bird(hd, lid, look)), x, y),
      );
      if (pose.wing === undefined) him.push(L(placed("wing", wing), x, y), L({ name: "tie", at: TIE_AT }, x, y));
      else
        him.push(
          // The other wing still folded on his back, a shade darker, while only the near one opens.
          ...(pose.far === undefined ? [L(placed("wingBack", wingBack), x, y - 1)] : []),
          L({ name: "tie", at: TIE_AT }, x, y),
          L(placed(`wingO:${pose.wing}:${pose.wingLen ?? 18}:0`, () => openWing(pose.wing!, pose.wingLen ?? 18, false)), x, y),
        );
      him.push(...capOn(x + hd[0], y + hd[1]));
    } else {
      const right = pose.look === "right";
      const h = placed(`head:${lid}`, () => headOnly(lid));
      const hw = Math.max(...PARTS[h.name]!.grid.map((r) => r.length));
      const hx0 = right ? MIRROR_A - h.at[0] - (hw - 1) : h.at[0];
      him.push(
        { part: h.name, x: OX + hx0 + dx + hd[0], y: OY + h.at[1] + dy + hd[1], ...(right ? { flipX: true } : {}) },
        ...capOn(dx + hd[0], dy + hd[1], right),
      );
    }
    if (dy <= 0) after.push(...feet);
  }
  let layers: Layer[];
  if (pose.tumble && !pose.hidden) {
    let fr = { layers: [...him, ...after] };
    for (let i = 0; i < pose.tumble.q % 4; i++) fr = lieDown(PARTS, fr, OX + MIDDLE[0], OY + MIDDLE[1], "right");
    const [tx, ty] = pose.tumble.at;
    const tumbling = fr.layers.map((l) => ({ ...l, x: l.x + tx, y: l.y + ty }));
    const front: Layer = { part: frontName(turn), x: OX + TRAIN_X0, y: OY + TRAIN_Y0 };
    // Up over the roof he is behind the train's near side; falling past it, in front.
    layers = ty > 0 ? [...base, front, ...tumbling] : [...base, ...tumbling, front];
  } else {
    layers = [...base, ...him, { part: frontName(turn), x: OX + TRAIN_X0, y: OY + TRAIN_Y0 }, ...after];
  }
  if (pose.capFree) {
    const [fx, fy, deg] = pose.capFree;
    const c = capTurned(deg);
    const loose: Layer = { part: c.name, x: OX + Math.round(fx) + c.off[0], y: OY + Math.round(fy) + c.off[1] };
    // Lying on the roof it is behind him (his tail over it); flying, in front.
    if (pose.capBehind) layers.splice(2, 0, loose);
    else layers.push(loose);
  }
  const [tx, ty] = pose.train ?? [0, 0];
  return tx || ty ? layers.map((l) => ({ ...l, x: l.x + tx, y: l.y + ty })) : layers;
}

const F = (ms: number, pose: BirdiePose = {}, extra: Partial<Frame> = {}): Frame => ({ ms, layers: birdieLayers(pose), ...extra });

/** Crouched in the hatch: moved this far toward its middle. */
const IN = 5;
/** Crouched: sunk this far, so only his head (and the beak, clear of the roof) shows above the lip. */
const DOWN = 17;

/**
 * Idle (about 5.6 s): perched tall on the lip, breathing, a dove's head bob, a blink, a cock of the head; then he ducks
 * down into the hatch until only his head shows, peeks left, then right, blinks, and pops back up to perch.
 */
const idle: Anim = {
  loop: true,
  frames: [
    F(420),
    F(420, { breath: 1 }),
    F(220, { head: [-1, 0] }),
    F(260),
    F(110, { lid: "shut" }),
    F(380, { breath: 1 }),
    F(420, { head: [0, -1] }),
    F(200),
    // Duck down and peek.
    F(110, { dy: 4, dx: 1, breath: 1, lid: "half" }),
    F(100, { dy: 12, dx: 3 }),
    F(260, { dy: DOWN, dx: IN }),
    F(420, { dy: DOWN, dx: IN - 1, head: [-1, 0] }),
    F(500, { dy: DOWN, dx: IN + 1, look: "right" }),
    F(110, { dy: DOWN, dx: IN + 1, look: "right", lid: "shut" }),
    F(300, { dy: DOWN, dx: IN + 1, look: "right", head: [0, -1] }),
    F(260, { dy: DOWN, dx: IN }),
    F(90, { dy: 9, dx: 2 }),
    F(110, { dy: -1 }),
    F(260),
    F(420, { breath: 1 }),
    F(260, { head: [-1, 0] }),
  ],
};

// ---- Things drawn on his frames (no outline): headlight glints, steam, his coo, sweat, loose feathers, speed lines.

/** A speck at a scene point, moved with the train (`t`). */
const sp = (x: number, y: number, k: string, t: Pt = [0, 0]): Speck => [OX + Math.round(x + t[0]), OY + Math.round(y + t[1]), k];

/** The headlights flashing: rays out of each lamp, short (1) or long (2). */
function flash(level: 1 | 2, t: Pt = [0, 0]): Speck[] {
  const out: Speck[] = [];
  const rays: readonly (readonly [Pt, readonly Pt[]])[] = [
    [LAMPS[0]!, [[-1, 0], [-1, -1], [0, -1], [1, -1]]],
    [LAMPS[1]!, [[-1, 0], [-1, -1], [-1, 1]]],
  ];
  for (const [[cx, cy], dirs] of rays)
    for (const [ux, uy] of dirs) {
      out.push(sp(cx + ux * 2, cy + uy * 2, "W", t));
      if (level === 2) out.push(sp(cx + ux * 3, cy + uy * 3, "w", t), sp(cx + ux * 4, cy + uy * 4, "Y", t));
    }
  return out;
}
/** The lamps themselves brighter. */
const BRIGHT: Record<string, string> = { W: PALETTE.w!, l: PALETTE.J! };

/** A round puff of steam at (x, y), `r` across: pale, lit at its top left, grey at its bottom right. */
function puff(x: number, y: number, r: number, t: Pt = [0, 0]): Speck[] {
  const out: Speck[] = [];
  const blobs: [number, number, number][] = r < 1.6 ? [[0, 0, r]] : [[0, 0, r], [-r * 0.85, r * 0.45, r * 0.7], [r * 0.9, r * 0.35, r * 0.72]];
  const inside = (i: number, j: number) => blobs.some(([bx, by, br]) => Math.hypot(i - bx, j - by) <= br + 0.25);
  const R = Math.ceil(r * 2);
  for (let j = -R; j <= R; j++)
    for (let i = -R; i <= R; i++) {
      if (!inside(i, j)) continue;
      // Lit from the top left: the top edge pale, the bottom edge grey.
      const k = !inside(i, j - 1) || !inside(i - 1, j - 1) ? "w" : !inside(i, j + 1) || !inside(i + 1, j + 1) ? "l" : "J";
      out.push(sp(x + i, y + j, k, t));
    }
  return out;
}
/** Steam from the train's roof (just behind the hatch), `n` steps after it starts: puffs rising and spreading, then thinning. */
const steam = (n: number, t: Pt = [0, 0]): Speck[] => {
  const out: Speck[] = [];
  for (let i = 0; i <= Math.min(n, 2); i++) {
    const age = n - i;
    if (age > 4) continue;
    out.push(...puff(56 + age * 1.25, 41 - age * 4, Math.min(3, 1.2 + age * 0.7), t));
  }
  return out;
};
/** His coo: little arcs off his beak, one (`n` 1) or two. */
const coo = (n: number, hd: Pt = [0, 0]): Speck[] => {
  const [bx, by] = [HEAD[0] + hd[0] - 10, HEAD[1] + hd[1] + 1];
  const small: Pt[] = [[-2, -2], [-3, -1], [-3, 0], [-2, 1]];
  const big: Pt[] = [[-4, -4], [-5, -3], [-6, -2], [-6, -1], [-6, 0], [-5, 1], [-4, 2]];
  return [...small.map(([x, y]) => sp(bx + x, by + y, "i")), ...(n > 1 ? big.map(([x, y]) => sp(bx + x, by + y, "h")) : [])];
};
/** A drop of nervous sweat by his head, falling (`i`). */
const sweat = (i: number, at: Pt, right = false): Speck[] => {
  const [x, y] = [HEAD[0] + at[0] + (right ? -9 : 8), HEAD[1] + at[1] - 6 + (i % 3) * 2];
  return [sp(x, y, "w"), sp(x, y + 1, "o"), sp(x - 1, y + 1, "o"), sp(x, y + 2, "l")];
};
/** A tear welling under his eye (0), then on his cheek (1). */
const tear = (i: number, at: Pt): Speck[] => {
  const [x, y] = [HEAD[0] + at[0] - 5, HEAD[1] + at[1] + 1 + i];
  return [sp(x, y, "w"), sp(x, y + 1, "Z"), ...(i ? [sp(x, y + 2, "Z")] : [])];
};
/** Loose feathers drifting off him (`i` steps on). */
const feathers = (i: number, at: Pt = [0, 0]): Speck[] =>
  ([[44, 28], [20, 40], [48, 36]] as Pt[]).flatMap(([x, y], n): Speck[] => {
    const fx = x + at[0] + (n === 1 ? -i * 2 : i * 2);
    const fy = y + at[1] - 3 + i * 2 + (n % 2);
    return [sp(fx, fy, "e"), sp(fx + 1, fy, "e"), sp(fx + 1, fy + 1, "d"), sp(fx + 2, fy + 1, "c")];
  });
/** Speed lines trailing the train, its back at `x`. */
const speed = (x: number, n: number): Speck[] =>
  [[50, 3], [57, 5], [64, 4]].flatMap(([y, len], i): Speck[] => Array.from({ length: len! + n }, (_, j) => sp(x + 3 + i * 2 + j, y!, j % 3 === 2 ? "." : "l")).filter((s) => s[2] !== "."));
/** Thought dots rising off his head (`n` 1 to 3). */
const dots = (n: number): Speck[] =>
  ([[34, 12], [37, 6], [41, 0]] as Pt[]).slice(0, n).flatMap(([x, y], i): Speck[] =>
    i === 2
      ? [sp(x + 1, y, "w"), sp(x + 2, y, "w"), sp(x, y + 1, "w"), sp(x + 3, y + 1, "o"), sp(x, y + 2, "o"), sp(x + 3, y + 2, "l"), sp(x + 1, y + 3, "o"), sp(x + 2, y + 3, "l")]
      : i === 1
        ? [sp(x, y, "w"), sp(x + 1, y, "w"), sp(x + 2, y, "o"), sp(x, y + 1, "w"), sp(x + 1, y + 1, "o"), sp(x + 2, y + 1, "o"), sp(x, y + 2, "o"), sp(x + 1, y + 2, "o"), sp(x + 2, y + 2, "l")]
        : [sp(x, y, "w"), sp(x + 1, y, "o"), sp(x, y + 1, "o"), sp(x + 1, y + 1, "l")],
  );

/** A hit: his feathers paler a step (keys of his own ramps, no new colors). */
const FLASH: Record<string, string> = Object.fromEntries(
  ([["a", "c"], ["b", "d"], ["c", "e"], ["d", "e"], ["e", "i"], ["f", "h"], ["g", "i"], ["h", "i"], ["s", "b"], ["1", "3"], ["2", "4"], ["3", "4"], ["R", "U"], ["T", "U"]] as const).map(([k, to]) => [k, PALETTE[to]!]),
);

// ---- His animations.

/** Entrance: the train rolls in from the right (wheels turning) and brakes with a puff of steam; he pops up, hops, and tips his cap. */
const ROLL = [64, 52, 41, 31, 22, 14, 8, 4, 1] as const;
const entrance: Anim = {
  loop: false,
  frames: [
    ...ROLL.map((x, i) => F(i < 3 ? 80 : 90, { hidden: true, train: [x, 0], wheel: i + 1 }, i === 0 ? { cue: "roll" } : {})),
    F(110, { hidden: true, train: [-1, 0] }, { cue: "brake", shake: [-1, 0], specks: steam(0) }),
    F(120, { hidden: true }, { specks: steam(1) }),
    F(90, { dy: 12, dx: 3 }, { specks: steam(2) }),
    F(100, { dy: -3, lid: "wide" }, { cue: "pop", specks: steam(3) }),
    F(110, { dy: 0 }, { specks: steam(4) }),
    F(120, { wing: 300, wingLen: 15, head: [-1, 0] }),
    F(320, { wing: 288, wingLen: 18, head: [-1, 1], capLift: [2, -3], capTilt: -14, lid: "joy" }, { cue: "tip" }),
    F(130, { wing: 295, wingLen: 15, head: [-1, 0], capLift: [1, -1], capTilt: -5 }),
    F(260),
  ],
};

/** Thinking (loop): a dove's head-bob, a look up with his head cocked, a blink, a look back over his shoulder; dots rise. */
const thinking: Anim = {
  loop: true,
  frames: [
    F(300, {}, { specks: dots(1) }),
    F(130, { head: [-2, 1] }, { specks: dots(1) }),
    F(130, { head: [0, 0] }, { specks: dots(1) }),
    F(420, { head: [0, -1], lid: "up", capTilt: 12 }, { specks: dots(2) }),
    F(110, { head: [0, -1], lid: "shut", capTilt: 12 }, { specks: dots(2) }),
    F(380, { head: [0, -1], lid: "up", capTilt: 12, breath: 1 }, { specks: dots(3) }),
    F(130, { head: [-2, 1] }, { specks: dots(3) }),
    F(130, { head: [0, 0] }),
    F(440, { head: [1, 0], lid: "back", capTilt: -10 }, { specks: dots(1) }),
    F(160, { head: [1, 0], lid: "back", capTilt: -10, breath: 1 }, { specks: dots(1) }),
  ],
};

/** Move: a nod, then a wing out toward the board ("there"), and he folds it again. */
const move: Anim = {
  loop: false,
  frames: [
    F(90, { head: [-1, 1] }),
    F(110, { head: [-2, 2], lid: "half" }, { cue: "nod" }),
    F(90, { head: [0, 0] }),
    F(90, { wing: 140, wingLen: 15, lean: [-1, 0], head: [-1, 0] }),
    F(300, { wing: 165, wingLen: 22, lean: [-1, 0], head: [-2, 1] }, { cue: "point" }),
    F(100, { wing: 140, wingLen: 15, lean: [-1, 0], head: [-1, 0] }),
    F(160),
  ],
};

/** Capture: a happy little flutter, both wings beating, hopping on the lip, eyes smiling, a puff of steam from the roof. */
const capture: Anim = {
  loop: false,
  frames: [
    F(80, { breath: 1, lid: "joy" }),
    ...Array.from({ length: 8 }, (_, i) => {
      const up = i % 2 === 0;
      return F(85, { wing: up ? 280 : 12, far: up ? 302 : 2, wingLen: 21, dy: up ? -2 : 0, lid: "joy", head: [0, up ? -1 : 0], beak: i === 2 || i === 4 }, { cue: i === 0 ? "flutter" : i === 3 ? "toot" : undefined, specks: i >= 3 ? steam(i - 3) : [] });
    }),
    F(110, { lid: "joy" }, { specks: steam(5) }),
    F(180),
  ],
};

/** Hurt: a flinch back with his feathers ruffled and the cap knocked askew; he blinks, reaches up and straightens it. */
const hurt: Anim = {
  loop: false,
  frames: [
    F(70, { lean: [2, 1], head: [1, 1], lid: "shut", ruffle: true, capTilt: 28, capLift: [2, -3] }, { cue: "oof", pal: FLASH, shake: [1, 0], specks: feathers(0) }),
    F(90, { lean: [2, 1], head: [1, 1], lid: "wide", ruffle: true, capTilt: 22, capLift: [2, -1] }, { shake: [-1, 0], specks: feathers(1) }),
    F(140, { lean: [1, 0], head: [0, 0], lid: "half", ruffle: true, capTilt: 22, capLift: [2, -1] }, { specks: feathers(2) }),
    F(120, { lid: "half", capTilt: 22, capLift: [2, -1] }, { specks: feathers(3) }),
    F(120, { wing: 290, wingLen: 17, lid: "half", capTilt: 12, capLift: [1, -1] }),
    F(120, { wing: 285, wingLen: 17, head: [-1, 0], capTilt: 0 }),
    F(200, { head: [-1, 0] }),
  ],
};

/** Check: he leans out and points his wing at the king, and the headlights flash once. */
const POINT: BirdiePose = { lean: [-3, 1], head: [-3, 1], wing: 168, wingLen: 23 };
const check: Anim = {
  loop: false,
  frames: [
    F(100, { lean: [-1, 0], head: [-1, 0], wing: 140, wingLen: 15 }),
    F(130, { ...POINT, beak: true }, { cue: "point" }),
    F(140, { ...POINT, beak: true }, { cue: "flash", pal: BRIGHT, specks: flash(2) }),
    F(120, POINT, { specks: flash(1) }),
    F(280, POINT),
    F(110, { lean: [-1, 0], head: [-1, 0], wing: 140, wingLen: 15 }),
    F(160),
  ],
};

/** Smug (loop): chest puffed, head back, eyes half shut, a pleased coo now and then. */
const SMUG: BirdiePose = { puff: 2, head: [1, -1], lid: "smug" };
const smug: Anim = {
  loop: true,
  frames: [
    F(260, SMUG),
    F(200, { ...SMUG, breath: 1 }),
    F(140, { ...SMUG, puff: 3 }, { cue: "coo", specks: coo(1, [1, -1]) }),
    F(180, { ...SMUG, puff: 3, lid: "shut" }, { specks: coo(2, [1, -1]) }),
    F(160, { ...SMUG }, { specks: coo(1, [1, -1]) }),
    F(260, { ...SMUG, breath: 1 }),
    F(110, { ...SMUG, lid: "shut" }),
    F(260, SMUG),
  ],
};

/** Rattled (loop): ducked down in the cab, only the top of his head showing, peeking out one way and the other, eyes wide, sweating. */
const RD = DOWN + 3;
const rattled: Anim = {
  loop: true,
  frames: [
    F(220, { dy: RD + 2, dx: IN, lid: "wide" }),
    F(120, { dy: RD, dx: IN - 1, lid: "wide" }, { specks: sweat(0, [IN, RD]) }),
    F(260, { dy: RD - 1, dx: IN - 2, head: [-1, 0], lid: "wide" }, { specks: sweat(1, [IN, RD]) }),
    F(90, { dy: RD + 3, dx: IN, lid: "shut" }, { shake: [1, 0] }),
    F(200, { dy: RD + 3, dx: IN, lid: "wide" }),
    F(120, { dy: RD, dx: IN + 1, look: "right", lid: "wide" }, { specks: sweat(0, [IN + 1, RD], true) }),
    F(260, { dy: RD - 1, dx: IN + 2, look: "right", lid: "wide" }, { specks: sweat(1, [IN + 1, RD], true) }),
    F(100, { dy: RD + 2, dx: IN, lid: "shut" }, { shake: [-1, 0], specks: sweat(2, [IN, RD]) }),
  ],
};

/** Where the fallen cap lies on the roof behind the hatch. */
const CAP_ROOF: readonly [number, number, number] = [49, 38, 0];
/** Defeat: a jolt and his cap flies off, lands on the roof behind him; he sinks into the cab until only his sad head shows. Held. */
const defeat: Anim = {
  loop: false,
  frames: [
    F(80, { lean: [1, 1], lid: "shut", ruffle: true, capOff: true, capFree: [CAP_AT[0] + 3, CAP_AT[1] - 4, 25] }, { cue: "oof", pal: FLASH, shake: [1, 0] }),
    F(110, { lean: [1, 1], lid: "wide", capOff: true, capFree: [CAP_AT[0] + 12, CAP_AT[1] - 5, 70] }),
    F(110, { lid: "wide", capOff: true, capFree: [CAP_AT[0] + 22, CAP_AT[1] + 2, 140] }),
    F(130, { lid: "half", head: [0, 1], capOff: true, capFree: [44, 30, 200] }),
    F(220, { lid: "sad", head: [0, 2], capOff: true, capFree: CAP_ROOF, capBehind: true }, { cue: "plop" }),
    F(140, { dy: 6, dx: 2, lid: "sad", head: [0, 2], capOff: true, capFree: CAP_ROOF, capBehind: true }),
    F(150, { dy: 12, dx: 3, lid: "sad", capOff: true, capFree: CAP_ROOF, capBehind: true }),
    F(220, { dy: DOWN, dx: IN, lid: "sad", capOff: true, capFree: CAP_ROOF, capBehind: true }),
    F(300, { dy: DOWN + 1, dx: IN, lid: "sad", capOff: true, capFree: CAP_ROOF, capBehind: true }, { specks: tear(0, [IN, DOWN + 1]) }),
    F(1000, { dy: DOWN + 1, dx: IN, lid: "sad", capOff: true, capFree: CAP_ROOF, capBehind: true }, { specks: tear(1, [IN, DOWN + 1]) }),
  ],
};

/** Victory (loop): flapping and bouncing on the lip, eyes smiling, the headlights blinking, a toot of steam. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const up = i % 2 === 0;
    return F(110, { wing: up ? 278 : 12, far: up ? 300 : 2, wingLen: 22, dy: up ? -3 : 0, lid: "joy", head: [0, up ? -1 : 0], beak: i % 4 === 0 }, {
      cue: i === 0 ? "toot" : undefined,
      pal: i % 4 < 2 ? BRIGHT : undefined,
      specks: [...(i % 4 < 2 ? flash(i % 4 === 0 ? 2 : 1) : []), ...(i < 5 ? steam(i) : [])],
    });
  }),
};

// ---- His own moments.

/** Signal (about 1.5 s, the warning): he leans out and waves his wing like a conductor, calling all aboard, the headlights flashing. */
const LEAN: BirdiePose = { lean: [-3, 1], head: [-3, 0], wingLen: 23 };
const signal: Anim = {
  loop: false,
  frames: [
    F(110, { lean: [-1, 0], head: [-1, 0] }),
    F(120, { ...LEAN, wing: 300, wingLen: 15 }),
    F(140, { ...LEAN, wing: 270, beak: true }, { pal: BRIGHT, specks: flash(1) }),
    F(130, { ...LEAN, wing: 305, beak: true }),
    F(170, { ...LEAN, wing: 262, wingLen: 24, beak: true, head: [-3, -1] }, { cue: "signal", pal: BRIGHT, specks: flash(2) }),
    F(130, { ...LEAN, wing: 305 }, { specks: flash(1) }),
    F(140, { ...LEAN, wing: 270, beak: true }, { pal: BRIGHT, specks: flash(2) }),
    F(130, { ...LEAN, wing: 305 }),
    F(150, { ...LEAN, wing: 280 }, { pal: BRIGHT, specks: flash(1) }),
    F(120, { lean: [-1, 0], head: [-1, 0], wing: 320, wingLen: 13 }),
    F(160),
  ],
};

/** Depart (about 1 s, the attack begins): he ducks into the cab, the train lurches and pulls away to our left, out of the frame. */
const AWAY = [-3, -9, -18, -30, -46, -66] as const;
const depart: Anim = {
  loop: false,
  frames: [
    F(90, { dy: 6, dx: 1, lid: "half" }),
    F(90, { dy: 13, dx: 3 }),
    F(110, { hidden: true }),
    F(130, { hidden: true, train: [2, 0], wheel: 1 }, { cue: "go", shake: [0, 1], specks: steam(0, [2, 0]) }),
    ...AWAY.map((x, i) => F(i < 2 ? 90 : 70, { hidden: true, train: [x, 0], wheel: i + 2 }, { specks: [...steam(i + 1, [Math.round(x / 3), 0]), ...(i >= 2 ? speed(67 + x, i) : [])] })),
    { ms: 80, layers: [] },
  ],
};

/** Fall (about 1 s, the ultimate begins): a jolt, then he tumbles backward out of the cab and out of the frame downward, his cap flying off. */
const fall: Anim = {
  loop: false,
  frames: [
    F(130, { dy: -3, lean: [1, 0], lid: "wide", ruffle: true, capOff: true, capFree: [CAP_AT[0] + 1, CAP_AT[1] - 5, 20] }, { cue: "fall", shake: [2, 1] }),
    F(100, { dy: -3, lid: "wide", ruffle: true, capOff: true, tumble: { q: 1, at: [7, -8] }, capFree: [CAP_AT[0] + 8, CAP_AT[1] - 7, 70] }, { specks: feathers(0) }),
    F(100, { dy: -3, lid: "wide", ruffle: true, capOff: true, tumble: { q: 2, at: [11, -7] }, capFree: [CAP_AT[0] + 18, CAP_AT[1] - 9, 140] }, { specks: feathers(1) }),
    F(90, { dy: -3, lid: "shut", ruffle: true, capOff: true, tumble: { q: 3, at: [14, 4] }, capFree: [CAP_AT[0] + 30, CAP_AT[1] - 11, 210] }, { specks: feathers(2) }),
    F(90, { dy: -3, lid: "wide", ruffle: true, capOff: true, tumble: { q: 0, at: [15, 20] }, capFree: [CAP_AT[0] + 42, CAP_AT[1] - 13, 280] }, { specks: feathers(3) }),
    F(80, { dy: -3, lid: "wide", ruffle: true, capOff: true, tumble: { q: 1, at: [16, 38] }, capFree: [CAP_AT[0] + 54, CAP_AT[1] - 15, 340] }, { specks: feathers(4) }),
    F(80, { dy: -3, lid: "wide", capOff: true, tumble: { q: 2, at: [17, 54] } }, { specks: feathers(5) }),
    F(80, { hidden: true }),
    { ms: 80, layers: [] },
  ],
};

export const BOSS_BIRDIE: Character = {
  id: "boss-birdie",
  name: "Birdie",
  w: W,
  h: H,
  foot: [OX + 35, OY + 72],
  palette: PALETTE,
  halo: "#3a3026",
  parts: PARTS,
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, signal, depart, fall },
};
