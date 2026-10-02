import { useEffect, useState } from "preact/hooks";
import { applyMove, sideToMove, toSan } from "@chessroyale/chess";
import { Board, type Arrow } from "../components/Board.tsx";
import type { BoardView, GameView, GroupReveal } from "../game.ts";
import { Hud } from "./Hud.tsx";

const fmt = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);

/** The group's picks as arrows with each pick's loss, your score, then the drawn move plays. */
export function RevealScreen({ match, mine, board }: { match: GameView; mine: GroupReveal; board: BoardView }) {
  const [played, setPlayed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPlayed(true), 1800);
    return () => clearTimeout(t);
  }, [mine]);

  const fen = mine.fenBefore;
  const me = mine.result.players.find((p) => match.isYou(p.playerId))!;
  const arrows: Arrow[] = played
    ? []
    : [
        { move: mine.bestMove, brush: "green" },
        ...mine.result.players
          .filter((p) => p.move && p.move !== mine.bestMove)
          .map((p) => ({ move: p.move!, brush: match.isYou(p.playerId) ? ("blue" as const) : ("paleGrey" as const) })),
      ];
  const playedBy = mine.result.players.filter((p) => p.move === mine.result.playedMove).map((p) => match.nameOf(p.playerId));

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
                <span class="pick-name">{match.nameOf(p.playerId)}</span>
                <span class="pick-move">{p.move ? toSan(fen, p.move) : "no move"}</span>
                <span class="pick-loss">{p.loss === null ? "−25 pts" : p.loss < 0.05 ? "best" : `−${p.loss.toFixed(1)}`}</span>
              </li>
            ))}
        </ul>
        <div class="muted small">
          Best was {toSan(fen, mine.bestMove)}.{" "}
          {played ? `Played: ${toSan(fen, mine.result.playedMove)}${playedBy.length ? ` (${playedBy.join(" & ")})` : " (engine)"}. Tap to continue.` : "Drawing a pick to play…"}
        </div>
      </div>
    </div>
  );
}
