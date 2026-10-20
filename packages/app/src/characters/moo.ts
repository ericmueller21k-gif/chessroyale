/**
 * Moo, the cow, and his friend the Moon (Eric, Oct 20): a lonely cow who always wanted a friend; the moon was always
 * looking down, curious about the farm, and now they're buddies. The cow doesn't talk (he's a cow); the moon does, and
 * Moo answers with moos. He's Moo because that's what the moon always heard him say. After Eric's three references,
 * redrawn: a round, soft Holstein calf, cream with dark-brown patches (a big one over his near eye), a pink snout, big
 * floppy brown ears with pink insides, small tan horns and a cream tuft between them, big brown eyes, dark hooves and a
 * thin tail with a dark tuft, standing up on his hind legs and hugging a crescent moon (soft yellow, a darker rim,
 * closed happy eyes, a small smile, pink cheeks) with his cheek on its tip. Drawn three-quarters on, facing our left
 * (as Alfil, Sawyer, Chub & Chirp and Smudgy), the moon on the side toward the board, light from the top left.
 *
 * Three stills for Eric's review (this step is the look only: his powers and his animations come later):
 * `idle` (hugging the moon), `sit` (sitting on the moon as it floats under him like a little boat, its face on the
 * front) and `power` (the idle drawn powered-up: he takes in the moon's power, so his cream turns yellow-gold, his eyes
 * glow white under angry brows, his tuft becomes a spiky yellow crest, his ears stand up and a golden aura flickers
 * round him; the moon stays happy). Nothing in the game draws him yet (he isn't in `CHARACTERS`, `BOSS_KITS` or the
 * roster); the preview draws him with its `extra=` option.
 *
 * Rigging, so the poses and animations that follow are numbers (`MooPose`): the moon is a part of its own (held, sat
 * on, floating) and so are its eyes, mouth and cheeks (it talks and he moos back); his head, with his eyes, brows,
 * horns and tuft riding on it, moves (`head`: it nuzzles the moon); his ears (`earN`, `earF`: they flop), his tail
 * (`tail`: it swishes), both front legs (`armN`, `armF`: they hug), his eyes and brows (`eyes`, `brows`: the powered-up
 * brows go angry) and the aura are parts of their own. The powered-up colors are a palette swap (`MOO_POWER_PALETTE`),
 * so any frame can be drawn powered-up with `pal` (a pose's `power` also brings the crest, the angry brows, the glowing
 * eyes, the raised ears and the aura).
 */
import { canvas, flame, inEllipse, line, poly, roundLight, toGrid, type Canvas } from "./paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part } from "./sprite.ts";

export const MOO_PALETTE: Record<string, string> = {
  k: "#25140d", // outline
  C: "#bf9f78", // his cream: shade, mid, light, highlight
  D: "#e0c8a2",
  E: "#f5e6c6",
  F: "#fff6e0",
  a: "#37201a", // the brown of his patches, ears, tuft and hooves: dark to light
  b: "#552f27",
  c: "#744339",
  d: "#92594a",
  p: "#b95a63", // pink (snout, inside his ears): shade, mid, light, highlight
  q: "#dd7b80",
  r: "#f19c96",
  s: "#ffc1b2",
  n: "#6e2a33", // his nostrils
  h: "#a9773e", // his horns: tan, shade, mid, light
  i: "#d3a25c",
  j: "#efcb8c",
  e: "#b07240", // his eyes: the ring, the pupil, the glint
  x: "#1f0f0a",
  w: "#ffffff",
  M: "#e3a22b", // the moon: yellow, shade, mid, light, highlight
  N: "#f8c744",
  O: "#ffdc6c",
  P: "#fff0a8",
  Q: "#c9801f", // the moon's darker yellow-orange rim
  u: "#6a3714", // its face: the lines of its eyes and mouth
  v: "#f08e80", // and its pink cheeks, with a light touch
  V: "#ffb1a4",
  "2": "#ffd22a", // the powered-up crest: shade, mid, light (nothing else uses them)
  "3": "#fff27a",
  "4": "#ffffd0",
  "5": "#e2850a", // the aura: its rim, then deeper gold, gold, yellow, and a pale core
  "6": "#f5a60f",
  "7": "#ffc933",
  "8": "#ffe55c",
  "9": "#fffbc2",
  z: "#0d0e12", // ground shadow
};

