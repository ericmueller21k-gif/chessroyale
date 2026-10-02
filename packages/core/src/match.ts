import { randomInt, shuffle, weightedIndex, type Rng } from "./rng.ts";
import type { GroupResult } from "./scoring.ts";
import { DEFAULT_SETTINGS, type Settings } from "./settings.ts";

/**
 * Match structure from buildspec.md: knockout stages scored on move quality,
 * then a duel. Boards are referred to by id only; their positions live in the
 * chess layer, which reports each board's expected score and game-over state.
 */

export interface StagePlan {
  index: number;
  players: number;
  boards: number;
  knockouts: number;
}

/** Players, boards and knockouts per stage, e.g. 32/8/8, 24/6/8, 16/4/8, 8/2/4, 4/1/2, then the duel. */
export function stagePlan(settings: Settings = DEFAULT_SETTINGS): StagePlan[] {
  let players = settings.lobbySize;
  return settings.knockoutsPerStage.map((knockouts, index) => {
    const plan = { index, players, boards: Math.ceil(players / settings.groupSize), knockouts };
    players -= knockouts;
    return plan;
  });
}

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  /** Bot skill temperature (lower is stronger). */
  skill: number | null;
  alive: boolean;
  /** Score in the current stage (or running total when scores carry over). */
  stageScore: number;
  /** Thinking time in the current stage, for tie-breaks. */
  stageThinkMs: number;
  /** Rounds played in the current stage (for the average). */
  stageRounds: number;
  /** Time left in the bank (ms). */
  bankMs: number;
  /** Unused power-ups. */
  powerUps: number;
  powerUpsUsed: number;
  /** Thinking time over the whole match and the moves it covers (for the average-time stat). */
  thinkMsTotal: number;
  movesTimed: number;
  /** Practice mode: unlimited power-ups (shown on the leaderboard). */
  practice: boolean;
  /** Colour played this stage (null when colours aren't fixed, e.g. the last stages on one board). */
  colour: Side | null;
  /** The final: loss of each move (a miss counts as finalMissLoss). */
  finalLosses: number[];
  /** Losses per stage, for the results screen. */
  lossesByStage: number[][];
  lastBoard: number | null;
  lastGroupmates: string[];
  /** Stage in which the player was knocked out (null while alive). */
  outInStage: number | null;
  /** Final placement, 1 = winner (set when knocked out or after the duel). */
  placement: number | null;
}

export type Side = "w" | "b";

/**
 * The 2v2 final on the last board: seeds 1 and 4 against 2 and 3, teammates
 * alternating their side's moves. Placement is by each player's own move quality.
 */
export interface FinalState {
  /** Who moves, turn by turn (cycled): seed 1, seed 2, seed 4, seed 3. */
  order: string[];
  /** teams[0] plays the side to move when the final starts. */
  teams: [string[], string[]];
  /** Moves made so far. */
  turn: number;
}

export interface MatchState {
  stage: number;
  round: number;
  players: PlayerState[];
  /** Ids of the boards in play this stage. */
  boards: number[];
  /** Set once the knockout stages are over. */
  final?: FinalState;
}

export function createMatch(
  entrants: readonly { id: string; name: string; isBot: boolean; skill?: number | null; practice?: boolean }[],
  boards: readonly number[],
  settings: Settings = DEFAULT_SETTINGS,
): MatchState {
  return {
    stage: 0,
    round: 0,
    boards: [...boards],
    players: entrants.map((e) => ({
      id: e.id,
      name: e.name,
      isBot: e.isBot,
      skill: e.skill ?? null,
      alive: true,
      stageScore: 0,
      stageThinkMs: 0,
      stageRounds: 0,
      bankMs: settings.timeBankSeconds * 1000,
      powerUps: settings.powerUpsAtStart,
      powerUpsUsed: 0,
      thinkMsTotal: 0,
      movesTimed: 0,
      practice: e.practice ?? false,
      colour: null,
      finalLosses: [],
      lossesByStage: [[]],
      lastBoard: null,
      lastGroupmates: [],
      outInStage: null,
      placement: null,
    })),
  };
}

