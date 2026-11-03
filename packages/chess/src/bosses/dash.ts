/**
 * Dash, the cheetah (BOSS_ROSTER "dash"; Eric's design and art approved Nov 1, his name Nov 3; docs/decisions/2026-11-03-dash.md).
 * A lanky, cocky cheetah in a backwards orange cap and a teal and orange track jacket, a chess clock under his arm (ticks, never
 * numerals); his sidekick Tick, a tortoise. He never thinks: his moves come at once (BOSS_POWERS.dashThinkMs). He starts from the
 * game so far, as most bosses do. (His art keeps its own name, `boss-blitz`, as drawn; every word a player sees says Dash.)
 *
 * "Your time" in a battle against him is the clock you already have (the dock's clock, the same place on every screen):
 * - on a **time bank** (`bossClock`: Boss alone and a Boss Battle party, BOSS_CLOCK's 10 + 10; a party's one team bank), the bank;
 * - on a raid's **move timer** (the Solo raid, a Boss raid: no bank that loses), your next move's seconds.
 *
 * His passive, **Clock Slap**: each capture of his, at the end of his turn, steals time from your clock: slapBankSeconds off the
 * bank, or your next move's clock slapMoveSeconds shorter (never under slapMoveMin; one slap a move, they don't add up). A slap
 * that would take nothing (an empty bank, a scrambled move) doesn't come. Its moment (`slap`) as your turn begins: his clock slap,
 * the time flying from your clock to him.
 *
 * His ultimate, **Time Scramble** (the rage meter, `rageSpeed.dash`): the usual warning, then from the next crowd turn your next
 * scrambleMoves moves get scrambleSeconds each (the move's clock; a bank still pays for them and still gets its increment). Its
 * moment (`scramble`) as the first begins; the countdown over the board on every one of them.
 *
 * **Out of time is never a loss against him** (`noTimeLoss`; the brief): a move whose time runs out, a scrambled one's 3 s or an
 * empty bank's, gets a random legal move played for you (`outOfTime`: seeded, from the moves allowed), his jab as your next turn
 * begins (`flag`). In a raid that's only when nobody picked in time: the crowd's picks made in time are played as ever. The bank
 * stays at 0 and refills by its increment.
 *
 * Fair play: online the server sets every deadline (the runner's allowedMsFor reads his clock: lobby.ts), so a scrambled move's
 * 3 s, a slapped move's shorter clock and the bank are the server's, never a device's word; a pick after the deadline is refused.
 *
 * Test switches (solo): `?power=clockslap`: his first move slaps as a capture would, whatever it is (then only his captures);
 * `?power=scramble` warns as the second turn begins.
 */
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type BossState, type DashState } from "@chessroyale/core";
import { powerRoll, turnOf, warnThenUnleash, type Battle, type BossRules } from "./base.ts";

// ---------------- His moments ----------------

/**
 * His animations' lengths (ms; the art's, scripts/boss-art/out/boss-blitz on claude/boss-art, copied into
 * packages/app/src/characters/boss-blitz.ts): the Clock Slap (`clockSlap`: the slam at slapHitAt, then a gold clock face
 * zips from his clock to his chest by stealAt), his finger gun (`check`: his jab at your flag), the scramble's warning (`scrambleWarn`, its last frame held) and the Time Scramble
 * (`timeScramble`: the clock tossed, spun, caught and slammed).
 */
export const DASH_ANIM = { clockSlap: 1130, slapHitAt: 270, stealAt: 690, scrambleWarn: 1470, timeScramble: 2000, check: 1050 } as const;

/**
 * How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts, so the server waits for them and your clock
 * starts after them): the slap (his clock slap, your time flying to him), the Time Scramble (its banner's 1500 ms, then his
 * spin) and his flag (your time ran out: his finger gun and his jab).
 */
export const DASH_FX = { slap: DASH_ANIM.clockSlap, scramble: 1500 + DASH_ANIM.timeScramble, flag: DASH_ANIM.check } as const;

type DashSettings = Pick<BossPowerSettings, "slapBankSeconds" | "slapMoveSeconds" | "slapMoveMin" | "scrambleMoves" | "scrambleSeconds">;

