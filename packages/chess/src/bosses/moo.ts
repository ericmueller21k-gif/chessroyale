/**
 * Moo & Moon (BOSS_ROSTER "moo"; Eric, Oct 20; docs/decisions/2026-10-20-moo-rules.md): a sweet cow who can't talk and
 * his friend, a chatty crescent Moon. He plays from the game so far, like most bosses.
 *
 * His passive, Moonbeam:
 * - After every moonbeamEvery-th move of his (his 3rd, 6th, 9th…), at the end of his turn (afterBossMove), a beam of
 *   moonlight lands on one of the crowd's pieces: it can't move on the crowd's next turn (one turn; then it's free). It
 *   still attacks and defends; it just can't move. Its moment, `moonbeam`, plays as the crowd's turn begins.
 * - The target (BOSS_POWERS.moonbeamTarget, beamOrder): "random", one of the crowd's pieces with a move, from the seed
 *   (the shipped one: the raid sim, reports/moo-sim.md); "valuable", Ginger's freeze's way; or "best", the one that
 *   moves in the crowd's engine-best move in the position after his move (the host's engine online, this device's in
 *   solo: beamLines), then the next lines' pieces, then by value. Never the king, and always a move left for the crowd:
 *   if a piece would leave none, the next in that order. No piece fits: no beam that turn, and the count carries on (the
 *   next comes after his next moonbeamEvery-th move, as ever).
 * - How the crowd's moves leave the stunned pieces out is Ginger's freeze's way (crowdFilter): the allowed moves are the
 *   only ones the judge scores, the bots pick and the God King plays, and a stunned turn doesn't count for fair play.
 *
 * His ultimate, the Full Moon (the rage meter, `rageSpeed.moo`):
 * - The meter full, the usual warning as a crowd turn begins; at the start of his turn after the crowd's move (as it lands:
 *   afterCrowdMove) he transforms (`fullMoon`, played while he thinks; his move waits for it: fullMoonMs) and his turn
 *   goes on: it doesn't take his move.
 * - For fullMoonMoves of his moves (this one first) his brain is the engine at full strength (bestReply: the engine's best
 *   at his move's own budget, never his Maia brain, a slip or the guard); the God King's strike still staggers one.
 * - The first of those turns ends with the flurry: flurryBeams moonbeams on different pieces of the crowd's, picked as
 *   the Moonbeam's are (beamOrder), each stunned for the crowd's next turn, as many as leave the crowd a move (`flurry`, the
 *   squares in the order they land). It replaces that turn's Moonbeam if both fall due; the Moonbeam's count goes on.
 * - After his last move at full strength, `dazed` as the crowd's turn begins: he's himself again. The meter is held empty
 *   from the transformation until then (ultimateRunning), then fills again.
 */
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type MooState, type PowerEvent } from "@chessroyale/core";
import { applyMove, legalMoves, pieceAt, sideToMove } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import { VALUE, from, meterFull, powerRoll, testSwitch, turnOf, unleashed, type Battle, type BossRules, type Side } from "./base.ts";

/**
 * Each of his moments beat by beat (ms into it), from his animations (docs/decisions/2026-10-20-moo-animations.md), so
 * the server waits for the board's beams too:
 * - **moonbeam** (as the crowd's turn after his move begins): his `moonbeam` animation (1040 ms), its `beam` cue at
 *   `beamAt`: the beam falls onto the piece (`fallMs`) and hits it (`hitMs`); the square keeps its glow (the stun) until
 *   the crowd has moved.
 * - **flurry** (as the crowd's turn after his first move at full strength begins): his `flurry` animation (1430 ms), its
 *   `beam1` to `beam5` cues from `beamAt`, `stagger` ms apart: a beam falls on each square in turn, each falling and
 *   hitting as the moonbeam's.
 * - **fullMoon** (at the start of his turn, while he thinks): his transformation (1340 ms), his colors swapping at `swapAt`.
 * - **dazed** (as the crowd's turn after his last move at full strength begins): 1250 ms, back to his own colors at `calmAt`.
 * Each total is the longest of the animation and its last beam's fall and hit.
 */
export const MOO_BEATS = {
  moonbeam: { beamAt: 350, fallMs: 220, hitMs: 240, total: 1040 },
  flurry: { beamAt: 380, stagger: 120, fallMs: 220, hitMs: 240, total: 1430 },
  fullMoon: { swapAt: 480, total: 1340 },
  dazed: { calmAt: 280, total: 1250 },
} as const;

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts): MOO_BEATS's totals. */
export const MOO_FX = { moonbeam: MOO_BEATS.moonbeam.total, flurry: MOO_BEATS.flurry.total, fullMoon: MOO_BEATS.fullMoon.total, dazed: MOO_BEATS.dazed.total } as const;

