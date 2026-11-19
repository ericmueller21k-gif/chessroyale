/**
 * The Battle Tower's climb sim (PR 14; docs/decisions/2026-11-18-battle-tower-design.md, section 3 and section 7's row 14):
 * a bot climber at one strength climbs from floor 1 with the real deal (core tower.ts: newRun, startFloor, finishFloor), each
 * floor a real battle through the match runner as solo plays one (the boss kit's driver, boss-kit-lib.ts runBattle, without its
 * invariants), every boss on the floor's brain and strength (Maia at the floor's rating), until a loss, a draw or floor 50 won
 * (Maia's floors; Stockfish's 51 to 99 are left for later).
 *
 * The climber: Maia-3 at the climber's rating (the human-like stand-in for a player of that rating), among the moves the bosses'
 * powers allow. It doesn't know the powers; it never calls the God King, votes Chandy's Dodge right, and has no clock (Dash's and
 * the timed powers run on the runner's own clock).
 *
 * CLIMBER picks the climber (Eric, Nov 20: "wouldn't these 700-800 ELO bots just be making terrible mistakes?"):
 * - `maia` (the default, the first run): Maia sampled the way the bosses are (BOSS_BRAIN's temperature and top-p), so even "2500"
 *   draws a human-like move at random, mistakes and all.
 * - `maia-best`: Maia's likeliest move at the rating, no sampling (a steadier player of that rating).
 * - `stockfish`: Stockfish at full strength among the allowed moves (`TOWER_NODES`, default 200k): the ceiling, what only the
 *   powers and the rules can beat.
 * Each floor also records how it ended (`how`: mate, the move cap, stalemate, a power's kill, …) and its last position.
 *
 *   CLIMBER=<climber> npx tsx packages/sim/scripts/tower-sim.ts run <rating> <runs> <seed>   appends to reports/tower-sim/<climber>-<rating>.jsonl
 *   (the first run's files, `<rating>.jsonl`, are `maia`)
 *   npx tsx packages/sim/scripts/tower-sim.ts summary                        prints the tables for reports/tower-sim.md
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BATTLE_TOWER, BOSS_ALONE_SCORING, BOSS_BRAIN, DEFAULT_SETTINGS, RAID_SETTINGS, finishFloor, floorStrength, mulberry32, newRun, startFloor, towerPool, type Settings } from "@chessroyale/core";
import { Chess } from "chess.js";
import { HumanUciEngine, MatchRunner, legalMoves, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { maiaProcess } from "../src/maia-process.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = root + "reports/tower-sim/";
const LAST_FLOOR = Number(process.env.TOWER_LAST ?? 50);
/**
 * A try at another climb (Eric, Nov 20: "give it a couple tests"): the Maia floors' steps as JSON rows, [[from floor, + a floor], …]
 * (BATTLE_TOWER.maiaSteps' shape), and a short name for the files. Unset: the settings' own.
 */
const STEPS = process.env.TOWER_STEPS ? (JSON.parse(process.env.TOWER_STEPS) as [number, number][]) : null;
const CURVE = process.env.TOWER_CURVE ?? (STEPS ? "try" : "");
/**
 * Lives (Eric, Nov 20: "add 2 lives, but it doesn't make you replay. You just win the floor"): a floor lost or drawn costs one and the
 * climb goes on; the run ends at a loss with none left. 0: the rule today (out at the first). The first loss is in the rows either way.
 */
const LIVES = Number(process.env.TOWER_LIVES ?? 0);
type Climber = "maia" | "maia-best" | "stockfish";
const CLIMBER = (process.env.CLIMBER ?? "maia") as Climber;
const CLIMBER_NODES = Number(process.env.TOWER_NODES ?? 200_000);
const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];

interface FloorRow {
  floor: number;
  bosses: string[];
  rating: number;
  result: "crowd" | "boss" | "draw" | "stuck";
  moves: number;
  sec: number;
  /** How the floor ended (the reruns of Nov 20 on): mate, cap (the move cap), stalemate, draw (another draw), other. */
  how?: string;
  fen?: string;
}

// (The runner reads a floor's strength from BATTLE_TOWER itself, so a try sets it there, in this process only.)
if (STEPS) (BATTLE_TOWER as { maiaSteps: readonly (readonly [number, number])[] }).maiaSteps = STEPS;
const rules = BATTLE_TOWER;
const tag = `${CLIMBER}${CURVE ? `-${CURVE}` : ""}${LIVES ? `-lives${LIVES}` : ""}`;

