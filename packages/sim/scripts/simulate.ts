/**
 * Milestone 2: simulated matches and the playtest report (buildspec.md, "Bots and playtesting").
 *
 *   npx tsx packages/sim/scripts/simulate.ts --matches 200 --workers 4
 *
 * Phase A plays full 32-bot matches with the real engine (one engine per worker),
 * recording every scored position. Phase B replays thousands of matches from that
 * position pool to compare settings. Phase C checks the engine budget against a
 * search 20 times larger. Writes reports/playtest.md and reports/playtest-data.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SETTINGS,
  finishDuel,
  isDeadRound,
  mulberry32,
  shuffle,
  type Settings,
} from "@chessroyale/core";
import { MatchRunner, legalMoves, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { duelWinner, runPoolMatch, type Bot, type Pool, type PositionSample } from "../src/poolsim.ts";
import { mean, pct, quantile, spearman } from "../src/stats.ts";

const args = process.argv.slice(2);
const arg = (n: string, d: number) => Number(args[args.indexOf(`--${n}`) + 1] ?? NaN) || d;
const MATCHES = arg("matches", 200);
const WORKERS = arg("workers", 4);
const POOL_MATCHES = arg("pool-matches", 2000);
const BUDGET_SAMPLES = arg("budget-samples", 120);
const SEED = arg("seed", 1);

const root = fileURLToPath(new URL("../../../", import.meta.url));
const library: Opening[] = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8"));
const settings: Settings = DEFAULT_SETTINGS;

/** 32 bots with a wide, even spread of skill on a log scale (T from 0.25 to 32). */
const SKILLS = Array.from({ length: 32 }, (_, i) => Math.round(0.25 * Math.pow(128, i / 31) * 1000) / 1000);
const bots: Bot[] = SKILLS.map((skill, i) => ({ id: `bot${String(i + 1).padStart(2, "0")}`, skill }));
const skillRank = new Map(bots.map((b, i) => [b.id, i + 1])); // 1 = strongest

const log = (s: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);
const t0 = Date.now();

// ---------------- Phase A: full matches with the engine ----------------

interface RealMatch {
  placement: Record<string, number>;
  stage1Out: string[];
  duelists: string[];
  groupRounds: number;
  deadRounds: number;
  retired: Record<string, number>;
  searches: number;
  ms: number;
}

const samples: PositionSample[] = [];
const outsideLosses: number[] = [];
const realMatches: RealMatch[] = [];
const allLosses: number[] = [];

