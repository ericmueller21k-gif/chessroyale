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
 * Three stills, approved by Eric (docs/decisions/2026-10-20-moo-still.md): `idle` (hugging the moon), `sit` (sitting on the
 * moon as it floats under him like a little boat, its face on the front) and `power` (the idle drawn powered-up: he takes in
 * the moon's power, so his cream turns yellow-gold, his eyes glow white under angry brows with a brown patch round the one on
 * our left, his tuft becomes a spiky yellow crest, his ears stand up and a golden aura flickers round him; the moon stays
 * happy). They are the first frames of `idle`, `sit` and `power`, pixel for pixel (the eye patch aside). Round them his
 * animation pack and his board art (docs/decisions/2026-10-20-moo-animations.md, effects/moo.ts). Nothing in the game draws
 * him yet (he isn't in `CHARACTERS`, `BOSS_KITS` or the roster); the preview draws him with its `extra=` option.
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
import { KING_ATTACK } from "@chessroyale/chess";
import { moved } from "./attack-frame.ts";
import { frameKeys, lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "./sprite.ts";

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
  G: "#ffe45ae8", // the glow round him when he's powered up: see-through gold, strong to faint (the aura's own keys)
  H: "#ffd63cb8",
  I: "#ffb02a80",
  J: "#ff94184a",
  z: "#0d0e12", // ground shadow
  t: "#8a7d66", // dust, light and dark
  y: "#4d4538",
  "~": "#9fd8ff", // sweat
  W: "#fff3b0f2", // the moon's glow when it brightens: see-through yellow, strong to faint
  X: "#ffd860cc",
  Y: "#ffb940a4",
  T: "#ff9f2e60",
  K: "#d6e8ff", // moonlight in a beam: pale, mid and rim (the king attack's moonbeam)
  L: "#8fb0ff",
  U: "#5d7ad8",
  Z: "#e6f4ff", // an icon's colors, when its pixels are drawn on a frame (`iconSpecks`): Zzz,
  A: "#9ccbf5",
  B: "#6aa0dc",
  l: "#f1e8d2", // the pawn,
  m: "#fffaf0",
  o: "#bfb08e",
  R: "#e0342c", // the anger mark
  S: "#ff8a7a",
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
const OX = 12;
/** Headroom above him: the entrance drops him in from above, and the flurry raises the moon over his head. */
const OY = 30;
const W = OX + 62;
const H = OY + GROUND + 8;

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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** The moon part-way from held (0) to the boat (1): it turns, grows and slips down as it goes. */
const moonShapeAt = (t: number): MoonShape => ({ cx: lerp(MOON_HELD.cx, MOON_BOAT.cx, t), cy: lerp(MOON_HELD.cy, MOON_BOAT.cy, t), turn: lerp(MOON_HELD.turn, MOON_BOAT.turn, t), rx: lerp(MOON_HELD.rx, MOON_BOAT.rx, t), D: lerp(MOON_HELD.D, MOON_BOAT.D, t), d: lerp(MOON_HELD.d, MOON_BOAT.d, t), bias: lerp(MOON_HELD.bias, MOON_BOAT.bias, t) });

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

/**
 * The moon's face: eyes (closed in a happy arch, or open and looking about, or a line as it blinks), a mouth (a small
 * smile, open as it talks, a round "o", a line, a frown) and pink cheeks; a part each. Each is placed at a top-left
 * (`FACE_HELD` and `FACE_BOAT`: where they sit on the held moon and on the boat, and in between as it slips).
 */
const MOON_EYES: Record<"happy" | "open" | "flat", readonly string[]> = { happy: [".uu.", "u..u"], open: ["wu", "uu", "uu"], flat: ["uuuu"] };
const MOON_MOUTHS: Record<"smile" | "open" | "o" | "flat" | "frown", readonly string[]> = {
  smile: ["u..u", ".uu."],
  open: [".uu.", "uvvu", ".uu."],
  o: [".u.", "u.u", ".u."],
  flat: ["uuuu"],
  frown: [".uu.", "u..u"],
};
const MOON_CHEEK: readonly string[] = ["Vv", "vv"];
const FACE_HELD = { eyeL: [6, 35], eyeR: [12, 35], cheekL: [5, 38], cheekR: [15, 38], mouth: [9, 39] } as const;
const FACE_BOAT = { eyeL: [19, 58], eyeR: [28, 58], cheekL: [14, 60], cheekR: [33, 60], mouth: [23, 61] } as const;
const faceAt = (t: number) => {
  const at = (k: keyof typeof FACE_HELD): Pt => [Math.round(lerp(FACE_HELD[k][0], FACE_BOAT[k][0], t)), Math.round(lerp(FACE_HELD[k][1], FACE_BOAT[k][1], t))];
  return { eyeL: at("eyeL"), eyeR: at("eyeR"), cheekL: at("cheekL"), cheekR: at("cheekR"), mouth: at("mouth") };
};

// ---- Parts and the pose.

const { parts: PARTS, add } = lazyParts();
/** The character as drawn without its halo or any animation: for `frameKeys`, to find a pose's outline for the aura to hug. */
const BASE: Character = { id: "moo", name: "Moo", w: W, h: H, foot: [OX + FOOT_X, OY + GROUND], palette: MOO_PALETTE, parts: PARTS, anims: {} };
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

// ---- His eyes, brows and mouth, parts of their own (so they blink, glow, scowl and moo as numbers).

export type Eyes = "open" | "shut" | "glow" | "joy" | "half";
const EYES_N: Record<Eyes, readonly string[]> = {
  open: [".aaaa.", "awxxxa", "awxxxa", "axxxxa", "axxexa", "aeeeea", ".aaaa."],
  shut: ["......", "......", "axxxxa", "......", "......", "......", "......"],
  glow: [".eeee.", "exxxxe", "exxxxe", "exxxxe", ".eeee.", "......", "......"],
  joy: ["......", "......", ".xxxx.", "xx..xx", "......", "......", "......"],
  half: ["......", "......", "aaaaaa", "axxxxa", "axxexa", "aeeeea", ".aaaa."],
};
const EYES_F: Record<Eyes, readonly string[]> = {
  open: [".aaa.", "awxxa", "axxxa", "axxea", "aeeea", ".aaa."],
  shut: [".....", ".....", "axxxa", ".....", ".....", "....."],
  glow: [".eee.", "exxxe", "exxxe", ".eee.", ".....", "....."],
  joy: [".....", ".....", ".xxx.", "x...x", ".....", "....."],
  half: [".....", ".....", "aaaaa", "axxxa", "aeeea", ".aaa."],
};
/** Where each eye's top-left sits on the head (the near eye is the big one, the far one set by the snout). */
const EYE_AT: Record<"N" | "F", Pt> = { N: [25, 14], F: [14, 15] };

/** An open eye looking about: its pupil (and glint) moved `gx`, `gy` pixels (each -1 to 1) inside the iris. */
function gazed(rows: readonly string[], gx: number, gy: number): readonly string[] {
  if (!gx && !gy) return rows;
  const g = rows.map((r) => [...r]);
  const pupil: [number, number, string][] = [];
  rows.forEach((r, y) => [...r].forEach((k, x) => (k === "x" || k === "w" ? pupil.push([x, y, k]) : undefined)));
  for (const [x, y] of pupil) g[y]![x] = "e";
  for (const [x, y, k] of pupil) {
    const [X, Y] = [x + gx, y + gy];
    g[rows[Y]?.[X] && "xwe".includes(rows[Y]![X]!) ? Y : y]![rows[Y]?.[X] && "xwe".includes(rows[Y]![X]!) ? X : x] = k;
  }
  return g.map((r) => r.join(""));
}

/** The brows: dark bars over each eye, slanting down toward his nose (angry) or up toward it (worried). */
function brows(kind: "angry" | "worry"): { part: Part; at: Pt } {
  return painted(
    12,
    8,
    22,
    12,
    (_F, _S, cv) => {
      // (The canvas starts at (12, 8) on the head.) Angry: the near brow high at its outer end (right), the far one high at its outer end (left).
      const [a, b, c, d, e, f, g, h] = kind === "angry" ? [12, 6, 19, 3, 3, 4, 8, 7] : [12, 3, 19, 6, 3, 7, 8, 4];
      line(cv, a, b, c, d, "a");
      line(cv, a, b + 1, c, d + 1, "a");
      line(cv, e, f, g, h, "a");
      line(cv, e, f + 1, g, h + 1, "a");
    },
    false,
  );
}

/** A brown patch round the far eye (our left), for the powered-up face, so its glowing white eye doesn't melt into the yellow. */
function eyePatchF(): { part: Part; at: Pt } {
  const patchF = patch(16.5, 18, 4.9, 5.2, 2.6);
  const light = roundLight(16, 17, 6, 6, 0.15);
  return painted(10, 11, 14, 14, (F) => F((x, y) => patchF(x, y) && HEAD(x, y) && !SNOUT(x, y), (x, y) => ramp(BROWN, light(x, y) + 0.04)), false);
}

/** His mouth, open to moo (a dark mouth under the snout with a pink tongue) or chewing (small); over the head's smile. */
function mouth(kind: "open" | "chew"): { part: Part; at: Pt } {
  const [cx, cy, rx, ry] = kind === "open" ? [10.4, 31.6, 4.7, 3.1] : [10.4, 30.9, 3.3, 1.9];
  return painted(4, 26, 14, 10, (F) => F(E(cx, cy, rx, ry), (_x, y) => (kind === "open" && y >= 32.6 ? "q" : "a")));
}

// ---- Glows: a soft light round a shape, from see-through keys fading with the distance, dithered (soft, never blended).

type Mask = readonly (readonly boolean[])[];
/**
 * Writes a glow round `sil` (frame pixels) into `cv`: `keys` weakest to strongest, out to `R` pixels from the shape (it fades
 * `up` times and `down` times quicker above and below it, so it stays inside the frame), only inside `box`.
 */
function glow(cv: Canvas, sil: Mask, R: number, keys: string, box: { left: number; right: number; top: number; floor: number }, up = 1.9, down = 3): void {
  const BAYER = [[0.125, 0.625], [0.875, 0.375]] as const;
  const n = keys.length;
  const reach = Math.ceil(R / Math.min(1, 1 / up)) + 1;
  for (let y = box.top; y <= box.floor; y++)
    for (let x = box.left; x <= box.right; x++) {
      let d = Infinity;
      for (let dy = -reach; dy <= reach; dy++)
        for (let dx = -reach; dx <= reach; dx++) {
          if (!sil[y + dy]?.[x + dx]) continue;
          // His pixel is below this one (dy > 0): this one is above him, where the glow fades quickest.
          d = Math.min(d, Math.hypot(dx, dy * (dy > 0 ? up : dy < 0 ? down : 1)));
        }
      if (d > R) continue;
      const level = Math.min(n, Math.floor((1 - d / R) ** 0.95 * n + BAYER[y & 1]![x & 1]!));
      if (level > 0 && !cv[y]![x]!.match(/[^.]/)) cv[y]![x] = keys[level - 1]!;
    }
}

/** The glow round the moon as it brightens (`level` 1 to 3), made for where its layer is; behind the moon, over him. */
function moonGlow(level: number, sil: Mask): { part: Part; at: Pt } {
  const cv = canvas(W, H);
  glow(cv, sil, [0, 3, 5.2, 7.4][level]!, "TYXW", { left: 3, right: W - 4, top: 3, floor: H - 4 });
  return { part: { grid: toGrid(cv), outline: false }, at: [-OX, -OY] };
}

// ---- The aura: a soft golden glow hugging his outline, and flames rising round him; one part of its own behind everything.

/**
 * The aura for one pose, in frame pixels (`sil` is the pose's outline: which pixels it covers). The glow is see-through
 * gold in four strengths, fading with the distance from his outline (dithered, so it's soft but never blended; it fades
 * faster above and below him, so it never reaches the frame's top or the ground). The flames are the shared `flame`
 * shape in the aura's keys, tongues standing along his outline and rising above it at their own heights, a taller row
 * behind a shorter one; `variant` picks the heights, so a flicker is a different variant each frame. `size` (0 to 1)
 * is how much of it there is: the glow's reach and the flames' height, so it can flare on and fizzle out.
 */
function aura(variant: number, sil: Mask, size = 1): { part: Part; at: Pt } {
  const cv = canvas(W, H);
  const seed = variant * 2.3 + 1;
  const rnd = (i: number) => {
    const v = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const first: number[] = Array(W).fill(Infinity);
  let [x0, x1, bottom] = [W, -1, -1];
  sil.forEach((row, y) => row.forEach((on, x) => {
    if (!on) return;
    first[x] = Math.min(first[x]!, y);
    [x0, x1, bottom] = [Math.min(x0, x), Math.max(x1, x), Math.max(bottom, y)];
  }));
  const [top, floor, left, right] = [OY + 1, OY + GROUND + 2, 3, W - 4];
  glow(cv, sil, 7.5 * size, "JIHG", { left, right, top, floor });
  const MAP: Record<string, string> = { y: "9", Y: "8", f: "7", F: "6", R: "5" };
  const cx = (x0 + x1) / 2;
  const half = Math.max(1, (x1 - x0) / 2);
  /** Where his outline is highest near column x, a slope away from it so the flames beside him stand lower. */
  const topNear = (x: number): number => {
    let t = Infinity;
    for (let c = Math.max(0, x - 12); c <= Math.min(W - 1, x + 12); c++) if (first[c]! < Infinity) t = Math.min(t, first[c]! + 0.9 * Math.abs(c - x));
    return t;
  };
  const tongue = (x: number, base: number, tip: number, salt: number) => {
    const w = 6 + Math.floor(rnd(x + salt + 17) * 3);
    const h = Math.round((base - tip) * Math.max(0, Math.min(1, (size - 0.2) / 0.8)));
    if (h < 7) return;
    const lean = Math.round(((x - cx) / half) * 3);
    flame(w, h, seed + x * 0.7 + salt, lean).forEach((r, j) =>
      [...r].forEach((c, i) => {
        const X = Math.round(x - w / 2) + i;
        const Y = base - h + j;
        if (c !== "." && X >= left && X <= right && Y >= top && Y <= floor) cv[Y]![X] = MAP[c] ?? c;
      }),
    );
  };
  // A back row standing on the ground at his two sides, mostly hidden by him: what shows is the flames beside his outline.
  [x0 - 3, x0 + 1, x0 + 5, x1 - 5, x1 - 1, x1 + 3].forEach((x, i) => tongue(x, bottom, bottom - Math.round(24 + 12 * rnd(i + 3)), 7));
  // Then tongues along his outline: on him a tongue's foot is hidden inside it, beside him it stands on the ground; each rises
  // a little above the highest point of him near it, never more than a third of his height.
  const row = (step: number, offset: number, lift: readonly [number, number], salt: number) => {
    for (let x = x0 - 6 + offset; x <= x1 + 6; x += step) {
      const t = topNear(x);
      if (!Number.isFinite(t)) continue;
      const inner = first[x] ?? Infinity;
      const onHim = Number.isFinite(inner);
      const base = onHim ? inner + 5 : bottom;
      let tip = Math.round(t - (lift[0] + (lift[1] - lift[0]) * rnd(x + salt)));
      if (tip < top) tip = top + Math.floor(rnd(x + salt + 5) * 9);
      tongue(x, base, Math.max(tip, base - Math.round((onHim ? 14 : 12) + 12 * rnd(x + salt + 9))), salt);
    }
  };
  row(4, 0, [7, 16], 0);
  row(4, 2, [2, 7], 41);
  return { part: { grid: toGrid(cv), outline: false }, at: [-OX, -OY] };
}

/** A short hash of a pose's layers, to name the aura made for it. */
function hashLayers(layers: readonly Layer[]): string {
  let h = 5381;
  for (const l of layers) for (const c of `${l.part}@${l.x},${l.y};`) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

// ---- The pose: the numbers that move him (scene pixels, degrees).

export type Stance = "hug" | "sit";

export interface MooPose {
  /** The whole of him moved sideways and up (negative: up; the sit's boat too, his shadow stays on the ground). */
  dx?: number;
  dy?: number;
  /** He sinks this many pixels (a crouch; his feet stay on the ground; sitting, he sinks into the boat). */
  bob?: number;
  /** His head, with his eyes, brows, horns, tuft and the roots of his ears riding on it: it nuzzles the moon. */
  head?: Pt;
  /** His mouth: closed (the smile under his snout), open to moo, chewing. */
  mouth?: "smile" | "open" | "chew";
  /** Each ear's angle below the horizontal, out to its side (negative: standing up): they flop. Both are drawn the same way, the one on our left (`earF`) the other's mirror, and never over the moon. */
  earN?: number;
  earF?: number;
  /** His tail's swing out from hanging straight (degrees). */
  tail?: number;
  eyes?: Eyes;
  /** Where his pupils look, each -1 to 1 (open eyes only). */
  gaze?: Pt;
  brows?: "none" | "angry" | "worry";
  /** A brown patch round the far eye (the powered-up face). */
  patchF?: boolean;
  /** The front legs: the near one's elbow and hoof, and the far one's hoof (the rest of that leg is behind the near one). */
  handN?: Pt;
  handF?: Pt;
  elbowN?: Pt;
  /**
   * The moon moved from where he holds it (or floats), and how far it has come from held (0) to a boat under him (1: it
   * turns, grows and slips down as it goes; in the sit it is 1). `moonBack`: drawn behind him (the held moon is in front of
   * his body but behind his head); `moonFront`: in front of everything (it bumps his head).
   */
  moon?: Pt;
  moonT?: number;
  moonBack?: boolean;
  moonFront?: boolean;
  /** Its face: eyes (happy arches, open and looking about by `moonGaze`, or a line as it blinks), mouth, and how bright it glows (0 to 3: a glow round it, and its yellow brightening: the frame's `pal`, see `F`). */
  moonEyes?: "happy" | "open" | "flat" | "none";
  moonGaze?: Pt;
  moonMouth?: "smile" | "open" | "o" | "flat" | "frown";
  moonGlow?: 0 | 1 | 2 | 3;
  /** The hair on his head: the cream tuft, or the powered-up crest. */
  crest?: boolean;
  /** The aura behind him (a flicker variant, 0 to 2), or none; and how much of it (0 to 1). */
  aura?: 0 | 1 | 2 | null;
  auraSize?: number;
}

const REST_HUG: Required<MooPose> = {
  dx: 0,
  dy: 0,
  bob: 0,
  head: [0, 0],
  mouth: "smile",
  earN: 26,
  earF: 26,
  tail: 0,
  eyes: "open",
  gaze: [0, 0],
  brows: "none",
  patchF: false,
  handN: [14.5, 47.5],
  handF: [20.5, 45.5],
  elbowN: [28.5, 45.5],
  moon: [0, 0],
  moonT: 0,
  moonBack: false,
  moonFront: false,
  moonEyes: "happy",
  moonGaze: [0, 0],
  moonMouth: "smile",
  moonGlow: 0,
  crest: false,
  aura: null,
  auraSize: 1,
};
const REST_SIT: Required<MooPose> = {
  ...REST_HUG,
  head: [2, 1],
  handN: [21, 47],
  handF: [25.5, 46.5],
  elbowN: [26.5, 41.5],
  moonT: 1,
};

/** The numbers that power him up: with `pal: MOO_POWER_PALETTE`, the powered-up still. */
export const POWERED: MooPose = { earN: -36, earF: -36, eyes: "glow", brows: "angry", patchF: true, crest: true, aura: 0, head: [0, 3], tail: 8 };

/**
 * A pose as layers, back to front: hugging the moon (standing on his hind legs) or sitting on it (it floats under him
 * like a boat, a little off the ground).
 */
export function mooLayers(pose: MooPose = {}, stance: Stance = "hug"): Layer[] {
  const p = { ...(stance === "sit" ? REST_SIT : REST_HUG), ...pose };
  const out: Layer[] = [];
  const put = (pl: Placed, ox = 0, oy = 0) => out.push({ part: pl.name, x: pl.at[0] + OX + p.dx + ox, y: pl.at[1] + OY + p.dy + oy });
  /** A part that sinks when he crouches. */
  const putB = (pl: Placed, ox = 0, oy = 0) => put(pl, ox, oy + p.bob);
  const [hx, hy] = p.head;
  const [mx, my] = p.moon;
  const t = stance === "sit" ? 1 : p.moonT;
  const sink = stance === "hug" ? putB : put;
  // The moon with its face and its glow: where it is, and how it looks.
  const moonLayers = (): void => {
    const m = t <= 0 ? placed("moonHeld", () => moonBody(MOON_HELD)) : t >= 1 ? placed("moonBoat", () => moonBody(MOON_BOAT)) : placed(`moonMid${Math.round(t * 20)}`, () => moonBody(moonShapeAt(Math.round(t * 20) / 20)));
    const face = faceAt(Math.round(t * 20) / 20);
    if (p.moonGlow > 0) {
      const probe: Layer = { part: m.name, x: m.at[0] + OX + p.dx + mx, y: m.at[1] + OY + p.dy + my + (stance === "hug" ? p.bob : 0) };
      const g = placed(`mglow${p.moonGlow}:${m.name}@${probe.x},${probe.y}`, () => moonGlow(p.moonGlow, frameKeys(BASE, { layers: [probe], ms: 0 }).map((r) => r.map((k) => k !== null))));
      out.push({ part: g.name, x: g.at[0] + OX, y: g.at[1] + OY });
    }
    sink(m, mx, my);
    sink(typed("moonCheek", MOON_CHEEK, face.cheekL), mx, my);
    sink(typed("moonCheek", MOON_CHEEK, face.cheekR), mx, my);
    if (p.moonEyes === "happy" || p.moonEyes === "flat") {
      for (const e of [face.eyeL, face.eyeR]) sink(typed(`moonEye${p.moonEyes}`, MOON_EYES[p.moonEyes], p.moonEyes === "flat" ? [e[0], e[1] + 1] : e), mx, my);
    } else if (p.moonEyes === "open") {
      for (const e of [face.eyeL, face.eyeR]) sink(typed("moonEyeopen", MOON_EYES.open, [e[0] + 1 + p.moonGaze[0], e[1] + p.moonGaze[1]]), mx, my);
    }
    sink(typed(`moonMouth${p.moonMouth}`, MOON_MOUTHS[p.moonMouth], face.mouth), mx, my);
  };
  if (stance === "hug") {
    out.push({ part: "shadow", x: OX + FOOT_X - 17, y: OY + GROUND - 2 });
    putB(placed(`tail${key(p.tail)}`, () => tail(p.tail, [39.4, 51])));
    if (p.moonBack) moonLayers();
    put(placed("legF", () => leg(29, false)));
    put(placed("legN", () => leg(21, true)));
    putB(placed("torso", torso));
    if (!p.moonBack && !p.moonFront) moonLayers();
    putB(placed(`mittF${key(...p.handF)}`, () => mitt(p.handF)));
    putB(placed(`armN${key(...p.elbowN, ...p.handN)}`, () => arm(p.elbowN, p.handN)));
  } else {
    // The boat floats a few pixels off the ground over a smaller shadow.
    out.push({ part: "shadowSmall", x: OX + FOOT_X - 13, y: OY + GROUND - 1 });
    moonLayers();
    putB(placed(`tailSit${key(p.tail)}`, () => tail(p.tail, [38.6, 50])));
    putB(placed("shinF", () => shin(16.5, 50.5, 27, 50)));
    putB(placed("torsoSit", torsoSit));
    putB(placed("haunch", haunch));
    putB(placed("shinN", () => shin(14.5, 52.8, 28, 52.5)));
    putB(placed(`mittF${key(...p.handF)}`, () => mitt(p.handF)));
    putB(placed(`armN${key(...p.elbowN, ...p.handN)}`, () => arm(p.elbowN, p.handN)));
  }
  // The head and what rides on it, far side first.
  putB(placed("hornF", () => horn([16.5, 11.6], [14.8, 8], [13.4, 4.8])), hx, hy);
  putB(placed("head", head), hx, hy);
  if (p.mouth !== "smile") putB(placed(`mouth${p.mouth}`, () => mouth(p.mouth as "open" | "chew")), hx, hy);
  if (p.crest) putB(placed("crest", () => hair(crestRows(), [18, 0])), hx, hy);
  else putB(placed("tuft", () => hair(TUFT, [19, 5])), hx, hy);
  // The two ears are mirror images about the middle of his head (x 22.5): the same root depth, length and angle.
  putB(placed(`earF${key(p.earF)}`, () => ear([12.5, 14.5], -1, p.earF, 10.5)), hx, hy);
  putB(placed(`earN${key(p.earN)}`, () => ear([32.5, 14.5], 1, p.earN, 10.5)), hx, hy);
  if (p.patchF) putB(placed("eyePatchF", eyePatchF), hx, hy);
  const [gx, gy] = p.eyes === "open" || p.eyes === "half" ? p.gaze : [0, 0];
  putB(typed(`eyeF${p.eyes}${gx},${gy}`, gazed(EYES_F[p.eyes], gx, gy), EYE_AT.F), hx, hy);
  putB(typed(`eyeN${p.eyes}${gx},${gy}`, gazed(EYES_N[p.eyes], gx, gy), EYE_AT.N), hx, hy);
  if (p.brows !== "none") putB(placed(`brows${p.brows}`, () => brows(p.brows as "angry" | "worry")), hx, hy);
  putB(placed("hornN", () => horn([28.6, 11.4], [30, 8.2], [31.4, 6])), hx, hy);
  if (p.moonFront && stance === "hug") moonLayers();
  if (p.aura !== null) {
    // Behind everything, made for this pose's outline (the shadow is no part of it).
    const body = out.filter((l) => !l.part.startsWith("shadow") && !l.part.startsWith("mglow"));
    const variant = p.aura;
    const size = Math.round(p.auraSize * 8) / 8;
    const a = placed(`aura${variant}:${size}:${hashLayers(body)}`, () => aura(variant, frameKeys(BASE, { layers: body, ms: 0 }).map((r) => r.map((k) => k !== null)), size));
    out.unshift({ part: a.name, x: a.at[0] + OX, y: a.at[1] + OY });
  }
  return out;
}

// ---- Moo's icons: he can't talk, so besides his moos he says things with these, in a line of text.

/**
 * A little picture for his speech line: `grid` is its pixels (a palette key each, `.` empty) and `palette` its colors. It has
 * no outline of its own: drawn as a sprite (`mooIconSprite`) it gets the same dark outline and faint halo as every figure,
 * light from the top left, so it reads on light and dark grounds. Each is about 10 pixels tall (12 with its outline).
 */
export interface MooIcon {
  grid: readonly string[];
  palette: Readonly<Record<string, string>>;
}

export const MOO_ICONS = {
  /** A bottle of milk: a blue cap, a glass neck and shoulders, a white body. */
  milk: {
    grid: ["..ccc..", "..cCc..", "..gwg..", ".gwwwg.", "gwWwwwg", "gwWwwwg", "gwwwwsg", "gwwwwsg", "gwwwssg", ".ggggg."],
    palette: { c: "#3f7fd0", C: "#8fbcf5", g: "#8fb8dc", w: "#f6f6f0", W: "#ffffff", s: "#c4d0e2" },
  },
  /** A heart. */
  heart: {
    grid: [".rrr...rrr.", "rHHrr.rrrrr", "rHrrrrrrrrr", "rrrrrrrrrrs", "rrrrrrrrrrs", ".rrrrrrrrs.", "..rrrrrrs..", "...rrrrs...", "....rrs....", ".....s....."],
    palette: { r: "#e8384f", H: "#ff9aa8", s: "#b01f3a" },
  },
  /** A chess pawn (him thinking of a piece). */
  pawn: {
    grid: ["...ww...", "..wWww..", "..wwws..", "...ws...", "..wwws..", "...ws...", "...ws...", "..wwss..", ".wwwwss.", ".sssssss"],
    palette: { w: "#f1e8d2", W: "#fffaf0", s: "#bfb08e" },
  },
  /** "Zzz": napping, or dazed after the full moon. */
  zzz: {
    grid: [".......ZZZZ", ".........z.", "........z..", ".......ssss", "ZZZZZZ.....", "....zz.....", "...zz......", "..zz.......", ".zz........", "ssssss....."],
    palette: { Z: "#e6f4ff", z: "#9ccbf5", s: "#6aa0dc" },
  },
  /** A tuft of grass with a little flower. */
  grass: {
    grid: [".....p.....", "....pyp....", ".....p.....", ".....g.....", "..g..g..g..", "..gg.gG.gg.", ".gGg.gGgGg.", ".gGgGgGgGg.", "gGGgGgGGGgg", "ggggggggggg"],
    palette: { g: "#3a8f3a", G: "#7ad25e", p: "#f27aa8", y: "#ffd23a" },
  },
  /** A sparkle: a four-pointed star. */
  sparkle: {
    grid: ["....y....", "....y....", "...yYy...", "...yYy...", "yyyYYYyyy", "...yYy...", "...yYy...", "....y....", "....y...."],
    palette: { y: "#ffd23a", Y: "#fff6a8" },
  },
  /** The cartoon anger mark: for when you take his piece. */
  anger: {
    grid: ["rrr....rrr", "rHr....rrr", "rr......rr", "..........", "..........", "..........", "rr......rr", "rrr....rrr", "rrr....rrr"],
    palette: { r: "#e0342c", H: "#ff8a7a" },
  },
  /** A question mark. */
  question: {
    grid: [".yyyy.", "yYyyyy", "yy..yo", "....yo", "...yoo", "..yoo.", "..yo..", "......", "..yo..", "..yo.."],
    palette: { y: "#ffd23a", Y: "#fff6a8", o: "#d9921a" },
  },
  /** A tiny crescent moon: his friend. */
  moon: {
    grid: ["..yyyy..", ".yYyyy..", "yYyyy...", "yYyy....", "yyyy....", "yyyy....", "yyyyo...", "yyyyoo..", ".yyyyoo.", "..yyyyoo"],
    palette: { y: "#f8c744", Y: "#ffe58a", o: "#d8921f" },
  },
  /** A cowbell: a leather loop, a brass bell and its clapper. */
  cowbell: {
    grid: ["...lll...", "...l.l...", "..yyyyy..", ".yYyyyyo.", ".yYyyyyo.", ".yYyyyyo.", "yyYyyyyoo", "yyYyyyyoo", "ooooooooo", "...ddd..."],
    palette: { l: "#8a5a34", y: "#e8b23a", Y: "#fff0a0", o: "#b8801a", d: "#7a4a1a" },
  },
} as const satisfies Record<string, MooIcon>;

export type MooIconId = keyof typeof MOO_ICONS;

/** An icon as a one-frame sprite (three pixels of room all round for its outline and halo), drawn the way every figure is. */
export function mooIconSprite(id: MooIconId): Character {
  const icon: MooIcon = MOO_ICONS[id];
  const w = Math.max(...icon.grid.map((r) => r.length)) + 6;
  const h = icon.grid.length + 6;
  return {
    id: `moo-icon-${id}`,
    name: `Moo icon: ${id}`,
    w,
    h,
    foot: [Math.floor(w / 2), h - 3],
    palette: { k: MOO_PALETTE.k!, ...icon.palette },
    halo: "#2c2624",
    parts: { icon: { grid: icon.grid } },
    anims: { idle: { loop: true, frames: [{ ms: 1000, layers: [{ part: "icon", x: 3, y: 3 }] }] } },
  };
}

// ---- Things drawn on his frames: sparkles, dust, sweat, thoughts, the moon's motes, icons' pixels.

/** A speck at a scene point (the frame adds its own margins). */
const sp = (x: number, y: number, k: string): Speck => [OX + Math.round(x), OY + Math.round(y), k];
/** A moonlit four-point sparkle, white at its heart. */
const sparkle = (x: number, y: number, big = false): Speck[] => [
  sp(x, y, "w"), sp(x - 1, y, "P"), sp(x + 1, y, "P"), sp(x, y - 1, "P"), sp(x, y + 1, "P"),
  ...(big ? [sp(x - 2, y, "O"), sp(x + 2, y, "O"), sp(x, y - 2, "O"), sp(x, y + 2, "O")] : []),
];
/** Dust kicked up either side of his feet (`t` frames after he lands): `n` puffs a side rolling outward and up. */
const dust = (t: number, n = 3, cx = FOOT_X, spread = 22): Speck[] => {
  const out: Speck[] = [];
  for (let side = -1; side <= 1; side += 2)
    for (let i = 0; i < n; i++) {
      const x = Math.round(cx + side * (spread * 0.5 + i * 3.5 + t * (2 + (i % 2))));
      const y = GROUND - 1 - Math.round(t * (0.6 + (i % 3) * 0.5) + (i % 2));
      const cloud: [number, number, string][] = t < 2 ? [[0, 0, "t"], [side, 0, "t"], [0, -1, "y"], [side, -1, "y"]] : [[0, 0, "y"], [side, -1, "t"]];
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
/** Sweat flying off his head, both ways. */
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  return [sp(8 - t, 14 + t * 2, "~"), sp(44 + t, 13 + t * 2, "~")];
};
/** An icon's pixels on a frame (outlined, in the keys `remap` gives them), its top left at a scene point: Zzz over his head, a pawn in a thought. */
function iconSpecks(id: MooIconId, x: number, y: number, remap: Readonly<Record<string, string>> = {}): Speck[] {
  const g = MOO_ICONS[id].grid;
  const filled = (X: number, Y: number) => (g[Y]?.[X] ?? ".") !== ".";
  const out: Speck[] = [];
  for (let Y = -1; Y <= g.length; Y++)
    for (let X = -1; X <= g[0]!.length; X++) {
      if (filled(X, Y)) out.push(sp(x + X, y + Y, remap[g[Y]![X]!] ?? g[Y]![X]!));
      else if (filled(X + 1, Y) || filled(X - 1, Y) || filled(X, Y + 1) || filled(X, Y - 1)) out.push(sp(x + X, y + Y, "k"));
    }
  return out;
}
const ZZZ = { Z: "Z", z: "A", s: "B" } as const;
const PAWN = { w: "l", W: "m", s: "o" } as const;
/** Thoughts: moonlit dots rising off his head to the right, one more each beat, the last a pawn (a piece on his mind). */
const thoughts = (n: number): Speck[] =>
  ([[46, 8], [50, 2], [54, -4]] as Pt[]).slice(0, Math.min(n, 3)).flatMap(([x, y]) => [sp(x, y, "P"), sp(x + 1, y, "O"), sp(x, y - 1, "w")]).concat(n >= 4 ? iconSpecks("pawn", 50, -22, PAWN) : []);
/** The moon's light flowing into him: motes along a curve from the moon's face to his chest and head, `phase` (0 to 1) along it. */
function motes(phase: number, n = 9, spread = 1): Speck[] {
  const out: Speck[] = [];
  for (let i = 0; i < n; i++) {
    const u = (i / n + phase) % 1;
    const wob = Math.sin(u * 9 + i) * 2.5 * spread;
    // From the moon (11, 38), up and over to the head (24, 22) and down into his chest (31, 40).
    const x = u < 0.5 ? lerp(12, 22, u * 2) : lerp(22, 32, (u - 0.5) * 2);
    const y = u < 0.5 ? lerp(36, 20, u * 2) + wob : lerp(20, 40, (u - 0.5) * 2) + wob;
    out.push(sp(x, y, u < 0.3 ? "O" : u < 0.7 ? "P" : "w"));
    if (i % 3 === 0) out.push(sp(x + 1, y, "O"));
  }
  return out;
}
/** Rays of light round the moon as it fills: short ticks up and out from its top and sides. */
const rays = (t: number): Speck[] =>
  [[8, 21], [14, 18], [21, 20], [3, 28], [27, 24]].flatMap(([x, y], i): Speck[] => (i + t) % 2 ? sparkle(x!, y! - (t % 3), i === 1) : [sp(x!, y!, "P"), sp(x!, y! - 1, "O")]);

/** A hit: every color goes pale. */
const FLASH: Record<string, string> = Object.fromEntries(
  Object.entries(MOO_PALETTE)
    .filter(([k, c]) => c.length === 7 && !["k", "z", "~", "t", "y", "w"].includes(k))
    .map(([k, c]) => {
      const n = parseInt(c.slice(1), 16);
      const mix = (v: number) => Math.round(v + (255 - v) * 0.55).toString(16).padStart(2, "0");
      return [k, `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`];
    }),
);
/** The moon's yellow as it brightens toward full (levels 1 to 3: the frame's `pal` follows `moonGlow`). */
const MOON_BRIGHT: readonly Record<string, string>[] = [
  {},
  { M: "#eab22f", N: "#ffd24d", O: "#ffe37e", P: "#fff6bd" },
  { M: "#f4c443", N: "#ffe266", O: "#fff09a", P: "#fffbd8", Q: "#e09a24" },
  { M: "#ffd65e", N: "#ffec80", O: "#fff6b4", P: "#ffffee", Q: "#f0a82a" },
];

/**
 * A frame of a pose: `stance` hug or sit, `power` draws it in the powered-up colors, `pal` is on top of those (and of the
 * moon's brightening); specks that would touch the frame's edge are dropped (the test's rule: nothing at the edge).
 */
const F = (ms: number, pose: MooPose = {}, extra: Partial<Frame> & { stance?: Stance; power?: boolean } = {}): Frame => {
  const { stance = "hug", power = false, pal, specks, ...rest } = extra;
  const merged = { ...(power ? MOO_POWER_PALETTE : {}), ...MOON_BRIGHT[pose.moonGlow ?? 0], ...pal };
  return {
    ms,
    layers: mooLayers(pose, stance),
    ...rest,
    ...(Object.keys(merged).length ? { pal: merged } : {}),
    ...(specks ? { specks: specks.filter(([x, y]) => x >= 2 && y >= 2 && x <= W - 3 && y <= H - 3) } : {}),
  };
};
/** A frame of him powered up: the powered-up pose with `pose` on top, in the powered-up colors. */
const FP = (ms: number, pose: MooPose = {}, extra: Partial<Frame> & { stance?: Stance } = {}): Frame => F(ms, { ...POWERED, ...pose }, { power: true, ...extra });

// ---- His animations. Frame counts and timings follow the other bosses'.

const TAU = Math.PI * 2;
/** Breathing: [bob] per frame. */
const BREATH = [0, 0, 0, 0, 1, 1, 1, 1] as const;
const rnd = Math.round;

type MoonLook = { eyes: "happy" | "open" | "flat"; gaze?: Pt; mouth?: MooPose["moonMouth"] };
const IDLE_MOON: readonly MoonLook[] = [
  { eyes: "happy" }, { eyes: "happy" }, { eyes: "happy" },
  { eyes: "open", gaze: [-1, 0] }, { eyes: "open", gaze: [-1, -1] }, { eyes: "open", gaze: [0, -1] },
  { eyes: "open", gaze: [1, 0], mouth: "open" }, { eyes: "open", gaze: [1, 0] }, { eyes: "open", gaze: [0, 0] },
  { eyes: "flat" }, { eyes: "happy" }, { eyes: "happy" }, { eyes: "happy" },
  { eyes: "open", gaze: [1, 1] }, { eyes: "open", gaze: [0, 0] }, { eyes: "happy" },
];
const NUZZLE: readonly Pt[] = [[-1, 0], [-2, 1], [-2, 1], [-1, 0]];
/**
 * Idle: he breathes, his ears flop and his tail swishes (all still as he hugs the moon in the first frame, the approved
 * still); the moon looks about curiously (open eyes wandering over to the board, a word, a blink) and now and then he
 * nuzzles it, his eyes shut. Frame 1 is the still.
 */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const e = Math.sin((Math.PI * i) / 16) ** 2;
    const m = IDLE_MOON[i]!;
    const nuzzle = i >= 10 && i <= 13;
    return F(125, {
      bob: BREATH[i % 8]!,
      earN: 26 + rnd(6 * e * Math.sin((TAU * 2 * i) / 16)),
      earF: 26 + rnd(6 * e * Math.sin((TAU * 2 * (i - 1)) / 16)),
      tail: rnd(14 * e * Math.sin((TAU * i) / 8)),
      head: nuzzle ? NUZZLE[i - 10]! : [0, 0],
      eyes: i === 11 || i === 12 || i === 14 ? "shut" : "open",
      moonEyes: m.eyes,
      moonGaze: m.gaze ?? [0, 0],
      moonMouth: m.mouth ?? "smile",
    });
  }),
};

const SIT_MOON: readonly MoonLook[] = [{ eyes: "happy" }, { eyes: "happy" }, { eyes: "open", gaze: [-1, 0] }, { eyes: "open", gaze: [0, -1] }, { eyes: "open", gaze: [1, 0], mouth: "open" }, { eyes: "flat" }, { eyes: "happy" }, { eyes: "happy" }];
/** Sitting on the moon, floating: the boat bobs a pixel, he nods, his ears and tail sway, the moon looks about. Frame 1 is the approved sit. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => {
    const e = Math.sin((Math.PI * i) / 8) ** 2;
    const m = SIT_MOON[i]!;
    return F(250, {
      dy: [0, 0, -1, -1, -1, -1, 0, 0][i]!,
      earN: 26 + rnd(5 * e * Math.sin((TAU * i) / 4)),
      earF: 26 + rnd(5 * e * Math.sin((TAU * (i - 1)) / 4)),
      tail: rnd(12 * e * Math.sin((TAU * i) / 4)),
      head: [2, i === 3 || i === 4 ? 2 : 1],
      eyes: i === 6 ? "shut" : "open",
      moonEyes: m.eyes,
      moonGaze: m.gaze ?? [0, 0],
      moonMouth: m.mouth ?? "smile",
    }, { stance: "sit" });
  }),
};

/**
 * Entrance: his shadow spreads, he drops in from above hugging the moon (the moon gasping, his ears up), lands (a thump,
 * dust, his eyes shut), bounces; then he lifts his head and moos, the moon chattering, and settles with a smile.
 */
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 100, layers: [], specks: groundShadow(8), cue: "drop" },
    { ms: 100, layers: [], specks: groundShadow(16) },
    F(70, { dy: -10, earN: -10, earF: -10, tail: 20, moonEyes: "open", moonMouth: "o", mouth: "open" }),
    F(70, { dy: -4, earN: 4, earF: 4, tail: 12, moonEyes: "open", moonMouth: "o", mouth: "open" }),
    F(130, { bob: 3, eyes: "shut", earN: 40, earF: 40, tail: -6 }, { cue: "thump", shake: [0, 2], specks: dust(0) }),
    F(110, { bob: 1, earN: 14, earF: 14, tail: 8, moonEyes: "flat" }, { specks: dust(1) }),
    F(110, { bob: 0, moonEyes: "open", moonGaze: [0, 0] }, { specks: dust(2) }),
    F(160, { head: [0, -1], mouth: "open", eyes: "joy", earN: 10, earF: 10, tail: 12, moonEyes: "open", moonMouth: "open" }, { cue: "moo", specks: [...sparkle(8, 22), ...sparkle(36, 18)] }),
    F(160, { head: [-1, 1], eyes: "shut", moonEyes: "happy", moonMouth: "smile", tail: 4 }),
    F(300, {}),
  ],
};

