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
 * Their Pawn Bounce (Eric, Nov 22: "once per game he'll take your pawn that was moved 2 spaces and he jumps it and he hops
 * it back 1 space"; docs/decisions/2026-11-22-hopper-pawn-bounce.md), once a battle, solo, online and in the Battle Tower: at the
 * start of his turn after the crowd pushed a pawn two squares, before his move (as Leapfrog, and free as it is), Chirp hops down
 * and knocks that pawn back one square (e4 to e3), the en passant square with it; then he plays his move. One power a turn: the
 * bounce first, the hop waiting for his next turn. A push it can't bounce (bounceOption) waits for the next double push.
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
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type BossState, type CarrotPatch, type CarrotPull, type CarrotSide, type CarrotSpin, type LeapfrogHop, type PawnBounce, type PowerEvent, type TurfHop, type TurfState } from "@chessroyale/core";
import { BOSS_OPENING, newBoard, playOnBoard, type BoardState } from "../boards.ts";
import { gameEnd, legalMoves, mateInOne, sideToMove, toSan } from "../rules.ts";
import type { EngineLike } from "../runner.ts";
import { stockfishRefuses } from "../uci.ts";
import { editedFen } from "./alfil.ts";
import { PASS_WAIT, meterFull, other, passAnswer, passScores, powerRoll, topEach, unleashed, type Battle, type BossAsks, type BossMoveExtras, type BossRules, type Side } from "./base.ts";
import { carrotsOf, carrotsOpen, plantCarrots, prizeFits, pullsOf, raceJudged, raceLeft, raceOn, racePulls, raceRanked, raceWeight, spinRoll, standingOn, type CarrotRace } from "./carrots.ts";
import { gridKingAttacked, gridOf, type Grid } from "./grid.ts";
import { extraMoveCandidates, extraMoveFrom, passTurn } from "./hollow.ts";
import { claimTurf, holdOn, holdsFor, legsOptions, legsPlay, newTurf, turfCount, turfIndex, turfOf, turfHopPick } from "./turf.ts";

/**
 * His moments, beat by beat (ms into each; nobody's clock runs), on his animations' cues (the app's characters/hopper.ts:
 * a unit test there keeps them the same; docs/decisions/2026-10-18-hopper-wired.md):
 *   hop         "LEAPFROG!" and his line as it begins; his `leapfrog` animation from `liftAt` less its takeoff (210 ms):
 *               at `liftAt` (its `takeoff`) his pawn leaves its square, at `overAt` it's over the crowd's pawn, at `landAt`
 *               (its `land`, 330 ms on) it lands on the square beyond; the screen holds to `total`, then he thinks and
 *               plays his move.
 *   pawnBounce  the Pawn Bounce, on the hop's own beats (his `leapfrog` animation, Chirp's hop): "BOUNCE!" and his line as it
 *               begins; at `liftAt` the crowd's pawn leaves the square its double push reached, at `landAt` it lands on the square
 *               behind it; the screen holds to `total`, then he thinks and plays his move.
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
const HOP_BEATS = { liftAt: 720, overAt: 885, landAt: 1050, total: 1600 } as const;
/**
 * The hop-around (Turf): its banner until `dropAt`, then Chirp's legs, each `legMs` long (from the board's corner to each of his
 * squares, to the square he claims, and back to the corner: at most turfHops + 2), each his `leapfrog` from `animLead` before the
 * leg (its `takeoff` at `takeoffAt` into the leg, its `land` at `landAt`, as the hop's 330 ms in the air); the screen holds to
 * `total`. Double hop: his banner as his second move lands (as Hollow's and Dash's extra moves).
 */
const TURF_HOP = { dropAt: 720, legMs: 600, animLead: 20, takeoffAt: 190, landAt: 520, total: 4000 } as const;
export const HOPPER_BEATS = {
  hop: HOP_BEATS,
  pawnBounce: HOP_BEATS,
  turfHop: TURF_HOP,
  doubleHop: { total: 2200 },
  carrots: { castAt: 900, tosses: [1100, 1310, 1520, 1730, 1940], flightMs: 300, ladderAt: 2400, total: 4900 },
  carrot: { popAt: 0, tokenAt: 60, total: 600 },
  carrotSpin: { reelAt: 1000, stopAt: 4000, prizeAt: 4200, total: 5000 },
  carrotWin: { cheerAt: 300, total: 2500 },
} as const;

