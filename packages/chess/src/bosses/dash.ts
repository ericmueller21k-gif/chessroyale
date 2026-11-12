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
 * empty bank's, gets a move played for you at random (`outOfTime`: seeded, from the judge's top flagTop moves allowed; the sim's
 * call: any legal move at random hung a piece too often and decided the battle), his jab as your next turn begins (`flag`). In a raid that's only when nobody picked in time: the crowd's picks made in time are played as ever. The bank
 * stays at 0 and refills by its increment.
 *
 * Fair play: online the server sets every deadline (the runner's allowedMsFor reads his clock: lobby.ts), so a scrambled move's
 * 3 s, a slapped move's shorter clock and the bank are the server's, never a device's word; a pick after the deadline is refused.
 *
 * Test switches (solo): `?power=clockslap`: his first move slaps as a capture would, whatever it is (then only his captures);
 * `?power=scramble` warns as the second turn begins; `?power=rush` warns of his Scramble Rush as the second turn begins (it comes
 * as the third does); `?power=clockfit` adds a multi-hit on his second turn; `?power=popoff` has his pop-off on his second turn.
 *
 * Dash v2 (Eric, Nov 6; docs/decisions/2026-11-06-dash-v2.md): Time Scramble at most twice a battle (maxUltimates.dash); and once a
 * battle his **Scramble Rush** (below): a memory test over a frozen position, whose only outcome is his extra move or not.
 * Dash v3 (Eric, Nov 7; docs/decisions/2026-11-07-dash-clock.md): his clock multi-hit every 4 or 5 of his moves (`clockFit`: 5
 * quick smacks and always a line, clockHitTurns), and twice a battle his pop-off (popOff: state, not an event; popOffMs holds his
 * thinking for its two beats, 3 smacks and a pop-off line, then 10 fast smacks and a love line).
 */
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type BossState, type DashRush, type DashState } from "@chessroyale/core";
import { playOnBoard, type BoardState } from "../boards.ts";
import { toSan } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import { powerRoll, rageNow, turnOf, warnThenUnleash, type Battle, type BossRules, type Side } from "./base.ts";
import { extraMoveCandidates, extraMoveFrom, passTurn } from "./hollow.ts";

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
export const DASH_FX = {
  slap: DASH_ANIM.clockSlap,
  scramble: 1500 + DASH_ANIM.timeScramble,
  flag: DASH_ANIM.check,
  clockFit: 1500,
  rushExtra: 2200,
  // (His pop-off's two beats, while he thinks: dashPopOff's popMs and loveMs.)
  popOff: BOSS_POWERS.dashPopOff.popMs,
  popOffFast: BOSS_POWERS.dashPopOff.loveMs,
} as const;

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

/**
 * The move played for you when your time ran out: at random (seeded by the battle and the turn: the same on every device) from
 * the judge's top `flagTop` moves allowed this turn (`ranked`: the round's scored moves, best first); with none of them, or
 * flagTop 0, from every move allowed.
 */
export function flagMove(seed: number, turn: number, allowed: readonly string[], ranked: readonly string[] = [], s: Pick<BossPowerSettings, "flagTop"> = BOSS_POWERS): string | null {
  if (!allowed.length) return null;
  const top = s.flagTop > 0 ? ranked.filter((m) => allowed.includes(m)).slice(0, s.flagTop) : [];
  const from = top.length ? [...top].sort() : [...allowed].sort();
  return from[Math.floor(powerRoll(seed, "flag", turn) * from.length)]!;
}

/** How many Time Scrambles a battle he has at most (BOSS_POWERS.maxUltimates.dash; none set: no cap). */
const scrambleMax = (s: Pick<BossPowerSettings, "maxUltimates"> = BOSS_POWERS): number => s.maxUltimates?.["dash"] ?? Infinity;

