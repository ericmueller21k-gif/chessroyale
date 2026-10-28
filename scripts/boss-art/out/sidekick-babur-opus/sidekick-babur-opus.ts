/**
 * Babur's sidekick (id "sidekick-babur-opus"): a tiger cub, a town bot that wanders the square and plays chess at the park's
 * tables. No powers, never fights: a cuddly little one who copies the big one. Babur's link is a balloon, but not a chess
 * piece: one big, plain, round purple party balloon, almost as big as the cub, hugged like a stuffed animal. Both front legs
 * wrap round it (the near one across its front, the far paw peeking round its far side), its cheek pressed on it; now and
 * then a big happy squeeze pinches the balloon in where it's held and bulges it out above and below, then it springs back.
 * Soft round paws, no claws anywhere: it never pops.
 *
 * Rigging, as Jefferson's sidekick: every part is painted at its rest place in frame pixels (light from the top left),
 * cropped and cached by name; a pose moves parts by whole pixels, and the arms, legs, tail and balloon are painted from
 * a handful of numbers (points, a squeeze), so a new pose is numbers, not a redraw.
 */
import { canvas, toGrid, type Canvas } from "../../../../packages/app/src/characters/paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";

export const CUB_PALETTE = {
  k: "#1f1210", // outline
  a: "#7a3410", // cub orange: deep shadow to highlight (a touch softer than Babur's)
  b: "#b5541a",
  c: "#dc7a26",
  d: "#f09a3e",
  e: "#ffbd6b",
  f: "#c4a47e", // cream: muzzle, cheeks, chest, feet
  g: "#e6d2ad",
  h: "#fbf1da",
  s: "#2a160f", // stripes
  t: "#4d2813", // brows
  y: "#f3a81f", // amber eyes
  Y: "#ffd45a",
  x: "#140a08", // pupil
  w: "#fffaf0", // glints, balloon shine
  n: "#e9858a", // nose, ear insides, paw pads, blush
  q: "#f6a7a4",
  m: "#6a1d24", // open mouth
  "1": "#341360", // the balloon: deepest to lightest purple
  "2": "#552592",
  "3": "#7c3fc6",
  "4": "#a06ce4",
  "5": "#d6b8fb",
  "9": "#e2d6c4", // balloon string
  r: "#c98f4e", // stool wood, light to dark
  p: "#a06a33",
  P: "#6c4222",
  z: "#0d0e12", // ground shadow
  j: "#7fd3ff", // sweat, tears
  i: "#9fe8ff", // twinkles
  H: "#ff6f9c", // hearts
  R: "#e8303d", // confetti: Babur's balloon colors
  B: "#3a8ae6",
  G: "#2fb862",
  L: "#f2c14e",
  u: "#b9a88f", // dust
  U: "#7d6c5a",
  o: "#cfc6d8", // thought bubbles
  O: "#8f879a",
} as const;

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;

const W = 64;
const H = 64;
/** The first row below the feet. */
const GROUND = 61;

const ORANGE = "abcde";
const CREAM = "fgh";

const PARTS: Record<string, Part> = {};
interface Painted {
  name: string;
  at: Pt;
}
const MADE = new Map<string, Pt>();

/** A part painted at its rest place on a frame-sized canvas, cropped, made once by name. */
function part(name: string, draw: (cv: Canvas) => void, outline = true): Painted {
  let at = MADE.get(name);
  if (!at) {
    const cv = canvas(W, H);
    draw(cv);
    let x0 = W;
    let y0 = H;
    let x1 = -1;
    let y1 = -1;
    cv.forEach((row, y) =>
      row.forEach((k, x) => {
        if (k === ".") return;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }),
    );
    if (x1 < 0) {
      PARTS[name] = { grid: ["."], outline };
      at = [0, 0];
    } else {
      PARTS[name] = { grid: toGrid(cv.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1))), outline };
      at = [x0, y0];
    }
    MADE.set(name, at);
  }
  return { name, at };
}

// ---- Painting helpers (an integer coordinate is the middle of that pixel).

const ell = (cx: number, cy: number, rx: number, ry: number): Inside => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const roundL = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => 0.52 + bias - 0.45 * ((x - cx) / rx) - 0.55 * ((y - cy) / ry);
const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
function each(cv: Canvas, inside: Inside, key: (x: number, y: number) => string): void {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) cv[y]![x] = key(x, y);
}
function stamp(cv: Canvas, rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, j) =>
    [...row].forEach((k, i) => {
      if (k !== "." && cv[y0 + j]?.[x0 + i] !== undefined) cv[y0 + j]![x0 + i] = k;
    }),
  );
}
function dots(cv: Canvas, pts: readonly Pt[], k: string): void {
  for (const [x, y] of pts) if (cv[y]?.[x] !== undefined) cv[y]![x] = k;
}

function seg(p: Pt, a: Pt, b: Pt) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}
/** For a pixel near a polyline: how far along (0 to 1), how far across, the normal, and the radius there. */
function along(pts: readonly Pt[], r: readonly number[], p: Pt) {
  let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: r[0]! };
  for (let i = 0; i + 1 < pts.length; i++) {
    const n = seg(p, pts[i]!, pts[i + 1]!);
    const rr = r[i]! + (r[i + 1]! - r[i]!) * n.t;
    if (n.d - rr < best.d - best.rr) best = { s: (i + n.t) / (pts.length - 1), d: n.d, nx: n.nx, ny: n.ny, rr };
  }
  return best;
}
const bar = (pts: readonly Pt[], r: readonly number[]): Inside => (x, y) => {
  const a = along(pts, r, [x, y]);
  return a.d <= a.rr;
};
const lengthOf = (pts: readonly Pt[]) => pts.slice(1).reduce((n, q, i) => n + Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]), 0);

