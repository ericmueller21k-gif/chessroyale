/**
 * Chub & Chirp (BOSS_ROSTER "hopper"; HOPPER_NAME): Chub the rabbit riding Chirp the grasshopper (Eric, Oct 18). Their
 * rules ("he" below: the boss as one, as for every boss; Chirp does the hop).
 *
 * Their passive, Leapfrog: at the start of his turn, when one of his pawns stands nose to nose with one of the crowd's
 * (the crowd's pawn on the square in front of his), his pawn hops over it to the square beyond, if that square is
 * empty: automatically (he says a line: the app's), and then he plays his move. No instant queen (Eric): never onto
 * the crowd's last two ranks (his move comes next: from their 2nd rank it would queen before they move), never one that
 * frees a pawn of his to promote; never one that leaves his king attacked (a pinned pawn; in check, it waits), never
 * one that gives check; the en passant square goes with it. When several can, the engine's pick: the one best for him
 * (hopFrom), as the other bosses' powers pick. At most hopMax a battle, one a turn. (Eric left open whether the hop is
 * free or his move that turn: "let the sim figure it out". Free, he lands in the pack; as his move, the crowd scored
 * 0.77: reports/hopper-sim.md, docs/decisions/2026-10-18-hopper-leapfrog.md.)
 *
 * Their ultimate, the Carrot Patch (Eric's sheet, Oct 18; docs/decisions/2026-10-18-carrot-patch.md), once a battle: his
 * rage meter full (its warning as a crowd turn begins), at the start of his turn the cast is his whole turn (the turn
 * passes, as Alfil's fusion): five carrots planted (carrots.ts, plantCarrots). Then the race: a piece pulls a carrot by
 * ending its move on it (a capture onto it, or his hop landing there, counts); carrotMoves moves each. His last carrot
 * wins the battle at once; else, the race over, his spin on his tier after his move (the prize on his side). The meter
 * is off from the cast on. His race brain is the runner's (raceGuard); the crowd's judge weighs the race too.
 *
 * Never an illegal position: every hop is checked on the board (hopOptions) and leaves a base at its ply (the position
 * changes outside a move: every replay plays from it, and a repetition counts from it); so do the cast (passTurn) and
 * the prize (placePrize: never giving check, never more than the engines take).
 */
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type BossState, type CarrotPatch, type CarrotPull, type CarrotSide, type CarrotSpin, type LeapfrogHop, type PowerEvent } from "@chessroyale/core";
import { BOSS_OPENING, newBoard } from "../boards.ts";
import { gameEnd, legalMoves, mateInOne, sideToMove } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import { stockfishRefuses } from "../uci.ts";
import { editedFen } from "./alfil.ts";
import { PASS_WAIT, meterFull, other, passAnswer, passScores, topEach, unleashed, type Battle, type BossRules, type Side } from "./base.ts";
import { carrotsOf, carrotsOpen, plantCarrots, prizeFits, pullsOf, raceJudged, raceLeft, raceOn, racePulls, raceRanked, raceWeight, spinRoll, standingOn, type CarrotRace } from "./carrots.ts";
import { gridKingAttacked, gridOf, type Grid } from "./grid.ts";
import { passTurn } from "./hollow.ts";

/**
 * His moments, beat by beat (ms into each; nobody's clock runs), on his animations' cues (the app's characters/hopper.ts:
 * a unit test there keeps them the same; docs/decisions/2026-10-18-hopper-wired.md):
 *   hop         "LEAPFROG!" and his line as it begins; his `leapfrog` animation from `liftAt` less its takeoff (210 ms):
 *               at `liftAt` (its `takeoff`) his pawn leaves its square, at `overAt` it's over the crowd's pawn, at `landAt`
 *               (its `land`, 330 ms on) it lands on the square beyond; the screen holds to `total`, then he thinks and
 *               plays his move.
 *   carrots     the cast (his whole turn: as the crowd's turn after it begins): "CARROT PATCH!", then his `carrotPatch`
 *               animation from `castAt`: Chirp bounds five times while Chub tosses a carrot each bound (`tosses`: each
 *               leaves his paw, its `toss<n>`), each thunking into its square `flightMs` later (its `plant<n>`), in the
 *               order planted; then his ladder (his count and its prize: every carrot you pull lowers it) from `ladderAt`
 *               to `total`.
 *   carrot      a carrot pulled: it pops at `popAt`, the puller's token is in the square's corner from `tokenAt`.
 *   carrotSpin  his spin (as the crowd's turn after his move begins): the race won or lost (his `raceWon` or `raceLost`,
 *               1 s), the reel of prize cards from `reelAt`, sliding past the line in the board's center and stopping at
 *               `stopAt` (3 s) on what he rolled, the prize pieces dropping onto their squares from `prizeAt` (tier 0: all
 *               blank cards, Chub's ears droop).
 *   carrotWin   his last carrot pulled: the battle is his (`cheerAt`), then the result.
 */
