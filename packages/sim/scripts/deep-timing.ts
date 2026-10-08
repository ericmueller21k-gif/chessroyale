/**
 * How long the deep re-check takes in a browser: the lite build in a Web Worker in headless Chromium (as the app runs
 * it), one thread, timed on realistic positions. For moving the close-call re-checks onto players' computers: which
 * node count fits the time the engine server takes today, and how fast a device must be (its speed check's reading).
 *
 *   npx tsx packages/sim/scripts/deep-timing.ts run [positions] [cpuSlowdown...]
 *   npx tsx packages/sim/scripts/deep-timing.ts summary
 *
 * cpuSlowdown: Chrome's CPU throttling (1 = this machine; 4 = roughly a mid-range phone). Results go to
 * reports/deep-timing.jsonl; `summary` writes reports/deep-timing.md.
 */
import { DEFAULT_SETTINGS, JUDGES, mulberry32, shuffle } from "@chessroyale/core";
import { applyMove, fenAfter, gameEnd, legalMoves, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { browserEngine } from "../src/browser-engine.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const file = root + "reports/deep-timing.jsonl";
const NODES = [700_000, 1_000_000, 2_000_000];

async function run(count: number, slowdowns: number[]) {
  const rng = mulberry32(11);
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const gen = await createNodeEngine({ nodes: 60_000, hashMb: 16 });
  // Realistic positions, and each one's re-check: the best move and four others from the top eight.
  const cases: { fen: string; moves: string[] }[] = [];
  for (const o of shuffle(rng, library.filter((x) => x.moves.length >= 8))) {
    if (cases.length >= count) break;
    let fen = fenAfter(o.moves.slice(0, 8));
    for (let i = 0, n = Math.floor(rng() * 20); i < n && !gameEnd(fen, []); i++) {
      const top = await gen.topMoves(fen, 3);
      if (!top.length) break;
      fen = applyMove(fen, top[Math.floor(rng() * top.length)]!.move);
    }
    if (gameEnd(fen, []) || legalMoves(fen).length < 6) continue;
    const top = await gen.topMoves(fen, 8);
    cases.push({ fen, moves: [top[0]!.move, ...shuffle(rng, top.slice(1)).slice(0, 4).map((m) => m.move)] });
  }
  gen.close();
  for (const slow of slowdowns) {
    const web = await browserEngine({ nodes: DEFAULT_SETTINGS.engineNodes, hashMb: DEFAULT_SETTINGS.engineHashMb }, slow);
    const e = web.engine;
    const speed = await e.speed(JUDGES.benchNodes);
    const speed2 = await e.speed(JUDGES.benchNodes);
    for (const c of cases) {
      const t0 = performance.now();
      await e.topMoves(c.fen, DEFAULT_SETTINGS.botCandidateMoves);
      const topMs = performance.now() - t0;
      const deepMs: Record<number, number> = {};
      for (const n of NODES) {
        const t = performance.now();
        await e.scoreMovesAt(c.fen, c.moves, n);
        deepMs[n] = Math.round(performance.now() - t);
      }
      const row = { slow, speed, speed2, topMs: Math.round(topMs), deepMs };
      appendFileSync(file, JSON.stringify(row) + "\n");
      console.log(JSON.stringify(row));
    }
    await web.stop();
  }
}

function summary() {
  const rows = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { slow: number; speed: number; speed2: number; topMs: number; deepMs: Record<string, number> });
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const max = (xs: number[]) => Math.max(...xs);
  let md = `# Deep re-checks in a browser

\`packages/sim/scripts/deep-timing.ts\`: the lite build (\`stockfish-19-lite-single\`) in a Web Worker in headless
Chromium on this machine (one thread, as the app runs it), timed on ${rows.filter((r) => r.slow === rows[0]!.slow).length} realistic positions: the re-check's
search (the best move and four others, restricted to them) at each node count, and the top-8 search the judges run
(${DEFAULT_SETTINGS.engineNodes.toLocaleString("en")} nodes). CPU slowdown is Chrome's own throttling (devtools' "4x slowdown" is roughly a mid-range phone).

| CPU | Speed check (nodes/s, 1st / 2nd) | Top-8 search | ${NODES.map((n) => `Re-check ${n / 1e6}M (median / max)`).join(" | ")} | Nodes/s at 2M |
|---|---|---:|${NODES.map(() => "---:").join("|")}|---:|
`;
  for (const slow of [...new Set(rows.map((r) => r.slow))]) {
    const rs = rows.filter((r) => r.slow === slow);
    const at2m = med(rs.map((r) => r.deepMs[2_000_000]!));
    md += `| ${slow === 1 ? "this machine" : `${slow}x slower`} | ${rs[0]!.speed.toLocaleString("en")} / ${rs[0]!.speed2.toLocaleString("en")} | ${med(rs.map((r) => r.topMs))} ms | ${NODES.map((n) => `${(med(rs.map((r) => r.deepMs[n]!)) / 1000).toFixed(2)} / ${(max(rs.map((r) => r.deepMs[n]!)) / 1000).toFixed(2)} s`).join(" | ")} | ${Math.round(2_000_000 / (at2m / 1000)).toLocaleString("en")} |\n`;
  }
  md += `
The engine server takes about 3 s for its 2M-node re-check (700k nodes/s on one core), after the judges' answers are
in; that's the time a round already waits for close calls today. See DECISIONS.md, "Deep checks on players'
computers", for the node count and speed threshold chosen from these.
`;
  writeFileSync(root + "reports/deep-timing.md", md);
  console.log(md);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "run") await run(Number(args[0] ?? 12), args.slice(1).length ? args.slice(1).map(Number) : [1, 4]);
else if (cmd === "summary") summary();
else console.log("usage: deep-timing.ts run [positions] [cpuSlowdown...] | summary");
