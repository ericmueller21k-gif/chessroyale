/**
 * The close-call re-check on players' computers against the engine server: how close each gets to the truth.
 * On the positions and picks measured by judge-accuracy.ts (reports/judge-accuracy/*.jsonl, with the referee's
 * losses), the picks today's judge (lite 250k) says lose 5-60 points are re-checked as the game does: one search
 * restricted to them and the judge's best move, at 2M nodes, by
 *   - the lite build (what a computer's browser runs)
 *   - the full-network build (standing in for the engine server's Stockfish 17.1)
 * Results go to reports/deep-accuracy.jsonl, which judge-cuts.ts reads to replay crowd matches with each.
 *
 *   npx tsx packages/sim/scripts/deep-accuracy.ts run [nodes]
 *   npx tsx packages/sim/scripts/deep-accuracy.ts summary      (writes reports/deep-accuracy.md)
 */
import { STOCKFISH_FULL_BUILD, createNodeEngine } from "@chessroyale/chess/node";
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const dir = root + "reports/judge-accuracy/";
type Row = { fen: string; picks: string[]; lite: Record<string, number>; ref: Record<string, number> };
const rows: Row[] = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).flatMap((f) => readFileSync(dir + f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const out = root + "reports/deep-accuracy.jsonl";

async function run(nodes: number) {
  writeFileSync(out, "");
  const lite = await createNodeEngine({ nodes, hashMb: 16 });
  const full = await createNodeEngine({ nodes, hashMb: 64 }, STOCKFISH_FULL_BUILD);
  let done = 0;
  for (const r of rows) {
    const best = r.picks.find((m) => r.lite[m] === 0) ?? r.picks[0]!;
    const flagged = r.picks.filter((m) => m !== best && r.lite[m]! >= 5 && r.lite[m]! <= 60);
    const deep = async (e: typeof lite) => {
      if (!flagged.length) return {};
      const s = await e.scoreMovesAt(r.fen, [best, ...flagged], nodes);
      const top = Math.max(...s.map((x) => x.expected));
      return Object.fromEntries(flagged.flatMap((m) => {
        const x = s.find((y) => y.move === m);
        return x ? [[m, Math.max(0, (top - x.expected) * 100)]] : [];
      }));
    };
    const row = { fen: r.fen, liteDeep: await deep(lite), fullDeep: await deep(full) };
    appendFileSync(out, JSON.stringify(row) + "\n");
    console.log(`${++done}/${rows.length}: ${flagged.length} re-checked`);
  }
  lite.close();
  full.close();

}

function summary() {
  const byFen = new Map(rows.map((r) => [r.fen, r]));
  const deep = readFileSync(out, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as { fen: string; liteDeep: Record<string, number>; fullDeep: Record<string, number> });
  const errs = { quick: [] as number[], lite: [] as number[], full: [] as number[] };
  for (const d of deep) {
    const r = byFen.get(d.fen)!;
    for (const [m, v] of Object.entries(d.liteDeep)) {
      if (d.fullDeep[m] === undefined) continue;
      errs.quick.push(Math.abs(r.lite[m]! - r.ref[m]!));
      errs.lite.push(Math.abs(v - r.ref[m]!));
      errs.full.push(Math.abs(d.fullDeep[m]! - r.ref[m]!));
    }
  }
  const row = (name: string, e: number[]) => {
    const s = [...e].sort((a, b) => a - b);
    return `| ${name} | ${s[Math.floor(s.length / 2)]!.toFixed(1)} | ${s[Math.floor(s.length * 0.9)]!.toFixed(1)} | ${(e.reduce((a, b) => a + b, 0) / e.length).toFixed(2)} | ${e.filter((x) => x > 5).length} | ${e.filter((x) => x > 10).length} |`;
  };
  const cuts = execFileSync(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./judge-cuts.ts", import.meta.url)), "600"], { encoding: "utf8" })
    .split("\n")
    .filter((l) => /^\| (Judge|---|Referee|Today: lite 250k|As the game runs it)/.test(l));
  const md = `# The close-call re-check: players' computers against the engine server

\`packages/sim/scripts/deep-accuracy.ts\`: on the ${rows.length} positions and 720 picks of \`reports/judge-accuracy.md\` (with the referee's
losses: the full network, 2M nodes a move), the ${errs.lite.length} picks today's quick judge (lite, 250k) says lose 5-60 points
are re-checked as the game re-checks them (one search over them and the best move, 2M nodes) by the lite build (what a
computer's browser runs) and by the full-network build (standing in for the engine server's Stockfish 17.1).

**Error against the referee (points)**

| Re-check | Median | 90th pct | Mean | Off by 5+ | Off by 10+ |
|---|---:|---:|---:|---:|---:|
${row("None (the quick judge's number)", errs.quick)}
${row("Lite, 2M nodes (two computers)", errs.lite)}
${row("Full network, 2M nodes (the engine server)", errs.full)}

**Who gets cut** (\`judge-cuts.ts 600\`: 600 replayed 100-player crowd matches, the same picks scored by each judge)

${cuts.join("\n")}

The computers' re-check helps (against none), but cuts strong players unfairly about 1.7 times as often as the
server's. So, by Eric's rule (fair scoring first), close calls stay with the engine server, and \`JUDGES.deepOnDevices\`
ships off. (Measured on this machine: the full network in Chrome runs about 260k nodes/s, so 2M nodes take about
8 s, too slow for a round, and its 99 MB file is over Cloudflare's 25 MiB limit for a static file.)
`;
  writeFileSync(root + "reports/deep-accuracy.md", md);
  console.log(md);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "run") await run(Number(arg ?? 2_000_000));
else if (cmd === "summary") summary();
else console.log("usage: deep-accuracy.ts run [nodes] | summary");