async function climb(rating: number, runs: number, seed: number) {
  mkdirSync(out, { recursive: true });
  const engine = await createNodeEngine({ nodes: DEFAULT_SETTINGS.bossNodes, hashMb: 16 });
  const maia = new HumanUciEngine(maiaProcess());
  if (!(await maia.init())) throw new Error(`Maia didn't load: ${maia.error}`);
  const pool = towerPool();
  for (let k = 0; k < runs; k++) {
    const runSeed = seed * 1000 + k;
    let run = newRun(runSeed, pool, rules);
    const floors: FloorRow[] = [];
    let lives = LIVES;
    while (run.status === "open" && run.floors.length <= LAST_FLOOR) {
      const start = startFloor(run, pool, rules)!;
      run = start.run;
      const floor = run.floors.length;
      const t0 = Date.now();
      const row = await battle(start.settings, runSeed * 100 + floor, rating, engine, maia);
      const bosses = [...run.floors[floor - 1]!];
      floors.push({ floor, bosses, rating: floorStrength(floor, bosses.length, rules).rating, ...row, sec: Math.round((Date.now() - t0) / 1000) });
      console.log(`${rating} run ${k} floor ${floor} ${bosses.join("+")}: ${row.result} in ${row.moves}`);
      // (A life spent: the floor counts as climbed, the bosses' strength goes on rising.)
      const spend = row.result !== "crowd" && lives > 0;
      if (spend) lives--;
      run = finishFloor(run, row.result === "crowd" || spend ? "won" : row.result === "draw" ? "drawn" : "lost", pool, rules);
      if (floor === LAST_FLOOR) break;
    }
    appendFileSync(out + `${tag}-${rating}.jsonl`, JSON.stringify({ rating, climber: tag, seed: runSeed, floors }) + "\n");
  }
  engine.close?.();
  process.exit(0);
}

/** One floor through the runner, as the kit's driver plays it; the climber's moves Maia's at `rating`. */
async function battle(floorSettings: Partial<Settings>, seed: number, rating: number, engine: Awaited<ReturnType<typeof createNodeEngine>>, maia: HumanUciEngine) {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...RAID_SETTINGS,
    ...BOSS_ALONE_SCORING,
    bossNoStrikes: true,
    hollowBulbs: true,
    bossDifficulty: 0,
    bossAloneMaia: 0,
    bossHidden: false,
    bossUnfinished: false,
    ...floorSettings,
  } as Settings;
  const engines = [engine];
  const r = new MatchRunner({ settings, rng: mulberry32(seed), engines, library, entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: "w" });
  const plan = r.bossBrainPlan("", true)!;
  if (plan.brain !== "stockfish" && plan.rating !== null) r.humanBrain = { brain: plan.brain, rating: plan.rating, engine: maia };
  const opts = { temperature: BOSS_BRAIN.temperature, topP: BOSS_BRAIN.topP, multipv: 1 };
  const fen = () => r.boards.get(r.state.boards[0]!)!.fen;
  if (process.env.TOWER_DEBUG) console.log("start", fen(), r.state.bosses?.map((b) => b.elo) ?? r.boss?.elo, plan);
  for (let i = 0; i < 600 && !r.isOver(); i++) {
    if (r.stageComplete() && process.env.TOWER_DEBUG) console.log("end", fen(), r.boards.get(r.state.boards[0]!)!.history.length);
    if (r.stageComplete()) {
      const end = fen();
      const result = r.finishBossBattle() as "crowd" | "boss" | "draw";
      return { result, moves: r.boss!.crowdMoves, how: howItEnded(end, r.boss!.crowdMoves, settings), fen: end };
    }
    if (r.bossToMove()) {
      if (r.lightsOutDue()) (r.startLightsOut(), r.finishLightsOut({}));
      if (r.bounceDue()) await r.playBounce(engines).catch(() => r.applyBounce(null));
      for (let s = 0; s < 3 && r.alfilStep(); s++) await r.playAlfil(engines).catch(() => r.applyAlfil(null));
      if (r.bossToMove() && r.carrotDue()) r.applyCarrots();
      if (r.bossToMove() && r.repaintDue()) await r.playRepaint(engines).catch(() => r.applyRepaint(null));
      if (r.bossToMove() && r.waterDue()) await r.playWater(engines).catch(() => r.applyWater(null));
      if (r.bossToMove() && r.hopDue()) await r.playHop(engines).catch(() => r.applyHop(null));
      if (r.bossToMove() && r.queenLockDue()) await r.playQueenLock(engines).catch(() => r.applyQueenLock(null));
      if (r.bossToMove()) await r.playBoss(engines[0]);
      continue;
    }
    if (r.dodgeDue()) {
      const d = r.boss!.powers!.chandy!.dodge!;
      r.finishDodgeRound({ [r.alive()[0]!.id]: d.rounds[d.results.length]!.safe });
      continue;
    }
    if (r.rushDue()) {
      r.finishRush({});
      continue;
    }
    if (r.extraMoveDue()) {
      await r.playExtraMove(engines[0]);
      continue;
    }
    if (r.funhouseDue()) {
      await r.playFunhouse(engines[0]).catch(() => r.applyFunhouse(""));
      continue;
    }
    r.deal();
    const at = fen();
    const allowed = r.crowdAllowed() ?? legalMoves(at);
    let move: string;
    if (r.darkForcedDue()) move = await r.playDarkForced(engines[0]);
    else if (CLIMBER === "stockfish") move = (await engine.topMovesAt(at, 1, CLIMBER_NODES, allowed))[0]?.move ?? allowed[0]!;
    else {
      const pick = CLIMBER === "maia-best" ? { temperature: 0.01, topP: 0.01, multipv: 1 } : opts;
      const a = await maia.candidates(at, rating, allowed, { ...pick, seed: Math.floor(mulberry32(seed + i)() * 2 ** 31) + 1 });
      move = a?.best && allowed.includes(a.best) ? a.best : allowed[0]!;
    }
    await r.score(new Map([[r.alive()[0]!.id, { move, thinkMs: 5000 }]]));
    if (r.bossKillDue()) r.bossKill();
  }
  return { result: "stuck" as const, moves: r.boss?.crowdMoves ?? 0 };
}

