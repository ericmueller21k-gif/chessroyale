/**
 * A box room's side walls, each drawn as ONE surface (Nov 13, Eric on the Hidden Boss's room: "one long thing that actually makes it look
 * like a 3D room"; then on the walk-up's hall and landing: "build the walls in the room like we did for his room"), not a row of cards
 * seen edge on. The room's layout keeps those squares solid with blank pieces; its scene (`RoomFx`) draws each wall from the back wall's
 * corner forward past the camera: its foot along the floor's edge, its top `wallH` room pixels over the foot as every upright thing is,
 * in thin affine slices, each its strip of the wall's picture (about 70 drawImage calls a wall). Each picture is made once.
 */
import { proj, newPt } from "../camera.ts";
import type { FxDraw } from "./ShopRoom.tsx";

const SQ = 37;
const STRIPS = 72;

/** A wall's picture as the art gives it: rows of palette keys (`.` see-through), `run` squares long, and its palette. */
export type WallGrid = (west: boolean, run: number) => { grid: readonly string[]; palette: Readonly<Record<string, string>> };

/** The drawer of a room's two side walls: `n` squares each way, walls `wallH` room pixels tall, their pictures from `gridOf`. */
export function sideWalls(gridOf: WallGrid, n: number, wallH: number): (d: FxDraw) => void {
  const run = n + 2;
  const imgs: (HTMLCanvasElement | null)[] = [null, null];
  const img = (west: boolean): HTMLCanvasElement => {
    const i = west ? 0 : 1;
    const have = imgs[i];
    if (have) return have;
    const { grid, palette } = gridOf(west, run);
    const w = grid[0]!.length;
    const h = grid.length;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const hex = palette[grid[y]![x]!];
        if (!hex) continue;
        const o = (y * w + x) * 4;
        data[o] = parseInt(hex.slice(1, 3), 16);
        data[o + 1] = parseInt(hex.slice(3, 5), 16);
        data[o + 2] = parseInt(hex.slice(5, 7), 16);
        data[o + 3] = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) : 255;
      }
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.putImageData(new ImageData(data, w, h), 0, 0);
    return (imgs[i] = c);
  };
  const wa = newPt();
  const wb = newPt();
  const at = (d: FxDraw, c: number, r: number, out: ReturnType<typeof newPt>) => proj(d.v, c - d.camX, d.camY - r, 0, out);
  return (d: FxDraw) => {
    const g = d.g;
    g.imageSmoothingEnabled = false;
    for (const west of [true, false]) {
      const pic = img(west);
      // (The wall's face: the inner edge of its column of squares.)
      const c = west ? 0.5 : n - 1.5;
      for (let i = 0; i < STRIPS; i++) {
        const ra = (i / STRIPS) * (run - 0.01);
        const rb = ((i + 1) / STRIPS) * (run - 0.01);
        if (!at(d, c, ra, wa) || !at(d, c, rb, wb)) break;
        const ha = (wallH * wa.k) / SQ;
        const hb = (wallH * wb.k) / SQ;
        const sx = ra * SQ;
        const sw = (rb - ra) * SQ;
        const hm = (ha + hb) / 2;
        // (An affine strip: its two ends' tops, its height the two ends' mean; a hair wider so no seam shows.)
        g.save();
        g.transform((wb.x - wa.x) / sw, (wb.y - hb - (wa.y - ha)) / sw, 0, hm / wallH, wa.x, wa.y - ha - (hm - ha) / 2);
        g.drawImage(pic, sx, 0, sw, wallH, 0, 0, sw + 0.6, wallH);
        g.restore();
        if (wb.x < -50 || wb.x > d.W + 50) break;
      }
    }
  };
}
