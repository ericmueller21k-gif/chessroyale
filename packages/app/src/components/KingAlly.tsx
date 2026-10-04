/**
 * The King: the crowd's champion in the boss battle. A king piece in the
 * crowd's colour with a sword at his side, swaying gently. The crowd can call
 * him, for a charge, in two ways: to play the move himself (at full engine
 * strength, stronger than the boss), or to strike the boss so its next move is
 * a weaker one. He acts when more than half of them call.
 */
export function KingAlly({
  side,
  charges,
  called,
  canCall,
  onCall,
  striking = false,
}: {
  side: "w" | "b";
  charges: number;
  called: "play" | "strike" | null;
  canCall: boolean;
  onCall?: (strike: boolean) => void;
  /** Raising his sword: he's playing this move. */
  striking?: boolean;
}) {
  return (
    <div class={`king-ally${striking ? " striking" : ""}`}>
      <span class="king-figure cg-wrap" aria-hidden="true">
        <piece class={`${side === "w" ? "white" : "black"} king`} />
        <span class="king-sword">🗡️</span>
      </span>
      {onCall && (
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
                onClick={() => onCall(strike)}
                title={title}
              >
                <strong>{mine ? done : label}</strong>
              </button>
            );
          })}
          <span class="king-charges" aria-label={`${charges} charges left`}>
            {charges > 0 ? Array.from({ length: charges }, (_, i) => <i key={i}>👑</i>) : "spent"}
          </span>
        </div>
      )}
    </div>
  );
}

/** Over the board when the King plays: he raises his sword and his move lands in gold. */
export function KingStrike({ side, san, strike = false }: { side: "w" | "b"; san: string; strike?: boolean }) {
  return (
    <div class={`king-strike${strike ? " at-boss" : ""}`} role="alert">
      <KingAlly side={side} charges={0} called={null} canCall={false} striking />
      <strong>{strike ? "The King strikes the boss!" : "The King steps in"}</strong>
      <span>{strike ? "Its next move will be a weaker one" : san}</span>
    </div>
  );
}