export const HOPPER_BEATS = {
  hop: { liftAt: 720, overAt: 885, landAt: 1050, total: 1600 },
  carrots: { castAt: 900, tosses: [1100, 1310, 1520, 1730, 1940], flightMs: 300, ladderAt: 2400, total: 4900 },
  carrot: { popAt: 0, tokenAt: 60, total: 600 },
  carrotSpin: { reelAt: 1000, stopAt: 4000, prizeAt: 4200, total: 5000 },
  carrotWin: { cheerAt: 300, total: 2500 },
} as const;

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const HOPPER_FX = {
  hop: HOPPER_BEATS.hop.total,
  carrots: HOPPER_BEATS.carrots.total,
  carrot: HOPPER_BEATS.carrot.total,
  carrotSpin: HOPPER_BEATS.carrotSpin.total,
  carrotWin: HOPPER_BEATS.carrotWin.total,
} as const;

const rank = (sq: string) => Number(sq[1]);
const square = (f: number, r: number) => `${"abcdefgh"[f]}${r}`;
const letter = (side: Side, type: string) => (side === "w" ? type.toUpperCase() : type.toLowerCase());

/** One hop he could make now: his pawn's square, the crowd's pawn it hops over, the square beyond, and the position after. */
export interface HopOption {
  from: string;
  over: string;
  to: string;
  fen: string;
}

/**
 * Why a pawn of his nose to nose with one of the crowd's can't hop now (the sims count them): the square beyond isn't
 * empty (`blocked`), it's the crowd's back rank (`lastRank`) or the rank before it (`nextToLast`: his move, which comes
 * straight after the hop, would queen), he's in check (`inCheck`: it waits), his king would be attacked after it
 * (`pinned`), it would give check (`check`), he'd have no move after it or the game would end (`noMove`), or it would
 * give his move a promotion (`promote`: a pin on a pawn of his it blocks) or a mate in one (`mate`) he didn't have, or, in
 * his Carrot Patch's race, it would pull his last carrot or let his move pull it when it couldn't before (`carrots`). The
 * crowd gets no turn between the hop and his move, so nothing the hop gives him may be decisive at once.
 */
export type HopRefused = "blocked" | "lastRank" | "nextToLast" | "inCheck" | "pinned" | "check" | "noMove" | "promote" | "mate" | "carrots";

/**
 * The hops he could make now (him to move in `fen`; `boss` his side), in his pawns' square order, and why each other
 * pawn of his that stands nose to nose with one of the crowd's can't. A hop takes his pawn two squares forward, over the
 * crowd's pawn, onto the empty square beyond: never the crowd's last two ranks, never with his king attacked before or
 * after it (in check; a pinned pawn), never giving check, never leaving him without a move, never making him a promotion
 * or a mate in one; in the race (`race`: the carrots still in the ground and his count), never his last carrot, nor one
 * his move could pull when it couldn't before the hop (a carrot it lands on is his: hopperBattle.apply).
 * The position after it: him still to move, the en passant square cleared, the fifty-move count from zero (a pawn
 * moved), castling and the move number as they were; one the engine plays.
 */
export function hopOptions(
  fen: string,
  boss: Side,
  race: Pick<CarrotRace, "open" | "his"> | null = null,
  s: Pick<BossPowerSettings, "carrotCount"> = BOSS_POWERS,
): { options: HopOption[]; refused: { from: string; why: HopRefused }[] } {
  const options: HopOption[] = [];
  const refused: { from: string; why: HopRefused }[] = [];
  if (sideToMove(fen) !== boss) return { options, refused };
  const g0 = gridOf(fen);
  const dir = boss === "w" ? 1 : -1;
  const checked = gridKingAttacked(g0, boss);
  // (His promotions and his mate in one before the hop, asked only once a hop gets that far.)
  let promotions: Set<string> | undefined;
  let mate: string | null | undefined;
  let carrot: boolean | undefined;
  const before: Before = {
    promotions: () => (promotions ??= new Set(movesOf(fen).filter(isPromotion))),
    mate: () => (mate === undefined ? (mate = mateInOne(fen)) : mate),
    carrotWin: () => (carrot ??= !!race && race.his >= s.carrotCount - 1 && canPull(fen, race.open)),
    race,
    last: s.carrotCount,
  };
  const pawns = [...g0].filter(([, c]) => c === letter(boss, "p")).map(([sq]) => sq).sort();
  for (const from of pawns) {
    const f = from.charCodeAt(0) - 97;
    const over = square(f, rank(from) + dir);
    if (g0.get(over) !== letter(other(boss), "p")) continue;
    const to = square(f, rank(from) + 2 * dir);
    const why = hopRefused(g0, fen, from, to, boss, checked, before);
    if (typeof why === "string") refused.push({ from, why });
    else options.push({ from, over, to, fen: why.fen });
  }
  return { options, refused };
}