/**
 * What changes when he takes in the moon's power: his cream turns yellow-gold (a lemon gold, so he stands apart from the
 * moon's warmer yellow), his eyes glow white, and the outline goes a dark gold, so the yellow still reads on a light
 * ground. The brown stays. As a frame's `pal`, it recolors any pose; the shapes that go with it (crest, angry brows,
 * aura) are in `MooPose.power`.
 */
export const MOO_POWER_PALETTE: Record<string, string> = {
  k: "#4a2f06",
  C: "#cfa013",
  D: "#efc926",
  E: "#fbe53c",
  F: "#fff794",
  e: "#fff2b3",
  x: "#ffffff",
};

type Pt = readonly [number, number];
type Inside = (x: number, y: number) => boolean;
type Key = (x: number, y: number) => string;

const CREAM = "CDEF";
const BROWN = "abcd";
const PINK = "pqrs";
const HORN = "hij";
const MOON = "MNOP";

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
const union = (...fs: Inside[]): Inside => (x, y) => fs.some((f) => f(x, y));
const E = inEllipse;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** A patch of brown: an ellipse with a wavering edge, so no patch is a neat oval (`seed` picks the waver). */
function patch(cx: number, cy: number, rx: number, ry: number, seed: number): Inside {
  return (x, y) => {
    const nx = (x + 0.5 - cx) / rx;
    const ny = (y + 0.5 - cy) / ry;
    const a = Math.atan2(ny, nx);
    const r = 1 + 0.13 * Math.sin(3 * a + seed) + 0.07 * Math.sin(5 * a + seed * 2.3);
    return nx * nx + ny * ny <= r * r;
  };
}

// ---- Painting: a part from shapes in the scene's own coordinates (the ground at y `GROUND`), or from strokes.

type Stamp = (rows: readonly string[], x: number, y: number) => void;

/** A part painted in the scene: its canvas covers (x0, y0) to (x0 + w, y0 + h). `F` fills where `inside`; `S` stamps pixel rows. */
function painted(x0: number, y0: number, w: number, h: number, draw: (F: (inside: Inside, key: Key) => void, S: Stamp, cv: Canvas) => void, outline = true): { part: Part; at: Pt } {
  const cv: Canvas = canvas(w, h);
  const F = (inside: Inside, key: Key) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + x0, y + y0)) cv[y]![x] = key(x + x0, y + y0);
  };
  const S: Stamp = (rows, sx, sy) =>
    rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        const X = sx + i - x0;
        const Y = sy + j - y0;
        if (k !== "." && cv[Y]?.[X] !== undefined) cv[Y]![X] = k;
      }),
    );
  draw(F, S, cv);
  return { part: { grid: toGrid(cv), outline }, at: [x0, y0] };
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
 * A stroke through `pts`, `r` its radius at each point; `key` colors a pixel from its light (0 dark to 1 light, lit from
 * the top left across the stroke), how far along it is (0 to 1) and how far from its axis (0 on it, 1 at its edge).
 */
interface Stroke {
  pts: readonly Pt[];
  r: readonly number[];
  key: (light: number, s: number, rel: number) => string;
}

/** Strokes painted into one part, each over the ones before it (a limb and its hoof, a tail and its tuft); `more` draws on top. */
function strokes(list: readonly Stroke[], more?: (S: Stamp, cv: Canvas, x0: number, y0: number) => void): { part: Part; at: Pt } {
  const pad = Math.ceil(Math.max(...list.flatMap((s) => s.r))) + 1;
  const all = list.flatMap((s) => s.pts);
  const x0 = Math.floor(Math.min(...all.map((p) => p[0]))) - pad;
  const y0 = Math.floor(Math.min(...all.map((p) => p[1]))) - pad;
  const w = Math.ceil(Math.max(...all.map((p) => p[0]))) + pad - x0 + 1;
  const h = Math.ceil(Math.max(...all.map((p) => p[1]))) + pad - y0 + 1;
  return painted(x0, y0, w, h, (F, S, cv) => {
    for (const st of list) {
      const at = (x: number, y: number) => along(st.pts, st.r, [x + 0.5, y + 0.5]);
      F(
        (x, y) => {
          const s = at(x, y);
          return s.d <= s.rr;
        },
        (x, y) => {
          const s = at(x, y);
          return st.key(0.6 - 0.45 * (s.nx / s.rr) - 0.5 * (s.ny / s.rr), s.s, s.d / s.rr);
        },
      );
    }
    more?.(S, cv, x0, y0);
  });
}

