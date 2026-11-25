import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BATTLE_TOWER, BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  allowedSearch,
  beamLines,
  bossGuardFrom,
  bossMoveFrom,
  bounceFrom,
  extraMoveFrom,
  funhouseMoveFrom,
  fuseFrom,
  hopFrom,
  jobEscapes,
  jobOffers,
  judgeCandidates,
  legalMoves,
  pigTurn,
  repliesFrom,
  repaintFrom,
  slamAhead,
  waterAnswer,
  hoopsAnswer,
  creaseAnswer,
  dashExtraMoveFrom,
  applyMove,
  dodgeTimeline,
  slamFrom,
  SAW_SWAP_TEST_CHECK,
  pieceAt,
  type BoardScore,
  type EngineLike,
  type ServerMessage,
} from "@chessroyale/chess";
import { KIT_OPENING, crowdPick, fakeEngine, hash, kitBosses, quickSearches } from "../../chess/test/boss-kit-lib.ts";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

/**
 * The shared boss test kit, solo against online (Oct 18; docs/decisions/2026-10-18-boss-test-kit.md): for every boss in
 * the roster, hidden ones included, one seeded battle through the lobby (the server's rules, a host answering every
 * request as the app's host does, net.ts's handlers on the same stand-in engine) and the same battle through solo's
 * path (a copy of the lobby's runner as the battle starts, driven as solo drives it: the runner's own steps on this
 * device's engine). The crowd plays the same move from the same position on both. Both must reach the same positions,
 * the same power events and the same result: host and server agreeing ("host and server disagreeing", Oct 18).
 */

type Msg = ServerMessage;
const MAX_MOVES = 14;
/**
 * The hippo gardener's seeds waiting at every watering (the ?seeds= test switch; other bosses never read it): his count
 * runs on the server's clock online and on none in this solo copy, so it's set, and both paths roll the same seeds.
 */
const KIT_SEEDS_WAITING = 10;
/**
 * The circus tiger's balloons go on fully blown (the ?stage=4 test switch; other bosses never read it): they blow up on
 * the server's clock online and on none in this solo copy, so both paths land or pop the same balloons on the same turns.
 */
const KIT_BALLOON_STAGE = 4;
const library = [KIT_OPENING];

/** The crowd's move, from the position alone: the same on both paths. */
const pickFor = (fen: string, allowed: readonly string[]) => crowdPick(fen, allowed, mulberry32(Math.floor(hash(fen) * 2 ** 32)));

/** The app's host (net.ts): its score of a board (hostScore), on the stand-in engine. No bots, no re-check. */
async function hostScore(engine: EngineLike, s: Settings, job: Extract<Msg, { t: "scoreRequest" }>["jobs"][number]): Promise<BoardScore> {
  const all = await engine.topMoves(job.fen, s.botCandidateMoves);
  const limits = { ...(job.barred ? { barred: job.barred } : {}), ...(job.allowed ? { allowed: job.allowed } : {}) };
  const humanMoves = Object.values(job.humanPicks).filter((mv): mv is string => !!mv);
  const open = (await allowedSearch(engine, { ...limits, fen: job.fen, picks: humanMoves }, all)) ?? [];
  const top = judgeCandidates(limits, all, open);
  const offers = jobOffers({ fen: job.fen, race: job.race, ...limits }).filter((mv) => !top.some((t) => t.move === mv));
  const offered = offers.length ? await engine.scoreMoves(job.fen, offers) : [];
  const expectedAfter: Record<string, number> = Object.fromEntries(top.map((mv) => [mv.move, mv.expected]));
  for (const mv of [...open, ...offered]) expectedAfter[mv.move] = mv.expected;
  const escapes = jobEscapes({ fen: job.fen, burn: job.burn, race: job.race, allowed: job.allowed, barred: job.barred });
  const missing = [...new Set([...Object.values(job.humanPicks), ...escapes])].filter((mv): mv is string => !!mv && expectedAfter[mv] === undefined);
  const extra = [...open, ...offered, ...(missing.length ? await engine.scoreMoves(job.fen, missing) : [])];
  for (const x of extra) expectedAfter[x.move] = x.expected;
  const { replies, mates } = repliesFrom([top, extra]);
  return { boardId: job.boardId, bestMove: top[0]!.move, bestExpected: top[0]!.expected, expectedAfter, botPicks: {}, botThinkMs: {}, botPowerUps: [], replies, mates };
}

