/**
 * Moo & Moon's board art (not wired in yet: drafts for Eric, Oct 20): the moonbeam that falls from the sky onto one of
 * your pieces (his passive, and five of them at once in the Full Moon's flurry), the glow and the little crescent that
 * mark a stunned piece's square, and the small beam the moon shines at a king in his attack. Drawn in the moon's colors: a
 * white core, a pale silver-blue shaft with a deeper blue edge and a dark blue outline (so it reads on the light squares
 * as well as the dark ones of every board color scheme: Classic, Green, Gold), and a soft see-through glow round it, with
 * a few sparkles; a lunar Kamehameha, not a UFO's tractor beam.
 *
 *   moonbeam  a column, 8 squares tall (`SQUARE` x `SQUARE * 8` frame pixels): its bottom square is the target square, the
 *             rest the sky above it; place it with its bottom on the square and let the board clip what's above the board's
 *             top edge (the shaft fades to nothing toward its top, so a square on the back rank loses nothing of it).
 *             fall   (ends on hit's first look, 220 ms, cue `beam`: the sound) a bright head races down the shaft, the shaft
 *                    ablaze behind it, the target square's pool of light waking as it comes.
 *             hit    (ends on hold's first look, 240 ms, cue `hit`: the flash) it lands: a white flash over the square
 *                    (the piece still shows through at the edges), a ring of light spreading, sparkles flying.
 *             hold   (loop, 3 frames, 680 ms) what stays through the crowd's turn: the shaft thin and faint, the square
 *                    softly lit with a bright blue edge and a little crescent in its corner (this is the stunned mark: the
 *                    glow and the crescent are the whole of it); everything in it is see-through, so the piece shows.
 *             fade   (ends empty, 300 ms) the glow thins and goes.
 *   moonHit   square  hit<H|L><L|R> (ends empty, about 200 ms): the small beam landing on a king's head (high) or a little
 *             lower, from the left or right edge: a flash, a ring of sparkles, motes.
 *
 * The flurry is the same beam on five squares: start each one's `fall` `FLURRY_STAGGER_MS` after the last (the moon's
 * frames in moo.ts carry the cues `beam1` to `beam5` that far apart), let them all reach `hold` together, then play every
 * `fade` at once.
 */
import { canvas, ellipse, toGrid, type Canvas } from "../paint.ts";
import type { Anim, Character, Frame, Layer, Part, Speck } from "../sprite.ts";
import { SQUARE, hitAnims, sparkle } from "./common.ts";

export const MOON_PALETTE: Record<string, string> = {
  k: "#232d6b", // outline: a deep blue that reads on every square
  e: "#4a6ecf", // the beam's edge
  c: "#86b2f4", // its shaft, outer to inner
  b: "#bddcff",
  W: "#e8f4ff",
  w: "#fffdf0",
  y: "#fff0a8",
  "1": "#d6eaffe0", // the glow, strong to faint (see-through)
  "2": "#b6d6ffa2",
  "3": "#9ec4ff5e",
  "4": "#8db6f532",
  m: "#f8c744", // the little crescent: its yellow, light and shade
  n: "#ffe58a",
  o: "#c9801f",
};

/** The same palette, every color's see-through by `f` (0 to 1) of what it was, for a glow thinning away. */
const faded = (f: number): Record<string, string> =>
  Object.fromEntries(
    Object.entries(MOON_PALETTE).map(([k, v]) => {
      const a = v.length === 9 ? parseInt(v.slice(7), 16) : 255;
      return [k, `${v.slice(0, 7)}${Math.round(a * f).toString(16).padStart(2, "0")}`];
    }),
  );

const TALL = SQUARE * 8;
/** The target square: the bottom one of the column. */
const SQ0 = TALL - SQUARE;
const MID = 15.5;
const BAYER = [[0.125, 0.625], [0.875, 0.375]] as const;
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

const part = (draw: (cv: Canvas) => void): Part => {
  const cv = canvas(SQUARE, TALL);
  draw(cv);
  return { grid: toGrid(cv), outline: false };
};
const L = (name: string): Layer => ({ part: name, x: 0, y: 0 });
const frame = (ms: number, layers: Layer[] = [], extra: Partial<Frame> = {}): Frame => ({ ms, layers, ...extra });

