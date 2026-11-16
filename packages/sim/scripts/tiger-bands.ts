/**
 * The circus tiger's landing bands, measured in the engine's own units (docs/decisions/2026-10-23-tiger-rules.md): what a
 * balloon of each shape gains him on a square the crowd doesn't attack (every guard of landCheck), from roughly even
 * middlegames. Each position: an opening from the book, played on by the engine (one of its top three, seeded) to ply
 * 20, White (the crowd) to move, one of Black's pawns taken off (so a piece of any shape is one he can have). Each shape on
 * up to `looks` seeded squares that pass landCheck, his gain as landFrom measures it (the crowd's best at balloonNodes,
 * after against before, in pawns of log-odds). Prints each shape's percentiles: the bands are set from them.
 *
 *   npx tsx packages/sim/scripts/tiger-bands.ts [positions=40] [looks=10]
 */
import { BOSS_POWERS, mulberry32, type BalloonShape } from "@chessroyale/core";
import { applyMove, landCheck, legalMoves, pieceAt, stockfishRefuses, withoutPiece, type Opening } from "@chessroyale/chess";

const logit = (x: number) => Math.log(Math.min(0.999, Math.max(0.001, x)) / (1 - Math.min(0.999, Math.max(0.001, x))));
import { createNodeEngine } from "@chessroyale/chess/node";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const [nArg, looksArg] = process.argv.slice(2);
const N = Number(nArg ?? 40);
const LOOKS = Number(looksArg ?? 10);
const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
const engine = await createNodeEngine({ nodes: BOSS_POWERS.balloonNodes, hashMb: 16 });
const rng = mulberry32(2024);
const best = async (fen: string) => (await engine.topMovesAt!(fen, 1, BOSS_POWERS.balloonNodes))[0]?.expected ?? null;
const gains: Record<BalloonShape, number[]> = { p: [], n: [], b: [], r: [], q: [] };
let positions = 0;
for (let i = 0; positions < N && i < N * 4; i++) {
  const op = library[Math.floor(rng() * library.length)]!;
  let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  try {
    for (const m of op.moves) fen = applyMove(fen, m);
    for (let ply = op.moves.length; ply < 20 && legalMoves(fen).length; ply++) {
      const top = await engine.topMovesAt!(fen, 3, 20_000);
      if (!top.length) break;
      fen = applyMove(fen, top[Math.floor(rng() * top.length)]!.move);
    }
  } catch {
    continue;
  }
  if (fen.split(" ")[1] !== "w") continue;
  const pawns = ["a", "b", "c", "d", "e", "f", "g", "h"].flatMap((f) => [7, 6, 5, 4, 3].map((r) => `${f}${r}`)).filter((sq) => pieceAt(fen, sq)?.type === "p" && pieceAt(fen, sq)?.color === "b");
  if (!pawns.length) continue;
  const pos = withoutPiece(fen, pawns[Math.floor(rng() * pawns.length)]!);
  if (stockfishRefuses(pos)) continue;
  const before = await best(pos);
  // (Roughly even only: the bands mean a piece's worth from an even position.)
  if (before === null || before < 0.3 || before > 0.7) continue;
  positions++;
  for (const shape of ["p", "n", "b", "r", "q"] as BalloonShape[]) {
    const squares = ["a", "b", "c", "d", "e", "f", "g", "h"]
      .flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`))
      .map((sq) => ({ sq, k: rng() }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.sq);
    let taken = 0;
    for (const sq of squares) {
      if (taken >= LOOKS) break;
      const after = landCheck(pos, shape, sq, []);
      if (!after) continue;
      taken++;
      const c = await best(after);
      if (c === null) continue;
      gains[shape].push((logit(1 - c) - logit(1 - before)) / BOSS_POWERS.bouncePawnLogit);
    }
  }
}
engine.close();
const pct = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))]! : NaN;
};
console.log(`positions ${positions}, up to ${LOOKS} safe squares a shape`);
console.log("| Shape | Squares | p10 | p25 | median | p75 | p90 |");
console.log("|---|---|---|---|---|---|---|");
for (const [shape, xs] of Object.entries(gains)) console.log(`| ${shape} | ${xs.length} | ${[0.1, 0.25, 0.5, 0.75, 0.9].map((q) => pct(xs, q).toFixed(2)).join(" | ")} |`);
