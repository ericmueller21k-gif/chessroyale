import { randomInt, shuffle, weightedIndex, type Rng } from "./rng.ts";
import type { GroupResult } from "./scoring.ts";
import { DEFAULT_SETTINGS, roundsInStage, type Settings } from "./settings.ts";

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
  /** Moves missed over the match (each counts as finalMissLoss in matchLoss). */
  misses?: number;
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
  /**
   * classic: a fixed number of moves each (finalMovesPerPlayer). team (Crowd 50 v 50): teamFinalSizes per
   * side, the weakest on each side going out after every step, the last step playing to the end. duel: 1v1 to the end.
   */
  format?: "classic" | "team" | "duel";
  /** Team final: index into teamFinalSizes, and the turn the current order started on. */
  step?: number;
  stepStart?: number;
  /** Team final: who went out, and after which turn. */
  out?: { id: string; turn: number }[];
}

/** Boss battle: the crowd (playing White) against Stockfish at `elo`. */
export interface BossState {
  elo: number;
  /** The side the crowd plays. */
  crowdSide: Side;
  /** The battle starts from this many moves (plies) into the game just played. */
  startPly?: number;
  /** Crowd moves made, and since the boss last struck. */
  crowdMoves: number;
  sinceKill: number;
  /** Who the boss struck down, after which crowd move. */
  kills: { id: string; atMove: number }[];
  /** How the battle ended (set at the end): the crowd won, the boss won, or a draw. */
  result?: "crowd" | "boss" | "draw";
  /** The King: charges left, and the crowd moves he played. */
  kingCharges?: number;
  kingMoves?: number[];
  /** The King struck the boss: its next move is a weaker one; and the crowd moves he struck during (1-based, like kingMoves). */
  staggerNext?: boolean;
  kingStrikes?: number[];
  /** Strikes stop with this many left (boss raid: half the group; 50 v 50: bossMinSurvivors). */
  minSurvivors?: number;
  /**
   * The God King's Last Stand (once per game): the crowd's disastrous move he took back, during which crowd move
   * (1-based, like kingMoves), what it gave away, the bar it crossed and the charges he fell with (they became
   * the crowd's power-ups). Set, he has fallen: no charges, no menu. For the results card: the position (`fen`,
   * before the move), the judge's best move there, the crowd's chances (expected score, 0-1) after the best move
   * and after the blunder, the boss's best reply and a forced mate it allowed (the boss's moves to mate).
   */
  lastStand?: {
    atMove: number;
    move: string;
    loss: number;
    bar: number;
    charges: number;
    fen?: string;
    bestMove?: string;
    before?: number;
    after?: number;
    reply?: string;
    mateIn?: number;
  };
  /** The re-pick after his Last Stand: this move (the one he took back) can't be picked. Cleared once it's played. */
  barred?: string;
}

/** The King's charges: the ten's leftover power-ups, one charge per kingPowerUpsPerCharge (rounded), 1 to kingChargesMax. */
export function kingCharges(powerUpsLeft: number, s: Pick<Settings, "kingPowerUpsPerCharge" | "kingChargesMax">): number {
  return Math.max(1, Math.min(s.kingChargesMax, Math.round(powerUpsLeft / s.kingPowerUpsPerCharge)));
}

export interface MatchState {
  stage: number;
  round: number;
  players: PlayerState[];
  /** Ids of the boards in play this stage. */
  boards: number[];
  /** Set once the knockout stages are over. */
  final?: FinalState;
  /** Set once the knockout stages are over in a boss battle. */
  boss?: BossState;
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
  /** Called the King instead of picking: counts as the round's average loss for the boss's strikes, and isn't a miss. */
  abstained?: boolean;
  neutralLoss?: number;
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
    const finalLosses = state.final || state.boss ? [...p.finalLosses, o.abstained ? (o.neutralLoss ?? 0) : (o.loss ?? settings.finalMissLoss)] : p.finalLosses;
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
      misses: (p.misses ?? 0) + (o.loss === null && !o.abstained ? 1 : 0),
      lossesByStage,
      lastBoard: board,
      lastGroupmates: board === null ? [] : groups.get(board)!.filter((id) => id !== p.id),
    };
  });
  return {
    ...state,
    players,
    round: state.round + 1,
    final: state.final && { ...state.final, turn: state.final.turn + 1 },
    boss: state.boss && { ...state.boss, crowdMoves: state.boss.crowdMoves + 1, sinceKill: state.boss.sinceKill + 1 },
  };
}

