import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";
import { legalMoves, pieceAt, sideToMove } from "@chessroyale/chess";
import { play } from "../sound.ts";

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
  /** Only these moves may be played (default: every legal move). */
  moves?: readonly string[];
  onMove?: (uci: string) => void;
  arrows?: Arrow[];
  small?: boolean;
  /** Animate changes (off for instant jumps). */
  animate?: boolean;
  /** Drawn over the board (e.g. everyone's picks as see-through pieces). */
  children?: ComponentChildren;
  /** Extra square highlights under the pieces: square → class (e.g. the God King's Last Stand marks the blunder). */
  marks?: Readonly<Record<string, string>>;
}

const sq = (s: string) => s as Key;

function destsFor(fen: string, only?: readonly string[]): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const m of only ?? legalMoves(fen)) {
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
export function Board({ fen, orientation, lastMove, interactive, moves, onMove, arrows, small, animate = true, children, marks }: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const prevFen = useRef(fen);
  const lastSound = useRef(0);

  // A move appearing on a big board makes a sound (a capture sounds different).
  useEffect(() => {
    const before = prevFen.current;
    prevFen.current = fen;
    if (small || before === fen || !lastMove) return;
    const to = lastMove.slice(2, 4);
    const mover = pieceAt(before, lastMove.slice(0, 2));
    if (!mover) return;
    const captured = !!pieceAt(before, to) || (mover.type === "p" && lastMove[0] !== lastMove[2]);
    const castled = mover.type === "k" && Math.abs(lastMove.charCodeAt(0) - lastMove.charCodeAt(2)) === 2;
    // A fast replay (a whole game from move 0) would be a clatter: at most one knock every 180 ms.
    const now = performance.now();
    if (now - lastSound.current < 180) return;
    lastSound.current = now;
    play(captured ? "capture" : castled ? "castle" : "move");
  }, [fen]);

  // The board is built, and kept in step, before the browser paints (layout effects): a plain effect runs after the
  // first paint, so every new board (each phase of a match is its own screen) showed one frame with no board at all.
  useLayoutEffect(() => {
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
      // Chessground draws its squares in a box it shrinks to a whole multiple of 8 device pixels (up to 8 px smaller
      // than the wrap at a fractional zoom or display scale), and writes that exact size to ---cg-width on the wrap
      // every time it sizes the board. Overlays size and place themselves by it (--cg-size in styles.css), never by
      // the wrap: a ring placed in % of the wrap drifted off its square by a few pixels toward the board's far side.
      addDimensionsCssVarsTo: el.current!.parentElement!,
    });
    const resize = new ResizeObserver(() => api.current?.redrawAll());
    resize.observe(el.current!);
    return () => {
      resize.disconnect();
      api.current?.destroy();
    };
  }, []);

  useLayoutEffect(() => {
    const color = sideToMove(fen) === "w" ? "white" : "black";
    const only = moves;
    api.current?.set({
      fen,
      orientation,
      turnColor: color,
      selectable: { enabled: !!interactive },
      animation: { enabled: animate, duration: 220 },
      lastMove: lastMove ? [sq(lastMove.slice(0, 2)), sq(lastMove.slice(2, 4))] : undefined,
      highlight: { lastMove: true, check: true, custom: new Map(Object.entries(marks ?? {}).map(([k, v]) => [sq(k), v])) },
      check: undefined,
      movable: {
        color: interactive ? color : undefined,
        dests: interactive ? destsFor(fen, moves) : new Map(),
        events: {
          after: (from, to) => {
            const moves = (only ?? legalMoves(fen)).filter((m) => m.startsWith(from + to));
            if (moves.length > 1) setPromotion({ from, to });
            else if (moves[0]) onMoveRef.current?.(moves[0]);
          },
        },
      },
    });
    api.current?.setAutoShapes(shapesFor(arrows));
  }, [fen, orientation, lastMove, interactive, arrows, animate, moves?.join(), JSON.stringify(marks ?? null)]);

  const promote = (piece: string) => {
    if (!promotion) return;
    setPromotion(null);
    onMoveRef.current?.(promotion.from + promotion.to + piece);
  };

  const white = sideToMove(fen) === "w";
  return (
    <div class={`board-wrap ${small ? "board-small" : ""}`}>
      <div ref={el} class="board" />
      {children}
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
      piece: { class?: string; key?: string; style?: Record<string, string> };
    }
  }
}
