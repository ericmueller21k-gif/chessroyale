/**
 * Jefferson's sidekick: a baby giraffe, a town bot that walks the square and plays chess at the park's tables. A big
 * round head with big shiny eyes, stubby ossicones with brown knobs, a short neck (for a giraffe), a round little body,
 * knobbly legs, paler yellow than Jefferson with a few round spots, a plain brown tail tuft, and one small sparkler held
 * up proudly in its near hoof, fizzing. Stands upright like the big guy (it copies him), three-quarters, facing right.
 *
 * Rigging: the head (per mood) and the torso+neck are painted once; the legs, arms and tail are painted from their
 * points, the sparkler's wire from the hoof in the arm's direction, so a pose is a handful of numbers.
 */
import { canvas, ellipse, inEllipse, inPoly, roundLight, shade, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

type Pt = readonly [number, number];

const PALETTE = {
  k: "#24140a", // outline
  d: "#c99540", // baby yellow, dark to light (paler than Jefferson)
  c: "#e9bd5c",
  C: "#f8db86",
  h: "#fff2bf",
  o: "#d08a46", // soft round spots
  O: "#a8642e",
  u: "#fff7e2", // cream: muzzle, belly
  U: "#efd6a6",
  b: "#7c4b27", // hooves, horn knobs, tuft
  B: "#4d2b13",
  N: "#a46d3c",
  s: "#1d1622", // pupils
  t: "#ffffff", // eye whites, shine
  p: "#f49a8c", // blush
  m: "#6e2616", // mouth
  q: "#ec6a78",
  l: "#9a6638", // stool wood
  L: "#64401f",
  y: "#fff7b8", // sparks: core to rim
  Y: "#ffd23a",
  f: "#ff9a1f",
  F: "#f2541b",
  x: "#ffffff",
  w: "#a4a4b0", // sparkler wire
  W: "#5c5c66",
  g: "#b8b0b8", // smoke
  G: "#7d7580",
  j: "#7fd3ff", // sweat, a tear
  z: "#0d0e12", // ground shadow
} as const;

function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, y) =>
    [...row].forEach((k, i) => {
      if (k === ".") return;
      if (cv[y0 + y]?.[x0 + i] === undefined) return;
      cv[y0 + y]![x0 + i] = k;
    }),
  );
}

const roundSpot = (cv: Canvas, cx: number, cy: number, r: number) => {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const k = cv[y]?.[x];
      if (!k || !"dcCh".includes(k)) continue;
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) cv[y]![x] = k === "d" ? "O" : "o";
    }
};

// ---- Head.

type Mood = "happy" | "blink" | "think" | "look" | "laugh" | "wow" | "hurt" | "smug" | "rattled" | "sad" | "out";
interface EyeLook {
  lid?: number;
  px?: number;
  py?: number;
  shut?: "line" | "arc" | "pinch" | "x";
  tiny?: boolean;
}

/** A big round eye, `w` x `h`, its own dark rim: a white, a big dark pupil with a shine, an eyelid coming down. */
function eye(w: number, h: number, look: EyeLook): string[] {
  const cv = canvas(w, h);
  const mid = Math.floor(h / 2) + 1;
  if (look.shut) {
    for (let x = 0; x < w; x++) {
      const t = x / Math.max(1, w - 1);
      if (look.shut === "line") cv[mid + Math.round(Math.sin(Math.PI * t) * 1)]![x] = "k";
      else if (look.shut === "arc") cv[mid - Math.round(Math.sin(Math.PI * t) * 1.6)]![x] = "k";
      else if (look.shut === "pinch") cv[mid + Math.round((t < 0.5 ? t : 1 - t) * 3) - 1]![x] = "k";
      else {
        cv[1 + Math.round(t * (h - 3))]![x] = "k";
        cv[h - 2 - Math.round(t * (h - 3))]![x] = "k";
      }
    }
    return toGrid(cv);
  }
  const inside = inEllipse(w / 2, h / 2, w / 2, h / 2);
  const lidY = (look.lid ?? 0) * (h - 1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      cv[y]![x] = edge ? "k" : y + 0.5 < lidY ? "C" : y + 0.5 < lidY + 1 && lidY > 0 ? "k" : "t";
    }
  // The pupil: big (tiny when rattled), where it looks, only on the white.
  const pw = look.tiny ? 2 : w - 3;
  const ph = look.tiny ? 2 : h - 3;
  const px0 = Math.round((w - pw) / 2 + (look.px ?? 0) * ((w - pw) / 2 - 0.6));
  const py0 = Math.round((h - ph) / 2 + (look.py ?? 0) * ((h - ph) / 2 - 0.6));
  for (let y = 0; y < ph; y++)
    for (let x = 0; x < pw; x++) {
      const X = px0 + x;
      const Y = py0 + y;
      if (cv[Y]?.[X] !== "t") continue;
      // round off the pupil's corners
      if (!look.tiny && (x === 0 || x === pw - 1) && (y === 0 || y === ph - 1)) continue;
      cv[Y]![X] = "s";
    }
  // The shine: two pixels at the top left of the pupil.
  if (!look.tiny) {
    for (const [dx, dy] of [[1, 1], [2, 1]] as const) if (cv[py0 + dy]?.[px0 + dx] === "s") cv[py0 + dy]![px0 + dx] = "t";
  }
  return toGrid(cv);
}

