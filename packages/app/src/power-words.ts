import type { BossDef, PowerId } from "@chessroyale/core";

/**
 * Each boss power in a few words, for the boss menu's cards ("freezes a piece · blizzard"). Keyed by every power there
 * is, so a new power without its words doesn't compile (Hollow's card read "undefined · undefined" when it was a plain
 * string table).
 */
export const POWER_WORDS: Record<PowerId, string> = {
  freeze: "freezes a piece",
  blizzard: "blizzard",
  pie: "pies a square",
  funhouse: "funhouse",
  sparkler: "sets squares alight",
  candle: "Roman candle",
  dark: "darkens a square",
  lightsout: "lights out",
};

/** A boss's card line for its powers: its passive, then its ultimate; empty for a boss without powers yet. */
export function powersLine(boss: Pick<BossDef, "powers">): string {
  return boss.powers ? `${POWER_WORDS[boss.powers.passive]} · ${POWER_WORDS[boss.powers.ultimate]}` : "";
}
