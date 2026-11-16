/**
 * The street town's boxes' roofs, made ready to draw (Nov 5, code round 3; boxes.ts has the geometry and the frame's plan, render.ts
 * draws it). Each roof face is painted once, top-down in its own plane at the art's 37 px a square, through the 3D art kit (kit/bake.ts,
 * Nov 6): its tile (town-kit.ts ROOF_TILES in the box's roof palette, or a hedge's own top), lit as a step of the palette's ramps
 * quantized from n . L (the light stays with the camera, so a box gets one painting for the camera facing north and one for east,
 * and a turn blends the two), its ink edge round it (not a dome's or a vault's own seams) and a flat roof's light parapet rim: every
 * pixel a palette color. A face is kept whole, for when it's drawn in one piece, and in triangles (a fan from its first
 * corner, each a pixel over its shared edges so no seam opens), for when its perspective needs them. A box's pieces are packed into a
 * sheet or two (so WebGL's atlas holds a few big pictures, not hundreds of small ones).
 *
 * Painting a box is a few milliseconds: render.ts does it ahead, a little a frame, nearest first (`TOWN_FEEL.boxBakeMs`).
 */
import { frameKeys, type Character } from "../characters/sprite.ts";
import { faceStep, geomOf, worldNormal, type BoxInst, type FaceGeom } from "./boxes.ts";
import { rampsOf, type Ramps } from "./kit/bake.ts";
import { faceCuts, packFaces, type FaceArt, type Piece } from "./kit/draw.ts";
import { roofTile, type TownBox } from "./town-kit.ts";

export type { FaceArt, Piece };
/** A box's roof painted for one heading. */
export interface RoofArt {
  faces: FaceArt[];
}

/** A flat roof's parapet rim (the trim's light cream, BASE.g), a palette color under its own key. */
const RIM = "#f7f1e3";
export const RIM_KEY = "%";

/** A tile's palette keys (37 x 37, or a box's own: a run of hedge's tops side by side) and its palette's ramps, by tile and palette. */
export interface Tile {
  w: number;
  h: number;
  keys: (string | null)[][];
  ramps: Ramps;
}
const tiles = new Map<string, Tile>();
export function tileOf(box: TownBox, tex: FaceGeom["tex"], own: Character | null): Tile {
  const key = own ? `own:${own.id}` : `${box.id}:${tex}`;
  let t = tiles.get(key);
  if (!t) {
    const ch = own ?? roofTile(tex, { ...box.roofPal }, `${tex}-${box.id}`);
    t = { w: ch.w, h: ch.h, keys: frameKeys(ch, ch.anims.idle!.frames[0]!), ramps: rampsOf({ ...ch.palette, [RIM_KEY]: RIM }) };
    tiles.set(key, t);
  }
  return t;
}
/** A face's texel: its tile's key at texture point (X, Y), the tile's rows along the face's first edge (u) or across it (t). */
export const tileTexel = (fg: FaceGeom, tile: Tile) => (X: number, Y: number): string | null => {
  const a = fg.rows === "u" ? X : Y;
  const b = fg.rows === "u" ? Y : X;
  return tile.keys[((b % tile.h) + tile.h) % tile.h]![((a % tile.w) + tile.w) % tile.w] ?? "k";
};

/**
 * Box `b`'s roof (its art `box`), painted for the camera facing quarter `q` (0 north, 1 east, 2 south, 3 west): every face, whole and
 * in triangles, packed into sheets.
 */
export function bakeRoof(b: BoxInst, box: TownBox, q: number): RoofArt {
  // (The camera's quarter: 0 north, 1 east, 2 south, 3 west; its heading's cosine and sine.)
  const hc = [1, 0, -1, 0][q & 3]!;
  const hs = [0, 1, 0, -1][q & 3]!;
  const g = geomOf(box);
  const n = { x: 0, y: 0 };
  // (Every face's pieces packed together into a sheet or two: WebGL's atlas holds a few big pictures, not hundreds of small ones.)
  return {
    faces: packFaces(
      g.faces.map((fg) => {
        worldNormal(b, fg.nx, fg.ny, n);
        const tile = tileOf(box, fg.tex, b.tile);
        return faceCuts(fg, tileTexel(fg, tile), tile.ramps, faceStep(n.x, n.y, fg.nz, hc, hs), { soft: fg.soft, rim: fg.rim ? RIM_KEY : undefined });
      }),
    ),
  };
}
