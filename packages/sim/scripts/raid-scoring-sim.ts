/**
 * Raid scoring's sim, step 2 (docs/decisions/2026-10-25-raid-scoring.md): re-scores every raid raid-scoring-trace.ts
 * recorded (reports/raid-scoring/*.jsonl[.gz]) under today's raid scoring and each variant, through the game's own core
 * code (scoreGroup, crowdBrilliant, applyRound, strikeVictim, bossKill), strikes by each rule, and writes
 * reports/raid-scoring.md.
 *
 *   npx tsx packages/sim/scripts/raid-scoring-sim.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SETTINGS,
  RAID_SCORING,
  RAID_SETTINGS,
  applyRound,
  bossKill,
  bossKillDue,
  createMatch,
  crowdBrilliant,
  matchLoss,
  mulberry32,
  openingAllowance,
  outcomesFromGroup,
  sameScore,
  scoreGroup,
  standingPoints,
  streakCounts,
  type CrowdScoring,
  type MatchState,
  type PlayerState,
  type Settings,
} from "@chessroyale/core";
import { spearman } from "../src/stats.ts";
import type { RaidRow } from "./raid-scoring-trace.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const DIR = root + "reports/raid-scoring/";

/**
 * How the boss picks whom to strike. "loss": today's (strikeVictim: the most counted points given away since its last
 * strike, a tie to the worse match loss, still tied: it waits a move). "points": the fewest round points since its last
 * strike (the scoreboard's measure: capped, relieved, streaks counted), a tie to the most counted points given away over
 * those moves, then the worse match loss, still tied: it waits a move.
 */
type StrikeRule = "loss" | "points";
interface Variant {
  id: string;
  label: string;
  scoring: CrowdScoring | undefined;
  strike: StrikeRule;
}

const plain: CrowdScoring = { ...RAID_SCORING, streakMinAverage: undefined };
const variants: Variant[] = [
  { id: "today", label: "Today (no cap, 1 decimal)", scoring: undefined, strike: "loss" },
  { id: "plain", label: "50 v 50's math as it is, cap by crowd move 1/11/15/19, strike as today", scoring: plain, strike: "loss" },
  { id: "avg05", label: "The same, streaks only on moves the crowd gave away 0.5+ on average", scoring: { ...plain, streakMinAverage: 0.5 }, strike: "loss" },
  { id: "avg1", label: "The same, streaks only on moves the crowd gave away 1+ on average", scoring: { ...plain, streakMinAverage: 1 }, strike: "loss" },
  { id: "avg2", label: "The same, streaks only on moves the crowd gave away 2+ on average", scoring: { ...plain, streakMinAverage: 2 }, strike: "loss" },
  { id: "avg4", label: "The same, streaks only on moves the crowd gave away 4+ on average", scoring: { ...plain, streakMinAverage: 4 }, strike: "loss" },
  { id: "chosen", label: "RAID_SCORING, strike as today", scoring: RAID_SCORING, strike: "loss" },
  { id: "points", label: "RAID_SCORING, strike by points since the last strike", scoring: RAID_SCORING, strike: "points" },
  { id: "slow", label: "RAID_SCORING with the cap by crowd move 1/11/21/31 (slower)", scoring: { ...RAID_SCORING, capFromMove: [1, 11, 21, 31] }, strike: "loss" },
  { id: "nostreak", label: "RAID_SCORING without streaks", scoring: { ...RAID_SCORING, streakBonus: [] }, strike: "loss" },
];

/** Counted loss of each pick (the opening allowance taken off, none for a material slip), as the runner's allowanceFor. */
function counted(ply: RaidRow["plies"][number], move: string): number {
  const points = openingAllowance(Number(ply.fen.split(" ")[5]));
  const off = points > 0 && !ply.slips[move] ? points : 0;
  return Math.max(0, ply.loss[move]! - off);
}

/** The points rule's victim (see StrikeRule), or null on a tie it can't break. */
function pointsVictim(state: MatchState, settings: Settings, window: Map<string, { pts: number; loss: number }>): string | null {
  const order = state.players
    .filter((p) => p.alive)
    .map((p) => ({ id: p.id, pts: window.get(p.id)?.pts ?? 0, loss: window.get(p.id)?.loss ?? 0, match: matchLoss(p, settings) }))
    .sort((a, b) => a.pts - b.pts || b.loss - a.loss || b.match - a.match);
  const [w, n] = order;
  if (!w) return null;
  if (n && sameScore(w.pts, n.pts) && sameScore(w.loss, n.loss) && (w.match === n.match || sameScore(w.match, n.match))) return null;
  return w.id;
}

