/**
 * Eric, Nov 2 ("in 50v50 why do all the bots on my team play the same moves?"; "the goal should be unique lines
 * favored over optimal play"): bot-only Crowd 50 v 50 games through the real runner (100 bots, botRoster's ratings),
 * the first `plies` team turns of each. Per turn: how the team's picks spread, whether the plurality was the engine's
 * best, where the played move ranks among the engine's lines, and blunders; per game: its moves, for how soon games
 * from the same start part ways and how many distinct positions there are by move 10 and 20.
 *
 *   npx tsx packages/sim/scripts/crowd-spread-probe.ts [games=16] [plies=40] [start=normal|random] [seed=1] [par=4] [bots=now|before|probe] [key=value ...]
 *
 * `before`: the bots and the played move as they were until Nov 2 (crowdBots off, the most popular pick played).
 * `probe`: 100 bots at temperatures spread over 4 to 1024 (BOT_LOBBY.skillAt's fit: points given away a move by
 * temperature, under this probe's positions). `key=value`: a CROWD_BOTS number for this run (e.g. blunderWeight=0.3).
 * Writes a summary to stdout (and the raw turns to reports/crowd-spread/<bots>-<start>-<seed>.jsonl).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CROWD_BOTS, CROWD_START, DEFAULT_SETTINGS, botRatingOf, botSkillSpread, modeSettings, mulberry32, shuffle, type CrowdBotSpread, type Settings } from "@chessroyale/core";
import { MatchRunner, botRoster, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];

interface Turn {
  ply: number;
  fen: string;
  /** The engine's lines, best first: move and loss. */
  lines: { move: string; loss: number }[];
  /** The team's picks: move -> count. */
  counts: Record<string, number>;
  played: string;
  playedLoss: number;
  /** Each bot's pick's loss, with its rating. */
  bots: { rating: number; loss: number }[];
}

async function game(seed: number, plies: number, start: string, kind: string, spread: CrowdBotSpread, engine: Awaited<ReturnType<typeof createNodeEngine>>) {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...modeSettings("crowd"),
    engineNodes: 100_000,
    crowdStart: start as Settings["crowdStart"],
    ...(start === "random" ? { openingMoves: CROWD_START.randomOpeningMoves } : {}),
    ...(kind === "before" ? { crowdBots: undefined, crowdPlayedFromTop: 1 } : { crowdBots: spread }),
  };
  // The lobby's bots (the same names, so the same ratings) every game; only the match's draws differ. The probe: its
  // temperatures (recorded as the "rating").
  const rng = mulberry32(9000 + seed);
  const bots =
    kind === "probe"
      ? shuffle(mulberry32(seed), botSkillSpread(100, { ...settings, botSkillRange: [4, 1024] })).map((skill, i) => ({ id: `bot${i}`, name: `B${i}`, isBot: true, skill }))
      : botRoster(mulberry32(1), 100, settings);
  const rating = new Map(bots.map((b) => [b.id, kind === "probe" ? b.skill : botRatingOf(b.name)]));
  const runner = new MatchRunner({ settings, rng, engines: [engine], library, entrants: bots });
  const turns: Turn[] = [];
  const moves: string[] = [];
  let startFen = "";
  while (!runner.isOver() && turns.length < plies) {
    runner.deal();
    runner.prefetch();
    const report = await runner.score(new Map());
    const b = report.boards[0];
    if (!b) break;
    if (!startFen) startFen = b.fenBefore;
    const counts: Record<string, number> = {};
    const botLosses: Turn["bots"] = [];
    for (const p of b.result.players) {
      if (!p.move) continue;
      counts[p.move] = (counts[p.move] ?? 0) + 1;
      botLosses.push({ rating: rating.get(p.playerId) ?? 0, loss: p.loss ?? 0 });
    }
    const played = b.result.playedMove;
    turns.push({
      ply: turns.length,
      fen: b.fenBefore,
      lines: b.scored.map((s) => ({ move: s.move, loss: Math.round(s.loss * 10) / 10 })),
      counts,
      played,
      playedLoss: b.scored.find((s) => s.move === played)?.loss ?? 0,
      bots: botLosses,
    });
    moves.push(played);
    if (runner.stageComplete()) {
      if (runner.isFinal()) runner.finishFinal();
      else runner.endStage();
    }
  }
  return { seed, startFen, moves, turns };
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