// ---- Where things are. The scene's ground is at y `GROUND`; the frame adds `OX`, `OY` (headroom for his poses).

const GROUND = 70;
const FOOT_X = 25;
const OX = 8;
const OY = 6;
const W = OX + 62;
const H = OY + GROUND + 4;

// ---- The moon: a crescent, its tips on one line and its back curving away from it; its face parts of their own.

/** The moon as it's drawn: where its tip line crosses its middle, how it's turned (degrees; 0: the tips point right, its back to the left), its half length tip to tip, the depth of its back and of its inside edge. */
interface MoonShape {
  cx: number;
  cy: number;
  turn: number;
  rx: number;
  D: number;
  d: number;
  /** How light its yellow runs (the held moon's face is lit from the top left; the boat's lit from above). */
  bias: number;
}
/** Held to his chest, and sat on (a boat: its tips up). */
const MOON_HELD: MoonShape = { cx: 27, cy: 41, turn: 0, rx: 16, D: 23, d: 10.5, bias: -0.04 };
const MOON_BOAT: MoonShape = { cx: 25, cy: 42.5, turn: -90, rx: 22, D: 25.5, d: 7, bias: 0.2 };

/** The moon's own coordinates: (u along its tips from their middle, v from the tip line toward its back). */
function moonAt(m: MoonShape): (x: number, y: number) => Pt {
  const a = rad(m.turn);
  return (x, y) => {
    const dx = x - m.cx;
    const dy = y - m.cy;
    return [-dx * Math.sin(a) + dy * Math.cos(a), -(dx * Math.cos(a) + dy * Math.sin(a))];
  };
}

function moonBody(m: MoonShape): { part: Part; at: Pt } {
  const at = moonAt(m);
  const inside: Inside = (x, y) => {
    const [u, v] = at(x + 0.5, y + 0.5);
    const s = 1 - (u / m.rx) ** 2;
    if (s <= 0) return false;
    const q = Math.sqrt(s);
    return v >= m.d * q && v <= m.D * q;
  };
  const R = Math.ceil(Math.max(m.rx, m.D)) + 2;
  const light = roundLight(m.cx - 6, m.cy - 5, m.D * 0.7, m.rx * 1.1, m.bias);
  return painted(Math.floor(m.cx - R), Math.floor(m.cy - R), 2 * R, 2 * R, (F) =>
    F(inside, (x, y) => {
      // The darker yellow-orange rim on the edge away from the light (below), a bright one toward it.
      if (!inside(x, y + 1)) return "Q";
      if (!inside(x + 1, y)) return "M";
      if (!inside(x - 1, y) || !inside(x, y - 1)) return "O";
      return ramp(MOON, light(x, y));
    }),
  );
}

/** The moon's face: eyes closed in a happy arch, a small smile (or its mouth open, talking), pink cheeks; a part each. */
const MOON_EYE: readonly string[] = [".uu.", "u..u"];
const MOON_SMILE: readonly string[] = ["u..u", ".uu."];
const MOON_OPEN: readonly string[] = [".uu.", "uvvu", ".uu."];
const MOON_CHEEK: readonly string[] = ["Vv", "vv"];

// ---- Parts and the pose.

const { parts: PARTS, add } = lazyParts();
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
const key = (...v: number[]) => v.map(r2).join(",");

/** A small part typed by hand. */
function typed(name: string, rows: readonly string[], at: Pt, outline = false): Placed {
  return placed(`${name}@${at[0]},${at[1]}`, () => ({ part: { grid: rows, outline }, at }));
}

add("shadow", () => {
  const cv = canvas(34, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 34; x++) if (E(17, 1.5, 17, 1.6)(x, y)) cv[y]![x] = "z";
  return { grid: toGrid(cv), outline: false };
});

add("shadowSmall", () => {
  const cv = canvas(26, 2);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 26; x++) if (E(13, 1, 13, 1.1)(x, y)) cv[y]![x] = "z";
  return { grid: toGrid(cv), outline: false };
});

// ---- His body.

