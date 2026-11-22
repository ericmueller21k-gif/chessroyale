/**
 * Boss powers: the dispatcher. Each boss's rules live in its own file (bosses/<boss>.ts, on the base boss in
 * bosses/base.ts, registered in bosses/index.ts); this file asks them, so the server, the solo game and every screen
 * work out the same thing for any boss: which moves the crowd (and the boss) may play this turn, what happens as a turn
 * begins, what each player sees, and whether a turn counts for fair play. It re-exports every boss's file, so the whole
 * package imports from here. The ground rules:
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
import { BATTLE_TOWER, BOSS_POWERS, type BossPowerSettings, type BossPowerState, type BossState, type PowerEvent, type StopReason } from "@chessroyale/core";
import { bindsBosses, layerStop, mergeLayers } from "./board-layer.ts";
import { legalMoves } from "./rules.ts";
import type { EngineLike } from "./runner.ts";
import type { MoveScore } from "./uci.ts";
import {
  bossPowers,
  heldBy,
  materialOf,
  moveLoss,
  moveSquares,
  other,
  powerRoll,
  rageNow,
  ragePoints,
  rageSpeedOf,
  rageTick,
  topEach,
  turnOf,
  ultCapped,
  unleashed,
  type Battle,
  type BossAsks,
  type BossLastMove,
  type BossRules,
  type JudgedEvaluation,
  type JudgedMove,
  type RageRates,
  type Side,
  type StopFields,
  type TurnContext,
} from "./bosses/base.ts";
import { bossRules } from "./bosses/index.ts";

// Every boss's file, and the shared pieces of the base boss, for the whole package.
export { bossPowers, heldBy, materialOf, moveLoss, moveSquares, powerRoll, rageNow, ragePoints, rageSpeedOf, rageTick, topEach, ultCapped, unleashed };
// (The pass guard: one rule for every power that spends his whole turn.)
export { PASS_WAIT, passAnswer, passLoses, passScores, type PassScore } from "./bosses/base.ts";
// The board layer (every boss's marks at once: board-layer.ts).
export * from "./board-layer.ts";
export type { Battle, BossAsks, BossLastMove, BossRules, JudgedEvaluation, JudgedMove, RageRates, StopFields, TurnContext };
export * from "./bosses/ginger.ts";
export * from "./bosses/boingo.ts";
export * from "./bosses/grex.ts";
export * from "./bosses/hollow.ts";
export * from "./bosses/bigboy.ts";
export * from "./bosses/sawyer.ts";
export * from "./bosses/pig.ts";
export * from "./bosses/recluse.ts";
export * from "./bosses/recluse-phase2.ts";
export * from "./bosses/alfil.ts";
export * from "./bosses/hopper.ts";
export * from "./bosses/carrots.ts";
export * from "./bosses/smudgy.ts";
export * from "./bosses/gardener.ts";
export * from "./bosses/tiger.ts";
export * from "./bosses/moo.ts";
export * from "./bosses/folio.ts";
export * from "./bosses/timber.ts";
export * from "./bosses/dash.ts";
export * from "./bosses/zebra.ts";
export * from "./bosses/chandy.ts";
export * from "./bosses/index.ts";

/** A battle's powers as it starts (nothing has happened yet; the first turn is set up by prepareTurn). */
export function initPowers(seed: number, fen: string, crowdSide: Side): BossPowerState {
  return { seed: seed >>> 0, turn: 0, material: materialOf(fen, other(crowdSide)), lost: 0, nextPassive: BOSS_POWERS.firstPassive, events: [] };
}

/**
 * As a crowd turn begins (after the boss's move, or as the battle starts): the rage meter, the ultimate's warning
 * and the ultimate, and the passive. `fen` is the position with the crowd to move. Once per turn: calling it again
 * for the same turn (the re-pick after the God King's Last Stand) changes nothing. `test`: an ultimate (the test switch)
 * warned as the second turn begins and unleashed on the third (the passive comes on the second turn anyway).
 * The test trigger (an admin's, `ultNext`) brings the ultimate as this turn begins, without the warning. `lastMove`: the
 * boss's move just played (Hollow covers its piece's square after his first).
 *
 * The meter is the same for every boss; the rest is the boss's own rules (BossRules), in this order: the ultimate
 * under way (still running: the meter stays empty; over: it clears, and the meter fills again from empty), what wore
 * off, the ultimate's step, anything every turn, then the passive (not on the turn the ultimate came, if it was due
 * then: it waits a turn). `hold` (several bosses on one side: not the turn change before his own move): the ultimate's step
 * is left out (the meter still fills; a warning and the test trigger wait), so one ultimate comes a turn change.
 */