/** How a floor ended, from its last position: mate, stalemate, the move cap, insufficient material, or other (a power's kill, …). */
function howItEnded(end: string, moves: number, settings: Settings): string {
  const c = new Chess(end);
  if (c.isCheckmate()) return c.turn() === "w" ? "mated" : "mate";
  if (c.isStalemate()) return "stalemate";
  if (c.isInsufficientMaterial()) return "material";
  const cap = (settings as Settings & { crowdMoveLimit?: number }).crowdMoveLimit;
  if (cap && moves >= cap) return "cap";
  return "other";
}

function summary() {
  const files = existsSync(out) ? readdirSync(out).filter((f) => f.endsWith(".jsonl")) : [];
  const runs = files.flatMap((f) => readFileSync(out + f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as { rating: number; climber?: string; floors: FloorRow[] }))
    .map((r) => ({ ...r, key: `${r.climber ?? "maia"} ${r.rating}` }));
  const ratings = [...new Set(runs.map((r) => r.key))].sort();
  console.log("| Climber | Runs | Floors won: median (min to max) | Fell on |\n| --- | --- | --- | --- |");
  for (const rt of ratings) {
    const rs = runs.filter((r) => r.key === rt);
    const won = rs.map((r) => r.floors.filter((f) => f.result === "crowd").length).sort((a, b) => a - b);
    const fell = rs.map((r) => r.floors.at(-1)!).filter((f) => f.result !== "crowd").map((f) => `${f.floor} (${f.bosses.length}, ${f.result === "boss" ? "lost" : f.result})`);
    console.log(`| ${rt} | ${rs.length} | ${won[Math.floor(won.length / 2)]} (${won[0]} to ${won.at(-1)}) | ${fell.join(", ")} |`);
  }
  console.log("\n| Climber | 1 boss won | 2 bosses won | 3 bosses won | Moves a floor (median) |\n| --- | --- | --- | --- | --- |");
  for (const rt of ratings) {
    const fs = runs.filter((r) => r.key === rt).flatMap((r) => r.floors);
    const rate = (n: number) => {
      const x = fs.filter((f) => f.bosses.length === n);
      return x.length ? `${x.filter((f) => f.result === "crowd").length}/${x.length}` : "-";
    };
    const mv = fs.map((f) => f.moves).sort((a, b) => a - b);
    console.log(`| ${rt} | ${rate(1)} | ${rate(2)} | ${rate(3)} | ${mv[Math.floor(mv.length / 2)]} |`);
  }
  console.log("\nBy boss rating faced (all climbers): rating: won/played");
  const fs = runs.flatMap((r) => r.floors.map((f) => ({ ...f, climber: r.key })));
  for (const rt of ratings) {
    const by = new Map<number, [number, number]>();
    for (const f of fs.filter((x) => x.climber === rt)) {
      const e = by.get(f.rating) ?? [0, 0];
      by.set(f.rating, [e[0] + (f.result === "crowd" ? 1 : 0), e[1] + 1]);
    }
    console.log(`${rt}: ` + [...by].sort((a, b) => a[0] - b[0]).map(([k, [w, n]]) => `${k} ${w}/${n}`).join(", "));
  }
  const losses = new Map<string, [number, number]>();
  for (const f of fs) for (const b of f.bosses) {
    const e = losses.get(b) ?? [0, 0];
    losses.set(b, [e[0] + (f.result === "crowd" ? 0 : 1), e[1] + 1]);
  }
  console.log("\nHow floors not won ended (climber: how count):");
  for (const rt of ratings) {
    const by = new Map<string, number>();
    for (const f of fs.filter((x) => x.climber === rt && x.result !== "crowd")) by.set(`${f.result} ${f.how ?? "?"}`, (by.get(`${f.result} ${f.how ?? "?"}`) ?? 0) + 1);
    console.log(`${rt}: ` + [...by].map(([k, n]) => `${k} ${n}`).join(", "));
  }
  console.log("\nBy boss: floors lost/met: " + [...losses].sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1]).map(([b, [l, n]]) => `${b} ${l}/${n}`).join(", "));
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "run") await climb(Number(args[0]), Number(args[1] ?? 10), Number(args[2] ?? 1));
else if (cmd === "summary") summary();
else console.log("usage: tower-sim.ts run <rating> <runs> <seed> | summary");
