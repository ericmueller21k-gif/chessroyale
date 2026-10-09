/**
 * Bot-match replays for the home page's live window (DECISIONS.md, "The live window"): Crowd 50 v 50 matches of 100
 * bots, played by the real match runner, saved as compact replays the app plays back on the clock. A beta stand-in
 * until real players arrive; the window shows a real match instead whenever one is running.
 *
 *   npm run replays:bots -- [count=10] [--fresh]
 *
 * Appends `count` new matches to packages/app/public/replays/crowd-bots.json (each from its own seed, so adding more
 * never changes the ones already there); --fresh starts the file again. Average-to-loose bots and a small engine
 * budget, so a match takes a minute or two.
 *
 * A replay: the bots' names, and per ply the move played (UCI), the crowd's top votes ([SAN, count], most first), a
 * bot who voted for the played move (an index into names), how many were still in, and, when the game was restarted
 * (it ended before the final), the position it started from. In the final, one player moves: `w` is who.
 */
import { DEFAULT_SETTINGS, modeSettings, mulberry32, type Settings } from "@chessroyale/core";
import { MatchRunner, START_FEN, botRoster, toSan, applyMove, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** One ply of a replay. */
export interface ReplayPly {
  /** The move played (UCI). */
  m: string;
  /** The crowd's top votes: [SAN, count], most first (in the final: the one player's move, 1). */
  v: [string, number][];
  /** A bot who voted for the played move (index into names). */
  n?: number;
  /** The final: who moved (index into names). */
  w?: number;
  /** Players still in after this ply. */
  a: number;
  /** The game was restarted: the position this ply started from. */
  s?: string;
}
export interface Replay {
  id: string;
  names: string[];
  plies: ReplayPly[];
  /** The game's winner ("w", "b", or null for a draw / unfinished) and the top three by placement (indexes). */
  end: { winner: "w" | "b" | null; top: number[] };
}
export interface ReplayFile {
  version: 1;
  replays: Replay[];
}

const root = fileURLToPath(new URL("../../../", import.meta.url));
const OUT = root + "packages/app/public/replays/crowd-bots.json";
const NODES = 40_000;
const args = process.argv.slice(2);
const count = Number(args.find((a) => /^\d+$/.test(a)) ?? 10);
const fresh = args.includes("--fresh");

const file: ReplayFile = !fresh && existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { version: 1, replays: [] };
const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
const engines = await Promise.all(Array.from({ length: 4 }, () => createNodeEngine({ nodes: NODES, hashMb: 16 })));
// Average to loose bots (skill temperatures 2-32 points; the full range starts at 0.25), as in a lobby's 50 v 50.
const settings: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { crowdTeams: true }), engineNodes: NODES, botSkillRange: [2, 32] };

for (let k = 0; k < count; k++) {
  const seed = 7000 + file.replays.length;
  const started = Date.now();
  const rng = mulberry32(seed);
  const entrants = botRoster(rng, settings.lobbySize, settings);
  const index = new Map(entrants.map((e, i) => [e.id, i]));
  const runner = new MatchRunner({ settings, rng, engines, library, entrants });
  const plies: ReplayPly[] = [];
  let fen = START_FEN;
  while (!runner.isOver()) {
    runner.deal();
    runner.prefetch();
    const rep = await runner.score(new Map());
    const b = rep.boards[0]!;
    const played = b.result.playedMove;
    const counts = new Map<string, string[]>();
    for (const p of b.result.players) if (p.move) counts.set(p.move, [...(counts.get(p.move) ?? []), p.playerId]);
    const top = [...counts.entries()].sort((x, y) => y[1].length - x[1].length || (x[0] === played ? -1 : y[0] === played ? 1 : 0)).slice(0, 3);
    const voters = counts.get(played) ?? [];
    const ply: ReplayPly = {
      m: played,
      v: top.map(([m, ids]) => [toSan(b.fenBefore, m), ids.length]),
      a: 0,
    };
    if (runner.isFinal() && b.playerIds.length === 1) ply.w = index.get(b.playerIds[0]!)!;
    else if (voters.length) ply.n = index.get(voters[Math.floor(rng() * voters.length)]!)!;
    if (b.fenBefore !== fen) ply.s = b.fenBefore;
    fen = applyMove(b.fenBefore, played);
    if (runner.isFinal()) runner.afterFinalTurn();
    if (runner.stageComplete()) {
      if (runner.isFinal()) runner.finishFinal();
      else runner.endStage();
    }
    ply.a = runner.alive().length;
    plies.push(ply);
  }
  const ps = runner.state.players;
  const top = [...ps].sort((x, y) => x.placement! - y.placement!).slice(0, 3).map((p) => index.get(p.id)!);
  const winner = runner.gameWinner();
  file.replays.push({ id: `crowd-${seed}`, names: entrants.map((e) => e.name), plies, end: { winner: winner ?? null, top } });
  console.log(`replay ${file.replays.length}: seed ${seed}, ${plies.length} plies, ${Math.round((Date.now() - started) / 1000)} s`);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(file));
}
engines.forEach((e) => e.close());
const bytes = readFileSync(OUT).length;
console.log(`${file.replays.length} replays, ${(bytes / 1024).toFixed(1)} KB -> ${OUT}`);