// ---- The body: a round little pear, orange with soft stripes down its back, a cream tummy.

const BODY = part("body", (cv) => {
  const e = ell(23, 46, 9.5, 11);
  const L = roundL(22, 44, 9.5, 11, 0.12);
  const belly = ell(30, 50, 6, 8.5);
  const bars = [
    bar([[17.5, 35.6], [19.2, 37.4], [19.8, 39.2]], [0.9, 0.7, 0.3]),
    bar([[13.8, 40], [16.6, 40.6], [18.4, 42]], [1, 0.8, 0.3]),
    bar([[13.6, 45.6], [17, 46], [19, 47.4]], [1, 0.8, 0.3]),
  ];
  each(cv, e, (x, y) => (belly(x, y) ? ramp(CREAM, L(x, y) + 0.25) : bars.some((b) => b(x, y)) ? "s" : ramp(ORANGE, L(x, y))));
});

// ---- The head: big and round, a cream muzzle and cheek fluff, soft stripes on the brow and the side, big amber eyes.

export type Mood = "calm" | "blink" | "happy" | "squeeze" | "cheer" | "think" | "thinkBlink" | "smug" | "rattled" | "hurt" | "sad" | "sadBlink" | "roar" | "bold";
type Eye = "open" | "up" | "wide" | "half" | "arc" | "shut" | "pinch" | "wet";
type Brow = "up" | "worried" | "bold" | "smug";
type Mouth = "smile" | "grin" | "flat" | "smirk" | "wavy" | "o" | "frown" | "roar";

const NEAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkkk.", "kwwxxk", "kwxxxk", "kyxxxk", "kyyxyk", "kYYyyk", ".kkkk."],
  up: [".kkkk.", "kxxxwk", "kxxxxk", "kyxxyk", "kyyyyk", "kYYyyk", ".kkkk."],
  wide: [".kkkk.", "kwYYyk", "kYYYyk", "kYxxyk", "kyxxyk", "kyyyyk", ".kkkk."],
  half: ["......", "......", "kkkkkk", "kwxxxk", "kyyxyk", ".kkkk.", "......"],
  arc: ["......", "......", ".kkkk.", "k....k", "......", "......", "......"],
  shut: ["......", "......", "......", "kkkkkk", "......", "......", "......"],
  pinch: ["......", "kk....", ".kkk..", "...kkk", ".kkk..", "kk....", "......"],
  wet: [".kkkk.", "kwwxxk", "kwxxxk", "kyxxxk", "kyyxyk", "kjjjjk", ".kkkk."],
};
const FAR_EYE: Record<Eye, readonly string[]> = {
  open: [".kkk.", "kwxxk", "kxxxk", "kyxyk", "kYyyk", ".kkk."],
  up: [".kkk.", "kxxwk", "kxxxk", "kyyyk", "kYyyk", ".kkk."],
  wide: [".kkk.", "kwYyk", "kYxyk", "kyxyk", "kyyyk", ".kkk."],
  half: [".....", ".....", "kkkkk", "kwxxk", ".kkk.", "....."],
  arc: [".....", ".....", ".kkk.", "k...k", ".....", "....."],
  shut: [".....", ".....", ".....", "kkkkk", ".....", "....."],
  pinch: [".....", "...kk", ".kkk.", "kk...", ".kkk.", "...kk"],
  wet: [".kkk.", "kwxxk", "kxxxk", "kyxyk", "kjjjk", ".kkk."],
};
const BROWS: Record<Brow, readonly [readonly Pt[], readonly Pt[]]> = {
  up: [[[18, 18], [19, 17], [20, 17], [21, 18]], [[28, 17], [29, 17], [30, 17]]],
  worried: [[[18, 19], [19, 19], [20, 18], [21, 17]], [[28, 17], [29, 18], [30, 18], [31, 19]]],
  bold: [[[18, 17], [19, 18], [20, 18], [21, 19]], [[28, 19], [29, 18], [30, 18], [31, 17]]],
  smug: [[[18, 19], [19, 19], [20, 19], [21, 19]], [[29, 17], [30, 17], [31, 18]]],
};
/** Mouths, stamped with their top-left at (32, 28), under the nose. */
const MOUTHS: Record<Mouth, readonly string[]> = {
  smile: ["k.k.k", ".k.k."],
  grin: ["kkkkk", "kmmmk", ".knk."],
  flat: ["..k..", ".kkk."],
  smirk: ["..k.k", ".k.k.", "kk..."],
  wavy: ["..k..", ".k.k.", "k...k"],
  o: ["..k..", ".kmk.", "..k.."],
  frown: ["..k..", ".kkk.", "k...k"],
  roar: [".kkkk.", "kwmmwk", "kmmmmk", "kmnnmk", ".kkkk."],
};
const FACES: Record<Mood, { near: Eye; far: Eye; brow?: Brow; mouth: Mouth; blush?: boolean; tear?: boolean }> = {
  calm: { near: "open", far: "open", mouth: "smile", blush: true },
  blink: { near: "shut", far: "shut", mouth: "smile", blush: true },
  happy: { near: "arc", far: "arc", mouth: "grin", blush: true },
  squeeze: { near: "arc", far: "arc", mouth: "smile", blush: true },
  cheer: { near: "open", far: "open", brow: "up", mouth: "grin", blush: true },
  think: { near: "up", far: "up", brow: "up", mouth: "flat" },
  thinkBlink: { near: "shut", far: "shut", brow: "up", mouth: "flat" },
  smug: { near: "half", far: "half", brow: "smug", mouth: "smirk", blush: true },
  rattled: { near: "wide", far: "wide", brow: "worried", mouth: "wavy" },
  hurt: { near: "pinch", far: "pinch", brow: "worried", mouth: "o" },
  sad: { near: "wet", far: "wet", brow: "worried", mouth: "frown", tear: true },
  sadBlink: { near: "shut", far: "shut", brow: "worried", mouth: "frown", tear: true },
  roar: { near: "open", far: "open", brow: "bold", mouth: "roar" },
  bold: { near: "open", far: "open", brow: "bold", mouth: "grin", blush: true },
};

