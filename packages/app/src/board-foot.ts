import { useLayoutEffect } from "preact/hooks";

/**
 * A computer's one bottom line (Eric, Nov 25: "the board and the two boxes should all be the same lower band"): the scoreboard on the
 * left and the chat in the column on the right end where the board ends, its frame included (the move clock's bar mirrored under it,
 * whether or not a clock runs, so nothing moves between phases). CSS can't know where the board ends (its side is the window's height
 * or its column's width, whichever is less), so this measures it and writes, on the arena around the screen:
 * - `--side-foot`: from the scoreboard's top (`.tower-side`) to that line;
 * - `--chat-foot`: from the chat's top (the screen's `.under-board.side`) to it;
 * - `--board-shift`: the board's middle less the title line's, so the status line centers on the board's squares.
 * board-size.css uses them on a computer only; a phone never reads them. Neither box's height moves its own top, so there is no loop.
 * docs/decisions/2026-11-25-crowd-desktop-flush.md.
 */
export function measureBoardFoot(arena: HTMLElement) {
  const wrap = arena.querySelector<HTMLElement>(".screen.game .board-area .board-row > .board-wrap");
  if (!wrap) return;
  const top = wrap.getBoundingClientRect().top;
  // (The squares' side: --board-size, up to 8 device pixels under the wrap's; the bar under the board sits right under it.)
  const side = parseFloat(getComputedStyle(wrap).getPropertyValue("--board-size")) || wrap.getBoundingClientRect().height;
  const bar = parseFloat(getComputedStyle(wrap).getPropertyValue("--timer-bar-h")) || 0;
  const foot = top + side + bar;
  const set = (name: string, el: Element | null) => {
    const v = el ? `${Math.round(foot - el.getBoundingClientRect().top)}px` : "";
    if (arena.style.getPropertyValue(name) !== v) (v ? arena.style.setProperty(name, v) : arena.style.removeProperty(name));
  };
  // (The status line over the board centers on the squares, not on the wrap's few spare pixels: `--board-shift`, from the title line's
  // middle to the board's. The line moves its words, never itself, so measuring it is steady.)
  const row = arena.querySelector(":scope > .screen.game > .hud-row")?.getBoundingClientRect();
  const shift = row ? `${(wrap.getBoundingClientRect().left + side / 2 - (row.left + row.width / 2)).toFixed(1)}px` : "";
  if (arena.style.getPropertyValue("--board-shift") !== shift) (shift ? arena.style.setProperty("--board-shift", shift) : arena.style.removeProperty("--board-shift"));
  set("--side-foot", arena.querySelector(":scope > .tower-side"));
  set("--chat-foot", arena.querySelector(":scope > .screen.game > .under-board.side"));
}

/** Rendered inside the arena: measures after every render of the match's screens and on a resize of the window or the board. */
export function BoardFoot() {
  useLayoutEffect(() => {
    const arena = document.querySelector<HTMLElement>(".arena");
    if (arena) measureBoardFoot(arena);
  });
  useLayoutEffect(() => {
    const again = () => {
      const arena = document.querySelector<HTMLElement>(".arena");
      if (arena) measureBoardFoot(arena);
    };
    const ro = new ResizeObserver(again);
    const arena = document.querySelector(".arena");
    if (arena) ro.observe(arena);
    addEventListener("resize", again);
    return () => {
      ro.disconnect();
      removeEventListener("resize", again);
    };
  }, []);
  return null;
}