/** How long each of his moments holds the screen (ms; POWER_FX in boss-timing.ts). */
export const HOPPER_FX = {
  hop: HOPPER_BEATS.hop.total,
  pawnBounce: HOPPER_BEATS.pawnBounce.total,
  turfHop: HOPPER_BEATS.turfHop.total,
  doubleHop: HOPPER_BEATS.doubleHop.total,
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
 * Why the crowd's double push can't be bounced now (the tests read them): he's in check (`inCheck`: he answers it with his move),
 * the square it passed isn't empty (`blocked`: never, after a double push), the crowd's king would be attacked after it
 * (`exposed`), his would (`check`: it would hand the crowd a check), he'd have no move after it or the game would end
 * (`noMove`), it would give his move a promotion (`promote`) or a mate in one (`mate`) he didn't have, or, in his Carrot Patch's
 * race, a carrot in the ground stands on the square it lands on, or his move could pull his last carrot when it couldn't before
 * (`carrots`). As for the hop: the crowd gets no turn between the bounce and his move, so nothing it gives him may be decisive.
 */
export type BounceRefused = "inCheck" | "blocked" | "exposed" | "check" | "noMove" | "promote" | "mate" | "carrots";

/** The Pawn Bounce he could make now: the crowd's pawn on `from` back to `to`, and the position after. */
export interface BounceOption {
  from: string;
  to: string;
  fen: string;
}

/**
 * The crowd's move just played (`move`, UCI; him to move in `fen`, `boss` his side) knocked back one square, as his Pawn Bounce:
 * null when `move` isn't a double push of the crowd's pawn that still stands where it landed; else the bounce, or why it can't
 * come (BounceRefused). The position after it: him still to move, the en passant square cleared, the fifty-move count from zero
 * (as the push left it), castling and the move number as they were; one the engine plays.
 */
export function bounceOption(
  fen: string,
  boss: Side,
  move: string | null | undefined,
  race: Pick<CarrotRace, "open" | "his"> | null = null,
  s: Pick<BossPowerSettings, "carrotCount"> = BOSS_POWERS,
): BounceOption | { why: BounceRefused } | null {
  const crowd = other(boss);
  const start = crowd === "w" ? 2 : 7;
  const dir = crowd === "w" ? 1 : -1;
  if (!move || move.length !== 4 || sideToMove(fen) !== boss || move[0] !== move[2] || rank(move.slice(0, 2)) !== start || rank(move.slice(2, 4)) !== start + 2 * dir) return null;
  const from = move.slice(2, 4);
  const g0 = gridOf(fen);
  if (g0.get(from) !== letter(crowd, "p")) return null;
  const to = square(from.charCodeAt(0) - 97, start + dir);
  if (gridKingAttacked(g0, boss)) return { why: "inCheck" };
  if (g0.has(to)) return { why: "blocked" };
  const g: Grid = new Map(g0);
  g.delete(from);
  g.set(to, letter(crowd, "p"));
  if (gridKingAttacked(g, crowd)) return { why: "exposed" };
  if (gridKingAttacked(g, boss)) return { why: "check" };
  const parts = editedFen(fen, g).split(" ");
  parts[3] = "-";
  const out = parts.join(" ");
  const moves = movesOf(out);
  if (gameEnd(out, []) || stockfishRefuses(out) || !moves.length) return { why: "noMove" };
  if (moves.some(isPromotion)) {
    const had = new Set(movesOf(fen).filter(isPromotion));
    if (moves.some((m) => isPromotion(m) && !had.has(m))) return { why: "promote" };
  }
  if (mateInOne(out) && !mateInOne(fen)) return { why: "mate" };
  if (race?.open.length) {
    if (race.open.includes(to)) return { why: "carrots" };
    if (race.his >= s.carrotCount - 1 && canPull(out, race.open) && !canPull(fen, race.open)) return { why: "carrots" };
  }
  return { from, to, fen: out };
}

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
 * the pawn or lets the hop give check); a double push first brings the Pawn Bounce instead, and the hop on his next turn. The crowd White: 1.e4 e5 (his e5 over your e4 to e3); the crowd Black (?side=b):
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
  // (Leapfrog and the Pawn Bounce come at the start of his turn: hopperBattle.)
  passive() {},
  // The crowd's turn right after a hop or a Pawn Bounce, and the one right after his spin (its prize put on the board): its picks don't
  // count for fair play, as for every power that changes the board. A race turn counts only where the engine's best is
  // the race's best too (the runner's resolveBoard, which then records the engine's own numbers).
  // (And the one after his Double hop: his two moves in a row.)
  powerTurn: (boss) => {
    const p = boss.powers!;
    return (!!p.hop && p.hop.at === boss.crowdMoves) || (!!p.pawnBounce && p.pawnBounce.at === boss.crowdMoves) || p.carrots?.spin?.at === boss.crowdMoves || (p.turf?.double?.state === "played" && p.turf.double.at === boss.crowdMoves);
  },
  // The carrots on the board while the race is on (the God King's Last Stand sits out).
  altersBoard: (boss) => raceOn(boss.powers!.carrots),
  // The judge weighs the race (as Grex's fire): every move's score with what it does to his chances of each carrot,
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
    turfBattle.turnBegins(b, !!move);
  },
  // After his move: Long legs' pawn on to its square, his carrots, then the squares claimed and Double hop's second move due.
  afterBossMove(b, move, extras) {
    turfBattle.legsOn(b, move, extras);
    carrotBattle.afterHisMove(b);
    turfBattle.afterHisMove(b);
  },
  // Long legs: his pawn's long step is written from to ("c3c5"), played as its first step (the pawn goes on after it: afterBossMove).
  specialMove(boss, fen, move) {
    if (!holdOn(boss, 1) || !legsOptions(fen, other(boss.crowdSide)).includes(move)) return null;
    return { play: legsPlay(move), san: move.slice(2, 4) };
  },
  // Long legs: his long steps to weigh against his move (the host's engine online: the boss request's `legs`; solo's), never staggered.
  asks(boss, fen) {
    if (!holdOn(boss, 1) || boss.staggerNext || sideToMove(fen) === boss.crowdSide) return null;
    const legs = legsOptions(fen, other(boss.crowdSide));
    return legs.length ? { legs, seed: Math.floor(powerRoll(boss.powers!.seed, "legs", boss.crowdMoves) * 2 ** 32) >>> 0 } : null;
  },
  opening: {
    // (Turf everywhere but the Battle Tower: each side's first two ranks, from the board the battle starts from.)
    setUp(b, at) {
      const test = b.settings.bossPowerTest;
      const moves = test === "leapfrog" ? LEAPFROG_TEST_MOVES[at.crowdSide] : test === "carrotpatch" ? CARROT_TEST_MOVES[at.crowdSide] : null;
      if (moves) b.boards.set(at.boardId, newBoard(at.boardId, { ...BOSS_OPENING, moves: [...moves] }, moves.length, at.generation));
      // (Off on a tower floor, and on a floor of several bosses: only the tower deals them.)
      if (b.settings.towerFloor != null || (b.settings.bossIds?.length ?? 0) > 1) return {};
      const turf = newTurf(b.boards.get(at.boardId)!.fen, at.crowdSide);
      return { turf: test === "turf" ? turfTest(turf, at.crowdSide) : turf };
    },
  },
  view: (p) => ({ hop: p.hop ?? null, pawnBounce: p.pawnBounce ?? null, carrots: carrotView(p.carrots), turf: turfView(p.turf) }),
};

