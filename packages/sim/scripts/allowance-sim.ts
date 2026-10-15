/**
 * The opening allowance and ties at the cut, in real Crowd 50 v 50 matches of 100 bots (DECISIONS.md, "Opening grace
 * and ties survive the cut", Oct 15, 2026). Records every round (position, best move, each pick's raw and counted loss,
 * the engine's top 8) and every cut (who went out, who stayed, the scores), so the same file can be written by the
 * code before the change and after it and compared.
 *
 *   npx tsx packages/sim/scripts/allowance-sim.ts run <label> <matches> [engines=3] [nodes=250000] [format=team]
 *       -> reports/allowance-sim/<label>.jsonl (one line per match)
 *   npx tsx packages/sim/scripts/allowance-sim.ts summary <before> <after>   -> reports/allowance-sim.md
 *
 * `run` uses only what the match runner had before the change, so it runs on either side of it. Eric's goal: "the goal is
 * simply to still cut players playing poor, and not punish players not playing precise engine lines or slight
 * variations in the opening 10-14 moves."
 */
import { CROWD_KNOCKOUTS, DEFAULT_SETTINGS, botSkillSpread, modeSettings, mulberry32, shuffle, type FinalFormat, type Settings } from "@chessroyale/core";
import * as chess from "@chessroyale/chess";
import { MatchRunner, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const dir = root + "reports/allowance-sim/";

interface RoundRec {
  stage: number;
  fen: string;
  best: string;
  top: string[];
  picks: { id: string; move: string | null; loss: number | null; counted?: number; score: number }[];
}
interface CutRec {
  stage: number;
  /** Before the cut: every player still in, with their score; who went out. */
  scores: Record<string, number>;
  out: string[];
  colour: Record<string, string | null>;
}
interface MatchRec {
  seed: number;
  skills: Record<string, number>;
  rounds: RoundRec[];
  cuts: CutRec[];
  finalists: string[];
  plies: number;
  placements: Record<string, number>;
}

async function run(label: string, matches: number, engineCount: number, nodes: number, format: FinalFormat) {
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const settings: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd"), finalFormat: format, knockoutsPerStage: CROWD_KNOCKOUTS[format], engineNodes: nodes };
  mkdirSync(dir, { recursive: true });
  const file = `${dir}${label}.jsonl`;
  writeFileSync(file, "");
  let next = 0;
  await Promise.all(
    Array.from({ length: engineCount }, async () => {
      const engine = await createNodeEngine({ nodes, hashMb: 16 });
      while (next < matches) {
        const m = next++;
        const rec = await playMatch(engine, settings, library, 7000 + m);
        appendFileSync(file, JSON.stringify(rec) + "\n");
        console.log(`${label}: match ${m + 1}/${matches} (${rec.plies} plies)`);
      }
      engine.close();
    }),
  );
}

async function playMatch(engine: Awaited<ReturnType<typeof createNodeEngine>>, settings: Settings, library: Opening[], seed: number): Promise<MatchRec> {
  const rng = mulberry32(seed);
  const skills = botSkillSpread(100, settings);
  const entrants = shuffle(rng, skills.map((skill, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill })));
  const runner = new MatchRunner({ settings, rng, engines: [engine], library, entrants });
  const rec: MatchRec = { seed, skills: Object.fromEntries(entrants.map((e) => [e.id, e.skill])), rounds: [], cuts: [], finalists: [], plies: 0, placements: {} };
  while (!runner.isOver()) {
    runner.deal();
    runner.prefetch();
    const stage = runner.state.stage;
    const report = await runner.score(new Map());
    rec.plies++;
    for (const b of report.boards) {
      if (runner.isFinal() || b.fenBefore.split(" ")[5] === undefined) continue;
      const top = (await runner.topMovesFor(b.fenBefore)).map((m) => m.move);
      rec.rounds.push({
        stage,
        fen: b.fenBefore,
        best: b.bestMove,
        top,
        picks: b.result.players.map((p) => ({
          id: p.playerId,
          move: p.move,
          loss: p.loss === null ? null : Math.round(p.loss * 1000) / 1000,
          ...((p as { counted?: number }).counted !== undefined ? { counted: Math.round((p as { counted?: number }).counted! * 1000) / 1000 } : {}),
          score: Math.round(p.roundScore * 1000) / 1000,
        })),
      });
    }
    if (runner.stageComplete()) {
      if (runner.isFinal()) runner.finishFinal();
      else {
        const alive = runner.alive();
        const scores = Object.fromEntries(alive.map((p) => [p.id, p.stageScore]));
        const colour = Object.fromEntries(alive.map((p) => [p.id, p.colour]));
        const end = runner.endStage();
        rec.cuts.push({ stage, scores, out: end.knockedOut.map((p) => p.id), colour });
        if (runner.isFinal()) rec.finalists = runner.alive().map((p) => p.id);
      }
    }
  }
  rec.placements = Object.fromEntries(runner.state.players.map((p) => [p.id, p.placement!]));
  return rec;
}

