import { AUTOCHESS, type AutoChessSettings } from "@chessroyale/core";

/**
 * Levels (v6, Eric Oct 20: "the board's piece limit is your level"): your level is how many pieces (not the king) you may have on
 * the board. You start at `levels.start`, get `levels.freeXp` XP free at each round's start, and may buy `levels.buyXp` XP for
 * `levels.buyXpCost` gold. XP to the next level: `levels.xpToNext` (from the start level on), and the top is `levels.max`.
 */

/** A side's level and the XP it has toward the next one. */
export interface Level {
  level: number;
  xp: number;
}

export const startLevel = (cfg: AutoChessSettings = AUTOCHESS): Level => ({ level: cfg.levels.start, xp: 0 });

/** The XP a side at this level needs to reach the next, or null at the top. */
export function xpToNext(level: number, cfg: AutoChessSettings = AUTOCHESS): number | null {
  if (level >= cfg.levels.max) return null;
  return cfg.levels.xpToNext[level - cfg.levels.start] ?? null;
}

/** Adds XP: levels go up while there is enough (the extra carries over); at the top the XP stays at 0. */
export function addXp(from: Level, xp: number, cfg: AutoChessSettings = AUTOCHESS): Level {
  let { level } = from;
  let have = from.xp + xp;
  for (let need = xpToNext(level, cfg); need !== null && have >= need; need = xpToNext(level, cfg)) {
    have -= need;
    level++;
  }
  return { level, xp: xpToNext(level, cfg) === null ? 0 : have };
}

export type XpBlock = "max" | "gold";

/** Why XP can't be bought now, or null: you are at the top level, or the gold isn't there. */
export function xpBlock(from: Level, gold: number, cfg: AutoChessSettings = AUTOCHESS): XpBlock | null {
  if (from.level >= cfg.levels.max) return "max";
  return gold < cfg.levels.buyXpCost ? "gold" : null;
}

/** Buys XP: the new level and the gold left (the caller checked `xpBlock`). */
export const buyXp = (from: Level, gold: number, cfg: AutoChessSettings = AUTOCHESS): Level & { gold: number } => ({ ...addXp(from, cfg.levels.buyXp, cfg), gold: gold - cfg.levels.buyXpCost });

export function xpWords(block: XpBlock, gold: number, cfg: AutoChessSettings = AUTOCHESS): string {
  return block === "max" ? `You are at the top level, ${cfg.levels.max}.` : `Not enough gold: ${cfg.levels.buyXp} XP cost ${cfg.levels.buyXpCost} and you have ${gold}.`;
}

/** What a level reads as: "Lv 4 · 2/4 XP", and "Lv 10 · max" at the top. */
export function levelWords(from: Level, cfg: AutoChessSettings = AUTOCHESS): string {
  const need = xpToNext(from.level, cfg);
  return need === null ? `Lv ${from.level} · max` : `Lv ${from.level} · ${from.xp}/${need} XP`;
}
