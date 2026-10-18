/**
 * Alfil, the woolly mammoth boss (the chess bishop's ancestor: in old Persian and Arabic chess the piece was the
 * elephant, the alfil). After Eric's reference picture, redrawn: a shaggy brown mammoth up on his hind legs in a
 * fighting stance, his front legs raised like fists (pale toenails), big curved ivory tusks, angry brows, his trunk
 * curling at its tip, a tufted tail; a red and blue Nettipattam on his brow and a matching caparison over his back,
 * diamond patterns, gold trim and gold tassels. In his far fist, held to his side, the ankus he took from his rider: a
 * gold goad as long as a scepter, its spike and hook beside his head and its butt by his feet (Eric, Oct 17). Drawn
 * three-quarters on, facing our left as in the reference, light from the top left.
 *
 * His still was approved (Oct 17) and is idle's first frame; his animation pack (the moments every boss has, his
 * entrance, his attack on a king, and his own: Tusks' cast and fusion, Mammoth Slam) is drawn from poses below
 * (docs/decisions/2026-10-17-alfil-animations.md). In the game (Oct 17): his kit (kits.ts), his lines (ALFIL_LINES), his
 * sounds (alfil-sounds.ts) and his powers on the board (components/Alfil.tsx), timed by ALFIL_BEATS
 * (docs/decisions/2026-10-17-alfil-wired.md).
 *
 * Rigging, as the other bosses: the head (with its Nettipattam), the ears, the body, the caparison, the feet and the
 * shadow are painted once; the legs, the trunk, the tusks, the tail and the ankus from their points, so a new pose is a
 * few numbers. Fur is shaggy: its locks hang a pixel or two below every lower edge and stick out along the sides.
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "./paint.ts";
import { lazyParts, partSize, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";
import { KING_ATTACK } from "@chessroyale/chess";

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
  P: "#7c5609", // brass, the ankus's deepest shade
  z: "#0d0e12", // ground shadow
  g: "#6e6253", // dust kicked up (a slam, a stomp): dark, light
  G: "#a39582",
  j: "#8fd3ff", // sweat
  q: "#ffffff", // a sparkle's white heart (the ankus's tip as he casts)
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

/**
 * His eyes and brows for each mood: the far eye (our left) and the near one, drawn over the fur at (15, 13) and
 * (29, 13); a `.` leaves the fur showing (shut eyes).
 */
export type Mood = "glare" | "blink" | "shut" | "wide" | "smug" | "joy" | "up" | "out";
const EYES: Record<Mood, readonly [readonly string[], readonly string[]]> = {
  // Angry brows slanting down to his trunk, and the eyes under them glaring at you (the still).
  glare: [["xx.....", ".xxxx..", "..wwxxx", "..wvxx.", "..wxxw.", "...ww.."], [".....xx", "...xxxx", ".xxxww.", "..vxwww", "..xxwww", "...www."]],
  // A blink: the brows as they are, the lids down.
  blink: [["xx.....", ".xxxx..", "....xxx", "..xxxx."], [".....xx", "...xxxx", ".xxx...", "..xxxx."]],
  // Squeezed shut (a hit): brows knotted, the lids two creases.
  shut: [["x......", ".xxx...", "...xxxx", "..xx...", "...xxx."], ["......x", "...xxx.", "xxxx...", "....xx.", "..xxx.."]],
  // Rattled: brows up in the middle, eyes wide, small pupils.
  wide: [["....xxx", "..xx...", ".wwww..", ".wwxw..", ".wwww..", "..ww..."], ["xxx....", "...xx..", "..wwww.", "..wxww.", "..wwww.", "...ww.."]],
  // Smug: heavy lids, one brow cocked.
  smug: [["xx.....", ".xxxx..", "..xxxxx", "..wvxx.", "...ww.."], ["...xx..", ".....xx", ".xxxxx.", "..vxww.", "...www."]],
  // Joy (a capture, victory): eyes shut in two happy arcs, brows relaxed.
  joy: [[".......", "xxx....", "...xx..", "..xxxx.", ".x....x"], ["......", "....xxx", "..xx...", ".xxxx..", "x....x."]],
  // Thinking: one brow up, the eyes rolled up and to our right.
  up: [["...xx..", ".xx....", "..wwxw.", "..wwxx.", "..www..", "...ww.."], [".....xx", "...xxxx", ".xxxxw.", "..wwxxw", "..wwwww", "...www."]],
  // Beaten: eyes shut, drooping.
  out: [["x......", ".xx....", "...xxx.", ".....x."], ["......x", "....xx.", ".xxx...", ".x....."]],
};