const FACES: Record<Mood, { near: EyeLook; far?: EyeLook; mouth: string; brow?: "up" | "worried"; blush?: boolean; tear?: boolean }> = {
  happy: { near: { px: 0.6, py: 0.1 }, mouth: "smile", blush: true },
  blink: { near: { shut: "line" }, mouth: "smile", blush: true },
  think: { near: { px: 0.4, py: -1, lid: 0.15 }, mouth: "flat" },
  look: { near: { px: 1, py: 0.8, lid: 0.25 }, mouth: "flat", blush: true },
  laugh: { near: { shut: "arc" }, mouth: "open", blush: true },
  wow: { near: { px: 0.8, py: -0.2 }, mouth: "o", blush: true },
  hurt: { near: { shut: "pinch" }, mouth: "wavy" },
  smug: { near: { lid: 0.5, px: 1, py: 0.5 }, mouth: "smirk", brow: "up", blush: true },
  rattled: { near: { tiny: true, px: 0, py: 0 }, mouth: "wavy", brow: "worried" },
  sad: { near: { lid: 0.35, px: 0.3, py: 1 }, mouth: "sad", brow: "worried", tear: true },
  out: { near: { shut: "x" }, mouth: "wavy" },
};

const MOUTHS: Record<string, readonly string[]> = {
  smile: ["k...k", ".kkk."],
  open: ["kkkkk", "kmmmk", ".kqk."],
  o: [".kk.", "kmmk", ".kk."],
  flat: [".kkk"],
  smirk: ["....k", "kkkk."],
  wavy: [".k.k.", "k.k.k"],
  sad: [".kkk.", "k...k"],
};

const HEAD_W = 26;
const HEAD_H = 22;
/** Where the neck's top meets the head grid. */
const HEAD_SOCKET: Pt = [11, 20];

function head(mood: Mood): Part {
  const cv = canvas(HEAD_W, HEAD_H);
  // Ears: the far one out back (our left), the near one up behind the horns.
  const earL = inPoly([[0.3, 9.5], [5, 8], [6.5, 11.5], [2, 12.6]]);
  const earR = inPoly([[15, 5.8], [20.5, 1.6], [22.6, 2.6], [19, 7.8]]);
  shade(cv, earL, "dcC", (_, y) => 1.1 - 0.06 * y);
  shade(cv, earR, "dcC", (x, y) => 1.15 - 0.08 * y - 0.01 * x);
  for (const [x, y] of [[2, 10], [3, 10], [4, 11], [19, 3], [18, 4], [20, 3]] as const) cv[y]![x] = "U";
  // Stubby ossicones with round brown knobs.
  for (const hx of [8, 13]) {
    for (let y = 2; y <= 5; y++) {
      cv[y]![hx] = "C";
      cv[y]![hx + 1] = "c";
    }
    stamp(cv, [".Nb.", "NbbB", ".bB."], hx - 1, 0);
  }
  // A big round skull, a short round muzzle.
  const skull = inEllipse(11, 12.2, 8.6, 8.2);
  const snout = inEllipse(19, 14.6, 6, 5);
  const inside = (x: number, y: number) => skull(x, y) || snout(x, y);
  shade(cv, inside, "dcCh", roundLight(11, 10, 12, 10, 0.17));
  roundSpot(cv, 4.6, 15.2, 1.6);
  roundSpot(cv, 11, 7, 1.2);
  roundSpot(cv, 7, 19, 1.1);
  shade(cv, (x, y) => inside(x, y) && inEllipse(19.8, 15, 5.6, 4.6)(x, y), "Uuu", (x, y) => 1.05 - 0.08 * (y - 11) - 0.02 * (x - 16));
  cv[12]![22] = "N";
  cv[12]![23] = "B";
  const f = FACES[mood];
  // The near eye big; the far eye smaller by the bridge of the nose.
  stamp(cv, eye(7, 8, f.near), 5, 8);
  stamp(cv, eye(4, 6, f.far ?? { ...f.near, px: f.near.px ?? 0, tiny: f.near.tiny }), 14, 8);
  if (f.brow === "up") stamp(cv, [".kk.", "k..."], 6, 6);
  if (f.brow === "worried") stamp(cv, ["kk..", "..kk"], 6, 6);
  if (f.blush) stamp(cv, ["pp"], 9, 17);
  if (f.tear) stamp(cv, ["j", "j"], 7, 16);
  stamp(cv, MOUTHS[f.mouth]!, 18, f.mouth === "flat" ? 17 : 16);
  return { grid: toGrid(cv) };
}

