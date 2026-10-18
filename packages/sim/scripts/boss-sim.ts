/**
 * Calibrates the boss battle: a crowd of 10 bots (voting, the most popular pick
 * played) as White against Stockfish at UCI_Elo = the crowd's weighted rating +
 * an offset, with the boss striking down the worst recent mover every 3 crowd
 * moves (down to 3). Crowds of three strengths (expert, club and casual players,
 * modeled as bots that sometimes play a random move). The goal is a boss that's hard but beatable.
 *
 *   npx tsx packages/sim/scripts/boss-sim.ts run <expert|club|casual|beginner> <offsets,comma> <games> <seed> [stumble][,snack][,split]
 *
 * `snack`: Big Boy's opening, the crowd's d- or e-pawn eaten before move 1 (a coin flip per game).
 * `split`: Sawyer's opening, his first move a pawn move and that pawn sawn in two (a second pawn beside it: splitSquare;
 *   from the starting position he has all 8, so it comes on his first pawn move once one of his pawns is gone).
 *   npx tsx packages/sim/scripts/boss-sim.ts summary
 *   npx tsx packages/sim/scripts/boss-sim.ts raid <boss,ids|all> <games> <seed> <strikes> <tag> [patch]
 *   npx tsx packages/sim/scripts/boss-sim.ts raid-summary <tags>
 *
 * `raid`'s `patch` (JSON, for tuning runs): `powers`, numbers put over BOSS_POWERS for the run (rageSpeed merged);
 * `offset`, a boss's Elo offset by id; `counter`, the crowd takes one of Alfil's marked pawns when the best such capture
 * costs at most that many pawns against its best move (the bots' own picks read the judge, which doesn't know about the
 * fusion: a crowd that knows the rule plays the counter when it's cheaper than what the fusion gives him).
 * Chub & Chirp's Leapfrog (id hopper): each row logs the hops and, for every turn of his with a pawn nose to nose that
 * couldn't hop, why (hopOptions; `cap`: out of hops). (The hop as his move, the variant the sim turned down, can't be
 * run from here: its switch went with it. It ran on commit eb678d7 only, checked out: reports/hopper-sim.md.)
 * Their Carrot Patch: each row logs the cast (after which crowd move, the carrots and each one's lead for him as the
 * cast saw it), every pull, how the race ended, his spin, and what his race brain did. `cast` ([from, to]): a forced cast
 * (the admins' trigger) at a crowd turn drawn from that range, the battle stopped once the race and the spin are over
 * (the carrot counts' extra samples: reports/hopper-carrots-sim.md). Tuning the placement: `{"powers": {"carrotLeads": [...]}}`.
 *
 * Results go to reports/boss-sim/*.jsonl; `summary` writes reports/boss-calibration.md.
 */
import { BOSS_ROSTER, DEFAULT_SETTINGS, RAID_SETTINGS, bossElo, bossStumbleChance, botPick, estimateRating, mulberry32, shuffle, type Rng, type Settings } from "@chessroyale/core";
import { BOSS_POWERS } from "@chessroyale/core";
import { MatchRunner, applyMove, bossMoveFrom, botRoster, carrotSpots, carrotsOf, carrotsOpen, chooseSplit, fenAfter, fuseFrom, gameEndWith, hopFrom, hopOptions, legalMoves, passTurn, pickSlam, pieceAt, raceOn, slamPawnsLost, slamScores, splitRoom, START_FEN, withPiece, withoutPiece, type Base, type EngineLike, type Opening } from "@chessroyale/chess";
import { createNodeEngine } from "@chessroyale/chess/node";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const settings = DEFAULT_SETTINGS;
const CROWD_NODES = 150_000;
const MAX_MOVES = 60;
const KILL_EVERY = 3;
const MIN_SURVIVORS = 3;
/** Crowds of 10: each member's skill temperature, and how often they play a random legal move (human-like blunders). */
const spread = (lo: number, hi: number) => Array.from({ length: 10 }, (_, i) => lo * Math.pow(hi / lo, i / 9));
const CROWDS: Record<string, { skills: number[]; random: number }> = {
  expert: { skills: spread(1, 4), random: 0.02 },
  club: { skills: spread(6, 20), random: 0.06 },
  casual: { skills: spread(15, 40), random: 0.12 },
  beginner: { skills: spread(30, 90), random: 0.25 },
};

