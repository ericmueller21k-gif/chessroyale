import { sideToMove } from "@chessroyale/chess";
import { Board } from "../components/Board.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import type { DuelView, GameView } from "../game.ts";

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function DuelColourScreen({ match, opponentName }: { match: GameView; opponentName: string }) {
  return (
    <div class="screen center">
      <h1>The duel</h1>
      <p>You scored higher than {opponentName} in the final four, so you choose your colour.</p>
      <p class="muted">One game, 3 minutes each, no increment. Checkmate, resignation or the clock decides it. A draw goes to whoever played more accurately.</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" onClick={() => match.chooseColour("w")}>
          Play White
        </button>
        <button type="button" class="btn btn-secondary" onClick={() => match.chooseColour("b")}>
          Play Black
        </button>
      </div>
    </div>
  );
}

export function DuelScreen({ match, duel }: { match: GameView; duel: DuelView }) {
  const clocks = match.duelClocks(duel);
  const turn = sideToMove(duel.fen);
  const yourTurn = !duel.over && !duel.spectator && turn === duel.youColour;
  const them = duel.youColour === "w" ? "b" : "w";
  return (
    <div class="screen game duel">
      <div class={`duel-player ${turn === them && !duel.over ? "active" : ""}`}>
        <span>{duel.opponentName}</span>
        <span class={`duel-clock ${clocks[them] < 20000 ? "low" : ""}`}>{clock(clocks[them])}</span>
      </div>
      <div class="board-area">
        <div class="duel-board-row">
          {duel.spectator && <EvalBar fen={duel.fen} history={duel.history} orientation={duel.youColour} />}
          <Board
          fen={duel.fen}
          orientation={duel.youColour === "w" ? "white" : "black"}
          lastMove={duel.lastMove}
          interactive={yourTurn}
          onMove={(m) => match.duelMove(m)}
          />
        </div>
      </div>
      <div class={`duel-player ${yourTurn ? "active" : ""}`}>
        <span>{duel.spectator ? (duel.youColour === "w" ? "White" : "Black") : match.playerName}</span>
        <span class={`duel-clock ${clocks[duel.youColour] < 20000 ? "low" : ""}`}>{clock(clocks[duel.youColour])}</span>
      </div>
      <div class="actions">
        {duel.over ? (
          <>
            <div class={`duel-result ${duel.over.winner === "you" ? "good" : duel.spectator ? "" : "bad"}`}>
              {duel.spectator ? "Game over" : duel.over.winner === "you" ? "You win the match!" : `${duel.opponentName} wins`}
              <div class="muted small">{duel.over.reason}</div>
            </div>
            <button type="button" class="btn btn-primary" onClick={() => match.finishAfterDuel()}>
              Results
            </button>
          </>
        ) : duel.spectator ? (
          <div class="status">Watching the duel</div>
        ) : (
          <button type="button" class="btn btn-secondary" onClick={() => confirm("Resign the duel?") && match.resign()}>
            Resign
          </button>
        )}
      </div>
    </div>
  );
}
