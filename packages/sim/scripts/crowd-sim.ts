/**
 * Checks Crowd mode with real engine matches of 100 bots (100k nodes for speed),
 * in both turn modes: how well placement tracks skill, how often the strongest
 * bots reach the final, how often the game ends before the final (and restarts
 * from the start), and how many plies a match lasts.
 * Run: npx tsx packages/sim/scripts/crowd-sim.ts [matches=10]. Results: reports/crowd-sim.md.
 */
import { DEFAULT_SETTINGS, botSkillSpread, modeSettings, mulberry32, shuffle, type Settings } from "@chessroyale/core";
import { MatchRunner, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { readFileSync } from "node:fs";
import { spearman } from "../src/stats.ts";
const library = JSON.parse(readFileSync(new URL("../../chess/data/openings.json", import.meta.url), "utf8")) as Opening[];
const N = Number(process.argv[2] ?? 10);
const engines = await Promise.all(Array.from({ length: 4 }, () => createNodeEngine({ nodes: 100_000, hashMb: 16 })));
for (const crowdTeams of [true, false]) {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { crowdTeams }), engineNodes: 100_000 };
  const rhos: number[] = [];
  let bestFinal = 0, top5Final = 0, restarts = 0, plies = 0, finalPlies = 0, finalEndedEarly = 0, decided = 0;
  for (let m = 0; m < N; m++) {
    const rng = mulberry32(900 + m);
    const skills = botSkillSpread(100, settings);
    const entrants = shuffle(rng, skills.map((skill, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill })));
    const runner = new MatchRunner({ settings, rng, engines, library, entrants });
    let finalists: string[] = [];
    while (!runner.isOver()) {
      runner.deal();
      runner.prefetch();
      const rep = await runner.score(new Map());
      restarts += rep.retired.filter((r) => r.reason === "replaced").length;
      plies++;
      if (runner.isFinal()) finalPlies++;
      if (runner.stageComplete()) {
        if (runner.isFinal()) {
          if (runner.final!.turn < 4 * settings.finalMovesPerPlayer) finalEndedEarly++;
          if (runner.gameWinner()) decided++;
          runner.finishFinal();
        } else {
          runner.endStage();
          if (runner.isFinal()) finalists = runner.alive().map((p) => p.id);
        }
      }
    }
    const ps = runner.state.players;
    rhos.push(spearman(ps.map((p) => p.skill!), ps.map((p) => p.placement!)));
    if (finalists.includes("b0")) bestFinal++;
    top5Final += finalists.filter((id) => ["b0", "b1", "b2", "b3", "b4"].includes(id)).length;
    process.stdout.write(`${crowdTeams ? "50 v 50" : "everyone"}: match ${m + 1}/${N}\r`);
  }
  const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
  console.log(
    `\n${crowdTeams ? "50 v 50" : "Everyone moves"}: rank corr ${mean(rhos).toFixed(3)} | strongest reaches final ${((100 * bestFinal) / N).toFixed(0)}% | top-5 bots in final (avg) ${(top5Final / N).toFixed(2)} | game restarted before the final ${(restarts / N).toFixed(2)}/match | plies per match ${(plies / N).toFixed(1)} (final ${(finalPlies / N).toFixed(1)}) | final cut short by the game ending ${((100 * finalEndedEarly) / N).toFixed(0)}% | game decided (mate or 60%+) ${((100 * decided) / N).toFixed(0)}%`,
  );
}
engines.forEach((e) => e.close());