// ---- Torso and neck, one part.

/** Where the torso grid sits on the frame at rest, and the neck's top on that grid. */
const BODY_AT: Pt = [17, 27];
const NECK_TOP: Pt = [13, 0];
const body: Part = (() => {
  const cv = canvas(20, 23);
  const neck = inPoly([[9.6, 12], [10.4, 0.5], [15.4, 0.5], [16, 12]]);
  shade(cv, neck, "dcCh", (x) => 0.95 - 0.07 * (x - 10));
  const torso = inEllipse(9.6, 15.2, 8.6, 7.6);
  shade(cv, torso, "dcCh", roundLight(8, 12, 10, 9, 0.12));
  // A short brown mane down the back of the neck.
  for (let y = 1; y <= 8; y++) {
    const row = cv[y]!;
    const x = row.findIndex((k) => k !== ".");
    if (x >= 0) row[x] = y % 3 === 0 ? "b" : "N";
  }
  roundSpot(cv, 4.6, 12.4, 1.7);
  roundSpot(cv, 9.6, 10, 1.3);
  roundSpot(cv, 3.6, 18, 1.4);
  roundSpot(cv, 13, 5, 1.1);
  roundSpot(cv, 8, 18, 1.1);
  shade(cv, (x, y) => torso(x, y) && inEllipse(13.6, 17, 4.4, 5.2)(x, y), "Uuu", (x, y) => 1.05 - 0.05 * (x - 10) - 0.03 * (y - 12));
  return { grid: toGrid(cv) };
})();

// ---- Limbs.

const PARTS: Record<string, Part> = { body };
const MOODS: readonly Mood[] = ["happy", "blink", "think", "look", "laugh", "wow", "hurt", "smug", "rattled", "sad", "out"];
for (const m of MOODS) PARTS[`head:${m}`] = head(m);

PARTS.shadow = (() => {
  const cv = canvas(26, 3);
  ellipse(cv, 13, 1.5, 13, 1.5, "z");
  return { grid: toGrid(cv), outline: false };
})();
PARTS.hoof = { grid: ["bNbb", "BBBB"] };
PARTS.tuft = { grid: [".N.", "bNb", "bbB", ".B."] };
PARTS.stool = {
  grid: [
    "lllllllllllllllll",
    "LLLLLLLLLLLLLLLLL",
    "..lL.........lL..",
    "..lL.........lL..",
    "..lL.........lL..",
    "..lLLLLLLLLLLlL..",
    "..lL.........lL..",
    "..lL.........lL..",
    ".lLL........lLL..",
  ],
};

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny };
}

