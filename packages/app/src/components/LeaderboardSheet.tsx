import { cutLabel, roundLive, scoreDp, towerView, type GameView, type TeamPick } from "../game.ts";
import { RaceTower } from "./RaceTower.tsx";

/** The full leaderboard as a sheet over the game: the team picked on the scoreboard (`pick`), or your own team. */
export function LeaderboardSheet({ match, pick, onClose }: { match: GameView; pick?: TeamPick; onClose: () => void }) {
  const view = towerView(match, pick);
  return (
    <div class="tower-overlay" role="dialog" aria-label="Leaderboard" onClick={onClose}>
      <div class="tower-sheet" onClick={(e) => e.stopPropagation()}>
        <div class="tower-sheet-head">
          <strong>{view.teamLabel ? `Leaderboard · ${view.teamLabel}` : "Leaderboard"}</strong>
          <button type="button" class="tower-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <RaceTower standings={view.standings} cutoff={view.cutoff} done={roundLive(match) ? match.done : undefined} cutLabel={cutLabel(match)} bank={!match.simul} dp={scoreDp(match.settings)} teams={view.teams} />
      </div>
    </div>
  );
}
