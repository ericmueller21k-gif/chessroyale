/**
 * The Stranger (code id `stranger`, a working name: Eric will name him "___ Stranger"; Eric's words, Nov 27: "a human ... the anti-king
 * ... a more anime, traditional kind of boss ... no IP stealing here ... generic"). His art only: his rules, powers, unlock and tower
 * place come in their own job (docs/decisions/2026-11-27-stranger-art.md).
 *
 * An original JRPG swordsman, drawn facing front, light from the top left, in a 128 x 128 frame, his feet at [64, 122], about 100 px
 * from his boots to his crown's tips: long white hair parted over his brow and draped down both sides of him to his waist; pale skin, a
 * narrow face, one ember eye and one ice eye; a long midnight-indigo trench coat of his own cut (a standing collar, gold trim, open
 * from the belt down over dark trousers, its crimson lining showing as its tails swing: the trench-coat idea of the Hidden Boss's final
 * form, cut and colored anew, no pauldrons); dark gloves and boots; and his crown, a grander Fire & Ice crown than the player's item:
 * a gold band with a split ruby-and-sapphire jewel, flame points rising on his right (our left) and ice spikes on his left.
 *
 * Two swords, worn crossed in an X on his back (their hilts over his shoulders) and drawn before a move: the fire sword in his right hand
 * (our left), its blade ember red to a white-hot edge with sparks; the ice sword in his left, pale cyan to white with frost. His aura is
 * a soft two-tone glow round him, fire on our left, ice on our right: a ring a few pixels wide off his outline, one part per frame of
 * his idle's flicker (no outline, see-through), cheap to draw.
 *
 * Rigging (`StrangerPose`): the whole figure is painted from a pose's numbers and cached by them (Chandy's way): the breath (`bob`),
 * the hair's and coat's sway (`sway`), each arm (shoulder fixed; elbow and hand), each sword (on his back, or held: its grip and angle),
 * his face (eyes, mouth), his head's tilt, and a drop to one knee (`kneel`). Every part is painted the first time a frame shows it.
 */
import { lazyAnimsTogether, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

const lazyAnim = lazyAnimsTogether();

export type Pt = readonly [number, number];
type Cv = string[][];

export const STRANGER_PALETTE: Record<string, string> = {
  k: "#120e1a", // outline
  a: "#8f5b54", // skin: shade to light (pale)
  b: "#c48a7c",
  c: "#e8b9a4",
  d: "#f8dccb",
  H: "#5f5b7d", // hair: white, lavender-gray shade to white
  h: "#8f8cae",
  j: "#c3c1d8",
  J: "#e9e8f3",
  W: "#ffffff",
  B: "#7d7a9a", // brows
  w: "#f1eef6", // eye whites
  r: "#ff8a32", // his right eye (our left): ember, and its dark
  R: "#b33a12",
  i: "#7fe6ff", // his left eye: ice, and its dark
  I: "#2a7fb8",
  x: "#140b12", // pupils, lashes
  m: "#7a3c40", // mouth
  "1": "#151330", // the coat: midnight indigo, deep shade to light
  "2": "#222050",
  "3": "#33336e",
  "4": "#474c90",
  "5": "#6670b4",
  e: "#4a1022", // its lining: crimson, shade and light
  E: "#842033",
  g: "#7a5418", // gold trim, dark to bright
  G: "#c08a26",
  o: "#f2c14e",
  O: "#ffe58a",
  t: "#17151f", // tunic and trousers: dark to light
  T: "#2a2734",
  u: "#423d50",
  n: "#191214", // boots: dark to light
  N: "#2f2428",
  M: "#4d3b40",
  l: "#1e1a26", // gloves: dark and light
  L: "#3b3446",
  p: "#5e1208", // the fire blade: dark rim, red, orange, gold, white-hot
  P: "#bf3216",
  q: "#ff7a2a",
  Q: "#ffc45a",
  y: "#fff3b8",
  s: "#18426b", // the ice blade: deep, blue, cyan, pale, (white W)
  S: "#3a8cc4",
  v: "#7fd6ff",
  V: "#cdf5ff",
  A: "#56627a", // the ice sword's silver guard: dark and light
  C: "#aebbd2",
  D: "#5a1a16", // the fire grip's wrap
  Z: "#1b2c52", // the ice grip's wrap
  X: "#d8203a", // the crown's jewel: ruby half, sapphire half
  K: "#2f9bff",
  "6": "#ff5a1e66", // the aura: fire, outer and inner (see-through)
  "7": "#ff7420b0",
  "8": "#3fc0ff50", // ice, outer and inner
  "9": "#8fe6ff99",
  z: "#0c0d12", // ground shadow
};

export const STRANGER_W = 128;
export const STRANGER_H = 128;
const GROUND = 122;
const MID = 64;
export const STRANGER_FOOT: Pt = [MID, GROUND];

// ---- Painting helpers (whole pixels, one key a pixel, lit from the top left).

const cvs = (w = STRANGER_W, h = STRANGER_H): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const get = (c: Cv, x: number, y: number) => c[y]?.[x] ?? ".";
const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const N4: readonly Pt[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Lays `src` over `dst`. Its own outline goes only where it meets what's under it (the figure's outer outline is the renderer's ring),
 * so every piece keeps a 1-pixel dark edge against the next, as every part of ours does.
 */
function lay(dst: Cv, src: Cv, ring = true): void {
  if (ring)
    for (let y = 0; y < src.length; y++)
      for (let x = 0; x < src[0]!.length; x++) {
        if (src[y]![x] !== ".") continue;
        if (get(dst, x, y) === "." || get(dst, x, y) === "k") continue;
        if (N4.some(([dx, dy]) => get(src, x + dx, y + dy) !== ".")) dst[y]![x] = "k";
      }
  for (let y = 0; y < src.length; y++) for (let x = 0; x < src[0]!.length; x++) if (src[y]![x] !== ".") dst[y]![x] = src[y]![x]!;
}

/** Fills a polygon's pixels with `key(x, y)`. */
function fillPoly(c: Cv, pts: readonly Pt[], key: (x: number, y: number) => string | null): void {
  const ys = pts.map((p) => p[1]);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(c.length - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    pts.forEach(([ax, ay], i) => {
      const [bx, by] = pts[(i + 1) % pts.length]!;
      if (ay <= yc !== by <= yc) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
    });
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2)
      for (let x = Math.ceil(xs[i]! - 0.5); x <= Math.floor(xs[i + 1]! - 0.5); x++) {
        const k = key(x, y);
        if (k) put(c, x, y, k);
      }
  }
}

/** A thick limb along points `pts`, radius `r0` at its start to `r1` at its end, shaded as a cylinder lit from the top left. */
function limb(c: Cv, pts: readonly Pt[], r0: number, r1: number, rampKeys: string, extra?: (x: number, y: number, along: number) => string | null | undefined): void {
  const total = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]), 0) || 1;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const R = Math.max(r0, r1) + 1;
  for (let y = Math.floor(Math.min(...ys) - R); y <= Math.ceil(Math.max(...ys) + R); y++)
    for (let x = Math.floor(Math.min(...xs) - R); x <= Math.ceil(Math.max(...xs) + R); x++) {
      let best = { d: Infinity, along: 0, side: 0, r: 0 };
      let run = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        const vx = b[0] - a[0];
        const vy = b[1] - a[1];
        const L = Math.hypot(vx, vy) || 1;
        const px = x + 0.5 - a[0];
        const py = y + 0.5 - a[1];
        const t = Math.max(0, Math.min(1, (px * vx + py * vy) / (L * L)));
        const dx = px - t * vx;
        const dy = py - t * vy;
        const d = Math.hypot(dx, dy);
        const along = (run + t * L) / total;
        const r = r0 + (r1 - r0) * along;
        if (d - r < best.d - best.r) best = { d, along, side: (dx * -vy + dy * vx) / L, r };
        run += L;
      }
      if (best.d > best.r) continue;
      const k = extra?.(x, y, best.along);
      if (k === null) continue;
      if (k) {
        put(c, x, y, k);
        continue;
      }
      // (Light from the top left: the limb's left side lit.)
      const l = 0.55 - (best.side / Math.max(1, best.r)) * 0.32 - (x - MID) * 0.004;
      put(c, x, y, ramp(rampKeys, l));
    }
}

