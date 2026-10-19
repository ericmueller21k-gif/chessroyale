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
 * This is his still, for Eric's review (docs/decisions/2026-10-19-smudgy-still.md): one pose, `idle`'s one frame, and
 * `SMUDGY_PORTRAIT`. Nothing in the game draws him yet (he isn't in `CHARACTERS`, `BOSS_KITS` or the roster); the
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
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part } from "./sprite.ts";

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
/** His mouth, a smirk: along the jaw, curling up into his cheek. */
const MOUTH: Pt[] = [[17.5, 32.8], [21, 33.4], [26, 34.2], [31, 33.9], [35, 32.4], [37.5, 30.2], [38.8, 28.2]];

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
function head(): { part: Part; at: Pt } {
  const inside = inPoly(HEAD);
  const light = roundLight(34, 24, 17, 15, 0.16);
  const mouthY = (x: number): number => {
    const i = MOUTH.findIndex((p, j) => j > 0 && x <= p[0]);
    if (i < 1) return x < MOUTH[0]![0] ? MOUTH[0]![1] : MOUTH.at(-1)![1];
    const [a, b] = [MOUTH[i - 1]!, MOUTH[i]!];
    return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  };
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
    // The smirk, a line along the segments of MOUTH.
    MOUTH.slice(1).forEach((q, i) => {
      const a = MOUTH[i]!;
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
function eye(cx: number, cy: number, rb: number, [gx, gy]: Pt): { part: Part; at: Pt } {
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
      const lid = py < c - ro * 0.72;
      if (d > ro || lid) {
        cv[y]![x] = ramp(GREEN, bulb(x, y) - (d < ro + 1 ? 0.2 : 0));
        continue;
      }
      cv[y]![x] = py < c - ro * 0.45 ? "S" : "h";
      const di = Math.hypot(px - ix, py - iy);
      if (di <= ri) cv[y]![x] = di >= ri - 0.9 ? "E" : py < iy ? "F" : "G";
      if (di <= rp) cv[y]![x] = "X";
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
    pts.push([x, y]);
    r.push(4.1 - 2.6 * (i / steps));
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
  /** The brush arm: the elbow, and the fist round the brush's handle. */
  elbowF?: Pt;
  fist?: Pt;
  /** The brush's axis: the butt of its handle and the tip of its bristles (its paint sits on the tip). */
  brushButt?: Pt;
  brushTip?: Pt;
  /** The palette arm: the elbow and the hand; the palette moves with the hand. */
  elbowN?: Pt;
  handN?: Pt;
  /** The tail: how curled it is (1 the spiral he stands with, 0 a loose hook), and a ripple down it: how far it bends the tip (radians) and where the ripple is (radians; animate it). */
  curl?: number;
  sway?: number;
  swayPhase?: number;
  /** The casque moved from where it stands (a flare, a droop). */
  casque?: Pt;
  /** The beret moved from where it sits (a bounce), and how far it's tipped (degrees, negative: its front down). */
  beret?: Pt;
  beretTilt?: number;
  /** Where each eye looks, from the middle of its white: the near eye (our right) and the far one. */
  gazeN?: Pt;
  gazeF?: Pt;
}

const REST = {
  bob: 0,
  elbowF: [31, 42] as Pt,
  fist: [19.5, 41.5] as Pt,
  brushButt: [21.5, 46] as Pt,
  brushTip: [9.5, 11.5] as Pt,
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
};

const HIP_N: Pt = [46, 54];
const HIP_F: Pt = [53, 54];
const SHOULDER_N: Pt = [38.5, 42];
const SHOULDER_F: Pt = [44, 39];

/** The layers of a pose, back to front. */
export function smudgyLayers(pose: SmudgyPose = {}): Layer[] {
  const p = { ...REST, ...pose };
  const b = p.bob;
  const at = (part: string, x: number, y: number): Layer => ({ part, x: OX + Math.round(x), y: OY + Math.round(y) });
  const L = (pl: Placed, dy = 0, dx = 0) => at(pl.name, pl.at[0] + dx, pl.at[1] + dy);
  const up = (q: Pt, dy: number): Pt => [q[0], q[1] + dy];
  // The palette moves with his hand: by how far it is from where it rests.
  const dPal: Pt = [p.handN[0] - REST.handN[0], p.handN[1] - REST.handN[1]];
  const leg = (name: string, hip: Pt, knee: Pt, ankle: Pt, pattern: string) => {
    const pts = [up(hip, b), up(knee, b / 2), ankle] as const;
    return L(placed(`${name}:${key(pts)}`, () => legPart(pts[0], pts[1], pts[2], pattern)));
  };
  const tailKey = [p.curl, p.sway, p.swayPhase].map((v) => Math.round(v * 50) / 50).join(":");
  const brushPts = [p.brushButt, p.brushTip] as const;
  const armF = [up(SHOULDER_F, b), up(p.elbowF, b), p.fist] as const;
  const armN = [up(SHOULDER_N, b), up(p.elbowN, b), p.handN] as const;
  const eyeN = placed(`eyeN:${p.gazeN}:${b}`, () => eye(40.5, 24.8 + b, 6.6, p.gazeN));
  const eyeF = placed(`eyeF:${p.gazeF}:${b}`, () => eye(27, 25.2 + b, 5.4, p.gazeF));
  return [
    at("shadow", 15, GROUND - 3),
    L(placed(`tail:${tailKey}`, () => tail(p.curl, p.sway, p.swayPhase)), b / 2),
    leg("legF", HIP_F, [60, 61], [58, 65], "ggtgg"),
    at("foot", 58 - 9, GROUND - 6),
    leg("legN", HIP_N, [37, 61], [38, 65], "ggotg"),
    at("foot", 38 - 9, GROUND - 6),
    // The brush arm, behind his body, and the brush in its fist.
    L(placed(`armF:${key(armF)}`, () => arm(armF[0], armF[1], armF[2], "gogtg"))),
    L(placed(`brush:${key(brushPts)}`, () => brush(p.brushButt, p.brushTip))),
    at("paintGlob", p.brushTip[0] - 6, p.brushTip[1] - 6.5),
    at("fist", p.fist[0] - 3, p.fist[1] - 2.5),
    L(placed("casque", casque), b + p.casque[1], p.casque[0]),
    L(placed("torso", torso), b),
    L(placed("apron", apron), b),
    L(placed("splats", splats), b),
    L(placed("strap", strap), b),
    at("button", 41, 39.5 + b),
    at("button", 49, 39.5 + b),
    L(placed("head", head), b),
    L(eyeF),
    L(eyeN),
    L(placed(`beret:${p.beretTilt}`, () => beret(p.beretTilt)), b + p.beret[1], p.beret[0]),
    // The palette arm, in front, and the palette in its hand.
    L(placed(`armN:${key(armN)}`, () => arm(armN[0], armN[1], armN[2], "gotg"))),
    L(placed("palette", paletteBoard), dPal[1], dPal[0]),
    L(placed("dabs", dabs), dPal[1], dPal[0]),
    at("hand", p.handN[0] - 2.5, p.handN[1] - 3),
  ];
}

const idle: Anim = {
  loop: true,
  frames: [{ layers: smudgyLayers(), ms: 1000 } satisfies Frame],
};

export const SMUDGY: Character = {
  id: "smudgy",
  name: "Smudgy",
  w: W,
  h: H,
  foot: [OX + FOOT_X, OY + GROUND],
  palette: SMUDGY_PALETTE,
  halo: "#26301f",
  parts: PARTS,
  anims: { idle },
};

/**
 * The part of him a portrait shows (his head, beret, casque and eyes, and the tip of his brush beside them, which says
 * who he is), in frame pixels.
 */
export const SMUDGY_PORTRAIT = { x: OX + 1, y: OY + 2, w: 60, h: 41 } as const;