/** What he could do before the hop (hopOptions works each out once, when a hop first needs it). */
interface Before {
  promotions(): Set<string>;
  mate(): string | null;
  /** His move could pull his last carrot. */
  carrotWin(): boolean;
  /** The race then (null: none on), and the carrots that win him the battle. */
  race: Pick<CarrotRace, "open" | "his"> | null;
  last: number;
}

/** A move of the side to move in `fen` would pull one of `open` (pullsOf). */
const canPull = (fen: string, open: readonly string[]): boolean => !!open.length && movesOf(fen).some((m) => pullsOf(fen, m, open).length > 0);

/** One hop checked (hopOptions): why it can't go, or the position after it. */
function hopRefused(g0: Grid, fen: string, from: string, to: string, boss: Side, checked: boolean, before: Before): HopRefused | { fen: string } {
  if (g0.has(to)) return "blocked";
  if (rank(to) === (boss === "w" ? 8 : 1)) return "lastRank";
  if (rank(to) === (boss === "w" ? 7 : 2)) return "nextToLast";
  if (checked) return "inCheck";
  const g: Grid = new Map(g0);
  g.delete(from);
  g.set(to, letter(boss, "p"));
  if (gridKingAttacked(g, boss)) return "pinned";
  if (gridKingAttacked(g, other(boss))) return "check";
  const parts = editedFen(fen, g).split(" ");
  parts[3] = "-";
  const out = parts.join(" ");
  const moves = movesOf(out);
  if (gameEnd(out, []) || stockfishRefuses(out) || !moves.length) return "noMove";
  // (The hopped pawn can't promote from where it lands, so only a pawn of his the hop unpins: its landing square blocks
  // the line from your piece. Rare, but his move would queen before you move.)
  if (moves.some((m) => isPromotion(m) && !before.promotions().has(m))) return "promote";
  if (mateInOne(out) && !before.mate()) return "mate";
  // (His Carrot Patch: a carrot it lands on is his. Never his last, nor setting his move up to pull it when it couldn't.)
  const race = before.race;
  if (race?.open.length) {
    const his = race.his + (race.open.includes(to) ? 1 : 0);
    if (his >= before.last) return "carrots";
    if (his === before.last - 1 && canPull(out, race.open.filter((x) => x !== to)) && !before.carrotWin()) return "carrots";
  }
  return { fen: out };
}

/** The legal moves of the side to move (none: a position chess.js can't read). */
function movesOf(fen: string): string[] {
  try {
    return legalMoves(fen);
  } catch {
    return [];
  }
}

/** A promotion (UCI: the piece it becomes, a fifth letter). */
const isPromotion = (m: string) => m.length === 5;

/**
 * The engine's pick of a hop, from this device's engines (the host's online, solo's): each way to go (him to move)
 * searched at hopNodes, shared out over the engines, and the one with his best expected score taken (equals in the
 * order given). Null: no candidates, no engine or no answer (the hop then takes the first way: hopperBattle.apply).
 */
export async function hopFrom(engines: readonly EngineLike[], fen: string, candidates: readonly string[], s: Pick<BossPowerSettings, "hopNodes"> = BOSS_POWERS): Promise<{ fen: string } | null> {
  if (!candidates.length || !engines.length) return null;
  const tops = await topEach(engines, candidates, s.hopNodes);
  let pick: { fen: string; his: number } | null = null;
  for (let i = 0; i < candidates.length; i++) {
    const m = tops[i];
    if (m && (!pick || m.expected > pick.his)) pick = { fen: candidates[i]!, his: m.expected };
  }
  return pick ? { fen: pick.fen } : null;
}