function head(mood: Mood = "glare"): { part: Part; at: Pt } {
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
    // The brows and eyes (EYES: the mood's).
    S(EYES[mood][0], 15, 13);
    S(EYES[mood][1], 29, 13);
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

/** His shadow on the ground, `w` wide (50 standing; smaller the higher he is off the ground). */
function shadow(w = 50): Part {
  const cv = canvas(w, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < w; x++) if (inEllipse(w / 2, 1.5, w / 2, 1.6)(x, y)) cv[y]![x] = "z";
  return { grid: toGrid(cv), outline: false };
}

/**
 * The ankus: the goad an elephant's rider commands him with, taken from his rider and carried as a trophy, a
 * scepter's length (longer than a real one). All gold: a straight spike at its tip, a knob under it set with a red
 * stone, the hook curving out of the knob and back down; a blue band under the head, red and blue wraps at the grip
 * (either side of his fist) and a knob at its butt. Drawn along its axis from the butt to the tip: `grip` is how far
 * below the tip his fist holds it.
 */
function ankus(butt: Pt, top: Pt, grip: number): { part: Part; at: Pt } {
  const L = Math.hypot(top[0] - butt[0], top[1] - butt[1]);
  const ax = (top[0] - butt[0]) / L;
  const ay = (top[1] - butt[1]) / L;
  // Across it: v > 0 is to our right (toward his head); the hook goes out the other way.
  const nx = -ay;
  const ny = ax;
  const at = (s: number, v: number): Pt => [top[0] - ax * s + nx * v, top[1] - ay * s + ny * v];
  const hook = [at(7.4, -1.8), at(6.2, -3.9), at(7.2, -5.3), at(9.6, -5.4), at(11.4, -4.5)];
  const b = boxOf([butt, top, ...hook], 3);
  return painted(b.x0, b.y0, b.w, b.h, (F) => {
    const local = (x: number, y: number) => {
      const dx = x + 0.5 - top[0];
      const dy = y + 0.5 - top[1];
      return { s: -(dx * ax + dy * ay), v: dx * nx + dy * ny };
    };
    const ell = (s: number, c: number, along: number, across: number) => across * Math.sqrt(Math.max(0, 1 - ((s - c) / along) ** 2));
    /** Its half-width at a distance s below the tip, and what's there. */
    const profile = (s: number): [number, string] => {
      if (s < 0 || s > L) return [0, ""];
      if (s <= 5.6) return [0.4 + s * 0.3, "spike"];
      if (s <= 10) return [ell(s, 7.8, 2.2, 2.9), "knob"];
      if (s <= 12) return [1.1, "gold"];
      if (s <= 13.6) return [1.6, "blue"];
      if (s <= 14.6) return [1.3, "gold"];
      if (s >= L - 2.8) return [Math.max(1.05, ell(s, L - 1.4, 1.4, 1.7)), "gold"];
      const g = Math.abs(s - grip);
      if (g >= 6 && g < 7.6) return [1.4, "red"];
      if (g >= 7.6 && g < 9) return [1.4, "blue"];
      return [1.05, "gold"];
    };
    const onHook = (x: number, y: number) => {
      const h = stroke(hook, 1.6, 0.6, [x + 0.5, y + 0.5]);
      return h.d <= h.rr ? h : null;
    };
    F(
      (x, y) => {
        const { s, v } = local(x, y);
        return Math.abs(v) <= profile(s)[0] || !!onHook(x, y);
      },
      (x, y) => {
        const { s, v } = local(x, y);
        const [hw, what] = profile(s);
        if (Math.abs(v) > hw) {
          const h = onHook(x, y)!;
          return ramp("POYy", 0.62 - 0.45 * (h.nx / h.rr) - 0.55 * (h.ny / h.rr));
        }
        const l = 0.6 - 0.55 * (v / hw) + (what === "spike" ? 0.15 : 0);
        if (what === "knob" && Math.abs(s - 7.8) < 1.1 && Math.abs(v) < 1.1) return v < 0 && s < 7.8 ? "R" : "r";
        if (what === "blue") return l > 0.5 ? "B" : "N";
        if (what === "red") return l > 0.5 ? "R" : "r";
        return ramp("POYy", l);
      },
    );
  });
}

// ---- Parts and the pose.

const { parts: PARTS, add } = lazyParts();
add("hindFoot", hindFoot);
add("foreFootL", () => foreFoot("left"));
add("foreFootN", () => foreFoot("bottom"));

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

/**
 * Where his own drawing space (the ground at y 68) sits on the frame, and the frame's size. The frame has 15 px of
 * headroom over his crown for his hops and the slam's launch (the select stage sizes him by the rows his idle draws
 * in, and the screens place him by his feet, so the empty rows change nothing at rest).
 */
const OX = 3;
const OY = 15;
const GROUND = 68;
const W = OX + 78;
const H = OY + GROUND + 8;

export interface AlfilPose {
  /** Down on his hind legs: everything above the feet a pixel or two lower (negative: rearing up, stretched). */
  bob?: number;
  /** Off the ground (a hop, the slam): the whole of him this many pixels up; his shadow stays and shrinks. */
  air?: number;
  /** The whole of him moved sideways (knocked back, shaking). */
  dx?: number;
  /** His head (with its ears, tusks and trunk) this much lower than his body (negative: thrown back). */
  nod?: number;
  mood?: Mood;
  /** His ears flared out this many pixels (a trumpet, alarm), or drooped in (negative). */
  ears?: number;
  /** His raised front feet (where each pad's top-left is), the far one (our left) and the near one. */
  foreF?: Pt;
  foreN?: Pt;
  /**
   * The trunk: hanging (its tip at `trunkTip`, curling), lifted and curled before his chest, raised, trumpeting, or
   * coiled round the ankus's shaft `trunkGrip` pixels below its tip (Tusks' cast: it swings the ankus).
   */
  trunk?: "hang" | "lift" | "up" | "grip";
  trunkTip?: Pt;
  /** The ankus in his far fist: the end of its butt and the tip of its spike. */
  ankusButt?: Pt;
  ankusTip?: Pt;
  trunkGrip?: number;
  /** The ankus drawn in front of his arms (his trunk holds it out before him, his fist let go). */
  ankusFront?: boolean;
  /** His near hind foot lifted or moved (a stomp), from where it stands. */
  step?: Pt;
  /** His tail's tuft swung this far sideways. */
  tail?: number;
}

/**
 * At rest, in his stance: the far front foot out to our left holding the ankus, the near one cocked across his chest.
 * The ankus leans out a little so its tip stays level with his crown and its hook no further left than his reach: a
 * taller or wider figure would be drawn smaller on the select stage, or reach past his room beside the board.
 */
const REST = { bob: 0, air: 0, dx: 0, nod: 0, mood: "glare", ears: 0, foreF: [4, 37], foreN: [34, 34], trunk: "hang", trunkTip: [23, 42], ankusButt: [11.4, 66.6], ankusTip: [7.6, 0], trunkGrip: 47, ankusFront: false, step: [0, 0], tail: 0 } as const satisfies Required<AlfilPose>;
/** Where the wraps on the ankus's staff are (the middle of his fist's place at rest), as a share of its length. */
const WRAPS_AT = Math.hypot(REST.foreF[0] + 6 - REST.ankusTip[0], REST.foreF[1] + 5.5 - REST.ankusTip[1]) / Math.hypot(REST.ankusButt[0] - REST.ankusTip[0], REST.ankusButt[1] - REST.ankusTip[1]);

/**
 * The trunk coiled round the ankus's shaft at `g` (frame-free drawing space, as the ankus is drawn), the shaft running
 * along `d` (a unit step from its tip toward its butt): down from between his eyes, swinging out (looping, when the
 * shaft is up by his face) to come at the shaft from his side of it, over it, and its tip curled back under.
 */
function gripTrunk(root: Pt, g: Pt, d: Pt): Pt[] {
  // Across the shaft, toward where the trunk comes from.
  let n: Pt = [-d[1], d[0]];
  if ((root[0] - g[0]) * n[0] + (root[1] - g[1]) * n[1] < 0) n = [-n[0], -n[1]];
  const near: Pt = [g[0] + n[0] * 3.4, g[1] + n[1] * 3.4];
  const p1: Pt = [root[0] - 0.6, root[1] + 7];
  const reach = Math.hypot(near[0] - p1[0], near[1] - p1[1]);
  const path = bezier(p1, [p1[0] - 0.4, p1[1] + Math.max(4, reach * 0.45)], [near[0] + n[0] * reach * 0.4, near[1] + n[1] * reach * 0.4], near, 10);
  const far: Pt = [g[0] - n[0] * 2.4, g[1] - n[1] * 2.4];
  return [root, ...path, far, [far[0] + d[0] * 2.4 - n[0] * 0.6, far[1] + d[1] * 2.4 - n[1] * 0.6], [g[0] + d[0] * 3.6 - n[0] * 0.4, g[1] + d[1] * 3.6 - n[1] * 0.4]];
}

/** The trunk's points for its shape (before his bob). */
function trunkPoints(shape: "hang" | "lift" | "up", [tx, ty]: Pt): Pt[] {
  if (shape === "lift") return [[26.8, 17.5], [26, 26], [23.5, 32], [19, 34], [15.6, 31.6], [15.8, 28.4], [18, 27.6]];
  if (shape === "up") return [[26.8, 17.5], [26.2, 25], [22.5, 29.5], [18, 28], [15, 23], [14, 17.5], [14.5, 12.5]];
  return [[26.8, 17.5], [26, 26], [24.6, 34], [tx, ty], [tx - 0.6, ty + 2.6], [tx + 1.2, ty + 4.4], [tx + 3.2, ty + 3.4], [tx + 2.6, ty + 1.6]];
}

export function alfilLayers(pose: AlfilPose = {}): Layer[] {
  const p = { ...REST, ...pose };
  const b = p.bob;
  const hb = b + p.nod;
  const at = (part: string, x: number, y: number): Layer => ({ part, x: OX + x, y: OY + y });
  const L = (l: Placed, dy = b, dx = 0) => at(l.name, l.at[0] + dx, l.at[1] + dy);
  const fF: Pt = [p.foreF[0], p.foreF[1] + b];
  const fN: Pt = [p.foreN[0], p.foreN[1] + b];
  const atRest = (q: Pt, r: Pt) => q[0] === r[0] && q[1] === r[1];
  const mid = (a: Pt, c: Pt, out: Pt): Pt => [(a[0] + c[0]) / 2 + out[0], (a[1] + c[1]) / 2 + out[1]];
  // Legs from their hips (or shoulders) to their feet; a raised fist bends its elbow out and down.
  const [sx, sy] = p.step;
  const hindN: Pt[] = [[38, 49 + b], [33 + sx / 2, 56 + sy / 2], [30.5 + sx, 63 + sy]];
  const hindF: Pt[] = [[53, 48 + b], [58, 55], [58.5, 63]];
  const shoulderF: Pt = [27, 33 + b];
  const shoulderN: Pt = [44, 30 + b];
  const fistF: Pt = [fF[0] + 7, fF[1] + 4.5];
  const fistN: Pt = [fN[0] + 7, fN[1] + 5];
  const armF: Pt[] = [shoulderF, atRest(p.foreF, REST.foreF) ? [19, 37 + b] : mid(shoulderF, fistF, [-1.5, 2.5]), fistF];
  const armN: Pt[] = [shoulderN, atRest(p.foreN, REST.foreN) ? [47.5, 37 + b] : mid(shoulderN, fistN, [3.5, 2.5]), fistN];
  const tuskF = bezier([21, 23.5 + hb], [11.5, 37 + hb], [0.5, 31 + hb], [7.5, 18.5 + hb]);
  const tuskN = bezier([31.5, 23 + hb], [40.5, 25 + hb], [41, 33 + hb], [33.5, 36 + hb]);
  // The ankus rides his bob, except that its butt never goes into the ground (planted, his fist slides down it);
  // `grip` is how far below its tip his far fist (the middle of its pad) holds it.
  const lowest = Math.max(p.ankusButt[1], p.ankusTip[1]);
  const ab = b <= 0 ? b : Math.min(b, Math.max(0, Math.floor(REST.ankusButt[1] - lowest)));
  const [ux, uy] = p.ankusTip;
  const ankusLen = Math.hypot(p.ankusButt[0] - ux, p.ankusButt[1] - uy);
  // Coiled in his trunk, the staff's wraps stay where they're sewn (his fist's place at rest), drawn shorter with it.
  const grip = p.trunk === "grip" ? WRAPS_AT * ankusLen : Math.hypot(p.foreF[0] + 6 - ux, p.foreF[1] + b - ab + 5.5 - uy);
  const shaft: Pt = [(p.ankusButt[0] - ux) / ankusLen, (p.ankusButt[1] - uy) / ankusLen];
  const coil: Pt = [ux + shaft[0] * p.trunkGrip, uy + shaft[1] * p.trunkGrip + ab];
  const trunkPts = p.trunk === "grip" ? gripTrunk([26.8, 17.5 + hb], coil, shaft) : trunkPoints(p.trunk, p.trunkTip).map(([x, y]): Pt => [x, y + hb]);
  const tailPts: Pt[] = [[61.5, 45 + b], [66 + p.tail / 2, 47.5 + b], [68 + p.tail, 52 + b]];
  // His shadow, smaller the higher he is.
  const sw = Math.max(26, 50 - 2 * p.air);
  const sh = `shadow:${sw}`;
  add(sh, () => shadow(sw));
  const ankusLayer = L(placed(`ankus:${key([p.ankusButt, p.ankusTip, [grip, 0]])}`, () => ankus(p.ankusButt, p.ankusTip, grip)), ab);
  const layers: Layer[] = [
    L(placed(`tail:${key(tailPts)}`, () => tail(tailPts)), 0),
    L(placed(`leg:${key(hindF)}`, () => leg(hindF, 6, 5, 7)), 0),
    at("hindFoot", 52, GROUND - 6),
    L(placed("body", body)),
    L(placed("caparison", caparison)),
    L(placed(`leg:${key(hindN)}`, () => leg(hindN, 6.5, 5.2, 11)), 0),
    at("hindFoot", 23 + sx, GROUND - 6 + sy),
    L(placed("earF", () => ear(13.5, 16, 6, 8.4, 4)), hb, -p.ears),
    L(placed("earN", () => ear(43, 13.5, 8.2, 10.6, 6)), hb, p.ears),
    ...(p.ankusFront ? [] : [ankusLayer]),
    L(placed(`arm:${key(armF)}`, () => leg(armF, 4.4, 3.4, 13, 0.16)), 0),
    at("foreFootL", fF[0], fF[1]),
    L(placed(`head:${p.mood}`, () => head(p.mood)), hb),
    L(placed(`tusk:${key(tuskF)}`, () => tusk(tuskF, 2.6, 0.9)), 0),
    L(placed(`arm:${key(armN)}`, () => leg(armN, 4.4, 3.4, 17, 0.16)), 0),
    at("foreFootN", fN[0], fN[1]),
    ...(p.ankusFront ? [ankusLayer] : []),
    L(placed(`trunk:${key(trunkPts)}`, () => trunk(trunkPts, 2.7, 1.6)), 0),
    L(placed(`tusk:${key(tuskN)}`, () => tusk(tuskN, 2.4, 0.9)), 0),
  ];
  return [at(sh, 19 + (50 - sw) / 2 + p.dx, GROUND - 2), ...layers.map((l) => ({ ...l, x: l.x + p.dx, y: l.y - p.air }))];
}

/** Where a point of his drawing space is on the frame, in a pose (his bob, hop and sway). */
const onFrame = ([x, y]: Pt, p: AlfilPose = {}, head = false): Pt => [OX + x + (p.dx ?? 0), OY + y + (p.bob ?? 0) + (head ? (p.nod ?? 0) : 0) - (p.air ?? 0)];

const f = (ms: number, pose: AlfilPose = {}, extra: Partial<Frame> = {}): Frame => ({ ms, layers: alfilLayers(pose), ...extra });

// ---- Things drawn on his frames: dust, sparkles, trumpet blasts, sweat, tufts of fur.

/**
 * Dust kicked up along the ground either side of his feet (`t` frames after he lands or stomps): `n` puffs a side,
 * each a little cloud that rolls outward and up, then thins.
 */
const dust = (t: number, n = 4, cx = OX + 44, spread = 30): Speck[] => {
  const out: Speck[] = [];
  for (let side = -1; side <= 1; side += 2)
    for (let i = 0; i < n; i++) {
      const x = Math.round(cx + side * (spread * 0.5 + i * 3.5 + t * (2 + (i % 2))));
      const y = OY + GROUND - 1 - Math.round(t * (0.6 + (i % 3) * 0.5) + (i % 2));
      const cloud: [number, number, string][] = t < 3 ? [[0, 0, "g"], [side, 0, "g"], [0, -1, "G"], [side, -1, "G"], ...(t >= 1 && i % 2 === 0 ? ([[side * 2, -1, "G"], [side, -2, "G"]] as [number, number, string][]) : [])] : [[0, 0, "G"], [side, -1, "g"]];
      for (const [ox, oy, k] of cloud) {
        const X = x + ox;
        const Y = y + oy;
        if (Y <= OY + GROUND && X >= 3 && X <= W - 4) out.push([X, Y, k]);
      }
    }
  return out;
};
/** A gold four-point sparkle, white at its heart. */
const sparkle = ([x, y]: Pt, big = false): Speck[] => {
  const X = Math.round(x);
  const Y = Math.round(y);
  return [[X, Y, "q"], [X - 1, Y, "y"], [X + 1, Y, "y"], [X, Y - 1, "y"], [X, Y + 1, "y"], ...(big ? ([[X - 2, Y, "Y"], [X + 2, Y, "Y"], [X, Y - 2, "Y"], [X, Y + 2, "Y"], [X - 3, Y, "O"], [X + 3, Y, "O"], [X, Y - 3, "O"], [X, Y + 3, "O"]] as Speck[]) : [])];
};
/** The ankus's spike in a pose, on the frame: where a cast sparkles. */
const tipOf = (p: AlfilPose): Pt => {
  const [x, y] = onFrame(p.ankusTip ?? REST.ankusTip, p);
  const b = p.bob ?? 0;
  const lowest = Math.max((p.ankusButt ?? REST.ankusButt)[1], (p.ankusTip ?? REST.ankusTip)[1]);
  return [x, y - b + (b <= 0 ? b : Math.min(b, Math.max(0, Math.floor(REST.ankusButt[1] - lowest))))];
};
/** A trumpet blast: short lines fanning out from his raised trunk's tip (`t` 0 or 1: near or further out). */
const blast = (p: AlfilPose, t: number): Speck[] => {
  const [x, y] = onFrame([14.5, 12.5], p, true);
  const r = 4 + t * 2;
  return [-1, 0, 1].flatMap((k): Speck[] => {
    const a = -Math.PI * 0.6 + k * 0.5;
    const X = Math.round(x + Math.cos(a) * r);
    const Y = Math.round(y + Math.sin(a) * r);
    return [[X, Y, "T"], [Math.round(X + Math.cos(a)), Math.round(Y + Math.sin(a)), "q"]];
  });
};
/** Sweat flying off his brow. */
const sweat = (i: number, p: AlfilPose): Speck[] => {
  const t = i % 4;
  const [x, y] = onFrame([14, 8], p, true);
  const [x2, y2] = onFrame([39, 6], p, true);
  return [[x - t, y + t * 2, "j"], [x2 + t, y2 + t * 2, "j"]];
};
/** Tufts of fur knocked off him (`t` frames after a hit). */
const tufts = (t: number, [x, y]: Pt = [OX + 40, OY + 18]): Speck[] =>
  [[-1, -1.2], [1.2, -1.4], [1.6, -0.4], [-1.7, -0.3]].flatMap(([vx, vy], i): Speck[] => {
    const px = Math.round(x + vx! * t * 2.4);
    const py = Math.round(y + vy! * t * 2.4 + 0.5 * t * t);
    return [[px, py, i % 2 ? "c" : "d"], [px + 1, py, "e"]];
  });
/** His shadow alone on the ground (he's above the frame, or about to come down), `r` its half-width. */
const groundShadow = (r: number): Speck[] => {
  const out: Speck[] = [];
  for (let x = -r; x <= r; x++) for (let y = -1; y <= 0; y++) if (Math.abs(x) < r - (y === -1 ? 2 : 0)) out.push([OX + 44 + x, OY + GROUND - 1 + y, "z"]);
  return out;
};
/** Thoughts: gold dots rising off his head, one more each beat (the third a spark). */
const thoughts = (n: number): Speck[] =>
  ([[OX + 47, OY - 2], [OX + 52, OY - 6], [OX + 58, OY - 10]] as Pt[]).slice(0, n).flatMap((q, i): Speck[] => (i === 2 ? sparkle(q) : [[q[0], q[1], "Y"], [q[0] + 1, q[1], "O"], [q[0], q[1] - 1, "y"]]));

/** A hit: his fur flashes pale. */
const FLASH: Record<string, string> = { a: "#8a6f5e", b: "#b49580", c: "#d8bba3", d: "#efd9c4", e: "#fff1e2", f: "#ffffff" };
/** His eyes flaring (casting, check). */
const EYES_HOT: Record<string, string> = { w: "#fff1a8", v: "#ffffff" };
/** The ankus blazing (the fusion's flash): its gold goes white-hot. */
const GOLD_HOT: Record<string, string> = { P: "#b4840f", O: "#f2c14e", Y: "#ffe58a", y: "#ffffff" };

// ---- His poses for his own moments.

/** The ankus raised high in his far fist, upright, its spike over his crown. */
const RAISED: AlfilPose = { foreF: [1, 20], ankusButt: [9.5, 62], ankusTip: [5.5, -6] };
/** Higher still: his fist by his ear, the spike well over his head (the fusion). */
const HIGH: AlfilPose = { foreF: [2, 8], ankusButt: [10.5, 57], ankusTip: [7, -9] };

// ---- His animations.

/** Breathing: [bob] per frame. */
const BREATH = [0, 0, 0, 1, 1, 1, 0, 0] as const;
/** The trunk's tip swaying while idle, [px] per frame. */
const SWAY = [0, 0, 0, 1, 1, 1, 0, 0, 0, -1, -1, -1, 0, 0, 0, 0] as const;

/**
 * Idle: he breathes, glowering, his trunk swaying; his ears flap once, his tail swishes, he blinks, and a glint runs
 * up the ankus to its spike. Silent. (Frame 1 is the approved still.)
 */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const p: AlfilPose = { bob: BREATH[i % 8]!, trunkTip: [23 + SWAY[i]!, 42], ears: i === 8 || i === 9 ? 1 : 0, tail: [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0][i]!, mood: i === 13 ? "blink" : "glare" };
    const glint = i >= 3 && i <= 5 ? sparkle(onFrame([9.6 - (i - 3) * 0.6, 26 - (i - 3) * 12], p)) : [];
    return f(125, p, { specks: glint });
  }),
};