/** Thinking: he chews, his eyes up toward the board, his ears and tail easing; the moon glances at the board, mouth a line; a thought rises (moonlit dots, then a pawn). */
const thinking: Anim = {
  loop: true,
  frames: [0, 1, 2, 3].flatMap((n) =>
    [0, 1, 2, 3].map((i) =>
      F(130, {
        gaze: [-1, -1],
        eyes: i === 3 ? "half" : "open",
        mouth: i % 2 ? "smile" : "chew",
        head: [0, i % 2],
        earN: 26 + [0, 3, 0, -3][i]!,
        earF: 26 + [0, -3, 0, 3][i]!,
        tail: [0, 5, 10, 5][i]!,
        moonEyes: "open",
        moonGaze: n % 2 ? [-1, 0] : [-1, -1],
        moonMouth: n === 2 && i === 1 ? "o" : "flat",
      }, { specks: thoughts(n + 1) }),
    ),
  ),
};

/** His move: a crouch, a hop with the tail up and his ears flying, a landing (dust), and a settle. */
const move: Anim = {
  loop: false,
  frames: [
    F(100, { bob: 2, earN: 32, earF: 32 }),
    F(90, { dy: -2, earN: 10, earF: 10, tail: 14, moonEyes: "open", moonMouth: "o" }),
    F(110, { dy: -5, earN: 0, earF: 0, tail: 20, eyes: "joy", moonEyes: "open", moonMouth: "o" }),
    F(130, { bob: 2, eyes: "shut", earN: 38, earF: 38, tail: 4 }, { cue: "thump", shake: [0, 1], specks: dust(0, 2) }),
    F(120, { bob: 1, earN: 18, earF: 18, tail: 8 }, { specks: dust(1, 2) }),
    F(160, {}),
  ],
};