export function prepareTurn(boss: BossState, fen: string, test = "", s: BossPowerSettings = BOSS_POWERS, lastMove: string | null = null, hold = false, crowdMoves?: () => readonly string[]): BossState {
  const powers = bossPowers(boss);
  const p = boss.powers;
  const rules = bossRules(boss);
  if (!powers || !p || !rules) return boss;
  const turn = turnOf(boss);
  if (p.turn === turn) return boss;
  const crowd = boss.crowdSide;
  // (He has had every ultimate this battle allows him (ultMax: a Battle Tower floor of three): none comes again.)
  const capped = ultCapped(p);
  const events: PowerEvent[] = [];
  const lost = Math.max(p.lost, p.material - materialOf(fen, other(crowd)));
  // The meter over time: each crowd move since the last turn began, faster while the crowd is ahead on the judged eval.
  const moved = p.turn > 0 ? Math.max(0, turn - p.turn) : 0;
  const charge = (p.charge ?? 0) + moved * rageTick(p.judged, s);
  // (An ultimate at the start of the boss's turn keeps the test trigger until then.)
  const { ultNext, ...rest } = p;
  const next: BossPowerState = { ...rest, turn, lost, charge, events, ...(ultNext && !capped && (hold || rules.ultimateOnHisTurn || rules.triggerAtHisTurn) ? { ultNext } : {}) };
  const t: TurnContext = { turn, fen, crowd, seed: p.seed, passive: powers.passive, ultimate: powers.ultimate, test, ultNext: !!ultNext && !capped, lastMove, rageSpeed: rageSpeedOf(boss.id, s), s, events, ...(crowdMoves ? { crowdMoves } : {}) };
  // The ultimate under way: while its effect runs, nothing gathers in the meter (it stays empty); once it's over, the
  // meter fills again from empty, and the next can come. (Capped, ultMax: it stays empty for the rest of the battle.)
  if (next.ultAt !== undefined || capped) next.rageUsed = ragePoints(next, s);
  if (next.ultAt !== undefined) {
    if (!(rules.ultimateRunning ? rules.ultimateRunning(next, turn, s) : turn <= next.ultAt)) {
      delete next.warnAt;
      delete next.ultAt;
    }
  }
  rules.wearOff?.(next, t);
  const before = next.ultAt;
  // (`hold`: several bosses on one side, and this turn change isn't his (sideTurn): his ultimate's step waits, its warning and
  // the test trigger kept.)
  // (No ultimate this battle, noUlt: a Battle Tower floor's Wrangler; or none left, ultMax: a floor of three's after his one. The step
  // never runs.)
  const ultNow = before === undefined && !hold && !next.noUlt && !capped ? rules.ultimate(next, t) : false;
  if (before === undefined && next.ultAt !== undefined) unleashed(next, s);
  rules.everyTurn?.(next, t);
  if (ultNow && turn >= next.nextPassive) next.nextPassive = turn + 1;
  else rules.passive(next, t);
  return { ...boss, powers: next };
}

/**
 * Several bosses: this boss's ultimate can't wait for his own turn change (BossRules.ultimateNow: Chandy's last chance), asked as the
 * crowd's turn in `fen` is set up, before any boss's step (his powers as his last turn left them), with the side's allowed moves.
 * Never while an ultimate of his is under way.
 */
export function ultimateNow(boss: BossState, fen: string, crowdMoves: () => readonly string[], test = "", s: BossPowerSettings = BOSS_POWERS): boolean {
  const powers = bossPowers(boss);
  const p = boss.powers;
  const rules = bossRules(boss);
  if (!powers || !p || !rules?.ultimateNow || p.ultAt !== undefined || p.noUlt || ultCapped(p)) return false;
  const t: TurnContext = { turn: turnOf(boss), fen, crowd: boss.crowdSide, seed: p.seed, passive: powers.passive, ultimate: powers.ultimate, test, ultNext: !!p.ultNext, lastMove: null, rageSpeed: rageSpeedOf(boss.id, s), s, events: [], crowdMoves };
  return rules.ultimateNow(p, t);
}