export const DASH: BossRules = {
  id: "dash",
  noTimeLoss: true,
  // At most maxUltimates.dash Time Scrambles a battle (Eric, Nov 6: "about twice a game"): then his meter stays empty, dimmed.
  get ultimateMax() {
    return scrambleMax();
  },
  spentMeterShown: true,
  // Time Scramble: the usual warning as a turn begins; the next turn, it comes (the admins' trigger: at once).
  ultimate(next, t) {
    if (next.warnAt === undefined && (next.ults ?? 0) >= scrambleMax(t.s)) return false;
    // (Not while his Scramble Rush is warned and still to come: it waits until after it.)
    if (next.warnAt === undefined && !t.ultNext && rushWarned(next.dash)) return false;
    if (!warnThenUnleash(next, t)) return false;
    t.events.push({ kind: "scramble", turn: t.turn, count: t.s.scrambleMoves, seconds: t.s.scrambleSeconds });
    return true;
  },
  // (Its moves: the meter stays empty and nothing else comes until the last is over.)
  ultimateRunning: (p, turn, s) => scrambleOn(p, turn, s),
  // As the crowd's turn after his turn's end begins: your flag's jab, then his slap.
  everyTurn(next, t) {
    // His pop-off, twice a battle, on two of his turns (from the seed; the test switch: his second and eighth turns). It is state,
    // not an event: it plays while he thinks, before his move lands (popOffMs), so it's set before the rest reads his state.
    if (next.dash && popOffTurns(t.seed, t.s.dashPopOff, t.test).includes(t.turn)) next.dash = { ...next.dash, popOff: { at: t.turn } };
    const d = next.dash;
    if (!d) return;
    if (d.flag && d.flag.at + 1 === t.turn) t.events.push({ kind: "flag", turn: t.turn, move: d.flag.move });
    if (d.slap && d.slap.at + 1 === t.turn) t.events.push({ kind: "slap", turn: t.turn, ms: d.slap.ms, bank: d.slap.bank });
    // His clock multi-hit: every 4 or 5 of his moves, always with a line (never dropped for another of his moves this turn).
    if (clockHitOn(t.seed, t.turn, t.s.dashClockFit, t.test)) t.events.push({ kind: "clockFit", turn: t.turn, count: t.s.dashClockFit.smacks });
    // His Scramble Rush, once a battle, warned a turn ahead as an ultimate is (Eric, Nov 6: RAGE!, "Next turn: Scramble Rush",
    // his line); as the next crowd turn begins it comes, the crowd's turn waiting for it (the runner's rushDue), the board as it is.
    // (Never while the crowd is in check: he couldn't move again then, as the crowd's turn can't pass, so the verdict and his
    // extra move could disagree. It waits, still warned, for the next crowd turn out of check; Nov 8.)
    if (rushWarned(d) && t.turn > d.rushWarn!) {
      if (!passTurn(t.fen)) return;
      const moves = chooseRush(t.fen, t.crowd, t.seed, t.turn, t.s.dashScramble);
      if (moves.length) next.dash = { ...d, rush: { at: t.turn - 1, moves } };
      return;
    }
    if (!d.rush && d.rushWarn === undefined && rushNow(next, t)) {
      next.dash = { ...d, rushWarn: t.turn };
      t.events.push({ kind: "rushWarn", turn: t.turn });
      return;
    }
  },
  // (His slaps come at his turn's end, after a capture: afterBossMove.)
  passive() {},
  // (No powerTurn: his powers take time, never a square or a move, so every turn counts for fair play as ever and the God
  // King's Last Stand works as ever. A turn nobody picked has no picks to count, and its random move, unscored, is never one
  // he takes back.)
  outOfTime(boss, _fen, allowed, ranked) {
    return boss.powers ? flagMove(boss.powers.seed, turnOf(boss), allowed, ranked) : null;
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

// ---------------- His clock: the multi-hit and the pop-off ----------------

/**
 * The turns of his clock multi-hits up to `upTo` (dashClockFit.every: each 4 or 5 of his own moves after the last, from the
 * battle's seed, so the same on every device). The first comes after 4 or 5 of his moves, too.
 */
export function clockHitTurns(seed: number, upTo: number, s: BossPowerSettings["dashClockFit"] = BOSS_POWERS.dashClockFit): number[] {
  const [lo, hi] = s.every;
  const out: number[] = [];
  let at = 0;
  for (let i = 0; at < upTo && i < 1000; i++) {
    at += lo + Math.floor(powerRoll(seed, "hit", i) * (hi - lo + 1));
    if (at <= upTo) out.push(at);
  }
  return out;
}

/** Whether his turn `turn` is a multi-hit turn (the test switch ?power=clockfit: his second turn too). */
export const clockHitOn = (seed: number, turn: number, s: BossPowerSettings["dashClockFit"] = BOSS_POWERS.dashClockFit, test = ""): boolean =>
  (test === "clockfit" && turn === 2) || clockHitTurns(seed, turn, s).includes(turn);

/**
 * His pop-off is playing as his thinking screen's beats, for the move he's about to play: the turn it came on is his turn to think
 * (powers.turn). Until his move lands, the move list keeps his move out (MovePanel's shownRows).
 */
export const popOffPending = (boss: { id?: string; powers?: { turn?: number; dash?: { popOff?: { at: number } | null } | null } | null } | null | undefined): boolean =>
  boss?.id === "dash" && !!boss.powers?.dash?.popOff && boss.powers.dash.popOff.at === boss.powers.turn;

/**
 * His move's row stays out of the move list while his pop-off's beats play: the pop-off came on this turn or the one before (the
 * runner's turn moves on as his move is played, before its beats end).
 */
export const popOffHolding = (boss: { id?: string; powers?: { turn?: number; dash?: { popOff?: { at: number } | null } | null } | null } | null | undefined): boolean =>
  boss?.id === "dash" && !!boss.powers?.dash?.popOff && boss.powers.dash.popOff.at >= (boss.powers.turn ?? 0) - 1;

/**
 * His two pop-off turns: two of his turns from dashPopOff.from to dashPopOff.to, at least dashPopOff.gap apart, from the battle's
 * seed (the same on every device; in order). The test switch (?power=popoff): his second and fourth turns (close together, so
 * the e2e plays few moves: before his Scramble Rush can come, turn 7, and before Stockfish mates the test's shuffled knights).
 */
export function popOffTurns(seed: number, s: BossPowerSettings["dashPopOff"] = BOSS_POWERS.dashPopOff, test = ""): [number, number] {
  if (test === "popoff") return [2, 4];
  const first = s.from + Math.floor(powerRoll(seed, "popoff", 1) * (s.to - s.from + 1 - s.gap));
  const second = first + s.gap + Math.floor(powerRoll(seed, "popoff", 2) * (s.to - first - s.gap + 1));
  return [first, second];
}

/**
 * How long his pop-off holds his thinking, ms (its two beats, DASH_FX.popOff + popOffFast), while he thinks for the turn it comes
 * (`powers.turn`: the turn his move after the crowd's is dispatched as). Else 0. That think waits for it (bossThinkMs, the solo and
 * the server alike), so his move lands after it and no crowd clock runs meanwhile.
 */
export const popOffMs = (boss: { id?: string; powers?: { turn?: number; dash?: { popOff?: { at: number } | null } | null } | null } | null | undefined): number =>
  popOffPending(boss) ? DASH_FX.popOff + DASH_FX.popOffFast : 0;

// ---------------- Scramble Rush ----------------

type RushSettings = BossPowerSettings["dashScramble"];

/** His Scramble Rush is warned and still to come (it comes as the crowd turn after its warning begins). */
const rushWarned = (d: DashState | null | undefined): boolean => !!d && d.rushWarn !== undefined && !d.rush;

/**
 * His Scramble Rush is warned as this crowd turn begins (it comes the next): never before turn dashScramble.from, never with Time
 * Scramble's warning or effect out, and only once his meter is dashScramble.atMeter full (the test switch `?power=rush`: as the
 * second turn begins).
 */
function rushNow(next: BossPowerState, t: { turn: number; test: string; rageSpeed: number; s: BossPowerSettings }): boolean {
  if (t.test === "rush") return t.turn >= 2;
  if (t.turn < t.s.dashScramble.from || next.warnAt !== undefined || next.ultAt !== undefined) return false;
  return rageNow(next, t.rageSpeed, t.s) >= t.s.rageFull * t.s.dashScramble.atMeter;
}

/** The pieces on a board, by square ("e4" → "wp"). */
export function boardPieces(fen: string): Map<string, string> {
  const out = new Map<string, string>();
  fen
    .split(" ")[0]!
    .split("/")
    .forEach((row, i) => {
      let f = 0;
      for (const c of row) {
        if (/\d/.test(c)) f += Number(c);
        else out.set(`${"abcdefgh"[f++]}${8 - i}`, `${c === c.toUpperCase() ? "w" : "b"}${c.toLowerCase()}`);
      }
    });
  return out;
}

/** A board's placement field from its pieces by square (the rest of `fen` kept). */
export function withPieces(fen: string, pieces: ReadonlyMap<string, string>): string {
  const rows: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let row = "";
    let gap = 0;
    for (const f of "abcdefgh") {
      const p = pieces.get(`${f}${r}`);
      if (!p) gap++;
      else {
        row += `${gap || ""}${p[0] === "w" ? p[1]!.toUpperCase() : p[1]}`;
        gap = 0;
      }
    }
    rows.push(row + (gap || ""));
  }
  return [rows.join("/"), ...fen.split(" ").slice(1)].join(" ");
}

/**
 * The Rush's sweep (seeded by the battle and the turn): dashScramble.pieces of the crowd's pieces and as many of his, never a king,
 * each to its own empty square of ranks dashScramble.ranks (empty before the sweep, so no two land together and none lands where
 * another stood). The crowd's first. Fewer when a side has fewer pieces or the ranks have too few empty squares.
 */
export function chooseRush(fen: string, crowd: Side, seed: number, turn: number, s: RushSettings = BOSS_POWERS.dashScramble): DashRush["moves"] {
  const pieces = boardPieces(fen);
  const order = <T extends string>(xs: T[], tag: string) => xs.map((x) => ({ x, k: powerRoll(seed, tag, turn, x) })).sort((a, b) => a.k - b.k).map((e) => e.x);
  const side = (c: Side) => order([...pieces].filter(([, p]) => p[0] === c && p[1] !== "k").map(([sq]) => sq), `rush-${c}`).slice(0, s.pieces);
  const picked = [...side(crowd), ...side(crowd === "w" ? "b" : "w")];
  const empty: string[] = [];
  for (let r = s.ranks[0]; r <= s.ranks[1]; r++) for (const f of "abcdefgh") if (!pieces.has(`${f}${r}`)) empty.push(`${f}${r}`);
  const spots = order(empty, "rush-to");
  return picked.slice(0, spots.length).map((from, i) => ({ from, to: spots[i]!, piece: pieces.get(from)! }));
}

/**
 * Where each swept piece stands now (by the square it came from), from a player's placements (`places`: its square before the
 * sweep → the square they put it on). A placement counts only onto a square on the board that's free: no piece that wasn't swept
 * stands there, and no other swept piece was put there first (in the sweep's order). Anything else (junk, a square taken) leaves
 * that piece where he dropped it; one whose drop square another took stands nowhere (it counts as wrong).
 */
export function rushSquares(fen: string, rush: Pick<DashRush, "moves">, places: Readonly<Record<string, unknown>> = {}): Map<string, string | null> {
  const pieces = boardPieces(fen);
  const swept = new Set(rush.moves.map((m) => m.from));
  const taken = new Set([...pieces.keys()].filter((sq) => !swept.has(sq)));
  const out = new Map<string, string | null>();
  for (const m of rush.moves) {
    const want = places[m.from];
    if (typeof want === "string" && /^[a-h][1-8]$/.test(want) && !taken.has(want)) {
      out.set(m.from, want);
      taken.add(want);
    }
  }
  for (const m of rush.moves) {
    if (out.has(m.from)) continue;
    out.set(m.from, taken.has(m.to) ? null : m.to);
    if (!taken.has(m.to)) taken.add(m.to);
  }
  return out;
}

/** The board as a player sees it in the Rush: the position with each swept piece where it stands now (rushSquares). */
export function rushFen(fen: string, rush: Pick<DashRush, "moves">, places: Readonly<Record<string, unknown>> = {}): string {
  const pieces = boardPieces(fen);
  const at = rushSquares(fen, rush, places);
  for (const m of rush.moves) pieces.delete(m.from);
  for (const m of rush.moves) {
    const sq = at.get(m.from);
    if (sq) pieces.set(sq, m.piece);
  }
  return withPieces(fen, pieces);
}

/** Squares apart as a king walks (1: next to it, a diagonal too). */
export const kingSteps = (a: string, b: string): number => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));