/**
 * The app's host (net.ts): its answer to a boss request, on the stand-in engine. `focus`: the boss of the last view it was sent (net.ts's
 * `this.boss`): his extra move is picked as his (Dash's after a failed Scramble Rush, else Hollow's; audit 1, finding 5).
 */
async function hostBoss(engine: EngineLike, s: Settings, m: Extract<Msg, { t: "bossRequest" }>, focus: string | undefined): Promise<Extract<Parameters<LobbyCore["message"]>[1], { t: "bossMove" }>> {
  const engines = [engine];
  const reply = (move: string, extra: { drag?: string; showdown?: string } = {}) => ({ t: "bossMove" as const, key: m.key, move, ...extra });
  if (m.extra) return reply((await (focus === "dash" ? dashExtraMoveFrom : extraMoveFrom)(engine, m.fen)) ?? "");
  if (m.bounce) return reply((await bounceFrom(engines, m.fen, m.bounce))?.fen ?? "");
  if (m.fuse) return reply((await fuseFrom(engines, m.fen, m.fuse, undefined, m.land?.length ? slamAhead(m.land).after : null))?.fen ?? "");
  if (m.slam) return reply((await slamFrom(engines, m.fen, m.slam))?.fen ?? "");
  if (m.hop) return reply((await hopFrom(engines, m.fen, m.hop))?.fen ?? "");
  if (m.repaint) return reply((await repaintFrom(engines, m.fen, m.repaint, !!m.repaintAny))?.fen ?? "");
  if (m.water) return reply((await waterAnswer(engines, m.fen, m.water, !!m.waterAny)).answer);
  const kind = m.best ? "best" : m.stumble ? "stumble" : m.stagger ? "stagger" : "elo";
  const ahead = m.land?.length && !m.funhouse ? slamAhead(m.land) : null;
  const look = m.race && !m.funhouse ? { race: m.race, looks: BOSS_POWERS.carrotLooks, nodes: BOSS_POWERS.carrotNodes } : null;
  const ordinary = () => bossMoveFrom(engine, m.fen, m.elo, m.nodes, kind, Math.random, s.kingStrikeLoss, bossGuardFrom(s), m.allowed ?? null, undefined, ahead, look, false, m.lock ?? null);
  if (m.seed !== undefined && !m.funhouse) {
    const answer = await pigTurn(engines, m.fen, { seed: m.seed, ...(m.pull ? { pull: m.pull } : {}), ...(m.drag ? { drag: true as const } : {}), ...(m.showdown ? { showdown: m.showdown } : {}) }, ordinary);
    return reply(answer.move, { ...(answer.drag !== undefined ? { drag: answer.drag } : {}), ...(answer.showdown !== undefined ? { showdown: answer.showdown } : {}) });
  }
  const move = m.funhouse ? await funhouseMoveFrom(engine, m.fen, m.allowed ?? null) : await ordinary();
  // (Moo's Moonbeam after his move: the crowd's top moves after it go with the move.)
  const beam = m.beam && !m.funhouse ? await beamLines(engine, m.fen, move, m.beam) : null;
  // (The circus tiger's hoops and balloon due after his move: the cast's blocks and where it lands go with the move.)
  const end = (m.balloon || m.hoops) && !m.funhouse ? await hoopsAnswer(engines, applyMove(m.fen, move), m.hoops ?? null, m.balloon ?? null) : null;
  // (Folio's Crease wanted with its move: the line after it goes with the move.)
  const crease = m.crease && !m.funhouse ? await creaseAnswer(engines, applyMove(m.fen, move), m.crease) : "";
  return { ...reply(move), ...(beam ? { beam } : {}), ...(end?.land ? { balloon: end.land.square } : {}), ...(end?.answer ? { hoops: end.answer } : {}), ...(crease ? { crease } : {}) };
}