/** An ultimate has come and its effect still runs (or it's its own turn): no rage gathers. */
export const ultimateUnderWay = (boss: Pick<BossState, "powers"> | null | undefined): boolean => boss?.powers?.ultAt !== undefined;

/**
 * The God King strikes the boss: a chunk of rage (BOSS_POWERS.rageStrike, at the boss's speed like every gain), unless
 * an ultimate is under way (it would be thrown away as the effect ends).
 */
export function strikeRage(boss: BossState, s: Pick<BossPowerSettings, "rageStrike"> = BOSS_POWERS): BossState {
  const p = boss.powers;
  // (A boss with a meter of its own, Wrangler: the strike adds nothing to it.)
  // (Capped, ultMax: nothing gathers for the rest of the battle.)
  if (!p || !bossPowers(boss) || ultimateUnderWay(boss) || ultCapped(p) || bossRules(boss)?.meter) return boss;
  return { ...boss, powers: { ...p, charge: (p.charge ?? 0) + s.rageStrike } };
}

// ---------------- The test trigger ----------------

/**
 * An admin's test trigger: the boss's ultimate comes as the next crowd turn begins, without the warning. Safe at any
 * moment: nothing happens if the boss has no ultimate, one is already under way (it never overlaps another) or on its
 * way, its once-a-battle ultimate has come (`ultimateOnce`: its `ultAt` is never cleared, as it stays under way), or the
 * battle is over; it only takes effect as a turn begins (prepareTurn), never in the middle of one or of a moment. Once
 * that ultimate's effect is over, it can be pulled again.
 */
export function triggerUltimate(boss: BossState | null | undefined): { boss: BossState | null | undefined; ok: boolean } {
  const p = boss?.powers;
  if (!boss || !p || !bossPowers(boss) || boss.result || p.ultAt !== undefined || p.noUlt || ultCapped(p)) return { boss, ok: false };
  if (p.ultNext) return { boss, ok: true };
  return { boss: { ...boss, powers: { ...p, ultNext: true } }, ok: true };
}

/**
 * The moves the crowd may play this turn, or null when every legal move is allowed. Frozen pieces can't move and
 * nobody can move onto the pie; in the blizzard only the pieces its ice doesn't hold move (Ginger's rules). The God
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
    allowed = limitCrowd(bossRules(boss), boss!, fen, legal);
    if (!allowed.length) allowed = legal;
  }
  if (barred) {
    const open = allowed.filter((m) => m !== barred);
    allowed = open.length ? open : legal.filter((m) => m !== barred);
    if (!allowed.length) allowed = legal;
  }
  return allowed.length === legal.length ? null : allowed;
}

/**
 * What stops the boss's own moves now (`fen`: him to move), or null: nothing does. His boss's marks on the board that bind
 * him (`layer`, read by the board layer's `layerStop`: a pie, a toy block, a plant, a scatter shot's square, his dough, Sawyer's
 * saw), then its other stops (`bossStops`: Sawyer's first move, the hoops, the paint).
 */
function bossLimit(boss: BossState | null | undefined, fen: string): ((move: string) => boolean) | null {
  const rules = boss?.powers ? bossRules(boss) : null;
  if (!rules) return null;
  const marks = rules.layer?.(boss!, fen);
  const layer = bindsBosses(marks) ? mergeLayers(boss!.crowdSide, [marks]) : null;
  const stops = rules.bossStops?.(boss!) ?? null;
  if (!layer && !stops) return null;
  return (m) => (!!layer && !!layerStop(layer, fen, m)) || !!stops?.(m, fen);
}

/**
 * The moves the boss may play (a pie stops it: nothing onto it; a toy block: nothing onto it or through it), or null
 * when every legal move is allowed. Never none: a restriction that would leave no move lifts.
 */
