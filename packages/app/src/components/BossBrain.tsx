import { BOSS_BRAIN, BOSS_BRAINS, type BossBrain } from "@chessroyale/core";
import { BRAIN_LABELS } from "../boss-brain.ts";

/**
 * Testing, admins only (Boss alone's boss menu): which brain the boss plays with. "Default" is each boss's own
 * (BOSS_BRAIN: Maia with no guard, the bridge band from bridgeFrom, Stockfish from stockfishFrom); a pick applies to
 * whichever boss you meet, at its own Maia rating, with no bridge share (Stockfish from stockfishFrom all the same).
 */
export function BossBrainPicker({ value, onChange }: { value: BossBrain | ""; onChange: (v: BossBrain | "") => void }) {
  return (
    <label class="boss-brain">
      <span class="bb-label">BRAIN · TEST</span>
      <select value={value} aria-label="Boss brain (testing)" onChange={(e) => onChange(e.currentTarget.value as BossBrain | "")}>
        <option value="">{`Default (${BRAIN_LABELS[BOSS_BRAIN.brain]})`}</option>
        {BOSS_BRAINS.map((b) => (
          <option key={b} value={b}>
            {BRAIN_LABELS[b]}
          </option>
        ))}
      </select>
    </label>
  );
}
