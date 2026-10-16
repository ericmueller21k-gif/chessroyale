/**
 * A pick scored above the judge's best move (docs/decisions/2026-10-16-the-best-move-is-the-highest-scored.md): how
 * often it happens, by how much, and whether a deeper, like-for-like search agrees with it.
 *
 * The judge's best move was the first line of its top-8 search (MultiPV 8 at 250k nodes: about an eighth of the budget
 * a move). Every pick outside those 8 is scored by a second search restricted to those picks (`scoreMoves`), so each
 * gets far more of the budget, and a top-8 line other than the first can score higher too (a line not yet searched
 * again at the last depth keeps the last depth's score). Either way a pick can come out above the best move's number.
 *
 * Positions and picks as the game makes them, through the judge's own code (`runQuickJob`, `judgedBoard`):
 *   - crowd: Crowd 50 v 50 from the starting position. Each turn the side to move's team votes: its bots (skills spread
 *     as a lobby's, `botSkillSpread`, the weakest going out at each cut as CROWD_KNOCKOUTS' boss ending) pick from the
 *     job's seed exactly as a judge does (`judgeBotPicks`: 2% of picks a random legal move), plus two people: one plays
 *     the engine's first line (as the e2e tests do), one plays like a decent player (skill 4) with a 15% chance of a
 *     random legal move (a stand-in for a person's own idea; a random move is worse on average than a person's). The
 *     most popular pick is played. Up to 64 plies.
 *   - classic: a library opening 4 moves in, then a group of 8 (6 bots, the same two people), the board's move drawn
 *     at random from the picks (Classic's first stages), so positions get messier. Up to 40 plies.
 * Wherever a pick scores above the best move's number, the best move and those picks are searched again together:
 *   - lite: the device's re-check (the lite build at 700k nodes, `scoreMovesAt`)
 *   - full: the engine server's stand-in (the full-network build at 2M nodes), as reports/deep-accuracy.md uses it
 *
 *   npx tsx packages/sim/scripts/best-move-gap.ts run <games> <seed> [engines=3]
 *   npx tsx packages/sim/scripts/best-move-gap.ts summary      -> reports/best-move-gap.md
 * (The data behind the report is committed gzipped: reports/best-move-gap/seedN.jsonl.gz.)
 */
import { CROWD_KNOCKOUTS, DEFAULT_SETTINGS, OPENING_ALLOWANCE, botPick, botSkillSpread, mulberry32, openingAllowance, shuffle, type Rng } from "@chessroyale/core";
import { START_FEN, applyMove, fenAfter, gameEnd, judgedBoard, legalMoves, materialSlips, moveNumber, runQuickJob, type JudgeJob, type MoveScore, type Opening } from "@chessroyale/chess";
import { STOCKFISH_FULL_BUILD, createNodeEngine } from "@chessroyale/chess/node";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = root + "reports/best-move-gap/";
const RULES = { botCandidateMoves: DEFAULT_SETTINGS.botCandidateMoves, botRandomMoveChance: DEFAULT_SETTINGS.botRandomMoveChance, botPowerUpLoss: DEFAULT_SETTINGS.botPowerUpLoss };

type Pair = [string, number];
interface Row {
  kind: "crowd" | "classic";
  game: number;
  ply: number;
  fen: string;
  /** The top-8 search, in the engine's order (the first line first). */
  top: Pair[];
  /** The second search: picks outside the top 8. */
  extra: Pair[];
  /** The people's picks: the engine's first line, then the decent player's (`ownIdea`: a random legal move). */
  people: [string, string];
  ownIdea: boolean;
  /** The bots' picks, counted. */
  bots: Record<string, number>;
  /** Picks scored above the first line, with the gap in points and where they were scored (rank in the top 8, or -1). */
  overs: { move: string; gap: number; rank: number }[];
  /** The like-for-like searches of the first line and the overs: the device's re-check, the server's stand-in. */
  lite?: Pair[];
  full?: Pair[];
}

const pairs = (xs: readonly MoveScore[]): Pair[] => xs.map((m) => [m.move, Math.round(m.expected * 1e6) / 1e6]);