// ---- His pose.

/** A sword: on his back (the X, its hilt over that shoulder), or held, its grip at `at`, its blade's angle `deg` (0 up, clockwise). */
export type SwordHold = "back" | { at: Pt; deg: number };

export interface StrangerPose {
  /** The breath: his body 0 or 1 px down. */
  bob?: number;
  /** Hair and coat tails: -1 to 1 (+ to our right). */
  sway?: number;
  /** His right arm (our left), his left arm (our right): elbow, hand. */
  armF: readonly [Pt, Pt];
  armI: readonly [Pt, Pt];
  swordF: SwordHold;
  swordI: SwordHold;
  eyes?: "open" | "narrow" | "shut" | "wide";
  mouth?: "flat" | "smirk" | "grit" | "open";
  /** The head's offset (a flinch, a bow). */
  head?: Pt;
  /** Down on one knee, 0 standing to 1 kneeling. */
  kneel?: number;
}

/** His arms at rest, hanging at his sides (relative to nothing: frame px). */
export const ARMS = {
  hangF: [
    [45, 72],
    [44, 86],
  ],
  hangI: [
    [83, 72],
    [84, 86],
  ],
} as const satisfies Record<string, readonly [Pt, Pt]>;

const SHOULDER_F: Pt = [49, 57];
const SHOULDER_I: Pt = [79, 57];

// ---- The pieces.

/** A sword with its grip at `at`, its blade at `deg` (0 up, clockwise). Its blade is 36 px, its guard 9 across, its grip 7. */
export const BLADE = 36;
function paintSword(c: Cv, kind: "fire" | "ice", at: Pt, deg: number, phase = 0): void {
  const r = (deg * Math.PI) / 180;
  const u: Pt = [Math.sin(r), -Math.cos(r)]; // along the blade
  const v: Pt = [Math.cos(r), Math.sin(r)]; // across it (to its right)
  const L = BLADE;
  const box = L + 12;
  for (let y = Math.floor(at[1] - box); y <= Math.ceil(at[1] + box); y++)
    for (let x = Math.floor(at[0] - box); x <= Math.ceil(at[0] + box); x++) {
      const px = x + 0.5 - at[0];
      const py = y + 0.5 - at[1];
      const s = px * u[0] + py * u[1]; // along: 0 at the grip's middle
      const t = px * v[0] + py * v[1]; // across
      let k: string | null = null;
      if (s >= -5 && s < 3 && Math.abs(t) <= 1.05) {
        // The grip, wrapped; the pommel at its end.
        k = s < -3.5 ? (kind === "fire" ? "G" : "C") : (Math.floor(s + 10) % 2 === 0) ? (kind === "fire" ? "D" : "Z") : "l";
      } else if (s >= 3 && s < 5 && Math.abs(t) <= 4.6) {
        // The guard: gold for fire (flared into points), silver for ice.
        const lit = t < 0 ? 1 : 0;
        k = kind === "fire" ? (Math.abs(t) > 3.6 ? "o" : lit ? "O" : "G") : Math.abs(t) > 3.6 ? "V" : lit ? "C" : "A";
      } else if (s >= 5 && s < 5 + L) {
        const along = (s - 5) / L;
        const half = along > 0.8 ? 1.9 * (1 - (along - 0.8) / 0.2) + 0.2 : 1.9;
        if (Math.abs(t) > half) continue;
        const e = t / Math.max(0.6, half); // -1 one edge, +1 the other
        if (kind === "fire") k = Math.abs(e) > 0.66 ? (e < 0 ? "Q" : "P") : Math.abs(e) > 0.2 ? (e < 0 ? "y" : "q") : "y";
        else k = Math.abs(e) > 0.66 ? (e < 0 ? "V" : "S") : Math.abs(e) > 0.2 ? (e < 0 ? "W" : "v") : "V";
        // (A fuller line down its middle, dark.)
        if (Math.abs(t) < 0.5 && along < 0.75) k = kind === "fire" ? "q" : "S";
      }
      if (k) put(c, x, y, k);
    }
  // Sparks off the fire blade's edge, frost notches on the ice one: a few pixels by the phase.
  for (let i = 0; i < 4; i++) {
    const s = 9 + ((i * 9 + phase * 4) % (L - 6));
    const side = (i + phase) % 2 ? 1 : -1;
    const p: Pt = [at[0] + u[0] * s + v[0] * side * 3, at[1] + u[1] * s + v[1] * side * 3];
    if (get(c, Math.round(p[0]), Math.round(p[1])) === ".") put(c, p[0], p[1], kind === "fire" ? (i % 2 ? "Q" : "q") : i % 2 ? "W" : "v");
  }
}

