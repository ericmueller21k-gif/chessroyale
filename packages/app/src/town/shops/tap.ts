/**
 * A tap inside a shop's room, as the room's camera sees it. Pure: no DOM; tested in packages/app/test/shop-tap.test.ts.
 *
 * - **The square under a point** (`squareUnder`): the nearest drawn square whose shape holds it, seen from the camera where it is
 *   now; Ginger's catwalk and stairs first, each drawn up where its deck or its steps are.
 * - **What a press is on** (`pressKey`), for the town's Press (../press.ts): the room picks it at the press and again at the release,
 *   and walks you only if both are the same (the town's rule). The camera trails your walk and glides on after you stop, about a
 *   square in a 100 ms tap at a walk's pace, so a square picked only at the release could be the one beside the square you pressed
 *   (Nov 5: docs/decisions/2026-11-05-ginger-steps.md).
 */
import { proj, type Pt, type View } from "../camera.ts";
import { isUp, liftAt } from "./levels.ts";
import type { Room, Sq } from "./room.ts";

/** (x, y) is inside the four points' shape. */
function inFour(q: readonly Pt[], x: number, y: number): boolean {
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i]!;
    const b = q[(i + 1) % 4]!;
    const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (cross > 0) pos++;
    else if (cross < 0) neg++;
  }
  return pos === 0 || neg === 0;
}

/**
 * The square under (x, y) in the room's box, seen through `v` from the camera at (camX, camY), or null: the nearest drawn square
 * whose shape holds the point (Ginger's catwalk and stairs first, up where they're drawn: a tap on the deck as you see it is the
 * deck's). `sqPx`: the room's pixels a square (a level's lift is in them); `q`: four scratch points.
 */
export function squareUnder(room: Room, v: View, camX: number, camY: number, sqPx: number, x: number, y: number, q: readonly Pt[]): Sq | null {
  const { n } = room;
  const lv = room.levels;
  const corners = (c: number, r: number) =>
    proj(v, c - 0.5 - camX, camY - (r - 0.5), 0, q[0]!) &&
    proj(v, c + 0.5 - camX, camY - (r - 0.5), 0, q[1]!) &&
    proj(v, c + 0.5 - camX, camY - (r + 0.5), 0, q[2]!) &&
    proj(v, c - 0.5 - camX, camY - (r + 0.5), 0, q[3]!);
  if (lv)
    for (let r = n - 1; r >= 0; r--)
      for (let c = 0; c < n; c++) {
        if (!isUp(lv, c, r) || !corners(c, r)) continue;
        const lift = liftAt(lv, c, r);
        for (let i = 0; i < 4; i++) q[i]!.y -= (lift * q[i]!.k) / sqPx;
        if (inFour(q, x, y)) return { c, r };
      }
  for (let r = n - 1; r >= 0; r--)
    for (let c = 0; c < n; c++) {
      if (!corners(c, r)) continue;
      if (inFour(q, x, y)) return { c, r };
    }
  return null;
}

const has = (list: readonly Sq[], s: Sq) => list.some((t) => t.c === s.c && t.r === s.r);

/**
 * What a press (or its release) is on, as the town keys it: the Shopkeeper (`onKeeper`: his picture; or his squares or the counter
 * under the finger), else the square under it (`sq:c,r`); "" nothing (a press on nothing walks nowhere). The same key at the release
 * as at the press walks you; another lets go, as in the town.
 */
export function pressKey(room: Room, onKeeper: boolean, sq: Sq | null): string {
  if (onKeeper) return "keeper";
  if (!sq) return "";
  if (has(room.keeper, sq) || has(room.counter, sq)) return "keeper";
  return `sq:${sq.c},${sq.r}`;
}