/** A capture: he cheers, mooing, hopping, his ears flapping, the moon laughing, sparkles. */
const capture: Anim = {
  loop: false,
  frames: [
    F(90, { bob: 1, earN: 34, earF: 34 }),
    ...Array.from({ length: 10 }, (_, i) => {
      const odd = i % 2 === 1;
      return F(85, {
        dy: odd ? 0 : -2,
        bob: odd ? 1 : 0,
        head: [0, odd ? 0 : -1],
        mouth: "open",
        eyes: "joy",
        earN: odd ? 22 : 4,
        earF: odd ? 22 : 4,
        tail: odd ? 6 : 16,
        moonEyes: "happy",
        moonMouth: "open",
      }, { cue: i === 4 ? "moo" : undefined, specks: i < 8 ? sparkle(6 + ((i * 7) % 24), 20 - (i % 3) * 2, i % 4 === 0) : [] });
    }),
    F(160, { eyes: "half" }),
  ],
};

/** Hurt: a flash, he's knocked back with his eyes shut and his ears flung, the moon gasping; then he glares. */
const hurt: Anim = {
  loop: false,
  frames: [
    F(70, { bob: 2, dx: 1, eyes: "shut", mouth: "open", brows: "worry", earN: -8, earF: -8, tail: 18, moon: [-1, 1], moonEyes: "open", moonMouth: "o" }, { cue: "oof", pal: FLASH, shake: [1, 0], specks: sweat(0) }),
    F(80, { bob: 2, dx: 1, eyes: "shut", mouth: "open", brows: "worry", earN: -4, earF: -4, tail: -10, moon: [-1, 1], moonEyes: "open", moonMouth: "o" }, { shake: [-1, 0], specks: sweat(1) }),
    F(90, { bob: 1, dx: 2, brows: "worry", earN: 40, earF: 40, tail: 6, moonEyes: "open", moonGaze: [1, 0], moonMouth: "o" }, { specks: sweat(2) }),
    F(90, { bob: 1, dx: 1, brows: "worry", earN: 34, earF: 34, moonEyes: "open", moonGaze: [1, 0], moonMouth: "frown" }),
    F(110, { head: [0, 1], eyes: "half", brows: "worry", moonEyes: "open", moonGaze: [1, 0], moonMouth: "frown" }),
    F(120, { eyes: "half", brows: "angry", moonEyes: "open", moonMouth: "flat" }),
    F(160, {}),
  ],
};