/**
 * The Carrot Patch cast's answer under the pass guard (passAnswer; docs/decisions/2026-10-18-turn-passing-guard.md),
 * from this device's engines (the host's online, solo's, the sims'): the position before it (`fen`, him to move) and the
 * turn passed (passTurn: the crowd to move; the carrots don't change the engine's evaluation) searched at
 * passGuardNodes each; PASS_WAIT when passing loses real material, else the passed position (the cast comes). Null: no
 * pass (in check), no engine or no answer (it comes, as ever).
 */
export async function castAnswer(engines: readonly EngineLike[], fen: string, s: Pick<BossPowerSettings, "passGuardNodes" | "passGuardPawns" | "bouncePawnLogit"> = BOSS_POWERS): Promise<string | null> {
  const passed = passTurn(fen);
  if (!passed) return null;
  return passAnswer((await passScores(engines, fen, [passed], s.passGuardNodes, s))?.[0] ?? null, s);
}

/**
 * The test switch (?power=leapfrog): the battle starts from 1.e4 e5 with the crowd to move, so his pawn stands nose to
 * nose with the crowd's as his first turn begins, whatever the crowd plays first (nothing fills the square beyond, pins
 * the pawn or lets the hop give check). The crowd White: 1.e4 e5 (his e5 over your e4 to e3); the crowd Black (?side=b):
 * 1.e4 e5 2.Nf3 (his e4 over your e5 to e6).
 */
export const LEAPFROG_TEST_MOVES: Record<Side, readonly string[]> = { w: ["e2e4", "e7e5"], b: ["e2e4", "e7e5", "g1f3"] };


/**
 * The test switch (?power=carrotpatch): the battle starts from 1.e4 e5 2.Nf3 Nc6 with the crowd to move (3.Bc4 after
 * them when the crowd is Black, ?side=b), the warning as the first turn begins: the cast comes at the start of his first
 * turn, after your first move. Nothing else changes: the race and the spin as ever.
 */
