/**
 * Chess Town's pictures as pure pixel work (Nov 23): what each picture is painted from, with no canvas. The build's bake runs it in
 * Node (bake.ts, scripts/bake-town.ts: Nov 28, the town's structure, phase 1), and the device loads what it made; render.ts still calls
 * it for the few pictures not on the town's list (a frame painted the first time it's drawn). Until phase 1c the device painted the
 * whole list with it, in paint workers too. docs/decisions/2026-11-28-town-no-device-painting.md.
 */
import { frameKeys, renderFrame, type Character } from "../characters/sprite.ts";
import { TOWN_FEEL } from "./feel.ts";
import type { LightPool, LightSpot } from "./houses/kit.ts";
import { ATLAS } from "./paint.ts";
import { stepChar } from "./kit/bake.ts";
import type { Cut } from "./kit/bake.ts";
import { roofCuts } from "./box-draw.ts";
import type { RoofBox, RoofInst } from "./box-geom.ts";

/** A picture's pixels, ImageData-shaped. */
export interface Pixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** A character's idle frame `i` as pixels (render.ts FrameCache: a frame's canvas holds exactly these). */
export function framePixels(ch: Character, i: number): Pixels {
  return renderFrame(ch, ch.anims.idle!.frames[i]!);
}

/**
 * One picture to paint: a character's frame `k` (or one ramp step darker, as render.ts's FrameCache `dark`), or a box's roof for the
 * camera's quarter `q` (box-draw.ts `bakeRoof`: its pixels here, packed onto sheets on the main thread).
 */
export type PaintSpec =
  | { kind: "frame"; ch: Character; k: number; dark: boolean }
  | { kind: "roof"; b: RoofOf; q: number }
  | { kind: "glow"; ch: Character; spots: readonly LightSpot[]; pools: readonly LightPool[] };
/** What a roof is painted from: the box and its art, as much as box-draw.ts `roofCuts` reads (box-geom.ts). */
export type RoofOf = RoofInst & { box: RoofBox };
/** A frame's pixels, a roof's faces' cuts, or a glow's sheet and pieces. */
export type Painted = Pixels | Cut[][] | GlowPixels;

/** Paints one picture. */
export function paintSpec(s: PaintSpec): Painted {
  if (s.kind === "frame") return framePixels(s.dark ? stepChar(s.ch, -1) : s.ch, s.k);
  if (s.kind === "glow") return glowPixels(s.ch, s.spots, s.pools);
  return roofCuts(s.b, s.b.box, s.q);
}

// ---- The lights' glows (Nov 26: here from render.ts, pure pixel work as the rest).

/**
 * A picture's lights at dusk and night (houses/kit.ts LightSpot, LightPool), baked: each spot's lit pixels warm and bright with the glow
 * spilling round them (and a lantern's halo), each pool on the ground; one piece a light, only as big as it needs, all on one sheet
 * GLOW_GAP clear pixels apart (as the atlas pads a picture, so a smoothed draw of one reads the same clear pixels round it as a canvas of
 * its own did). Laid on with "lighter" (render.ts lightUp, lightT).
 */
