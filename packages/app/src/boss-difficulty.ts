import { BOSS_BRAIN, BOSS_DIFFICULTY, bossStrength, raidBossElo, type BossDef, type BossDifficultyId } from "@chessroyale/core";

/**
 * Solo's difficulty against a boss (next to the boss picker): Very easy, Easy, Medium, Hard or Very hard (the ids stay very-easy, easy, normal, hard, hardest). In Boss alone it sets the
 * rating the boss picks its moves at (BOSS_DIFFICULTY's `maia`, whatever your rating), and Elo on top of the boss's
 * usual strength for its powers' own brains. Which boss you meet doesn't change. Remembered on this device.
 */
const KEY = "brc.bossDifficulty";
let picked: BossDifficultyId | null = null;

const known = (v: unknown): v is BossDifficultyId => BOSS_DIFFICULTY.some((d) => d.id === v);

/** The difficulty last chosen on this device (Medium, id `normal`, at first). */
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

/** Its Elo on top of the boss's strength (Very easy −500 … Very hard +500). */
export function difficultyElo(id: BossDifficultyId = chosenDifficulty()): number {
  return BOSS_DIFFICULTY.find((d) => d.id === id)?.elo ?? 0;
}

/** Boss alone's Maia rating for a difficulty (Very easy 700 … Very hard 2500): the boss picks its moves at it. */
export function difficultyMaia(id: BossDifficultyId = chosenDifficulty()): number {
  return BOSS_DIFFICULTY.find((d) => d.id === id)?.maia ?? 1400;
}

/** A difficulty's name on screen ("Hard"). */
export function difficultyLabel(id: BossDifficultyId): string {
  return BOSS_DIFFICULTY.find((d) => d.id === id)?.label ?? "Medium";
}

/**
 * Boss alone's level for a boss: the rating it picks its moves at, your difficulty's (difficultyMaia, Oct 18: whatever
 * your rating); a boss whose brain is fixed (the Hidden Boss) its fixed strength. The one number shown for a boss
 * before Boss alone, on the Boss raid screen's stage and in Boss alone's menu alike, so the two never disagree
 * (docs/decisions/2026-10-17-boss-sheet-fit.md, docs/decisions/2026-10-18-boss-alone-difficulty.md).
 */
export function bossAloneElo(rating: number | null, def: Pick<BossDef, "offset" | "id">, id: BossDifficultyId = chosenDifficulty()): number {
  return def.id && BOSS_BRAIN.fixed[def.id] ? bossStrength(raidBossElo([rating]), def, difficultyElo(id)) : difficultyMaia(id);
}