async function run(games: number, seed: number, engineCount: number) {
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const classic = library.filter((o) => !o.unusual && o.moves.length >= 10);
  const workers = await Promise.all(
    Array.from({ length: engineCount }, async () => ({
      lite: await createNodeEngine({ nodes: DEFAULT_SETTINGS.engineNodes, hashMb: 16 }),
      full: await createNodeEngine({ nodes: DEFAULT_SETTINGS.engineNodes, hashMb: 64 }, STOCKFISH_FULL_BUILD),
    })),
  );
  mkdirSync(out, { recursive: true });
  const file = `${out}seed${seed}.jsonl`;
  const plan = Array.from({ length: games }, (_, i) => {
    const rng = mulberry32(seed * 1000 + i);
    const kind = i % 3 === 2 ? ("classic" as const) : ("crowd" as const);
    const o = classic[Math.floor(rng() * classic.length)]!;
    return { i, kind, fen: kind === "crowd" ? START_FEN : fenAfter(o.moves.slice(0, 8)), rng };
  });
  let next = 0;
  let done = 0;
  await Promise.all(
    workers.map(async (w) => {
      while (next < plan.length) {
        const g = plan[next++]!;
        await playGame(w, g.i, g.kind, g.fen, g.rng, file);
        console.log(`game ${++done}/${plan.length} (${g.kind})`);
      }
    }),
  );
  for (const w of workers) {
    w.lite.close();
    w.full.close();
  }
}

type Engine = Awaited<ReturnType<typeof createNodeEngine>>;

async function playGame(w: { lite: Engine; full: Engine }, game: number, kind: Row["kind"], start: string, rng: Rng, file: string) {
  // Crowd: each team's bots, strongest first; the weakest go out at each cut (from ply 20, every 2 plies).
  const skills = shuffle(rng, botSkillSpread(100));
  const teams = [skills.filter((_, i) => i % 2 === 0).sort((a, b) => a - b), skills.filter((_, i) => i % 2 === 1).sort((a, b) => a - b)];
  const cuts = CROWD_KNOCKOUTS.boss;
  let alive = 100;
  let fen = start;
  const maxPlies = kind === "crowd" ? 64 : 40;
  for (let ply = 0; ply < maxPlies && !gameEnd(fen, []) && legalMoves(fen).length >= 2; ply++) {
    if (kind === "crowd" && ply >= 20 && ply % 2 === 0) alive = Math.max(4, alive - (cuts[(ply - 20) / 2] ?? 0));
    const side = fen.split(" ")[1] === "w" ? 0 : 1;
    const botSkills = kind === "crowd" ? teams[side]!.slice(0, Math.max(0, Math.ceil(alive / 2) - 2)) : shuffle(rng, skills).slice(0, 6);
    const top = await w.lite.topMoves(fen, RULES.botCandidateMoves);
    if (!top.length) break;
    // The people: the engine's first line, and a decent player with ideas of their own now and then.
    const legal = legalMoves(fen);
    const ownIdea = rng() < 0.15;
    const decent = ownIdea ? legal[Math.floor(rng() * legal.length)]! : botPick(rng, top.map((m) => ({ move: m.move, loss: Math.max(0, (top[0]!.expected - m.expected) * 100) })), 4, legal, { ...DEFAULT_SETTINGS, botRandomMoveChance: 0 });
    const people: [string, string] = [top[0]!.move, decent];
    const job: JudgeJob = { id: `${game}:${ply}`, fen, picks: [...people].sort(), bots: botSkills.map((s) => ({ skill: s, powerUps: 0 })), seed: Math.floor(rng() * 2 ** 31), rules: RULES };
    const report = await runQuickJob(w.lite, job, top);
    const board = judgedBoard(job, report);
    if (!board) throw new Error(`judgedBoard failed at ${fen}`);
    const picks = [...people, ...board.botPicks];
    const firstMove = report.top[0]!.move;
    const first = report.top[0]!.expected;
    const ranks = new Map(report.top.map((m, i) => [m.move, i]));
    const overs = [...new Set(picks)]
      .filter((m) => board.expectedAfter[m]! > first + 1e-12)
      .map((m) => ({ move: m, gap: Math.round((board.expectedAfter[m]! - first) * 100 * 1000) / 1000, rank: ranks.get(m) ?? -1 }));
    const bots: Record<string, number> = {};
    for (const m of board.botPicks) bots[m] = (bots[m] ?? 0) + 1;
    const row: Row = { kind, game, ply, fen, top: pairs(report.top), extra: pairs(report.extra), people, ownIdea, bots, overs };
    if (overs.length) {
      const moves = [firstMove, ...overs.map((o) => o.move)];
      row.lite = pairs(await w.lite.scoreMovesAt(fen, moves, DEFAULT_SETTINGS.recheckNodes));
      row.full = pairs(await w.full.scoreMovesAt(fen, moves, 2_000_000));
    }
    appendFileSync(file, JSON.stringify(row) + "\n");
    // The move played: Crowd's most popular pick (a tie drawn at random), Classic's random draw.
    let played: string;
    if (kind === "crowd") {
      const count = new Map<string, number>();
      for (const m of picks) count.set(m, (count.get(m) ?? 0) + 1);
      const most = Math.max(...count.values());
      const tied = [...count.keys()].filter((m) => count.get(m) === most);
      played = tied[Math.floor(rng() * tied.length)]!;
    } else played = picks[Math.floor(rng() * picks.length)]!;
    fen = applyMove(fen, played);
  }
}

