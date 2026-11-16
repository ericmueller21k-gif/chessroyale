/**
 * The Maia prototype's sanity runs (Ginger in Boss alone; DECISIONS.md, "A human-like boss: Maia-3 for Ginger"). Maia
 * runs as a separate program (the Maia box's command-line build, spoken to in UCI text, as the browser's worker is);
 * Stockfish is the lite build the browser runs, at the boss's budget.
 *
 *   npx tsx packages/sim/scripts/maia-sim.ts positions                     a few positions per brain, ms per move
 *   npx tsx packages/sim/scripts/maia-sim.ts games <brain> <games> <seed> [tier] [club|casual|expert]
 *       Boss alone, plain chess (no powers): a bot player against Ginger at a tier (his offset, Normal), the boss on
 *       <brain>; every boss move scored by the judge. The same openings for every brain.
 *   npx tsx packages/sim/scripts/maia-sim.ts summary                       reports/maia-boss.md
 *
 * Games go to reports/maia-sim/*.jsonl.
 */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BOSS_BRAIN, BOSS_ROSTER, DEFAULT_SETTINGS, bossBrainFor, bossStrength, bossStumbleChance, botPick, mulberry32, shuffle, type BossBrain } from "@chessroyale/core";
import { applyMove, bossGuardFrom, bossMoveFrom, brainLine, fenAfter, gameEnd, HumanUciEngine, legalMoves, START_FEN, type BrainNote, type Opening, type UciTransport } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const settings = DEFAULT_SETTINGS;
const GINGER = BOSS_ROSTER.find((b) => b.id === "gingerbread")!;
const PLAYER_NODES = 150_000;
const MAX_MOVES = 60;
/** A player as a bot: a skill temperature and a chance of a random move (as boss-sim.ts's crowds' middle members). */
const PLAYERS: Record<string, { skill: number; random: number }> = {
  expert: { skill: 2, random: 0.02 },
  club: { skill: 11, random: 0.06 },
  casual: { skill: 24, random: 0.12 },
};

/** The Maia box as a separate process: text in, text out. */
function maiaProcess(): UciTransport {
  const child = spawn(process.execPath, ["--import", "tsx", root + "packages/maia-worker/src/cli.ts"], { stdio: ["pipe", "pipe", "inherit"] });
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
  return { send: (c) => child.stdin.write(c + "\n"), onLine: (l) => listeners.push(l), close: () => child.kill() };
}

async function maia() {
  const m = new HumanUciEngine(maiaProcess());
  if (!(await m.init())) throw new Error(`Maia didn't load: ${m.error}`);
  return m;
}

const BRAINS: BossBrain[] = ["stockfish", "maia-raw", "maia-light", "maia-full"];

async function positions() {
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const rng = mulberry32(7);
  const fens = shuffle(rng, library.filter((o) => o.moves.length >= 16))
    .slice(0, 4)
    .map((o) => fenAfter(o.moves.slice(0, 13 + Math.floor(rng() * 4))));
  const boss = await createNodeEngine({ nodes: settings.bossNodes, hashMb: 16 });
  const human = await maia();
  const lines: string[] = [];
  for (const elo of [1500, 2300, 2600]) {
    for (const brain of BRAINS) {
      const { rating } = bossBrainFor("gingerbread", elo, brain, true);
      for (const fen of fens) {
        let note: BrainNote | null = null;
        const t = performance.now();
        const move = await bossMoveFrom(boss, fen, elo, settings.bossNodes, "elo", rng, settings.kingStrikeLoss, bossGuardFrom(settings), null, rating === null ? undefined : { brain, rating, engine: human, onNote: (n) => (note = n) });
        const ms = performance.now() - t;
        const row = `| ${elo} | ${brain} | \`${fen.split(" ").slice(0, 2).join(" ")}\` | ${move} | ${note ? brainLine(note) : "Stockfish"} | ${Math.round(ms)} |`;
        lines.push(row);
        console.log(row);
      }
    }
  }
  boss.close();
  human.close();
  mkdirSync(root + "reports/maia-sim", { recursive: true });
  writeFileSync(root + "reports/maia-sim/positions.md", ["| Boss strength | Brain | Position | Move | What the brain did | ms (whole boss move) |", "| --- | --- | --- | --- | --- | --- |", ...lines].join("\n") + "\n");
}

