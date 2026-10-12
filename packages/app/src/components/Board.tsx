import { useLayoutEffect, useRef } from "preact/hooks";
import { play } from "../sound.ts";
import { boardKnock } from "../move-sound.ts";
import { OwnBoard } from "../board/OwnBoard.tsx";
import type { BoardProps } from "../board/types.ts";

export type { Arrow, BoardProps } from "../board/types.ts";

/** The board every screen draws (board/OwnBoard.tsx: docs/areas/board.md), and the knock for every move it shows. */
export function Board(props: BoardProps) {
  const { fen, lastMove, small, silent } = props;
  const prevFen = useRef<string | null>(null);
  const lastSound = useRef(0);

  // A move appearing on a big board makes a sound (a capture sounds different); a small or silent one makes none
  // (boardKnock). Before the paint (a layout effect),
  // and a board that takes over from another screen's knocks for the move made there (knockFor): a screen replaced
  // before it painted never ran its effects, and your own move went silent.
  useLayoutEffect(() => {
    const prev = prevFen.current;
    prevFen.current = fen;
    const knock = boardKnock(prev, fen, lastMove, { small, silent });
    if (!knock) return;
    // A fast replay (a whole game from move 0) would be a clatter: at most one knock every 180 ms.
    const now = performance.now();
    if (now - lastSound.current < 180) return;
    lastSound.current = now;
    play(knock);
  }, [fen]);

  return <OwnBoard {...props} />;
}