/** What a battle showed: each crowd turn's position and allowed moves, every power event, the result. */
interface Trace {
  turns: string[];
  events: Set<string>;
  result: string | null;
}
const turnKey = (fen: string, allowed: readonly string[] | null | undefined) => `${fen} | ${allowed ? [...allowed].sort().join(",") : "any"}`;
const eventKey = (e: object) => JSON.stringify(e, Object.keys(e).sort());

/** The battle online: two people (the host, p1, answers every request), each crowd turn the same pick from both. */
async function online(bossId: string, test: string, patch: Partial<Settings> = {}, pick = pickFor): Promise<{ trace: Trace; start: MatchRunner }> {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const settings = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...RAID_SETTINGS, lastStandFrom: 999, bossId, bossPowerTest: test, bossUnfinished: true, bossHidden: true, bossMaxMoves: MAX_MOVES, bossSeedTest: KIT_SEEDS_WAITING, bossStageTest: KIT_BALLOON_STAGE, ...patch } as Settings;
  const core = new LobbyCore(newLobbyRecord("KITPA", now), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), msg as Msg]), icon: () => undefined }, library, mulberry32(7), settings);
  // (Rated 3000: the boss a step above, past the strength where he slips, so his move is the same on both paths.)
  for (const [i, id] of ["P1", "P2"].entries()) core.connect(undefined, id, i ? "phone" : "computer", false, 3000);
  core.message("p1", { t: "start" });
  const runner = (core as unknown as { runner: MatchRunner }).runner;
  const start = MatchRunner.restore(structuredClone(runner.snapshot()), { settings: runner.settings, rng: mulberry32(99), engines: [fakeEngine()], library });
  const engine = fakeEngine();
  const trace: Trace = { turns: [], events: new Set(), result: null };
  const picked = new Set<string>();
  let focus: string | undefined;
  for (let i = 0; i < 4000 && trace.result === null; i++) {
    const msgs = inbox.get("p1") ?? [];
    inbox.set("p1", []);
    inbox.set("p2", []);
    let acted = false;
    for (const m of msgs) {
      if ((m.t === "boss" || m.t === "round") && m.boss?.id) focus = m.boss.id;
      if (m.t === "boss") for (const e of m.boss.powers?.events ?? []) trace.events.add(eventKey(e));
      // (Chandy's Dodge: both vote the safe square (the lobby's own state: the view hides it) once the round's vote is open.)
      const dodge = m.t === "boss" ? m.dodge : undefined;
      const full = runner.boss?.powers?.chandy?.dodge;
      if (dodge && full && full.results.length === dodge.round && dodge.round < full.rounds.length) {
        now = Math.max(now, dodge.at + dodgeTimeline().rounds[dodge.round]!.voteAt);
        for (const id of ["p1", "p2"]) core.message(id, { t: "dodgeVote", key: dodge.key, round: dodge.round, square: full.rounds[dodge.round]!.safe });
      }
      if (m.t === "results") trace.result = m.bossResult ?? "none";
      if (m.t === "scoreRequest") {
        const boards = await Promise.all(m.jobs.map((j) => hostScore(engine, runner.settings, j)));
        core.message("p1", { t: "scores", key: m.key, boards });
        acted = true;
      }
      if (m.t === "bossRequest") {
        core.message("p1", await hostBoss(engine, runner.settings, m, focus));
        acted = true;
      }
      if (m.t === "round" && m.board && m.boss && !picked.has(m.key)) {
        picked.add(m.key);
        for (const e of m.boss.powers?.events ?? []) trace.events.add(eventKey(e));
        const allowed = m.boss.powers?.allowed ?? null;
        trace.turns.push(turnKey(m.board.fen, allowed));
        const move = pick(m.board.fen, allowed ?? legalMoves(m.board.fen));
        for (const id of ["p1", "p2"]) core.message(id, { t: "pick", key: m.key, move });
        acted = true;
      }
    }
    if (acted || trace.result !== null) continue;
    const next = core.nextAlarm;
    if (next === null) break;
    now = Math.max(now + 1, next);
    core.alarm();
  }
  return { trace, start };
}