/** Where a sword on his back sits: its grip just over that shoulder, the blade down across his back (an X with the other). */
const BACK_F = { at: [44, 39] as Pt, deg: 140 };
const BACK_I = { at: [84, 39] as Pt, deg: -140 };

function paintBackHair(c: Cv, oy: number, sway: number): void {
  // The long fall behind him: from the crown of his head down to his waist, wider toward its ends, its tips swaying.
  const s = sway * 1.5;
  fillPoly(
    c,
    [
      [54, 26 + oy],
      [74, 26 + oy],
      [78, 46 + oy],
      [81 + s, 74 + oy],
      [80 + s, 90 + oy],
      [76 + s, 86 + oy],
      [64, 78 + oy],
      [52 + s, 86 + oy],
      [48 + s, 90 + oy],
      [47 + s, 74 + oy],
      [50, 46 + oy],
    ],
    (x, y) => {
      const strand = (x + Math.floor(y / 11)) % 4;
      const l = 0.45 - (x - MID) * 0.012 + (strand === 0 ? -0.3 : strand === 2 ? 0.14 : 0);
      return ramp("Hhj", l);
    },
  );
}

function paintLegs(c: Cv, oy: number, kneel: number): void {
  const thigh = "tTu";
  if (kneel <= 0) {
    limb(c, [[59, 84 + oy], [59, 100], [58, 112]], 3.6, 3.0, thigh);
    limb(c, [[69, 84 + oy], [69, 100], [70, 112]], 3.6, 3.0, thigh);
    paintBoot(c, 58, false);
    paintBoot(c, 70, true);
    return;
  }
  // Down on his left knee (our right), his right foot planted (our left), his knee up.
  const d = Math.round(10 * kneel);
  limb(c, [[59, 84 + d], [55, 104], [56, 112]], 3.6, 3.0, thigh);
  paintBoot(c, 56, false);
  limb(c, [[69, 84 + d], [71, 112 - 2 * kneel], [73, 119]], 3.6, 3.2, thigh);
  // (His shin folded behind, its boot's toe on the ground.)
  fillPoly(c, [[70, 117], [77, 117], [78, 121], [69, 121]], (x) => ramp("nNM", 0.6 - (x - 70) * 0.06));
}

function paintBoot(c: Cv, x0: number, right: boolean): void {
  const toe = right ? 2 : -2;
  fillPoly(
    c,
    [
      [x0 - 3.5, 106],
      [x0 + 3.5, 106],
      [x0 + 3.8 + Math.max(0, toe), 121],
      [x0 - 3.8 + Math.min(0, toe), 121],
    ],
    (x, y) => (y === 110 ? (x === Math.round(x0) ? "o" : "g") : ramp("nNM", 0.75 - (x - x0 + 3) * 0.1 - (y - 106) * 0.01)),
  );
}

/** The coat: its standing collar, its shoulders and body to the belt, and its skirt to below the knees, open from the belt down. */
function paintCoat(c: Cv, oy: number, sway: number, kneel: number): void {
  const d = Math.round(10 * kneel);
  const s = sway;
  // The lining, behind the open skirt (between his legs).
  fillPoly(
    c,
    [
      [56, 82 + oy],
      [72, 82 + oy],
      [75 + s, 108 + d * 0.7],
      [53 + s, 108 + d * 0.7],
    ],
    (x, y) => (x < 57 || x > 71 ? "e" : null),
  );
  const body = cvs();
  // The torso: shoulders (56..) to the waist.
  fillPoly(
    body,
    [
      [52, 52 + oy],
      [76, 52 + oy],
      [82, 56 + oy],
      [81, 64 + oy],
      [77, 80 + oy],
      [51, 80 + oy],
      [47, 64 + oy],
      [46, 56 + oy],
    ],
    (x, y) => ramp("12345", 0.62 - (x - 46) * 0.014 - (y - 52 - oy) * 0.006),
  );
  // The skirt's two fronts, flaring, their tails swinging; open between them below the belt.
  const hem = 109 + d * 0.7;
  const left: Pt[] = [
    [51, 80 + oy],
    [62, 80 + oy],
    [60, 88 + oy],
    [55 + s, hem - 1],
    [44 + s * 1.6, hem + 1],
    [46 + s * 0.6, 94],
  ];
  const right: Pt[] = [
    [66, 80 + oy],
    [77, 80 + oy],
    [82 + s * 0.6, 94],
    [84 + s * 1.6, hem + 1],
    [73 + s, hem - 1],
    [68, 88 + oy],
  ];
  fillPoly(body, left, (x, y) => ramp("12345", 0.6 - (x - 44) * 0.02 + (y - 80) * -0.003 + ((x + Math.floor(y / 4)) % 6 === 0 ? -0.15 : 0)));
  fillPoly(body, right, (x, y) => ramp("12345", 0.44 - (x - 66) * 0.02 + ((x + Math.floor(y / 4)) % 6 === 0 ? -0.15 : 0)));
  // The open front above the belt: the dark tunic in a V under the collar.
  fillPoly(
    body,
    [
      [59, 52 + oy],
      [69, 52 + oy],
      [66, 78 + oy],
      [62, 78 + oy],
    ],
    (x, y) => (x === 64 && (y - oy) % 5 === 0 ? "u" : ramp("tT", 0.5 - (x - 64) * 0.08)),
  );
  // Gold trim down each front's edge and along the hem; the lining's crimson showing at the skirt's inner edge.
  for (let y = 52 + oy; y <= 79 + oy; y++) {
    const w = (y - 52 - oy) / 26;
    put(body, 59 + w * 3 - 1, y, "o");
    put(body, 69 - w * 3 + 1, y, "G");
  }
  const edge = (pts: Pt[], inner: number, keyOf: (y: number) => string) => {
    for (let y = Math.ceil(80 + oy); y <= hem; y++) {
      let xmin = Infinity;
      let xmax = -Infinity;
      for (let x = 0; x < STRANGER_W; x++)
        if (body[y]![x] !== "." && body[y]![x] !== "o" && body[y]![x] !== "G") {
          if (pts === left && x < 64) {
            xmin = Math.min(xmin, x);
            xmax = Math.max(xmax, x);
          }
          if (pts === right && x > 64) {
            xmin = Math.min(xmin, x);
            xmax = Math.max(xmax, x);
          }
        }
      if (xmax < 0) continue;
      put(body, inner > 0 ? xmax : xmin, y, keyOf(y));
    }
  };
  edge(left, 1, (y) => (y > 98 ? "E" : "o"));
  edge(right, -1, (y) => (y > 98 ? "e" : "G"));
  // The hem's trim.
  for (let x = 40; x < 90; x++)
    for (let y = Math.floor(hem) + 2; y >= 96; y--)
      if (body[y]![x] !== ".") {
        body[y]![x] = x < 64 ? "o" : "G";
        break;
      }
  // The belt and its buckle.
  for (let x = 50; x <= 78; x++) {
    if (body[79 + oy]![x] === ".") continue;
    put(body, x, 79 + oy, x >= 62 && x <= 66 ? "O" : "t");
    put(body, x, 80 + oy, x >= 62 && x <= 66 ? "G" : "T");
  }
  // The standing collar: high round his neck, gold-edged, open at his throat.
  fillPoly(
    body,
    [
      [55, 44 + oy],
      [60, 46 + oy],
      [60, 54 + oy],
      [53, 54 + oy],
    ],
    (x, y) => (y === 44 + oy || x === 55 ? "o" : ramp("2345", 0.7 - (x - 53) * 0.05)),
  );
  fillPoly(
    body,
    [
      [68, 46 + oy],
      [73, 44 + oy],
      [75, 54 + oy],
      [68, 54 + oy],
    ],
    (x, y) => (y === 44 + oy || x === 73 ? "G" : ramp("1234", 0.45 - (x - 68) * 0.05)),
  );
  lay(c, body);
}

