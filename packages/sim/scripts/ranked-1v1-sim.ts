/**
 * Ranked 1 v 1's rating and ranks on synthetic players with a known true strength (docs/areas/ranked.md): the hidden
 * rating (Glicko-1) and the ladder converging, the rank distribution, the queue's waits and gaps (core's pairUp), and
 * whether gaming it pays: losing the placements on purpose (sandbagging), and two accounts trading wins. Everything
 * runs through core's own functions (rankedGame, pairUp, rankView) and RANKED_1V1. Writes reports/ranked-1v1.md.
 *
 *   npx tsx packages/sim/scripts/ranked-1v1-sim.ts [players=1500] [rounds=400]
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RANKED_1V1, expectedScore, ladderRating, mulberry32, newRankedRecord, pairUp, rankView, rankedGame, ratingNow, type RankedRecord } from "@chessroyale/core";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const PLAYERS = Number(process.argv[2] ?? 1500);
const ROUNDS = Number(process.argv[3] ?? 400);
const DAY = 86_400_000;
const DRAWS = 0.08;
const rng = mulberry32(1016);

const gauss = () => {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
};
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};
const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))]!;
};
const f0 = (x: number) => (Number.isFinite(x) ? Math.round(x).toString() : "–");

/** A game between two true strengths: White's score (a draw `DRAWS` of the time, scaled down for lopsided games). */
function play(a: number, b: number): number {
  const e = expectedScore({ rating: a, rd: 0 }, { rating: b, rd: 0 });
  const draw = DRAWS * 4 * e * (1 - e);
  const r = rng();
  if (r < e - draw / 2) return 1;
  if (r < e + draw / 2) return 0.5;
  return 0;
}

/** The ladder integer a hidden rating stands for (the inverse of ladderRating), for "where they belong". */
const ladderAt = (rating: number) => Math.max(0, Math.floor((rating - RANKED_1V1.baseRating) / RANKED_1V1.ratingPerPoint));
const tierOf = (ladder: number | null) => (ladder === null ? "Placement" : rankView({ games: 99, ladder }).tier);

interface Player {
  id: string;
  truth: number;
  rec: RankedRecord;
  /** Hidden rating and ladder after each game. */
  trail: { hidden: number; ladder: number | null }[];
  /** Loses every placement game on purpose, then plays honestly. */
  sandbag?: boolean;
}

function population(n: number, tag: string): Player[] {
  const out: Player[] = [];
  for (let i = 0; i < n; i++) {
    const truth = clamp(1500 + 350 * gauss(), 500, 2900);
    // Some have played other modes (users.rating, a noisy read of their strength); the rest start at 1500.
    const seed = rng() < 0.6 ? truth + 250 * gauss() : null;
    out.push({ id: `${tag}${i}`, truth, rec: newRankedRecord(seed), trail: [] });
  }
  return out;
}

const waits: { online: number; waited: number[]; gaps: number[]; unpaired: number; seats: number }[] = [];

/**
 * One round: `online` players queue at the same moment; pairs are made each second (the range widening) for up to
 * 90 s; each pair plays one game. A round is `dayShare` of a day (idle days widen the deviation).
 */
function round(pool: Player[], online: number, now: number, stats?: (typeof waits)[number]) {
  const here = [...pool].sort(() => rng() - 0.5).slice(0, online);
  const t0 = now;
  let left = here.map((p) => ({ id: p.id, uid: p.id, ...ratingNow(p.rec, now), at: t0, p }));
  for (let s = 0; s <= 90 && left.length > 1; s++) {
    const pairs = pairUp(left, t0 + s * 1000);
    const gone = new Set<string>();
    for (const [x, y] of pairs) {
      gone.add(x.id);
      gone.add(y.id);
      stats?.waited.push(s, s);
      stats?.gaps.push(Math.abs(x.rating - y.rating));
      game(x.p, y.p, now + s * 1000);
    }
    left = left.filter((e) => !gone.has(e.id));
  }
  if (stats) {
    stats.unpaired += left.length;
    stats.seats += here.length;
  }
}

