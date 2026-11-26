import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type ChandyDodge, type Settings } from "@chessroyale/core";
import { CHANDY_FX, dodgeTimeline, legalMoves, powerMomentMs, sanLineToUci, type BoardScore, type MatchRunner, type Opening, type ServerMessage } from "@chessroyale/chess";
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

function chandyLobby(test: string, extra: Partial<Settings> = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  /** Every message each person got, with the server's time it went out. */
  const log: { id: string; at: number; msg: Msg }[] = [];
  const settings = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...RAID_SETTINGS, lastStandFrom: 999, bossId: "chandy", bossUnfinished: true, bossStumbleBelow: 0, bossPowerTest: test, ...extra } as Settings;
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
  /** The crowd plays `m` (everyone picks it), the host scoring it. */
  const crowdPlaysMove = (m: string) => {
    for (let i = 0; i < 20 && core.save().phase !== "play"; i++) advance(2_000);
    for (const id of ["p1", "p2"]) core.message(id, { t: "pick", key: last(id, "round")!.key, move: m });
    expect(hostScores()).toBe(true);
  };
  advance(1000);
  advance(60_000);
  return { core, log, advance, runner, hisTurn, crowdPlays, crowdPlaysMove, last, drop, now: () => now };
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
    // (His second capture teaches too, Eric, Nov 18: the hunt from then.)
    expect([c.marked, c.taught, c.upgrades]).toEqual([1, undefined, 1]);
    const shown = L.log.slice(before).filter((x) => x.id === "p1" && x.msg.t === "boss").map((x) => x.msg as Extract<Msg, { t: "boss" }>).at(-1)!;
    expect(shown.thinking).toBeFalsy();
    expect(shown.boss.powers?.events.some((e) => e.kind === "upgrade")).toBe(true);
  });
});