export interface GlowPixels {
  /** The sheet (null: no piece lit anything). */
  sheet: Pixels | null;
  /** Seven numbers a piece: sx, sy, w, h on the sheet; x, y (its top left in the picture's pixels); 1 if it flickers. */
  pieces: number[];
}
/** Clear pixels between a glow's pieces on its sheet: the atlas's own padding round a picture. */
export const GLOW_GAP = ATLAS.pad;
const rgbOf = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const;
const bandAt = (bands: readonly (readonly [number, number])[], d: number) => {
  for (const [to, a] of bands) if (d <= to) return a;
  return 0;
};
type AddLight = (x: number, y: number, rgb: readonly number[], a: number) => void;
export function glowPixels(ch: Character, spots: readonly LightSpot[], pools: readonly LightPool[]): GlowPixels {
  const f = TOWN_FEEL;
  const spill = Math.ceil(f.lightSpill[f.lightSpill.length - 1]![0]);
  const keys = frameKeys(ch, ch.anims.idle!.frames[0]!);
  /** Each piece's light as worked out (r, g, b, premultiplied), before it goes on the glow's one sheet. */
  const made: { x0: number; y0: number; w: number; h: number; flicker: boolean; A: Float32Array }[] = [];
  /** A piece over (x0, y0, w, h), in the picture's pixels: `fill` adds its light, pixel by pixel (r, g, b, premultiplied). */
  const piece = (x0: number, y0: number, w: number, h: number, flicker: boolean, fill: (add: AddLight) => void) => {
    const A = new Float32Array(w * h * 3);
    let any = false;
    fill((x, y, rgb, a) => {
      const X = x - x0;
      const Y = y - y0;
      if (a <= 0 || X < 0 || Y < 0 || X >= w || Y >= h) return;
      const o = (Y * w + X) * 3;
      A[o] = A[o]! + rgb[0]! * a;
      A[o + 1] = A[o + 1]! + rgb[1]! * a;
      A[o + 2] = A[o + 2]! + rgb[2]! * a;
      any = true;
    });
    if (any) made.push({ x0, y0, w, h, flicker, A });
  };
  for (const s of spots) {
    const rgb = rgbOf(s.color);
    // Its pixels (its keys in its box).
    const m = new Uint8Array(s.w * s.h);
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const k = keys[s.y + y]?.[s.x + x];
        if (!k || (s.keys !== undefined && !s.keys.includes(k))) continue;
        m[y * s.w + x] = 1;
      }
    const isLit = (x: number, y: number) => x >= s.x && y >= s.y && x < s.x + s.w && y < s.y + s.h && m[(y - s.y) * s.w + x - s.x] === 1;
    const halo = s.halo ?? 0;
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const x0 = Math.min(s.x - spill, Math.floor(cx - halo));
    const y0 = Math.min(s.y - spill, Math.floor(cy - halo));
    const x1 = Math.max(s.x + s.w + spill, Math.ceil(cx + halo) + 1);
    const y1 = Math.max(s.y + s.h + spill, Math.ceil(cy + halo) + 1);
    // How far each pixel of the piece is from the nearest lit one within `spill` across and down (squared): stamped out from the lit
    // pixels (Nov 26: the same numbers as looking round every pixel, which was 2.7 s of the loading screen for the town's 2,551 pieces).
    const PW = x1 - x0;
    const PH = y1 - y0;
    const near = new Float32Array(PW * PH).fill(Infinity);
    for (let v = s.y; v < s.y + s.h; v++)
      for (let u = s.x; u < s.x + s.w; u++) {
        if (m[(v - s.y) * s.w + u - s.x] !== 1) continue;
        for (let dy = -spill; dy <= spill; dy++) {
          const Y = v + dy - y0;
          if (Y < 0 || Y >= PH) continue;
          for (let dx = -spill; dx <= spill; dx++) {
            const X = u + dx - x0;
            if (X < 0 || X >= PW) continue;
            const d = dx * dx + dy * dy;
            if (d < near[Y * PW + X]!) near[Y * PW + X] = d;
          }
        }
      }
    piece(x0, y0, PW, PH, !!s.flicker, (add) => {
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          // Its lit pixels warm and bright; round them, the glow spilling, by how far the nearest lit one is; and its
          // halo in the air (a lantern's, a lamp's), round its box's middle.
          if (isLit(x, y)) {
            add(x, y, rgb, s.strength);
            continue;
          }
          const d2 = near[(y - y0) * PW + x - x0]!;
          if (d2 < Infinity) add(x, y, rgb, s.strength * bandAt(f.lightSpill, Math.sqrt(d2)));
          if (halo) add(x, y, rgb, s.strength * bandAt(f.lightHalo, Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / halo));
        }
    });
  }
  for (const p of pools) {
    const rgb = rgbOf(p.color);
    const x0 = Math.floor(p.x - p.rx);
    const y0 = Math.floor(p.y - p.ry);
    const x1 = Math.ceil(p.x + p.rx) + 1;
    const y1 = Math.ceil(p.y + p.ry) + 1;
    piece(x0, y0, x1 - x0, y1 - y0, false, (add) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) add(x, y, rgb, p.strength * bandAt(f.lightPool, Math.hypot((x + 0.5 - p.x) / p.rx, (y + 0.5 - p.y) / p.ry)));
    });
  }
  // The pieces on one sheet (Nov 26: a canvas each was 2,551 canvases, most of the lights' cost on the loading screen), in rows, GLOW_GAP
  // clear pixels apart (as the atlas pads each picture: a smoothed draw of one reads the same clear pixels round it).
  const G = GLOW_GAP;
  let area = 0;
  let widest = 0;
  for (const p of made) {
    const w = Math.trunc(p.w);
    area += (w + G) * (Math.trunc(p.h) + G);
    widest = Math.max(widest, w);
  }
  const rowW = Math.max(widest, Math.ceil(Math.sqrt(area)));
  const at: number[] = [];
  let cx = 0;
  let cy = 0;
  let rowH = 0;
  let sw = 0;
  for (const p of made) {
    const w = Math.trunc(p.w);
    const h = Math.trunc(p.h);
    if (cx > 0 && cx + w > rowW) ((cx = 0), (cy += rowH + G), (rowH = 0));
    at.push(cx, cy);
    sw = Math.max(sw, cx + w);
    cx += w + G;
    rowH = Math.max(rowH, h);
  }
  const pieces: number[] = [];
  if (!made.length) return { sheet: null, pieces };
  const W = Math.max(1, sw);
  const H = Math.max(1, cy + rowH);
  const d = new Uint8ClampedArray(W * H * 4);
  made.forEach((p, k) => {
    const { w, h, A } = p;
    const tw = Math.trunc(w);
    const th = Math.trunc(h);
    const sx = at[2 * k]!;
    const sy = at[2 * k + 1]!;
    // (As a canvas of its own had it, Nov 26: its pixels in order, tw across. Every one of the town's 2,551 matched.)
    for (let i = 0; i < w * h && i < tw * th; i++) {
      const a = Math.min(255, Math.max(A[i * 3]!, A[i * 3 + 1]!, A[i * 3 + 2]!));
      if (a <= 0) continue;
      const o = ((sy + ((i / tw) | 0)) * W + sx + (i % tw)) * 4;
      d[o] = Math.min(255, (A[i * 3]! * 255) / a);
      d[o + 1] = Math.min(255, (A[i * 3 + 1]! * 255) / a);
      d[o + 2] = Math.min(255, (A[i * 3 + 2]! * 255) / a);
      d[o + 3] = a;
    }
    pieces.push(sx, sy, tw, th, p.x0, p.y0, p.flicker ? 1 : 0);
  });
  return { sheet: { w: W, h: H, data: d }, pieces };
}