function game(a: Player, b: Player, now: number) {
  let score = play(a.truth, b.truth);
  if (a.sandbag && a.rec.games < RANKED_1V1.placements.games) score = 0;
  if (b.sandbag && b.rec.games < RANKED_1V1.placements.games) score = 1;
  const ra = rankedGame(a.rec, b.rec, score, now).next;
  const rb = rankedGame(b.rec, a.rec, 1 - score, now).next;
  a.rec = ra;
  b.rec = rb;
  a.trail.push({ hidden: ra.rating, ladder: ra.ladder });
  b.trail.push({ hidden: rb.rating, ladder: rb.ladder });
}

// ---------------- 1. A population ----------------

const pool = population(PLAYERS, "p");
// Twins: sandbaggers and honest players of the same true strengths, in the same population.
const twins: [Player, Player][] = [];
for (let i = 0; i < 60; i++) {
  const truth = 1500 + 400 * rng();
  const seed = truth + 250 * gauss();
  const s: Player = { id: `s${i}`, truth, rec: newRankedRecord(seed), trail: [], sandbag: true };
  const h: Player = { id: `h${i}`, truth, rec: newRankedRecord(seed), trail: [] };
  twins.push([s, h]);
  pool.push(s, h);
}
const ONLINE = Math.round(pool.length * 0.15);
const busy = { online: ONLINE, waited: [] as number[], gaps: [] as number[], unpaired: 0, seats: 0 };
for (let r = 0; r < ROUNDS; r++) round(pool, ONLINE, r * 0.1 * DAY, r >= 20 ? busy : undefined);

// Convergence by games played.
const CHECK = [1, 5, 6, 10, 20, 40, 80];
const conv = CHECK.map((g) => {
  const hidden: number[] = [];
  const ladder: number[] = [];
  let sameTier = 0;
  let n = 0;
  for (const p of pool) {
    const t = p.trail[g - 1];
    if (!t || p.sandbag) continue;
    n++;
    hidden.push(Math.abs(t.hidden - p.truth));
    if (t.ladder !== null) {
      ladder.push(Math.abs(ladderRating(t.ladder) - p.truth));
      if (tierOf(t.ladder) === tierOf(ladderAt(p.truth))) sameTier++;
    }
  }
  return { g, n, hidden: median(hidden), hidden90: pct(hidden, 0.9), ladder: median(ladder), ladder90: pct(ladder, 0.9), sameTier: ladder.length ? sameTier / ladder.length : NaN };
});

// The ranks of everyone with 20 games or more, against where their true strength would put them.
const TIERS = [...RANKED_1V1.tiers.map((t) => t.name), ...RANKED_1V1.apex.map((a) => a.name)];
const settled = pool.filter((p) => p.rec.games >= 20 && !p.sandbag);
const dist = TIERS.map((t) => ({
  tier: t,
  ranked: settled.filter((p) => tierOf(p.rec.ladder) === t).length / settled.length,
  truth: settled.filter((p) => tierOf(ladderAt(p.truth)) === t).length / settled.length,
}));

