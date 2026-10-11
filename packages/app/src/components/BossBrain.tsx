import { BOSS_BRAIN, BOSS_BRAINS, bossDef, type BossBrain } from "@chessroyale/core";
import { BRAIN_LABELS } from "../boss-brain.ts";

/**
 * Testing, admins only (Boss alone's boss menu): which brain the boss plays with. "Default" is each boss's own
 * (BOSS_BRAIN.soloDefault: Ginger's Maia, no guard; Stockfish for the rest); a pick applies to whichever boss you meet.
 */
export function BossBrainPicker({ value, onChange }: { value: BossBrain | ""; onChange: (v: BossBrain | "") => void }) {
  const maia = Object.entries(BOSS_BRAIN.soloDefault).filter(([, b]) => b !== "stockfish").map(([id]) => bossDef(id)?.name ?? id);
  return (
    <label class="boss-brain">
      <span class="bb-label">BRAIN · TEST</span>
      <select value={value} aria-label="Boss brain (testing)" onChange={(e) => onChange(e.currentTarget.value as BossBrain | "")}>
        <option value="">{maia.length ? `Default (Maia for ${maia.join(", ")})` : "Default (Stockfish)"}</option>
        {BOSS_BRAINS.map((b) => (
          <option key={b} value={b}>
            {BRAIN_LABELS[b]}
          </option>
        ))}
      </select>
    </label>
  );
}