function torso(): { part: Part; at: Pt } {
  const body = union(E(29, 45, 11.6, 14.8), E(28.5, 34, 8.8, 6));
  const brown = union(patch(36, 48.5, 6.4, 9.5, 1.9), patch(38.6, 36, 3.2, 4.4, 3.3), patch(24.5, 36.5, 4.6, 5, 0.6), patch(24.5, 55.5, 5.2, 3.6, 4.1));
  const light = roundLight(26, 40, 14, 19, 0.14);
  return painted(16, 27, 29, 36, (F) => F(body, (x, y) => (brown(x, y) ? ramp(BROWN, light(x, y) + 0.05) : ramp(CREAM, light(x, y) + 0.12))));
}

/** A hind leg and its hoof (the toe toward our left): cream, with a brown patch over the thigh and knee (the far one's at its top). */
function leg(x: number, near: boolean): { part: Part; at: Pt } {
  const patchOn = near ? patch(x - 0.6, 58, 3.6, 5.4, 1.1) : patch(x + 1, 56.5, 3.4, 3.4, 2.2);
  return strokes([
    { pts: [[x, 54], [x - 0.2, 65.5]], r: [4.3, 3.7], key: (l) => ramp(CREAM, l + 0.14) },
    { pts: [[x - 1.2, 67.2], [x + 0.9, 67.2]], r: [3.1, 3], key: (l) => ramp(BROWN, l - 0.05) },
  ], (_S, cv, x0, y0) => {
    // The brown over the cream part of the leg only.
    for (let j = 0; j < cv.length; j++) for (let i = 0; i < cv[0]!.length; i++) if (patchOn(i + x0, j + y0) && "CDEF".includes(cv[j]![i]!)) cv[j]![i] = ramp(BROWN, 0.5 - 0.06 * (i - 3));
  });
}

/** A front leg bent at the elbow, reaching out to the hoof (a dark mitt): cream, brown at the elbow, tucked into his chest. */
function arm(elbow: Pt, hand: Pt): { part: Part; at: Pt } {
  return strokes([
    { pts: [elbow, hand], r: [3.7, 3], key: (l, s) => (s < 0.36 + 0.07 * Math.sin(l * 11) ? ramp(BROWN, l + 0.04) : ramp(CREAM, l + 0.12)) },
    { pts: [[hand[0] - 0.8, hand[1] + 0.2], [hand[0] + 0.8, hand[1] + 0.2]], r: [3.2, 3.2], key: (l) => ramp(BROWN, l) },
  ]);
}
/** A hoof alone: the far leg's, with the rest of it behind the near one. */
function mitt(hand: Pt): { part: Part; at: Pt } {
  return strokes([{ pts: [[hand[0] - 0.8, hand[1] + 0.2], [hand[0] + 0.8, hand[1] + 0.2]], r: [3.2, 3.2], key: (l) => ramp(BROWN, l) }]);
}

/** His tail: a thin cream stalk hanging from his rump (`root`) with a dark tuft at its end, swung `ang` degrees out from hanging straight. */
function tail(ang: number, root: Pt): { part: Part; at: Pt } {
  const a = rad(-ang);
  const at = (dx: number, dy: number): Pt => [root[0] + dx * Math.cos(a) - dy * Math.sin(a), root[1] + dx * Math.sin(a) + dy * Math.cos(a)];
  return strokes([
    { pts: [at(0, 0), at(2.4, 4.4), at(3.4, 9), at(3.6, 12.4)], r: [1.4, 1.2, 1.1, 1.1], key: (l) => ramp(CREAM, l + 0.1) },
    { pts: [at(3.6, 11.6), at(3.9, 15.2), at(3.8, 18.2)], r: [1.9, 2.6, 0.9], key: (l) => ramp(BROWN, l - 0.05) },
  ]);
}