/**
 * The test switch ?power=turf: the hop-around on his first turn (his last "came" turfHopEvery - 1 crowd moves before the battle), and
 * the two ranks in front of his own his too (32 squares: Long legs from his first turn).
 */
export function turfTest(t: TurfState, crowd: Side, s: Pick<BossPowerSettings, "turfHopEvery"> = BOSS_POWERS): TurfState {
  const ranks = crowd === "w" ? [5, 6] : [3, 4];
  const owner = [...t.owner].map((c, i) => (ranks.includes(Math.floor(i / 8) + 1) ? "b" : c)).join("");
  return { ...t, owner, hopAt: 1 - s.turfHopEvery };
}

/** His Turf as the screens get it (NetBossPowers.turf): who holds each square, his holds and the turn they're for, his last hop-around. */
export interface TurfView {
  owner: string;
  holds: number;
  holdsAt: number;
  hop: TurfHop | null;
  /** Double hop's second move this turn (played: its moment). */
  double: "due" | "played" | "skipped" | null;
  doubleAt: number | null;
}

export function turfView(t: TurfState | null | undefined): TurfView | null {
  if (!t) return null;
  return { owner: t.owner, holds: t.holds, holdsAt: t.holdsAt, hop: t.hop ? { ...t.hop, hops: [...t.hop.hops] } : null, double: t.double?.state ?? null, doubleAt: t.double?.at ?? null };
}

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

