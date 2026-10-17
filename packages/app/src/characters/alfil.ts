/**
 * Alfil, the woolly mammoth boss (the chess bishop's ancestor: in old Persian and Arabic chess the piece was the
 * elephant, the alfil). After Eric's reference picture, redrawn: a shaggy brown mammoth up on his hind legs in a
 * fighting stance, his front legs raised like fists (pale toenails), big curved ivory tusks, angry brows, his trunk
 * curling at its tip, a tufted tail; a red and blue Nettipattam on his brow and a matching caparison over his back,
 * diamond patterns, gold trim and gold tassels. Drawn three-quarters on, facing our left as in the reference, light
 * from the top left.
 *
 * A still for Eric's review (Oct 17): one pose, idle frame 0. Not in the roster or the game yet; his poses,
 * animations, powers and sounds come after Eric's edits.
 *
 * Rigging, as the other bosses: the head (with its Nettipattam), the ears, the body, the caparison, the feet and the
 * shadow are painted once; the legs, the trunk, the tusks and the tail from their points, so a new pose is a few
 * numbers. Fur is shaggy: its locks hang a pixel or two below every lower edge and stick out along the sides.
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "./paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part } from "./sprite.ts";

export const ALFIL_PALETTE: Record<string, string> = {
  k: "#1d120d", // outline
  a: "#4a2a17", // fur, dark to light (the reference's warm, reddish brown)
  b: "#6f4124",
  c: "#94592f",
  d: "#b8743f",
  e: "#d39257",
  f: "#ebbb82", // the lightest locks, catching the light
  T: "#fffaea", // ivory (tusks, toenails): highlight, light, mid, shadow
  t: "#ece0c1",
  U: "#c9b78f",
  V: "#9a8762",
  w: "#fbf7ee", // eye whites, and the glint in his pupils
  v: "#ffffff",
  x: "#0c0806", // pupils, brows
  R: "#e0312a", // the Nettipattam and the caparison: red, its shade
  r: "#a51d24",
  B: "#2f63cc", // blue, its shade
  N: "#1d3d8c",
  Y: "#f2c14e", // gold (the game's gold), its light, its shade
  y: "#ffe58a",
  O: "#b4840f",
  z: "#0d0e12", // ground shadow
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;
const FUR = "abcde";
const IVORY = "VUtT";

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
/** A steady pseudo-random number in [0, 1) for a pixel (the fur's strands and locks: the same every time). */
function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x + 1013, 374761393) ^ Math.imul(y + 7919, 668265263) ^ Math.imul(seed + 31, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * A shape with shaggy edges: locks of hair hang one or two pixels below every lower edge (two pixels wide, pointed),
 * and stick out a pixel, slanting down, along the sides every third row. Top edges stay smooth (the fur lies flat).
 */
function shaggy(inside: Inside, seed: number, long = 2): Inside {
  return (x, y) => {
    if (inside(x, y)) return true;
    const lock = Math.floor((x + seed) / 2);
    const len = Math.min(long, Math.floor(hash(lock, 0, seed) * (long + 1)));
    for (let d = 1; d <= len; d++) if (inside(x, y - d) && (d < len || (x + seed) % 2 === 0)) return true;
    return (y + seed) % 3 === 0 && (inside(x + 1, y - 1) !== inside(x - 1, y - 1)) && !inside(x, y - 1);
  };
}

/**
 * Fur: banded by the light (dark to light), with short darker strands here and there in the lit parts and the locks
 * that hang past the shape (`core`) a shade darker; the brightest strands catch the light (`f`).
 */
function furKey(core: Inside, light: (x: number, y: number) => number, seed: number, r = FUR): Key {
  return (x, y) => {
    const l = light(x, y);
    let i = Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)));
    if (!core(x, y)) i = Math.max(0, i - 1);
    else if (i >= 2 && hash(x, Math.floor((y + (x % 3)) / 3), seed) < 0.16) i -= 1;
    else if (i === r.length - 1 && hash(x, y, seed + 9) < 0.12) return "f";
    return r[i]!;
  };
}