/** Sitting: his body (a round torso with a patch on his back), his near haunch (a big thigh with a brown patch) and the folded shin and hoof in front of it. */
function torsoSit(): { part: Part; at: Pt } {
  const body = union(E(28, 41.5, 11.4, 11), E(28, 34, 8.8, 5.6));
  const brown = union(patch(35, 41.5, 5.2, 8, 1.3), patch(24.5, 36, 4.4, 5.6, 2.2), patch(30, 47, 4, 3, 0.9));
  const light = roundLight(25, 36, 14, 16, 0.14);
  return painted(16, 27, 25, 28, (F) => F(body, (x, y) => (brown(x, y) ? ramp(BROWN, light(x, y) + 0.05) : ramp(CREAM, light(x, y) + 0.12))));
}
function haunch(): { part: Part; at: Pt } {
  const thigh = E(32.5, 48.5, 10, 6.4);
  const brown = patch(33.4, 48.4, 4.4, 3.6, 2.4);
  const light = roundLight(30, 46, 11, 8, 0.12);
  return painted(21, 41, 24, 16, (F) => F(thigh, (x, y) => (brown(x, y) ? ramp(BROWN, light(x, y) + 0.05) : ramp(CREAM, light(x, y) + 0.12))));
}
/** A hind leg folded forward: the shin from the haunch (x1, y1) out to the hoof at its toe (x0, y0). */
function shin(x0: number, y0: number, x1: number, y1: number): { part: Part; at: Pt } {
  return strokes([
    { pts: [[x1, y1], [x0 + 2, y0 - 0.4]], r: [3.7, 3.1], key: (l) => ramp(CREAM, l + 0.14) },
    { pts: [[x0 - 0.6, y0 + 0.2], [x0 + 0.9, y0 + 0.2]], r: [3.2, 3.1], key: (l) => ramp(BROWN, l - 0.05) },
  ]);
}

// ---- His head, and what rides on it.

const SKULL = E(22.5, 18.5, 11.4, 10);
const MUZZLE = E(13.5, 26, 8.2, 5.4);
const CHEEK = E(23, 25.5, 10.4, 5.8);
const SNOUT = E(10.4, 26.4, 5.2, 4.2);
const HEAD = union(SKULL, MUZZLE, CHEEK);

function head(): { part: Part; at: Pt } {
  const eyePatch = patch(28.8, 16.6, 6.4, 8, 0.7);
  const light = roundLight(23, 19, 13, 12, 0.17);
  const snoutLight = roundLight(9.6, 25.2, 5, 4, 0.14);
  return painted(4, 8, 33, 26, (F, S) => {
    F(HEAD, (x, y) => {
      if (SNOUT(x, y)) return ramp(PINK, snoutLight(x, y));
      if (eyePatch(x, y)) return ramp(BROWN, light(x, y) + 0.04);
      return ramp(CREAM, light(x, y) + 0.12);
    });
    // Two nostrils on the snout, and a small smile under it.
    S(["n", "n"], 7, 26);
    S(["n", "n"], 11, 26);
    S(["n.", ".n.", "..nn"], 7, 30);
  });
}

/** An ear: a leaf from `root` out to the side and `ang` degrees below the horizontal (negative: up), brown with a pink inside. */
function ear(root: Pt, side: 1 | -1, ang: number, len: number): { part: Part; at: Pt } {
  const d: Pt = [side * Math.cos(rad(ang)), Math.sin(rad(ang))];
  const droop = ang > -10 ? 1.8 : 0.5;
  const tip: Pt = [root[0] + d[0] * len, root[1] + d[1] * len + droop];
  const mid: Pt = [root[0] + d[0] * len * 0.48, root[1] + d[1] * len * 0.48 + droop * 0.3];
  return strokes([{ pts: [root, mid, tip], r: [2.1, 3.8, 2.1], key: (l, s, rel) => (rel < 0.6 && s > 0.1 && s < 0.9 ? ramp(PINK, l + 0.12) : ramp(BROWN, l + 0.05)) }]);
}

/** A horn: tan, curving up and out from the skull. */
function horn(base: Pt, mid: Pt, tip: Pt): { part: Part; at: Pt } {
  return strokes([{ pts: [base, mid, tip], r: [2.2, 1.6, 0.8], key: (l) => ramp(HORN, l + 0.1) }]);
}

/**
 * Hair on top of his head, drawn over it: the shape is `rows` of keys; its top and sides carry their own dark rim and its
 * foot has none, so it grows out of his head rather than sitting on it.
 */
function hair(rows: readonly string[], at: Pt): { part: Part; at: Pt } {
  const cv: Canvas = rows.map((r) => [...r]);
  const src = cv.map((r) => [...r]);
  const empty = (x: number, y: number) => (src[y]?.[x] ?? ".") === ".";
  for (let y = 0; y < cv.length; y++)
    for (let x = 0; x < cv[0]!.length; x++) {
      if (src[y]![x] === ".") continue;
      if (empty(x, y - 1) || empty(x - 1, y) || empty(x + 1, y)) cv[y]![x] = "k";
    }
  return { part: { grid: toGrid(cv), outline: false }, at };
}

