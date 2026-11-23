/**
 * This Worker instance's answers to "is this session's (or this marked browser's) account banned?", for the ban gate (ban-gate.ts),
 * each kept FAIRPLAY.banCheckMs. A leaf module (no imports), so fair play's setCase can forget an account's answers the moment it
 * bans or lifts it: a ban made on this instance counts here at once, one made on another within FAIRPLAY.banCheckMs.
 */

export interface BanCheck {
  /** The account the answer is about (null: a session that's unknown or ended). */
  userId: string | null;
  banned: boolean;
  until: number;
}

const MAX = 50_000;
const checks = new Map<string, BanCheck>();

/** A kept answer still in time, or null. Keys: `s:<session token>` and `m:<marked account id>`. */
export function cachedBanCheck(key: string, now: number): BanCheck | null {
  const hit = checks.get(key);
  if (!hit) return null;
  if (hit.until > now) return hit;
  checks.delete(key);
  return null;
}

export function keepBanCheck(key: string, check: BanCheck): void {
  if (checks.size >= MAX) checks.delete(checks.keys().next().value!);
  checks.set(key, check);
}

export function forgetBanCheck(key: string): void {
  checks.delete(key);
}

/** An account banned or lifted on this instance: every answer about it goes, so the next request reads the case again. */
export function forgetBanChecks(userId: string): void {
  for (const [key, check] of checks) if (check.userId === userId) checks.delete(key);
}