/** One swept piece's state on a player's board: put back right, put down wrong (`off`: how far from where one like it stood), or still where he dropped it. */
export type RushMark = { square: string; piece: string; right: boolean; placed: boolean; off: number };

/**
 * A player's Rush, judged (the same code on the server, solo and every screen): each swept piece where it stands now; it's right
 * when a piece like it (the same color and kind) stood on that square before the sweep, so two like pieces swapped count as both
 * right. `correct`: the swept pieces right. A piece never moved counts as wrong (not placed).
 */
export function rushJudge(fen: string, rush: Pick<DashRush, "moves">, places: Readonly<Record<string, unknown>> = {}): { correct: number; marks: RushMark[] } {
  const at = rushSquares(fen, rush, places);
  const homes = (piece: string) => rush.moves.filter((m) => m.piece === piece).map((m) => m.from);
  const marks: RushMark[] = rush.moves.flatMap((m) => {
    const sq = at.get(m.from);
    if (!sq) return [];
    const home = homes(m.piece);
    return [{ square: sq, piece: m.piece, right: home.includes(sq), placed: sq !== m.to, off: Math.min(...home.map((h) => kingSteps(h, sq))) }];
  });
  return { correct: marks.filter((x) => x.right).length, marks };
}

/** A bot's Rush: how many of the swept pieces it puts back (each with dashScramble.botHit's chance, from the seed). */
export function botRushCorrect(seed: number, botId: string, rush: Pick<DashRush, "at" | "moves">, s: RushSettings = BOSS_POWERS.dashScramble): number {
  return rush.moves.filter((_, i) => powerRoll(seed, "rush-bot", botId, rush.at, i) < s.botHit).length;
}