export const CARROT_TEST_MOVES: Record<Side, readonly string[]> = { w: ["e2e4", "e7e5", "g1f3", "b8c6"], b: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"] };

// ---------------- Their rules ----------------

/** The race as the crowd's judge weighs its move now (the crowd to move in `fen`, the race on: all of it), or null. */
export function crowdRace(boss: BossState | null | undefined, fen: string): CarrotRace | null {
  const c = boss?.powers?.carrots;
  if (!boss || boss.result || !raceOn(c) || sideToMove(fen) !== boss.crowdSide) return null;
  const left = raceLeft(c);
  return { boss: other(boss.crowdSide), open: carrotsOpen(c), his: carrotsOf(c, "boss"), crowdLeft: left.crowd, bossLeft: left.boss, weight: 1 };
}

/**
 * The race as his brain weighs his move now (him to move in `fen`, the race on), weighed by his strength (raceWeight), or
 * null. The boss request's `race` online (the host's engine runs his brain); solo's own.
 */
export function bossRace(boss: BossState | null | undefined, fen: string): CarrotRace | null {
  const c = boss?.powers?.carrots;
  if (!boss || boss.result || !raceOn(c) || sideToMove(fen) === boss.crowdSide) return null;
  const left = raceLeft(c);
  return { boss: other(boss.crowdSide), open: carrotsOpen(c), his: carrotsOf(c, "boss"), crowdLeft: left.crowd, bossLeft: left.boss, weight: raceWeight(boss.elo) };
}

/** The Carrot Patch as the screens get it (NetBossPowers.carrots): the carrots, who pulled each, the counts, the moves left, his tier, his spin. */
export interface CarrotView {
  /** The crowd move the cast came after (his whole turn). */
  at: number;
  squares: string[];
  /** Who pulled each carrot (in `squares`' order): null while it's in the ground. */
  by: (CarrotSide | null)[];
  crowd: number;
  boss: number;
  /** Each side's moves left in the race. */
  crowdLeft: number;
  bossLeft: number;
  /** Over: every carrot pulled, both sides' moves done, or his last carrot (the battle his). Null: the race is on. */
  over: "pulled" | "moves" | "won" | null;
  /** His tier: his carrots so far (his spin's, once the race is over). */
  tier: number;
  /** His spin, once rolled. */
  spin: CarrotSpin | null;
}

export function carrotView(c: CarrotPatch | null | undefined): CarrotView | null {
  if (!c) return null;
  const left = raceLeft(c);
  return {
    at: c.at,
    squares: [...c.squares],
    by: c.squares.map((x) => c.pulls.find((p) => p.square === x)?.by ?? null),
    crowd: carrotsOf(c, "crowd"),
    boss: carrotsOf(c, "boss"),
    crowdLeft: left.crowd,
    bossLeft: left.boss,
    over: c.over ?? null,
    tier: carrotsOf(c, "boss"),
    spin: c.spin ? { ...c.spin, rolled: [...c.spin.rolled], prize: [...c.spin.prize], squares: [...c.spin.squares] } : null,
  };
}

/** Chub & Chirp: Leapfrog (his pawns hop over the crowd's) and the Carrot Patch (once a battle: a race for five carrots, then his spin). */
export const HOPPER: BossRules = {
  id: "hopper",
  // The Carrot Patch: the meter full as a turn begins, its warning ("RAGE!") that turn; the cast at the start of his
  // turn, after the crowd's move (carrotBattle.due). The test switch: warned as the first turn begins. The trigger
  // (`ultNext`, kept): at the start of his next turn, without the warning. Once a battle: the meter is off after it.
  ultimateOnHisTurn: true,
  ultimateOnce: true,
  ultimate(next, t) {
    if (next.carrots || next.ults || next.warnAt !== undefined || t.ultNext) return false;
    if (meterFull(next, t) || t.test === t.ultimate) {
      next.warnAt = t.turn;
      t.events.push({ kind: "warn", turn: t.turn });
    }
    return false;
  },
  // From the cast on, for the rest of the battle (once a battle): nothing gathers, and none comes again.
  ultimateRunning: (p) => !!p.carrots,
  // As a crowd turn begins: the cast (his whole turn, just now), his move's carrot, his spin, his last carrot.
  everyTurn(next, t) {
    const c = next.carrots;
    if (!c) return;
    if (c.at + 1 === t.turn) t.events.push({ kind: "carrots", turn: t.turn, squares: [...c.squares] });
    for (const p of c.pulls) if (p.by === "boss" && !p.hop && p.at + 1 === t.turn) t.events.push({ kind: "carrot", turn: t.turn, square: p.square, by: "boss" });
    if (c.spin && c.spin.at + 1 === t.turn) t.events.push({ kind: "carrotSpin", turn: t.turn, tier: c.spin.tier, prize: [...c.spin.prize], squares: [...c.spin.squares] });
    const last = c.pulls.at(-1);
    if (c.over === "won" && last && last.at + 1 === t.turn) t.events.push({ kind: "carrotWin", turn: t.turn, square: last.square });
  },
  // (Leapfrog comes at the start of his turn: hopperBattle.)
  passive() {},
  // The crowd's turn right after a hop, and the one right after his spin (its prize put on the board): its picks don't
  // count for fair play, as for every power that changes the board. A race turn counts only where the engine's best is
  // the race's best too (the runner's resolveBoard, which then records the engine's own numbers).
  powerTurn: (boss) => {
    const p = boss.powers!;
    return (!!p.hop && p.hop.at === boss.crowdMoves) || p.carrots?.spin?.at === boss.crowdMoves;
  },
  // The carrots on the board while the race is on (the God King's Last Stand sits out).
  altersBoard: (boss) => raceOn(boss.powers!.carrots),
  // The judge weighs the race (as G-REX's fire): every move's score with what it does to his chances of each carrot,
  // and the moves that pull one always scored (carrots.ts). The bots pick by it too, the pulls among their choices (as
  // his brain weighs his).
  judge: {
    mustScore: (boss, fen) => racePulls(fen, crowdRace(boss, fen)),
    offer: (boss, fen) => racePulls(fen, crowdRace(boss, fen)),
    rank: (boss, top, fen) => raceRanked(top, fen, crowdRace(boss, fen)),
    evaluation: (boss, evaluation, fen) => raceJudged(evaluation, fen, crowdRace(boss, fen)),
  },
  afterCrowdMove(b, move) {
    if (move) carrotBattle.afterCrowdMove(b);
  },
  afterBossMove(b) {
    carrotBattle.afterHisMove(b);
  },
  opening: {
    setUp(b, at) {
      const test = b.settings.bossPowerTest;
      const moves = test === "leapfrog" ? LEAPFROG_TEST_MOVES[at.crowdSide] : test === "carrotpatch" ? CARROT_TEST_MOVES[at.crowdSide] : null;
      if (!moves) return {};
      b.boards.set(at.boardId, newBoard(at.boardId, { ...BOSS_OPENING, moves: [...moves] }, moves.length, at.generation));
      return {};
    },
  },
  view: (p) => ({ hop: p.hop ?? null, carrots: carrotView(p.carrots) }),
};

// ---------------- Their part in the match runner ----------------

/** The battle's board (its one board). */
const boardOf = (b: Battle) => b.boards.get(b.state.boards[0]!)!;

/** His hops now, worked out once per position and race (the pick is checked against the same list). */
function hopList(b: Battle): ReturnType<typeof hopOptions> {
  const fen = boardOf(b).fen;
  const c = b.state.boss!.powers?.carrots;
  const race = raceOn(c) ? { open: carrotsOpen(c), his: carrotsOf(c, "boss") } : null;
  const key = `${fen}|${race ? `${race.open.join()}:${race.his}` : ""}`;
  const memo = b.memo.get("hop") as { key: string; list: ReturnType<typeof hopOptions> } | undefined;
  if (memo?.key === key) return memo.list;
  const list = hopOptions(fen, other(b.state.boss!.crowdSide), race);
  b.memo.set("hop", { key, list });
  return list;
}

/** His powers' state, changed (the match's state replaced, as everywhere). */
const setPowers = (b: Battle, change: (p: BossPowerState) => BossPowerState): void => {
  const boss = b.state.boss!;
  b.state = { ...b.state, boss: { ...boss, powers: change(boss.powers!) } };
};

/** The position changes outside a move: a base on the board at its ply (every replay plays from it). */
function setBase(b: Battle, fen: string): void {
  const id = b.state.boards[0]!;
  const board = b.boards.get(id)!;
  const ply = board.history.length;
  b.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen }] });
}

