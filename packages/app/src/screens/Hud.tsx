import { useEffect, useState } from "preact/hooks";
import { LeaderboardSheet } from "../components/LeaderboardSheet.tsx";
import { LiveNumber } from "../components/LiveNumber.tsx";
import { MuteButton } from "../components/MuteButton.tsx";
import { clockText } from "../components/RaceTower.tsx";
import { BoardsStrip } from "../components/TinyBoard.tsx";
import { myBoardId, type GameView } from "../game.ts";
import { roundsInStage } from "@chessroyale/core";

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
export function Hud({ match }: { match: GameView }) {
  const [open, setOpen] = useState(false);
  // During the reveal the round counter has already moved on; show the round just played.
  const shownRound = match.phase.kind === "reveal" ? match.roundsPlayed : match.roundsPlayed + 1;
  const standings = match.standings();
  const alive = standings.filter((s) => !s.out);
  let rank = alive.findIndex((x) => x.isYou) + 1;
  if (match.final) {
    // In the final, position is by average loss per move in the final (lowest first).
    const f = match.final;
    const avg = (id: string) => f.scores[id]?.avg ?? Infinity;
    const order = [...f.order].sort((a, b) => avg(a) - avg(b));
    rank = order.findIndex((id) => match.isYou(id)) + 1;
  }
  const me = alive[alive.findIndex((x) => x.isYou)];
  const knockouts = match.cutoff > 0 && match.cutoff < alive.length;
  // The score on the cut line: the last player who'd go through.
  const cutScore = knockouts ? alive[match.cutoff - 1]!.points : null;
  const inZone = knockouts && rank > match.cutoff;
  return (
    <>
      <div class="hud-row">
        <button type="button" class="hud" onClick={() => setOpen(true)} aria-label="Show the leaderboard">
          <span class="hud-stage">
            {match.final ? (
              "FINAL"
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
          {me && !match.final && (
            <span class={`hud-score ${inZone ? "danger" : "safe"}`} title="Your points this stage">
              <LiveNumber value={me.points} format={pts} />
            </span>
          )}
          {cutScore !== null && me && !match.final && (
            <span class="hud-cut" title="Points on the cut line (the last place that goes through)">
              <small>cut</small>
              <LiveNumber value={cutScore} format={pts} />
            </span>
          )}
          <BankTime match={match} />
        </button>
        <MuteButton />
      </div>
      <BoardsStrip slots={match.slots()} current={myBoardId(match)} />
      {open && <LeaderboardSheet match={match} onClose={() => setOpen(false)} />}
    </>
  );
}