/** The same battle as solo plays it: the lobby's runner as the battle started, its own steps, this device's engine. */
async function solo(start: MatchRunner, pick = pickFor): Promise<Trace> {
  const r = start;
  const engines = [fakeEngine()];
  const trace: Trace = { turns: [], events: new Set(), result: null };
  const seen = () => {
    for (const e of r.bossView()?.powers?.events ?? []) trace.events.add(eventKey(e));
  };
  for (let i = 0; i < 400 && !r.isOver(); i++) {
    seen();
    if (r.stageComplete()) {
      trace.result = r.finishBossBattle();
      break;
    }
    if (r.bossToMove()) {
      if (r.lightsOutDue()) {
        r.startLightsOut();
        r.finishLightsOut({});
        seen();
      }
      if (r.bounceDue()) await r.playBounce(engines).catch(() => r.applyBounce(null));
      seen();
      for (let s = 0; s < 3 && r.alfilStep(); s++) {
        await r.playAlfil(engines).catch(() => r.applyAlfil(null));
        seen();
      }
      if (r.bossToMove() && r.carrotDue()) r.applyCarrots();
      seen();
      if (r.bossToMove() && r.repaintDue()) await r.playRepaint(engines).catch(() => r.applyRepaint(null));
      seen();
      if (r.bossToMove() && r.waterDue()) await r.playWater(engines).catch(() => r.applyWater(null));
      seen();
      if (r.bossToMove() && r.hopDue()) await r.playHop(engines).catch(() => r.applyHop(null));
      seen();
      // (Chandy's queen lock: aimed, as online where the host's answer to the pass guard is a move, never "wait".)
      if (r.bossToMove() && r.queenLockDue()) r.applyQueenLock(null);
      seen();
      // (A moment with his move known, before it shows, as solo shows it: Chandy's first lock.)
      if (r.bossToMove()) await r.playBoss(engines[0], async () => seen());
      continue;
    }
    // (Chandy's Dodge: everyone votes the safe square, as online.)
    while (r.dodgeDue()) {
      const d = r.boss!.powers!.chandy!.dodge!;
      const safe = d.rounds[d.results.length]!.safe;
      r.finishDodgeRound(Object.fromEntries(r.alive().map((p) => [p.id, safe])));
    }
    seen();
    if (r.stageComplete()) continue;
    // (Dash's Scramble Rush: nobody's placements, as online.)
    if (r.rushDue()) r.finishRush({});
    if (r.extraMoveDue()) {
      await r.playExtraMove(engines[0]);
      continue;
    }
    if (r.funhouseDue()) {
      await r.playFunhouse(engines[0]).catch(() => r.applyFunhouse(""));
      continue;
    }
    r.deal();
    const fen = r.boards.get(r.state.boards[0]!)!.fen;
    const allowed = r.crowdAllowed();
    trace.turns.push(turnKey(fen, allowed));
    const move = pick(fen, allowed ?? legalMoves(fen));
    await r.score(new Map(r.alive().map((p) => [p.id, { move, thinkMs: 1000 }])));
    if (r.bossKillDue()) r.bossKill();
  }
  return trace;
}

let undoSearches: () => void;
beforeAll(() => {
  undoSearches = quickSearches();
});
afterAll(() => undoSearches?.());

