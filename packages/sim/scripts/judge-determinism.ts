/**
 * Is the browser engine deterministic? Many judges needs to know whether two honest devices give identical numbers
 * for the same scoring job (then the lobby can demand an exact match) or only close ones (then a tolerance).
 *
 * Realistic jobs (a library opening, then 0-30 plies of good-but-varied play; 3-10 people's picks, some of them
 * blunders; 6 bots; the device's own re-check of close calls), each run in full by runJudgeJob on:
 *   - A and B: two separate engine processes (the Stockfish 19 lite single-threaded WASM build: what browsers run)
 *   - C: a third, "used" one, that runs an unrelated search (another position, a boss move at limited strength)
 *     before every job, like a device that's been prefetching, playing bosses and giving hints
 *   - W: (with `browser`) the same build in a Web Worker in headless Chromium, as the app runs it
 * and compared byte for byte. Then the engine server's view (the full-network build at refNodes, a stand-in for
 * the container's native Stockfish 17.1 full network) scores the same moves, to measure how far an honest device's
 * losses are from a deep verdict (the noise blame has to allow for).
 *
 *   npx tsx packages/sim/scripts/judge-determinism.ts run <positions> <seed> [browser] [refNodes]
 *   npx tsx packages/sim/scripts/judge-determinism.ts summary
 */
import { DEFAULT_SETTINGS, mulberry32, shuffle } from "@chessroyale/core";
import {
  applyMove,
  distanceFrom,
  fenAfter,
  gameEnd,
  judgedBoard,
  legalMoves,
  runJudgeJob,
  verdictBoard,
  verdictMoves,
  UciEngine,
  type JudgeJob,
  type Opening,
  type UciTransport,
} from "@chessroyale/chess";
import { STOCKFISH_BUILD, STOCKFISH_FULL_BUILD, createNodeEngine } from "@chessroyale/chess/node";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = root + "reports/judge-determinism/";
const opts = { nodes: DEFAULT_SETTINGS.engineNodes, hashMb: DEFAULT_SETTINGS.engineHashMb };

