/**
 * Does a boss's ultimate come when he's losing? (Eric, Nov 26: "It should have detected like he was basically in danger, or like it
 * was already heavily in my favor, and it should start triggering very quickly thereafter, like a turn or two at most.")
 *
 * Plays real battles through the match runner (Stockfish as the judge and as the boss's brain, at his Elo), one person in the crowd:
 *   - `strong`: the crowd plays the judge's best allowed move every turn (Stockfish strength, as Eric played), so it gets ahead;
 *   - `even`: the crowd picks like a club player (botPick over the judge's moves), so most battles stay level for a long time.
 * Each crowd move logs the judge's expected score for the crowd (the boss's `judged`, the meter's and the danger rule's number), the
 * ultimates so far and whether one is under way; the summary turns that into, for each boss: the boss turns from the first crowd move
 * at or above the danger line (BOSS_POWERS.dangerAt, 0.70) (none under way, one still to come) to his ultimate, or never.
 *
 *   npx tsx packages/sim/scripts/ult-danger.ts run <boss,ids|all> <seeds> <strong|even> <tag> [first seed] [off]
 *   npx tsx packages/sim/scripts/ult-danger.ts summary <tags> [danger]
 *   npx tsx packages/sim/scripts/ult-danger.ts jumps <tags> [danger]
 *   npx tsx packages/sim/scripts/ult-danger.ts compare <before tag> <after tag>
 *
 * `off`: the danger rule switched off (dangerAt past 1: the meters as they were before it), for the before-and-after. Each battle gets
 * an engine of its own (a fresh hash), so the same seed plays the same battle until the rule first changes something.
 *
 * Rows go to reports/ult-danger/<tag>.jsonl; the summary prints a markdown table.
 */
import { BOSS_POWERS, BOSS_ROSTER, DEFAULT_SETTINGS, RAID_SETTINGS, botPick, mulberry32, type Settings } from "@chessroyale/core";
import { MatchRunner, bossRules, eloDraw, legalMoves, pieceAt, type EngineLike, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const NODES = 120_000;
const MAX_MOVES = 60;
/** The boss's Elo (bossFixedElo: a player rated just under the usual tier; BOSS_ELO for another, a weaker boss the crowd gets ahead of). */
const BOSS_ELO = Number(process.env.BOSS_ELO ?? 1600);
/**
 * The even crowd: a strong player's skill (boss-sim's expert crowd spans 1 to 4) and a rare random move: against the boss's powers
 * that keeps most battles level for a long time (a club crowd, 8, was crushed within a few moves).
 */
const EVEN_SKILL = 3;
const EVEN_RANDOM = 0.01;

/** A cheap position hash (FNV-1a), for the boss's seeded draw. */
const hashOf = (s: string): number => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

/**
 * The engine with the boss's move drawn from its top moves by a seed of the battle's and the position's (eloDraw, as two devices
 * agree on one online: BOSS_CHECK), not Stockfish's own draw at a strength, which its clock seeds: the same seed plays the same
 * battle every run, so a before and an after differ only where the rule did.
 */
function seededEngine(engine: EngineLike, seed: number): EngineLike {
  return {
    topMoves: (fen, n) => engine.topMoves(fen, n),
    scoreMoves: (fen, moves) => engine.scoreMoves(fen, moves),
    ...(engine.scoreMovesAt ? { scoreMovesAt: (fen: string, moves: readonly string[], nodes: number) => engine.scoreMovesAt!(fen, moves, nodes) } : {}),
    ...(engine.topMovesAt ? { topMovesAt: (fen: string, n: number, nodes: number, moves?: readonly string[]) => engine.topMovesAt!(fen, n, nodes, moves) } : {}),
    playAtElo: async (fen, elo) => eloDraw(await engine.topMoves(fen, 8), elo, mulberry32(seed ^ hashOf(fen))),
  };
}
/** The danger line: the crowd's expected score (the judge's) at or above it. */
const DANGER = BOSS_POWERS.dangerAt;

/** The game's own opening library: each seed opens from one of its lines. */
const LIBRARY = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];

interface Row {
  /** The crowd's move (its count). */
  turn: number;
  /** The judge's expected score for the crowd after it. */
  judged: number | null;
  /** As the crowd's turn began, before its move: his ultimates so far, one under way (its effect still running) or warned. */
  ults: number;
  busy: boolean;
}

