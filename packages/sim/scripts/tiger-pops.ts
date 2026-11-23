/**
 * Babur's balloons in Boss alone at Eric's pace (Oct 25, docs/decisions/2026-10-25-tiger-pops.md): you alone against the
 * circus tiger, every move of yours the admins' Engine move (the runner's topMovesFor, its best), played as fast as you
 * can. Counts every balloon he puts on, the ones found ready, popped (a dud, or `nine`) and landed, by kind, the order
 * (the longest run of landings), the pop moments the screens are given, and his landed material a battle.
 *
 *   npx tsx packages/sim/scripts/tiger-pops.ts run <tag> <from-to> <seed> <pickSec> [patch]
 *   npx tsx packages/sim/scripts/tiger-pops.ts summary <tags,comma>
 *
 * `pickSec`: the seconds from your turn's start to your move (the Engine move's search and your tap: 1.5 as fast as
 * possible; 5 a 5 s pick). The battle's clock (Boss alone's: the page's time) then passes his turn: his thinking (at least
 * bossThinkMs, or the engine's real time if longer), his move on screen alone (bossTurnShowMs) and its moments. `patch`
 * (JSON): `powers`, numbers put over BOSS_POWERS for the run. Games `from` to `to` (inclusive; several processes can share
 * a run, each its own range). Rows go to reports/boss-sim/alone-<tag>.jsonl (appended).
 */
import { BOSS_ALONE_SCORING, BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { MatchRunner, bossThinkMs, bossTurnShowMs, rollBalloon, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const NODES = 120_000;
const YOU = "you";
const WORTH: Record<string, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, fakeQueen: 9, queen: 9 };

interface BalloonRow {
  n: number;
  kind: string;
  dud: boolean;
  /** A dud only because of the landings in a row before it (balloonLandsInRow). */
  guard?: boolean;
  /** After which crowd move it went on, and its end: land, pop (a dud), nine (a shape he can't have), or null (still on at the end). */
  placed: number;
  ready: boolean;
  end: "land" | "pop" | "nine" | null;
  at: number | null;
  /** Turns it waited ready (no square). */
  waits: number;
}

async function run(tag: string, from: number, to: number, seed: number, pickSec: number, patch: { powers?: Record<string, unknown> } = {}) {
  Object.assign(BOSS_POWERS as Record<string, unknown>, patch.powers ?? {});
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const engines = [await createNodeEngine({ nodes: NODES, hashMb: 16 })];
  mkdirSync(root + "reports/boss-sim", { recursive: true });
  const file = root + `reports/boss-sim/alone-${tag}.jsonl`;
  for (let g = from; g <= to; g++) {
    const rng = mulberry32(seed * 7919 + g);
    const s = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, ...BOSS_ALONE_SCORING, bossId: "tiger", engineNodes: NODES, bossNodes: NODES } as Settings;
    let clockMs = 0;
    const runner = new MatchRunner({ settings: s, rng, engines, library, entrants: [{ id: YOU, name: "You", isBot: false }], clock: () => clockMs });
    const balloons: BalloonRow[] = [];
    const popMoments = new Set<number>();
    const landMoments = new Set<number>();
    const secret = () => runner.boss!.powers!.balloon!.secret!;
    const look = () => {
      const p = runner.boss?.powers;
      const st = p?.balloon;
      if (!p || !st) return;
      for (const e of p.events) {
        if (e.kind === "pop") popMoments.add(e.turn);
        if (e.kind === "balloonLand") landMoments.add(e.turn);
      }
      const nz = st.nozzle;
      if (nz && !balloons.some((b) => b.n === nz.n)) {
        const r = rollBalloon(p.seed, secret(), nz.n, undefined, BOSS_POWERS, st.inRow ?? 0);
        if (r.dud !== nz.dud) throw new Error(`balloon ${nz.n}: the roll says dud ${r.dud}, the nozzle ${nz.dud}`);
        // (`guard`: a dud only because of the landings in a row before it.)
        const guard = r.dud && !rollBalloon(p.seed, secret(), nz.n, undefined, BOSS_POWERS, 0).dud;
        balloons.push({ n: nz.n, kind: r.kind, dud: nz.dud, ...(guard ? { guard } : {}), placed: runner.boss!.crowdMoves, ready: false, end: null, at: null, waits: 0 });
      }
      if (nz?.due) balloons.find((b) => b.n === nz.n)!.ready = true;
      const last = st.last;
      if (last) {
        const b = balloons.find((x) => x.n === last.n)!;
        if (b.end === null) {
          b.ready = true;
          b.end = last.outcome === "land" ? "land" : last.nine ? "nine" : "pop";
          b.at = last.at;
          if (b.end === "land" && b.dud) throw new Error(`a dud landed: balloon ${b.n}`);
          if (b.end === "pop" && !b.dud) throw new Error(`a real balloon popped: balloon ${b.n}`);
        }
      }
    };
    const t0 = Date.now();
    while (!runner.isOver()) {
      if (runner.stageComplete()) {
        runner.finishBossBattle();
        break;
      }
      if (runner.bossToMove()) {
        look();
        const before = runner.boss!.powers!.balloon?.nozzle;
        const tw = Date.now();
        await runner.playBoss(engines[0]);
        const engineMs = Date.now() - tw;
        look();
        const after = runner.boss!.powers!.balloon?.nozzle;
        if (before?.due && after && after.n === before.n) balloons.find((b) => b.n === after.n)!.waits++;
        const view = runner.bossView();
        clockMs += Math.max(bossThinkMs(view!), engineMs) + bossTurnShowMs(view, true);
        continue;
      }
      runner.deal();
      look();
      const fen = runner.boards.get(runner.state.boards[0]!)!.fen;
      const [best] = await runner.topMovesFor(fen);
      clockMs += pickSec * 1000;
      await runner.score(new Map([[YOU, { move: best?.move ?? null, thinkMs: pickSec * 1000, usedPowerUp: false }]]));
      look();
    }
    const b = runner.boss!;
    const row = {
      tag,
      seed,
      game: g,
      pickSec,
      result: b.result ?? null,
      moves: b.crowdMoves,
      clockSec: Math.round(clockMs / 1000),
      secret: b.powers?.balloon?.secret ?? null,
      balloons,
      popMoments: popMoments.size,
      landMoments: landMoments.size,
      counts: { placed: b.powers?.balloon?.placed ?? 0, landed: b.powers?.balloon?.landed ?? 0, popped: b.powers?.balloon?.popped ?? 0 },
      secs: Math.round((Date.now() - t0) / 1000),
    };
    appendFileSync(file, JSON.stringify(row) + "\n");
    console.log(`${tag} game ${g}: ${row.moves} moves, ${row.clockSec} s, balloons ${balloons.map((x) => `${x.kind}:${x.end ?? "-"}`).join(" ")}`);
  }
  for (const e of engines) e.close?.();
}

