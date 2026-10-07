import { useEffect, useState } from "preact/hooks";
import { LeaderboardSheet } from "../components/LeaderboardSheet.tsx";
import { LiveNumber } from "../components/LiveNumber.tsx";
import { MuteButton } from "../components/MuteButton.tsx";
import { clockText } from "../components/RaceTower.tsx";
import { BoardsStrip } from "../components/TinyBoard.tsx";
import { isCrowd, myBoardId, towerView, type GameView } from "../game.ts";
import { roundsInStage } from "@chessroyale/core";
import { BossBar } from "./Boss.tsx";

/**
 * Your total time left (the bank), ticking down while you think. Each move
 * adds a few seconds before the clock starts, so it's shown with that added.
 */
function BankTime({ match }: { match: GameView }) {
  const [now, setNow] = useState(Date.now());
  const p = match.phase;
  const ticking = p.kind === "play";
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [ticking]);
  const me = match.standings().find((s) => s.isYou);
  if (!me || me.out) return null;
  const bank = ticking
    ? Math.max(0, me.bankMs + match.settings.timeIncrementSeconds * 1000 - Math.max(0, now - p.startsAt))
    : me.bankMs;
  return (
    <span class={`hud-bank${bank < 60_000 ? " low" : ""}`} title="Your total time left (bank): +5 s every move, at most 30 s per move">
      {clockText(bank)}
    </span>
  );
}

const pts = (x: number) => (Math.abs(x) < 0.05 ? "0.0" : (x > 0 ? "+" : "−") + Math.abs(x).toFixed(1));

/**
 * Above the board: one clean line with stage and round, your position, your
 * points (green while you're above the cut, red below it) and, in yellow, the
 * score on the cut line. Tap it for the full leaderboard. Then every board as
 * a tiny live board (yours ringed).
 */
export function Hud({ match, stripFrozen = false }: { match: GameView; stripFrozen?: boolean }) {
  const [open, setOpen] = useState(false);
  // During the reveal the round counter has already moved on; show the round just played.
  const shownRound = match.phase.kind === "reveal" ? match.roundsPlayed : match.roundsPlayed + 1;
  // Crowd 50 v 50: your team, with your team's cut line.
  const view = towerView(match);
  const standings = view.standings;
  const alive = standings.filter((s) => !s.out);
  const cutoff = view.cutoff;
  let rank = alive.findIndex((x) => x.isYou) + 1;
  if (match.final) {
    // In the final, position is by average loss per move in the final (lowest first); in a team final or duel, over the whole match.
    const f = match.final;
    const whole = f.format === "team" || f.format === "duel";
    const avg = (id: string) => (whole ? f.scores[id]?.matchLoss : f.scores[id]?.avg) ?? Infinity;
    const order = [...f.order].sort((a, b) => avg(a) - avg(b));
    rank = order.findIndex((id) => match.isYou(id)) + 1;
  }
  const boss = match.boss;
  const me = alive[alive.findIndex((x) => x.isYou)];
  const knockouts = cutoff > 0 && cutoff < alive.length;
  // The score on the cut line: the last player who'd go through.
  const cutScore = knockouts ? alive[cutoff - 1]!.points : null;
  const inZone = knockouts && rank > cutoff;
  // Crowd: the move number on the board, and turns left until the cut.
  const crowd = isCrowd(match);
  const p = match.phase;
  const fen = "board" in p && p.board ? p.board.fen : null;
  const moveNo = fen ? Number(fen.split(" ")[5]) || 1 : null;
  const turnsLeft = roundsInStage(match.settings, match.stage) - match.roundsPlayed;
  const team = view.teamLabel ? (alive.find((s) => s.isYou)?.team ?? null) : null;
  return (
    <>
      <div class="hud-row">
        <button type="button" class="hud" onClick={() => setOpen(true)} aria-label="Show the leaderboard">
          <span class="hud-stage">
            {match.final ? (
              "FINAL"
            ) : boss ? (
              <>
                BOSS<span class="muted"> · move {Math.min(boss.crowdMoves + 1, boss.maxMoves)}</span>
              </>
            ) : crowd ? (
              <>
                {team && <span class={`team-chip ${team}`} title={view.teamLabel ?? ""} aria-label={view.teamLabel ?? ""} />}
                {/* (Two short lines on a phone, so the numbers beside it fit.) */}
                <span class="hud-stage-text">
                  <span>{moveNo ? `Move ${moveNo}` : "Crowd"}</span>
                  <span class="muted">
                    <span class="hud-dot"> · </span>
                    {turnsLeft <= 1 ? "cut now" : `cut in ${turnsLeft}`}
                  </span>
                </span>
              </>
            ) : (
              <>
                S{match.stage + 1}
                <span class="muted">
                  {" "}
                  · R{Math.min(shownRound, roundsInStage(match.settings, match.stage))}/{roundsInStage(match.settings, match.stage)}
                </span>
              </>
            )}
          </span>
          {rank > 0 && (
            <span class={`hud-rank ${inZone ? "danger" : ""}`}>
              P<LiveNumber value={rank} format={(x) => String(Math.round(x))} goodWhenDown />
              <span class="muted">/{match.final ? match.final.order.length : alive.length}</span>
            </span>
          )}
          {me && !match.final && !boss && (
            <span class={`hud-score ${inZone ? "danger" : "safe"}`} title="Your points this stage">
              <LiveNumber value={me.points} format={pts} />
            </span>
          )}
          {cutScore !== null && me && !match.final && !boss && (
            <span class="hud-cut" title="Points on the cut line (the last place that goes through)">
              <small>cut</small>
              <LiveNumber value={cutScore} format={pts} />
            </span>
          )}
          {crowd ? <span class="hud-spacer" /> : <BankTime match={match} />}
        </button>
        <MuteButton />
      </div>
      {boss ? <BossBar boss={boss} /> : <BoardsStrip slots={match.slots()} current={myBoardId(match)} frozen={stripFrozen} />}
      {open && <LeaderboardSheet match={match} onClose={() => setOpen(false)} />}
    </>
  );
}