/**
 * A player's average loss per move over the whole match, a missed move counting
 * as finalMissLoss (lower is better; Infinity before any move). It's the steady
 * measure the late game ranks by, so one blunder (or one brilliant move) can't
 * decide alone.
 */
export function matchLoss(p: Pick<PlayerState, "lossesByStage" | "misses">, settings: Settings = DEFAULT_SETTINGS): number {
  const losses = p.lossesByStage.flat();
  const misses = p.misses ?? 0;
  const n = losses.length + misses;
  return n ? (losses.reduce((s, x) => s + x, 0) + misses * settings.finalMissLoss) / n : Infinity;
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
    ...(p.abstained ? { abstained: true, neutralLoss: result.averageLoss ?? 0 } : {}),
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
  const teams = isTeamMatch(settings);
  // Crowd 50 v 50: the bottom of each team goes, half the knockouts each, so the teams stay even.
  const out = new Set(
    teams
      ? (["w", "b"] as const).flatMap((side) => {
          const team = ranked.filter((p) => p.colour === side);
          return team.slice(team.length - Math.floor(k / 2)).map((p) => p.id);
        })
      : ranked.slice(ranked.length - k).map((p) => p.id),
  );
  // Placements for this stage's knockouts: they take the last k places, best of them first (the last-ranked gets the worst).
  const outRanked = ranked.filter((p) => out.has(p.id));
  const placement = new Map(outRanked.map((p, i) => [p.id, ranked.length - outRanked.length + i + 1]));
  const players = state.players.map((p) => {
    if (!p.alive) return p;
    if (out.has(p.id)) return { ...p, alive: false, outInStage: state.stage, placement: placement.get(p.id)! };
    return {
      ...p,
      stageScore: settings.scoresBetweenStages === "reset" ? 0 : p.stageScore,
      stageThinkMs: 0,
      stageRounds: 0,
      powerUps: Math.min(settings.powerUpsMax, p.powerUps + settings.powerUpsPerStage),
      lossesByStage: [...p.lossesByStage, []],
    };
  });
  const next: MatchState = { stage: state.stage + 1, round: 0, players, boards: [...keepBoards] };
  if (next.stage >= settings.knockoutsPerStage.length) {
    // Seeds from this stage's standings: 1 & 4 against 2 & 3, alternating 1, 2, 4, 3.
    const seeds = ranked.filter((p) => !out.has(p.id)).map((p) => p.id);
    const colourOf = new Map(ranked.map((p) => [p.id, p.colour]));
    const whites = seeds.filter((id) => colourOf.get(id) === "w");
    const blacks = seeds.filter((id) => colourOf.get(id) === "b");
    const [w1, w2] = whites;
    const [b1, b2] = blacks;
    if (teams && settings.finalFormat === "boss") {
      // The boss battle is set up by the runner (it needs a fresh board and the boss's strength).
    } else if (teams && settings.finalFormat === "duel" && w1 && b1) {
      next.final = { order: [w1, b1], teams: [[w1], [b1]], turn: 0, format: "duel" };
    } else if (teams && settings.finalFormat === "team" && whites.length && whites.length === blacks.length) {
      // Each team's survivors, best first, teammates taking turns for their side.
      next.final = { order: interleave(whites, blacks), teams: [whites, blacks], turn: 0, format: "team", step: 0, stepStart: 0, out: [] };
    } else if (teams && w1 && w2 && b1 && b2) {
      // Each team's top two play the final for their side (the runner puts the side to move first).
      next.final = { order: [w1, b1, w2, b2], teams: [[w1, w2], [b1, b2]], turn: 0, format: "classic" };
    } else if (seeds.length === 4) {
      const [s1, s2, s3, s4] = seeds as [string, string, string, string];
      next.final = { order: [s1, s2, s4, s3], teams: [[s1, s4], [s2, s3]], turn: 0, format: "classic" };
    }
  }
  return {
    state: next,
    knockedOut: ranked.filter((p) => out.has(p.id)).map((p) => ({ ...p, placement: placement.get(p.id)! })),
  };
}

