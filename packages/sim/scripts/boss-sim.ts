/**
 * Calibrates the boss battle: a crowd of 10 bots (voting, the most popular pick
 * played) as White against Stockfish at UCI_Elo = the crowd's weighted rating +
 * an offset, with the boss striking down the worst recent mover every 3 crowd
 * moves (down to 3). Crowds of three strengths (expert, club and casual players,
 * modelled as bots that sometimes play a random move). The goal is a boss that's hard but beatable.
 *
 *   npx tsx packages/sim/scripts/boss-sim.ts run <expert|club|casual|beginner> <offsets,comma> <games> <seed> [stumble]
 *   npx tsx packages/sim/scripts/boss-sim.ts summary
 *
 * Results go to reports/boss-sim/*.jsonl; `summary` writes reports/boss-calibration.md.
 */
import { DEFAULT_SETTINGS, bossElo, bossStumbleChance, botPick, estimateRating, mulberry32, shuffle, type Rng } from "@chessroyale/core";
import { applyMove, bossMoveFrom, fenAfter, gameEnd, legalMoves, START_FEN, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const settings = DEFAULT_SETTINGS;
const CROWD_NODES = 150_000;
const MAX_MOVES = 60;
const KILL_EVERY = 3;
const MIN_SURVIVORS = 3;
/** Crowds of 10: each member's skill temperature, and how often they play a random legal move (human-like blunders). */
const spread = (lo: number, hi: number) => Array.from({ length: 10 }, (_, i) => lo * Math.pow(hi / lo, i / 9));
const CROWDS: Record<string, { skills: number[]; random: number }> = {
  expert: { skills: spread(1, 4), random: 0.02 },
  club: { skills: spread(6, 20), random: 0.06 },
  casual: { skills: spread(15, 40), random: 0.12 },
  beginner: { skills: spread(30, 90), random: 0.25 },
};

async function run(kind: string, offsets: number[], games: number, seed: number, stumble: boolean) {
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const engine = await createNodeEngine({ nodes: CROWD_NODES, hashMb: 16 });
  const boss = await createNodeEngine({ nodes: settings.bossNodes, hashMb: 16 });
  const rng = mulberry32(seed);
  const { skills, random } = CROWDS[kind]!;
  const pickSettings = { ...settings, botRandomMoveChance: random };
  const candidates = async (fen: string) => {
    const top = await engine.topMoves(fen, settings.botCandidateMoves);
    const best = top[0]!.expected;
    return { top, list: top.map((m) => ({ move: m.move, loss: Math.max(0, (best - m.expected) * 100) })) };
  };
  // The crowd's rating before the battle, from picks in positions like the game's.
  const warm: number[][] = skills.map(() => []);
  const positions = shuffle(rng, library.filter((o) => o.moves.length >= 10)).slice(0, 30);
  for (const o of positions) {
    const fen = fenAfter(o.moves.slice(0, 8 + Math.floor(rng() * 3)));
    const { list } = await candidates(fen);
    skills.forEach((skill, i) => {
      const move = botPick(rng, list, skill, legalMoves(fen), pickSettings);
      warm[i]!.push(list.find((c) => c.move === move)?.loss ?? 30);
    });
  }
  const rating = bossElo(warm.map((l) => estimateRating(l)), { bossEloOffset: 0, bossEloRange: [0, 9999] });
  console.log(`${kind} crowd rating ${rating}`);
  mkdirSync(root + "reports/boss-sim", { recursive: true });
  for (const offset of offsets) {
    for (let g = 0; g < games; g++) {
      // As the game does: the target strength (down to 800), Stockfish at no less than 1320, stumbling below 1700.
      const elo = stumble ? Math.max(settings.bossEloRange[0], Math.min(3190, rating + offset)) : Math.max(1320, Math.min(3190, rating + offset));
      const chance = stumble ? bossStumbleChance(elo, settings) : 0;
      const result = await battle(rng, skills, pickSettings, candidates, (fen) => bossMoveFrom(boss, fen, elo, settings.bossNodes, rng() < chance, rng));
      const row = { kind, rating, offset, elo, stumble, ...result };
      appendFileSync(root + `reports/boss-sim/${kind}-${seed}.jsonl`, JSON.stringify(row) + "\n");
      console.log(JSON.stringify(row));
    }
  }
  engine.close();
  boss.close();
}

async function battle(
  rng: Rng,
  skills: number[],
  pickSettings: typeof settings,
  candidates: (fen: string) => Promise<{ top: { move: string; expected: number }[]; list: { move: string; loss: number }[] }>,
  bossMove: (fen: string) => Promise<string>,
) {
  let history: string[] = [];
  let fen = START_FEN;
  let alive = skills.map((skill, i) => ({ i, skill, recent: [] as number[] }));
  let moves = 0;
  let lastExpected = 0.5;
  while (moves < MAX_MOVES && !gameEnd(START_FEN, history)) {
    const { top, list } = await candidates(fen);
    lastExpected = top[0]!.expected;
    const legal = legalMoves(fen);
    const picks = alive.map((p) => {
      const move = botPick(rng, list, p.skill, legal, pickSettings);
      p.recent.push(list.find((c) => c.move === move)?.loss ?? 30);
      return move;
    });
    const count = (m: string) => picks.filter((x) => x === m).length;
    const most = Math.max(...picks.map(count));
    const tied = [...new Set(picks.filter((m) => count(m) === most))];
    const played = tied[Math.floor(rng() * tied.length)]!;
    history = [...history, played];
    fen = applyMove(fen, played);
    moves++;
    if (moves % KILL_EVERY === 0 && alive.length > MIN_SURVIVORS) {
      const sum = (p: (typeof alive)[number]) => p.recent.slice(-KILL_EVERY).reduce((s, x) => s + x, 0);
      const victim = [...alive].sort((a, b) => sum(b) - sum(a))[0]!;
      alive = alive.filter((p) => p !== victim);
    }
    if (gameEnd(START_FEN, history)) break;
    const reply = await bossMove(fen);
    history = [...history, reply];
    fen = applyMove(fen, reply);
  }
  const end = gameEnd(START_FEN, history);
  let result: "crowd" | "boss" | "draw";
  if (end === "checkmate") result = fen.split(" ")[1] === "b" ? "crowd" : "boss";
  else if (end) result = "draw";
  else {
    // The move cap: the engine's verdict (White's expected score from the last crowd search).
    result = lastExpected >= 0.6 ? "crowd" : lastExpected <= 0.4 ? "boss" : "draw";
  }
  return { result, moves, ended: end ?? "cap" };
}

function summary() {
  const dir = root + "reports/boss-sim";
  const rows = readdirSync(dir).flatMap((f) =>
    readFileSync(`${dir}/${f}`, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { kind: string; rating: number; offset: number; elo: number; result: string; moves: number; ended: string; stumble?: boolean }),
  );
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.kind}|${r.offset}|${r.stumble ? "s" : ""}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const lines = [
    "# Boss battle calibration",
    "",
    `A crowd of 10 bots (the most popular pick played, ${CROWD_NODES.toLocaleString("en-US")}-node candidate search) as White against Stockfish at UCI_Elo = the crowd's weighted rating + offset (${settings.bossNodes.toLocaleString("en-US")} nodes), with the boss striking down the worst recent mover every ${KILL_EVERY} crowd moves down to ${MIN_SURVIVORS}, capped at ${MAX_MOVES} crowd moves (then the engine's verdict: 60%+ wins). Generated by \`packages/sim/scripts/boss-sim.ts\`.`,
    "",
    "Rows marked *stumbles* use the game's boss: the target strength can go down to 800; Stockfish plays at 1320 or more, and below 2100 the boss sometimes plays a random legal move instead (chance (2100 − target) / 1000, at most 40% in these runs; the game ships with at most 25%, since weak crowds still won 6–7 of 8 at 40%). Earlier tries, replaced here: a random top-5 move below 1700, and a random legal move below 1900, still lost nearly every game for these crowds; a random legal move below 2300 (chance / 800, at most 50%) went too far the other way (club and casual crowds won 7 of 8, beginners 4 of 8).",
    "",
    "| Crowd | Crowd rating | Offset | Boss | Boss Elo | Games | Crowd wins | Draws | Boss wins | Avg moves |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  const order = ["expert", "club", "casual", "beginner"];
  for (const [key, rs] of [...groups].sort(([a], [b]) => {
    const [ka, oa] = a.split("|");
    const [kb, ob] = b.split("|");
    return order.indexOf(ka!) - order.indexOf(kb!) || a.split("|")[2]!.localeCompare(b.split("|")[2]!) || Number(oa) - Number(ob);
  })) {
    const [kind, offset, st] = key.split("|");
    const n = rs.length;
    const pct = (k: string) => `${Math.round((100 * rs.filter((r) => r.result === k).length) / n)}%`;
    const avg = Math.round(rs.reduce((s, r) => s + r.moves, 0) / n);
    lines.push(`| ${kind} | ${rs[0]!.rating} | ${Number(offset) >= 0 ? "+" : ""}${offset} | ${st ? "stumbles" : "plain"} | ${Math.round(rs.reduce((s, r) => s + r.elo, 0) / n)} | ${n} | ${pct("crowd")} | ${pct("draw")} | ${pct("boss")} | ${avg} |`);
  }
  writeFileSync(root + "reports/boss-calibration.md", lines.join("\n") + "\n");
  console.log(lines.join("\n"));
}

const [cmd, kind, offsets, games, seed, mode] = process.argv.slice(2);
if (cmd === "summary") summary();
else await run(kind ?? "club", (offsets ?? "0").split(",").map(Number), Number(games ?? 4), Number(seed ?? 1), mode === "stumble");