/** A limb through `pts`, `r` thick, a knobbly knee/elbow (`knob` across, at the middle point), a brown hoof at the end (`hoof`). */
function limb(kind: string, pts: readonly Pt[], r: number, opts: { knob?: number; hoof?: number; dim?: number } = {}): { name: string; at: Pt } {
  const name = `${kind}:${pts.map((p) => p.join(",")).join(";")}`;
  const at = LIMB_AT.get(name);
  if (at) return { name, at };
  const pad = Math.ceil(Math.max(r, opts.knob ?? 0, opts.hoof ?? 0)) + 1;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - pad;
  const y0 = Math.floor(Math.min(...ys)) - pad;
  const w = Math.ceil(Math.max(...xs)) + pad - x0 + 1;
  const h = Math.ceil(Math.max(...ys)) + pad - y0 + 1;
  const cv = canvas(w, h);
  const end = pts[pts.length - 1]!;
  const mid = pts[1]!;
  const dim = opts.dim ?? 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p: Pt = [x0 + x + 0.5, y0 + y + 0.5];
      let best = { d: Infinity, nx: 0, ny: 0 };
      for (let i = 0; i + 1 < pts.length; i++) {
        const n = nearest(p, pts[i]!, pts[i + 1]!);
        if (n.d < best.d) best = n;
      }
      const de = Math.hypot(p[0] - end[0], p[1] - end[1]);
      if (opts.hoof && de <= opts.hoof) {
        const lt = 0.62 - 0.42 * ((p[0] - end[0]) / opts.hoof) - 0.5 * ((p[1] - end[1]) / opts.hoof) - dim;
        cv[y]![x] = "BbN"[Math.max(0, Math.min(2, Math.floor(lt * 3)))]!;
        continue;
      }
      const dk = Math.hypot(p[0] - mid[0], p[1] - mid[1]);
      if (opts.knob && dk <= opts.knob && dk < best.d + 1.5) {
        const lt = 0.66 - 0.42 * ((p[0] - mid[0]) / opts.knob) - 0.5 * ((p[1] - mid[1]) / opts.knob) - dim;
        cv[y]![x] = "dcCh"[Math.max(0, Math.min(3, Math.floor(lt * 4)))]!;
        continue;
      }
      if (best.d > r) continue;
      const lt = 0.62 - 0.42 * (best.nx / r) - 0.5 * (best.ny / r) - dim;
      cv[y]![x] = "dcCh"[Math.max(0, Math.min(3, Math.floor(lt * 4)))]!;
    }
  PARTS[name] = { grid: toGrid(cv) };
  LIMB_AT.set(name, [x0, y0]);
  return { name, at: [x0, y0] };
}
const LIMB_AT = new Map<string, Pt>();

/** A sparkler's wire from the hoof to its burning tip. */
function wire(from: Pt, to: Pt): { name: string; at: Pt } {
  const name = `wire:${from.join(",")}:${to.join(",")}`;
  const x0 = Math.min(from[0], to[0]);
  const y0 = Math.min(from[1], to[1]);
  if (!PARTS[name]) {
    const cv = canvas(Math.abs(to[0] - from[0]) + 1, Math.abs(to[1] - from[1]) + 1);
    let [x, y] = [from[0] - x0, from[1] - y0];
    const [x1, y1] = [to[0] - x0, to[1] - y0];
    const dx = Math.abs(x1 - x);
    const dy = -Math.abs(y1 - y);
    const sx = x < x1 ? 1 : -1;
    const sy = y < y1 ? 1 : -1;
    let err = dx + dy;
    const path: Pt[] = [];
    for (;;) {
      path.push([x, y]);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) (err += dy), (x += sx);
      if (e2 <= dx) (err += dx), (y += sy);
    }
    path.forEach(([px, py], i) => (cv[py]![px] = i >= path.length - 2 ? "f" : i % 3 === 2 ? "W" : "w"));
    PARTS[name] = { grid: toGrid(cv) };
  }
  return { name, at: [x0, y0] };
}

// ---- Poses.

const W = 68;
/** Headroom above the drawing space (for hops), added to every frame. */
const TOP = 5;
const H = 64 + TOP;
/** The bottom row of the hooves. */
const FOOT_Y = 58;

interface ArmSpec {
  pts: readonly [Pt, Pt, Pt];
  dir: Pt;
  len: number;
}
const SH_N: Pt = [32, 41];
/** The near arm, the sparkler in its hoof. */
const ARMS = {
  up: { pts: [SH_N, [39, 44], [45, 38]], dir: [0.35, -1], len: 9 },
  high: { pts: [SH_N, [41, 40], [48, 33]], dir: [0.1, -1], len: 9 },
  wave1: { pts: [SH_N, [41, 40], [47, 33]], dir: [-0.1, -1], len: 9 },
  wave2: { pts: [SH_N, [40, 41], [47, 35]], dir: [0.5, -1], len: 9 },
  wave3: { pts: [SH_N, [40, 42], [47, 38]], dir: [1, -0.55], len: 9 },
  point: { pts: [SH_N, [39, 43], [45, 40]], dir: [1, -0.35], len: 8 },
  low: { pts: [SH_N, [35, 47], [40, 48]], dir: [1, 0.25], len: 6 },
  lap: { pts: [SH_N, [36, 46], [41, 44]], dir: [0.8, -0.6], len: 6 },
  down: { pts: [SH_N, [36, 47], [41, 49]], dir: [0.8, 0.6], len: 5 },
} satisfies Record<string, ArmSpec>;
type ArmName = keyof typeof ARMS;
/** The far arm, behind the body (its hoof peeks out). */
const FAR = {
  rest: [[25, 41], [22, 46], [21, 50]],
  up: [[25, 40], [21, 35], [19, 29]],
  out: [[25, 41], [19, 43], [15, 40]],
} satisfies Record<string, readonly [Pt, Pt, Pt]>;
type FarName = keyof typeof FAR;