/** A part painted in drawing space: its canvas covers (x0, y0) to (x0 + w, y0 + h). */
function painted(x0: number, y0: number, w: number, h: number, draw: (F: (inside: Inside, key: Key) => void, S: (rows: readonly string[], x: number, y: number) => void) => void): { part: Part; at: Pt } {
  const cv: Canvas = canvas(w, h);
  const F = (inside: Inside, key: Key) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
  };
  const S = (rows: readonly string[], sx: number, sy: number) =>
    rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        const X = sx + i - x0;
        const Y = sy + j - y0;
        if (k !== "." && cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
      }),
    );
  draw(F, S);
  return { part: { grid: toGrid(cv) }, at: [x0, y0] };
}

/** How deep a pixel is inside a shape: 0 on its edge, 1 a pixel in, ... (4-neighbors), up to `max`. */
function depthIn(inside: Inside, x: number, y: number, max: number): number {
  for (let d = 0; d < max; d++) if (!inside(x + d + 1, y) || !inside(x - d - 1, y) || !inside(x, y + d + 1) || !inside(x, y - d - 1)) return d;
  return max;
}

/** A diamond of the Nettipattam's pattern: gold rim, blue, a red heart. */
const DIAMOND = ["..Y..", ".YBY.", "YBRBY", ".YBO.", "..O.."];
/** A gold tassel, hanging from its top pixel: a cord, then the fringe. */
const TASSEL = [".O.", "yYO", "yYO"];

// ---- The head: skull, the shaggy crown, the face, and the Nettipattam on his brow. Drawing space: the ground at y 68.

/** The headpiece's outline on his brow: a band across, its lower edge dipping to a point between his eyes. */
const NETTI: Pt[] = [[17.6, 7.6], [20, 4.6], [27, 3.6], [34.2, 4], [36.8, 6.6], [36, 9], [31, 10.2], [27.2, 12.4], [23, 10.6], [18.2, 10]];

function head(): { part: Part; at: Pt } {
  return painted(14, -1, 26, 30, (F, S) => {
    const skull = (x: number, y: number) => inEllipse(26.5, 12.5, 11, 11)(x, y) || inPoly([[16.5, 14], [36.5, 14], [34, 26], [19.5, 26.5]])(x, y);
    // The crown: a shaggy tuft standing up on top of his head, wider than the headpiece.
    const crown = inPoly([[16.4, 9], [15.6, 4.2], [18.6, 5.4], [18.8, 1.4], [22, 3.4], [23.8, -0.4], [26.6, 2.6], [29.2, 0], [30.8, 3.2], [33.8, 1.2], [34.2, 4.6], [37.6, 4.2], [36.8, 9]]);
    const all = (x: number, y: number) => skull(x, y) || crown(x, y);
    const light = roundLight(22, 8, 16, 19, 0.2);
    F(shaggy(all, 3, 1), furKey(all, light, 3));
    // His cheeks, darker under the eyes where the trunk starts; the brow ridge catches the light.
    F((x, y) => skull(x, y) && y >= 21 && (x < 22 || x > 31), (x, y) => ramp("bcd", light(x, y)));
    // The Nettipattam: gold rim, red, a blue panel in the middle with a small diamond, tassels along its lower edge.
    const netti = inPoly(NETTI);
    const panel = inPoly([[22, 6.2], [32.4, 6], [30.6, 9], [27.2, 11.2], [23.6, 9.2]]);
    F(netti, (x, y) => {
      const d = depthIn(netti, x, y, 3);
      if (d === 0) return x > 33 || y > 11 ? "O" : "Y";
      if (panel(x, y)) return x > 30 ? "N" : "B";
      return x > 33 ? "r" : "R";
    });
    S(["..Y..", ".YRY.", "YRyRY", ".YRO.", "..O.."], 25, 5);
    for (const [x, y] of [[18, 10], [21.8, 11], [32.2, 10.4], [35.6, 9]] as const) S(TASSEL, Math.round(x) - 1, Math.round(y));
    S([".O.", "yYO", "yYO", ".O."], 26, 12);
    // Angry brows slanting down to his trunk, and the eyes under them glaring at you.
    S(["xx.....", ".xxxx..", "..wwxxx", "..wvxx.", "..wxxw.", "...ww.."], 15, 13);
    S([".....xx", "...xxxx", ".xxxww.", "..vxwww", "..xxwww", "...www."], 29, 13);
  });
}

