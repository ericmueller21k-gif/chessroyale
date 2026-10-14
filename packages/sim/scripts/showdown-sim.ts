/**
 * Wrangler's SHOWDOWN! in real battles (Eric, Oct 13: "he checks every turn after three or four moves, and the moment
 * it's ready he fires it with no warning"): battles through the match runner, a crowd of 10 bots against him, with his
 * scout searching while the crowd thinks and his turn's search after his move, as solo plays them. Per battle: when
 * his meter filled, when each showdown came (and how many of his turns after the meter filled), its size (3 or 2 pairs),
 * the edge the engine put on the crowd's best duel, and how many of his moves after each duel the engine played.
 *
 *   npx tsx packages/sim/scripts/showdown-sim.ts run <expert|club|casual> <games> <seed> <computer|phone> <tag>
 *   npx tsx packages/sim/scripts/showdown-sim.ts summary <tags,comma>
 *
 * The searches' time budgets run on the device's own clock, not this machine's (shared, and busy): it moves on by the
 * engine's work, at a computer's speed (DEVICE_NPS.computer) or a phone's, so the results don't depend on what else
 * this machine is doing. (The line-up generator's own JS time isn't counted: small against the engine's.) Rows go to
 * reports/boss-sim/showdown-<tag>.jsonl; `summary` prints the table.
 */
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { MatchRunner, ShowdownScout, showdownReady, type EngineLike, type Entrant, type Opening, type UciEngine } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { appendFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
/** The judge's and the boss's search (a little under the game's 250,000, for time; the showdown's own budgets are the game's). */
const NODES = 120_000;
/** Battles end here at the latest (crowd moves): enough for both of his showdowns. */
const MAX_MOVES = 40;
/** Crowds of 10: each member's skill temperature (as boss-sim.ts), and the boss's strength against them. */
const spread = (lo: number, hi: number) => Array.from({ length: 10 }, (_, i) => lo * Math.pow(hi / lo, i / 9));
const CROWDS: Record<string, { skills: number[]; elo: number }> = {
  expert: { skills: spread(1, 4), elo: 2200 },
  club: { skills: spread(6, 20), elo: 1700 },
  casual: { skills: spread(15, 40), elo: 1400 },
};

/** A device's engine speed (nodes a second, Stockfish lite on one thread): a computer, and a phone 4 times slower. */
const DEVICE_NPS: Record<string, number> = { computer: 800_000, phone: 200_000 };
/** The device's clock (ms): the searches' budgets read it (performance.now), and the engine's work moves it on. */
const clock = { ms: 0 };
(globalThis as { performance: { now: () => number } }).performance.now = () => clock.ms;
/** An engine whose searches take the device's time: nodes / its speed. */
function onDevice(e: UciEngine, nps: number): EngineLike {
  const spend = <T>(nodes: number) => (r: T) => ((clock.ms += (nodes / nps) * 1000), r);
  return {
    topMoves: (fen, n) => e.topMoves(fen, n).then(spend(NODES)),
    topMovesAt: (fen, n, nodes) => e.topMovesAt(fen, n, nodes).then(spend(nodes)),
    scoreMoves: (fen, moves) => e.scoreMoves(fen, moves).then(spend(NODES)),
    scoreMovesAt: (fen, moves, nodes) => e.scoreMovesAt(fen, moves, nodes).then(spend(nodes)),
    playAtElo: (fen, elo, nodes) => e.playAtElo(fen, elo, nodes).then(spend(nodes ?? NODES)),
  };
}

interface Row {
  tag: string;
  crowd: string;
  speed: string;
  seed: number;
  game: number;
  moves: number;
  result: string | null;
  /** Crowd turns his meter was full as they began (each fill's first). */
  full: number[];
  showdowns: { turn: number; duels: number; edge: number | null; afterFull: number | null; engineMoves: number }[];
  scanned: number;
  secs: number;
}

async function run(crowd: string, games: number, seed: number, speed: string, tag: string) {
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const nps = DEVICE_NPS[speed] ?? DEVICE_NPS.phone!;
  const uci = await createNodeEngine({ nodes: NODES, hashMb: 16 });
  const scoutUci = await createNodeEngine({ nodes: NODES, hashMb: 16 });
  const engines = [onDevice(uci, nps)];
  const scoutEngine = onDevice(scoutUci, nps);
  mkdirSync(root + "reports/boss-sim", { recursive: true });
  const { skills, elo } = CROWDS[crowd]!;
  for (let g = 0; g < games; g++) {
    const rng = mulberry32(seed * 7919 + g);
    const s = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossId: "pig", engineNodes: NODES, bossNodes: NODES, bossFixedElo: elo, bossMaxMoves: MAX_MOVES, lobbySize: skills.length, groupSize: skills.length } as Settings;
    const entrants: Entrant[] = skills.map((skill, i) => ({ id: `bot${i}`, name: `Bot ${i + 1}`, isBot: true, skill }));
    const runner = new MatchRunner({ settings: s, rng, engines, library, entrants });
    runner.showdownScout = new ShowdownScout(async () => scoutEngine, BOSS_POWERS);
    const row: Row = { tag, crowd, speed, seed, game: g, moves: 0, result: null, full: [], showdowns: [], scanned: 0, secs: 0 };
    const t0 = Date.now();
    let lastFill: number | null = null;
    let fullAt: number | null = null;
    let seenShowdown = -1;
    while (!runner.isOver()) {
      if (runner.stageComplete()) {
        row.result = runner.finishBossBattle();
        break;
      }
      const b = runner.boss!;
      if (runner.bossToMove()) {
        // (The engine plays his move after a duel while its tactics are live: counted against the last showdown.)
        if (runner.bossBestReply() && row.showdowns.length) row.showdowns[row.showdowns.length - 1]!.engineMoves++;
        await runner.playBoss(engines[0]);
        continue;
      }
      const p = b.powers!;
      // His meter's fill, as this crowd turn begins: when it first showed full.
      const ready = showdownReady(p);
      if (ready !== null && ready !== lastFill) {
        lastFill = ready;
        fullAt = p.turn;
        row.full.push(p.turn);
      }
      const sd = p.showdown;
      if (sd && sd.turn === p.turn && sd.turn !== seenShowdown) {
        seenShowdown = sd.turn;
        row.showdowns.push({ turn: sd.turn, duels: sd.pairs.length, edge: sd.edge, afterFull: fullAt === null ? null : sd.turn - fullAt, engineMoves: 0 });
        fullAt = null;
      }
      // The crowd thinks: his scout searches meanwhile (when the rules say a showdown may follow before long).
      const view = runner.bossView()!;
      if (view.powers?.scout) {
        runner.showdownScout.scout(view.board.fen, [3, 2]);
        await runner.showdownScout.idle();
      }
      runner.deal();
      await runner.score(new Map());
      if (runner.bossKillDue()) runner.bossKill();
    }
    const b = runner.boss!;
    row.moves = b.crowdMoves;
    row.result ??= b.result ?? null;
    row.scanned = runner.showdownScout.scanned;
    row.secs = Math.round((Date.now() - t0) / 1000);
    appendFileSync(root + `reports/boss-sim/showdown-${tag}.jsonl`, JSON.stringify(row) + "\n");
    console.log(JSON.stringify(row));
  }
  uci.close();
  scoutUci.close();
}