export const alivePlayers = (state: MatchState) => state.players.filter((p) => p.alive);

/**
 * Splits the alive players into groups, one per board. While there are 4 or
 * more boards nobody gets the same board twice in a row; repeat groupmates are
 * avoided where possible. When players have a colour for the stage and
 * `boardSide` says which side is to move on each board, players only go to
 * boards where their colour is to move.
 */
export function assignGroups(
  rng: Rng,
  state: MatchState,
  settings: Settings = DEFAULT_SETTINGS,
  iterations = 4000,
  boardSide?: ReadonlyMap<number, Side>,
): Map<number, string[]> {
  const players = alivePlayers(state);
  const strictBoards = state.boards.length >= 4;
  const groups = new Map<number, string[]>();
  const parts: [PlayerState[], number[]][] = [];
  const sides: Side[] = ["w", "b"];
  const byColour = (side: Side) => players.filter((p) => p.colour === side);
  const boardsOf = (side: Side) => state.boards.filter((b) => boardSide?.get(b) === side);
  // Colours fit when every player has one and each colour has a board where it's to move. Group sizes then
  // follow the numbers (an odd number of boards makes them 7-10 instead of 8).
  const colourFits =
    boardSide !== undefined &&
    players.every((p) => p.colour !== null) &&
    sides.every((side) => byColour(side).length === 0 || boardsOf(side).length > 0);
  if (colourFits) for (const side of sides) parts.push([byColour(side), boardsOf(side)]);
  else parts.push([players, [...state.boards]]);
  for (const [ps, bs] of parts) {
    for (const [b, ids] of groupSubset(rng, ps, bs, strictBoards, settings, iterations)) groups.set(b, ids);
  }
  return groups;
}

/** Local search: start from a random split, then swap players between groups whenever that doesn't make things worse. */
function groupSubset(
  rng: Rng,
  players: readonly PlayerState[],
  boardIds: readonly number[],
  strictBoards: boolean,
  settings: Settings,
  iterations: number,
): Map<number, string[]> {
  const boards = shuffle(rng, boardIds);
  const n = players.length;
  // slot[i] = index of the board (in `boards`) player i sits at.
  const order = shuffle(rng, players.map((_, i) => i));
  const slot = new Array<number>(n);
  // Deal round-robin, so group sizes differ by at most one; swaps keep the sizes.
  order.forEach((pi, k) => (slot[pi] = k % boards.length));
  void settings;
  const mates = players.map((p) => new Set(p.lastGroupmates));

  const playerCost = (i: number, b: number): number => {
    let c = strictBoards && players[i]!.lastBoard === boards[b] ? 1000 : 0;
    for (let j = 0; j < n; j++) if (j !== i && slot[j] === b && mates[i]!.has(players[j]!.id)) c += 1;
    return c;
  };
  let total = 0;
  for (let i = 0; i < n; i++) total += playerCost(i, slot[i]!);

  for (let it = 0; it < iterations && total > 0; it++) {
    const i = Math.floor(rng() * n);
    const j = Math.floor(rng() * n);
    const bi = slot[i]!;
    const bj = slot[j]!;
    if (bi === bj) continue;
    const before = playerCost(i, bi) + playerCost(j, bj);
    slot[i] = bj;
    slot[j] = bi;
    const after = playerCost(i, bj) + playerCost(j, bi);
    if (after > before) {
      slot[i] = bi;
      slot[j] = bj;
    } else {
      // Pair costs count twice (both directions), so recompute exactly.
      total = 0;
      for (let k = 0; k < n; k++) total += playerCost(k, slot[k]!);
    }
  }

  const groups = new Map<number, string[]>(boards.map((b) => [b, []]));
  players.forEach((p, i) => groups.get(boards[slot[i]!]!)!.push(p.id));
  return groups;
}

/**
 * Colours for a new stage: `whites` players play White and the rest Black.
 * Players swap colour from the last stage where the numbers allow; the rest
 * are chosen at random. Pass whites = null to clear colours (one board left).
 */