describe("Chandy online: the Lock-on Shot (the queen lock until Nov 24) and a taught capture's lock in one turn", () => {
  it("the shot as his turn begins, then the lock as his second capture is about to show; the hold covers both, then the move (the review of #797)", () => {
    const L = chandyLobby("");
    L.crowdPlays();
    L.hisTurn();
    for (let i = 0; i < 20 && L.core.save().phase !== "play"; i++) L.advance(2_000);
    // (Your turn, set by hand: his queen lock aimed at your queen on d1 behind your d2 pawn, after his first capture (upgrade 1, the
    // queen lock unlocked and fired); his knight on f6 can take your knight on g4, his second capture.)
    const r = L.runner();
    const id = r.state.boards[0]!;
    const board = r.boards.get(id)!;
    const fen = "4k3/pppp4/5n2/8/6N1/8/3P4/3QK2R w K - 0 1";
    r.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== board.history.length), { ply: board.history.length, fen }] });
    const boss = r.state.boss!;
    const c0 = boss.powers!.chandy!;
    r.state = { ...r.state, boss: { ...boss, powers: { ...boss.powers!, chandy: { ...c0, locks: [], marked: 1, upgrades: 1, unlocked: ["queenlock"], fresh: null, used: 1, last: "queenlock", fired: { queenlock: 1 }, meter: 0, due: null, aim: { square: "d1", turn: boss.crowdMoves + 1 } } } } };
    for (const pid of ["p1", "p2"]) L.core.message(pid, { t: "pick", key: L.last(pid, "round")!.key, move: "h1h2" });
    const hostScores = () => {
      const req = L.last("p1", "scoreRequest")!;
      L.core.message("p1", { t: "scores", key: req.key, boards: req.jobs.map((j) => ({ boardId: j.boardId, bestMove: "h1h2", bestExpected: 0.5, expectedAfter: Object.fromEntries((j.allowed ?? legalMoves(j.fen)).map((m) => [m, 0.5])), botPicks: {}, botThinkMs: {} })) });
      L.drop("p1", "scoreRequest");
    };
    hostScores();
    // (Your move's reveal, then his turn: asked of the host as it begins.)
    for (let i = 0; i < 300 && !L.last("p1", "bossRequest"); i++) L.advance(100);
    const req = L.last("p1", "bossRequest")!;
    expect(req).toBeTruthy();
    L.drop("p1", "bossRequest");
    // (The shot came as his turn began: your d2 pawn; his thinking holds for it.)
    expect(r.boss!.powers!.chandy!.shot).toMatchObject({ square: "d2", piece: "p" });
    const minAt = () => (L.core as unknown as { r: { bossMinAt?: number } }).r.bossMinAt ?? 0;
    const shotEnd = minAt();
    expect(shotEnd).toBeGreaterThanOrEqual(L.now() + powerMomentMs([{ kind: "queenShot" }]) - 100);
    // (The host answers at once: held to the shot's end, then the lock's moment from there, the board still as it was.)
    const before = r.boards.get(id)!.fen;
    L.core.message("p1", { t: "bossMove", key: req.key, move: "f6g4" });
    expect(r.boss!.powers!.events.some((e) => e.kind === "lockOn")).toBe(false);
    L.advance(shotEnd - L.now());
    const ev = r.boss!.powers!.events;
    const shot = ev.findIndex((e) => e.kind === "queenShot");
    const lock = ev.findIndex((e) => e.kind === "lockOn" && e.first);
    expect([shot >= 0, lock > shot, ev[lock]?.square, ev[lock]?.turn]).toEqual([true, true, "g4", ev[shot]?.turn]);
    expect(minAt()).toBeGreaterThanOrEqual(shotEnd + CHANDY_FX.lockOn);
    expect(r.boards.get(id)!.fen).toBe(before);
    L.advance(minAt() - L.now() - 100);
    expect(r.boards.get(id)!.fen).toBe(before);
    L.advance(200);
    expect(r.boards.get(id)!.fen).not.toBe(before);
    // (His second capture: upgrade 2, taught.)
    expect([r.boss!.powers!.chandy!.marked, r.boss!.powers!.chandy!.taught, r.boss!.powers!.chandy!.upgrades]).toEqual([2, true, 2]);
  });

  it("the Lock-on Shot's locked piece (Nov 24): its shatter as his turn begins is an upgrade online too, then his capture another; the lock gone with the shot", () => {
    const L = chandyLobby("");
    L.crowdPlays();
    L.hisTurn();
    for (let i = 0; i < 20 && L.core.save().phase !== "play"; i++) L.advance(2_000);
    // (As above, but aimed as the rules aim it: the d2 pawn in front of your queen locked too, the shot's victim.)
    const r = L.runner();
    const id = r.state.boards[0]!;
    const board = r.boards.get(id)!;
    const fen = "4k3/pppp4/5n2/8/6N1/8/3P4/3QK2R w K - 0 1";
    r.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== board.history.length), { ply: board.history.length, fen }] });
    const boss = r.state.boss!;
    const c0 = boss.powers!.chandy!;
    r.state = { ...r.state, boss: { ...boss, powers: { ...boss.powers!, chandy: { ...c0, locks: [{ square: "d2", piece: "p", at: 1, shot: true }], marked: 1, upgrades: 1, unlocked: ["queenlock"], fresh: null, used: 1, last: "queenlock", fired: { queenlock: 1 }, meter: 0, due: null, aim: { square: "d1", turn: boss.crowdMoves + 1, victim: "d2" } } } } };
    for (const pid of ["p1", "p2"]) L.core.message(pid, { t: "pick", key: L.last(pid, "round")!.key, move: "h1h2" });
    const req0 = L.last("p1", "scoreRequest")!;
    L.core.message("p1", { t: "scores", key: req0.key, boards: req0.jobs.map((j) => ({ boardId: j.boardId, bestMove: "h1h2", bestExpected: 0.5, expectedAfter: Object.fromEntries((j.allowed ?? legalMoves(j.fen)).map((m) => [m, 0.5])), botPicks: {}, botThinkMs: {} })) });
    L.drop("p1", "scoreRequest");
    for (let i = 0; i < 300 && !L.last("p1", "bossRequest"); i++) L.advance(100);
    const req = L.last("p1", "bossRequest")!;
    L.drop("p1", "bossRequest");
    const c1 = r.boss!.powers!.chandy!;
    expect([c1.shot?.square, c1.upgrades, c1.upgrade?.stage, c1.locks]).toEqual(["d2", 2, 2, []]);
    // (Not taught by it: his captures teach. His second capture then: upgrade 3.)
    expect(c1.marked).toBe(1);
    L.core.message("p1", { t: "bossMove", key: req.key, move: "f6g4" });
    for (let i = 0; i < 100 && r.boards.get(id)!.fen.includes("6N1"); i++) L.advance(200);
    expect([r.boss!.powers!.chandy!.marked, r.boss!.powers!.chandy!.taught, r.boss!.powers!.chandy!.upgrades]).toEqual([2, true, 3]);
  });
});

