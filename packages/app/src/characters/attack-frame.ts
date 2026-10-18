/**
 * What the bosses' attacks on a king share (kits.ts: `kingAttack`; Sawyer's, Wrangler's and Boingo's): their frames
 * are the boss's own frames moved into a bigger one, with room ahead of him for his prop (the saw, the lasso, the pie's
 * flight) and headroom to drop in from, and a shadow on the ground under where he'll land. Nothing is mirrored here:
 * the board mirrors the whole figure when it has to (KingAttack.tsx).
 */
import type { Frame, Speck } from "./sprite.ts";

/**
 * `fr` moved `dx` right and `dy` down into a frame `w` x `h`, lifted `lift` pixels (in the air); specks that would
 * leave the frame (a pixel's margin) are dropped, as each boss's own frames do. In the air, his own ground shadow
 * (a part named "shadow") stays off, and `ground` (specks already in the new frame's pixels: his shadow on the ground
 * below him) is drawn as it is.
 */
export function moved(fr: Frame, dx: number, dy: number, w: number, h: number, lift = 0, ground: readonly Speck[] = []): Frame {
  const y = dy - lift;
  const specks = [...(fr.specks ?? []).map(([sx, sy, k]): Speck => [sx + dx, sy + y, k]), ...ground].filter(([sx, sy]) => sx >= 2 && sy >= 2 && sx <= w - 3 && sy <= h - 3);
  return { ...fr, layers: fr.layers.filter((l) => !lift || l.part !== "shadow").map((l) => ({ ...l, x: l.x + dx, y: l.y + y })), specks };
}

/** A shadow on the ground (frame pixels): an ellipse `r` across each way, `ry` high, centered at (cx, cy), in key `k`. */
export function groundShadow(cx: number, cy: number, r: number, k = "z", ry = 1.5): Speck[] {
  const out: Speck[] = [];
  for (let x = -r; x <= r; x++) for (let y = -2; y <= 0; y++) if ((x / r) ** 2 + ((y + 0.5) / ry) ** 2 <= 1) out.push([cx + x, cy + y, k]);
  return out;
}
