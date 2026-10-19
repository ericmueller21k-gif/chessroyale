/**
 * Smudgy, the chameleon painter boss (Eric, Oct 19: "he learned painting because he always struggled to blend in like
 * the other chameleons"). After Eric's reference picture, redrawn: a lime-green chameleon with a casque striped in
 * orange, teal and green, the same patchy stripes on his arms, legs and his spiral tail (he never blends in); big
 * amber eyes in turrets of skin, a friendly smirk; a painter's beret, deep plum, tipped on his casque; a cream apron
 * splashed with paint on brown straps with gold buttons; in one hand a big brush with a silver ferrule, dripping
 * yellow paint, in the other a wooden palette of paint. Drawn three-quarters on, facing our left (as Alfil, Sawyer and
 * Chub & Chirp), light from the top left. His wide stance has the gripping toes, the brush held up and the palette held
 * out in front of him.
 *
 * His still was approved (Oct 19) and is idle's first frame, pixel for pixel (docs/decisions/2026-10-19-smudgy-still.md);
 * his animation pack (the moments every boss has, his attack on a king, and his own: Camouflage's splash, the strike's
 * reveal, Repaint's cast) is drawn from poses below (docs/decisions/2026-10-19-smudgy-animations.md), his board art in
 * effects/smudgy.ts. Nothing in the game draws him yet (he isn't in `CHARACTERS`, `BOSS_KITS` or the roster); the
 * preview draws him with its `extra=` option.
 *
 * Rigging, as the other bosses: the head, the casque, the beret, the torso, the apron and its splats, the feet, the
 * palette and its dabs are painted once; the tail, the legs, the arms, the straps, the brush, its paint and his eyes
 * from numbers, so the poses that follow are numbers in `SmudgyPose`:
 * - the tail, his main moving part: `curl` (1 the spiral, 0 a loose hook, its length never changing) and a ripple down
 *   it, `sway` and `swayPhase`;
 * - the brush arm (`elbowF`, `fist`, `brushButt`, `brushTip`) and the palette arm (`elbowN`, `handN`);
 * - the eyes (`gazeN`, `gazeF`: the pupils sweep on their own);
 * - the casque and the beret, parts of their own (`casque`, `beret`, `beretTilt`);
 * - the brush's paint, a part of its own in the palette keys `P`, `R` and `K` and no others, so a frame's `pal`
 *   recolors it alone.
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "./paint.ts";
import { KING_ATTACK } from "@chessroyale/chess";
import { moved } from "./attack-frame.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

export const SMUDGY_PALETTE: Record<string, string> = {
  k: "#14210f", // outline
  a: "#2c5e18", // his skin: lime green, dark to light
  b: "#4b9023",
  c: "#74c02c",
  d: "#9fdc43",
  e: "#c9f27a",
  l: "#9bb838", // his throat and jaw: yellow-green, dark to light
  m: "#c5da55",
  n: "#e6ee86",
  p: "#a93a17", // the stripes: orange, dark to light
  q: "#dc5a1e",
  r: "#f5832d",
  s: "#ffb162",
  t: "#0e5c60", // teal, dark to light
  u: "#1a8985",
  v: "#34b4a8",
  x: "#74dccb",
  h: "#fbf6e4", // the whites of his eyes, and their shade under the lid
  S: "#d9d0b0",
  E: "#9b4f0d", // his irises: amber, dark to light
  F: "#dd8512",
  G: "#ffc437",
  X: "#0a0c07", // pupils
  w: "#ffffff", // glints
  H: "#b9a37f", // the apron: cream, shade, mid, light
  I: "#e3d4b4",
  J: "#faf1da",
  L: "#35200f", // leather and wood (the straps, the brush's handle), dark to light
  M: "#5a3516",
  N: "#85501f",
  Q: "#ad7634",
  B: "#76451e", // the palette's board: dark, mid, light
  C: "#a96f3b",
  D: "#cf9858",
  Y: "#f2c14e", // gold (the game's), its light, its shade
  y: "#ffe58a",
  O: "#b4840f",
  f: "#5f6b7a", // the ferrule: silver, dark to light
  g: "#9aa6b5",
  i: "#cfd8e2",
  j: "#f4f7fb",
  U: "#8a5e30", // the bristles: dark to light
  V: "#c79a5a",
  W: "#ecd29b",
  P: "#b97c06", // the brush's paint (and nothing else): yellow, dark, mid, light
  R: "#f7c60f",
  K: "#fff48c",
  A: "#2a0e34", // his beret: deep plum, dark to light
  T: "#4a1c58",
  Z: "#6b2f7c",
  o: "#9059a3",
  "1": "#d9342c", // the dabs on the palette and the splats on the apron: red, yellow, blue, green; mid and light
  "2": "#ff7a66",
  "3": "#f0b90f",
  "4": "#fff08a",
  "5": "#2f6fdc",
  "6": "#7ab0ff",
  "7": "#2fa84a",
  "8": "#7be08a",
  z: "#0d0e12", // ground shadow
  "~": "#9fd8ff", // sweat
  "9": "#4d4538", // dust, dark and light
  "0": "#7d705a",
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;

const GREEN = "abcde";
const THROAT = "lmn";
const ORANGE = "pqrs";
const TEAL = "tuvx";
/** The three colors of his stripes, by the letter a pattern names them with. */
const HUES: Record<string, string> = { g: GREEN, o: ORANGE, t: TEAL };

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;

// ---- Painting: a part from shapes in the scene's own coordinates (the ground at y `GROUND`), or from strokes.

/** A part painted in the scene: its canvas covers (x0, y0) to (x0 + w, y0 + h). */
function painted(
  x0: number,
  y0: number,
  w: number,
  h: number,
  draw: (F: (inside: Inside, key: Key) => void, S: (rows: readonly string[], x: number, y: number) => void) => void,
): { part: Part; at: Pt } {
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

function nearest(p: Pt, a: Pt, b: Pt): { d: number; nx: number; ny: number; t: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const nx = p[0] - (a[0] + t * vx);
  const ny = p[1] - (a[1] + t * vy);
  return { d: Math.hypot(nx, ny), nx, ny, t };
}

/** For a pixel near a stroke: how far along it is (0 to 1), its distance across and the normal, the radius there. */
function along(pts: readonly Pt[], r: readonly number[], p: Pt): { s: number; d: number; nx: number; ny: number; rr: number } {
  let best = { s: 0, d: Infinity, nx: 0, ny: 0, rr: r[0]! };
  pts.slice(1).forEach((q, i) => {
    const n = nearest(p, pts[i]!, q);
    const rr = r[i]! + (r[i + 1]! - r[i]!) * n.t;
    if (n.d - rr < best.d - best.rr) best = { s: (i + n.t) / (pts.length - 1), d: n.d, nx: n.nx, ny: n.ny, rr };
  });
  return best;
}

/**
 * A stroke through `pts`, `r` its radius at each point; `key` colors a pixel from its light (0 dark to 1 light, lit
 * from the top left across the stroke), how far along it is (0 to 1) and the signed distance across it.
 */
function stroke(pts: readonly Pt[], r: readonly number[], key: (light: number, s: number, across: number) => string): { part: Part; at: Pt } {
  const pad = Math.ceil(Math.max(...r)) + 1;
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0]))) - pad;
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1]))) - pad;
  const w = Math.ceil(Math.max(...pts.map((p) => p[0]))) + pad - x0 + 1;
  const h = Math.ceil(Math.max(...pts.map((p) => p[1]))) + pad - y0 + 1;
  return painted(x0, y0, w, h, (F) => {
    const at = (x: number, y: number) => along(pts, r, [x + 0.5, y + 0.5]);
    F(
      (x, y) => {
        const s = at(x, y);
        return s.d <= s.rr;
      },
      (x, y) => {
        const s = at(x, y);
        const across = s.rr ? (s.nx + s.ny) / (s.rr * Math.SQRT2) : 0;
        return key(0.6 - 0.45 * (s.nx / s.rr) - 0.5 * (s.ny / s.rr), s.s, across);
      },
    );
  });
}

/**
 * His stripes along a stroke: `pattern` names a band's color a letter at a time (g, o or t), each `width` pixels along it,
 * slanted by his distance across, so every limb has its own patches. The color's shade is the stroke's light.
 */
function stripes(pattern: string, width: number, len: number, slant = 1.4): (light: number, s: number, across: number) => string {
  return (l, s, across) => {
    const v = Math.max(0, s * len + across * slant);
    return ramp(HUES[pattern[Math.floor(v / width) % pattern.length]!]!, l);
  };
}

/** Parts painted in the same space, as one part: each over the ones before it. */
function merged(ps: readonly { part: Part; at: Pt }[]): { part: Part; at: Pt } {
  const x0 = Math.min(...ps.map((q) => q.at[0]));
  const y0 = Math.min(...ps.map((q) => q.at[1]));
  const w = Math.max(...ps.map((q) => q.at[0] + q.part.grid[0]!.length)) - x0;
  const h = Math.max(...ps.map((q) => q.at[1] + q.part.grid.length)) - y0;
  return painted(x0, y0, w, h, (_F, S) => ps.forEach((q) => S(q.part.grid, q.at[0], q.at[1])));
}

// ---- Where things are. The scene's ground is at y `GROUND`; the frame adds `OX`, `OY` (headroom for his poses).

const GROUND = 70;
const OX = 8;
const OY = 10;
const W = OX + 86;
const H = OY + GROUND + 4;
/** The ground point between his feet (x). */
const FOOT_X = 44;

// ---- The head: the casque behind it, then the head itself (muzzle, jaw, mouth), and the eyes over it.

