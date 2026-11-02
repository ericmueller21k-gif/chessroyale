/**
 * Trickle, the hourglass creature (concept, idle only): a living hourglass in a carved walnut frame, a crown-like cap
 * with brass finials, two turned posts for sides, stubby wooden arms and little round feet. Golden sand trickles from
 * the top bulb to the bottom one, with a violet magic shimmer in it; two big sleepy-mischievous eyes in the upper glass,
 * shifted a little to our left (toward the board). Light from the top left.
 *
 * Rigging: the body (frame, glass, sand, eyes, mouth) is painted per sand step and face (`bodyPart`), so it turns as
 * one with quarter turns for the flip; arms are painted stubs from a shoulder to a hand offset; feet and the ground
 * shadow are fixed parts. `pose()` places them.
 */
import { canvas, edge, ellipse, inEllipse, roundLight, shade, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Speck } from "../../../../packages/app/src/characters/sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#1d120c", // outline
  d: "#4a2a17", // walnut, dark to light
  w: "#6e4126",
  W: "#8f5a34",
  h: "#b88052",
  o: "#f2c14e", // brass
  O: "#a8761f",
  g: "#2c4a5e", // glass
  q: "#7fb3c9", // glass rim
  G: "#bfe8f5", // glass highlight
  H: "#ffffff",
  s: "#e3ad42", // sand
  S: "#b07a2c",
  y: "#ffe08a",
  v: "#a978ff", // violet shimmer
  V: "#e6d6ff",
  e: "#fbf6ea", // eye white
  p: "#1b1630", // pupil
  m: "#5a1f2a", // mouth
  z: "#0b0c10", // ground shadow
};

const { parts, add } = lazyParts();

// ---- The body: 36 x 48. Cap rows 0-10, glass rows 11-41 (neck at 26), base rows 42-47.

const BW = 36;
const BH = 56;
const CX = 18;
const GT = 11;
const NECK = 30;
const GB = 49;

/** Half-width of the glass at a row. */
function hw(y: number): number {
  const yc = y + 0.5;
  const u = yc < NECK ? (NECK - yc) / (NECK - GT) : (yc - NECK) / (GB + 1 - NECK);
  return 1.3 + 9.4 * (1 - (1 - Math.min(1, u)) ** 3.2);
}
const inGlass = (x: number, y: number) => y >= GT && y <= GB && Math.abs(x + 0.5 - CX) <= hw(y);

export type EyeKind = "open" | "shut" | "happy" | "wide";
export interface Face {
  eye: EyeKind;
  /** Pupil offset: 0 (looking our left) to 2; 0 (up) to 2 (down). */
  px?: number;
  py?: number;
  mouth?: "smile" | "smirk" | "o" | "grin";
}

const MOUTHS: Record<string, readonly string[]> = {
  smile: ["k...k", ".kkk."],
  smirk: ["....k", "kkkk."],
  o: [".kk.", "kmmk", ".kk."],
  grin: ["kkkkk", "kmmmk", ".kkk."],
};

function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, y) =>
    [...row].forEach((k, x) => {
      if (k !== "." && cv[y0 + y]?.[x0 + x] !== undefined) cv[y0 + y]![x0 + x] = k;
    }),
  );
}

function eyeRows(f: Face): string[] {
  if (f.eye === "shut") return [".......", ".......", ".......", ".......", ".......", "kkkkkkk", ".kkkkk.", ".......", "......."];
  if (f.eye === "happy") return [".......", ".......", ".......", "..kkk..", ".kkkkk.", "kk...kk", "k.....k", ".......", "......."];
  const rows = f.eye === "wide"
    ? [".kkkkk.", "keeeeek", "keeeeek", "keeeeek", "keeeeek", "keeeeek", "keeeeek", "keeeeek", ".kkkkk."]
    : ["..kkk..", ".keeek.", "keeeeek", "keeeeek", "keeeeek", "keeeeek", "keeeeek", ".keeek.", "..kkk.."];
  const g = rows.map((r) => [...r]);
  const px = 1 + [0, 1, 2][f.px ?? 1]!;
  const py = 2 + [0, 1, 3][f.py ?? 1]!;
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (g[py + y]?.[px + x] === "e") g[py + y]![px + x] = "p";
  if (g[py]?.[px] === "p") g[py]![px] = "e";
  return g.map((r) => r.join(""));
}

