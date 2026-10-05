/**
 * Does the scoring engine's misjudging change who gets cut? Replays a 100-player crowd match many times on the
 * positions measured by judge-accuracy.ts (reports/judge-accuracy/*.jsonl): every player picks among each
 * position's 12 moves by their skill (judged on the referee's losses, the truth), plus an occasional random
 * blunder, and the same picks are scored by each judge. The cut schedule is the 50 v 50 one (no cuts for 10
 * moves, then 16, 14, 12, 10, 8, 8, 6, 6, 4, 4 out, down to the final 8). Scores are relative to everyone who
 * picked that turn, as in the game.
 *
 *   npx tsx packages/sim/scripts/judge-cuts.ts [matches]
 */
import { mulberry32 } from "@chessroyale/core";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const dir = root + "reports/judge-accuracy/";
type Row = { picks: string[]; lite: Record<string, number>; lite1m: Record<string, number>; full: Record<string, number>; ref: Record<string, number> };
const rows: Row[] = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).flatMap((f) => readFileSync(dir + f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)));

const N = 100;
const FIRST = 10;
const CUTS = [16, 14, 12, 10, 8, 8, 6, 6, 4, 4];
const RANDOM_MOVE = 0.05;
const skills = Array.from({ length: N }, (_, i) => 0.5 * Math.pow(60, i / (N - 1))); // 0 = strongest

/** Judges: a name and how it turns a row into each pick's loss. */
const band = (o: Record<string, number>, b: number) => Object.fromEntries(Object.entries(o).map(([m, v]) => [m, v < b ? 0 : v]));
/** Picks the judge `k` scores `at`+ are searched again by `by` (a deeper search), and that score is used. */
const recheck = (r: Row, k: "lite" | "lite1m", at: number, by: "ref" | "lite1m" | "full" = "ref") =>
  Object.fromEntries(r.picks.map((m) => [m, r[k][m]! >= at ? r[by][m]! : r[k][m]!]));
const JUDGES: [string, (r: Row) => Record<string, number>][] = [
  ["Referee (truth)", (r) => r.ref],
  ["Today: lite 250k", (r) => r.lite],
  ["Lite 1M (4x time)", (r) => r.lite1m],
  ["Full net 250k", (r) => r.full],
  ["Today + 3-point good-move band", (r) => band(r.lite, 3)],
  ["Today + deep re-check of picks it calls 8+", (r) => recheck(r, "lite", 8)],
  ["Today + band + re-check", (r) => band(recheck(r, "lite", 8), 3)],
  ["Today + re-check 8+ with lite 1M (phone can do)", (r) => recheck(r, "lite", 8, "lite1m")],
  ["Today + re-check 5+ with lite 1M (phone can do)", (r) => recheck(r, "lite", 5, "lite1m")],
  ["Lite 1M + re-check 8+ with the referee (a server)", (r) => recheck(r, "lite1m", 8, "ref")],
];

function match(seed: number) {
  const rng = mulberry32(seed);
  const turns = FIRST + CUTS.length;
  // Everyone's pick each turn, decided once (by true quality), then scored by every judge.
  const plan = Array.from({ length: turns }, () => {
    const row = rows[Math.floor(rng() * rows.length)]!;
    const picks = skills.map((T) => {
      if (rng() < RANDOM_MOVE) return row.picks[8 + Math.floor(rng() * (row.picks.length - 8))] ?? row.picks[row.picks.length - 1]!;
      const w = row.picks.map((m) => Math.exp(-row.ref[m]! / T));
      let x = rng() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < w.length; i++) if ((x -= w[i]!) <= 0) return row.picks[i]!;
      return row.picks[0]!;
    });
    return { row, picks };
  });
  // The truth's running score (the referee's losses), to ask how good a cut player's game really was.
  const trueScore: number[][] = [];
  {
    const sc = new Array(N).fill(0);
    plan.forEach(({ row, picks }) => {
      const avg = picks.reduce((s, m) => s + row.ref[m]!, 0) / N;
      picks.forEach((m, i) => (sc[i] += avg - row.ref[m]!));
      trueScore.push([...sc]);
    });
  }
  return JUDGES.map(([, judge]) => {
    let strongCut = 0;
    let topQuarterCut = 0;
    const score = new Array(N).fill(0);
    const alive = new Set(skills.map((_, i) => i));
    const outAt = new Array(N).fill(99);
    plan.forEach(({ row, picks }, t) => {
      const loss = judge(row);
      const ids = [...alive];
      const avg = ids.reduce((s, i) => s + loss[picks[i]!]!, 0) / ids.length;
      for (const i of ids) score[i] += avg - loss[picks[i]!]!;
      const c = t - FIRST + 1;
      if (c >= 0 && c < CUTS.length) {
        const order = ids.sort((a, b) => score[a] - score[b]);
        // How each cut player really ranked among those alive (by the truth's score so far).
        const trueRank = [...ids].sort((a, b) => trueScore[t]![b]! - trueScore[t]![a]!);
        for (const i of order.slice(0, CUTS[c]!)) {
          const r = trueRank.indexOf(i) / ids.length;
          if (r < 0.5) strongCut++;
          if (r < 0.25) topQuarterCut++;
          alive.delete(i);
          outAt[i] = c;
        }
      }
    });
    return { finalists: new Set(alive), outAt, strongCut, topQuarterCut };
  });
}

const matches = Number(process.argv[2] ?? 400);
const tally = JUDGES.map(() => ({ wrongCuts: 0, cuts: 0, finalistsDiff: 0, top10Early: 0, top10Final: 0, strong: 0, topQ: 0 }));
for (let s = 1; s <= matches; s++) {
  const res = match(s);
  const truth = res[0]!;
  res.forEach((r, j) => {
    const t = tally[j]!;
    // A wrong cut: someone this judge cut at a cut where the truth kept them.
    for (let i = 0; i < N; i++) {
      if (r.outAt[i] < 99) t.cuts++;
      if (r.outAt[i] < 99 && truth.outAt[i] > r.outAt[i]) t.wrongCuts++;
    }
    t.strong += r.strongCut;
    t.topQ += r.topQuarterCut;
    t.finalistsDiff += [...r.finalists].filter((i) => !truth.finalists.has(i)).length;
    t.top10Early += r.outAt.slice(0, 10).filter((c) => c <= 1).length;
    t.top10Final += [...r.finalists].filter((i) => i < 10).length;
  });
}
console.log(`${rows.length} positions, ${matches} matches of ${N} players`);
console.log("| Judge | Cut while really in the top half | Cut while really in the top quarter | Any swap at the cut line | Top-10 players in the final 8 |");
console.log("| --- | --- | --- | --- | --- |");
JUDGES.forEach(([name], j) => {
  const t = tally[j]!;
  console.log(`| ${name} | ${((100 * t.strong) / t.cuts).toFixed(2)}% | ${((100 * t.topQ) / t.cuts).toFixed(2)}% | ${((100 * t.wrongCuts) / t.cuts).toFixed(1)}% | ${(t.top10Final / matches).toFixed(2)} |`);
});
