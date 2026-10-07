import { Board, type Arrow } from "./Board.tsx";

export function MiniBoard({ fen, lastMove, label, orientation = "white", arrows }: { fen: string; lastMove?: string | null; label?: string; orientation?: "white" | "black"; arrows?: Arrow[] }) {
  return (
    <figure class="mini">
      <Board fen={fen} orientation={orientation} lastMove={lastMove} arrows={arrows} small />
      {label && <figcaption class="mini-label">{label}</figcaption>}
    </figure>
  );
}
