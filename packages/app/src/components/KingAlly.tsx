import { useState } from "preact/hooks";

/**
 * Boss battle: summon the God King instead of picking a move. Two ways, each
 * for one of the crowd's charges: he plays the move himself (at full engine
 * strength, stronger than the boss), or he strikes the boss so its next move is
 * a weaker one. He comes when more than half the crowd calls. Calling him is
 * your whole turn, so a tap asks to confirm first.
 */
export function KingCalls({
  charges,
  called,
  canCall,
  onCall,
}: {
  charges: number;
  called: "play" | "strike" | null;
  canCall: boolean;
  onCall: (strike: boolean) => void;
}) {
  const [confirm, setConfirm] = useState<"play" | "strike" | null>(null);
  const crowns = (
    <span class="king-charges" aria-label={`${charges} charges left`}>
      {charges > 0 ? Array.from({ length: charges }, (_, i) => <i key={i}>👑</i>) : "spent"}
    </span>
  );
  if (confirm && !called) {
    return (
      <div class="king-calls confirming" role="dialog" aria-label="Summon the God King?">
        <span class="king-confirm-text">
          {confirm === "play" ? "Summon the God King to play this move?" : "Summon the God King to strike the boss?"}{" "}
          <span class="muted">You won't pick a move.</span>
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
  return (
    <div class="king-calls">
      {(
        [
          [false, "Call the King", "King called", "He plays this move at full engine strength if more than half the crowd calls him"],
          [true, "Strike the boss", "Strike called", "The boss's next move will be a weaker one if more than half the crowd calls for it"],
        ] as const
      ).map(([strike, label, done, title]) => {
        const mine = called === (strike ? "strike" : "play");
        return (
          <button
            type="button"
            key={label}
            class={`king-call${strike ? " strike" : ""}${mine ? " on" : ""}`}
            disabled={!canCall || !!called || charges <= 0}
            onClick={() => setConfirm(strike ? "strike" : "play")}
            title={title}
          >
            <strong>{mine ? done : label}</strong>
          </button>
        );
      })}
      {crowns}
    </div>
  );
}