export function bossAllowed(boss: BossState | null | undefined, fen: string): string[] | null {
  const stops = bossLimit(boss, fen);
  if (!stops) return null;
  const legal = legalMoves(fen);
  const allowed = legal.filter((m) => !stops(m));
  return allowed.length && allowed.length < legal.length ? allowed : null;
}

/** A power stops the boss's `move` now (`fen`: him to move): played anyway, it went through (his only move, the limit lifted). */
export const bossStopped = (boss: BossState | null | undefined, fen: string, move: string): boolean => !!bossLimit(boss, fen)?.(move);

/** A crowd move is allowed this turn. */
export const crowdMayPlay = (boss: BossState | null | undefined, fen: string, move: string): boolean => {
  const allowed = crowdAllowed(boss, fen);
  return allowed ? allowed.includes(move) : legalMoves(fen).includes(move);
};

/**
 * Which power stops `move` now, either side (Sawyer's saw, a pie, a toy block: BossRules.stopReason), for the screens'
 * words, or null. The match's state and the screens' view alike (the fields it reads are the same in both).
 */
export function stopReason(boss: { id?: string; powers?: StopFields | null } | null | undefined, fen: string, move: string): StopReason | null {
  return boss?.powers ? (bossRules(boss)?.stopReason?.(boss, fen, move) ?? null) : null;
}

/**
 * A power touches this crowd turn (a frozen piece, a pie, the blizzard, a flipped board, fire; Big Boy's toy blocks only
 * where they take one of the crowd's moves away: Eric's (b), Nov 18): its picks don't count as fair-play signals. `fen`: the
 * position, the crowd to move (the match always passes it; without it, Big Boy's toys up count, as before).
 */
export function powerTurn(boss: BossState | null | undefined, fen?: string): boolean {
  const p = boss?.powers;
  return !!p && !!bossRules(boss)?.powerTurn?.(boss!, fen);
}

/**
 * A boss's power has changed the board this crowd turn (`fen`: the crowd to move), so the God King's Last Stand sits out
 * (Eric, Oct 24: Babur's hoop stopped the recapture the plain-chess judge feared;
 * docs/decisions/2026-10-24-king-save-off-on-altered-boards.md). One rule for every boss, no list: a power touches the
 * turn (`powerTurn`, fair play's own test), something stops his moves (`bossStops`, or a mark that binds him: `layer`),
 * something stops any of the crowd's (`layer`, `crowdFilter`), or something else of his is on the board (`altersBoard`: Hollow's dark, the Roman candle's shadows,
 * the carrots). A boss with its own test (`standAltered`: Big Boy's, his toy blocks only where they take away the reply the
 * Last Stand would replay; Eric's (b), Nov 18) answers in its place, given the crowd's move (`stand`: the played move and the
 * judge's feared reply; without it, the general rule). `rules`: the boss's (a test's stand-in).
 */
export function boardAltered(
  boss: BossState | null | undefined,
  fen: string,
  rules: BossRules | null = bossRules(boss),
  stand?: { played: string; reply?: string },
): boolean {
  if (!boss?.powers || !rules) return false;
  if (rules.standAltered && stand) return rules.standAltered(boss, fen, stand.played, stand.reply);
  if (rules.powerTurn?.(boss, fen) || rules.bossStops?.(boss) || rules.altersBoard?.(boss)) return true;
  if (rules.layer && bindsBosses(rules.layer(boss, fen))) return true;
  if (!rules.crowdFilter && !rules.layer) return false;
  const legal = legalMoves(fen);
  return limitCrowd(rules, boss, fen, legal).length < legal.length;
}

/**
 * A boss's limits on the crowd's `legal` moves (none may be left: the caller lifts them): its marks on the board first
 * (`layer`, read by the board layer's `layerStop`), one rule for every boss (Eric, Oct 27): a held piece doesn't move, nor
 * castles with a held rook; then its other limits (`crowdFilter`).
 */
export function limitCrowd(rules: Pick<BossRules, "layer" | "crowdFilter"> | null | undefined, boss: BossState, fen: string, legal: string[]): string[] {
  if (!rules) return legal;
  const marks = rules.layer?.(boss, fen);
  const layer = marks ? mergeLayers(boss.crowdSide, [marks]) : null;
  const free = layer ? legal.filter((m) => !layerStop(layer, fen, m)) : legal;
  return rules.crowdFilter ? rules.crowdFilter(free, boss, fen) : free;
}

