import { sideToMove } from "@chessroyale/chess";
import { Board } from "../components/Board.tsx";
import { Countdown } from "../components/Countdown.tsx";
import type { BoardView, GameView } from "../game.ts";
import { Hud } from "./Hud.tsx";

export function PlayScreen({ match, board, deadline, picked }: { match: GameView; board: BoardView; deadline: number; picked?: string | null }) {
  const side = sideToMove(board.fen);
  const waiting = picked !== undefined;
  return (
    <div class="screen game">
      <Hud match={match} />
      <div class="board-area">
        <div class="opening-name">{board.openingName}</div>
        <Board
          fen={board.fen}
          orientation={side === "w" ? "white" : "black"}
          lastMove={board.lastMove}
          interactive={!waiting}
          onMove={(m) => match.submit(m)}
        />
      </div>
      <div class="play-footer">
        {waiting ? (
          <div class="status">{picked ? "Move locked in. Scoring…" : "Time's up. Scoring…"}</div>
        ) : (
          <>
            <Countdown deadline={deadline} total={match.settings.moveClockSeconds * 1000} />
            <div class="status">
              You play <strong>{side === "w" ? "White" : "Black"}</strong>. Find the best move: your first move is final.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