// ---------------- Summary ----------------

const pct = (a: number, b: number, digits = 1) => (b ? `${((100 * a) / b).toFixed(digits)}%` : "–");
const q = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};
const f = (x: number, d = 1) => (Number.isNaN(x) ? "–" : x.toFixed(d));

function rows(): Row[] {
  const files = readdirSync(out);
  return files
    .filter((x) => x.endsWith(".jsonl") || (x.endsWith(".jsonl.gz") && !files.includes(x.slice(0, -3))))
    .flatMap((x) => (x.endsWith(".gz") ? gunzipSync(readFileSync(out + x)).toString("utf8") : readFileSync(out + x, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row));
}

/** The like-for-like gap (points): the over's number less the first line's, in one search of both. */
function deepGap(r: Row, which: "lite" | "full", move: string): number | null {
  const s = r[which];
  const a = s?.find((p) => p[0] === move)?.[1];
  const b = s?.find((p) => p[0] === r.top[0]![0])?.[1];
  return a === undefined || b === undefined ? null : (a - b) * 100;
}

function summary() {
  const all = rows();
  const lines: string[] = [];
  const add = (...xs: string[]) => lines.push(...xs);
  const kinds = [["crowd", "Crowd (50 v 50)"], ["classic", "Classic-like groups of 8"], ["all", "All"]] as const;
  const of = (k: string) => (k === "all" ? all : all.filter((r) => r.kind === k));
  add("# A pick scored above the judge's best move", "");
  add(
    `Made by \`packages/sim/scripts/best-move-gap.ts\` (how the positions and picks are made is in its header): ${all.length} judged positions from ${new Set(all.map((r) => `${r.kind}${r.game}`)).size} games, the judge's own code at its own budget (the lite build, 250k nodes: the top-8 search, then one search over the picks outside it). Gaps in points (1 point = 1% of expected score). An "over" is a pick scored above the best move's number (the top-8 search's first line).`,
    "",
  );
  add("## How often", "");
  add("| | Positions | Picks outside the top 8 (per position) | Positions with an over | ... from the second search | ... from another top-8 line | Over by 1+ point | Over by 2+ | Over by 5+ |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const [k, label] of kinds) {
    const rs = of(k);
    const n = rs.length;
    const extraPicks = rs.reduce((s, r) => s + r.extra.length, 0);
    const big = (g: number) => rs.filter((r) => r.overs.some((o) => o.gap >= g)).length;
    add(
      `| ${label} | ${n} | ${f(extraPicks / Math.max(1, n), 2)} | ${pct(rs.filter((r) => r.overs.length).length, n)} | ${pct(rs.filter((r) => r.overs.some((o) => o.rank < 0)).length, n)} | ${pct(rs.filter((r) => r.overs.some((o) => o.rank > 0)).length, n)} | ${pct(big(1), n)} | ${pct(big(2), n)} | ${pct(big(5), n)} |`,
    );
  }
  add("");
  // Per searched pick: how often a pick the second search scored comes out above the first line.
  const extraRows = all.flatMap((r) => r.extra.map(([m, e]) => ({ r, m, gap: (e - r.top[0]![1]) * 100, idea: r.ownIdea && m === r.people[1] })));
  add(
    `Of the ${extraRows.length} picks the second search scored, ${pct(extraRows.filter((x) => x.gap > 1e-9).length, extraRows.length)} came out above the best move's number (${pct(extraRows.filter((x) => x.gap >= 1).length, extraRows.length)} by a point or more). The bots' random moves alone: ${pct(extraRows.filter((x) => !x.idea && x.gap > 1e-9).length, extraRows.filter((x) => !x.idea).length)}.`,
    "",
  );
  add("## By how much (gap of the top over, points)", "");
  add("| | Overs | p25 | median | p75 | p90 | max |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const [label, pick] of [["From the second search", (o: Row["overs"][number]) => o.rank < 0], ["From another top-8 line", (o: Row["overs"][number]) => o.rank > 0]] as const) {
    const gs = all.flatMap((r) => r.overs.filter(pick).map((o) => o.gap));
    add(`| ${label} | ${gs.length} | ${f(q(gs, 0.25), 2)} | ${f(q(gs, 0.5), 2)} | ${f(q(gs, 0.75), 2)} | ${f(q(gs, 0.9), 2)} | ${f(gs.length ? Math.max(...gs) : NaN, 2)} |`);
  }
  add("");
  add("By the best move's expected score (where the over came from the second search):", "");
  add("| Best move's expected score | Positions | With such an over | median gap |", "| --- | ---: | ---: | ---: |");
  for (const [lo, hi] of [[0, 0.1], [0.1, 0.3], [0.3, 0.7], [0.7, 0.9], [0.9, 1.01]] as const) {
    const rs = all.filter((r) => r.top[0]![1] >= lo && r.top[0]![1] < hi);
    const gs = rs.flatMap((r) => r.overs.filter((o) => o.rank < 0).map((o) => o.gap));
    add(`| ${lo.toFixed(1)}-${Math.min(1, hi).toFixed(1)} | ${rs.length} | ${pct(rs.filter((r) => r.overs.some((o) => o.rank < 0)).length, rs.length)} | ${f(q(gs, 0.5), 2)} |`);
  }
  add("");
  add("## Does a like-for-like search agree?", "");
  add(
    "Each over and the first line searched again together, as the re-check does: the device's (lite, 700k nodes) and the engine server's stand-in (the full network, 2M nodes). The deep gap is the over's number less the first line's in that one search: at or above 0, the over really is at least as good; below 0, the first line is better after all.",
    "",
  );
  add("| Overs (quick gap) | n | full: over at least as good | full: within 1 point | full: first line better by 2+ | by 5+ | full deep gap, median | lite: over at least as good | lite: first line better by 2+ |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  const overs = all.flatMap((r) => r.overs.map((o) => ({ r, o, full: deepGap(r, "full", o.move), lite: deepGap(r, "lite", o.move) })));
  const groups: [string, (x: (typeof overs)[number]) => boolean][] = [
    ["second search, under 1 point", (x) => x.o.rank < 0 && x.o.gap < 1],
    ["second search, 1-5 points", (x) => x.o.rank < 0 && x.o.gap >= 1 && x.o.gap < 5],
    ["second search, 5+ points", (x) => x.o.rank < 0 && x.o.gap >= 5],
    ["another top-8 line", (x) => x.o.rank > 0],
    ["all", () => true],
  ];
  for (const [label, pick] of groups) {
    const xs = overs.filter(pick).filter((x) => x.full !== null && x.lite !== null);
    const fulls = xs.map((x) => x.full!);
    add(
      `| ${label} | ${xs.length} | ${pct(fulls.filter((g) => g >= 0).length, xs.length)} | ${pct(fulls.filter((g) => g >= -1).length, xs.length)} | ${pct(fulls.filter((g) => g <= -2).length, xs.length)} | ${pct(fulls.filter((g) => g <= -5).length, xs.length)} | ${f(q(fulls, 0.5), 2)} | ${pct(xs.filter((x) => x.lite! >= 0).length, xs.length)} | ${pct(xs.filter((x) => x.lite! <= -2).length, xs.length)} |`,
    );
  }
  add("");
  // What each rule charges the first line's pickers and the over's, against the server's stand-in (full, 2M).
  add("## What each rule charges, against the server's stand-in", "");
  add(
    "Every over, against what the full-network search (2M nodes, like for like) says each move gave away: the first line its deep gap if the over is better, the over minus the deep gap if the first line is. The quick numbers charge the first line's pickers the quick gap and the over's nothing (today, and the promoted rule without a re-check: the same numbers). A re-check searches the two together on the device (lite, 700k nodes) and charges what it says. Promoted, the first line is an ordinary pick, so it's re-checked when its loss is in the re-check's range: from 5 points (`recheckLoss`), or from 1 for a player near the cut line (`recheckCutLoss`); the engine's first line never was (it was the anchor). Mean error in points; \"2+ off\": the share of overs where a side was charged 2 points or more away from the deep search.",
    "",
  );
  add("| Rule | Overs re-checked | First line's pickers: mean error | Over's pickers: mean error | 2+ off |", "| --- | ---: | ---: | ---: | ---: |");
  {
    const xs = overs.filter((x) => x.full !== null && x.lite !== null);
    const mean = (ys: number[]) => ys.reduce((s2, y) => s2 + y, 0) / Math.max(1, ys.length);
    const rules: [string, (g: number) => boolean][] = [
      ["The quick numbers (today; promoted without a re-check)", () => false],
      [`Promoted, the first line re-checked from ${DEFAULT_SETTINGS.recheckLoss[0]} points`, (g) => g >= DEFAULT_SETTINGS.recheckLoss[0]],
      [`Promoted, near the cut line (from ${DEFAULT_SETTINGS.recheckCutLoss[0]} point)`, (g) => g >= DEFAULT_SETTINGS.recheckCutLoss[0]],
      ["Every over re-checked against the first line", () => true],
    ];
    for (const [label, checks] of rules) {
      const errs = xs.map((x) => {
        const truthFirst = Math.max(0, x.full!);
        const truthOver = Math.max(0, -x.full!);
        const [first, over] = checks(x.o.gap) ? [Math.max(0, x.lite!), Math.max(0, -x.lite!)] : [x.o.gap, 0];
        return { first: Math.abs(first - truthFirst), over: Math.abs(over - truthOver) };
      });
      add(`| ${label} | ${pct(xs.filter((x) => checks(x.o.gap)).length, xs.length, 0)} | ${f(mean(errs.map((e) => e.first)), 2)} | ${f(mean(errs.map((e) => e.over)), 2)} | ${pct(errs.filter((e) => e.first >= 2 || e.over >= 2).length, xs.length, 0)} |`);
    }
    add("", `(${xs.length} overs; the quick gap is ${DEFAULT_SETTINGS.recheckLoss[0]}+ points in ${pct(xs.filter((x) => x.o.gap >= DEFAULT_SETTINGS.recheckLoss[0]).length, xs.length, 0)} of them, ${DEFAULT_SETTINGS.recheckCutLoss[0]}+ in ${pct(xs.filter((x) => x.o.gap >= DEFAULT_SETTINGS.recheckCutLoss[0]).length, xs.length, 0)}.)`, "");
  }
  // The exchange check (the opening allowance's material fallback) is measured against the best move.
  {
    const early = overs.filter((x) => openingAllowance(moveNumber(x.r.fen)) > 0);
    const firstSlips = early.filter((x) => materialSlips(x.r.fen, x.o.move, [x.r.top[0]![0]], OPENING_ALLOWANCE.materialPawns).size).length;
    const overSlips = early.filter((x) => materialSlips(x.r.fen, x.r.top[0]![0], [x.o.move], OPENING_ALLOWANCE.materialPawns).size).length;
    add("## The exchange check", "");
    add(
      `The opening allowance's material check measures each pick against the best move. Of the ${early.length} overs while there's an allowance (moves 1-13), the first line gives up material against the over by the check in ${firstSlips} (promoted, its pickers lose the allowance), and the over against the first line in ${overSlips}.`,
      "",
    );
  }
  add("## The inconsistency players saw", "");
  const firstPicked = all.filter((r) => r.overs.some((o) => o.gap >= 0.05));
  add(
    `In ${pct(firstPicked.length, all.length)} of positions (${firstPicked.length} of ${all.length}) a pick was scored at least 0.05 points above the best move, which someone always picked here (the first-line player): the reveal said "you found the best move" while charging the gap. Crowd alone: ${pct(firstPicked.filter((r) => r.kind === "crowd").length, of("crowd").length)}.`,
    "",
  );
  writeFileSync(root + "reports/best-move-gap.md", lines.join("\n"));
  console.log(lines.join("\n"));
}

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === "run") await run(Number(a ?? 30), Number(b ?? 1), Number(c ?? 3));
else summary();