/**
 * Entrance: the ground rumbles and his shadow spreads, he drops in from above and lands with a thud, squashed, dust
 * flying; he rears up and trumpets, ears out, and settles into his glare.
 */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 100, layers: [], specks: groundShadow(8), cue: "rumble" },
    { ms: 100, layers: [], specks: groundShadow(16) },
    f(70, { air: 10, bob: -1, ears: 2, trunk: "lift", mood: "glare" }),
    f(70, { air: 4, bob: -1, ears: 2, trunk: "lift" }),
    f(130, { bob: 5, nod: 2, ears: 2, mood: "shut" }, { cue: "thud", shake: [0, 2], specks: dust(0, 5) }),
    f(110, { bob: 3, nod: 1, ears: 1 }, { specks: dust(1, 5) }),
    f(110, { bob: 1, trunk: "lift", ears: 1 }, { specks: dust(2, 5) }),
    f(160, { bob: -1, nod: -1, trunk: "up", ears: 2, mood: "glare" }, { cue: "trumpet", pal: EYES_HOT, specks: blast({ bob: -1, nod: -1 }, 0) }),
    f(160, { bob: -1, nod: -1, trunk: "up", ears: 2 }, { specks: blast({ bob: -1, nod: -1 }, 1) }),
    f(300, {}),
  ],
};

