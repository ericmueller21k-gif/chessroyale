/**
 * The engine server as deployed (its container's own Stockfish, engine/Dockerfile) on deep-accuracy.ts's close-call
 * re-checks: the same searches (each position's picks the quick judge says lose 5-60 points, with its best move: one
 * search, 2M nodes, 64 MB hash, through UciEngine), set against the referee and against the full-network Stockfish 19
 * build that stood in for the server there (reports/deep-accuracy.jsonl). Needs Docker and the image:
 *
 *   docker build -t hunchess-engine engine
 *   npx tsx packages/sim/scripts/container-accuracy.ts run [image]   (writes reports/container-accuracy.jsonl)
 *   npx tsx packages/sim/scripts/container-accuracy.ts summary       (writes reports/container-accuracy.md)
 */
import { UciEngine, type UciTransport } from "@chessroyale/chess";
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const dir = root + "reports/judge-accuracy/";
type Row = { fen: string; picks: string[]; lite: Record<string, number>; ref: Record<string, number> };
type Deep = { fen: string; liteDeep: Record<string, number>; fullDeep: Record<string, number> };
type Server = { fen: string; serverDeep: Record<string, number> };
const rows: Row[] = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).flatMap((f) => readFileSync(dir + f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const out = root + "reports/container-accuracy.jsonl";
const readJsonl = <T,>(file: string): T[] => readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as T);

/** The container's Stockfish itself, over its stdin and stdout (no HTTP: a re-check here can name more than 8 moves). */
function containerTransport(image: string): UciTransport {
  const child = spawn("docker", ["run", "-i", "--rm", "--entrypoint", "/opt/stockfish", image], { stdio: ["pipe", "pipe", "inherit"] });
  let buffer = "";
  const listeners: ((line: string) => void)[] = [];
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    let i: number;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      for (const l of listeners) l(line);
    }
  });
  return { send: (c) => child.stdin.write(c + "\n"), onLine: (l) => listeners.push(l), close: () => child.stdin.end("quit\n") };
}

async function run(image: string) {
  writeFileSync(out, "");
  const nodes = 2_000_000;
  const engine = new UciEngine(containerTransport(image), { nodes, hashMb: 64 });
  await engine.init();
  let done = 0;
  for (const r of rows) {
    // (As deep-accuracy.ts picks them.)
    const best = r.picks.find((m) => r.lite[m] === 0) ?? r.picks[0]!;
    const flagged = r.picks.filter((m) => m !== best && r.lite[m]! >= 5 && r.lite[m]! <= 60);
    let serverDeep: Record<string, number> = {};
    if (flagged.length) {
      const s = await engine.scoreMovesAt(r.fen, [best, ...flagged], nodes);
      const top = Math.max(...s.map((x) => x.expected));
      serverDeep = Object.fromEntries(flagged.flatMap((m) => {
        const x = s.find((y) => y.move === m);
        return x ? [[m, Math.max(0, (top - x.expected) * 100)]] : [];
      }));
    }
    const row: Server = { fen: r.fen, serverDeep };
    appendFileSync(out, JSON.stringify(row) + "\n");
    console.log(JSON.stringify(row));
    console.error(`${++done}/${rows.length}: ${flagged.length} re-checked`);
  }
  engine.close();
}

function summary() {
  const byFen = new Map(rows.map((r) => [r.fen, r]));
  const server = new Map(readJsonl<Server>(out).map((s) => [s.fen, s.serverDeep]));
  const errs = { quick: [] as number[], full: [] as number[], server: [] as number[], apart: [] as number[], signed: [] as number[] };
  for (const d of readJsonl<Deep>(root + "reports/deep-accuracy.jsonl")) {
    const r = byFen.get(d.fen)!;
    const s = server.get(d.fen) ?? {};
    // (The picks deep-accuracy.md counts: re-checked by both builds there, and here.)
    for (const m of Object.keys(d.liteDeep)) {
      const full = d.fullDeep[m];
      if (full === undefined || s[m] === undefined) continue;
      errs.quick.push(Math.abs(r.lite[m]! - r.ref[m]!));
      errs.full.push(Math.abs(full - r.ref[m]!));
      errs.server.push(Math.abs(s[m]! - r.ref[m]!));
      errs.apart.push(Math.abs(s[m]! - full));
      errs.signed.push(s[m]! - full);
    }
  }
  const row = (name: string, e: number[]) => {
    const s = [...e].sort((a, b) => a - b);
    return `| ${name} | ${s[Math.floor(s.length / 2)]!.toFixed(1)} | ${s[Math.floor(s.length * 0.9)]!.toFixed(1)} | ${(e.reduce((a, b) => a + b, 0) / e.length).toFixed(2)} | ${e.filter((x) => x > 5).length} | ${e.filter((x) => x > 10).length} |`;
  };
  const mean = (e: number[]) => e.reduce((a, b) => a + b, 0) / e.length;
  const cuts = execFileSync(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./judge-cuts.ts", import.meta.url)), "600"], { encoding: "utf8" })
    .split("\n")
    .filter((l) => /^\| (Judge|---|Referee|Today: lite 250k|As the game runs it|As deployed)/.test(l));
  const md = `# The engine server as deployed: its own Stockfish on the close-call re-checks

\`packages/sim/scripts/container-accuracy.ts\`: the ${errs.apart.length} re-checked picks of \`reports/deep-accuracy.md\` (60
positions; each position's picks the quick judge, lite at 250k, says lose 5-60 points, with its best move: one search,
2M nodes), searched again by the engine server's own binary (native Stockfish 17.1 with its full network, run from the
container image built from \`engine/Dockerfile\`, in CI). There, the full-network Stockfish 19 build stood in for it.
The referee is that same Stockfish 19 full network (each move on its own, 2M nodes), so it leans toward its own build.

**Error against the referee (points)**

| Re-check | Median | 90th pct | Mean | Off by 5+ | Off by 10+ |
|---|---:|---:|---:|---:|---:|
${row("None (the quick judge's number)", errs.quick)}
${row("Stockfish 19 full network, 2M (the stand-in)", errs.full)}
${row("Native Stockfish 17.1, 2M (the server as deployed)", errs.server)}

**The server as deployed against its stand-in** (the same re-check, point for point)

| | Median | 90th pct | Mean | Off by 5+ | Off by 10+ |
|---|---:|---:|---:|---:|---:|
${row("Native 17.1 against Stockfish 19 full", errs.apart)}

On average 17.1 calls a re-checked pick ${mean(errs.signed) >= 0 ? `${mean(errs.signed).toFixed(2)} points worse` : `${(-mean(errs.signed)).toFixed(2)} points better`} than Stockfish 19 does.

**Who gets cut** (\`judge-cuts.ts 600\`: 600 replayed 100-player crowd matches, the same picks scored by each judge)

${cuts.join("\n")}

With the server's own numbers, the re-check's gain over today's quick judge is about what two players' computers
(lite, 2M) give, not what its Stockfish 19 stand-in gave. Part of that is the referee's lean toward its own build, so
17.1 isn't shown to be wrong; but every number the judge was tuned on (\`reports/judge-accuracy.md\`,
\`reports/deep-accuracy.md\`) is Stockfish 19's, and the server's isn't (DECISIONS.md, "The engine server's own
Stockfish, checked in CI", Oct 15).
`;
  writeFileSync(root + "reports/container-accuracy.md", md);
  console.log(md);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "run") await run(arg ?? "hunchess-engine");
else if (cmd === "summary") summary();
else console.log("usage: container-accuracy.ts run [image] | summary");