async function run(kind: string, offsets: number[], games: number, seed: number, stumble: boolean, snack = false, split = false) {
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const engine = await createNodeEngine({ nodes: CROWD_NODES, hashMb: 16 });
  const boss = await createNodeEngine({ nodes: settings.bossNodes, hashMb: 16 });
  const rng = mulberry32(seed);
  const { skills, random } = CROWDS[kind]!;
  const pickSettings = { ...settings, botRandomMoveChance: random };
  const candidates = async (fen: string) => {
    const top = await engine.topMoves(fen, settings.botCandidateMoves);
    const best = top[0]!.expected;
    return { top, list: top.map((m) => ({ move: m.move, loss: Math.max(0, (best - m.expected) * 100) })) };
  };
  // The crowd's rating before the battle, from picks in positions like the game's.
  const warm: number[][] = skills.map(() => []);
  const positions = shuffle(rng, library.filter((o) => o.moves.length >= 10)).slice(0, 30);
  for (const o of positions) {
    const fen = fenAfter(o.moves.slice(0, 8 + Math.floor(rng() * 3)));
    const { list } = await candidates(fen);
    skills.forEach((skill, i) => {
      const move = botPick(rng, list, skill, legalMoves(fen), pickSettings);
      warm[i]!.push(list.find((c) => c.move === move)?.loss ?? 30);
    });
  }
  const rating = bossElo(warm.map((l) => estimateRating(l)), { bossEloOffset: 0, bossEloRange: [0, 9999] });
  console.log(`${kind} crowd rating ${rating}`);
  mkdirSync(root + "reports/boss-sim", { recursive: true });
  for (const offset of offsets) {
    for (let g = 0; g < games; g++) {
      // As the game does: the target strength (down to 800), Stockfish at no less than 1320, stumbling below 1700.
      const elo = stumble ? Math.max(settings.bossEloRange[0], Math.min(3190, rating + offset)) : Math.max(1320, Math.min(3190, rating + offset));
      const chance = stumble ? bossStumbleChance(elo, settings) : 0;
      // (Big Boy's snack: the crowd's d- or e-pawn gone before move 1.)
      const start = snack ? withoutPiece(START_FEN, rng() < 0.5 ? "d2" : "e2") : START_FEN;
      const splitSeed = Math.floor(rng() * 2 ** 32);
      const result = await battle(rng, skills, pickSettings, candidates, (fen, allowed) => bossMoveFrom(boss, fen, elo, settings.bossNodes, rng() < chance, rng, undefined, undefined, allowed), start, split ? splitSeed : null);
      const row = { kind, rating, offset, elo, stumble, ...(snack ? { snack } : {}), ...(split ? { split } : {}), ...result };
      appendFileSync(root + `reports/boss-sim/${kind}-${seed}${snack ? "-snack" : ""}${split ? "-split" : ""}.jsonl`, JSON.stringify(row) + "\n");
      console.log(JSON.stringify(row));
    }
  }
  engine.close();
  boss.close();
}

