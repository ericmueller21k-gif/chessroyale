/**
 * The circus tiger's board art for his balloons (not wired in yet: drafts for Eric, Oct 23; docs/decisions/2026-10-23-tiger-animations.md).
 * A finished balloon leaves the pump in the boss bar (tiger-bar.ts `release<Piece>`), floats to its square on its string and lands
 * there as one of his pieces. Each sprite is a `Character` as the other bosses' board art: one 32-px frame (`SQUARE`), and the balloon
 * is the bar's own stage-4 drawing at one frame pixel each (20 art px tall, its string trailing under it), so the balloon that leaves
 * the bar is the one that lands. The board draws the frame bigger than its square, at the scale that makes a balloon as tall as a
 * queen piece (Tiger.tsx, `balloonBox`). Its color is a look of each sprite (`BALLOON_COLORS`, the bar's), passed in.
 *
 *   balloonFly   square  fly<Piece> (loop, 4 frames, 480 ms): the balloon bobbing a pixel, its string swaying under it. Move it from
 *                the bar (the pump's `RELEASE_KNOT`) to the square (a CSS transform, as seedFly), then play balloonLand there: the
 *                landing's first look is the flight's (the knot at the same place).
 *   balloonLand  square  land<Piece> (ends empty, 790 ms): it drifts down onto the square, its string folding under it and its
 *                shadow growing; touches down with a squash (`thump`), bounces once softly and settles; then a puff of smoke
 *                swells over it and hides it whole (`poof`: put his real piece on the square at this cue, under the smoke) and thins
 *                away, leaving the real piece. Drawn over the square's piece.
 */
import { canvas, inEllipse, toGrid } from "../paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../sprite.ts";
import { BALLOON_COLORS, BALLOON_PIECES, balloonDrawing, balloonLooks, balloonPartOf, knotX, stringPart, type BalloonLook, type BalloonPiece } from "../tiger-bar.ts";
import { SQUARE, hitAnims, sparkle } from "./common.ts";

export const TIGER_FX_PALETTE: Record<string, string> = {
  k: "#1f1210", // outline (his)
  "1": BALLOON_COLORS.yellow[0], // the balloon (a look recolors it)
  "2": BALLOON_COLORS.yellow[1],
  "3": BALLOON_COLORS.yellow[2],
  w: "#fff6dc", // shine
  "8": "#5a3b22", // the string
  p: "#ffffff", // the puff of smoke: white to its shade
  q: "#e4def0",
  r: "#b4aac8",
  z: "#1a100c55", // the shadow on the square (see-through)
};

const { parts, add } = lazyParts();

/** Where the balloon's knot is while it flies, and the landing's first look (frame pixels). */
const FLY_KNOT: readonly [number, number] = [16, 22];
/** Where its knot is once it stands on the square (its base two rows above, about where a piece's base is). */
export const LAND_Y = 29;

function balloonAt(b: BalloonLook, kx: number, ky: number): Layer {
  const { sil, marks } = balloonDrawing(b);
  const name = `balloon:${b.piece}:${b.swell ?? 0}:${b.squash ?? 0}`;
  add(name, () => balloonPartOf(sil, marks));
  return { part: name, x: kx - knotX(sil), y: ky - (sil.length - 1) };
}

function stringAt(kx: number, ky: number, len: number, sway: number, phase: number): Layer {
  const s = stringPart(len, sway, phase);
  const name = `string:${len}:${sway}:${phase}`;
  add(name, () => s.part);
  return { part: name, x: kx + s.dx, y: ky + 1 };
}

/** A string lying on the square, folded `n` pixels to the right of the knot. */
function lyingString(kx: number, ky: number, n: number): Layer {
  const name = `lying:${n}`;
  add(name, () => {
    const cv = canvas(n + 1, 2);
    for (let i = 0; i <= n; i++) cv[i === 0 ? 0 : 1]![i] = "8";
    return { grid: toGrid(cv), outline: false };
  });
  return { part: name, x: kx, y: ky + 1 };
}

function shadow(w: number): Layer {
  const name = `shadow:${w}`;
  add(name, () => {
    const cv = canvas(w, 2);
    for (let y = 0; y < 2; y++) for (let x = 0; x < w; x++) if (inEllipse(w / 2, 1, w / 2, 1.2)(x, y)) cv[y]![x] = "z";
    return { grid: toGrid(cv), outline: false };
  });
  return { part: name, x: 16 - Math.floor(w / 2), y: LAND_Y };
}