function headPart(mood: Mood): Painted {
  return part(`head:${mood}`, (cv) => {
    const skull = ell(24, 25, 13, 11);
    const snout = ell(32, 30, 6, 4.6);
    const fluff = ell(13.5, 31, 3.2, 2.6);
    const inside: Inside = (x, y) => skull(x, y) || snout(x, y) || fluff(x, y);
    const L = roundL(22, 23, 13, 11, 0.12);
    const muzzle = ell(31.5, 30.2, 6, 4.4);
    const cheek = ell(15, 31.5, 4.6, 3);
    const bars = [
      bar([[24, 14.2], [24.2, 18]], [1, 0.3]),
      bar([[20.6, 15], [21.4, 17.6]], [0.9, 0.3]),
      bar([[27.6, 15], [27, 17.4]], [0.9, 0.3]),
      bar([[11.2, 23], [14.8, 23.6]], [0.9, 0.3]),
      bar([[11.4, 26.6], [14.2, 27]], [0.85, 0.3]),
    ];
    each(cv, inside, (x, y) => (muzzle(x, y) || cheek(x, y) ? ramp(CREAM, L(x, y) + 0.3) : bars.some((b) => b(x, y)) ? "s" : ramp(ORANGE, L(x, y))));
    const face = FACES[mood];
    // Pale spots above the eyes (as Babur's), under any brows.
    dots(cv, [[18, 17], [19, 17], [29, 17]], "h");
    stamp(cv, NEAR_EYE[face.near], 17, 19);
    stamp(cv, FAR_EYE[face.far], 28, 19);
    if (face.brow) for (const side of BROWS[face.brow]) dots(cv, side.map(([x, y]): Pt => [x, y - 1]), "t");
    stamp(cv, ["nnn", ".n."], 33, 26);
    stamp(cv, MOUTHS[face.mouth], 32, 28);
    if (face.blush) dots(cv, [[21, 28], [22, 28], [23, 28]], "q");
    if (face.tear) dots(cv, [[18, 27], [18, 28], [17, 29]], "j");
  });
}

/** The ears, round, behind the head: orange with a pink and cream inside. */
const EAR_N = part("earN", (cv) => {
  const e = ell(15, 15.5, 4.2, 4);
  const L = roundL(15, 15.5, 4.2, 4, 0.1);
  const inner = ell(15.8, 16.2, 2.1, 2.1);
  each(cv, e, (x, y) => (inner(x, y) ? (y <= 15 ? "g" : "q") : ramp(ORANGE, L(x, y))));
});
const EAR_F = part("earF", (cv) => {
  const e = ell(32, 14.5, 3.6, 3.6);
  const L = roundL(32, 14.5, 3.6, 3.6, -0.05);
  const inner = ell(31.6, 15.2, 1.7, 1.8);
  each(cv, e, (x, y) => (inner(x, y) ? (y <= 14 ? "g" : "n") : ramp(ORANGE, L(x, y))));
});

// ---- The balloon: big, plain, round and shiny, one soft highlight, a little knot. `s` squeezes it: pinched in at the
// arms (WY), bulging out above and below; a negative `s` is its spring back (a touch fat at the waist).

const BCX = 43;
const BCY = 40;
const BRX = 12.5;
const BRY = 13;
const WY = 44;
const bm = (s: number, y: number) => 1 + 0.11 * s - 0.27 * s * Math.exp(-(((y - WY) / 3.4) ** 2));
const bry = (s: number) => BRY * (1 + 0.04 * s);
function balloonBottom(s: number): number {
  const ry = bry(s);
  let b = BCY;
  while (((b + 1 - BCY) / ry) ** 2 <= 1) b++;
  return b;
}
function balloon(s: number): Painted {
  return part(`balloon:${s}`, (cv) => {
    const ry = bry(s);
    const inside: Inside = (x, y) => ((x - BCX) / (BRX * bm(s, y))) ** 2 + ((y - BCY) / ry) ** 2 <= 1;
    const hl = ell(40.5, 32.5, 1.7, 3);
    each(cv, inside, (x, y) => {
      const nx = (x - BCX) / (BRX * bm(s, y));
      const ny = (y - BCY) / ry;
      const l = 0.6 - 0.42 * nx - 0.5 * ny;
      if (hl(x, y)) return "5";
      // A faint bounce light on the lower left rim.
      if (nx < -0.55 && ny > 0.35 && nx * nx + ny * ny > 0.8) return "3";
      return l < 0.14 ? "1" : l < 0.4 ? "2" : l < 0.82 ? "3" : "4";
    });
    dots(cv, [[40, 31], [40, 32]], "w");
    const b = balloonBottom(s);
    stamp(cv, [".2.", "232"], BCX - 1, b + 1);
  });
}
/** The string: short, from the knot, wiggling down. */
function balloonString(s: number, sway: number, maxY: number): Painted {
  return part(`string:${s}:${sway}:${maxY}`, (cv) => {
    const top = balloonBottom(s) + 3;
    for (let y = top; y <= Math.max(top, Math.min(top + 4, maxY)); y++) cv[y]![BCX + Math.round(Math.sin((y - top) * 0.9 + sway) * 0.8)] = "9";
  });
}

// ---- Arms and legs.