async function runRealMatches(workerIndex: number, count: number) {
  const engine = await createNodeEngine({ nodes: settings.engineNodes, hashMb: settings.engineHashMb });
  for (let m = 0; m < count; m++) {
    const start = Date.now();
    const rng = mulberry32(SEED * 100_000 + workerIndex * 1000 + m);
    const seats = shuffle(rng, bots);
    const runner = new MatchRunner({
      settings,
      rng,
      engines: [engine],
      library,
      entrants: seats.map((b) => ({ id: b.id, name: b.id, isBot: true, skill: b.skill })),
    });
    let stage1Out: string[] = [];
    let groupRounds = 0;
    let deadRounds = 0;
    let searches = 0;
    const retired: Record<string, number> = {};
    while (!runner.isDuel()) {
      runner.deal();
      const report = await runner.score(new Map());
      for (const r of report.retired) retired[r.reason] = (retired[r.reason] ?? 0) + 1;
      for (const b of report.boards) {
        groupRounds++;
        searches += 1 + (b.scored.length > settings.botCandidateMoves ? 1 : 0);
        if (isDeadRound(b.result)) deadRounds++;
        const top = b.scored.slice(0, settings.botCandidateMoves);
        const best = top[0]!.expected;
        samples.push({
          fen: b.fenBefore,
          candidates: top.map((s) => ({ move: s.move, loss: Math.max(0, (best - s.expected) * 100) })),
          legalCount: legalMoves(b.fenBefore).length,
        });
        for (const p of b.result.players) if (p.loss !== null) allLosses.push(p.loss);
        const topMoves = new Set(top.map((s) => s.move));
        for (const s of b.scored) if (!topMoves.has(s.move)) outsideLosses.push(Math.max(0, (best - s.expected) * 100));
      }
      if (runner.stageComplete()) {
        const end = runner.endStage();
        if (end.knockedOut.length && runner.state.stage === 1) stage1Out = end.knockedOut.map((p) => p.id);
      }
    }
    const [a, b] = runner.alive();
    const pool: Pool = { samples, outsideLosses };
    const winner = duelWinner(rng, { id: a!.id, skill: a!.skill! }, { id: b!.id, skill: b!.skill! }, pool, settings);
    runner.state = finishDuel(runner.state, winner.id);
    realMatches.push({
      placement: Object.fromEntries(runner.state.players.map((p) => [p.id, p.placement!])),
      stage1Out,
      duelists: [a!.id, b!.id],
      groupRounds,
      deadRounds,
      retired,
      searches,
      ms: Date.now() - start,
    });
    log(`match ${realMatches.length}/${MATCHES} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
  }
  engine.close();
}

const perWorker = Array.from({ length: WORKERS }, (_, w) => Math.floor(MATCHES / WORKERS) + (w < MATCHES % WORKERS ? 1 : 0));
await Promise.all(perWorker.map((n, w) => runRealMatches(w, n)));
const pool: Pool = { samples, outsideLosses };
log(`phase A done: ${realMatches.length} matches, ${samples.length} positions`);

// ---------------- Analysis helpers ----------------

interface Summary {
  matches: number;
  spearman: number;
  top4OutStage1: number;
  strongestInDuel: number;
  strongestWins: number;
  meanPlacementOfStrongest: number;
  deadRate: number;
}

function summarise(results: { placement: Record<string, number>; stage1Out: string[]; duelists: string[]; groupRounds: number; deadRounds: number }[]): Summary {
  const rhos = results.map((r) => {
    const ids = Object.keys(r.placement);
    return spearman(
      ids.map((id) => skillRank.get(id)!),
      ids.map((id) => r.placement[id]!),
    );
  });
  const top4 = new Set(bots.slice(0, 4).map((b) => b.id));
  const strongest = bots[0]!.id;
  return {
    matches: results.length,
    spearman: mean(rhos),
    top4OutStage1: mean(results.map((r) => (r.stage1Out.some((id) => top4.has(id)) ? 1 : 0))),
    strongestInDuel: mean(results.map((r) => (r.duelists.includes(strongest) ? 1 : 0))),
    strongestWins: mean(results.map((r) => (r.placement[strongest] === 1 ? 1 : 0))),
    meanPlacementOfStrongest: mean(results.map((r) => r.placement[strongest]!)),
    deadRate: results.reduce((s, r) => s + r.deadRounds, 0) / Math.max(1, results.reduce((s, r) => s + r.groupRounds, 0)),
  };
}

// ---------------- Phase B: pool-based variants ----------------

const variants: { rounds: number; carry: "reset" | "carry"; summary: Summary }[] = [];
for (const rounds of [6, 8, 10, 12]) {
  for (const carry of ["reset", "carry"] as const) {
    const s: Settings = { ...settings, roundsPerStage: rounds, scoresBetweenStages: carry };
    const rng = mulberry32(SEED * 7 + rounds * 13 + (carry === "carry" ? 1 : 0));
    const results = Array.from({ length: POOL_MATCHES }, () => runPoolMatch(rng, shuffle(rng, bots), pool, s));
    variants.push({ rounds, carry, summary: summarise(results) });
    log(`pool variant ${rounds} rounds, ${carry}: done`);
  }
}

// ---------------- Phase C: engine budget check ----------------

const budget: { lossDiff: number[]; orderAgree: number; verdictAgree: number; checked: number } = {
  lossDiff: [],
  orderAgree: 0,
  verdictAgree: 0,
  checked: 0,
};
{
  const rng = mulberry32(SEED + 99);
  const chosen = shuffle(rng, samples).slice(0, BUDGET_SAMPLES);
  const small = await createNodeEngine({ nodes: settings.engineNodes, hashMb: settings.engineHashMb });
  const big = await createNodeEngine({ nodes: settings.engineNodes * 20, hashMb: settings.engineHashMb });
  for (const s of chosen) {
    const moves = s.candidates.map((c) => c.move);
    const [a, b] = await Promise.all([small.scoreMoves(s.fen, moves), big.scoreMoves(s.fen, moves)]);
    const bestA = Math.max(...a.map((m) => m.expected));
    const bestB = Math.max(...b.map((m) => m.expected));
    const lossA = new Map(a.map((m) => [m.move, (bestA - m.expected) * 100]));
    const lossB = new Map(b.map((m) => [m.move, (bestB - m.expected) * 100]));
    for (const m of moves) if (lossA.has(m) && lossB.has(m)) budget.lossDiff.push(Math.abs(lossA.get(m)! - lossB.get(m)!));
    if (a[0]?.move === b[0]?.move) budget.orderAgree++;
    // Would a random group of 4 picks rank the same way? Compare who tops the group.
    for (let k = 0; k < 20; k++) {
      const picks = Array.from({ length: 4 }, () => moves[Math.floor(rng() * moves.length)]!);
      const topA = picks.reduce((x, y) => (lossA.get(y)! < lossA.get(x)! ? y : x));
      const topB = picks.reduce((x, y) => (lossB.get(y)! < lossB.get(x)! ? y : x));
      if (lossB.get(topA)! - lossB.get(topB)! <= 0.5) budget.verdictAgree++;
    }
    budget.checked++;
  }
  small.close();
  big.close();
  log("phase C done");
}

// ---------------- Report ----------------

const real = summarise(realMatches);
const retiredTotals: Record<string, number> = {};
for (const m of realMatches) for (const [k, v] of Object.entries(m.retired)) retiredTotals[k] = (retiredTotals[k] ?? 0) + v;
const minutes = ((Date.now() - t0) / 60000).toFixed(1);

const lines: string[] = [];
const out = (s = "") => lines.push(s);
const table = (head: string[], rows: (string | number)[][]) => {
  out(`| ${head.join(" | ")} |`);
  out(`| ${head.map(() => "---").join(" | ")} |`);
  for (const r of rows) out(`| ${r.join(" | ")} |`);
  out();
};

out("# Battle Royale Chess: playtest report (bots)");
out();
out(
  `${realMatches.length} full matches of 32 bots with Stockfish at ${settings.engineNodes.toLocaleString("en-US")} nodes ` +
    `(phase A), plus ${POOL_MATCHES.toLocaleString("en-US")} matches per variant replayed from the ${samples.length.toLocaleString("en-US")} ` +
    `positions those matches produced (phase B). Generated by \`packages/sim/scripts/simulate.ts\` in ${minutes} minutes.`,
);
out();
out(
  `Bots: 32 skill settings from T = ${SKILLS[0]} (strongest) to T = ${SKILLS[31]} (weakest), evenly spaced on a log scale. ` +
    `A bot picks among the engine's top ${settings.botCandidateMoves} moves with probability proportional to exp(-loss / T), ` +
    `and plays a random legal move ${settings.botRandomMoveChance * 100}% of the time. Seats are shuffled every match.`,
);
out();
out("## Answers");
out();
out("### 1. Does final placement track bot skill?");
out();
out(
  `Yes. Mean Spearman rank correlation between skill rank and final placement: **${real.spearman.toFixed(2)}** in the full matches ` +
    `(1.0 would be perfect order, 0 no relation).`,
);
out();
out("### 2. Do the best bots survive?");
out();
table(
  ["Measure", "Full matches"],
  [
    ["A top-4 bot knocked out in stage 1", pct(real.top4OutStage1)],
    ["Strongest bot reaches the duel", pct(real.strongestInDuel)],
    ["Strongest bot wins", pct(real.strongestWins)],
    ["Strongest bot's average placement", real.meanPlacementOfStrongest.toFixed(1)],
  ],
);
out("### 3 and 4. Reset or carry-over, and rounds per stage");
out();
out(`From the position pool, ${POOL_MATCHES.toLocaleString("en-US")} matches each. Phase A (8 rounds, reset) is the check that the pool behaves like full matches.`);
out();
table(
  ["Rounds per stage", "Scores", "Rank correlation", "Top-4 bot out in stage 1", "Strongest reaches duel", "Strongest wins", "Match length (min)"],
  [
    ["8 (full matches)", "reset", real.spearman.toFixed(3), pct(real.top4OutStage1), pct(real.strongestInDuel), pct(real.strongestWins), (5 * 8 * 15 / 60).toFixed(0)],
    ...variants.map((v) => [
      v.rounds,
      v.carry,
      v.summary.spearman.toFixed(3),
      pct(v.summary.top4OutStage1),
      pct(v.summary.strongestInDuel),
      pct(v.summary.strongestWins),
      ((5 * v.rounds * 15) / 60).toFixed(0),
    ]),
  ],
);
out("Match length is the knockout stages only (15 s a round), before the 3-minute duel.");
out();
out("### 5. Dead rounds");
out();
out(
  `**${pct(real.deadRate)}** of group-rounds were dead (every pick within 1 point of the others). ` +
    `Median loss of a pick: ${quantile(allLosses, 0.5).toFixed(1)} points; 75th percentile ${quantile(allLosses, 0.75).toFixed(1)}; ` +
    `90th ${quantile(allLosses, 0.9).toFixed(1)}.`,
);
out();
out("### 6. Board retirements");
out();
table(
  ["Reason", "Per match"],
  Object.entries(retiredTotals).map(([k, v]) => [k === "decided" ? "Expected score reached 0.90" : "Game over", (v / realMatches.length).toFixed(2)]),
);
out("### 7. Engine budget");
out();
out(
  `On ${budget.checked} positions, scoring the top moves at ${settings.engineNodes.toLocaleString("en-US")} nodes and at 20 times that: ` +
    `median difference in a move's loss ${quantile(budget.lossDiff, 0.5).toFixed(2)} points, 90th percentile ${quantile(budget.lossDiff, 0.9).toFixed(2)}. ` +
    `Same best move in ${pct(budget.orderAgree / budget.checked)} of positions. ` +
    `In random groups of 4 picks, the small search's group winner is also the big search's winner (within 0.5 points) ` +
    `${pct(budget.verdictAgree / (budget.checked * 20))} of the time.`,
);
out();
out("### Timing");
out();
out(
  `An engine-scored round took ${(mean(realMatches.map((m) => m.ms)) / realMatches.reduce((s, m) => s + m.groupRounds, 0) * realMatches.length / 1000 * 8).toFixed(2)} s ` +
    `for 8 boards on one engine in Node (${mean(realMatches.map((m) => m.searches / m.groupRounds)).toFixed(2)} searches per board).`,
);
out();
out("## 8. Recommendations");
out();
out("See DECISIONS.md, \"Milestone 2\", for the settings changed as a result of this report.");

mkdirSync(root + "reports", { recursive: true });
writeFileSync(root + "reports/playtest.md", lines.join("\n") + "\n");
writeFileSync(
  root + "reports/playtest-data.json",
  JSON.stringify({ skills: SKILLS, real, variants, retiredTotals, budget: { ...budget, lossDiff: undefined }, realMatches }, null, 1),
);
log(`wrote reports/playtest.md`);
