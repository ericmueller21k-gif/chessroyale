import { BOSS_ROSTER, adminFirstBosses, bossDef, isPlayable, type BossDef } from "./boss.ts";
import { BOSS_TOKENS, CLAW } from "./settings.ts";

/**
 * Boss tokens' rules (Eric, Nov 2; BOSS_TOKENS in settings.ts; docs/decisions/2026-11-02-boss-tokens.md). Pure: the server decides
 * every drop with these (server/boss-tokens.ts), with its own clock, counts and randomness, never the device's.
 */

/** A boss battle counts once it has reached BOSS_TOKENS.moves of your own moves or BOSS_TOKENS.minutes of play, win or lose. */
export const battleCounts = (b: { moves: number; ms: number }): boolean => b.moves >= BOSS_TOKENS.moves || b.ms >= BOSS_TOKENS.minutes * 60_000;

/** The rolling window, in ms. */
export const TOKEN_WINDOW_MS = BOSS_TOKENS.windowHours * 3_600_000;

/**
 * How many drops the window may already hold for a counted battle to drop one: under 1 (none yet: the first always drops), or,
 * when its roll came in under BOSS_TOKENS.chance (`lucky`), under the cap.
 */
export const dropLimit = (lucky: boolean): number => (lucky ? BOSS_TOKENS.cap : 1);

/** The rule: a counted battle drops a token, with `inWindow` drops already in the window and its roll (0 to 1). */
export const dropsToken = (inWindow: number, roll: number): boolean => inWindow < dropLimit(roll < BOSS_TOKENS.chance);

/** The bosses whose tokens drop, each as likely: every live boss (one players meet: not the Hidden Boss, not one for admins first, not resting). */
export const dropBosses = (off: readonly string[] = [], roster: readonly BossDef[] = BOSS_ROSTER): BossDef[] => roster.filter((b) => isPlayable(b) && !off.includes(b.id));

/** The bosses tokens exist for (the inventory's list, an admin's test grant): the live ones, then those in the game for admins first. */
export const tokenBosses = (roster: readonly BossDef[] = BOSS_ROSTER): BossDef[] => [...roster.filter(isPlayable), ...adminFirstBosses(roster)];
export const isTokenBoss = (id: unknown): id is string => typeof id === "string" && tokenBosses().some((b) => b.id === id);

/** The name on a boss's token: "Babur" ("Babur token"); a few say a shorter name than the boss's own (BOSS_TOKENS.shortNames). */
export const tokenBossName = (id: string): string => BOSS_TOKENS.shortNames[id] ?? bossDef(id)?.name ?? id;

/** The result screen's box: "You got a Babur token!", "You got an Alfil token!". */
export function tokenGotLine(id: string): string {
  const n = tokenBossName(id);
  return `You got ${/^[aeiou]/i.test(n) ? "an" : "a"} ${n} token!`;
}

/** The claw machine's rule (CLAW): a roll (0 to 1, the server's) under CLAW.winChance wins that boss's crate. */
export const clawWins = (roll: number): boolean => roll < CLAW.winChance;

/** The claw machine's win line: "You won Folio's Boss Crate!". */
export const clawWonLine = (crateName: string): string => `You won ${crateName}!`;
