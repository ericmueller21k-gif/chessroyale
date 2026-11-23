/**
 * Boingo's claw machine as a solid cabinet in his Funhouse (Eric, Nov 6: "the real claw machine in the room, a big 3D arcade cabinet
 * you walk up to"), drawn in 3D through the room's own camera (`proj` with a lift), so it looks right from wherever you stand. Since
 * Nov 6 (brief-3d-kit; Eric: "the claw machine looks out of place … old school … pixelated") it is a kit model (kit/models/
 * claw-cabinet.ts): Boingo's palette in three-step ramps, the room's 37 texels a square, a 1-texel ink outline, baked light; this
 * file only places it and poses its moving parts from the play (claw/view.ts `clawPose`: it only ever shows the server's answer).
 *
 * Units here: room squares (x across, z along the rows, 0 at the back wall, larger toward the camera) and lift (squares up).
 */
import { newPt, type Pt } from "../camera.ts";
import { CHUTE, PILE, pickCrate, type ClawPose } from "../../claw/view.ts";
import { drawModel, type Place } from "../kit/draw.ts";
import type { Shape, V3 } from "../kit/prims.ts";
import { CLAW_CABINET, CLAW_W, CLAW_Y, inX, inZ } from "../kit/models/claw-cabinet.ts";

/** The cabinet's box in the room (its squares' edges, a little inside them) and its heights. */
export interface Cabinet {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
/** Heights (squares up): the base's top (the glass's floor), the glass's top, the marquee's top; the gantry under the glass's top. */
export const CAB_H = { base: 1.05, glass: 2.35, top: 2.8, gantry: 2.2, crate: 0.3, coinY: 0.66 } as const;

/** The cabinet over a piece covering `w` x `d` squares from (col, row) (row its south-most). */
export function cabinetOf(col: number, row: number, w: number, d: number): Cabinet {
  return { x0: col - 0.5 + 0.1, x1: col + w - 0.5 - 0.1, z0: row - d + 0.5 + 0.1, z1: row + 0.5 - 0.1 };
}

/** The coin slot on the base's front (the right half), in room units: its middle across, and half its width and height. */
export const slotOf = (c: Cabinet) => ({ x: c.x0 + (c.x1 - c.x0) * 0.52, hw: 0.08, y: CAB_H.coinY, hh: 0.11 });

/** A point projector the room gives: (x, z, lift) to the screen, false if it's behind the camera. */
export type P3 = (x: number, z: number, y: number, out: Pt) => boolean;

/** What the room needs back after drawing: the coin slot's box on screen (for a tap). */
export interface CabinetHits {
  slot: { x0: number; y0: number; x1: number; y1: number; on: boolean };
}
export const newHits = (): CabinetHits => ({ slot: { x0: 0, y0: 0, x1: 0, y1: 0, on: false } });

const SQ = 37;
const Q = [newPt(), newPt()];
/** A shape that only moves with the view (no part, or a crate on the pile, the won crate in the tray: their changes are in the key). */
const still = (s: Shape) => !s.part || s.part.startsWith("pile") || s.part === "tray";
/** The cached pictures of the still parts, the view they were made for, and the view last frame. */
const cache = { back: null as HTMLCanvasElement | null, front: null as HTMLCanvasElement | null, key: "" };
let last = "";
const K = newPt();
/** The view: where three of the model's corners land on screen, the pile, the tray, the canvas's size. */
function viewKey(p3: (x: number, y: number, l: number, out: Pt) => boolean, at: Place, took: number, tray: boolean, cv: HTMLCanvasElement): string {
  let k = `${took}|${tray}|${cv.width}x${cv.height}`;
  for (const [x, y, l] of [[0, 0, 0], [1, 0, 0], [0, 1, 1]]) k += p3(at.x + x!, at.y + y!, l!, K) ? `|${K.x.toFixed(2)},${K.y.toFixed(2)}` : "|-";
  return k;
}
/** Draws into a canvas the size of `like` (made or resized and cleared first). */
function paint(which: "back" | "front", like: HTMLCanvasElement, draw: (g: CanvasRenderingContext2D) => void): void {
  const c = (cache[which] ??= document.createElement("canvas"));
  if (c.width !== like.width || c.height !== like.height) ((c.width = like.width), (c.height = like.height));
  const g = c.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  draw(g);
}
/** A cached picture over the room's canvas, pixel for pixel. */
function blit(g: CanvasRenderingContext2D, cv: HTMLCanvasElement | null): void {
  if (!cv) return;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.drawImage(cv, 0, 0);
  g.restore();
}
/** The parts' offsets this frame (texels), reused. */
const move: Record<string, V3> = {};
const shown = new Set<string>();

/**
 * Draws the cabinet `c` with its claw at `pose` through the room's camera (`p3`; the room's context `g` at `dpr`); `now` for the
 * sign's chase and the arrow's bob. Fills `hits` (the coin slot's box on screen). Every offset is whole texels: the claw steps
 * across the grid as the sprites do.
 */
export function drawCabinet(g: CanvasRenderingContext2D, p3: P3, _camX: number, c: Cabinet, pose: ClawPose, now: number, hits: CabinetHits, arrow = false, dpr = 1): void {
  // Its front's left foot, the model centered on the cabinet's box, its front on the box's front (toward the camera).
  const at: Place = { x: (c.x0 + c.x1) / 2 - CLAW_W / SQ / 2, y: -c.z1, lift: 0, ux: 1, uy: 0, bx: 0, by: 1, px: SQ };
  const x = Math.round(inX(pose.x));
  const z = Math.round(inZ(pose.z));
  const d = Math.round(pose.down * CLAW_Y.reach);
  shown.clear();
  const set = (part: string, v: V3) => ((move[part] = v), shown.add(part));
  set("claw", [x, z, 0]);
  set("bridge", [x, 0, 0]);
  set("head", [x, z, -d]);
  set(pose.open > 0.7 ? "prong-open" : pose.open > 0.2 ? "prong-half" : "prong-shut", [x, z, -d]);
  for (let k = 0; k <= 4; k++) if (k === 0 || d >= 3 * k - 1.5) set(`cable${k}`, [x, z, 0]);
  if (pose.held) set("held", [x, z, -d]);
  const took = pose.taken ? pickCrate(pose.x, pose.z) : -1;
  for (let i = 0; i < PILE.length; i++) if (i !== took) set(`pile${i}`, [0, 0, 0]);
  if (pose.fall) {
    // Falling from where the claw let go: back onto the pile, or down the chute (to the felt, inside the chute's glass).
    const f = pose.fall;
    const from = CLAW_Y.held - Math.round(f.fromDown * CLAW_Y.reach);
    const [px, pz, l] = f.into === "pile" ? PILE[pickCrate(pose.x, pose.z)]! : [CHUTE.x, CHUTE.z, 0];
    const to = CLAW_Y.base + CLAW_Y.crate * l;
    set("fall", [Math.round(inX(px)), Math.round(inZ(pz)), Math.round(from + (to - from) * f.t)]);
  }
  if (pose.inTray) set("tray", [0, 0, 0]);
  if (pose.coin >= 0 && pose.coin < 1) set("coin", [0, 0, 26 + Math.round(13 * (1 - pose.coin))]);
  if (arrow) set("arrow", [0, 0, Math.round(1.1 * Math.sin(now / 180))]);
  // The sign's bulbs, one in three lit, stepping every 260 ms (as the walls' do).
  set(`chase${(3 - (Math.floor(now / 260) % 3)) % 3}`, [0, 0, 0]);
  const kp3 = (wx: number, wy: number, l: number, out: Pt) => p3(wx, -wy, l, out);
  const hide = (p: string) => !shown.has(p);
  // Still for a second frame running (the close-up while you play): what doesn't move is drawn from two pictures made once, the inside
  // (layers to 2) and the glass and front (layers 3 and 4), the moving parts live between them. Otherwise the whole model, live.
  const key = viewKey(kp3, at, took, pose.inTray, g.canvas);
  const steady = key === last;
  last = key;
  if (!steady) drawModel(g, CLAW_CABINET, at, kp3, { dpr, move, hide });
  else {
    if (cache.key !== key) {
      cache.key = key;
      paint("back", g.canvas, (c) => drawModel(c, CLAW_CABINET, at, kp3, { dpr, move, hide, pick: (s, l) => l < 3 && still(s) }));
      paint("front", g.canvas, (c) => drawModel(c, CLAW_CABINET, at, kp3, { dpr, move, hide, pick: (s, l) => l >= 3 && l < 5 && still(s) }));
    }
    blit(g, cache.back);
    drawModel(g, CLAW_CABINET, at, kp3, { dpr, move, hide, pick: (s, l) => l < 3 && !still(s) });
    blit(g, cache.front);
    drawModel(g, CLAW_CABINET, at, kp3, { dpr, move, hide, pick: (s, l) => l >= 5 || (l >= 3 && !still(s)) });
  }
  // The coin slot's box on screen (the tap target).
  const sl = slotOf(c);
  hits.slot.on = false;
  if (p3(sl.x - sl.hw, c.z1, sl.y + sl.hh, Q[0]!) && p3(sl.x + sl.hw, c.z1, sl.y - sl.hh, Q[1]!)) {
    hits.slot.x0 = Q[0]!.x;
    hits.slot.y0 = Q[0]!.y;
    hits.slot.x1 = Q[1]!.x;
    hits.slot.y1 = Q[1]!.y;
    hits.slot.on = true;
  }
}
