import { useEffect, useState } from "preact/hooks";
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

/** One see-through piece that slides from its square to the picked square once it appears. */
function Ghost({ fen, move, orientation, you, instant }: { fen: string; move: string; orientation: "white" | "black"; you: boolean; instant?: boolean }) {
  const [landed, setLanded] = useState(!!instant);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setLanded(true)));
    return () => cancelAnimationFrame(raf);
  }, []);
  const piece = pieceAt(fen, move.slice(0, 2));
  if (!piece) return null;
  const p = at(landed ? move.slice(2, 4) : move.slice(0, 2), orientation);
  return (
    <piece
      class={`${piece.color === "w" ? "white" : "black"} ${NAMES[piece.type]} crowd-ghost${you ? " you" : ""}`}
      style={{ left: `${p.left}%`, top: `${p.top}%` }}
    />
  );
}

/**
 * Crowd picks on the board. Every move picked gets a tag over its square: the
 * top three names (by leaderboard) and "+N" for the rest. With animations on,
 * every single pick is a ghost piece sliding to its square as it comes in (20
 * knight picks are 20 knights in quick succession); with them off, each move
 * gets one still ghost. `chosen` fades the others and lights the winner.
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
      {animate
        ? picks.map((p) => (
            <div key={p.id} class={`ghost-wrap${cls(p.move)}`}>
              <Ghost fen={fen} move={p.move} orientation={orientation} you={p.you} instant={instant?.has(p.id)} />
            </div>
          ))
        : [...byMove.keys()].map((move) => {
            const piece = pieceAt(fen, move.slice(0, 2));
            if (!piece) return null;
            const to = at(move.slice(2, 4), orientation);
            return (
              <piece
                key={move}
                class={`${piece.color === "w" ? "white" : "black"} ${NAMES[piece.type]} crowd-ghost still${cls(move)}`}
                style={{ left: `${to.left}%`, top: `${to.top}%` }}
              />
            );
          })}
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