/** The cow's tuft of cream hair between his horns. */
const TUFT: readonly string[] = ["..EF.F..", ".EEFEEF.", ".EEEEEE.", "DEEEEEED", "DEEEEEED"];

/**
 * The powered-up crest: three spikes of yellow hair, the middle one tallest, on a band of it across the top of his head;
 * pale in the middle of each spike, a deeper gold just inside the edge away from the light (the rim, `k`, is `hair`'s).
 * Each row is the columns it fills, from and to.
 */
function crestRows(): string[] {
  const spans: readonly (readonly (readonly [number, number])[])[] = [
    [[9, 10]],
    [[9, 10]],
    [[8, 11], [15, 16]],
    [[3, 4], [8, 11], [14, 16]],
    [[3, 5], [7, 12], [14, 17]],
    [[2, 5], [7, 12], [13, 17]],
    [[2, 13], [13, 17]],
    [[1, 17]],
    [[1, 17]],
    [[0, 17]],
    [[0, 17]],
    [[1, 16]],
  ];
  const cv = canvas(18, spans.length);
  spans.forEach((row, y) => row.forEach(([from, to]) => { for (let x = from; x <= to; x++) cv[y]![x] = "3"; }));
  const src = cv.map((r) => [...r]);
  for (let y = 0; y < spans.length; y++)
    for (let x = 0; x < 18; x++) {
      if (src[y]![x] === ".") continue;
      const e = (dx: number) => (src[y]![x + dx] ?? ".") === ".";
      cv[y]![x] = e(1) || e(2) ? "2" : y < 8 ? "4" : "3";
    }
  return toGrid(cv) as string[];
}

// ---- His eyes and brows, parts of their own (so they blink, glow and scowl as numbers).

export type Eyes = "open" | "shut" | "glow";
const EYE_N: Record<Eyes, readonly string[]> = {
  open: [".aaaa.", "awxxxa", "awxxxa", "axxxxa", "axxexa", "aeeeea", ".aaaa."],
  shut: ["......", "......", "axxxxa", "......", "......", "......", "......"],
  glow: [".eeee.", "exxxxe", "exxxxe", "exxxxe", ".eeee.", "......", "......"],
};
const EYE_F: Record<Eyes, readonly string[]> = {
  open: [".aaa.", "awxxa", "axxxa", "axxea", "aeeea", ".aaa."],
  shut: [".....", ".....", "axxxa", ".....", ".....", "....."],
  glow: [".eee.", "exxxe", "exxxe", ".eee.", ".....", "....."],
};
/** Where each eye's top-left sits on the head (the near eye is the big one, the far one set by the snout). */
const EYE_AT: Record<"N" | "F", Pt> = { N: [25, 14], F: [14, 15] };

/** The angry brows: dark bars slanting down toward his nose, over the near eye and the far one. */
function brows(): { part: Part; at: Pt } {
  return painted(
    12,
    8,
    22,
    12,
    (_F, _S, cv) => {
      // (The canvas starts at (12, 8) on the head.) The near brow: high at its outer end (right), low at the nose end.
      line(cv, 12, 6, 19, 3, "a");
      line(cv, 12, 7, 19, 4, "a");
      // The far brow: high at its outer end (left), low toward the nose.
      line(cv, 3, 4, 8, 7, "a");
      line(cv, 3, 5, 8, 8, "a");
    },
    false,
  );
}

// ---- The aura: golden flames behind him, from the shared flame shape recolored into the aura's own keys.