export function assignColours(state: MatchState, rng: Rng, whites: number | null): MatchState {
  const alive = alivePlayers(state);
  if (whites === null) return { ...state, players: state.players.map((p) => (p.alive ? { ...p, colour: null } : p)) };
  // Preference order for White: last stage's Black players first, then no colour, then last stage's White.
  const rank = (p: PlayerState) => (p.colour === "b" ? 0 : p.colour === null ? 1 : 2);
  const order = shuffle(rng, alive).sort((a, b) => rank(a) - rank(b));
  const white = new Set(order.slice(0, whites).map((p) => p.id));
  return {
    ...state,
    players: state.players.map((p) => (p.alive ? { ...p, colour: white.has(p.id) ? "w" : "b" } : p)),
  };
}

export interface RoundPlayerOutcome {
  playerId: string;
  roundScore: number;
  loss: number | null;
  thinkMs: number;
  usedPowerUp?: boolean;
}

/** How long this player may think about the next move: the bank plus the increment, capped by the move clock. */
export function allowedMs(p: Pick<PlayerState, "bankMs">, settings: Settings = DEFAULT_SETTINGS): number {
  return Math.min(settings.moveClockSeconds * 1000, p.bankMs + settings.timeIncrementSeconds * 1000);
}

/** What the standings rank by: the stage score (move quality only; time and power-ups don't count). */
export const standingPoints = (p: Pick<PlayerState, "stageScore">, _settings: Settings = DEFAULT_SETTINGS) => p.stageScore;

/** Adds a round's results to the players and remembers boards and groupmates for the next rotation. */
export function applyRound(
  state: MatchState,
  groups: Map<number, string[]>,
  outcomes: readonly RoundPlayerOutcome[],
  settings: Settings = DEFAULT_SETTINGS,
): MatchState {
  const byPlayer = new Map(outcomes.map((o) => [o.playerId, o]));
  const boardOf = new Map<string, number>();
  for (const [b, ids] of groups) for (const id of ids) boardOf.set(id, b);
  const players = state.players.map((p) => {
    const o = byPlayer.get(p.id);
    if (!p.alive || !o) return p;
    const board = boardOf.get(p.id) ?? null;
    const lossesByStage = p.lossesByStage.map((l) => [...l]);
    if (o.loss !== null) lossesByStage[state.stage]!.push(o.loss);
    const finalLosses = state.final ? [...p.finalLosses, o.loss ?? settings.finalMissLoss] : p.finalLosses;
    const think = Math.max(0, Math.min(o.thinkMs, allowedMs(p, settings)));
    const usedPowerUp = !!o.usedPowerUp && (p.practice || p.powerUps > 0);
    return {
      ...p,
      stageScore: p.stageScore + o.roundScore,
      finalLosses,
      stageThinkMs: p.stageThinkMs + think,
      stageRounds: p.stageRounds + 1,
      bankMs: Math.max(0, p.bankMs + settings.timeIncrementSeconds * 1000 - think),
      powerUps: usedPowerUp && !p.practice ? p.powerUps - 1 : p.powerUps,
      powerUpsUsed: p.powerUpsUsed + (usedPowerUp ? 1 : 0),
      thinkMsTotal: p.thinkMsTotal + think,
      movesTimed: p.movesTimed + 1,
      lossesByStage,
      lastBoard: board,
      lastGroupmates: board === null ? [] : groups.get(board)!.filter((id) => id !== p.id),
    };
  });
  return { ...state, players, round: state.round + 1, final: state.final && { ...state.final, turn: state.final.turn + 1 } };
}

/** Converts a scored group into per-player outcomes, given each player's thinking time. */
export function outcomesFromGroup(
  result: GroupResult,
  thinkMs: Readonly<Record<string, number>>,
  usedPowerUp: ReadonlySet<string> = new Set(),
): RoundPlayerOutcome[] {
  return result.players.map((p) => ({
    playerId: p.playerId,
    roundScore: p.roundScore,
    loss: p.loss,
    thinkMs: thinkMs[p.playerId] ?? 0,
    usedPowerUp: usedPowerUp.has(p.playerId),
  }));
}