type MooSettings = Pick<BossPowerSettings, "moonbeamTarget" | "moonbeamEvery" | "moonbeamLines" | "moonbeamNodes" | "fullMoonMoves" | "flurryBeams">;

/** Which of the crowd's pieces a beam takes (BOSS_POWERS.moonbeamTarget). */
export type MoonbeamTarget = BossPowerSettings["moonbeamTarget"];

const FRESH: MooState = { moves: 0, stun: null, full: null };

/**
 * The crowd's pieces a beam may take, in the order the beams take them (`fen`: the position after his move, the crowd to
 * move; `at`: his move's number, for the seed). Never the king, never a piece without a move. By `target`
 * (BOSS_POWERS.moonbeamTarget):
 * - "best": the pieces moving in the engine's lines (`lines`, best first; each one legal here and a crowd piece's), then
 *   the crowd's other pieces with a move by value, then by how many moves each has, ties from the seed;
 * - "valuable" (Ginger's freeze's way): its three most valuable, mobile pieces (pieces before pawns, then value and
 *   moves) in an order from the seed, then the rest in that ranking;
 * - "random": every piece with a move, in an order from the seed.
 */
export function beamOrder(fen: string, crowd: Side, lines: readonly string[] | null, seed: number, at: number, target: MoonbeamTarget = BOSS_POWERS.moonbeamTarget): string[] {
  const legal = legalMoves(fen);
  const moves = new Map<string, number>();
  for (const m of legal) moves.set(from(m), (moves.get(from(m)) ?? 0) + 1);
  const ok = (sq: string) => {
    const piece = pieceAt(fen, sq);
    return !!piece && piece.color === crowd && piece.type !== "k" && moves.has(sq);
  };
  const roll = (sq: string) => powerRoll(seed, "moonbeam", at, sq);
  const pieces = [...moves.keys()].filter(ok).sort();
  if (target === "random") return pieces.sort((a, b) => roll(a) - roll(b) || (a < b ? -1 : 1));
  if (target === "valuable") {
    const type = (sq: string) => pieceAt(fen, sq)!.type;
    const score = (sq: string) => (type(sq) === "p" ? 0 : 100) + VALUE[type(sq)]! * 3 + moves.get(sq)!;
    const ranked = pieces.sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1));
    const top = ranked.slice(0, 3).sort((a, b) => roll(a) - roll(b) || (a < b ? -1 : 1));
    return [...top, ...ranked.slice(3)];
  }
  const out: string[] = [];
  for (const m of lines ?? []) {
    const sq = from(m);
    if (legal.includes(m) && ok(sq) && !out.includes(sq)) out.push(sq);
  }
  const rest = pieces
    .filter((sq) => !out.includes(sq))
    .map((sq) => ({ sq, value: VALUE[pieceAt(fen, sq)!.type]!, n: moves.get(sq)!, roll: roll(sq) }))
    .sort((a, b) => b.value - a.value || b.n - a.n || a.roll - b.roll || (a.sq < b.sq ? -1 : 1));
  return [...out, ...rest.map((r) => r.sq)];
}

/**
 * A stunned piece can't take part in `move` (`fen`: before it): the piece moving is held, or the move is castling and
 * the rook it moves is held (its corner on the king's rank: the h-file for a king's step to the g-file, the a-file
 * for one to the c-file).
 */
export function stunnedIn(fen: string, move: string, held: ReadonlySet<string> | readonly string[]): boolean {
  const has = (sq: string) => ("has" in held ? held.has(sq) : held.includes(sq));
  if (has(from(move))) return true;
  const f0 = move.charCodeAt(0);
  const f1 = move.charCodeAt(2);
  if (Math.abs(f1 - f0) !== 2 || move[1] !== move[3] || pieceAt(fen, from(move))?.type !== "k") return false;
  return has(`${f1 > f0 ? "h" : "a"}${move[1]}`);
}

/**
 * The squares `count` beams stun (beamOrder's, in turn), each kept only if the crowd still has a legal move with every
 * piece picked so far held: fewer when that runs out, none when no piece fits.
 */
export function chooseBeams(fen: string, crowd: Side, lines: readonly string[] | null, count: number, seed: number, at: number, target: MoonbeamTarget = BOSS_POWERS.moonbeamTarget): string[] {
  if (count <= 0) return [];
  const legal = legalMoves(fen);
  const picked: string[] = [];
  for (const sq of beamOrder(fen, crowd, lines, seed, at, target)) {
    if (picked.length >= count) break;
    const held = new Set([...picked, sq]);
    if (legal.some((m) => !stunnedIn(fen, m, held))) picked.push(sq);
  }
  return picked;
}