/** His clock's state (a fresh one: nothing yet). */
export const dashOf = (p: Pick<BossPowerState, "dash"> | null | undefined): DashState => p?.dash ?? { slaps: 0, stolen: 0, flags: 0 };

/** Crowd turn `turn` is one of the Time Scramble's (it came at `ultAt`). */
export function scrambleOn(p: Pick<BossPowerState, "ultAt"> | null | undefined, turn: number, s: Pick<BossPowerSettings, "scrambleMoves"> = BOSS_POWERS): boolean {
  return p?.ultAt !== undefined && turn >= p.ultAt && turn < p.ultAt + s.scrambleMoves;
}

/** The scrambled moves left, this one counted (0: none under way). */
export function scrambleLeft(p: Pick<BossPowerState, "ultAt"> | null | undefined, turn: number, s: Pick<BossPowerSettings, "scrambleMoves"> = BOSS_POWERS): number {
  return scrambleOn(p, turn, s) ? p!.ultAt! + s.scrambleMoves - turn : 0;
}

/**
 * The move clock (seconds) of the crowd turn being picked against him, from the one the battle would have (`base`): a scrambled
 * move's scrambleSeconds; a move his slap shortened (a raid's move timer), slapMoveSeconds less, never under slapMoveMin (nor
 * above `base`). Every other boss, and his battle once over: `base`. The runner's moveClock and roundSettings read it, so the
 * lobby's deadlines, solo's and the bots' all follow.
 */
export function dashMoveClock(boss: Pick<BossState, "id" | "powers" | "crowdMoves" | "result"> | null | undefined, base: number, s: DashSettings = BOSS_POWERS): number {
  const p = boss?.powers;
  if (!boss || boss.id !== "dash" || !p || boss.result) return base;
  if (scrambleOn(p, turnOf(boss), s)) return s.scrambleSeconds;
  const slap = p.dash?.slap;
  if (slap && !slap.bank && slap.at === boss.crowdMoves) return slappedClock(base, s);
  return base;
}

/** A raid's move clock after a slap: slapMoveSeconds shorter, never under slapMoveMin (nor above what it was). */
export const slappedClock = (base: number, s: Pick<BossPowerSettings, "slapMoveSeconds" | "slapMoveMin"> = BOSS_POWERS): number => Math.min(base, Math.max(s.slapMoveMin, base - s.slapMoveSeconds));

/** The crowd's next turn will be scrambled (seen at his turn, before it's set up): its warning is out, or one is under way with moves left. */
function scrambleNext(p: BossPowerState, crowdMoves: number, s: DashSettings): boolean {
  if (p.ultAt !== undefined) return scrambleOn(p, crowdMoves + 1, s);
  return p.warnAt !== undefined || !!p.ultNext;
}

/** The random legal move played for you when your time ran out (seeded by the battle and the turn: the same on every device). */
export function flagMove(seed: number, turn: number, allowed: readonly string[]): string | null {
  if (!allowed.length) return null;
  const sorted = [...allowed].sort();
  return sorted[Math.floor(powerRoll(seed, "flag", turn) * sorted.length)]!;
}

export const DASH: BossRules = {
  id: "dash",
  noTimeLoss: true,
  // Time Scramble: the usual warning as a turn begins; the next turn, it comes (the admins' trigger: at once).
  ultimate(next, t) {
    if (!warnThenUnleash(next, t)) return false;
    t.events.push({ kind: "scramble", turn: t.turn, count: t.s.scrambleMoves, seconds: t.s.scrambleSeconds });
    return true;
  },
  // (Its moves: the meter stays empty and nothing else comes until the last is over.)
  ultimateRunning: (p, turn, s) => scrambleOn(p, turn, s),
  // As the crowd's turn after his turn's end begins: your flag's jab, then his slap.
  everyTurn(next, t) {
    const d = next.dash;
    if (!d) return;
    if (d.flag && d.flag.at + 1 === t.turn) t.events.push({ kind: "flag", turn: t.turn, move: d.flag.move });
    if (d.slap && d.slap.at + 1 === t.turn) t.events.push({ kind: "slap", turn: t.turn, ms: d.slap.ms, bank: d.slap.bank });
  },
  // (His slaps come at his turn's end, after a capture: afterBossMove.)
  passive() {},
  // (No powerTurn: his powers take time, never a square or a move, so every turn counts for fair play as ever and the God
  // King's Last Stand works as ever. A turn nobody picked has no picks to count, and its random move, unscored, is never one
  // he takes back.)
  outOfTime(boss, _fen, allowed) {
    return boss.powers ? flagMove(boss.powers.seed, turnOf(boss), allowed) : null;
  },
  opening: {
    setUp() {
      return { dash: { slaps: 0, stolen: 0, flags: 0 } };
    },
  },
  afterCrowdMove(b, move, judged) {
    if (judged?.flag && move) dashBattle.flagged(b, move);
  },
  afterBossMove(b) {
    dashBattle.slap(b);
  },
  view: (p) => ({ dash: dashView(p) }),
};