/** Thinking: his near foot up to his chin, his eyes rolled up, his trunk curled and tapping, gold dots for thoughts. */
const thinking: Anim = {
  loop: true,
  frames: [0, 1, 2, 3].flatMap((n) =>
    [0, 1, 2, 3].map((i) => f(130, { mood: "up", foreN: [27, 26], trunk: i % 2 ? "lift" : "hang", trunkTip: [22, 41], bob: i === 2 ? 1 : 0, tail: i === 1 ? 1 : 0 }, { specks: thoughts(n) })),
  ),
};

/** Smug: heavy-lidded, a brow cocked, his near foot on his hip, tapping the ankus's butt on the ground, trunk swinging. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const tap = i % 4 === 1 ? 2 : 0;
    return f(150, { mood: "smug", foreN: [37, 37], ankusButt: [11.4, 66.6 - tap], ankusTip: [7.6, -tap], trunkTip: [23 + [0, 1, 2, 1, 0, -1, -2, -1][i]!, 42], tail: [0, 1, 1, 1, 0, -1, -2, -1][i]!, nod: i % 4 === 2 ? 1 : 0 }, { cue: undefined });
  }),
};

/** Rattled: wide eyes, shaking, ears out, his trunk twitching, sweating. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const p: AlfilPose = { mood: "wide", dx: i % 2 ? 1 : -1, bob: i % 4 === 2 ? 1 : 0, ears: 2, trunkTip: [23 + (i % 2 ? 1 : -1), 41], tail: i % 2 ? 1 : -1 };
    return f(80, p, { specks: sweat(i, p) });
  }),
};

/** His move: he lifts his near foot and stamps it down, planting the ankus with it (dust), then settles. */
const move: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1 }),
    f(100, { step: [-1, -4], ankusButt: [11.4, 63.6], ankusTip: [7.6, -3], trunkTip: [22, 41] }),
    f(120, { step: [-2, -5], ankusButt: [11.4, 62.6], ankusTip: [7.6, -4], trunkTip: [21, 41], mood: "smug" }),
    f(130, { bob: 2, nod: 1 }, { cue: "stomp", shake: [0, 1], specks: dust(0, 2, OX + 30, 12) }),
    f(120, { bob: 1 }, { specks: dust(1, 2, OX + 30, 12) }),
    f(160, {}),
  ],
};