/** The near foreleg: shoulder, elbow, paw. `palm` shows the paw's soft pink pads (a wave); otherwise its round back. */
function nearArm(sh: Pt, el: Pt, paw: Pt, palm: boolean): Painted {
  return part(`armN:${sh}:${el}:${paw}:${palm ? 1 : 0}`, (cv) => {
    const pts = [sh, el, paw] as const;
    const r = [2.6, 2.3, 2.1];
    const P = palm ? ell(paw[0], paw[1], 3.3, 3.2) : ell(paw[0], paw[1], 3.2, 2.7);
    const len = lengthOf(pts);
    each(
      cv,
      (x, y) => {
        const a = along(pts, r, [x, y]);
        return a.d <= a.rr || P(x, y);
      },
      (x, y) => {
        if (P(x, y)) {
          const l = 0.62 - 0.2 * ((x - paw[0]) / 3) - 0.26 * ((y - paw[1]) / 3);
          return palm ? ramp(CREAM, l + 0.15) : ramp(ORANGE, l + 0.2);
        }
        const a = along(pts, r, [x, y]);
        const at = a.s * len;
        if (Math.abs(at - len * 0.5) < 0.6) return "s";
        return ramp(ORANGE, 0.6 - 0.45 * (a.nx / a.rr) - 0.5 * (a.ny / a.rr));
      },
    );
    const [px, py] = [Math.round(paw[0]), Math.round(paw[1])];
    if (palm) {
      dots(cv, [[px - 1, py + 1], [px, py + 1], [px - 1, py + 2], [px, py + 2]], "n");
      dots(cv, [[px - 2, py - 1], [px, py - 2], [px + 2, py - 1]], "q");
    } else {
      dots(cv, [[px, py + 1], [px + 2, py]], "c");
    }
  });
}

/** The far paw, peeking round the balloon's far side (drawn behind it). */
const FAR_PAW_AT: Pt = [56, 43];
const FAR_PAW = part("pawF", (cv) => {
  const P = ell(FAR_PAW_AT[0], FAR_PAW_AT[1], 3.3, 3);
  each(cv, P, (x, y) => ramp(ORANGE, 0.55 - 0.2 * (x - FAR_PAW_AT[0]) / 3 - 0.3 * (y - FAR_PAW_AT[1]) / 3));
  dots(cv, [[FAR_PAW_AT[0] + 1, FAR_PAW_AT[1] - 1], [FAR_PAW_AT[0] + 1, FAR_PAW_AT[1] + 1]], "b");
});

/** A hind leg: a round haunch, a short shin, a big soft foot (cream, two toe creases). */
function leg(pts: readonly Pt[], foot: Pt, far: boolean, sole = false): Painted {
  return part(`leg:${pts.map((p) => p.join(",")).join(";")}:${foot}:${far ? 1 : 0}:${sole ? 1 : 0}`, (cv) => {
    const r = pts.map((_, i) => (i === 0 ? 3.2 : 2.5));
    const haunch = ell(pts[0]![0], pts[0]![1], 4.6, 4.4);
    const F = sole ? ell(foot[0], foot[1], 2.7, 3.3) : ell(foot[0], foot[1], 4.3, 2.3);
    const dim = far ? 0.24 : 0;
    const stripe = bar([[pts[0]![0] - 3.6, pts[0]![1] - 1], [pts[0]![0] - 1, pts[0]![1] - 0.4]], [0.9, 0.3]);
    each(
      cv,
      (x, y) => {
        const a = along(pts, r, [x, y]);
        return a.d <= a.rr || haunch(x, y) || F(x, y);
      },
      (x, y) => {
        if (F(x, y)) return ramp(CREAM, 0.75 - 0.2 * ((x - foot[0]) / 4) - 0.3 * ((y - foot[1]) / 2.4) - dim);
        if (!far && sole && stripe(x, y)) return "s";
        const L = haunch(x, y) ? roundL(pts[0]![0], pts[0]![1], 4.6, 4.4, 0.08)(x, y) : 0.5;
        return ramp(ORANGE, L - dim);
      },
    );
    const [fx, fy] = [Math.round(foot[0]), Math.round(foot[1])];
    if (sole) {
      // The sole toward us: a soft pink pad and three toe beans.
      dots(cv, [[fx, fy + 1], [fx + 1, fy + 1], [fx, fy + 2], [fx + 1, fy + 2]], "n");
      dots(cv, [[fx - 1, fy - 1], [fx + 1, fy - 2], [fx + 2, fy]], "q");
    } else dots(cv, [[fx + 1, fy], [fx + 3, fy]], "f");
  });
}

/** The tail: short and plump, striped, a dark tip; `sw` swishes the tip. */
function tail(sw: number): Painted {
  return part(`tail:${sw}`, (cv) => {
    const pts: Pt[] = [[16, 52], [10.5, 51.5], [7, 48.5], [6 + sw * 0.4, 44.5], [7.5 + sw, 41]];
    const r = [2.1, 1.9, 1.8, 1.7, 1.6];
    const len = lengthOf(pts);
    each(
      cv,
      (x, y) => {
        const a = along(pts, r, [x, y]);
        return a.d <= a.rr;
      },
      (x, y) => {
        const a = along(pts, r, [x, y]);
        const at = a.s * len;
        if (at > len - 2.2 || (at > 5 && (at - 5) % 3.2 < 1.2)) return "s";
        return ramp(ORANGE, 0.6 - 0.45 * (a.nx / a.rr) - 0.5 * (a.ny / a.rr));
      },
    );
  });
}

const SHADOW = part(
  "shadow",
  (cv) => {
    each(cv, ell(30, GROUND - 1, 16, 1.6), () => "z");
  },
  false,
);

const STOOL = part("stool", (cv) => {
  stamp(
    cv,
    [
      "rrrrrrrrrrrrrrrrrrrrrrr",
      "ppppppppppppppppppppppp",
      "PPPPPPPPPPPPPPPPPPPPPPP",
      "..rp...............rp..",
      "..rp...............rp..",
      "..rp...............rp..",
      "..rpppppppppppppppprp..",
      "..rpPPPPPPPPPPPPPPPrp..",
      "..rp...............rp..",
      "..rp...............rp..",
      "..rp...............rp..",
    ],
    9,
    49,
  );
});