function rect(cv: Canvas, x0: number, y0: number, x1: number, y1: number, k: string) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (cv[y]?.[x] !== undefined) cv[y]![x] = k;
}

/** Paints a post (4 wide, x0 its left), lit from the left. */
function post(cv: Canvas, x0: number, left: boolean) {
  const ramp = left ? ["h", "W", "w", "d"] : ["W", "w", "w", "d"];
  for (let y = 10; y <= GB + 1; y++) for (let i = 0; i < 4; i++) cv[y]![x0 + i] = ramp[i]!;
  // turned bulge round the neck, where the arms grow
  for (let y = NECK - 3; y <= NECK + 3; y++) {
    const wide = y >= NECK - 2 && y <= NECK + 2;
    if (wide) {
      cv[y]![x0 - 1] = left ? "W" : "w";
      cv[y]![x0 + 4] = "d";
    }
  }
  for (const y of [NECK - 3, NECK + 3]) for (let i = 0; i < 4; i++) cv[y]![x0 + i] = "d";
  for (const y of [15, GB - 4]) for (let i = 0; i < 4; i++) cv[y]![x0 + i] = i === 0 && left ? "W" : "d";
  for (const y of [16, GB - 3]) cv[y]![x0] = "h";
}

function paintBody(step: number, face: Face, ph: number, magic: boolean): Canvas {
  const cv = canvas(BW, BH);
  const frac = step / 16;
  // Cap: plank, knobs and brass finials.
  ellipse(cv, CX, 4.5, 5, 3, "W");
  ellipse(cv, 5, 5.5, 3, 2, "W");
  ellipse(cv, 31, 5.5, 3, 2, "W");
  edge(cv, 0, -1, "W", "h");
  ellipse(cv, CX, 1.7, 1.8, 1.7, "o");
  ellipse(cv, 5, 3.2, 1.4, 1.3, "o");
  ellipse(cv, 31, 3.2, 1.4, 1.3, "o");
  rect(cv, 0, 6, 35, 9, "w");
  rect(cv, 0, 6, 35, 6, "h");
  rect(cv, 0, 7, 35, 7, "W");
  rect(cv, 0, 9, 35, 9, "d");
  cv[6]![0] = ".";
  cv[6]![35] = ".";
  cv[9]![0] = ".";
  cv[9]![35] = ".";
  // brass studs along the plank
  for (const x of [5, 12, 24, 31]) cv[8]![x] = "o";
  cv[8]![CX - 1] = "O";
  cv[8]![CX] = "o";
  rect(cv, 3, 10, 32, 10, "w");
  // Base.
  const B = GB + 1;
  rect(cv, 3, B, 32, B, "w");
  rect(cv, 0, B + 1, 35, B + 5, "w");
  rect(cv, 0, B + 1, 35, B + 1, "h");
  rect(cv, 0, B + 2, 35, B + 2, "W");
  rect(cv, 0, B + 5, 35, B + 5, "d");
  cv[B + 5]![0] = ".";
  cv[B + 5]![35] = ".";
  for (const x of [5, 12, 24, 31]) cv[B + 3]![x] = "o";
  // Posts.
  post(cv, 1, true);
  post(cv, 31, false);
  // Glass.
  for (let y = GT; y <= GB; y++)
    for (let x = 0; x < BW; x++) {
      if (!inGlass(x, y)) continue;
      cv[y]![x] = !inGlass(x - 1, y) || !inGlass(x + 1, y) ? "q" : "g";
    }
  const interior = (x: number, y: number) => inGlass(x, y) && inGlass(x - 1, y) && inGlass(x + 1, y);
  const sand = new Set<string>();
  const put = (x: number, y: number) => interior(x, y) && sand.add(`${x},${y}`);
  // Top sand: from its level down to the neck, a little funnel dip in the middle while it drains.
  if (frac < 1) {
    const level = 15 + Math.round(frac * (NECK - 15));
    for (let y = level; y <= NECK; y++)
      for (let x = 0; x < BW; x++) {
        const d = Math.abs(x + 0.5 - CX);
        if (y === level && d < 2.5 && frac > 0) continue;
        if (y === level + 1 && d < 1 && frac > 0 && y < NECK - 1) continue;
        put(x, y);
      }
  }
  // Bottom heap: a cone.
  const H = Math.round(frac * 16);
  if (H > 0)
    for (let y = NECK + 1; y <= GB; y++)
      for (let x = 0; x < BW; x++) if (y >= GB + 1 - H + Math.floor(Math.abs(x + 0.5 - CX) * 0.5)) put(x, y);
  // Stream.
  if (frac < 1) {
    const heapTop = H > 0 ? GB + 1 - H : GB + 1;
    for (let y = NECK + 1; y < heapTop; y++) sand.add(`17,${y}`);
  }
  for (const key of sand) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    let k: string;
    if (x === 17 && y > NECK && !sand.has(`16,${y}`) && !sand.has(`18,${y}`)) k = (y + ph) % 3 === 0 ? "y" : "s";
    else if (!sand.has(`${x},${y - 1}`)) k = "y";
    else if (x + 0.5 - CX > hw(y) * 0.45 || !sand.has(`${x},${y + 1}`)) k = "S";
    else k = "s";
    cv[y]![x] = k;
  }
  // Violet shimmer in the sand.
  const list = [...sand].filter((s) => !s.startsWith("17,") || Number(s.split(",")[1]) <= NECK);
  if (list.length) {
    const n = magic ? 10 : 3;
    for (let i = 0; i < n; i++) {
      const [x, y] = list[(ph * 37 + i * 53 + i * i * 11) % list.length]!.split(",").map(Number) as [number, number];
      cv[y]![x] = i % 3 === 0 ? "V" : "v";
    }
  }
  // Glass highlights (on the glass, over the sand).
  for (let y = 13; y <= 19; y++) {
    const x = Math.ceil(CX - hw(y) - 0.5) + 2;
    cv[y]![x] = y === 13 ? "H" : "G";
  }
  for (let y = 37; y <= 44; y++) {
    const x = Math.ceil(CX - hw(y) - 0.5) + 2;
    cv[y]![x] = y === 37 ? "H" : "G";
  }
  for (let y = 41; y <= 43; y++) {
    const x = Math.floor(CX + hw(y) - 0.5) - 2;
    cv[y]![x] = "G";
  }
  // Face: eyes a little to our left.
  const eye = eyeRows(face);
  stamp(cv, eye, 8, 12);
  stamp(cv, eye, 17, 12);
  // a sleepy lid: the top of each eye drawn heavy
  if (face.eye === "open") for (const x0 of [8, 17]) for (let x = 1; x <= 5; x++) cv[13]![x0 + x] = "k";
  const mouth = MOUTHS[face.mouth ?? "smirk"]!;
  stamp(cv, mouth, 16 - Math.floor(mouth[0]!.length / 2), 23);
  return cv;
}

