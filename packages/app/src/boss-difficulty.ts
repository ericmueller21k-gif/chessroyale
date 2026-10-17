import { BOSS_DIFFICULTY, bossStrength, raidBossElo, type BossDef, type BossDifficultyId } from "@chessroyale/core";

/**
 * Solo's difficulty against a boss (next to the boss picker): Easy, Normal (your strength), Hard or Hardest, Elo on
 * top of the boss's usual strength (BOSS_DIFFICULTY), capped at the engine's strongest. Which boss you meet doesn't
 * change. Remembered on this device.
 */
const KEY = "brc.bossDifficulty";
let picked: BossDifficultyId | null = null;

const known = (v: unknown): v is BossDifficultyId => BOSS_DIFFICULTY.some((d) => d.id === v);

/** The difficulty last chosen on this device (Normal at first). */
export function chosenDifficulty(): BossDifficultyId {
  if (picked) return picked;
  try {
    const v = localStorage.getItem(KEY);
    if (known(v)) return v;
  } catch {
    // No storage.
  }
  return "normal";
}

export function rememberDifficulty(id: BossDifficultyId) {
  if (!known(id)) return;
  picked = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Not important.
  }
}

/** Its Elo on top of the boss's strength (Easy −300 … Hardest +500). */
export function difficultyElo(id: BossDifficultyId = chosenDifficulty()): number {
  return BOSS_DIFFICULTY.find((d) => d.id === id)?.elo ?? 0;
}

/** A difficulty's name on screen ("Hard"). */
export function difficultyLabel(id: BossDifficultyId): string {
  return BOSS_DIFFICULTY.find((d) => d.id === id)?.label ?? "Normal";
}

/**
 * Boss alone's strength for a boss, as the battle gets it (App's `overridesFromUrl`): a step above your rating, plus
 * the boss's offset, plus your difficulty. The one number shown for a boss before Boss alone, on the Boss raid screen's
 * stage and in Boss alone's menu alike, so the two never disagree (docs/decisions/2026-10-17-boss-sheet-fit.md).
 */
export function bossAloneElo(rating: number | null, def: Pick<BossDef, "offset" | "id">, id: BossDifficultyId = chosenDifficulty()): number {
  return bossStrength(raidBossElo([rating]), def, difficultyElo(id));
}
