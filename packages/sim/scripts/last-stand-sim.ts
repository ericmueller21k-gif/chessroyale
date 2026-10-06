/**
 * How often the God King's Last Stand would happen, and on which move: crowds of bots play boss battles against
 * the real boss (Stockfish at a tier's strength, with its blunder guard and slips), every crowd move judged as the
 * game judges it (the top 8 at engineNodes, missing picks scored, close calls re-checked at recheckNodes on the
 * same lite build the phones run). Each crowd move's numbers are recorded, so the rule can be tried with any
 * threshold afterwards: the Last Stand is once per game, so a game up to its first one is the game as played.
 *
 *   npx tsx packages/sim/scripts/last-stand-sim.ts run <crowd> <tiers,comma> <games> <seed>
 *   npx tsx packages/sim/scripts/last-stand-sim.ts summary
 *
 * Crowds: solo-strong, solo-club, solo-casual (a boss raid alone: one player's move is the crowd's) and
 * final-club, final-expert (the 50 v 50 boss final: ten players, the most popular pick, the boss striking down
 * the worst every 3 moves, the bots calling the God King when the popular move loses 6+ while he has charges).
 * Results go to reports/last-stand-sim/*.jsonl.
 */
import { DEFAULT_SETTINGS, bossStumbleChance, botPick, lastStandDue, mulberry32, type Rng } from "@chessroyale/core";
import { applyMove, bossGuardFrom, bossMoveFrom, gameEnd, legalMoves, recheckCloseCalls, START_FEN, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const settings = DEFAULT_SETTINGS;
const MAX_MOVES = settings.bossMaxMoves;
const spread = (n: number, lo: number, hi: number) => Array.from({ length: n }, (_, i) => (n === 1 ? lo : lo * Math.pow(hi / lo, i / (n - 1))));
const CROWDS: Record<string, { skills: number[]; random: number; charges: number; botsCallKing: boolean }> = {
  "solo-strong": { skills: [3], random: 0.02, charges: 3, botsCallKing: false },
  "solo-club": { skills: [8], random: 0.05, charges: 3, botsCallKing: false },
  "solo-casual": { skills: [20], random: 0.1, charges: 3, botsCallKing: false },
  "final-club": { skills: spread(10, 6, 20), random: 0.06, charges: 2, botsCallKing: true },
  "final-expert": { skills: spread(10, 1, 4), random: 0.02, charges: 2, botsCallKing: true },
};

interface MoveRow {
  /** Crowd moves made before this one. */
  n: number;
  /** The played move's loss (points) and the best move's expected score (0-1), as the judge saw them. */
  loss: number;
  best: number;
  /** The God King's charges before the move, and whether he played it. */
  charges: number;
  king: boolean;
}

async function run(kind: string, tiers: number[], games: number, seed: number) {
  const library = (JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[]).filter(
    (o) => !o.unusual && o.moves.length >= 10 && o.expected[10] !== undefined && o.expected[10]! >= settings.openingBalance[0] && o.expected[10]! <= settings.openingBalance[1],
  );
  const judge = await createNodeEngine({ nodes: settings.engineNodes, hashMb: 16 });
  const boss = await createNodeEngine({ nodes: settings.bossNodes, hashMb: 16 });
  const rng = mulberry32(seed);
  const crowd = CROWDS[kind]!;
  const pickSettings = { ...settings, botRandomMoveChance: crowd.random };
  mkdirSync(root + "reports/last-stand-sim", { recursive: true });
  for (const elo of tiers) {
    for (let g = 0; g < games; g++) {
      const opening = library[Math.floor(rng() * library.length)]!;
      const t0 = Date.now();
      const r = await battle(rng, crowd, pickSettings, judge, (fen) => {
        const kind = rng() < bossStumbleChance(elo, settings) ? "stumble" : "elo";
        return bossMoveFrom(boss, fen, elo, settings.bossNodes, kind, rng, settings.kingStrikeLoss, bossGuardFrom(settings));
      }, opening.moves.slice(0, 10));
      const first = r.moves.findIndex((m) => !m.king && lastStandDue(m.loss, m.best, m.n, m.charges, settings));
      const row = { kind, elo, opening: opening.name, seed, game: g, result: r.result, ended: r.ended, ms: Date.now() - t0, firstAtCurrentSettings: first < 0 ? null : r.moves[first]!.n + 1, moves: r.moves };
      appendFileSync(root + `reports/last-stand-sim/${kind}-${seed}.jsonl`, JSON.stringify(row) + "\n");
      console.log(`${kind} ${elo} #${g}: ${r.result} after ${r.moves.length} moves (${r.ended}), Last Stand at move ${row.firstAtCurrentSettings ?? "-"}, ${Math.round(row.ms / 1000)} s`);
    }
  }
  judge.close();
  boss.close();
}

async function battle(
  rng: Rng,
  crowd: (typeof CROWDS)[string],
  pickSettings: typeof settings,
  judge: Awaited<ReturnType<typeof createNodeEngine>>,
  bossMove: (fen: string) => Promise<string>,
  opening: string[],
) {
  let history = [...opening];
  let fen = opening.reduce((f, m) => applyMove(f, m), START_FEN);
  let alive = crowd.skills.map((skill, i) => ({ i, skill, recent: [] as number[] }));
  let charges = crowd.charges;
  const moves: MoveRow[] = [];
  let lastBest = 0.5;
  while (moves.length < MAX_MOVES && !gameEnd(START_FEN, history)) {
    // The judge: the top 8, then any pick outside them, then the close calls re-checked.
    const top = await judge.topMoves(fen, settings.botCandidateMoves);
    const best0 = top[0]!.expected;
    const list = top.map((m) => ({ move: m.move, loss: Math.max(0, (best0 - m.expected) * 100) }));
    const legal = legalMoves(fen);
    const picks = alive.map((p) => botPick(rng, list, p.skill, legal, pickSettings));
    const known = new Map(top.map((m) => [m.move, m.expected]));
    const missing = [...new Set(picks.filter((m) => !known.has(m)))];
    if (missing.length) for (const m of await judge.scoreMoves(fen, missing)) known.set(m.move, m.expected);
    const checked = await recheckCloseCalls(judge, fen, { bestMove: top[0]!.move, bestExpected: best0, expectedAfter: Object.fromEntries(known) }, picks, settings);
    const best = Math.max(checked.bestExpected, ...picks.map((m) => checked.expectedAfter[m] ?? 0));
    const lossOf = (m: string) => Math.max(0, (best - (checked.expectedAfter[m] ?? best)) * 100);
    alive.forEach((p, k) => p.recent.push(lossOf(picks[k]!)));
    const count = (m: string) => picks.filter((x) => x === m).length;
    const most = Math.max(...picks.map(count));
    const tied = [...new Set(picks.filter((m) => count(m) === most))];
    let played = tied[Math.floor(rng() * tied.length)]!;
    const loss = lossOf(played);
    // The 50 v 50 final: the bots call the God King when the popular move would lose kingBotLoss or more.
    const king = crowd.botsCallKing && charges > 0 && loss >= settings.kingBotLoss;
    moves.push({ n: moves.length, loss: Math.round(loss * 10) / 10, best: Math.round(best * 1000) / 1000, charges, king });
    if (king) {
      charges--;
      played = checked.bestMove;
    }
    lastBest = best;
    history = [...history, played];
    fen = applyMove(fen, played);
    if (moves.length % settings.bossKillEvery === 0 && alive.length > settings.bossMinSurvivors) {
      const sum = (p: (typeof alive)[number]) => p.recent.slice(-settings.bossKillEvery).reduce((s, x) => s + x, 0);
      const victim = [...alive].sort((a, b) => sum(b) - sum(a))[0]!;
      alive = alive.filter((p) => p !== victim);
    }
    if (gameEnd(START_FEN, history)) break;
    const reply = await bossMove(fen);
    history = [...history, reply];
    fen = applyMove(fen, reply);
  }
  const end = gameEnd(START_FEN, history);
  const result = end === "checkmate" ? (fen.split(" ")[1] === "b" ? "crowd" : "boss") : end ? "draw" : lastBest >= 0.6 ? "crowd" : lastBest <= 0.4 ? "boss" : "draw";
  return { result, ended: end ?? "cap", moves };
}

type Row = { kind: string; elo: number; result: string; moves: MoveRow[] };

function load(): Row[] {
  const dir = root + "reports/last-stand-sim";
  return readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .flatMap((f) => readFileSync(`${dir}/${f}`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row));
}

/** The first crowd move (1-based) a rule fires on, or null. */
function firstFiring(moves: readonly MoveRow[], s: typeof settings, chargesHeld: boolean): number | null {
  for (const m of moves) {
    if (m.king) continue;
    if (lastStandDue(m.loss, m.best, m.n, chargesHeld ? m.charges : 0, s)) return m.n + 1;
  }
  return null;
}

function summary() {
  const rows = load();
  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(`${r.kind} ${r.elo}`, [...(groups.get(`${r.kind} ${r.elo}`) ?? []), r]);
  const grid: { floor: number; decay: number }[] = [];
  for (const floor of [10, 12, 13, 14, 15, 18]) for (const decay of [15, 20, 22, 25, 30]) grid.push({ floor, decay });
  const lines = ["# The God King's Last Stand: how often", "", `${rows.length} boss battles (\`packages/sim/scripts/last-stand-sim.ts\`).`, ""];
  lines.push("| Floor | Decay moves | " + [...groups.keys()].join(" | ") + " | All |");
  lines.push("|---|---|" + [...groups.keys()].map(() => "---").join("|") + "|---|");
  for (const g of grid) {
    const s = { ...settings, lastStandLossFloor: g.floor, lastStandDecayMoves: g.decay };
    const cell = (rs: Row[]) => {
      const f = rs.map((r) => firstFiring(r.moves, s, true));
      const hit = f.filter((x) => x !== null) as number[];
      const avg = hit.length ? Math.round(hit.reduce((a, b) => a + b, 0) / hit.length) : 0;
      return `${Math.round((100 * hit.length) / rs.length)}% (m${avg})`;
    };
    lines.push(`| ${g.floor} | ${g.decay} | ${[...groups.values()].map(cell).join(" | ")} | ${cell(rows)} |`);
  }
  lines.push("", "Each cell: the share of games with a Last Stand, and (m) the average crowd move it came on.");
  lines.push("", "## Per game at the shipped settings", "");
  lines.push("| Crowd | Boss | Games | With a Last Stand | Moves it came on | Crowd moves per game | Moves losing 30+ |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const [key, rs] of groups) {
    const f = rs.map((r) => firstFiring(r.moves, settings, true));
    const hit = f.filter((x) => x !== null) as number[];
    const big = rs.reduce((n, r) => n + r.moves.filter((m) => m.loss >= 30).length, 0);
    const [kind, elo] = key.split(" ");
    lines.push(`| ${kind} | ${elo} | ${rs.length} | ${hit.length} (${Math.round((100 * hit.length) / rs.length)}%) | ${hit.sort((a, b) => a - b).join(", ") || "-"} | ${Math.round(rs.reduce((n, r) => n + r.moves.length, 0) / rs.length)} | ${big} |`);
  }
  // Why the floor and its pace barely matter: while the crowd isn't lost yet, its moves are mostly fine or a
  // piece-sized disaster; the in-between mistakes (12-30) mostly tip the position under lastStandFrom at once.
  const live = rows.flatMap((r) => r.moves.filter((m) => !m.king && m.best * 100 >= settings.lastStandFrom));
  const bands: [string, (l: number) => boolean][] = [["under 5", (l) => l < 5], ["5-12", (l) => l >= 5 && l < 12], ["12-20", (l) => l >= 12 && l < 20], ["20-30", (l) => l >= 20 && l < 30], ["30 or more", (l) => l >= 30]];
  lines.push("", "## The crowd's moves while it wasn't lost (best move worth 40+), by points given away", "");
  lines.push("| " + bands.map(([n]) => n).join(" | ") + " |", "|" + bands.map(() => "---").join("|") + "|");
  lines.push("| " + bands.map(([, f]) => `${live.filter((m) => f(m.loss)).length} (${((100 * live.filter((m) => f(m.loss)).length) / live.length).toFixed(1)}%)`).join(" | ") + " |");
  writeFileSync(root + "reports/last-stand.md", lines.join("\n") + "\n");
  console.log(lines.join("\n"));
}

const [cmd, kind, tiers, games, seed] = process.argv.slice(2);
if (cmd === "summary") summary();
else await run(kind ?? "solo-club", (tiers ?? "2000").split(",").map(Number), Number(games ?? 4), Number(seed ?? 1));
