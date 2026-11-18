/**
 * Chandy's figure in the town (his home's out front, and in its swamp): his approved drawing (chandy.ts) at rest, his rifle slung, in
 * his own frame without the room on its right his board figure keeps for the rifle held out level (FIRE_ROOM). The town draws a boss's
 * `idle` only.
 */
import { CHANDY, FIRE_ROOM } from "./chandy.ts";
import type { Character } from "./sprite.ts";

export const CHANDY_TOWN: Character = {
  ...CHANDY,
  id: "chandy-town",
  w: CHANDY.w - FIRE_ROOM,
  anims: { idle: CHANDY.anims.idle! },
};
