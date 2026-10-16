import { BOSS_ROSTER, bossDef, bossInText } from "./boss.ts";

/**
 * Kill switches (docs/areas/ops.md, "Kill switches"): parts of the game Eric can rest for a while from the Cloudflare
 * dashboard, each with a Worker runtime variable `PAUSE_<NAME>` (the server reads them: kill-switches.ts). While one is
 * resting, the app hides or disables its way in with its line below, and the server refuses new matches (or sales) for
 * it; matches already running finish normally.
 *   - "classic", "crowd", "raid", "squads": that mode online (its queue, new lobbies and parties);
 *   - "ranked1v1": 1 v 1 (PAUSE_RANKED1V1): its queue and new games (the bot game is reached only from the queue);
 *   - "solo": Solo and Boss alone (played in the browser: only the app can stop them);
 *   - "shop": the shop and crates (getting items, opening crates; your locker stays);
 *   - "friends": friends;
 *   - "boss:<id>": one boss (PAUSE_BOSS_<ID>): never met, at random or picked.
 */
export const PAUSABLE = ["classic", "crowd", "raid", "squads", "ranked1v1", "solo", "shop", "friends"] as const;
export type Pausable = (typeof PAUSABLE)[number] | `boss:${string}`;

/** Every switch there is: the parts above, then one per boss in the roster. */
export const allPausable = (): Pausable[] => [...PAUSABLE, ...BOSS_ROSTER.map((b) => `boss:${b.id}` as const)];

/** Its Worker variable: PAUSE_SQUADS, PAUSE_BOSS_PIG, … (a boss's id in capitals, anything but letters and digits as _). */
export const pauseVariable = (what: Pausable): string =>
  `PAUSE_${what.startsWith("boss:") ? `BOSS_${what.slice(5)}` : what}`.toUpperCase().replace(/[^A-Z0-9_]/g, "_");

const NAMES: Record<(typeof PAUSABLE)[number], string> = {
  classic: "Classic is",
  crowd: "Crowd is",
  raid: "Boss raids are",
  squads: "Squads is",
  ranked1v1: "1 v 1 is",
  solo: "Solo and Boss alone are",
  shop: "The shop is",
  friends: "Friends are",
};

/** The short friendly line for a part that's resting: on its way in (the app), and in the server's refusal. */
export function pausedLine(what: Pausable): string {
  // (A boss as a sentence says him: "The Hidden Boss is …", "Wrangler is …"; bossInText.)
  const boss = what.startsWith("boss:") ? bossDef(what.slice(5)) : null;
  const who = what.startsWith("boss:") ? `${boss ? bossInText(boss.name, true) : "This boss"} is` : (NAMES[what as keyof typeof NAMES] ?? "This is");
  return `${who} resting for a bit. Back soon.`;
}

/** The bosses resting, from a list of switches that are off (their ids). */
export const bossesOff = (paused: readonly string[]): string[] => paused.filter((p) => p.startsWith("boss:")).map((p) => p.slice(5));
