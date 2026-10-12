/**
 * Calibrating the Maia boss (DECISIONS.md, "Every boss on Maia"): which Maia rating a boss plays at for its strength,
 * the bridge band up to Stockfish, and the margin a crowd voting together needs. Maia runs as the separate program it
 * is (the Maia box's command-line build, spoken to in UCI text, as the browser's worker is); Stockfish is the lite build
 * the browser runs, at the game's budgets.
 *
 *   npx tsx packages/sim/scripts/maia-calibration.ts moves <chunk> <chunks> [positions]
 *       Per move, on the positions the rating curve was fitted on (calibrate-rating.ts's, the same seed): Maia's
 *       candidates and probabilities at a ladder of ratings, the boss's own top-8 search, and today's Stockfish boss
 *       at a few strengths; every move scored as the judge scores a pick. No sampling noise for Maia: its expected loss
 *       is worked out from its probabilities (temperature, top-p) and, for the guarded brains, the guard's rule.
 *   npx tsx packages/sim/scripts/maia-calibration.ts games <crowd> <config> <games> <seed>
 *       A crowd of 10 bots (boss-sim.ts's: voting, the most popular pick played, the boss striking the worst recent
 *       mover every 3 moves down to 3) against the boss in plain chess (no powers, no God King), from the same
 *       openings for every config. The boss's strength: the crowd's weighted rating + OFFSET (as the Crowd's boss
 *       battle sets it). <config>: `sf` (today's Stockfish boss), `<brain>@<maia rating>` (maia-raw, maia-light,
 *       maia-full, maia-strict at a fixed rating), or `game` (the game's own rule: bossBrainFor, as shipped).
 *   npx tsx packages/sim/scripts/maia-calibration.ts summary          reports/maia-calibration.md
 *
 * Rows go to reports/maia-calibration/*.jsonl.
 */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BOSS_BRAIN,
  DEFAULT_SETTINGS,
  bossBrainFor,
  bossElo,
  bossStumbleChance,
  botPick,
  estimateRating,
  mulberry32,
  openingPlies,
  ratingForLoss,
  shuffle,
  type BossBrain,
  type BrainGuard,
} from "@chessroyale/core";
import { applyMove, bossGuardFrom, bossMoveFrom, fenAfter, gameEnd, HumanUciEngine, legalMoves, type BrainNote, type Opening, type UciTransport } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const OUT = root + "reports/maia-calibration/";
const settings = DEFAULT_SETTINGS;
const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];

/** Maia's rating ladder for the per-move study. */
const LADDER = [600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000];
/** Today's Stockfish boss, per move, at these strengths. */
const SF_LEVELS = [1600, 2200, 2600, 2800];
/** Candidates asked of Maia per position: enough to cover the draw's top-p share. */
const MULTIPV = 20;

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

// ---------------- Per move ----------------

/** calibrate-rating.ts's positions (the same seed and steps): the ones the rating curve was fitted on. */
async function curvePositions(n: number): Promise<string[]> {
  const rng = mulberry32(7);
  const helper = await createNodeEngine({ nodes: 100_000, hashMb: settings.engineHashMb });
  const fens: string[] = [];
  for (const o of shuffle(rng, library)) {
    if (fens.length >= n) break;
    const plies = rng() < 0.5 ? openingPlies(settings) : openingPlies(settings) + 1;
    if (o.moves.length < plies) continue;
    let fen = fenAfter(o.moves.slice(0, plies));
    const extra = Math.floor(rng() * 16);
    for (let i = 0; i < extra; i++) {
      const top = await helper.topMoves(fen, 3);
      if (!top.length) break;
      const next = applyMove(fen, top[Math.floor(rng() * top.length)]!.move);
      if (gameEnd(next, [])) break;
      fen = next;
    }
    fens.push(fen);
  }
  helper.close();
  return fens;
}