type Legs = { far: Pt; near: Pt } | "sit" | "floor";

interface Pose {
  bob?: number;
  crouch?: number;
  air?: number;
  dx?: number;
  mood?: Mood;
  headDx?: number;
  headDy?: number;
  arm?: ArmName;
  far?: FarName;
  legs?: Legs;
  lit?: boolean;
  /** The sparkler's spray size. */
  spark?: number;
  stool?: boolean;
}

const STAND: Legs = { far: [22, FOOT_Y], near: [31, FOOT_Y] };

function build(p: Pose): { layers: Layer[]; tip: Pt | null } {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const sitting = p.legs === "sit" || p.legs === "floor";
  const crouch = (p.crouch ?? 0) + (p.legs === "sit" ? 1 : p.legs === "floor" ? 8 : 0);
  const bodyY = crouch + (p.bob ?? 0) - air;
  const hips = crouch - air;
  const at = (part: string, x: number, y: number): Layer => ({ part, x: x + dx, y });
  const L = (l: { name: string; at: Pt }) => at(l.name, l.at[0], l.at[1]);
  const down = (pts: readonly Pt[]): Pt[] => pts.map((q): Pt => [q[0], q[1] + bodyY + BODY_AT[1] - 29]);
  // Legs.
  const hipF: Pt = [23, 48 + hips];
  const hipN: Pt = [30, 48 + hips];
  let legF: Pt[];
  let legN: Pt[];
  if (p.legs === "sit") {
    legF = [[26, 49], [34, 50], [34, 55]];
    legN = [[29, 49], [38, 50], [38, 55]];
  } else if (p.legs === "floor") {
    legF = [[25, 54], [33, 53], [37, 56]];
    legN = [[30, 54], [38, 53], [43, 56]];
  } else {
    const lg = (p.legs as { far: Pt; near: Pt } | undefined) ?? (STAND as { far: Pt; near: Pt });
    const ank = (f: Pt): Pt => [f[0], f[1] - 2 - air];
    const knee = (hip: Pt, f: Pt, out: number): Pt => [Math.round((hip[0] + f[0]) / 2 + out), Math.round((hip[1] + f[1] - air) / 2)];
    legF = [hipF, knee(hipF, lg.far, -1), ank(lg.far)];
    legN = [hipN, knee(hipN, lg.near, 1), ank(lg.near)];
  }
  const lf = limb("leg", legF, 1.6, { knob: 2.3, dim: 0.12 });
  const ln = limb("leg", legN, 1.6, { knob: 2.3 });
  const hoofAt = (a: Pt): Layer => at("hoof", a[0] - 1, a[1] + 1);
  // Tail with a plain tuft.
  const tailEnd: Pt = p.legs === "sit" ? [12, 54] : p.legs === "floor" ? [12, 57] : [11, 50 + hips];
  const tail = limb("tail", [[19, 45 + hips], [14, 47 + hips], tailEnd], 0.8);
  // Arms.
  const spec: ArmSpec = ARMS[p.arm ?? "up"];
  const pts = down(spec.pts);
  const arm = limb("arm", pts, 1.5, { knob: 1.9, hoof: 2.2 });
  const farArm = limb("farArm", down(FAR[p.far ?? "rest"]), 1.4, { knob: 1.7, hoof: 2, dim: 0.15 });
  const fist = pts[2]!;
  const n = Math.hypot(spec.dir[0], spec.dir[1]);
  const from: Pt = [Math.round(fist[0] + (spec.dir[0] / n) * 2), Math.round(fist[1] + (spec.dir[1] / n) * 2)];
  const tipL: Pt = [Math.round(fist[0] + (spec.dir[0] / n) * (spec.len + 2)), Math.round(fist[1] + (spec.dir[1] / n) * (spec.len + 2))];
  const wr = wire(from, tipL);
  const hx = BODY_AT[0] + NECK_TOP[0] - HEAD_SOCKET[0] + (p.headDx ?? 0);
  const hy = BODY_AT[1] + NECK_TOP[1] - HEAD_SOCKET[1] + bodyY + (p.headDy ?? 0);
  const layers: Layer[] = [
    at("shadow", 15, FOOT_Y),
    ...(p.stool ? [at("stool", 13, 50)] : []),
    at("tuft", tailEnd[0] - 1, tailEnd[1] - 1),
    L(tail),
    L(farArm),
    L(lf),
    hoofAt(legF[2]!),
    ...(sitting ? [] : [L(ln), hoofAt(legN[2]!)]),
    at("body", BODY_AT[0], BODY_AT[1] + bodyY),
    ...(sitting ? [L(ln), hoofAt(legN[2]!)] : []),
    at(`head:${p.mood ?? "happy"}`, hx, hy),
    L(wr),
    L(arm),
  ];
  return { layers, tip: p.lit === false ? null : [tipL[0] + dx, tipL[1]] };
}

