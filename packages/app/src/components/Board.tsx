import { useLayoutEffect, useRef } from "preact/hooks";
import type { BoardImpl } from "@chessroyale/core";
import { play } from "../sound.ts";
import { knockFor } from "../move-sound.ts";
import { boardImpl } from "../board/impl.ts";
import { OwnBoard } from "../board/OwnBoard.tsx";
import type { BoardProps } from "../board/types.ts";
import { CgBoard } from "./CgBoard.tsx";

export type { Arrow, BoardProps } from "../board/types.ts";

/**
 * The board every screen draws: chessground's (CgBoard) or our own (board/OwnBoard.tsx), as BOARD.impl and this
 * device's choice say (board/impl.ts). Both take the same props and look and feel the same. A board keeps the one it
 * was made with until it goes (a screen made after a switch draws the other).
 */
export function Board({ impl: force, ...props }: BoardProps & { /** This board whatever the device's choice (the board lab). */ impl?: BoardImpl }) {
  const { fen, lastMove, small } = props;
  const impl = useRef(force ?? boardImpl()).current;
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

  return impl === "own" ? <OwnBoard {...props} /> : <CgBoard {...props} />;
}
