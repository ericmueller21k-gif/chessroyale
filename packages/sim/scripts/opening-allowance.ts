/**
 * The opening allowance's calibration (docs/decisions/2026-10-15-opening-allowance-and-ties.md): what
 * moves cost in the first 14 moves, by kind, at the strength the game scores with (the lite build at 250k nodes, the
 * judge's top-8 search plus a search over the other picks: `analyse`, as the runner's scoreBoard does).
 *
 * Positions: games from the starting position (Crowd), from Classic's library openings 4 moves in and the raid's 5 in,
 * played on by varied good moves (one of the engine's top 3), so the line stays balanced. From 40% of its positions a
 * side branch: a random move that leaves material hanging, and the position after it, where the other side has a free
 * capture (the class Eric named: "an obvious capture early or blunder"). In every position up to move 14, the engine's
 * top 8 and 6 random legal moves are scored. Each move is sorted into one kind by the game's exchange check
 * (`exchangeNet` in the chess package: what a move takes, less what the opponent can then win by one capture and the
 * exchange on its square: pawn 1, minor 3, rook 5, queen 9), against the engine's best move, so a pawn already en prise
 * for every move (a gambit, tension) doesn't count against any of them:
 *   - top 2-4 / top 5-8: the engine's 2nd to 8th move, giving up no material against the best
 *   - random, sound: a random legal move giving up no material against the best
 *   - missed free pawn / piece: the engine's best is a capture that wins a pawn (a piece), and the move doesn't win it
 *     (without losing material itself)
 *   - hangs a pawn / a piece: the move gives up a pawn (a piece) against the best by the exchange check
 *
 *   npx tsx packages/sim/scripts/opening-allowance.ts run <games> <seed> [engines=3]
 *   npx tsx packages/sim/scripts/opening-allowance.ts summary      -> reports/opening-allowance.md
 * (The data behind the report is committed gzipped: reports/opening-allowance/seed1.jsonl.gz.)
 */
import { mulberry32, shuffle, type Rng } from "@chessroyale/core";
import { START_FEN, applyMove, exchangeNet, fenAfter, gameEnd, legalMoves, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { Chess } from "chess.js";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = root + "reports/opening-allowance/";
const LAST_MOVE = 14;
/** The game's own exchange check (the opening allowance's material fallback); null counts as no material. */
const moveNet = (fen: string, move: string) => exchangeNet(fen, move) ?? 0;

/** Whether a move takes something (a piece on its square, or a pawn en passant). */
const takes = (fen: string, move: string) => {
  const chess = new Chess(fen);
  return !!chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }).captured;
};

interface Row {
  src: string;
  fen: string;
  move: number;
  pick: string;
  rank: number | null;
  loss: number;
  net: number;
  bestNet: number;
  bestIsCapture: boolean;
  /** The side to move's expected score after the best move, and whether this is a side branch (after a hung piece). */
  bestExpected: number;
  branch: boolean;
}

async function run(games: number, seed: number, engineCount: number) {
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const classic = library.filter((o) => !o.unusual && o.moves.length >= 10);
  const engines = await Promise.all(Array.from({ length: engineCount }, () => createNodeEngine({ nodes: 250_000, hashMb: 16 })));
  mkdirSync(out, { recursive: true });
  const file = `${out}seed${seed}.jsonl`;
  // Game i: from the start (Crowd), a Classic opening 4 moves in, or a raid's 5 in, in turn.
  const plan = Array.from({ length: games }, (_, i) => {
    const rng = mulberry32(seed * 1000 + i);
    const kind = (["start", "classic", "raid"] as const)[i % 3]!;
    const o = classic[Math.floor(rng() * classic.length)]!;
    const fen = kind === "start" ? START_FEN : fenAfter(o.moves.slice(0, kind === "classic" ? 8 : 10));
    return { kind, fen, rng };
  });
  let next = 0;
  let done = 0;
  await Promise.all(
    engines.map(async (engine) => {
      while (next < plan.length) {
        const g = plan[next++]!;
        await playGame(engine, g.kind, g.fen, g.rng, file);
        console.log(`game ${++done}/${plan.length} (${g.kind})`);
      }
    }),
  );
  engines.forEach((e) => e.close());
}

