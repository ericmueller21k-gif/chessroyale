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
  /**
   * One size for every boss (Eric, Nov 7: "how are the king and the pawn so different sized … shrink the ones that are currently larger …
   * about a 15% shrink"; docs/decisions/2026-11-07-one-side-size.md): the screen px a sprite px is the board's side over this, at most
   * `max` (each 15% under Nov 4's 170 and 4), and no more than the widest and tallest boss (SIDE_REACH) fits in the room, so every boss,
   * Babur too, is drawn at the same size at a window size.
   */
  boardPerPx: 200,
  /** Never smaller than they were (2 px a sprite px; the God King 1×), never past this. */
  min: 2,
  max: 3.4,
  /** In steps of this, so a window's small change doesn't redraw the figure. */
  step: 0.05,
  /** Room kept free between a figure and the window's edge, or the menu beside an empty column, px. */
  margin: 8,
  /** A figure's gap off the board where its room allows it (its drawing's inner edge, px). */
  gap: 12,
  /** How far a figure may come over the board's outer edge where its room doesn't (a share of the board's side: 0.05, 0.4 of a square). */
  over: 0.05,
  /**
   * Bosses that stand as far toward the board as `over` lets them, at the same size: Babur, whose pump stands in front of him, left of
   * him, overlapping him a little (components/Tiger.tsx `sidePump`; docs/decisions/2026-10-24-babur-desktop-pump.md, Nov 7).
   */
  lean: ["tiger"] as readonly string[],
  /**
   * A boss wider at rest than the one size allows for (Chandy's slung rifle, Nov 16: 100 sprite px against the others' 87 at most): left
   * out of SIDE_WIDEST, so every boss keeps today's size; drawn at the same size, his far side lies over the menu beside the empty column
   * where it must, never past the window's edge (Eric's rule, Nov 4: "over the board or a menu is fine").
   */
  // (The Stranger, Nov 27: his crossed swords reach 101 wide at rest, past the 87 the rest fit: left out the same way.)
  overMenu: ["chandy", "stranger"] as readonly string[],
  /** The God King and your pawn: the bosses' size over 2, at most this (15% under Nov 4's 2), the same in every fight. */
  kingMax: 1.7,
  /** The share of the room right of the board they fill at most (Nov 7: 15% smaller than they were, "so then the king fits"). */
  kingFill: 0.85,
  /** Your pawn's drawing, half its width: a share of its art's box (`--pw`; a pawn fills about 0.68 of its square). */
  pawnHalf: 0.34,
} as const;

/**
 * Babur's pump stands in front of him on a computer (Eric, Nov 7: "the pump can just be sitting in front of him, slightly overlapping, and
 * he's kind of standing behind it a little bit, like just 10 pixels even is enough"): over his drawn left edge by PUMP_OVER px, more where
 * the room left of him is short, up to PUMP_OVER_MAX of the pump's drawn width (components/Tiger.tsx `sidePump`).
 */
export const PUMP_OVER = 10;
export const PUMP_OVER_MAX = 0.4;

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
  smudgy: [37, 77, 50, 1],
  moo: [34, 93, 34, 4],
  gardener: [46, 78, 28, 2],
  tiger: [31, 89, 31, 2],
  folio: [46, 80, 41, 2],
  timber: [38, 84, 46, 4],
  dash: [39, 95, 28, 4],
  zebra: [33, 96, 51, 2],
  recluse: [30, 135, 30, 2],
  // (Chandy at rest: his frames with the rifle held level, aiming and firing, lie over the board: OVER_BOARD.)
  chandy: [57, 117, 43, 3],
  // (Birdie, young and armored: the armored stands taller.)
  birdie: [37, 83, 35, 2],
  // (The Stranger, Nov 27: his swords crossed on his back reach past his shoulders.)
  stranger: [50, 120, 51, 2],
};

/**
 * How far each boss's drawing reaches from its feet, left and right (sprite px), over every frame it plays beside the board (mid-beat too:
 * a lunge, a swing), OVER_BOARD's animations left out; the same unit test measures them. A figure mirrored to face the board (kits.ts
 * `placeFacing`) turns toward it the side it held behind it as drawn, whose swings its rest's room (SIDE_REACH) never counted: its room
 * keeps them within `over` too (BossCharacter.tsx fitSides, `bossSwing`). Nov 17: Timber, turned, swings 44 toward the board when he moves,
 * gnaws or builds, 6 past his rest's 38: 41 px over a 1440 × 900 board against its 38.
 * Nov 18: Ginger 40 and 39 (was 38 and 38): his Super Freeze cast, its glowing orb and the blast a step past his other frames.
 */