interface Beam {
  /** Where its head is (the shaft is lit above it only); TALL for the whole column. */
  front: number;
  /** Half the width of its white core and of its shaft, in pixels at the bottom. */
  core: number;
  half: number;
  /** How far its glow reaches beyond the shaft. */
  glow: number;
  /** Where the ripple is along it (radians). */
  wave: number;
  /** A faint beam: no white core, no dark outline. */
  faint?: boolean;
}

/** The shaft as a grid column: layered zones from the core out (white, pale, blue, edge, outline, glow), fading out toward the sky, dithered. */
function shaft(cv: Canvas, b: Beam): void {
  for (let y = 0; y <= Math.min(TALL - 1, b.front); y++) {
    // Strong at the bottom, fading to nothing over the top 90 pixels of the column; the head is brightest.
    const sky = clamp(y / 90) ** 0.8;
    const toHead = b.front - y;
    const cx = MID + Math.sin(y * 0.16 + b.wave) * (0.3 + 0.8 * (y / TALL));
    const half = b.half * (0.7 + 0.3 * (y / TALL));
    const core = b.core * (0.7 + 0.3 * (y / TALL));
    for (let x = 0; x < SQUARE; x++) {
      const dx = Math.abs(x + 0.5 - cx);
      // [zone key, how strong it is]; the zone this distance falls in.
      let key = "";
      let strength = 0;
      if (!b.faint && dx <= core) [key, strength] = ["w", 0.98];
      else if (!b.faint && dx <= core + 1.5) [key, strength] = ["W", 0.92];
      else if (dx <= half * 0.72) [key, strength] = [b.faint ? "3" : "b", b.faint ? 0.6 : 0.82];
      else if (dx <= half) [key, strength] = [b.faint ? "4" : "c", b.faint ? 0.5 : 0.7];
      else if (dx <= half + 1) [key, strength] = [b.faint ? "4" : "e", 0.58];
      else if (!b.faint && dx <= half + 2) [key, strength] = ["k", 0.52];
      else if (dx <= half + 2 + b.glow) {
        const g = (dx - half - 2) / Math.max(1, b.glow);
        [key, strength] = [g < 0.3 ? "1" : g < 0.55 ? "2" : g < 0.8 ? "3" : "4", 0.46 - g * 0.36];
      }
      if (!key) continue;
      const lit = sky + (BAYER[y & 1]![x & 1]! - 0.5) * 0.3;
      if (lit < 1 - strength) continue;
      cv[y]![x] = key;
    }
    // The head: a bright blob, a little wider than the shaft.
    if (toHead >= 0 && toHead < 6 && b.front < TALL - 1) {
      const r = (half + 2) * Math.sqrt(1 - ((5 - toHead) / 6) ** 2 * 0.0 - (toHead / 6) ** 2);
      for (let x = 0; x < SQUARE; x++) {
        const dx = Math.abs(x + 0.5 - cx);
        if (dx <= r) cv[y]![x] = dx <= r * 0.45 ? "w" : dx <= r * 0.8 ? "W" : "b";
      }
    }
  }
}

/** A pool of light on the target square: `r` its reach (1 fills the square), strongest at the middle; a bright rim where the flash is. */
function pool(cv: Canvas, r: number, rim = false): void {
  const [cx, cy] = [MID, SQ0 + 15.5];
  for (let y = SQ0; y < TALL; y++)
    for (let x = 0; x < SQUARE; x++) {
      const d = Math.hypot((x + 0.5 - cx) / 15, (y + 0.5 - cy) / 15) / r;
      if (d > 1) continue;
      const v = (1 - d) ** 0.8;
      const level = Math.floor(v * 4 + BAYER[y & 1]![x & 1]!);
      if (level > 0 && cv[y]![x] === ".") cv[y]![x] = "4321"[clamp(level, 1, 4) - 1]!;
    }
  if (rim) for (let a = 0; a < 80; a++) {
    const t = (a / 80) * Math.PI * 2;
    const [x, y] = [Math.round(cx + Math.cos(t) * 14.2 * r), Math.round(cy + Math.sin(t) * 14.2 * r)];
    if (cv[y]?.[x] !== undefined && y >= SQ0) cv[y]![x] = "W";
  }
}