/** A capture: he throws his trunk up and trumpets, ears flapping, bobbing with glee. */
const capture: Anim = {
  loop: false,
  frames: [
    f(90, { bob: 1, trunk: "lift" }),
    ...Array.from({ length: 10 }, (_, i) => {
      const p: AlfilPose = { mood: "joy", trunk: "up", nod: i % 2 ? 0 : -1, bob: i % 2, ears: i % 2 ? 1 : 2, tail: i % 2 ? 1 : -1 };
      return f(85, p, { cue: i === 0 ? "trumpet" : undefined, specks: i < 6 ? blast(p, i % 2) : [] });
    }),
    f(160, { mood: "smug" }),
  ],
};

/** Hurt: a flash, tufts of fur fly, he's knocked back a step, eyes squeezed shut, then glares and snorts. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { bob: 3, nod: 1, mood: "shut", ears: 2, dx: 1 }, { cue: "oof", pal: FLASH, shake: [1, 0], specks: tufts(0) }),
    f(80, { bob: 3, nod: 1, mood: "shut", ears: 2, dx: 1 }, { shake: [-1, 0], specks: tufts(1) }),
    f(90, { bob: 2, mood: "wide", ears: 1, dx: 2 }, { specks: tufts(2) }),
    f(90, { bob: 1, mood: "wide", dx: 1 }, { specks: tufts(3) }),
    f(110, { mood: "glare" }),
    f(120, { mood: "glare", trunk: "lift", ears: 1 }, { pal: EYES_HOT }),
    f(160, {}),
  ],
};

/** Check: he rears up, ankus raised and trunk high, eyes flaring, twice. */
const LOOM: AlfilPose = { ...RAISED, bob: -2, ears: 2, trunk: "up", mood: "glare" };
const check: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1 }),
    f(120, LOOM, { cue: "trumpet", pal: EYES_HOT, specks: blast(LOOM, 0) }),
    f(100, { ...LOOM, ears: 1 }, { pal: EYES_HOT, specks: blast(LOOM, 1) }),
    f(100, { ...RAISED, bob: 0, trunk: "lift" }),
    f(120, LOOM, { pal: EYES_HOT, specks: [...blast(LOOM, 0), ...sparkle(tipOf(LOOM))] }),
    f(100, { ...LOOM, ears: 1 }, { pal: EYES_HOT, specks: blast(LOOM, 1) }),
    f(150, { mood: "smug", trunk: "lift" }),
    f(160, { mood: "smug" }),
  ],
};

