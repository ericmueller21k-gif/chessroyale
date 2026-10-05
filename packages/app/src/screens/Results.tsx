import { applyMove } from "@chessroyale/chess";
import { MiniBoard } from "../components/MiniBoard.tsx";
import { elimination, myTeam, type GameView } from "../game.ts";
import { useState } from "preact/hooks";
import { Breakdown } from "../components/Breakdown.tsx";
import { ordinal } from "./StageBreak.tsx";

export function ResultsScreen({ match, placement, winner, onAgain, onHome }: { match: GameView; placement: number; winner: string; onAgain: () => void; onHome: () => void }) {
  const played = match.moves.filter((m) => m.move !== null);
  const [review, setReview] = useState(false);
  // Out at a cut (Crowd): the breakdown measures you against the line you missed.
  const elim = elimination.current;
  const best = [...played].sort((a, b) => b.roundScore - a.roundScore)[0];
  const worst = [...played].sort((a, b) => a.roundScore - b.roundScore)[0];
  const avgMs = match.scoringMs.length ? match.scoringMs.reduce((a, b) => a + b, 0) / match.scoringMs.length : 0;
  const standings = match.standings();
  const team = myTeam(match);
  const gameWinner = match.phase.kind === "results" ? match.phase.gameWinner : undefined;
  const bossResult = match.phase.kind === "results" ? match.phase.bossResult : undefined;
  // Boss battle: those still standing at the end share the result.
  const survived = !!match.boss && !match.boss.kills.some((k) => match.isYou(k.id)) && placement <= 10;
  const me = standings.find((s) => s.isYou);
  const scariest = standings
    .filter((s) => s.rating !== null)
    .sort((a, b) => b.rating! - a.rating!)
    .slice(0, 3);
  return (
    <div class="screen results">
      <div class="trophy" aria-hidden="true">
        {placement === 1 ? "🏆" : placement <= 4 ? "🥈" : "♟️"}
      </div>
      <h1>
        {placement}
        {ordinal(placement)} of {match.totalPlayers}
      </h1>
      <p class="muted">{placement === 1 ? "You won the match!" : `${winner} won the match.`}</p>
      {bossResult && match.boss && (
        <p class={`team-result ${bossResult === "crowd" && survived ? "good" : bossResult === "boss" ? "bad" : ""}`}>
          {match.boss.icon}{" "}
          {bossResult === "crowd"
            ? `The crowd beat ${match.boss.name}!${survived ? " A win on your record." : ""}`
            : bossResult === "boss"
              ? `${match.boss.name} won.`
              : `A draw with ${match.boss.name}.`}
        </p>
      )}
      {team && !bossResult && (
        <p class={`team-result ${gameWinner === team ? "good" : gameWinner ? "bad" : ""}`}>
          {gameWinner === team
            ? `Your team (${team === "w" ? "White" : "Black"}) won the game: a win on your record.`
            : gameWinner
              ? `Your team (${team === "w" ? "White" : "Black"}) lost the game.`
              : "The game was a draw."}
        </p>
      )}
      {me && (
        <div class="stat-tiles">
          <div class="stat-tile">
            <span class="stat-value">{me.rating ?? "—"}</span>
            <span class="stat-label">Engine rating (est.)</span>
          </div>
          <div class="stat-tile">
            <span class="stat-value">{(me.avgThinkMs / 1000).toFixed(1)} s</span>
            <span class="stat-label">Average time per move</span>
          </div>
          <div class="stat-tile">
            <span class="stat-value">{me.powerUpsUsed}</span>
            <span class="stat-label">Power-ups used</span>
          </div>
        </div>
      )}
      {scariest.length > 0 && (
        <div class="scariest">
          <h2 class="small muted">Most dangerous players this match</h2>
          <ol>
            {scariest.map((s) => (
              <li key={s.id} class={s.isYou ? "you" : ""}>
                <span>{s.name}</span>
                <strong>{s.rating}</strong>
              </li>
            ))}
          </ol>
        </div>
      )}
      <table class="stage-table">
        <thead>
          <tr>
            <th>Stage</th>
            <th>Average loss per move</th>
          </tr>
        </thead>
        <tbody>
          {match.lossesByStage.map((l, i) =>
            l.length ? (
              <tr key={i}>
                <td>{i < match.settings.knockoutsPerStage.length ? `Stage ${i + 1}` : "Duel"}</td>
                <td>{(l.reduce((a, b) => a + b, 0) / l.length).toFixed(1)} pts</td>
              </tr>
            ) : null,
          )}
        </tbody>
      </table>
      <p class="muted small">Lower is better: 0 means you matched the engine's best move.</p>
      <div class="best-worst">
        {best && (
          <div>
            <h2>Best move</h2>
            <MiniBoard fen={applyMove(best.fen, best.move!)} lastMove={best.move} orientation={best.fen.split(" ")[1] === "w" ? "white" : "black"} />
            <p>
              {best.san}: {best.roundScore >= 0 ? "+" : ""}
              {best.roundScore.toFixed(1)}
            </p>
          </div>
        )}
        {worst && worst !== best && (
          <div>
            <h2>Worst move</h2>
            <MiniBoard fen={applyMove(worst.fen, worst.move!)} lastMove={worst.move} orientation={worst.fen.split(" ")[1] === "w" ? "white" : "black"} />
            <p>
              {worst.san}: {worst.roundScore.toFixed(1)}
            </p>
          </div>
        )}
      </div>
      {played.some((m) => m.bestMove) && (
        <button type="button" class="btn btn-secondary btn-wide" onClick={() => setReview(true)}>
          {elim ? "Why you went out" : "Your game, move by move"}
        </button>
      )}
      {review && <Breakdown moves={match.moves} you={elim?.you} line={elim?.line} placement={elim ? placement : null} onClose={() => setReview(false)} />}
      {avgMs > 0 && <p class="muted small">Scoring took {Math.round(avgMs)} ms per round on this device.</p>}
      <div class="actions">
        <button type="button" class="btn btn-secondary" onClick={onHome}>
          Home
        </button>
        <button type="button" class="btn btn-primary" onClick={onAgain}>
          Play again
        </button>
      </div>
    </div>
  );
}
