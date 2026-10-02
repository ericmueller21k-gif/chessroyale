import { Board } from "./Board.tsx";

export function MiniBoard({ fen, lastMove, label, orientation = "white" }: { fen: string; lastMove?: string | null; label?: string; orientation?: "white" | "black" }) {
  return (
    <figure class="mini">
      <Board fen={fen} orientation={orientation} lastMove={lastMove} small />
      {label && <figcaption class="mini-label">{label}</figcaption>}
    </figure>
  );
}
