import type { GameView } from "../game.ts";

/** Stage, round and your rank, with a warning inside the knockout zone. */
export function Hud({ match }: { match: GameView }) {
  // During the reveal the round counter has already moved on; show the round just played.
  const shownRound = match.phase.kind === "reveal" ? match.roundsPlayed : match.roundsPlayed + 1;
  const standings = match.standings();
  const rank = standings.findIndex((x) => x.isYou) + 1;
  const inZone = rank > match.cutoff;
  const me = standings[rank - 1];
  return (
    <header class="hud">
      <div class="hud-stage">
        Stage {match.stage + 1}/{match.settings.knockoutsPerStage.length}
        <span class="muted">
          {" "}
          · Round {Math.min(shownRound, match.settings.roundsPerStage)}/{match.settings.roundsPerStage}
        </span>
      </div>
      <div class={`hud-rank ${inZone ? "danger" : ""}`} title={inZone ? "Knockout zone" : undefined}>
        #{rank}
        <span class="muted"> of {standings.length}</span>
        {inZone && <span class="zone-badge">KO zone</span>}
        <span class="hud-score">{me ? (me.score >= 0 ? "+" : "") + me.score.toFixed(1) : ""}</span>
      </div>
    </header>
  );
}