/** The head's outline, clockwise from the muzzle's tip: a pointed snout. */
const HEAD: Pt[] = [[16.5, 31.8], [19.5, 28.8], [24.5, 26.5], [29.5, 23.2], [35, 20.5], [41, 20], [45, 22], [47.5, 26], [47.5, 30], [45, 35], [40, 37.5], [33, 38], [26, 36.8], [20.5, 34.6], [17.5, 33.2]];
/** His mouth: the smirk of the still (along the jaw, curling up into his cheek), a wide grin, a yell and a frown. */
export type Mouth = "smirk" | "grin" | "open" | "frown";
const MOUTHS: Record<Mouth, { line: Pt[]; inside?: Pt[] }> = {
  smirk: { line: [[17.5, 32.8], [21, 33.4], [26, 34.2], [31, 33.9], [35, 32.4], [37.5, 30.2], [38.8, 28.2]] },
  // The grin: the same line curling higher, a dark mouth open under it, its tongue.
  grin: { line: [[17.5, 32.4], [21, 32.9], [26, 33.5], [31, 33.1], [35, 31.4], [38, 28.8], [40, 26.2]], inside: [[19, 33.4], [26, 34.2], [32, 33.8], [36.5, 32], [39, 29.2], [37, 32.2], [33, 35.4], [26, 36.2], [21, 35.2]] },
  // A yell: the line as it is and a dark mouth wide under it.
  open: { line: [[17.5, 32.8], [21, 33.4], [26, 34.2], [31, 33.9], [35, 32.4], [37.5, 30.2], [38.8, 28.2]], inside: [[19, 33.6], [26, 34.4], [32, 34], [36, 32.6], [35, 35.6], [30, 37.2], [24, 37.2], [20, 35.6]] },
  frown: { line: [[17.5, 33.8], [21, 34], [26, 34.4], [31, 34.6], [35, 35.4], [37, 36.6]] },
};

/**
 * The casque, a fin swept back from behind his eyes, striped by the angle from its pivot like a fan. It's short: his beret
 * sits on its top, so the crest shows below it, flowing up out of his head.
 */
function casque(): { part: Part; at: Pt } {
  const outline: Pt[] = [[34, 23], [35, 17], [38, 13], [44, 11], [52, 12], [56, 15.5], [58, 21], [56.5, 27], [51.5, 31], [44, 27], [38, 25]];
  const inside = inPoly(outline);
  const [px, py] = [40, 26];
  const light = roundLight(42, 16, 14, 13, 0.1);
  // Bands in order from the front over the top to the back: the letter and where it ends (0 to 1 around the fan).
  const bands: readonly (readonly [string, number])[] = [["g", 0.1], ["t", 0.24], ["o", 0.38], ["g", 0.46], ["t", 0.6], ["o", 0.74], ["g", 0.82], ["t", 0.9], ["o", 1]];
  return painted(33, 8, 27, 25, (F) =>
    F(inside, (x, y) => {
      const a = Math.atan2(y + 0.5 - py, x + 0.5 - px);
      // The edges between bands waver a little with the distance, so the patches aren't ruled lines.
      const t = (a + 2.4) / 2.65 + 0.03 * Math.sin(Math.hypot(x - px, y - py) * 0.9);
      const hue = bands.find(([, to]) => t < to)?.[0] ?? "o";
      return ramp(HUES[hue]!, light(x, y));
    }),
  );
}

/**
 * His beret, a painter's: a soft floppy disc with a puffed lip drooping at its front, a band round its foot and a stalk on
 * top, tipped `tilt` degrees (negative: its front down, its back up). It sits on his casque; a part of its own.
 */
function beret(tilt: number): { part: Part; at: Pt } {
  const [cx, cy] = [46.5, 11];
  const th = (tilt * Math.PI) / 180;
  const [cs, sn] = [Math.cos(th), Math.sin(th)];
  const [rx, ry] = [12, 6.2];
  /** A pixel in the beret's own frame: along it (negative toward his front) and across it (negative up). */
  const local = (x: number, y: number): Pt => [(x + 0.5 - cx) * cs + (y + 0.5 - cy) * sn, -(x + 0.5 - cx) * sn + (y + 0.5 - cy) * cs];
  // The lip droops on its front: it's deeper below the middle there.
  const depth = (u: number, v: number): number => (v > 0 ? ry + 2.2 * Math.max(0, -u / rx) : ry);
  const inside: Inside = (x, y) => {
    const [u, v] = local(x, y);
    return (u / rx) ** 2 + (v / depth(u, v)) ** 2 <= 1;
  };
  // The stalk: on the top of the disc, a little toward its front.
  const [su, sv] = [-1.8, -ry - 0.6];
  const stalk: Pt = [cx + su * cs - sv * sn, cy + su * sn + sv * cs];
  return painted(30, 0, 32, 24, (F, S) => {
    F(inside, (x, y) => {
      const [u, v] = local(x, y);
      const d = depth(u, v);
      let l = 0.6 - 0.34 * (v / d) - 0.2 * (u / rx);
      // A fold or two of the cloth, running from the stalk down toward the front.
      if (Math.abs(v / ry - (-0.2 + 0.45 * Math.sin((u / rx) * 2.4 + 0.5))) < 0.09) l -= 0.3;
      if (Math.abs(v / ry - (0.35 + 0.3 * Math.sin((u / rx) * 3.1 + 2))) < 0.07 && u > -rx * 0.5) l -= 0.25;
      if (v > d * 0.68) return l > 0.5 ? "T" : "A";
      return ramp("ATZo", l);
    });
    S(["Zo", "TA"], Math.round(stalk[0]) - 1, Math.round(stalk[1]) - 1);
  });
}

/** His head: green above the mouth, the yellow-green jaw below it, a nostril, and a few stripes at his cheek. */
function head(mouth: Mouth): { part: Part; at: Pt } {
  const inside = inPoly(HEAD);
  const light = roundLight(34, 24, 17, 15, 0.16);
  const { line, inside: gape } = MOUTHS[mouth];
  const mouthY = (x: number): number => {
    const i = line.findIndex((p, j) => j > 0 && x <= p[0]);
    if (i < 1) return x < line[0]![0] ? line[0]![1] : line.at(-1)![1];
    const [a, b] = [line[i - 1]!, line[i]!];
    return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  };
  const open = gape ? inPoly(gape) : null;
  return painted(15, 14, 36, 26, (F, S) => {
    F(inside, (x, y) => {
      // His cheek stripes: diagonal patches of orange and teal toward the casque.
      if (x > 40.5 && y < 33) {
        const v = Math.floor((x * 0.9 - y * 0.7 + 60) / 2.6) % 3;
        if (v === 0) return ramp(ORANGE, light(x, y) + 0.1);
        if (v === 1) return ramp(TEAL, light(x, y));
      }
      return y > mouthY(x) + 0.5 && x < 38.5 ? ramp(THROAT, light(x, y) + 0.12) : ramp(GREEN, light(x, y));
    });
    // An open mouth: dark, with the tongue in the bottom of it.
    if (open) {
      F((x, y) => open(x, y) && inside(x, y), (x, y) => (y > 35.4 && x > 23 && x < 33 ? "q" : "k"));
    }
    // The line of his mouth, along the segments.
    line.slice(1).forEach((q, i) => {
      const a = line[i]!;
      const n = Math.ceil(Math.hypot(q[0] - a[0], q[1] - a[1]) * 2);
      for (let j = 0; j <= n; j++) S(["k"], Math.floor(a[0] + ((q[0] - a[0]) * j) / n), Math.floor(a[1] + ((q[1] - a[1]) * j) / n));
    });
    S(["a"], 20, 30);
  });
}

/**
 * An eye centered at (`cx`, `cy`): his turret of green skin, the white, the amber iris with its pupil and a glint. `rb` is
 * the turret's radius; the iris looks by (`gx`, `gy`) from the middle of the white, so the pupils sweep and swivel as
 * numbers.
 */
export type Lid = "open" | "wide" | "half" | "shut" | "joy";
/** How far down the opening his lid reaches, from the opening's middle in turret radii (up is negative). */
const LID_AT: Record<Lid, number> = { open: -0.72, wide: -1.2, half: -0.05, shut: 1.3, joy: 1.3 };

function eye(cx: number, cy: number, rb: number, [gx, gy]: Pt, lid: Lid = "open"): { part: Part; at: Pt } {
  const size = Math.ceil(rb * 2) + 1;
  const c = size / 2;
  // His turret is a cone of skin: a thick rim round the opening, darker on its inside edge, and a lid over the top of it.
  const ro = rb - 2;
  const ri = ro * 0.8;
  const rp = ri * 0.52;
  const bulb = roundLight(c, c, rb, rb, 0.1);
  const cv = canvas(size, size);
  const ix = c + gx;
  const iy = c + gy;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = Math.hypot(px - c, py - c);
      if (d > rb) continue;
      const covered = py < c + ro * LID_AT[lid];
      if (d > ro || covered) {
        cv[y]![x] = ramp(GREEN, bulb(x, y) - (d < ro + 1 ? 0.2 : 0));
        continue;
      }
      cv[y]![x] = py < c - ro * 0.45 && lid !== "wide" ? "S" : "h";
      const di = Math.hypot(px - ix, py - iy);
      if (di <= ri) cv[y]![x] = di >= ri - 0.9 ? "E" : py < iy ? "F" : "G";
      if (di <= rp) cv[y]![x] = "X";
    }
  // A shut eye: a dark crease across it, or an arch (happy).
  if (lid === "shut" || lid === "joy")
    for (let x = 0; x < size; x++) {
      const t = (x + 0.5 - c) / ro;
      if (Math.abs(t) > 0.92) continue;
      const y = lid === "shut" ? Math.floor(c + 0.4) : Math.floor(c + 1.1 - 2.4 * (1 - t * t));
      // (The arch is two pixels thick, so it reads at a glance.)
      for (const yy of lid === "shut" ? [y] : [y, y + 1]) if (cv[yy]?.[x]) cv[yy]![x] = "k";
    }
  // Its glint: the pupil's top left pixel.
  const dark = cv.flatMap((row, y) => row.flatMap((k, x) => (k === "X" ? [[x, y] as Pt] : [])));
  const top = dark.sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
  if (top && dark.length >= 4) cv[top[1]]![top[0]] = "w";
  return { part: { grid: toGrid(cv) }, at: [Math.round(cx - c), Math.round(cy - c)] };
}

// ---- The body.

/** His torso: a bean, leaning to the front, a few patches of stripe on his back and hip. */
function torso(): { part: Part; at: Pt } {
  const inside = inEllipse(48.5, 46, 10.3, 13.5);
  const light = roundLight(45, 40, 14, 16, 0.1);
  return painted(37, 31, 24, 30, (F) =>
    F(inside, (x, y) => {
      const v = x * 0.8 + y * 0.6;
      if (x > 53.5 && y > 43 && y < 58) return ramp(v % 11 < 4.5 ? ORANGE : v % 11 < 7 ? TEAL : GREEN, light(x, y));
      return ramp(GREEN, light(x, y));
    }),
  );
}

