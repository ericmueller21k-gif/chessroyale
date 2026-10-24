/**
 * The 50 v 50 scoring rework's sim, step 2 (docs/decisions/2026-10-24-crowd-scoring.md): re-scores every match
 * crowd-scoring-trace.ts recorded (reports/crowd-scoring/*.jsonl) under today's scoring and each variant (`variants`),
 * through the game's own core code (scoreGroup, crowdBrilliant, applyRound, endStage), and writes reports/crowd-scoring.md.
 *
 *   npx tsx packages/sim/scripts/crowd-scoring-sim.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import {
  CROWD_SCORING,
  DEFAULT_SETTINGS,
  applyRound,
  createMatch,
  crowdBrilliant,
  endStage,
  isFinal,
  modeSettings,
  mulberry32,
  openingAllowance,
  streakCounts,
  outcomesFromGroup,
  roundsInStage,
  scoreGroup,
  standingPoints,
  standings,
  type CrowdScoring,
  type MatchState,
  type Settings,
} from "@chessroyale/core";
import { materialSlips } from "@chessroyale/chess";
import { spearman } from "../src/stats.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const OUT = root + "reports/crowd-scoring/";
const base: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd") };

/** One recorded ply: the position, the judge's numbers and every pick of the side to move (in player order). */
export interface Ply {
  fen: string;
  bestMove: string;
  bestExpected: number;
  after: Record<string, number>;
  slips: Record<string, "gave" | "missed">;
  /** Player index → move (only the side to move's players). */
  picks: Record<number, string | null>;
  /** Game restarted at this ply (a fresh board). */
  fresh?: boolean;
}
export interface MatchRow {
  kind: "maia" | "bots";
  seed: number;
  /** Per player: their team and strength (a Maia rating, or a bot's skill temperature: lower is stronger). */
  players: { team: "w" | "b"; rating: number }[];
  plies: Ply[];
}

// ---------------- score ----------------

/** A scoring to compare: today's (no CrowdScoring) or a variant of CROWD_SCORING. */
interface Variant {
  id: string;
  label: string;
  scoring?: CrowdScoring;
}

const CAPS: Record<string, CrowdScoring["cap"]> = {
  A: [2, 3.5, 5, 8],
  B: [3, 5, 8, null],
  C: [5, 5, 5, 5],
};
const RAMPS: Record<string, CrowdScoring["streakBonus"]> = {
  i: [1, 1.1, 1.25],
  ii: [0.25, 0.5, 0.75, 1],
  iii: [0.25, 0.4, 0.55, 0.7, 0.85, 1],
};
/** Every variant: today's, each cap with each ramp (the default k, strong band and grace), and the tuning sweeps. */
function variants(): Variant[] {
  const out: Variant[] = [{ id: "today", label: "Today's scoring" }];
  for (const [c, cap] of Object.entries(CAPS))
    for (const [r, ramp] of Object.entries(RAMPS)) out.push({ id: `${c}-${r}`, label: `Cap ${c}, ramp ${r}`, scoring: { ...CROWD_SCORING, cap, capCurve: "tanh", streakBonus: ramp } });
  for (const [c, cap] of Object.entries(CAPS))
    for (const [r, ramp] of Object.entries(RAMPS)) out.push({ id: `${c}-${r}-ratio`, label: `Cap ${c}, ratio curve, ramp ${r}`, scoring: { ...CROWD_SCORING, cap, capCurve: "ratio", streakBonus: ramp } });
  for (const [c, cap] of Object.entries(CAPS)) out.push({ id: `${c}-none`, label: `Cap ${c}, no streaks (chosen curve)`, scoring: { ...CROWD_SCORING, cap, streakBonus: [] } });
  const chosen = { ...CROWD_SCORING };
  for (const k of [0, 0.5, 1]) out.push({ id: `k${k}`, label: `Chosen, shared relief k ${k}`, scoring: { ...chosen, sharedK: k } });
  for (const s of [1, 2, 4]) out.push({ id: `strong${s}`, label: `Chosen, strong move within ${s} points`, scoring: { ...chosen, streakStrong: s } });
  for (const g of [0, 0.05, 0.1, 0.25]) out.push({ id: `grace${g}`, label: `Chosen, cut grace ${g}`, scoring: { ...chosen, cutGrace: g } });
  for (const u of [1, 3]) out.push({ id: `uncap${u}`, label: `Chosen, uncapped from ${u} pawns of material`, scoring: { ...chosen, uncapPawns: u } });
  for (const g of [8, 15, 25, 35, 50]) out.push({ id: `bgap${g}`, label: `Chosen, brilliant gap ${g} points`, scoring: { ...chosen, brilliantMinGap: g } });
  out.push({ id: "chosen-latestreak", label: "Chosen, streaks from the first cut", scoring: { ...chosen, streakFromCut: true } });
  return out;
}

