/**
 * Best-move agreement: on a few hundred positions (normal openings played on, and Auto-chess-like sparse positions), how often the
 * HunChess engine's move at the fight's node budget is deep Stockfish's best move, or within 0.3 pawns of it (Stockfish scoring
 * our move with the same depth). Ordinary chess rules, since Stockfish knows no others.
 *
 *   npx tsx packages/sim/scripts/hunchess-agreement.ts positions=300 depth=16 nodes=60000 out=agreement.json
 */
import { writeFileSync } from "node:fs";
import { AUTOCHESS, mulberry32 } from "@chessroyale/core";
import { CHESS_RULES, gameResult, HunchessEngine, replay } from "@chessroyale/chess/hunchess";
import { openingStarts, sparseStarts, type Start } from "../src/hunchess-starts.ts";
import { sfPlayer } from "../src/sf-player.ts";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(k + "="))?.slice(k.length + 1) ?? d;
const POSITIONS = Number(arg("positions", "300"));
const DEPTH = Number(arg("depth", "16"));
const NODES = Number(arg("nodes", String(AUTOCHESS.fightNodes)));
const OUT = arg("out", "");

// Positions: from each start, a few quick moves of the engine against itself (with a little randomness), then one position.
const rng = mulberry32(31);
const quick = new HunchessEngine({ nodes: 3000 });
function positionFrom(start: Start): string | null {
  quick.newGame();
  const moves: string[] = [];
  const plies = 4 + Math.floor(rng() * (start.kind === "opening" ? 24 : 12));
  for (let i = 0; i < plies; i++) {
    const game = { startFen: start.fen, moves: [...moves], rules: CHESS_RULES };
    if (gameResult(game)) return null;
    moves.push(quick.best(game).move!);
  }
  const game = { startFen: start.fen, moves, rules: CHESS_RULES };
  if (gameResult(game)) return null;
  return fenOf(start.fen, moves);
}
const fenOf = (startFen: string, moves: string[]) => replay({ startFen, moves, rules: CHESS_RULES }).fen();

const half = Math.round(POSITIONS / 2);
const positions: { kind: string; fen: string }[] = [];
for (const s of openingStarts(half * 2, 7)) {
  if (positions.length >= half) break;
  const f = positionFrom(s);
  if (f) positions.push({ kind: "opening", fen: f });
}
for (const s of sparseStarts(half * 2, 8)) {
  if (positions.length >= POSITIONS) break;
  const f = positionFrom(s);
  if (f) positions.push({ kind: "sparse", fen: f });
}

const sf = await sfPlayer({ hashMb: 64 });
const hun = new HunchessEngine({ nodes: NODES, ttBits: 20 });
const rows: { kind: string; same: boolean; close: boolean; loss: number }[] = [];
for (const [i, p] of positions.entries()) {
  hun.newGame();
  const ours = hun.best({ startFen: p.fen, moves: [], rules: CHESS_RULES }).move!;
  await sf.newGame();
  const best = await sf.search(p.fen, { depth: DEPTH });
  let loss = 0;
  if (best.move !== ours) {
    await sf.newGame();
    const mine = await sf.search(p.fen, { depth: DEPTH }, [ours]);
    loss = Math.max(0, best.score - mine.score);
  }
  rows.push({ kind: p.kind, same: best.move === ours, close: loss <= 30, loss });
  if ((i + 1) % 25 === 0) process.stdout.write(`${i + 1}/${positions.length}\n`);
}
sf.close();

function summary(rs: typeof rows) {
  const n = rs.length;
  const same = rs.filter((r) => r.same).length;
  const close = rs.filter((r) => r.close).length;
  const losses = rs.map((r) => Math.min(r.loss, 1000));
  return { positions: n, sameMove: +((100 * same) / n).toFixed(1), within30cp: +((100 * close) / n).toFixed(1), meanLossCp: Math.round(losses.reduce((a, b) => a + b, 0) / n) };
}
const out = { depth: DEPTH, nodes: NODES, all: summary(rows), openings: summary(rows.filter((r) => r.kind === "opening")), sparse: summary(rows.filter((r) => r.kind === "sparse")) };
console.log(JSON.stringify(out, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2));