// ---- Sparks and specks.

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}

/** A small sparkler head: a white core, four short rays (crossed or diagonal) and a few loose sparks, seeded. */
function sparkSpray([x, y]: Pt, seed: number, size = 0.7): Speck[] {
  const rnd = seeded(seed + 11);
  const out: Speck[] = [];
  const diag = seed % 2 === 1;
  const reach = Math.max(1, Math.round(1 + size * 2 + rnd() * 1.2));
  const rays: readonly Pt[] = diag ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of rays) for (let d = 1; d <= reach; d++) out.push([x + dx * d, y + dy * d, d === reach ? "f" : d === 1 ? "y" : "Y"]);
  const nSp = Math.round(3 + 6 * size);
  for (let i = 0; i < nSp; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 2.5 + rnd() * 4 * size;
    out.push([Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), d > 4 * size + 1 ? "F" : d > 3.2 ? "f" : "Y"]);
  }
  out.push([x, y, "x"], [x, y - 1, "y"], [x + 1, y, "y"]);
  return out;
}

function wisps([x, y]: Pt, t: number, n = 3): Speck[] {
  return Array.from({ length: n }, (_, i): Speck[] => {
    const yy = y - ((t * 2 + i * 4) % 12);
    const xx = x + Math.round(Math.sin(t * 0.9 + i * 2) * 1.5);
    return [[xx, yy, i % 2 ? "g" : "G"], [xx + 1, yy - 1, "G"]];
  }).flat();
}

/** Thought dots rising by its head. */
const thought = (n: number): Speck[] =>
  ([[46, 12], [49, 8], [53, 4]] as const).slice(0, n).flatMap(([x, y], k): Speck[] => {
    const out: Speck[] = [];
    const s = k + 1;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (!(s === 3 && (dx !== 1) && (dy !== 1))) out.push([x + dx, y - dy, "u"]);
    return out;
  });

/** Sweat flying off. */
const sweat = (i: number): Speck[] => {
  const t = i % 3;
  return [
    [16 - t, 12 + t, "x"],
    [16 - t, 13 + t, "j"],
    [15 - t, 13 + t, "j"],
    [20 - t, 5 + t, "x"],
    [20 - t, 6 + t, "j"],
  ];
};

/** Twinkles round it (a capture, a win). */
const twinkles = (i: number): Speck[] =>
  ([[8, 18], [54, 16], [12, 34], [56, 34], [6, 46]] as const).flatMap(([x, y], k): Speck[] => {
    if ((i + k) % 3 === 0) return [];
    const big = (i + k) % 3 === 1;
    return big ? [[x, y, "x"], [x - 1, y, "Y"], [x + 1, y, "Y"], [x, y - 1, "Y"], [x, y + 1, "Y"]] : [[x, y, "Y"]];
  });

const FLASH: Record<string, string> = { d: "#f0c070", c: "#ffe4a0", C: "#fff4cc", h: "#ffffff", o: "#efb07a", O: "#d08a50" };

const f = (ms: number, p: Pose, extra: Partial<Frame> = {}, seed = 0): Frame => {
  const b = build(p);
  const sparks = b.tip ? sparkSpray(b.tip, seed * 7 + 3, p.spark ?? 0.7) : [];
  return {
    ms,
    ...extra,
    layers: b.layers.map((l) => ({ ...l, y: l.y + TOP })),
    specks: [...sparks, ...(extra.specks ?? [])].map(([x, y, k]): Speck => [x, y + TOP, k]),
  };
};

// ---- Animations.

/** Idle (~3 s): a gentle bob, a blink, the sparkler fizzing every frame. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 20 }, (_, i) => {
    const bob = [0, 0, 0, 1, 1, 1, 0, 0, 0, 1][i % 10]!;
    const mood: Mood = i === 7 || i === 16 ? "blink" : "happy";
    return f(150, { bob, mood, headDy: i % 10 === 4 ? 1 : 0 }, {}, i);
  }),
};

/** Walk (0.6 s): a little trot, knobbly knees up, head bobbing, the sparkler held up. */
const WALK: readonly [Pt, Pt, number][] = [
  [[19, FOOT_Y], [34, FOOT_Y], 1],
  [[23, FOOT_Y - 3], [31, FOOT_Y], 0],
  [[28, FOOT_Y - 1], [27, FOOT_Y], 0],
  [[33, FOOT_Y], [20, FOOT_Y], 1],
  [[30, FOOT_Y], [24, FOOT_Y - 3], 0],
  [[26, FOOT_Y], [29, FOOT_Y - 1], 0],
];
const walk: Anim = {
  loop: true,
  frames: WALK.map(([far, near, bob], i) => f(100, { legs: { far, near }, bob, headDy: bob ? 0 : -1, arm: "up" }, i % 3 === 0 ? { cue: "step" } : {}, i)),
};