describe("the boss kit: solo and online agree", () => {
  for (const def of kitBosses()) {
    it(`${def.id}: the same battle (his ultimate switched on early) reaches the same positions, power events and result solo and online`, async () => {
      const { trace: net, start } = await online(def.id, def.powers!.ultimate);
      expect(start.boss?.id).toBe(def.id);
      const local = await solo(start);
      // (Enough of a battle to mean something.)
      expect(net.turns.length).toBeGreaterThan(4);
      expect(net.result).not.toBeNull();
      const firstDiff = net.turns.findIndex((t, i) => t !== local.turns[i]);
      expect(firstDiff === -1 ? null : { turn: firstDiff + 1, online: net.turns[firstDiff], solo: local.turns[firstDiff] ?? "none" }).toBeNull();
      expect(local.turns.length).toBe(net.turns.length);
      expect({ onlyOnline: [...net.events].filter((e) => !local.events.has(e)), onlySolo: [...local.events].filter((e) => !net.events.has(e)) }).toEqual({ onlyOnline: [], onlySolo: [] });
      expect(local.result).toBe(net.result);
    }, 60_000);
  }

  it("gingerbread, ?power=superfreeze: his Super Freeze (at the start of his turn, while he thinks) is the same solo and online", async () => {
    const { trace: net, start } = await online("gingerbread", "superfreeze");
    const local = await solo(start);
    expect([...net.events].some((e) => e.includes("superFreeze"))).toBe(true);
    expect(local.turns).toEqual(net.turns);
    expect({ onlyOnline: [...net.events].filter((e) => !local.events.has(e)), onlySolo: [...local.events].filter((e) => !net.events.has(e)) }).toEqual({ onlyOnline: [], onlySolo: [] });
    expect(local.result).toBe(net.result);
  }, 60_000);

  it("sawyer, ?power=sawswap: his Saw Swap (as the crowd's check lands, before his move) is the same solo and online", async () => {
    // (The crowd plays the switch's check when it can, from the position alone: the same on both paths.)
    const pick = (fen: string, allowed: readonly string[]) => Object.values(SAW_SWAP_TEST_CHECK).find((m) => allowed.includes(m)) ?? pickFor(fen, allowed);
    const { trace: net, start } = await online("sawyer", "sawswap", {}, pick);
    const local = await solo(start, pick);
    expect([...net.events].some((e) => e.includes("sawSwap"))).toBe(true);
    expect(local.turns).toEqual(net.turns);
    expect({ onlyOnline: [...net.events].filter((e) => !local.events.has(e)), onlySolo: [...local.events].filter((e) => !net.events.has(e)) }).toEqual({ onlyOnline: [], onlySolo: [] });
    expect(local.result).toBe(net.result);
  }, 60_000);

  it("hopper, the Pawn Bounce: the crowd's first double push knocked back (at the start of his turn, before his move) is the same solo and online", async () => {
    // (The crowd pushes a pawn two squares when it can, from the position alone: the same on both paths.)
    const pick = (fen: string, allowed: readonly string[]) => [...allowed].sort().find((m) => /^[a-h]2[a-h]4$|^[a-h]7[a-h]5$/.test(m) && m[0] === m[2] && pieceAt(fen, m.slice(0, 2))?.type === "p") ?? pickFor(fen, allowed);
    const { trace: net, start } = await online("hopper", "pawnbounce", {}, pick);
    const local = await solo(start, pick);
    expect([...net.events].some((e) => e.includes("pawnBounce"))).toBe(true);
    expect(local.turns).toEqual(net.turns);
    expect({ onlyOnline: [...net.events].filter((e) => !local.events.has(e)), onlySolo: [...local.events].filter((e) => !net.events.has(e)) }).toEqual({ onlyOnline: [], onlySolo: [] });
    expect(local.result).toBe(net.result);
  }, 60_000);

  it("chandy, no switch: his first two captures' locks (the host's move, then the lock moment, then the move) are the same solo and online", async () => {
    const { trace: net, start } = await online("chandy", "");
    const local = await solo(start);
    const firsts = [...net.events].filter((e) => e.includes('"kind":"lockOn"') && e.includes('"first":true'));
    // (His first two captures each locked as the move shows: Eric, Nov 18.)
    expect(firsts.length).toBe(BOSS_POWERS.chandy.teachCaptures);
    expect(local.turns).toEqual(net.turns);
    expect({ onlyOnline: [...net.events].filter((e) => !local.events.has(e)), onlySolo: [...local.events].filter((e) => !net.events.has(e)) }).toEqual({ onlyOnline: [], onlySolo: [] });
    expect(local.result).toBe(net.result);
  }, 60_000);
});