/**
 * The squares that show ice: the frozen piece; in the blizzard the crowd's pieces its ice holds (every one but those
 * free), on the crowd's turn and through the boss's turn after it.
 */
export function icedSquares(boss: BossState | null | undefined, fen: string): string[] {
  const p = boss?.powers;
  if (!p || !boss) return [];
  return bossRules(boss)?.iced?.(boss, fen, crowdAllowed) ?? [];
}

/**
 * Its ultimate has come as often as a battle allows (`ultimateOnce`: once, Chub & Chirp's Carrot Patch; `ultimateMax`:
 * Smudgy's Repaint, twice): the meter is off from the turn after the last, and the admins' test trigger refuses.
 */
export function ultimateSpent(boss: BossState | null | undefined): boolean {
  const p = boss?.powers;
  const rules = bossRules(boss);
  if (!p || !rules || p.ultAt === undefined) return false;
  return !!rules.ultimateOnce || (rules.ultimateMax !== undefined && (p.ults ?? 0) >= rules.ultimateMax);
}

/**
 * The rage meter, 0 to 1 (full: the warning, then the ultimate), null without powers. Full on the ultimate's own
 * turn; empty from then while its effect runs; then it fills again.
 */
export function rageOf(boss: BossState | null | undefined, s: RageRates = BOSS_POWERS): number | null {
  const p = boss?.powers;
  if (!p || !bossPowers(boss)) return null;
  // (No ultimate this battle: the meter stays, empty, dimmed by ragePaused.)
  if (p.noUlt) return 0;
  // (His last a battle allows him has come (ultMax: a tower floor of three): from the turn after it, the meter stays, empty, dimmed by
  // ragePaused, whoever he is (never gone, as a lone Smudgy's or Chub & Chirp's goes after theirs: nothing hidden).)
  if (ultCapped(p) && (p.ultAt === undefined || turnOf(boss!) > p.ultAt)) return 0;
  // (A meter of its own: Wrangler's.)
  const own = bossRules(boss)?.meter;
  if (own) return own(p, turnOf(boss!), { ...BOSS_POWERS, ...s });
  // (Once a battle, Chub & Chirp's; Smudgy's last Repaint: from the turn after it, no meter.)
  // (Timber's: it stays, empty: spentMeterShown.)
  if (p.ultAt !== undefined && ultimateSpent(boss) && turnOf(boss!) > p.ultAt) return bossRules(boss)?.spentMeterShown ? 0 : null;
  if (p.ultAt !== undefined) return turnOf(boss!) <= p.ultAt ? 1 : 0;
  return Math.max(0, Math.min(1, rageNow(p, rageSpeedOf(boss!.id, s), s) / s.rageFull));
}

/**
 * The meter is held empty: an ultimate came and its effect still runs, or (spentMeterShown: Timber's) the last a battle allows
 * has come (the screens show it paused). A meter of its own (Wrangler's) is never paused, unless it's kept on the bar once spent
 * (spentMeterShown: Chandy's after his one Dodge).
 */
export const ragePaused = (boss: BossState | null | undefined): boolean => {
  const p = boss?.powers;
  const rules = bossRules(boss);
  if (p?.noUlt) return true;
  // (Capped, ultMax: from the turn after his last, for the rest of the battle.)
  if (ultCapped(p) && (p!.ultAt === undefined || turnOf(boss!) > p!.ultAt)) return true;
  if (!p || p.ultAt === undefined || turnOf(boss!) <= p.ultAt) return false;
  if (rules?.meter) return !!rules.spentMeterShown && ultimateSpent(boss);
  return !ultimateSpent(boss) || !!rules?.spentMeterShown;
};

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
 * The moves the judge must score too this crowd turn, whatever the engine's top moves are (G-REX's fire: the ones that
 * save a piece from a tile ablaze). None without a boss, or for a boss whose rules don't ask.
 */
export function judgeMustScore(boss: BossState | null | undefined, fen: string): string[] {
  const j = boss ? bossRules(boss)?.judge : undefined;
  return j ? j.mustScore(boss!, fen) : [];
}