function bodyPart(step: number, face: Face, ph: number, magic = false): string {
  const name = `body:${step}:${face.eye}:${face.px ?? 1}:${face.py ?? 1}:${face.mouth ?? "smirk"}:${ph}:${magic}`;
  return add(name, () => ({ grid: toGrid(paintBody(step, face, ph, magic)) }));
}

// ---- Arms: a stub from the shoulder to a round mitten hand.

function armPart(dx: number, dy: number): { name: string; ax: number; ay: number } {
  const ax = 4 + Math.max(0, -dx);
  const ay = 4 + Math.max(0, -dy);
  const name = add(`arm:${dx},${dy}`, () => {
    const cv = canvas(Math.abs(dx) + 8, Math.abs(dy) + 8);
    const n = 12;
    for (let i = 0; i <= n; i++) ellipse(cv, ax + 0.5 + (dx * i) / n, ay + 0.5 + (dy * i) / n, 1.6, 1.6, "w");
    ellipse(cv, ax + 0.5 + dx, ay + 0.5 + dy, 2.6, 2.6, "W");
    edge(cv, 0, 1, "*", "d");
    edge(cv, 0, -1, "*", "h");
    return { grid: toGrid(cv) };
  });
  return { name, ax, ay };
}

type ArmPose = "rest" | "up" | "out" | "tuck";
const ARM_L: Record<ArmPose, [number, number]> = { rest: [-4, 7], up: [-5, -6], out: [-7, 1], tuck: [-3, 3] };
const ARM_R: Record<ArmPose, [number, number]> = { rest: [4, 7], up: [5, -6], out: [7, 1], tuck: [3, 3] };