/**
 * The crowd's top `n` moves in the position after his `move` (`fen`: before it), best first (the line with the highest
 * score first, ties by move), at `nodes`: what his beams weigh. The host's answer online (the boss request's `beam`),
 * this device's in solo and the sims. [] when the crowd has no move; null when the engine gives no answer (the beams
 * then go by value).
 */
export async function beamLines(engine: EngineLike, fen: string, move: string, n: number, nodes: number = BOSS_POWERS.moonbeamNodes): Promise<string[] | null> {
  let after: string;
  try {
    after = applyMove(fen, move);
  } catch {
    return null;
  }
  if (!legalMoves(after).length) return [];
  try {
    const top = await (engine.topMovesAt ? engine.topMovesAt(after, n, nodes) : engine.topMoves(after, n));
    return [...top].sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1)).map((m) => m.move);
  } catch {
    return null;
  }
}

/** His powers' state (fresh before his first move). */
const mooOf = (p: Pick<BossPowerState, "moo"> | null | undefined): MooState => p?.moo ?? FRESH;

/** A Moonbeam after his `moves`-th move: every moonbeamEvery-th; the test switch (?power=moonbeam): after every one. */
export const beamAfter = (moves: number, test: string, s: Pick<MooSettings, "moonbeamEvery"> = BOSS_POWERS): boolean =>
  test === "moonbeam" || moves % Math.max(1, Math.round(s.moonbeamEvery)) === 0;

/** The Full Moon came at the start of this turn of his (after crowd move `crowdMoves`): his move now ends with the flurry. */
const flurryNow = (m: MooState, crowdMoves: number): boolean => !!m.full && m.full.at === crowdMoves;

const setPowers = (b: Battle, change: (p: BossPowerState) => BossPowerState): void => {
  const boss = b.state.boss!;
  b.state = { ...b.state, boss: { ...boss, powers: change(boss.powers!) } };
};

/** The stun on crowd turn `turn`, or null. */
const stunOn = (m: MooState, turn: number) => (m.stun && m.stun.turn === turn ? m.stun : null);

/** Moo & Moon: a moonbeam stuns a crowd piece every few moves; the Full Moon, full strength for a few moves and a flurry. */
export const MOO: BossRules = {
  id: "moo",
  // The Full Moon: the meter full as a crowd turn begins, its warning that turn; at the start of his turn, as the crowd's
  // move lands (afterCrowdMove). The trigger (`ultNext`, kept): at the start of his next turn, without the warning. The
  // test switch: warned as the second turn begins.
  ultimateOnHisTurn: true,
  ultimate(next, t) {
    if (next.warnAt !== undefined || t.ultNext) return false;
    if (meterFull(next, t) || testSwitch(t, next)) {
      next.warnAt = t.turn;
      t.events.push({ kind: "warn", turn: t.turn });
    }
    return false;
  },
  // From his transformation until his last move at full strength: the meter held empty, no other Full Moon.
  ultimateRunning: (p, turn) => turn <= (p.ultAt ?? 0) || (p.moo?.full?.left ?? 0) > 0,
  // (A stun set for another turn: gone.)
  wearOff(next, t) {
    const m = next.moo;
    if (m?.stun && m.stun.turn !== t.turn) next.moo = { ...m, stun: null };
  },
  // As the crowd's turn begins, after his move: the beam (or the flurry) that landed, then his daze if the Full Moon is over.
  everyTurn(next, t) {
    const m = next.moo;
    if (!m) return;
    const stun = stunOn(m, t.turn);
    if (stun?.flurry) t.events.push({ kind: "flurry", turn: t.turn, squares: [...stun.squares] });
    else if (stun) t.events.push({ kind: "moonbeam", turn: t.turn, square: stun.squares[0]! });
    if (m.dazed === t.turn) t.events.push({ kind: "dazed", turn: t.turn });
  },
  // (Moonbeam works through his moves: afterBossMove.)
  passive() {},
  // Stunned pieces can't move this turn (Ginger's frozen piece's way), nor castle with a stunned rook (stunnedIn).
  crowdFilter(allowed, boss, fen) {
    const stun = stunOn(mooOf(boss.powers), turnOf(boss));
    return stun ? allowed.filter((m) => !stunnedIn(fen, m, stun.squares)) : allowed;
  },
  powerTurn: (boss) => !!stunOn(mooOf(boss.powers), turnOf(boss)),
  // The Full Moon: his moves are the engine's at full strength (the runner's "best").
  bestReply: (boss) => (boss.powers?.moo?.full?.left ?? 0) > 0,
  // (The bar's level is up for the whole Full Moon, the crowd's turns between his moves too.)
  fullStretch: (boss) => (boss.powers?.moo?.full?.left ?? 0) > 0,
  afterCrowdMove(b) {
    mooBattle.afterCrowdMove(b);
  },
  afterBossMove(b, _move, extras) {
    mooBattle.afterHisMove(b, extras?.beam ?? null);
  },
  view: (p) => {
    const m = mooOf(p);
    const stun = stunOn(m, p.turn);
    return { stunned: stun ? [...stun.squares] : [], fullMoon: m.full ? { left: m.full.left } : null };
  },
};

