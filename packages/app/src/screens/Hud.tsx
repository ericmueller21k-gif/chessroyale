import { useState } from "preact/hooks";
import { MuteButton } from "../components/MuteButton.tsx";
import { RaceTower, gapToCut } from "../components/RaceTower.tsx";
import { cutLabel, roundLive, type GameView } from "../game.ts";

/**
 * The strip above the board: stage and round, your position, how far you are
 * from the knockout line, and your power-ups. Tap it for the full leaderboard.
 */
export function Hud({ match }: { match: GameView }) {
  const [open, setOpen] = useState(false);
  // During the reveal the round counter has already moved on; show the round just played.
  const shownRound = match.phase.kind === "reveal" ? match.roundsPlayed : match.roundsPlayed + 1;
  const standings = match.standings();
  const alive = standings.filter((s) => !s.out);
  const rank = alive.findIndex((x) => x.isYou) + 1;
  const inZone = rank > match.cutoff;
  const gap = gapToCut(standings, match.cutoff);
  const left = match.powerUpsLeft();
  return (
    <div class="hud-row">
      <button type="button" class="hud" onClick={() => setOpen(true)} aria-label="Show the leaderboard">
        <span class="hud-stage">
          S{match.stage + 1}
          <span class="muted">
            {" "}
            · R{Math.min(shownRound, match.settings.roundsPerStage)}/{match.settings.roundsPerStage}
          </span>
        </span>
        {rank > 0 && (
          <span class={`hud-rank ${inZone ? "danger" : ""}`}>
            P{rank}
            <span class="muted">/{alive.length}</span>
          </span>
        )}
        {gap !== null && rank > 0 && (
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
  );
}
