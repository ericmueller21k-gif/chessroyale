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
  /** The figures' size by the board's: the boss's screen px a sprite px is the board's side over this (600 px: 2.5, 1120 px: 4.7, as the room allows). */
  boardPerPx: 240,
  /** Never smaller than they were (2 px a sprite px; the God King 1×), never past this. */
  min: 2,
  max: 4.5,
  /** In steps of this, so a window's small change doesn't redraw the figure. */
  step: 0.05,
  /** Room kept free between a figure and the edge of its room, px (the window's, or the menu's beside an empty column). */
  margin: 8,
  /**
   * Bosses that keep their old size (2): Babur, whose pump stands beside him in that room at the board's scale (else it goes into a taller
   * bar and the board shrinks: docs/decisions/2026-10-24-babur-desktop-pump.md).
   */
  keep: ["tiger"] as readonly string[],
  /** The God King and your pawn grow with the boss (the mirror: sideSizes), at most this. */
  kingMax: 2.25,
} as const;

/**
 * How far each boss's drawing reaches from its feet, left and up (sprite px), over every frame it rests in (its loops) and the last frame
 * of each animation (where each beat ends): what must stay whole on screen (Eric's rule, Nov 4). By its character's id; a unit test
 * measures them from the art (test/battle-desktop.test.ts), so a change to a drawing that reaches further fails until this is updated.
 */
export const SIDE_REACH: Readonly<Record<string, readonly [left: number, up: number]>> = {
  clown: [33, 89],
  gingerbread: [36, 86],
  grex: [42, 100],
  hollow: [38, 82],
  bigboy: [30, 71],
  sawyer: [39, 67],
  pig: [39, 70],
  alfil: [46, 82],
  hopper: [37, 78],
  smudgy: [50, 77],
  moo: [34, 93],
  gardener: [46, 78],
  tiger: [31, 89],
  folio: [46, 80],
  timber: [38, 84],
  dash: [39, 95],
  recluse: [30, 135],
};

/** What a figure's size is worked out from, in screen px (from getBoundingClientRect), at the sizes now (`s`, `k`). */
export type SideRoom = {
  /** The board's side, its left edge (the boss's anchor, where his row starts), and its bottom (the figures' feet line). */
  board: number;
  boardLeft: number;
  boardBottom: number;
  /** Where the boss's room ends on the left (the empty column's left edge, or the screen's), and the window's width. */
  leftLimit: number;
  winW: number;
  s: number;
  k: number;
  /** How far left and up the boss's drawing reaches at rest and where each beat ends (px: SIDE_REACH on the page). */
  bossLeft: number;
  bossTop: number;
  /** How far the boss's middle is from his anchor per unit of `s` (he scales about the anchor). */
  grow: number;
  /**
   * Right of the board (null: no God King in his place here): the left edge of the first figure there (your pawn, else the God King),
   * which stays where it is, and the room the figures there take from it to the right edge of everything of theirs (the God King's
   * whole frame: its box is what the page scrolls by), per unit of `k`.
   */
  right: { left: number; span: number } | null;
  /** The figures right of the board don't grow here (a party's, stacked by the corner): the boss keeps his size too, for the mirror. */
  fixed?: boolean;
};

/**
 * The figures' sizes for the room: the boss's `s` (screen px a sprite px) and the God King's and your pawn's `k`. The boss scales about
 * the board's edge (his box, his distance out, his drawing). The first figure right of the board keeps its left edge, a small gap off the
 * board, and its middle as far from the board as the boss's (the mirror, Eric, Oct 11 and Oct 28): so it grows exactly as far as his
 * middle moves out, `k` = 1 + (s − 2) × grow / 60 (its box 120 px at 1). So the room right of the board (the God King's whole frame
 * inside the window, at most `kingMax`) holds the boss back too.
 */
export function sideSizes(r: SideRoom, feel: typeof SIDE_FEEL = SIDE_FEEL, boss = ""): { s: number; k: number } {
  const down = (v: number, step: number) => Math.floor(v / step + 1e-6) * step;
  const want = r.board / feel.boardPerPx;
  // (Left: from the board's edge to his drawing's left; up: from the board's bottom to his drawing's top. Per unit of size.)
  const left = (r.boardLeft - r.bossLeft) / r.s;
  const up = (r.boardBottom - r.bossTop) / r.s;
  const fitLeft = left > 0 ? (r.boardLeft - r.leftLimit - feel.margin) / left : Infinity;
  const fitUp = up > 0 ? (r.boardBottom - feel.margin) / up : Infinity;
  // (Right: the God King's size the room there allows, and the boss's that makes it.)
  const kFit = Math.min(feel.kingMax, r.right && r.right.span > 0 ? (r.winW - feel.margin - r.right.left) / r.right.span : Infinity);
  const fitRight = r.grow > 0 ? feel.min + ((kFit - 1) * 60) / r.grow : Infinity;
  const s = feel.keep.includes(boss) || r.fixed ? feel.min : Math.max(feel.min, Math.min(feel.max, down(Math.min(want, fitLeft, fitUp, fitRight), feel.step)));
  return { s: Math.round(s * 100) / 100, k: Math.round((1 + ((s - feel.min) * r.grow) / 60) * 1000) / 1000 };
}