/**
 * His Pawn Bounce now (bounceOption on the board's last move), worked out once per position and race: null when the crowd's last
 * move isn't a double push of the battle's, he has bounced pawnBounceMax times, or he bounced or hopped this turn.
 */
export function bounceNow(b: Battle, s: Pick<BossPowerSettings, "pawnBounceMax"> = BOSS_POWERS): ReturnType<typeof bounceOption> {
  const boss = b.state.boss!;
  const p = boss.powers!;
  if ((p.pawnBounces ?? 0) >= s.pawnBounceMax || p.pawnBounce?.at === boss.crowdMoves || p.hop?.at === boss.crowdMoves || p.turf?.hop?.at === boss.crowdMoves) return null;
  const board = boardOf(b);
  // (A ply of the opening the battle started from isn't the crowd's push.)
  if (board.history.length <= board.openingPlies) return null;
  const move = board.history.at(-1)!;
  const c = p.carrots;
  const race = raceOn(c) ? { open: carrotsOpen(c), his: carrotsOf(c, "boss") } : null;
  const key = `${board.fen}|${move}|${race ? `${race.open.join()}:${race.his}` : ""}`;
  const memo = b.memo.get("pawnBounce") as { key: string; out: ReturnType<typeof bounceOption> } | undefined;
  if (memo?.key === key) return memo.out;
  const out = bounceOption(board.fen, other(boss.crowdSide), move, race);
  b.memo.set("pawnBounce", { key, out });
  return out;
}

/** The bounce he makes now, if one is due (bounceNow, not refused). */
const bounceDue = (b: Battle, s: Pick<BossPowerSettings, "pawnBounceMax"> = BOSS_POWERS): BounceOption | null => {
  const out = bounceNow(b, s);
  return out && "fen" in out ? out : null;
};

/** What his step at the start of his turn did: a hop (Leapfrog), a Pawn Bounce or a hop-around (Turf). */
export type HopperStep = LeapfrogHop | PawnBounce | TurfHop;

/** The step was a hop, not a Pawn Bounce or a hop-around (a hop has the pawn it hopped over). */
export const isHop = (step: HopperStep): step is LeapfrogHop => "over" in step;

/** The moment a step plays as (its event's kind: POWER_FX). */
export const hopperStepKind = (step: HopperStep): "hop" | "pawnBounce" | "turfHop" => ("over" in step ? "hop" : "hops" in step ? "turfHop" : "pawnBounce");

type StepSettings = Pick<BossPowerSettings, "hopMax" | "pawnBounceMax" | "turfHopEvery" | "turfHops">;

/** The hop-around he'd make now: his Turf on, turfHopEvery crowd moves since his last, and a square to land on (turfHopPick). */
function turfHopNow(b: Battle, s: Pick<BossPowerSettings, "turfHopEvery" | "turfHops"> = BOSS_POWERS): TurfHop | null {
  const boss = b.state.boss!;
  const t = turfOf(boss);
  if (!t || boss.crowdMoves - t.hopAt < s.turfHopEvery) return null;
  return turfHopPick(t, boardOf(b).fen, boss.powers!.seed, boss.crowdMoves, s);
}