interface Metrics {
  /** Every player's score after 10 moves a side (the first stage). */
  after10: number[];
  /** Per cut: exact ties with the line, near ties (within 0.1), and players saved by the grace. */
  ties: number[];
  near: number[];
  saves: number[];
  /** Bottom 5% after stage 1 reaching the final (per bottom player), the best player's win, reaching the final. */
  bottomFinal: number;
  bottomCount: number;
  /** The same for the bottom 5% of those who hung no piece, and for the bottom quarter. */
  slowFinal: number;
  slowCount: number;
  quarterFinal: number;
  bestWins: number;
  bestFinal: number;
  /** The winner's strength (a Maia rating, or a bot's skill temperature), the final 8's mean, and rank correlation. */
  winnerRating: number;
  finalRating: number;
  rho: number;
  /** The top 8's points from streaks and in all. */
  streakPts: number;
  topPts: number;
  /** Brilliant shoutouts. */
  shoutouts: number;
  /** Players who hung a piece (10+ points) in the first 10 moves: their rank percentile after 10 moves and at the end. */
  blunderPct: number[];
  blunderOut: number;
  blunderCount: number;
  /** The longest streak in the match. */
  maxStreak: number;
}

function scoreMatch(row: MatchRow, v: Variant): Metrics {
  const settings: Settings = { ...base, ...(v.scoring ? { crowdScoring: v.scoring } : { crowdScoring: undefined }) };
  const rng = mulberry32(row.seed);
  const entrants = row.players.map((p, i) => ({ id: `p${i}`, name: `P${i}`, isBot: true }));
  let state: MatchState = createMatch(entrants, [0], settings);
  state = { ...state, players: state.players.map((p, i) => ({ ...p, colour: row.players[i]!.team })) };
  // The best players: the top rating band (Maia: the 1900s, about 1 in 9; bots: the strongest 11).
  const strength = (i: number) => (row.kind === "maia" ? row.players[i]!.rating : -row.players[i]!.rating);
  const order = row.players.map((_, i) => i).sort((a, b) => strength(b) - strength(a) || a - b);
  const top = new Set(row.kind === "maia" ? order.filter((i) => strength(i) === strength(order[0]!)) : order.slice(0, 11));
  const m: Metrics = { after10: [], ties: [], near: [], saves: [], bottomFinal: 0, bottomCount: 0, slowFinal: 0, slowCount: 0, quarterFinal: 0, bestWins: 0, bestFinal: 0, winnerRating: 0, finalRating: 0, rho: 0, streakPts: 0, topPts: 0, shoutouts: 0, blunderPct: [], blunderOut: 0, blunderCount: 0, maxStreak: 0 };
  const blunderers = new Set<string>();
  let bottom: string[] = [];
  let slow: string[] = [];
  let quarter: string[] = [];
  let pickedMove = 0;
  for (const [n, ply] of row.plies.entries()) {
    if (isFinal(state, settings)) break;
    if (ply.fresh) pickedMove = 0;
    const side = ply.fen.split(" ")[1];
    if (side === "w") pickedMove++;
    const ids = state.players.filter((p) => p.alive && p.colour === side).map((p) => p.id);
    const picks = ids.map((id) => ({ playerId: id, move: ply.picks[Number(id.slice(1))] ?? null }));
    const evaluation = { bestMove: ply.bestMove, bestExpected: ply.bestExpected, expectedAfter: ply.after };
    const fullmove = Number(ply.fen.split(" ")[5]);
    const cs = settings.crowdScoring;
    // (As the runner's allowanceFor: the opening allowance on the game's move number, none for a material slip.)
    const points = openingAllowance(fullmove);
    const pieces = cs ? materialSlips(ply.fen, ply.bestMove, Object.keys(ply.after), cs.uncapPawns) : new Map();
    const allowance = (mv: string) => {
      const material = points > 0 ? ply.slips[mv] : undefined;
      const uncap = pieces.get(mv);
      return { points: material ? 0 : points, ...(material ? { material } : {}), ...(uncap ? { uncap } : {}) };
    };
    const streakOf = new Map(state.players.map((p) => [p.id, p.streak ?? 0]));
    const context = cs ? { stage: state.stage, streaks: streakCounts(cs, "normal", pickedMove, state.stage), streakOf: (id: string) => streakOf.get(id) ?? 0 } : undefined;
    const result = scoreGroup(picks, evaluation, rng, settings, "popular", allowance, context);
    crowdBrilliant(result, settings);
    if (result.brilliant) m.shoutouts++;
    // (A piece hung in the first 10 moves, whatever the scoring: the exchange check at a piece's worth.)
    const hung = pickedMove <= 10 ? materialSlips(ply.fen, ply.bestMove, Object.keys(ply.after), CROWD_SCORING.uncapPawns) : new Map();
    for (const p of result.players) if (p.move && hung.get(p.move) === "gave" && (p.loss ?? 0) >= 10) blunderers.add(p.playerId);
    state = applyRound(state, new Map([[0, ids]]), outcomesFromGroup(result, {}), settings);
    for (const p of state.players) m.maxStreak = Math.max(m.maxStreak, p.streak ?? 0);
    if (state.round >= roundsInStage(settings, state.stage)) {
      const ranked = standings(state, rng, settings);
      if (state.stage === 0) {
        m.after10 = ranked.map((p) => standingPoints(p, settings));
        bottom = [...ranked].slice(-5).map((p) => p.id);
        slow = ranked.filter((p) => !blunderers.has(p.id)).slice(-5).map((p) => p.id);
        quarter = ranked.slice(-25).map((p) => p.id);
        for (const id of blunderers) m.blunderPct.push(ranked.findIndex((p) => p.id === id) / ranked.length);
      }
      // Ties and near ties at this cut, per team, and what the grace saved (those within the grace but not tied).
      const grace = settings.crowdScoring?.cutGrace ?? 0;
      for (const team of ["w", "b"] as const) {
        const pool = ranked.filter((p) => p.colour === team);
        const k = Math.floor((settings.knockoutsPerStage[state.stage] ?? 0) / 2);
        const line = pool[pool.length - k - 1];
        if (!line) continue;
        const lp = standingPoints(line, settings);
        const below = pool.slice(pool.length - k);
        m.ties.push(below.filter((p) => Math.abs(standingPoints(p, settings) - lp) < 1e-9).length);
        m.near.push(below.filter((p) => Math.abs(standingPoints(p, settings) - lp) <= 0.1).length);
        m.saves.push(state.stage < settings.knockoutsPerStage.length - 1 ? below.filter((p) => Math.abs(standingPoints(p, settings) - lp) >= 1e-9 && lp - standingPoints(p, settings) <= grace + 1e-9).length : 0);
      }
      state = endStage(state, rng, [0], settings).state;
    }
    void n;
  }
  const finalists = state.players.filter((p) => p.alive);
  const ranked = [...finalists].sort((a, b) => standingPoints(b, settings) - standingPoints(a, settings));
  const idx = (id: string) => Number(id.slice(1));
  const winner = ranked[0]!;
  m.bestWins = top.has(idx(winner.id)) ? 1 : 0;
  m.bestFinal = finalists.filter((p) => top.has(idx(p.id))).length / top.size;
  m.winnerRating = row.players[idx(winner.id)]!.rating;
  m.finalRating = mean(finalists.map((p) => row.players[idx(p.id)]!.rating));
  // How far each got (the stage they went out in; the finalists past the last) against their strength.
  m.rho = spearman(state.players.map((_, i) => strength(i)), state.players.map((p) => (p.alive ? 99 : p.outInStage!)));
  m.bottomCount = bottom.length;
  m.bottomFinal = bottom.filter((id) => finalists.some((p) => p.id === id)).length;
  m.slowCount = slow.length;
  m.slowFinal = slow.filter((id) => finalists.some((p) => p.id === id)).length;
  m.quarterFinal = quarter.filter((id) => finalists.some((p) => p.id === id)).length / Math.max(1, quarter.length);
  for (const p of ranked) {
    m.streakPts += p.streakPoints ?? 0;
    m.topPts += Math.max(0, standingPoints(p, settings));
  }
  m.blunderCount = blunderers.size;
  m.blunderOut = [...blunderers].filter((id) => !finalists.some((p) => p.id === id)).length;
  return m;
}