/** Defeat: a flash; he staggers, the ankus slips from his fist and clatters down, and he sinks onto his haunches, head hung. */
const SLUMP: AlfilPose = { bob: 6, nod: 4, mood: "out", ears: -1, trunkTip: [23, 47], foreF: [6, 50], foreN: [31, 50], ankusButt: [1, 66], ankusTip: [67, 66.5] };
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { bob: 3, nod: 1, mood: "shut", ears: 2, dx: 1 }, { cue: "oof", pal: FLASH, shake: [1, 0], specks: tufts(0) }),
    f(100, { bob: 3, mood: "wide", dx: 2, ankusButt: [9, 66.6], ankusTip: [16, 0.5] }, { specks: tufts(1) }),
    f(110, { bob: 4, nod: 1, mood: "wide", dx: 1, ankusButt: [4, 66.6], ankusTip: [44, 9], foreF: [5, 42] }, { specks: tufts(2) }),
    f(120, { ...SLUMP, bob: 5, nod: 2 }, { cue: "clatter", shake: [0, 1], specks: dust(0, 3) }),
    f(140, SLUMP, { specks: dust(1, 3) }),
    f(1000, SLUMP),
  ],
};

/** Victory: he hops on his hind legs, ankus raised high, trunk up trumpeting, ears flapping. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 2, 5, 6, 5, 2, 0, 0, 0, 0, 0, 0][i]!;
    const p: AlfilPose = { ...RAISED, mood: "joy", trunk: "up", air, bob: i === 0 || i === 6 ? 2 : 0, ears: i % 2 ? 1 : 2, nod: i % 2 ? 0 : -1, tail: i % 2 ? 1 : -1 };
    return f(110, p, { cue: i === 2 ? "trumpet" : i === 6 ? "stomp" : undefined, specks: [...(i >= 2 && i <= 4 ? blast(p, i % 2) : []), ...(i === 6 ? dust(0, 3) : i === 7 ? dust(1, 3) : []), ...(i % 3 === 0 ? sparkle(tipOf(p)) : [])] });
  }),
};

/**
 * The ankus held out by his trunk's coil at `g` (drawing space), its spike pointing `deg` round from straight up
 * (counterclockwise as we see it: 90 to our left, 180 down, 270 to our right), drawn `k` of its length: as it swings
 * down before him it comes toward us, so it's drawn shorter. His trunk holds it lower than his fist does, 47 pixels
 * below the spike.
 */
const swung = (g: Pt, deg: number, k = 1): AlfilPose => {
  const a = (deg * Math.PI) / 180;
  const u: Pt = [-Math.sin(a), -Math.cos(a)];
  return { trunk: "grip", trunkGrip: 47 * k, ankusFront: true, ankusTip: [g[0] + u[0] * 47 * k, g[1] + u[1] * 47 * k], ankusButt: [g[0] - u[0] * 20 * k, g[1] - u[1] * 20 * k] };
};
type Swing = readonly [g: Pt, deg: number, k: number];
/** The spike's trail through the air, from one swing pose to the next: a fading streak of gold behind it. */
const trail = (from: Swing, to: Swing, p: AlfilPose = {}): Speck[] => {
  const out: Speck[] = [];
  for (let i = 3; i < 10; i++) {
    const t = i / 10;
    const q = swung([from[0][0] + (to[0][0] - from[0][0]) * t, from[0][1] + (to[0][1] - from[0][1]) * t], from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t);
    const [x, y] = onFrame(q.ankusTip!, p);
    // (A streak that would leave his frame is cut short inside it.)
    if (x >= 2 && x <= W - 3 && y >= 2 && y <= H - 3) out.push([Math.round(x), Math.round(y), i < 6 ? "O" : i < 8 ? "Y" : "y"]);
  }
  return out;
};
/** Two puffs of breath snorted from his trunk's tip, blowing down and out, `t` frames after (then thinning). */
const snort = (t: number, [x, y]: Pt): Speck[] =>
  [[-2.4, 1.6], [1.6, 2.4]].flatMap(([vx, vy]): Speck[] => {
    const X = Math.round(x + vx! * (t + 1.2));
    const Y = Math.round(y + vy! * (t + 1.2));
    const cloud = t === 0 ? [".Gq.", "Gqqq", "qqqG", ".GG."] : [".G.", "GqG", ".G."];
    return cloud.flatMap((row, j) => [...row].flatMap((k, i): Speck[] => (k === "." ? [] : [[X + i - 1, Y + j - 1, k]])));
  });

/** Tusks' cast, the swing: his trunk's coil, the spike's angle and how much of its length shows, frame by frame. */
const SWING: readonly Swing[] = [
  [[25, 40], 26, 0.95], // tipped over to our left, his fist letting go
  [[27, 37], 135, 0.6], // swinging down before him, coming toward us
  [[28, 35], 205, 0.62], // past the bottom, rising to our right
  [[26, 38], 245, 0.85],
  [[24, 37], 266, 1], // levelled at the board (to our right, a little down)
  [[18, 40], 320, 0.9], // back up over to his side
];
const sw = (i: number, p: AlfilPose = {}): AlfilPose => ({ foreF: [6, 29], ...p, ...swung(...SWING[i]!) });
/** The far fist on the ankus again, upright at his side, his trunk still round it. */
const RETAKE: AlfilPose = { trunk: "grip", trunkGrip: 51 };

/**
 * Tusks, the cast (Eric, Oct 17): his trunk curls round the ankus below his fist; his fist lets go and his trunk swings
 * it down before him in an arc, from our left to our right, the spike leaving a gold streak, and levels it at the
 * board (to our right, a little down) at his chest; he holds it there, eyes blazing, and snorts; then his trunk swings
 * it back up to his side, his fist takes it, and he rests, smug. The `cast` cue (frame 6, the spike first pointing at
 * the board) is where the board's glow on the two pawns starts; `swing` is the whoosh as it goes, `snort` his snort
 * (his trunk is busy, so no trumpet).
 */
