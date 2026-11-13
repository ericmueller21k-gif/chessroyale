import { applyMove } from "@chessroyale/chess";
import { WelcomeNotice } from "../components/WelcomeNotice.tsx";
import { MiniBoard } from "../components/MiniBoard.tsx";
import { elimination, lossRows, myTeam, scoreDp, type GameView } from "../game.ts";
import { useState } from "preact/hooks";
import { Breakdown } from "../components/Breakdown.tsx";
import { ordinal } from "./StageBreak.tsx";
import { LastStandCard } from "../components/LastStand.tsx";
import { PlayerName } from "../components/PlayerName.tsx";
import { ChatSection, useMedia } from "../components/QuickChat.tsx";
import { bossInText, crowdFinalists, rankedMinHumans } from "@chessroyale/core";
import { BossTag, hasCharacter } from "../components/BossCharacter.tsx";
import { ResultDuo } from "../components/ResultDuo.tsx";
import { FlagIcon, MOUSE_LAYOUT, MatchMenu } from "../components/MatchMenu.tsx";
import { exitFor } from "../match-exit.ts";
import { TokenBox } from "../components/TokenBox.tsx";
import { XpResult, useGameXp } from "../components/XpResult.tsx";
import { NO_RESULT_LINE } from "./Recluse2.tsx";

/** An online match where one device's word stood alone (LobbyRecord.unvouched: nobody could check a host's scores or the boss's move). */
export const UNVOUCHED_LINE = "Only one device checked this match: it pays as a solo game.";