/** Sit: on a stool at a chess table, facing the board, the sparkler lowered and fizzing small, a slow blink, a thoughtful look down. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const mood: Mood = i === 9 ? "blink" : i >= 12 ? "think" : "look";
    return f(i === 9 ? 160 : 200, { stool: true, legs: "sit", arm: "lap", spark: 0.35, mood, bob: i % 8 >= 4 ? 1 : 0, headDx: i >= 12 ? 0 : 1 }, {}, i);
  }),
};

/** Wave (~1.2 s): up goes the sparkler, a little arc back and forth, then back to idle. */
const wave: Anim = {
  loop: false,
  frames: (["high", "wave1", "wave2", "wave3", "wave2", "wave1", "wave2", "wave3", "up"] as const).map((arm, i) =>
    f(i === 8 ? 160 : 130, { arm, mood: i === 0 || i === 8 ? "happy" : "laugh", spark: 0.9, headDy: i % 2 && i < 8 ? -1 : 0 }, i === 1 ? { cue: "fizz" } : {}, i),
  ),
};

/** Entrance: hops in, crouches, the sparkler fizzes alight, a proud wave. */
const entrance: Anim = {
  loop: false,
  frames: [
    f(90, { dx: -6, air: 5, arm: "high", lit: false, mood: "laugh", legs: { far: [20, FOOT_Y], near: [33, FOOT_Y] } }, { cue: "boing" }),
    f(90, { dx: -3, air: 3, arm: "high", lit: false, mood: "laugh", legs: { far: [20, FOOT_Y], near: [33, FOOT_Y] } }),
    f(100, { crouch: 2, arm: "up", lit: false, mood: "happy" }, { cue: "step" }),
    f(110, { arm: "up", lit: false, mood: "wow" }),
    f(110, { arm: "up", mood: "wow", spark: 0.4 }, { cue: "fizz" }, 1),
    f(110, { arm: "high", mood: "laugh", spark: 0.9 }, {}, 2),
    f(110, { arm: "wave2", mood: "laugh", spark: 0.9 }, {}, 3),
    f(110, { arm: "wave3", mood: "laugh", spark: 0.9 }, {}, 4),
    f(260, { mood: "happy" }, {}, 5),
  ],
};

/** Thinking: eyes rolled up, a slow sway, thought dots popping up one by one. */
const thinking: Anim = {
  loop: true,
  frames: [0, 1, 2, 3].flatMap((nDots) =>
    [0, 1, 2].map((i) => f(160, { mood: "think", bob: i === 1 ? 1 : 0, headDx: nDots % 2 ? 0 : -1, far: "rest" }, { specks: thought(nDots) }, nDots * 3 + i)),
  ),
};

/** Move: a little hop toward the board and a point of the sparkler at it. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { crouch: 2, mood: "happy" }, {}, 1),
    f(90, { air: 3, dx: 1, arm: "high", mood: "wow" }, {}, 2),
    f(100, { crouch: 1, dx: 2, arm: "point", mood: "laugh", spark: 1 }, { cue: "fizz" }, 3),
    f(140, { dx: 2, arm: "point", mood: "happy", spark: 0.9 }, {}, 4),
    f(110, { dx: 1, mood: "happy" }, {}, 5),
    f(140, { mood: "happy" }, {}, 6),
  ],
};

/** Capture: a happy bounce, the sparkler up high, both hooves up, twinkles. */
const capture: Anim = {
  loop: false,
  frames: [
    f(90, { crouch: 2, mood: "wow" }, {}, 1),
    ...Array.from({ length: 8 }, (_, i) =>
      f(90, { mood: "laugh", arm: "high", far: "up", air: [0, 3, 5, 3, 0, 3, 5, 3][i]!, crouch: i % 4 === 0 ? 1 : 0, spark: 1.1 }, { specks: twinkles(i), cue: i === 0 ? "crackle" : undefined }, i + 2),
    ),
    f(160, { mood: "happy" }, {}, 12),
  ],
};

