// HunChess engine server: native Stockfish behind a tiny HTTP API, run in a Cloudflare Container.
// POST /score {fen, moves[], nodes} -> {moves: [{move, expected}]}: one search restricted to those moves,
// the same numbers the game's own engine gives (expected score from Stockfish's win/draw/loss, mover's side).
// One search at a time (Stockfish is single-threaded here); requests queue.
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const BIN = process.env.STOCKFISH ?? "/opt/stockfish";
const MAX_NODES = 5_000_000;
const sf = spawn(BIN, [], { stdio: ["pipe", "pipe", "inherit"] });
let buffer = "";
let listener = null;
sf.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let i;
  while ((i = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    listener?.(line);
  }
});
sf.on("exit", (code) => {
  console.error(`stockfish exited (${code})`);
  process.exit(1);
});
const send = (cmd) => sf.stdin.write(cmd + "\n");
const until = (test) =>
  new Promise((resolve) => {
    const lines = [];
    listener = (l) => {
      lines.push(l);
      if (test(l)) {
        listener = null;
        resolve(lines);
      }
    };
  });

const expectedFromWdl = (w, d, l) => (w + d / 2) / (w + d + l || 1000);
function parseInfo(line) {
  if (!line.startsWith("info ") || !line.includes(" wdl ") || !line.includes(" pv ")) return null;
  if (line.includes(" lowerbound") || line.includes(" upperbound")) return null;
  const wdl = line.match(/ wdl (\d+) (\d+) (\d+)/);
  const pv = line.match(/ pv (\S+)/);
  const mpv = line.match(/ multipv (\d+)/);
  if (!wdl || !pv) return null;
  return { multipv: mpv ? Number(mpv[1]) : 1, move: pv[1], expected: expectedFromWdl(Number(wdl[1]), Number(wdl[2]), Number(wdl[3])) };
}

let queue = Promise.resolve();
const serial = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
};

async function ready() {
  const done = until((l) => l === "readyok");
  send("isready");
  await done;
}

function score(fen, moves, nodes) {
  return serial(async () => {
    send("ucinewgame");
    send(`setoption name MultiPV value ${moves.length}`);
    await ready();
    send(`position fen ${fen}`);
    const done = until((l) => l.startsWith("bestmove"));
    send(`go nodes ${nodes} searchmoves ${moves.join(" ")}`);
    const last = new Map();
    for (const l of await done) {
      const info = parseInfo(l);
      if (info) last.set(info.multipv, info);
    }
    return [...last.values()].sort((a, b) => a.multipv - b.multipv).map(({ move, expected }) => ({ move, expected }));
  });
}

const FEN = /^[1-8pnbrqkPNBRQK/]+ [wb] (-|[KQkq]+) (-|[a-h][36]) \d+ \d+$/;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

createServer((req, res) => {
  const reply = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method === "GET" && req.url === "/ping") return reply(200, { ok: true });
  if (req.method !== "POST" || req.url !== "/score") return reply(404, { error: "not found" });
  let raw = "";
  req.on("data", (c) => {
    raw += c;
    if (raw.length > 4096) req.destroy();
  });
  req.on("end", async () => {
    try {
      const { fen, moves, nodes } = JSON.parse(raw);
      const unique = [...new Set(moves)];
      if (typeof fen !== "string" || !FEN.test(fen) || !unique.length || unique.length > 8 || !unique.every((m) => typeof m === "string" && UCI.test(m))) {
        return reply(400, { error: "bad request" });
      }
      const n = Math.max(10_000, Math.min(MAX_NODES, Number(nodes) || 2_000_000));
      const t = Date.now();
      const out = await score(fen, unique, n);
      reply(200, { moves: out, ms: Date.now() - t });
    } catch (e) {
      reply(500, { error: String(e) });
    }
  });
}).listen(8080, async () => {
  send("uci");
  send("setoption name Threads value 1");
  send("setoption name Hash value 128");
  send("setoption name UCI_ShowWDL value true");
  await ready();
  console.log("engine server ready on 8080");
});
