/**
 * Wrangler's effect sprites for the board: one, the crack of his lasso's end on a king (his attack on a king: the God
 * King's Last Stand, the crowd's king at its mate). His other powers' ropes are drawn by the board itself
 * (components/Pig.tsx). See ../effects.ts.
 */
import type { Anim, Character, Speck } from "../sprite.ts";
import { SQUARE } from "./common.ts";

const CRACK_PALETTE: Record<string, string> = {
  k: "#2b1411", // outline (unused: all specks)
  c: "#fffbe8", // the snap's white heart
  y: "#ffd451", // its gold
  t: "#ecc47c", // rope fibers: light, mid
  R: "#c58f4b",
};

/**
 * The snap where the rope's end cracks, coming in from the left edge, at (x, y): `step` 0 to 2 (a white star and its
 * rays, the rays flung wider with fibers off the rope, the last fibers drifting).
 */
const crackSpecks = (x: number, y: number, step: 0 | 1 | 2): Speck[] => {
  const out: Speck[] = [];
  if (step === 0) out.push([x, y, "c"], [x - 1, y, "c"], [x + 1, y, "c"], [x, y - 1, "c"], [x, y + 1, "c"]);
  // Rays: short streaks out from the snap, the longest away from him (to the right).
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  for (const deg of rays) {
    const a = (deg * Math.PI) / 180;
    const len = (deg === 0 || deg === 45 || deg === 315 ? 3 : 2) + step;
    const from = 2 + step * 2;
    for (let d = from; d < from + len; d++) {
      if (step === 2 && d % 2) continue;
      const X = Math.round(x + Math.cos(a) * d);
      const Y = Math.round(y + Math.sin(a) * d * 0.8);
      if (X > 0 && Y > 0 && X < SQUARE - 1 && Y < SQUARE - 1) out.push([X, Y, step === 0 ? "y" : d === from ? "y" : "t"]);
    }
  }
  // Fibers off the rope, flicked up and away.
  if (step > 0) for (let i = 0; i < 5; i++) out.push([x + 2 + i * 2 + step, y - 3 - ((i * 3) % 4) - step + (step === 2 ? 3 : 0), i % 2 ? "R" : "t"]);
  return out;
};
const crackAnims: Record<string, Anim> = {};
for (const [kind, y] of [["H", 10], ["L", 17]] as const)
  for (const side of ["L", "R"] as const) {
    const sp = (step: 0 | 1 | 2): Speck[] => crackSpecks(18, y, step).map(([x, yy, k]): Speck => [side === "L" ? x : SQUARE - 1 - x, yy, k]);
    crackAnims[`hit${kind}${side}`] = {
      loop: false,
      frames: [
        { ms: 50, layers: [], specks: sp(0) },
        { ms: 70, layers: [], specks: sp(1) },
        { ms: 60, layers: [], specks: sp(2) },
        { ms: 20, layers: [] },
      ],
    };
  }

/**
 * A crack of Wrangler's lasso on a king's square (his attack on a king): `hit<H|L><L|R>`, high or low, his rope coming
 * in from the left or the right edge: a white snap with gold rays and fibers flicked off the rope. About 200 ms; ends
 * empty. Over the piece (or the God King standing there); it never touches him: the rope only cracks there.
 */
export const LASSO_HIT: Character = {
  id: "lasso-hit",
  name: "A crack of Wrangler's lasso",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: CRACK_PALETTE,
  parts: {},
  anims: crackAnims,
};