/** An arm in the coat's sleeve, from the shoulder to the elbow and the wrist, its gold cuff and a dark glove. */
function paintArm(c: Cv, sh: Pt, [el, hand]: readonly [Pt, Pt], lit: boolean, oy: number): void {
  const a = cvs();
  const s: Pt = [sh[0], sh[1] + oy];
  const len = Math.hypot(hand[0] - el[0], hand[1] - el[1]) || 1;
  const wrist: Pt = [hand[0] - ((hand[0] - el[0]) / len) * 3, hand[1] - ((hand[1] - el[1]) / len) * 3];
  limb(a, [s, el, wrist], 4.2, 3.4, lit ? "2345" : "1234", (_x, _y, along) => (along > 0.93 ? (lit ? "o" : "G") : undefined));
  // The glove: a fist.
  const g = cvs();
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) put(g, hand[0] + x, hand[1] + y, x + y < -1 ? "L" : "l");
  lay(a, g);
  lay(c, a);
}

/** His head: the face, the bangs and side locks, the crown. */
function paintHead(c: Cv, pose: StrangerPose, ox: number, oy: number, sway: number): void {
  const hd = cvs();
  const cx = MID + ox;
  // The neck.
  fillPoly(hd, [[60 + ox, 44 + oy], [68 + ox, 44 + oy], [67 + ox, 52 + oy], [61 + ox, 52 + oy]], (x) => ramp("abc", 0.5 - (x - 60 - ox) * 0.07));
  // The face: a narrow oval, its chin pointed.
  fillPoly(
    hd,
    [
      [54 + ox, 29 + oy],
      [74 + ox, 29 + oy],
      [74 + ox, 40 + oy],
      [70 + ox, 46 + oy],
      [64 + ox, 49 + oy],
      [58 + ox, 46 + oy],
      [54 + ox, 40 + oy],
    ],
    (x, y) => ramp("abcd", 0.86 - (x - 55 - ox) * 0.03 - Math.max(0, y - 42 - oy) * 0.05),
  );
  // Eyes: almond, his right (our left) ember, his left ice; brows sharp, angled down to the middle.
  const eyes = pose.eyes ?? "open";
  const eye = (ex: number, iris: string, dark: string, flip: boolean) => {
    const y = 39 + oy;
    if (eyes === "shut") {
      for (let x = 0; x < 5; x++) put(hd, ex + x, y + (x === 0 || x === 4 ? 0 : 1), "x");
      return;
    }
    const rows = eyes === "narrow" ? 2 : eyes === "wide" ? 4 : 3;
    const top = y - (rows - 2);
    for (let x = 0; x < 5; x++) put(hd, ex + x, top - 1, "x"); // the lash line, heavy
    put(hd, flip ? ex - 1 : ex + 5, top - 2, "x"); // its sharp outer tip
    put(hd, flip ? ex - 1 : ex + 5, top - 1, "x");
    const ix = flip ? 1 : 2; // the iris (from the eye's left), 2 wide, toward his nose
    for (let r = 0; r < rows; r++)
      for (let x = 0; x < 5; x++) {
        const inIris = x === ix || x === ix + 1;
        const k = inIris ? (r === 0 ? dark : r === rows - 1 && rows > 2 ? dark : iris) : r === rows - 1 && rows > 2 ? "." : "w";
        if (k !== ".") put(hd, ex + x, top + r, k);
      }
    // (A glint in each, and the pupil.)
    if (rows > 2) {
      put(hd, ex + ix + 1, top + 1, "W");
      put(hd, ex + ix, top + 1, "x");
    }
  };
  eye(57 + ox, "r", "R", false);
  eye(66 + ox, "i", "I", true);
  const browY = 35 + oy + (eyes === "wide" ? -1 : 0);
  // (Thin brows, mostly under the bangs.)
  for (let x = 0; x < 5; x++) {
    put(hd, 56 + ox + x, browY + (x > 2 ? 1 : 0), "B");
    put(hd, 71 + ox - x, browY + (x > 2 ? 1 : 0), "B");
  }
  // The nose: a lit ridge and its shadow; the mouth.
  put(hd, 64 + ox, 42 + oy, "b");
  put(hd, 63 + ox, 43 + oy, "a");
  const mouth = pose.mouth ?? "flat";
  const my = 46 + oy;
  if (mouth === "open") {
    fillPoly(hd, [[62 + ox, my - 0.5], [66 + ox, my - 0.5], [65.5 + ox, my + 2], [62.5 + ox, my + 2]], () => "m");
  } else if (mouth === "grit") {
    for (let x = 61; x <= 67; x++) put(hd, x + ox, my, x % 2 ? "w" : "m");
  } else {
    for (let x = 62; x <= 66; x++) put(hd, x + ox, my, "m");
    if (mouth === "smirk") put(hd, 67 + ox, my - 1, "m");
  }
  // The hair over his head: a dome from brow to crown, its bangs in long points over his brow, between his eyes and past them.
  const s = sway;
  fillPoly(
    hd,
    [
      [52 + ox, 36 + oy],
      [53 + ox, 26 + oy],
      [58 + ox, 21 + oy],
      [70 + ox, 21 + oy],
      [75 + ox, 26 + oy],
      [76 + ox, 36 + oy],
      [74 + ox, 39 + oy],
      [72 + ox, 32 + oy],
      [69 + ox, 35 + oy],
      [67 + ox, 31 + oy],
      [64.5 + ox, 38 + oy],
      [62 + ox, 31 + oy],
      [59 + ox, 35 + oy],
      [56 + ox, 32 + oy],
      [54 + ox, 39 + oy],
    ],
    (x, y) => {
      // (Strands sweeping from the crown's middle down to the bangs' points.)
      const strand = Math.round((x - 64 - ox) * (1 - (y - 21 - oy) / 30) + 64) % 4;
      return ramp("hjJW", 0.74 - (x - 54 - ox) * 0.024 - (y - 21 - oy) * 0.008 + (strand === 0 ? -0.26 : 0));
    },
  );
  lay(c, hd);
  // The side locks: from his temples down in front of his shoulders to his chest, swaying at their tips.
  const lock = (x0: number, lean: number, lit: boolean) => {
    const lk = cvs();
    fillPoly(
      lk,
      [
        [x0 - 1.5 + ox, 30 + oy],
        [x0 + 2.5 + ox, 30 + oy],
        [x0 + 2.5 + lean * 0.4 + ox, 52 + oy],
        [x0 + 2 + lean + s * 1.5, 72 + oy],
        [x0 + 0.5 + lean + s * 1.5, 78 + oy],
        [x0 - 1.5 + lean + s * 1.5, 70 + oy],
        [x0 - 1.5 + lean * 0.4 + ox, 52 + oy],
      ],
      (x, y) => {
        const strand = (x + Math.floor(y / 13)) % 3;
        return ramp(lit ? "hjJW" : "Hhj", 0.62 - (x - x0 - ox) * 0.1 + (strand === 0 ? -0.3 : strand === 2 ? 0.1 : 0));
      },
    );
    lay(c, lk);
  };
  lock(53, -1, true);
  lock(75, 1, false);
  // The crown.
  paintCrown(c, cx, 22 + oy);
}