/**
 * Alive players ordered best first: stage score, then (only for an exact tie)
 * less thinking time, then a coin flip.
 */
export function standings(state: MatchState, rng: Rng, settings: Settings = DEFAULT_SETTINGS): PlayerState[] {
  const tiebreak = new Map(alivePlayers(state).map((p) => [p.id, rng()]));
  return alivePlayers(state).sort(
    (a, b) =>
      standingPoints(b, settings) - standingPoints(a, settings) ||
      a.stageThinkMs - b.stageThinkMs ||
      tiebreak.get(a.id)! - tiebreak.get(b.id)!,
  );
}

export interface StageEnd {
  state: MatchState;
  knockedOut: PlayerState[];
}

/**
 * Ends the current stage: the lowest scorers are knocked out and placed, scores
 * reset (or carry over), and the board list is shrunk by the caller via `keepBoards`.
 */
export function endStage(
  state: MatchState,
  rng: Rng,
  keepBoards: readonly number[],
  settings: Settings = DEFAULT_SETTINGS,
): StageEnd {
  const ranked = standings(state, rng, settings);
  const k = settings.knockoutsPerStage[state.stage] ?? 0;
  const out = new Set(ranked.slice(ranked.length - k).map((p) => p.id));
  // Placements for this stage's knockouts: the last-ranked player gets the worst place.
  const placement = new Map(ranked.map((p, i) => [p.id, i + 1]));
  const players = state.players.map((p) => {
    if (!p.alive) return p;
    if (out.has(p.id)) return { ...p, alive: false, outInStage: state.stage, placement: placement.get(p.id)! };
    return {
      ...p,
      stageScore: settings.scoresBetweenStages === "reset" ? 0 : p.stageScore,
      stageThinkMs: 0,
      stageRounds: 0,
      powerUps: p.powerUps + settings.powerUpsPerStage,
      lossesByStage: [...p.lossesByStage, []],
    };
  });
  const next: MatchState = { stage: state.stage + 1, round: 0, players, boards: [...keepBoards] };
  if (next.stage >= settings.knockoutsPerStage.length) {
    // Seeds from this stage's standings: 1 & 4 against 2 & 3, alternating 1, 2, 4, 3.
    const seeds = ranked.filter((p) => !out.has(p.id)).map((p) => p.id);
    if (seeds.length === 4) {
      const [s1, s2, s3, s4] = seeds as [string, string, string, string];
      next.final = { order: [s1, s2, s4, s3], teams: [[s1, s4], [s2, s3]], turn: 0 };
    }
  }
  return {
    state: next,
    knockedOut: ranked.filter((p) => out.has(p.id)).map((p) => ({ ...p, placement: placement.get(p.id)! })),
  };
}

/** True once the knockout stages are over and the 2v2 final is on. */
export const isFinal = (state: MatchState, settings: Settings = DEFAULT_SETTINGS) =>
  state.stage >= settings.knockoutsPerStage.length;

export const stageComplete = (state: MatchState, settings: Settings = DEFAULT_SETTINGS) =>
  state.round >= settings.roundsPerStage;

/** The finalist to move now. */
export const finalMover = (f: FinalState) => f.order[f.turn % f.order.length]!;

/** The final ends once everyone has made their moves (or the game ends: the caller checks the board). */
export const finalComplete = (state: MatchState, settings: Settings = DEFAULT_SETTINGS) =>
  !!state.final && state.final.turn >= state.final.order.length * settings.finalMovesPerPlayer;

/** A finalist's average loss per move in the final (lower is better). */
export const finalAverage = (p: Pick<PlayerState, "finalLosses">) =>
  p.finalLosses.length ? p.finalLosses.reduce((s, x) => s + x, 0) / p.finalLosses.length : Infinity;