/** The moves the bots may pick this crowd turn besides the engine's top moves (BossRules.judge.offer: the race's pulls); none for most bosses. */
export function judgeOffers(boss: BossState | null | undefined, fen: string): string[] {
  const j = boss ? bossRules(boss)?.judge : undefined;
  return j?.offer ? j.offer(boss!, fen) : [];
}

/** Top moves as the judge ranks them this crowd turn under the boss's rules (for bots and hints), best first. */
export function judgeRanked(boss: BossState | null | undefined, top: readonly MoveScore[], fen: string): MoveScore[] {
  const j = boss ? bossRules(boss)?.judge : undefined;
  return j ? j.rank(boss!, top, fen) : [...top];
}

/** A board's evaluation as the judge sees it under the boss's rules (G-REX's fire: a piece left to burn counts as gone). */
export function judgeEvaluation<E extends JudgedEvaluation>(boss: BossState | null | undefined, evaluation: E, fen: string): E {
  const j = boss ? bossRules(boss)?.judge : undefined;
  return j ? j.evaluation(boss!, evaluation, fen) : evaluation;
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

// ---------------- The judge's look past a move (BossRules.judgeAfter: Sawyer's Saw Swap) ----------------

/**
 * The judge's look past the crowd's move (Eric, Nov 21): for each move that sets off a power as it lands (`swap`: move → the board
 * after it, the boss to move; the runner's judgeAfter, sent in the job), that board's search (`search`: the top-moves search every
 * position the judge looks at gets, so a device prefetches it while players think and two devices run it alike), its best line read
 * from the crowd's side: the crowd's expected score after the move and the power. By move. A board with no line (none should be:
 * sawSwapFen leaves him a move the engine plays) is left out, and its move is scored as it stands.
 */
export async function swapScores(search: (fen: string) => Promise<readonly MoveScore[]>, swap: Readonly<Record<string, string>> | null | undefined): Promise<MoveScore[]> {
  const out: MoveScore[] = [];
  for (const move of Object.keys(swap ?? {}).sort()) {
    const [best] = await search(swap![move]!);
    if (best) out.push({ move, expected: 1 - best.expected });
  }
  return out;
}

/** The look's scores by move (swapScores), for an evaluation's `swapped`; none: undefined. */
export const swapMap = (swap: readonly MoveScore[]): Record<string, number> | undefined => (swap.length ? Object.fromEntries(swap.map((m) => [m.move, m.expected])) : undefined);

/**
 * Scores as the judge ranks them with its look past the move (swapScores: for the bots and the hints): each move it looked past takes
 * the look's score (its reply and mate were the boss's answers on the board without the power: gone), best first (ties by move). A move
 * it looked past that isn't in the list joins it when its score is above the list's best (the judge's best can be a move outside the top
 * moves: swapJudged; the review of #863, finding 5), so the bots and the hints can pick it. Moves it didn't look past keep their place:
 * without one in or above the list, the list as it is.
 */
export function swapIn(scores: readonly MoveScore[], swap: readonly MoveScore[] | null | undefined): MoveScore[] {
  const by = new Map((swap ?? []).map((m) => [m.move, m]));
  const listed = scores.map((m) => by.get(m.move) ?? m);
  const high = Math.max(...listed.map((m) => m.expected));
  const joins = (swap ?? []).filter((m) => m.expected > high && !scores.some((x) => x.move === m.move));
  if (!joins.length && !scores.some((m) => by.has(m.move))) return [...scores];
  return [...listed, ...joins].sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));
}

/**
 * A board's evaluation with the judge's look past the move in (`swapped`: move → the crowd's expected score after the power, the
 * runner's own moves only: swapsFor): each of those moves takes that score, scored or not before (it was searched either way), its
 * reply and mate dropped (the boss's answers on the board without the power, which the Last Stand would show); then the best move is
 * the highest scored (ties keep the judge's best, then by move). The same object when there are none. Pure: the host, the judges and
 * the lobby work it out alike.
 */
