import type { BossUi, MomentUi } from "./PowerParts.tsx";

/**
 * Moo & Moon's powers on screen: a place held for his art (the wiring lane: his sprite, the moonbeam falling on the
 * stunned piece and its glow until your move lands (the view's `stunned`), the Full Moon's transformation while he
 * thinks, his powered-up look while the view's `fullMoon` is on, the flurry's five beams 120 ms apart, his daze). His
 * rules are built (packages/chess/src/bosses/moo.ts): until the art comes his moments show nothing and only hold their
 * time, so the server's timing is already his.
 */

const nothing = () => null;

/** The beam (as your turn begins), the flurry (the same), his transformation (as your move lands), his daze. */
const MOMENTS: Record<"moonbeam" | "flurry" | "fullMoon" | "dazed", MomentUi> = {
  moonbeam: { order: 0, kit: "power", view: nothing },
  flurry: { order: 2, kit: "ultimate", view: nothing },
  fullMoon: { order: 2, kit: "ultimate", view: nothing },
  dazed: { order: 3, kit: "powerHit", view: nothing },
};

export const MOO_UI = {
  id: "moo",
  ultimate: { name: "Full Moon" },
  moments: MOMENTS,
} satisfies BossUi;