/** Check: he points his snout at the king and moos, the moon glowing and looking too, sparkling; twice. */
const check: Anim = {
  loop: false,
  frames: [
    F(100, { bob: 2, head: [1, 1], earN: 38, earF: 38 }),
    F(120, { head: [-2, -1], mouth: "open", gaze: [-1, 0], earN: 14, earF: 14, tail: 14, moonGlow: 2, moonEyes: "open", moonGaze: [-1, 0], moonMouth: "o" }, { cue: "moo", specks: sparkle(2, 36) }),
    F(100, { head: [-2, -1], mouth: "open", gaze: [-1, 0], bob: 1, earN: 18, earF: 18, tail: 10, moonGlow: 1, moonEyes: "open", moonGaze: [-1, 0], moonMouth: "o" }),
    F(100, { eyes: "half", gaze: [-1, 0], moonEyes: "open", moonGaze: [-1, 0] }),
    F(120, { head: [-2, -1], mouth: "open", gaze: [-1, 0], earN: 12, earF: 12, tail: 16, moonGlow: 2, moonEyes: "open", moonGaze: [-1, 0], moonMouth: "o" }, { specks: sparkle(2, 36, true) }),
    F(100, { head: [-2, -1], mouth: "open", gaze: [-1, 0], bob: 1, earN: 18, earF: 18, moonGlow: 1, moonEyes: "open", moonGaze: [-1, 0], moonMouth: "o" }),
    F(150, { eyes: "half" }),
    F(160, { eyes: "half" }),
  ],
};