/** A puff of smoke: round blobs (center x, y, radius), white lit from the top left, a shade at their lower right. */
function puff(name: string, blobs: readonly (readonly [number, number, number])[]): Layer {
  add(name, (): Part => {
    const cv = canvas(SQUARE, SQUARE);
    for (const [cx, cy, r] of blobs)
      for (let y = 0; y < SQUARE; y++)
        for (let x = 0; x < SQUARE; x++) {
          if (!inEllipse(cx, cy, r, r)(x, y)) continue;
          const u = (x + 0.5 - cx + (y + 0.5 - cy)) / (r * 1.4);
          cv[y]![x] = u > 0.55 ? "r" : u > 0.05 ? "q" : "p";
        }
    return { grid: toGrid(cv) };
  });
  return { part: name, x: 0, y: 0 };
}

const fr = (ms: number, layers: Layer[], extra: Partial<Frame> = {}): Frame => ({ ms, layers, ...extra });
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function flyAnim(piece: BalloonPiece): Anim {
  const [kx, ky] = FLY_KNOT;
  const frames = [0, 1, 2, 3].map((i) => {
    const bob = i === 1 || i === 2 ? -1 : 0;
    return fr(120, [stringAt(kx, ky + bob, SQUARE - 2 - ky - 1 - bob, 2, i * 1.6), balloonAt({ piece, stage: 4 }, kx, ky + bob)]);
  });
  return { loop: true, frames };
}

// The smoke: a few puffs at its foot, then one cloud over the whole balloon, then a ring that opens on the piece, then wisps.
const PUFF_START = [[9, 26, 3], [23, 26, 3], [16, 27, 2.5]] as const;
const PUFF_FULL = [[16, 8, 6], [10, 13, 6], [22, 13, 6], [9, 20, 6], [23, 20, 6], [16, 16, 8], [16, 24, 6], [11, 26.5, 3.2], [21, 26.5, 3.2]] as const;
const PUFF_RING = [[16, 5, 3.4], [7, 10, 3.6], [25, 10, 3.6], [6, 19, 3.6], [26, 19, 3.6], [9, 26, 3.4], [23, 26, 3.4]] as const;
const PUFF_WISP = [[16, 3.5, 1.8], [5, 12, 2], [27, 13, 2], [5, 26, 1.8], [27, 27, 1.8]] as const;

function landAnim(piece: BalloonPiece): Anim {
  const kx = FLY_KNOT[0];
  const at = (ky: number, more: Partial<BalloonLook> = {}) => balloonAt({ piece, stage: 4, ...more }, kx, ky);
  return {
    loop: false,
    frames: [
      fr(90, [shadow(5), stringAt(kx, 22, 7, 1, 0), at(22)]),
      fr(90, [shadow(7), stringAt(kx, 25, 4, 1, 1), at(25)]),
      fr(80, [shadow(9), stringAt(kx, 27, 1, 0, 0), lyingString(kx, 27, 2), at(27)]),
      fr(70, [shadow(11), lyingString(kx, LAND_Y - 1, 4), at(LAND_Y, { squash: -1 })], { cue: "thump" }),
      fr(70, [shadow(9), lyingString(kx, LAND_Y - 1, 4), at(LAND_Y - 2, { squash: 1 })]),
      fr(70, [shadow(11), lyingString(kx, LAND_Y - 1, 4), at(LAND_Y)]),
      fr(50, [shadow(11), lyingString(kx, LAND_Y - 1, 4), at(LAND_Y), puff("puff:start", PUFF_START)]),
      fr(90, [puff("puff:full", PUFF_FULL)], { cue: "poof" }),
      fr(80, [puff("puff:ring", PUFF_RING)]),
      fr(70, [puff("puff:wisp", PUFF_WISP)]),
      fr(30, []),
    ],
  };
}

const sprite = (id: string, anims: Record<string, Anim>): Character => ({
  id,
  name: id,
  w: SQUARE,
  h: SQUARE,
  foot: [SQUARE / 2, SQUARE],
  palette: TIGER_FX_PALETTE,
  looks: balloonLooks(),
  parts,
  anims,
});

/** A finished balloon in flight (`fly<Piece>`). */
export const BALLOON_FLY = sprite("balloonFly", Object.fromEntries(BALLOON_PIECES.map((p) => [`fly${cap(p)}`, flyAnim(p)])));
/** A balloon landing on its square and turning into his piece (`land<Piece>`). */
export const BALLOON_LAND = sprite("balloonLand", Object.fromEntries(BALLOON_PIECES.map((p) => [`land${cap(p)}`, landAnim(p)])));

