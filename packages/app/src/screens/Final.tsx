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
  // Team final and duel: the whole match counts (average loss per move over every move); classic: the final's moves.
  const whole = final.format === "team" || final.format === "duel";
  const quality = (id: string) => (whole ? final.scores[id]?.matchLoss : final.scores[id]?.avg) ?? null;
  const leader = [...final.order].filter((id) => quality(id) !== null).sort((a, b) => quality(a)! - quality(b)!)[0];
  const size = final.teams[0].length;
  const title = final.format === "duel" ? "DUEL · 1v1" : `FINAL · ${size}v${size}`;
  const justOut = final.justOut ?? [];
  useEffect(() => {
    // Everyone watches the final board, so nothing needs replaying on your turn.
    match.seen.set(seenKey(final.board), final.board.ply);
  }, [final.turn]);

  return (
    <div class="screen game final-screen">
      <Hud match={match} />
      <div class="board-area">
        <div class="opening-name">
          <strong>{title}</strong> ·{" "}
          {whole ? (
            <>
              move {final.turn + (final.mover ? 1 : 0)}
              {final.cutIn != null ? ` · next cut in ${final.cutIn}` : " · to the end"}
            </>
          ) : (
            <>
              move {Math.min(final.turn + (final.mover ? 1 : 0), final.totalTurns)} of {final.totalTurns}
            </>
          )}
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
        {justOut.length > 0 && (
          <div class="final-cut" role="alert">
            ❌ <strong>{justOut.map((id) => (match.isYou(id) ? "You" : match.nameOf(id))).join(" and ")}</strong>{" "}
            {justOut.length === 1 && !match.isYou(justOut[0]!) ? "is" : "are"} out: the weakest on {justOut.length === 1 ? "their" : "each"} side over the match.
          </div>
        )}
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
                  <span class="final-avg" title={whole ? "Average loss per move over the whole match (lower is better)" : "Average loss per move in the final (lower is better)"}>
                    {avgText(quality(id))}
                  </span>
                  <span class="muted small">
                    {whole && final.scores[id]?.rating ? `${final.scores[id]!.rating} rated` : `${final.scores[id]?.moves ?? 0} ${(final.scores[id]?.moves ?? 0) === 1 ? "move" : "moves"}`}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
        {(final.out?.length ?? 0) > 0 && (
          <div class="final-outs">
            <span class="muted small">Out:</span>
            {final.out!.map((o) => (
              <span key={o.id} class={`final-out-name${match.isYou(o.id) ? " you" : ""}`}>
                {match.isYou(o.id) ? "You" : match.nameOf(o.id)}
              </span>
            ))}
          </div>
        )}
        <p class="muted small">
          {final.format === "duel"
            ? "The best player on each side, one on one, to the end of the game. The winner of the game wins the match."
            : final.format === "team"
              ? "Teammates take turns for their side. After each round of turns the weakest on each side goes out (average loss over the whole match), down to 2v2, which plays to the end. Winning the game goes on both teammates' records; your own move quality places you."
              : "Teammates take turns moving for their side. The lowest average loss per move wins the match; the game's result only breaks a tie."}
        </p>
      </div>
    </div>
  );
}
