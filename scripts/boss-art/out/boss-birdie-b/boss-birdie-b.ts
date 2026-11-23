/**
 * Birdie (variant B, a touch more charming): a young mourning dove, Eric's own bird, riding a miniature toy diesel
 * locomotive. A real dove (soft brown and grey-brown plumage, scalloped wing feathers with dark edges, a smooth round
 * head, a small dark beak, a big dark eye in a pale ring, coral-pink feet, a long tapered tail), the head a little big
 * and the eye a little large for warmth at phone size; a navy conductor's cap with a gold band, worn jaunty, and a
 * small burgundy tie. The train: a yellow toy diesel seen from the side, its nose to our left, a dark roof with an open
 * hatch he perches in, a thin red stripe, round headlights, silver trucks and wheels. No letters, numbers or markings.
 *
 * Rigging: the dove's body and head are painted together for each head offset and lid (so the neck stays one smooth
 * piece); the wing, tail, tie, cap and feet are parts of their own; the train is one part, and its near side (every
 * row from the hatch's lip down) is drawn again in front of him, so he can sink into the hatch. Crouched, only his
 * head (a part of its own, mirrored to look the other way) and cap show above the lip.
 */
import { canvas, inEllipse, inPoly, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part } from "../../../../packages/app/src/characters/sprite.ts";

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

function trainCanvas(): Canvas {
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
    }
  }).part.grid.map((r) => [...r]);
}

const { parts: PARTS, add } = lazyParts();

add("train", () => ({ grid: toGrid(trainCanvas()) }));
/** The near side again (from the lip down), drawn in front of him. */
add("trainFront", () => {
  const cv = trainCanvas();
  for (let y = 0; y < cv.length; y++) if (y + TRAIN_Y0 < LIP) cv[y]!.fill(".");
  return { grid: toGrid(cv), outline: false };
});
add("shadow", () => {
  const cv = canvas(66, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 66; x++) if (E(33, 1.5, 33, 1.6)(x, y)) cv[y]![x] = "G";
  return { grid: toGrid(cv), outline: false };
});

// ---- The dove.

export type Lid = "open" | "half" | "shut";

/** His head at (hx, hy): round, grey-brown on the crown, buff on the face, the beak, the big eye, a dark cheek spot. */
function paintHead(F: (inside: Inside, key: Key) => void, S: (rows: readonly string[], x: number, y: number) => void, hx: number, hy: number, lid: Lid) {
  const shape = E(hx, hy, 7.6, 7.2);
  F(shape, (x, y) => {
    const nx = (x + 0.5 - hx) / 7.6;
    const ny = (y + 0.5 - hy) / 7.2;
    const l = 0.62 - 0.38 * nx - 0.5 * ny;
    if (nx < -0.1 && ny > -0.25) return ramp("fgh", l + 0.05);
    return ramp("bcde", l - 0.05);
  });
  // Beak.
  S(["CCB", ".BB"], hx - 10, hy + 1);
  // Eye: dark, big, in a pale ring, a glint at its top left.
  const ex = hx - 6;
  const ey = hy - 4;
  const eyes: Record<Lid, string[]> = {
    open: [".ooo.", "owxxo", "oxxxo", "oxxxo", ".ooo."],
    half: [".ooo.", "occco", "oxxxo", "oxxxo", ".ooo."],
    shut: [".ooo.", "occco", "occco", "osssc", ".ooo."],
  };
  S(eyes[lid], ex, ey);
  // The little dark mark under his eye.
  S(["s", "s"], hx - 1, hy + 3);
}

