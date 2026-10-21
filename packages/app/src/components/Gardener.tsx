import type { BossUi, MomentUi } from "./PowerParts.tsx";

/**
 * The hippo gardener's powers on screen: a place held for his art (the wiring lane: his sprite and its animations, the
 * board art in characters/effects/gardener.ts on his sprite's branch, and his seed meter). His rules are built
 * (packages/chess/src/bosses/gardener.ts; docs/decisions/2026-10-21-gardener-rules.md): until the art comes his moments
 * show nothing and only hold their time, so the server's timing is already his. What the wiring lane draws:
 * - **The seed meter** beside the rage meter: the seeds waiting and a bar filling toward the next, from the view's
 *   `garden` (seedsAt and seedFill, with the page's clock solo, gardenClock, and the server's online); `fixed`, the test
 *   switch's set count.
 * - **plantMany** (as the first crowd turn begins) and **plant** (each time the count rises, from the screens' own clock:
 *   no turn's events carry it): his toss (`toss` cue), the seeds flying and plopping into the board (`seedPlop`), over
 *   whoever's turn it is: they never hold a move (their POWER_FX is 0).
 * - **water** (as the crowd's turn after his watering begins): his cast, the sweep from its `spray` cue, a sprout on every
 *   outcome's square, then each outcome in the moment's `growth` order at WATER_BEATS (killer plants' `kill`, the piece off
 *   at `snap`; grown pieces' `bud`/`budQueen`, the piece on at `pop`; plain plants' `grow`; nothing's `wilt`). The board
 *   under the moment is the position before it until each outcome's cue.
 * - **cheer**, **bigCheer**, **shrug**: his reaction after it.
 * - **Plain plants** on their squares while they block (the view's `garden.plants`, `left` 3, 2, 1: `green`, `fall`,
 *   `drop`), and `gone` as one leaves the list.
 */

const nothing = () => null;

const MOMENTS: Record<"plantMany" | "plant" | "water" | "cheer" | "bigCheer" | "shrug", MomentUi> = {
  plantMany: { order: 0, kit: "power", view: nothing },
  plant: { order: 0, kit: "power", view: nothing },
  water: { order: 2, kit: "ultimate", view: nothing },
  cheer: { order: 3, kit: "ultimateHit", view: nothing },
  bigCheer: { order: 3, kit: "ultimateHit", view: nothing },
  shrug: { order: 3, kit: "ultimateHit", view: nothing },
};

export const GARDENER_UI = {
  id: "gardener",
  ultimate: { name: "Watering" },
  moments: MOMENTS,
} satisfies BossUi;