async function games(brain: BossBrain, n: number, seed: number, tier: number, kind: string) {
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const engine = await createNodeEngine({ nodes: PLAYER_NODES, hashMb: 16 });
  const boss = await createNodeEngine({ nodes: settings.bossNodes, hashMb: 16 });
  // (Every boss move scored as the judge scores a pick: its loss against the best move, in points.)
  const judge = await createNodeEngine({ nodes: settings.engineNodes, hashMb: 16 });
  const human = brain === "stockfish" ? null : await maia();
  const rng = mulberry32(seed);
  const { skill, random } = PLAYERS[kind]!;
  const pickSettings = { ...settings, botRandomMoveChance: random };
  const candidates = async (fen: string) => {
    const top = await engine.topMoves(fen, settings.botCandidateMoves);
    const best = Math.max(...top.map((m) => m.expected));
    return { top, list: top.map((m) => ({ move: m.move, loss: Math.max(0, (best - m.expected) * 100) })) };
  };
  const openings = shuffle(mulberry32(seed + 1), library.filter((o) => o.moves.length >= 10));
  const elo = bossStrength(tier, GINGER, 0);
  const { brain: used, rating: maiaRating } = bossBrainFor("gingerbread", elo, brain, true);
  console.log(`tier ${tier}, Ginger ${elo}, brain ${used}${maiaRating ? ` (Maia ${maiaRating})` : ""}, player ${kind}`);
  mkdirSync(root + "reports/maia-sim", { recursive: true });
  for (let g = 0; g < n; g++) {
    // (The same opening for every brain: game g of a seed, the player White in even games.)
    const o = openings[g]!;
    let fen = fenAfter(o.moves.slice(0, 6 + (g % 2)));
    const youWhite = fen.split(" ")[1] === "w";
    const counts = { maia: 0, stockfish: 0, vetoed: 0 };
    const ms: number[] = [];
    const bossLoss: number[] = [];
    /** The boss's chances before each of its moves (the summary counts the moves of a game still to be played). */
    const bossBest: number[] = [];
    const playerLoss: number[] = [];
    let moves = 0;
    while (moves < MAX_MOVES && !gameEnd(fen, [])) {
      const { list } = await candidates(fen);
      const move = botPick(rng, list, skill, legalMoves(fen), pickSettings);
      playerLoss.push(list.find((c) => c.move === move)?.loss ?? 30);
      fen = applyMove(fen, move);
      moves++;
      if (gameEnd(fen, [])) break;
      let note: BrainNote | null = null;
      const t = performance.now();
      const moveKind = rng() < bossStumbleChance(elo, settings) ? "stumble" : "elo";
      const reply = await bossMoveFrom(boss, fen, elo, settings.bossNodes, moveKind, rng, settings.kingStrikeLoss, bossGuardFrom(settings), null, human && maiaRating !== null ? { brain: used, rating: maiaRating, engine: human, onNote: (x) => (note = x) } : undefined);
      ms.push(performance.now() - t);
      const a = await judge.analyse(fen, [reply], 1);
      const best = Math.max(...a.moves.map((m) => m.expected));
      bossLoss.push(+Math.max(0, (best - (a.moves.find((m) => m.move === reply)?.expected ?? best)) * 100).toFixed(2));
      bossBest.push(+best.toFixed(3));
      const n2 = note as BrainNote | null;
      if (n2?.by === "maia") counts.maia++;
      else counts.stockfish++;
      counts.vetoed += n2?.vetoed ?? 0;
      fen = applyMove(fen, reply);
    }
    const end = gameEnd(fen, []);
    // The player's score: a mate decides; else (a draw or the move cap) the engine's verdict, 75% or more a win.
    let score: number;
    let youExpected: number;
    if (end === "checkmate") youExpected = score = fen.split(" ")[1] === (youWhite ? "b" : "w") ? 1 : 0;
    else if (end) youExpected = score = 0.5;
    else {
      const { top } = await candidates(fen);
      const e = Math.max(...top.map((m) => m.expected));
      youExpected = fen.split(" ")[1] === (youWhite ? "w" : "b") ? e : 1 - e;
      score = youExpected >= 0.75 ? 1 : youExpected <= 0.25 ? 0 : 0.5;
    }
    ms.sort((x, y) => x - y);
    const row = { brain, used, kind, seed, tier, game: g, opening: o.name, elo, maiaRating, moves, end: end ?? "cap", score, youExpected: +youExpected.toFixed(3), ...counts, medianMs: Math.round(ms[ms.length >> 1] ?? 0), bossLoss, bossBest, playerLoss };
    appendFileSync(root + `reports/maia-sim/t${tier}-${kind}-${brain}-${seed}.jsonl`, JSON.stringify(row) + "\n");
    console.log(JSON.stringify({ ...row, bossLoss: undefined, bossBest: undefined, playerLoss: undefined, bossMean: +(bossLoss.reduce((x, y) => x + y, 0) / Math.max(1, bossLoss.length)).toFixed(2) }));
  }
  engine.close();
  boss.close();
  judge.close();
  human?.close();
}

