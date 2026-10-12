import { BOSS_BRAIN, BOSS_BRAINS, type BossBrain } from "@chessroyale/core";
import { account } from "./account.ts";

/**
 * Testing, admins only: the boss's brain in Boss alone (the Brain picker in the boss menu, or ?brain=<id>), "" for
 * each boss's own (BOSS_BRAIN: every boss on Maia, no guard, the bridge band, Stockfish at the top). Remembered on
 * this device.
 */
const KEY = "brc.bossBrain";
const known = (v: unknown): v is BossBrain => (BOSS_BRAINS as readonly unknown[]).includes(v);

export const BRAIN_LABELS: Record<BossBrain, string> = {
  stockfish: "Stockfish",
  "maia-raw": "Maia, no guard",
  "maia-light": "Maia, light guard",
  "maia-full": "Maia, full guard",
  "maia-strict": "Maia, strict guard",
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
 * Whether this device may run Maia at all: an admin's (Maia on every boss, Eric, Oct 12); a player's only once the
 * Maia brain is on for players (BOSS_BRAIN.forPlayers). A player's device never downloads it before that.
 */
export const maiaAllowed = () => BOSS_BRAIN.forPlayers || isAdmin();

/**
 * The brain a solo boss battle asks for: an admin's pick in Boss alone (`bossAlone`; elsewhere each boss's own), and
 * whether Maia may play here.
 */
export function soloBrain(bossAlone: boolean): { picked: BossBrain | ""; maia: boolean } {
  return { picked: bossAlone && isAdmin() ? pickedBrain() : "", maia: maiaAllowed() };
}

/** Whether a Boss alone battle at one of these strengths could use Maia (to fetch its files ahead). */
export function maiaLikely(strengths: readonly number[]): boolean {
  const { picked, maia } = soloBrain(true);
  return maia && picked !== "stockfish" && strengths.some((s) => s < BOSS_BRAIN.stockfishFrom);
}