/**
 * His crown, a grander Fire & Ice crown than the player's: a gold band across his brow-line hair, a jewel split ruby and sapphire at its
 * middle under a tall central point; flame points rising on our left, ice spikes on our right, each a band of its own colors.
 */
function paintCrown(c: Cv, cx: number, top: number): void {
  const cr = cvs();
  const y = top; // the band's top row
  // The band: 15 px across, 3 rows, lit from the left.
  for (let x = -8; x <= 8; x++)
    for (let r = 0; r < 3; r++) put(cr, cx + x, y + r, r === 0 ? (x < 0 ? "O" : "o") : r === 1 ? (x < 2 ? "o" : "G") : "g");
  // Its middle point and the jewel.
  fillPoly(cr, [[cx - 2.5, y], [cx + 2.5, y], [cx + 0.5, y - 9], [cx - 0.5, y - 9]], (x) => (x < cx ? "O" : "G"));
  put(cr, cx - 1, y + 1, "X");
  put(cr, cx - 1, y, "X");
  put(cr, cx, y + 1, "K");
  put(cr, cx, y, "K");
  // Flames on our left: three tongues, red to white-hot.
  const flame = (x0: number, h: number, lean: number) =>
    fillPoly(cr, [[x0 - 1.8, y], [x0 + 1.8, y], [x0 + 0.6 + lean, y - h * 0.6], [x0 + lean * 1.6, y - h], [x0 - 1 + lean, y - h * 0.5]], (x, yy) => {
      const v = (y - yy) / h;
      return v > 0.75 ? "Q" : Math.abs(x - x0 - lean * v) < 0.8 ? "y" : v > 0.4 ? "q" : "P";
    });
  flame(cx - 7, 6, -1);
  flame(cx - 4.5, 8, -0.5);
  // Ice spikes on our right: three crystals, deep blue to white.
  const spike = (x0: number, h: number, lean: number) =>
    fillPoly(cr, [[x0 - 1.6, y], [x0 + 1.6, y], [x0 + lean, y - h]], (x) => (x < x0 + lean * 0.5 - 0.3 ? "W" : x < x0 + lean * 0.5 + 0.8 ? "v" : "S"));
  spike(cx + 4.5, 8, 0.5);
  spike(cx + 7.5, 6, 1);
  lay(c, cr);
}

// ---- The figure, from a pose.

export const STRANGER_PARTS: Record<string, Part> = {};
const CACHE = new Map<string, { name: string; at: Pt } | null>();

function crop(c: Cv, outline: boolean): { part: Part; at: Pt } | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < c.length; y++)
    for (let x = 0; x < c[0]!.length; x++) {
      if (c[y]![x] === ".") continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  if (x1 < 0) return null;
  return { part: { grid: c.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline }, at: [x0, y0] };
}

function part(key: string, paint: (c: Cv) => void, outline = true): { name: string; at: Pt } | null {
  if (CACHE.has(key)) return CACHE.get(key)!;
  const c = cvs();
  paint(c);
  const b = crop(c, outline);
  const out = b ? { name: key, at: b.at } : null;
  if (b) STRANGER_PARTS[key] = b.part;
  CACHE.set(key, out);
  return out;
}

const poseKey = (p: StrangerPose, phase: number) => JSON.stringify([p, phase]);