/**
 * The crowd held: its mean put back (people's and bots' alike) at least dashScramble.needCorrect, or all of them when fewer were
 * swept. (Solo, only your own count is passed: finishRush's `only`; Eric, Nov 8.)
 */
export const rushHeld = (correct: readonly number[], swept: number, s: RushSettings = BOSS_POWERS.dashScramble): boolean =>
  !correct.length || correct.reduce((a, b) => a + b, 0) / correct.length >= Math.min(s.needCorrect, swept) - 1e-9;

/**
 * His extra move after a failed Rush (Eric, Nov 8: "if YOU fail, he moves twice"): Hollow's quiet move within the cap
 * (extraMoveFrom) when there's one; else the quiet candidate closest to no gain at all (the least either way; never a forced mate
 * in its line, unless every one has one: then one against him before his own). Null only when the crowd's turn can't pass or he has no quiet move.
 */
export async function dashExtraMoveFrom(engine: EngineLike, fen: string): Promise<string | null> {
  const capped = await extraMoveFrom(engine, fen);
  if (capped) return capped;
  const passed = passTurn(fen);
  const candidates = passed ? extraMoveCandidates(passed) : [];
  if (!passed || !candidates.length) return null;
  const crowdBest = (await engine.topMoves(fen, 1))[0];
  const before = crowdBest ? 1 - crowdBest.expected : 0.5;
  const scored = (await engine.scoreMoves(passed, candidates)).filter((m) => candidates.includes(m.move));
  // Prefer no forced mate; then one against him (the crowd's); his own only when nothing else is left (review of #561).
  const quiet = scored.filter((m) => m.mate === undefined);
  const theirs = scored.filter((m) => m.mate !== undefined && m.mate < 0);
  const pool = quiet.length ? quiet : theirs.length ? theirs : scored;
  return [...pool].sort((a, b) => Math.abs(a.expected - before) - Math.abs(b.expected - before) || (a.move < b.move ? -1 : 1))[0]?.move ?? candidates[0]!;
}

