import { account } from "../account.ts";
import { TOWN_ASKED } from "../test-switches.ts";

/**
 * Whether this is an admin's town (Nov 3): the homes and kids of the bosses in the game for admins first (core's BOSS_ADMIN_FIRST:
 * Timber's Lumber Lodge and Rivet) are in an admin's town only, as their boss is only on an admin's boss select. Read once, as
 * the town's code first loads (TownPage waits for your account before loading it), so the world is fixed while you're in it: an
 * admin who signs in or out on the way sees the change on the next load. Taking a boss out of BOSS_ADMIN_FIRST puts its home in
 * everyone's town.
 */
export const ADMIN_TOWN: boolean = !!account().profile?.admin;
/** Whether this browser can give a WebGL 2 context (a throwaway canvas's, let go at once). False where there's no page (Node). */
export function hasWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
/**
 * Whether this town is the street town (Nov 5, round 2: the layout; town-plan-nov5.json, street.ts): an admin's only, so Eric can
 * walk it while everyone else keeps today's town. Drawn with WebGL 2 only (Nov 6): a device without it gets today's town, and so does
 * a page the street town left (`?street=off`: its WebGL failed or its context was lost for good; Town.tsx). Read once, as ADMIN_TOWN is.
 */
export const STREET_TOWN: boolean = ADMIN_TOWN && !TOWN_ASKED.streetOff && hasWebGL2();
/** An admin's device that has no WebGL 2, so it got today's town (reported once a page: Town.tsx). */
export const NO_WEBGL_STREET: boolean = ADMIN_TOWN && !TOWN_ASKED.streetOff && !STREET_TOWN;
