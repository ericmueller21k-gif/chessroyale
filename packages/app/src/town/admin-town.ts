import { account } from "../account.ts";

/**
 * Whether this is an admin's town (Nov 3): the homes and kids of the bosses in the game for admins first (core's BOSS_ADMIN_FIRST:
 * Timber's Lumber Lodge and Rivet) are in an admin's town only, as their boss is only on an admin's boss select. Read once, as
 * the town's code first loads (TownPage waits for your account before loading it), so the world is fixed while you're in it: an
 * admin who signs in or out on the way sees the change on the next load. Taking a boss out of BOSS_ADMIN_FIRST puts its home in
 * everyone's town.
 */
export const ADMIN_TOWN: boolean = !!account().profile?.admin;
/**
 * Whether this town is the street town (Nov 5, round 2: the layout; town-plan-nov5.json, street.ts): an admin's only, so Eric can
 * walk it while everyone else keeps today's town. Drawn with WebGL 2 only (Nov 6). It never falls back to today's town (Nov 13): WebGL
 * failing reloads it once, then says the town couldn't load (gl-fail.ts, Town.tsx). Read once, as ADMIN_TOWN is.
 */
export const STREET_TOWN: boolean = ADMIN_TOWN;