type Engine = Awaited<ReturnType<typeof createNodeEngine>>;
const fullmove = (f: string) => Number(f.split(" ")[5]);

async function playGame(engine: Engine, src: string, start: string, rng: Rng, file: string) {
  let fen = start;
  while (fullmove(fen) <= LAST_MOVE && !gameEnd(fen, []) && legalMoves(fen).length >= 2) {
    const top = await recordPosition(engine, src, fen, rng, file, false);
    // A side branch: a move that leaves material hanging, and the position after it (the other side's free capture).
    if (rng() < 0.4) {
      const hang = shuffle(rng, legalMoves(fen)).find((m) => moveNet(fen, m) <= -1);
      const after = hang && applyMove(fen, hang);
      if (after && fullmove(after) <= LAST_MOVE && !gameEnd(after, []) && legalMoves(after).length >= 2) await recordPosition(engine, src, after, rng, file, true);
    }
    // Play on: one of the top 3, so the line stays balanced.
    fen = applyMove(fen, top[Math.floor(rng() * Math.min(3, top.length))]!);
  }
}

/** Scores one position's moves (the engine's top 8 and 6 random legal moves, as the judge does) and writes a row each. Returns the top moves, best first. */
async function recordPosition(engine: Engine, src: string, fen: string, rng: Rng, file: string, branch: boolean): Promise<string[]> {
  // As the runner's scoreBoard: the top 8 in one search, then one search over the picks outside them.
  const randoms = shuffle(rng, legalMoves(fen)).slice(0, 6);
  const topLines = (await engine.topMoves(fen, 8)).sort((x, y) => y.expected - x.expected);
  const top = topLines.map((m) => m.move);
  const missing = randoms.filter((m) => !top.includes(m));
  const extra = missing.length ? await engine.scoreMoves(fen, missing) : [];
  const a = { moves: [...topLines, ...extra] };
  const best = Math.max(...a.moves.map((m) => m.expected));
  const bestMove = top[0]!;
  const bestIsCapture = takes(fen, bestMove);
  const bestNet = moveNet(fen, bestMove);
  for (const m of a.moves) {
    const rank = top.indexOf(m.move);
    const row: Row = {
      src,
      fen,
      move: fullmove(fen),
      pick: m.move,
      rank: rank >= 0 ? rank + 1 : null,
      loss: Math.round(Math.max(0, (best - m.expected) * 100) * 100) / 100,
      net: moveNet(fen, m.move),
      bestNet,
      bestIsCapture,
      bestExpected: Math.round(best * 1000) / 1000,
      branch,
    };
    appendFileSync(file, JSON.stringify(row) + "\n");
  }
  return top;
}

// ---------------- Summary ----------------

type Kind = "top 2-4" | "top 5-8" | "random, sound" | "missed free pawn" | "missed free piece" | "hangs a pawn" | "hangs a piece";
const KINDS: Kind[] = ["top 2-4", "top 5-8", "random, sound", "missed free pawn", "missed free piece", "hangs a pawn", "hangs a piece"];

export function kindOf(r: Row): Kind | null {
  if (r.rank === 1) return null;
  // Material the move gives up against the engine's best, by the exchange check.
  const given = r.bestNet - r.net;
  if (given < 1) return r.rank === null ? "random, sound" : r.rank <= 4 ? "top 2-4" : "top 5-8";
  if (r.bestIsCapture && r.bestNet >= 1 && r.net >= 0) return given >= 2.5 ? "missed free piece" : "missed free pawn";
  return given >= 2.5 ? "hangs a piece" : "hangs a pawn";
}

