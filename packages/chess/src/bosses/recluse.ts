/**
 * The Hidden Boss (BOSS_ROSTER "recluse"; working id, Eric names him later), phase 1: his rules. Hidden from players: only
 * an admin meets him, in Boss alone (BossDef.adminOnly). His brain is fixed (BOSS_BRAIN.fixed: Maia at its top rating,
 * raw), and so is his strength.
 *
 * - His passive, "nohelp": the God King's help doesn't work against him (Eric, Oct 14): his strike, his move and his
 *   Last Stand never come (`blocksKing`), and nothing is spent. The screens have him mock the try.
 * - His ultimate, "bullet" (Eric, Oct 14): his own meter fills from crowd turn 1 and is full as crowd turn
 *   BOSS_POWERS.bulletTurn begins, when it comes, with no warning (his line, the spellbook). From then to the end of phase
 *   1 the crowd's clock is bullet: every bank is set to bulletBankSeconds, no increment, no per-move cap, nothing adds
 *   time (bulletClock), and a bank that runs out loses the battle on time (the runner's bossOutOfTime).
 *
 * His art and lines are the app's (characters/recluse.ts, characters/recluse-lines.ts, components/Recluse.tsx).
 */
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type BossState } from "@chessroyale/core";
import { bossPowers, testSwitch, type Battle, type BossRules } from "./base.ts";

/**
 * His moments' lengths (ms; POWER_FX in boss-timing.ts). The bullet clock as it comes: he consults the book (1.54 s), then
 * opens it like a spell book (1.03 s), holds the spell (one 0.8 s loop) and slams it shut (1 s), and a beat; the crowd's
 * clock starts after it, as after every power's moment.
 */
export const RECLUSE_FX = { bullet: 4600 } as const;

/**
 * Beaten (Boss alone): how long his collapse (1.07 s) and his first mumbled line hold the board before the result screen,
 * where he goes on mumbling. Solo only: online he can't be met (BossDef.adminOnly).
 */
export const RECLUSE_FALL_MS = 4500;

/** The bullet clock is on: a boss whose ultimate is the bullet clock, once it has come (to the end of the battle). */
export function bulletClock(boss: Pick<BossState, "id" | "powers" | "result"> | null | undefined): boolean {
  return !!boss?.powers && bossPowers(boss)?.ultimate === "bullet" && boss.powers.ultAt !== undefined && !boss.result;
}

/** The God King's help doesn't work against this boss (his strike, his move, his Last Stand): the Hidden Boss's passive. */
export const kingHelpBlocked = (boss: Pick<BossState, "id"> | null | undefined): boolean => bossPowers(boss)?.passive === "nohelp";

/** His meter (0-1) as crowd turn `turn` is picked: from empty at turn 1 to full at bulletTurn; full on its own turn, then none. */
export function bulletMeter(p: Pick<BossPowerState, "ultAt">, turn: number, s: Pick<BossPowerSettings, "bulletTurn"> = BOSS_POWERS): number | null {
  if (p.ultAt !== undefined) return turn <= p.ultAt ? 1 : null;
  return Math.max(0, Math.min(1, (turn - 1) / Math.max(1, s.bulletTurn - 1)));
}

export const RECLUSE: BossRules = {
  id: "recluse",
  blocksKing: true,
  fallMs: RECLUSE_FALL_MS,
  // From the starting position, never a book opening: he has no memorized lines (Eric, Oct 14). Sides as usual (the
  // crowd White in Boss alone; ?side=b: he's White and makes the first move from the start).
  opening: { fromStart: true },
  meter: (p, turn, s) => bulletMeter(p, turn, s),
  // Full (crowd turn bulletTurn), the admins' trigger or the test switch (?power=bullet: turn 2): it comes now, no warning.
  ultimate(next, t) {
    if (!t.ultNext && t.turn < t.s.bulletTurn && !testSwitch(t, next)) return false;
    next.ultAt = t.turn;
    t.events.push({ kind: "bullet", turn: t.turn });
    return true;
  },
  // The rest of phase 1: once it has come, the clock stays bullet (and no other ultimate comes).
  ultimateRunning: () => true,
  // "nohelp" has no step of its own: it's the God King's help blocked (blocksKing).
  passive() {},
  // As it comes: every bank still in the battle becomes the bullet bank (no increment from now on: bulletClock).
  turnBegun(b: Battle) {
    const p = b.state.boss?.powers;
    if (!p?.events.some((e) => e.kind === "bullet" && e.turn === p.turn)) return;
    b.state = { ...b.state, players: b.state.players.map((pl) => (pl.alive ? { ...pl, bankMs: BOSS_POWERS.bulletBankSeconds * 1000 } : pl)) };
  },
};
