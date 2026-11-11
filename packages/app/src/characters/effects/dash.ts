/**
 * Dash's effect sprites for the board: one, the marks of a swipe of his claws on a king (his attack on a king: the God King's Last
 * Stand, the crowd's king at its mate). Until Nov 11 his swipes showed Jefferson's fireball pops (`popHit`), another boss's effect
 * (docs/decisions/2026-11-11-mate-effects-iphone-vibration.md). Drawn by code like Don Dough's flour (effects/zebra.ts), in his own colors (his
 * jacket's teal, boss-blitz.ts): three claw streaks raking down across the square, white-hot, then teal, then gone. See ../effects.ts.
 */
import type { Character, Speck } from "../sprite.ts";
import { SQUARE, hitAnims } from "./common.ts";

const CLAW_PALETTE: Record<string, string> = {
  w: "#ffffff", // a streak's heart
  D: "#6fd8c8", // his teal, light to dark
  C: "#22a8a0",
  B: "#137a7a",
};

/**
 * Three claw streaks around height y, coming in from the left edge and raking down to the right: drawn in (step 0, their first
 * half), whole (1), fading at their tails (2).
 */
function claws(y: number, step: 0 | 1 | 2): Speck[] {
  const out: Speck[] = [];
  const len = 14;
  for (let k = 0; k < 3; k++) {
    const x0 = 7 + k * 3;
    const y0 = y - 6 + k * 3;
    const from = step === 2 ? len / 2 : 0;
    const to = step === 0 ? len / 2 : len;
    for (let i = from; i < to; i++) {
      const x = x0 + i;
      const yy = y0 + Math.round(i * 0.6);
      const heart = step === 1 && i > 2 && i < len - 2;
      out.push([x, yy, step === 2 ? "B" : heart ? "w" : "D"]);
      out.push([x, yy + 1, step === 2 ? "B" : "C"]);
    }
  }
  return out;
}

/**
 * The marks of a swipe of Dash's claws on a king's square (his attack on a king): `hitH<L|R>` at its head, `hitL<L|R>` at its chest,
 * his swipe coming in from the left or the right edge. About 200 ms each; each ends empty. Over the piece (or the God King there).
 */
export const CLAW_HIT: Character = {
  id: "claw-hit",
  name: "A swipe of Dash's claws",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: CLAW_PALETTE,
  parts: {},
  anims: {
    ...hitAnims([["H", 10]], claws),
    ...hitAnims([["L", 18]], claws),
  },
};
