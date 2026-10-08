/**
 * The fair-play simulation's position bank: Crowd games as a crowd plays them, every position analysed once.
 *
 * Each game starts from the starting position (as Crowd does). At every ply:
 *   - the judge's numbers: the top 8 moves at the game's engine budget (250k nodes, the browser build), exactly what
 *     a lobby's judges compute, and the same search over any other move a simulated player might pick;
 *   - Stockfish's own MultiPV-4 lines at each depth 1-11 (the input of its limited-strength pick: honest players at
 *     any UCI_Elo up to about 2800, see src/skill.ts);
 *   - a cheater's engine: the full-network build's top 3 moves at 1M nodes (a strong engine app on a second screen);
 * then the crowd moves on: 50 honest players (UCI_Elo ~ N(1500, 350)) pick and the most popular move is played.
 *
 *   npx tsx packages/sim/scripts/fairplay-bank.ts <worker> <workers> <games>   # one file per game, resumable
 *   npx tsx packages/sim/scripts/fairplay-bank.ts pack                        # -> packages/sim/data/fairplay-bank.json.gz
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS, mulberry32 } from "@chessroyale/core";
import { START_FEN, applyMove, gameEnd, legalMoves } from "@chessroyale/chess";
import { STOCKFISH_FULL_BUILD, createNodeEngine, nodeTransport } from "@chessroyale/chess/node";
import { internalFromCp, internalFromMate, randUint, sfMaterial, skillPick, pickDepth } from "../src/skill.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const dir = root + "packages/sim/data/fairplay-bank/";
export const BANK_FILE = root + "packages/sim/data/fairplay-bank.json.gz";
const MAX_PLY = 48;
const SHALLOW_DEPTH = 11;
const CHEAT_NODES = 1_000_000;

/** One analysed position. Expected scores are the mover's (0-1); `sh[d]` are depth d's lines, internal units. */
export interface BankPosition {
  ply: number;
  fen: string;
  /** The move that led here (UCI), and whether it captured. */
  last: string | null;
  lastCap: boolean;
  legal: number;
  /** The judge's top moves, best first, and its numbers for other moves. */
  top: [string, number][];
  extra: Record<string, number>;
  sh: Record<number, [string, number][]>;
  /** The cheater's engine: its top 3, best first. */
  cheat: string[];
  /** The move the crowd played. */
  played: string;
}
export interface BankGame {
  g: number;
  positions: BankPosition[];
}

if (process.argv[2] === "pack") {
  const games = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(dir + f, "utf8")) as BankGame)
    .sort((a, b) => a.g - b.g);
  writeFileSync(BANK_FILE, gzipSync(JSON.stringify(games)));
  console.log(`${games.length} games, ${games.reduce((s, g) => s + g.positions.length, 0)} positions -> ${BANK_FILE}`);
  process.exit(0);
}

const worker = Number(process.argv[2] ?? 0);
const workers = Number(process.argv[3] ?? 1);
const total = Number(process.argv[4] ?? 8);
mkdirSync(dir, { recursive: true });

/** A raw UCI engine for the multi-depth search and the cheater's engine. */
async function rawEngine(build?: string, hash = 16) {
  const t = nodeTransport(build);
  let waiting: { test: (l: string) => boolean; resolve: (l: string[]) => void; lines: string[] } | null = null;
  t.onLine((l) => {
    if (!waiting) return;
    waiting.lines.push(l);
    if (waiting.test(l)) {
      const w = waiting;
      waiting = null;
      w.resolve(w.lines);
    }
  });
  const until = (test: (l: string) => boolean) => new Promise<string[]>((resolve) => (waiting = { test, resolve, lines: [] }));
  let r = until((l) => l === "uciok");
  t.send("uci");
  await r;
  for (const c of ["setoption name Threads value 1", `setoption name Hash value ${hash}`]) t.send(c);
  r = until((l) => l === "readyok");
  t.send("isready");
  await r;
  return {
    async go(fen: string, multipv: number, go: string): Promise<string[]> {
      t.send("ucinewgame");
      t.send(`setoption name MultiPV value ${multipv}`);
      const ready = until((l) => l === "readyok");
      t.send("isready");
      await ready;
      t.send(`position fen ${fen}`);
      const done = until((l) => l.startsWith("bestmove"));
      t.send(go);
      return done;
    },
    close: () => t.close(),
  };
}

interface Info {
  depth: number;
  multipv: number;
  move: string;
  cp: number | null;
  mate: number | null;
}
function parse(line: string): Info | null {
  if (!line.startsWith("info depth") || !line.includes(" pv ") || / (lower|upper)bound/.test(line)) return null;
  const d = line.match(/ depth (\d+)/);
  const mpv = line.match(/ multipv (\d+)/);
  const cp = line.match(/ score cp (-?\d+)/);
  const mate = line.match(/ score mate (-?\d+)/);
  const pv = line.match(/ pv (\S+)/);
  if (!d || !pv || (!cp && !mate)) return null;
  return { depth: Number(d[1]), multipv: mpv ? Number(mpv[1]) : 1, move: pv[1]!, cp: cp ? Number(cp[1]) : null, mate: mate ? Number(mate[1]) : null };
}