/** How many ultimates a battle allows him (once a battle, ultimateMax, maxUltimates); Infinity: no cap. */
function capOf(id: string): number {
  const rules = bossRules({ id });
  if (rules?.ultimateOnce) return 1;
  return Math.min(rules?.ultimateMax ?? Infinity, BOSS_POWERS.maxUltimates?.[id] ?? Infinity);
}

/** The boss turn an ultimate whose `ultAt` is `at` came in: his turn after crowd move `at` for one at the start of his turn, else his turn before crowd turn `at`. */
const ultBossTurn = (id: string, at: number): number => (bossRules({ id })?.ultimateOnHisTurn ? at : at - 1);

async function battle(id: string, seed: number, crowd: "strong" | "even", engine: EngineLike): Promise<Record<string, unknown>> {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...RAID_SETTINGS,
    bossFixedElo: BOSS_ELO,
    bossId: id,
    bossUnfinished: true,
    bossHidden: true,
    lastStandFrom: 999,
    bossMaxMoves: MAX_MOVES,
    bossNoStrikes: true,
    engineNodes: NODES,
    bossNodes: NODES,
    botRandomMoveChance: EVEN_RANDOM,
  } as Settings;
  const rng = mulberry32(seed * 7919 + id.length);
  const pickRng = mulberry32(seed * 104729 + 17);
  const side = seed % 2 ? "w" : "b";
  const r = new MatchRunner({ settings, rng, engines: [engine], library: LIBRARY, entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: side });
  const rows: Row[] = [];
  /** Every ultimate's boss turn, from the count going up (ults) and its ultAt. */
  const came: number[] = [];
  const look = () => {
    const p = r.boss?.powers;
    if (!p) return;
    while ((p.ults ?? 0) > came.length) came.push(p.ultAt !== undefined ? ultBossTurn(id, p.ultAt) : r.boss!.crowdMoves);
  };
  const engines = [engine];
  for (let i = 0; i < 600 && !r.isOver(); i++) {
    if (r.stageComplete()) break;
    if (r.bossToMove()) {
      if (r.lightsOutDue()) {
        r.startLightsOut();
        r.finishLightsOut({});
      }
      if (r.bounceDue()) await r.playBounce(engines).catch(() => r.applyBounce(null));
      for (let s = 0; s < 3; s++) {
        if (!r.alfilStep()) break;
        await r.playAlfil(engines).catch(() => r.applyAlfil(null));
      }
      if (r.bossToMove() && r.carrotDue()) await r.playCarrots(engines).catch(() => r.applyCarrots());
      if (r.bossToMove() && r.repaintDue()) await r.playRepaint(engines).catch(() => r.applyRepaint(null));
      if (r.bossToMove() && r.waterDue()) await r.playWater(engines).catch(() => r.applyWater(null));
      if (r.bossToMove() && r.hopDue()) await r.playHop(engines).catch(() => r.applyHop(null));
      if (r.bossToMove() && r.queenLockDue()) await r.playQueenLock(engines).catch(() => r.applyQueenLock(null));
      look();
      if (r.bossToMove()) await r.playBoss(engine);
      look();
      continue;
    }
    if (r.dodgeDue()) {
      const d = r.boss!.powers!.chandy!.dodge!;
      r.finishDodgeRound({ h0: d.rounds[d.results.length]!.safe });
      continue;
    }
    if (r.rushDue()) {
      r.finishRush({});
      continue;
    }
    if (r.extraMoveDue()) {
      await r.playExtraMove(engine);
      continue;
    }
    if (r.funhouseDue()) {
      await r.playFunhouse(engine).catch(() => r.applyFunhouse(""));
      continue;
    }
    r.deal();
    const fen = r.boards.get(r.state.boards[0]!)!.fen;
    const allowed = r.crowdAllowed() ?? legalMoves(fen);
    const before = r.boss?.powers;
    const ults = before?.ults ?? 0;
    const busy = before?.ultAt !== undefined || before?.warnAt !== undefined;
    let move: string;
    if (r.darkForcedDue()) move = await r.playDarkForced(engine);
    else {
      const top = (await r.topMovesFor(fen)).filter((m) => allowed.includes(m.move));
      // (Birdie's train on your king: moved, as a crowd reading the dock does.)
      const train = r.trainJob();
      const kingOut = train && pieceAt(fen, train)?.type === "k" ? allowed.filter((m) => m.startsWith(train)) : [];
      if (kingOut.length && !top.some((m) => kingOut.includes(m.move))) move = kingOut.sort()[0]!;
      else if (crowd === "strong" || !top.length) move = top.length ? [...top].sort((a, b) => b.expected - a.expected)[0]!.move : [...allowed].sort()[0]!;
      else {
        const best = Math.max(...top.map((m) => m.expected));
        move = botPick(pickRng, top.map((m) => ({ move: m.move, loss: Math.max(0, (best - m.expected) * 100) })), EVEN_SKILL, allowed, settings);
      }
    }
    await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
    look();
    const p = r.boss?.powers;
    rows.push({ turn: r.boss!.crowdMoves, judged: p?.judged ?? null, ults, busy });
    if (process.env.TRACE) console.log(r.boss!.crowdMoves, fen, move, (p?.judged ?? -1).toFixed(2), JSON.stringify(p?.events.map((e) => e.kind)));
    if (r.bossKillDue()) r.bossKill();
  }
  look();
  const result = r.stageComplete() ? r.finishBossBattle() : null;
  return { boss: id, seed, crowd, side, result, moves: r.boss?.crowdMoves ?? 0, came, rows };
}