export const SIDE_SWING: Readonly<Record<string, readonly [left: number, right: number]>> = {
  clown: [33, 34],
  gingerbread: [40, 39],
  grex: [42, 49],
  hollow: [38, 45],
  bigboy: [38, 33],
  sawyer: [44, 37],
  pig: [41, 69],
  alfil: [46, 32],
  hopper: [40, 34],
  smudgy: [39, 51],
  moo: [34, 35],
  gardener: [54, 33],
  tiger: [32, 34],
  folio: [51, 42],
  timber: [44, 47],
  dash: [39, 64],
  zebra: [33, 58],
  recluse: [31, 30],
  chandy: [57, 98],
  birdie: [37, 36],
  // (The Stranger: his slash and cast reach past his rest.)
  stranger: [61, 61],
};

/**
 * Animations whose drawing lies over the board on a computer, left out of a boss's SIDE_REACH (his room is his rest's): Chandy's level
 * rifle, aiming and firing (Nov 16), at every stage. Over the board is fine (Eric's rule, Nov 4); the e2e guard still checks every frame
 * whole in the window.
 */
export const OVER_BOARD: Readonly<Record<string, RegExp>> = { chandy: /^(aim|fire)(_s\d)?$/ };
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
  /** How much further than his drawing's right edge his frames swing toward the board (page px at `s`; SIDE_SWING): kept within `over` too. */
  bossSwing?: number;
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

/** The widest and the tallest any boss's drawing reaches (SIDE_REACH): what the one size must fit (sprite px). */
export const SIDE_WIDEST = Math.max(...Object.entries(SIDE_REACH).filter(([id]) => !SIDE_FEEL.overMenu.includes(id)).map(([, [l, , r]]) => l + r));
export const SIDE_TALLEST = Math.max(...Object.values(SIDE_REACH).map(([, u]) => u));

export function sideSizes(r: SideRoom, feel: typeof SIDE_FEEL = SIDE_FEEL, boss = ""): SidePlace {
  if (r.fixed) return { s: feel.min, k: 1, bossMid: null, firstMid: null };
  const down = (v: number, step: number) => Math.round(Math.floor(v / step + 1e-6) * step * 100) / 100;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const want = Math.min(feel.max, r.board / feel.boardPerPx);
  const over = r.board * feel.over;
  // The boss: his drawing's reach either side of his box's middle and up, per unit of size; its width in the room from its limit to the
  // board's edge, and over it as far as `over`.
  const lc = (r.bossMid - r.bossLeft) / r.s;
  const rc = (r.bossRight - r.bossMid) / r.s;
  const up = (r.boardBottom - r.bossTop) / r.s;
  // The one size: what the widest and the tallest boss would fit in this room (his own reach swapped for theirs), whoever stands here.
  const reach = SIDE_REACH[boss];
  // (A boss wider than the one size allows for, Chandy: the one size as everyone's; his far side over the menu where it must.)
  const wider = reach ? (feel.overMenu.includes(boss) ? SIDE_WIDEST - reach[0] - reach[2] : Math.max(0, SIDE_WIDEST - reach[0] - reach[2])) : 0;
  const taller = reach ? Math.max(0, SIDE_TALLEST - reach[1]) : 0;
  const fitLeft = (r.boardLeft + over - r.leftLimit - feel.margin) / (lc + rc + wider);
  const fitUp = up > 0 ? (r.boardBottom - feel.margin) / (up + taller) : Infinity;
  const shared = Math.max(feel.min, down(Math.min(want, fitLeft, fitUp), feel.step));
  const s = r.bossFixed ? feel.min : shared;
  // (His drawing's right edge a gap off the board, or as far over it as his room needs, never further; a boss who leans, over it by `over`.
  // His swing toward the board (`bossSwing`) over it by `over` at most too: his far side then over the menu where his room is short.)
  const lean = feel.lean.includes(boss);
  const most = r.boardLeft + over - ((r.bossSwing ?? 0) / r.s) * s;
  const bossRight = lean ? most : Math.min(most, Math.max(r.boardLeft - feel.gap, r.leftLimit + feel.margin + (lc + rc) * s));
  const bossMid = r.bossFixed ? null : r1(bossRight - rc * s);
  if (!r.right) return { s, k: 1, bossMid, firstMid: null };
  // Right of the board: your pawn and the God King the one size over 2, filling at most `kingFill` of their room.
  const ri = (r.right.mid - r.right.inner) / r.k;
  const ro = (r.right.outer - r.right.mid) / r.k;
  const lo = r.boardRight - (r.right.over ? over : 0);
  const edge = r.rightLimit - feel.margin;
  const k = Math.max(1, Math.min(feel.kingMax, down(Math.min(shared / 2, (feel.kingFill * (edge - lo)) / (ri + ro)), feel.step)));
  const inner = Math.max(lo, Math.min(r.boardRight + feel.gap, edge - (ri + ro) * k));
  return { s, k, bossMid, firstMid: r1(inner + ri * k) };
}