const SMUG_GAZE: readonly Pt[] = [[-1, 0], [0, 0], [1, 0], [1, 0], [0, 0], [-1, 0], [-1, 0], [-1, 0]];
/** Smug: head back, heavy-lidded, the smile, his ears lazing and tail swaying, one eye wandering; the moon snickers (eyes a line now and then). */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    F(150, {
      head: [1, -1],
      eyes: "half",
      gaze: SMUG_GAZE[i]!,
      earN: 30 + rnd(3 * Math.sin((TAU * i) / 8)),
      earF: 30 - rnd(3 * Math.sin((TAU * i) / 8)),
      tail: rnd(10 * Math.sin((TAU * i) / 8)),
      moonEyes: i % 4 === 2 ? "flat" : "happy",
      moonMouth: i % 4 === 2 ? "open" : "smile",
    }),
  ),
};

const RATTLED_GAZE: readonly Pt[] = [[1, 0], [-1, 0], [0, -1], [-1, 1]];
/** Rattled: shaking, eyes wide, mouth working, sweat flying, his ears and tail trembling; the moon gasps, eyes darting. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) =>
    F(80, {
      dx: i % 2 ? 1 : -1,
      bob: i % 4 === 2 ? 1 : 0,
      brows: "worry",
      mouth: i % 2 ? "open" : "smile",
      earN: i % 2 ? 36 : 20,
      earF: i % 2 ? 20 : 36,
      tail: i % 2 ? 8 : -8,
      moonEyes: "open",
      moonGaze: RATTLED_GAZE[i % 4]!,
      moonMouth: i % 2 ? "o" : "frown",
    }, { specks: sweat(i) }),
  ),
};

/**
 * Defeat: the hit flings him back, the moon slips out of his arms and he drops onto it, sitting; he slumps, his head down
 * and his ears limp, the moon looking at him, worried (held a second).
 */