/** The whole figure, painted for a pose (and the sparks' phase), as one canvas. */
function paintFigure(c: Cv, p: StrangerPose, phase: number): void {
  const oy = (p.bob ?? 0) + Math.round(10 * (p.kneel ?? 0));
  const sway = p.sway ?? 0;
  const [hx, hy] = p.head ?? [0, 0];
  // Swords on his back first (behind everything), then his hair's long fall.
  const back = cvs();
  if (p.swordF === "back") paintSword(back, "fire", [BACK_F.at[0], BACK_F.at[1] + oy], BACK_F.deg, phase);
  if (p.swordI === "back") paintSword(back, "ice", [BACK_I.at[0], BACK_I.at[1] + oy], BACK_I.deg, phase);
  lay(c, back);
  const hair = cvs();
  paintBackHair(hair, oy + hy, sway);
  lay(c, hair);
  const legs = cvs();
  paintLegs(legs, oy, p.kneel ?? 0);
  lay(c, legs);
  paintCoat(c, oy, sway, p.kneel ?? 0);
  paintHead(c, p, hx, oy + hy, sway);
  // Arms and the swords in hand, in front: his far-lit (our right) arm first.
  const held = (kind: "fire" | "ice", h: SwordHold) => {
    if (h === "back") return;
    const sw = cvs();
    paintSword(sw, kind, h.at, h.deg, phase);
    lay(c, sw);
  };
  // (A sword held pointing down sits under its arm; one held up sits over it.)
  const under = (h: SwordHold) => h !== "back" && Math.abs(((h.deg % 360) + 360) % 360 - 180) < 70;
  if (under(p.swordI)) held("ice", p.swordI);
  paintArm(c, SHOULDER_I, p.armI, false, oy);
  if (!under(p.swordI)) held("ice", p.swordI);
  if (under(p.swordF)) held("fire", p.swordF);
  paintArm(c, SHOULDER_F, p.armF, true, oy);
  if (!under(p.swordF)) held("fire", p.swordF);
}

function figurePart(p: StrangerPose, phase: number): { name: string; at: Pt } | null {
  return part(`fig:${poseKey(p, phase)}`, (c) => paintFigure(c, p, phase));
}

/**
 * His aura: a soft ring 2 to 4 px off his outline (fire on our left of his middle, ice on our right), its outer edge flickering by the
 * phase, and a few embers and frost motes rising. See-through, no outline: one part per figure and phase.
 */
function auraPart(p: StrangerPose, phase: number, strength = 1): { name: string; at: Pt } | null {
  return part(
    `aura:${poseKey(p, phase)}:${strength}`,
    (c) => {
      const fig = cvs();
      paintFigure(fig, p, phase);
      const solid = (x: number, y: number) => get(fig, x, y) !== ".";
      // Distance to his figure, up to 4 px (a few passes of growth).
      const dist: number[][] = fig.map((r) => r.map((k) => (k === "." ? 99 : 0)));
      for (let pass = 1; pass <= 4; pass++)
        for (let y = 0; y < STRANGER_H; y++)
          for (let x = 0; x < STRANGER_W; x++)
            if (dist[y]![x] === 99 && N4.some(([dx, dy]) => dist[y + dy]?.[x + dx] === pass - 1)) dist[y]![x] = pass;
      for (let y = 0; y < STRANGER_H; y++)
        for (let x = 0; x < STRANGER_W; x++) {
          const d = dist[y]![x]!;
          if (d === 0 || d === 99 || y > GROUND - 1) continue;
          if (solid(x, y)) continue;
          // (Its reach flickers: 2 to 4 px by a wave along his outline, moving with the phase.)
          const reach = 2 + strength * (1 + Math.round(1 + Math.sin(y * 0.45 + phase * 1.7 + (x < MID ? 0 : 2)))) * 0.5;
          if (d > Math.min(4, reach + 0.5)) continue;
          const fire = x < MID;
          put(c, x, y, d <= 1 ? (fire ? "7" : "9") : fire ? "6" : "8");
        }
    },
    false,
  );
}

function shadowPart(): { name: string; at: Pt } | null {
  return part(
    "shadow",
    (c) => {
      for (let x = MID - 22; x <= MID + 22; x++) {
        const half = Math.abs(x - MID) < 14 ? 1 : 0;
        for (let y = GROUND - half; y <= GROUND + 1; y++) put(c, x, y, "z");
      }
    },
    false,
  );
}

export interface FrameOpts {
  ms: number;
  cue?: string;
  shake?: readonly [number, number];
  specks?: readonly Speck[];
  /** Extra layers over him (a slash's arc, the cast's light). */
  over?: readonly Layer[];
  /** The aura's strength (0 none, 1 his idle's, 2 flared). */
  aura?: number;
  pal?: Readonly<Record<string, string>>;
}

/** One frame: the shadow, his aura, his figure, anything over him. */
export function strangerFrame(p: StrangerPose, phase: number, o: FrameOpts): Frame {
  const layers: Layer[] = [];
  const sh = shadowPart();
  if (sh) layers.push({ part: sh.name, x: sh.at[0], y: sh.at[1] });
  const aura = o.aura ?? 1;
  if (aura > 0) {
    const a = auraPart(p, phase % 4, aura);
    if (a) layers.push({ part: a.name, x: a.at[0], y: a.at[1] });
  }
  const f = figurePart(p, phase % 4);
  if (f) layers.push({ part: f.name, x: f.at[0], y: f.at[1] });
  layers.push(...(o.over ?? []));
  return { layers, ms: o.ms, ...(o.cue ? { cue: o.cue } : {}), ...(o.shake ? { shake: o.shake } : {}), ...(o.specks ? { specks: o.specks } : {}), ...(o.pal ? { pal: o.pal } : {}) };
}

// ---- His poses.

const REST: StrangerPose = { armF: ARMS.hangF, armI: ARMS.hangI, swordF: "back", swordI: "back" };
const held = (at: Pt, deg: number): SwordHold => ({ at, deg });

