  return (
    <div class={`screen results mm-screen${bossResult ? " boss-results" : ""}`}>
      {/* (The top part: a box of its own only on a computer, where a boss battle's review sits beside it.) */}
      <div class="results-top">
        <div class="mm-corner">
          <MatchMenu exit={exitFor(match)} />
        </div>
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
          <button type="button" class="btn btn-primary" onClick={onAgain}>
            Play again
          </button>
        </div>
      </div>
      {/* A boss battle's review: every move, on the page (the first costly move's board open), no tap needed (Eric's brief). */}
      {bossResult && played.some((m) => m.bestMove) && (
        <div class="results-review">
          <Breakdown inline moves={match.moves} dp={scoreDp(match.settings)} />
        </div>
      )}
      {/* A boss battle that dropped you a token: its box, over the screen (Eric, Nov 2). */}
      {match.settings.raid && <TokenBox match={match} />}
    </div>
  );
}