function aura(seed: number): { part: Part; at: Pt } {
  const tongues: readonly (readonly [number, number, number, number, number])[] = [
    // base x, base y, width, height, lean (out toward its side as it rises). The ones above and behind his head have
    // their bases hidden behind it; the ones at his sides stand on the ground.
    [3, 70, 7, 38, -2],
    [7, 70, 8, 46, -2],
    [11, 22, 7, 18, -2],
    [16, 17, 7, 11, -1],
    [22, 14, 7, 8, 0],
    [27, 13, 8, 8, 0],
    [32, 15, 7, 10, 1],
    [37, 21, 8, 16, 2],
    [41, 26, 8, 20, 2],
    [41, 70, 8, 42, 2],
    [46, 70, 7, 34, 2],
    [50, 70, 5, 22, 3],
    // the low ones along the ground
    [14, 70, 6, 10, -1],
    [25, 70, 7, 9, 0],
    [36, 70, 6, 10, 1],
  ];
  const MAP: Record<string, string> = { y: "9", Y: "8", f: "7", F: "6", R: "5" };
  return painted(
    0,
    0,
    54,
    70,
    (_F, S) => {
      tongues.forEach(([bx, by, w, h, lean], i) => {
        const rows = flame(w, h, seed + i * 1.7, lean).map((r) => [...r].map((c) => MAP[c] ?? c).join(""));
        S(rows, Math.round(bx - w / 2), by - h);
      });
    },
    false,
  );
}

// ---- The pose: the numbers that move him (scene pixels, degrees).

export type Stance = "hug" | "sit";

export interface MooPose {
  /** The whole of him moved sideways and up (negative: up). */
  dx?: number;
  dy?: number;
  /** His head, with his eyes, brows, horns, tuft and the roots of his ears riding on it: it nuzzles the moon. */
  head?: Pt;
  /** Each ear's angle below the horizontal, out to its side (negative: standing up): they flop. */
  earN?: number;
  earF?: number;
  /** His tail's swing out from hanging straight (degrees). */
  tail?: number;
  eyes?: Eyes;
  brows?: "none" | "angry";
  /** The front legs: the near one's elbow and hoof, and the far one's hoof (the rest of that leg is behind the near one). */
  handN?: Pt;
  handF?: Pt;
  elbowN?: Pt;
  /** The moon moved from where he holds it (or floats), and its face. */
  moon?: Pt;
  moonEyes?: "happy" | "none";
  moonMouth?: "smile" | "open";
  /** The hair on his head: the cream tuft, or the powered-up crest. */
  crest?: boolean;
  /** The aura behind him (a flicker variant, 0 to 2), or none. */
  aura?: 0 | 1 | 2 | null;
}

const REST_HUG: Required<MooPose> = {
  dx: 0,
  dy: 0,
  head: [0, 0],
  earN: 26,
  earF: 28,
  tail: 0,
  eyes: "open",
  brows: "none",
  handN: [14.5, 47.5],
  handF: [20.5, 45.5],
  elbowN: [28.5, 45.5],
  moon: [0, 0],
  moonEyes: "happy",
  moonMouth: "smile",
  crest: false,
  aura: null,
};
const REST_SIT: Required<MooPose> = {
  ...REST_HUG,
  head: [2, 1],
  tail: 0,
  handN: [21, 47],
  handF: [25.5, 46.5],
  elbowN: [26.5, 41.5],
};

/** The numbers that power him up: with `pal: MOO_POWER_PALETTE`, the powered-up still. */
export const POWERED: MooPose = { earN: -36, earF: -34, eyes: "glow", brows: "angry", crest: true, aura: 0, head: [0, 1], tail: 8 };

/**
 * A pose as layers, back to front: hugging the moon (standing on his hind legs) or sitting on it (it floats under him
 * like a boat, a little off the ground).
 */