/** An ear: big and shaggy, darker inside where it turns away. */
function ear(cx: number, cy: number, rx: number, ry: number, seed: number): { part: Part; at: Pt } {
  return painted(Math.floor(cx - rx) - 2, Math.floor(cy - ry) - 1, Math.ceil(rx * 2) + 5, Math.ceil(ry * 2) + 5, (F) => {
    const e = inEllipse(cx, cy, rx, ry);
    const light = roundLight(cx - rx * 0.3, cy - ry * 0.4, rx * 1.3, ry * 1.3, 0.14);
    F(shaggy(e, seed), furKey(e, light, seed));
  });
}

/**
 * His body: a great humped back under the caparison, his chest between his raised front legs. (The reference's breast
 * strap is left out: at this size it hid between his trunk, his near foot and his thigh, a few stray pixels.)
 */
function body(): { part: Part; at: Pt } {
  return painted(20, 13, 46, 47, (F) => {
    const torso = inPoly([[23, 25], [33, 18], [43, 15.2], [52, 17.4], [59, 25], [63, 37], [62, 49], [53, 56], [38, 56.4], [27, 50], [22.5, 37]]);
    F(shaggy(torso, 5), furKey(torso, roundLight(36, 22, 24, 26, -0.1), 5));
  });
}

/**
 * The caparison: the cloth over his back, gold-trimmed, a blue border inside a gold line, the red field with two
 * diamonds; gold tassels along its hem.
 */
const CAPARISON: Pt[] = [[44, 19.5], [50, 17.2], [55, 18.6], [59.5, 23.5], [62.5, 31], [64.6, 40], [65.2, 46.6], [56, 48], [48.4, 47.4], [46.8, 38], [45, 28]];
function caparison(): { part: Part; at: Pt } {
  return painted(43, 15, 24, 39, (F, S) => {
    const cloth = inPoly(CAPARISON);
    const light = roundLight(48, 22, 16, 30, 0.02);
    F(cloth, (x, y) => {
      const d = depthIn(cloth, x, y, 4);
      const lit = light(x, y) > 0.12;
      if (d === 0) return lit ? "Y" : "O";
      if (d <= 2) return lit ? "B" : "N";
      if (d === 3) return lit ? "Y" : "O";
      // A fold down the drape, in shade.
      return lit && !(Math.abs(x - (49 + (y - 20) * 0.32)) < 0.6 && y > 24) ? "R" : "r";
    });
    S(DIAMOND, 51, 25);
    S(DIAMOND, 54, 35);
    for (const x of [49, 53, 57, 61]) S(TASSEL, x - 1, 47);
  });
}

// ---- Strokes: legs, the trunk, tusks and the tail, painted along a few points, shaded like a cylinder.

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
function boxOf(pts: readonly Pt[], pad: number): { x0: number; y0: number; w: number; h: number } {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - pad;
  const y0 = Math.floor(Math.min(...ys)) - pad;
  return { x0, y0, w: Math.ceil(Math.max(...xs)) + pad - x0 + 1, h: Math.ceil(Math.max(...ys)) + pad - y0 + 1 };
}
/** For each pixel near a stroke: how far it is along it (0 to 1), its distance across and the normal, its radius. */
function stroke(pts: readonly Pt[], r: number, r1: number, p: Pt): { s: number; d: number; nx: number; ny: number; rr: number } {
  let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: r };
  pts.slice(1).forEach((q, i) => {
    const n = nearest(p, pts[i]!, q);
    const s = (i + n.t) / (pts.length - 1);
    const rr = r + (r1 - r) * s;
    if (n.d - rr < best.d - best.rr) best = { s, d: n.d, nx: n.nx, ny: n.ny, rr };
  });
  return best;
}
/** A cubic curve as points. */
const bezier = (a: Pt, b: Pt, c: Pt, d: Pt, n = 16): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0], u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1]];
  });

