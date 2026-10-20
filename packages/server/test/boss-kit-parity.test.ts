import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
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
  slamFrom,
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

/** The app's host (net.ts): its answer to a boss request, on the stand-in engine. */
async function hostBoss(engine: EngineLike, s: Settings, m: Extract<Msg, { t: "bossRequest" }>): Promise<Extract<Parameters<LobbyCore["message"]>[1], { t: "bossMove" }>> {
  const engines = [engine];
  const reply = (move: string, extra: { drag?: string; showdown?: string } = {}) => ({ t: "bossMove" as const, key: m.key, move, ...extra });
  if (m.extra) return reply((await extraMoveFrom(engine, m.fen)) ?? "");
  if (m.bounce) return reply((await bounceFrom(engines, m.fen, m.bounce))?.fen ?? "");
  if (m.fuse) return reply((await fuseFrom(engines, m.fen, m.fuse, undefined, m.land?.length ? slamAhead(m.land).after : null))?.fen ?? "");
  if (m.slam) return reply((await slamFrom(engines, m.fen, m.slam))?.fen ?? "");
  if (m.hop) return reply((await hopFrom(engines, m.fen, m.hop))?.fen ?? "");
  if (m.repaint) return reply((await repaintFrom(engines, m.fen, m.repaint, !!m.repaintAny))?.fen ?? "");
  const kind = m.best ? "best" : m.stumble ? "stumble" : m.stagger ? "stagger" : "elo";
  const ahead = m.land?.length && !m.funhouse ? slamAhead(m.land) : null;
  const look = m.race && !m.funhouse ? { race: m.race, looks: BOSS_POWERS.carrotLooks, nodes: BOSS_POWERS.carrotNodes } : null;
  const ordinary = () => bossMoveFrom(engine, m.fen, m.elo, m.nodes, kind, Math.random, s.kingStrikeLoss, bossGuardFrom(s), m.allowed ?? null, undefined, ahead, look);
  if (m.seed !== undefined && !m.funhouse) {
    const answer = await pigTurn(engines, m.fen, { seed: m.seed, ...(m.pull ? { pull: m.pull } : {}), ...(m.drag ? { drag: true as const } : {}), ...(m.showdown ? { showdown: m.showdown } : {}) }, ordinary);
    return reply(answer.move, { ...(answer.drag !== undefined ? { drag: answer.drag } : {}), ...(answer.showdown !== undefined ? { showdown: answer.showdown } : {}) });
  }
  const move = m.funhouse ? await funhouseMoveFrom(engine, m.fen, m.allowed ?? null) : await ordinary();
  // (Moo's Moonbeam after his move: the crowd's top moves after it go with the move.)
  const beam = m.beam && !m.funhouse ? await beamLines(engine, m.fen, move, m.beam) : null;
  return { ...reply(move), ...(beam ? { beam } : {}) };
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
async function online(bossId: string, test: string): Promise<{ trace: Trace; start: MatchRunner }> {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const settings = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...RAID_SETTINGS, lastStandFrom: 999, bossId, bossPowerTest: test, bossUnfinished: true, bossHidden: true, bossMaxMoves: MAX_MOVES } as Settings;
  const core = new LobbyCore(newLobbyRecord("KITPA", now), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), msg as Msg]), icon: () => undefined }, library, mulberry32(7), settings);
  // (Rated 3000: the boss a step above, past the strength where he slips, so his move is the same on both paths.)
  for (const [i, id] of ["P1", "P2"].entries()) core.connect(undefined, id, i ? "phone" : "computer", false, 3000);
  core.message("p1", { t: "start" });
  const runner = (core as unknown as { runner: MatchRunner }).runner;
  const start = MatchRunner.restore(structuredClone(runner.snapshot()), { settings: runner.settings, rng: mulberry32(99), engines: [fakeEngine()], library });
  const engine = fakeEngine();
  const trace: Trace = { turns: [], events: new Set(), result: null };
  const picked = new Set<string>();
  for (let i = 0; i < 4000 && trace.result === null; i++) {
    const msgs = inbox.get("p1") ?? [];
    inbox.set("p1", []);
    inbox.set("p2", []);
    let acted = false;
    for (const m of msgs) {
      if (m.t === "boss") for (const e of m.boss.powers?.events ?? []) trace.events.add(eventKey(e));
      if (m.t === "results") trace.result = m.bossResult ?? "none";
      if (m.t === "scoreRequest") {
        const boards = await Promise.all(m.jobs.map((j) => hostScore(engine, runner.settings, j)));
        core.message("p1", { t: "scores", key: m.key, boards });
        acted = true;
      }
      if (m.t === "bossRequest") {
        core.message("p1", await hostBoss(engine, runner.settings, m));
        acted = true;
      }
      if (m.t === "round" && m.board && m.boss && !picked.has(m.key)) {
        picked.add(m.key);
        for (const e of m.boss.powers?.events ?? []) trace.events.add(eventKey(e));
        const allowed = m.boss.powers?.allowed ?? null;
        trace.turns.push(turnKey(m.board.fen, allowed));
        const move = pickFor(m.board.fen, allowed ?? legalMoves(m.board.fen));
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
async function solo(start: MatchRunner): Promise<Trace> {
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
      if (r.bossToMove() && r.hopDue()) await r.playHop(engines).catch(() => r.applyHop(null));
      seen();
      if (r.bossToMove()) await r.playBoss(engines[0]);
      continue;
    }
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
    const move = pickFor(fen, allowed ?? legalMoves(fen));
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
});
