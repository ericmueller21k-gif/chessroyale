/**
 * Checks Crowd 50 v 50 with real engine matches of 100 bots (100k nodes for speed): how well placement tracks skill,
 * how often the strongest bots reach the final, how often the game ends before the final (and restarts from the
 * start), and how many plies a match lasts.
 * Run: npx tsx packages/sim/scripts/crowd-sim.ts [matches=10] [start=normal|random|freestyle]: the start vote's option
 * (Eric, Oct 24), patched in before move 1 as the vote does (none: the board as made, the usual start). Results:
 * reports/crowd-sim.md (the starts: docs/decisions/2026-10-24-opening-vote.md).
 */
import { DEFAULT_SETTINGS, PREGAME_VOTES, botSkillSpread, modeSettings, mulberry32, shuffle, type Settings } from "@chessroyale/core";
import { MatchRunner, baseAt, isChess960Fen, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { readFileSync } from "node:fs";
import { spearman } from "../src/stats.ts";
const library = JSON.parse(readFileSync(new URL("../../chess/data/openings.json", import.meta.url), "utf8")) as Opening[];
const N = Number(process.argv[2] ?? 10);
const START = process.argv[3] ? PREGAME_VOTES.find((v) => v.id === "start")!.options.find((o) => o.id === process.argv[3]) : undefined;
if (process.argv[3] && !START) throw new Error(`No start "${process.argv[3]}"`);
const engines = await Promise.all(Array.from({ length: 4 }, () => createNodeEngine({ nodes: 100_000, hashMb: 16 })));
const settings: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd"), engineNodes: 100_000 };
const rhos: number[] = [];
let bestFinal = 0, top5Final = 0, restarts = 0, plies = 0, finalPlies = 0, finalEndedEarly = 0, decided = 0;
// The start's own numbers: every pick's raw and counted loss before the final, castles played, Chess960 starts.
let picks = 0, rawLoss = 0, countedLoss = 0, castles = 0, starts960 = 0;
for (let m = 0; m < N; m++) {
  const rng = mulberry32(900 + m);
  const skills = botSkillSpread(100, settings);
  const entrants = shuffle(rng, skills.map((skill, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill })));
  const runner = new MatchRunner({ settings, rng, engines, library, entrants });
  if (START) runner.patchSettings(START.patch);
  if (isChess960Fen(baseAt(0, runner.boards.get(0)!.bases).fen)) starts960++;
  let finalists: string[] = [];
  while (!runner.isOver()) {
    runner.deal();
    runner.prefetch();
    const rep = await runner.score(new Map());
    restarts += rep.retired.filter((r) => r.reason === "replaced").length;
    for (const b of rep.boards) {
      // (Castling: the king two files over, or onto its own rook as Chess960 writes it.)
      const m = b.result.playedMove;
      const squares = b.fenBefore.split(" ")[0]!.replace(/\d/g, (d) => ".".repeat(Number(d))).split("/").reverse().join("");
      const at = (sq: string) => squares[(Number(sq[1]) - 1) * 8 + sq.charCodeAt(0) - 97];
      const piece = at(m.slice(0, 2));
      const target = at(m.slice(2, 4));
      if ((piece === "K" || piece === "k") && (Math.abs(m.charCodeAt(0) - m.charCodeAt(2)) === 2 || (target === (piece === "K" ? "R" : "r")))) castles++;
      if (runner.isFinal()) continue;
      for (const p of b.result.players) {
        if (p.loss === null) continue;
        picks++;
        rawLoss += p.loss;
        countedLoss += p.counted ?? p.loss;
      }
    }
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
  process.stdout.write(`50 v 50: match ${m + 1}/${N}\r`);
}
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
console.log(
  `\n50 v 50${START ? ` (${START.label})` : ""}: rank corr ${mean(rhos).toFixed(3)} | strongest reaches final ${((100 * bestFinal) / N).toFixed(0)}% | top-5 bots in final (avg) ${(top5Final / N).toFixed(2)} | game restarted before the final ${(restarts / N).toFixed(2)}/match | plies per match ${(plies / N).toFixed(1)} (final ${(finalPlies / N).toFixed(1)}) | final cut short by the game ending ${((100 * finalEndedEarly) / N).toFixed(0)}% | game decided (mate or 60%+) ${((100 * decided) / N).toFixed(0)}% | mean pick loss before the final ${(rawLoss / picks).toFixed(2)} raw, ${(countedLoss / picks).toFixed(2)} counted | castles played ${(castles / N).toFixed(2)}/match | Chess960 starts ${starts960}/${N}`,
);
engines.forEach((e) => e.close());