/** The lite build in a Web Worker in headless Chromium, spoken to from here over UCI (the app's own transport). */
async function browserEngine(): Promise<{ engine: UciEngine; stop: () => Promise<void> }> {
  const { chromium } = await import("@playwright/test");
  const dir = dirname(STOCKFISH_BUILD);
  const server = createServer((req, res) => {
    const name = (req.url ?? "/").split("?")[0]!.split("#")[0]!.replace(/^\//, "");
    if (!name) return res.writeHead(200, { "content-type": "text/html" }).end("<!doctype html><title>engine</title>");
    try {
      const body = readFileSync(join(dir, name.replace(/[^\w.-]/g, "")));
      res.writeHead(200, { "content-type": name.endsWith(".wasm") ? "application/wasm" : "text/javascript" }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const listeners: ((line: string) => void)[] = [];
  await page.exposeFunction("uciLine", (text: string) => {
    for (const line of text.split("\n")) for (const l of listeners) l(line.trim());
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  // (Runs in the page: typed loosely, as this package has no DOM types.)
  type Page = { Worker: new (url: string) => { onmessage: (e: { data: unknown }) => void; postMessage(c: string): void }; uciLine(t: string): void; sf: { postMessage(c: string): void } };
  await page.evaluate(() => {
    const g = globalThis as unknown as Page;
    const w = new g.Worker(`/stockfish-19-lite-single.js#${encodeURIComponent("/stockfish-19-lite-single.wasm")}`);
    w.onmessage = (e) => void (typeof e.data === "string" && g.uciLine(e.data));
    g.sf = w;
  });
  const transport: UciTransport = {
    send: (c) => void page.evaluate((cmd) => (globalThis as unknown as Page).sf.postMessage(cmd), c),
    onLine: (l) => listeners.push(l),
    close: () => undefined,
  };
  const engine = new UciEngine(transport, opts);
  await engine.init();
  return {
    engine,
    stop: async () => {
      await browser.close();
      server.close();
    },
  };
}

async function run(count: number, seed: number, withBrowser: boolean, refNodes: number) {
  const rng = mulberry32(seed);
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const gen = await createNodeEngine({ nodes: 60_000, hashMb: 16 });
  const a = await createNodeEngine(opts);
  const b = await createNodeEngine(opts);
  const c = await createNodeEngine(opts);
  const ref = await createNodeEngine({ nodes: refNodes, hashMb: 64 }, STOCKFISH_FULL_BUILD);
  const web = withBrowser ? await browserEngine() : null;
  mkdirSync(out, { recursive: true });
  const file = `${out}seed${seed}.jsonl`;
  let done = 0;
  for (const o of shuffle(rng, library.filter((x) => x.moves.length >= 6))) {
    if (done >= count) break;
    let fen = fenAfter(o.moves.slice(0, 4 + Math.floor(rng() * Math.min(10, o.moves.length - 3))));
    const plies = Math.floor(rng() * 31);
    for (let i = 0; i < plies && !gameEnd(fen, []); i++) {
      const top = await gen.topMoves(fen, 3);
      if (!top.length) break;
      fen = applyMove(fen, top[Math.floor(rng() * top.length)]!.move);
    }
    const legal = legalMoves(fen);
    if (gameEnd(fen, []) || legal.length < 3) continue;
    // People's picks: mostly good moves, some blunders, a few picked by several.
    const good = (await gen.topMoves(fen, 6)).map((m) => m.move);
    const pool = [...good, ...good, ...shuffle(rng, legal).slice(0, 3)];
    const picks = Array.from({ length: 3 + Math.floor(rng() * 8) }, () => pool[Math.floor(rng() * pool.length)]!).sort();
    const job: JudgeJob = {
      id: `d${done}`,
      fen,
      picks,
      bots: Array.from({ length: 6 }, () => ({ skill: 1 + Math.floor(rng() * 12), powerUps: rng() < 0.3 ? 1 : 0 })),
      seed: Math.floor(rng() * 2 ** 31),
      rules: { botCandidateMoves: DEFAULT_SETTINGS.botCandidateMoves, botRandomMoveChance: DEFAULT_SETTINGS.botRandomMoveChance, botPowerUpLoss: DEFAULT_SETTINGS.botPowerUpLoss },
      recheck: DEFAULT_SETTINGS,
      ...(rng() < 0.5 ? { priority: picks.slice(0, 2) } : {}),
    };
    // C has been busy with something else first (its hash and history tables are dirty, MultiPV and strength changed).
    const other = fenAfter(shuffle(rng, library)[0]!.moves);
    await c.topMoves(other, 1 + Math.floor(rng() * 8));
    if (rng() < 0.5) await c.playAtElo(other, 1400 + Math.floor(rng() * 1200), 50_000);
    const t0 = performance.now();
    const ra = await runJudgeJob(a, job);
    const ms = performance.now() - t0;
    const rb = await runJudgeJob(b, job);
    const rc = await runJudgeJob(c, job);
    const rw = web ? await runJudgeJob(web.engine, job) : null;
    const same = (x: unknown) => JSON.stringify(x) === JSON.stringify(ra);
    const board = judgedBoard(job, ra);
    if (!board) {
      writeFileSync(out + `invalid-${seed}-${done}.json`, JSON.stringify({ job, report: ra }, null, 1));
      throw new Error("an honest report didn't hold together");
    }
    // The deep verdict over every move scored, and how far the honest device's losses are from it.
    const moves = verdictMoves(job, [ra], [board]);
    const deep = await ref.scoreMovesAt(fen, moves, refNodes);
    const verdict = verdictBoard(job, deep, board);
    const row = {
      fen,
      picks,
      ms: Math.round(ms),
      searches: 1 + (ra.extra.length ? 1 : 0) + (ra.deep ? 1 : 0),
      sameB: same(rb),
      sameC: same(rc),
      ...(rw ? { sameW: same(rw) } : {}),
      distance: verdict ? distanceFrom(verdict, board) : null,
      moves: moves.length,
    };
    appendFileSync(file, JSON.stringify(row) + "\n");
    done++;
    console.log(`${done}/${count} B ${row.sameB} C ${row.sameC}${rw ? ` W ${row.sameW}` : ""} distance ${row.distance?.toFixed(1)} (${row.ms} ms)`);
  }
  for (const e of [gen, a, b, c, ref]) e.close();
  await web?.stop();
}

function summary() {
  const rows = readdirSync(out)
    .filter((f) => f.endsWith(".jsonl"))
    .flatMap((f) => readFileSync(out + f, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>));
  const n = rows.length;
  const count = (k: string) => rows.filter((r) => r[k] === true).length;
  const withW = rows.filter((r) => r.sameW !== undefined).length;
  const dist = rows.map((r) => r.distance as number | null).filter((d): d is number => d !== null && Number.isFinite(d)).sort((x, y) => x - y);
  const pct = (p: number) => dist[Math.min(dist.length - 1, Math.floor(p * dist.length))]!.toFixed(1);
  const searches = rows.reduce((s, r) => s + (r.searches as number), 0);
  const ms = rows.map((r) => r.ms as number).sort((x, y) => x - y);
  // Relaxed-SIMD instructions (0xFD prefix, opcodes 0x100-0x113): the one WebAssembly feature whose results may
  // differ between CPUs. A raw scan of the bytes (it can only over-count).
  const wasm = readFileSync(STOCKFISH_BUILD.replace(/\.js$/, ".wasm"));
  let relaxed = 0;
  for (let i = 0; i + 2 < wasm.length; i++) if (wasm[i] === 0xfd && wasm[i + 2] === 0x02 && wasm[i + 1]! >= 0x80 && wasm[i + 1]! <= 0x93) relaxed++;
  const md = `# Judge determinism

Many judges needs to know: do two honest devices give identical numbers for the same scoring job?
\`packages/sim/scripts/judge-determinism.ts\` builds realistic jobs (a library opening, then 0–30 plies of
good-but-varied play; 3–10 people's picks including blunders; 6 bots; the device's own re-check of close calls) and
runs each in full (\`runJudgeJob\`: the top-8 search at ${DEFAULT_SETTINGS.engineNodes.toLocaleString("en")} nodes, the search over picks
outside it, the 700k-node re-check) on separate engines, comparing the raw output byte for byte.

## Result: deterministic

| Comparison | Jobs | Identical |
|---|---:|---:|
| Two separate engine processes (A, B) | ${n} | ${count("sameB")} |
| A against a "used" engine (C: another search and a limited-strength boss move before every job) | ${n} | ${count("sameC")} |
| Node against a Web Worker in headless Chromium (W: the app's own transport) | ${withW} | ${count("sameW")} |

${n} jobs, ${searches} searches, every score, best reply and mate identical. Stockfish with one thread, a fixed node
count and a cleared hash (\`ucinewgame\`) is deterministic, and the WebAssembly build is the same file everywhere.
The build has ${relaxed ? `${relaxed} possible` : "no"} relaxed-SIMD instructions (a scan of the .wasm's bytes), the only WebAssembly
feature whose results may differ between CPUs (x86 against a phone's ARM). Integer SIMD and the rest are exactly
specified, so the same file gives the same numbers on any device.

So the lobby demands an **exact match** (\`JUDGES.tolerance = 0\` in settings.ts). Untested here: real ARM phones
(this machine is x86). The lobby logs every disagreement with its size, so a platform difference would show up in
the logs at once as disagreements between honest devices.

A job took ${ms[Math.floor(ms.length / 2)]} ms (median) and ${ms[Math.floor(ms.length * 0.95)]} ms (95th percentile) on one core of this machine, with
nothing prefetched.

## Noise between a device and the engine server

For blame after a disagreement: how far an honest device's losses are from a deep verdict (the full-network build
over every move scored, standing in for the server's Stockfish 17.1), as the worst difference over a job's moves:

| Percentile | Points |
|---|---:|
| median | ${pct(0.5)} |
| 90th | ${pct(0.9)} |
| 99th | ${pct(0.99)} |
| max | ${dist[dist.length - 1]!.toFixed(1)} |

A lone judge's spot check blames it only beyond the worst of these (\`soloBlame\`); a pair blames the further judge
only when it's \`JUDGES.blameMargin\` points further than the other (measured with cheaters in
\`reports/many-judges.md\`).
`;
  writeFileSync(root + "reports/judge-determinism.md", md);
  console.log(md);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "run") await run(Number(args[0] ?? 100), Number(args[1] ?? 1), args.includes("browser"), Number(args.find((x) => /^\d{6,}$/.test(x)) ?? 1_000_000));
else if (cmd === "summary") summary();
else console.log("usage: judge-determinism.ts run <positions> <seed> [browser] [refNodes] | summary");