export function swapJudged<E extends JudgedEvaluation & { replies?: Readonly<Record<string, string>>; mates?: Readonly<Record<string, number>> }>(evaluation: E, swapped: Readonly<Record<string, number>>): E {
  const moves = Object.keys(swapped);
  if (!moves.length) return evaluation;
  const expectedAfter = { ...evaluation.expectedAfter, ...swapped };
  const drop = <T>(r: Readonly<Record<string, T>> | undefined) => (r ? Object.fromEntries(Object.entries(r).filter(([m]) => !Object.hasOwn(swapped, m))) : r);
  let bestMove = evaluation.bestMove;
  let bestExpected = expectedAfter[bestMove] ?? evaluation.bestExpected;
  for (const [m, e] of Object.entries(expectedAfter).sort((a, b) => (a[0] < b[0] ? -1 : 1))) if (e > bestExpected) [bestMove, bestExpected] = [m, e];
  return { ...evaluation, bestMove, bestExpected, expectedAfter, ...(evaluation.replies ? { replies: drop(evaluation.replies) } : {}), ...(evaluation.mates ? { mates: drop(evaluation.mates) } : {}) };
}

// ---------------- Several bosses on one side (the Battle Tower) ----------------

/*
 * A side of several bosses (`side`: each in full, the boss in focus first, then the rest in turn order: the runner's
 * sideBosses). Every function here gives exactly today's answer for a side of one (it asks the one-boss function above), so
 * no battle of one boss changes. Several: every boss's marks merge into one layer (the most restrictive wins), every boss's
 * other limits apply in turn, and the lift and the Last Stand's barred move come last, once, as for one boss.
 */

/** The crowd's moves under every boss on the side at once (crowdAllowed's rules), or null: any legal move. */
export function sideCrowdAllowed(side: readonly BossState[], fen: string): string[] | null {
  if (side.length < 2) return crowdAllowed(side[0], fen);
  const barred = side[0]!.barred;
  const live = side.filter((b) => b.powers && bossRules(b));
  if (!live.length && !barred) return null;
  const legal = legalMoves(fen);
  let allowed = legal;
  if (live.length) {
    const layer = mergeLayers(side[0]!.crowdSide, live.map((b) => bossRules(b)!.layer?.(b, fen)));
    allowed = legal.filter((m) => !layerStop(layer, fen, m));
    for (const b of live) {
      const filter = bossRules(b)!.crowdFilter;
      if (filter) allowed = filter(allowed, b, fen);
    }
    if (!allowed.length) allowed = legal;
  }
  if (barred) {
    const open = allowed.filter((m) => m !== barred);
    allowed = open.length ? open : legal.filter((m) => m !== barred);
    if (!allowed.length) allowed = legal;
  }
  return allowed.length === legal.length ? null : allowed;
}

/**
 * What stops the move of the boss to move (`side[0]`, him to move in `fen`): every mark on the board that binds the bosses,
 * whoever put it there, his own stops (bossStops), and of every other boss's the part that binds the whole side (sideStops:
 * Smudgy's disguise, the hoops), never one that binds only that boss's own moves (Sawyer's first move, Smudgy's forced moves).
 */
function sideBossLimit(side: readonly BossState[], fen: string): ((move: string) => boolean) | null {
  if (side.length < 2) return bossLimit(side[0], fen);
  const live = side.filter((b) => b.powers && bossRules(b));
  const marks = live.map((b) => bossRules(b)!.layer?.(b, fen));
  const layer = marks.some(bindsBosses) ? mergeLayers(side[0]!.crowdSide, marks) : null;
  const stops = live.flatMap((b) => {
    const rules = bossRules(b)!;
    const stop = b !== side[0] && rules.sideStops ? rules.sideStops(b) : rules.bossStops?.(b);
    return stop ? [stop] : [];
  });
  if (!layer && !stops.length) return null;
  return (m) => (!!layer && !!layerStop(layer, fen, m)) || stops.some((stop) => stop(m, fen));
}

/** The moves the boss to move (`side[0]`) may play (bossAllowed's rules, every boss's guards), or null: any legal move. */
export function sideBossAllowed(side: readonly BossState[], fen: string): string[] | null {
  if (side.length < 2) return bossAllowed(side[0], fen);
  const stops = sideBossLimit(side, fen);
  if (!stops) return null;
  const legal = legalMoves(fen);
  const allowed = legal.filter((m) => !stops(m));
  return allowed.length && allowed.length < legal.length ? allowed : null;
}

