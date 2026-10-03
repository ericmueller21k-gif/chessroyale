import { useEffect, useState } from "preact/hooks";
import { applyMove, sideToMove } from "@chessroyale/chess";
import { Board, type Arrow } from "../components/Board.tsx";
import { COUNT_FROM_SECONDS, CenterCount, TimerBar, useTicks } from "../components/Countdown.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import { HistoryNav, useHistoryView } from "../components/HistoryNav.tsx";
import { clockText } from "../components/RaceTower.tsx";
import type { BoardView, GameView } from "../game.ts";
import { MiniTower } from "../components/MiniTower.tsx";
import { useReplay } from "../hooks.ts";
import { Hud } from "./Hud.tsx";

const HINT_BRUSHES = ["green", "blue", "yellow"] as const;

/** Re-renders every `ms` and returns the time. */
function useNow(ms = 200) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Your time bank, ticking down while you think (it doesn't move during the settling-in countdown). */
function BankClock({ match, startsAt, now }: { match: GameView; startsAt: number; now: number }) {
  const me = match.standings().find((s) => s.isYou);
  if (!me) return null;
  const bank = Math.max(0, me.bankMs + match.settings.timeIncrementSeconds * 1000 - Math.max(0, now - startsAt));
  return (
    <span class={`bank ${bank < 60_000 ? "low" : ""}`} title="Time bank: +5 s every move, 30 s at most per move">
      Bank {clockText(bank)}
    </span>
  );
}

/** In the final: whose side you're moving for, and with whom. */
function FinalTurnLabel({ match, side }: { match: GameView; side: "w" | "b" }) {
  const f = match.final!;
  const team = f.teams.find((t) => t.some((id) => match.isYou(id))) ?? [];
  const mate = team.find((id) => !match.isYou(id));
  return (
    <>
      <strong>FINAL</strong> · your move for {side === "w" ? "White" : "Black"}
      {mate ? ` (with ${match.nameOf(mate)})` : ""}
    </>
  );
}

export function PlayScreen({
  match,
  board,
  startsAt = 0,
  deadline,
  allowedMs,
  picked,
}: {
  match: GameView;
  board: BoardView;
  startsAt?: number;
  deadline: number;
  allowedMs?: number;
  picked?: string | null;
}) {
  const side = sideToMove(board.fen);
  const waiting = picked !== undefined;
  const now = useNow();
  const [mountedAt] = useState(Date.now());
  // A new board: a short countdown while the last few moves replay, then the clock starts.
  const intro = !waiting && now < startsAt;
  const introLeft = Math.ceil((startsAt - now) / 1000);
  const shown = useReplay(match, board, Math.max(0, startsAt - mountedAt));
  const history = useHistoryView(board.history);
  // The same 3-2-1 (with a tick each second) opens the round and closes it.
  useTicks(introLeft, COUNT_FROM_SECONDS, intro);
  const total = allowedMs ?? match.settings.moveClockSeconds * 1000;
  const secsLeft = Math.ceil((deadline - now) / 1000);
  const ending = !waiting && !intro && deadline > 0 && secsLeft > 0 && secsLeft <= COUNT_FROM_SECONDS;

  const hint = match.hint;
  const left = match.powerUpsLeft();
  // Once you've moved, your move stays on the board while the others finish.
  const moved = waiting && picked ? { fen: applyMove(board.fen, picked), lastMove: picked } : null;
  const alive = match.standings().filter((s) => !s.out);
  const doneCount = alive.filter((s) => match.done.has(s.id)).length;
  const arrows: Arrow[] =
    !waiting && hint && !history.browsing
      ? hint.map((h, i) => ({ move: h.move, brush: HINT_BRUSHES[i]!, label: (h.expected * 100).toFixed(1) }))
      : [];
  const fen = history.fen ?? moved?.fen ?? shown.fen;
  const lastMove = history.browsing ? history.lastMove : (moved?.lastMove ?? shown.lastMove);
  const canMove = !waiting && !intro && !shown.replaying && !history.browsing;

  return (
    <div class="screen game">
      <Hud match={match} />
      <div class="board-area">
        <div class="opening-name">
          {match.final ? <FinalTurnLabel match={match} side={side} /> : board.openingName}
        </div>
        <div class="board-row">
          <EvalBar fen={history.fen ?? board.fen} orientation={side} evaluate={(f) => match.evaluate(f)} />
          <Board fen={fen} orientation={side === "w" ? "white" : "black"} lastMove={lastMove} interactive={canMove} onMove={(m) => match.submit(m)} arrows={arrows}>
            {!waiting && deadline > 0 && <TimerBar startsAt={startsAt} deadline={deadline} total={total} />}
            {intro && <CenterCount label="Round start" n={introLeft <= COUNT_FROM_SECONDS ? introLeft : null} />}
            {ending && <CenterCount label="Round end" n={secsLeft} />}
          </Board>
        </div>
        <HistoryNav view={history} total={board.history.length} />
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
            <div class="play-row">
              <span class="status">
                You play <strong>{side === "w" ? "White" : "Black"}</strong>
                {intro && <span class="muted"> · {shown.replaying ? "replay" : "get ready"}</span>}
                {history.browsing && <span class="muted"> · looking back</span>}
              </span>
              {allowedMs !== undefined && <BankClock match={match} startsAt={startsAt} now={now} />}
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
                onClick={() => match.usePowerUp()}
              >
                {hint ? "Asking the engine…" : left === Infinity ? "💡 Show the engine's top 3 (practice)" : `⚡ Power-up: show the top 3 (${left} left)`}
              </button>
            )}
          </>
        )}
      </div>
      <MiniTower match={match} />
    </div>
  );
}
