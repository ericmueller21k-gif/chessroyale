import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type ChandyDodge, type Settings } from "@chessroyale/core";
import { CHANDY_FX, dodgeTimeline, legalMoves, sanLineToUci, type BoardScore, type MatchRunner, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

/**
 * Chandy's Dodge online (docs/decisions/2026-11-16-chandy-rules.md): the safe squares and the teleports are the round's answers, so the
 * server sends them only in their time (dodgeSeen). Dodge is set up as his move applies, a step before it plays: the message after
 * that move, and every one after it until Dodge is over (a reconnect's `last` too), carries no safe square before its vote has closed
 * and no teleport before its time (the review of #739, H1).
 */

type Msg = ServerMessage;
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, eco: "C88", name: `O${i}`, family: `F${i}`, unusual: false, moves: line, namedPlies: line.length, expected: Object.fromEntries(line.map((_, n) => [n, 0.5])) }));

function chandyLobby(test: string) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  /** Every message each person got, with the server's time it went out. */
  const log: { id: string; at: number; msg: Msg }[] = [];
  const settings = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...RAID_SETTINGS, lastStandFrom: 999, bossId: "chandy", bossUnfinished: true, bossStumbleBelow: 0, bossPowerTest: test } as Settings;
  const send = (id: string, msg: unknown) => {
    inbox.set(id, [...(inbox.get(id) ?? []), msg as Msg]);
    log.push({ id, at: now, msg: msg as Msg });
  };
  const core = new LobbyCore(newLobbyRecord("CHNDY", now), { now: () => now, send, icon: () => undefined }, library, mulberry32(7), settings);
  for (const [i, id] of ["P1", "P2"].entries()) core.connect(undefined, id, i ? "phone" : "computer", false, 1500);
  core.message("p1", { t: "start" });
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const drop = (id: string, t: Msg["t"]) => inbox.set(id, (inbox.get(id) ?? []).filter((m) => m.t !== t));
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  const runner = () => (core as unknown as { runner: MatchRunner }).runner;
  const hostScores = () => {
    const req = last("p1", "scoreRequest");
    if (!req) return false;
    const boards: BoardScore[] = req.jobs.map((j) => {
      const legal = j.allowed ?? legalMoves(j.fen);
      const exp = Object.fromEntries(legal.map((m) => [m, 0.3 + 0.4 * hash(j.fen + m)]));
      const best = legal.reduce((a, b) => (exp[b]! > exp[a]! ? b : a));
      return { boardId: j.boardId, bestMove: best, bestExpected: exp[best]!, expectedAfter: exp, botPicks: {}, botThinkMs: {} };
    });
    core.message("p1", { t: "scores", key: req.key, boards });
    drop("p1", "scoreRequest");
    return true;
  };
  /** His turn: answered with his first legal move. */
  const hisTurn = () => {
    for (let i = 0; i < 12 && !last("p1", "bossRequest") && core.save().phase !== "play"; i++) advance(5_000);
    const req = last("p1", "bossRequest");
    if (!req) return;
    drop("p1", "bossRequest");
    core.message("p1", { t: "bossMove", key: req.key, move: legalMoves(req.fen)[0]! });
  };
  const crowdPlays = () => {
    for (let i = 0; i < 20 && core.save().phase !== "play"; i++) {
      if (runner()?.bossToMove()) hisTurn();
      else advance(2_000);
    }
    const r = last("p1", "round")!;
    const ok = r.boss?.powers?.allowed ?? legalMoves(r.board!.fen);
    const m = ok.find((x) => x === "b1c3" || x === "g1f3" || x === "b8c6" || x === "g8f6") ?? ok[0]!;
    for (const id of ["p1", "p2"]) core.message(id, { t: "pick", key: last(id, "round")!.key, move: m });
    expect(hostScores()).toBe(true);
  };
  advance(1000);
  advance(60_000);
  return { core, log, advance, runner, hisTurn, crowdPlays, last, drop, now: () => now };
}

/** A message's Dodge (the boss's, a round's or a reveal's view of it), or null. */
const dodgeIn = (m: Msg): ChandyDodge | null => ("boss" in m && m.boss && typeof m.boss === "object" && "powers" in m.boss ? (m.boss.powers?.chandy?.dodge ?? null) : null);