async function main() {
  const args = process.argv.slice(2);
  const [gamesArg = "16", pliesArg = "40", start = "normal", seedArg = "1", parArg = "4", bots = "now"] = args.filter((a) => !a.includes("="));
  const spread = { ...CROWD_BOTS } as Record<string, unknown>;
  for (const a of args.filter((x) => x.includes("="))) {
    const [k, v] = a.split("=") as [string, string];
    spread[k] = v.includes(",") ? v.split(",").map(Number) : Number(v);
  }
  const games = Number(gamesArg);
  const plies = Number(pliesArg);
  const seed0 = Number(seedArg);
  const par = Number(parArg);
  const engines = await Promise.all(Array.from({ length: par }, () => createNodeEngine({ nodes: 100_000, hashMb: 16 })));
  const out: Awaited<ReturnType<typeof game>>[] = [];
  let next = 0;
  await Promise.all(
    engines.map(async (e) => {
      while (next < games) {
        const g = seed0 + next++;
        out.push(await game(g, plies, start, bots, spread as unknown as CrowdBotSpread, e));
        process.stderr.write(".");
      }
    }),
  );
  process.stderr.write("\n");
  for (const e of engines) e.close();
  mkdirSync(root + "reports/crowd-spread/", { recursive: true });
  writeFileSync(root + `reports/crowd-spread/${bots}-${start}-${seed0}.jsonl`, out.map((g) => JSON.stringify(g)).join("\n") + "\n");

  const turns = out.flatMap((g) => g.turns);
  const BLUNDER = 15;
  let pluralBest = 0;
  let unanimousish = 0;
  let playedTop3 = 0;
  let playedBest = 0;
  let playedBlunder = 0;
  let pickBlunders = 0;
  let picks = 0;
  let distinctSum = 0;
  let topShareSum = 0;
  const rankCounts = new Map<number, number>();
  for (const t of turns) {
    const sorted = Object.entries(t.counts).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, n]) => s + n, 0);
    const bestMove = t.lines[0]?.move;
    if (sorted[0]?.[0] === bestMove) pluralBest++;
    topShareSum += (sorted[0]?.[1] ?? 0) / Math.max(1, total);
    if ((sorted[0]?.[1] ?? 0) / Math.max(1, total) >= 0.8) unanimousish++;
    distinctSum += sorted.length;
    const rank = t.lines.findIndex((l) => l.move === t.played);
    rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
    if (rank >= 0 && rank < 3) playedTop3++;
    if (rank === 0) playedBest++;
    if (t.playedLoss >= BLUNDER) playedBlunder++;
    for (const b of t.bots) {
      picks++;
      if (b.loss >= BLUNDER) pickBlunders++;
    }
  }
  const n = turns.length;
  console.log(`## ${bots}: ${games} games, ${start} start, ${plies} plies (${n} team turns)`);
  console.log(`- plurality = engine best: ${pct(pluralBest / n)}`);
  console.log(`- plurality's share of the team's picks (avg): ${pct(topShareSum / n)}; turns with one move >= 80%: ${pct(unanimousish / n)}`);
  console.log(`- distinct moves picked per turn (avg): ${(distinctSum / n).toFixed(1)}`);
  console.log(`- played move = engine best: ${pct(playedBest / n)}; a top-3 line: ${pct(playedTop3 / n)}; played loss >= ${BLUNDER}: ${pct(playedBlunder / n)}`);
  console.log(`- played move's rank: ${[...rankCounts.entries()].sort((a, b) => a[0] - b[0]).map(([r, c]) => `${r < 0 ? "outside" : r + 1}: ${c}`).join(", ")}`);
  console.log(`- bot picks with loss >= ${BLUNDER}: ${pct(pickBlunders / picks)}`);
  // Average loss per rating (the bots' strength).
  const byRating = new Map<number, { sum: number; n: number; blunders: number }>();
  for (const t of turns) for (const b of t.bots) {
    const r = byRating.get(b.rating) ?? { sum: 0, n: 0, blunders: 0 };
    r.sum += b.loss;
    r.n++;
    if (b.loss >= BLUNDER) r.blunders++;
    byRating.set(b.rating, r);
  }
  const bands = bots === "probe" ? [[4, 5.99], [6, 7.99], [8, 10.99], [11, 15.99], [16, 22.99], [23, 31.99], [32, 44.99], [45, 63.99], [64, 89.99], [90, 127.99], [128, 255.99], [256, 1024]] : [[0, 799], [800, 1099], [1100, 1399], [1400, 1699], [1700, 9999]];
  console.log(`- average loss a pick by rating: ${bands.map(([lo, hi]) => {
    let s = 0, c = 0, bl = 0;
    for (const [r, v] of byRating) if (r >= lo! && r <= hi!) { s += v.sum; c += v.n; bl += v.blunders; }
    return `${lo}-${hi === 9999 ? "" : hi}: ${c ? (s / c).toFixed(2) : "-"} (${c ? pct(bl / c) : "-"} blunders)`;
  }).join(", ")}`);
  if (bots !== "probe") console.log(`- per rating: ${[...byRating.entries()].sort((a, b) => a[0] - b[0]).map(([r, v]) => `${r}: ${(v.sum / v.n).toFixed(2)} (${v.n})`).join(", ")}`);
  // Unique lines: games from the same start.
  const sameStart = new Map<string, string[][]>();
  for (const g of out) sameStart.set(g.startFen, [...(sameStart.get(g.startFen) ?? []), g.moves]);
  const groups = [...sameStart.values()].filter((gs) => gs.length > 1);
  if (groups.length) {
    const firstSplit: number[] = [];
    const distinctAt = (ply: number) => groups.reduce((s, gs) => s + new Set(gs.filter((m) => m.length >= ply).map((m) => m.slice(0, ply).join(" "))).size, 0);
    const gamesAt = (ply: number) => groups.reduce((s, gs) => s + gs.filter((m) => m.length >= ply).length, 0);
    for (const gs of groups) for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) {
      let k = 0;
      while (k < gs[i]!.length && k < gs[j]!.length && gs[i]![k] === gs[j]![k]) k++;
      firstSplit.push(k);
    }
    firstSplit.sort((a, b) => a - b);
    const avg = firstSplit.reduce((s, x) => s + x, 0) / firstSplit.length;
    console.log(`- same start: ${groups.reduce((s, g) => s + g.length, 0)} games; two games part ways at ply ${avg.toFixed(1)} on average (median ${firstSplit[firstSplit.length >> 1]})`);
    for (const ply of [4, 10, 20, 40]) if (gamesAt(ply)) console.log(`  - distinct lines by ply ${ply} (move ${ply / 2}): ${distinctAt(ply)} of ${gamesAt(ply)} games`);
  }
  const playedLoss = turns.reduce((s, t) => s + t.playedLoss, 0) / n;
  console.log(`- the played move's loss (avg): ${playedLoss.toFixed(2)}; spread: ${JSON.stringify(spread)}`);
}

main().then(() => process.exit(0));