// ---- Poses.

type ArmName = "hug" | "tap" | "w1" | "w2" | "w3" | "up";
/** Where the waving (far) paw goes, by beat. */
const FAR_WAVE: Record<string, Pt> = { up: [49, 26], w1: [50, 21], w2: [53, 21], w3: [55, 24] };
interface Pose {
  mood?: Mood;
  /** The upper body down this many pixels (a breath, a squash). */
  bob?: number;
  air?: number;
  dx?: number;
  /** The head on the body. */
  hx?: number;
  hy?: number;
  /** How hard it hugs the balloon (0 to 2; negative: the spring back). */
  sq?: number;
  bx?: number;
  by?: number;
  tail?: number;
  ears?: "up" | "down" | "perk";
  arm?: ArmName;
  feet?: { n?: { x?: number; lift?: number }; f?: { x?: number; lift?: number } };
  sit?: "stool" | "ground";
  sway?: number;
  noShadow?: boolean;
}

function build(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const air = p.air ?? 0;
  const bob = p.bob ?? 0;
  const s = p.sq ?? 0;
  const uy = bob - air + (p.sit === "stool" ? -8 : p.sit === "ground" ? 3 : 0);
  const layers: Layer[] = [];
  const put = (pp: Painted, ox: number, oy: number) => layers.push({ part: pp.name, x: pp.at[0] + ox, y: pp.at[1] + oy });

  if (!p.noShadow) put(SHADOW, dx, 0);
  if (p.sit === "stool") put(STOOL, dx, 0);
  put(tail(p.tail ?? 0), dx, uy);

  // The legs: standing on its hind legs, dangling off a stool, or sat on the ground with its feet out front.
  let farLeg: Painted;
  let nearLeg: Painted;
  if (p.sit === "stool") {
    const sw = p.feet?.n?.x ?? 0;
    farLeg = leg([[28, 44 + bob], [33, 46 + bob], [35 - sw, 51]], [36.5 - sw, 52.8], true);
    nearLeg = leg([[22, 44 + bob], [28, 47 + bob], [30 + sw, 52]], [31.5 + sw, 53.8], false);
  } else if (p.sit === "ground") {
    farLeg = leg([[27, 54 + bob], [33, 56]], [36, 55], true, true);
    nearLeg = leg([[21, 54 + bob], [28, 56.5]], [31.5, 56], false, true);
  } else {
    const fn = p.feet?.n ?? {};
    const ff = p.feet?.f ?? {};
    farLeg = leg([[27, 51 + bob - air], [31 + (ff.x ?? 0), 55 - air - (ff.lift ?? 0)]], [33 + (ff.x ?? 0), 57 - air - (ff.lift ?? 0)], true);
    nearLeg = leg([[21, 51 + bob - air], [24 + (fn.x ?? 0), 56 - air - (fn.lift ?? 0)]], [26 + (fn.x ?? 0), 58 - air - (fn.lift ?? 0)], false);
  }
  put(farLeg, dx, 0);

  // Where the balloon sits: at its chest, or in its lap.
  const bxo = dx + (p.bx ?? 0) + (p.sit === "stool" ? -1 : 0);
  const byo = uy + (p.by ?? 0) + (p.sit === "stool" ? 2 : p.sit === "ground" ? -1 : 0);
  const arm = p.arm ?? "hug";
  const pawX = Math.min(57 - bxo, Math.round(BCX + BRX * bm(s, WY)) - 1);
  const waving = arm === "w1" || arm === "w2" || arm === "w3" || arm === "up";
  if (waving) {
    // The far paw comes up from behind the balloon and waves over its shoulder, pink pads out.
    const q = FAR_WAVE[arm]!;
    const a = nearArm([48, 38], [Math.round((48 + q[0]) / 2) + 1, 31], q, true);
    put(a, bxo, byo);
  } else {
    // The far paw round the balloon's side.
    put(FAR_PAW, bxo + pawX - FAR_PAW_AT[0], byo);
  }

  put(BODY, dx, uy);
  if (p.sit !== "ground") put(nearLeg, dx, 0);
  put(balloon(s), bxo, byo);
  put(balloonString(s, p.sway ?? 0, 59 - byo), bxo, byo);
  // Plopped on the ground, its feet stick out in front of the balloon.
  if (p.sit === "ground") put(nearLeg, dx, 0);

  const ex = p.ears === "down" ? [-2, 2, 2, 2] : p.ears === "perk" ? [0, -1, 0, -1] : [0, 0, 0, 0];
  const hx = dx + (p.hx ?? 0);
  const hy = uy + (p.hy ?? 0);
  put(EAR_N, hx + ex[0]!, hy + ex[1]!);
  put(EAR_F, hx + ex[2]!, hy + ex[3]!);
  put(headPart(p.mood ?? "calm"), hx, hy);

  // The near arm: hugging across the balloon's front (tighter in a squeeze), tapping it, or up in a wave.
  const sh: Pt = [28, 39 + uy];
  const bpX = BCX + (p.bx ?? 0) + (p.sit === "stool" ? -1 : 0);
  const paw: Pt = [bpX - (s >= 1 ? 1 : 0), WY + byo - (arm === "tap" ? 3 : 0)];
  const el: Pt = [Math.round((sh[0] + paw[0]) / 2) - 1 + (s >= 1 ? 1 : 0), Math.max(sh[1], paw[1]) + 3 - (s >= 1 ? 1 : 0)];
  const a = nearArm(sh, el, paw, false);
  layers.push({ part: a.name, x: a.at[0] + dx, y: a.at[1] });
  return layers;
}