async function battle(
  rng: Rng,
  skills: number[],
  pickSettings: typeof settings,
  candidates: (fen: string) => Promise<{ top: { move: string; expected: number }[]; list: { move: string; loss: number }[] }>,
  bossMove: (fen: string, allowed: string[] | null) => Promise<string>,
  start: string = START_FEN,
  split: number | null = null,
) {
  let history: string[] = [];
  let fen = start;
  // (Sawyer's split: the position changes after his first move, a base there.)
  const bases: Base[] = [{ ply: 0, fen: start }];
  let splitState: "first" | "waiting" | "done" = "first";
  let splitAt: number | null = null;
  const gameEnd = (_start: string, h: readonly string[]) => gameEndWith(h, bases);
  let alive = skills.map((skill, i) => ({ i, skill, recent: [] as number[] }));
  let moves = 0;
  let lastExpected = 0.5;
  while (moves < MAX_MOVES && !gameEnd(start, history)) {
    const { top, list } = await candidates(fen);
    lastExpected = top[0]!.expected;
    const legal = legalMoves(fen);
    const picks = alive.map((p) => {
      const move = botPick(rng, list, p.skill, legal, pickSettings);
      p.recent.push(list.find((c) => c.move === move)?.loss ?? 30);
      return move;
    });
    const count = (m: string) => picks.filter((x) => x === m).length;
    const most = Math.max(...picks.map(count));
    const tied = [...new Set(picks.filter((m) => count(m) === most))];
    const played = tied[Math.floor(rng() * tied.length)]!;
    history = [...history, played];
    fen = applyMove(fen, played);
    moves++;
    if (moves % KILL_EVERY === 0 && alive.length > MIN_SURVIVORS) {
      const sum = (p: (typeof alive)[number]) => p.recent.slice(-KILL_EVERY).reduce((s, x) => s + x, 0);
      const victim = [...alive].sort((a, b) => sum(b) - sum(a))[0]!;
      alive = alive.filter((p) => p !== victim);
    }
    if (gameEnd(start, history)) break;
    // (Sawyer: his first move a pawn move, then that pawn sawn in two; with no room yet for another pawn of his, his
    // first pawn move once there is: as the game's rules, bosses/sawyer.ts.)
    const first = split !== null && history.length === 1;
    const pawnMoves = first ? legalMoves(fen).filter((m) => pieceAt(fen, m.slice(0, 2))?.type === "p") : [];
    const reply = await bossMove(fen, pawnMoves.length ? pawnMoves : null);
    history = [...history, reply];
    fen = applyMove(fen, reply);
    if (split !== null && splitState !== "done") {
      const pawn = pieceAt(fen, reply.slice(2, 4))?.type === "p" && reply.length === 4;
      const pick = pawn && splitRoom(fen, "b") ? chooseSplit(fen, reply.slice(2, 4), "w", split, moves + 1) : null;
      if (pick) {
        fen = withPiece(fen, pick.square, { color: "b", type: "p" });
        bases.push({ ply: history.length, fen });
        splitState = "done";
        splitAt = moves;
      } else if (first) splitState = pawn ? "waiting" : "done";
    }
  }
  const end = gameEnd(start, history);
  let result: "crowd" | "boss" | "draw";
  if (end === "checkmate") result = fen.split(" ")[1] === "b" ? "crowd" : "boss";
  else if (end) result = "draw";
  else {
    // The move cap: the engine's verdict (White's expected score from the last crowd search).
    result = lastExpected >= 0.6 ? "crowd" : lastExpected <= 0.4 ? "boss" : "draw";
  }
  return { result, moves, ended: end ?? "cap", ...(split !== null ? { splitAt } : {}) };
}