/** The apron: a bib, a skirt flaring to a curved hem, shaded across its folds. */
function apron(): { part: Part; at: Pt } {
  const shape = inPoly([[40.5, 38.5], [50.5, 38.5], [51, 45], [56.5, 56.5], [52, 58], [45, 58.6], [39, 58], [35.5, 56.5], [40, 45]]);
  return painted(34, 37, 25, 24, (F) =>
    F(shape, (x, y) => {
      // Light from the left, a fold or two running down it and a shade under the hem.
      let l = 0.88 - (x - 36) * 0.02;
      if (Math.abs(x - 47.5 - (y - 46) * 0.25) < 0.6 && y > 47) l -= 0.3;
      if (y > 56.4) l -= 0.3;
      return l > 0.66 ? "J" : l > 0.36 ? "I" : "H";
    }),
  );
}

/** The splats on the apron: a red one on the bib, a blue one and a yellow one on the skirt, a green speck. */
function splats(): { part: Part; at: Pt } {
  return painted(34, 38, 25, 22, (_F, S) => {
    S([".11.", "2111", "1111", ".11."], 43, 40);
    S(["26.", "555", ".55"], 39, 50);
    S([".4.", "433", "333"], 48, 49);
    S(["78", "77"], 52, 54);
  });
}

/** Where the straps lie: from the bib's corners, over his near shoulder. */
function strap(): { part: Part; at: Pt } {
  return stroke([[49.5, 39.5], [52, 36], [54, 33.5]], [1.5, 1.5, 1.5], (l) => ramp("LMNQ", l));
}

const BUTTON: Part = { grid: ["yY", "YO"], outline: false };

// ---- Strokes: his legs, feet, arms and tail.