export const POSES = {
  rest: REST,
  // The draw: both hands up over his shoulders to the hilts, then out and up, then down to his sides, ready.
  reach: { ...REST, armF: [[42, 52], [46, 44]], armI: [[86, 52], [82, 44]] },
  pull: {
    ...REST,
    armF: [[40, 52], [40, 44]],
    armI: [[88, 52], [88, 44]],
    swordF: held([40, 44], -40),
    swordI: held([88, 44], 40),
    eyes: "narrow",
  },
  flourish: {
    ...REST,
    armF: [[38, 60], [30, 62]],
    armI: [[90, 60], [98, 62]],
    swordF: held([30, 62], -78),
    swordI: held([98, 62], 78),
    eyes: "narrow",
    mouth: "smirk",
  },
  ready: {
    ...REST,
    armF: [[42, 70], [38, 82]],
    armI: [[86, 70], [90, 82]],
    swordF: held([38, 82], -150),
    swordI: held([90, 82], 150),
    mouth: "smirk",
  },
  // The double slash: both raised high and back, then down across in an X (his arms crossed), then the follow-through.
  windup: {
    ...REST,
    armF: [[42, 50], [44, 42]],
    armI: [[86, 50], [84, 42]],
    swordF: held([44, 42], -50),
    swordI: held([84, 42], 50),
    eyes: "narrow",
    mouth: "grit",
  },
  cross: {
    ...REST,
    armF: [[54, 68], [72, 76]],
    armI: [[74, 68], [56, 76]],
    swordF: held([72, 76], 128),
    swordI: held([56, 76], -128),
    eyes: "narrow",
    mouth: "grit",
    head: [0, 1],
  },
  through: {
    ...REST,
    armF: [[56, 72], [78, 84]],
    armI: [[72, 72], [50, 84]],
    swordF: held([78, 84], 150),
    swordI: held([50, 84], -150),
    eyes: "narrow",
    mouth: "flat",
    head: [0, 1],
  },
  // The twin-tip cast: arms out at his shoulders, both blades pointing in, their tips meeting in front of him.
  aimTips: {
    ...REST,
    armF: [[36, 60], [24, 62]],
    armI: [[92, 60], [104, 62]],
    swordF: held([24, 62], 95),
    swordI: held([104, 62], -95),
    eyes: "narrow",
    mouth: "flat",
  },
  // Hit: a flinch back, eyes shut, his head knocked to our right.
  flinch: { ...REST, armF: [[46, 70], [46, 82]], armI: [[84, 70], [86, 82]], eyes: "shut", mouth: "grit", head: [1, 1], sway: 1 },
  // Rattled: his eyes wide, a hand at his brow.
  rattled: { ...REST, armF: [[44, 64], [56, 42]], eyes: "wide", mouth: "open", head: [-1, 0] },
  // Beaten: down on one knee, his head bowed.
  kneel: { ...REST, armF: [[46, 80], [52, 92]], armI: [[84, 80], [80, 94]], eyes: "shut", mouth: "flat", head: [0, 2], kneel: 1 },
  // Won: one sword raised (fire), the other held low, a smirk.
  triumph: {
    ...REST,
    armF: [[42, 50], [42, 40]],
    armI: [[86, 70], [90, 82]],
    swordF: held([42, 40], -35),
    swordI: held([90, 82], 150),
    mouth: "smirk",
  },
} satisfies Record<string, StrangerPose>;

export type PoseName = keyof typeof POSES;

/** The tips' meeting point in the twin-tip cast (frame px): where the cast's light is drawn. */
export const TIPS_AT: Pt = (() => {
  const s = POSES.aimTips.swordF as { at: Pt; deg: number };
  const r = (s.deg * Math.PI) / 180;
  return [Math.round(s.at[0] + Math.sin(r) * (BLADE + 5)), Math.round(s.at[1] - Math.cos(r) * (BLADE + 5))];
})();

// ---- Over him: the slash arcs and the cast's light.

/** One slash's arc: a crescent of its blade's color across his front, from our upper `from` side down to the other. */
function arcPart(kind: "fire" | "ice", step: 0 | 1 | 2): { name: string; at: Pt } | null {
  return part(
    `arc:${kind}:${step}`,
    (c) => {
      // A band along an arc from upper left to lower right (fire) or mirrored (ice); it fades by the step.
      const cx = MID;
      const cy = 60;
      const R = 40;
      for (let y = 10; y < GROUND; y++)
        for (let x = 4; x < STRANGER_W - 4; x++) {
          const dx = kind === "fire" ? x - cx : cx - x;
          const dy = y - cy;
          // (A diagonal crescent: distance from the line y = x through his middle, bowed outward.)
          const along = (dx + dy) / Math.SQRT2;
          const across = (dy - dx) / Math.SQRT2 + (along * along) / (2 * R) - 6;
          if (Math.abs(along) > 40) continue;
          const w = (1 - Math.abs(along) / 40) * (step === 0 ? 3.2 : step === 1 ? 2.4 : 1.2);
          if (Math.abs(across) > w) continue;
          const core = Math.abs(across) < w * 0.4;
          const key = kind === "fire" ? (core ? (step === 2 ? "Q" : "y") : step === 2 ? "P" : "q") : core ? (step === 2 ? "v" : "W") : step === 2 ? "S" : "v";
          put(c, x, y, key);
        }
    },
    false,
  );
}

/** The cast's light at the tips: a ball, half fire and half ice, swirling, growing by its step (0..3). */
function orbPart(step: number): { name: string; at: Pt } | null {
  return part(
    `orb:${step}`,
    (c) => {
      const [cx, cy] = TIPS_AT;
      const R = [2, 3.5, 5, 6.5][step]!;
      for (let y = Math.floor(cy - R - 2); y <= cy + R + 2; y++)
        for (let x = Math.floor(cx - R - 2); x <= cx + R + 2; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const d = Math.hypot(dx, dy);
          if (d > R) continue;
          // (A yin-yang swirl: the dividing line curls with the step.)
          const ang = Math.atan2(dy, dx) + d * 0.25 + step * 0.7;
          const fire = Math.cos(ang) < 0;
          const key = d < R * 0.35 ? "W" : d < R * 0.7 ? (fire ? "y" : "V") : fire ? "q" : "v";
          put(c, x, y, key);
        }
    },
    false,
  );
}

const over = (p: { name: string; at: Pt } | null): Layer[] => (p ? [{ part: p.name, x: p.at[0], y: p.at[1] }] : []);

// ---- His animations.

const F = (pose: PoseName | StrangerPose, phase: number, o: FrameOpts): Frame => strangerFrame(typeof pose === "string" ? POSES[pose] : pose, phase, o);
const breathe = (p: StrangerPose, i: number): StrangerPose => ({ ...p, bob: i >= 2 ? 1 : 0, sway: [0, 0.5, 0, -0.5][i % 4]! });

