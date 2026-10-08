/**
 * Boss powers: the rules each power answers, from the boss template (core's BOSS_ROSTER). Pure functions of the
 * battle's state and the position, so the server, the solo game and every screen work out the same thing: which
 * moves the crowd (and the boss) may play this turn, what happens as a turn begins, what each player sees, and
 * whether a turn counts for fair play. The ground rules:
 *
 * - The server decides every power, from the battle's seed (drawn once, as it starts) and the position.
 * - A power never leaves anyone without a legal move and never breaks check: if a restriction would leave no legal
 *   move (or no escape from check), it lifts for that turn. The king is never frozen.
 * - The judge plays by the same rules: the best move is the best of the allowed ones (judge.ts, runner.ts).
 * - A turn the boss plays for the crowd (the funhouse) isn't scored; any turn a power touches doesn't count for
 *   fair play.
 *
 * Turns are the crowd's: turn N is the crowd's Nth move of the battle (crowdMoves + 1 while it's being picked).
 */
import { BOSS_POWERS, bossDef, mulberry32, type BossPowerState, type BossState, type PowerEvent, type PowerId } from "@chessroyale/core";
import { legalMoves, pieceAt } from "./rules.ts";
import type { EngineLike } from "./runner.ts";
import type { MoveScore } from "./uci.ts";

type Side = "w" | "b";
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const other = (s: Side): Side => (s === "w" ? "b" : "w");
const from = (m: string) => m.slice(0, 2);
const to = (m: string) => m.slice(2, 4);

/** Material on the board for one side (pawns 1, knights and bishops 3, rooks 5, queens 9). */
export function materialOf(fen: string, side: Side): number {
  let total = 0;
  for (const c of fen.split(" ")[0]!) {
    const v = VALUE[c.toLowerCase()];
    if (v && (c === c.toUpperCase()) === (side === "w")) total += v;
  }
  return total;
}

