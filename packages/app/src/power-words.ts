import type { BossDef, PowerId } from "@chessroyale/core";

/**
 * Each boss power in a few words, for the boss menu's cards ("freezes a piece · Blizzard"): a power's name in Title Case
 * as everywhere (Freeze, Big Bounce, Lights Out), what it does in lower case. Keyed by every power there
 * is, so a new power without its words doesn't compile (Hollow's card read "undefined · undefined" when it was a plain
 * string table).
 */
export const POWER_WORDS: Record<PowerId, string> = {
  freeze: "freezes a piece",
  blizzard: "Blizzard",
  pie: "pies a square",
  funhouse: "Funhouse",
  sparkler: "sets squares alight",
  candle: "Roman Candle",
  dark: "darkens a square",
  lightsout: "Lights Out",
  blocks: "eats a pawn, Toy Blocks",
  bounce: "Big Bounce",
  cuts: "splits a pawn, Saw Cuts",
  boardsaw: "Board Saw",
  drag: "lassos your pieces",
  showdown: "Showdown",
  nohelp: "no God King help",
  bullet: "Bullet",
  tusks: "fuses two pawns into an elephant",
  slam: "Mammoth Slam",
};

/** A boss's card line for its powers: its passive, then its ultimate; empty for a boss without powers yet. */
export function powersLine(boss: Pick<BossDef, "powers">): string {
  return boss.powers ? `${POWER_WORDS[boss.powers.passive]} · ${POWER_WORDS[boss.powers.ultimate]}` : "";
}
