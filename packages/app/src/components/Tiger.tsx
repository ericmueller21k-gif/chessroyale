import type { BossUi, MomentUi } from "./PowerParts.tsx";

/**
 * The circus tiger's powers on screen: a place held for his art (the wiring lane: his sprite and animations, the pump in
 * the boss bar's free room, the balloons' and hoops' board art, all on his sprite's branch). His rules are built
 * (packages/chess/src/bosses/tiger.ts; docs/decisions/2026-10-23-tiger-rules.md): until the art comes his moments show
 * nothing and only hold their time (only the hoops' cast holds the turn), so the server's timing is already his. What the
 * wiring lane draws:
 * - **The pump** (BossUi.barProp) from the view's `balloon`: none, its nozzle bare; else the balloon's `shape` and
 *   `color` at the stage the battle's clock gives (balloonStage with `at` and `readyAt`: the page's clock solo,
 *   gardenNow, and the server's online), the pump's `grow` step as a stage comes, held at stage 4 once ready.
 * - **place** (at the start of his turn, while he thinks): his hop to the pump and `place` (`touch` at 440 ms: the pump's
 *   `put<Piece>`). It never holds his move.
 * - **balloonLand** (as your turn after his turn's end begins; `square`, `shape`, `color`): the pump's `release`, the
 *   flight to the square, `land<Piece>` there (his piece goes on at its `poof` cue: the board shows the position before it
 *   until then), then **balloonCheer** or **balloonBigCheer** (a queen). **pop** (`shape`, `color`): the pump's
 *   `pop<stage><Piece>`, then **wince**. None of them holds your clock.
 * - **hoops** (as your turn after the cast begins; `blocks` in throw order): his `hoops` animation, a hoop thrown at each
 *   `throwN` cue (HOOPS_BEATS) to its block and its ring's `land`; the rings burn while the view's `hoops` stands (`left`
 *   2: `burn`, 1: `dying`), and **hoopsOut** (as your second move after it lands, while he thinks) plays each ring's `out`.
 */

const nothing = () => null;

const MOMENTS: Record<"place" | "balloonLand" | "pop" | "balloonCheer" | "balloonBigCheer" | "wince" | "hoops" | "hoopsOut", MomentUi> = {
  place: { order: 0, kit: "power", view: nothing },
  balloonLand: { order: 1, kit: "power", view: nothing },
  pop: { order: 1, kit: "power", view: nothing },
  balloonCheer: { order: 3, kit: "power", view: nothing },
  balloonBigCheer: { order: 3, kit: "power", view: nothing },
  wince: { order: 3, kit: "power", view: nothing },
  hoops: { order: 0, kit: "ultimate", view: nothing },
  hoopsOut: { order: 0, kit: "ultimateHit", view: nothing },
};

export const TIGER_UI = {
  id: "tiger",
  ultimate: { name: "Hoops" },
  moments: MOMENTS,
} satisfies BossUi;