function summary() {
  const dir = root + "reports/boss-sim";
  const rows = readdirSync(dir).flatMap((f) =>
    readFileSync(`${dir}/${f}`, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { kind: string; rating: number; offset: number; elo: number; result: string; moves: number; ended: string; stumble?: boolean; snack?: boolean; split?: boolean }),
  );
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.kind}|${r.offset}|${r.stumble ? "s" : ""}${r.snack ? "+snack" : ""}${r.split ? "+split" : ""}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const lines = [
    "# Boss battle calibration",
    "",
    `A crowd of 10 bots (the most popular pick played, ${CROWD_NODES.toLocaleString("en-US")}-node candidate search) as White against Stockfish at UCI_Elo = the crowd's weighted rating + offset (${settings.bossNodes.toLocaleString("en-US")} nodes), with the boss striking down the worst recent mover every ${KILL_EVERY} crowd moves down to ${MIN_SURVIVORS}, capped at ${MAX_MOVES} crowd moves (then the engine's verdict: 60%+ wins). Generated by \`packages/sim/scripts/boss-sim.ts\`.`,
    "",
    "Rows marked *stumbles* use the game's boss: the target strength can go down to 800; Stockfish plays at 1320 or more, and below 2100 the boss sometimes plays a random legal move instead (chance (2100 − target) / 1000, at most 40% in these runs; the game ships with at most 25%, since weak crowds still won 6–7 of 8 at 40%). Earlier tries, replaced here: a random top-5 move below 1700, and a random legal move below 1900, still lost nearly every game for these crowds; a random legal move below 2300 (chance / 800, at most 50%) went too far the other way (club and casual crowds won 7 of 8, beginners 4 of 8).",
    "",
    "| Crowd | Crowd rating | Offset | Boss | Boss Elo | Games | Crowd wins | Draws | Boss wins | Avg moves |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  const order = ["expert", "club", "casual", "beginner"];
  for (const [key, rs] of [...groups].sort(([a], [b]) => {
    const [ka, oa] = a.split("|");
    const [kb, ob] = b.split("|");
    return order.indexOf(ka!) - order.indexOf(kb!) || a.split("|")[2]!.localeCompare(b.split("|")[2]!) || Number(oa) - Number(ob);
  })) {
    const [kind, offset, st] = key.split("|");
    const n = rs.length;
    const pct = (k: string) => `${Math.round((100 * rs.filter((r) => r.result === k).length) / n)}%`;
    const avg = Math.round(rs.reduce((s, r) => s + r.moves, 0) / n);
    lines.push(`| ${kind} | ${rs[0]!.rating} | ${Number(offset) >= 0 ? "+" : ""}${offset} | ${st?.startsWith("s") ? "stumbles" : "plain"}${st?.includes("+snack") ? ", snack (a center pawn eaten)" : ""}${st?.includes("+split") ? ", split (his first pawn sawn in two)" : ""} | ${Math.round(rs.reduce((s, r) => s + r.elo, 0) / n)} | ${n} | ${pct("crowd")} | ${pct("draw")} | ${pct("boss")} | ${avg} |`);
  }
  writeFileSync(root + "reports/boss-calibration.md", lines.join("\n") + "\n");
  console.log(lines.join("\n"));
}

// ---------------- Raids with every power (the rage meter's tuning) ----------------

/** The judge's and the boss's search in the raid sims (a little under the game's 250,000, for time). */
const RAID_NODES = 120_000;
/** Each boss's ultimate, as the raid sim sees it come: a moment as a turn begins, or one the match runner plays. */
const ULT_EVENTS = new Set(["blizzard", "candle", "boardsaw"]);

/**
 * A Solo raid with every power, as solo plays one with nobody watching (simulateRest): 50 bots (the Solo raid's own
 * roster) against the boss at its usual raid strength, through the match runner, so the rage meter, the passives and
 * the ultimates are the game's own. `strikes`: the God King's strikes the crowd calls (at random crowd turns 6 to 30,
 * from a source of its own so the games stay paired across settings). Rows go to reports/boss-sim/raid-<tag>.jsonl.
 */
/** A raid run's tuning patch (see the top of this file). */
interface RaidPatch {
  powers?: Record<string, unknown>;
  offset?: Record<string, number>;
  counter?: number;
  /** Chub & Chirp: a forced Carrot Patch (the admins' trigger) at a crowd turn in this range; the battle stops after the race. */
  cast?: [number, number];
  /** Start at this game (a run picked up where it stopped: the games before it are already in its rows). */
  skip?: number;
}

/**
 * The crowd's counter to Alfil's cast (patch.counter): with two of his pawns marked, the captures that take one; the
 * best of them by the engine, played by the whole crowd when it costs at most `max` pawns against the best move.
 * Returns that cost (null: no capture there).
 */