// ---- Little effects.

function seeded(seed: number): () => number {
  let v = (seed * 2654435761) >>> 0 || 1;
  return () => ((v = (v * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}
const star = (x: number, y: number, k = "Y"): Speck[] => [[x, y, "w"], [x - 1, y, k], [x + 1, y, k], [x, y - 1, k], [x, y + 1, k]];
/** A little heart floating up. */
const heart = (x: number, y: number): Speck[] =>
  (["HH.HH", "HwHHH", ".HHH.", "..H.."] as const).flatMap((row, j) => [...row].flatMap((k, i): Speck[] => (k === "." ? [] : [[x + i, y + j, k]])));
const smallHeart = (x: number, y: number): Speck[] => [[x, y, "H"], [x + 2, y, "H"], [x, y + 1, "H"], [x + 1, y + 1, "H"], [x + 2, y + 1, "H"], [x + 1, y + 2, "H"]];
function twinkles(t: number, n = 3, box: readonly [number, number, number, number] = [4, 4, 58, 40]): Speck[] {
  const rnd = seeded(t * 31 + 5);
  return Array.from({ length: n }, (_, i) => star(Math.round(box[0] + rnd() * (box[2] - box[0])), Math.round(box[1] + rnd() * (box[3] - box[1])), (i + t) % 2 ? "Y" : "i")).flat();
}
/** Confetti in Babur's balloon colors. */
function confetti(t: number, n = 9): Speck[] {
  const rnd = seeded(t * 17 + 3);
  const keys = ["R", "B", "G", "L", "H"];
  return Array.from({ length: n }, (_, i): Speck[] => {
    const x = Math.round(3 + rnd() * 57);
    const y = Math.round(2 + ((rnd() * 40 + t * 3) % 44));
    const k = keys[(i + t) % keys.length]!;
    return rnd() > 0.5 ? [[x, y, k], [x + 1, y, k]] : [[x, y, k], [x, y + 1, k]];
  }).flat();
}
const dust = (t: number): Speck[] =>
  [-1, 1].flatMap((side) => [0, 1, 2].map((i): Speck => [Math.round(28 + side * (11 + i * 3 + t * 2)), GROUND - 1 - (i % 2) - (t > 0 ? 1 : 0), t > 1 ? "U" : "u"]));
const thoughts = (n: number): Speck[] =>
  ([[40, 15], [44, 11], [49, 7]] as const).slice(0, n).flatMap(([x, y], k): Speck[] => {
    const big = k === 2;
    return [[x, y, "o"], [x + 1, y, "o"], [x, y + 1, "o"], [x + 1, y + 1, "O"], ...(big ? ([[x - 1, y, "o"], [x + 2, y, "o"], [x, y - 1, "o"], [x + 1, y - 1, "o"], [x - 1, y + 1, "o"], [x + 2, y + 1, "O"], [x, y + 2, "O"], [x + 1, y + 2, "O"]] as Speck[]) : [])];
  });
const sweat = (i: number): Speck[] => {
  const t = i % 3;
  return [[10 - t, 18 + t, "j"], [10 - t, 19 + t, "w"], [37 + t, 13 + t, "j"], [37 + t, 14 + t, "w"]];
};
/** A tiny roar: little sound arcs out of its mouth. */
const roarLines = (t: number): Speck[] => {
  const x = 43 + t;
  const y = 20 - Math.min(t, 1);
  return [[x, y + 1, "w"], [x + 1, y + 2, "w"], [x + 1, y + 3, "w"], [x + 1, y + 4, "w"], [x, y + 5, "w"], [x + 3, y - 1, "Y"], [x + 4, y, "Y"], [x + 4, y + 1, "Y"], [x + 4, y + 2, "Y"], [x + 4, y + 3, "Y"], [x + 4, y + 4, "Y"], [x + 4, y + 5, "Y"], [x + 3, y + 6, "Y"]];
};
const tear = (t: number): Speck[] => [[17, 30 + t, "j"], [17, 31 + t, "w"]];
/** "Boing" lines round the balloon as it springs back. */
const boing = (dx = 0): Speck[] => [[55 + dx, 33, "5"], [56 + dx, 32, "5"], [55 + dx, 52, "5"], [56 + dx, 53, "5"]];

const FLASH: Record<string, string> = { a: "#b05a30", b: "#e08040", c: "#ffaa60", d: "#ffc890", e: "#ffe4c0", f: "#e8d8c0", g: "#fff2dc", h: "#ffffff" };

function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const specks = (extra.specks ?? []).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: build(p), ...extra, specks };
}

// ---- Animations.

/** Idle (3 s): sways, breathes, blinks, swishes its tail; once a loop a big happy squeeze, and the balloon springs back. */
const SQ_IDLE: Record<number, number> = { 15: 1, 16: 2, 17: 2, 18: 2, 19: 1, 20: -1, 21: 0 };
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 30 }, (_, i) => {
    const th = (i / 30) * Math.PI * 2;
    const sq = SQ_IDLE[i] ?? 0;
    const squeezing = sq >= 1;
    const blink = i === 7 || i === 8 || i === 26;
    const sway = Math.round(Math.sin(th) * 1.2);
    return f(100, {
      mood: squeezing ? "squeeze" : blink ? "blink" : "calm",
      bob: (i % 10 >= 5 ? 1 : 0) + (sq === 2 ? 1 : 0),
      hx: squeezing ? 1 : sway > 0 ? 1 : 0,
      hy: squeezing ? 1 : 0,
      bx: sway < 0 ? 0 : 0,
      sq,
      tail: Math.round(Math.sin(th * 2) * 2),
      ears: i === 22 ? "perk" : "up",
      sway: i * 0.4,
    }, {
      specks: i >= 17 && i <= 22 ? heart(44, 26 - (i - 17) * 2) : i === 20 ? boing() : [],
    });
  }),
};