const mean = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN);
const se = (x: number[]) => (x.length > 1 ? Math.sqrt(x.reduce((s, v) => s + (v - mean(x)) ** 2, 0) / (x.length - 1) / x.length) : NaN);
const pm = (x: number[], d = 2, scale = 1) => `${(mean(x) * scale).toFixed(d)} ± ${(se(x) * scale).toFixed(d)}`;

function score() {
  // (The recorded matches, kept gzipped in the repo: reports/crowd-scoring/*.jsonl.gz; fresh traces are plain .jsonl.)
  const files = existsSync(OUT) ? readdirSync(OUT).filter((f) => f.endsWith(".jsonl") || f.endsWith(".jsonl.gz")) : [];
  const text = (f: string) => (f.endsWith(".gz") ? gunzipSync(readFileSync(OUT + f)).toString("utf8") : readFileSync(OUT + f, "utf8"));
  const rows = files.flatMap((f) => text(f).split("\n").filter(Boolean).map((l) => JSON.parse(l) as MatchRow));
  const lines: string[] = [];
  const out = (s = "") => (lines.push(s), console.log(s));
  out("# 50 v 50 scoring: the sim");
  out();
  out("Generated by `npx tsx packages/sim/scripts/crowd-scoring-sim.ts score` (decision: docs/decisions/2026-10-24-crowd-scoring.md).");
  out("Every row is the mean over the recorded matches ± its standard error. Per match unless it says per cut or per player.");
  out("Metrics: **in ±10**: share of players within -10..+10 after 10 moves a side; **sd**: their spread (standard deviation);");
  out("**ties/near**: players at a cut's line tied exactly / within 0.1 (per team, per cut); **saves**: players the bubble grace");
  out("put through (per team, per cut); **bottom 5% → final**: share of the bottom 5 after stage 1 who reach the final (then the same for the bottom 5 of those who");
  out("hung no piece, and for the bottom quarter); **top band");
  out("wins**: the top of the final 8 on points is from the top rating band (Maia: the 1900s, about 1 in 9; bots: the strongest 11);");
  out("**top band in final**: the share of that band reaching the final; **winner's rating**; **rank corr**: strength against how far");
  out("each got (Spearman); **streak share**: the streak bonus's share of the");
  out("final 8's points; **shoutouts** per match; **max streak**; **blunder pct**: where a player who hung 10+ points of material");
  out("in the first 10 moves stands after 10 moves (0 = top, 1 = bottom); **blunder out**: share of them cut before the final.");
  for (const kind of ["maia", "bots"] as const) {
    const ms = rows.filter((r) => r.kind === kind);
    if (!ms.length) continue;
    out();
    out(`## ${kind === "maia" ? "Maia players (1100-1900), the main test" : "The game's bots (comparison)"}: ${ms.length} matches`);
    out();
    out(`| Scoring | in ±10 | sd after 10 | ties/cut | near/cut | saves/cut | bottom 5% → final | bottom 5%, no piece hung → final | bottom quarter → final | top band wins | top band in final | winner's ${kind === "maia" ? "rating" : "skill"} | rank corr | streak share | shoutouts | max streak | blunder pct | blunder out |`);
    out("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const v of variants()) {
      const r = ms.map((row) => scoreMatch(row, v));
      const in10 = r.map((x) => x.after10.filter((s) => Math.abs(s) <= 10).length / x.after10.length);
      const sd = r.map((x) => Math.sqrt(mean(x.after10.map((s) => (s - mean(x.after10)) ** 2))));
      const perCut = (f: (x: Metrics) => number[]) => r.map((x) => mean(f(x)));
      const bottom = r.map((x) => x.bottomFinal / Math.max(1, x.bottomCount));
      const slowB = r.map((x) => x.slowFinal / Math.max(1, x.slowCount));
      const share = r.map((x) => (x.topPts > 0 ? x.streakPts / x.topPts : 0));
      const bl = r.flatMap((x) => x.blunderPct);
      const blOut = r.flatMap((x) => (x.blunderCount ? [x.blunderOut / x.blunderCount] : []));
      out(
        `| ${v.label} | ${pm(in10, 0, 100)}% | ${pm(sd, 1)} | ${pm(perCut((x) => x.ties))} | ${pm(perCut((x) => x.near))} | ${pm(perCut((x) => x.saves))} | ${pm(bottom, 1, 100)}% | ${pm(slowB, 1, 100)}% | ${pm(r.map((x) => x.quarterFinal), 1, 100)}% | ${pm(r.map((x) => x.bestWins), 0, 100)}% | ${pm(r.map((x) => x.bestFinal), 0, 100)}% | ${pm(r.map((x) => x.winnerRating), kind === "maia" ? 0 : 1)} | ${pm(r.map((x) => x.rho))} | ${pm(share, 0, 100)}% | ${pm(r.map((x) => x.shoutouts))} | ${pm(r.map((x) => x.maxStreak), 1)} | ${bl.length ? pm(bl) : "—"} | ${blOut.length ? pm(blOut, 0, 100) + "%" : "—"} |`,
      );
    }
  }
  writeFileSync(root + "reports/crowd-scoring.md", lines.join("\n") + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) score();