/** His extra move when no engine answer came (or one that isn't a candidate): a quiet candidate from the battle's seed; null: none. */
export const rushStandIn = (seed: number, at: number, candidates: readonly string[]): string | null =>
  candidates.length ? [...candidates].sort()[Math.floor(powerRoll(seed, "rush-extra", at) * candidates.length)]! : null;

/** A swept piece's moves left in the put-back (`moved`: each piece's moves so far, by its square before the sweep). */
export const rushMovesLeft = (moved: Readonly<Record<string, number>> | undefined, from: string, s: Pick<RushSettings, "movesPerPiece"> = BOSS_POWERS.dashScramble): number =>
  Math.max(0, s.movesPerPiece - (moved?.[from] ?? 0));

/**
 * A player's placements as they send them (whole, as each is made: `next`), against those kept so far (`prev`) and each swept
 * piece's moves so far (`moved`): a piece's square changes only while it has moves left (dashScramble.movesPerPiece; Eric, Nov 6:
 * "you can only move a piece up to 2 times"). A piece is counted by its square before the sweep, wherever it stands now, never
 * by the square it's on. Junk is dropped. The server keeps what this keeps; every screen asks rushMovesLeft first.
 */
export function rushKeep(
  rush: Pick<DashRush, "moves">,
  prev: Readonly<Record<string, string>>,
  moved: Readonly<Record<string, number>>,
  next: Readonly<Record<string, unknown>>,
  s: Pick<RushSettings, "movesPerPiece"> = BOSS_POWERS.dashScramble,
): { places: Record<string, string>; moved: Record<string, number> } {
  const places: Record<string, string> = {};
  const count: Record<string, number> = { ...moved };
  for (const m of rush.moves) {
    const want = next[m.from];
    const was = prev[m.from];
    if (typeof want === "string" && /^[a-h][1-8]$/.test(want) && want !== was && rushMovesLeft(count, m.from, s) > 0) {
      places[m.from] = want;
      count[m.from] = (count[m.from] ?? 0) + 1;
    } else if (was !== undefined) places[m.from] = was;
  }
  return { places, moved: count };
}

