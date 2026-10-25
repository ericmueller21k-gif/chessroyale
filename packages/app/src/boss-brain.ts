import { BOSS_BRAIN, BOSS_BRAINS, BOSS_POWERS, type BossBrain } from "@chessroyale/core";
import { account } from "./account.ts";

/**
 * Testing, admins only: the boss's brain in Boss alone (?brain=<id>), "" for each boss's own (BOSS_BRAIN: every boss
 * on Maia, no guard, the bridge band, Stockfish at the top). (No picker in the boss menu any more, and an old pick
 * remembered on a device no longer counts: Eric, Oct 25.)
 */
const known = (v: unknown): v is BossBrain => (BOSS_BRAINS as readonly unknown[]).includes(v);

export const isAdmin = () => !!account().profile?.admin;

/**
 * Testing, admins only: the "Engine move" button (Stockfish's best move played for you) shows in Boss alone
 * (`bossAlone`: you alone against a boss, on this device) and nowhere else. Online matches never have it.
 */
export const engineMoveAllowed = (bossAlone: boolean) => BOSS_POWERS.engineMoveButton && bossAlone && isAdmin();

/** The brain an admin asked for in the link ("" for the boss's own). */
export function pickedBrain(): BossBrain | "" {
  const q = new URLSearchParams(location.search).get("brain");
  return known(q) ? q : "";
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
