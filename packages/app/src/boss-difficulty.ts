import { BOSS_DIFFICULTY, type BossDifficultyId } from "@chessroyale/core";

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
