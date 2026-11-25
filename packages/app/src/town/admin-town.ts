import { account } from "../account.ts";

/**
 * Whether this is an admin's town (Nov 3): the homes and kids of the bosses in the game for admins first (core's BOSS_ADMIN_FIRST:
 * Timber's Lumber Lodge and Rivet) are in an admin's town only, as their boss is only on an admin's boss select. Read once, as
 * the town's code first loads (TownPage waits for your account before loading it), so the world is fixed while you're in it: an
 * admin who signs in or out on the way sees the change on the next load. Taking a boss out of BOSS_ADMIN_FIRST puts its home in
 * everyone's town. (The town itself is the street town for everyone since Nov 13, admins or not: the old Canvas 2D town is gone.)
 */
export const ADMIN_TOWN: boolean = !!account().profile?.admin;