/** Hurt: a flash, eyes squeezed, a flinch back; then a brave little smile. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { crouch: 2, mood: "hurt", arm: "down", spark: 0.3 }, { cue: "poof", pal: FLASH, shake: [1, 0] }, 1),
    f(80, { crouch: 2, mood: "hurt", arm: "down", dx: -1, spark: 0.3 }, { shake: [-1, 0] }, 2),
    f(100, { crouch: 1, mood: "hurt", arm: "down", dx: -1, spark: 0.3 }, {}, 3),
    f(120, { mood: "rattled", dx: -1, spark: 0.5 }, {}, 4),
    f(160, { mood: "happy" }, {}, 5),
  ],
};

/** Check: a gasp, then two excited jabs of the sparkler at the board, sparks flying bigger. */
const check: Anim = {
  loop: false,
  frames: [
    f(100, { mood: "wow", arm: "high", crouch: 1 }, {}, 1),
    f(100, { mood: "wow", arm: "point", dx: 2, spark: 1.3 }, { cue: "whoosh" }, 2),
    f(90, { mood: "laugh", arm: "point", dx: 1, spark: 1 }, {}, 3),
    f(100, { mood: "wow", arm: "high", crouch: 1 }, {}, 4),
    f(100, { mood: "wow", arm: "point", dx: 2, spark: 1.3 }, { cue: "whoosh" }, 5),
    f(140, { mood: "laugh", arm: "point", dx: 1, spark: 1 }, {}, 6),
    f(160, { mood: "smug" }, {}, 7),
  ],
};

/** Smug: a brow up, eyes half shut, a little nod, the sparkler fizzing like the big guy's. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "smug", arm: i < 4 ? "up" : "high", bob: i % 4 === 1 ? 1 : 0, headDx: i < 4 ? 0 : 1 }, {}, i)),
};

/** Rattled: tiny pupils, worried brows, shaking, sweat flying, the sparkler sputtering low. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => f(90, { mood: "rattled", arm: "down", far: "rest", dx: i % 2 ? 1 : 0, bob: i % 3 === 1 ? 1 : 0, spark: i % 2 ? 0.25 : 0.4 }, { specks: sweat(i) }, i)),
};

/** Defeat: a flinch, the sparkler fizzles out in smoke, it plops down on its bottom and droops, teary. */
const tipOf = (p: Pose): Pt => build({ ...p, lit: true }).tip!;
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { crouch: 2, mood: "hurt", arm: "down", spark: 0.3 }, { cue: "poof", pal: FLASH, shake: [1, 0] }, 1),
    f(110, { crouch: 1, mood: "out", arm: "down", lit: false }, { specks: wisps(tipOf({ crouch: 1, arm: "down" }), 0) }),
    f(120, { crouch: 3, mood: "out", arm: "down", lit: false, dx: 1 }, { specks: wisps(tipOf({ crouch: 3, arm: "down", dx: 1 }), 1) }),
    f(120, { legs: "floor", mood: "out", arm: "lap", lit: false }, { cue: "thud", shake: [0, 1], specks: wisps(tipOf({ legs: "floor", arm: "lap" }), 2) }),
    f(200, { legs: "floor", mood: "sad", arm: "lap", lit: false, headDy: 1 }, { specks: wisps(tipOf({ legs: "floor", arm: "lap" }), 3) }),
    f(1000, { legs: "floor", mood: "sad", arm: "lap", lit: false, headDy: 1 }, { specks: wisps(tipOf({ legs: "floor", arm: "lap" }), 4, 2) }),
  ],
};

/** Victory: jumping for joy, the sparkler waving high, twinkles all round. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 10 }, (_, i) => {
    const air = [0, 3, 6, 7, 6, 3, 0, 0, 0, 0][i]!;
    const arm: ArmName = i < 6 ? "high" : (["wave1", "wave2", "wave3", "wave2"] as const)[i - 6]!;
    return f(110, { mood: "laugh", arm, far: "up", air, crouch: i === 0 || i === 6 ? 2 : 0, spark: 1.1, headDy: i % 2 ? -1 : 0 }, { specks: twinkles(i), cue: i === 2 ? "fizz" : undefined }, i);
  }),
};

export const SIDEKICK_JEFFERSON: Character = {
  id: "sidekick-jefferson-opus-medium",
  name: "Jefferson's sidekick",
  w: W,
  h: H,
  foot: [28, FOOT_Y + 1 + TOP],
  palette: PALETTE,
  halo: "#2e2218",
  parts: PARTS,
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, walk, sit, wave },
};
