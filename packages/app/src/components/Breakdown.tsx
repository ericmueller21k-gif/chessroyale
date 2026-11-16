import { useEffect, useLayoutEffect, useMemo, useState } from "preact/hooks";
import { toSan } from "@chessroyale/chess";
import { Board } from "./Board.tsx";
import { Chevrons } from "./HistoryNav.tsx";
import type { MoveRecord, SimulBoardView } from "../game.ts";
import { ordinal } from "../screens/StageBreak.tsx";
import { boardSteps } from "../recluse-phase2.ts";

const fmt = (x: number, dp = 1) => (x >= 0 ? "+" : "") + x.toFixed(dp);
const moveNo = (fen: string) => Number(fen.split(" ")[5] ?? 1);

/**
 * Why you went out (or how your game went): your score against the cut line, the moves that cost you the
 * most (what you played, the best move, how many found it), and every move. Tap a move to see the position
 * with your move (red) and the best (green). Close calls were re-checked with a deeper search before the cut.
 */
export function Breakdown({
  moves,
  you,
  line,
  placement,
  lastCut,
  onClose,
  dp = 1,
  inline = false,
  solo = false,
}: {
  moves: readonly MoveRecord[];
  you?: number;
  line?: number;
  placement?: number | null;
  /** You went out at the last cut before the ending, where a tie is broken (not kept in). */
  lastCut?: boolean;
  /** Tapped closed (the overlay's Close button). Not used inline. */
  onClose?: () => void;
  /** Decimals on the scores (scoreDp: 2 in 50 v 50). */
  dp?: number;
  /**
   * On the result page under the stats (a boss battle, Eric's brief): not an overlay, no Close button, and no note on how
   * scores compare. Crowd's and Classic's breakdowns keep the overlay and the note. Inline is one board stepped with ◀ ▶ (InlineReview).
   */
  inline?: boolean;
  /** Inline, in a solo boss battle: no "Everyone's average loss" and no "found" count (you play alone). */
  solo?: boolean;
}) {
  const played = moves.filter((m) => m.bestMove);
  const costly = [...played].filter((m) => m.roundScore < 0).sort((a, b) => a.roundScore - b.roundScore).slice(0, 3);
  const brilliant = played.filter((m) => m.brilliant);
  // (On the result page the first move's board is open when nothing cost you: the review shows with no tap.)
  const [open, setOpen] = useState<MoveRecord | null>(costly[0] ?? null);
  const short = you !== undefined && line !== undefined ? line - you : null;
  if (inline) return <InlineReview moves={moves} dp={dp} solo={solo} />;
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
            {placement ? `${placement}${ordinal(placement)} place. ` : ""}
            {short >= 0.05 ? (
              <>
                You finished <strong>{short.toFixed(dp)} points</strong> below the last player through.
              </>
            ) : lastCut ? (
              // (A tie at any other cut goes through: only the last cut before the ending breaks one.)
              "You finished level with the last player through. At the last cut a tie goes to fewer points given away before the opening allowance, then to less thinking time."
            ) : (
              "You finished less than 0.1 points below the last player through."
            )}
          </p>
          <div class="line-scores">
            <span class="line-score you">You {fmt(you!, dp)}</span>
            <span class="line-score line">Last through {fmt(line!, dp)}</span>
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
          <MoveRow key={`c${m.fen}`} m={m} dp={dp} open={open === m} onOpen={() => setOpen(open === m ? null : m)} />
        ))}
      </ol>
      <details class="breakdown-all">
        <summary>Every move ({played.length})</summary>
        <ol class="breakdown-list">
          {played.map((m) => (
            <MoveRow key={`a${m.fen}`} m={m} dp={dp} open={open === m} onOpen={() => setOpen(open === m ? null : m)} />
          ))}
        </ol>
      </details>
      <p class="muted small">Scores compare your move with everyone who picked that turn. Close calls are re-checked with a deeper search before every cut.</p>
    </div>
  );
}