/** The flash as it lands: a white disc over the square's middle, pale toward its rim, the corners left clear. */
function flash(cv: Canvas, r: number): void {
  const [cx, cy] = [MID, SQ0 + 15.5];
  for (let y = SQ0; y < TALL; y++)
    for (let x = 0; x < SQUARE; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / (15 * r);
      if (d > 1) continue;
      cv[y]![x] = d < 0.35 ? "w" : d < 0.6 ? "W" : d < 0.82 ? "b" : "1";
    }
}

/** What stays on the square while the piece can't move: a bright blue edge a pixel in, a pale band inside it, a faint tint, a crescent in the corner. */
function held(cv: Canvas, shimmer: number): void {
  for (let y = SQ0; y < TALL; y++)
    for (let x = 0; x < SQUARE; x++) {
      const edgeDist = Math.min(x, y - SQ0, SQUARE - 1 - x, TALL - 1 - y);
      if (edgeDist === 0) cv[y]![x] = "e";
      else if (edgeDist === 1) cv[y]![x] = (x + y + shimmer) % 3 === 0 ? "W" : "2";
      else if (edgeDist === 2) cv[y]![x] = "3";
      else cv[y]![x] = (x + y + shimmer) % 4 === 0 ? "4" : cv[y]![x]!;
    }
  // The crescent, top right: an outline, a yellow body, a pale light on its upper left.
  const cres = [".kkk.", "kmnnk", "kmk..", "kmk..", "kmmok", ".kkk."];
  cres.forEach((row, j) => [...row].forEach((k, i) => (k !== "." ? (cv[SQ0 + 3 + j]![SQUARE - 9 + i] = k) : undefined)));
}

const beamParts: Record<string, Part> = {};
const fallFronts = [48, 120, 190, 245] as const;
fallFronts.forEach((f, i) => {
  beamParts[`fall${i}`] = part((cv) => {
    shaft(cv, { front: f, core: 2.2, half: 5.6, glow: 6, wave: i * 1.7 });
    pool(cv, [0, 0.25, 0.5, 0.8][i]!);
  });
});
beamParts.hit0 = part((cv) => {
  shaft(cv, { front: TALL, core: 3, half: 6.6, glow: 7, wave: 0.4 });
  pool(cv, 1, true);
  flash(cv, 1);
});
beamParts.hit1 = part((cv) => {
  shaft(cv, { front: TALL, core: 2.8, half: 6.2, glow: 6, wave: 1.3 });
  pool(cv, 1, true);
  flash(cv, 0.62);
});
beamParts.hit2 = part((cv) => {
  shaft(cv, { front: TALL, core: 1.8, half: 4.8, glow: 5, wave: 2.2, faint: false });
  pool(cv, 0.9);
});
for (const [i, w] of [0, 2.1, 4.2].entries())
  beamParts[`hold${i}`] = part((cv) => {
    shaft(cv, { front: TALL, core: 0, half: 3.2 + (i % 2) * 0.6, glow: 5, wave: w, faint: true });
    held(cv, i);
  });

/** Sparkles drifting down the shaft (scene: the column's own pixels), `i` which frame. */
const motes = (i: number, n: number): Speck[] =>
  Array.from({ length: n }, (_, k): Speck[] => {
    const y = 70 + ((k * 61 + i * 37) % 150);
    const x = Math.round(MID + Math.sin(k * 2.3 + i) * 9);
    return k % 3 === 0 ? sparkle(x, y, "w", "b") : [[x, y, k % 2 ? "W" : "b"]];
  }).flat();