/**
 * His fields for the screens (NetBossPowers' `dash`): his last slap and flag, the counts, and the Time Scramble under way (the
 * crowd turn it came, its moves and seconds: scrambleLeft with the turn gives the countdown's moves left).
 */
export interface DashView {
  slap: DashState["slap"] | null;
  slaps: number;
  stolen: number;
  flag: DashState["flag"] | null;
  flags: number;
  scramble: { at: number; moves: number; seconds: number } | null;
}

export function dashView(p: BossPowerState, s: DashSettings = BOSS_POWERS): DashView | null {
  const d = p.dash;
  if (!d) return null;
  return {
    slap: d.slap ?? null,
    slaps: d.slaps,
    stolen: d.stolen,
    flag: d.flag ?? null,
    flags: d.flags,
    scramble: p.ultAt !== undefined && scrambleOn(p, p.turn, s) ? { at: p.ultAt, moves: s.scrambleMoves, seconds: s.scrambleSeconds } : null,
  };
}

/** His moments in the match (the runner calls these through his rules' hooks). */
export const dashBattle = {
  /**
   * The end of his turn (after his move): his Clock Slap when his move took a piece. On a time bank (`bossClock`) it takes
   * slapBankSeconds from every bank still in the battle (a party's one team bank: every member's, alike), as much as is there; on
   * a raid's move timer it marks the crowd's next turn for a shorter clock (dashMoveClock), as much as that shortens it. Nothing
   * to take (an empty bank, a scrambled move next): no slap. Returns the ms taken, for the tests and the sims.
   */
  slap(b: Battle, s: DashSettings = BOSS_POWERS): number {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "dash" || boss.result) return 0;
    // (The test switch ?power=clockslap: his first move slaps as a capture would.)
    const test = b.settings.bossPowerTest === "clockslap" && !dashOf(p).slaps;
    if (!b.bossLast?.captured && !test) return 0;
    const at = boss.crowdMoves;
    const bank = !!b.settings.bossClock;
    let ms: number;
    if (bank) {
      const alive = b.alive();
      const before = alive[0]?.bankMs ?? 0;
      ms = Math.min(before, s.slapBankSeconds * 1000);
      if (ms > 0) b.state = { ...b.state, players: b.state.players.map((pl) => (pl.alive ? { ...pl, bankMs: Math.max(0, pl.bankMs - s.slapBankSeconds * 1000) } : pl)) };
    } else {
      const base = b.settings.moveClockSeconds;
      ms = scrambleNext(p, at, s) ? 0 : (base - slappedClock(base, s)) * 1000;
    }
    if (ms <= 0) return 0;
    const d = dashOf(p);
    const dash: DashState = { ...d, slap: { at, ms, bank }, slaps: d.slaps + 1, stolen: d.stolen + ms };
    b.state = { ...b.state, boss: { ...b.state.boss!, powers: { ...b.state.boss!.powers!, dash } } };
    return ms;
  },

  /** Your time ran out on the crowd move just played (`move`, played for you): his jab as your next turn begins. */
  flagged(b: Battle, move: string): void {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "dash") return;
    const d = dashOf(p);
    const dash: DashState = { ...d, flag: { at: boss.crowdMoves, move }, flags: d.flags + 1 };
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, dash } } };
  },
};
