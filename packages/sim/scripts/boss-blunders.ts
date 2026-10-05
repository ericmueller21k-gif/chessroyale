/**
 * How often the boss gives material away: the boss (at a strength, with its slips and blunder guard) plays both
 * sides from 8 openings for 30 plies, and a judge engine scores each move against the best. Prints how many
 * moves lost more than N points (expected score, 0-100) and more than N in log-odds.
 *
 *   npx tsx packages/sim/scripts/boss-blunders.ts <elo>
 */
import { DEFAULT_SETTINGS, bossStumbleChance, mulberry32, shuffle } from "@chessroyale/core";
import { applyMove, bossGuardFrom, bossMoveFrom, fenAfter, gameEnd, legalMoves, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { readFileSync } from "node:fs";
const elo = Number(process.argv[2] ?? 1600);
const lib = JSON.parse(readFileSync("packages/chess/data/openings.json", "utf8")) as Opening[];
const judge = await createNodeEngine({ nodes: DEFAULT_SETTINGS.engineNodes, hashMb: 16 });
const boss = await createNodeEngine({ nodes: DEFAULT_SETTINGS.bossNodes, hashMb: 16 });
const rng = mulberry32(7);
const logit = (p: number) => { const q = Math.min(0.999, Math.max(0.001, p)); return Math.log(q / (1 - q)); };
const losses: { pts: number; lg: number; fenE: number }[] = [];
for (const o of shuffle(rng, lib.filter((x) => x.moves.length >= 8)).slice(0, 8)) {
  let fen = fenAfter(o.moves.slice(0, 8));
  for (let ply = 0; ply < 30; ply++) {
    if (gameEnd(fen, []) || !legalMoves(fen).length) break;
    const m = await bossMoveFrom(boss, fen, elo, DEFAULT_SETTINGS.bossNodes, rng() < bossStumbleChance(elo, DEFAULT_SETTINGS) ? "stumble" : "elo", rng, DEFAULT_SETTINGS.kingStrikeLoss, bossGuardFrom(DEFAULT_SETTINGS));
    const top = await judge.topMoves(fen, 1);
    const [s] = await judge.scoreMoves(fen, [m]);
    const best = top[0]!.expected, got = Math.min(best, s!.expected);
    losses.push({ pts: (best - got) * 100, lg: logit(best) - logit(got), fenE: best });
    fen = applyMove(fen, m);
  }
}
const n = losses.length;
for (const t of [5, 10, 15, 20, 30]) console.log(`loss>${t}pts: ${losses.filter((l) => l.pts > t).length}/${n}`);
for (const t of [0.5, 1, 1.5, 2, 3]) console.log(`logit>${t}: ${losses.filter((l) => l.lg > t).length}/${n}`);
console.log(losses.filter((l) => l.lg > 1).map((l) => `${l.pts.toFixed(0)}pts/${l.lg.toFixed(2)}lg@${l.fenE.toFixed(2)}`).join(" "));
judge.close(); boss.close();
