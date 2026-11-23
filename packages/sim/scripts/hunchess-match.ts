/**
 * The HunChess engine against Stockfish limited to a rating (UCI_LimitStrength, UCI_Elo), ordinary chess rules (promotion on),
 * from varied starts: normal openings and Auto-chess-like sparse positions, each played twice with the colors swapped. Our
 * engine searches a fixed number of nodes a move; Stockfish gets a fixed time a move (the fight's 350 ms by default).
 * Writes one JSON line per game and a summary (score, Elo estimate with a 95% interval) to `out`.
 *
 *   npx tsx packages/sim/scripts/hunchess-match.ts pairs=60 nodes=60000 elo=2200 ms=350 parallel=3 out=match.json
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { Chess } from "chess.js";
import { CHESS_RULES, HunchessEngine } from "@chessroyale/chess/hunchess";
import { openingStarts, sparseStarts, type Start } from "../src/hunchess-starts.ts";
import { sfPlayer } from "../src/sf-player.ts";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(k + "="))?.slice(k.length + 1) ?? d;
const PAIRS = Number(arg("pairs", "60"));
const NODES = Number(arg("nodes", "60000"));
const ELO = Number(arg("elo", "2200"));
const MS = Number(arg("ms", "350"));
const PARALLEL = Number(arg("parallel", "3"));
const OUT = arg("out", "hunchess-match.jsonl");
const SEED = Number(arg("seed", "2026"));
const SPARSE_SHARE = Number(arg("sparse", "0.5"));
const MAX_PLIES = 300;

interface Game {
  start: Start;
  /** Our engine plays White? */
  hunWhite: boolean;
}

const nSparse = Math.round(PAIRS * SPARSE_SHARE);
const starts = [...openingStarts(PAIRS - nSparse, SEED), ...sparseStarts(nSparse, SEED + 1)];
const games: Game[] = starts.flatMap((start) => [
  { start, hunWhite: true },
  { start, hunWhite: false },
]);
writeFileSync(OUT, "");

interface Outcome {
  /** 1 our win, 0.5 draw, 0 loss. */
  score: number;
  reason: string;
  plies: number;
  hunMs: number;
  hunDepth: number;
}

async function play(game: Game): Promise<Outcome> {
  const sf = await sfPlayer({ elo: ELO });
  const hun = new HunchessEngine({ nodes: NODES, ttBits: 20 });
  await sf.newGame();
  hun.newGame();
  const chess = new Chess(game.start.fen);
  const moves: string[] = [];
  let hunMs = 0;
  let hunMoves = 0;
  let hunDepth = 0;
  let agree = 0;
  try {
    for (;;) {
      if (chess.isCheckmate()) {
        const loserWhite = chess.turn() === "w";
        return { score: loserWhite === game.hunWhite ? 0 : 1, reason: "mate", plies: moves.length, hunMs: hunMs / hunMoves, hunDepth: hunDepth / hunMoves };
      }
      if (chess.isDraw() || moves.length >= MAX_PLIES)
        return { score: 0.5, reason: chess.isThreefoldRepetition() ? "repetition" : chess.isStalemate() ? "stalemate" : chess.isInsufficientMaterial() ? "material" : chess.isDrawByFiftyMoves() ? "fifty" : "length", plies: moves.length, hunMs: hunMs / hunMoves, hunDepth: hunDepth / hunMoves };
      const hunTurn = (chess.turn() === "w") === game.hunWhite;
      let move: string;
      let score: number; // for our engine's side
      if (hunTurn) {
        const t0 = performance.now();
        const r = hun.best({ startFen: game.start.fen, moves, rules: CHESS_RULES });
        hunMs += performance.now() - t0;
        hunMoves++;
        hunDepth += r.depth;
        move = r.move!;
        score = r.score >= 29000 ? 100000 : r.score <= -29000 ? -100000 : r.score;
      } else {
        const r = await sf.move(game.start.fen, moves, { ms: MS });
        move = r.move;
        score = -r.score;
      }
      // Both sides agreeing on a big edge for 4 plies in a row: adjudicated.
      agree = Math.abs(score) >= 1000 && (agree === 0 || Math.sign(agree) === Math.sign(score)) ? agree + Math.sign(score) : 0;
      if (Math.abs(agree) >= 4) return { score: agree > 0 ? 1 : 0, reason: "adjudicated", plies: moves.length, hunMs: hunMs / hunMoves, hunDepth: hunDepth / hunMoves };
      chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] as "q" | undefined });
      moves.push(move);
    }
  } finally {
    sf.close();
  }
}

function elo(p: number) {
  const q = Math.min(0.999, Math.max(0.001, p));
  return -400 * Math.log10(1 / q - 1);
}

const results: (Outcome & Game)[] = [];
let next = 0;
const t0 = Date.now();
async function worker() {
  while (next < games.length) {
    const g = games[next++]!;
    const o = await play(g);
    results.push({ ...o, ...g });
    appendFileSync(OUT, JSON.stringify({ kind: g.start.kind, name: g.start.name, fen: g.start.fen, hunWhite: g.hunWhite, ...o }) + "\n");
    const s = results.reduce((a, r) => a + r.score, 0);
    process.stdout.write(`${results.length}/${games.length} ${o.score} ${o.reason} ${g.start.kind} | ${s}/${results.length} (${Math.round((Date.now() - t0) / 1000)} s)\n`);
  }
}
await Promise.all(Array.from({ length: PARALLEL }, worker));

function summary(rs: (Outcome & Game)[], label: string) {
  const n = rs.length;
  const w = rs.filter((r) => r.score === 1).length;
  const d = rs.filter((r) => r.score === 0.5).length;
  const l = n - w - d;
  const p = (w + d / 2) / n;
  const variance = (w * (1 - p) ** 2 + d * (0.5 - p) ** 2 + l * p ** 2) / n;
  const se = Math.sqrt(variance / n);
  return `${label}: ${n} games, +${w} =${d} -${l}, score ${(100 * p).toFixed(1)}%, Elo ${elo(p) >= 0 ? "+" : ""}${Math.round(elo(p))} (95%: ${Math.round(elo(p - 1.96 * se))} to ${Math.round(elo(p + 1.96 * se))}), our engine ${Math.round(rs.reduce((a, r) => a + r.hunMs, 0) / n)} ms and depth ${(rs.reduce((a, r) => a + r.hunDepth, 0) / n).toFixed(1)} a move, ${Math.round(rs.reduce((a, r) => a + r.plies, 0) / n)} plies a game`;
}
const lines = [summary(results, "All"), summary(results.filter((r) => r.start.kind === "opening"), "Openings"), summary(results.filter((r) => r.start.kind === "sparse"), "Sparse")];
const reasons = new Map<string, number>();
for (const r of results) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
lines.push(`Ends: ${[...reasons].map(([k, v]) => `${k} ${v}`).join(", ")}`);
lines.push(`Settings: Stockfish UCI_Elo ${ELO}, ${MS} ms a move; HunChess ${NODES} nodes a move; ${PAIRS} starts x 2 colors; ${Math.round((Date.now() - t0) / 60000)} min`);
appendFileSync(OUT, "# " + lines.join("\n# ") + "\n");
console.log(lines.join("\n"));