/** The opening allowance on a move, after its loss: what counted, or why all of it did. */
function allowanceWords(m: MoveRecord): string {
  if (m.material) return m.material === "missed" ? "; it missed a capture, so all of it counted" : "; it gave up material, so all of it counted";
  if (m.counted === undefined) return "";
  return m.counted < 0.05 ? "; none of it counted: the opening allowance" : `; ${m.counted.toFixed(1)} counted after the opening allowance`;
}

function MoveRow({ m, open, onOpen, dp }: { m: MoveRecord; open: boolean; onOpen: () => void; dp: number }) {
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
        <span class={`bm-score ${m.roundScore >= 0 ? "good" : "bad"}`}>{fmt(m.roundScore, dp)}</span>
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
            {m.move ? `You played ${m.san}${m.loss !== null ? ` (${m.loss.toFixed(1)} points from the best${allowanceWords(m)})` : ""}.` : "You didn't move in time."}{" "}
            {same ? "That was the best move." : `Best was ${best}.`} Everyone's average loss:{" "}
            {m.avgRaw !== undefined ? `${m.avgRaw.toFixed(1)} (${m.avgLoss?.toFixed(1) ?? "?"} after the opening allowance)` : (m.avgLoss?.toFixed(1) ?? "?")}.
          </p>
        </div>
      )}
    </li>
  );
}

/**
 * The result page's review (a boss battle): one board, stepped with ◀ ▶ (and the ← → keys on a computer). The stepper row, the
 * board and the text under it keep their places from move to move: stepping only changes the board, the arrows and the words.
 */
function InlineReview({ moves, dp, solo }: { moves: readonly MoveRecord[]; dp: number; solo: boolean }) {
  const played = moves.filter((m) => m.bestMove);
  const brilliant = played.filter((m) => m.brilliant);
  const last = played.length - 1;
  const [at, setAt] = useState(0);
  const step = (d: number) => setAt((p) => Math.min(last, Math.max(0, p + d)));
  useStepKeys(last, setAt);
  const m = played[at];
  if (!m) return null;
  const same = m.move === m.bestMove;
  const best = m.bestMove ? toSan(m.fen, m.bestMove) : "?";
  const side = m.fen.split(" ")[1] === "w" ? "white" : "black";
  return (
    <div class="breakdown inline">
      <div class="breakdown-head">
        <h2>Your game, move by move</h2>
      </div>
      {brilliant.length > 0 && (
        <p class="brilliant-line you">
          <span class="brilliant-mark" aria-hidden="true">‼</span> {brilliant.length === 1 ? "One brilliant move" : `${brilliant.length} brilliant moves`}:{" "}
          {brilliant.map((b) => `${moveNo(b.fen)}. ${b.san}`).join(", ")}
        </p>
      )}
      <div class="history-nav bm-step">
        <button type="button" class="nav-btn" aria-label="Previous move" disabled={at === 0} onClick={() => step(-1)}>
          <Chevrons back />
        </button>
        <div class="nav-middle bm-step-mid">
          <span class="bm-step-text">
            Move {at + 1} of {played.length} · {m.move ? m.san : "no move"}
            {m.brilliant ? " ‼" : ""}
            {m.usedPowerUp ? " ⚡" : ""} · {same ? "best move" : `best ${best}`}
            {solo ? "" : ` · ${m.found ?? 0}/${m.pickers ?? 0} found`} ·{" "}
            <span class={`bm-score ${m.roundScore >= 0 ? "good" : "bad"}`}>{fmt(m.roundScore, dp)}</span>
          </span>
        </div>
        <button type="button" class="nav-btn" aria-label="Next move" disabled={at === last} onClick={() => step(1)}>
          <Chevrons />
        </button>
      </div>
      <div class="bm-board-wrap">
        <Board
          fen={m.fen}
          orientation={side}
          small
          animate={false}
          arrows={[...(m.move && !same ? [{ move: m.move, brush: "red" as const }] : []), ...(m.bestMove ? [{ move: m.bestMove, brush: "green" as const }] : [])]}
        />
      </div>
      <p class="small bm-text">
        {m.move ? `You played ${m.san}${m.loss !== null ? ` (${m.loss.toFixed(1)} points from the best${allowanceWords(m)})` : ""}.` : "You didn't move in time."}{" "}
        {same ? "That was the best move." : `Best was ${best}.`}
        {!solo && (
          <>
            {" "}
            Everyone's average loss:{" "}
            {m.avgRaw !== undefined ? `${m.avgRaw.toFixed(1)} (${m.avgLoss?.toFixed(1) ?? "?"} after the opening allowance)` : (m.avgLoss?.toFixed(1) ?? "?")}.
          </>
        )}
      </p>
    </div>
  );
}

