/**
 * What the rows let you see (Nov 5, round 4; the brief: "draw only what the rows let you see: the street you're on and the openings at
 * its ends"). From a square, the squares a straight line reaches without crossing a lot (a row's, a home's, a tall block's): the street
 * you stand in, the sidewalks, the fronts on either side, the crossings and what the street or a square opens onto. A lot square is seen
 * when it's the first lot on its line (a front); the ones behind it are under the building or behind the row.
 *
 * Pure (no canvas): render.ts asks for the squares seen from where you stand and from where the camera stands, at the close zoom steps,
 * and leaves out the ground, the props and the boxes nobody could see. Worked out once a square (a few thousand short lines), cached.
 */
import { N, colI, rowI } from "./camera.ts";
import { STREET_GROUND, STREET_GROUND_KEY } from "./street.ts";

/** How far a line is followed (squares): past the camera's rim (16) with room for the camera standing behind you. */
export const SEEN_REACH = 20;
const L = STREET_GROUND_KEY.L;
const cache = new Map<number, Uint8Array>();
const CACHE_MAX = 96;

/** Rays cast round a square: half a degree apart, so at the reach two neighbours are under a fifth of a square apart. */
const RAYS = 720;
const STEP = 0.2;
const RAY_X = new Float64Array(RAYS);
const RAY_Y = new Float64Array(RAYS);
for (let i = 0; i < RAYS; i++) ((RAY_X[i] = Math.cos((2 * Math.PI * i) / RAYS)), (RAY_Y[i] = Math.sin((2 * Math.PI * i) / RAYS)));

/**
 * The squares seen from square (c0, r0) (index r * N + c: 1 seen), within SEEN_REACH: rays cast from its middle every half degree, each
 * marking the squares it crosses up to and including the first lot it meets (a front seen at any slant, however shallow). Off the
 * world: nothing seen (all 0).
 */
export function seenFrom(c0: number, r0: number): Uint8Array {
  const cc = colI(Math.round(c0));
  const rr = rowI(Math.round(r0));
  if (cc < 0 || rr < 0) return EMPTY;
  const key = rr * N + cc;
  const hit = cache.get(key);
  if (hit) return hit;
  const out = new Uint8Array(N * N);
  out[key] = 1;
  const steps = Math.ceil(SEEN_REACH / STEP);
  for (let i = 0; i < RAYS; i++) {
    let pc = cc;
    let pr = rr;
    for (let s = 1; s <= steps; s++) {
      const c = Math.round(cc + RAY_X[i]! * s * STEP);
      const r = Math.round(rr + RAY_Y[i]! * s * STEP);
      if (c === pc && r === pr) continue;
      pc = c;
      pr = r;
      const wc = colI(c);
      const wr = rowI(r);
      // (Off the world's north or south edge: nothing more that way.)
      if (wc < 0 || wr < 0) break;
      out[wr * N + wc] = 1;
      if (STREET_GROUND[wr * N + wc] === L) break;
    }
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, out);
  return out;
}
const EMPTY = new Uint8Array(N * N);

/** The squares seen from either of two squares (where you stand and where the camera stands), into `out`. */
export function seenEither(a: Uint8Array, b: Uint8Array, out: Uint8Array): Uint8Array {
  for (let k = 0; k < out.length; k++) out[k] = a[k]! | b[k]!;
  return out;
}