const POINTED = sw(4, { ears: 2 });
/** Where his trunk's curled tip is, levelled: the snort comes out there. */
const SNOUT = onFrame([SWING[4]![0][0] - 1, SWING[4]![0][1] + 3]);
const tusksCast: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 1, nod: 1, trunk: "grip", trunkGrip: 52, ears: 1 }),
    f(80, sw(0, { ears: 1 }), { cue: "swing" }),
    f(60, sw(1, { ears: 1 }), { specks: trail(SWING[0]!, SWING[1]!) }),
    f(60, sw(2, { ears: 2 }), { specks: trail(SWING[1]!, SWING[2]!) }),
    f(50, sw(3, { ears: 2 }), { specks: trail(SWING[2]!, SWING[3]!) }),
    f(90, POINTED, { cue: "cast", pal: EYES_HOT, shake: [1, 0], specks: [...trail(SWING[3]!, SWING[4]!), ...sparkle(tipOf(POINTED), true)] }),
    f(150, { ...POINTED, nod: -1 }, { cue: "snort", pal: EYES_HOT, specks: [...sparkle(tipOf(POINTED)), ...snort(0, SNOUT)] }),
    f(130, { ...POINTED, ears: 1, mood: "smug" }, { specks: [...sparkle(tipOf(POINTED), true), ...snort(1, SNOUT)] }),
    f(90, sw(5, { mood: "smug" }), { specks: trail(SWING[4]!, SWING[5]!) }),
    f(90, { ...RETAKE, mood: "smug" }),
    f(140, { mood: "smug" }),
  ],
};

/**
 * Tusks, the fusion: a short beat to go with the board's white flash. He crouches (the `rise` cue: the two pawns start
 * up to the middle of the board), lifts the ankus high over his head as they rise, and at the top it blazes white (the
 * `flash` cue: the board's white flash, the elephant appearing; the crunch of the fusion), a short trumpet, then he
 * lowers it.
 */
const tusksFuse: Anim = {
  loop: false,
  frames: [
    f(100, { bob: 2, foreF: [2, 30], ankusButt: [10, 66.6], ankusTip: [6, 1] }, { cue: "rise" }),
    f(120, { ...RAISED, bob: 1, trunk: "lift" }),
    f(140, { ...HIGH, ears: 1, trunk: "lift" }, { specks: sparkle(tipOf(HIGH)) }),
    f(140, { ...HIGH, ears: 2, bob: -1, trunk: "up" }, { specks: sparkle(tipOf({ ...HIGH, bob: -1 })) }),
    f(90, { ...HIGH, ears: 2, bob: -1, trunk: "up" }, { cue: "flash", pal: { ...GOLD_HOT, ...EYES_HOT }, specks: sparkle(tipOf({ ...HIGH, bob: -1 }), true) }),
    // (A short trumpet after the fusion's crunch: the sheet's "a grinding crunch, then a short trumpet".)
    f(140, { ...HIGH, ears: 1, bob: -1, trunk: "up", mood: "joy" }, { cue: "trumpet", pal: GOLD_HOT, specks: sparkle(tipOf({ ...HIGH, bob: -1 })) }),
    f(120, { ...RAISED, mood: "smug" }),
    f(160, { mood: "smug" }),
  ],
};

/**
 * Mammoth Slam, his ultimate: he crouches, squashes and launches (the `leap` cue: his big trumpet), rises off the
 * ground, his shadow shrinking, and crashes down onto his haunches (the `slam` cue: the thud and the board's shake),
 * dust flying; then the `fly` cue (the three pieces fly up off the board, a whoosh) and the `shadows` cue (their
 * shadows appear on their squares); he rises, smug.
 */
const SQUASH: AlfilPose = { bob: 5, nod: 2, ears: 2, mood: "shut", trunkTip: [24, 44] };
const mammothSlam: Anim = {
  loop: false,
  frames: [
    f(120, { bob: 2, trunk: "lift", mood: "glare" }),
    f(110, { bob: 4, nod: 1, ears: 1, trunk: "lift", mood: "glare" }),
    f(70, { air: 4, bob: -2, nod: -1, ears: 2, trunk: "up", foreN: [36, 27] }, { cue: "leap", specks: [...dust(0, 3), ...blast({ air: 4, bob: -2, nod: -1 }, 0)] }),
    f(70, { air: 8, bob: -2, nod: -1, ears: 2, trunk: "up", foreN: [36, 27] }, { specks: [...dust(1, 3), ...blast({ air: 8, bob: -2, nod: -1 }, 1)] }),
    f(90, { air: 10, bob: -1, ears: 1, trunk: "up", mood: "joy", foreN: [36, 28] }),
    f(70, { air: 7, bob: -1, ears: 2, trunk: "lift" }),
    f(60, { air: 3, bob: -1, ears: 2, trunk: "lift" }),
    f(140, SQUASH, { cue: "slam", shake: [0, 2], specks: dust(0, 6) }),
    f(100, { ...SQUASH, bob: 4 }, { cue: "fly", shake: [0, -1], specks: dust(1, 6) }),
    f(110, { bob: 2, nod: 1, ears: 1 }, { specks: dust(2, 6) }),
    f(120, { bob: 1, mood: "smug" }, { cue: "shadows", specks: dust(3, 4) }),
    f(300, { mood: "smug" }),
  ],
};

export const ALFIL: Character = {
  id: "alfil",
  name: "Alfil",
  w: W,
  h: H,
  foot: [OX + 44, OY + GROUND],
  palette: ALFIL_PALETTE,
  halo: "#2c2624",
  parts: PARTS,
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, tusksCast, tusksFuse, mammothSlam },
};

// ---- His attack on a king.

/**
 * Room ahead of him for the attack, in frame pixels: the attack's frame is this much wider, and he's drawn turned
 * round (facing our right, the king's side), his ankus reaching into the king's square 1.8 squares away.
 */
const ATTACK_REACH = 36;
const AW = W + ATTACK_REACH;
/** A frame of his, turned to face our right in the attack's wider frame. */
function facingRight(fr: Frame): Frame {
  const layers = fr.layers.map((l): Layer => {
    const [pw] = partSize(PARTS[l.part]!, l.rot ?? 0);
    return { ...l, x: AW - (l.x + ATTACK_REACH) - pw, flipX: !l.flipX };
  });
  const specks = (fr.specks ?? []).map(([x, y, k]): Speck => [AW - 1 - (x + ATTACK_REACH), y, k]);
  return { ...fr, layers, specks, shake: fr.shake ? [-fr.shake[0], fr.shake[1]] : undefined };
}