/** A leg: the thigh from the hip to the knee, the shin from there to the ankle. */
function legPart(hip: Pt, knee: Pt, ankle: Pt, pattern: string): { part: Part; at: Pt } {
  const thigh = stroke([hip, [(hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2], knee], [4.3, 3.9, 3.1], stripes(pattern, 5, 12));
  const shin = stroke([knee, ankle], [2.8, 2.3], stripes("g", 99, 8));
  return merged([shin, thigh]);
}

/**
 * A foot, facing left: a paw with three fat toes gripping the ground, a gap between them (it fills with the outline). Its
 * ankle is at the top right, 9 pixels in from the heel's end.
 */
const FOOT: readonly string[] = [
  "......ccddcb..",
  "..cccdddddddcb",
  ".cdddddddddcbb",
  "cddd.cdd.cddbb",
  "cbbb.cbb.cbbb.",
];

/** An arm: from the shoulder, the elbow, to the wrist. */
function arm(shoulder: Pt, elbow: Pt, wrist: Pt, pattern: string): { part: Part; at: Pt } {
  const len = Math.hypot(elbow[0] - shoulder[0], elbow[1] - shoulder[1]) + Math.hypot(wrist[0] - elbow[0], wrist[1] - elbow[1]);
  return stroke([shoulder, elbow, wrist], [3.1, 2.6, 2.3], stripes(pattern, len / pattern.length, len));
}

/** A fist: closed round the brush's handle, the fingers lined across it. */
const FIST: readonly string[] = [
  ".cddc.",
  "cdddcb",
  "caccbb",
  "cacabb",
  ".bbbb.",
];

/** A hand on the palette's edge, the thumb over it. */
const HAND: readonly string[] = [
  ".cdd.",
  "cddcb",
  "cdccb",
  "cacbb",
  ".bbb.",
];

/** Where his tail leaves his hip, and where its curl begins. */
const TAIL_ROOT: Pt = [55.5, 51];
const TAIL_START: Pt = [57.4, 53.4];
/** The tail's length from there, and the radius of the curl it winds into: from `TAIL_R0` at its start to `TAIL_R1` at its tip. */
const TAIL_LEN = 56;
const TAIL_R0 = 11.5;
const TAIL_R1 = 3.2;
/** The radius of the loose curl it hangs in when it's uncurled (`curl` 0). */
const TAIL_LOOSE = 11;

/**
 * His tail, walked along from his hip: its heading turns as it goes, counter-clockwise on the screen, by how tight it's
 * curled. `curl` 1 is the spiral he stands with (its curve tightening toward the tip), 0 a loose hook hanging out
 * behind him, between them it winds up or lets go (its length never changes). `sway` is how far, in radians, a ripple
 * running down it bends it at the tip, `phase` where that ripple is (animate it to make the tail swing). Thick at the
 * root and thin at the tip, in bands of his three colors.
 */
function tail(curl: number, sway: number, phase: number): { part: Part; at: Pt } {
  const steps = 76;
  const ds = TAIL_LEN / steps;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  let heading = lerp(72, 104.4, curl) * (Math.PI / 180);
  let [x, y] = TAIL_START;
  const pts: Pt[] = [TAIL_ROOT, TAIL_START];
  const r: number[] = [4.2, 4];
  for (let i = 1; i <= steps; i++) {
    const s = (i - 0.5) * ds;
    // The spiral's radius of curvature at s (it tightens), blended with the loose hook's.
    const rad = TAIL_R0 - ((TAIL_R0 - TAIL_R1) * s) / TAIL_LEN;
    heading -= (lerp(1 / TAIL_LOOSE, 1 / rad, curl) * ds);
    // The ripple: it grows toward the tip and travels down the tail.
    const h = heading + sway * Math.sin(phase - s * 0.16) * (s / TAIL_LEN);
    x += Math.cos(h) * ds;
    y += Math.sin(h) * ds;
    const radius = 4.1 - 2.6 * (i / steps);
    // (Resting on the ground when it's loose, never lower than his feet, and never out of his frame.)
    pts.push([Math.min(x, 79.5 - radius), Math.min(y, GROUND - 0.5 - radius)]);
    r.push(radius);
  }
  const bands = stripes("tgotgtogtotg", 4.6, TAIL_LEN, 1.1);
  return stroke(pts, r, (l, t, across) => bands(l - 0.06, t, across));
}

// ---- His brush and its paint, from the butt of its handle to the tip of its bristles.

/**
 * The brush along its axis: a handle (brown, lit on its upper left), a silver ferrule with a crimp at each end, and
 * the bristles, fat just under their tip. The paint on the tip is a part of its own (`paintGlob`).
 */
function brush(butt: Pt, tip: Pt): { part: Part; at: Pt } {
  const len = Math.hypot(tip[0] - butt[0], tip[1] - butt[1]);
  const ax = (tip[0] - butt[0]) / len;
  const ay = (tip[1] - butt[1]) / len;
  // The side of the brush that faces the light (up and left) is `n`.
  const [nx, ny] = ax - ay >= 0 ? [ay, -ax] : [-ay, ax];
  const pad = 5;
  const x0 = Math.floor(Math.min(butt[0], tip[0])) - pad;
  const y0 = Math.floor(Math.min(butt[1], tip[1])) - pad;
  const w = Math.ceil(Math.max(butt[0], tip[0])) + pad - x0 + 1;
  const h = Math.ceil(Math.max(butt[1], tip[1])) + pad - y0 + 1;
  /** Where a pixel lies: along the brush from its tip (`u`), and across it toward the light (`v`, signed). */
  const where = (x: number, y: number) => {
    const dx = x + 0.5 - tip[0];
    const dy = y + 0.5 - tip[1];
    return { u: -(dx * ax + dy * ay), v: dx * nx + dy * ny };
  };
  const BRISTLES = 12;
  const FERRULE = 6.5;
  const radius = (u: number): number => {
    if (u < 0) return -1;
    if (u < BRISTLES) return u < 4 ? 2.7 + 1.1 * (u / 4) : 3.8 - (u - 4) * 0.06;
    if (u < BRISTLES + FERRULE) return 3;
    return 1.8 + 0.4 * ((u - BRISTLES - FERRULE) / (len - BRISTLES - FERRULE));
  };
  return painted(x0, y0, w, h, (F) =>
    F(
      (x, y) => {
        const { u, v } = where(x, y);
        return u >= 0 && u <= len && Math.abs(v) <= radius(u);
      },
      (x, y) => {
        const { u, v } = where(x, y);
        const l = 0.62 + 0.4 * (v / radius(u));
        if (u < BRISTLES) return ramp("UVW", l + (u < 3 ? 0.1 : -0.05) - (Math.abs(v) < 0.6 || Math.round(v * 1.6) % 2 === 0 ? 0.12 : 0));
        if (u < BRISTLES + FERRULE) {
          const e = u - BRISTLES;
          return e < 0.9 || e > FERRULE - 1.2 ? "f" : ramp("fgij", l);
        }
        return ramp("LMNQ", l);
      },
    ),
  );
}

/** The paint on the bristles' tip: a dollop with a peak and a ragged edge, drips running down it, in the keys P, R and K only. */
const PAINT_GLOB: readonly string[] = [
  "...PPPPPP...",
  "..PRKKKRRP..",
  ".PRKwKRRRRP.",
  "PRRKKRRRRRRP",
  "PRRRRRRPRRRP",
  "PRPRRRPRPRRP",
  ".P.PRP.P.PRP",
  ".....P....RP",
  "..........P.",
];

/** Paint just taken from the palette: a small smear over the tip of the bristles. */
const PAINT_SMEAR: readonly string[] = [".PRRP.", "PRKRRP", "PRRRRP", ".PPPP."];

/** The palette: a wooden board with a thumb hole and a bite taken out of its edge, shaded from the top left. */
function paletteBoard(): { part: Part; at: Pt } {
  const board = inEllipse(16, 56, 10.4, 7.2);
  const bite = inEllipse(14, 63.4, 3.4, 2.2);
  const hole = inEllipse(22, 56.4, 1.3, 1.1);
  return painted(4, 47, 24, 18, (F) =>
    F((x, y) => board(x, y) && !bite(x, y), (x, y) => (hole(x, y) ? "L" : ramp("BCD", 0.66 - 0.04 * (x - 10) - 0.07 * (y - 52)))),
  );
}

/** The dabs on the palette: red, yellow, blue and green, over the board with no outline of their own. */
function dabs(): { part: Part; at: Pt } {
  return painted(4, 47, 24, 18, (_F, S) => {
    S(["211", "111"], 8, 52);
    S(["433", "333"], 14, 50);
    S(["655", "555"], 19, 52);
    S(["87", "77"], 9, 57);
  });
}

/** His shadow on the ground, `w` wide. */
function shadow(w: number): Part {
  const cv = canvas(w, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < w; x++) if (inEllipse(w / 2, 1.5, w / 2, 1.6)(x, y)) cv[y]![x] = "z";
  return { grid: toGrid(cv), outline: false };
}

// ---- Parts and the pose.

const { parts: PARTS, add } = lazyParts();
add("fist", () => ({ grid: FIST }));
add("hand", () => ({ grid: HAND }));
add("button", () => BUTTON);
add("paintGlob", () => ({ grid: PAINT_GLOB }));
add("paintSmear", () => ({ grid: PAINT_SMEAR }));
add("shadow", () => shadow(60));
add("foot", () => ({ grid: FOOT }));

type Placed = { name: string; at: Pt };
const placedAt = new Map<string, Pt>();
/** A part painted at a place of its own (its `at`), made the first time it's drawn, by a name that says how. */
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

/** A pose: the numbers that move him (scene pixels). */
export interface SmudgyPose {
  /** He sinks this many pixels (a crouch); his feet stay on the ground. */
  bob?: number;
  /** The whole of him moved sideways, and lifted off the ground (his shadow stays). */
  dx?: number;
  air?: number;
  /** His head (with its eyes, casque and beret) nodded down and leaning forward (negative: to our left) from his body. */
  nod?: number;
  lean?: number;
  /** The brush arm: the fist round the brush's handle and the elbow (bent by itself when left out). */
  fist?: Pt;
  elbowF?: Pt;
  /** The brush's axis: the butt of its handle and the tip of its bristles (`holding` works them out from the fist). */
  brushButt?: Pt;
  brushTip?: Pt;
  /** The brush arm drawn over his body (before the palette arm: across his belly, a dip) or over everything (a slash). */
  front?: boolean | "top";
  /** The paint on the brush: a full dollop (the still), the same on a brush held level (centered on the tip), a smear at the tip (just dipped) or none (a clean brush). */
  paint?: "full" | "side" | "smear" | "none";
  /** The palette arm: the hand and the elbow (bent by itself when left out); the palette moves with the hand. */
  handN?: Pt;
  elbowN?: Pt;
  /** The tail: how curled it is (1 the spiral he stands with, 0 a loose hook), and a ripple down it: how far it bends the tip (radians) and where the ripple is (radians; animate it). */
  curl?: number;
  sway?: number;
  swayPhase?: number;
  /** The casque moved from where it stands (a flare, a droop). */
  casque?: Pt;
  /** The beret moved from where it sits (a bounce), and how far it's tipped (degrees, negative: its front down). */
  beret?: Pt;
  beretTilt?: number;
  /** Where each eye looks, from the middle of its white: the near eye (our right) and the far one; and their lids. */
  gazeN?: Pt;
  gazeF?: Pt;
  lidN?: Lid;
  lidF?: Lid;
  mouth?: Mouth;
}

const REST = {
  bob: 0,
  dx: 0,
  air: 0,
  nod: 0,
  lean: 0,
  elbowF: [31, 42] as Pt,
  fist: [19.5, 41.5] as Pt,
  brushButt: [21.5, 46] as Pt,
  brushTip: [9.5, 11.5] as Pt,
  paint: "full" as "full" | "side" | "smear" | "none",
  elbowN: [33, 47.5] as Pt,
  handN: [27.5, 54] as Pt,
  curl: 1,
  sway: 0,
  swayPhase: 0,
  casque: [0, 0] as Pt,
  beret: [0, 0] as Pt,
  beretTilt: -13,
  gazeN: [-1.3, 0.5] as Pt,
  gazeF: [-1.1, 0.5] as Pt,
  lidN: "open" as Lid,
  lidF: "open" as Lid,
  mouth: "smirk" as Mouth,
};

const HIP_N: Pt = [46, 54];
const HIP_F: Pt = [53, 54];
const SHOULDER_N: Pt = [38.5, 42];
const SHOULDER_F: Pt = [44, 39];
/** His arms' bones: the upper arm and the forearm, as the still has them. */
const BONES_F: Pt = [13.3, 11.5];
const BONES_N: Pt = [7.8, 8.5];
/** The brush, butt to tip, and where the fist holds it in the still (from the butt). */
const BRUSH_LEN = 36.5;
const GRIP = 4.9;

/**
 * The brush held with the fist at `fist`, its axis tilted `tilt` degrees from straight up (positive: the tip to our left,
 * toward where he faces; 90 level, 180 down) and the fist `grip` px along it from the butt: the pose numbers that go
 * with it.
 */
export function holding(fist: Pt, tilt: number, grip = GRIP): Required<Pick<SmudgyPose, "fist" | "brushButt" | "brushTip">> {
  const a = (tilt * Math.PI) / 180;
  const d: Pt = [-Math.sin(a), -Math.cos(a)];
  return { fist, brushButt: [fist[0] - d[0] * grip, fist[1] - d[1] * grip], brushTip: [fist[0] + d[0] * (BRUSH_LEN - grip), fist[1] + d[1] * (BRUSH_LEN - grip)] };
}
/** The same, but given where the tip is. */
export function holdingTip(tip: Pt, tilt: number, grip: number): Required<Pick<SmudgyPose, "fist" | "brushButt" | "brushTip">> {
  const a = (tilt * Math.PI) / 180;
  const d: Pt = [-Math.sin(a), -Math.cos(a)];
  const butt: Pt = [tip[0] - d[0] * BRUSH_LEN, tip[1] - d[1] * BRUSH_LEN];
  return { fist: [butt[0] + d[0] * grip, butt[1] + d[1] * grip], brushButt: butt, brushTip: tip };
}

/** An elbow for an arm of two bones `l1` and `l2` from `s` to `t`, bent down (or as far out as it reaches). */
function elbowOf(s: Pt, t: Pt, [l1, l2]: Pt): Pt {
  const dist = Math.hypot(t[0] - s[0], t[1] - s[1]) || 0.01;
  const d = Math.min(dist, l1 + l2 - 0.01);
  const [ux, uy] = [(t[0] - s[0]) / dist, (t[1] - s[1]) / dist];
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const [mx, my] = [s[0] + ux * a, s[1] + uy * a];
  const c1: Pt = [mx - uy * h, my + ux * h];
  const c2: Pt = [mx + uy * h, my - ux * h];
  return c1[1] >= c2[1] ? c1 : c2;
}

const unit = (a: Pt, b: Pt): Pt => {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
};

/** The layers of a pose, back to front. */
export function smudgyLayers(pose: SmudgyPose = {}): Layer[] {
  const p = { ...REST, ...pose };
  const b = p.bob;
  const at = (part: string, x: number, y: number): Layer => ({ part, x: OX + Math.round(x), y: OY + Math.round(y) });
  const L = (pl: Placed, dy = 0, dx = 0) => at(pl.name, pl.at[0] + dx, pl.at[1] + dy);
  /** A part of his head: it nods and leans with it. */
  const H = (pl: Placed, dy = 0, dx = 0) => L(pl, b + p.nod + dy, p.lean + dx);
  const up = (q: Pt, dy: number): Pt => [q[0], q[1] + dy];
  // The palette moves with his hand: by how far it is from where it rests.
  const dPal: Pt = [p.handN[0] - REST.handN[0], p.handN[1] - REST.handN[1]];
  const leg = (name: string, hip: Pt, knee: Pt, ankle: Pt, pattern: string) => {
    const pts = [up(hip, b), up(knee, b / 2), ankle] as const;
    return L(placed(`${name}:${key(pts)}`, () => legPart(pts[0], pts[1], pts[2], pattern)));
  };
  const tailKey = [p.curl, p.sway, p.swayPhase].map((v) => Math.round(v * 50) / 50).join(":");
  const brushPts = [p.brushButt, p.brushTip] as const;
  const shoulderF = up(SHOULDER_F, b);
  const shoulderN = up(SHOULDER_N, b);
  const armF = [shoulderF, pose.elbowF ? up(p.elbowF, b) : pose.fist ? elbowOf(shoulderF, p.fist, BONES_F) : up(REST.elbowF, b), p.fist] as const;
  const armN = [shoulderN, pose.elbowN ? up(p.elbowN, b) : pose.handN ? elbowOf(shoulderN, p.handN, BONES_N) : up(REST.elbowN, b), p.handN] as const;
  const eyeN = placed(`eyeN:${p.gazeN}:${b}:${p.lidN}`, () => eye(40.5, 24.8 + b, 6.6, p.gazeN, p.lidN));
  const eyeF = placed(`eyeF:${p.gazeF}:${b}:${p.lidF}`, () => eye(27, 25.2 + b, 5.4, p.gazeF, p.lidF));
  // The brush arm, and the brush in its fist: behind his body unless `front`.
  const brushLayers: Layer[] = [
    L(placed(`armF:${key(armF)}`, () => arm(armF[0], armF[1], armF[2], "gogtg"))),
    L(placed(`brush:${key(brushPts)}`, () => brush(p.brushButt, p.brushTip))),
    ...(p.paint === "full"
      ? [at("paintGlob", p.brushTip[0] - 6, p.brushTip[1] - 6.5)]
      : p.paint === "side"
        ? [at("paintGlob", p.brushTip[0] - 6 + 2 * unit(p.brushButt, p.brushTip)[0], p.brushTip[1] - 4.5 + 2 * unit(p.brushButt, p.brushTip)[1])]
        : p.paint === "smear"
          ? [at("paintSmear", p.brushTip[0] - 2.5, p.brushTip[1] - 1.5)]
          : []),
    at("fist", p.fist[0] - 3, p.fist[1] - 2.5),
  ];
  const layers: Layer[] = [
    at("shadow", 15, GROUND - 3),
    // (The tail stays on the ground when he crouches: its root, behind his hip, is hidden either way.)
    L(placed(`tail:${tailKey}`, () => tail(p.curl, p.sway, p.swayPhase))),
    leg("legF", HIP_F, [60, 61], [58, 65], "ggtgg"),
    at("foot", 58 - 9, GROUND - 6),
    leg("legN", HIP_N, [37, 61], [38, 65], "ggotg"),
    at("foot", 38 - 9, GROUND - 6),
    ...(p.front ? [] : brushLayers),
    H(placed("casque", casque), p.casque[1], p.casque[0]),
    L(placed("torso", torso), b),
    L(placed("apron", apron), b),
    L(placed("splats", splats), b),
    L(placed("strap", strap), b),
    at("button", 41, 39.5 + b),
    at("button", 49, 39.5 + b),
    H(placed(`head:${p.mouth}`, () => head(p.mouth))),
    H(eyeF, -b),
    H(eyeN, -b),
    H(placed(`beret:${p.beretTilt}`, () => beret(p.beretTilt)), p.beret[1], p.beret[0]),
    ...(p.front === true ? brushLayers : []),
    // The palette arm, in front, and the palette in its hand.
    L(placed(`armN:${key(armN)}`, () => arm(armN[0], armN[1], armN[2], "gotg"))),
    L(placed("palette", paletteBoard), dPal[1], dPal[0]),
    L(placed("dabs", dabs), dPal[1], dPal[0]),
    at("hand", p.handN[0] - 2.5, p.handN[1] - 3),
    ...(p.front === "top" ? brushLayers : []),
  ];
  // The whole of him moved: sideways, and up (his shadow stays on the ground).
  return p.dx || p.air ? layers.map((l) => (l.part === "shadow" ? { ...l, x: l.x + p.dx } : { ...l, x: l.x + p.dx, y: l.y - p.air })) : layers;
}

// ---- Things drawn on his frames: flecks of paint, sparkles, dust, thoughts, sweat.

/** A speck at a scene point (the frame adds its own margins). */
const sp = (x: number, y: number, k: string): Speck => [OX + Math.round(x), OY + Math.round(y), k];
/**
 * Paint at a scene point: `n` 1 a fleck, 2 a drop, 3 a blob. They're in the brush's paint keys (P, R, K), so a frame that
 * recolors the brush recolors them too.
 */
const blob = (x: number, y: number, n: 1 | 2 | 3 | 4 = 2): Speck[] =>
  n === 4
    ? [".KKR.", "KRRRP", "RRRRP", "RRRPP", ".PPP."].flatMap((row, j) => [...row].flatMap((k, i): Speck[] => (k === "." ? [] : [sp(x - 2 + i, y - 2 + j, k)])))
    : n === 1
    ? [sp(x, y, "R")]
    : n === 2
      ? [sp(x, y, "K"), sp(x + 1, y, "R"), sp(x, y + 1, "R"), sp(x + 1, y + 1, "P")]
      : [sp(x - 1, y - 1, "K"), sp(x, y - 1, "R"), sp(x + 1, y - 1, "R"), sp(x - 1, y, "R"), sp(x, y, "R"), sp(x + 1, y, "P"), sp(x, y + 1, "P"), sp(x + 1, y + 1, "P"), sp(x - 1, y + 1, "P")];
/** A gold four-point sparkle, white at its heart. */
const sparkle = (x: number, y: number, big = false): Speck[] => [
  sp(x, y, "w"), sp(x - 1, y, "y"), sp(x + 1, y, "y"), sp(x, y - 1, "y"), sp(x, y + 1, "y"),
  ...(big ? [sp(x - 2, y, "Y"), sp(x + 2, y, "Y"), sp(x, y - 2, "Y"), sp(x, y + 2, "Y")] : []),
];
/** Dust kicked up either side of his feet (`t` frames after he lands): `n` puffs a side rolling outward and up. */
const dust = (t: number, n = 3, cx = FOOT_X, spread = 36): Speck[] => {
  const out: Speck[] = [];
  for (let side = -1; side <= 1; side += 2)
    for (let i = 0; i < n; i++) {
      const x = Math.round(cx + side * (spread * 0.5 + i * 3.5 + t * (2 + (i % 2))));
      const y = GROUND - 1 - Math.round(t * (0.6 + (i % 3) * 0.5) + (i % 2));
      const cloud: [number, number, string][] = t < 2 ? [[0, 0, "9"], [side, 0, "9"], [0, -1, "0"], [side, -1, "0"]] : [[0, 0, "0"], [side, -1, "9"]];
      for (const [ox, oy, k] of cloud) out.push(sp(x + ox, y + oy, k));
    }
  return out;
};
/** His shadow alone on the ground (he's above the frame, or about to come down), `r` its half-width. */
const groundShadow = (r: number, cx = FOOT_X): Speck[] => {
  const out: Speck[] = [];
  for (let x = -r; x <= r; x++) for (let y = -1; y <= 0; y++) if (Math.abs(x) < r - (y === -1 ? 2 : 0)) out.push(sp(cx + x, GROUND - 1 + y, "z"));
  return out;
};
/** Thoughts: gold dots rising off his beret, one more each beat (the third a spark). */
const thoughts = (n: number): Speck[] =>
  ([[59, 5], [63, 0], [67, -5]] as Pt[]).slice(0, n).flatMap(([x, y], i): Speck[] => (i === 2 ? sparkle(x, y) : [sp(x, y, "Y"), sp(x + 1, y, "O"), sp(x, y - 1, "y")]));
/** Sweat flying off his head, both ways. */
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [sp(24 - t, 21 + t * 2, "~"), sp(50 + t, 20 + t * 2, "~")];
};
/** Flecks of paint flung from where the brush's tip is, `t` frames after, fanning out along `dir` (degrees, 0 to our right, 90 down). */
const flecks = (tip: Pt, dir: number, t: number, n = 6): Speck[] =>
  Array.from({ length: n }, (_, i): Speck[] => {
    const a = ((dir + (i - (n - 1) / 2) * 16) * Math.PI) / 180;
    const d = 3 + t * (3.5 + (i % 3));
    return blob(tip[0] + Math.cos(a) * d, tip[1] + Math.sin(a) * d + 0.25 * t * t, (i % 3 === 0 ? 2 : 1) as 1 | 2);
  }).flat();

