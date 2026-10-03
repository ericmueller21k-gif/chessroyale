import { useEffect, useMemo, useState } from "preact/hooks";
import { applyMove, sideToMove, toSan } from "@chessroyale/chess";
import type { DrawRule } from "@chessroyale/core";
import { Board } from "../components/Board.tsx";
import { MiniTower } from "../components/MiniTower.tsx";
import { ShadeMoves, SquareRing, type ShadeMove } from "../components/ShadeMoves.tsx";
import { type BoardView, type GameView, type GroupReveal } from "../game.ts";
import { seenKey } from "../hooks.ts";
import { play } from "../sound.ts";
import { Hud } from "./Hud.tsx";

const fmt = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);

/** Why this move continues the board, in a few words. */
function reason(rule: DrawRule, tied: boolean): string {
  if (rule === "popular") return tied ? "tied for most picks, so drawn among those" : "the most popular move in your group";
  if (rule === "best") return tied ? "the best move picked (a tie, drawn among those)" : "the best move in your group";
  if (rule === "weighted") return "drawn at random, with better moves more likely";
  return "drawn at random from your group's picks";
}

/**
 * The reveal's timeline (ms from when it appears), fitted into the time until
 * the next board: everyone's moves slide in, a "selecting" reel ticks across
 * them (a rising roulette blip per step) and lands on the chosen move (it
 * blinks three times with three tones), then the move plays and stays on show
 * until the next board comes up (which opens with its own "Round start" 3-2-1).
 */
function timeline(total: number) {
  const shadesEnd = Math.min(2200, total * 0.25);
  const reelEnd = shadesEnd + Math.min(2000, total * 0.24);
  const playAt = reelEnd + 800;
  return { shadesEnd, reelEnd, playAt };
}

/** Reel steps that slow down and end on `target`: the index on show at each step and when it starts. */
function reelSteps(count: number, target: number, duration: number): { index: number; at: number }[] {
  const n = count > 1 ? Math.max(7, Math.min(14, count * 3)) : 3;
  // Delays grow geometrically (a reel slowing down), scaled to fill the duration.
  const raw = Array.from({ length: n }, (_, i) => Math.pow(1.22, i));
  const scale = duration / raw.reduce((s, x) => s + x, 0);
  let t = 0;
  const start = (((target - (n - 1)) % count) + count) % count;
  return raw.map((d, i) => {
    const step = { index: (start + i) % count, at: t };
    t += d * scale;
    return step;
  });
}

export function RevealScreen({ match, mine, board, until }: { match: GameView; mine: GroupReveal; board: BoardView; until: number }) {
  const [start] = useState(Date.now());
  const total = Math.max(3000, until - start);
  const { shadesEnd, reelEnd, playAt } = timeline(total);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(t);
  }, []);
  const elapsed = now - start;
  // You watch the chosen move play here, so it won't be replayed next time you get this board.
  useEffect(() => {
    match.seen.set(seenKey(board), board.ply + 1);
  }, [board]);

  const fen = mine.fenBefore;
  const orientation = sideToMove(fen) === "w" ? "white" : "black";
  const me = mine.result.players.find((p) => match.isYou(p.playerId))!;

  // One shade per distinct move, with everyone who picked it.
  const shades = useMemo(() => {
    const byMove = new Map<string, ShadeMove>();
    for (const p of mine.result.players) {
      if (!p.move) continue;
      const s = byMove.get(p.move) ?? { move: p.move, names: [], you: false };
      s.names.push(match.isYou(p.playerId) ? "You" : match.nameOf(p.playerId));
      s.you ||= match.isYou(p.playerId);
      byMove.set(p.move, s);
    }
    return [...byMove.values()];
  }, [mine]);
  const chosenIndex = Math.max(0, shades.findIndex((s) => s.move === mine.result.playedMove));
  const steps = useMemo(() => reelSteps(Math.max(1, shades.length), chosenIndex, reelEnd - shadesEnd), [shades, chosenIndex]);

  const selecting = elapsed >= shadesEnd && elapsed < reelEnd;
  const landed = elapsed >= reelEnd;
  const played = elapsed >= playAt;
  const stepNo = selecting ? steps.filter((s) => shadesEnd + s.at <= elapsed).length - 1 : -1;
  const reelOn = selecting && stepNo >= 0 ? (shades[steps[stepNo]!.index]?.move ?? null) : null;
  // Sounds: a roulette blip per reel step, then three tones as the winner blinks.
  useEffect(() => {
    if (stepNo >= 0) play("reel");
  }, [stepNo]);
  useEffect(() => {
    if (landed) play("select");
  }, [landed]);

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
          {!played && (
            <ShadeMoves fen={fen} moves={shades} orientation={orientation} highlight={reelOn} chosen={landed ? mine.result.playedMove : null} />
          )}
          {played && <SquareRing square={mine.result.playedMove.slice(2, 4)} orientation={orientation} />}
          {selecting && <div class="selecting-label">Selecting move…</div>}
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
              <li key={p.playerId} class={`${match.isYou(p.playerId) ? "you" : ""}${landed && p.move === mine.result.playedMove ? " chosen" : ""}`}>
                <span class="pick-name">{match.nameOf(p.playerId)}</span>
                <span class="pick-move">{p.move ? toSan(fen, p.move) : "no move"}</span>
                <span class="pick-loss">{p.loss === null ? "−25 pts" : p.loss < 0.05 ? "best" : `−${p.loss.toFixed(1)}`}</span>
              </li>
            ))}
        </ul>
        <div class="drawn">
          <span class="drawn-main">
            {landed ? (
              <>
                The board continues with <strong>{toSan(fen, mine.result.playedMove)}</strong>, {whose}: {reason(rule, tied)}.
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
      </div>
      <MiniTower match={match} />
    </div>
  );
}