async function moves(chunk: number, chunks: number, n: number) {
  const fens = await curvePositions(n);
  const judge = await createNodeEngine({ nodes: settings.engineNodes, hashMb: settings.engineHashMb });
  const boss = await createNodeEngine({ nodes: settings.bossNodes, hashMb: 16 });
  const human = await maia();
  const rng = mulberry32(1000 + chunk);
  mkdirSync(OUT, { recursive: true });
  for (let i = chunk; i < fens.length; i += chunks) {
    const fen = fens[i]!;
    const t0 = Date.now();
    const asked: Record<number, { move: string; p: number }[]> = {};
    for (const rating of LADDER) {
      const a = await human.candidates(fen, rating, null, { temperature: 0, topP: 1, multipv: MULTIPV });
      asked[rating] = a?.moves ?? [];
    }
    // Today's Stockfish boss (its own engine, so its searches don't share the judge's hash).
    const sf: Record<number, string> = {};
    for (const elo of SF_LEVELS) {
      const kind = rng() < bossStumbleChance(elo, settings) ? "stumble" : "elo";
      sf[elo] = await bossMoveFrom(boss, fen, elo, settings.bossNodes, kind, rng, settings.kingStrikeLoss, bossGuardFrom(settings), null);
    }
    // The judge: the boss's own top-8 search (the guard reads it) and every move above scored.
    const top8 = await judge.topMoves(fen, 8);
    const wanted = new Set<string>([...Object.values(asked).flatMap((ms) => ms.map((m) => m.move)), ...Object.values(sf)]);
    const known = new Map(top8.map((m) => [m.move, m.expected]));
    const missing = [...wanted].filter((m) => !known.has(m));
    if (missing.length) for (const s of await judge.scoreMoves(fen, missing)) known.set(s.move, s.expected);
    const row = { i, fen, top8: top8.map((m) => ({ move: m.move, expected: +m.expected.toFixed(4) })), scores: Object.fromEntries([...known].map(([m, e]) => [m, +e.toFixed(4)])), maia: asked, sf, secs: Math.round((Date.now() - t0) / 1000) };
    appendFileSync(OUT + `moves-${chunk}.jsonl`, JSON.stringify(row) + "\n");
    console.log(`position ${i} (${row.secs} s)`);
  }
  judge.close();
  boss.close();
  human.close();
}

interface MoveRow {
  i: number;
  fen: string;
  top8: { move: string; expected: number }[];
  scores: Record<string, number>;
  maia: Record<string, { move: string; p: number }[]>;
  sf: Record<string, string>;
}

/** Maia's draw as the box makes it: probabilities to the power 1/temperature, then the likeliest within top-p. */
function drawn(cands: readonly { move: string; p: number }[], temperature: number, topP: number): { move: string; q: number }[] {
  if (!cands.length) return [];
  const w = cands.map((c) => Math.pow(Math.max(c.p, 1e-12), 1 / temperature));
  const z = w.reduce((a, b) => a + b, 0);
  const probs = cands.map((c, k) => ({ move: c.move, q: w[k]! / z })).sort((a, b) => b.q - a.q);
  let total = 0;
  const kept = probs.filter((m, k) => {
    total += m.q;
    return k === 0 || total <= topP;
  });
  const sum = kept.reduce((a, m) => a + m.q, 0);
  return kept.map((m) => ({ move: m.move, q: m.q / sum }));
}

/** A position's best (as calibrate-rating.ts: the top line, or a scored move if it came out higher). */
const bestOf = (r: MoveRow) => Math.max(...Object.values(r.scores), r.top8[0]?.expected ?? 0);
const lossOf = (r: MoveRow, move: string) => Math.max(0, (bestOf(r) - (r.scores[move] ?? bestOf(r))) * 100);

/** The guard's verdict, as the game reads it: from the top-8 search only (a move outside it is turned down). */
function passes(r: MoveRow, move: string, g: BrainGuard): boolean {
  const best = Math.max(...r.top8.map((t) => t.expected));
  const scored = r.top8.find((t) => t.move === move);
  if (!scored) return false;
  const points = Math.max(0, (best - scored.expected) * 100);
  const lg = (p: number) => Math.log(Math.min(0.999, Math.max(0.001, p)) / (1 - Math.min(0.999, Math.max(0.001, p))));
  return points <= g.maxLoss && (lg(best) - lg(scored.expected) <= g.maxLogitLoss || points <= 2);
}