/** Crowd 50 v 50: players keep one colour (their team) all match. */
export const isTeamMatch = (settings: Pick<Settings, "mode" | "crowdTeams">) => settings.mode === "crowd" && settings.crowdTeams;

/** True once the knockout stages are over and the 2v2 final is on. */
export const isFinal = (state: MatchState, settings: Settings = DEFAULT_SETTINGS) =>
  state.stage >= settings.knockoutsPerStage.length;

export const stageComplete = (state: MatchState, settings: Settings = DEFAULT_SETTINGS) =>
  state.round >= roundsInStage(settings, state.stage);

/** Turn order: a[0], b[0], a[1], b[1], ... */
export function interleave(a: readonly string[], b: readonly string[]): string[] {
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]]).flat().filter((x): x is string => !!x);
}

/** The finalist to move now. */
export const finalMover = (f: FinalState) => f.order[(f.turn - (f.stepStart ?? 0)) % f.order.length]!;

/** Plays to the end of the game (team final and duel), with finalMaxTurns as a safety cap. */
export const finalToTheEnd = (f: FinalState) => f.format === "team" || f.format === "duel";

/**
 * The final ends once everyone has made their moves (or the game ends: the
 * caller checks the board). A team final or duel plays to the end, up to the cap.
 */
export const finalComplete = (state: MatchState, settings: Settings = DEFAULT_SETTINGS) => {
  const f = state.final;
  if (!f) return false;
  if (finalToTheEnd(f)) return f.turn >= settings.finalMaxTurns;
  return f.turn >= f.order.length * settings.finalMovesPerPlayer;
};

/** Team final: turns left until the next step's cut (null on the last step, which plays to the end). */
export function teamFinalCutIn(f: FinalState, settings: Settings = DEFAULT_SETTINGS): number | null {
  if (f.format !== "team" || (f.step ?? 0) >= settings.teamFinalSizes.length - 1) return null;
  return Math.max(0, f.order.length * settings.teamFinalMovesPerStep - (f.turn - (f.stepStart ?? 0)));
}

/**
 * Team final: when a step's moves are done, the weakest player on each side
 * (by matchLoss) goes out, and the rest carry on with a shorter turn order.
 * Those out are placed just below the players still in. Returns who went out.
 */
export function teamFinalStep(state: MatchState, rng: Rng, settings: Settings = DEFAULT_SETTINGS): { state: MatchState; out: string[] } {
  const f = state.final;
  if (!f || teamFinalCutIn(f, settings) !== 0) return { state, out: [] };
  const coin = new Map(f.order.map((id) => [id, rng()]));
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const worse = (a: string, b: string) => matchLoss(byId.get(b)!, settings) - matchLoss(byId.get(a)!, settings) || coin.get(a)! - coin.get(b)!;
  const nextSize = settings.teamFinalSizes[(f.step ?? 0) + 1] ?? 1;
  const goes = f.teams.flatMap((t) => [...t].sort(worse).slice(0, Math.max(0, t.length - nextSize)));
  const out = new Set(goes);
  const teams: [string[], string[]] = [f.teams[0].filter((id) => !out.has(id)), f.teams[1].filter((id) => !out.has(id))];
  // They take the places just below everyone still in, the better of them first.
  const aliveAfter = state.players.filter((p) => p.alive && !out.has(p.id)).length;
  const placed = [...goes].sort((a, b) => worse(b, a));
  const placement = new Map(placed.map((id, i) => [id, aliveAfter + i + 1]));
  // teams[0] moved on even turns from the final's start, so the side to move now leads the new order.
  const first = f.turn % 2 === 0 ? 0 : 1;
  const order = first === 0 ? interleave(teams[0], teams[1]) : interleave(teams[1], teams[0]);
  return {
    out: goes,
    state: {
      ...state,
      players: state.players.map((p) => (out.has(p.id) ? { ...p, alive: false, outInStage: state.stage, placement: placement.get(p.id)! } : p)),
      final: { ...f, teams, order, step: (f.step ?? 0) + 1, stepStart: f.turn, out: [...(f.out ?? []), ...goes.map((id) => ({ id, turn: f.turn }))] },
    },
  };
}