/** A hit: every color goes pale. */
const FLASH: Record<string, string> = Object.fromEntries(
  Object.entries(SMUDGY_PALETTE)
    .filter(([k]) => !["k", "z", "~", "9", "0", "w"].includes(k))
    .map(([k, c]) => {
      const n = parseInt(c.slice(1), 16);
      const mix = (v: number) => Math.round(v + (255 - v) * 0.55).toString(16).padStart(2, "0");
      return [k, `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`];
    }),
);

/**
 * The brush's paint recolored for Repaint (the paint keys P, R and K only: nothing else of his changes): his pawn
 * painted your color (white's: a cream) and your knight or bishop his (black's: a charcoal).
 */
export const PAINT_CREAM: Record<string, string> = { P: "#b5a98a", R: "#f1e8d2", K: "#ffffff" };
export const PAINT_CHARCOAL: Record<string, string> = { P: "#0f1013", R: "#30333a", K: "#6c727d" };

/** A frame of a pose; its specks that would touch the frame's edge are dropped (the test's rule: nothing at the edge). */
const F = (ms: number, pose: SmudgyPose = {}, extra: Partial<Frame> = {}): Frame => ({
  ms,
  layers: smudgyLayers(pose),
  ...extra,
  ...(extra.specks ? { specks: extra.specks.filter(([x, y]) => x >= 2 && y >= 2 && x <= W - 3 && y <= H - 3) } : {}),
});
const tipOf = (pose: SmudgyPose): Pt => pose.brushTip ?? REST.brushTip;

// ---- His poses: the brush held a few ways, the eyes, the tail.

/** The brush raised high beside his face; overhead; wound back over his head; flung forward; pointed ahead; slashed down. */
const HOLD_UP = holding([21, 37.5], 10);
const HOLD_OVER = holding([19.5, 36], 3);
const HOLD_BACK = holding([24, 35], -16);
const HOLD_FWD = holding([17, 40.5], 78);
/** Waving: the brush swept out to the left. */
const WAVE_L = holding([20, 38], 32);
const HOLD_FLING = holding([21, 39], 38);
const HOLD_POINT = holding([22, 39], 36);
const STROKE = holding([26, 38], 135);
/** Dipped in the palette: level across his belly, its tip on the yellow dab, the palette raised to meet it. */
const DIP: SmudgyPose = { ...holdingTip([14.5, 46], 90, 21), handN: [28, 51], front: true };

// ---- His animations. Frame counts and timings follow Alfil's and Chub & Chirp's.

/** Breathing: [bob] per frame. */
const BREATH = [0, 0, 0, 0, 1, 1, 1, 1] as const;
const TAU = Math.PI * 2;

/**
 * Idle: he breathes; his tail is alive: it loosens a little and swings once a loop, a ripple running down it (it's
 * still as he stands in the first frame, the approved still); his eyes swivel on their own, each looking its own way
 * now and then, and he blinks; a drop of paint runs off his brush. Frame 1 is the approved still.
 */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const e = Math.sin((Math.PI * i) / 16) ** 2;
    const both = i === 13;
    const p: SmudgyPose = {
      bob: BREATH[i % 8]!,
      curl: 1 - 0.18 * e,
      sway: 0.5 * e,
      swayPhase: (TAU * i) / 16,
      gazeN: i === 3 || i === 4 ? [0.9, -0.7] : i === 9 || i === 10 ? [-1.8, -0.9] : REST.gazeN,
      gazeF: i === 3 || i === 4 ? [-1.6, 0.9] : i === 6 || i === 7 ? [0.7, 0.3] : i === 11 || i === 12 ? [-0.4, -1] : REST.gazeF,
      lidN: both ? "shut" : "open",
      lidF: both ? "shut" : "open",
    };
    const drop = i >= 6 && i <= 10 ? blob(5, 14 + (i - 6) * 3, 1) : [];
    return F(125, p, { specks: drop });
  }),
};

