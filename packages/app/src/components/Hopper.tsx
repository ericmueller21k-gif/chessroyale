import { HOPPER_NAME } from "@chessroyale/core";
import type { BossView } from "../game.ts";
import type { BossUi, MomentUi } from "./PowerParts.tsx";

/**
 * Chub & Chirp's powers on screen (the code id: hopper): a place held for their art (a later build, the wiring PR: the
 * sprite, Chirp's hop over the crowd's pawn, the carrot board art, the ladder, the reel and their sounds, on
 * HOPPER_BEATS's cues, and the lines). Their rules are built (packages/chess/src/bosses/hopper.ts and carrots.ts) and
 * the screens get their state in the boss view (`hop`: from, over, to; `carrots`: the race and the spin): until the art
 * comes, each moment shows nothing (the board shows the position as it is) and only holds its time, so the server's
 * timing is already theirs.
 */

const nothing = () => null;

/** The dock's line for the cast (his whole turn: no move to show). */
export const CAST_LINE = `${HOPPER_NAME} spent their turn planting carrots.`;

/**
 * Leapfrog's hop: at the start of his turn, before his move, on a screen of its own (as Big Boy's bounce: the last thing
 * that happened). The Carrot Patch's moments come as a crowd turn begins, after his turn: the cast (his whole turn), a
 * carrot his move pulled (the crowd's own pull, and his hop's, go with their move), his spin, his last carrot.
 */
const MOMENTS: Record<"hop" | "carrots" | "carrot" | "carrotSpin" | "carrotWin", MomentUi> = {
  hop: { order: 0, kit: "power", own: (boss: BossView) => boss.powers?.events.at(-1)?.kind === "hop" && boss.powers?.hop?.at === boss.crowdMoves, view: nothing },
  carrot: { order: 0, kit: "powerHit", view: nothing },
  carrots: { order: 2, kit: "ultimate", view: nothing },
  carrotSpin: { order: 3, kit: "ultimateHit", view: nothing },
  carrotWin: { order: 4, kit: "ultimateHit", view: nothing },
};

export const HOPPER_UI = {
  id: "hopper",
  ultimate: { name: "Carrot Patch" },
  moments: MOMENTS,
  noMove: (boss) => (boss.powers?.carrots && boss.powers.carrots.at === boss.crowdMoves && !boss.lastMove ? CAST_LINE : null),
} satisfies BossUi;
