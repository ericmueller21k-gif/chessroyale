/**
 * Does hanging the queen or a minor piece early in a boss raid call for the God King's Last Stand? Takes real raid
 * starting positions (named openings, 10 plies in, White to move), plays a few sensible moves on (the engine's best
 * for both sides) to reach crowd moves 1 to 10, and in each finds the moves that leave the queen, a knight or a
 * bishop where an enemy pawn, or any enemy piece if it's undefended, takes it for nothing. Each is judged as the
 * game judges it (top 8 at engineNodes, then the re-check at recheckNodes) and compared with the bar for that move.
 *
 *   npx tsx packages/sim/scripts/last-stand-blunders.ts <positions> <seed>
 */
import { DEFAULT_SETTINGS, lastStandBar, mulberry32 } from "@chessroyale/core";
import { applyMove, legalMoves, pieceAt, recheckCloseCalls, START_FEN, toSan, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Chess, type Square } from "chess.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const s = DEFAULT_SETTINGS;
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 } as const;

/** The moved piece (queen, knight or bishop) can be taken for nothing: by a pawn, or by anything if undefended. */
export function hangs(fen: string, move: string): "q" | "n" | "b" | null {
  const piece = pieceAt(fen, move.slice(0, 2));
  if (!piece || !["q", "n", "b"].includes(piece.type)) return null;
  const after = new Chess(applyMove(fen, move));
  const to = move.slice(2, 4) as Square;
  const them = piece.color === "w" ? "b" : "w";
  const attackers = after.attackers(to, them);
  if (!attackers.length) return null;
  const cheaper = attackers.some((a) => VALUE[after.get(a as Square)!.type] < VALUE[piece.type as "q" | "n" | "b"]);
  const defended = after.isAttacked(to, piece.color);
  return cheaper || !defended ? (piece.type as "q" | "n" | "b") : null;
}

const [count, seedArg] = process.argv.slice(2);
const library = (JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[]).filter(
  (o) => !o.unusual && o.moves.length >= 10 && o.expected[10] !== undefined && o.expected[10]! >= s.openingBalance[0] && o.expected[10]! <= s.openingBalance[1],
);
const engine = await createNodeEngine({ nodes: s.engineNodes, hashMb: 16 });
const rng = mulberry32(Number(seedArg ?? 1));
const rows: string[] = [];
let tried = 0;
let fired = 0;
for (let i = 0; i < Number(count ?? 8); i++) {
  const o = library[Math.floor(rng() * library.length)]!;
  let fen = o.moves.slice(0, 10).reduce((f, m) => applyMove(f, m), START_FEN);
  // Crowd move n+1 (n moves in): play n sensible pairs of moves on first.
  const n = Math.floor(rng() * 10);
  for (let k = 0; k < n * 2; k++) fen = applyMove(fen, (await engine.topMoves(fen, 1))[0]!.move);
  const blunders = legalMoves(fen).filter((m) => hangs(fen, m));
  if (!blunders.length) continue;
  const pick = blunders.find((m) => hangs(fen, m) === "q") ?? blunders[Math.floor(rng() * blunders.length)]!;
  const top = await engine.topMoves(fen, s.botCandidateMoves);
  const known = new Map(top.map((m) => [m.move, m.expected]));
  if (!known.has(pick)) for (const m of await engine.scoreMoves(fen, [pick])) known.set(m.move, m.expected);
  const checked = await recheckCloseCalls(engine, fen, { bestMove: top[0]!.move, bestExpected: top[0]!.expected, expectedAfter: Object.fromEntries(known) }, [pick], s);
  const best = Math.max(checked.bestExpected, checked.expectedAfter[pick]!);
  const loss = (best - checked.expectedAfter[pick]!) * 100;
  const bar = lastStandBar(n, 3, s);
  const ok = best * 100 >= s.lastStandFrom && loss >= bar;
  tried++;
  if (ok) fired++;
  rows.push(`| ${o.name} | ${n + 1} | ${toSan(fen, pick)} (${hangs(fen, pick)}) | ${(best * 100).toFixed(1)} | ${loss.toFixed(1)} | ${bar.toFixed(1)} | ${ok ? "yes" : "NO"} | \`${fen}\` |`);
  console.log(rows[rows.length - 1]);
}
console.log(`\n${fired} of ${tried} hung pieces call for the Last Stand.`);
engine.close();