// ---- His burning hoops (the ultimate): a hoop flies in from his paw and lands flat round a 2 x 2 block of squares, a ring of fire
// that burns for two of the crowd's turns (the second lower, embers) and goes out in a puff of smoke. The flames lick outward and up,
// off the ring, never in: the pieces inside stay in full view. Every pixel of fire and steel is outlined, so it reads on light and dark
// squares of every scheme.

const HOOP_PAL: Record<string, string> = {
  k: "#1f1210",
  p: "#7a1a0a", // fire: dark red to white-hot
  u: "#e8461c",
  v: "#ff9b22",
  Q: "#ffd84a",
  R: "#fff3b0",
  "%": "#4a4756", // the hoop's steel: dark, mid, light
  "&": "#8d8a9c",
  "=": "#cfccd9",
  c: "#2a2630", // charred steel
  "4": "#6c6878", // smoke: dark to light
  "5": "#a19cad",
  "6": "#d8d4e0",
};

/** The ring's frame: the 2 x 2 block (`HOOP_BLOCK` = 64 frame pixels, two squares) with `HOOP_MARGIN` round it for the fire. */
export const HOOP_MARGIN = 16;
export const HOOP_SIZE = 2 * SQUARE + 2 * HOOP_MARGIN;
const HC = HOOP_SIZE / 2;
/** The ring's size: a rounded square (a hoop seen from above, fitted to the block) just outside the block's edge. */
const RING_IN = 32.4;
const RING_OUT = 35.2;
/** How far a pixel is out from the middle along a rounded square (4th power: a squircle), `s` squashing it top to bottom (a hoop seen tilted), `lift` raising it. */
const ringR = (x: number, y: number, s = 1, lift = 0): number => {
  const dx = Math.abs(x + 0.5 - HC);
  const dy = Math.abs((y + 0.5 - HC + lift) / s);
  return (dx ** 4 + dy ** 4) ** 0.25;
};

interface HoopLook {
  /** Flames: their longest tongue (0 none), how hot (2 white-hot core, 1 orange, 0 embers only), and a seed (each frame flickers). */
  flame: number;
  heat: number;
  seed: number;
  /** Tilted (in the air) and how high above the block, the steel charred, the ring only partly left (fading out). */
  s?: number;
  lift?: number;
  charred?: boolean;
  part?: number;
}

function hoopRing(h: HoopLook): Part {
  const cv = canvas(HOOP_SIZE, HOOP_SIZE);
  const s = h.s ?? 1;
  const lift = h.lift ?? 0;
  const hash = (n: number) => ((Math.sin(n * 12.9898 + h.seed * 78.233) * 43758.5453) % 1 + 1) % 1;
  for (let y = 0; y < HOOP_SIZE; y++)
    for (let x = 0; x < HOOP_SIZE; x++) {
      const r = ringR(x, y, s, lift);
      if (r < RING_IN || r > RING_OUT) continue;
      const ang = Math.atan2(y + 0.5 - HC + lift, x + 0.5 - HC);
      if (h.part !== undefined && hash(Math.floor((ang + Math.PI) * 6)) > h.part) continue;
      // The steel, lit from the top left, wrapped with dark bands (the old act's tape, charred).
      const wrap = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 40) % 4 === 0;
      const lit = -Math.cos(ang + Math.PI / 4);
      cv[y]![x] = h.charred ? (hash(x * 31 + y) > 0.8 ? "p" : "c") : wrap ? "%" : r < RING_IN + 0.9 ? "%" : lit > 0.3 ? "=" : "&";
    }
  if (h.flame > 0) {
    // Tongues of fire off the outer edge, outward and up, each a flame shape (wide at the ring, to a point), of different lengths, hottest
    // at the ring; they overlap into a band of fire.
    const n = 46;
    for (let i = 0; i < n; i++) {
      const a = ((i + hash(i + 50) * 0.6) / n) * Math.PI * 2;
      const len = h.flame * (0.5 + 0.5 * hash(i));
      const [ox, oy] = [Math.cos(a), Math.sin(a)];
      let t = 20;
      while (ringR(HC + ox * t - 0.5, HC + oy * t * s - lift - 0.5, s, lift) < RING_OUT - 0.5) t += 0.5;
      let [dx, dy] = [ox, oy * 0.9 - 0.45];
      const d = Math.hypot(dx, dy) || 1;
      [dx, dy] = [dx / d, dy / d];
      const [bx, by] = [HC + ox * t - 0.5, HC + oy * t * s - lift - 0.5];
      const width = Math.min(2.4, 1.1 + len * 0.2);
      for (let y = Math.floor(by - len - 3); y <= by + len + 3; y++)
        for (let x = Math.floor(bx - len - 3); x <= bx + len + 3; x++) {
          if (cv[y]?.[x] !== ".") continue;
          const [px, py] = [x - bx, y - by];
          const along = px * dx + py * dy;
          const across = Math.abs(-px * dy + py * dx + Math.sin(along * 0.9 + i + h.seed) * 0.5);
          if (along < -0.5 || along > len) continue;
          const f = Math.max(0, along) / Math.max(1, len);
          if (across > width * (1 - f * 0.85)) continue;
          cv[y]![x] = h.heat >= 2 ? (f < 0.22 && across < width * 0.5 ? "R" : f < 0.45 ? "Q" : f < 0.75 ? "v" : "u") : h.heat === 1 ? (f < 0.35 ? "Q" : f < 0.65 ? "v" : "u") : f < 0.5 ? "u" : "p";
        }
    }
  }
  return { grid: toGrid(cv) };
}