/** A brain's expected loss in one position at one Maia rating (raw: its draw; guarded: the guard's pick for each draw). */
function brainLoss(r: MoveRow, rating: number, guard: BrainGuard | null): number {
  const cands = r.maia[String(rating)] ?? [];
  const draw = drawn(cands, BOSS_BRAIN.temperature, BOSS_BRAIN.topP);
  if (!draw.length) return 0;
  let loss = 0;
  for (const d of draw) {
    let move = d.move;
    if (guard) {
      const tries = [d.move, ...cands.filter((c) => c.move !== d.move && c.p >= BOSS_BRAIN.minP).map((c) => c.move)].slice(0, BOSS_BRAIN.candidates);
      // (None passes: Stockfish's best, the top-8 search's highest score.)
      move = tries.find((m) => passes(r, m, guard)) ?? [...r.top8].sort((a, b) => b.expected - a.expected)[0]!.move;
    }
    loss += d.q * lossOf(r, move);
  }
  return loss;
}

// ---------------- Games against a crowd ----------------

const CROWD_NODES = 150_000;
const MAX_MOVES = 60;
const KILL_EVERY = 3;
const MIN_SURVIVORS = 3;
/** The boss's strength over the crowd's weighted rating: the Crowd's boss battle's bossEloOffset. */
const OFFSET = settings.bossEloOffset;
const spread = (lo: number, hi: number) => Array.from({ length: 10 }, (_, i) => lo * Math.pow(hi / lo, i / 9));
/** boss-sim.ts's crowds: each member's skill temperature, and how often they play a random legal move. */
const CROWDS: Record<string, { skills: number[]; random: number }> = {
  expert: { skills: spread(1, 4), random: 0.02 },
  club: { skills: spread(6, 20), random: 0.06 },
  casual: { skills: spread(15, 40), random: 0.12 },
  beginner: { skills: spread(30, 90), random: 0.25 },
};

