import { useEffect, useMemo, useState } from "preact/hooks";
import { applyMove, inCheck, queenInDanger, sideToMove } from "@chessroyale/chess";
import { Board, type Arrow } from "../components/Board.tsx";
import { COUNT_FROM_SECONDS, CenterCount, TimerBar, useTicks } from "../components/Countdown.tsx";
import { EvalBar, knownEval } from "../components/EvalBar.tsx";
import { kingTurn, type KingCue } from "../godKing.ts";
import { HistoryNav, useHistoryView } from "../components/HistoryNav.tsx";
import type { BoardView, GameView, StrikeState } from "../game.ts";
import { MiniTower } from "../components/MiniTower.tsx";
import { PowerUps } from "../components/PowerUpButton.tsx";
import { BossDock, Dots } from "../components/BossDock.tsx";
import { KingSummon, kingSquare } from "../components/GodKing.tsx";
import { LiveGhosts } from "./Crowd.tsx";
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

/** In the final: whose side you're moving for, and with whom. */
function FinalTurnLabel({ match, side }: { match: GameView; side: "w" | "b" }) {
  const f = match.final!;
  const team = f.teams.find((t) => t.some((id) => match.isYou(id))) ?? [];
  const mates = team.filter((id) => !match.isYou(id)).map((id) => match.nameOf(id));
  return (
    <>
      <strong>{f.format === "duel" ? "DUEL" : "FINAL"}</strong> · your move for {side === "w" ? "White" : "Black"}
      {mates.length ? ` (with ${mates.join(", ")})` : ""}
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
  strike,
}: {
  match: GameView;
  board: BoardView;
  startsAt?: number;
  deadline: number;
  allowedMs?: number;
  picked?: string | null;
  strike?: StrikeState;
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
  // Power-ups you hold (one in use this move already counts as spent).
  const held = match.practice ? Infinity : (match.standings().find((s) => s.isYou)?.powerUps ?? 0);
  const powerUps = hint !== null ? Math.max(0, held - 1) : held;
  // Once you've moved, your move stays on the board while the others finish.
  // (Crowd keeps the position on screen and shows everyone's picks over it instead.)
  const crowd = match.settings.mode === "crowd";
  const moved = waiting && picked && !crowd ? { fen: applyMove(board.fen, picked), lastMove: picked } : null;
  // Crowd 50 v 50: only your team is picking this turn.
  const alive = match.standings().filter((s) => !s.out && (s.team == null || s.team === side));
  const doneCount = alive.filter((s) => match.done.has(s.id)).length;
  const arrows: Arrow[] =
    !waiting && hint && !history.browsing
      ? hint.map((h, i) => ({ move: h.move, brush: HINT_BRUSHES[i]!, label: (h.expected * 100).toFixed(1) }))
      : [];
  const fen = history.fen ?? moved?.fen ?? shown.fen;
  const lastMove = history.browsing ? history.lastMove : (moved?.lastMove ?? shown.lastMove);
  // Boss battle: the God King striking the boss. The clock stands still and nobody moves until he's gone.
  const striking = !!strike?.at && now < strike.until!;
  const canMove = !waiting && !intro && !shown.replaying && !history.browsing && !striking;
  const godKing = useMemo(() => {
    if (!strike?.at) return null;
    const boss = side === "w" ? "b" : "w";
    const mine = kingSquare(board.fen, side);
    const target = kingSquare(board.fen, boss);
    if (!mine || !target) return null;
    const hp = Math.round((match.settings.kingStrikeLoss[0] + match.settings.kingStrikeLoss[1]) / 2);
    return {
      side,
      orientation: side === "w" ? ("white" as const) : ("black" as const),
      kingBefore: mine,
      kingAfter: mine,
      target,
      mode: "strike" as const,
      hp,
      startAt: strike.at,
      moveAt: strike.at,
      exitAt: strike.until! - 900,
    };
  }, [strike?.at, board.fen]);
  // What the God King might say about the position: danger first, then how it's going, then small talk.
  const kingCues = useMemo(() => {
    if (!match.boss || waiting) return [];
    kingTurn(board.fen);
    const out: { cue: KingCue; key: string }[] = [];
    if (strike?.at) out.push({ cue: "struck", key: `struck-${strike.at}` });
    if (queenInDanger(board.fen, side)) out.push({ cue: "queenDanger", key: `queen-${board.fen}` });
    if (inCheck(board.fen)) out.push({ cue: "inCheck", key: `check-${board.fen}` });
    out.push({ cue: "intro", key: "intro" });
    if (match.boss.kingCharges <= 0) out.push({ cue: "spent", key: "spent" });
    const w = knownEval(board.fen);
    if (w !== undefined) {
      const ours = side === "w" ? w : 1 - w;
      if (ours >= 0.85) out.push({ cue: "winning", key: `winning-${board.fen}` });
      else if (ours <= 0.15) out.push({ cue: "losing", key: `losing-${board.fen}` });
    }
    if (match.boss.kingCharges > 0 && board.ply >= 6) out.push({ cue: "nudge", key: `nudge-${Math.floor(board.ply / 12)}` });
    out.push({ cue: "idle", key: `idle-${board.fen}` });
    return out;
  }, [board.fen, strike?.at, waiting]);

  return (
    <div class="screen game">
      <Hud match={match} />
      <div class="board-area">
        <div class="opening-name">
          {match.final ? (
            <FinalTurnLabel match={match} side={side} />
          ) : match.boss ? (
            <BossHeading side={side} note={`${doneCount}/${alive.length} picked`} />
          ) : match.settings.mode === "crowd" ? (
            <>
              Your pick for <strong>{side === "w" ? "White" : "Black"}</strong> ·{" "}
              <span class="pick-count">
                {doneCount}/{alive.length} picked
              </span>
            </>
          ) : (
            board.openingName
          )}
        </div>
        <div class="board-row">
          <EvalBar fen={history.fen ?? board.fen} orientation={side} evaluate={(f) => match.evaluate(f)} />
          <Board fen={fen} orientation={side === "w" ? "white" : "black"} lastMove={lastMove} interactive={canMove} onMove={(m) => match.submit(m)} arrows={arrows}>
            {!waiting && deadline > 0 && <TimerBar startsAt={startsAt} deadline={deadline} total={total} frozen={strike?.at ? { at: strike.at, until: strike.until! } : undefined} />}
            {intro && (
              <CenterCount
                label="Round start"
                n={introLeft <= COUNT_FROM_SECONDS ? introLeft : null}
                note={shown.replaying ? (shown.fromStart ? "New board: replaying it from the start" : "Replaying the moves you missed") : null}
              />
            )}
            {ending && !striking && <CenterCount label="Round end" n={secsLeft} />}
            {godKing && <KingSummon {...godKing} />}
            {crowd && waiting && !history.browsing && <LiveGhosts match={match} fen={board.fen} orientation={side === "w" ? "white" : "black"} />}
          </Board>
        </div>
        {!match.boss && (
          <HistoryNav
            view={history}
            total={board.history.length}
            extra={<PowerUps count={powerUps} max={match.settings.powerUpsMax} used={hint !== null} disabled={waiting} onUse={() => match.usePowerUp()} />}
          />
        )}
      </div>
      {match.boss ? (
        <BossDock
          match={match}
          side={side}
          cues={kingCues}
          away={striking}
          nav={{ view: history, total: board.history.length }}
          canCall={!waiting && !intro && !shown.replaying && !striking}
          strike={strike}
          status={
            striking ? (
              <span>
                <strong>👑 The God King strikes the boss!</strong> <span class="muted">The clock is stopped.</span>
              </span>
            ) : waiting ? (
              <span>
                <Dots /> <strong>{picked ? "Move in." : "Time's up."}</strong>{" "}
                <span class="muted">
                  Waiting for the others · {doneCount}/{alive.length}
                </span>
              </span>
            ) : intro ? (
              <span class="muted">Get ready…</span>
            ) : strike?.mine && !match.boss.staggerNext ? (
              <span>
                <strong>Strike called.</strong>{" "}
                <span class="muted">
                  {strike.calls} of {strike.needed} needed. Pick your move meanwhile.
                </span>
              </span>
            ) : (
              <span>
                <strong>Your move.</strong>{" "}
                {match.boss.staggerNext && <span class="muted">The boss is staggered: its next move will be weaker.</span>}
              </span>
            )
          }
        />
      ) : (
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
            {hint && hint.length > 0 && (
              <ol class="hints">
                {hint.map((h, i) => (
                  <li key={h.move} class={`hint-${HINT_BRUSHES[i]}`}>
                    <strong>{h.san}</strong>
                    <span>{(h.expected * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ol>
            )}
            {hint && hint.length === 0 && <p class="muted small hints-wait">Asking the engine…</p>}
          </>
        )}
      </div>
      )}
      <MiniTower match={match} />
    </div>
  );
}

/** Boss battle: the line above the board, the same on every screen of it. */
export function BossHeading({ side, note }: { side: "w" | "b"; note?: string }) {
  return (
    <>
      <strong>BOSS BATTLE</strong> · you play {side === "w" ? "White" : "Black"}
      {note ? <> · {note}</> : null}
    </>
  );
}