/** A furry leg: thick, shaggy, a shade darker toward the foot. */
function leg(pts: readonly Pt[], r: number, r1: number, seed: number, lift = 0): { part: Part; at: Pt } {
  const b = boxOf(pts, Math.ceil(Math.max(r, r1)) + 3);
  return painted(b.x0, b.y0, b.w, b.h, (F) => {
    const core = (x: number, y: number) => {
      const s = stroke(pts, r, r1, [x + 0.5, y + 0.5]);
      return s.d <= s.rr;
    };
    const light = (x: number, y: number) => {
      const s = stroke(pts, r, r1, [x + 0.5, y + 0.5]);
      return 0.62 + lift - 0.42 * (s.nx / s.rr) - 0.5 * (s.ny / s.rr) - s.s * 0.1;
    };
    F(shaggy(core, seed), furKey(core, light, seed));
  });
}

/** A tusk: ivory, thick at its root, tapering to a point, lit along its upper edge. */
function tusk(pts: readonly Pt[], r: number, r1: number): { part: Part; at: Pt } {
  const b = boxOf(pts, Math.ceil(r) + 1);
  return painted(b.x0, b.y0, b.w, b.h, (F) => {
    F(
      (x, y) => {
        const s = stroke(pts, r, r1, [x + 0.5, y + 0.5]);
        return s.d <= s.rr;
      },
      (x, y) => {
        const s = stroke(pts, r, r1, [x + 0.5, y + 0.5]);
        return ramp(IVORY, 0.62 - 0.45 * (s.nx / s.rr) - 0.55 * (s.ny / s.rr) + s.s * 0.12);
      },
    );
  });
}

/** The trunk: hanging from between his eyes, ringed with wrinkles, curling at its tip. */
function trunk(pts: readonly Pt[], r: number, r1: number): { part: Part; at: Pt } {
  const b = boxOf(pts, Math.ceil(r) + 1);
  return painted(b.x0, b.y0, b.w, b.h, (F) => {
    const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]));
    const total = lens.reduce((a, l) => a + l, 0);
    F(
      (x, y) => {
        const s = stroke(pts, r, r1, [x + 0.5, y + 0.5]);
        return s.d <= s.rr;
      },
      (x, y) => {
        const s = stroke(pts, r, r1, [x + 0.5, y + 0.5]);
        const l = 0.6 - 0.45 * (s.nx / s.rr) - 0.3 * (s.ny / s.rr);
        // A wrinkle across it every 2.5 pixels along, on the lit part above the curl.
        const along = s.s * total;
        const ring = s.s < 0.78 && along > 4 && Math.floor(along / 2.5) % 2 === 1 && Math.abs(s.nx) < s.rr * 0.7;
        return ramp("bcdde", l - (ring ? 0.22 : 0));
      },
    );
  });
}

/** A hind foot: a broad round pillar's end, three toenails along its front. */
function hindFoot(): Part {
  const cv = canvas(13, 6);
  const foot = inPoly([[0.4, 5.9], [0.8, 2.6], [3, 0.4], [10, 0.2], [12.6, 2], [12.8, 5.9]]);
  const light = roundLight(4, 0, 10, 7, 0.02);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 13; x++) if (foot(x, y)) cv[y]![x] = ramp("abc", light(x, y));
  const nails: [number, number][] = [[1, 3], [4, 3], [7, 3]];
  for (const [x, y] of nails) ["TtU", "tUV", "UVV"].forEach((row, j) => [...row].forEach((k, i) => (cv[y + j]![x + i] = k)));
  return { grid: toGrid(cv) };
}

