import { useState } from "preact/hooks";
import { toSan } from "@chessroyale/chess";
import { Board } from "./Board.tsx";
import type { MoveRecord } from "../game.ts";
import { ordinal } from "../screens/StageBreak.tsx";

const fmt = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);
const moveNo = (fen: string) => Number(fen.split(" ")[5] ?? 1);

/**
 * Why you went out (or how your game went): your score against the cut line, the moves that cost you the
 * most (what you played, the best move, how many found it), and every move. Tap a move to see the position
 * with your move (red) and the best (green). Close calls were re-checked with a deeper search before the cut.
 */
export function Breakdown({ moves, you, line, placement, onClose }: { moves: readonly MoveRecord[]; you?: number; line?: number; placement?: number | null; onClose: () => void }) {
  const played = moves.filter((m) => m.bestMove);
  const costly = [...played].filter((m) => m.roundScore < 0).sort((a, b) => a.roundScore - b.roundScore).slice(0, 3);
  const brilliant = played.filter((m) => m.brilliant);
  const [open, setOpen] = useState<MoveRecord | null>(costly[0] ?? null);
  const short = you !== undefined && line !== undefined ? line - you : null;
  return (
    <div class="breakdown" role="dialog" aria-label="Your game, move by move">
      <div class="breakdown-head">
        <h2>{short !== null ? "Why you went out" : "Your game, move by move"}</h2>
        <button type="button" class="btn btn-secondary breakdown-close" onClick={onClose}>
          Close
        </button>
      </div>
      {short !== null && (
        <div class="breakdown-line">
          <p>
            {placement ? `${placement}${ordinal(placement)} place. ` : ""}You finished <strong>{Math.abs(short).toFixed(1)} points</strong> {short > 0 ? "below" : "level with"} the last player through.
          </p>
          <div class="line-scores">
            <span class="line-score you">You {fmt(you!)}</span>
            <span class="line-score line">Last through {fmt(line!)}</span>
          </div>
        </div>
      )}
      {brilliant.length > 0 && (
        <p class="brilliant-line you">
          <span class="brilliant-mark" aria-hidden="true">‼</span> {brilliant.length === 1 ? "One brilliant move" : `${brilliant.length} brilliant moves`}:{" "}
          {brilliant.map((m) => `${moveNo(m.fen)}. ${m.san}`).join(", ")}
        </p>
      )}
      {costly.length > 0 && <h3>What cost you the most</h3>}
      <ol class="breakdown-list">
        {costly.map((m) => (
          <MoveRow key={`c${m.fen}`} m={m} open={open === m} onOpen={() => setOpen(open === m ? null : m)} />
        ))}
      </ol>
      <details class="breakdown-all">
        <summary>Every move ({played.length})</summary>
        <ol class="breakdown-list">
          {played.map((m) => (
            <MoveRow key={`a${m.fen}`} m={m} open={open === m} onOpen={() => setOpen(open === m ? null : m)} />
          ))}
        </ol>
      </details>
      <p class="muted small">Scores compare your move with everyone who picked that turn. Close calls are re-checked with a deeper search before every cut.</p>
    </div>
  );
}

function MoveRow({ m, open, onOpen }: { m: MoveRecord; open: boolean; onOpen: () => void }) {
  const best = m.bestMove ? toSan(m.fen, m.bestMove) : "?";
  const same = m.move === m.bestMove;
  const side = m.fen.split(" ")[1] === "w" ? "white" : "black";
  return (
    <li class={`breakdown-move${open ? " open" : ""}`}>
      <button type="button" onClick={onOpen} aria-expanded={open}>
        <span class="bm-no">{moveNo(m.fen)}.</span>
        <span class="bm-you">
          {m.move ? m.san : "no move"}
          {m.brilliant ? " ‼" : ""}
          {m.usedPowerUp ? " ⚡" : ""}
        </span>
        <span class="bm-best">{same ? "best move" : `best ${best}`}</span>
        <span class="bm-found">
          {m.found ?? 0}/{m.pickers ?? 0} found
        </span>
        <span class={`bm-score ${m.roundScore >= 0 ? "good" : "bad"}`}>{fmt(m.roundScore)}</span>
      </button>
      {open && (
        <div class="bm-board">
          <div class="bm-board-wrap">
          <Board
            fen={m.fen}
            orientation={side}
            small
            animate={false}
            arrows={[...(m.move && !same ? [{ move: m.move, brush: "red" as const }] : []), ...(m.bestMove ? [{ move: m.bestMove, brush: "green" as const }] : [])]}
          />
          </div>
          <p class="small">
            {m.move ? `You played ${m.san}${m.loss !== null ? ` (${m.loss.toFixed(1)} points from the best)` : ""}.` : "You didn't move in time."}{" "}
            {same ? "That was the best move." : `Best was ${best}.`} Everyone's average loss: {m.avgLoss?.toFixed(1) ?? "?"}.
          </p>
        </div>
      )}
    </li>
  );
}