/** A number in [0, 1) from the battle's seed and what it's for: the same on every device and every replay. */
export function powerRoll(seed: number, ...parts: readonly (string | number)[]): number {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (const ch of parts.join("|")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return mulberry32(h)();
}

/** The boss's powers, if it has any (its template's passive and ultimate). */
export function bossPowers(boss: Pick<BossState, "id"> | null | undefined): { passive: PowerId; ultimate: PowerId } | null {
  return bossDef(boss?.id)?.powers ?? null;
}

/** A battle's powers as it starts (nothing has happened yet; the first turn is set up by prepareTurn). */
export function initPowers(seed: number, fen: string, crowdSide: Side): BossPowerState {
  return { seed: seed >>> 0, turn: 0, material: materialOf(fen, other(crowdSide)), lost: 0, nextPassive: BOSS_POWERS.firstPassive, events: [] };
}

/** The crowd turn being picked now. */
const turnOf = (boss: Pick<BossState, "crowdMoves">) => boss.crowdMoves + 1;

/** The legal moves of the side not to move (as if it were its turn): what a square would block for the boss. */
function movesOfOther(fen: string): string[] {
  const parts = fen.split(" ");
  parts[1] = parts[1] === "w" ? "b" : "w";
  parts[3] = "-";
  try {
    return legalMoves(parts.join(" "));
  } catch {
    return [];
  }
}

/**
 * Freeze: the piece to ice, one that matters (the most valuable and mobile of the crowd's pieces: a pick from the
 * top three), never the king, never a piece without a move, and never one whose freeze leaves no other legal move.
 */
export function chooseFreeze(fen: string, crowdSide: Side, seed: number, turn: number, pie?: string | null): { square: string; piece: string } | null {
  const legal = legalMoves(fen).filter((m) => to(m) !== pie);
  const moves = new Map<string, number>();
  for (const m of legal) moves.set(from(m), (moves.get(from(m)) ?? 0) + 1);
  const options = [...moves.entries()]
    .map(([square, n]) => ({ square, n, piece: pieceAt(fen, square) }))
    .filter((o) => o.piece && o.piece.color === crowdSide && o.piece.type !== "k" && legal.length - o.n > 0)
    // Pieces before pawns; then the most valuable and mobile. Ties by square, so every device ranks alike.
    .map((o) => ({ ...o, score: (o.piece!.type === "p" ? 0 : 100) + VALUE[o.piece!.type]! * 3 + o.n }))
    .sort((a, b) => b.score - a.score || (a.square < b.square ? -1 : 1));
  if (!options.length) return null;
  const top = options.slice(0, 3);
  const pick = top[Math.floor(powerRoll(seed, "freeze", turn) * top.length)]!;
  return { square: pick.square, piece: pick.piece!.type };
}

const CENTRE = ["d4", "e4", "d5", "e5", "c3", "d3", "e3", "f3", "c4", "f4", "c5", "f5", "c6", "d6", "e6", "f6"];
const centreDistance = (sq: string) => Math.abs(sq.charCodeAt(0) - 100.5) + Math.abs(Number(sq[1]) - 4.5);

/**
 * Pie: the square to pie, an empty one near the centre chosen so the position barely changes: the fewest moves of
 * either side can land there right now (none, if possible), nearest the middle first, a pick from the best few.
 */
export function choosePie(fen: string, seed: number, turn: number): string | null {
  const reach = new Map<string, number>();
  for (const m of [...legalMoves(fen), ...movesOfOther(fen)]) reach.set(to(m), (reach.get(to(m)) ?? 0) + 1);
  const empty = CENTRE.filter((sq) => !pieceAt(fen, sq))
    .map((sq) => ({ sq, reach: reach.get(sq) ?? 0, d: centreDistance(sq) }))
    .sort((a, b) => a.reach - b.reach || a.d - b.d || (a.sq < b.sq ? -1 : 1));
  if (!empty.length) return null;
  const least = empty.filter((e) => e.reach === empty[0]!.reach).slice(0, 4);
  return least[Math.floor(powerRoll(seed, "pie", turn) * least.length)]!.sq;
}

/**
 * As a crowd turn begins (after the boss's move, or as the battle starts): the rage meter, the ultimate's warning
 * and the ultimate, and the passive. `fen` is the position with the crowd to move. Once per turn: calling it again
 * for the same turn (the re-pick after the God King's Last Stand) changes nothing. `test`: an ultimate (the test switch)
 * warned as the second turn begins and unleashed on the third (the passive comes on the second turn anyway).
 */
export function prepareTurn(boss: BossState, fen: string, test = ""): BossState {
  const powers = bossPowers(boss);
  const p = boss.powers;
  if (!powers || !p) return boss;
  const turn = turnOf(boss);
  if (p.turn === turn) return boss;
  const s = BOSS_POWERS;
  const crowd = boss.crowdSide;
  const events: PowerEvent[] = [];
  const lost = Math.max(p.lost, p.material - materialOf(fen, other(crowd)));
  const next: BossPowerState = { ...p, turn, lost, events };
  // What wore off: the ice after its turns (or once its piece is gone), the pie after its turns.
  if (next.frozen) {
    const piece = pieceAt(fen, next.frozen.square);
    if (next.frozen.until < turn || piece?.color !== crowd || piece.type !== next.frozen.piece) next.frozen = null;
  }
  if (next.pie && next.pie.until < turn) next.pie = null;
  // The ultimate: the rage meter full, a warning as this turn begins; the next turn, the ultimate. Once a match.
  const ult = powers.ultimate;
  let ultNow = false;
  if (next.ultAt === undefined) {
    if (next.warnAt === undefined) {
      // (The test switch: warned as the second turn begins, after the boss's first move, as in play.)
      if (lost >= s.rageFull || (test === ult && turn >= 2)) {
        next.warnAt = turn;
        events.push({ kind: "warn", turn });
      }
    } else if (turn > next.warnAt) {
      next.ultAt = turn;
      ultNow = true;
      // (The funhouse's moment is the move it plays: added when it's played.)
      if (ult === "blizzard") events.push({ kind: "blizzard", turn });
    }
  }
  // The passive (not on the ultimate's turn: it waits a turn).
  const passive = powers.passive;
  if (ultNow && turn >= next.nextPassive) next.nextPassive = turn + 1;
  else if (turn >= next.nextPassive) {
    if (passive === "freeze") {
      const pick = chooseFreeze(fen, crowd, p.seed, turn, next.pie?.square);
      if (pick) {
        next.frozen = { ...pick, until: turn + s.freezeTurns - 1 };
        events.push({ kind: "freeze", turn, square: pick.square });
        const [lo, hi] = s.freezeEvery;
        next.nextPassive = turn + lo + Math.floor(powerRoll(p.seed, "every", turn) * (hi - lo + 1));
      } else next.nextPassive = turn + 1;
    } else if (passive === "pie") {
      const square = choosePie(fen, p.seed, turn);
      if (square) {
        next.pie = { square, until: turn + s.pieTurns - 1 };
        events.push({ kind: "pie", turn, square });
        next.nextPassive = turn + s.pieTurns + s.pieGap;
      } else next.nextPassive = turn + 1;
    }
  }
  return { ...boss, powers: next };
}

/** This turn is the blizzard's. */
export const blizzardNow = (boss: BossState | null | undefined): boolean =>
  !!boss?.powers && bossPowers(boss)?.ultimate === "blizzard" && boss.powers.ultAt === turnOf(boss);

/** The boss plays the crowd's move this turn (the funhouse), and hasn't yet. */
export const funhouseDue = (boss: BossState | null | undefined): boolean =>
  !!boss?.powers && !boss.result && bossPowers(boss)?.ultimate === "funhouse" && boss.powers.ultAt === turnOf(boss) && !boss.powers.funhouse;

/** After the funhouse, the crowd sees the board flipped for its next few turns. */
export const boardFlipped = (boss: BossState | null | undefined): boolean => {
  const p = boss?.powers;
  return !!p?.funhouse && p.flipUntil !== undefined && turnOf(boss!) > p.funhouse.turn && turnOf(boss!) <= p.flipUntil;
};

/**
 * The moves the crowd may play this turn, or null when every legal move is allowed. Frozen pieces can't move and
 * nobody can move onto the pie; in the blizzard only the queen moves (no queen, or she can't: the king). The God
 * King's Last Stand bars the move he took back on top. Never empty: a restriction that would leave no legal move
 * lifts for the turn (and since only legal moves are counted, check is always answered).
 */
export function crowdAllowed(boss: BossState | null | undefined, fen: string): string[] | null {
  const p = boss?.powers;
  const barred = boss?.barred;
  if (!p && !barred) return null;
  const legal = legalMoves(fen);
  let allowed = legal;
  if (p) {
    if (p.pie) allowed = allowed.filter((m) => to(m) !== p.pie!.square);
    if (blizzardNow(boss)) {
      const queen = allowed.filter((m) => pieceAt(fen, from(m))?.type === "q");
      const king = allowed.filter((m) => pieceAt(fen, from(m))?.type === "k");
      allowed = queen.length ? queen : king.length ? king : allowed;
    } else if (p.frozen) allowed = allowed.filter((m) => from(m) !== p.frozen!.square);
    if (!allowed.length) allowed = legal;
  }
  if (barred) {
    const open = allowed.filter((m) => m !== barred);
    allowed = open.length ? open : legal.filter((m) => m !== barred);
    if (!allowed.length) allowed = legal;
  }
  return allowed.length === legal.length ? null : allowed;
}

/** The moves the boss may play (only the pie stops it), or null when every legal move is allowed. */
export function bossAllowed(boss: BossState | null | undefined, fen: string): string[] | null {
  const pie = boss?.powers?.pie?.square;
  if (!pie) return null;
  const legal = legalMoves(fen);
  const allowed = legal.filter((m) => to(m) !== pie);
  return allowed.length && allowed.length < legal.length ? allowed : null;
}

/** A crowd move is allowed this turn. */
export const crowdMayPlay = (boss: BossState | null | undefined, fen: string, move: string): boolean => {
  const allowed = crowdAllowed(boss, fen);
  return allowed ? allowed.includes(move) : legalMoves(fen).includes(move);
};

/**
 * A power touches this crowd turn (a frozen piece, a pie, the blizzard, a flipped board): its picks don't count as
 * fair-play signals.
 */
export function powerTurn(boss: BossState | null | undefined): boolean {
  const p = boss?.powers;
  return !!p && (!!p.frozen || !!p.pie || blizzardNow(boss) || boardFlipped(boss));
}

/** The squares that show ice: the frozen piece; in the blizzard every crowd piece but the one(s) still free to move. */
export function icedSquares(boss: BossState | null | undefined, fen: string): string[] {
  const p = boss?.powers;
  if (!p || !boss) return [];
  if (blizzardNow(boss)) {
    const free = new Set((crowdAllowed({ ...boss, barred: undefined }, fen) ?? []).map(from));
    const out: string[] = [];
    for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) {
      const sq = `${f}${r}`;
      const piece = pieceAt(fen, sq);
      if (piece?.color === boss.crowdSide && !free.has(sq)) out.push(sq);
    }
    return out;
  }
  return p.frozen ? [p.frozen.square] : [];
}

