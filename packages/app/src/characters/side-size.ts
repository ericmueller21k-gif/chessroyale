/**
 * How big the figures beside a boss battle's board are drawn on a computer, and where they stand (Eric, Nov 4: "we have space on the
 * desktop. They should be kind of bigger"; round 2: "those things are tiny… there is space for more"; his rule the same day: a figure is
 * never cut off by the window's edge, and over the board or a menu is fine, "it can even create a cool effect").
 * docs/decisions/2026-11-04-bigger-side-figures.md (round 1: 2026-11-04-battle-desktop-fixes.md).
 *
 * Since Oct 8 the boss stood at 2 screen px a sprite px and the God King in his 120 px box, while the board grew with the window (Oct 29,
 * Nov 1: 470 px then, 600 to 1120 now). Now both grow toward twice that: the boss in the room left of the board, your pawn and the God King
 * (or the God King alone) in the room right of it. Each stands a small gap off the board where its room allows, and where it doesn't
 * slides over the board's outer edge, by at most `over` of the board's side, before it gets any smaller. Pure: BossCharacter.tsx (BossSide)
 * measures and sets the CSS variables on the screen (`--side-s`, `--side-d`, `--king-k`, `--first-d`); styles.css reads them from 1100 px
 * wide up (from 900 to 1099 px he stays at 1×: no room).
 */
export const SIDE_FEEL = {
  /** The figures' wanted size by the board's: the boss's screen px a sprite px is the board's side over this, at most `max`. */
  boardPerPx: 170,
  /** Never smaller than they were (2 px a sprite px; the God King 1×), never past this (twice as big). */
  min: 2,
  max: 4,
  /** In steps of this, so a window's small change doesn't redraw the figure. */
  step: 0.05,
  /** Room kept free between a figure and the window's edge, or the menu beside an empty column, px. */
  margin: 8,
  /** A figure's gap off the board where its room allows it (its drawing's inner edge, px). */
  gap: 12,
  /** How far a figure may come over the board's outer edge where its room doesn't (a share of the board's side: 0.05, 0.4 of a square). */
  over: 0.05,
  /**
   * Bosses that keep their old size and place (2): Babur, whose pump stands beside him in that room at the board's scale (else it goes into
   * a taller bar and the board shrinks: docs/decisions/2026-10-24-babur-desktop-pump.md).
   */
  keep: ["tiger"] as readonly string[],
  /** The God King and your pawn grow to the boss's wanted size over 2, at most this. */
  kingMax: 2,
  /** Your pawn's drawing, half its width: a share of its art's box (`--pw`; a pawn fills about 0.68 of its square). */
  pawnHalf: 0.34,
} as const;

/**
 * How far each boss's drawing reaches from its feet, left, up, right and down (sprite px; down: the rows drawn from the one its feet
 * stand on, which is drawn just under the line they stand on), over every frame it rests in (its loops) and the last
 * frame of each animation (where each beat ends): what must stay whole on screen (Eric's rule, Nov 4). By its character's id; a unit test
 * measures them from the art (test/battle-desktop.test.ts), so a change to a drawing that reaches further fails until this is updated.
 */
export const SIDE_REACH: Readonly<Record<string, readonly [left: number, up: number, right: number, down: number]>> = {
  clown: [33, 89, 34, 2],
  gingerbread: [36, 86, 28, 4],
  grex: [42, 100, 42, 1],
  hollow: [38, 82, 39, 4],
  bigboy: [30, 71, 29, 2],
  sawyer: [39, 67, 37, 2],
  pig: [39, 70, 38, 2],
  alfil: [46, 82, 32, 3],
  hopper: [37, 78, 34, 1],
  smudgy: [50, 77, 37, 1],
  moo: [34, 93, 34, 4],
  gardener: [46, 78, 28, 2],
  tiger: [31, 89, 31, 2],
  folio: [46, 80, 41, 2],
  timber: [38, 84, 46, 4],
  dash: [39, 95, 28, 2],
  recluse: [30, 135, 30, 2],
};
/** The God King's the same (characters/god-king.ts: his frame 108 × 104, his feet at 64, 99), measured by the same test. */
export const KING_REACH = [38, 98, 34, 3] as const;