/**
 * Places the finalists 1st to 4th by average loss in the final; a tie goes to
 * the team that won the game (`winningTeam`, 0 or 1, if it ended), then less
 * thinking time, then a coin flip.
 */
export function finishFinal(state: MatchState, rng: Rng, winningTeam: 0 | 1 | null = null): MatchState {
  const f = state.final!;
  const team = (id: string) => (f.teams[0].includes(id) ? 0 : 1);
  const coin = new Map(f.order.map((id) => [id, rng()]));
  const ranked = state.players
    .filter((p) => p.alive)
    .sort(
      (a, b) =>
        finalAverage(a) - finalAverage(b) ||
        (winningTeam === null ? 0 : (team(a.id) === winningTeam ? 0 : 1) - (team(b.id) === winningTeam ? 0 : 1)) ||
        a.stageThinkMs - b.stageThinkMs ||
        coin.get(a.id)! - coin.get(b.id)!,
    );
  const place = new Map(ranked.map((p, i) => [p.id, i + 1]));
  return {
    ...state,
    players: state.players.map((p) =>
      p.alive ? { ...p, alive: false, placement: place.get(p.id)!, outInStage: place.get(p.id) === 1 ? null : state.stage } : p,
    ),
  };
}

// ---- Boards ----

export interface BoardStatus {
  id: number;
  /** Side to move's expected score. */
  expected: number;
  gameOver: boolean;
}

/**
 * Why a board left play: its game ended mid-stage ("game_over"), or it was the
 * last board and had to be replaced with a fresh opening ("replaced").
 */
export type RetireReason = "game_over" | "replaced";

/**
 * When fewer boards are needed, keep the most balanced: finished games go
 * first, then the most lopsided (expected score furthest from 0.50).
 */
export function keepBoards(boards: readonly BoardStatus[], count: number): number[] {
  return [...boards]
    .sort((a, b) => Number(a.gameOver) - Number(b.gameOver) || Math.abs(a.expected - 0.5) - Math.abs(b.expected - 0.5) || a.id - b.id)
    .slice(0, count)
    .map((b) => b.id);
}

// ---- Bots ----

export interface Candidate {
  move: string;
  loss: number;
}

/**
 * A bot with skill T picks among the candidates with probability proportional
 * to exp(-loss / T); with a small chance it plays a random legal move instead.
 */
export function botPick(
  rng: Rng,
  candidates: readonly Candidate[],
  skill: number,
  legalMoves: readonly string[],
  settings: Settings = DEFAULT_SETTINGS,
): string {
  if (legalMoves.length && rng() < settings.botRandomMoveChance) return legalMoves[randomInt(rng, 0, legalMoves.length - 1)]!;
  if (!candidates.length) return legalMoves[randomInt(rng, 0, legalMoves.length - 1)]!;
  const weights = candidates.map((c) => Math.exp(-c.loss / Math.max(skill, 1e-6)));
  return candidates[weightedIndex(rng, weights)]!.move;
}

/**
 * A bot's move, using a power-up when it has one and the position is sharp
 * (the second-best candidate loses at least `botPowerUpLoss`): then it plays the best move.
 */
export function botChoose(
  rng: Rng,
  candidates: readonly Candidate[],
  bot: { skill: number | null; powerUps: number },
  legalMoves: readonly string[],
  settings: Settings = DEFAULT_SETTINGS,
): { move: string; usedPowerUp: boolean } {
  const sorted = [...candidates].sort((a, b) => a.loss - b.loss);
  if (bot.powerUps > 0 && sorted.length > 1 && sorted[1]!.loss >= settings.botPowerUpLoss) {
    return { move: sorted[0]!.move, usedPowerUp: true };
  }
  return { move: botPick(rng, candidates, bot.skill ?? 5, legalMoves, settings), usedPowerUp: false };
}

export function botThinkMs(rng: Rng, settings: Settings = DEFAULT_SETTINGS): number {
  const [lo, hi] = settings.botThinkSeconds;
  return Math.round((lo + rng() * (hi - lo)) * 1000);
}
