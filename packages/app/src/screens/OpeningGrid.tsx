import { useEffect, useState } from "preact/hooks";
import { fenAfter } from "@chessroyale/chess";
import type { BoardView } from "../game.ts";
import { MiniBoard } from "../components/MiniBoard.tsx";

/** All boards animating through their named openings at once (~5 s). */
export function OpeningGrid({ boards, title }: { boards: BoardView[]; title: string }) {
  const [ply, setPly] = useState(0);
  const max = Math.max(1, ...boards.map((b) => b.openingMoves?.length ?? 0));
  useEffect(() => {
    if (ply >= max) return;
    const t = setTimeout(() => setPly((p) => p + 1), 5000 / max);
    return () => clearTimeout(t);
  }, [ply, max]);
  return (
    <div class="screen grid-screen">
      <h1 class="grid-title">{title}</h1>
      <div class={`grid grid-${boards.length}`}>
        {boards.map((b) => {
          if (!b.openingMoves) return <MiniBoard key={b.id} fen={b.fen} lastMove={b.lastMove} label={b.openingName} />;
          const moves = b.openingMoves.slice(0, ply);
          return <MiniBoard key={b.id} fen={fenAfter(moves)} lastMove={moves[moves.length - 1]} label={b.openingName} />;
        })}
      </div>
    </div>
  );
}
