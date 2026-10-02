import { useEffect, useState } from "preact/hooks";
import { pieceAt } from "@chessroyale/chess";

const NAMES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

export interface ShadeMove {
  move: string;
  names: string[];
  you: boolean;
}

/** Board coordinates (percent from the top-left) of a square, from the given side. */
function at(square: string, orientation: "white" | "black") {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  const x = orientation === "white" ? f : 7 - f;
  const y = orientation === "white" ? 7 - r : r;
  return { left: x * 12.5, top: y * 12.5 };
}

/**
 * Everyone's pick at once: a see-through copy of each moved piece slides to its
 * square, with the players' names stacked above where it lands. Sits over the
 * board (inside its wrapper) and lets taps through.
 */
export function ShadeMoves({
  fen,
  moves,
  orientation,
  highlight = null,
  chosen = null,
}: {
  fen: string;
  moves: ShadeMove[];
  orientation: "white" | "black";
  /** The move the "selecting" reel is on right now. */
  highlight?: string | null;
  /** The move that was chosen (the others fade). */
  chosen?: string | null;
}) {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLanded(true), 60);
    return () => clearTimeout(t);
  }, [fen]);
  return (
    <div class="cg-wrap shade-layer" aria-hidden="true">
      {moves.map((m) => {
        const piece = pieceAt(fen, m.move.slice(0, 2));
        if (!piece) return null;
        const from = at(m.move.slice(0, 2), orientation);
        const to = at(m.move.slice(2, 4), orientation);
        const pos = landed ? to : from;
        return (
          <piece
            key={m.move}
            class={`${piece.color === "w" ? "white" : "black"} ${NAMES[piece.type]} shade${m.you ? " shade-you" : ""}${
              highlight === m.move ? " reel-on" : ""
            }${chosen ? (chosen === m.move ? " chosen" : " not-chosen") : ""}`}
            style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
          />
        );
      })}
      {landed &&
        moves.map((m) => {
          const to = at(m.move.slice(2, 4), orientation);
          return (
            <div
              key={`tag${m.move}`}
              class={`shade-tag${m.you ? " you" : ""}${chosen && chosen !== m.move ? " not-chosen" : ""}`}
              style={{ left: `${to.left + 6.25}%`, top: `${to.top}%` }}
            >
              {m.names.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
          );
        })}
    </div>
  );
}

/** A green ring around a square (where the chosen move landed). */
export function SquareRing({ square, orientation }: { square: string; orientation: "white" | "black" }) {
  const p = at(square, orientation);
  return <div class="square-ring" style={{ left: `${p.left}%`, top: `${p.top}%` }} aria-hidden="true" />;
}
