import { pieceAt } from "@chessroyale/chess";

const NAMES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/** Board position (percent from the top-left) of a square, from the given side. */
function at(square: string, orientation: "white" | "black") {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { left: (orientation === "white" ? f : 7 - f) * 12.5, top: (orientation === "white" ? 7 - r : r) * 12.5 };
}

export interface GhostPick {
  /** Unique per pick (the player's id). */
  id: string;
  name: string;
  move: string;
  you: boolean;
  /** Leaderboard position (for which names make the tag). */
  rank: number;
}

/**
 * One see-through piece on its picked square. Every picked square has exactly
 * one: it never slides across the board (dozens of pieces sliding at once
 * smeared into streaks), it pops in where it lands, a little bolder for every
 * extra pick and with a pulse each time one more arrives.
 */
function Ghost({ fen, move, orientation, count, you, instant, chosenCls }: { fen: string; move: string; orientation: "white" | "black"; count: number; you: boolean; instant: boolean; chosenCls: string }) {
  const piece = pieceAt(fen, move.slice(0, 2));
  if (!piece) return null;
  const p = at(move.slice(2, 4), orientation);
  // 1 pick: faint; more picks: bolder (the stack reads at a glance), up to a cap.
  const weight = Math.min(1, 0.55 + 0.15 * Math.log2(count));
  return (
    <piece
      key={instant ? "still" : `n${count}`}
      class={`${piece.color === "w" ? "white" : "black"} ${NAMES[piece.type]} crowd-ghost${you ? " you" : ""}${instant ? "" : " pop"}${chosenCls}`}
      style={{ left: `${p.left}%`, top: `${p.top}%`, "--ghost-weight": String(weight) }}
    />
  );
}

/** A ghost with animations off: one still piece per picked move. */
function StillGhost({ fen, move, orientation, chosenCls }: { fen: string; move: string; orientation: "white" | "black"; chosenCls: string }) {
  const piece = pieceAt(fen, move.slice(0, 2));
  if (!piece) return null;
  const to = at(move.slice(2, 4), orientation);
  return <piece class={`${piece.color === "w" ? "white" : "black"} ${NAMES[piece.type]} crowd-ghost still${chosenCls}`} style={{ left: `${to.left}%`, top: `${to.top}%` }} />;
}

/**
 * Crowd picks on the board. Every move picked gets a tag over its square: the
 * top three names (by leaderboard) and "+N" for the rest, and one ghost piece
 * on the square it moves to (one spot per square, however many picked it).
 * With animations on, each new pick pops that ghost (20 knight picks are 20
 * quick pulses on one knight); with them off, the ghosts just stand there.
 * `chosen` fades the others and lights the winner.
 */
export function CrowdGhosts({
  fen,
  picks,
  orientation,
  animate,
  chosen = null,
  faint = false,
  instant,
  tags = true,
}: {
  fen: string;
  picks: GhostPick[];
  orientation: "white" | "black";
  animate: boolean;
  chosen?: string | null;
  /** Live tallies while players are still picking: a little more see-through. */
  faint?: boolean;
  /** Picks already shown (live): they start on their square instead of sliding in again. */
  instant?: ReadonlySet<string>;
  /** Name tags over each picked square (off for the pre-game votes, which show counts instead). */
  tags?: boolean;
}) {
  const byMove = new Map<string, GhostPick[]>();
  for (const p of picks) byMove.set(p.move, [...(byMove.get(p.move) ?? []), p]);
  const cls = (move: string) => (chosen ? (move === chosen ? " chosen" : " not-chosen") : "");
  return (
    <div class={`cg-wrap shade-layer crowd-layer${faint ? " faint" : ""}`} aria-hidden="true">
      {[...byMove].map(([move, ps]) =>
        animate ? (
          <Ghost
            key={move}
            fen={fen}
            move={move}
            orientation={orientation}
            count={ps.length}
            you={ps.some((p) => p.you)}
            instant={ps.every((p) => instant?.has(p.id))}
            chosenCls={cls(move)}
          />
        ) : (
          <StillGhost key={move} fen={fen} move={move} orientation={orientation} chosenCls={cls(move)} />
        ),
      )}
      {tags && [...byMove].map(([move, ps]) => {
        const to = at(move.slice(2, 4), orientation);
        const ranked = [...ps].sort((a, b) => Number(b.you) - Number(a.you) || a.rank - b.rank);
        const shown = ranked.slice(0, 3);
        const more = ps.length - shown.length;
        return (
          <div key={`tag${move}`} class={`shade-tag crowd-tag${ps.some((p) => p.you) ? " you" : ""}${cls(move)}`} style={{ left: `${to.left + 6.25}%`, top: `${to.top}%` }}>
            {shown.map((p) => (
              <span key={p.id}>{p.you ? "You" : p.name}</span>
            ))}
            {more > 0 && <span class="tag-more">+{more}</span>}
          </div>
        );
      })}
    </div>
  );
}