/** The arrow keys step a review (0 to `last`), but not while typing in a field. */
function useStepKeys(last: number, setAt: (f: (p: number) => number) => void) {
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || t.closest("input, textarea, select"))) return;
      if (e.key === "ArrowLeft") setAt((p) => Math.max(0, p - 1));
      else if (e.key === "ArrowRight") setAt((p) => Math.min(last, p + 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);
}

/** How your phase 2 board ended, in words (the board's own tag says it the same way: Won, Lost on time, Lost: resigned, Draw). */
function boardEnd(r: SimulBoardView["result"]): string {
  if (!r) return "";
  if (r.winner === "draw") return "Your board is drawn.";
  if (r.winner === "crowd") return "Your board is won.";
  return `Your board is lost${r.how === "time" ? " on time" : r.how === "resign" ? ": you resigned" : ""}.`;
}

/**
 * The result page's review after the Hidden Boss's phase 2 (QA #12, Nov 14: it replayed phase 1's first form, "Move 1 of 11", not
 * the fight just won): the board you played, from its Chess960 start to its end, stepped with ◀ ▶ (and the ← → keys) in
 * InlineReview's places (the same stepper, board and text under it). It opens on the end. Phase 2's moves aren't judged: it says
 * who moved and what, no scores (you're White on every board, he's Black).
 */
export function BoardReview({ board }: { board: Pick<SimulBoardView, "history" | "bases" | "result"> }) {
  const steps = useMemo(() => boardSteps(board), [board]);
  const last = steps.length - 1;
  const [at, setAt] = useState(last);
  const step = (d: number) => setAt((p) => Math.min(last, Math.max(0, p + d)));
  useStepKeys(last, setAt);
  const s = steps[Math.min(at, last)]!;
  const said = s.ply === 0 ? (last === 0 ? "No moves were played on your board." : "Your board's start: its own Chess960 position.") : `${steps[s.ply - 1]!.fen.split(" ")[1] === "w" ? "You" : "He"} played ${s.san}.`;
  return (
    <div class="breakdown inline board-review">
      <div class="breakdown-head">
        <h2>Your board, move by move</h2>
      </div>
      <div class="history-nav bm-step">
        <button type="button" class="nav-btn" aria-label="Previous move" disabled={at === 0} onClick={() => step(-1)}>
          <Chevrons back />
        </button>
        <div class="nav-middle bm-step-mid">
          <span class="bm-step-text">{s.ply === 0 ? "The start · Chess960" : `Move ${s.ply} of ${last} · ${s.san}`}</span>
        </div>
        <button type="button" class="nav-btn" aria-label="Next move" disabled={at === last} onClick={() => step(1)}>
          <Chevrons />
        </button>
      </div>
      <div class="bm-board-wrap">
        <Board fen={s.fen} orientation="white" lastMove={s.move} small animate={false} silent />
      </div>
      <p class="small bm-text">
        {said}
        {at === last && board.result ? ` ${boardEnd(board.result)}` : ""}
      </p>
    </div>
  );
}