// ---------------- Summary ----------------

const exchangeNet = (chess as unknown as { exchangeNet?: (fen: string, move: string) => number | null }).exchangeNet;

/** The pick gave up a pawn or more against the best move by the game's exchange check (as the allowance's fallback). */
function materialError(r: RoundRec, move: string): boolean {
  if (!exchangeNet || move === r.best) return false;
  const b = exchangeNet(r.fen, r.best);
  const m = exchangeNet(r.fen, move);
  return b !== null && m !== null && b - m >= 1;
}

function summary(beforeLabel: string, afterLabel: string) {
  // (The committed data is gzipped: <label>.jsonl.gz; a fresh run writes <label>.jsonl.)
  const load = (label: string) =>
    (existsSync(`${dir}${label}.jsonl`) ? readFileSync(`${dir}${label}.jsonl`, "utf8") : gunzipSync(readFileSync(`${dir}${label}.jsonl.gz`)).toString("utf8"))
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as MatchRec);
  const sides = [
    ["before", load(beforeLabel)],
    ["after", load(afterLabel)],
  ] as const;
  const lines: string[] = [];
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const pctOf = (k: number, n: number) => (n ? `${Math.round((100 * k) / n)}%` : "–");
  lines.push("# The opening allowance and ties at the cut: Crowd 50 v 50 bot matches");
  lines.push("");
  lines.push(
    `Made by \`packages/sim/scripts/allowance-sim.ts\`: ${sides[0][1].length} matches before the change and ${sides[1][1].length} after, the same seeds (the matches are identical up to the first cut), 100 bots (skills spread from strongest to loosest), team final.`,
  );
  lines.push("");
  lines.push('Eric\'s goal: "the goal is simply to still cut players playing poor, and not punish players not playing precise engine lines or slight variations in the opening 10-14 moves."');
  lines.push("");
  lines.push("- **Poor play:** a pick that gave up a pawn or more against the best move by the exchange check (the allowance's fallback), or lost 20 points or more (raw).");
  lines.push("- **Slight variations:** every pick among the engine's top 8.");
  lines.push("");
  for (const cutNo of [0, 1]) {
    lines.push(`## Cut ${cutNo + 1} (${cutNo === 0 ? "after move 10" : "after move 11"})`);
    lines.push("");
    lines.push("| | before | after |");
    lines.push("| --- | ---: | ---: |");
    const rows: Record<string, string[]> = {};
    const add = (k: string, v: string) => (rows[k] ??= []).push(v);
    for (const [, ms] of sides) {
      let cut = 0, cutPoor = 0, cutNeg = 0, surv = 0, survTop8 = 0, survPoor = 0, tiedThrough = 0, cuts = 0, out = 0;
      let clean = 0, cleanThrough = 0, poorAll = 0, poorCut = 0;
      const cutSkill: number[] = [];
      for (const m of ms) {
        const c = m.cuts[cutNo];
        if (!c) continue;
        cuts++;
        const rounds = m.rounds.filter((r) => r.stage <= c.stage);
        const poor = new Set<string>();
        const offTop = new Set<string>();
        for (const r of rounds)
          for (const p of r.picks) {
            if (!p.move) {
              poor.add(p.id);
              continue;
            }
            if ((p.loss ?? 0) >= 20 || materialError(r, p.move)) poor.add(p.id);
            if (!r.top.includes(p.move)) offTop.add(p.id);
          }
        const outs = new Set(c.out);
        out += c.out.length;
        for (const id of c.out) {
          cut++;
          if (poor.has(id)) cutPoor++;
          if (c.scores[id]! < -1e-9) cutNeg++;
          cutSkill.push(m.skills[id]!);
        }
        for (const id of Object.keys(c.scores)) {
          // Only the engine's top 8, and nothing poor (a sound move off the line is still one of them).
          if (!offTop.has(id) && !poor.has(id)) {
            clean++;
            if (!outs.has(id)) cleanThrough++;
          }
          if (poor.has(id)) {
            poorAll++;
            if (outs.has(id)) poorCut++;
          }
        }
        const through = Object.keys(c.scores).filter((id) => !outs.has(id));
        for (const id of through) {
          surv++;
          if (!offTop.has(id)) survTop8++;
          if (poor.has(id)) survPoor++;
        }
        tiedThrough += cutLines(m)[cutNo]!.kept;
      }
      add("Players cut (per match)", (out / Math.max(1, cuts)).toFixed(1));
      add("**Of those who played only top-8 moves (nothing poor), went through**", pctOf(cleanThrough, clean));
      add("**Of those who had played poorly, cut**", pctOf(poorCut, poorAll));
      add("Cut players who played poorly (a material error, a loss of 20+ or a miss)", pctOf(cutPoor, cut));
      add("Cut players with a negative score", pctOf(cutNeg, cut));
      add("Cut players' bot temperature (median; higher is looser)", cutSkill.length ? cutSkill.sort((a, b) => a - b)[Math.floor(cutSkill.length / 2)]!.toFixed(1) : "–");
      add("Survivors who played only top-8 moves", pctOf(survTop8, surv));
      add("Survivors who had played poorly", pctOf(survPoor, surv));
      add("Kept in by a tie at the line, owed by the next cut (per match)", (tiedThrough / Math.max(1, cuts)).toFixed(1));
    }
    for (const [k, v] of Object.entries(rows)) lines.push(`| ${k} | ${v.join(" | ")} |`);
    lines.push("");
  }
  // Match-wide.
  lines.push("## The whole match");
  lines.push("");
  lines.push("| | before | after |");
  lines.push("| --- | ---: | ---: |");
  const whole: Record<string, string[]> = {};
  const addW = (k: string, v: string) => (whole[k] ??= []).push(v);
  for (const [, ms] of sides) {
    addW("Plies per match (mean)", mean(ms.map((m) => m.plies)).toFixed(1));
    addW("Cuts with fewer out than the plan (share)", pctOf(ms.flatMap((m) => m.cuts.filter((c, i) => c.out.length < CROWD_KNOCKOUTS.team[i]!)).length, ms.flatMap((m) => m.cuts).length));
    addW("Cuts with an exact tie at a team's line (share)", pctOf(ms.flatMap((m) => cutLines(m).filter((l) => l.tie)).length, ms.flatMap((m) => m.cuts).length));
    addW("Owed to the next cut after each cut (mean: kept in by ties, not yet taken)", CROWD_KNOCKOUTS.team.map((_, i) => mean(ms.flatMap((m) => (cutLines(m)[i] ? [cutLines(m)[i]!.kept] : []))).toFixed(1)).join(" · "));
    addW("Most owed at once (mean of each match's largest)", mean(ms.map((m) => Math.max(0, ...cutLines(m).map((l) => l.kept)))).toFixed(1));
    const outs = CROWD_KNOCKOUTS.team.map((_, i) => mean(ms.flatMap((m) => (m.cuts[i] ? [m.cuts[i]!.out.length] : []))).toFixed(1));
    addW("Out at each cut (mean)", outs.join(" · "));
    addW("Finalists (every match)", [...new Set(ms.map((m) => m.finalists.length))].join(", "));
    const rho = mean(ms.map((m) => spearman(Object.keys(m.skills).map((id) => m.skills[id]!), Object.keys(m.skills).map((id) => m.placements[id]!))));
    addW("Placement against bot skill (Spearman)", rho.toFixed(3));
  }
  for (const [k, v] of Object.entries(whole)) lines.push(`| ${k} | ${v.join(" | ")} |`);
  lines.push("");
  writeFileSync(root + "reports/allowance-sim.md", lines.join("\n"));
  console.log(lines.join("\n"));
}

