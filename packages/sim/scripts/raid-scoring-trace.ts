/**
 * Raid scoring's sim, step 1: recording raids (docs/decisions/2026-10-25-raid-scoring.md). Step 2, scoring them under
 * each variant, is raid-scoring-sim.ts.
 *
 *   npx tsx packages/sim/scripts/raid-scoring-trace.ts <boss> <raids> <seed>
 *
 * Plays boss raids through the game's own MatchRunner with RAID_SETTINGS (the boss's brain, powers, the God King's Last
 * Stand): 50 players, each Maia at a fixed rating drawn from MAIA_RATINGS (the 50 v 50 sim's spread), sampled from Maia's
 * own probabilities among the moves the boss allows. The judge scores every pick as the runner does, and the runner plays
 * the most popular pick. Rows go to reports/raid-scoring/<boss>-<seed>.jsonl (gzip them to keep them: the sim reads both).
 *
 * One simplification, as in the 50 v 50 sim: the boss never strikes while recording (bossKillEvery out of reach), so all
 * 50 pick every move and the raid is the same game under every scoring and strike rule (common random numbers). The sim
 * then strikes offline, by each rule, from the same picks.
 */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, raidBossElo, type Settings } from "@chessroyale/core";
import { HumanUciEngine, MatchRunner, legalMoves, materialSlips, type HumanPick, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { maiaProcess } from "../src/maia-process.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const OUT = root + "reports/raid-scoring/";
/** The Maia players' ratings: about 1100 to 1900, evenly (as crowd-scoring-trace.ts). */
const MAIA_RATINGS = [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900];
/** The judge's and the boss's search (as boss-sim.ts's raids). */
const NODES = 120_000;
const PLAYERS = 50;

/** One recorded crowd move: the position, the judge's loss for each pick, every player's pick (in player order). */
export interface RaidPly {
  /** Crowd moves made before this one (the boss's own count, 0 up). */
  move: number;
  fen: string;
  bestMove: string;
  /** Each distinct pick's raw loss, in points. */
  loss: Record<string, number>;
  picks: (string | null)[];
  /** The exchange check against the best move: a pawn or more (the opening allowance's bar) and a piece (3, the cap's). */
  slips: Record<string, "gave" | "missed">;
  pieces: Record<string, "gave" | "missed">;
  /** The God King's Last Stand took this move back (the scores stand; the crowd picks again). */
  stand?: true;
}
export interface RaidRow {
  boss: string;
  seed: number;
  ratings: number[];
  bossElo: number;
  result: string | null;
  plies: RaidPly[];
}

async function trace(bossId: string, raids: number, seed: number) {
  mkdirSync(OUT, { recursive: true });
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const engines = [await createNodeEngine({ nodes: NODES, hashMb: 16 })];
  const human = new HumanUciEngine(maiaProcess());
  if (!(await human.init())) throw new Error(`Maia didn't load: ${human.error}`);
  for (let g = 0; g < raids; g++) {
    const rng = mulberry32(seed * 7919 + g);
    const ratings = Array.from({ length: PLAYERS }, () => MAIA_RATINGS[Math.floor(rng() * MAIA_RATINGS.length)]!);
    const bossElo = raidBossElo(ratings);
    const s = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, crowdScoring: undefined, bossId, bossFixedElo: bossElo, engineNodes: NODES, bossNodes: NODES, bossKillEvery: 10_000 } as Settings;
    const entrants = ratings.map((_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: false }));
    let clockMs = 0;
    const runner = new MatchRunner({ settings: s, rng, engines, library, entrants, clock: () => clockMs });
    const plies: RaidPly[] = [];
    let result: string | null = null;
    const t0 = Date.now();
    while (!runner.isOver()) {
      if (runner.stageComplete()) {
        result = runner.finishBossBattle();
        break;
      }
      if (runner.bossToMove()) {
        if (runner.lightsOutDue()) {
          runner.startLightsOut();
          runner.finishLightsOut({});
        }
        if (runner.bounceDue()) await runner.playBounce(engines).catch(() => runner.applyBounce(null));
        if (runner.bossToMove()) await runner.playBoss(engines[0]);
        continue;
      }
      if (runner.extraMoveDue()) {
        await runner.playExtraMove(engines[0]);
        continue;
      }
      if (runner.funhouseDue()) {
        await runner.playFunhouse(engines[0]);
        continue;
      }
      runner.deal();
      const fen = runner.boards.get(runner.state.boards[0]!)!.fen;
      const allowed = new Set(runner.crowdAllowed() ?? legalMoves(fen));
      const byRating = new Map<number, { move: string; p: number }[]>();
      for (const r of new Set(ratings)) byRating.set(r, (await human.candidates(fen, r, null, { temperature: 0, topP: 1, multipv: 20 }))?.moves.filter((c) => allowed.has(c.move)) ?? []);
      const fallback = [...allowed][0] ?? null;
      const picks = ratings.map((r) => {
        const c = byRating.get(r)!;
        const total = c.reduce((sum, x) => sum + x.p, 0);
        let x = rng() * total;
        return c.find((m) => (x -= m.p) <= 0)?.move ?? c[0]?.move ?? fallback;
      });
      const humanPicks = new Map<string, HumanPick>(picks.map((m, i) => [`p${i}`, { move: m, thinkMs: 5000 + Math.floor(rng() * 10_000) }]));
      const before = runner.boss!.crowdMoves;
      clockMs += 20_000;
      const report = await runner.score(humanPicks);
      const board = report.boards[0]!;
      const loss: Record<string, number> = {};
      for (const p of board.result.players) if (p.move && p.loss !== null) loss[p.move] = +p.loss.toFixed(3);
      const distinct = Object.keys(loss);
      plies.push({
        move: before,
        fen: board.fenBefore,
        bestMove: board.bestMove,
        loss,
        picks: ratings.map((_, i) => board.result.players.find((p) => p.playerId === `p${i}`)?.move ?? null),
        slips: Object.fromEntries(materialSlips(board.fenBefore, board.bestMove, distinct, 1)),
        pieces: Object.fromEntries(materialSlips(board.fenBefore, board.bestMove, distinct, 3)),
        ...(board.lastStand ? { stand: true as const } : {}),
      });
    }
    const row: RaidRow = { boss: bossId, seed: seed * 7919 + g, ratings, bossElo, result: result ?? runner.boss?.result ?? null, plies };
    appendFileSync(OUT + `${bossId}-${seed}.jsonl`, JSON.stringify(row) + "\n");
    console.log(`${bossId} ${seed}: raid ${g + 1}/${raids}, ${plies.length} crowd moves, ${row.result} (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  engines.forEach((e) => e.close());
  human.close();
}

const [boss, raids, seed] = process.argv.slice(2);
await trace(boss ?? "gingerbread", Number(raids ?? 1), Number(seed ?? 1));
