/**
 * Chess Town's pictures painted from the list (pictures.ts), for the build's bake (scripts/bake-town.ts; Nov 28, the town's structure,
 * phase 1a: docs/decisions/2026-11-28-town-bake.md). Pure, no browser: the device's own painting code (paint-jobs.ts `paintSpec`, the
 * kit's `packCuts` for a roof's sheets), so a baked picture is the device's, pixel for pixel. The script runs this once a town (a
 * player's, an admin's: admin-town.ts), packs the pictures into each group's pages and writes the files and their manifest.
 */
import { solidTop } from "./boxes.ts";
import type { Cut } from "./kit/bake.ts";
import { packCuts } from "./kit/draw.ts";
import { paintSpec, type GlowPixels, type Pixels } from "./paint-jobs.ts";
import { townArt, townSheets, townWants } from "./pictures.ts";

export { packPictures } from "./keep-pictures.ts";
export { ATLAS } from "./paint.ts";

/** One town's pictures and what the renderer needs beside them. */
export interface TownBake {
  /** Every picture the loading screen keeps, by name (pictures.ts `Want.name`; a roof's sheets `<roof>/<n>`), in the order it first keeps
   * them: its group and its pixels. */
  pictures: Map<string, { group: string; px: Pixels }>;
  /** The loading screen's pictures in its own order (render.ts `pics.list`, the device's canvases), by name. A name comes twice where
   * the device paints one picture twice (two boxes of one art, each with a roof of its own). */
  order: string[];
  /** Each roof painted (`roof:<box>:<painting>`): its faces, each its whole then its triangles, seven numbers a piece (its sheet, the
   * roof's `/<n>` picture; sx, sy, w, h there; ox, oy: where its texture's (0, 0) lies on the sheet). As keep-pictures.ts `Manifest.roofs`. */
  roofs: Record<string, number[][]>;
  /** Each glow (`glow:<art>`): seven numbers a piece (sx, sy, w, h on its sheet, the picture of its name; x, y in its art's pixels; 1 if
   * it flickers). None: no light, and no picture. As `Manifest.glows`. */
  glows: Record<string, number[]>;
  /** Each animated art's frames' times (ms a frame, as drawn: render.ts FrameCache holds each at least 16), by the art's id. */
  anims: Record<string, number[]>;
  /** Each box's solid top (boxes.ts `solidTop`), by its art's id. */
  tops: Record<string, number>;
  /** The sidekicks' sheets this town shows, by name (pictures.ts `townSheets`: each a picture file as it is, sidekicks/<name>.png). */
  sheets: string[];
}

const samePixels = (a: Pixels, b: Pixels): boolean => a.w === b.w && a.h === b.h && a.data.length === b.data.length && a.data.every((v, i) => v === b.data[i]);

/** Paints this town's list. Throws if one name comes with two different pictures or numbers (a name must mean one thing, in every town). */
export function bakeList(): TownBake {
  const art = townArt();
  const pictures: TownBake["pictures"] = new Map();
  const order: string[] = [];
  const roofs: TownBake["roofs"] = {};
  const glows: TownBake["glows"] = {};
  const anims: TownBake["anims"] = {};
  const tops: TownBake["tops"] = {};
  const put = (name: string, group: string, px: Pixels) => {
    const had = pictures.get(name);
    if (!had) pictures.set(name, { group, px });
    else if (!samePixels(had.px, px)) throw new Error(`town bake: two different pictures named "${name}"`);
    order.push(name);
  };
  const note = <T>(rec: Record<string, T>, what: string, key: string, v: T) => {
    if (key in rec && JSON.stringify(rec[key]) !== JSON.stringify(v)) throw new Error(`town bake: two different ${what} named "${key}"`);
    rec[key] = v;
  };
  for (const w of townWants(art)) {
    // (A frame or a roof the device has already: nothing painted, nothing new kept.)
    if ((w.kind === "frame" || w.kind === "roof") && !w.fresh) continue;
    const out = paintSpec(w.spec);
    if (w.kind === "roof") {
      const cuts = out as Cut[][];
      const { sheets, at } = packCuts(cuts.flat());
      let k = 0;
      const faces = cuts.map((c) => c.flatMap(() => {
        const p = at[k++]!;
        return [p.sheet, p.sx, p.sy, p.w, p.h, p.ox, p.oy];
      }));
      note(roofs, "roofs", w.name, faces);
      // (Its sheets in the order the device keeps them: as its faces' pieces come to them, a face's whole then its triangles.)
      const seen = new Set<number>();
      for (const f of faces)
        for (let j = 0; j < f.length; j += 7)
          if (!seen.has(f[j]!)) {
            seen.add(f[j]!);
            put(`${w.name}/${f[j]!}`, w.group, sheets[f[j]!]!);
          }
    } else if (w.kind === "glow") {
      const g = out as GlowPixels;
      note(glows, "glows", w.name, g.pieces);
      if (g.sheet) put(w.name, w.group, g.sheet);
    } else {
      put(w.name, w.group, out as Pixels);
      if (w.kind === "frame") note(anims, "animations", w.cache.ch.id, w.cache.ch.anims.idle!.frames.map((f) => f.ms));
    }
  }
  for (const b of art.boxes) note(tops, "box tops", b.box.id, solidTop(b.box));
  return { pictures, order, roofs, glows, anims, tops, sheets: townSheets() };
}
