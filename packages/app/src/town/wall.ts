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
  /**
   * (The north edge round) Open arches through it, gateways you walk through: each its middle (px from its left), its opening's width
   * and its height to the crown (px). A wall with arches is seen from both sides (the plaza's front wall): its back is its front mirrored.
   */
  arches?: readonly { x: number; w: number; h: number }[];
  /** A grand gateway's crest over its arch: the game's crown in gold on a navy roundel, pilasters either side. */
  crest?: boolean;
}

const PAL = paletteOf({
  name: "wall",
  wall: ["#7d766b", "#a59d8e", "#c9c1b0"],
  roof: ["#6f685e", "#8f877a", "#b1a998"],
  door: "#26252b",
  extra: { N: "#1f2a44", n: "#34466e", Y: "#f4b740", y: "#ffe08a", O: "#b97c10" },
});
/** The crenels' height and the gate's size (px). */
const CREN = 10;
const GATE_W = 38;
const GATE_H = 74;

/** Is (x, y) (px across from its left; y up from its foot) inside an open arch? */
const inArch = (a: { x: number; w: number; h: number }, x: number, y: number, pad = 0): boolean => {
  const r = a.w / 2 + pad;
  const dx = x + 0.5 - a.x;
  if (Math.abs(dx) >= r || y < 0) return false;
  const spring = a.h - a.w / 2;
  return y + 0.5 <= spring || Math.hypot(dx, y + 0.5 - spring) < r;
};

const cache = new Map<string, TownBox>();
export function wallArt(spec: WallSpec): TownBox {
  const key = `wall-${spec.w}-${spec.h}-${spec.gate ?? ""}-${spec.depth}-${(spec.arches ?? []).map((a) => `${a.x}.${a.w}.${a.h}`).join("_")}${spec.crest ? "-crest" : ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = Math.round(spec.w * SQ);
  const front = wallFront(key, spec, W, false);
  const D = Math.round(spec.depth * SQ);
  const eave = spec.h - CREN;
  const side = { mat: "stone" as const, rows: [], trim: [0] };
  const left = sideArt(`${key}-L`, PAL, side, D, eave, true);
  const right = sideArt(`${key}-R`, PAL, side, D, eave, false);
  const tb: TownBox = {
    id: key, front, lights: [], lot: { w: spec.w, d: 1 }, inset: 0, depth: spec.depth, body: { x0: 0, x1: W }, left, right,
    roof: flatRoof(0, W, eave + 1, "wallstone"), roofPal: PAL, taper: 1,
    // (Seen from behind too, a wall with gateways: its front mirrored, so each arch is where it is.)
    ...(spec.arches?.length ? { rear: { ch: wallFront(`${key}-rear`, spec, W, true), lights: [] } } : {}),
  };
  cache.set(key, tb);
  return tb;
}

/** A wall's face (`mirror`: as seen from behind, its arches mirrored). */
function wallFront(key: string, spec: WallSpec, W: number, mirror: boolean) {
  const H = spec.h + 3;
  const F = H - 3;
  const top = F - spec.h;
  const arches = (spec.arches ?? []).map((a) => (mirror ? { ...a, x: W - a.x } : a));
  const open = (x: number, y: number, pad = 0) => arches.some((a) => inArch(a, x, F - 1 - y, pad));
  const P: Piece[] = [];
  // The wall, every column (a neighbor segment butts against it), its stones; a coping under the crenels; a plinth. The arches open.
  P.push(box(0, top + CREN, W, spec.h - CREN, (_i, _j, x, y) => (open(x, y) ? null : MAT.stone(x, y - top))));
  P.push(box(0, top, W, CREN + 1, (i, j) => (j < 4 && i % 12 >= 6 ? null : j === 0 || (j === 4 && i % 12 >= 6) ? "c" : j < 7 ? "c" : j === CREN ? "a" : "b")));
  P.push(box(0, top + CREN, W, 4, (_i, j) => (j < 2 ? "c" : "a"), false));
  P.push(box(0, F - 6, W, 6, (_i, j, x, y) => (open(x, y) ? null : j === 0 ? "a" : x % 14 === 0 ? "a" : "b"), false));
  // Each arch's ring of dressed stones (lit on its upper left), its keystone; its jambs.
  for (const a of arches) {
    const r = a.w / 2 + 6;
    const spring = a.h - a.w / 2;
    P.push(
      box(a.x - r, F - a.h - 6, 2 * r, a.h + 6, (_i, _j, x, y) => {
        if (!open(x, y, 6) || open(x, y)) return null;
        const dx = x + 0.5 - a.x;
        const h = F - 1 - y;
        if (h > spring && Math.abs(dx) < 4) return h > a.h + 1 ? "c" : "b"; // the keystone
        const ang = h > spring ? Math.atan2(h - spring, dx) : dx < 0 ? Math.PI : 0;
        return Math.floor(ang / 0.3) % 2 ? (dx < 0 ? "c" : "b") : "a";
      }, false),
    );
  }
  if (spec.crest && arches[0]) {
    // Pilasters either side of the grand arch, an entablature over it, and the crest: the game's crown on a navy roundel, rimmed gold.
    const a = arches[0];
    const r = a.w / 2 + 6;
    for (const x of [a.x - r - 9, a.x + r + 1]) P.push(box(x, top + CREN + 4, 8, F - top - CREN - 10, (i) => (i === 0 ? "c" : i === 7 ? "a" : "b")));
    P.push(box(a.x - r - 12, top + CREN + 2, 2 * r + 24, 7, (_i, j) => (j < 2 ? "c" : j === 6 ? "a" : "b")));
    const cy = top + CREN + 2 + Math.max(14, (F - a.h - 6 - (top + CREN + 9)) / 2 + 5);
    const R = 13;
    P.push(
      box(a.x - R, cy - R, 2 * R, 2 * R, (i, j) => {
        const dx = i + 0.5 - R;
        const dy = j + 0.5 - R;
        const d = Math.hypot(dx, dy);
        if (d > R) return null;
        if (d > R - 2.5) return dx + dy < 0 ? "y" : "O";
        const ci = Math.floor((dx + 9) / 2.25);
        const cj = Math.floor((dy + 7) / 2);
        const crown = ci >= 0 && ci <= 7 && cj >= 0 && cj <= 6 && (cj >= 4 || ((ci === 0 || ci === 7 || ci === 3 || ci === 4) ? cj >= 1 : cj >= 3));
        if (crown) return cj < 2 ? "y" : "Y";
        return dx < -3 ? "n" : "N";
      }),
    );
  }
  if (spec.gate !== null) {
    // A closed iron gate in an arch of dressed stone: dark behind, upright bars with spear tops, two rails.
    const gx = Math.round((mirror ? W - spec.gate : spec.gate) - GATE_W / 2);
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
  return character(key, W, H, PAL, P);
}
