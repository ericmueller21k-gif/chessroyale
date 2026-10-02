import {
  alivePlayers,
  applyRound,
  assignGroups,
  botPick,
  botThinkMs,
  createMatch,
  endStage,
  finishFinal,
  outcomesFromGroup,
  scoreGroup,
  stagePlan,
  isDeadRound,
  type Candidate,
  type Rng,
  type Settings,
} from "@chessroyale/core";

/**
 * A fast stand-in for a full match: every round, each group gets a position
 * drawn from a pool recorded in real engine-scored matches, so no engine runs.
 * Used to compare settings (rounds per stage, reset vs carry-over) over
 * thousands of matches.
 */
export interface PositionSample {
  fen: string;
  /** Top moves with loss in points versus the best (loss 0 first). */
  candidates: Candidate[];
  legalCount: number;
}

export interface Pool {
  samples: PositionSample[];
  /** Losses of picks that fell outside the top candidates (random moves). */
  outsideLosses: number[];
}

export interface Bot {
  id: string;
  skill: number;
}

/** A random legal move: a top candidate with probability (candidates / legal moves), else an outside loss. */
function randomMoveLoss(rng: Rng, s: PositionSample, pool: Pool): { move: string; loss: number } {
  if (rng() < s.candidates.length / Math.max(s.legalCount, s.candidates.length) || !pool.outsideLosses.length) {
    const c = s.candidates[Math.floor(rng() * s.candidates.length)]!;
    return { move: c.move, loss: c.loss };
  }
  const k = Math.floor(rng() * pool.outsideLosses.length);
  return { move: `outside-${k}`, loss: pool.outsideLosses[k]! };
}

export function botMove(rng: Rng, s: PositionSample, skill: number, pool: Pool, settings: Settings) {
  if (rng() < settings.botRandomMoveChance) return randomMoveLoss(rng, s, pool);
  const move = botPick(rng, s.candidates, skill, [], { ...settings, botRandomMoveChance: 0 });
  return { move, loss: s.candidates.find((c) => c.move === move)!.loss };
}

/** Duel stand-in: each finalist plays `moves` sampled positions; lower average loss wins (as for a drawn duel). */
export function duelWinner(rng: Rng, a: Bot, b: Bot, pool: Pool, settings: Settings, moves = 40): Bot {
  let la = 0;
  let lb = 0;
  for (let i = 0; i < moves; i++) {
    const s = pool.samples[Math.floor(rng() * pool.samples.length)]!;
    la += botMove(rng, s, a.skill, pool, settings).loss;
    lb += botMove(rng, s, b.skill, pool, settings).loss;
  }
  return la < lb || (la === lb && rng() < 0.5) ? a : b;
}

export interface MatchOutcome {
  /** Final placement by bot id (1 = winner). */
  placement: Record<string, number>;
  stage1Out: string[];
  duelists: string[];
  groupRounds: number;
  deadRounds: number;
}

export function runPoolMatch(rng: Rng, bots: readonly Bot[], pool: Pool, settings: Settings): MatchOutcome {
  const plan = stagePlan(settings);
  const skill = new Map(bots.map((b) => [b.id, b.skill]));
  let state = createMatch(
    bots.map((b) => ({ id: b.id, name: b.id, isBot: true, skill: b.skill })),
    plan[0]!.boards ? Array.from({ length: plan[0]!.boards }, (_, i) => i) : [],
  );
  let stage1Out: string[] = [];
  let groupRounds = 0;
  let deadRounds = 0;
  for (const stage of plan) {
    for (let r = 0; r < settings.roundsPerStage; r++) {
      const groups = assignGroups(rng, state, settings);
      const outcomes = [...groups.values()].flatMap((ids) => {
        const s = pool.samples[Math.floor(rng() * pool.samples.length)]!;
        const picks = ids.map((id) => ({ id, ...botMove(rng, s, skill.get(id)!, pool, settings) }));
        const expectedAfter = Object.fromEntries(picks.map((p) => [p.move, 0.5 - p.loss / 100]));
        const result = scoreGroup(
          picks.map((p) => ({ playerId: p.id, move: p.move })),
          { bestExpected: 0.5, bestMove: s.candidates[0]!.move, expectedAfter },
          rng,
          settings,
        );
        groupRounds++;
        if (isDeadRound(result)) deadRounds++;
        return outcomesFromGroup(result, Object.fromEntries(ids.map((id) => [id, botThinkMs(rng, settings)])));
      });
      state = applyRound(state, groups, outcomes);
    }
    const nextBoards = plan[stage.index + 1]?.boards ?? 1;
    const end = endStage(state, rng, Array.from({ length: nextBoards }, (_, i) => i), settings);
    if (stage.index === 0) stage1Out = end.knockedOut.map((p) => p.id);
    state = end.state;
  }
  // The 2v2 final: each finalist plays finalMovesPerPlayer moves; placement by average loss.
  const finalists = alivePlayers(state).map((p) => p.id);
  for (let t = 0; t < finalists.length * settings.finalMovesPerPlayer && state.final; t++) {
    const mover = state.final.order[t % state.final.order.length]!;
    const s = pool.samples[Math.floor(rng() * pool.samples.length)]!;
    const { loss } = botMove(rng, s, skill.get(mover)!, pool, settings);
    state = applyRound(state, new Map([[0, [mover]]]), [{ playerId: mover, roundScore: 0, loss, thinkMs: botThinkMs(rng, settings) }], settings);
  }
  state = finishFinal(state, rng);
  return {
    placement: Object.fromEntries(state.players.map((p) => [p.id, p.placement!])),
    stage1Out,
    duelists: finalists,
    groupRounds,
    deadRounds,
  };
}