/** Body and head together (one smooth piece), the head moved `hd` from rest, the body sunk `sink`. */
function bird(hd: Pt, lid: Lid): { part: Part; at: Pt } {
  const hx = HEAD[0] + hd[0];
  const hy = HEAD[1] + hd[1];
  return painted(10, 8, 40, 40, (F, S) => {
    const main = E(35.5, 37.5, 11.5, 8.2);
    const breast = E(27.5, 36.5, 7.2, 8.6);
    const neck = E(26.5, 29.5, 5.2, 5.2);
    F(union(main, breast, neck), (x, y) => {
      const nx = (x + 0.5 - 32) / 13;
      const ny = (y + 0.5 - 36) / 10;
      const l = 0.6 - 0.35 * nx - 0.5 * ny;
      const front = x + 0.5 < 31 - (y - 30) * 0.2 || y > 42;
      // Soft scaly fringes on his breast, as a young dove's.
      const fleck = y > 30 && y % 3 === 0 && (x + y) % 4 === 0;
      if (front) return ramp("fgh", l - (fleck ? 0.3 : 0));
      return ramp("bcde", l - 0.05);
    });
    paintHead(F, S, hx, hy, lid);
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

/** One covert feather's tile (5 x 4): `*` is its body, lit by where it is. */
const FEATHER = ["b***c", "b***b", "ab*ba", "aeeea"];

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
}

/** Mirrors a part of width `w` at `x0` about the head's middle (pixel x maps to A - x). */
const MIRROR_A = 2 * HEAD[0] - 1;

export function birdieLayers(pose: BirdiePose = {}): Layer[] {
  const dy = pose.dy ?? 0;
  const dx = pose.dx ?? 0;
  const br = pose.breath ?? 0;
  const hd = pose.head ?? [0, 0];
  const lid = pose.lid ?? "open";
  const L = (pl: { name: string; at: Pt }, ox = 0, oy = 0, flipX = false): Layer => ({ part: pl.name, x: OX + pl.at[0] + ox, y: OY + pl.at[1] + oy, ...(flipX ? { flipX } : {}) });
  const layers: Layer[] = [
    { part: "shadow", x: OX + 2, y: OY + 71 },
    { part: "train", x: OX + TRAIN_X0, y: OY + TRAIN_Y0 },
  ];
  const feet: Layer[] = [
    { part: "footF", x: OX + FOOT_F_AT[0] + dx, y: OY + FOOT_F_AT[1] + Math.min(0, dy) },
    { part: "footN", x: OX + FOOT_N_AT[0] + dx, y: OY + FOOT_N_AT[1] + Math.min(0, dy) },
  ];
  if (dy <= 13) {
    const y = dy + br;
    layers.push(
      ...(dy < 8 ? [L(placed("tail", tail), dx, y)] : []),
      ...(dy > 0 ? feet : []),
      L(placed(`bird:${hd[0]},${hd[1]}:${lid}`, () => bird(hd, lid)), dx, y),
      L(placed("wing", wing), dx, y),
      L({ name: "tie", at: TIE_AT }, dx, y),
      L({ name: "cap", at: CAP_AT }, dx + hd[0], y + hd[1]),
    );
  } else {
    const right = pose.look === "right";
    const h = placed(`head:${lid}`, () => headOnly(lid));
    const hw = Math.max(...PARTS[h.name]!.grid.map((r) => r.length));
    const cw = Math.max(...CAP.map((r) => r.length));
    const hx0 = right ? MIRROR_A - h.at[0] - (hw - 1) : h.at[0];
    const cx0 = right ? MIRROR_A - CAP_AT[0] - (cw - 1) : CAP_AT[0];
    layers.push(
      { part: h.name, x: OX + hx0 + dx + hd[0], y: OY + h.at[1] + dy + hd[1], ...(right ? { flipX: true } : {}) },
      { part: "cap", x: OX + cx0 + dx + hd[0], y: OY + CAP_AT[1] + dy + hd[1], ...(right ? { flipX: true } : {}) },
    );
  }
  layers.push({ part: "trainFront", x: OX + TRAIN_X0, y: OY + TRAIN_Y0 });
  if (dy <= 0) layers.push(...feet);
  return layers;
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

export const BIRDIE: Character = {
  id: "boss-birdie-b",
  name: "Birdie",
  w: W,
  h: H,
  foot: [OX + 35, OY + 72],
  palette: PALETTE,
  halo: "#3a3026",
  parts: PARTS,
  anims: { idle },
};
