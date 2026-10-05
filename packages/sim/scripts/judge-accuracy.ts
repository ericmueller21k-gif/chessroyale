/**
 * How often the engine that scores picks misjudges them. Realistic positions (a classic opening, then 0-24 plies
 * of good-but-varied play) and realistic picks (the scorer's top 8, what players mostly choose, plus 4 random legal
 * moves, the blunders). Each pick's loss is measured by:
 *   - the game's scorer: the lite build at 250k nodes (what phones run today), and two upgrades (lite at 1M, full at 250k)
 *   - a referee: the full-network build, each move searched on its own at a much bigger budget.
 * Results go to reports/judge-accuracy/*.jsonl; `summary` writes reports/judge-accuracy.md.
 *
 *   npx tsx packages/sim/scripts/judge-accuracy.ts run <positions> <seed> [refNodes]
 *   npx tsx packages/sim/scripts/judge-accuracy.ts summary
 */
import { mulberry32, shuffle } from "@chessroyale/core";
import { applyMove, fenAfter, gameEnd, legalMoves, type Opening } from "@chessroyale/chess";
import { STOCKFISH_FULL_BUILD, createNodeEngine } from "@chessroyale/chess/node";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = root + "reports/judge-accuracy/";

async function run(count: number, seed: number, refNodes: number) {
  const rng = mulberry32(seed);
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const lite = await createNodeEngine({ nodes: 250_000, hashMb: 16 });
  const lite1m = await createNodeEngine({ nodes: 1_000_000, hashMb: 16 });
  const full = await createNodeEngine({ nodes: 250_000, hashMb: 16 }, STOCKFISH_FULL_BUILD);
  const ref = await createNodeEngine({ nodes: refNodes, hashMb: 64 }, STOCKFISH_FULL_BUILD);
  mkdirSync(out, { recursive: true });
  const file = `${out}seed${seed}.jsonl`;
  for (const o of shuffle(rng, library.filter((x) => x.moves.length >= 10)).slice(0, count)) {
    // A middlegame-ish position: the opening, then some plies of good but varied moves.
    let fen = fenAfter(o.moves.slice(0, 10));
    const extra = Math.floor(rng() * 25);
    for (let i = 0; i < extra && !gameEnd(fen, []); i++) {
      const top = await lite.topMoves(fen, 3);
      if (!top.length) break;
      fen = applyMove(fen, top[Math.floor(rng() * top.length)]!.move);
    }
    if (gameEnd(fen, []) || legalMoves(fen).length < 2) continue;
    const scorer = await lite.analyse(fen, [], 8);
    const randoms = shuffle(rng, legalMoves(fen).filter((m) => !scorer.moves.some((s) => s.move === m))).slice(0, 4);
    const picks = [...scorer.moves.map((m) => m.move), ...randoms];
    const judge = async (e: typeof lite) => {
      const a = await e.analyse(fen, picks, 8);
      const best = Math.max(a.best.expected, ...a.moves.map((m) => m.expected));
      return Object.fromEntries(picks.map((m) => [m, Math.max(0, (best - a.moves.find((x) => x.move === m)!.expected) * 100)]));
    };
    const [l, l1, f] = [await judge(lite), await judge(lite1m), await judge(full)];
    // The referee: every pick searched on its own (the position after it), plus its own best move.
    const refTop = await ref.topMoves(fen, 1);
    const after: Record<string, number> = {};
    for (const m of picks) {
      const next = applyMove(fen, m);
      const end = gameEnd(next, []);
      after[m] = end === "checkmate" ? 1 : end ? 0.5 : 1 - ((await ref.topMoves(next, 1))[0]?.expected ?? 0.5);
    }
    const refBest = Math.max(refTop[0]!.expected, ...Object.values(after));
    const r = Object.fromEntries(picks.map((m) => [m, Math.max(0, (refBest - after[m]!) * 100)]));
    appendFileSync(file, JSON.stringify({ fen, picks, randoms, lite: l, lite1m: l1, full: f, ref: r }) + "\n");
    console.log(`${fen}  done`);
  }
  for (const e of [lite, lite1m, full, ref]) e.close();
}

function summary() {
  const rows = readdirSync(out).filter((f) => f.endsWith(".jsonl")).flatMap((f) =>
    readFileSync(out + f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)),
  );
  const configs = [["lite", "Today: lite, 250k nodes"], ["lite1m", "Lite, 1M nodes (4x time)"], ["full", "Full network, 250k nodes"]] as const;
  const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) + "%" : "-");
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
  const lines: string[] = ["# How often the scoring engine misjudges a pick", "", `${rows.length} positions, ${rows.reduce((s, r) => s + r.picks.length, 0)} picks (each position: the scorer's top 8 plus 4 random legal moves). Referee: the full-network Stockfish 19, each move searched on its own at a much bigger budget. Loss is in points (1 point = 1% of expected score).`, ""];
  lines.push("| Scorer | Good move marked a mistake (ref ≤ 3, scorer ≥ 10) | ... marked a blunder (scorer ≥ 20) | Bad move let off (ref ≥ 15, scorer ≤ 5) | Typical error (median) | 90th pct error | Same best pick as referee |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const [k, label] of configs) {
    let good = 0, robbed = 0, robbed20 = 0, bad = 0, letOff = 0, sameBest = 0;
    const errs: number[] = [];
    for (const r of rows) {
      for (const m of r.picks) {
        const ref = r.ref[m], s = r[k][m];
        errs.push(Math.abs(ref - s));
        if (ref <= 3) { good++; if (s >= 10) robbed++; if (s >= 20) robbed20++; }
        if (ref >= 15) { bad++; if (s <= 5) letOff++; }
      }
      const bestBy = (o: Record<string, number>) => r.picks.reduce((a: string, m: string) => (o[m]! < o[a]! ? m : a), r.picks[0]);
      if (r.ref[bestBy(r[k])] <= 1) sameBest++;
    }
    lines.push(`| ${label} | ${pct(robbed, good)} (${robbed}/${good}) | ${pct(robbed20, good)} | ${pct(letOff, bad)} (${letOff}/${bad}) | ${q(errs, 0.5).toFixed(1)} | ${q(errs, 0.9).toFixed(1)} | ${pct(sameBest, rows.length)} |`);
  }
  writeFileSync(root + "reports/judge-accuracy.md", lines.join("\n") + "\n");
  console.log(lines.join("\n"));
}

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === "run") await run(Number(a ?? 10), Number(b ?? 1), Number(c ?? 3_000_000));
else summary();