/** A puff of smoke round the ring: blobs at every eighth of the way round, `r` across, `out` how far they have drifted out and up. */
function smokeRing(r: number, out: number, thin: boolean): Part {
  const cv = canvas(HOOP_SIZE, HOOP_SIZE);
  for (let i = 0; i < 12; i++) {
    if (thin && i % 2) continue;
    const a = (i / 12) * Math.PI * 2 + 0.2;
    const [cx, cy] = [HC + Math.cos(a) * (34 + out), HC + Math.sin(a) * (34 + out) - out];
    for (let y = 0; y < HOOP_SIZE; y++)
      for (let x = 0; x < HOOP_SIZE; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r) continue;
        const u = (x + 0.5 - cx + (y + 0.5 - cy)) / (r * 1.4);
        cv[y]![x] = u > 0.4 ? "4" : u > -0.2 ? "5" : "6";
      }
  }
  return { grid: toGrid(cv) };
}

const ringParts = lazyParts();
const ringLayer = (name: string, make: () => Part): Layer => (ringParts.add(name, make), { part: name, x: 0, y: 0 });
const ring = (h: HoopLook): Layer => ringLayer(`ring:${h.flame}:${h.heat}:${h.seed}:${h.s ?? 1}:${h.lift ?? 0}:${h.charred ? 1 : 0}:${h.part ?? 1}`, () => hoopRing(h));
const smoke = (r: number, out: number, thin = false): Layer => ringLayer(`smoke:${r}:${out}:${thin}`, () => smokeRing(r, out, thin));
const sparks = (seed: number, n: number, spread: number): Speck[] =>
  Array.from({ length: n }, (_, i): Speck => {
    const a = (i / n) * Math.PI * 2 + seed;
    const d = 36 + ((i * 5 + seed * 3) % spread);
    return [Math.round(HC + Math.cos(a) * d), Math.round(HC + Math.sin(a) * d - (i % 3)), i % 3 ? "Q" : "R"];
  }).filter(([x, y]) => x > 1 && y > 1 && x < HOOP_SIZE - 2 && y < HOOP_SIZE - 2);

/**
 * The ring of fire round a 2 x 2 block (frame `HOOP_SIZE` square: the block and `HOOP_MARGIN` round it; place it so the block is the
 * four squares). `land` (ends on burn's first look, 330 ms): it comes down tilted from above (`whoosh`), lands flat (`thump`) and its
 * flames flare up with sparks (`flame`). `burn` (loop, 4 x 110 ms): the crowd's first turn. `dying` (loop, 4 x 150 ms): its last turn,
 * low orange flames and embers. `out` (ends empty, 400 ms): the flames die, the steel goes black and a puff of smoke rises off it all
 * the way round (`puff`) and thins away.
 */
