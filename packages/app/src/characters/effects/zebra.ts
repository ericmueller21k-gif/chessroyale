/**
 * Don Dough's effect sprites for the board: one, the flour off a shot of his bread rifle on a king (his attack on a king: the God
 * King's Last Stand, the crowd's king at its mate). Drawn by code like Timber's chips (effects/timber.ts), in the art's flour and
 * crust colors (scripts/boss-art/out/zebra-nov10.md on `claude/boss-art`: his puff is "a pop of flour and crumbs", never a muzzle
 * flash): a white-hot pop where the shot lands, a cloud of flour rolling on, crumbs falling. See ../effects.ts.
 */
import type { Character, Speck } from "../sprite.ts";
import { SQUARE, hitAnims } from "./common.ts";

const FLOUR_PALETTE: Record<string, string> = {
  k: "#5a3818",
  f: "#ffffff", // the pop's heart and the flour
  h: "#efe8d8",
  H: "#d9cdb0",
  c: "#d68a35", // crumbs of crust
  d: "#7a3f12",
};

const bit = (n: number, salt = 0) => ((Math.imul(n + 7 * salt + 3, 2654435761) >>> 0) >>> 13) % 7;

/** The flour off a shot at (bx, y), coming in from the left edge: the pop (step 0), the cloud (1), crumbs falling and the haze thinning (2). */
function flour(bx: number, y: number, step: 0 | 1 | 2, seed: number): Speck[] {
  const out: Speck[] = [];
  if (step === 0) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push([bx + dx, y + dy, Math.abs(dx) + Math.abs(dy) < 2 ? "f" : "h"]);
    return out;
  }
  const r = step === 1 ? 4 : 6;
  for (let i = 0; i < (step === 1 ? 16 : 12); i++) {
    const a = (i / 16) * 2 * Math.PI + bit(i, seed) * 0.3;
    const d = r * (0.5 + (bit(i, seed + 1) % 4) / 6);
    const x = Math.round(bx + 2 + Math.cos(a) * d);
    const yy = Math.round(y + Math.sin(a) * d * 0.8 + (step === 2 ? 2 : 0));
    out.push([x, yy, step === 1 ? (i % 3 ? "h" : "f") : i % 2 ? "H" : "h"]);
  }
  for (let i = 0; i < 4; i++) out.push([bx + 3 + i * 2, y + (step === 1 ? 1 : 4) + (i % 2), i % 2 ? "c" : "d"]);
  return out;
}

/**
 * The flour off a shot of Don Dough's on a king's square (his attack on a king): `hitH<L|R>` at its head, `hitL<L|R>` at its chest,
 * his shot coming in from the left or the right edge. About 200 ms each; each ends empty. Over the piece (or the God King standing there).
 */
export const FLOUR_HIT: Character = {
  id: "flour-hit",
  name: "Flour off a shot of Don Dough's",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: FLOUR_PALETTE,
  parts: {},
  anims: {
    ...hitAnims([["H", 9]], (y, step) => flour(10, y, step, 3)),
    ...hitAnims([["L", 16]], (y, step) => flour(10, y, step, 5)),
  },
};