/** The ring of light and the sparkles thrown off as it lands, `t` 0 to 2. */
const landing = (t: number): Speck[] => {
  const out: Speck[] = [];
  const r = 8 + t * 4;
  for (let a = 0; a < 14; a++) {
    const ang = (a / 14) * Math.PI * 2 + t * 0.2;
    const [x, y] = [Math.round(MID + Math.cos(ang) * r), Math.round(SQ0 + 15.5 + Math.sin(ang) * r * 0.92)];
    if (x >= 1 && x <= SQUARE - 2 && y >= SQ0 + 1 && y <= TALL - 2) out.push([x, y, a % 2 ? "W" : "w"]);
  }
  for (const [dx, dy] of [[-11, -9], [11, -10], [-10, 10], [12, 9]] as const) out.push(...sparkle(MID + dx * (0.6 + t * 0.3) | 0, (SQ0 + 15 + dy * (0.6 + t * 0.3)) | 0, "w", "b"));
  return out;
};

const beamAnims: Record<string, Anim> = {
  fall: {
    loop: false,
    frames: [
      frame(55, [L("fall0")], { cue: "beam", specks: motes(0, 3) }),
      frame(55, [L("fall1")], { specks: motes(1, 4) }),
      frame(55, [L("fall2")], { specks: motes(2, 5) }),
      frame(55, [L("fall3")], { specks: motes(3, 5) }),
    ],
  },
  hit: {
    loop: false,
    frames: [
      frame(70, [L("hit0")], { cue: "hit", specks: landing(0) }),
      frame(80, [L("hit1")], { specks: landing(1) }),
      frame(90, [L("hit2")], { specks: landing(2) }),
    ],
  },
  hold: { loop: true, frames: [frame(240, [L("hold0")], { specks: motes(4, 2) }), frame(220, [L("hold1")], { specks: motes(5, 2) }), frame(220, [L("hold2")], { specks: motes(6, 2) })] },
  fade: {
    loop: false,
    frames: [0.75, 0.5, 0.28, 0.12].map((f, i) => frame(75, [L(`hold${i % 3}`)], { pal: faded(f) })).concat([frame(20)]),
  },
};

export const MOONBEAM: Character = {
  id: "moonbeam",
  name: "A moonbeam",
  w: SQUARE,
  h: TALL,
  foot: [16, TALL - 1],
  palette: MOON_PALETTE,
  parts: beamParts,
  anims: beamAnims,
};

/** How long after one beam's `fall` the next starts in the flurry (moo.ts's `beam1` to `beam5` cues are this far apart), and how many there are. */
export const FLURRY_STAGGER_MS = 120;
export const FLURRY_BEAMS = 5;

// ---- The small beam landing on a king (his attack on a king).

/** The landing at (`x`, `y`) on the king, as specks with a dark outline: a white flash, a ring of sparkles, then motes. */
function strike([x, y]: [number, number], step: 0 | 1 | 2): Speck[] {
  const cv = canvas(SQUARE, SQUARE);
  const r = [3.2, 5.5, 4][step]!;
  ellipse(cv, x, y, r, r * 0.92, step === 2 ? "b" : "W");
  ellipse(cv, x, y, r * 0.55, r * 0.5, "w");
  const filled = (px: number, py: number) => cv[py]?.[px] !== undefined && cv[py]![px] !== ".";
  const out: Speck[] = [];
  for (let py = 0; py < SQUARE; py++)
    for (let px = 0; px < SQUARE; px++) {
      if (filled(px, py)) out.push([px, py, cv[py]![px]!]);
      else if (([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => filled(px + dx, py + dy))) out.push([px, py, "k"]);
    }
  if (step === 0) out.push(...sparkle(x, y - 5, "w", "b"));
  if (step === 1) out.push(...sparkle(x - 8, y - 3, "w", "b"), ...sparkle(x + 8, y - 4, "W", "c"), [x - 6, y + 7, "W"], [x + 7, y + 6, "b"], [x, y - 9, "w"]);
  if (step === 2) out.push([x - 9, y - 5, "b"], [x + 9, y - 6, "c"], [x - 7, y + 8, "b"], [x + 8, y + 7, "W"]);
  return out;
}

export const MOON_HIT: Character = {
  id: "moon-hit",
  name: "A moonbeam landing on a king",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: MOON_PALETTE,
  parts: {},
  anims: hitAnims([["H", 9], ["L", 15]], (y, step) => strike([15, y], step)),
};
