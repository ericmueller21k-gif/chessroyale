/**
 * Checks the 64-player format with real engine matches of bots (100k nodes for speed):
 * how well placement tracks skill, how often the strongest bot reaches the final,
 * how often games end mid-match. Run: npx tsx packages/sim/scripts/format-sim.ts [matches=20]
 * (it compares 5 and 6 rounds per stage). Results from Oct 2026 are in reports/format-sim.md.
 */
import { DEFAULT_SETTINGS, botSkillSpread, isDeadRound, mulberry32, shuffle, type Settings } from "@chessroyale/core";
import { MatchRunner, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { readFileSync } from "node:fs";
import { spearman } from "../src/stats.ts";
const library = JSON.parse(readFileSync(new URL("../../chess/data/openings.json", import.meta.url), "utf8")) as Opening[];
const N = Number(process.argv[2] ?? 20);
const engines = await Promise.all(Array.from({ length: 4 }, () => createNodeEngine({ nodes: 100_000, hashMb: 16 })));
for (const rounds of [5, 6]) {
  const settings: Settings = { ...DEFAULT_SETTINGS, engineNodes: 100_000, roundsPerStage: rounds };
  const rhos: number[] = []; let top8out1 = 0, bestFinal = 0, bestWins = 0, top4Final = 0, ended = 0, groupRounds = 0, dead = 0, finalTurns = 0, roundCount = 0;
  for (let m = 0; m < N; m++) {
    const rng = mulberry32(500 + m);
    const skills = botSkillSpread(64, settings);
    const entrants = shuffle(rng, skills.map((skill, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill })));
    const runner = new MatchRunner({ settings, rng, engines, library, entrants });
    let finalists: string[] = [];
    while (!runner.isOver()) {
      runner.deal();
      runner.prefetch();
      const rep = await runner.score(new Map());
      ended += rep.retired.length;
      if (runner.isFinal()) finalTurns++;
      else { roundCount++; for (const b of rep.boards) { groupRounds++; if (isDeadRound(b.result)) dead++; } }
      if (runner.stageComplete()) {
        if (runner.isFinal()) runner.finishFinal();
        else {
          const end = runner.endStage();
          if (runner.state.stage === 1 && end.knockedOut.some((p) => ["b0","b1","b2","b3","b4","b5","b6","b7"].includes(p.id))) top8out1++;
          if (runner.isFinal()) finalists = runner.alive().map((p) => p.id);
        }
      }
    }
    const ps = runner.state.players;
    rhos.push(spearman(ps.map((p) => p.skill!), ps.map((p) => p.placement!)));
    if (finalists.includes("b0")) bestFinal++;
    if (ps.find((p) => p.id === "b0")!.placement === 1) bestWins++;
    top4Final += finalists.filter((id) => ["b0","b1","b2","b3"].includes(id)).length;
    process.stdout.write(`rounds ${rounds}: match ${m + 1}/${N}\r`);
  }
  const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
  console.log(`\nrounds/stage ${rounds}: rank corr ${mean(rhos).toFixed(3)} | a top-8 bot out in stage 1 ${(100*top8out1/N).toFixed(0)}% | strongest reaches final ${(100*bestFinal/N).toFixed(0)}% | strongest wins ${(100*bestWins/N).toFixed(0)}% | top-4 bots in final (avg) ${(top4Final/N).toFixed(2)} | dead rounds ${(100*dead/groupRounds).toFixed(0)}% | games ended mid-match ${(ended/N).toFixed(2)} | knockout rounds ${roundCount/N} | final turns ${(finalTurns/N).toFixed(1)}`);
}
engines.forEach((e) => e.close());
