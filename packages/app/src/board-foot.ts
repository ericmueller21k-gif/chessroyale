import { useLayoutEffect, useRef } from "preact/hooks";

/**
 * A computer's one bottom line (Eric, Nov 25: "the board and the two boxes should all be the same lower band"): the scoreboard on the
 * left and the chat in the column on the right end where the board ends, its frame included (the move clock's bar mirrored under it,
 * whether or not a clock runs, so nothing moves between phases). CSS can't know where the board ends (its side is the window's height
 * or its column's width, whichever is less), so this measures it and writes, on the arena around the screen:
 * - `--side-foot`: from the scoreboard's top (`.tower-side`) to that line; `--side-pad`: its padding, so its table's top is the squares' top
 *   (Eric: "the same height as the chessboard");
 * - `--chat-foot`: from the chat's top (the screen's `.under-board.side`; Squads' panel or its votes' list) to it.
 * board-size.css uses them on a computer only; a phone never reads them. Neither box's height moves its own top, so there is no loop.
 * docs/decisions/2026-11-25-crowd-desktop-flush.md.
 */
/** The board's squares in the arena's screen: their box is what OwnBoard sizes (a whole multiple of 8 device pixels). */
const SQUARES = ":scope > .screen.game .board-area .board-row > .board-wrap > .board > .hb-container";

export function measureBoardFoot(arena: HTMLElement) {
  const box = arena.querySelector<HTMLElement>(SQUARES);
  const wrap = box?.closest<HTMLElement>(".board-wrap");
  if (!box || !wrap) return;
  // (The squares' box, as drawn: OwnBoard sets its size after the window's, so this is read when it changes, never before.)
  const b = box.getBoundingClientRect();
  const foot = b.top + b.height + (parseFloat(getComputedStyle(wrap).getPropertyValue("--timer-bar-h")) || 0);
  const put = (name: string, v: string) => {
    if (arena.style.getPropertyValue(name) !== v) (v ? arena.style.setProperty(name, v) : arena.style.removeProperty(name));
  };
  const to = (el: Element | null) => (el ? `${Math.round(foot - el.getBoundingClientRect().top)}px` : "");
  // (Eric, Nov 25: the scoreboard "literally the same height as the chessboard": its table's top on the squares' top too. The column's own
  // top never moves (sticky at the screen's top), so its padding is the table's offset from there: what it is now plus the gap left.)
  const side = arena.querySelector<HTMLElement>(":scope > .tower-side");
  // (The 50 v 50's scoreboard table; Squads' standings' box: Nov 26.)
  const table = side?.querySelector<HTMLElement>(":scope > .tower, :scope > .sq-standings > .sq-standings-rows");
  if (side && table) {
    const pad = parseFloat(getComputedStyle(side).paddingTop) || 0;
    put("--side-pad", `${Math.max(0, Math.round(pad + b.top - table.getBoundingClientRect().top))}px`);
  }
  put("--side-foot", to(side ?? null));
  // (The column's last box: the 50 v 50's chat; Squads' panel, or its votes' list in the vote: Nov 26.)
  put("--chat-foot", to(arena.querySelector(":scope > .screen.game > :is(.under-board.side, .sq-panel, .sq-votes)")));
}

/**
 * Rendered inside the arena: measures after every render of the match's screens, and whenever the arena or the board's squares change
 * size (a resize of the window: the squares follow it a moment later, from OwnBoard's own observer, and this follows them).
 */
export function BoardFoot() {
  const seen = useRef<{ ro: ResizeObserver; board: Element | null } | null>(null);
  useLayoutEffect(() => {
    const arena = document.querySelector<HTMLElement>(".arena");
    if (!arena) return;
    if (!seen.current) {
      seen.current = { ro: new ResizeObserver(() => measureBoardFoot(arena)), board: null };
      seen.current.ro.observe(arena);
    }
    const board = arena.querySelector(SQUARES);
    if (board !== seen.current.board) {
      if (seen.current.board) seen.current.ro.unobserve(seen.current.board);
      if (board) seen.current.ro.observe(board);
      seen.current.board = board;
    }
    measureBoardFoot(arena);
  });
  useLayoutEffect(() => () => seen.current?.ro.disconnect(), []);
  return null;
}
