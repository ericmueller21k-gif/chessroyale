import { useEffect, useState } from "preact/hooks";
import { applyMove, sideToMove, toSan } from "@chessroyale/chess";
import { Board, type Arrow } from "../components/Board.tsx";
import { RaceTower } from "../components/RaceTower.tsx";
import { cutLabel, type BoardView, type GameView, type GroupReveal } from "../game.ts";
import { seenKey } from "../hooks.ts";
import { Hud } from "./Hud.tsx";

const fmt = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);

/** The group's picks as arrows with each pick's loss, your score, then the drawn move plays. */
export function RevealScreen({ match, mine, board }: { match: GameView; mine: GroupReveal; board: BoardView }) {
  const [played, setPlayed] = useState(false);
  // You watch the drawn move play here, so it won't be replayed next time you get this board.
  useEffect(() => {
    match.seen.set(seenKey(board), board.ply + 1);
  }, [board]);
  useEffect(() => {
    const t = setTimeout(() => setPlayed(true), 1800);
    return () => clearTimeout(t);
  }, [mine]);

  const fen = mine.fenBefore;
  const me = mine.result.players.find((p) => match.isYou(p.playerId))!;
  const mineIsBest = me.move === mine.bestMove;
  const arrows: Arrow[] = played
    ? []
    : [
        { move: mine.bestMove, brush: "green", label: mineIsBest ? "You ★" : "★" },
        ...(me.move && !mineIsBest ? [{ move: me.move, brush: "blue" as const, label: "You" }] : []),
        ...mine.result.players
          .filter((p) => p.move && p.move !== mine.bestMove && p.move !== me.move)
          .map((p) => ({ move: p.move!, brush: "paleGrey" as const })),
      ];
  const drawnBy = mine.result.players.filter((p) => p.move === mine.result.playedMove);
  const yoursDrawn = drawnBy.some((p) => match.isYou(p.playerId));
  const others = drawnBy.filter((p) => !match.isYou(p.playerId)).map((p) => match.nameOf(p.playerId));
  const whose = !drawnBy.length ? "the engine's move (nobody picked)" : yoursDrawn ? (others.length ? `your pick (and ${others.join(" & ")}'s)` : "your pick") : `${others.join(" & ")}'s pick`;

  return (
    <div class="screen game" onClick={() => played && match.skipReveal()}>
      <Hud match={match} />
      <div class="board-area">
        <div class="opening-name">{board.openingName}</div>
        <Board
          fen={played ? applyMove(fen, mine.result.playedMove) : fen}
          orientation={sideToMove(fen) === "w" ? "white" : "black"}
          lastMove={played ? mine.result.playedMove : board.lastMove}
          arrows={arrows}
        />
      </div>
      <div class="reveal">
        <div class={`round-score ${me.roundScore >= 0 ? "good" : "bad"}`}>
          {fmt(me.roundScore)}
          <span class="round-score-label">{me.move ? "this round" : "missed move"}</span>
        </div>
        <ul class="picks">
          {mine.result.players
            .slice()
            .sort((a, b) => (a.loss ?? 999) - (b.loss ?? 999))
            .map((p) => (
              <li key={p.playerId} class={match.isYou(p.playerId) ? "you" : ""}>
                <span class="pick-name">
                  {played && p.move === mine.result.playedMove && <span title="This pick continues the board">🎲 </span>}
                  {match.nameOf(p.playerId)}
                </span>
                <span class="pick-move">{p.move ? toSan(fen, p.move) : "no move"}</span>
                <span class="pick-loss">{p.loss === null ? "−25 pts" : p.loss < 0.05 ? "best" : `−${p.loss.toFixed(1)}`}</span>
              </li>
            ))}
        </ul>
        <div class="drawn">
          <span class="drawn-main">
            {played ? (
              <>
                🎲 The board continues with <strong>{toSan(fen, mine.result.playedMove)}</strong>, {whose}.
              </>
            ) : (
              "🎲 Drawing one of your group's moves to continue the board…"
            )}
          </span>
          <span class="muted small">
            One pick per group is drawn at random to carry on the game. Your score only depends on your own move. Best was{" "}
            {toSan(fen, mine.bestMove)}.{played && !match.serverPaced ? " Tap to continue." : ""}
          </span>
        </div>
        <div class="reveal-tower">
          <RaceTower standings={match.standings()} cutoff={match.cutoff} compact cutLabel={cutLabel(match)} />
        </div>
      </div>
    </div>
  );
}