/** His Carrot Patch's state changed, and events added to this turn's. */
const setCarrots = (b: Battle, change: (c: CarrotPatch) => CarrotPatch, events: readonly PowerEvent[] = []): void =>
  setPowers(b, (p) => ({ ...p, carrots: change(p.carrots!), events: [...p.events, ...events] }));

/**
 * Test switch only (settings.bossCarrotTest, ?carrots=N): `his` carrots on empty squares one of his pieces can step to
 * and none of the crowd's can reach in one move, then the rest (to carrotCount) on empty squares one of the crowd's can
 * step to and none of his can; a different piece for each when it can, in square order; `fen` the crowd to move. Each
 * side pulling its own, his spin comes on `his` carrots (all of them: his last wins the battle).
 */
export function carrotsWithinReach(fen: string, crowd: Side, his: number, count: number = BOSS_POWERS.carrotCount): string[] {
  const parts = fen.split(" ");
  const hisFen = [parts[0], other(crowd), ...parts.slice(2)].join(" ").replace(/ [a-h][36] /, " - ");
  const grid = gridOf(fen);
  const reach = (f: string) => legalMoves(f).filter((m) => !grid.has(m.slice(2, 4)));
  const mine = reach(hisFen);
  const theirs = reach(fen);
  const out: string[] = [];
  const pick = (moves: string[], other: string[], n: number) => {
    const blocked = new Set(other.map((m) => m.slice(2, 4)));
    const used = new Set<string>();
    for (const pass of [true, false])
      for (const m of [...moves].sort()) {
        const to = m.slice(2, 4);
        if (n <= 0 || out.includes(to) || blocked.has(to) || (pass && used.has(m.slice(0, 2)))) continue;
        out.push(to);
        used.add(m.slice(0, 2));
        n--;
      }
  };
  pick(mine, legalMoves(fen), Math.max(0, Math.min(count, his)));
  pick(theirs, legalMoves(hisFen), count - out.length);
  return out;
}

