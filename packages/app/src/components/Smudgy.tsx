import type { BossUi, MomentUi } from "./PowerParts.tsx";

/**
 * Smudgy's powers on screen: a place held for his art (the wiring lane: his sprite, the paint over his pawn row as the
 * swap comes, the paint dripping off the rook as it strikes, "That was his rook!", Repaint's brush strokes, and the board
 * drawn as the crowd sees it: the hidden rook as a pawn, maskedFen with the view's `camo.square`). His rules are built
 * (packages/chess/src/bosses/smudgy.ts): until the art comes his moments show nothing and only hold their time, so the
 * server's timing is already his.
 */

const nothing = () => null;

/** The swap (as your turn begins after his second forced move), the strike, the rook taken (as your move lands), Repaint. */
const MOMENTS: Record<"camouflage" | "strike" | "rookTaken" | "repaint", MomentUi> = {
  camouflage: { order: 0, kit: "power", view: nothing },
  strike: { order: 0, kit: "powerHit", view: nothing },
  rookTaken: { order: 0, kit: "powerHit", view: nothing },
  repaint: { order: 2, kit: "ultimate", view: nothing },
};

export const SMUDGY_UI = {
  id: "smudgy",
  ultimate: { name: "Repaint" },
  moments: MOMENTS,
} satisfies BossUi;
