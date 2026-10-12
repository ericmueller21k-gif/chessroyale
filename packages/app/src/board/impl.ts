/**
 * Which board the game draws (BOARD.impl in settings.ts): chessground, or our own (board/OwnBoard.tsx). Admins switch
 * their device in Settings → Testing; `?board=own` or `?board=cg` in the address switches any device (and is kept on it,
 * so a link works through every screen of the app). `?board=default` forgets the choice. A build with VITE_BOARD=own
 * makes our own board the default (the e2e suite's second run).
 */
import { BOARD, type BoardImpl } from "@chessroyale/core";

export const BOARD_KEY = "brc.board";

/** "own" / "chessground" (also "cg") as a board, else null. */
export function parseBoardImpl(v: string | null | undefined): BoardImpl | null {
  if (v === "own") return "own";
  if (v === "cg" || v === "chessground") return "chessground";
  return null;
}

/** The default here: the build's (VITE_BOARD) if it names one, else settings.ts. */
export const defaultBoardImpl = (): BoardImpl => parseBoardImpl(import.meta.env?.VITE_BOARD as string | undefined) ?? BOARD.impl;

function stored(): BoardImpl | null {
  try {
    return parseBoardImpl(localStorage.getItem(BOARD_KEY));
  } catch {
    return null;
  }
}

function store(impl: BoardImpl | null) {
  try {
    if (impl) localStorage.setItem(BOARD_KEY, impl);
    else localStorage.removeItem(BOARD_KEY);
  } catch {
    // Not important: it lasts until the page reloads.
  }
}

let current: BoardImpl = (() => {
  try {
    // (Not on the board lab, whose own ?board= picks a board to try.)
    if (typeof location !== "undefined" && !/^\/boardlab\/?$/.test(location.pathname)) {
      const q = new URLSearchParams(location.search).get("board");
      if (q === "default") store(null);
      else if (parseBoardImpl(q)) store(parseBoardImpl(q));
    }
  } catch {
    // No address or storage: the default.
  }
  return stored() ?? defaultBoardImpl();
})();

/** The board this device draws. */
export const boardImpl = (): BoardImpl => current;

/** Whether this device has picked a board (else it follows the default). */
export const boardImplPicked = (): boolean => stored() !== null;

/** Picks the board for this device (null: back to the default). Boards drawn from now on use it. */
export function setBoardImpl(impl: BoardImpl | null) {
  store(impl);
  current = impl ?? defaultBoardImpl();
}
