/**
 * Calibrates the "engine rating" estimate. Stockfish's UCI_Elo mode (1320 to
 * 3190, anchored to CCRL ratings) picks moves in positions like the game's
 * boards; each pick is scored exactly as players' picks are (loss in points
 * against the top move at the game's engine budget). The average loss at each
 * rating gives the curve the app uses to turn a player's average loss into a
 * rating. Writes reports/rating-calibration.md and packages/core/src/rating-curve.ts.
 *
 *   npx tsx packages/sim/scripts/calibrate-rating.ts [positions=160]
 */
import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS, mulberry32, openingPlies, shuffle } from "@chessroyale/core";
import { applyMove, fenAfter, gameEnd, type Opening } from "@chessroyale/chess";
import { createNodeEngine, nodeTransport } from "@chessroyale/chess/node";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
const POSITIONS = Number(process.argv[2] ?? 160);
const LEVELS = [1320, 1600, 1900, 2200, 2500, 2800, 3190];
const settings = DEFAULT_SETTINGS;
const rng = mulberry32(7);

/** A Stockfish playing at a given UCI_Elo. */
async function limitedEngine(elo: number) {
  const t = nodeTransport();
  let waiting: { test: (l: string) => boolean; resolve: (l: string) => void } | null = null;
  t.onLine((l) => {
    if (waiting?.test(l)) {
      const w = waiting;
      waiting = null;
      w.resolve(l);
    }
  });
  const until = (test: (l: string) => boolean) => new Promise<string>((resolve) => (waiting = { test, resolve }));
  let r = until((l) => l === "uciok");
  t.send("uci");
  await r;
  for (const c of ["setoption name Threads value 1", `setoption name Hash value ${settings.engineHashMb}`, "setoption name UCI_LimitStrength value true", `setoption name UCI_Elo value ${elo}`]) t.send(c);
  r = until((l) => l === "readyok");
  t.send("isready");
  await r;
  return {
    async move(fen: string): Promise<string> {
      t.send("ucinewgame");
      const ready = until((l) => l === "readyok");
      t.send("isready");
      await ready;
      t.send(`position fen ${fen}`);
      const done = until((l) => l.startsWith("bestmove"));
      t.send(`go nodes ${settings.engineNodes}`);
      return (await done).split(" ")[1]!;
    },
    close: () => t.close(),
  };
}

const scorer = await createNodeEngine({ nodes: settings.engineNodes, hashMb: settings.engineHashMb });
const helper = await createNodeEngine({ nodes: 100_000, hashMb: settings.engineHashMb });
const players = await Promise.all(LEVELS.map(limitedEngine));

// Positions like the game's boards: an opening line, then a few good moves.
const fens: string[] = [];
for (const o of shuffle(rng, library)) {
  if (fens.length >= POSITIONS) break;
  const plies = rng() < 0.5 ? openingPlies(settings) : openingPlies(settings) + 1;
  if (o.moves.length < plies) continue;
  let fen = fenAfter(o.moves.slice(0, plies));
  const extra = Math.floor(rng() * 16);
  for (let i = 0; i < extra; i++) {
    const top = await helper.topMoves(fen, 3);
    if (!top.length) break;
    const next = applyMove(fen, top[Math.floor(rng() * top.length)]!.move);
    if (gameEnd(next, [])) break;
    fen = next;
  }
  fens.push(fen);
}

const losses = new Map<number, number[]>(LEVELS.map((l) => [l, []]));
for (const [i, fen] of fens.entries()) {
  const picks = await Promise.all(players.map((p) => p.move(fen)));
  const top = await scorer.topMoves(fen, settings.botCandidateMoves);
  const known = new Map(top.map((m) => [m.move, m.expected]));
  const missing = picks.filter((m) => !known.has(m));
  if (missing.length) for (const s of await scorer.scoreMoves(fen, missing)) known.set(s.move, s.expected);
  const best = Math.max(top[0]!.expected, ...picks.map((m) => known.get(m) ?? -1));
  picks.forEach((m, k) => losses.get(LEVELS[k]!)!.push(Math.max(0, (best - (known.get(m) ?? best)) * 100)));
  process.stdout.write(`position ${i + 1}/${fens.length}\r`);
}
scorer.close();
helper.close();
players.forEach((p) => p.close());

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const measured = LEVELS.map((elo) => ({ elo, meanLoss: mean(losses.get(elo)!) }));
// Smooth with a least-squares line through log(loss) against rating (the raw points are noisy), so the curve
// is strictly monotonic and extends sensibly below 1320 and above 3190.
const xm = mean(measured.map((m) => m.elo));
const ym = mean(measured.map((m) => Math.log(m.meanLoss)));
const slope =
  measured.reduce((s, m) => s + (m.elo - xm) * (Math.log(m.meanLoss) - ym), 0) / measured.reduce((s, m) => s + (m.elo - xm) ** 2, 0);
const fitted = (elo: number) => Math.exp(ym + slope * (elo - xm));
const curve = LEVELS.map((elo) => ({ elo, meanLoss: Math.round(fitted(elo) * 100) / 100 }));
writeFileSync(
  root + "packages/core/src/rating-curve.ts",
  `/**\n * Generated by packages/sim/scripts/calibrate-rating.ts: Stockfish's average loss per move at each UCI_Elo\n` +
    ` * setting, smoothed (log-linear fit). Raw measurements are in reports/rating-calibration.md.\n */\n` +
    `export const RATING_CURVE: readonly { elo: number; meanLoss: number }[] = ${JSON.stringify(curve, null, 2)};\n`,
);
const md = [
  "# Engine rating calibration",
  "",
  `Stockfish at each UCI_Elo setting (CCRL-anchored, 1320 to 3190) picked a move in ${fens.length} positions like the game's boards; each pick was scored as players' picks are (${settings.engineNodes.toLocaleString("en-US")}-node search, loss in points). Generated by \`packages/sim/scripts/calibrate-rating.ts\`.`,
  "",
  "The app uses the smoothed column: a straight line through log(loss) against rating, which also extends the scale below 1320 and above 3190.",
  "",
  "| UCI_Elo | Measured loss per move | Smoothed |",
  "| --- | --- | --- |",
  ...measured.map((m, i) => `| ${m.elo} | ${m.meanLoss.toFixed(2)} | ${curve[i]!.meanLoss.toFixed(2)} |`),
  "",
  "What a player's average loss per move maps to (before the early-match pull towards 1500):",
  "",
  "| Average loss | Rating |",
  "| --- | --- |",
  ...[2, 3, 5, 8, 12, 20].map((l) => `| ${l} | ${Math.round(xm + (Math.log(l) - ym) / slope)} |`),
  "",
];
writeFileSync(root + "reports/rating-calibration.md", md.join("\n"));
console.log("\n" + md.join("\n"));
