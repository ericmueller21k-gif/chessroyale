import { useEffect, useState } from "preact/hooks";
import { applyMove, sideToMove, toSan } from "@chessroyale/chess";
import type { DrawRule } from "@chessroyale/core";
import { Board } from "../components/Board.tsx";
import { RaceTower } from "../components/RaceTower.tsx";
import { ShadeMoves, type ShadeMove } from "../components/ShadeMoves.tsx";
import { cutLabel, type BoardView, type GameView, type GroupReveal } from "../game.ts";
import { seenKey } from "../hooks.ts";
import { play } from "../sound.ts";
import { Hud } from "./Hud.tsx";

const fmt = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);

/** When each beat of the reveal starts (ms). */
const DECIDING_AT = 1900;
const PLAYED_AT = 2700;

/** Why this move continues the board, in a few words. */
function reason(rule: DrawRule, tied: boolean): string {
  if (rule === "popular") return tied ? "tied for most picks, so drawn among those" : "the most popular move in your group";
  if (rule === "best") return tied ? "the best move picked (a tie, drawn among those)" : "the best move in your group";
  if (rule === "weighted") return "drawn at random, with better moves more likely";
  return "drawn at random from your group's picks";
}

/**
 * The round's end: everyone's moves slide in at once as see-through pieces
 * with names over them, then one move is chosen to continue the board and
 * plays, with the reason. Your score and the group's are listed alongside.
 */
export function RevealScreen({ match, mine, board }: { match: GameView; mine: GroupReveal; board: BoardView }) {
  const [beat, setBeat] = useState<"shades" | "deciding" | "played">("shades");
  // You watch the chosen move play here, so it won't be replayed next time you get this board.
  useEffect(() => {
    match.seen.set(seenKey(board), board.ply + 1);
  }, [board]);
  useEffect(() => {
    const a = setTimeout(() => {
      setBeat("deciding");
      play("allIn");
    }, DECIDING_AT);
    const b = setTimeout(() => setBeat("played"), PLAYED_AT);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [mine]);

  const fen = mine.fenBefore;
  const orientation = sideToMove(fen) === "w" ? "white" : "black";
  const me = mine.result.players.find((p) => match.isYou(p.playerId))!;
  const played = beat === "played";

  // One shade per distinct move, with everyone who picked it.
  const byMove = new Map<string, ShadeMove>();
  for (const p of mine.result.players) {
    if (!p.move) continue;
    const s = byMove.get(p.move) ?? { move: p.move, names: [], you: false };
    s.names.push(match.isYou(p.playerId) ? "You" : match.nameOf(p.playerId));
    s.you ||= match.isYou(p.playerId);
    byMove.set(p.move, s);
  }
  const shades = [...byMove.values()];

  const rule = mine.result.drawRule;
  const counts = shades.map((s) => s.names.length);
  const losses = new Map(mine.result.players.flatMap((p) => (p.move && p.loss !== null ? [[p.move, p.loss] as const] : [])));
  const bestLoss = Math.min(...losses.values());
  const tied =
    rule === "popular"
      ? counts.filter((c) => c === Math.max(...counts)).length > 1
      : rule === "best" && [...new Set([...losses].filter(([, l]) => l - bestLoss < 1e-9).map(([m]) => m))].length > 1;
  const drawnBy = mine.result.players.filter((p) => p.move === mine.result.playedMove);
  const yoursDrawn = drawnBy.some((p) => match.isYou(p.playerId));
  const others = drawnBy.filter((p) => !match.isYou(p.playerId)).map((p) => match.nameOf(p.playerId));
  const whose = !drawnBy.length
    ? "the engine's move (nobody picked)"
    : yoursDrawn
      ? others.length
        ? `your pick (and ${others.join(" & ")}'s)`
        : "your pick"
      : `${others.join(" & ")}'s pick`;

  return (
    <div class="screen game" onClick={() => played && match.skipReveal()}>
      <Hud match={match} />
      <div class="board-area">
        <div class="opening-name">{board.openingName}</div>
        <Board
          fen={played ? applyMove(fen, mine.result.playedMove) : fen}
          orientation={orientation}
          lastMove={played ? mine.result.playedMove : board.lastMove}
        >
          {!played && <ShadeMoves fen={fen} moves={shades} orientation={orientation} />}
          {beat === "deciding" && (
            <div class="round-over" role="status">
              <strong>All moves in</strong>
              <span>Choosing the move…</span>
            </div>
          )}
        </Board>
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
                  {played && p.move === mine.result.playedMove && <span title="This move continues the board">▶ </span>}
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
                ▶ The board continues with <strong>{toSan(fen, mine.result.playedMove)}</strong>, {whose}: {reason(rule, tied)}.
              </>
            ) : (
              "Everyone's moves are in. One of them will continue the board…"
            )}
          </span>
          <span class="muted small">
            Your score only depends on your own move. Best was {toSan(fen, mine.bestMove)}.
            {played && !match.serverPaced ? " Tap to continue." : ""}
          </span>
        </div>
        <div class="reveal-tower">
          <RaceTower standings={match.standings()} cutoff={match.cutoff} compact cutLabel={cutLabel(match)} />
        </div>
      </div>
    </div>
  );
}