const BUCKETS: [number, number][] = [[1, 4], [5, 8], [9, 10], [11, 12], [13, 14]];
const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};
const f1 = (x: number) => (Number.isNaN(x) ? "–" : x.toFixed(1));

function summary() {
  // (The committed data is gzipped: seedN.jsonl.gz; a fresh run writes seedN.jsonl.)
  const rows: Row[] = readdirSync(out)
    .filter((f) => f.endsWith(".jsonl") || (f.endsWith(".jsonl.gz") && !readdirSync(out).includes(f.slice(0, -3))))
    .flatMap((f) => (f.endsWith(".gz") ? gunzipSync(readFileSync(out + f)).toString("utf8") : readFileSync(out + f, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row));
  // Sorted by the exchange check the game ships (rows written by an earlier version of it are re-checked).
  const bestOf = new Map(rows.filter((r) => r.rank === 1).map((r) => [r.fen, r.pick]));
  const memo = new Map<string, { bestNet: number; bestIsCapture: boolean }>();
  for (const r of rows) {
    const best = bestOf.get(r.fen);
    if (!best) continue;
    if (!memo.has(r.fen)) memo.set(r.fen, { bestNet: moveNet(r.fen, best), bestIsCapture: takes(r.fen, best) });
    Object.assign(r, memo.get(r.fen)!, { net: moveNet(r.fen, r.pick) });
  }
  const byKind = new Map<Kind, Row[]>(KINDS.map((k) => [k, []]));
  for (const r of rows) {
    const k = kindOf(r);
    if (k) byKind.get(k)!.push(r);
  }
  const positions = new Set(rows.map((r) => r.fen)).size;
  const lines: string[] = [];
  lines.push("# The opening allowance's calibration");
  lines.push("");
  lines.push(`Made by \`packages/sim/scripts/opening-allowance.ts\` (${positions} positions, ${rows.length} scored moves, moves 1-${LAST_MOVE}; the lite build at 250k nodes, the judge's top-8 search plus a search over the other picks). Loss in points (1 point = 1% of expected score). How the moves are sorted is in the script's header.`);
  lines.push("");
  const sound = (k: Kind) => k.startsWith("top") || k.startsWith("random");
  // Sound moves are measured where players really choose: the balanced line (not the side branches after a hung piece).
  const pool = (k: Kind) => byKind.get(k)!.filter((r) => !sound(k) || !r.branch);
  lines.push("## Loss by kind (moves 1-14)");
  lines.push("");
  lines.push("Sound kinds on the balanced line only; material kinds on the line and its side branches.");
  lines.push("");
  lines.push("| Kind | n | p10 | p25 | median | p75 | p90 |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const k of KINDS) {
    const xs = pool(k).map((r) => r.loss);
    lines.push(`| ${k} | ${xs.length} | ${f1(pct(xs, 0.1))} | ${f1(pct(xs, 0.25))} | ${f1(pct(xs, 0.5))} | ${f1(pct(xs, 0.75))} | ${f1(pct(xs, 0.9))} |`);
  }
  lines.push("");
  lines.push("## Loss by move number (median / p90; n)");
  lines.push("");
  lines.push(`| Kind | ${BUCKETS.map(([a, b]) => `moves ${a}-${b}`).join(" | ")} |`);
  lines.push(`| --- | ${BUCKETS.map(() => "---:").join(" | ")} |`);
  for (const k of KINDS) {
    const cells = BUCKETS.map(([a, b]) => {
      const xs = pool(k).filter((r) => r.move >= a && r.move <= b).map((r) => r.loss);
      return xs.length ? `${f1(pct(xs, 0.5))} / ${f1(pct(xs, 0.9))} (${xs.length})` : "–";
    });
    lines.push(`| ${k} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  const Gs = [2, 3, 4, 5, 6, 8, 10, 12];
  const sweep = (title: string, fallback: boolean) => {
    lines.push(`## ${title}`);
    lines.push("");
    lines.push(
      "Moves 1-10 (the whole allowance). Sound kinds: the share that counts 0 (loss <= G). Material kinds: the share still charged at least half its raw loss / the share counted under 1 point (\"about 0\")" +
        (fallback ? ": with the fallback a move that gives up material by the exchange check gets no allowance, so they're charged in full." : "."),
    );
    lines.push("");
    lines.push(`| Kind | ${Gs.map((g) => `G=${g}`).join(" | ")} |`);
    lines.push(`| --- | ${Gs.map(() => "---:").join(" | ")} |`);
    for (const k of KINDS) {
      const xs = pool(k).filter((r) => r.move <= 10).map((r) => r.loss);
      const cells = Gs.map((g) => {
        if (!xs.length) return "–";
        if (sound(k)) return `${Math.round((100 * xs.filter((x) => x <= g).length) / xs.length)}% at 0`;
        const counted = xs.map((x) => (fallback ? x : Math.max(0, x - g)));
        const half = counted.filter((c, i) => c >= xs[i]! / 2).length;
        const zero = counted.filter((c) => c < 1).length;
        return `${Math.round((100 * half) / xs.length)}% / ${Math.round((100 * zero) / xs.length)}%`;
      });
      lines.push(`| ${k} | ${cells.join(" | ")} |`);
    }
    lines.push("");
  };
  sweep("What a flat allowance of G points would do", false);
  sweep("The same with the material fallback", true);
  // Flat through move 10 (gone by 14) against a taper from move 1 (gone by 14), over moves 1-14, no fallback.
  const flat = (g: number, n: number) => (n <= 10 ? g : n >= 14 ? 0 : (g * (14 - n)) / 4);
  const taper = (g: number, n: number) => (n >= 14 ? 0 : (g * (14 - n)) / 13);
  lines.push("## Flat to move 10, or a taper from move 1");
  lines.push("");
  lines.push("Moves 1-14. Flat: G through move 10, then down to 0 at move 14. Taper: G at move 1, down in a line to 0 at move 14. Sound kinds: share at 0; material kinds: share charged at least half its raw loss.");
  lines.push("");
  const shapes: [string, (g: number, n: number) => number][] = [["flat", flat], ["taper", taper]];
  const cols = [4, 6, 8, 10].flatMap((g) => shapes.map(([name, f]) => ({ g, name, f })));
  lines.push(`| Kind | ${cols.map((c) => `${c.name} G=${c.g}`).join(" | ")} |`);
  lines.push(`| --- | ${cols.map(() => "---:").join(" | ")} |`);
  for (const k of KINDS) {
    const rs = pool(k);
    const cells = cols.map(({ g, f }) => {
      if (!rs.length) return "–";
      const ok = sound(k) ? rs.filter((r) => r.loss <= f(g, r.move)).length : rs.filter((r) => Math.max(0, r.loss - f(g, r.move)) >= r.loss / 2).length;
      return `${Math.round((100 * ok) / rs.length)}%`;
    });
    lines.push(`| ${k} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  // How far the exchange check and the engine disagree: material moves the engine says cost under 2 points.
  lines.push("## Material moves the engine says cost little");
  lines.push("");
  lines.push("The exchange check is simple (one capture and the exchange on its square), so some moves it calls material are sound to the engine (a gambit, a pawn that can't be taken safely). Share with a raw loss under 2 / under 5 points, moves 1-10:");
  lines.push("");
  for (const k of KINDS.filter((x) => !sound(x))) {
    const xs = pool(k).filter((r) => r.move <= 10).map((r) => r.loss);
    lines.push(`- ${k}: ${Math.round((100 * xs.filter((x) => x < 2).length) / xs.length)}% / ${Math.round((100 * xs.filter((x) => x < 5).length) / xs.length)}%`);
  }
  lines.push("");
  writeFileSync(root + "reports/opening-allowance.md", lines.join("\n"));
  console.log(lines.join("\n"));
}

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === "run") await run(Number(a ?? 30), Number(b ?? 1), Number(c ?? 3));
else summary();