/** A finalist's average loss per move in the final (lower is better). */
export const finalAverage = (p: Pick<PlayerState, "finalLosses">) =>
  p.finalLosses.length ? p.finalLosses.reduce((s, x) => s + x, 0) / p.finalLosses.length : Infinity;

/**
 * Places the finalists 1st to 4th by average loss in the final; a tie goes to
 * the team that won the game (`winningTeam`, 0 or 1, if it ended), then less
 * thinking time, then a coin flip.
 */
export function finishFinal(state: MatchState, rng: Rng, winningTeam: 0 | 1 | null = null, settings: Settings = DEFAULT_SETTINGS): MatchState {
  const f = state.final!;
  const team = (id: string) => (f.teams[0].includes(id) ? 0 : 1);
  const coin = new Map(f.order.map((id) => [id, rng()]));
  // Team final: by matchLoss (the whole game counts). Duel: the winner of the game first. Classic: by the final's moves.
  const quality = (p: PlayerState) => (finalToTheEnd(f) ? matchLoss(p, settings) : finalAverage(p));
  const duelWin = (p: PlayerState) => (f.format === "duel" && winningTeam !== null ? (team(p.id) === winningTeam ? 0 : 1) : 0);
  const ranked = state.players
    .filter((p) => p.alive)
    .sort(
      (a, b) =>
        duelWin(a) - duelWin(b) ||
        quality(a) - quality(b) ||
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

// ---- Boss battle ----

/**
 * The boss strikes after every bossKillEvery crowd moves, while more than bossMinSurvivors are left. Not between
 * the God King's Last Stand and the re-pick: the strike waits until the re-pick is played (and counts both rounds).
 */
export const bossKillDue = (state: MatchState, settings: Settings = DEFAULT_SETTINGS) =>
  !!state.boss && !state.boss.barred && state.boss.sinceKill >= settings.bossKillEvery && alivePlayers(state).length > (state.boss.minSurvivors ?? settings.bossMinSurvivors);

/**
 * The boss strikes down the player with the worst moves since its last strike
 * (most points lost over those moves, a miss counting as finalMissLoss); a tie
 * goes against the weaker player over the match. They take the last place still open.
 */
export function bossKill(state: MatchState, rng: Rng, settings: Settings = DEFAULT_SETTINGS): { state: MatchState; victim: string | null } {
  const boss = state.boss;
  if (!boss) return { state, victim: null };
  const alive = alivePlayers(state);
  const k = Math.max(1, boss.sinceKill);
  const recent = (p: PlayerState) => p.finalLosses.slice(-k).reduce((s, x) => s + x, 0);
  const coin = new Map(alive.map((p) => [p.id, rng()]));
  const victim = [...alive].sort((a, b) => recent(b) - recent(a) || matchLoss(b, settings) - matchLoss(a, settings) || coin.get(a.id)! - coin.get(b.id)!)[0];
  if (!victim) return { state, victim: null };
  const place = alive.length;
  return {
    victim: victim.id,
    state: {
      ...state,
      players: state.players.map((p) => (p.id === victim.id ? { ...p, alive: false, outInStage: state.stage, placement: place } : p)),
      boss: { ...boss, sinceKill: 0, kills: [...boss.kills, { id: victim.id, atMove: boss.crowdMoves }] },
    },
  };
}

/** Ends the boss battle: the survivors placed by matchLoss (they all share the result on their records). */
export function finishBoss(state: MatchState, rng: Rng, result: "crowd" | "boss" | "draw", settings: Settings = DEFAULT_SETTINGS): MatchState {
  const coin = new Map(state.players.map((p) => [p.id, rng()]));
  const ranked = alivePlayers(state).sort((a, b) => matchLoss(a, settings) - matchLoss(b, settings) || coin.get(a.id)! - coin.get(b.id)!);
  const place = new Map(ranked.map((p, i) => [p.id, i + 1]));
  return {
    ...state,
    boss: state.boss && { ...state.boss, result },
    players: state.players.map((p) => (p.alive ? { ...p, alive: false, placement: place.get(p.id)!, outInStage: place.get(p.id) === 1 ? null : state.stage } : p)),
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