/** The table: showdowns a battle, the first's turn, the wait after a full meter, sizes, edges, the engine's moves. */
function summary(tags: string[]) {
  const dir = root + "reports/boss-sim";
  const rows: Row[] = readdirSync(dir)
    .filter((f) => f.startsWith("showdown-") && tags.includes(f.slice(9, -6)))
    .flatMap((f) => readFileSync(`${dir}/${f}`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row));
  const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : NaN);
  const out = ["| Run | Crowd | Battles | Avg moves | Showdowns 0 / 1 / 2 | First at (median crowd turn) | Meter full at (first) | His turns full → showdown: median (max) | 3 / 2 pairs | Edge: median (range) | Engine moves after a duel 1 / 2 / 3 |", "|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const tag of tags) {
    for (const crowd of Object.keys(CROWDS)) {
      const rs = rows.filter((r) => r.tag === tag && r.crowd === crowd);
      if (!rs.length) continue;
      const sds = rs.flatMap((r) => r.showdowns);
      const waits = sds.flatMap((x) => (x.afterFull === null ? [] : [x.afterFull]));
      const edges = sds.flatMap((x) => (x.edge === null ? [] : [x.edge]));
      const count = (k: number) => rs.filter((r) => r.showdowns.length === k).length;
      out.push(
        `| ${tag} | ${crowd} | ${rs.length} | ${Math.round(rs.reduce((t, r) => t + r.moves, 0) / rs.length)} | ${count(0)} / ${count(1)} / ${count(2)} | ${median(rs.flatMap((r) => (r.showdowns[0] ? [r.showdowns[0].turn] : [])))} | ${median(rs.flatMap((r) => r.full.slice(0, 1)))} | ${median(waits)} (${waits.length ? Math.max(...waits) : "-"}) | ${sds.filter((x) => x.duels === 3).length} / ${sds.filter((x) => x.duels === 2).length} | ${edges.length ? `${median(edges).toFixed(2)} (${Math.min(...edges).toFixed(2)} to ${Math.max(...edges).toFixed(2)})` : "-"} | ${[1, 2, 3].map((k) => sds.filter((x) => x.engineMoves === k).length).join(" / ")} |`,
      );
    }
  }
  console.log(out.join("\n"));
}

const [cmd, a, b, c, d, e] = process.argv.slice(2);
if (cmd === "run") await run(a ?? "club", Number(b ?? 1), Number(c ?? 1), d ?? "phone", e ?? "test");
else if (cmd === "summary") summary((a ?? "").split(","));
