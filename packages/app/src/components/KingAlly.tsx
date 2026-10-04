import { useState } from "preact/hooks";
import type { StrikeState } from "../game.ts";

/**
 * Boss battle: the God King, for one of the crowd's charges, when more than half
 * the crowd calls. Two ways: he plays this move himself (at full engine
 * strength, stronger than the boss), which is your whole turn; or he strikes the
 * boss right now (its next move will be a weaker one), the clock standing still
 * while he does, and then you pick your move as usual. A tap asks to confirm.
 */
export function KingCalls({
  charges,
  called,
  strike,
  struck,
  canCall,
  onCall,
}: {
  charges: number;
  /** You called him to play this move. */
  called: boolean;
  strike?: StrikeState;
  /** He has struck the boss this move (one strike a move). */
  struck: boolean;
  canCall: boolean;
  onCall: (strike: boolean) => void;
}) {
  const [confirm, setConfirm] = useState<"play" | "strike" | null>(null);
  const crowns = (
    <span class="king-charges" aria-label={`${charges} charges left`}>
      {charges > 0 ? Array.from({ length: charges }, (_, i) => <i key={i}>👑</i>) : "spent"}
    </span>
  );
  if (confirm && canCall && !called) {
    return (
      <div class="king-calls confirming" role="dialog" aria-label="Summon the God King?">
        <span class="king-confirm-text">
          {confirm === "play" ? "Summon the God King to play this move?" : "Summon the God King to strike the boss?"}{" "}
          <span class="muted">{confirm === "play" ? "You won't pick a move." : "The clock stops while he strikes, then you pick your move."}</span>
        </span>
        <button
          type="button"
          class="king-call yes"
          onClick={() => {
            setConfirm(null);
            onCall(confirm === "strike");
          }}
        >
          <strong>Yes</strong>
        </button>
        <button type="button" class="king-call" onClick={() => setConfirm(null)}>
          <strong>No</strong>
        </button>
      </div>
    );
  }
  const strikeLabel = struck ? "Boss struck" : strike?.mine ? `Strike called ${strike.calls}/${strike.needed}` : "Strike the boss";
  return (
    <div class="king-calls">
      <button
        type="button"
        class={`king-call${called ? " on" : ""}`}
        disabled={!canCall || called || charges <= 0}
        onClick={() => setConfirm("play")}
        title="He plays this move at full engine strength if more than half the crowd calls him"
      >
        <strong>{called ? "King called" : "Call the King"}</strong>
      </button>
      <button
        type="button"
        class={`king-call strike${strike?.mine || struck ? " on" : ""}`}
        disabled={!canCall || called || struck || !!strike?.mine || charges <= 0}
        onClick={() => setConfirm("strike")}
        title="He strikes now if more than half the crowd calls for it: the boss's next move will be a weaker one"
      >
        <strong>{strikeLabel}</strong>
      </button>
      {crowns}
    </div>
  );
}