export const hopperBattle = {
  /**
   * A hop is due: his turn (the crowd has moved), the battle on, fewer than hopMax hops so far, none yet this turn, no
   * Carrot Patch cast due (that's his whole turn), and a pawn of his that can hop (hopOptions: in check, none).
   */
  due(b: Battle, s: Pick<BossPowerSettings, "hopMax"> = BOSS_POWERS): boolean {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "hopper" || boss.result || !b.bossToMove() || b.finalGameOver()) return false;
    if ((p.hops ?? 0) >= s.hopMax || p.hop?.at === boss.crowdMoves) return false;
    if (carrotBattle.due(b)) return false;
    return hopList(b).options.length > 0;
  },

  /** The positions the engine's pick weighs (one per hop he could make), when a hop is due: the same on the server, the host and in solo. */
  candidates(b: Battle): string[] {
    return hopperBattle.due(b) ? hopList(b).options.map((o) => o.fen) : [];
  },

  /** The hop needs an engine's pick: more than one pawn can hop (one alone hops at once). */
  needsEngine(b: Battle): boolean {
    return hopperBattle.candidates(b).length > 1;
  },

  /** The hop, from this device's engines (solo, the sims): hopFrom when several can, then apply. Null: none was due. */
  async play(b: Battle, engines: readonly EngineLike[]): Promise<LeapfrogHop | null> {
    const candidates = hopperBattle.candidates(b);
    if (!candidates.length) return null;
    const pick = candidates.length > 1 ? await hopFrom(engines, boardOf(b).fen, candidates) : null;
    return hopperBattle.apply(b, pick?.fen ?? null);
  },

  /**
   * The hop (online with the host's pick: one of the candidates; anything else, the first): his pawn over the crowd's to
   * the square beyond, a base on the board at its ply (no move added; him still to move). Its moment plays at the start
   * of his turn, a screen of its own (its event with this turn's), then he plays his move. Nothing is scored; the God
   * King's strike waits for that move, as ever. In the Carrot Patch's race a carrot it lands on is his (its `carrot`
   * event just before the hop's, so the hop's screen stays its own); it counts toward hopMax as any hop. Returns the hop;
   * null when none was due.
   */
  apply(b: Battle, pick: string | null): LeapfrogHop | null {
    if (!hopperBattle.due(b)) return null;
    const options = hopList(b).options;
    const chosen = options.find((o) => o.fen === pick) ?? options[0]!;
    const hop: LeapfrogHop = { at: b.state.boss!.crowdMoves, from: chosen.from, over: chosen.over, to: chosen.to };
    setBase(b, chosen.fen);
    const pulled = carrotBattle.pull(b, "boss", true);
    setPowers(b, (p) => ({ ...p, hop, hops: (p.hops ?? 0) + 1, events: [...p.events, ...pulled, { kind: "hop", turn: p.turn, square: hop.to, squares: [hop.from, hop.over, hop.to] }] }));
    return hop;
  },
};

/**
 * The Carrot Patch in a battle: the cast at the start of his turn (his whole turn), the pulls after every move and hop,
 * the race's end, and his spin after his move.
 */