// The scale: by true strength, how far the hidden rating and the rank's rating sit from it (signed), and how well the
// ranks keep the players' order (Spearman's rank correlation of the ladder with the true strength).
const BANDS = [[500, 900], [900, 1200], [1200, 1500], [1500, 1800], [1800, 2100], [2100, 2400], [2400, 2900]] as const;
const scale = BANDS.map(([lo, hi]) => {
  const ps = settled.filter((p) => p.truth >= lo && p.truth < hi);
  const avg = (f: (p: Player) => number) => ps.reduce((a, p) => a + f(p), 0) / Math.max(1, ps.length);
  return { lo, hi, n: ps.length, hidden: avg((p) => p.rec.rating - p.truth), ladder: avg((p) => ladderRating(p.rec.ladder!) - p.truth) };
});
const ranks = (xs: number[]) => {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  order.forEach(([, i], k) => (r[i] = k));
  return r;
};
const spearman = (() => {
  const a = ranks(settled.map((p) => p.truth));
  const b = ranks(settled.map((p) => p.rec.ladder! + p.rec.rating / 10_000));
  const n = a.length;
  const d2 = a.reduce((acc, x, i) => acc + (x - b[i]!) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
})();

// Sandbagging: the twins' ladders after the same number of games.
const SB = [6, 10, 20, 40, 80];
const sandbag = SB.map((g) => {
  const diffs: number[] = [];
  let ahead = 0;
  for (const [s, h] of twins) {
    const a = s.trail[g - 1]?.ladder;
    const b = h.trail[g - 1]?.ladder;
    if (a == null || b == null) continue;
    diffs.push(a - b);
    if (a > b) ahead++;
  }
  return { g, n: diffs.length, median: median(diffs), ahead: diffs.length ? ahead / diffs.length : NaN };
});

// ---------------- 2. A quiet queue (launch) ----------------

const quietPool = population(200, "q");
const quiet: (typeof waits)[number][] = [];
for (const online of [4, 8, 16, 40]) {
  const st = { online, waited: [] as number[], gaps: [] as number[], unpaired: 0, seats: 0 };
  for (let r = 0; r < 300; r++) round(quietPool, online, (1000 + r) * 0.1 * DAY, r >= 40 ? st : undefined);
  quiet.push(st);
}

// ---------------- 3. Two accounts trading wins ----------------

/** A always beats B, and they always meet (alone in a quiet queue) while the range allows it. */
function winTrade(games: number) {
  const a: Player = { id: "A", truth: 1500, rec: newRankedRecord(null), trail: [] };
  const b: Player = { id: "B", truth: 1500, rec: newRankedRecord(null), trail: [] };
  let played = 0;
  for (let i = 0; i < games; i++) {
    const now = i * 0.02 * DAY;
    const x = { id: "A", uid: "A", ...ratingNow(a.rec, now), at: now };
    const y = { id: "B", uid: "B", ...ratingNow(b.rec, now), at: now };
    // They wait as long as it takes (the range at its widest).
    if (!pairUp([x, y], now + 600_000).length) break;
    played++;
    a.rec = rankedGame(a.rec, b.rec, 1, now).next;
    b.rec = rankedGame(b.rec, a.rec, 0, now).next;
  }
  return { played, a: rankView(a.rec).label, aHidden: a.rec.rating, b: rankView(b.rec).label, bHidden: b.rec.rating };
}
const trades = [20, 50, 100, 200, 400].map((g) => ({ g, ...winTrade(g) }));

// ---------------- The report ----------------

const R = RANKED_1V1;
const lines: string[] = [];
lines.push("# Ranked 1 v 1: ratings, ranks and pairing on synthetic players");
lines.push("");
lines.push(
  `Generated by \`packages/sim/scripts/ranked-1v1-sim.ts\` (seeded; \`npx tsx packages/sim/scripts/ranked-1v1-sim.ts ${PLAYERS} ${ROUNDS}\`), through core's own \`rankedGame\`, \`pairUp\` and \`rankView\` with \`RANKED_1V1\` as it stands: Glicko-1 from ${R.rating.start} (or the account's rating from other modes), RD ${R.rating.startRd} → ${R.rating.minRd}; rank points 2 × ${R.points.perGame} × (result − expected result) plus ${R.points.perRating} × (hidden − ladder rating) within ±${R.points.maxAdjust}; ${R.placements.games} placements, placed at most Diamond 4 0; pairing within ${R.match.startRange} + ${R.match.perSecond}/s waited + ${R.match.perRd} × the larger deviation, at most ${R.match.maxRange}.`,
);
lines.push("");
lines.push(
  `**The players:** ${PLAYERS} with a true strength drawn from a normal curve (mean 1500, spread 350, kept within 500-2900) on the Elo scale; 60% start from an account rating that reads their strength give or take 250, the rest at 1500. A game's result comes from the two true strengths (Elo's expected score, ${DRAWS * 100}% draws between equals). Each round, ${Math.round(0.15 * 100)}% of them (${ONLINE}) queue at once and are paired second by second for up to 90 s; a round is a tenth of a day. ${ROUNDS} rounds.`,
);
lines.push("");
lines.push("## The hidden rating and the ladder converge");
lines.push("");
lines.push("How far from the true strength, by games played (players who played that many; the ladder's rating is the rating a rank stands for: 800 at Iron 4 0, 2400 at Master).");
lines.push("");
lines.push("| Games | Players | Hidden rating off by (median) | 90th percentile | Ladder's rating off by (median) | 90th percentile | In their true tier |");
lines.push("| --- | --- | --- | --- | --- | --- | --- |");
for (const c of conv) lines.push(`| ${c.g} | ${c.n} | ${f0(c.hidden)} | ${f0(c.hidden90)} | ${f0(c.ladder)} | ${f0(c.ladder90)} | ${Number.isFinite(c.sameTier) ? `${Math.round(c.sameTier * 100)}%` : "–"} |`);
lines.push("");
lines.push("## The rank distribution");
lines.push("");
lines.push(`Players with 20 games or more (${settled.length}): their rank against the tier their true strength stands for.`);
lines.push("");
lines.push("| Tier | Ranked there | True strength there |");
lines.push("| --- | --- | --- |");
for (const d of dist) lines.push(`| ${d.tier} | ${(d.ranked * 100).toFixed(1)}% | ${(d.truth * 100).toFixed(1)}% |`);
lines.push("");
lines.push(
  `**The scale.** The ranks keep the players' order (Spearman's rank correlation of rank with true strength: ${spearman.toFixed(2)}), but pairing by the closest rating stretches the scale: the strong are rated above their true number and the weak below, more so the longer they play (results between near-equals say little about the scale). Ranks are relative, so this costs little; it is why the tails hold more players than the true strengths would put there. Signed, by true strength:`,
);
lines.push("");
lines.push("| True strength | Players | Hidden − true (mean) | Rank's rating − true (mean) |");
lines.push("| --- | --- | --- | --- |");
for (const b of scale) lines.push(`| ${b.lo}-${b.hi} | ${b.n} | ${f0(b.hidden)} | ${f0(b.ladder)} |`);
lines.push("");
lines.push("## Pairing: waits and gaps");
lines.push("");
lines.push("Seconds waited and the hidden-rating gap of the pairs made, by how many queue at once (\"Unpaired\": still waiting at 90 s, when the app has offered the bot since 45).");
lines.push("");
lines.push("| Queueing at once | Median wait | 90th percentile | Median gap | 90th percentile | Unpaired at 90 s |");
lines.push("| --- | --- | --- | --- | --- | --- |");
for (const s of [...quiet, busy]) lines.push(`| ${s.online} | ${f0(median(s.waited))} s | ${f0(pct(s.waited, 0.9))} s | ${f0(median(s.gaps))} | ${f0(pct(s.gaps, 0.9))} | ${((s.unpaired / Math.max(1, s.seats)) * 100).toFixed(1)}% |`);
lines.push("");
lines.push("## Gaming it");
lines.push("");
lines.push(
  `**Sandbagging:** ${twins.length} pairs of twins (the same true strength, 1500-1900, and the same account rating) in the same population; one loses all five placements on purpose, then plays honestly. The sandbagger's ladder minus the honest twin's, after the same number of games (100 = one division):`,
);
lines.push("");
lines.push("| Games | Pairs | Sandbagger − honest twin (median ladder points) | Sandbagger ahead |");
lines.push("| --- | --- | --- | --- |");
for (const s of sandbag) lines.push(`| ${s.g} | ${s.n} | ${f0(s.median)} | ${Number.isFinite(s.ahead) ? `${Math.round(s.ahead * 100)}%` : "–"} |`);
lines.push("");
lines.push(
  "**Trading wins:** two new accounts of equal strength, alone in a quiet queue, A always beating B for as long as the pairing range lets them meet (the range at its widest).",
);
lines.push("");
lines.push("| Traded | Games they could play | A's rank | A's hidden rating | B's rank | B's hidden rating |");
lines.push("| --- | --- | --- | --- | --- | --- |");
for (const t of trades) lines.push(`| ${t.g} | ${t.played} | ${t.a} | ${f0(t.aHidden)} | ${t.b} | ${f0(t.bHidden)} |`);
lines.push("");
lines.push(
  "Not simulated: leaving (resigning is a loss; leaving before both first moves is an abort, which records nothing) and bots (bot games are unranked).",
);
lines.push("");
writeFileSync(root + "reports/ranked-1v1.md", lines.join("\n"));
console.log(lines.join("\n"));
