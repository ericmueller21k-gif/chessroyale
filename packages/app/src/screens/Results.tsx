import { applyMove } from "@chessroyale/chess";
import { MiniBoard } from "../components/MiniBoard.tsx";
import { elimination, lossRows, myTeam, scoreDp, type GameView } from "../game.ts";
import { useState } from "preact/hooks";
import { Breakdown } from "../components/Breakdown.tsx";
import { ordinal } from "./StageBreak.tsx";
import { GodKingEpilogue, LastStandCard } from "../components/LastStand.tsx";
import { PlayerName } from "../components/PlayerName.tsx";
import { ChatSection } from "../components/QuickChat.tsx";
import { bossInText, crowdFinalists, rankedMinHumans } from "@chessroyale/core";
import { BossCharacter, hasCharacter } from "../components/BossCharacter.tsx";
import { FlagIcon } from "../components/MatchMenu.tsx";

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
  // (The bullet clock ran out: the Hidden Boss won on time.)
  const onTime = match.phase.kind === "results" && !!match.phase.timeout;
  // (Chub & Chirp's Carrot Patch: they pulled their fifth carrot.)
  const byCarrots = match.phase.kind === "results" && !!match.phase.carrots;
  // (The Hidden Boss's phase 2: how many of the four boards were won.)
  const simul = match.phase.kind === "results" ? match.phase.simul : undefined;
  // Boss battle: those still standing at the end share the result (a raid's whole crowd fought; the Crowd's, its
  // finalists: crowdFinalists, the top 4).
  const survived = !!match.boss && !match.boss.kills.some((k) => match.isYou(k.id)) && (match.boss.raid || placement <= crowdFinalists("boss"));
  const me = standings.find((s) => s.isYou);
  const scariest = standings
    .filter((s) => s.rating !== null)
    .sort((a, b) => b.rating! - a.rating!)
    .slice(0, 3);
  // A boss battle is won or lost against the boss: your place is only your rank in the crowd. (Alone, you're always
  // "1st of 1", which used to read "You won the match!" right above "The Iron Bishop won.")
  const alone = !!bossResult && match.totalPlayers === 1;
  // You left before the end: you resigned (a loss), or you were already out (your place stood; no winner yet).
  const left = match.phase.kind === "results" ? match.phase.left : undefined;
  const resigned = left?.how === "resigned";
  const topName = (() => {
    const w = standings.find((s) => s.placement === 1);
    return w ? <PlayerName name={winner} uid={w.uid} bot={w.isBot} /> : winner;
  })();
  return (
    <div class="screen results">
      <div class={`trophy${resigned ? " resigned" : ""}`} aria-hidden="true">
        {resigned ? <FlagIcon size={56} /> : bossResult ? (bossResult === "crowd" ? "🏆" : bossResult === "boss" ? "💀" : "🤝") : placement === 1 ? "🏆" : placement <= 4 ? "🥈" : "♟️"}
      </div>
      <h1>
        {resigned ? (
          "You resigned"
        ) : alone ? (
          bossResult === "crowd" ? "Victory!" : bossResult === "boss" ? "Defeated" : "A draw"
        ) : (
          <>
            {placement}
            {ordinal(placement)} of {match.totalPlayers}
          </>
        )}
      </h1>
      {left ? (
        // (Your place when you left; the match went on without you, or, solo, stopped there. Boss alone: the boss's line
        // below says who won.)
        !alone && (
          <p class="muted left-line">
            {resigned
              ? `Out in ${placement}${ordinal(placement)} place of ${match.totalPlayers}.${
                  !match.serverPaced ? "" : left.bot ? " A bot plays your seat." : " The match goes on without you."
                }`
              : "You left before the end. Your place stands."}
          </p>
        )
      ) : !alone && (
        <p class="muted">
          {bossResult ? (
            placement === 1 ? (
              "You were the best in the crowd."
            ) : (
              <>{topName} was the best in the crowd.</>
            )
          ) : placement === 1 ? (
            "You won the match!"
          ) : (
            <>{topName} won the match.</>
          )}
        </p>
      )}
      {/* A boss with a character takes its bow: knocked off its pogo, or bouncing in triumph. */}
      {bossResult && match.boss && <BossCharacter match={match} place="results" />}
      {bossResult && match.boss && (
        <p class={`team-result ${bossResult === "crowd" && survived ? "good" : bossResult === "boss" ? "bad" : ""}`}>
          {hasCharacter(match) ? null : <>{match.boss.icon} </>}
          {simul
            ? // (The Hidden Boss's phase 2: every board must be won.)
              simul.won === simul.of
              ? `You beat ${bossInText(match.boss.name)} on all ${simul.of} boards!`
              : `${bossInText(match.boss.name, true)} won. You won ${simul.won} of ${simul.of} boards: all ${simul.of} must be won.`
            : bossResult === "crowd"
            ? `${alone ? "You" : "The crowd"} beat ${bossInText(match.boss.name)}!${survived ? " A win on your record." : ""}`
            : bossResult === "boss"
              ? `${bossInText(match.boss.name, true)} won${onTime ? " on time" : byCarrots ? " with their fifth carrot" : ""}.`
              : `A draw with ${bossInText(match.boss.name)}.`}
        </p>
      )}
      {/* After his Last Stand: he rises again if the crowd won; otherwise he stays down. */}
      {bossResult && match.boss?.lastStand && <GodKingEpilogue side={match.boss.crowdSide} rises={bossResult === "crowd"} />}
      {/* What he saved you from: the blunder, the boss's reply, the best move, your chances (tap to open). */}
      {bossResult && match.boss?.lastStand?.fen && <LastStandCard stand={match.boss.lastStand} side={match.boss.crowdSide} />}
      {/* You resigned: a loss on your record. */}
      {resigned && <p class="team-result bad">It counts as a loss.</p>}
      {team && !bossResult && !left && (
        <p class={`team-result ${gameWinner === team ? "good" : gameWinner ? "bad" : ""}`}>
          {gameWinner === team
            ? `Your team (${team === "w" ? "White" : "Black"}) won the game: a win on your record.`
            : gameWinner
              ? `Your team (${team === "w" ? "White" : "Black"}) lost the game.`
              : "The game was a draw."}
        </p>
      )}
      {/* Whether it counted for your ranking, in words (the rule: RANKING in settings.ts). */}
      {match.ranked === false && (
        <p class="results-unranked">
          {match.serverPaced
            ? `Unranked: fewer than ${rankedMinHumans(match.settings.lobbySize)} real players, so your ranking didn't change.`
            : "Unranked: solo games don't count for ranking."}
        </p>
      )}
      {/* Online: quick chat, for the GGs. */}
      <ChatSection match={match} />
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
      {/* (Boss alone: you'd be the whole list.) */}
      {scariest.length > 0 && !alone && (
        <div class="scariest">
          <h2 class="small muted">Most dangerous players this match</h2>
          <ol>
            {scariest.map((s) => (
              <li key={s.id} class={s.isYou ? "you" : ""}>
                <PlayerName name={s.name} uid={s.uid} you={s.isYou} bot={s.isBot} />
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
          {lossRows(match).map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{r.avg.toFixed(1)} pts</td>
            </tr>
          ))}
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
      {review && <Breakdown moves={match.moves} you={elim?.you} line={elim?.line} placement={elim ? placement : null} lastCut={elim?.lastCut} onClose={() => setReview(false)} dp={scoreDp(match.settings)} />}
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
