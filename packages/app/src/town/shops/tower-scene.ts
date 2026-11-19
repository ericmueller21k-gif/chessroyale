/**
 * The Battle Tower's lobby as a scene (Nov 19): its side walls, each one surface (side-walls.ts), as the walk-up's hall's are; and (PR 11b)
 * your best floor written on the "Best floors" board (solo), once the clerk's card or the tower has read it. Loaded with the room, given to
 * it as its `fx` (Town.tsx).
 */
import { SHOP_TOWER_N, SHOP_TOWER_SIDE_WALL_GRID, SHOP_TOWER_WALL_H } from "./tower-art.ts";
import type { RoomFx } from "./ShopRoom.tsx";
import { sideWalls } from "./side-walls.ts";

const walls = { z: 0.01, draw: sideWalls(SHOP_TOWER_SIDE_WALL_GRID, SHOP_TOWER_N, SHOP_TOWER_WALL_H) };
const list = [walls];
/** The board's lines for a best (null: not read yet, nothing written). */
export const bestLines = (best: number | null): readonly string[] | null => (best === null ? null : ["SOLO", best > 0 ? `FLOOR ${best}` : "NONE YET"]);
/** The lobby's scene: its two side walls, and your best on the board (`best`: as last read, or null). */
export function towerLobbyFx(best: () => number | null): RoomFx {
  let was: number | null = null;
  let lines: readonly string[] | null = null;
  return {
    figures: () => list,
    signBody: () => {
      const b = best();
      if (b !== was || (b !== null && !lines)) [was, lines] = [b, bestLines(b)];
      return lines;
    },
  };
}