function summary() {
  const dir = root + "reports/maia-sim/";
  type Row = { brain: string; kind: string; tier: number; elo: number; maiaRating: number | null; score: number; maia: number; stockfish: number; vetoed: number; medianMs: number; bossLoss: number[]; bossBest: number[]; playerLoss: number[] };
  const rows: Row[] = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".jsonl"))
        .flatMap((f) => readFileSync(dir + f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row))
    : [];
  const groups = new Map<string, Row[]>();
  const order = (b: string) => BRAINS.indexOf(b as BossBrain);
  for (const r of [...rows].sort((a, b) => a.tier - b.tier || a.kind.localeCompare(b.kind) || order(a.brain) - order(b.brain))) {
    const k = `${r.tier} | ${r.kind} | ${r.brain}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const table = [...groups.entries()].map(([k, rs]) => {
    const n = rs.length;
    const score = rs.reduce((a, r) => a + r.score, 0);
    // (Only moves in a game still to be played: the boss's chances 15–85% before it. A won or lost position makes
    // every move look free.)
    const losses = rs.flatMap((r) => r.bossLoss.filter((_, i) => r.bossBest[i]! >= 0.15 && r.bossBest[i]! <= 0.85));
    const maiaMoves = rs.reduce((a, r) => a + r.maia, 0);
    const all = rs.reduce((a, r) => a + r.maia + r.stockfish, 0);
    const vetoed = rs.reduce((a, r) => a + r.vetoed, 0);
    const r0 = rs[0]!;
    const ms = rs.map((r) => r.medianMs).sort((a, b) => a - b)[n >> 1];
    const big = (t: number) => Math.round((100 * losses.filter((l) => l > t).length) / Math.max(1, losses.length));
    return `| ${k} | ${r0.elo}${r0.maiaRating ? ` (Maia ${r0.maiaRating})` : ""} | ${n} | ${score} / ${n} | ${mean(losses).toFixed(1)} | ${big(10)}% / ${big(25)}% | ${all ? Math.round((100 * maiaMoves) / all) : 0}% | ${vetoed} | ${ms} | ${mean(rs.flatMap((r) => r.playerLoss)).toFixed(1)} |`;
  });
  const md = [
    "# Maia-3 as Ginger's brain: sanity runs (Oct 11, 2026)",
    "",
    "Written by `npx tsx packages/sim/scripts/maia-sim.ts summary` from `reports/maia-sim/*.jsonl`. Boss alone as plain chess",
    "(Ginger's powers and the God King left out): a bot player (boss-sim.ts's kind: a skill temperature and some random",
    "moves) against Ginger at a tier (his offset, Normal), the boss on each brain (BOSS_BRAIN: Maia's draw at temperature",
    `${BOSS_BRAIN.temperature}, top-p ${BOSS_BRAIN.topP}). The same openings and colors for every brain; 60 player moves at most, then the`,
    "engine's verdict (75% or more: a win). Every boss move is scored as the judge scores a pick (its loss against the best,",
    "in points, at engineNodes); the loss columns count only moves in a game still to be played (the boss's chances 15–85%",
    "before it). (Stockfish judging Stockfish's own moves reads them kindly: compare the brains with each other.)",
    "Small samples: a sanity check, not a calibration.",
    "",
    "| Tier | Player | Brain | Ginger (strength) | Games | Player's score | Boss's mean loss | Boss moves over 10 / 25 points | Boss moves by Maia | Vetoed | Median boss move, ms | Player's mean loss |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...table,
    "",
    "## A few positions per brain",
    "",
    existsSync(dir + "positions.md") ? readFileSync(dir + "positions.md", "utf8") : "(not run)",
  ].join("\n");
  writeFileSync(root + "reports/maia-boss.md", md + "\n");
  console.log(md);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "positions") await positions();
else if (cmd === "games") await games(args[0] as BossBrain, Number(args[1] ?? 6), Number(args[2] ?? 1), Number(args[3] ?? 1600), args[4] ?? "club");
else if (cmd === "summary") summary();
else console.log("usage: maia-sim.ts positions | games <brain> <games> <seed> [tier] [club|casual|expert] | summary");