async function counterTusks(runner: MatchRunner, engine: EngineLike, max: number): Promise<number | null> {
  const p = runner.boss?.powers;
  if (!p?.tusks) return null;
  const fen = runner.boards.get(runner.state.boards[0]!)!.fen;
  const his = runner.boss!.crowdSide === "w" ? "b" : "w";
  const caps = legalMoves(fen).filter((m) => p.tusks!.pawns.some((sq) => pieceAt(applyMove(fen, m), sq)?.color !== his));
  if (!caps.length) return null;
  const [best] = await engine.topMoves(fen, 1);
  const [top] = (await engine.scoreMoves(fen, caps)).sort((a, b) => b.expected - a.expected);
  const cost = Math.max(0, slamPawnsLost(best!.expected, top!.expected));
  // (Every bot's pick, as one crowd: the runner's planned picks.)
  if (cost <= max) for (const pl of runner.alive()) (runner as unknown as { planned: Map<string, string> }).planned.set(pl.id, top!.move);
  return Math.round(cost * 100) / 100;
}

async function raid(bosses: string[], games: number, seed: number, strikes: number, tag: string, patch: RaidPatch = {}) {
  const { rageSpeed, ...powers } = (patch.powers ?? {}) as { rageSpeed?: Record<string, number> };
  Object.assign(BOSS_POWERS as Record<string, unknown>, powers, rageSpeed ? { rageSpeed: { ...BOSS_POWERS.rageSpeed, ...rageSpeed } } : {});
  for (const [id, offset] of Object.entries(patch.offset ?? {})) (BOSS_ROSTER.find((d) => d.id === id) as { offset: number }).offset = offset;
  const library = JSON.parse(readFileSync(root + "packages/chess/data/openings.json", "utf8")) as Opening[];
  const engines = [await createNodeEngine({ nodes: RAID_NODES, hashMb: 16 })];
  mkdirSync(root + "reports/boss-sim", { recursive: true });
  for (const bossId of bosses) {
    for (let g = patch.skip ?? 0; g < games; g++) {
      const rng = mulberry32(seed * 7919 + g);
      const strikeRng = mulberry32(seed * 104729 + g);
      const strikeTurns = new Set<number>();
      while (strikeTurns.size < strikes) strikeTurns.add(6 + Math.floor(strikeRng() * 25));
      // (A boss whose powers are built before its art: met as the test link does, bossUnfinished.)
      const s = { ...settings, ...RAID_SETTINGS, bossId, bossUnfinished: true, engineNodes: RAID_NODES, bossNodes: RAID_NODES } as Settings;
      const runner = new MatchRunner({ settings: s, rng, engines, library, entrants: botRoster(rng, s.lobbySize, s) });
      const ults: { kind: string; turn: number }[] = [];
      let seen = -1;
      const look = () => {
        const p = runner.boss?.powers;
        if (!p || p.turn === seen) return;
        seen = p.turn;
        for (const e of p.events) if (ULT_EVENTS.has(e.kind)) ults.push({ kind: e.kind, turn: e.turn });
      };
      look();
      let struck = 0;
      let result: string | null = null;
      // (Alfil: his casts, the fusions they came to (or the crowd's counters), his slams: each lift's swing and the ones weighed.)
      // (And the landing guard: each move of his it judged with the Slam's pieces down, and each fusion weighed that way.)
      const alfil = { casts: 0, fused: 0, taken: 0, nowhere: 0, gains: [] as number[], slams: [] as { at: number; n: number; loss: number | null; weighed: (number | "mate")[] }[], early: 0, counters: [] as number[], landing: [] as { at: number; pick: string; move: string; searched: number; ms: number }[], fuseLanding: 0 };
      // (The hopper: his hops (after which crowd move, the pawn's squares, how many he could choose from), his turns with
      // a pawn of his nose to nose with one of the crowd's, and each such pawn that couldn't hop, by why: hopOptions's
      // reasons, and `cap` once his hops are spent.)
      const hopper = { max: BOSS_POWERS.hopMax, hops: [] as { at: number; from: string; over: string; to: string; of: number }[], noseTurns: 0, refused: {} as Record<string, number> };
      // (Their Carrot Patch: the cast, each carrot's lead for him and fewest moves each side as it saw them, the pulls,
      // the end, the spin, and his race brain's looks: how many, how many changed his move, his last carrots taken.)
      const castAt = patch.cast ? patch.cast[0] + Math.floor(mulberry32(seed * 31 + g)() * (patch.cast[1] - patch.cast[0] + 1)) : null;
      const carrots = {
        forced: castAt,
        cast: null as null | { at: number; squares: string[]; leads: number[]; his: number[]; crowd: number[] },
        pulls: [] as { square: string; by: string; at: number; hop?: true }[],
        over: null as string | null,
        his: 0,
        crowd: 0,
        spin: null as unknown,
        brain: { looks: 0, changed: 0, won: 0, ms: 0 },
      };
      const t0 = Date.now();
      while (!runner.isOver()) {
        if (runner.stageComplete()) {
          result = runner.finishBossBattle();
          break;
        }
        if (runner.bossToMove()) {
          if (runner.lightsOutDue()) {
            ults.push({ kind: "lightsout", turn: runner.boss!.crowdMoves });
            runner.startLightsOut();
            runner.finishLightsOut({});
          }
          if (runner.bounceDue()) {
            ults.push({ kind: "bounce", turn: runner.boss!.crowdMoves });
            await runner.playBounce(engines).catch(() => runner.applyBounce(null));
          }
          for (let step = runner.alfilStep(); step; step = runner.alfilStep()) {
            if (step === "slam") {
              // (Every Slam tried is logged; one that lifts nothing keeps the meter and comes again on his next turn, so
              // only one that lifts counts as an ultimate.)
              const at = runner.boss!.crowdMoves;
              const fen = runner.boards.get(runner.state.boards[0]!)!.fen;
              const scored = await slamScores(engines, fen, runner.alfilCandidates());
              const pick = scored ? pickSlam(scored.before, scored.outs) : null;
              const lifted = runner.applyAlfil(pick?.fen ?? null, pick?.loss ?? null, step);
              const p = runner.boss!.powers!;
              if (lifted) ults.push({ kind: "slam", turn: at });
              alfil.slams.push({ at, n: lifted ? p.slam!.pieces.length : 0, loss: lifted ? p.slam!.loss : null, weighed: (scored?.outs ?? []).map((o) => (o.mate ? "mate" : Math.round(slamPawnsLost(scored!.before, o.crowd) * 100) / 100)) });
              continue;
            }
            if (step === "tusks") alfil.casts++;
            const fen = runner.boards.get(runner.state.boards[0]!)!.fen;
            const ahead = runner.alfilFusionAhead();
            if (ahead) alfil.fuseLanding++;
            const pick = await fuseFrom(engines, fen, runner.alfilCandidates(), undefined, ahead);
            runner.applyAlfil(pick?.fen ?? null, null, step);
            const f = runner.boss!.powers!.fusion;
            if (step === "fuse") f?.to ? alfil.fused++ : alfil.nowhere++;
            if (step === "fuse" && f?.to && pick) alfil.gains.push(pick.gain);
          }
          if (bossId === "hopper" && runner.carrotDue()) {
            // (The Carrot Patch's cast: his whole turn.)
            const at = runner.boss!.crowdMoves;
            const passed = passTurn(runner.boards.get(runner.state.boards[0]!)!.fen)!;
            const spots = carrotSpots(passed, runner.boss!.crowdSide);
            runner.applyCarrots();
            const c = runner.boss!.powers!.carrots!;
            const spot = (sq: string) => spots.find((x) => x.square === sq)!;
            const round = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : -1);
            carrots.cast = { at, squares: c.squares, leads: c.squares.map((sq) => spot(sq).lead), his: c.squares.map((sq) => round(spot(sq).his)), crowd: c.squares.map((sq) => round(spot(sq).crowd)) };
            ults.push({ kind: "carrots", turn: at });
            look();
            continue;
          }
          if (bossId === "hopper") {
            const fen = runner.boards.get(runner.state.boards[0]!)!.fen;
            const his = runner.boss!.crowdSide === "w" ? "b" : "w";
            const race = runner.boss!.powers!.carrots;
            const { options, refused } = hopOptions(fen, his, raceOn(race) ? { open: carrotsOpen(race), his: carrotsOf(race, "boss") } : null);
            if (options.length || refused.length) hopper.noseTurns++;
            const spent = (runner.boss!.powers!.hops ?? 0) >= BOSS_POWERS.hopMax;
            for (const r of refused) hopper.refused[r.why] = (hopper.refused[r.why] ?? 0) + 1;
            if (spent) hopper.refused.cap = (hopper.refused.cap ?? 0) + options.length;
            if (runner.hopDue()) {
              const candidates = runner.hopCandidates();
              const pick = candidates.length > 1 ? await hopFrom(engines, fen, candidates) : null;
              const h = runner.applyHop(pick?.fen ?? null)!;
              hopper.hops.push({ at: h.at, from: h.from, over: h.over, to: h.to, of: candidates.length });
            }
          }
          // (Alfil's fusion is his move: then his turn is over.)
          if (runner.bossToMove()) {
            const at = runner.boss!.crowdMoves;
            await runner.playBoss(engines[0]);
            const c = runner.landingCheck;
            if (c) alfil.landing.push({ at, pick: c.pick, move: c.move, searched: c.searched, ms: Math.round(c.ms) });
            const rc = runner.raceCheck;
            if (rc) {
              carrots.brain.looks++;
              if (rc.move !== rc.pick) carrots.brain.changed++;
              if (rc.won) carrots.brain.won++;
              carrots.brain.ms += Math.round(rc.ms);
            }
          }
          // (A forced cast: once the race and his spin are over, or the battle his by his last carrot, the sample is in.)
          const done = runner.boss!.powers?.carrots;
          if (castAt !== null && done && (done.spin || done.over === "won")) break;
          look();
          continue;
        }
        if (runner.extraMoveDue()) {
          await runner.playExtraMove(engines[0]);
          continue;
        }
        if (runner.funhouseDue()) {
          ults.push({ kind: "funhouse", turn: runner.boss!.crowdMoves + 1 });
          await runner.playFunhouse(engines[0]);
          continue;
        }
        runner.deal();
        // (A forced Carrot Patch: the admins' trigger, as this crowd turn begins: the cast at the start of his turn after it.)
        if (castAt !== null && bossId === "hopper" && runner.boss!.crowdMoves + 1 === castAt && !runner.boss!.powers?.carrots) runner.triggerUltimate();
        // (Alfil's marked pawns: a crowd that knows the rule takes one when it's cheap enough: patch.counter.)
        if (patch.counter !== undefined && bossId === "alfil") {
          const cost = await counterTusks(runner, engines[0]!, patch.counter);
          if (cost !== null) alfil.counters.push(cost);
        }
        // (The crowd calls the God King's strike: bots call until more than half of the crowd has.)
        if (strikeTurns.has(runner.boss!.crowdMoves + 1) && (runner.boss!.kingCharges ?? 0) > 0) {
          for (const p of runner.alive()) {
            if (runner.callStrike(p.id).struck) {
              struck++;
              break;
            }
          }
        }
        const tusksBefore = runner.boss!.powers?.tusks;
        await runner.score(new Map());
        if (tusksBefore && runner.boss!.powers?.fusion?.why === "taken" && runner.boss!.powers.fusion.at === runner.boss!.crowdMoves) alfil.taken++;
        if (runner.boss!.powers?.landed?.early && runner.boss!.powers.landed.at === runner.boss!.crowdMoves) alfil.early++;
        if (runner.bossKillDue()) runner.bossKill();
      }
      const b = runner.boss!;
      const pc = b.powers?.carrots;
      if (pc) Object.assign(carrots, { pulls: pc.pulls, over: pc.over ?? null, his: carrotsOf(pc, "boss"), crowd: carrotsOf(pc, "crowd"), spin: pc.spin ?? null });
      const row = { boss: bossId, tag, seed, game: g, strikes: struck, tier: b.tier, elo: b.elo, result: result ?? b.result ?? null, moves: b.crowdMoves, ults: ults.length, ultTurns: ults.map((u) => u.turn), kinds: [...new Set(ults.map((u) => u.kind))], secs: Math.round((Date.now() - t0) / 1000), ...(bossId === "alfil" ? { alfil } : {}), ...(bossId === "hopper" ? { hopper, carrots } : {}) };
      appendFileSync(root + `reports/boss-sim/raid-${tag}.jsonl`, JSON.stringify(row) + "\n");
      console.log(JSON.stringify(row));
    }
  }
  engines.forEach((e) => e.close());
}