const idle = (): Anim => ({ loop: true, frames: [0, 1, 2, 3].map((i) => F(breathe(POSES.rest, i), i, { ms: 320 })) });
const readyLoop = (): Anim => ({ loop: true, frames: [0, 1, 2, 3].map((i) => F(breathe(POSES.ready, i), i, { ms: 300, aura: 1.5 })) });
const drawFrames = (): Frame[] => [
  F("reach", 0, { ms: 140 }),
  F("pull", 1, { ms: 110, cue: "draw", aura: 1.5 }),
  F("flourish", 2, { ms: 130, aura: 2 }),
  F("ready", 3, { ms: 180, aura: 1.5 }),
];
const sheatheFrames = (): Frame[] => [
  F("pull", 0, { ms: 150 }),
  F("reach", 1, { ms: 110, cue: "sheathe" }),
  F("rest", 2, { ms: 220 }),
];
const slashFrames = (): Frame[] => [
  F("windup", 0, { ms: 220, aura: 2 }),
  F("cross", 1, { ms: 70, cue: "slash", aura: 2, over: [...over(arcPart("fire", 0)), ...over(arcPart("ice", 0))], shake: [1, 0] }),
  F("through", 2, { ms: 110, aura: 2, over: [...over(arcPart("fire", 1)), ...over(arcPart("ice", 1))] }),
  F("through", 3, { ms: 120, aura: 1.5, over: [...over(arcPart("fire", 2)), ...over(arcPart("ice", 2))] }),
  F("ready", 0, { ms: 220, aura: 1.5 }),
];
const castFrames = (): Frame[] => [
  F("aimTips", 0, { ms: 200, aura: 1.5 }),
  F("aimTips", 1, { ms: 120, cue: "tips", aura: 2, over: over(orbPart(0)) }),
  F("aimTips", 2, { ms: 120, aura: 2, over: over(orbPart(1)) }),
  F("aimTips", 3, { ms: 140, aura: 2, over: over(orbPart(2)) }),
  F("aimTips", 0, { ms: 160, cue: "cast", aura: 2, over: over(orbPart(3)), shake: [0, 1] }),
  F("aimTips", 1, { ms: 120, aura: 1.5, over: over(orbPart(1)) }),
  F("ready", 2, { ms: 200, aura: 1.5 }),
];

export const STRANGER_ANIMS: Record<string, Anim> = {
  idle: lazyAnim(idle),
  // Thinking: his idle, his eyes narrowed.
  think: lazyAnim(() => ({ loop: true, frames: [0, 1, 2, 3].map((i) => F({ ...breathe(POSES.rest, i), eyes: "narrow" }, i, { ms: 360 })) })),
  // Smug: his idle with a smirk.
  smug: lazyAnim(() => ({ loop: true, frames: [0, 1, 2, 3].map((i) => F({ ...breathe(POSES.rest, i), mouth: "smirk" }, i, { ms: 320 })) })),
  // His entrance and a move: a nod, his aura flaring.
  nod: lazyAnim(() => ({
    loop: false,
    frames: [F({ ...POSES.rest, head: [0, 1], eyes: "narrow" }, 0, { ms: 200, cue: "hum", aura: 2 }), F({ ...POSES.rest, mouth: "smirk" }, 1, { ms: 320, aura: 1.5 }), F(POSES.rest, 2, { ms: 200 })],
  })),
  draw: lazyAnim(() => ({ loop: false, frames: drawFrames() })),
  sheathe: lazyAnim(() => ({ loop: false, frames: sheatheFrames() })),
  ready: lazyAnim(readyLoop),
  slash: lazyAnim(() => ({ loop: false, frames: slashFrames() })),
  cast: lazyAnim(() => ({ loop: false, frames: castFrames() })),
  // From his rest, swords on his back: draw, the double slash, sheathe (a capture, his strike, a check).
  strike: lazyAnim(() => ({ loop: false, frames: [...drawFrames(), ...slashFrames(), ...sheatheFrames()] })),
  // From his rest: draw, the twin-tip cast, sheathe (his power's wind-up, wired by his rules).
  castFull: lazyAnim(() => ({ loop: false, frames: [...drawFrames(), ...castFrames(), ...sheatheFrames()] })),
  hit: lazyAnim(() => ({
    loop: false,
    frames: [
      F("flinch", 0, { ms: 90, cue: "hit", shake: [-1, 0], pal: { "1": "#8f86d8", "2": "#b3acf0", "3": "#d8d4ff", "4": "#ffffff" } }),
      F("flinch", 1, { ms: 220 }),
      F(POSES.rest, 2, { ms: 200 }),
    ],
  })),
  rattled: lazyAnim(() => ({
    loop: true,
    frames: [0, 1, 2, 3].map((i) => F({ ...POSES.rattled, head: [i % 2 ? 0 : -1, 0], bob: i >= 2 ? 1 : 0 }, i, { ms: 240, aura: 0.5 })),
  })),
  defeat: lazyAnim(() => ({
    loop: false,
    frames: [
      F("flinch", 0, { ms: 160, cue: "fall", aura: 0.5 }),
      F({ ...POSES.kneel, kneel: 0.5, eyes: "shut", head: [0, 1] }, 1, { ms: 160, aura: 0.5 }),
      F(POSES.kneel, 2, { ms: 300, cue: "kneel", aura: 0, shake: [0, 1] }),
      F(POSES.kneel, 3, { ms: 400, aura: 0 }),
    ],
  })),
  defeatLoop: lazyAnim(() => ({ loop: true, frames: [0, 1].map((i) => F({ ...POSES.kneel, bob: i }, i, { ms: 700, aura: 0 })) })),
  victory: lazyAnim(() => ({
    loop: true,
    frames: [0, 1, 2, 3].map((i) => F({ ...POSES.triumph, bob: i >= 2 ? 1 : 0, sway: [0, 0.5, 0, -0.5][i]! }, i, { ms: 300, aura: 2 })),
  })),
};

/** His locked look (the picker shows him before he's unlocked): all in shadow but his eyes, the jewel and the aura's rim. */
export const STRANGER_LOCKED: Record<string, string> = Object.fromEntries(
  Object.keys(STRANGER_PALETTE)
    .filter((k) => !"riXK6789zk".includes(k))
    .map((k) => [k, "#0b0912"]),
);

export const STRANGER: Character = {
  id: "stranger",
  name: "The Stranger",
  w: STRANGER_W,
  h: STRANGER_H,
  foot: STRANGER_FOOT,
  palette: STRANGER_PALETTE,
  halo: "#3a2f5c",
  looks: { locked: STRANGER_LOCKED },
  parts: STRANGER_PARTS,
  anims: STRANGER_ANIMS,
};

/** The part of his idle's first frame his portrait shows: his head, crown and collar. */
export const STRANGER_PORTRAIT = { x: 44, y: 10, w: 40, h: 44 };
