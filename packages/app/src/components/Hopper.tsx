import type { BossView } from "../game.ts";
import type { BossUi, MomentUi } from "./PowerParts.tsx";

/**
 * Chub & Chirp's powers on screen (the code id: hopper): a place held for their art (a later build: the sprite, Chirp's
 * hop over the crowd's pawn on HOPPER_BEATS's cues, the line). Their rules are built (packages/chess/src/bosses/hopper.ts)
 * and the screens get the last hop in the boss view (`hop`: from, over, to): until the art comes, the moment shows
 * nothing (the board shows the position as it is) and only holds its time, so the server's timing is already theirs.
 */

const nothing = () => null;

/** Leapfrog's hop: at the start of his turn, before his move, on a screen of its own (as Big Boy's bounce: the last thing that happened). */
const MOMENTS: Record<"hop", MomentUi> = {
  hop: { order: 0, kit: "power", own: (boss: BossView) => boss.powers?.events.at(-1)?.kind === "hop" && boss.powers?.hop?.at === boss.crowdMoves, view: nothing },
};

export const HOPPER_UI = {
  id: "hopper",
  // (His ultimate isn't decided yet: it never comes, so no warning names it.)
  ultimate: { name: "his ultimate" },
  moments: MOMENTS,
} satisfies BossUi;