/** A raised front foot, its sole to us: a round dark pad ringed with fur, three toenails along its lower front. */
function foreFoot(nailsAt: "left" | "bottom"): Part {
  const cv = canvas(12, 11);
  const pad = inEllipse(6, 5.5, 6, 5.5);
  const light = roundLight(4.5, 3, 6.5, 6.5, 0.12);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 12; x++) if (pad(x, y)) cv[y]![x] = ramp("abcde", light(x, y));
  // A big pale nail on each toe, round its front edge (to our left, or along the bottom).
  const nails: Pt[] = nailsAt === "left" ? [[0, 1.5], [0, 4.5], [1, 7.5]] : [[2, 8], [5, 9], [8, 8]];
  const NAIL = ["Tt", "tU"];
  for (const [nx, ny] of nails) NAIL.forEach((row, j) => [...row].forEach((k, i) => cv[Math.round(ny) + j]?.[Math.round(nx) + i] !== undefined && (cv[Math.round(ny) + j]![Math.round(nx) + i] = k)));
  return { grid: toGrid(cv) };
}

/** The tail: a short rope of fur, ending in a big shaggy tuft. */
function tail(pts: readonly Pt[]): { part: Part; at: Pt } {
  const end = pts[pts.length - 1]!;
  const b = boxOf([...pts, [end[0] + 3, end[1] + 5]], 5);
  return painted(b.x0, b.y0, b.w, b.h, (F) => {
    const rope = (x: number, y: number) => {
      const s = stroke(pts, 1.8, 1.4, [x + 0.5, y + 0.5]);
      return s.d <= s.rr;
    };
    const tuft = inEllipse(end[0] + 0.5, end[1] + 3, 2.8, 4);
    const core = (x: number, y: number) => rope(x, y) || tuft(x, y);
    F(shaggy(core, 2, 2), furKey(core, roundLight(end[0] - 2, end[1] - 4, 7, 9, 0.1), 2));
  });
}

function shadow(): Part {
  const cv = canvas(50, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 50; x++) if (inEllipse(25, 1.5, 25, 1.6)(x, y)) cv[y]![x] = "z";
  return { grid: toGrid(cv), outline: false };
}

// ---- Parts and the pose.

const { parts: PARTS, add } = lazyParts();
add("hindFoot", hindFoot);
add("foreFootL", () => foreFoot("left"));
add("foreFootN", () => foreFoot("bottom"));
add("shadow", shadow);

type Placed = { name: string; at: Pt };
const placedAt = new Map<string, Pt>();
/** A part painted at a place of its own (its at), made the first time it's drawn, by a name that says how. */
function placed(name: string, make: () => { part: Part; at: Pt }): Placed {
  let at = placedAt.get(name);
  if (!at) {
    const m = make();
    add(name, () => m.part);
    placedAt.set(name, (at = m.at));
  }
  return { name, at };
}
const r2 = (v: number) => Math.round(v * 2) / 2;
const key = (pts: readonly Pt[]) => pts.map((p) => `${r2(p[0])},${r2(p[1])}`).join(";");

/** Where his own drawing space (the ground at y 68) sits on the frame, and the frame's size. */
const OX = 3;
const OY = 3;
const GROUND = 68;
const W = OX + 76;
const H = OY + GROUND + 4;

export interface AlfilPose {
  /** Down on his hind legs: everything above the feet a pixel or two lower. */
  bob?: number;
  /** His raised front feet (where each pad's top-left is), the far one (our left) and the near one. */
  foreF?: Pt;
  foreN?: Pt;
  /** The trunk's tip, from where it hangs (its curl follows). */
  trunkTip?: Pt;
}

/** At rest, in his stance: the far front foot out to our left, the near one cocked across his chest. */
const REST: Required<AlfilPose> = { bob: 0, foreF: [4, 37], foreN: [34, 34], trunkTip: [23, 42] };

