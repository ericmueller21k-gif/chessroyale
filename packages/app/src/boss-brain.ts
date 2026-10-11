import { BOSS_BRAIN, BOSS_BRAINS, type BossBrain } from "@chessroyale/core";
import { account } from "./account.ts";

/**
 * Testing, admins only: the boss's brain in Boss alone (the Brain picker in the boss menu, or ?brain=<id>), "" for
 * each boss's own (BOSS_BRAIN.soloDefault: Ginger is Maia, no guard). Remembered on this device.
 */
const KEY = "brc.bossBrain";
const known = (v: unknown): v is BossBrain => (BOSS_BRAINS as readonly unknown[]).includes(v);

export const BRAIN_LABELS: Record<BossBrain, string> = {
  stockfish: "Stockfish",
  "maia-raw": "Maia, no guard",
  "maia-light": "Maia, light guard",
  "maia-full": "Maia, full guard",
};

export const isAdmin = () => !!account().profile?.admin;

/** The brain an admin picked ("" for the boss's own). */
export function pickedBrain(): BossBrain | "" {
  const q = new URLSearchParams(location.search).get("brain");
  if (known(q)) return q;
  try {
    const v = localStorage.getItem(KEY);
    if (known(v)) return v;
  } catch {
    // No storage.
  }
  return "";
}

export function rememberBrain(v: BossBrain | "") {
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    // Not important.
  }
}

/**
 * The brain this device's Boss alone asks for: an admin's pick (or each boss's own); a player meets each boss's own
 * only once the Maia brain is on for players (BOSS_BRAIN.forPlayers), else Stockfish as before. `maia`: whether Maia
 * may be used at all here.
 */
export function soloBrain(): { picked: BossBrain | ""; maia: boolean } {
  if (isAdmin()) return { picked: pickedBrain(), maia: true };
  return { picked: "", maia: BOSS_BRAIN.forPlayers };
}

/** Whether a Boss alone battle against this boss ("" random) could use Maia (to fetch its files ahead). */
export function maiaLikely(bossId: string): boolean {
  const { picked, maia } = soloBrain();
  if (!maia) return false;
  if (picked) return picked !== "stockfish";
  return !bossId || bossId in BOSS_BRAIN.soloDefault;
}