/** The table: pop rate by kind, the longest landing streak, landed material a battle. */
function summary(tags: string[]) {
  const KINDS = ["pawn", "knight", "bishop", "rook", "fakeQueen", "queen"];
  console.log("| Run | Battles | Moves (mean) | Battle clock (mean, s) | Placed / ready / popped (nine) / landed a battle | Pop rate of the ended, by kind (" + KINDS.join(", ") + ") | Pop rate (all ended) | Longest landing streak (mean / max) | 3+ landings in a row (battles) | Landed material a battle (± 1 s.e.) | Pops by the streak rule | Pop moments shown / pops |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const spec of tags) {
    // (`tag:from-to`: those games only, to pair runs of different lengths.)
    const [tag, range] = spec.split(":") as [string, string | undefined];
    const [lo, hi] = range ? range.split("-").map(Number) : [0, Infinity];
    const rows = readFileSync(root + `reports/boss-sim/alone-${tag}.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { game: number; moves: number; clockSec: number; balloons: BalloonRow[]; popMoments: number })
      // (One row a game: a range run again keeps its first.)
      .filter((r, i, all) => all.findIndex((x) => x.game === r.game) === i && r.game >= lo! && r.game <= hi!);
    const n = rows.length;
    const all = rows.flatMap((r) => r.balloons);
    const ended = all.filter((b) => b.end);
    const pops = ended.filter((b) => b.end !== "land");
    const byKind = KINDS.map((k) => {
      const e = ended.filter((b) => b.kind === k);
      return e.length ? `${Math.round((100 * e.filter((b) => b.end !== "land").length) / e.length)}% (${e.length})` : "-";
    });
    const streaks = rows.map((r) => {
      let best = 0;
      let cur = 0;
      for (const b of r.balloons.filter((x) => x.end).sort((a, c) => a.n - c.n)) {
        cur = b.end === "land" ? cur + 1 : 0;
        best = Math.max(best, cur);
      }
      return best;
    });
    const material = rows.map((r) => r.balloons.filter((b) => b.end === "land").reduce((t, b) => t + WORTH[b.kind]!, 0));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const se = Math.sqrt(mean(material.map((x) => (x - mean(material)) ** 2)) / n);
    const f = (x: number) => x.toFixed(2);
    console.log(
      `| ${spec} | ${n} | ${f(mean(rows.map((r) => r.moves)))} | ${Math.round(mean(rows.map((r) => r.clockSec)))} | ${f(all.length / n)} / ${f(all.filter((b) => b.ready).length / n)} / ${f(pops.length / n)} (${f(pops.filter((b) => b.end === "nine").length / n)}) / ${f(ended.filter((b) => b.end === "land").length / n)} | ${byKind.join(", ")} | ${Math.round((100 * pops.length) / Math.max(1, ended.length))}% of ${ended.length} | ${f(mean(streaks))} / ${Math.max(...streaks)} | ${streaks.filter((x) => x >= 3).length} | ${f(mean(material))} (± ${f(se)}) | ${all.filter((b) => b.guard && b.end === "pop").length} | ${rows.reduce((t, r) => t + r.popMoments, 0)} / ${pops.length} |`,
    );
  }
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "run") await run(args[0]!, Number(args[1]!.split("-")[0]), Number(args[1]!.split("-")[1] ?? args[1]), Number(args[2]), Number(args[3]), args[4] ? JSON.parse(args[4]) : {});
else if (cmd === "summary") summary(args[0]!.split(","));
else console.log("usage: run <tag> <from-to> <seed> <pickSec> [patch] | summary <tags>");
process.exit(0);