export function mooLayers(pose: MooPose = {}, stance: Stance = "hug"): Layer[] {
  const p = { ...(stance === "sit" ? REST_SIT : REST_HUG), ...pose };
  const out: Layer[] = [];
  const put = (pl: Placed, ox = 0, oy = 0) => out.push({ part: pl.name, x: pl.at[0] + OX + p.dx + ox, y: pl.at[1] + OY + p.dy + oy });
  const [hx, hy] = p.head;
  const [mx, my] = p.moon;
  const mouth = p.moonMouth === "open" ? MOON_OPEN : MOON_SMILE;
  if (p.aura !== null) put(placed(`aura${p.aura}`, () => aura(p.aura! * 2.3)));
  if (stance === "hug") {
    out.push({ part: "shadow", x: OX + FOOT_X - 17, y: OY + GROUND - 2 });
    put(placed(`tail${key(p.tail)}`, () => tail(p.tail, [39.4, 51])));
    put(placed("legF", () => leg(29, false)));
    put(placed("legN", () => leg(21, true)));
    put(placed("torso", torso));
    put(placed("moonHeld", () => moonBody(MOON_HELD)), mx, my);
    put(typed("moonCheek", MOON_CHEEK, [5, 38]), mx, my);
    put(typed("moonCheek", MOON_CHEEK, [15, 38]), mx, my);
    if (p.moonEyes === "happy") {
      put(typed("moonEye", MOON_EYE, [6, 35]), mx, my);
      put(typed("moonEye", MOON_EYE, [12, 35]), mx, my);
    }
    put(typed(`moonMouth${p.moonMouth}`, mouth, [9, 39]), mx, my);
    put(placed(`mittF${key(...p.handF)}`, () => mitt(p.handF)));
    put(placed(`armN${key(...p.elbowN, ...p.handN)}`, () => arm(p.elbowN, p.handN)));
  } else {
    // The boat floats a few pixels off the ground over a smaller shadow.
    out.push({ part: "shadowSmall", x: OX + FOOT_X - 13, y: OY + GROUND - 1 });
    put(placed("moonBoat", () => moonBody(MOON_BOAT)), mx, my);
    put(typed("moonCheek", MOON_CHEEK, [14, 60]), mx, my);
    put(typed("moonCheek", MOON_CHEEK, [33, 60]), mx, my);
    if (p.moonEyes === "happy") {
      put(typed("moonEye", MOON_EYE, [19, 58]), mx, my);
      put(typed("moonEye", MOON_EYE, [28, 58]), mx, my);
    }
    put(typed(`moonMouth${p.moonMouth}`, mouth, [23, 61]), mx, my);
    put(placed(`tailSit${key(p.tail)}`, () => tail(p.tail, [38.6, 50])));
    put(placed("shinF", () => shin(16.5, 50.5, 27, 50)));
    put(placed("torsoSit", torsoSit));
    put(placed("haunch", haunch));
    put(placed("shinN", () => shin(14.5, 52.8, 28, 52.5)));
    put(placed(`mittF${key(...p.handF)}`, () => mitt(p.handF)));
    put(placed(`armN${key(...p.elbowN, ...p.handN)}`, () => arm(p.elbowN, p.handN)));
  }
  // The head and what rides on it, far side first.
  put(placed(`earF${key(p.earF)}`, () => ear([14, 15], -1, p.earF, 10)), hx, hy);
  put(placed("hornF", () => horn([16.5, 11.6], [14.8, 8], [13.4, 4.8])), hx, hy);
  put(placed("head", head), hx, hy);
  if (p.crest) put(placed("crest", () => hair(crestRows(), [18, 0])), hx, hy);
  else put(placed("tuft", () => hair(TUFT, [19, 5])), hx, hy);
  put(placed(`earN${key(p.earN)}`, () => ear([32.5, 14.5], 1, p.earN, 10.5)), hx, hy);
  put(typed(`eyeF${p.eyes}`, EYE_F[p.eyes], EYE_AT.F), hx, hy);
  put(typed(`eyeN${p.eyes}`, EYE_N[p.eyes], EYE_AT.N), hx, hy);
  if (p.brows === "angry") put(placed("brows", brows), hx, hy);
  put(placed("hornN", () => horn([28.6, 11.4], [30, 8.2], [31.4, 6])), hx, hy);
  return out;
}

const frame = (ms: number, pose: MooPose = {}, stance: Stance = "hug", extra: Partial<Frame> = {}): Frame => ({ layers: mooLayers(pose, stance), ms, ...extra });

const idle: Anim = { loop: true, frames: [frame(1000)] };
const sit: Anim = { loop: true, frames: [frame(1000, {}, "sit")] };
const power: Anim = { loop: true, frames: [frame(1000, POWERED, "hug", { pal: MOO_POWER_PALETTE })] };

export const MOO: Character = {
  id: "moo",
  name: "Moo",
  w: W,
  h: H,
  foot: [OX + FOOT_X, OY + GROUND],
  palette: MOO_PALETTE,
  halo: "#2c2624",
  parts: PARTS,
  anims: { idle, sit, power },
};

/** What a portrait shows (his head, an ear, his horns and a bit of the moon's face), in frame pixels. */
export const MOO_PORTRAIT = { x: OX + 1, y: OY + 3, w: 44, h: 44 } as const;