const defeat: Anim = {
  loop: false,
  frames: [
    F(140, { bob: 2, dx: 1, eyes: "shut", mouth: "open", brows: "worry", earN: -10, earF: -10, tail: 16, moonT: 0.1, moon: [-1, 2], moonEyes: "open", moonMouth: "o" }, { cue: "oof", pal: FLASH, shake: [1, 0] }),
    F(150, { bob: 2, dx: 2, eyes: "shut", mouth: "open", brows: "worry", earN: 50, earF: 50, tail: -8, moonT: 0.3, moon: [-2, 7], handN: [12, 52], handF: [18, 50], moonEyes: "open", moonMouth: "o" }),
    F(150, { dy: -4, head: [2, 3], eyes: "shut", brows: "worry", earN: 55, earF: 55, tail: -8, moonEyes: "open", moonMouth: "o" }, { cue: "flop", stance: "sit", shake: [0, 1], specks: sweat(1) }),
    F(160, { bob: 1, head: [2, 4], eyes: "shut", brows: "worry", earN: 58, earF: 58, tail: -10, moonEyes: "open", moonGaze: [0, 1], moonMouth: "frown" }, { stance: "sit" }),
    F(220, { bob: 2, head: [2, 6], eyes: "shut", brows: "worry", earN: 62, earF: 62, tail: -14, moonEyes: "open", moonGaze: [0, 1], moonMouth: "frown" }, { stance: "sit" }),
    F(730, { bob: 2, head: [2, 6], eyes: "shut", brows: "worry", earN: 62, earF: 62, tail: -14, moonEyes: "open", moonGaze: [0, 1], moonMouth: "frown" }, { stance: "sit" }),
  ],
};

/** Victory: he hops, mooing, his ears up and flapping, the moon laughing; sparkles. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 2, 5, 6, 5, 2, 0, 0, 0, 0, 0, 0][i]!;
    return F(110, {
      dy: -air,
      bob: i === 0 || i === 6 ? 2 : 0,
      head: [0, air > 3 ? -1 : 0],
      mouth: air > 0 ? "open" : "smile",
      eyes: "joy",
      earN: air > 0 ? 2 + (i % 2) * 6 : 26,
      earF: air > 0 ? 8 - (i % 2) * 6 : 26,
      tail: rnd(16 * Math.sin((TAU * i) / 6)),
      moonEyes: "happy",
      moonMouth: air > 0 || i === 6 ? "open" : "smile",
    }, { cue: i === 2 ? "moo" : i === 6 ? "thump" : undefined, specks: [...(i === 6 ? dust(0, 2) : i === 7 ? dust(1, 2) : []), ...(i % 4 === 1 ? sparkle(30 + (i % 3) * 4, 4) : [])] });
  }),
};

// ---- Hugging the moon, sitting on it, and back.

/**
 * The switch: the moon slips out of his arms (it gasps), he opens them and it drops and turns into a boat under him; he
 * hops up (the boat under his feet), and drops onto it, sitting, with a bounce. `toHug` is the same the other way round.
 */
const SWITCH: readonly { ms: number; pose: MooPose; stance?: Stance; cue?: string; shake?: Frame["shake"] }[] = [
  { ms: 100, pose: { head: [0, 1], gaze: [-1, 1], earN: 18, earF: 18, moonEyes: "open", moonGaze: [1, 0], moonMouth: "o" } },
  { ms: 90, pose: { moonT: 0.12, moon: [-1, 3], handN: [11, 51], handF: [16, 48], head: [0, 1], mouth: "open", gaze: [-1, 1], earN: 10, earF: 10, tail: 8, moonEyes: "open", moonGaze: [1, 1], moonMouth: "open" }, cue: "slip" },
  { ms: 90, pose: { moonT: 0.4, moon: [-1, 6], handN: [7, 52], handF: [12, 49], dy: -1, head: [0, 1], mouth: "open", gaze: [-1, 1], earN: 6, earF: 6, tail: 14, moonEyes: "open", moonGaze: [0, 1], moonMouth: "o" } },
  { ms: 90, pose: { moonT: 0.7, moon: [0, 5], moonBack: true, handN: [8, 50], handF: [13, 48], dy: -6, head: [0, 1], eyes: "joy", earN: 0, earF: 0, tail: 18, moonEyes: "happy", moonMouth: "open" } },
  { ms: 80, pose: { moonT: 1, moonBack: true, handN: [8, 50], handF: [13, 48], dy: -11, eyes: "joy", earN: -4, earF: -4, tail: 20, moonEyes: "happy", moonMouth: "open" } },
  { ms: 80, pose: { dy: -4, head: [2, 0], eyes: "joy", earN: 0, earF: 0, tail: 14, moonEyes: "happy", moonMouth: "open" }, stance: "sit" },
  { ms: 90, pose: { dy: 1, bob: 1, eyes: "shut", earN: 40, earF: 40, tail: 4, moonEyes: "flat", moonMouth: "o" }, stance: "sit", cue: "plop", shake: [0, 1] },
  { ms: 120, pose: { head: [2, 1], tail: 6, moonEyes: "happy", moonMouth: "smile" }, stance: "sit" },
];
const switchFrames = (list: typeof SWITCH, cues: readonly (string | undefined)[]): Frame[] => list.map((s, i) => F(s.ms, s.pose, { stance: s.stance, cue: cues[i], shake: s.shake }));
const toSit: Anim = { loop: false, frames: switchFrames(SWITCH, SWITCH.map((s) => s.cue)) };
const toHug: Anim = { loop: false, frames: switchFrames([...SWITCH].reverse(), [undefined, "hop", undefined, undefined, "catch", undefined, undefined, undefined]) };

// ---- His own moments.

/**
 * Moonbeam, his passive (about as long as Alfil's tusks): the moon starts to glow and looks up, he lifts his snout to the
 * sky, ears back, and moos (`beam`: the beam starts falling from the sky onto your piece); the glow holds, motes of light
 * rising off the moon, and eases off.
 */
