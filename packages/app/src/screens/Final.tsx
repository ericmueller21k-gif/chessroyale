import { useEffect } from "preact/hooks";
import { sideToMove } from "@chessroyale/chess";
import { Board } from "../components/Board.tsx";
import { EvalBar } from "../components/EvalBar.tsx";
import { HistoryNav, useHistoryView } from "../components/HistoryNav.tsx";
import type { FinalView, GameView } from "../game.ts";
import { seenKey } from "../hooks.ts";
import { Hud } from "./Hud.tsx";

/** Which colour each team has: teams[0] had the move when the final started. */
export function teamSides(f: FinalView): ["w" | "b", "w" | "b"] {
  const now = sideToMove(f.board.fen);
  const first = f.turn % 2 === 0 ? now : now === "w" ? "b" : "w";
  return [first, first === "w" ? "b" : "w"];
}

const avgText = (avg: number | null) => (avg === null ? "—" : avg.toFixed(1));

/**
 * The 2v2 final, watching: the two teams (teammates alternate their side's
 * moves), whose turn it is, each finalist's average loss (lowest wins the
 * match), and the move just played.
 */
export function FinalScreen({ match, final }: { match: GameView; final: FinalView }) {
  const sides = teamSides(final);
  const history = useHistoryView(final.board.history);
  const orientation = (() => {
    const mine = final.teams.findIndex((t) => t.some((id) => match.isYou(id)));
    return (mine >= 0 ? sides[mine] : "w") === "w" ? "white" : "black";
  })();
  const leader = [...final.order]
    .filter((id) => final.scores[id]?.avg !== null)
    .sort((a, b) => final.scores[a]!.avg! - final.scores[b]!.avg!)[0];
  useEffect(() => {
    // Everyone watches the final board, so nothing needs replaying on your turn.
    match.seen.set(seenKey(final.board), final.board.ply);
  }, [final.turn]);

  return (
    <div class="screen game final-screen">
      <Hud match={match} />
      <div class="board-area">
        <div class="opening-name">
          <strong>FINAL · 2v2</strong> · move {Math.min(final.turn + (final.mover ? 1 : 0), final.totalTurns)} of {final.totalTurns}
        </div>
        <div class="board-row">
          <EvalBar fen={history.fen ?? final.board.fen} orientation={orientation === "white" ? "w" : "b"} evaluate={(f) => match.evaluate(f)} />
          <Board
            fen={history.fen ?? final.board.fen}
            orientation={orientation}
            lastMove={history.browsing ? history.lastMove : final.board.lastMove}
          />
        </div>
        <HistoryNav view={history} total={final.board.history.length} />
      </div>
      <div class="final-panel">
        <div class="final-last" role="status">
          {final.mover ? (
            final.last && Date.now() ? (
              <>
                <strong>{match.isYou(final.last.playerId) ? "You" : match.nameOf(final.last.playerId)}</strong> played{" "}
                <strong>{final.last.san}</strong>{" "}
                <span class={final.last.loss === null ? "bad" : final.last.loss < 0.5 ? "good" : final.last.loss > 5 ? "bad" : ""}>
                  {final.last.loss === null ? "missed" : final.last.loss < 0.05 ? "best move" : `−${final.last.loss.toFixed(1)}`}
                </span>
                <div class="muted small">
                  Next: {match.isYou(final.mover) ? "your move" : `${match.nameOf(final.mover)} is thinking…`}
                </div>
              </>
            ) : (
              <>
                <span class="waiting-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>{" "}
                {match.isYou(final.mover) ? "Your move" : `${match.nameOf(final.mover)} is thinking…`}
              </>
            )
          ) : (
            "The final is over."
          )}
        </div>
        <div class="final-teams">
          {final.teams.map((team, t) => (
            <div key={t} class={`final-team side-${sides[t]}`}>
              <div class="final-team-head">
                <span class={`side-chip ${sides[t]}`} aria-hidden="true" />
                Team {t + 1} · {sides[t] === "w" ? "White" : "Black"}
              </div>
              {team.map((id) => (
                <div key={id} class={`final-player${match.isYou(id) ? " you" : ""}${final.mover === id ? " to-move" : ""}`}>
                  <span class="final-name">
                    {leader === id && <span title="Lowest average loss so far">👑 </span>}
                    {match.isYou(id) ? "You" : match.nameOf(id)}
                  </span>
                  <span class="final-avg" title="Average loss per move in the final (lower is better)">
                    {avgText(final.scores[id]?.avg ?? null)}
                  </span>
                  <span class="muted small">
                    {final.scores[id]?.moves ?? 0} {(final.scores[id]?.moves ?? 0) === 1 ? "move" : "moves"}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p class="muted small">
          Teammates take turns moving for their side. The lowest average loss per move wins the match; the game's result only
          breaks a tie.
        </p>
      </div>
    </div>
  );
}