interface Metrics {
  in10: number;
  strikes: number;
  /** Strikes whose victim's pick on the strike move was fine (1 point or less, or not among that move's worst 10%). */
  fineLast: number;
  /** Strikes whose victim wasn't among the 5 who gave away the most since the last strike (ties count as among). */
  fineWindow: number;
  /** Strikes that waited a move on a tie. */
  waits: number;
  /** At each strike, players tied exactly with the scoreboard's last (beyond the last himself). */
  boardTies: number[];
  /** Players who hung a piece in the first 10 crowd moves: their place after 10 moves (0 top, 1 bottom); struck by move 20. */
  hangPct: number[];
  hangStruck: number;
  hangCount: number;
  /** The top 8 on points at the end: points from streaks, and in all. */
  streakPts: number;
  topPts: number;
  /** Rating against how long each lasted (the struck by order out, the survivors last). */
  rho: number;
  /** Mean rating of the struck. */
  struckRating: number;
  shoutouts: number;
}

function scoreRaid(row: RaidRow, v: Variant): Metrics {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, crowdScoring: v.scoring };
  const rng = mulberry32(row.seed);
  const entrants = row.ratings.map((_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: false }));
  let state: MatchState = createMatch(entrants, [0], settings);
  state = { ...state, boss: { elo: row.bossElo, crowdSide: "w", crowdMoves: 0, sinceKill: 0, kills: [], minSurvivors: Math.ceil(entrants.length / 2) } };
  const m: Metrics = { in10: NaN, strikes: 0, fineLast: 0, fineWindow: 0, waits: 0, boardTies: [], hangPct: [], hangStruck: 0, hangCount: 0, streakPts: 0, topPts: 0, rho: 0, struckRating: NaN, shoutouts: 0 };
  const hangers = new Set<string>();
  // Since the boss's last strike: each player's round points and counted loss (for the points rule and the measures).
  let window = new Map<string, { pts: number; loss: number }>();
  const cs = settings.crowdScoring;
  const idx = (id: string) => Number(id.slice(1));
  for (const ply of row.plies) {
    const alive = state.players.filter((p) => p.alive);
    const ids = alive.map((p) => p.id);
    const picks = ids.map((id) => ({ playerId: id, move: ply.picks[idx(id)] ?? null }));
    const evaluation = { bestMove: ply.bestMove, bestExpected: 1, expectedAfter: Object.fromEntries(Object.entries(ply.loss).map(([mv, l]) => [mv, 1 - l / 100])) };
    const fullmove = Number(ply.fen.split(" ")[5]);
    const points = openingAllowance(fullmove);
    const allowance = (mv: string) => {
      const material = points > 0 ? ply.slips[mv] : undefined;
      const uncap = cs ? ply.pieces[mv] : undefined;
      return { points: material ? 0 : points, ...(material ? { material } : {}), ...(uncap ? { uncap } : {}) };
    };
    const streakOf = new Map(state.players.map((p) => [p.id, p.streak ?? 0]));
    const move = state.boss!.crowdMoves + 1;
    const context = cs ? { stage: 0, move, streaks: streakCounts(cs, undefined, fullmove, 0), streakOf: (id: string) => streakOf.get(id) ?? 0 } : undefined;
    const result = scoreGroup(picks, evaluation, rng, settings, "popular", allowance, context);
    crowdBrilliant(result, settings);
    if (result.brilliant) m.shoutouts++;
    if (move <= 10) for (const p of result.players) if (p.move && ply.pieces[p.move] === "gave" && (p.loss ?? 0) >= 10) hangers.add(p.playerId);
    state = applyRound(state, new Map([[0, ids]]), outcomesFromGroup(result, {}), settings);
    for (const p of result.players) {
      const w = window.get(p.playerId) ?? { pts: 0, loss: 0 };
      window.set(p.playerId, { pts: w.pts + p.roundScore, loss: w.loss + (p.move ? counted(ply, p.move) : settings.finalMissLoss) });
    }
    if (ply.stand) {
      // (The God King's Last Stand: the move is taken back, and so is the count to the next strike, which then weighs both rounds.)
      const b = state.boss!;
      state = { ...state, boss: { ...b, crowdMoves: b.crowdMoves - 1, sinceKill: Math.max(0, b.sinceKill - 1), lastStand: { atMove: b.crowdMoves - 1 } as NonNullable<MatchState["boss"]>["lastStand"] } };
      continue;
    }
    if (state.boss!.crowdMoves === 10) {
      const pts = state.players.filter((p) => p.alive).map((p) => standingPoints(p, settings));
      m.in10 = pts.filter((x) => x >= -10 && x <= 10).length / pts.length;
      const ranked = state.players.filter((p) => p.alive).sort((a, b) => standingPoints(b, settings) - standingPoints(a, settings));
      for (const id of hangers) {
        const i = ranked.findIndex((p) => p.id === id);
        if (i >= 0) m.hangPct.push(i / (ranked.length - 1));
      }
    }
    // The strike, by the variant's rule (bossKillDue's turn and survivors; its victim by the rule).
    const b = state.boss!;
    const due = b.sinceKill >= settings.bossKillEvery && state.players.filter((p) => p.alive).length > b.minSurvivors!;
    if (!due) continue;
    const victim = v.strike === "loss" ? (bossKillDue(state, settings) ? bossKill(state, rng, settings) : null) : null;
    let id: string | null = null;
    if (v.strike === "loss") {
      if (victim?.victim) {
        id = victim.victim;
        state = victim.state;
      }
    } else {
      id = pointsVictim(state, settings, window);
      if (id) {
        const place = state.players.filter((p) => p.alive).length;
        state = { ...state, players: state.players.map((p) => (p.id === id ? { ...p, alive: false, outInStage: 0, placement: place } : p)), boss: { ...b, sinceKill: 0, kills: [...b.kills, { id: id!, atMove: b.crowdMoves }] } };
      }
    }
    if (!id) {
      m.waits++;
      continue;
    }
    m.strikes++;
    // The victim's last pick: fine when it gave away 1 point or less, or more than 10% of the picks were worse.
    const last = ply.picks[idx(id)];
    const lastLoss = last ? counted(ply, last) : settings.finalMissLoss;
    const worse = picks.filter((p) => (p.move ? counted(ply, p.move) : settings.finalMissLoss) > lastLoss + 1e-9).length;
    if (lastLoss <= 1 || worse >= Math.ceil(0.1 * picks.length)) m.fineLast++;
    // Over the window: among the 5 who gave away the most (ties count as among)?
    const wl = window.get(id)!.loss;
    const worseWindow = ids.filter((x) => (window.get(x)?.loss ?? 0) > wl + 1e-9).length;
    if (worseWindow >= 5) m.fineWindow++;
    // The scoreboard at the strike (before it): players tied exactly with the last.
    const board = ids.map((x) => standingPoints(state.players.find((p) => p.id === x)!, settings)).sort((a, c) => a - c);
    m.boardTies.push(board.filter((x) => sameScore(x, board[0]!)).length - 1);
    window = new Map();
  }
  const struck = state.boss!.kills.map((k) => k.id);
  m.hangCount = hangers.size;
  m.hangStruck = [...hangers].filter((h) => state.boss!.kills.some((k) => k.id === h && k.atMove <= 20)).length;
  const order = new Map(struck.map((s, i) => [s, i]));
  m.rho = spearman(row.ratings, row.ratings.map((_, i) => order.get(`p${i}`) ?? 99));
  m.struckRating = struck.length ? struck.reduce((s, x) => s + row.ratings[idx(x)]!, 0) / struck.length : NaN;
  const top = [...state.players].sort((a: PlayerState, c: PlayerState) => standingPoints(c, settings) - standingPoints(a, settings)).slice(0, 8);
  for (const p of top) {
    m.streakPts += p.streakPoints ?? 0;
    m.topPts += Math.max(0, standingPoints(p, settings));
  }
  return m;
}

