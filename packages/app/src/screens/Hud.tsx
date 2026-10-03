import { useState } from "preact/hooks";
import { MuteButton } from "../components/MuteButton.tsx";
import { RaceTower, gapToCut } from "../components/RaceTower.tsx";
import { BoardsStrip } from "../components/TinyBoard.tsx";
import { cutLabel, myBoardId, roundLive, type GameView } from "../game.ts";

/**
 * Above the board: one clean line with stage and round, your position, how
 * far you are from the knockout line and your power-ups (tap it for the full
 * leaderboard), then every board as a tiny live board (yours ringed).
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
  const inZone = rank > match.cutoff;
  const gap = gapToCut(standings, match.cutoff);
  const left = match.powerUpsLeft();
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
                · R{Math.min(shownRound, match.settings.roundsPerStage)}/{match.settings.roundsPerStage}
              </span>
            </>
          )}
        </span>
        {rank > 0 && (
          <span class={`hud-rank ${inZone ? "danger" : ""}`}>
            P{rank}
            <span class="muted">/{alive.length}</span>
          </span>
        )}
        {gap !== null && rank > 0 && !match.final && (
          <span class={`hud-gap ${gap < 0 ? "danger" : "safe"}`}>
            {gap >= 0 ? `+${gap.toFixed(1)} safe` : `${gap.toFixed(1)} at risk`}
          </span>
        )}
        <span class="hud-pu" title="Power-ups">
          ⚡{left === Infinity ? "∞" : left}
        </span>
        <span class="hud-more" aria-hidden="true">
          ☰
        </span>
      </button>
      <MuteButton />
      {open && (
        <div class="tower-overlay" role="dialog" aria-label="Leaderboard" onClick={() => setOpen(false)}>
          <div class="tower-sheet" onClick={(e) => e.stopPropagation()}>
            <div class="tower-sheet-head">
              <strong>Leaderboard</strong>
              <button type="button" class="tower-close" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <RaceTower standings={standings} cutoff={match.cutoff} done={roundLive(match) ? match.done : undefined} cutLabel={cutLabel(match)} />
          </div>
        </div>
      )}
    </div>
    <BoardsStrip slots={match.slots()} current={myBoardId(match)} />
    </>
  );
}
