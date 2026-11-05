/**
 * The street town's back wall (Nov 5, round 5; Eric: "put a gate to the left and right of it … trees and shrubs … you can't go past it.
 * It's all blocked off … the entire back wall of the map … is totally blocked"). A stone wall with crenels, as a box (town-kit.ts
 * TownBox): either side of the Colosseum on its front line, each with a closed iron gate (decorative), and along the whole north edge
 * behind the town's back rows. Trees and shrubs stand behind it (the plan's grove); nothing else does.
 *
 * Pixel scale and palette as the town's (37 px a square). No words on it.
 */
import { box, character, flatRoof, MAT, paletteOf, sideArt, SQ, type Piece, type TownBox } from "./town-kit.ts";

/** A wall's recipe: its width (squares), its height (px to the top of its crenels), a gate's middle (px from its left) or none. */
export interface WallSpec {
  w: number;
  h: number;
  gate: number | null;
  /** How deep it runs back (squares). */
  depth: number;
}

const PAL = paletteOf({
  name: "wall",
  wall: ["#7d766b", "#a59d8e", "#c9c1b0"],
  roof: ["#6f685e", "#8f877a", "#b1a998"],
  door: "#26252b",
});
/** The crenels' height and the gate's size (px). */
const CREN = 10;
const GATE_W = 38;
const GATE_H = 74;

const cache = new Map<string, TownBox>();
export function wallArt(spec: WallSpec): TownBox {
  const key = `wall-${spec.w}-${spec.h}-${spec.gate ?? ""}-${spec.depth}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = Math.round(spec.w * SQ);
  const H = spec.h + 3;
  const F = H - 3;
  const top = F - spec.h;
  const P: Piece[] = [];
  // The wall, every column (a neighbour segment butts against it), its stones; a coping under the crenels; a plinth.
  P.push(box(0, top + CREN, W, spec.h - CREN, (_i, _j, x, y) => MAT.stone(x, y - top)));
  P.push(box(0, top, W, CREN + 1, (i, j) => (j < 4 && i % 12 >= 6 ? null : j === 0 || (j === 4 && i % 12 >= 6) ? "c" : j < 7 ? "c" : j === CREN ? "a" : "b")));
  P.push(box(0, top + CREN, W, 4, (_i, j) => (j < 2 ? "c" : "a"), false));
  P.push(box(0, F - 6, W, 6, (i, j) => (j === 0 ? "a" : i % 14 === 0 ? "a" : "b"), false));
  if (spec.gate !== null) {
    // A closed iron gate in an arch of dressed stone: dark behind, upright bars with spear tops, two rails.
    const gx = Math.round(spec.gate - GATE_W / 2);
    const gy = F - GATE_H;
    P.push(
      box(gx - 5, gy - 6, GATE_W + 10, GATE_H + 6, (i, j) => {
        const cx = (GATE_W + 10) / 2;
        const dx = i + 0.5 - cx;
        const r = (GATE_W + 10) / 2;
        // The arch's head: a half circle.
        if (j < r && Math.hypot(dx, j - r) > r) return null;
        return Math.abs(dx) > GATE_W / 2 || (j < r && Math.hypot(dx, j - r) > r - 5) ? ((i + j) % 5 === 0 ? "a" : "c") : "x";
      }),
    );
    P.push(
      box(gx, gy, GATE_W, GATE_H, (i, j) => {
        const r = GATE_W / 2;
        const dx = i + 0.5 - r;
        if (j < r && Math.hypot(dx, j - r) > r) return null;
        if (j === Math.round(GATE_H * 0.35) || j === GATE_H - 10) return "k";
        if (i % 6 === 2) return j % 6 === 0 && j < GATE_H * 0.35 ? "y" : "k";
        return "m";
      }),
    );
  }
  const front = character(key, W, H, PAL, P);
  const D = Math.round(spec.depth * SQ);
  const eave = spec.h - CREN;
  const side = { mat: "stone" as const, rows: [], trim: [0] };
  const left = sideArt(`${key}-L`, PAL, side, D, eave, true);
  const right = sideArt(`${key}-R`, PAL, side, D, eave, false);
  const tb: TownBox = {
    id: key, front, lights: [], lot: { w: spec.w, d: 1 }, inset: 0, depth: spec.depth, body: { x0: 0, x1: W }, left, right,
    roof: flatRoof(0, W, eave + 1, "wallstone"), roofPal: PAL, taper: 1,
  };
  cache.set(key, tb);
  return tb;
}