/** The ankus thrust ahead of him (to our left, as drawn before he's turned round) at the king: high or low, out or drawn back. */
const jab = (low: boolean, out: boolean): AlfilPose => {
  const y = low ? 40 : 30;
  const reach = out ? -30 : -18;
  return { foreF: [out ? -6 : 2, y - 6], ankusButt: [reach + 66, y + 2.5], ankusTip: [reach, y - 1.5], ears: out ? 2 : 1, mood: out ? "glare" : "smug", trunk: out ? "lift" : "hang", bob: out ? 1 : 0, dx: out ? -2 : 0 };
};

/**
 * His attack on a king (kits.ts: his kit's `kingAttack`), the king to our right, on the shared beats (KING_ATTACK,
 * boss-timing.ts): his shadow spreads, he drops in and lands with a thud, then jabs the ankus at the king ten times,
 * high and low (a `jab` cue each: the board's hit on the king's square), drawing it back between; he trumpets and
 * leaps off; the last frame is empty.
 */
const kingAttack: Anim = (() => {
  const A = KING_ATTACK;
  const frames: Frame[] = [
    { ms: 100, layers: [], specks: groundShadow(8), cue: "rumble" },
    { ms: 100, layers: [], specks: groundShadow(16) },
    f(80, { air: 10, bob: -1, ears: 2, trunk: "lift" }),
    f(80, { air: 4, bob: -1, ears: 2, trunk: "lift" }),
    f(A.landAt - 360, { bob: 5, nod: 2, ears: 2, mood: "shut" }, { cue: "land", shake: [0, 2], specks: dust(0, 5) }),
    f(A.lashAt - A.landAt, { ...jab(false, false), mood: "glare" }, { pal: EYES_HOT, specks: dust(1, 5) }),
  ];
  const hitMs = 90;
  for (let i = 0; i < A.lashes; i++) {
    const low = i % 2 === 1;
    const p = jab(low, true);
    const tip = onFrame([p.ankusTip![0] - 1, p.ankusTip![1]], p);
    frames.push(f(hitMs, p, { cue: "jab", shake: [-1, 0], pal: EYES_HOT, specks: sparkle(tip, i % 3 === 0) }));
    frames.push(f(A.lashEveryMs - hitMs, jab(low, false)));
  }
  const trumpet = A.leaveAt - (A.lashAt + A.lashes * A.lashEveryMs);
  frames.push(f(trumpet, { mood: "joy", trunk: "up", ears: 2, nod: -1 }, { cue: "trumpet", specks: blast({ nod: -1 }, 0) }));
  const leave = A.ms - A.leaveAt;
  frames.push(
    f(leave - 300, { bob: 4, nod: 1, ears: 1, mood: "smug" }),
    f(80, { air: 4, bob: -2, ears: 2, trunk: "up" }, { cue: "leap", specks: dust(0, 3) }),
    f(80, { air: 10, bob: -2, ears: 2, trunk: "up" }, { specks: dust(1, 3) }),
    { ms: 80, layers: [], specks: groundShadow(10) },
    { ms: 60, layers: [] },
  );
  return { loop: false, frames: frames.map((fr) => (fr.layers.length ? facingRight(fr) : { ...fr, specks: (fr.specks ?? []).map(([x, y, k]): Speck => [AW - 1 - (x + ATTACK_REACH), y, k]) })) };
})();

/**
 * Alfil for his attack on a king (his kit's `kingAttack`, once he's wired in): the same drawing, parts and palette,
 * turned to face our right in a frame `ATTACK_REACH` wider, so the ankus he jabs at the king fits in it. (Its `idle`, one
 * still, is for the preview, which starts every character's reel from one.)
 */
export const ALFIL_ATTACK: Character = { ...ALFIL, id: "alfil-attack", name: "Alfil (his attack)", w: AW, foot: [AW - (OX + 44 + ATTACK_REACH), OY + GROUND], anims: { idle: { loop: true, frames: [facingRight(f(1000))] }, kingAttack } };

/** The part of him a portrait shows (his head, headpiece and tusks), in frame pixels. */
export const ALFIL_PORTRAIT = { x: OX, y: OY - 3, w: 50, h: 38 } as const;

/**
 * His lines (Eric's sheet, Oct 17: "Before your bishops, there was me.", "Two little pawns make one big problem.", "Hold
 * on to something.", "What goes up…" and the fusion's three; the rest in the same voice): short, said now and then
 * (ALFIL_CHANCE); a power's moment always has its line. `power` is his cast (two pawns glowing), `powerHit` the fusion
 * (it's his move: "Alfil spent his move on the fusion."), `ultimateWarn` the Slam coming, `ultimate` the Slam, and
 * `ultimateHit` the pieces landing ("…must come down." answers "What goes up…").
 */
export const ALFIL_LINES: Partial<Record<import("./boss-beats.ts").Beat, readonly string[]>> = {
  entrance: ["Before your bishops, there was me.", "The old piece is back.", "Make room. Big guy coming through."],
  move: ["Stomp.", "Heavy step.", "Make way."],
  capture: ["Trampled!", "Squashed flat.", "I never forget a piece."],
  check: ["Check! Feel the ground shake?", "Check. Stampede!", "Small king. Big tusks."],
  hurt: ["Hey! Mind the tusks!", "Ow! My trunk!", "That stung!"],
  thinking: ["Elephants never rush.", "Slow and heavy…", "Let me chew on that…"],
  smug: ["Old school wins.", "Ten thousand years of practice.", "Thick skin. Big plans."],
  rattled: ["The ice age was easier…", "My tusks are shaking…", "Not my squares…"],
  defeat: ["Back to the ice…", "Replaced… again…", "The bishops can have it…"],
  victory: ["The board is mine again!", "Who needs bishops?", "Mammoth win!"],
  strike: ["Trampled!", "Out of my way!"],
  power: ["Two little pawns make one big problem.", "Glow, little ones.", "Pawns today. Elephant tomorrow."],
  powerHit: ["Worth the wait.", "I'll skip my move. You'll wish I hadn't.", "Patience. Something old is coming back."],
  ultimateWarn: ["Hold on to something.", "Feel that rumble?", "Brace yourselves…"],
  ultimate: ["What goes up…", "Up you go!", "Fly, little pieces!"],
  ultimateHit: ["…must come down.", "And down they come.", "Welcome back. Miss me?"],
  kingAttack: ["Poke! Poke! Poke!", "Out of my way, little king!", "Remember me now?"],
};
export const ALFIL_CHANCE: Partial<Record<import("./boss-beats.ts").Beat, number>> = {
  entrance: 1,
  move: 0.12,
  capture: 0.6,
  check: 0.75,
  hurt: 0.6,
  thinking: 0.08,
  smug: 0.8,
  rattled: 0.8,
  defeat: 1,
  victory: 1,
  strike: 1,
  kingAttack: 1,
};