/** The rage meter, 0 to 1 (full: the warning, then the ultimate); null once the ultimate is spent. */
export function rageOf(boss: BossState | null | undefined): number | null {
  const p = boss?.powers;
  if (!p || !bossPowers(boss)) return null;
  if (p.ultAt !== undefined && turnOf(boss!) > p.ultAt) return null;
  return Math.max(0, Math.min(1, p.lost / BOSS_POWERS.rageFull));
}

/** The funhouse played: the crowd's move is on the board (the caller plays it), and the board flips for a while. */
export function funhousePlayed(boss: BossState, move: string, san: string): BossState {
  const p = boss.powers!;
  const turn = turnOf(boss);
  return {
    ...boss,
    crowdMoves: boss.crowdMoves + 1,
    powers: { ...p, funhouse: { turn, move, san }, flipUntil: turn + BOSS_POWERS.flipTurns, events: [...p.events, { kind: "funhouse", turn }] },
  };
}

// ---------------- The judge plays by the same rules ----------------

/** What limits the crowd's moves in a judging job: the move the God King took back, and a power's allowed moves. */
export interface MoveLimits {
  barred?: string;
  allowed?: string[];
}

/** Whether the job lets the crowd play `move` (not the barred move; one of the allowed, when a power limits them). */
export function jobAllows(job: MoveLimits, move: string): boolean {
  return move !== job.barred && (!job.allowed || job.allowed.includes(move));
}

