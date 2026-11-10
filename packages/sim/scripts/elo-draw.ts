/**
 * eloDraw's calibration (BOSS_CHECK.eloDrawScale; PR #611's delta review, D5): Stockfish at a strength drawn with a seed
 * (eloDraw: two devices play the same move) against UCI_LimitStrength's own draw, both through the boss's guard, on the
 * same positions at each strength. The loss of a move is in points of expected score (0-100) against the best, by the
 * boss engine's own top-8 search. Per Elo it prints UCI's mean loss a move, the seeded draw's at scale 1 (a real seeded
 * move per position, and the draw's exact expectation over seeds), and the scale on T that brings that expectation to UCI's.
 *
 *   npx tsx packages/sim/scripts/elo-draw.ts [positions=200] [uciSamples=3]
 *
 * Writes reports/elo-draw.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_SETTINGS, RAID_SETTINGS, lossForRating, mulberry32, shuffle } from "@chessroyale/core";
import { applyMove, bossGuardFrom, bossMoveFrom, fenAfter, gameEnd, legalMoves, moveLoss, withinGuard, type BossGuard, type MoveScore, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";

const N = Number(process.argv[2] ?? 200);
const SAMPLES = Number(process.argv[3] ?? 3);
const ELOS = [1600, 2200, 2500, 2800];
const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS };
const guard = bossGuardFrom(settings);
const nodes = settings.bossNodes;

// Positions: openings played on by Stockfish at a middling strength, one every 7 plies (4 a game).
const lib = JSON.parse(readFileSync("packages/chess/data/openings.json", "utf8")) as Opening[];
const gen = await createNodeEngine({ nodes: 30_000, hashMb: 16 });
const rng = mulberry32(11);
const positions: string[] = [];
for (const o of shuffle(rng, lib.filter((x) => x.moves.length >= 8))) {
  if (positions.length >= N) break;
  let fen = fenAfter(o.moves.slice(0, 8));
  try {
    for (let ply = 0; ply < 28 && positions.length < N; ply++) {
      if (gameEnd(fen, []) || !legalMoves(fen).length) break;
      if (ply % 7 === 3) positions.push(fen);
      fen = applyMove(fen, await gen.playAtElo(fen, 1800 + Math.floor(rng() * 800), 30_000));
    }
  } catch {
    // (A position Stockfish refuses: the next opening.)
  }
}
gen.close();
console.log(`${positions.length} positions`);

/** The guard's slip in place of a move past it (runner-tools' pickByLoss). */
function slip(top: readonly MoveScore[], g: BossGuard): string {
  const best = top[0]!.expected;
  const [lo, hi] = g.slipLoss;
  const mid = (lo + hi) / 2;
  const inRange = top.map((m) => ({ move: m.move, loss: moveLoss(best, m.expected) })).filter((m) => withinGuard(m.loss, g) && m.loss.points >= lo && m.loss.points <= hi);
  return inRange.length ? [...inRange].sort((a, b) => Math.abs(a.loss.points - mid) - Math.abs(b.loss.points - mid))[0]!.move : top[0]!.move;
}

interface PerElo { elo: number; uci: number[]; seeded: number[]; cands: { raw: number; after: number }[][] }

async function measure(elo: number): Promise<PerElo> {
  const engine = await createNodeEngine({ nodes, hashMb: 16 });
  const out: PerElo = { elo, uci: [], seeded: [], cands: [] };
  for (let i = 0; i < positions.length; i++) {
    const fen = positions[i]!;
    try {
      const ref = await engine.topMoves(fen, 8);
      if (!ref.length) continue;
      const best = ref[0]!.expected;
      const known = new Map(ref.map((m) => [m.move, m.expected]));
      const loss = async (move: string) => {
        if (!known.has(move)) known.set(move, (await engine.scoreMoves(fen, [move]))[0]?.expected ?? best);
        return moveLoss(best, known.get(move)!).points;
      };
      for (let s = 0; s < SAMPLES; s++) out.uci.push(await loss(await bossMoveFrom(engine, fen, elo, nodes, "elo", Math.random, settings.kingStrikeLoss, guard)));
      out.seeded.push(await loss(await bossMoveFrom(engine, fen, elo, nodes, "elo", mulberry32(1000 + i), settings.kingStrikeLoss, guard, null, undefined, null, null, true)));
      const fallback = slip(ref, guard);
      const cands: { raw: number; after: number }[] = [];
      for (const m of ref) cands.push({ raw: moveLoss(best, m.expected).points, after: await loss(withinGuard(moveLoss(best, m.expected), guard) ? m.move : fallback) });
      out.cands.push(cands);
    } catch {
      // (Stockfish refused it: skipped.)
    }
    if (i % 25 === 0) console.log(`${elo}: ${i}/${positions.length}`);
  }
  engine.close();
  return out;
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const se = (xs: readonly number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)) / Math.max(1, xs.length));
/** The seeded draw's exact mean loss over seeds, at a scale on T (eloDraw's weights exp(−loss ÷ T), then the guard). */
function expected(r: PerElo, scale: number): number {
  const t = Math.max(0.1, lossForRating(r.elo) * scale);
  return mean(
    r.cands.map((c) => {
      const w = c.map((x) => Math.exp(-x.raw / t));
      const sum = w.reduce((a, b) => a + b, 0);
      return c.reduce((a, x, i) => a + (w[i]! / sum) * x.after, 0);
    }),
  );
}

const results = await Promise.all(ELOS.map(measure));
const lines = [
  "# eloDraw against UCI_LimitStrength",
  "",
  `\`npx tsx packages/sim/scripts/elo-draw.ts ${N} ${SAMPLES}\`: ${positions.length} positions, Stockfish lite at ${nodes} nodes, the raid's guard, mean loss a move (points).`,
  "",
  "| Elo | T | UCI (± se) | seeded, scale 1: a move / exact | scale | seeded at scale (exact) |",
  "|---|---|---|---|---|---|",
];
for (const r of results) {
  const target = mean(r.uci);
  let [lo, hi] = [0.02, 4];
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (expected(r, mid) > target) hi = mid;
    else lo = mid;
  }
  const scale = (lo + hi) / 2;
  lines.push(`| ${r.elo} | ${lossForRating(r.elo).toFixed(2)} | ${target.toFixed(2)} ± ${se(r.uci).toFixed(2)} (${r.uci.length}) | ${mean(r.seeded).toFixed(2)} / ${expected(r, 1).toFixed(2)} | ${scale.toFixed(2)} | ${expected(r, scale).toFixed(2)} |`);
}
writeFileSync("reports/elo-draw.md", lines.join("\n") + "\n");
console.log(lines.join("\n"));
