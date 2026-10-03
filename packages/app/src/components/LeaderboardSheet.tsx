import { cutLabel, roundLive, towerView, type GameView } from "../game.ts";
import { RaceTower } from "./RaceTower.tsx";

/** The full leaderboard as a sheet over the game. */
export function LeaderboardSheet({ match, onClose }: { match: GameView; onClose: () => void }) {
  const view = towerView(match);
  return (
    <div class="tower-overlay" role="dialog" aria-label="Leaderboard" onClick={onClose}>
      <div class="tower-sheet" onClick={(e) => e.stopPropagation()}>
        <div class="tower-sheet-head">
          <strong>{view.teamLabel ? `Leaderboard · ${view.teamLabel}` : "Leaderboard"}</strong>
          <button type="button" class="tower-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <RaceTower standings={view.standings} cutoff={view.cutoff} done={roundLive(match) ? match.done : undefined} cutLabel={cutLabel(match)} />
      </div>
    </div>
  );
}