/** Which step comes at the start of his turn now (one a turn): the bounce, else a hop, else the hop-around; null: none. */
function stepNow(b: Battle, s: StepSettings = BOSS_POWERS): "bounce" | "hop" | "turf" | null {
  const boss = b.state.boss!;
  const p = boss.powers!;
  if (bounceDue(b, s)) return "bounce";
  if (p.hop?.at === boss.crowdMoves || p.pawnBounce?.at === boss.crowdMoves || p.turf?.hop?.at === boss.crowdMoves) return null;
  if ((p.hops ?? 0) < s.hopMax && hopList(b).options.length > 0) return "hop";
  return turfHopNow(b, s) ? "turf" : null;
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
   * His step at the start of his turn is due: his turn (the crowd has moved), the battle on, no Carrot Patch cast due (that's
   * his whole turn), and one of (one a turn, in this order): a Pawn Bounce (bounceNow: the crowd's double push just played, fewer
   * than pawnBounceMax so far); a hop (fewer than hopMax so far, a pawn of his that can: hopOptions, none in check); the hop-around
   * (Turf: turfHopEvery crowd moves since his last, a square to land on).
   */
  due(b: Battle, s: StepSettings = BOSS_POWERS): boolean {
    const boss = b.state.boss;
    const p = boss?.powers;
    if (!boss || !p || boss.id !== "hopper" || boss.result || !b.bossToMove() || b.finalGameOver()) return false;
    if (carrotBattle.due(b)) return false;
    return stepNow(b, s) !== null;
  },

  /**
   * The positions the engine's pick weighs (one per hop he could make), when a hop is due: the same on the server, the host and
   * in solo. None for a Pawn Bounce or a hop-around: no choice to make.
   */
  candidates(b: Battle): string[] {
    return hopperBattle.due(b) && stepNow(b) === "hop" ? hopList(b).options.map((o) => o.fen) : [];
  },

  /** The hop needs an engine's pick: more than one pawn can hop (one alone hops at once). */
  needsEngine(b: Battle): boolean {
    return hopperBattle.candidates(b).length > 1;
  },

  /** The step, from this device's engines (solo, the sims): a hop's hopFrom when several can, then apply. Null: none was due. */
  async play(b: Battle, engines: readonly EngineLike[]): Promise<HopperStep | null> {
    if (!hopperBattle.due(b)) return null;
    const candidates = hopperBattle.candidates(b);
    const pick = candidates.length > 1 ? await hopFrom(engines, boardOf(b).fen, candidates) : null;
    return hopperBattle.apply(b, pick?.fen ?? null);
  },

  /**
   * The hop (online with the host's pick: one of the candidates; anything else, the first): his pawn over the crowd's to
   * the square beyond, a base on the board at its ply (no move added; him still to move). Its moment plays at the start
   * of his turn, a screen of its own (its event with this turn's), then he plays his move. Nothing is scored; the God
   * King's strike waits for that move, as ever. In the Carrot Patch's race a carrot it lands on is his (its `carrot`
   * event just before the hop's, so the hop's screen stays its own); it counts toward hopMax as any hop. Returns the hop;
   * null when none was due. A Pawn Bounce due comes instead (no pick: one way to go), the same way: the crowd's pawn back one
   * square, a base at its ply, the last move shown as the bounce (the pawn is no longer where the push put it), its moment a
   * screen of its own, then his move; returns the bounce. Neither: the hop-around (Turf; no pick, nothing on the board moves):
   * the square he lands on is his, then his move; returns it. Each claims the squares its pieces land on (Turf).
   */
  apply(b: Battle, pick: string | null): HopperStep | null {
    if (!hopperBattle.due(b)) return null;
    const step = stepNow(b);
    if (step === "bounce") {
      const bounce = bounceDue(b)!;
      const done: PawnBounce = { at: b.state.boss!.crowdMoves, from: bounce.from, to: bounce.to };
      setBase(b, bounce.fen);
      b.boards.set(b.state.boards[0]!, { ...boardOf(b), lastMove: `${done.from}${done.to}` });
      setPowers(b, (p) => ({ ...p, pawnBounce: done, pawnBounces: (p.pawnBounces ?? 0) + 1, events: [...p.events, { kind: "pawnBounce", turn: p.turn, square: done.to, squares: [done.from, done.to] }] }));
      turfBattle.claim(b);
      return done;
    }
    if (step === "turf") {
      const hop = turfHopNow(b)!;
      setPowers(b, (p) => {
        const owner = [...p.turf!.owner];
        owner[turfIndex(hop.to)] = "b";
        return { ...p, turf: { ...p.turf!, owner: owner.join(""), hop, hopAt: hop.at }, events: [...p.events, { kind: "turfHop", turn: p.turn, square: hop.to, squares: [...hop.hops, hop.to] }] };
      });
      return hop;
    }
    const options = hopList(b).options;
    const chosen = options.find((o) => o.fen === pick) ?? options[0]!;
    const hop: LeapfrogHop = { at: b.state.boss!.crowdMoves, from: chosen.from, over: chosen.over, to: chosen.to };
    setBase(b, chosen.fen);
    const pulled = carrotBattle.pull(b, "boss", true);
    setPowers(b, (p) => ({ ...p, hop, hops: (p.hops ?? 0) + 1, events: [...p.events, ...pulled, { kind: "hop", turn: p.turn, square: hop.to, squares: [hop.from, hop.over, hop.to] }] }));
    turfBattle.claim(b);
    return hop;
  },

  /** What his turn must work out besides his move (Long legs' long steps: HOPPER.asks), or null. */
  asks(b: Battle): BossAsks | null {
    const boss = b.state.boss;
    if (!boss?.powers || boss.id !== "hopper") return null;
    return HOPPER.asks!(boss, boardOf(b).fen);
  },

  /**
   * Double hop's second move is due: his third hold on as his turn began, his move played (the crowd's turn begun, not yet
   * played) and the turn could pass back to him (turfBattle.afterHisMove). Like Hollow's extra move, it comes before the crowd picks.
   */
  doubleDue(b: Battle): boolean {
    const boss = b.state.boss;
    const d = turfOf(boss)?.double;
    return d?.state === "due" && d.at === boss!.crowdMoves && !b.finalGameOver() && !b.bossToMove();
  },

  /** His second move from this device's engine (doubleHopFrom); none, the seeded stand-in (applyDouble). */
  async playDouble(b: Battle, engine: EngineLike): Promise<string | null> {
    const pick = await doubleHopFrom(engine, boardOf(b).fen).catch(() => null);
    return hopperBattle.applyDouble(b, pick);
  },

  /**
   * Plays his second move (from the host's engine online), as Hollow's extra move: the crowd's turn passes back (a base at its
   * ply), then his quiet move (extraMoveCandidates: no capture, check or promotion, the crowd left a move). One that isn't a
   * candidate, or none (no engine answer), and a quiet candidate from the battle's seed (as Dash's: it never just doesn't come
   * once due). Unscored, never fair play's; the squares it lands on his; a carrot it ends on his. Returns it, or null.
   */
  applyDouble(b: Battle, move: string | null): string | null {
    if (!hopperBattle.doubleDue(b)) return null;
    const boss = b.state.boss!;
    const d = boss.powers!.turf!.double!;
    const id = b.state.boards[0]!;
    const board = b.boards.get(id)!;
    const passed = passTurn(board.fen);
    const candidates = passed ? extraMoveCandidates(passed) : [];
    if (move === null || !candidates.includes(move)) move = candidates.length ? [...candidates].sort()[Math.floor(powerRoll(boss.powers!.seed, "double", d.at) * candidates.length)]! : null;
    const done = (state: "played" | "skipped", events: readonly PowerEvent[] = []) => setPowers(b, (p) => ({ ...p, turf: { ...p.turf!, double: { at: d.at, state } }, events: [...p.events, ...events] }));
    if (!passed || !move) {
      done("skipped");
      return null;
    }
    const ply = board.history.length;
    const base: BoardState = { ...board, fen: passed, expected: 1 - board.expected, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: passed }] };
    b.boards.set(id, playOnBoard(base, move, base.expected));
    b.bossLast = { move, san: toSan(passed, move) };
    const pulled = carrotBattle.pull(b, "boss", true);
    done("played", [...pulled, { kind: "doubleHop", turn: boss.powers!.turn, square: move.slice(2, 4), squares: [move.slice(0, 2), move.slice(2, 4)] }]);
    turfBattle.claim(b);
    return move;
  },
};