const judge = await createNodeEngine({ nodes: DEFAULT_SETTINGS.engineNodes, hashMb: DEFAULT_SETTINGS.engineHashMb });
const shallow = await rawEngine();
const cheater = await rawEngine(STOCKFISH_FULL_BUILD, 64);

for (let g = worker; g < total; g += workers) {
  const file = `${dir}${String(g).padStart(3, "0")}.json`;
  if (existsSync(file)) continue;
  const rng = mulberry32(1000 + g);
  const rand = randUint(rng);
  const positions: BankPosition[] = [];
  let fen = START_FEN;
  const history: string[] = [];
  const t0 = Date.now();
  for (let ply = 0; ply < MAX_PLY; ply++) {
    if (gameEnd(START_FEN, history)) break;
    const legal = legalMoves(fen);
    // Stockfish's lines at each depth (its limited-strength input).
    const material = sfMaterial(fen);
    const byDepth = new Map<number, Map<number, [string, number]>>();
    for (const l of await shallow.go(fen, 4, `go depth ${SHALLOW_DEPTH}`)) {
      const info = parse(l);
      if (!info) continue;
      const v = info.mate !== null ? internalFromMate(info.mate) : internalFromCp(info.cp!, material);
      if (!byDepth.has(info.depth)) byDepth.set(info.depth, new Map());
      byDepth.get(info.depth)!.set(info.multipv, [info.move, v]);
    }
    const sh: Record<number, [string, number][]> = {};
    for (const [d, lines] of byDepth) sh[d] = [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => x).sort((a, b) => b[1] - a[1]);
    // The cheater's engine.
    const cheatLines = new Map<number, string>();
    for (const l of await cheater.go(fen, 3, `go nodes ${CHEAT_NODES}`)) {
      const info = parse(l);
      if (info) cheatLines.set(info.multipv, info.move);
    }
    const cheat = [...cheatLines.entries()].sort((a, b) => a[0] - b[0]).map(([, m]) => m);
    // The judge: top 8, then everything else anyone might pick.
    const topScores = await judge.topMoves(fen, DEFAULT_SETTINGS.botCandidateMoves);
    const top: [string, number][] = topScores.map((m) => [m.move, m.expected]);
    const have = new Set(top.map(([m]) => m));
    const wanted = new Set<string>([...cheat, ...Object.values(sh).flatMap((ls) => ls.map(([m]) => m))]);
    const missing = [...wanted].filter((m) => !have.has(m) && legal.includes(m));
    const extra: Record<string, number> = {};
    if (missing.length) for (const s of await judge.scoreMoves(fen, missing)) extra[s.move] = s.expected;
    // The crowd plays on: 50 honest players, the most popular pick.
    const counts = new Map<string, number>();
    for (let i = 0; i < 50; i++) {
      const u1 = Math.max(1e-9, rng());
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng());
      const elo = Math.max(1000, Math.min(2800, 1500 + 350 * z));
      const d = Math.min(SHALLOW_DEPTH, pickDepth(elo));
      const lines = sh[d] ?? sh[Math.max(...Object.keys(sh).map(Number))]!;
      const m = skillPick(lines, elo, rand);
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    const most = Math.max(...counts.values());
    const tied = [...counts.entries()].filter(([, c]) => c === most).map(([m]) => m);
    const played = tied[Math.floor(rng() * tied.length)]!;
    const last = history[history.length - 1] ?? null;
    const prevFen = positions[positions.length - 1]?.fen;
    const lastCap = !!(last && prevFen && isCapture(prevFen, last));
    positions.push({ ply, fen, last, lastCap, legal: legal.length, top, extra, sh, cheat, played });
    history.push(played);
    fen = applyMove(fen, played);
  }
  writeFileSync(file, JSON.stringify({ g, positions } satisfies BankGame));
  console.log(`game ${g}: ${positions.length} positions in ${Math.round((Date.now() - t0) / 1000)} s`);
}
judge.close();
shallow.close();
cheater.close();

/** Whether a move captures (a piece on the target square, or en passant). */
function isCapture(fen: string, uci: string): boolean {
  const board = fen.split(" ")[0]!.split("/");
  const file = uci.charCodeAt(2) - 97;
  const rank = 8 - Number(uci[3]);
  let col = 0;
  for (const c of board[rank]!) {
    if (/\d/.test(c)) col += Number(c);
    else {
      if (col === file) return true;
      col++;
    }
  }
  // En passant: a pawn moving diagonally to the en-passant square.
  const ep = fen.split(" ")[3];
  return ep === uci.slice(2, 4) && uci[0] !== uci[2];
}