/**
 * The top moves the job may use: never the barred move, unless it's the only one; only allowed moves when a power
 * limits them (none of them in the top moves: empty, and the second search covers them all).
 */
export function judgeTop(job: MoveLimits, top: readonly MoveScore[]): MoveScore[] {
  const open = top.filter((m) => jobAllows(job, m.move));
  if (open.length || job.allowed) return open;
  return [...top];
}

/**
 * The scores the job's best move and bots' picks come from: the top moves it allows, or (a power left none of the
 * top moves) the second search over every allowed move, best first.
 */
export function judgeCandidates(job: MoveLimits, top: readonly MoveScore[], extra: readonly MoveScore[] = []): MoveScore[] {
  const t = judgeTop(job, top);
  if (t.length || !job.allowed) return t;
  // (Best first, ties by move: the same order whatever order the engine listed them in.)
  return extra.filter((m) => jobAllows(job, m.move)).sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));
}

/**
 * A power left none of the top moves open: one search over every allowed move (and any pick), whose best is the
 * best allowed move. Null when the top moves already hold an allowed one (or nothing limits the moves).
 */
export async function allowedSearch(engine: Pick<EngineLike, "scoreMoves">, job: MoveLimits & { fen: string; picks?: readonly string[] }, top: readonly MoveScore[]): Promise<MoveScore[] | null> {
  if (!job.allowed || judgeTop(job, top).length) return null;
  const have = new Set(top.map((m) => m.move));
  const moves = [...new Set([...job.allowed, ...(job.picks ?? [])].filter((m) => !have.has(m)))].sort();
  return engine.scoreMoves(job.fen, moves);
}