/** The raid sims' table: ultimates per game and crowd results, by boss and run (tag). */
function raidSummary(tags: string[]): string[] {
  const dir = root + "reports/boss-sim";
  type Row = { boss: string; tag: string; strikes: number; result: string; moves: number; ults: number; ultTurns: number[] };
  const rows: Row[] = readdirSync(dir)
    .filter((f) => f.startsWith("raid-") && tags.includes(f.slice(5, -6)))
    .flatMap((f) => readFileSync(`${dir}/${f}`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row));
  const out: string[] = [
    "| Boss | Run | Games | Strikes a game | Ultimates a game | Games with 0 / 1 / 2 / 3+ | First at (median turn) | Crowd wins | Draws | Boss wins | Avg crowd moves |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : "-");
  for (const def of BOSS_ROSTER.filter((d) => d.powers)) {
    for (const tag of tags) {
      const rs = rows.filter((r) => r.boss === def.id && r.tag === tag);
      if (!rs.length) continue;
      const n = rs.length;
      const pct = (k: string) => `${Math.round((100 * rs.filter((r) => r.result === k).length) / n)}%`;
      const dist = [0, 1, 2].map((k) => rs.filter((r) => r.ults === k).length).concat(rs.filter((r) => r.ults >= 3).length).join(" / ");
      const avg = (f: (r: Row) => number) => (rs.reduce((t, r) => t + f(r), 0) / n).toFixed(1);
      out.push(`| ${def.name} | ${tag} | ${n} | ${avg((r) => r.strikes)} | ${avg((r) => r.ults)} | ${dist} | ${median(rs.filter((r) => r.ults).map((r) => r.ultTurns[0]!))} | ${pct("crowd")} | ${pct("draw")} | ${pct("boss")} | ${Math.round(rs.reduce((t, r) => t + r.moves, 0) / n)} |`);
    }
  }
  console.log(out.join("\n"));
  return out;
}

const [cmd, kind, offsets, games, seed, mode, patchArg] = process.argv.slice(2);
if (cmd === "summary") summary();
else if (cmd === "raid") {
  // npx tsx packages/sim/scripts/boss-sim.ts raid <boss,ids|all> <games> <seed> <strikes> <tag>
  const ids = !kind || kind === "all" ? BOSS_ROSTER.filter((d) => d.powers && d.kit).map((d) => d.id) : kind.split(",");
  await raid(ids, Number(offsets ?? 4), Number(games ?? 1), Number(seed ?? 2), mode ?? "test", patchArg ? (JSON.parse(patchArg) as RaidPatch) : {});
} else if (cmd === "raid-summary") raidSummary((kind ?? "").split(","));
else await run(kind ?? "club", (offsets ?? "0").split(",").map(Number), Number(games ?? 4), Number(seed ?? 1), !!mode?.split(",").includes("stumble"), !!mode?.split(",").includes("snack"), !!mode?.split(",").includes("split"));
