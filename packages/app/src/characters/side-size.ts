/**
 * How big the figures beside a boss battle's board are drawn on a computer (Eric, Nov 4: "we have space on the desktop. They should be
 * kind of bigger"; docs/decisions/2026-11-04-battle-desktop-fixes.md). Since Oct 8 the boss stood at 2 screen px a sprite px and the
 * God King in his 120 px box, while the board grew with the window (Oct 29, Nov 1: 470 px then, 600 to 1120 now). Now both grow with the
 * board, each as far as the room beside the board lets it, whole on screen (Eric's rule, Nov 4: a figure is never cut off by the page's
 * edge; over the board or a menu is fine). Pure: BossCharacter.tsx (BossSide) measures and sets the CSS variables `--side-s` (the
 * boss's screen px a sprite px) and `--king-k` (the God King's and your pawn's size against their old one) on the screen; styles.css
 * reads them from 1100 px wide up (from 900 to 1099 px he stays at 1×: no room).
 */
export const SIDE_FEEL = {
  /** The figures' size by the board's: the boss's screen px a sprite px is the board's side over this (600 px: 2.5, 1120 px: 4.7). */
  boardPerPx: 240,
  /** Never smaller than they were (2 px a sprite px; the God King 1×), never past this. */
  min: 2,
  max: 4.5,
  /** In steps of this (a quarter px a sprite px), so a window's small change doesn't redraw the figure. */
  step: 0.25,
  /** Room kept free between a figure and the edge of its room, px (the window's, or the menu's beside an empty column). */
  margin: 8,
  /**
   * Bosses that keep their old size (2): Babur, whose pump stands beside him in that room at the board's scale (else it goes into a taller
   * bar and the board shrinks: docs/decisions/2026-10-24-babur-desktop-pump.md).
   */
  keep: ["tiger"] as readonly string[],
  /** The God King and your pawn grow as the board does (`--king-k` the boss's wanted size over 2), as the room beside the board lets them. */
  kingMax: 2.25,
  kingStep: 0.05,
} as const;

/** What a figure's size is worked out from, in screen px (from getBoundingClientRect). */
export type SideRoom = {
  /** The board's side, its left and right edges, and its bottom (the figures' feet line). */
  board: number;
  boardLeft: number;
  boardRight: number;
  boardBottom: number;
  /** Where the boss's room ends on the left (the empty column's left edge, or the screen's), and the window's width. */
  leftLimit: number;
  winW: number;
  /** At the size now (`s`): the boss's drawn left and top (px), the God King's right (his box's, and his cape past it) and `k`. */
  s: number;
  bossLeft: number;
  bossTop: number;
  k: number;
  kingRight: number;
};

/**
 * The figures' sizes for the room: the boss's `s` (screen px a sprite px) and the God King's `k`. Everything beside the board scales about
 * the board's edge (the boss's box, its distance out and its drawing; the God King's and your pawn's boxes), so a figure's reach from it is
 * its reach now over its size now, times the new size.
 */
export function sideSizes(r: SideRoom, feel: typeof SIDE_FEEL = SIDE_FEEL, boss = ""): { s: number; k: number } {
  const down = (v: number, step: number) => Math.floor(v / step + 1e-6) * step;
  const want = r.board / feel.boardPerPx;
  // (Left: from the board's edge to his drawing's left; up: from the board's bottom to his drawing's top. Per unit of size.)
  const left = (r.boardLeft - r.bossLeft) / r.s;
  const up = (r.boardBottom - r.bossTop) / r.s;
  const fitLeft = left > 0 ? (r.boardLeft - r.leftLimit - feel.margin) / left : Infinity;
  const fitUp = up > 0 ? (r.boardBottom - feel.margin) / up : Infinity;
  const s = feel.keep.includes(boss) ? feel.min : Math.max(feel.min, Math.min(feel.max, down(Math.min(want, fitLeft, fitUp), feel.step)));
  const right = (r.kingRight - r.boardRight) / r.k;
  const fitRight = right > 0 ? (r.winW - feel.margin - r.boardRight) / right : Infinity;
  const k = Math.max(1, Math.min(feel.kingMax, down(Math.min(want / 2, fitRight), feel.kingStep)));
  return { s, k: Math.round(k * 100) / 100 };
}