describe("Chandy online: Dodge from your mate (Eric, Nov 26)", () => {
  /** ?win=1's mate in one (Qxf7#), then Dodge timed by the server: each round's vote, `pick(k, safe)` from everyone once it's open. */
  function mateDodge(pick: (k: number, safe: string) => string) {
    const L = chandyLobby("", { bossWinTest: true });
    L.crowdPlaysMove("h5f7");
    const rec = () => (L.core as unknown as { record: { dodge?: { key: string; at: number; round: number } } }).record.dodge;
    // (Your mate held: the battle not decided, his Dodge set up from it.)
    for (let i = 0; i < 100 && !rec(); i++) L.advance(100);
    const full = L.runner().boss!.powers!.chandy!.dodge!;
    expect(full.mate).toBe(true);
    expect(L.runner().boss!.result).toBeUndefined();
    const tl = dodgeTimeline();
    const sentAt = L.log.filter((x) => x.msg.t === "boss" && "dodge" in x.msg && x.msg.dodge).at(0)!.at;
    // (Its start after his opening: the message carries it.)
    expect(rec()!.at - sentAt).toBe(tl.openingMs);
    // (A vote in the opening is no vote.)
    L.core.message("p1", { t: "dodgeVote", key: rec()!.key, round: 0, square: full.rounds[0]!.safe });
    expect(L.core.save().dodge?.votes ?? {}).toEqual({});
    let end = 0;
    let decided = 0;
    for (let i = 0; i < 800; i++) {
      const r = rec();
      const d = L.runner().boss!.powers!.chandy!.dodge!;
      if (L.runner().boss!.result && !decided) decided = L.now();
      if (!r) break;
      const k = d.results.length;
      if (k < d.rounds.length && L.now() - r.at >= tl.rounds[k]!.voteAt && L.now() - r.at < tl.rounds[k]!.voteEnd) for (const id of ["p1", "p2"]) L.core.message(id, { t: "dodgeVote", key: r.key, round: r.round, square: pick(k, d.rounds[k]!.safe) });
      end = r.at;
      L.advance(100);
    }
    if (L.runner().boss!.result && !decided) decided = L.now();
    return { L, end, decided, tl };
  }

  it("survived: the mate stands after the win beat, the battle the crowd's", () => {
    const { L, end, decided, tl } = mateDodge((_k, safe) => safe);
    const d = L.runner().boss!.powers!.chandy!.dodge!;
    expect(d.results.length).toBe(3);
    expect(d.results.every((r) => !r.hit)).toBe(true);
    expect(L.runner().boss!.result).toBe("crowd");
    // (Decided only after the win beat's end, not at the last round's.)
    expect(decided - end).toBeGreaterThanOrEqual(tl.win.end);
    expect(decided - end).toBeLessThan(tl.win.end + 1000);
  });

  it("the second hit: the battle is his", () => {
    const wrong = (safe: string) => ["d3", "e3", "f3", "d4", "e4", "f4", "d5", "e5", "f5"].find((sq) => sq !== safe)!;
    const { L } = mateDodge((k, safe) => (k < 2 ? wrong(safe) : safe));
    const d = L.runner().boss!.powers!.chandy!.dodge!;
    expect(d.results.filter((r) => r.hit).length).toBe(2);
    expect(L.runner().boss!.result).toBe("boss");
  });
});