async function games(kind: string, config: string, n: number, seed: number) {
  const engine = await createNodeEngine({ nodes: CROWD_NODES, hashMb: 16 });
  const boss = await createNodeEngine({ nodes: settings.bossNodes, hashMb: 16 });
  const human = config === "sf" ? null : await maia();
  // "<crowd>1": one player alone (Boss alone): the crowd's middle member.
  const alone = kind.endsWith("1");
  const crowd = CROWDS[alone ? kind.slice(0, -1) : kind]!;
  const { random } = crowd;
  const skills = alone ? [crowd.skills[4]!] : crowd.skills;
  const pickSettings = { ...settings, botRandomMoveChance: random };
  const candidates = async (fen: string) => {
    const top = await engine.topMoves(fen, settings.botCandidateMoves);
    const best = Math.max(...top.map((m) => m.expected));
    return { top, best, list: top.map((m) => ({ move: m.move, loss: Math.max(0, (best - m.expected) * 100) })) };
  };
  // The crowd's rating before the battle (as boss-sim.ts): its members' picks in positions like the game's, weighted
  // towards the best (bossElo). The same for every config of a crowd and seed.
  const warmRng = mulberry32(seed * 31 + kind.length + (alone ? 7 : 0));
  const warm: number[][] = skills.map(() => []);
  for (const o of shuffle(warmRng, library.filter((x) => x.moves.length >= 10)).slice(0, 30)) {
    const fen = fenAfter(o.moves.slice(0, 8 + Math.floor(warmRng() * 3)));
    const { list } = await candidates(fen);
    skills.forEach((skill, k) => {
      const move = botPick(warmRng, list, skill, legalMoves(fen), pickSettings);
      warm[k]!.push(list.find((c) => c.move === move)?.loss ?? 30);
    });
  }
  const members = warm.map((l) => estimateRating(l)!);
  const rating = bossElo(members, { bossEloOffset: 0, bossEloRange: [0, 9999] });
  // (Alone, as Boss alone at Normal: a step above your rating, less Ginger's 100: about your rating.)
  const strength = Math.max(settings.bossEloRange[0], Math.min(settings.bossEloRange[1], rating + (alone ? 0 : OFFSET)));
  // The boss's brain: Stockfish, a fixed Maia rating, or the game's own rule.
  const [brainName, at] = config.split("@") as [string, string | undefined];
  const plan = config === "game" ? bossBrainFor("gingerbread", strength, "", true, { crowd: !alone }) : null;
  console.log(`${kind} crowd ${rating} (members ${members.join(", ")}), boss ${strength}, ${config}${plan ? ` → ${JSON.stringify(plan)}` : ""}`);
  const openings = shuffle(mulberry32(seed + 1), library.filter((o) => o.moves.length >= 10));
  mkdirSync(OUT, { recursive: true });
  for (let g = 0; g < n; g++) {
    const rng = mulberry32(seed * 7919 + g);
    // (The same opening for every config: game g of a seed, the crowd White in even games.)
    const o = openings[g]!;
    let fen = fenAfter(o.moves.slice(0, 6 + (g % 2)));
    const crowdSide = fen.split(" ")[1]!;
    let alive = skills.map((skill, k) => ({ k, skill, recent: [] as number[], all: [] as number[] }));
    const played: number[] = [];
    /** Every member's own picks' losses in the battle (struck-down members' too): the crowd's uplift is measured on the same positions. */
    const memberLosses: number[][] = skills.map(() => []);
    const notes = { maia: 0, stockfish: 0, vetoed: 0, share: 0 };
    let moves = 0;
    let ms = 0;
    while (moves < MAX_MOVES && !gameEnd(fen, [])) {
      const { list } = await candidates(fen);
      const legal = legalMoves(fen);
      const picks = alive.map((p) => {
        const move = botPick(rng, list, p.skill, legal, pickSettings);
        const loss = list.find((c) => c.move === move)?.loss ?? 30;
        p.recent.push(loss);
        memberLosses[p.k]!.push(loss);
        return move;
      });
      const count = (m: string) => picks.filter((x) => x === m).length;
      const most = Math.max(...picks.map(count));
      const tied = [...new Set(picks.filter((m) => count(m) === most))];
      const move = tied[Math.floor(rng() * tied.length)]!;
      played.push(list.find((c) => c.move === move)?.loss ?? 30);
      fen = applyMove(fen, move);
      moves++;
      if (moves % KILL_EVERY === 0 && alive.length > MIN_SURVIVORS) {
        const sum = (p: (typeof alive)[number]) => p.recent.slice(-KILL_EVERY).reduce((s, x) => s + x, 0);
        const victim = [...alive].sort((a, b) => sum(b) - sum(a))[0]!;
        alive = alive.filter((p) => p !== victim);
      }
      if (gameEnd(fen, [])) break;
      const kindOfMove = rng() < bossStumbleChance(strength, settings) ? "stumble" : "elo";
      let note: BrainNote | null = null;
      const brain =
        human && plan && plan.rating !== null
          ? { brain: plan.brain, rating: plan.rating, engine: human, stockfishShare: plan.stockfishShare, onNote: (x: BrainNote) => (note = x) }
          : human && at
            ? { brain: brainName as BossBrain, rating: Number(at), engine: human, onNote: (x: BrainNote) => (note = x) }
            : undefined;
      const t = performance.now();
      const reply = await bossMoveFrom(boss, fen, strength, settings.bossNodes, kindOfMove, rng, settings.kingStrikeLoss, bossGuardFrom(settings), null, brain);
      ms += performance.now() - t;
      const nb = note as BrainNote | null;
      if (nb?.by === "maia") notes.maia++;
      else notes.stockfish++;
      if (nb?.why === "share") notes.share++;
      notes.vetoed += nb?.vetoed ?? 0;
      fen = applyMove(fen, reply);
    }
    const end = gameEnd(fen, []);
    // The crowd's score: a mate decides; a draw is a half; at the move cap the engine's verdict (60%+ a win, as
    // boss-sim.ts). `expected`: the crowd's chances at the end (a continuous measure, for tighter error bars).
    let score: number;
    let expected: number;
    if (end === "checkmate") expected = score = fen.split(" ")[1] === crowdSide ? 0 : 1;
    else if (end) expected = score = 0.5;
    else {
      const { best } = await candidates(fen);
      expected = fen.split(" ")[1] === crowdSide ? best : 1 - best;
      score = expected >= 0.6 ? 1 : expected <= 0.4 ? 0 : 0.5;
    }
    const memberMean = memberLosses.map((l) => +(l.reduce((a, b) => a + b, 0) / Math.max(1, l.length)).toFixed(2));
    const row = { kind, config, seed, game: g, opening: o.name, rating, members, strength, plan, moves, end: end ?? "cap", score, expected: +expected.toFixed(3), ...notes, bossMs: Math.round(ms / Math.max(1, notes.maia + notes.stockfish)), played, memberMean, memberMoves: memberLosses.map((l) => l.length) };
    appendFileSync(OUT + `games-${kind}-${config.replace("@", "-")}-${seed}.jsonl`, JSON.stringify(row) + "\n");
    console.log(JSON.stringify({ ...row, played: undefined, playedMean: +(played.reduce((a, b) => a + b, 0) / Math.max(1, played.length)).toFixed(2) }));
  }
  engine.close();
  boss.close();
  human?.close();
}