/** Walk (0.6 s): a waddly trot on its hind legs, the balloon hugged to its chest, head bobbing. */
const walk: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) => {
    const th = (i / 6) * Math.PI * 2;
    const leg = (off: number) => ({ x: Math.round(3.4 * Math.sin(th + off)), lift: Math.max(0, Math.round(3.6 * Math.cos(th + off))) });
    const bob = [0, 1, 2, 0, 1, 2][i]!;
    return f(100, { mood: "calm", bob, hy: bob === 2 ? -1 : 0, hx: i < 3 ? 1 : 0, by: bob === 2 ? -1 : 0, feet: { n: leg(0), f: leg(Math.PI) }, tail: i < 3 ? 2 : -1, sway: i, ears: bob === 2 ? "perk" : "up" }, i % 3 === 0 ? { cue: "step" } : {});
  }),
};

/** Sit (loops): on a stool at the table, facing the board, feet dangling, the balloon in its lap; a slow blink, a think. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const thinking = i >= 7 && i <= 12;
    const blink = i === 3 || i === 4 || i === 11;
    return f(200, {
      sit: "stool",
      mood: blink ? (thinking ? "thinkBlink" : "blink") : thinking ? "think" : "calm",
      bob: i % 8 >= 4 ? 1 : 0,
      hx: thinking ? 1 : 0,
      hy: thinking ? 1 : 0,
      feet: { n: { x: i % 4 < 2 ? 0 : 1 } },
      tail: i % 8 < 4 ? 0 : 1,
      sq: i === 14 ? 1 : 0,
      sway: i * 0.3,
    }, { specks: thinking ? thoughts(Math.min(3, i - 6)) : [] });
  }),
};

/** Wave (once, 1.2 s): peeks round the balloon and waves a paw hello, the other arm still hugging; then settles back. */
const WAVES: readonly ArmName[] = ["w1", "w2", "w3", "w2", "w1", "w2", "w3", "w2"];
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { mood: "cheer", hx: 1, hy: -1, arm: "up", ears: "perk" }),
    ...WAVES.map((arm, i) => f(100, { mood: i % 4 === 3 ? "happy" : "cheer", arm, hx: 1 + (i % 2), hy: -1, bob: i % 2, tail: i % 2 ? 2 : -1, ears: "perk" }, { specks: i === 1 || i === 5 ? star(54, 20 + (i % 3)) : [] })),
    f(100, { mood: "happy", hx: 1, sq: 1 }),
    f(100, { mood: "calm", sq: -1 }),
    f(100, { mood: "calm" }),
  ],
};

/** Entrance: waddles in from the left, stops, and gives the balloon a big happy squeeze. */
const entrance: Anim = {
  loop: false,
  frames: [
    ...Array.from({ length: 9 }, (_, i) => {
      const th = (i / 6) * Math.PI * 2;
      const leg = (off: number) => ({ x: Math.round(2.5 * Math.sin(th + off)), lift: Math.max(0, Math.round(2.5 * Math.cos(th + off))) });
      return f(90, { mood: "calm", dx: -36 + i * 4, bob: i % 3 === 0 ? 0 : 1, hx: i % 6 < 3 ? 1 : 0, feet: { n: leg(0), f: leg(Math.PI) }, tail: i % 2 ? 2 : -1, sway: i }, i % 3 === 0 ? { cue: "step" } : {});
    }),
    f(110, { mood: "cheer", hy: -1, ears: "perk" }),
    f(100, { mood: "squeeze", sq: 1, hx: 1, hy: 1 }),
    f(260, { mood: "squeeze", sq: 2, bob: 1, hx: 1, hy: 1 }, { specks: heart(44, 22) }),
    f(90, { mood: "happy", sq: -1 }, { specks: [...heart(45, 18), ...boing()] }),
    f(300, { mood: "calm" }),
  ],
};

/** Thinking (loops): chin on the balloon, eyes rolled up, a paw tapping the balloon, thought bubbles. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", hx: 1, hy: 1, arm: i % 4 < 2 ? "tap" : "hug", bob: i % 6 >= 3 ? 1 : 0, tail: i % 6 < 3 ? 1 : -1, sway: i * 0.5 }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a little hop toward the board, a squeeze as it lands. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { mood: "bold", bob: 2 }),
    f(80, { mood: "cheer", air: 4, dx: 1, ears: "perk", feet: { n: { lift: 1 }, f: { lift: 1 } } }, { cue: "step" }),
    f(80, { mood: "cheer", air: 5, dx: 2, ears: "perk", by: 1 }),
    f(100, { mood: "squeeze", bob: 2, dx: 2, sq: 1, hx: 1, hy: 1 }, { specks: dust(0) }),
    f(100, { mood: "happy", bob: 1, dx: 2, sq: -1 }, { specks: dust(1) }),
    f(110, { mood: "happy", dx: 1 }),
    f(150, { mood: "calm" }),
  ],
};

/** A capture: bounces for joy, squeezing the balloon at each landing, hearts and twinkles. */
const capture: Anim = {
  loop: false,
  frames: [
    f(80, { mood: "bold", bob: 2 }),
    f(80, { mood: "cheer", air: 5, ears: "perk", by: 1, feet: { n: { lift: 1 }, f: { lift: 2 } } }, { cue: "step", specks: twinkles(1) }),
    f(80, { mood: "happy", air: 6, ears: "perk", by: 2 }, { specks: twinkles(2) }),
    f(80, { mood: "happy", air: 3, by: 1 }),
    f(100, { mood: "squeeze", bob: 2, sq: 2, hx: 1, hy: 1 }, { specks: [...dust(0), ...heart(46, 20)] }),
    f(80, { mood: "cheer", air: 5, sq: -1, ears: "perk", by: 1 }, { specks: [...twinkles(3), ...heart(47, 16)] }),
    f(80, { mood: "happy", air: 6, ears: "perk", by: 2 }, { specks: twinkles(4) }),
    f(80, { mood: "happy", air: 3, by: 1 }),
    f(120, { mood: "squeeze", bob: 2, sq: 2, hx: 1, hy: 1 }, { specks: [...dust(1), ...heart(45, 20), ...smallHeart(52, 26)] }),
    f(100, { mood: "happy", sq: -1 }, { specks: [...heart(46, 15), ...boing()] }),
    f(160, { mood: "smug" }),
  ],
};

