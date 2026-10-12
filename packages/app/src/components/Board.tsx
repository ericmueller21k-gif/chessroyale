import { useLayoutEffect, useRef } from "preact/hooks";
import { play } from "../sound.ts";
import { knockFor } from "../move-sound.ts";
import { OwnBoard } from "../board/OwnBoard.tsx";
import type { BoardProps } from "../board/types.ts";

export type { Arrow, BoardProps } from "../board/types.ts";

/** The board every screen draws (board/OwnBoard.tsx: docs/areas/board.md), and the knock for every move it shows. */
export function Board(props: BoardProps) {
  const { fen, lastMove, small } = props;
  const prevFen = useRef<string | null>(null);
  const lastSound = useRef(0);

  // A move appearing on a big board makes a sound (a capture sounds different). Before the paint (a layout effect),
  // and a board that takes over from another screen's knocks for the move made there (knockFor): a screen replaced
  // before it painted never ran its effects, and your own move went silent.
  useLayoutEffect(() => {
    const prev = prevFen.current;
    prevFen.current = fen;
    if (small) return;
    const knock = knockFor(prev, fen, lastMove);
    if (!knock) return;
    // A fast replay (a whole game from move 0) would be a clatter: at most one knock every 180 ms.
    const now = performance.now();
    if (now - lastSound.current < 180) return;
    lastSound.current = now;
    play(knock);
  }, [fen]);

  return <OwnBoard {...props} />;
}