describe("Chandy online: Dodge's answers go out in their time", () => {
  it("from the message after the move that brings it: no safe square before its vote closes, no teleport before its time, every round; a reconnect gets no more", () => {
    const L = chandyLobby("dodge");
    // (The test switch: the rifle whole from the start, the warning as the second turn begins, Dodge as the third does.)
    L.crowdPlays();
    L.crowdPlays();
    const before = L.log.length;
    // His move after the second: Dodge is set up as it applies, and plays as the crowd's next turn begins.
    for (let i = 0; i < 20 && !L.runner().boss?.powers?.chandy?.dodge; i++) {
      if (L.runner().bossToMove()) L.hisTurn();
      else L.advance(500);
    }
    const full = L.runner().boss!.powers!.chandy!.dodge!;
    expect(full).toBeTruthy();
    expect(full.results).toEqual([]);
    // The message after his move (sent before Dodge begins): Dodge there, nothing of its answers.
    const after = L.log.slice(before).filter((x) => x.msg.t === "boss" && dodgeIn(x.msg));
    expect(after.length).toBeGreaterThan(0);
    const first = dodgeIn(after[0]!.msg)!;
    expect(first.rounds.length).toBe(full.rounds.length);
    for (const r of first.rounds) {
      expect(r.safe).toBe("");
      expect(r.teleports).toEqual([]);
    }
    // A device back now (a reload): what it's sent is what everyone had.
    const saved = L.core.save();
    for (const id of ["p1", "p2"]) {
      const d = dodgeIn(saved.last[id] as Msg);
      expect(d).toBeTruthy();
      for (const r of d!.rounds) {
        expect(r.safe).toBe("");
        expect(r.teleports).toEqual([]);
      }
    }
    // Through Dodge: everyone votes the safe square (the lobby's own state) once each round's vote is open.
    const tl = dodgeTimeline();
    let start: number | null = null;
    for (let i = 0; i < 400; i++) {
      const d = L.runner().boss!.powers!.chandy!.dodge!;
      const rec = (L.core as unknown as { record: { dodge?: { key: string; at: number; round: number } } }).record.dodge;
      if (rec) {
        start = rec.at;
        const k = d.results.length;
        if (k < d.rounds.length && L.now() - rec.at >= tl.rounds[k]!.voteAt) for (const id of ["p1", "p2"]) L.core.message(id, { t: "dodgeVote", key: rec.key, round: rec.round, square: d.rounds[k]!.safe });
      }
      if (d.results.length >= d.rounds.length && !rec) break;
      L.advance(100);
    }
    expect(start).not.toBeNull();
    const done = L.runner().boss!.powers!.chandy!.dodge!;
    expect(done.results.length).toBe(done.rounds.length);
    expect(done.results.every((r) => !r.hit)).toBe(true);
    // Every message from his move until Dodge was over: a round's safe square only once its vote had closed (its result in),
    // its teleports only those whose time had come.
    let checked = 0;
    for (const x of L.log.slice(before)) {
      const d = dodgeIn(x.msg);
      if (!d) continue;
      const elapsed = start !== null && x.at >= start ? x.at - start : -1;
      d.rounds.forEach((r, k) => {
        if (k < d.results.length) return;
        expect(r.safe).toBe("");
        expect(r.teleports.length).toBe(elapsed < 0 ? 0 : tl.rounds[k]!.teleports.filter((t) => elapsed >= t).length);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(5);
  });
});

describe("Chandy online: his first capture", () => {
  it("the host's move, then the lock moment while he still thinks (the board as it was), then the move shows: upgrade 1", () => {
    const L = chandyLobby("");
    L.crowdPlays();
    for (let i = 0; i < 20 && !L.last("p1", "bossRequest"); i++) L.advance(500);
    const req = L.last("p1", "bossRequest")!;
    expect(req).toBeTruthy();
    L.drop("p1", "bossRequest");
    // (The position set by hand as his move is asked: his knight on f6 can take your knight on d5, his first capture.)
    const r = L.runner();
    const id = r.state.boards[0]!;
    const board = r.boards.get(id)!;
    const fen = "4k3/8/5n2/3N4/8/8/8/R3K3 b - - 0 1";
    r.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== board.history.length), { ply: board.history.length, fen }] });
    const before = L.log.length;
    L.core.message("p1", { t: "bossMove", key: req.key, move: "f6d5" });
    // (Held: a thinking message with the lock on d5 and its moment, the board unchanged.)
    const held = L.log.slice(before).filter((x) => x.id === "p1" && x.msg.t === "boss").map((x) => x.msg as Extract<Msg, { t: "boss" }>);
    expect(held.length).toBe(1);
    expect(held[0]!.thinking).toBe(true);
    expect(held[0]!.boss.board.fen).toBe(fen);
    expect(held[0]!.boss.powers?.chandy?.locks.map((l) => l.square)).toEqual(["d5"]);
    expect(held[0]!.boss.powers?.events.filter((e) => e.kind === "lockOn")).toEqual([{ kind: "lockOn", turn: held[0]!.boss.powers!.turn, square: "d5", first: true }]);
    // (Not before the moment's end.)
    L.advance(CHANDY_FX.lockOn - 100);
    expect(r.boards.get(id)!.fen).toBe(fen);
    L.advance(200);
    expect(r.boards.get(id)!.fen).not.toBe(fen);
    const c = r.boss!.powers!.chandy!;
    expect([c.taught, c.upgrades]).toEqual([true, 1]);
    const shown = L.log.slice(before).filter((x) => x.id === "p1" && x.msg.t === "boss").map((x) => x.msg as Extract<Msg, { t: "boss" }>).at(-1)!;
    expect(shown.thinking).toBeFalsy();
    expect(shown.boss.powers?.events.some((e) => e.kind === "upgrade")).toBe(true);
  });
});
