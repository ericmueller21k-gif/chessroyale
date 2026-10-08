/**
 * The close-call re-check on players' computers against the engine server: how close each gets to the truth.
 * On the positions and picks measured by judge-accuracy.ts (reports/judge-accuracy/*.jsonl, with the referee's
 * losses), the picks today's judge (lite 250k) says lose 5-60 points are re-checked as the game does: one search
 * restricted to them and the judge's best move, at 2M nodes, by
 *   - the lite build (what a computer's browser runs)
 *   - the full-network build (standing in for the engine server's Stockfish 17.1)
 * Results go to reports/deep-accuracy.jsonl, which judge-cuts.ts reads to replay crowd matches with each.
 *
 *   npx tsx packages/sim/scripts/deep-accuracy.ts [nodes]
 */
import { STOCKFISH_FULL_BUILD, createNodeEngine } from "@chessroyale/chess/node";
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const dir = root + "reports/judge-accuracy/";
type Row = { fen: string; picks: string[]; lite: Record<string, number>; ref: Record<string, number> };
const rows: Row[] = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).flatMap((f) => readFileSync(dir + f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const nodes = Number(process.argv[2] ?? 2_000_000);
const out = root + "reports/deep-accuracy.jsonl";
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