const moonbeam: Anim = (() => {
  const glowAt = [1, 2, 3, 3, 3, 3, 3, 2, 2, 1, 0] as const;
  const ms = [80, 90, 90, 90, 100, 100, 100, 100, 100, 90, 100];
  const up = (i: number): MooPose => {
    const k = Math.min(1, i / 3);
    return {
      moonGlow: glowAt[i] as 0 | 1 | 2 | 3,
      moonEyes: i < 10 ? "open" : "happy",
      moonGaze: [0, -1],
      moonMouth: i >= 3 && i <= 8 ? "o" : "smile",
      head: i < 10 ? [rnd(-2 * k), rnd(-3 * k)] : [0, 0],
      eyes: i >= 2 && i < 10 ? "shut" : "open",
      gaze: [0, -1],
      mouth: i >= 3 && i <= 8 ? "open" : "smile",
      earN: i < 10 ? 26 - rnd(18 * k) : 26,
      earF: i < 10 ? 26 - rnd(18 * k) : 26,
      tail: i < 10 ? rnd(18 * k) : 0,
      bob: i === 0 ? 1 : 0,
    };
  };
  return {
    loop: false,
    frames: ms.map((m, i) => F(m, up(i), { cue: i === 1 ? "hum" : i === 4 ? "beam" : i === 5 ? "moo" : undefined, specks: i >= 2 && i <= 8 ? rays(i) : [] })),
  };
})();

/**
 * Full Moon, the transformation (about as long as Alfil's Slam cast): the moon brightens to full (a word, a laugh), motes
 * of its light flow into him, he flashes white and flickers (`swap`: his colors go gold, his eyes glow, the aura flares
 * on), growls, then a big "MOO" with the aura blazing, and settles powered up.
 */
const fullMoon: Anim = {
  loop: false,
  frames: [
    F(90, { moonGlow: 1, moonEyes: "open", moonGaze: [1, 0], moonMouth: "open", gaze: [-1, 1], head: [0, 1] }, { cue: "swell" }),
    F(90, { moonGlow: 2, moonEyes: "open", moonGaze: [1, 0], moonMouth: "smile", gaze: [-1, 1], head: [0, 1], earN: 20, earF: 20 }, { specks: rays(0) }),
    F(100, { moonGlow: 3, moonEyes: "happy", moonMouth: "open", earN: 14, earF: 14, tail: 8 }, { specks: rays(1) }),
    F(100, { moonGlow: 3, moonEyes: "happy", moonMouth: "open", eyes: "open", earN: 10, earF: 10, tail: 12, bob: 1 }, { shake: [0, 1], specks: [...rays(2), ...motes(0.1)] }),
    F(100, { moonGlow: 3, moonEyes: "happy", moonMouth: "open", eyes: "half", earN: 4, earF: 4, tail: 16, bob: 1 }, { pal: FLASH, specks: [...rays(3), ...motes(0.4, 11, 1.4)] }),
    FP(70, { aura: 0, auraSize: 0.6, moonGlow: 3, moonEyes: "happy", moonMouth: "open", bob: 2 }, { cue: "swap", shake: [0, 2], specks: sparkle(40, 8, true) }),
    F(60, { moonGlow: 3, moonEyes: "happy", moonMouth: "open", bob: 1, eyes: "glow", brows: "angry", crest: true, patchF: true, earN: -30, earF: -30, head: [0, 3] }, { pal: FLASH, shake: [0, -1] }),
    FP(70, { aura: 1, auraSize: 0.85, moonGlow: 3, moonEyes: "happy", moonMouth: "open", bob: 1 }, { shake: [0, 1] }),
    FP(100, { aura: 2, moonGlow: 2, moonEyes: "happy", moonMouth: "smile", bob: 2, head: [0, 4], tail: 12 }, { shake: [1, 0] }),
    FP(100, { aura: 0, moonGlow: 2, moonEyes: "happy", moonMouth: "open", head: [0, 0], mouth: "open", earN: -58, earF: -58, tail: 20, dy: -2 }, { cue: "moo", shake: [0, -1], specks: [...sparkle(2, 16, true), ...sparkle(44, 14, true)] }),
    FP(100, { aura: 1, moonGlow: 2, moonEyes: "happy", moonMouth: "open", head: [0, 0], mouth: "open", earN: -62, earF: -62, tail: 22, dy: -2 }, { shake: [0, 1], specks: sparkle(24, 4) }),
    FP(100, { aura: 2, moonGlow: 1, moonEyes: "happy", moonMouth: "open", head: [0, 1], mouth: "open", earN: -54, earF: -54, tail: 18 }, { shake: [1, 0] }),
    FP(120, { aura: 0, moonGlow: 1, moonEyes: "happy", moonMouth: "smile", head: [0, 2], earN: -40, earF: -40 }),
    FP(140, { aura: 1, moonEyes: "happy" }),
  ],
};

/** He stands powered up, the aura flickering round him, breathing hard: a loop for the moves he plays at full strength. */
const powerIdle: Anim = {
  loop: true,
  frames: Array.from({ length: 6 }, (_, i) =>
    FP(110, { aura: (i % 3) as 0 | 1 | 2, bob: i % 3 === 1 ? 1 : 0, earN: -36 + rnd(4 * Math.sin((TAU * i) / 6)), earF: -36 - rnd(4 * Math.sin((TAU * i) / 6)), tail: 8 + rnd(6 * Math.sin((TAU * i) / 3)), moonEyes: i % 3 === 2 ? "flat" : "happy", moonMouth: "smile", moonGlow: 1 }),
  ),
};

/**
 * The flurry, on the first of his powered moves: the moon leaves his arms and rises over his head, glowing (it fires a
 * moonbeam, `beam1` to `beam5`, one after another about every 120 ms: each shot kicks the moon, Moo roaring, the aura
 * blazing); then they all stand together a moment (the last frame before the board fades them) and the moon comes
 * back down into his arms.
 */
const flurry: Anim = (() => {
  const rise = (dy: number, glowL: 0 | 1 | 2 | 3, extra: MooPose = {}): MooPose => ({ moonT: 0, moon: [0, dy], moonBack: dy < -30, handN: [12, 38], handF: [18, 36], moonEyes: "happy", moonMouth: "smile", moonGlow: glowL, ...extra });
  const shot = (i: number): Frame =>
    FP(120, rise(-46 + (i % 2 ? 1 : 0), 3, { aura: (i % 3) as 0 | 1 | 2, moonMouth: "o", mouth: "open", head: [0, 1], earN: -58, earF: -58, tail: 14 + (i % 2) * 8, bob: i % 2, dy: i % 2 ? 0 : -1 }), {
      cue: `beam${i + 1}`,
      shake: [i % 2 ? 1 : -1, 0],
      specks: [...sparkle(11 + (i % 3) * 3, -14 + (i % 2) * 3, true), ...sparkle(2 + i * 3, -24 + (i % 3) * 4)],
    });
  return {
    loop: false,
    frames: [
      FP(80, rise(0, 1, { aura: 0, bob: 2, mouth: "open", head: [0, 3] }), { cue: "gather" }),
      FP(70, rise(-14, 1, { aura: 1, head: [0, 2], moonMouth: "open" })),
      FP(70, rise(-30, 2, { aura: 2, head: [0, 1], moonMouth: "open" })),
      FP(70, rise(-46, 2, { aura: 0, head: [0, 1], mouth: "open", moonMouth: "open" })),
      FP(90, rise(-46, 3, { aura: 1, head: [0, 0], mouth: "open", earN: -62, earF: -62, bob: 1 }), { cue: "charge", shake: [0, 1], specks: sparkle(12, -20, true) }),
      ...[0, 1, 2, 3, 4].map(shot),
      FP(140, rise(-46, 3, { aura: 2, head: [0, 0], mouth: "open", earN: -60, earF: -60, moonMouth: "smile" }), { specks: [...sparkle(4, -28, true), ...sparkle(22, -34, true), ...sparkle(14, -14)] }),
      FP(110, rise(-24, 2, { aura: 0, head: [0, 1] })),
      FP(100, rise(-8, 1, { aura: 1, head: [0, 2], moonMouth: "smile" })),
      FP(100, { aura: 2, moonGlow: 0 }),
    ],
  };
})();

/**
 * Dazed, after his five powered moves: the aura fizzles and he flickers back to himself (`calm`: the colors swap back), a
 * wobble, his eyes shut, a Zzz rising over his head; the moon floats up and pats him, twice, and he comes round.
 */