/**
 * Entrance: his shadow spreads, he drops in from above, beret flying, and lands (a thump, dust, the beret bounced); then
 * a flourish of the brush, a flick of paint and a grin, and he settles with a sly look.
 */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 100, layers: [], specks: groundShadow(8), cue: "drop" },
    { ms: 100, layers: [], specks: groundShadow(16) },
    F(70, { air: 7, curl: 0.55, sway: 0.4, lidN: "wide", lidF: "wide", mouth: "open", beret: [0, -3], beretTilt: -30 }, { specks: flecks(REST.brushTip, 80, 1, 3) }),
    F(70, { air: 3, curl: 0.7, sway: 0.25, lidN: "wide", lidF: "wide", mouth: "open", beret: [0, -2], beretTilt: -24 }),
    F(130, { bob: 3, curl: 0.85, lidN: "shut", lidF: "shut", beret: [0, 1] }, { cue: "thump", shake: [0, 2], specks: dust(0) }),
    F(110, { bob: 1, beret: [0, -2], beretTilt: -8 }, { specks: dust(1) }),
    F(110, { bob: 0, beret: [0, 0] }, { specks: dust(2) }),
    F(160, { ...HOLD_OVER, mouth: "grin", lidN: "joy", lidF: "joy", curl: 0.9, sway: 0.3 }, { cue: "splat", specks: flecks(tipOf(HOLD_OVER), 110, 1, 5) }),
    F(160, { ...HOLD_UP, mouth: "grin", lidF: "half", gazeN: [0.6, 0.3], curl: 1, beretTilt: -18 }, { specks: flecks(tipOf(HOLD_OVER), 110, 3, 5) }),
    F(300, {}),
  ],
};

/** Thinking: the brush's handle tapped on his chin, his eyes rolled up, gold dots rising off his beret; the tail curling slowly. */
const thinking: Anim = {
  loop: true,
  frames: [0, 1, 2, 3].flatMap((n) =>
    [0, 1, 2, 3].map((i) =>
      F(130, { ...holding([24.5, i % 2 ? 37 : 37.8], 6), gazeN: [-0.5, -1.3], gazeF: i === 2 ? [0.4, -1.2] : [-1.4, -1.1], lidN: "half", lidF: "open", curl: [1, 0.92, 0.84, 0.92][i]!, sway: 0.08 * (i % 2 ? 1 : -1), swayPhase: i, beretTilt: i === 2 ? -9 : -16, bob: i === 2 ? 1 : 0 }, { specks: thoughts(n) }),
    ),
  ),
};

/** His move: a crouch, a hop with the tail whipping out behind and the beret lifting, a landing (dust), and a settle. */
const move: Anim = {
  loop: false,
  frames: [
    F(100, { bob: 2, beret: [0, 1] }),
    F(90, { air: 2, curl: 0.8, sway: 0.3, lidN: "wide", lidF: "wide", ...holding([20, 39], 30), beret: [0, -1], beretTilt: -18 }),
    F(110, { air: 5, curl: 0.45, sway: 0.4, lidN: "wide", lidF: "wide", mouth: "grin", ...holding([20, 39], 38), beret: [0, -3], beretTilt: -26 }),
    F(130, { bob: 2, curl: 0.8, beret: [0, 1], lidN: "shut", lidF: "shut" }, { cue: "thump", shake: [0, 1], specks: dust(0, 2) }),
    F(120, { bob: 1, beret: [0, -1], beretTilt: -9 }, { specks: dust(1, 2) }),
    F(160, {}),
  ],
};

/** A capture: he cheers, pumping the brush over his head, flicking paint, the tail corkscrewing, the beret bouncing. */
const capture: Anim = {
  loop: false,
  frames: [
    F(90, { bob: 1, ...HOLD_BACK, lean: 1 }, { cue: "splat" }),
    ...Array.from({ length: 10 }, (_, i) => {
      const odd = i % 2 === 1;
      const hold = odd ? WAVE_L : HOLD_UP;
      const p: SmudgyPose = { ...hold, air: odd ? 0 : 2, lidN: "joy", lidF: "joy", mouth: "grin", curl: odd ? 0.7 : 1, sway: odd ? 0.3 : -0.3, swayPhase: i * 1.2, beret: [0, odd ? 0 : -2], beretTilt: odd ? -10 : -20, bob: odd ? 1 : 0 };
      return F(85, p, { cue: i === 4 ? "giggle" : undefined, specks: [...(i < 8 ? flecks(tipOf(hold), odd ? 100 : 70, 1 + (i % 3), 4) : []), ...(i < 6 && !odd ? sparkle(30 + i * 2, 1) : [])] });
    }),
    F(160, { mouth: "smirk", lidF: "half" }),
  ],
};

/** Hurt: a flash, flecks fly off the brush, the beret pops off to the side, he's knocked back with his eyes shut; then he glares. */
const hurt: Anim = {
  loop: false,
  frames: [
    F(70, { bob: 2, dx: 1, lidN: "shut", lidF: "shut", mouth: "open", curl: 0.6, sway: 0.5, beret: [2, -4], beretTilt: -34 }, { cue: "oof", pal: FLASH, shake: [1, 0], specks: flecks(REST.brushTip, 60, 1, 5) }),
    F(80, { bob: 2, dx: 1, lidN: "shut", lidF: "shut", mouth: "open", curl: 0.7, sway: -0.4, beret: [3, -5], beretTilt: -38 }, { shake: [-1, 0], specks: flecks(REST.brushTip, 60, 2, 5) }),
    F(90, { bob: 1, dx: 2, lidN: "wide", lidF: "wide", mouth: "frown", curl: 0.85, beret: [2, -2], beretTilt: -26 }, { specks: flecks(REST.brushTip, 60, 3, 4) }),
    F(90, { bob: 1, dx: 1, lidN: "wide", lidF: "wide", mouth: "frown", beret: [1, -1], beretTilt: -18 }),
    F(110, { nod: 1, lidN: "half", lidF: "half", gazeN: [-1.6, 0.9], gazeF: [-1.4, 0.9], mouth: "frown" }),
    F(120, { lidN: "half", lidF: "open", gazeN: [0.5, 0.3], mouth: "smirk", ...HOLD_UP }),
    F(160, {}),
  ],
};

/** Check: he points the brush ahead (at the king) with a flourish of sparkle, grinning, his eye on it; twice. */
const check: Anim = {
  loop: false,
  frames: [
    F(100, { bob: 2, ...HOLD_BACK, lean: 1 }),
    F(120, { ...HOLD_POINT, paint: "side", mouth: "grin", gazeN: [-1.8, 0], gazeF: [-1.6, 0], nod: 1, lean: -1, curl: 0.9 }, { cue: "swish", specks: sparkle(tipOf(HOLD_POINT)[0] - 3, tipOf(HOLD_POINT)[1] - 2) }),
    F(100, { ...HOLD_POINT, paint: "side", mouth: "grin", gazeN: [-1.8, 0], gazeF: [-1.6, 0], nod: 1, lean: -1, bob: 1, curl: 0.95 }),
    F(100, { ...HOLD_UP, lidF: "half", gazeN: [0.6, 0.3] }),
    F(120, { ...HOLD_POINT, paint: "side", mouth: "grin", gazeN: [-1.8, 0], gazeF: [-1.6, 0], nod: 1, lean: -1, curl: 0.9 }, { specks: sparkle(tipOf(HOLD_POINT)[0] - 3, tipOf(HOLD_POINT)[1] - 2, true) }),
    F(100, { ...HOLD_POINT, paint: "side", mouth: "grin", gazeN: [-1.8, 0], gazeF: [-1.6, 0], nod: 1, lean: -1, bob: 1 }),
    F(150, { lidN: "half", lidF: "half" }),
    F(160, { lidN: "half", lidF: "half", mouth: "grin" }),
  ],
};

const SMUG_GAZE: readonly Pt[] = [[-1.1, 0.5], [-0.4, 0.4], [0.6, 0.3], [0.6, 0.3], [0.2, 0.4], [-0.6, 0.5], [-1.1, 0.5], [-1.1, 0.5]];
/** Smug: leaning back, heavy-lidded, a grin, the beret tipped, the tail lazily swaying, one eye wandering. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    F(150, {
      lean: 1,
      nod: -1,
      mouth: "grin",
      lidN: "half",
      lidF: "half",
      gazeN: REST.gazeN,
      gazeF: SMUG_GAZE[i]!,
      beretTilt: -18,
      curl: 0.95 - 0.05 * Math.sin((TAU * i) / 8),
      sway: 0.2,
      swayPhase: (TAU * i) / 8,
      beret: [0, i % 4 === 2 ? -1 : 0],
    }),
  ),
};

/** Rattled: shaking, eyes wide, mouth working, sweat flying, the tail wound tight and trembling, the beret jiggling. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const p: SmudgyPose = {
      dx: i % 2 ? 1 : -1,
      bob: i % 4 === 2 ? 1 : 0,
      lidN: "wide",
      lidF: "wide",
      mouth: i % 2 ? "open" : "frown",
      curl: 1,
      sway: 0.14 * (i % 2 ? 1 : -1),
      swayPhase: i,
      beret: [0, i % 2 ? -1 : 0],
      beretTilt: -13 + (i % 2 ? 4 : -4),
      ...holding([19.5 + (i % 2 ? 0.7 : -0.7), 41.5], 19.2),
    };
    return F(80, p, { specks: sweat(i) });
  }),
};

/** The beret over his eyes, the sag of the end. */
const SLUMP: SmudgyPose = { bob: 6, curl: 0.12, sway: 0, lidN: "shut", lidF: "shut", mouth: "frown", beret: [-1, 9], beretTilt: -7, ...STROKE, paint: "side", handN: [27.5, 58], nod: 1 };
/**
 * Defeat: a flash; the beret pops off his head, he reels; his tail uncurls and goes limp, the brush drops, and he slumps
 * with the beret fallen over his eyes.
 */