export const HOOP_RING: Character = {
  id: "hoopRing",
  name: "hoopRing",
  w: HOOP_SIZE,
  h: HOOP_SIZE,
  foot: [HC, HOOP_SIZE],
  palette: HOOP_PAL,
  parts: ringParts.parts,
  anims: {
    land: {
      loop: false,
      frames: [
        fr(70, [ring({ flame: 4, heat: 2, seed: 1, s: 0.3, lift: 22 })], { cue: "whoosh" }),
        fr(70, [ring({ flame: 4, heat: 2, seed: 2, s: 0.6, lift: 10 })]),
        fr(80, [ring({ flame: 2, heat: 2, seed: 3 })], { cue: "thump" }),
        fr(110, [ring({ flame: 10, heat: 2, seed: 4 })], { cue: "flame", specks: sparks(1, 14, 8) }),
      ],
    },
    burn: { loop: true, frames: [5, 6, 7, 8].map((seed, i) => fr(110, [ring({ flame: [9, 7, 10, 8][i]!, heat: 2, seed })])) },
    dying: { loop: true, frames: [9, 10, 11, 12].map((seed, i) => fr(150, [ring({ flame: [4, 3, 4, 3][i]!, heat: 1, seed })], { specks: sparks(seed, 6, 4) })) },
    out: {
      loop: false,
      frames: [
        fr(90, [ring({ flame: 1, heat: 0, seed: 13, charred: true })]),
        fr(100, [ring({ flame: 0, heat: 0, seed: 14, charred: true }), smoke(3.2, 0)], { cue: "puff" }),
        fr(100, [ring({ flame: 0, heat: 0, seed: 15, charred: true, part: 0.5 }), smoke(4, 2)]),
        fr(90, [smoke(3, 4, true)]),
        fr(20, []),
      ],
    },
  },
};

/** A hoop in flight (square, `fly`, loop 4 x 70 ms): small, burning, turning over; the board moves it from his paw to the block. */
function flyingHoop(t: number): Part {
  const cv = canvas(SQUARE, SQUARE);
  const sy = [1, 0.55, 0.2, 0.55][t]!;
  for (let y = 0; y < SQUARE; y++)
    for (let x = 0; x < SQUARE; x++) {
      const d = Math.hypot((x + 0.5 - 16) / 9, (y + 0.5 - 16) / (9 * sy + 0.6));
      if (d >= 0.78 && d <= 1.05) cv[y]![x] = x < 14 ? "=" : x > 18 ? "%" : "&";
      else if (d > 1.05 && d < 1.45 && (x * 7 + y * 3 + t * 5) % 4 !== 0 && y < 16 + 9 * sy) cv[y]![x] = d < 1.2 ? "Q" : d < 1.32 ? "v" : "u";
    }
  return { grid: toGrid(cv) };
}
const flyParts = lazyParts();
export const HOOP_FLY: Character = {
  id: "hoopFly",
  name: "hoopFly",
  w: SQUARE,
  h: SQUARE,
  foot: [SQUARE / 2, SQUARE],
  palette: HOOP_PAL,
  parts: flyParts.parts,
  anims: { fly: { loop: true, frames: [0, 1, 2, 3].map((t) => fr(70, [(flyParts.add(`fly:${t}`, () => flyingHoop(t)), { part: `fly:${t}`, x: 0, y: 0 })])) } },
};

/** His attack's hit on a king's square (`hit<H|L><L|R>`, about 200 ms): a balloon bonks on him and pops, scraps flying. */
export const BALLOON_HIT: Character = {
  id: "balloonHit",
  name: "balloonHit",
  w: SQUARE,
  h: SQUARE,
  foot: [SQUARE / 2, SQUARE],
  palette: { ...TIGER_FX_PALETTE, f: "#ffffff", Y: "#ffe27a" },
  looks: balloonLooks(),
  parts: {},
  anims: hitAnims([["H", 9], ["L", 15]], (y, step): Speck[] => {
    if (step === 0) {
      const out: Speck[] = [];
      for (let dy = -3; dy <= 3; dy++) for (let dx = 0; dx <= 6; dx++) if (((dx - 3) / 3.6) ** 2 + (dy / 3.2) ** 2 <= 1) out.push([4 + dx, y + dy, Math.abs(dy) === 3 || dx === 0 || dx === 6 ? "k" : dx < 3 && dy < 0 ? "3" : "2"]);
      return out;
    }
    if (step === 1) return [...sparkle(9, y, "f", "Y", true), [4, y - 4, "2"], [14, y - 3, "2"], [5, y + 4, "1"], [13, y + 4, "2"]];
    return [[3, y - 6, "2"], [16, y - 4, "1"], [4, y + 6, "2"], [15, y + 6, "1"], [9, y - 7, "3"]];
  }),
};