async function run(ids: string[], seeds: number, crowd: "strong" | "even", tag: string, first: number, off: boolean) {
  mkdirSync(root + "reports/ult-danger", { recursive: true });
  if (off) (BOSS_POWERS as { dangerAt: number }).dangerAt = 2;
  for (const id of ids)
    for (let k = 0; k < seeds; k++) {
      const t0 = Date.now();
      const engine = await createNodeEngine({ nodes: NODES, hashMb: 16 });
      const row = await battle(id, first + k, crowd, seededEngine(engine, first + k));
      engine.close();
      appendFileSync(root + `reports/ult-danger/${tag}.jsonl`, JSON.stringify({ ...row, off }) + "\n");
      console.log(`${id} seed ${first + k}: ${row.result} after ${row.moves}, ults at ${JSON.stringify(row.came)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
}

interface Battle {
  boss: string;
  seed: number;
  crowd: string;
  result: string | null;
  moves: number;
  came: number[];
  rows: Row[];
}

/**
 * One battle's danger windows: from each crowd move at or above `danger` with no ultimate under way (none warned, one still to come
 * by the meter) and none come yet in this danger (since the crowd's moves last went under the line: the rule brings one a danger),
 * his turns until the next ultimate came (1: in his very next turn), or the turns he had left with none (`never`).
 */
export function windows(b: Battle, danger: number): { first: number | "never" | null; worst: number | "never" | null; onset: number | null } {
  const at = (k: number) => b.came.filter((j) => j >= k);
  let first: number | "never" | null = null;
  let worst: number | "never" | null = null;
  let onset: number | null = null;
  // (The crowd move where this danger began: the first of the run of moves at the line that ends at row `i`.)
  const since = (i: number) => {
    while (i > 0 && (b.rows[i - 1]!.judged ?? 0) >= danger) i--;
    return b.rows[i]!.turn;
  };
  for (const [i, row] of b.rows.entries()) {
    if (row.judged === null || row.judged < danger || row.busy || row.ults >= capOf(b.boss)) continue;
    // (One ultimate a danger (dangerSpent): a move after one came in this danger is no window.)
    if (b.came.some((j) => j >= since(i) && j < row.turn)) continue;
    const k = row.turn;
    const next = at(k)[0];
    // (His turns left from k to the end of the battle: the last crowd move's turn, k counted.)
    const left = b.moves - k + 1;
    const wait: number | "never" | null = next !== undefined ? next - k + 1 : left > 2 ? "never" : null;
    if (wait === null) continue;
    if (onset === null) {
      onset = k;
      first = wait;
    }
    if (worst === null || wait === "never" || (worst !== "never" && wait > worst)) worst = wait;
  }
  return { first, worst, onset };
}

function summary(tags: string[], danger: number) {
  const battles: Battle[] = [];
  for (const tag of tags)
    for (const l of readFileSync(root + `reports/ult-danger/${tag}.jsonl`, "utf8").split("\n").filter(Boolean)) battles.push(JSON.parse(l) as Battle);
  const out = [`| boss | battles | results (crowd/boss/draw) | first danger (crowd move) | his turns to the ultimate, first window | worst window | ults a battle |`, `|---|---|---|---|---|---|---|`];
  for (const id of [...new Set(battles.map((b) => b.boss))]) {
    const bs = battles.filter((b) => b.boss === id);
    const ws = bs.map((b) => windows(b, danger));
    const res = ["crowd", "boss", "draw"].map((x) => bs.filter((b) => b.result === x).length).join("/");
    const show = (v: number | "never" | null) => (v === null ? "–" : String(v));
    out.push(`| ${id} | ${bs.length} | ${res} | ${ws.map((w) => show(w.onset)).join(", ")} | ${ws.map((w) => show(w.first)).join(", ")} | ${ws.map((w) => show(w.worst)).join(", ")} | ${bs.map((b) => b.came.length).join(", ")} |`);
  }
  console.log(out.join("\n"));
}

/**
 * How jumpy the judge's number is at the danger line: each crossing (a crowd move at or above it after one below, or the first), and
 * whether the crowd's next move held it there; of those that fell back, the lowest the next three moves reached.
 */
function jumps(tags: string[], danger: number) {
  for (const tag of tags) {
    const battles = readFileSync(root + `reports/ult-danger/${tag}.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Battle);
    let crossings = 0;
    let held = 0;
    let back = 0;
    const lows: number[] = [];
    for (const b of battles) {
      const js = b.rows.map((r) => r.judged);
      for (let i = 0; i < js.length - 1; i++) {
        const j = js[i];
        if (j === null || j === undefined || j < danger || (i > 0 && (js[i - 1] ?? 0) >= danger)) continue;
        crossings++;
        const next = js[i + 1] ?? 0;
        if (next >= danger) held++;
        else {
          back++;
          lows.push(Math.min(...js.slice(i + 1, i + 4).map((x) => x ?? 0)));
        }
      }
    }
    lows.sort((x, y) => x - y);
    const fmt = (x: number) => x.toFixed(2);
    console.log(`${tag}: ${battles.length} battles, ${crossings} crossings of ${danger}: the next move held it ${held}, fell back ${back} (the next three moves' lowest: ${lows.map(fmt).join(", ") || "none"})`);
  }
}