/**
 * The Rush's beats (ms from its start; the server and every screen alike). Nobody's clock runs.
 *   0            the countdown: "1.00" down to "0.00" over `countdownMs` (a second that lasts five)
 *   scatterAt    his five copies sweep the board until `scatterUntil`: each swept piece gone as one passes it, on its new square
 *                as one passes there
 *   linesAt      his line; `askAt` the God King's ("Put the pieces back…")
 *   placeAt      the second countdown: `placeMs` to drag or tap the swept pieces back, until `placeUntil` (and the late grace)
 *   placeUntil   time's up: the board as it was, and the verdict until `total`
 */
export function rushTimeline(s: RushSettings = BOSS_POWERS.dashScramble) {
  const placeAt = s.countdownMs + s.linesMs;
  const placeUntil = placeAt + s.placeMs;
  return { countdownMs: s.countdownMs, scatterAt: s.scatterAt, scatterUntil: s.scatterAt + s.scatterMs, linesAt: s.countdownMs, askAt: s.countdownMs + Math.round(s.linesMs * 0.45), placeAt, placeUntil, total: placeUntil + s.resultMs };
}

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
  /** His Scramble Rush, once it has come (the swept pieces, and once it's over how many the crowd put back and his extra move). */
  rush?: DashRush | null;
  /** His pop-off (Eric, Nov 7): his turn it comes on, so his screen plays it while he thinks. */
  popOff?: { at: number } | null;
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
    ...(d.rush ? { rush: { ...d.rush, moves: d.rush.moves.map((m) => ({ ...m })) } } : {}),
    ...(d.popOff ? { popOff: { ...d.popOff } } : {}),
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

  /** His Scramble Rush is due: it came as this crowd turn began, not yet over (the crowd's turn waits for it). */
  rushDue(b: Battle): boolean {
    const boss = b.state.boss;
    const r = boss?.powers?.dash?.rush;
    return !!r && r.at === boss!.crowdMoves && r.correct === undefined && !boss!.result && !b.finalGameOver() && !b.bossToMove();
  },

  /**
   * The Rush is over: each person's placements (`places`, by player id: square before the sweep → square put on) judged by
   * rushJudge, each bot's from the seed; the crowd held when its mean is at least needCorrect, else his extra move is due. The
   * game's position never changed: nothing on the board changes here. Returns each player's count and the verdict.
   * `only` (solo: you, while you're in; Eric, Nov 8: "there should be no average when I'm playing in solo mode"): only that
   * player's put-back counts, no bots, no mean. Online the crowd's mean stays.
   * A failed Rush with no quiet move for him at all (extraMoveCandidates: none) is "skipped" here, in the verdict itself, so the
   * screens never say he moves again when he can't; otherwise his extra move always comes (applyExtraMove).
   */
  finishRush(b: Battle, places: Readonly<Record<string, Readonly<Record<string, unknown>>>>, only?: string): { correct: Record<string, number>; mean: number; held: boolean } {
    const boss = b.state.boss!;
    const p = boss.powers!;
    const d = dashOf(p);
    const r = d.rush;
    if (!r || r.correct !== undefined) return { correct: {}, mean: r?.correct ?? 0, held: r?.extra === undefined };
    const fen = b.boards.get(b.state.boards[0]!)!.fen;
    const correct: Record<string, number> = {};
    const judged = only !== undefined ? b.alive().filter((pl) => pl.id === only) : b.alive();
    for (const pl of judged) correct[pl.id] = pl.isBot ? botRushCorrect(p.seed, pl.id, r) : rushJudge(fen, r, places[pl.id] ?? {}).correct;
    const counts = Object.values(correct);
    const mean = counts.length ? counts.reduce((a, c) => a + c, 0) / counts.length : r.moves.length;
    const held = rushHeld(counts, r.moves.length);
    const passed = held ? null : passTurn(fen);
    const extra = held ? undefined : passed && extraMoveCandidates(passed).length ? ("due" as const) : ("skipped" as const);
    const rush: DashRush = { ...r, correct: Math.floor(mean * 10 + 1e-9) / 10, ...(extra ? { extra } : {}) };
    b.state = { ...b.state, boss: { ...boss, powers: { ...p, dash: { ...d, rush } } } };
    return { correct, mean, held };
  },

  /** His extra move is due: the crowd failed the Rush, before its turn's picks. */
  extraMoveDue(b: Battle): boolean {
    const boss = b.state.boss;
    const r = boss?.powers?.dash?.rush;
    return r?.extra === "due" && r.at === boss!.crowdMoves && !boss!.result && !b.finalGameOver() && !b.bossToMove();
  },

  /** His extra move from this device's engine (dashExtraMoveFrom); the engine failing, applyExtraMove's seeded stand-in. */
  async playExtraMove(b: Battle, engine: EngineLike): Promise<string | null> {
    const pick = await dashExtraMoveFrom(engine, b.boards.get(b.state.boards[0]!)!.fen).catch(() => null);
    return dashBattle.applyExtraMove(b, pick);
  },

  /**
   * Plays his extra move (from the host's engine online), as Hollow's after Lights out: the crowd's turn passes (a base), then
   * his quiet move. Unlike Hollow he never skips it once it's due (Eric, Nov 8: the verdict said he'd move again and he didn't):
   * a move that isn't a candidate, or none (the engine failed, a host sent ""), and he plays a quiet candidate from the seed
   * instead (rushStandIn). Unscored, never fair play's. Returns it, or null when it wasn't due.
   */
  applyExtraMove(b: Battle, move: string | null): string | null {
    const boss = b.state.boss!;
    const p = boss.powers!;
    const d = dashOf(p);
    const r = d.rush;
    if (!r || r.extra !== "due" || r.at !== boss.crowdMoves) return null;
    const id = b.state.boards[0]!;
    const board = b.boards.get(id)!;
    const passed = passTurn(board.fen);
    const candidates = passed ? extraMoveCandidates(passed) : [];
    if (move === null || !candidates.includes(move)) move = rushStandIn(p.seed, r.at, candidates);
    if (!passed || !move) {
      b.state = { ...b.state, boss: { ...boss, powers: { ...p, dash: { ...d, rush: { ...r, extra: "skipped" } } } } };
      return null;
    }
    const ply = board.history.length;
    const base: BoardState = { ...board, fen: passed, expected: 1 - board.expected, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: passed }] };
    b.boards.set(id, playOnBoard(base, move, base.expected));
    b.bossLast = { move, san: toSan(passed, move) };
    b.state = {
      ...b.state,
      boss: { ...boss, powers: { ...p, dash: { ...d, rush: { ...r, extra: "played" } }, events: [...p.events, { kind: "rushExtra", turn: p.turn, square: move.slice(2, 4) }] } },
    };
    return move;
  },
};
