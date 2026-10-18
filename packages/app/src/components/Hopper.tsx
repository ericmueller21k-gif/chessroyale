import { BOSS_POWERS } from "@chessroyale/core";
import type { BossView } from "../game.ts";
import type { BossUi, MomentUi } from "./PowerParts.tsx";

/**
 * The hopper's powers on screen: a place held for his art (a later build: his sprite, the hop's arc over the crowd's
 * pawn on HOPPER_BEATS's cues, his line). His rules are built (packages/chess/src/bosses/hopper.ts) and the screens get
 * his last hop in the boss view (`hop`: from, over, to): until the art comes, his moment shows nothing (the board shows
 * the position as it is) and only holds its time, so the server's timing is already his.
 */

const nothing = () => null;

/**
 * Leapfrog's hop. When it comes before his move, it plays at the start of his turn on a screen of its own (as Big Boy's
 * bounce: the last thing that happened); when it's his move, first among the moments of the crowd's turn it begins.
 */
const MOMENTS: Record<"hop", MomentUi> = {
  hop: {
    order: 0,
    kit: "power",
    ...(BOSS_POWERS.hopIsMove ? {} : { own: (boss: BossView) => boss.powers?.events.at(-1)?.kind === "hop" && boss.powers?.hop?.at === boss.crowdMoves }),
    view: nothing,
  },
};

export const HOPPER_UI = {
  id: "hopper",
  // (His ultimate isn't decided yet: it never comes, so no warning names it.)
  ultimate: { name: "his ultimate" },
  moments: MOMENTS,
} satisfies BossUi;