/** The same battles before (off) and after: each battle's ultimates (his turns) and result, side by side. */
function compare(before: string, after: string) {
  const read = (tag: string) => readFileSync(root + `reports/ult-danger/${tag}.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Battle);
  const a = read(before);
  const b = read(after);
  const out = [`| boss | seed | before: ultimates (his turns), result | after: ultimates, result | first danger (crowd move) |`, `|---|---|---|---|---|`];
  for (const x of a) {
    const y = b.find((z) => z.boss === x.boss && z.seed === x.seed);
    if (!y) continue;
    const w = windows(x, DANGER);
    out.push(`| ${x.boss} | ${x.seed} | ${x.came.join(", ") || "none"}; ${x.result} after ${x.moves} | ${y.came.join(", ") || "none"}; ${y.result} after ${y.moves} | ${w.onset ?? "never"} |`);
  }
  console.log(out.join("\n"));
}

const [cmd, a, b, c, d, e, f] = process.argv.slice(2);
if (cmd === "run") {
  const ids = a === "all" ? BOSS_ROSTER.filter((x) => x.powers).map((x) => x.id) : a!.split(",");
  await run(ids, Number(b ?? 3), (c ?? "strong") as "strong" | "even", d ?? "test", Number(e ?? 1), f === "off");
} else if (cmd === "summary") summary(a!.split(","), Number(b ?? DANGER));
else if (cmd === "jumps") jumps(a!.split(","), Number(b ?? DANGER));
else if (cmd === "compare") compare(a!, b!);
else console.log("usage: run <ids|all> <seeds> <strong|even> <tag> [first seed] [off] | summary <tags> [danger] | jumps <tags> [danger] | compare <before> <after>");