const dazed: Anim = {
  loop: false,
  frames: [
    FP(100, { aura: 1, auraSize: 0.75, dx: -1, brows: "worry", head: [0, 4], moonEyes: "open", moonMouth: "o", moonGaze: [1, 0] }, { cue: "fizz" }),
    F(90, { aura: 2, auraSize: 0.5, dx: 1, brows: "worry", eyes: "half", crest: true, patchF: true, earN: -10, earF: -10, head: [0, 4], moonEyes: "open", moonMouth: "o" }, { pal: FLASH }),
    FP(90, { aura: 0, auraSize: 0.3, dx: -1, eyes: "half", brows: "worry", earN: 10, earF: 10, head: [0, 5], moonEyes: "open", moonMouth: "o" }),
    F(110, { dx: 1, eyes: "shut", brows: "worry", earN: 44, earF: 44, head: [0, 4], tail: -6, moonEyes: "open", moonGaze: [1, 0], moonMouth: "frown" }, { cue: "calm", specks: iconSpecks("zzz", 40, 4, ZZZ) }),
    F(110, { dx: -1, bob: 1, eyes: "shut", brows: "worry", earN: 48, earF: 48, head: [0, 5], tail: -8, moon: [3, -8], moonFront: true, moonEyes: "open", moonGaze: [1, 0], moonMouth: "o" }, { specks: iconSpecks("zzz", 41, 0, ZZZ) }),
    F(110, { dx: 1, bob: 2, eyes: "shut", brows: "worry", earN: 50, earF: 50, head: [-1, 6], tail: -8, moon: [9, -15], moonFront: true, moonEyes: "happy", moonMouth: "open" }, { shake: [0, 1], specks: iconSpecks("zzz", 42, -4, ZZZ) }),
    F(110, { dx: -1, bob: 1, eyes: "shut", brows: "worry", earN: 46, earF: 46, head: [0, 5], tail: -6, moon: [3, -7], moonFront: true, moonEyes: "open", moonGaze: [1, 0], moonMouth: "o" }, { specks: iconSpecks("zzz", 43, -8, ZZZ) }),
    F(110, { dx: 1, bob: 2, eyes: "shut", brows: "worry", earN: 48, earF: 48, head: [-1, 6], tail: -8, moon: [9, -14], moonFront: true, moonEyes: "happy", moonMouth: "open" }, { shake: [0, 1], specks: iconSpecks("zzz", 44, -12, ZZZ) }),
    F(120, { bob: 1, eyes: "half", brows: "worry", earN: 38, earF: 38, head: [0, 3], moon: [4, -5], moonEyes: "happy", moonMouth: "smile" }),
    F(140, { eyes: "half", earN: 30, earF: 30, head: [0, 1], moonEyes: "happy" }),
    F(160, {}),
  ],
};

// ---- His attack on a king (for his kit's `kingAttack` once he's wired in: perSquare 36, stand 1.8, facesLeft).

/** Room ahead of him (to our left, where he faces) for the moonbeams' reach to the king. */
const ATTACK_REACH = 40;
const AW = W + ATTACK_REACH;
/** Where each beam reaches the king (scene pixels): at his head, or a little lower, in turn. */
const STAND = 1.8 * 36;
const KING_AT = (i: number): Pt => [FOOT_X - STAND - 4, GROUND - 1 - (i % 2 ? 21 : 27)];
/** A frame of his in the attack's wider frame (his own frames already have headroom to drop in from). */
const fa = (fr: Frame): Frame => moved(fr, ATTACK_REACH, 0, AW, H);
const landShadow = (r: number): Speck[] => groundShadow(r).map(([x, y, k]): Speck => [x + ATTACK_REACH, y, k]);

/** A small moonbeam from the moon's edge to the king, scene pixels: a white core, a pale shaft round it, a faint rim, a flare at each end. */
function beam(from: Pt, to: Pt, fatness = 1): Speck[] {
  const cells = new Map<string, Speck>();
  const put = (x: number, y: number, k: string, rank: number) => {
    const id = `${Math.round(x)},${Math.round(y)}`;
    const old = cells.get(id);
    const oldRank = old ? ["w", "K", "L"].indexOf(old[2]) : 9;
    if (!old || rank < oldRank) cells.set(id, sp(x, y, k));
  };
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  for (let s = 0; s <= len; s += 0.5) {
    const u = s / len;
    const x = lerp(from[0], to[0], u);
    const y = lerp(from[1], to[1], u);
    const wobble = Math.round(Math.sin(s * 0.9) * 0.6);
    put(x, y + wobble, "w", 0);
    for (let o = 1; o <= fatness; o++) {
      put(x, y + wobble - o, "K", 1);
      put(x, y + wobble + o, "K", 1);
    }
    if (Math.round(s) % 2 === 0) {
      put(x, y + wobble - fatness - 1, "L", 2);
      put(x, y + wobble + fatness + 1, "L", 2);
    }
  }
  // A flare where it leaves the moon and where it lands.
  for (const [dx, dy, k] of [[0, 0, "w"], [-1, 0, "K"], [1, 0, "K"], [0, -1, "K"], [0, 1, "K"], [-2, 0, "L"], [2, 0, "L"], [0, -2, "L"], [0, 2, "L"]] as const) {
    put(from[0] + dx, from[1] + dy, k, k === "w" ? 0 : k === "K" ? 1 : 2);
    put(to[0] + dx, to[1] + dy, k, k === "w" ? 0 : k === "K" ? 1 : 2);
  }
  return [...cells.values()];
}

/** In the attack, both of them look at the king: his eyes and the moon's turned to him, his brows down, the stare nonstop. */
const ON_KING: MooPose = { gaze: [-1, 0], brows: "angry", head: [-1, 0], moonEyes: "open", moonGaze: [-1, 0] };
/** A beat: the moon shines a small moonbeam at the king (the cue frame is where the board flashes it on his square). */
const shineAt = (i: number): Frame => {
  const fr = fa(F(90, { ...ON_KING, bob: 1, moonGlow: 3, moonMouth: "o", mouth: "chew", earN: 18 + (i % 2) * 8, earF: 18 + (i % 2) * 8, tail: i % 2 ? 10 : -4 }, { cue: i % 2 ? "shine" : "beam", shake: [i % 2 ? -1 : 1, 0] }));
  const [tx, ty] = KING_AT(i);
  return { ...fr, specks: [...(fr.specks ?? []), ...beam([2, 38], [tx, ty], 1).map(([x, y, k]): Speck => [x + ATTACK_REACH, y, k])] };
};
/** Between beats: the glow eases, the stare holds. */
const easeAt = (i: number): Frame => fa(F(80, { ...ON_KING, moonGlow: 1, moonMouth: "flat", earN: 22, earF: 22, tail: i % 2 ? -4 : 6 }));

/**
 * His attack on a king, the king to our left (where he faces; the board mirrors him when it's to his right), on the
 * shared beats (KING_ATTACK, boss-timing.ts): his shadow spreads, he drops in hugging the moon (`drop`), lands (`land`);
 * then the moon shines a small moonbeam at the king nonstop, ten of them, cues `beam` and `shine` in turn (the cue frame
 * is where the board flashes the beam on the king's square), both of them staring at him, relentless; he moos once,
 * satisfied, and they float off. The last frame is empty.
 */
const kingAttack: Anim = (() => {
  const A = KING_ATTACK;
  const frames: Frame[] = [
    { ms: 100, layers: [], specks: landShadow(8) },
    { ms: 100, layers: [], specks: landShadow(16) },
    fa(F(80, { dy: -24, earN: -10, earF: -10, tail: 20, moonEyes: "open", moonMouth: "o", mouth: "open" }, { cue: "drop" })),
    fa(F(80, { dy: -9, earN: 4, earF: 4, tail: 12, ...ON_KING, moonMouth: "o", mouth: "open" })),
    fa(F(A.landAt - 360, { bob: 3, eyes: "shut", earN: 40, earF: 40, moonEyes: "flat" }, { cue: "land", shake: [0, 1], specks: dust(0) })),
    fa(F(A.lashAt - A.landAt, { ...ON_KING, moonGlow: 1, moonMouth: "flat", earN: 22, earF: 22 }, { specks: dust(1) })),
  ];
  for (let i = 0; i < A.lashes; i++) frames.push(shineAt(i), easeAt(i));
  const laugh = A.leaveAt - (A.lashAt + A.lashes * A.lashEveryMs);
  frames.push(fa(F(laugh, { head: [-1, -1], mouth: "open", eyes: "joy", earN: 8, earF: 8, tail: 14, moonEyes: "happy", moonMouth: "open" }, { cue: "moo", specks: sparkle(8, 24) })));
  const leave = A.ms - A.leaveAt;
  frames.push(
    fa(F(leave - 300, { bob: 3, eyes: "half", earN: 30, earF: 30 })),
    fa(F(80, { dy: -8, earN: 4, earF: 4, tail: 14, eyes: "joy", moonEyes: "happy", moonMouth: "open" }, { cue: "drop" })),
    fa(F(80, { dy: -24, earN: -10, earF: -10, tail: 18, eyes: "joy", moonEyes: "happy", moonMouth: "open" })),
    { ms: 80, layers: [], specks: landShadow(10) },
    { ms: 60, layers: [] },
  );
  return { loop: false, frames };
})();

export const MOO: Character = {
  id: "moo",
  name: "Moo",
  w: W,
  h: H,
  foot: [OX + FOOT_X, OY + GROUND],
  palette: MOO_PALETTE,
  halo: "#2c2624",
  parts: PARTS,
  anims: { idle, sit, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory, toSit, toHug, moonbeam, fullMoon, powerIdle, flurry, dazed, power: { loop: true, frames: [F(1000, POWERED, { power: true })] } },
};

/**
 * Moo for his attack on a king: the same drawing, parts and palette, facing our left as always, in a frame `ATTACK_REACH`
 * wider on the left (the moonbeams' reach). Its `idle`, one still, is for the preview, which starts every reel from one.
 */
export const MOO_ATTACK: Character = {
  ...MOO,
  id: "moo-attack",
  name: "Moo (his attack)",
  w: AW,
  foot: [MOO.foot[0] + ATTACK_REACH, MOO.foot[1]],
  anims: { idle: { loop: true, frames: [fa(F(1000))] }, kingAttack },
};

/** What a portrait shows (his head, an ear, his horns and a bit of the moon's face), in frame pixels. */
export const MOO_PORTRAIT = { x: OX + 1, y: OY + 3, w: 44, h: 44 } as const;