const defeat: Anim = {
  loop: false,
  frames: [
    F(80, { bob: 2, dx: 1, lidN: "shut", lidF: "shut", mouth: "open", beret: [2, -5], beretTilt: -36, curl: 0.6, sway: 0.5 }, { cue: "oof", pal: FLASH, shake: [1, 0], specks: flecks(REST.brushTip, 60, 1, 5) }),
    F(100, { bob: 2, dx: 2, lidN: "wide", lidF: "wide", mouth: "open", beret: [5, -8], beretTilt: -42, curl: 0.5, sway: -0.5 }, { specks: flecks(REST.brushTip, 60, 3, 4) }),
    F(110, { bob: 4, dx: 1, lidN: "half", lidF: "half", mouth: "frown", beret: [2, -2], beretTilt: -24, curl: 0.3, sway: 0.2, ...holding([22, 43], 40) }),
    F(120, { ...SLUMP, bob: 5, beret: [-1, 7] }, { cue: "flop", shake: [0, 1], specks: dust(0) }),
    F(140, SLUMP, { specks: dust(1) }),
    F(1000, SLUMP),
  ],
};

/** Victory: he hops in place, the brush waving over his head and flicking yellow, the tail corkscrewing, the beret bouncing. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 2, 5, 6, 5, 2, 0, 0, 0, 0, 0, 0][i]!;
    const wave = i % 2 ? WAVE_L : HOLD_UP;
    const p: SmudgyPose = {
      ...wave,
      air,
      bob: i === 0 || i === 6 ? 2 : 0,
      lidN: "joy",
      lidF: "joy",
      mouth: "grin",
      curl: 0.55 + 0.4 * Math.abs(Math.sin((TAU * i) / 12)),
      sway: 0.4 * Math.sin((TAU * i) / 6),
      swayPhase: (TAU * i) / 6,
      beret: [0, air > 0 ? -2 : i === 6 ? 1 : 0],
      beretTilt: air > 0 ? -22 : -12,
      handN: air > 0 ? [27.5, 52] : REST.handN,
    };
    return F(110, p, { cue: i === 2 ? "giggle" : i === 6 ? "thump" : undefined, specks: [...(i === 6 ? dust(0, 2) : i === 7 ? dust(1, 2) : []), ...(i % 3 === 0 ? flecks(tipOf(wave), 90, 2, 3) : []), ...(i % 4 === 1 ? sparkle(34, -2) : [])] });
  }),
};

/**
 * Camouflage's splash (his passive, at the start): he dips the brush in the palette, raises it loaded, winds back and
 * flings a big splash at the board (`splash`: it leaves the brush; the board flies it to his pawns), flecks flying; then
 * a sly look, one eye on you, the other wandering, and the brush loaded again.
 */
const camouflage: Anim = {
  loop: false,
  frames: [
    F(100, { bob: 1, ...DIP, paint: "smear", lidN: "half", lidF: "half", gazeN: [-1.4, 1], gazeF: [-1.2, 1] }),
    F(110, { bob: 1, ...DIP, paint: "smear", lidN: "half", lidF: "half", gazeN: [-1.4, 1], gazeF: [-1.2, 1], mouth: "grin" }, { specks: sparkle(15, 43) }),
    F(100, { ...HOLD_UP, paint: "full", mouth: "grin", lidN: "open", lidF: "open", curl: 0.95 }, { cue: "dab" }),
    F(90, { bob: 1, ...HOLD_BACK, lean: 1, nod: -1, mouth: "grin", curl: 0.8, sway: 0.2, beretTilt: -18 }),
    F(80, { ...HOLD_FLING, paint: "smear", lean: -1, nod: 1, mouth: "open", lidN: "wide", lidF: "wide", curl: 0.6, sway: 0.5, beret: [1, -1] }, { cue: "splash", specks: [...blob(tipOf(HOLD_FLING)[0] + 1, tipOf(HOLD_FLING)[1] - 5, 4), ...flecks(tipOf(HOLD_FLING), 235, 1, 7)] }),
    F(90, { ...HOLD_FLING, paint: "smear", lean: -1, mouth: "grin", lidN: "joy", lidF: "joy", curl: 0.75, sway: 0.2 }, { specks: [...blob(tipOf(HOLD_FLING)[0] + 4, tipOf(HOLD_FLING)[1] - 11, 4), ...blob(tipOf(HOLD_FLING)[0] - 1, tipOf(HOLD_FLING)[1] - 7, 2), ...flecks(tipOf(HOLD_FLING), 245, 3, 7)] }),
    F(80, { ...HOLD_UP, paint: "smear", mouth: "grin", lidN: "open", curl: 0.9 }, { specks: [...blob(tipOf(HOLD_FLING)[0] + 6, tipOf(HOLD_FLING)[1] - 15, 3), ...flecks(tipOf(HOLD_FLING), 250, 5, 6)] }),
    F(110, { paint: "smear", mouth: "smirk", gazeN: [0.3, 0.4], gazeF: [-1.9, -0.6], lidN: "half", lidF: "open", beretTilt: -18 }),
    F(110, { paint: "smear", mouth: "smirk", gazeN: [0.3, 0.4], gazeF: [-1.9, -0.6], lidN: "half", lidF: "open", beretTilt: -18, curl: 0.92 }),
    F(90, { paint: "smear", mouth: "grin", gazeN: [0.3, 0.4], lidN: "half" }, { specks: sparkle(11, 11) }),
    F(80, {}),
  ],
};

/**
 * The strike, the reveal (his passive's second half: the disguised piece makes its rook move and the paint drips off
 * it, `drip`): he crouches with his tail wound tight, then the tail snaps open, the beret leaps off his head, and he
 * laughs with the brush up; the tail curls back, the beret lands.
 */
const strike: Anim = {
  loop: false,
  frames: [
    F(110, { bob: 2, curl: 1, lidN: "wide", lidF: "wide", mouth: "grin", beret: [0, 1] }),
    F(60, { air: 1, curl: 0.15, sway: 0.5, swayPhase: 0, lidN: "joy", lidF: "joy", mouth: "grin", beret: [0, -5], beretTilt: -28, ...HOLD_UP }, { cue: "drip", specks: sparkle(46, -4) }),
    F(70, { air: 3, curl: 0, sway: 0.35, swayPhase: 2, lidN: "joy", lidF: "joy", mouth: "grin", beret: [0, -5], beretTilt: -32, ...HOLD_OVER }, { specks: [...flecks(tipOf(HOLD_OVER), 90, 2, 5), ...sparkle(50, -3, true)] }),
    F(80, { air: 2, curl: 0.3, sway: 0.4, swayPhase: 4, lidN: "joy", lidF: "joy", mouth: "grin", beret: [0, -3], beretTilt: -24, ...HOLD_UP }),
    F(90, { bob: 2, curl: 0.6, sway: 0.25, swayPhase: 5, lidN: "shut", lidF: "shut", mouth: "grin", beret: [0, 1] }, { cue: "thump", shake: [0, 1], specks: dust(0, 2) }),
    F(100, { bob: 0, curl: 0.8, sway: 0.15, swayPhase: 6, lidN: "joy", lidF: "joy", mouth: "grin", beret: [0, -2], beretTilt: -6 }, { specks: dust(1, 2) }),
    F(110, { curl: 0.95, lidN: "joy", lidF: "joy", mouth: "grin", beret: [0, 0], beretTilt: -16 }),
    F(140, { mouth: "smirk", lidN: "half", lidF: "half", beretTilt: -16 }),
    F(160, {}),
  ],
};

/**
 * Repaint, his ultimate: two quick brush strokes. The paint on his brush goes your color (a cream), he winds back and
 * strokes (`stroke1`: his pawn goes your color); it goes his color (a charcoal) with a sparkle, he winds back again and
 * strokes (`stroke2`: your knight or bishop goes his); a flourish and a grin.
 */
const repaint: Anim = {
  loop: false,
  frames: [
    F(120, { ...HOLD_UP, lidN: "half", lidF: "half", mouth: "grin", curl: 0.95 }, { pal: PAINT_CREAM, specks: sparkle(14, 4) }),
    F(90, { bob: 1, ...HOLD_BACK, lean: 1, nod: -1, mouth: "grin", curl: 0.8, sway: 0.2 }, { pal: PAINT_CREAM }),
    F(60, { ...STROKE, front: "top", paint: "side", lean: -1, nod: 1, mouth: "open", lidN: "wide", lidF: "wide", curl: 0.6, sway: 0.4, beret: [1, -1] }, { cue: "stroke1", pal: PAINT_CREAM, specks: [...blob(10, 56, 3), ...flecks([6, 62], 160, 1, 5)] }),
    F(160, { ...STROKE, front: "top", paint: "side", lean: -1, mouth: "grin", lidN: "joy", lidF: "joy", curl: 0.75 }, { pal: PAINT_CREAM, specks: flecks([6, 62], 150, 3, 5) }),
    F(150, { ...HOLD_UP, lidN: "open", lidF: "half", mouth: "grin", curl: 0.95, beret: [0, -1] }, { pal: PAINT_CHARCOAL, specks: sparkle(14, 4, true) }),
    F(90, { bob: 1, ...HOLD_BACK, lean: 1, nod: -1, mouth: "grin", curl: 0.8, sway: -0.2 }, { pal: PAINT_CHARCOAL }),
    F(60, { ...STROKE, front: "top", paint: "side", lean: -1, nod: 1, mouth: "open", lidN: "wide", lidF: "wide", curl: 0.6, sway: -0.4, beret: [1, -1] }, { cue: "stroke2", pal: PAINT_CHARCOAL, specks: [...blob(10, 56, 3), ...flecks([6, 62], 160, 1, 5)] }),
    F(160, { ...STROKE, front: "top", paint: "side", lean: -1, mouth: "grin", lidN: "joy", lidF: "joy", curl: 0.75 }, { pal: PAINT_CHARCOAL, specks: flecks([6, 62], 150, 3, 5) }),
    F(120, { ...HOLD_OVER, lidN: "joy", lidF: "joy", mouth: "grin", curl: 0.9, sway: 0.3, beret: [0, -2], beretTilt: -20 }, { specks: sparkle(30, 1) }),
    F(140, { mouth: "smirk", lidN: "half", lidF: "half" }),
    F(160, {}),
  ],
};

// ---- His attack on a king (for his kit's `kingAttack` once he's wired in: perSquare 36, stand 1.8, facesLeft).

