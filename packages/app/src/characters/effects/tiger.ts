/**
 * The circus tiger's board art for his balloons (not wired in yet: drafts for Eric, Oct 23; docs/decisions/2026-10-23-tiger-animations.md).
 * A finished balloon leaves the pump in the boss bar (tiger-bar.ts `release<Piece>`), floats to its square on its string and lands
 * there as one of his pieces. Each sprite is a `Character` as the other bosses' board art: one frame exactly the square it covers
 * (`SQUARE` = 32 frame pixels), and the balloon is the bar's own stage-4 drawing at one frame pixel each (about 20 of the square's
 * 32, its string trailing under it), so the balloon that leaves the bar is the one that lands. Its color is a look of each sprite
 * (`BALLOON_COLORS`, the bar's), passed in.
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
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part } from "../sprite.ts";
import { BALLOON_COLORS, BALLOON_PIECES, balloonDrawing, balloonLooks, balloonPartOf, knotX, stringPart, type BalloonLook, type BalloonPiece } from "../tiger-bar.ts";
import { SQUARE } from "./common.ts";

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
const LAND_Y = 29;

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