// ---------------- The report ----------------

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
/** A mean and its standard error. */
function meanSe(xs: readonly number[]): { m: number; se: number } {
  const m = mean(xs);
  const v = xs.length > 1 ? xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1) : 0;
  return { m, se: Math.sqrt(v / Math.max(1, xs.length)) };
}
/** Bootstrap-free standard error of a per-position mean, as "m ± 2·se". */
const pm = (xs: readonly number[], digits = 2) => {
  const { m, se } = meanSe(xs);
  return `${m.toFixed(digits)} ± ${(2 * se).toFixed(digits)}`;
};

function readRows<T>(prefix: string): T[] {
  if (!existsSync(OUT)) return [];
  return readdirSync(OUT)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".jsonl"))
    .flatMap((f) => readFileSync(OUT + f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as T));
}

export function movesTables(): string[] {
  const rows = readRows<MoveRow>("moves-").sort((a, b) => a.i - b.i);
  if (!rows.length) return ["(not run)"];
  const out: string[] = [];
  out.push(`${rows.length} positions (calibrate-rating.ts's). Mean loss per move ± two standard errors (over positions); "plays like" is the rating whose loss per move that is on the game's own scale (RATING_CURVE, what a player's rating is), the way a player is rated.`);
  out.push("");
  out.push("| Maia rating | No guard: loss | plays like | Light guard: loss | plays like | Full guard: loss | plays like | Strict guard: loss | plays like |");
  out.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const rating of LADDER) {
    const cols = [null, BOSS_BRAIN.light, BOSS_BRAIN.full, BOSS_BRAIN.strict].map((g) => {
      const ls = rows.map((r) => brainLoss(r, rating, g));
      return `${pm(ls)} | ${ratingForLoss(mean(ls))}`;
    });
    out.push(`| ${rating} | ${cols.join(" | ")} |`);
  }
  out.push("");
  out.push("| Today's Stockfish boss at | Loss per move | plays like |");
  out.push("| --- | --- | --- |");
  for (const elo of SF_LEVELS) {
    const ls = rows.map((r) => lossOf(r, r.sf[String(elo)]!));
    out.push(`| ${elo} | ${pm(ls)} | ${ratingForLoss(mean(ls))} |`);
  }
  return out;
}

interface GameRow {
  kind: string;
  config: string;
  rating: number;
  members: number[];
  strength: number;
  plan: { brain: string; rating: number | null; stockfishShare?: number } | null;
  moves: number;
  score: number;
  expected: number;
  maia: number;
  stockfish: number;
  vetoed: number;
  share: number;
  bossMs: number;
  played: number[];
}