/** A power stops the move of the boss to move (`side[0]`) now: played anyway, it went through (bossStopped's rules). */
export const sideBossStopped = (side: readonly BossState[], fen: string, move: string): boolean => (side.length < 2 ? bossStopped(side[0], fen, move) : !!sideBossLimit(side, fen)?.(move));

/** Which power stops `move` now, either side, for the screens' words: the first boss's on the side that names one (stopReason). */
export function sideStopReason(side: readonly BossState[], fen: string, move: string): StopReason | null {
  for (const b of side) {
    const why = stopReason(b, fen, move);
    if (why) return why;
  }
  return null;
}

/**
 * The name another boss on the side gives the move about to be played (`fen`: before it), when his rules play that very move
 * under another name (specialMove: Smudgy's, while his rook hides, so no move of the side's names it), or null: as it is.
 */
export function sideMoveName(side: readonly BossState[], fen: string, move: string): string | null {
  for (const b of side) {
    const s = b.powers ? bossRules(b)?.specialMove?.(b, fen, move) : null;
    if (s && s.play === move) return s.san;
  }
  return null;
}

/** A power of any boss on the side touches this crowd turn (powerTurn): its picks aren't fair-play signals. */
export const sidePowerTurn = (side: readonly BossState[], fen?: string): boolean => side.some((b) => powerTurn(b, fen));

/** Any boss's power has changed the board this crowd turn (boardAltered): the God King's Last Stand sits out. */
export const sideBoardAltered = (side: readonly BossState[], fen: string, stand?: { played: string; reply?: string }): boolean =>
  side.some((b) => boardAltered(b, fen, bossRules(b), stand));

/** The squares that show ice, every boss's (icedSquares). */
export function sideIcedSquares(side: readonly BossState[], fen: string): string[] {
  if (side.length < 2) return icedSquares(side[0], fen);
  return [...new Set(side.flatMap((b) => icedSquares(b, fen)))];
}

/** The moves the judge must score too this crowd turn, under every boss's rules (judgeMustScore). */
export function sideMustScore(side: readonly BossState[], fen: string): string[] {
  if (side.length < 2) return judgeMustScore(side[0], fen);
  return [...new Set(side.flatMap((b) => judgeMustScore(b, fen)))];
}

/** The moves the bots may pick besides the top moves, under every boss's rules (judgeOffers). */
export function sideOffers(side: readonly BossState[], fen: string): string[] {
  if (side.length < 2) return judgeOffers(side[0], fen);
  return [...new Set(side.flatMap((b) => judgeOffers(b, fen)))];
}

/** Top moves as the judge ranks them under every boss's rules, each in turn (judgeRanked). */
export function sideRanked(side: readonly BossState[], top: readonly MoveScore[], fen: string): MoveScore[] {
  if (side.length < 2) return judgeRanked(side[0], top, fen);
  return side.reduce<MoveScore[]>((ranked, b) => judgeRanked(b, ranked, fen), [...top]);
}

/** A board's evaluation as the judge sees it under every boss's rules, each in turn (judgeEvaluation). */
export function sideEvaluation<E extends JudgedEvaluation>(side: readonly BossState[], evaluation: E, fen: string): E {
  if (side.length < 2) return judgeEvaluation(side[0], evaluation, fen);
  return side.reduce((e, b) => judgeEvaluation(b, e, fen), evaluation);
}

/**
 * Each boss's rage meter on a side of `n` bosses fills at BATTLE_TOWER.rageScale[n - 1] of its speed: the rates with every
 * boss's speed scaled (one boss: the rates as they are).
 */
export function sideRates<R extends Pick<BossPowerSettings, "rageSpeed">>(s: R, ids: readonly (string | undefined)[], scale: readonly number[] = BATTLE_TOWER.rageScale): R {
  if (ids.length < 2) return s;
  const k = scale[ids.length - 1] ?? scale[scale.length - 1] ?? 1;
  return { ...s, rageSpeed: { ...s.rageSpeed, ...Object.fromEntries(ids.filter((id): id is string => !!id).map((id) => [id, rageSpeedOf(id, s) * k])) } };
}