/** Hurt: a flash, eyes screwed shut, clutching the balloon tight (it squishes, never pops); then a brave little smile. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { mood: "hurt", bob: 2, sq: 2, ears: "down", hx: -1 }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(80, { mood: "hurt", bob: 2, sq: 2, ears: "down", hx: -1, dx: -1 }, { shake: [-1, 0], specks: sweat(0) }),
    f(90, { mood: "hurt", bob: 1, sq: 2, ears: "down", dx: -1 }, { specks: sweat(1) }),
    f(100, { mood: "rattled", bob: 1, sq: 1, ears: "down" }),
    f(110, { mood: "blink", sq: -1 }),
    f(120, { mood: "calm", hx: 1 }),
    f(160, { mood: "calm" }),
  ],
};

/** Check: copies the big one, a tiny roar at the board (squeaky, not scary), then a proud little bounce. */
const check: Anim = {
  loop: false,
  frames: [
    f(100, { mood: "bold", bob: 1, ears: "perk" }),
    f(90, { mood: "bold", hy: -1, ears: "perk" }),
    f(130, { mood: "roar", hx: 2, hy: -1, ears: "perk", dx: 1, sq: 1 }, { cue: "roar", specks: roarLines(0) }),
    f(130, { mood: "roar", hx: 2, hy: -1, ears: "perk", dx: 1, sq: 1 }, { shake: [1, 0], specks: roarLines(1) }),
    f(130, { mood: "roar", hx: 2, ears: "perk", dx: 1, sq: 1 }, { specks: roarLines(2) }),
    f(110, { mood: "cheer", hx: 1, sq: -1 }),
    f(160, { mood: "smug" }),
  ],
};

/** Smug (loops): chin up, eyes half shut, a little smirk, a satisfied squeeze, its tail swishing. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    f(160, { mood: i === 4 || i === 5 ? "squeeze" : "smug", hy: i === 4 || i === 5 ? 0 : -1, hx: i === 4 || i === 5 ? 1 : 0, sq: i === 4 || i === 5 ? 1 : i === 6 ? -1 : 0, tail: i % 4 < 2 ? 2 : 0, ears: i === 2 ? "perk" : "up" }),
  ),
};

/** Rattled (loops): wide eyes, worried brows, sweat, ears flat, trembling and holding the balloon tight. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    f(80, { mood: "rattled", dx: i % 2 ? 1 : 0, bob: 1, sq: 1, ears: "down", hx: -1, tail: i % 2 ? 1 : -1 }, { specks: sweat(i) }),
  ),
};

/** Defeat: a flash, a wobble, it plops down on its bottom, ears down, sniffling and cuddling the balloon (the last frame holds). */
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { mood: "hurt", bob: 2, sq: 2, ears: "down" }, { cue: "poof", pal: FLASH, shake: [1, 0] }),
    f(100, { mood: "rattled", bob: 1, sq: 1, ears: "down", dx: -1 }),
    f(100, { mood: "rattled", bob: 1, sq: 1, ears: "down", dx: 1 }),
    f(110, { mood: "hurt", bob: 3, ears: "down" }),
    f(120, { mood: "sad", sit: "ground", ears: "down", sq: 2, by: 1 }, { cue: "step", specks: dust(0) }),
    f(200, { mood: "sad", sit: "ground", ears: "down", sq: 1, hx: 1, hy: 1 }, { specks: dust(1) }),
    f(200, { mood: "sadBlink", sit: "ground", ears: "down", sq: 2, hx: 1, hy: 1 }, { specks: tear(0) }),
    f(200, { mood: "sad", sit: "ground", ears: "down", sq: 1, hx: 1, hy: 1 }, { specks: tear(2) }),
    f(1000, { mood: "sad", sit: "ground", ears: "down", sq: 1, hx: 1, hy: 1 }, { specks: tear(4) }),
  ],
};

/** Victory (loops): hops for joy with its balloon, a squeeze at every landing, confetti in Babur's balloon colors. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 6, 7, 6, 3, 0, 0, 3, 6, 3, 0][i]!;
    const landing = i === 0 || i === 6 || i === 11;
    return f(100, {
      mood: landing ? "squeeze" : air > 4 ? "happy" : "cheer",
      air,
      bob: landing ? 2 : 0,
      sq: landing ? 2 : i === 1 || i === 7 ? -1 : 0,
      hx: landing ? 1 : 0,
      hy: landing ? 1 : 0,
      by: air > 4 ? 1 : 0,
      feet: air > 2 ? { n: { lift: 1 }, f: { lift: 2 } } : {},
      ears: air > 3 ? "perk" : "up",
      tail: i % 2 ? 2 : -1,
      sway: i,
    }, { specks: [...confetti(i), ...(landing ? heart(46, 18) : [])], cue: i === 1 ? "step" : undefined });
  }),
};

export const sidekickBaburOpus: Character = {
  id: "sidekick-babur-opus",
  name: "Babur's sidekick",
  w: W,
  h: H,
  foot: [29, GROUND],
  palette: CUB_PALETTE,
  halo: "#2e2218",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