export const carrotBattle = {
  /**
   * The cast is due: the start of his turn (the crowd has just moved) from the turn the meter warned, or after the test
   * trigger; once a battle. In check, or with the crowd left no move once the turn passes, it waits for his next turn
   * (he answers the check with his move: passTurn), the warning staying; and so it does when passing would lose real
   * material (the pass guard, Oct 18: `passWait`, the host's PASS_WAIT): he plays his move, the warning and the
   * trigger staying, so "next turn" stays true, and it's checked again on his next turn.
   */
  due(b: Battle): boolean {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "hopper" || boss.result || !b.bossToMove() || b.finalGameOver()) return false;
    if (p.carrots || p.ultAt !== undefined || p.ults) return false;
    if (!p.ultNext && !(p.warnAt !== undefined && p.warnAt <= boss.crowdMoves)) return false;
    if (p.passWait === boss.crowdMoves) return false;
    return passTurn(boardOf(b).fen) !== null;
  },

  /**
   * The cast from this device's engines (solo, the sims; online the host's, castAnswer): it comes, or it waits when
   * passing would lose real material (the pass guard). Returns what apply returns.
   */
  async play(b: Battle, engines: readonly EngineLike[]): Promise<CarrotPatch | null> {
    if (!carrotBattle.due(b)) return null;
    return carrotBattle.apply(b, await castAnswer(engines, boardOf(b).fen));
  },

  /**
   * The cast (the placement is the position's and the seed's, the same on the server, the host and in solo; an engine only
   * for the pass guard: `answer` PASS_WAIT, it waits a turn, the warning staying, and he plays his move; anything else, or
   * none, it comes): his whole turn. The turn passes to the crowd (passTurn: the en passant square cleared, the fifty-move count as it was,
   * a base at its ply so a repetition counts from it, no move played), the carrots planted on the position it leaves
   * (plantCarrots: the crowd moves first), the meter spent (once a battle: off from now on), and the crowd's turn set up
   * as after his move (its moment, the cast's, plays as it begins: HOPPER.everyTurn). The God King's strike, if called,
   * waits for his next move. Returns the patch; null when none was due, or it waits.
   */
  apply(b: Battle, answer: string | null = null): CarrotPatch | null {
    if (!carrotBattle.due(b)) return null;
    const boss = b.state.boss!;
    if (answer === PASS_WAIT) {
      setPowers(b, (p) => ({ ...p, passWait: boss.crowdMoves }));
      return null;
    }
    const board = boardOf(b);
    const passed = passTurn(board.fen)!;
    const test = b.settings.bossCarrotTest;
    const squares = test !== undefined ? carrotsWithinReach(passed, boss.crowdSide, test) : plantCarrots(passed, boss.crowdSide, boss.powers!.seed, boss.crowdMoves);
    const patch: CarrotPatch = { at: boss.crowdMoves, squares, pulls: [], crowdMoves: 0, bossMoves: 0 };
    setBase(b, passed);
    b.boards.set(b.state.boards[0]!, { ...boardOf(b), expected: 1 - board.expected, lastMove: null });
    b.bossLast = null;
    setPowers(b, ({ ultNext: _trigger, ...p }) => unleashed({ ...p, ultAt: boss.crowdMoves, carrots: patch }));
    b.bossPassed();
    return patch;
  },

  /**
   * The carrots just pulled (`by`; `hop`: his hop's), in the race: every carrot still in the ground that a piece now
   * stands on (a piece ended its move there), claimed for good. Ends the race when the last is pulled, or when his is his
   * last carrot (the battle his). Returns the events for this turn's: the crowd's and his hop's (his move's play as the
   * crowd's turn after it begins: HOPPER.everyTurn).
   */
  pull(b: Battle, by: CarrotSide, hop = false, s: Pick<BossPowerSettings, "carrotCount"> = BOSS_POWERS): PowerEvent[] {
    const boss = b.state.boss!;
    const c = boss.powers?.carrots;
    if (!raceOn(c)) return [];
    const pulled = standingOn(boardOf(b).fen, carrotsOpen(c));
    if (!pulled.length) return [];
    const pulls: CarrotPull[] = [...c.pulls, ...pulled.map((square) => ({ square, by, at: boss.crowdMoves, ...(hop ? { hop: true as const } : {}) }))];
    const next: CarrotPatch = { ...c, pulls };
    if (carrotsOf(next, "boss") >= s.carrotCount) next.over = "won";
    else if (!carrotsOpen(next).length) next.over = "pulled";
    setPowers(b, (p) => ({ ...p, carrots: next }));
    return by === "boss" && !hop ? [] : pulled.map((square) => ({ kind: "carrot" as const, turn: boss.powers!.turn, square, by }));
  },

  /** After the crowd's move in the race: what it pulled (its event with this turn's), and one of its race moves gone. */
  afterCrowdMove(b: Battle): void {
    if (!raceOn(b.state.boss?.powers?.carrots)) return;
    const events = carrotBattle.pull(b, "crowd");
    setCarrots(b, (c) => ({ ...c, crowdMoves: c.crowdMoves + 1 }), events);
  },

  /**
   * After his own move: in the race, what it pulled and one of his race moves gone (the race over once both sides' are
   * done); the race over (but not his: then the battle is his), his spin, unless the battle is over.
   */
  afterHisMove(b: Battle, s: Pick<BossPowerSettings, "carrotMoves"> = BOSS_POWERS): void {
    if (!b.state.boss?.powers?.carrots) return;
    if (raceOn(b.state.boss.powers.carrots)) {
      carrotBattle.pull(b, "boss");
      setCarrots(b, (c) => {
        const bossMoves = c.bossMoves + 1;
        const done = !c.over && c.crowdMoves >= s.carrotMoves && bossMoves >= s.carrotMoves;
        return { ...c, bossMoves, ...(done ? { over: "moves" as const } : {}) };
      });
    }
    carrotBattle.spin(b);
  },

  /**
   * His spin, once the race is over (not by his last carrot: then the battle is his), after his move, the battle on, once:
   * his tier is his carrots, the roll from the battle's seed (spinRoll: the same on the server and in solo, and in every
   * replay), the prize stepped down to the next that fits and put on his side (prizeFits: a base at its ply). Tier 0, or
   * nothing that fits: a blank, nothing put on. Returns the spin; null when none was due.
   */
  spin(b: Battle): CarrotSpin | null {
    const boss = b.state.boss!;
    const c = boss.powers?.carrots;
    if (!c?.over || c.over === "won" || c.spin || boss.result || b.finalGameOver()) return null;
    const tier = carrotsOf(c, "boss");
    const rolled = spinRoll(boss.powers!.seed, boss.crowdMoves, tier);
    const fits = prizeFits(boardOf(b).fen, rolled, other(boss.crowdSide));
    if (fits.squares.length) setBase(b, fits.fen);
    const spin: CarrotSpin = { at: boss.crowdMoves, tier, rolled, prize: fits.prize, squares: fits.squares };
    setCarrots(b, (x) => ({ ...x, spin }));
    return spin;
  },

  /** His last carrot was pulled: the battle is his (the runner's stageComplete and finishBossBattle). */
  won: (boss: BossState | null | undefined): boolean => boss?.powers?.carrots?.over === "won",
};
