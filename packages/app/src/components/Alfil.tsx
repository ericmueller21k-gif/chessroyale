import type { BossView } from "../game.ts";
import type { BossUi, MomentUi } from "./PowerParts.tsx";

/**
 * Alfil's powers on screen: places held for his art (a later build: his sprite, the glow on his marked pawns, the
 * fusion's flash, the elephants' own piece art, the Slam's leap, the growing shadows reused from Jefferson's Roman
 * candle, the landings). His rules are built (packages/chess/src/bosses/alfil.ts) and the screens get their state in
 * the boss view (`tusks`, `fusion`, `elephants`, `slam`, `airborne`, `landed`): until the art comes, his moments show
 * nothing (the board shows the position as it is) and only hold their time, so the server's timing is already his.
 */

/** A step at the start of his turn plays on a screen of its own (as Big Boy's bounce): it's the last thing that happened. */
const latest = (boss: BossView, kind: string): boolean => boss.powers?.events.at(-1)?.kind === kind;

const nothing = () => null;

const MOMENTS: Record<"tusks" | "fuse" | "slam" | "land", MomentUi> = {
  tusks: { order: 0, kit: "power", own: (boss) => latest(boss, "tusks") && boss.powers?.tusks?.at === boss.crowdMoves, view: nothing },
  fuse: { order: 0, kit: "power", own: (boss) => latest(boss, "fuse") && boss.powers?.fusion?.at === boss.crowdMoves, view: nothing },
  slam: { order: 3, kit: "ultimate", own: (boss) => latest(boss, "slam") && boss.powers?.slam?.at === boss.crowdMoves, view: nothing },
  land: { order: 2, kit: "ultimateHit", view: nothing },
};

export const ALFIL_UI = {
  id: "alfil",
  // (His Slam comes at the start of his turn, after your move, as Big Boy's bounce.)
  ultimate: { name: "the Mammoth Slam", when: "After your move" },
  moments: MOMENTS,
} satisfies BossUi;