/** What the figures' sizes and places are worked out from, in page px (getBoundingClientRect), at the sizes now (`s`, `k`). */
export type SideRoom = {
  /** The board's side and its edges. */
  board: number;
  boardLeft: number;
  boardRight: number;
  boardBottom: number;
  /** Where the boss's room ends on the left (the empty column's left edge, or the screen's), and where the room right of the board ends. */
  leftLimit: number;
  rightLimit: number;
  /** The boss at `s`: his drawing's left, right and top (SIDE_REACH on the page), and his box's middle. */
  s: number;
  bossLeft: number;
  bossRight: number;
  bossTop: number;
  bossMid: number;
  /**
   * Right of the board at `k` (null: no God King in his place): the first figure's middle (your pawn's, else the God King's), its inner
   * edge (your pawn's drawing; the God King's box when he's alone: he stays off the board), the outer edge of everything drawn there, and
   * whether the inner edge may come over the board.
   */
  k: number;
  right: { mid: number; inner: number; outer: number; over: boolean } | null;
  /** The figures don't grow or move here (a party's battle, stacked by the corner). */
  fixed?: boolean;
  /** The boss keeps his size and place (a raid's, standing over the scoreboard's edge: it has no empty column for him); the God King grows. */
  bossFixed?: boolean;
};

/** The sizes, and the middles (page x) the boss's box and the first figure right of the board stand at (null: where they were). */
export type SidePlace = { s: number; k: number; bossMid: number | null; firstMid: number | null };

export function sideSizes(r: SideRoom, feel: typeof SIDE_FEEL = SIDE_FEEL, boss = ""): SidePlace {
  if (r.fixed || feel.keep.includes(boss)) return { s: feel.min, k: 1, bossMid: null, firstMid: null };
  const down = (v: number, step: number) => Math.round(Math.floor(v / step + 1e-6) * step * 100) / 100;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const want = Math.min(feel.max, r.board / feel.boardPerPx);
  const over = r.board * feel.over;
  // The boss: his drawing's reach either side of his box's middle and up, per unit of size; its width in the room from its limit to the
  // board's edge, and over it as far as `over`.
  const lc = (r.bossMid - r.bossLeft) / r.s;
  const rc = (r.bossRight - r.bossMid) / r.s;
  const up = (r.boardBottom - r.bossTop) / r.s;
  const fitLeft = (r.boardLeft + over - r.leftLimit - feel.margin) / (lc + rc);
  const fitUp = up > 0 ? (r.boardBottom - feel.margin) / up : Infinity;
  const s = r.bossFixed ? feel.min : Math.max(feel.min, down(Math.min(want, fitLeft, fitUp), feel.step));
  // (His drawing's right edge a gap off the board, or as far over it as his room needs, never further.)
  const bossRight = Math.min(r.boardLeft + over, Math.max(r.boardLeft - feel.gap, r.leftLimit + feel.margin + (lc + rc) * s));
  const bossMid = r.bossFixed ? null : r1(bossRight - rc * s);
  if (!r.right) return { s, k: 1, bossMid, firstMid: null };
  // Right of the board: the figures there as big as the boss's wanted size over 2, as far as their room allows.
  const ri = (r.right.mid - r.right.inner) / r.k;
  const ro = (r.right.outer - r.right.mid) / r.k;
  const lo = r.boardRight - (r.right.over ? over : 0);
  const edge = r.rightLimit - feel.margin;
  const k = Math.max(1, Math.min(feel.kingMax, down(Math.min(want / 2, (edge - lo) / (ri + ro)), feel.step)));
  const inner = Math.max(lo, Math.min(r.boardRight + feel.gap, edge - (ri + ro) * k));
  return { s, k, bossMid, firstMid: r1(inner + ri * k) };
}