/**
 * Each cut's line, team by team: what it owed (its half of the plan, plus what the team's last cut left over), whether
 * the last one through and the first one below were tied exactly there, and how many it kept in (owed, less those out).
 */
function cutLines(m: MatchRec): { tie: boolean; kept: number }[] {
  const carry: Record<string, number> = { w: 0, b: 0 };
  return m.cuts.map((c, i) => {
    let tie = false;
    let kept = 0;
    for (const side of ["w", "b"]) {
      const team = Object.keys(c.scores)
        .filter((id) => c.colour[id] === side)
        .sort((a, b) => c.scores[b]! - c.scores[a]!);
      const owed = Math.floor(CROWD_KNOCKOUTS.team[i]! / 2) + carry[side]!;
      const out = c.out.filter((id) => c.colour[id] === side).length;
      const last = team[team.length - owed - 1];
      const first = team[team.length - owed];
      if (last && first && Math.abs(c.scores[last]! - c.scores[first]!) < 1e-9) tie = true;
      kept += Math.max(0, owed - out);
      carry[side] = Math.max(0, owed - out);
    }
    return { tie, kept };
  });
}

function spearman(a: number[], b: number[]): number {
  const rank = (xs: number[]) => {
    const order = xs.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array<number>(xs.length);
    order.forEach(([, i], k) => (r[i] = k));
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const d2 = ra.reduce((s, x, i) => s + (x - rb[i]!) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

const [cmd, a, b, c, d, e] = process.argv.slice(2);
if (cmd === "run") await run(a ?? "after", Number(b ?? 10), Number(c ?? 3), Number(d ?? 250_000), (e ?? "team") as FinalFormat);
else summary(a ?? "before", b ?? "after");
