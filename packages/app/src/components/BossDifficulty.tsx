import { BOSS_DIFFICULTY, type BossDifficultyId } from "@chessroyale/core";

/** Solo's difficulty, next to the boss picker: four segments, the chosen one lit. */
export function BossDifficulty({ value, onChange }: { value: BossDifficultyId; onChange: (id: BossDifficultyId) => void }) {
  return (
    <div class="boss-difficulty" role="radiogroup" aria-label="Difficulty">
      {BOSS_DIFFICULTY.map((d) => (
        <button
          type="button"
          key={d.id}
          role="radio"
          aria-checked={value === d.id}
          class={`bd-opt ${d.id}${value === d.id ? " on" : ""}`}
          onClick={() => onChange(d.id)}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
