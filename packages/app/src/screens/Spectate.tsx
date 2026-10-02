import type { BoardView, GameView } from "../game.ts";
import { MiniBoard } from "../components/MiniBoard.tsx";

const fmt = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);

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
      <ol class="standings">
        {st.map((s, i) => (
          <>
            {i === match.cutoff && <li class="ko-line" aria-hidden="true">knockout line</li>}
            <li key={s.id} class={s.isYou ? "you" : ""}>
              <span class="st-rank">{i + 1}</span>
              <span class="st-name">{s.name}</span>
              <span class="st-score">{fmt(s.score)}</span>
            </li>
          </>
        ))}
      </ol>
    </div>
  );
}