add("foot", () => {
  const cv = canvas(9, 5);
  shade(cv, inEllipse(4.5, 2.5, 4.5, 2.5), "dwWh", roundLight(4.5, 2.5, 4.5, 2.5, 0.1));
  return { grid: toGrid(cv) };
});
for (const w of [36, 28, 22]) add(`shadow${w}`, () => {
  const cv = canvas(w, 3);
  ellipse(cv, w / 2, 1.5, w / 2, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
});

// ---- Pose.

const OX = 22;
const GROUND = 78;
const BY = GROUND - 59;

interface Pose {
  step: number;
  face: Face;
  ph?: number;
  magic?: boolean;
  bob?: number;
  air?: number;
  rot?: 0 | 1 | 2 | 3;
  armL?: ArmPose;
  armR?: ArmPose;
  feetUp?: number;
}

function pose(p: Pose): Layer[] {
  const air = p.air ?? 0;
  const by = BY + (p.bob ?? 0) - air;
  const body = bodyPart(p.step, p.face, p.ph ?? 0, p.magic);
  const shadow = air > 5 ? "shadow22" : air > 0 ? "shadow28" : "shadow36";
  const sw = air > 5 ? 22 : air > 0 ? 28 : 36;
  const layers: Layer[] = [{ part: shadow, x: OX + CX - sw / 2, y: GROUND - 2 }];
  const rot = p.rot ?? 0;
  if (rot !== 0) {
    const cx = OX + CX;
    const cy = BY + BH / 2 - air;
    const [w, h] = rot % 2 ? [BH, BW] : [BW, BH];
    layers.push({ part: body, x: cx - w / 2, y: cy - h / 2, rot });
    return layers;
  }
  const fy = BY + BH - 2 - Math.min(air, p.feetUp ?? air);
  const arm = (side: "L" | "R", ps: ArmPose): Layer => {
    const [dx, dy] = (side === "L" ? ARM_L : ARM_R)[ps];
    const a = armPart(dx, dy);
    const sx = side === "L" ? OX + 0 : OX + 35;
    return { part: a.name, x: sx - a.ax, y: by + NECK - a.ay };
  };
  layers.push(arm("R", p.armR ?? "rest"));
  layers.push({ part: "foot", x: OX + 5, y: fy }, { part: "foot", x: OX + 22, y: fy });
  layers.push({ part: body, x: OX, y: by });
  layers.push(arm("L", p.armL ?? "rest"));
  return layers;
}

const f = (ms: number, p: Pose, extra: Partial<Frame> = {}): Frame => ({ ms, layers: pose(p), ...extra });

const VIOLET_SAND = { s: "#b98cff", S: "#7a4fd0", y: "#efe2ff" };
const VIOLET_HALF = { s: "#d9a6d8", S: "#9468a8", y: "#fff0e0" };

/** A swoosh of sparks round the spinning body. */
const swoosh = (a0: number, air: number): Speck[] =>
  Array.from({ length: 7 }, (_, i): Speck => {
    const a = a0 + i * 0.32;
    return [Math.round(OX + CX + Math.cos(a) * 31), Math.round(BY + BH / 2 - air + Math.sin(a) * 31), i < 2 ? "V" : i < 4 ? "v" : "o"];
  });
const dust = (r: number): Speck[] => [
  [OX + CX - 18 - r, GROUND - 1, "h"],
  [OX + CX - 20 - r, GROUND - 3, "W"],
  [OX + CX + 18 + r, GROUND - 1, "h"],
  [OX + CX + 20 + r, GROUND - 3, "W"],
];

// Eyes during the drain: follow the stream down, glance at the board, blink, follow the heap.
const LOOK: Face[] = [
  { eye: "open", px: 1, py: 1 },
  { eye: "open", px: 1, py: 2 },
  { eye: "open", px: 1, py: 2 },
  { eye: "shut" },
  { eye: "open", px: 1, py: 2 },
  { eye: "open", px: 0, py: 1 },
  { eye: "open", px: 0, py: 1, mouth: "smile" },
  { eye: "open", px: 0, py: 1, mouth: "smile" },
  { eye: "open", px: 0, py: 1 },
  { eye: "open", px: 1, py: 2 },
  { eye: "open", px: 1, py: 2 },
  { eye: "open", px: 1, py: 2 },
  { eye: "shut" },
  { eye: "open", px: 1, py: 2 },
  { eye: "open", px: 2, py: 2 },
  { eye: "open", px: 1, py: 2 },
];

const idle: Anim = {
  loop: true,
  frames: [
    ...LOOK.map((face, i) => f(185, { step: i, face, ph: i % 3, bob: i % 4 >= 2 ? 1 : 0, armL: i >= 5 && i <= 7 ? "out" : "rest" })),
    f(260, { step: 16, face: { eye: "wide", px: 1, py: 2, mouth: "o" } }),
    f(240, { step: 16, face: { eye: "open", px: 0, py: 1, mouth: "smirk" }, armL: "out" }),
    f(100, { step: 16, face: { eye: "happy", mouth: "grin" }, bob: 2, armL: "up", armR: "up" }),
    f(80, { step: 16, face: { eye: "happy", mouth: "grin" }, air: 5, armL: "up", armR: "up" }),
    f(70, { step: 16, face: { eye: "happy", mouth: "grin" }, air: 9, rot: 1 }, { specks: swoosh(-2.2, 9) }),
    f(70, { step: 16, face: { eye: "happy", mouth: "grin" }, air: 10, rot: 2, magic: true }, { specks: swoosh(-1.0, 10), pal: VIOLET_HALF }),
    f(70, { step: 0, face: { eye: "happy", mouth: "grin" }, air: 9, rot: 3, magic: true }, { specks: swoosh(0.2, 9), pal: VIOLET_SAND }),
    f(80, { step: 0, face: { eye: "happy", mouth: "grin" }, air: 4, magic: true, armL: "up", armR: "up" }, { pal: VIOLET_SAND }),
    f(90, { step: 0, face: { eye: "happy", mouth: "grin" }, bob: 2, magic: true, armL: "out", armR: "out" }, { pal: VIOLET_HALF, specks: dust(0), shake: [0, 1] }),
    f(130, { step: 0, face: { eye: "open", px: 0, py: 1, mouth: "smile" }, bob: 1, ph: 1 }, { specks: dust(3) }),
    f(200, { step: 0, face: { eye: "open", px: 0, py: 1, mouth: "smirk" }, ph: 2 }),
  ],
};

export const TRICKLE: Character = {
  id: "boss-trickle",
  name: "Trickle",
  w: 80,
  h: GROUND + 4,
  foot: [OX + CX, GROUND],
  palette: PALETTE,
  halo: "#2c2622",
  parts,
  anims: { idle },
};
