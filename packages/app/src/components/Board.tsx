import { useEffect, useRef, useState } from "preact/hooks";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";
import { legalMoves, sideToMove } from "@chessroyale/chess";

export interface Arrow {
  move: string;
  brush: "green" | "blue" | "red" | "yellow" | "paleGrey" | "paleBlue";
  /** Short text on the arrow, e.g. an expected score. */
  label?: string;
}

interface BoardProps {
  fen: string;
  orientation: "white" | "black";
  lastMove?: string | null;
  /** Enable moving for the side to move. */
  interactive?: boolean;
  onMove?: (uci: string) => void;
  arrows?: Arrow[];
  small?: boolean;
  /** Animate changes (off for instant jumps). */
  animate?: boolean;
}

const sq = (s: string) => s as Key;

function destsFor(fen: string): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const m of legalMoves(fen)) {
    const from = sq(m.slice(0, 2));
    const to = sq(m.slice(2, 4));
    const list = dests.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    dests.set(from, list);
  }
  return dests;
}

function shapesFor(arrows: Arrow[] = []): DrawShape[] {
  return arrows.map((a) => ({
    orig: sq(a.move.slice(0, 2)),
    dest: sq(a.move.slice(2, 4)),
    brush: a.brush,
    ...(a.label ? { label: { text: a.label } } : {}),
  }));
}

/** Chessground board. Tap a piece then a square, or drag. Pawns reaching the last rank open a promotion picker. */
export function Board({ fen, orientation, lastMove, interactive, onMove, arrows, small, animate = true }: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    api.current = Chessground(el.current!, {
      fen,
      orientation,
      coordinates: !small,
      // Input is wired up only when a board is created interactive, so big boards always are;
      // `movable` and `selectable` decide whether moving is allowed right now.
      viewOnly: !!small,
      selectable: { enabled: !!interactive },
      animation: { enabled: animate, duration: 220 },
      highlight: { lastMove: true, check: true },
      movable: { free: false, showDests: true },
      draggable: { enabled: !small, showGhost: true },
      premovable: { enabled: false },
      drawable: { enabled: false, visible: true },
    });
    const resize = new ResizeObserver(() => api.current?.redrawAll());
    resize.observe(el.current!);
    return () => {
      resize.disconnect();
      api.current?.destroy();
    };
  }, []);

  useEffect(() => {
    const color = sideToMove(fen) === "w" ? "white" : "black";
    api.current?.set({
      fen,
      orientation,
      turnColor: color,
      selectable: { enabled: !!interactive },
      animation: { enabled: animate, duration: 220 },
      lastMove: lastMove ? [sq(lastMove.slice(0, 2)), sq(lastMove.slice(2, 4))] : undefined,
      check: undefined,
      movable: {
        color: interactive ? color : undefined,
        dests: interactive ? destsFor(fen) : new Map(),
        events: {
          after: (from, to) => {
            const moves = legalMoves(fen).filter((m) => m.startsWith(from + to));
            if (moves.length > 1) setPromotion({ from, to });
            else if (moves[0]) onMoveRef.current?.(moves[0]);
          },
        },
      },
    });
    api.current?.setAutoShapes(shapesFor(arrows));
  }, [fen, orientation, lastMove, interactive, arrows, animate]);

  const promote = (piece: string) => {
    if (!promotion) return;
    setPromotion(null);
    onMoveRef.current?.(promotion.from + promotion.to + piece);
  };

  const white = sideToMove(fen) === "w";
  return (
    <div class={`board-wrap ${small ? "board-small" : ""}`}>
      <div ref={el} class="board" />
      {promotion && (
        <div class="promo" role="dialog" aria-label="Promote to">
          {(["q", "r", "b", "n"] as const).map((p) => (
            <button type="button" key={p} class={`promo-piece ${white ? "white" : "black"} ${p}`} onClick={() => promote(p)} aria-label={{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[p]}>
              <piece class={`${white ? "white" : "black"} ${{ q: "queen", r: "rook", b: "bishop", n: "knight" }[p]}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      piece: { class?: string };
    }
  }
}
