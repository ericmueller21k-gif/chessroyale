/**
 * The Battle Tower's lobby as a scene (Nov 19): only its side walls, each one surface (side-walls.ts), as the walk-up's hall's are. Loaded
 * with the room, given to it as its `fx` (Town.tsx).
 */
import { SHOP_TOWER_N, SHOP_TOWER_SIDE_WALL_GRID, SHOP_TOWER_WALL_H } from "./tower-art.ts";
import type { RoomFx } from "./ShopRoom.tsx";
import { sideWalls } from "./side-walls.ts";

const walls = { z: 0.01, draw: sideWalls(SHOP_TOWER_SIDE_WALL_GRID, SHOP_TOWER_N, SHOP_TOWER_WALL_H) };
/** The lobby's scene: its two side walls. */
export const TOWER_LOBBY_FX: RoomFx = { figures: () => [walls] };