/** A trace's events before the move cap's last crowd turn (`cap`): a moment on it is read by the solo trace but never sent online. */
const beforeCap = (events: ReadonlySet<string>, cap: number) => new Set([...events].filter((e) => !(((JSON.parse(e) as { turn?: number }).turn ?? 0) >= cap)));

/** More sides by hand (the default list stays as it is): `KIT_PARITY_SIDES=moo+dash,alfil+tiger npx vitest run packages/server/test/boss-kit-parity.test.ts`. */
const EXTRA_SIDES = (process.env.KIT_PARITY_SIDES ?? "").split(",").filter(Boolean).map((x) => x.split("+"));

/**
 * Several bosses on one side (Battle Tower PR 6): the same battle solo and online, through the lobby's path for the boss to move.
 * Every tower boss in at least one pair, and two threes; the first boss's ultimate by its test switch. Two limits of this harness,
 * not of the side (each shows with one boss too): Timber's scraps run on the server's clock online and on none in the solo copy,
 * so he goes first, with his ultimate's switch, as in his one-boss check; and a moment on the move cap's last crowd turn is read by
 * the solo trace but never sent online, so that turn's events are left out of the comparison (beforeCap; audit 1, finding 5).
 */
describe("the boss kit over several bosses: solo and online agree", () => {
  const ids = kitBosses().map((d) => d.id).filter((id) => id !== "recluse");
  const half = Math.ceil(ids.length / 2);
  const CAP = 16;
  // (Each boss once: the first half each with one from the second, then two threes; never a pair BATTLE_TOWER.apart keeps apart.)
  const sides = [
    ...ids.slice(0, half).map((id, i) => [id, ids[(half + i) % ids.length]!]),
    [ids[1]!, ids[5]!, ids[9]!],
    [ids[12]!, ids[2]!, ids[16 % ids.length]!],
    ...EXTRA_SIDES,
  ]
    .filter((xs) => new Set(xs).size === xs.length && !BATTLE_TOWER.apart.some(([a, b]) => xs.includes(a) && xs.includes(b)))
    .map((xs) => (xs.includes("timber") ? ["timber", ...xs.filter((x) => x !== "timber")] : xs));
  for (const bosses of sides) {
    it(`${bosses.join(" + ")}: the same positions, power events and result solo and online`, async () => {
      // (The first boss's ultimate by its test switch: it comes at his own turn change.)
      const test = kitBosses().find((d) => d.id === bosses[0])!.powers!.ultimate;
      const { trace: net, start } = await online(bosses[0]!, test, { bossIds: bosses, bossNoStrikes: true, bossMaxMoves: CAP });
      expect(start.state.bosses?.map((o) => o.id)).toEqual(bosses);
      const local = await solo(start);
      expect(net.turns.length).toBeGreaterThan(4);
      expect(net.result).not.toBeNull();
      const firstDiff = net.turns.findIndex((t, i) => t !== local.turns[i]);
      expect(firstDiff === -1 ? null : { turn: firstDiff + 1, online: net.turns[firstDiff], solo: local.turns[firstDiff] ?? "none" }).toBeNull();
      expect(local.turns.length).toBe(net.turns.length);
      const [netEvents, localEvents] = [beforeCap(net.events, CAP), beforeCap(local.events, CAP)];
      expect({ onlyOnline: [...netEvents].filter((e) => !localEvents.has(e)), onlySolo: [...localEvents].filter((e) => !netEvents.has(e)) }).toEqual({ onlyOnline: [], onlySolo: [] });
      expect(local.result).toBe(net.result);
    }, 60_000);
  }
});
