import { useEffect, useState } from "preact/hooks";
import { applyMove, sideToMove } from "@chessroyale/chess";
import { Board, type Arrow } from "../components/Board.tsx";
import { Countdown } from "../components/Countdown.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import { clockText } from "../components/RaceTower.tsx";
import type { BoardView, GameView } from "../game.ts";
import { useReplay } from "../hooks.ts";
import { play } from "../sound.ts";
import { Hud } from "./Hud.tsx";

const HINT_BRUSHES = ["green", "blue", "yellow"] as const;

/** Your time bank, ticking down while you think. */
function BankClock({ match, deadline, allowedMs }: { match: GameView; deadline: number; allowedMs: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const me = match.standings().find((s) => s.isYou);
  if (!me) return null;
  const startedAt = deadline - allowedMs;
  const bank = Math.max(0, me.bankMs + match.settings.timeIncrementSeconds * 1000 - Math.max(0, now - startedAt));
  return (
    <span class={`bank ${bank < 60_000 ? "low" : ""}`} title="Time bank: +5 s every move; what's left counts as points">
      Bank {clockText(bank)}
    </span>
  );
}

export function PlayScreen({
  match,
  board,
  deadline,
  allowedMs,
  picked,
}: {
  match: GameView;
  board: BoardView;
  deadline: number;
  allowedMs?: number;
  picked?: string | null;
}) {
  const side = sideToMove(board.fen);
  const waiting = picked !== undefined;
  const shown = useReplay(match, board);
  useEffect(() => {
    if (!waiting) play("roundStart");
  }, []);
  const hint = match.hint;
  const left = match.powerUpsLeft();
  // Once you've moved, your move stays on the board while the others finish.
  const moved = waiting && picked ? { fen: applyMove(board.fen, picked), lastMove: picked } : null;
  const alive = match.standings().filter((s) => !s.out);
  const doneCount = alive.filter((s) => match.done.has(s.id)).length;
  const arrows: Arrow[] =
    !waiting && hint ? hint.map((h, i) => ({ move: h.move, brush: HINT_BRUSHES[i]!, label: (h.expected * 100).toFixed(1) })) : [];
  return (
    <div class="screen game">
      <Hud match={match} />
      <div class="board-area">
        <div class="opening-name">
          {board.openingName}
          {shown.replaying && <span class="replay-tag"> · catching up…</span>}
        </div>
        <div class="board-row">
          <EvalBar fen={board.fen} orientation={side} evaluate={(f) => match.evaluate(f)} />
          <Board
            fen={moved?.fen ?? shown.fen}
            orientation={side === "w" ? "white" : "black"}
            lastMove={moved?.lastMove ?? shown.lastMove}
            interactive={!waiting && !shown.replaying}
            onMove={(m) => match.submit(m)}
            arrows={arrows}
          />
        </div>
      </div>
      <div class="play-footer">
        {waiting ? (
          <div class="waiting-banner" role="status">
            <span class="waiting-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>
              <strong>{picked ? "Move in." : "Time's up."}</strong> Waiting for other players
            </span>
            {alive.length > 0 && (
              <span class="waiting-count">
                {doneCount}/{alive.length}
              </span>
            )}
          </div>
        ) : (
          <>
            <Countdown deadline={deadline} total={allowedMs ?? match.settings.moveClockSeconds * 1000} />
            <div class="play-row">
              <span class="status">
                You play <strong>{side === "w" ? "White" : "Black"}</strong>
              </span>
              {allowedMs !== undefined && <BankClock match={match} deadline={deadline} allowedMs={allowedMs} />}
            </div>
            {hint && hint.length > 0 ? (
              <ol class="hints">
                {hint.map((h, i) => (
                  <li key={h.move} class={`hint-${HINT_BRUSHES[i]}`}>
                    <strong>{h.san}</strong>
                    <span>{(h.expected * 100).toFixed(1)}% expected</span>
                  </li>
                ))}
              </ol>
            ) : (
              <button
                type="button"
                class="btn btn-secondary btn-powerup"
                disabled={left <= 0 || hint !== null}
                onClick={() => {
                  play("powerUp");
                  match.usePowerUp();
                }}
              >
                {hint ? "Asking the engine…" : left === Infinity ? "💡 Show the engine's top 3 (practice)" : `⚡ Power-up: show the top 3 (${left} left)`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