/** Double hop's second move from this device's engine: his best quiet move within turfDoubleGain points (extraMoveFrom). */
export const doubleHopFrom = (engine: EngineLike, fen: string, s: Pick<BossPowerSettings, "turfDoubleGain"> = BOSS_POWERS): Promise<string | null> => extraMoveFrom(engine, fen, s.turfDoubleGain);

/** His Turf in a battle: the squares claimed after every move and step, his holds as his turn begins, Long legs' long step. */
export const turfBattle = {
  /** Every piece that has come to a square since the last claim claims it (claimTurf). */
  claim(b: Battle): void {
    const boss = b.state.boss;
    const t = turfOf(boss);
    if (!t) return;
    const next = claimTurf(t, boardOf(b).fen, boss!.crowdSide);
    if (next !== t) setPowers(b, (p) => ({ ...p, turf: next }));
  },

  /** As his turn begins (the crowd has moved: `moved`): the squares claimed, then his holds from his count (holdsFor). */
  turnBegins(b: Battle, moved: boolean): void {
    turfBattle.claim(b);
    const boss = b.state.boss!;
    const t = turfOf(boss);
    if (!t || !moved) return;
    setPowers(b, (p) => ({ ...p, turf: { ...t, holds: holdsFor(turfCount(t.owner, "b")), holdsAt: boss.crowdMoves } }));
  },

  /**
   * Long legs: his move was a long step's first step (`extras.special`, his rules' specialMove: legsPlay of it is `move`), so the
   * pawn goes on to its square (a base at its ply; the last move shown from to; no en passant from it).
   */
  legsOn(b: Battle, move: string, extras?: BossMoveExtras): void {
    const legs = extras?.special;
    if (!legs || legsPlay(legs) !== move || !holdOn(b.state.boss, 1)) return;
    const id = b.state.boards[0]!;
    const board = b.boards.get(id)!;
    const g = gridOf(board.fen);
    const pawn = g.get(move.slice(2, 4));
    if (!pawn || g.has(legs.slice(2, 4))) return;
    g.delete(move.slice(2, 4));
    g.set(legs.slice(2, 4), pawn);
    const parts = editedFen(board.fen, g).split(" ");
    parts[3] = "-";
    const fen = parts.join(" ");
    const ply = board.history.length;
    b.boards.set(id, { ...board, fen, lastMove: legs, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen }] });
  },

  /** After his move (and its carrots and spin): the squares claimed; Double hop's second move due when his third hold is on. */
  afterHisMove(b: Battle): void {
    turfBattle.claim(b);
    const boss = b.state.boss!;
    if (!holdOn(boss, 3) || boss.result || carrotBattle.won(boss) || b.finalGameOver()) return;
    const passed = passTurn(boardOf(b).fen);
    const state = passed && extraMoveCandidates(passed).length ? ("due" as const) : ("skipped" as const);
    setPowers(b, (p) => ({ ...p, turf: { ...p.turf!, double: { at: boss.crowdMoves, state } } }));
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
   * trigger staying, so "next turn" stays true, and it's checked again on his next turn; for at most ultWaitMax of his
   * waits, then it comes (Eric, Nov 26).
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
    // (The guard has held it ultWaitMax times: it comes now, the guard or not. His waits, not crowd moves, so a tower floor's other
    // bosses' turns and his turns in check don't count. Eric, Nov 26: "just force it at some point"; review of #972, finding 1.)
    const forced = (boss.powers!.passWaits ?? 0) >= BOSS_POWERS.ultWaitMax;
    if (answer === PASS_WAIT && !forced) {
      setPowers(b, (p) => ({ ...p, passWait: boss.crowdMoves, passWaits: (p.passWaits ?? 0) + 1 }));
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