// ---------------- His part in the match runner ----------------

export const mooBattle = {
  /**
   * How many of the crowd's top lines his beams weigh after his move now (the boss request's `beam`; solo's own), or
   * null: no beam lands after it (none due, not his turn, not his battle), or its target doesn't weigh them (only "best"
   * does).
   */
  beamAsk(b: Battle, s: MooSettings = BOSS_POWERS): number | null {
    const boss = b.state.boss;
    if (!boss?.powers || boss.id !== "moo" || boss.result || !b.bossToMove()) return null;
    const m = mooOf(boss.powers);
    // (Only the "best" target weighs the engine's lines.)
    if (s.moonbeamTarget !== "best") return null;
    return flurryNow(m, boss.crowdMoves) || beamAfter(m.moves + 1, b.settings.bossPowerTest, s) ? s.moonbeamLines : null;
  },

  /**
   * After the crowd's move: the stun is over (the crowd's turn has ended); and the Full Moon, when it's due (warned as the
   * last crowd turn began, or the admins' trigger), comes now, at the start of his turn: his transformation (`fullMoon`,
   * while he thinks), the meter spent, fullMoonMoves of his moves at full strength from this one.
   */
  afterCrowdMove(b: Battle, s: MooSettings = BOSS_POWERS): void {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "moo") return;
    let next = p.moo?.stun ? { ...p, moo: { ...p.moo, stun: null } } : p;
    const due = !!next.ultNext || (next.warnAt !== undefined && next.warnAt <= boss.crowdMoves);
    // (Not once the battle is over: a result, a mate or stalemate, the move cap.)
    if (next.ultAt === undefined && due && !boss.result && b.bossToMove() && boss.crowdMoves < b.settings.bossMaxMoves) {
      const { ultNext: _trigger, ...rest } = next;
      const events: PowerEvent[] = [...rest.events, { kind: "fullMoon", turn: rest.turn }];
      next = unleashed({ ...rest, ultAt: boss.crowdMoves, moo: { ...mooOf(rest), full: { at: boss.crowdMoves, left: Math.max(1, Math.round(s.fullMoonMoves)) } }, events });
    }
    if (next !== p) setPowers(b, () => next);
  },

  /**
   * After his move (`lines`: the crowd's top moves after it, from beamLines; null: none, the beams go by value): his count
   * goes on; a beam lands when one is due (the flurry on the Full Moon's first turn, in its place), stunning the crowd's
   * pieces for its next turn; the Full Moon's count goes down, and at its end he's dazed as the crowd's turn begins.
   */
  afterHisMove(b: Battle, lines: readonly string[] | null, s: MooSettings = BOSS_POWERS): void {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "moo") return;
    const m = mooOf(p);
    const moves = m.moves + 1;
    const flurry = flurryNow(m, boss.crowdMoves);
    const count = flurry ? s.flurryBeams : beamAfter(moves, b.settings.bossPowerTest, s) ? 1 : 0;
    const fen = b.boards.get(b.state.boards[0]!)!.fen;
    const squares = count && sideToMove(fen) === boss.crowdSide ? chooseBeams(fen, boss.crowdSide, lines, count, p.seed, moves, s.moonbeamTarget) : [];
    const stun = squares.length ? { turn: boss.crowdMoves + 1, squares, ...(flurry ? { flurry: true as const } : {}) } : null;
    let full = m.full;
    let dazed = m.dazed;
    if (full) {
      const left = full.left - 1;
      if (left > 0) full = { ...full, left };
      else {
        full = null;
        dazed = boss.crowdMoves + 1;
      }
    }
    setPowers(b, (q) => ({ ...q, moo: { moves, stun, full, ...(dazed !== undefined ? { dazed } : {}) } }));
  },
};

/** His events for a turn (the sims and tests read them). */
export const mooEvents = (events: readonly PowerEvent[]) => events.filter((e) => e.kind === "moonbeam" || e.kind === "flurry" || e.kind === "fullMoon" || e.kind === "dazed");