const KINDS = ["beginner1", "beginner", "casual1", "casual", "club1", "club", "expert1", "expert"];
const kindName = (k: string) => (k.endsWith("1") ? `one ${k.slice(0, -1)} player (Boss alone)` : `${k} crowd`);
const labelOf = (config: string) => Number(config.split("@")[1] ?? 0);

function groupsOf(rows: GameRow[]): Map<string, GameRow[]> {
  const groups = new Map<string, GameRow[]>();
  const brainOrder = ["sf", "maia-raw", "maia-light", "maia-full", "maia-strict", "game"];
  for (const r of [...rows].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || brainOrder.indexOf(a.config.split("@")[0]!) - brainOrder.indexOf(b.config.split("@")[0]!) || labelOf(a.config) - labelOf(b.config))) {
    const k = `${r.kind}|${r.config}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return groups;
}

export function gamesTables(): string[] {
  const rows = readRows<GameRow>("games-");
  if (!rows.length) return ["(not run)"];
  const out = [
    "| Who plays the boss | Their rating | Boss strength | Boss | Games | Their score ± 2 SE | Their chances at the end ± 2 SE | Wins / draws / losses | Their played moves rate | Boss moves by Maia | Median boss move, ms | Avg moves |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const [k, rs] of groupsOf(rows)) {
    const [kind, config] = k.split("|");
    const n = rs.length;
    const w = rs.filter((r) => r.score === 1).length;
    const d = rs.filter((r) => r.score === 0.5).length;
    const plan = rs[0]!.plan;
    const label = config === "sf" ? "Stockfish (today)" : config === "game" ? `the shipped rule: ${plan?.rating ? `${plan.brain} at Maia ${plan.rating}` : "Stockfish"}${plan?.stockfishShare ? `, ${Math.round(plan.stockfishShare * 100)}% Stockfish` : ""}` : config!.replace("@", " at Maia ");
    const plays = ratingForLoss(mean(rs.flatMap((r) => r.played)));
    const maiaShare = Math.round((100 * rs.reduce((a, r) => a + r.maia, 0)) / Math.max(1, rs.reduce((a, r) => a + r.maia + r.stockfish, 0)));
    const ms = rs.map((r) => r.bossMs).sort((a, b) => a - b)[n >> 1];
    out.push(`| ${kindName(kind!)} | ${rs[0]!.rating} | ${rs[0]!.strength} | ${label} | ${n} | ${pm(rs.map((r) => r.score))} | ${pm(rs.map((r) => r.expected))} | ${w} / ${d} / ${n - w - d} | ${plays} | ${maiaShare}% | ${ms} | ${Math.round(mean(rs.map((r) => r.moves)))} |`);
  }
  return out;
}

/**
 * Where the score crosses one half against Maia with no guard, for each crowd or lone player: a decreasing fit of the
 * score over Maia's rating (pooling neighbours that go the wrong way), read where it crosses 0.5.
 */
export function evenPoints(rows: GameRow[] = readRows<GameRow>("games-")): { kind: string; rating: number; strength: number; even: number | null; note: string }[] {
  const out: { kind: string; rating: number; strength: number; even: number | null; note: string }[] = [];
  for (const kind of KINDS) {
    const rs = rows.filter((r) => r.kind === kind && r.config.startsWith("maia-raw@"));
    if (!rs.length) continue;
    const cells = [...new Set(rs.map((r) => labelOf(r.config)))].sort((a, b) => a - b).map((x) => {
      const c = rs.filter((r) => labelOf(r.config) === x);
      return { x, n: c.length, m: mean(c.map((r) => r.score)) };
    });
    // Pool adjacent violators: the score should fall as Maia's rating rises.
    const blocks = cells.map((c) => ({ xs: [c.x], n: c.n, m: c.m }));
    for (let i = 0; i < blocks.length - 1; ) {
      if (blocks[i]!.m < blocks[i + 1]!.m) {
        const a = blocks[i]!;
        const b = blocks.splice(i + 1, 1)[0]!;
        blocks[i] = { xs: [...a.xs, ...b.xs], n: a.n + b.n, m: (a.m * a.n + b.m * b.n) / (a.n + b.n) };
        if (i > 0) i--;
      } else i++;
    }
    const fit = blocks.map((b) => ({ x: mean(b.xs), m: b.m }));
    let even: number | null = null;
    let note = "";
    if (fit[0]!.m <= 0.5) note = `at or below Maia ${cells[0]!.x}`;
    else if (fit.at(-1)!.m > 0.5) note = `above Maia ${cells.at(-1)!.x}`;
    for (let i = 1; i < fit.length && even === null; i++) {
      const [a, b] = [fit[i - 1]!, fit[i]!];
      if (a.m > 0.5 && b.m <= 0.5) even = Math.round(a.x + ((a.m - 0.5) * (b.x - a.x)) / (a.m - b.m));
    }
    out.push({ kind, rating: rs[0]!.rating, strength: rs[0]!.strength, even, note });
  }
  return out;
}

function summary() {
  const rows = readRows<GameRow>("games-");
  const md = [
    ...REPORT_HEAD,
    "## Per move: what a Maia rating plays like",
    "",
    ...movesTables(),
    "",
    "## Games: bot crowds, and one player alone, against the boss",
    "",
    ...gamesTables(),
    "",
    "Where each is even with Maia (no guard), from the table above:",
    "",
    "| Who | Their rating | Boss strength | Even with Maia at |",
    "| --- | --- | --- | --- |",
    ...evenPoints(rows).map((e) => `| ${kindName(e.kind)} | ${e.rating} | ${e.strength} | ${e.even ?? e.note} |`),
    "",
    ...REPORT_TAIL(),
  ];
  writeFileSync(root + "reports/maia-calibration.md", md.join("\n") + "\n");
  console.log(md.join("\n"));
}

/** The report's opening: how it was measured. */
const REPORT_HEAD: string[] = [
  "# Maia boss calibration (Oct 12, 2026)",
  "",
  "Written by `npx tsx packages/sim/scripts/maia-calibration.ts summary` from `reports/maia-calibration/*.jsonl`. A modest",
  "run by design: small samples, every number with its error bar (± two standard errors), and the choices lean on",
  "several rows at once, never on one. The choices and why are in DECISIONS.md, \"Every boss on Maia: the calibration\".",
  "",
  "**What it measures.**",
  "",
  "- **Games** (as `boss-sim.ts` and `reports/boss-calibration.md`): a crowd of 10 bots (each a skill temperature and a",
  "  share of random moves: beginner, casual, club, expert), the most popular pick played, the boss striking down the",
  "  worst recent mover every 3 crowd moves down to 3, against the boss in plain chess (no powers, no God King, no Last",
  "  Stand), up to 60 crowd moves, then the engine's verdict (60% or more: a win). The boss's strength is the crowd's",
  "  weighted rating less 100 (as the Crowd's boss battle sets it); the boss is today's Stockfish boss, or Maia at a fixed",
  "  rating. \"One player alone\" is the crowd's middle member on its own, against a boss at its own rating (Boss alone at",
  "  Normal). The same openings for every boss, colours alternating. \"Their played moves rate\": the rating (the game's",
  "  own, from points lost a move) of the moves the crowd actually played.",
  "- **Per move**: on the positions the game's rating curve was fitted on (calibrate-rating.ts's), Maia's likeliest moves",
  "  at a ladder of ratings, scored as the judge scores a pick. Maia's expected loss is worked out from its",
  "  probabilities (temperature 0.8, top-p 0.9; for a guard, the guard's pick for each draw), so it has no sampling",
  "  noise; the error bars are over positions. These are early positions (openings and a few good moves), where people",
  "  play well, so Maia \"plays like\" far higher ratings here than in whole games: read them across the ladder and",
  "  across the guards, not as the game's scale.",
  "",
];

/** The report's end: what the game now ships, worked out from BOSS_BRAIN. */
function REPORT_TAIL(): string[] {
  const M = BOSS_BRAIN;
  const at = (x: number, crowd: boolean) => {
    const p = bossBrainFor("gingerbread", x, "", true, { crowd });
    return p.rating === null ? "Stockfish" : `${p.brain} ${p.rating}${p.stockfishShare ? ` (${Math.round(p.stockfishShare * 100)}% Stockfish)` : ""}`;
  };
  return [
    "## What it says",
    "",
    "- **Today's Stockfish boss is far harder than its label in plain chess.** With its blunder guard (Oct 5) it beat every",
    "  beginner, casual and club crowd here (18 games, no crowd win or draw) and held the expert crowd to a quarter. Maia with",
    "  no guard can't be that hard below its ceiling and still be the human boss Eric asked for; the target is instead the",
    "  boss battle's own from Oct 3 (\"very hard but beatable\": a club crowd about even in plain chess), the powers and",
    "  the God King on top as before.",
    "- **Where crowds are even with Maia (no guard):** the beginner crowd at about Maia 350 (under Maia's floor of 600, where",
    "  it scored 0.13), the casual crowd a little under 1000, the club crowd about 2100 (it scored the same against 2600).",
    "  The steps between crowds are far bigger than their ratings' steps: bot crowds' blunders are random moves, which",
    "  voting filters out better the more consistent the crowd is.",
    "- **One player alone needs a much weaker Maia** than a crowd of the same rating: the club bot alone scored 0.25",
    "  against Maia 1000, the club crowd 0.50 against 2100. On the lines that is about 400 of level: the crowd's margin.",
    "- **Maia's ceiling:** with no guard it stops gaining between Maia 2100 and 2700 (the same score for the club crowd at",
    "  2100 and 2600; per move 2.73 points at 2400, 2.53 at 2700, 2.80 at 3000). The lines hold at 2500.",
    "- **The bridge:** against the expert crowd, Maia at its ceiling with no guard lost 9 of 10; with the light guard the",
    "  crowd scored 0.65, with the strict guard 0.35, against today's Stockfish 0.25: light, then strict, then Stockfish",
    "  is a ramp in steps no bigger than the error bars. Per move, the light guard (about 1.5–1.7 points a move at Maia",
    "  2400–2700) is today's boss at 2600 (1.39), the strict one (about 0.4) sharper than today's at 2800 (1.05); the",
    "  bridge's growing share of Stockfish's moves brings it to Stockfish's own at 2800.",
    "- **The shipped rule, checked on fresh openings** (the rows marked so above, 8 games each): the casual crowd scored",
    "  0.38, the club crowd 0.50, the club player alone 0.50, the expert crowd (in the bridge, 90% Stockfish) 0.38: about",
    "  even everywhere, within error bars of about ±0.3 to ±0.4. Small samples: the lines are a starting point for real",
    "  battles, and `crowdMargin` (crowds) and the lines' first points (Boss alone) are the knobs.",
    "",
    "## What the game ships (BOSS_BRAIN)",
    "",
    `Maia's rating lines: ${M.maiaRating.map(([x, y]) => `${x} → ${y}`).join(", ")} (held above the last; never under ${M.maiaRatingMin}); a crowd's margin ${M.crowdMargin}; the bridge from ${M.bridgeFrom} (light guard), the strict guard from ${M.bridgeStrictFrom}, Stockfish's share up to ${Math.round(M.bridgeStockfishShare * 100)}% just under ${M.stockfishFrom}; Stockfish from ${M.stockfishFrom}.`,
    "",
    "| Boss strength | Boss alone | A crowd |",
    "| --- | --- | --- |",
    ...[1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2500, 2600, 2650, 2700, 2750, 2799, 2800, 3000].map((x) => `| ${x} | ${at(x, false)} | ${at(x, true)} |`),
    "",
  ];
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "moves") await moves(Number(args[0] ?? 0), Number(args[1] ?? 1), Number(args[2] ?? 160));
else if (cmd === "games") await games(args[0] ?? "club", args[1] ?? "sf", Number(args[2] ?? 6), Number(args[3] ?? 1));
else if (cmd === "summary") summary();
else console.log("usage: maia-calibration.ts moves <chunk> <chunks> [positions] | games <crowd> <config> <games> <seed> | summary");