export function ResultsScreen({ match, placement, winner, onAgain, onHome, homeText = "Home" }: { match: GameView; placement: number; winner: string; onAgain: () => void; onHome: () => void; /** Its leaving button's words: "Back to town" after a boss challenged in the town. */ homeText?: string }) {
  const played = match.moves.filter((m) => m.move !== null);
  const [review, setReview] = useState(false);
  // XP (Nov 9): an online game's by its lobby code, as its room writes it; a solo game's with its result (App.tsx).
  const xp = useGameXp(match, match.serverPaced ? { code: (match as { code?: string }).code ?? null } : { solo: true });
  // A computer has the side bar (its Settings); a boss battle's gear is left out there (Eric, round 2).
  const sidebar = useMedia(MOUSE_LAYOUT);
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
  // (Hollow in Boss alone: the last of your ten bulbs went out.)
  const byBlackout = match.phase.kind === "results" && !!match.phase.blackout;
  // (The Hidden Boss's phase 2: how many of the four boards were won; or no result, his move never came from the engine server.)
  const simul = match.phase.kind === "results" ? match.phase.simul : undefined;
  const noResult = match.phase.kind === "results" && !!match.phase.noResult;
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
  // (Crowd 50 v 50's removal for being away counts as resigning: CrowdMisses.)
  const afk = left?.how === "afk";
  const resigned = left?.how === "resigned" || afk;
  const topName = (() => {
    const w = standings.find((s) => s.placement === 1);
    return w ? <PlayerName name={winner} uid={w.uid} bot={w.isBot} /> : winner;
  })();
  return (
    <div class={`screen results mm-screen${bossResult ? " boss-results" : ""}`}>
      {/* (The top part: a box of its own only on a computer, where a boss battle's review sits beside it.) */}
      <div class="results-top">
        {!(bossResult && sidebar) && (
          <div class="mm-corner">
            <MatchMenu exit={exitFor(match)} />
          </div>
        )}
        {/* (A boss battle has no trophy and no skull above its title: Eric, Nov 7.) */}
        {!bossResult && (
          <div class={`trophy${resigned ? " resigned" : ""}`} aria-hidden="true">
            {resigned ? <FlagIcon size={56} /> : placement === 1 ? "🏆" : placement <= 4 ? "🥈" : "♟️"}
          </div>
        )}
        {/* (A boss battle's title: the God King's pixel type, Eric, Nov 7.) */}
        <h1 class={bossResult ? "boss-title" : undefined}>
          {afk ? (
            "Removed for being away"
          ) : resigned ? (
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
                ? `${afk ? `You missed ${left.misses ?? 0} moves. ` : ""}Out in ${placement}${ordinal(placement)} place of ${match.totalPlayers}.${
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
        {/* The boss on the left (his bow, or his attack on you if he won), your pawn on the right with your XP under it; no God
            King (Eric, Nov 9: ResultDuo). */}
        {bossResult && match.boss && <ResultDuo match={match} result={bossResult} xp={xp} />}
        {bossResult && match.boss && (
          <p class={`team-result ${noResult ? "" : bossResult === "crowd" && survived ? "good" : bossResult === "boss" ? "bad" : ""}`}>
            {hasCharacter(match) ? null : <><BossTag boss={match.boss} /> </>}
            {noResult
              ? `${NO_RESULT_LINE} Nothing counts for or against anyone.`
              : simul
              ? // (The Hidden Boss's phase 2: every board must be won.)
                simul.won === simul.of
                ? `You beat ${bossInText(match.boss.name)} on all ${simul.of} boards!`
                : `${bossInText(match.boss.name, true)} won. You won ${simul.won} of ${simul.of} boards: all ${simul.of} must be won.`
              : bossResult === "crowd"
              ? `${alone ? "You" : "The crowd"} beat ${bossInText(match.boss.name)}!`
              : bossResult === "boss"
                ? `${bossInText(match.boss.name, true)} won${onTime ? " on time" : byCarrots ? " with their fifth carrot" : byBlackout ? ": the last of your ten bulbs went out" : ""}.`
                : `A draw with ${bossInText(match.boss.name)}.`}
          </p>
        )}
        {/* What he saved you from: the blunder, the boss's reply, the best move, your chances (tap to open). */}
        {bossResult && match.boss?.lastStand?.fen && <LastStandCard stand={match.boss.lastStand} side={match.boss.crowdSide} />}
        {/* You resigned: a loss on your record (a boss battle says nothing of the record: its counts just move, Eric, Nov 7). */}
        {resigned && !bossResult && <p class="team-result bad">It counts as a loss.</p>}
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
        {/* (A boss battle's solo note: it says nothing of ranking, Eric, Nov 8; a lobby's line stays.) */}
        {/* (One device's word stood alone somewhere in it: why it pays as a solo game, in place of the unranked line.) */}
        {match.unvouched && !noResult && <p class="results-unranked">{UNVOUCHED_LINE}</p>}
        {match.ranked === false && !match.unvouched && !noResult && (match.serverPaced || !bossResult) && (
          <p class="results-unranked">
            {match.serverPaced
              ? `Unranked: fewer than ${rankedMinHumans(match.settings.lobbySize)} real players, so your ranking didn't change.`
              : "Unranked: solo games don't count for ranking."}
          </p>
        )}
        {/* XP (Nov 9): the bar filling from your old XP to the new, on every result screen (a boss battle's: under your pawn). */}
        {!(bossResult && match.boss) && <XpResult xp={xp} />}
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
        {/* (A boss battle has the review below instead: no stage table, no best and worst boards.) */}
        {!bossResult && (
          <>
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
          </>
        )}
        {avgMs > 0 && <p class="muted small">Scoring took {Math.round(avgMs)} ms per round on this device.</p>}
        <div class="actions">
          {/* (Its words on one line: "Back to town" after a boss challenged in the town.) */}
          <button type="button" class="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={onHome}>
            {homeText}
          </button>
          {/* (A boss battle's two buttons on one line, as Home's: the review's narrower column wrapped "Play again".) */}
          <button type="button" class="btn btn-primary" style={bossResult ? { whiteSpace: "nowrap" } : undefined} onClick={onAgain}>
            Play again
          </button>
        </div>
      </div>
      {/* A boss battle's review: every move, on the page (the first costly move's board open), no tap needed (Eric's brief). */}
      {bossResult && played.some((m) => m.bestMove) && (
        <div class="results-review">
          <Breakdown inline moves={match.moves} dp={scoreDp(match.settings)} solo={!match.serverPaced} />
        </div>
      )}
      {/* A boss battle that dropped you a token: its box, over the screen (Eric, Nov 2). */}
      {match.settings.raid && <TokenBox match={match} />}
      {/* (A finished game may have earned the Welcome Crate, Nov 6: its one-time notice, asked for again as the result is saved.) */}
      <WelcomeNotice refresh />
    </div>
  );
}
