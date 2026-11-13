/**
 * The walk-up's hall and landing as scenes (Nov 13): only their side walls, each one surface (side-walls.ts), as his room's are (Eric:
 * "build the walls in the room like we did for his room"). Loaded with the rooms, given to the room as its `fx` (Town.tsx).
 */
import { RECLUSE_HALL_N, RECLUSE_STAIRS_WALL_H, stairsSideWallGrid } from "./recluse-stairs-art.ts";
import type { RoomFx } from "./ShopRoom.tsx";
import { sideWalls } from "./side-walls.ts";

const walls = { z: 0.01, draw: sideWalls(stairsSideWallGrid, RECLUSE_HALL_N, RECLUSE_STAIRS_WALL_H) };
/** The hall's and the landing's scene: their two side walls (the same walls in both). */
export const RECLUSE_STAIRS_FX: RoomFx = { figures: () => [walls] };