/** Room ahead of him (to our left, where he faces) for the brush's reach and the paint's flight, and headroom to drop in from. */
const ATTACK_REACH = 34;
const ATTACK_TOP = 18;
const AW = W + ATTACK_REACH;
const AH = H + ATTACK_TOP;
/** Where each blob reaches the king (scene pixels): at his head, or a little lower, in turn, past his square's middle. */
const STAND = 1.8 * 36;
const KING_AT = (i: number): Pt => [FOOT_X - STAND - 4, GROUND - 1 - (i % 2 ? 21 : 27)];
/** A frame of his in the attack's bigger frame. */
const fa = (fr: Frame): Frame => moved(fr, ATTACK_REACH, ATTACK_TOP, AW, AH);
const landShadow = (r: number): Speck[] => groundShadow(r).map(([x, y, k]): Speck => [x + ATTACK_REACH, y + ATTACK_TOP, k]);

/** A blob's flight from his brush to the king (scene pixels): a short lob, the point `t` (0 to 1) along it. */
function lob(from: Pt, i: number, t: number): Pt {
  const to = KING_AT(i);
  const c: Pt = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - 6];
  return [(1 - t) ** 2 * from[0] + 2 * (1 - t) * t * c[0] + t * t * to[0], (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * c[1] + t * t * to[1]];
}
/** Drops of paint behind the blob, from his brush, brighter toward it. */
function paintTrail(from: Pt, i: number): Speck[] {
  const out: Speck[] = [];
  for (let n = 3; n <= 22; n++) {
    const t = n / 28;
    if (t < 0.45 && n % 2) continue;
    const [x, y] = lob(from, i, t);
    out.push(sp(x, y, t > 0.55 ? "K" : t > 0.35 ? "R" : "P"));
  }
  return out;
}

/** In the attack, his face is on the king: both eyes on him, the head nodded and leaning toward him. */
const ON_KING: SmudgyPose = { gazeN: [-1.9, 0.9], gazeF: [-1.6, 0.9], nod: 1, lean: -1, lidN: "open", lidF: "open" };
/**
 * A flick: the brush flung at the king, the paint's blob just reaching his head at the end of a lob of drops (the board
 * splats it on his square), his tail whipping.
 */
const flickAt = (i: number): Frame => {
  const pose: SmudgyPose = { ...HOLD_FWD, ...ON_KING, mouth: "grin", bob: 1, curl: 0.7, sway: i % 2 ? -0.45 : 0.45, swayPhase: i, paint: "smear", beret: [0, i % 2 ? 0 : -1], beretTilt: i % 2 ? -17 : -9 };
  const fr = fa(F(90, pose, { cue: i % 2 ? "splat" : "flick", shake: [i % 2 ? -1 : 1, 0] }));
  const tip = tipOf(pose);
  const [bx, by] = lob(tip, i, 0.86);
  return { ...fr, specks: [...(fr.specks ?? []), ...[...paintTrail(tip, i), ...blob(bx, by, 4)].map(([x, y, k]): Speck => [x + ATTACK_REACH, y + ATTACK_TOP, k])] };
};
/** Between flicks: the brush swung back up and loaded, his eyes still on the king. */
const windUp = (i: number): Frame =>
  fa(F(80, { ...(i % 2 ? HOLD_UP : HOLD_BACK), ...ON_KING, mouth: "grin", lean: i % 2 ? -1 : 0, curl: 0.9, sway: i % 2 ? 0.2 : -0.2, swayPhase: i + 2, beretTilt: -14, paint: "full" }));

/**
 * His attack on a king, the king to our left (where he faces; the board mirrors him when it's to his right), on the
 * shared beats (KING_ATTACK, boss-timing.ts): his shadow spreads, he drops in from above, beret flying, and lands
 * (`land`); then he paints the king nonstop: ten flicks of the brush, a blob of yellow paint on each, cues `flick` and
 * `splat` in turn (the cue frame is where the blob reaches the king's head: the board splats it there), his eyes and
 * his face on the king throughout; he laughs, the brush up, and they bound off. The last frame is empty.
 */
const kingAttack: Anim = (() => {
  const A = KING_ATTACK;
  const frames: Frame[] = [
    { ms: 100, layers: [], specks: landShadow(8) },
    { ms: 100, layers: [], specks: landShadow(16) },
    fa(F(80, { air: 24, ...HOLD_UP, curl: 0.55, sway: 0.4, lidN: "wide", lidF: "wide", mouth: "open", beret: [0, -4], beretTilt: -30 }, { cue: "drop" })),
    fa(F(80, { air: 9, ...HOLD_UP, curl: 0.7, lidN: "wide", lidF: "wide", mouth: "open", beret: [0, -2], beretTilt: -24, ...ON_KING })),
    fa(F(A.landAt - 360, { bob: 3, curl: 0.85, ...ON_KING, lidN: "shut", lidF: "shut", beret: [0, 1] }, { cue: "land", shake: [0, 1], specks: dust(0) })),
    fa(F(A.lashAt - A.landAt, { ...HOLD_BACK, ...ON_KING, mouth: "grin", lean: 0, curl: 0.9, beretTilt: -14 }, { specks: dust(1) })),
  ];
  for (let i = 0; i < A.lashes; i++) frames.push(flickAt(i), windUp(i));
  const laugh = A.leaveAt - (A.lashAt + A.lashes * A.lashEveryMs);
  frames.push(fa(F(laugh, { ...HOLD_OVER, lidN: "joy", lidF: "joy", mouth: "grin", curl: 0.8, sway: 0.3 }, { cue: "cheer", specks: flecks(tipOf(HOLD_OVER), 100, 2, 4) })));
  const leave = A.ms - A.leaveAt;
  frames.push(
    fa(F(leave - 300, { bob: 3, mouth: "grin", lidF: "half" })),
    fa(F(80, { air: 8, ...HOLD_UP, curl: 0.6, sway: 0.4, lidN: "joy", lidF: "joy", mouth: "grin", beret: [0, -3], beretTilt: -24 }, { cue: "drop" })),
    fa(F(80, { air: 24, ...HOLD_UP, curl: 0.5, sway: -0.4, lidN: "joy", lidF: "joy", mouth: "grin", beret: [0, -4], beretTilt: -30 })),
    { ms: 80, layers: [], specks: landShadow(10) },
    { ms: 60, layers: [] },
  );
  return { loop: false, frames };
})();

export const SMUDGY: Character = {
  id: "smudgy",
  name: "Smudgy",
  w: W,
  h: H,
  foot: [OX + FOOT_X, OY + GROUND],
  palette: SMUDGY_PALETTE,
  halo: "#26301f",
  parts: PARTS,
  anims: { idle, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, camouflage, strike, repaint },
};

/**
 * Smudgy for his attack on a king: the same drawing, parts and palette, facing our left as always (as Sawyer), in a frame
 * `ATTACK_REACH` wider on the left (his brush's reach and the paint's flight) and `ATTACK_TOP` taller (he drops in). Its
 * `idle`, one still, is for the preview, which starts every reel from one.
 */
export const SMUDGY_ATTACK: Character = {
  ...SMUDGY,
  id: "smudgy-attack",
  name: "Smudgy (his attack)",
  w: AW,
  h: AH,
  foot: [SMUDGY.foot[0] + ATTACK_REACH, SMUDGY.foot[1] + ATTACK_TOP],
  anims: { idle: { loop: true, frames: [fa(F(1000))] }, kingAttack },
};

/**
 * His lines (the director's draft, Oct 19, as written: docs/decisions/2026-10-19-smudgy-wired.md): a cheerful, slightly
 * vain artist who never blended in like the other chameleons and made peace with it by getting loud about color. Short,
 * paint and gallery jokes, never mean. `power` is Camouflage's splash over his pawns; `camoStrike` the hidden rook
 * revealed by his move (the rules' moment `unmask`, which is not the `strike` beat: that is his periodic strike on a
 * piece); `rookTaken` the crowd taking it; `ultimateWarn` Repaint coming, `ultimate` Repaint itself. How often a
 * moment speaks: SMUDGY_CHANCE; a power's moment always has its line.
 */
export const SMUDGY_LINES: Partial<Record<import("./boss-beats.ts").Beat, readonly string[]>> = {
  entrance: ["Smudgy, artist. Don't touch the wet parts.", "Every chameleon blends in. I'd rather stand out.", "Hold still. I'm painting you into a corner."],
  move: ["A little dab here…", "Broad strokes.", "Needs more yellow.", "Light touch."],
  capture: ["Painted over!", "That one didn't go with the room.", "Into the scrap pile!"],
  hurt: ["My palette!", "Hey! That was still drying!", "Smudged!"],
  strike: ["Brush stroke!", "Splat!"],
  power: ["Now you see it…", "Which one's which? Even I forget.", "Fresh coat for the boys."],
  camoStrike: ["Surprise! A rook all along!", "Ta-da! Nobody ever notices me. Until now."],
  rookTaken: ["Hey! How did you know?!", "My masterpiece!"],
  thinking: ["Where does this one go…", "An artist never rushes."],
  check: ["Check! Hold that pose!", "Check! Somebody frame this!"],
  smug: ["A masterpiece, if I say so myself.", "The other chameleons should see me now."],
  rattled: ["This isn't the picture I had in mind!", "Too many colors! Too many!"],
  victory: ["Signed, Smudgy!", "Hang it in a gallery!"],
  defeat: ["Back to the drawing board…", "I wanted to stand out. Not like this."],
  ultimateWarn: ["My brush is getting itchy…", "Time for a new color scheme."],
  ultimate: ["Repaint! Your side, my side, who can tell?", "A little white here, a little black there…", "Let's switch things up."],
  kingAttack: ["Hold still, your majesty. You need a touch-up.", "Yellow's your color, King!", "Splat! Splat! Splat!"],
};
/** How often each moment speaks (Chub & Chirp's, plus every one of his powers' moments always: a power's line is always said). */
export const SMUDGY_CHANCE: Partial<Record<import("./boss-beats.ts").Beat, number>> = {
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
  strike: 0.8,
  kingAttack: 1,
  camoStrike: 1,
  rookTaken: 1,
  power: 1,
  ultimate: 1,
};

/**
 * The part of him a portrait shows (his head, beret, casque and eyes, and the tip of his brush beside them, which says
 * who he is), in frame pixels.
 */
export const SMUDGY_PORTRAIT = { x: OX + 1, y: OY + 2, w: 60, h: 41 } as const;
