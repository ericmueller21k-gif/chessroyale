import { cutLabel, type BoardView, type GameView } from "../game.ts";
import { MiniBoard } from "../components/MiniBoard.tsx";
import { RaceTower } from "../components/RaceTower.tsx";
import { ChatSection } from "../components/QuickChat.tsx";

/** For knocked-out players: the boards in play and the live standings. */
export function SpectateScreen({ match, boards, note }: { match: GameView; boards: BoardView[]; note?: string }) {
  const st = match.standings();
  return (
    <div class="screen spectate">
      <h1>Watching</h1>
      {note && <p class="status">{note}</p>}
      {boards.length > 0 && (
        <div class={`grid grid-${boards.length}`}>
          {boards.map((b) => (
            <MiniBoard key={b.id} fen={b.fen} lastMove={b.lastMove} label={b.openingName} />
          ))}
        </div>
      )}
      {/* Out of the match, still on the team: quick chat (online). */}
      <ChatSection match={match} />
      <RaceTower standings={st} cutoff={match.cutoff} cutLabel={cutLabel(match)} floats={match.chat?.floats()} />
    </div>
  );
}