const mean = (x: number[]) => {
  const y = x.filter((v) => Number.isFinite(v));
  return y.length ? y.reduce((a, b) => a + b, 0) / y.length : NaN;
};
const se = (x: number[]) => {
  const y = x.filter((v) => Number.isFinite(v));
  return y.length > 1 ? Math.sqrt(y.reduce((s, v) => s + (v - mean(y)) ** 2, 0) / (y.length - 1) / y.length) : NaN;
};
const pm = (x: number[], d = 2, scale = 1) => `${(mean(x) * scale).toFixed(d)} ± ${(se(x) * scale).toFixed(d)}`;

function main() {
  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".jsonl") || f.endsWith(".jsonl.gz")).sort() : [];
  const text = (f: string) => (f.endsWith(".gz") ? gunzipSync(readFileSync(DIR + f)).toString("utf8") : readFileSync(DIR + f, "utf8"));
  const rows = files.flatMap((f) => text(f).split("\n").filter(Boolean).map((l) => JSON.parse(l) as RaidRow));
  const lines: string[] = [];
  const out = (s = "") => (lines.push(s), console.log(s));
  out("# Raid scoring: the sim");
  out();
  out("Generated by `npx tsx packages/sim/scripts/raid-scoring-sim.ts` from the raids `raid-scoring-trace.ts` recorded (reports/raid-scoring/*.jsonl.gz); the pick and why: docs/decisions/2026-10-25-raid-scoring.md. \"Chosen\" is RAID_SCORING as shipped.");
  out();
  const bosses = [...new Set(rows.map((r) => r.boss))];
  const results = rows.map((r) => r.result);
  out(`${rows.length} raids of 50 Maia players (ratings drawn evenly from 1100 to 1900, each pick sampled from Maia's own probabilities at its rating among the moves the boss allows) against ${bosses.join(", ")} (${bosses.map((b) => rows.filter((r) => r.boss === b).length).join(" / ")} raids), each played through the game's own MatchRunner with RAID_SETTINGS (the boss's brain and powers, the God King's Last Stand; judge and boss at 120k nodes). Mean crowd moves ${mean(rows.map((r) => r.plies.filter((p) => !p.stand).length)).toFixed(1)}; results: crowd ${results.filter((x) => x === "crowd").length}, boss ${results.filter((x) => x === "boss").length}, draw ${results.filter((x) => x === "draw").length}.`);
  out();
  out("Recording never strikes, so all 50 pick every move and every variant scores the same games (common random numbers); the strikes are re-played from the same picks by each rule. Mean ± its standard error over the raids.");
  out();
  out("| Scoring | in ±10 after 10 moves | strikes / raid | strike's victim played that move fine | victim not among the window's 5 worst | strikes that waited on a tie / raid | ties at the scoreboard's bottom at a strike | piece-hanger's place after 10 (0 top, 1 bottom) | hangers struck by move 20 | streak share of the top 8's points | shoutouts / raid | rating vs lasting (rank corr) | struck players' mean rating |");
  out("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const v of variants) {
    const ms = rows.map((r) => scoreRaid(r, v));
    const ratio = (a: (m: Metrics) => number, b: (m: Metrics) => number) => {
      const t = ms.reduce((s, m) => s + b(m), 0);
      return t ? `${((100 * ms.reduce((s, m) => s + a(m), 0)) / t).toFixed(0)}%` : "—";
    };
    const cells = [
      v.id === "chosen" ? `**${v.label} (chosen)**` : v.label,
      pm(ms.map((m) => m.in10), 0, 100) + "%",
      pm(ms.map((m) => m.strikes), 1),
      ratio((m) => m.fineLast, (m) => m.strikes),
      ratio((m) => m.fineWindow, (m) => m.strikes),
      pm(ms.map((m) => m.waits), 1),
      pm(ms.flatMap((m) => m.boardTies), 2),
      pm(ms.flatMap((m) => m.hangPct), 2),
      ratio((m) => m.hangStruck, (m) => m.hangCount),
      v.scoring ? ratio((m) => m.streakPts, (m) => m.topPts) : "—",
      v.scoring ? pm(ms.map((m) => m.shoutouts), 2) : "—",
      pm(ms.map((m) => m.rho), 2),
      pm(ms.map((m) => m.struckRating), 0),
    ];
    out(`| ${cells.join(" | ")} |`);
  }
  out();
  out("Columns: **in ±10** is the share of players still in with −10 to +10 points after 10 crowd moves. **Played that move fine**: the victim's pick on the move the strike came after gave away 1 point or less (counted), or more than 10% of the picks gave away more. **Not among the window's 5 worst**: by counted points given away since the boss's last strike. **Waited on a tie**: a strike due but two tied for the worst on every key, so it came a move later. **Ties at the bottom**: players level to the point with the scoreboard's last at each strike, beyond the last. **Piece-hangers**: a pick that gave up a piece by the exchange check and 10 points or more, in the first 10 crowd moves. **Rating vs lasting**: Spearman's correlation between a player's rating and how long they lasted (struck early: low; survivors: highest).");
  writeFileSync(root + "reports/raid-scoring.md", lines.join("\n") + "\n");
}

main();