export function alfilLayers(pose: AlfilPose = {}): Layer[] {
  const p = { ...REST, ...pose };
  const b = p.bob;
  const at = (part: string, x: number, y: number): Layer => ({ part, x: OX + x, y: OY + y });
  const L = (l: Placed, dy = b) => at(l.name, l.at[0], l.at[1] + dy);
  const fF: Pt = [p.foreF[0], p.foreF[1] + b];
  const fN: Pt = [p.foreN[0], p.foreN[1] + b];
  // Legs from their hips (or shoulders) to their feet.
  const hindN: Pt[] = [[38, 49 + b], [33, 56], [30.5, 63]];
  const hindF: Pt[] = [[53, 48 + b], [58, 55], [58.5, 63]];
  const armF: Pt[] = [[27, 33 + b], [19, 37 + b], [fF[0] + 7, fF[1] + 4.5]];
  const armN: Pt[] = [[44, 30 + b], [47.5, 37 + b], [fN[0] + 7, fN[1] + 5]];
  const [tx, ty] = p.trunkTip;
  const trunkPts = ([[26.8, 17.5], [26, 26], [24.6, 34], [tx, ty], [tx - 0.6, ty + 2.6], [tx + 1.2, ty + 4.4], [tx + 3.2, ty + 3.4], [tx + 2.6, ty + 1.6]] as Pt[]).map(([x, y]): Pt => [x, y + b]);
  const tuskF = bezier([21, 23.5 + b], [11.5, 37 + b], [0.5, 31 + b], [7.5, 18.5 + b]);
  const tuskN = bezier([31.5, 23 + b], [40.5, 25 + b], [41, 33 + b], [33.5, 36 + b]);
  const tailPts: Pt[] = [[61.5, 45 + b], [66, 47.5 + b], [68, 52 + b]];
  return [
    at("shadow", 19, GROUND - 2),
    L(placed(`tail:${key(tailPts)}`, () => tail(tailPts)), 0),
    L(placed(`leg:${key(hindF)}`, () => leg(hindF, 6, 5, 7)), 0),
    at("hindFoot", 52, GROUND - 6),
    L(placed("body", body)),
    L(placed("caparison", caparison)),
    L(placed(`leg:${key(hindN)}`, () => leg(hindN, 6.5, 5.2, 11)), 0),
    at("hindFoot", 23, GROUND - 6),
    L(placed("earF", () => ear(13.5, 16, 6, 8.4, 4))),
    L(placed("earN", () => ear(43, 13.5, 8.2, 10.6, 6))),
    L(placed(`arm:${key(armF)}`, () => leg(armF, 4.4, 3.4, 13, 0.16)), 0),
    at("foreFootL", fF[0], fF[1]),
    L(placed("head", head)),
    L(placed(`tusk:${key(tuskF)}`, () => tusk(tuskF, 2.6, 0.9)), 0),
    L(placed(`arm:${key(armN)}`, () => leg(armN, 4.4, 3.4, 17, 0.16)), 0),
    at("foreFootN", fN[0], fN[1]),
    L(placed(`trunk:${key(trunkPts)}`, () => trunk(trunkPts, 2.7, 1.6)), 0),
    L(placed(`tusk:${key(tuskN)}`, () => tusk(tuskN, 2.4, 0.9)), 0),
  ];
}

const frame = (ms: number, pose: AlfilPose = {}): Frame => ({ ms, layers: alfilLayers(pose) });

/** Idle: for now one still (frame 0), for Eric's review; his breathing and blinks come with the animations. */
const idle: Anim = { loop: true, frames: [frame(1000)] };

export const ALFIL: Character = {
  id: "alfil",
  name: "Alfil",
  w: W,
  h: H,
  foot: [OX + 44, OY + GROUND],
  palette: ALFIL_PALETTE,
  halo: "#2c2624",
  parts: PARTS,
  anims: { idle },
};

/** The part of him a portrait shows (his head, headpiece and tusks), in frame pixels. */
export const ALFIL_PORTRAIT = { x: OX + 3, y: OY - 3, w: 46, h: 38 } as const;
