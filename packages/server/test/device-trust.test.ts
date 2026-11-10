/**
 * A device's word counts only when it's checked (docs/decisions/2026-11-10-device-trust.md). The outside review's two
 * proofs (many seats on one account; a host whose scores leave its own pick out) turned around, plus one check per fix.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, FRONT_DOOR, JUDGES, RAID_SETTINGS, SQUADS, SQUADS_LOBBY, modeSettings, mulberry32, voteResultMs, type Settings } from "@chessroyale/core";
import { legalMoves, type BoardScore, type ScoreJob, type ServerMessage } from "@chessroyale/chess";
import { SQUADS_PROTOCOL, squadsVotes } from "@chessroyale/chess/squads";
import { LobbyCore, OTHER_ACCOUNT, hostBoardOk, newLobbyRecord } from "../src/lobby.ts";
import { drawJudges, judgeWeight } from "../src/judges.ts";
import { SQUADS_OTHER_ACCOUNT, clearTopCache } from "../src/squads-lobby.ts";
import { fallbackTop } from "../src/squads-bots.ts";
import { library, setup } from "./lobby-fixture.ts";
import { squadsLobby } from "./squads-fixture.ts";

type Msg = ServerMessage;
const VOTES_MS = FRONT_DOOR.fillShowMs + SQUADS.firstVoteDelaySeconds * 1000 + squadsVotes().length * (SQUADS.voteSeconds * 1000 + voteResultMs(SQUADS));

/** A lobby on a fake clock with the full settings given (no test shortcuts but the board intro). */
function lobby(settings: Partial<Settings>) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const core = new LobbyCore(newLobbyRecord("ABCDE", now), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]) }, library, mulberry32(7), {
    ...DEFAULT_SETTINGS,
    boardIntroSeconds: 0,
    ...settings,
  });
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  return { core, last, advance, inbox };
}

describe("one seat per account (the review's many-seats proof, turned around)", () => {
  it("the same account connecting three times holds one seat: no extra votes, and never both judges", () => {
    const L = setup({ ...modeSettings("crowd", { augments: true }) });
    const a = L.core.connect(undefined, "Mallory", "computer", false, 1500, undefined, "user-1");
    const b = L.core.connect(undefined, "Mallory", "computer", false, 1500, undefined, "user-1");
    const c = L.core.connect(undefined, "Mallory", "computer", false, 1500, undefined, "user-1");
    const honest = L.core.connect(undefined, "Honest", "phone", false, 1500, undefined, "user-2");
    expect([a, b, c]).toEqual([{ ok: true, playerId: "p1" }, { ok: true, playerId: "p1" }, { ok: true, playerId: "p1" }]);
    expect(honest).toEqual({ ok: true, playerId: "p2" });
    expect(L.core.record.humans.map((h) => h.id)).toEqual(["p1", "p2"]);
    expect(L.core.record.accounts).toEqual({ p1: "user-1", p2: "user-2" });
    // Each tab is welcomed into that seat, with its token (a reconnect).
    const welcomes = (L.inbox.get("p1") ?? []).filter((m) => m.t === "welcome");
    expect(welcomes.length).toBe(3);
    // The claimed top speed counts only up to the cap.
    L.core.message("p1", { t: "speed", nps: 50_000_000 } as never);
    expect(L.core.record.judges!.devices.p1!.nps).toBe(JUDGES.maxNps);
  });

  it("a reconnect by token still works; another account's token is refused; the seat isn't taken twice", () => {
    const L = setup();
    L.core.connect(undefined, "Ann", "computer", false, 1500, undefined, "user-1");
    const token = L.last("p1", "welcome")!.token;
    L.core.disconnect("p1");
    expect(L.core.connect(token, "Ann", "computer", false, 1500, undefined, "user-1")).toEqual({ ok: true, playerId: "p1" });
    expect(L.core.connect(token, "Eve", "computer", false, 1500, undefined, "user-9")).toEqual({ ok: false, message: OTHER_ACCOUNT });
    expect(L.core.record.humans.length).toBe(1);
  });

  it("seats with no account (no sign-in at all) are still one per hello", () => {
    const L = setup();
    L.core.connect(undefined, "A", "computer");
    L.core.connect(undefined, "B", "computer");
    expect(L.core.record.humans.map((h) => h.id)).toEqual(["p1", "p2"]);
  });
});

describe("drawing judges", () => {
  it("never two seats of one owner, nor one beside an excluded seat's owner", () => {
    const devices = [
      { id: "p1", nps: 5_000_000, owner: "u1" },
      { id: "p2", nps: 5_000_000, owner: "u1" },
      { id: "p3", nps: 300_000, owner: "u3" },
    ];
    const rng = mulberry32(3);
    for (let i = 0; i < 300; i++) {
      const two = drawJudges(rng, devices, 2, JUDGES);
      expect(new Set(two.map((id) => devices.find((d) => d.id === id)!.owner)).size).toBe(two.length);
      expect(two).toContain("p3");
    }
    expect(drawJudges(rng, devices, 1, JUDGES, new Map(), new Set(["p1"]))).toEqual(["p3"]);
    // (No owner given: each seat is its own.)
    expect(drawJudges(rng, [{ id: "a", nps: 1 }, { id: "b", nps: 1 }], 2, JUDGES).sort()).toEqual(["a", "b"]);
  });

  it("a claimed speed buys little: at the cap, 2.25 times a fast computer's weight (was about 16 times at 50M with the cube)", () => {
    expect(JUDGES).toMatchObject({ speedWeight: 2, maxNps: 3_000_000 });
    expect(judgeWeight(JUDGES.maxNps, 0, JUDGES) / judgeWeight(2_000_000, 0, JUDGES)).toBeCloseTo(2.25, 6);
  });

  it("the second judge comes from the first's class when it can (computer with computer), else from anyone", () => {
    const devices = [
      { id: "c1", nps: 2_000_000, kind: "computer" as const },
      { id: "c2", nps: 2_000_000, kind: "computer" as const },
      { id: "p1", nps: 300_000, kind: "phone" as const },
      { id: "p2", nps: 300_000, kind: "phone" as const },
    ];
    const rng = mulberry32(5);
    const kind = (id: string) => devices.find((d) => d.id === id)!.kind;
    for (let i = 0; i < 200; i++) {
      const [a, b] = drawJudges(rng, devices, 2, JUDGES);
      expect(kind(a!)).toBe(kind(b!));
    }
    // One computer only: its partner is a phone (a pair beats one judge).
    const lone = [devices[0]!, devices[2]!];
    expect(drawJudges(rng, lone, 2, JUDGES).sort()).toEqual(["c1", "p1"]);
  });

  /**
   * The review's lobby (20 computers at 2M, 80 phones at 300k): the share of jobs given a computer and a phone (the
   * computer answers first, the phone is past the grace, so the computer's answer is used alone), before and after;
   * and a two-account attacker claiming the cap, both judges of one board (2026-11-10-judge-pairing.md).
   */
  it("judge pairs at the review's lobby: mixed pairs (one answer alone) and an attacker's both-judges chance", () => {
    const lobby = [
      ...Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, nps: 2_000_000, kind: "computer" as const })),
      ...Array.from({ length: 80 }, (_, i) => ({ id: `p${i}`, nps: 300_000, kind: "phone" as const })),
    ];
    const N = 20_000;
    const share = (devices: typeof lobby, cfg: { speedWeight: number }, hit: (pair: string[]) => boolean, classes = true) => {
      const rng = mulberry32(11);
      const pool = classes ? devices : devices.map(({ kind: _, ...d }) => d);
      let n = 0;
      for (let i = 0; i < N; i++) if (hit(drawJudges(rng, pool, 2, cfg))) n++;
      return n / N;
    };
    const mixed = (pair: string[]) => pair.filter((id) => id.startsWith("p")).length === 1;
    const before = share(lobby, { speedWeight: 1 }, mixed, false);
    const weightOnly = share(lobby, JUDGES, mixed, false);
    const after = share(lobby, JUDGES, mixed);
    // Two attacker accounts (computers claiming the cap) in place of two honest computers.
    const attacked = lobby.map((d) => (d.id === "c0" || d.id === "c1" ? { ...d, nps: JUDGES.maxNps } : d));
    const both = (pair: string[]) => pair.includes("c0") && pair.includes("c1");
    const attackBefore = share(attacked.map((d) => (d.id === "c0" || d.id === "c1" ? { ...d, nps: 5_000_000 } : d)), { speedWeight: 1 }, both, false);
    const attackAfter = share(attacked, JUDGES, both);
    console.log("judge pairs", JSON.stringify({ before, weightOnly, after, attackBefore, attackAfter }));
    expect(before).toBeGreaterThan(0.4);
    expect(after).toBe(0);
    expect(attackAfter).toBeLessThan(0.03);
  });
});

describe("the host's scores are checked as a judge's are (the review's lying-host proof, turned around)", () => {
  const job: ScoreJob = { boardId: 0, fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", humanPicks: { p1: "e2e4", p2: "d2d4" }, bots: [{ id: "b1", skill: 1, powerUps: 0 }] };
  const good: BoardScore = { boardId: 0, bestMove: "e2e4", bestExpected: 0.55, expectedAfter: { e2e4: 0.55, d2d4: 0.54, g1f3: 0.53 }, botPicks: { b1: "g1f3" }, botThinkMs: {} };

  it("holds together: legal moves, chances from 0 to 1, every pick and bot scored", () => {
    expect(hostBoardOk(job, good)).toBe(true);
    expect(hostBoardOk(job, { ...good, expectedAfter: { d2d4: 0.54, g1f3: 0.53 } })).toBe(false); // its own pick left out
    expect(hostBoardOk(job, { ...good, expectedAfter: { ...good.expectedAfter, a2a4: "x" as never } })).toBe(false);
    expect(hostBoardOk(job, { ...good, expectedAfter: { ...good.expectedAfter, a2a4: 7 } })).toBe(false);
    expect(hostBoardOk(job, { ...good, bestExpected: Number.NaN })).toBe(false);
    expect(hostBoardOk(job, { ...good, bestMove: "e2e5" })).toBe(false);
    expect(hostBoardOk(job, { ...good, botPicks: {} })).toBe(false);
    expect(hostBoardOk(job, { ...good, botPicks: { b1: "a2a4" } })).toBe(false); // a bot's pick unscored
    expect(hostBoardOk(job, { ...good, expectedAfter: null as never })).toBe(false);
    expect(hostBoardOk(job, "junk")).toBe(false);
  });

  it("a host that leaves its own pick out (and scores the rest low) gains nothing: that board's picks all count the same", () => {
    const L = lobby({ roundsPerStage: 1, firstStageRounds: 1 });
    L.core.connect(undefined, "Cheat", "computer", false, 1500);
    L.core.connect(undefined, "Friend", "phone", false, 1500);
    L.core.message("p1", { t: "start" });
    L.advance(6000);
    for (const id of ["p1", "p2"]) {
      const r = L.last(id, "round")!;
      L.core.message(id, { t: "pick", key: r.key, move: legalMoves(r.board!.fen)[0]! });
    }
    const req = L.last("p1", "scoreRequest")!;
    const boards: BoardScore[] = req.jobs.map((j) => {
      const mine = j.humanPicks.p1;
      const legal = legalMoves(j.fen);
      // Everything scored low but its own pick, which it leaves out (it used to "count as the best"); one junk value.
      const expectedAfter = Object.fromEntries(legal.filter((m) => m !== mine).map((m) => [m, 0.1]));
      return { boardId: j.boardId, bestMove: mine ?? legal[0]!, bestExpected: 0.99, expectedAfter: { ...expectedAfter, ...(mine ? ({ a1a1: "x" } as unknown as Record<string, number>) : {}) }, botPicks: Object.fromEntries(j.bots.map((b) => [b.id, legal.find((m) => m !== mine)!])), botThinkMs: {} };
    });
    L.core.message("p1", { t: "scores", key: req.key, boards });
    const rv = L.last("p1", "reveal")!;
    expect(rv.picks.length).toBeGreaterThan(1);
    expect(rv.picks.every((p) => Number.isFinite(p.roundScore))).toBe(true);
    const losses = new Set(rv.picks.map((p) => p.loss));
    expect(losses.size).toBe(1);
    const mine = rv.picks.find((p) => p.playerId === "p1")!;
    expect(rv.picks.every((p) => p.roundScore === mine.roundScore)).toBe(true);
  });
});

describe("message fields", () => {
  it("botPlan: only this round's picking bots, each with a move allowed on the board", () => {
    const L = setup({ ...modeSettings("crowd", { augments: true }) });
    L.core.connect(undefined, "Host", "computer");
    L.core.message("p1", { t: "start" });
    for (let i = 0; i < 40 && L.core.record.phase !== "play"; i++) L.advance(1000);
    expect(L.core.record.phase).toBe("play");
    const round = L.core.record.round!;
    const bots = L.core.record.bots.map((b) => b.id);
    const fen = L.last("p1", "round")!.board!.fen;
    const ok = legalMoves(fen)[0]!;
    L.core.message("p1", { t: "botPlan", key: round.key, picks: { [bots[0]!]: ok, [bots[1]!]: "zz9", p1: ok, nobody: ok, [bots[2]!]: 7 as never }, powerUps: [bots[0]!, "nobody", 3 as never] });
    expect(L.core.record.round!.botPlan).toMatchObject({ picks: { [bots[0]!]: ok }, powerUps: [bots[0]!] });
  });

  it("crossCheck: counted, but the log takes only the first few, cut short", () => {
    const L = setup();
    L.core.connect(undefined, "A", "computer");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    for (let i = 0; i < 100; i++) L.core.message("p1", { t: "crossCheck", key: "k", boardId: 0, ok: false, detail: "x".repeat(10_000) } as never);
    const lines = log.mock.calls.map((c) => String(c[0])).filter((s) => s.startsWith("cross-check"));
    log.mockRestore();
    expect(L.core.record.mismatches).toBe(100);
    expect(lines.length).toBe(20);
    expect(Math.max(...lines.map((s) => s.length))).toBeLessThan(400);
  });

  it("bossMove: a move that isn't a string is ignored (the boss's turn still waits for one)", () => {
    const L = lobby({ ...RAID_SETTINGS, raidOpening: true });
    L.core.connect(undefined, "Host", "computer", false, 1500);
    L.core.connect(undefined, "Other", "phone", false, 1500);
    L.core.message("p1", { t: "start" });
    for (let i = 0; i < 200 && L.core.record.phase !== "boss"; i++) {
      if (L.core.record.phase === "play") {
        for (const id of ["p1", "p2"]) {
          const r = L.last(id, "round");
          if (r?.board && !L.core.record.round?.picks[id]) L.core.message(id, { t: "pick", key: r.key, move: (r.boss?.powers?.allowed ?? legalMoves(r.board.fen))[0]! });
        }
      }
      L.advance(2000);
    }
    expect(L.core.record.phase).toBe("boss");
    const key = L.core.record.bossKey!;
    const sent = L.inbox.get("p2")!.length;
    for (const move of [42, {}, null, ["e7e5"], "x".repeat(500)]) L.core.message("p1", { t: "bossMove", key, move } as never);
    // (Nothing reached his turn: nobody was told anything.)
    expect(L.inbox.get("p2")!.length).toBe(sent);
    expect(L.core.record.phase).toBe("boss");
    expect(L.core.record.bossKey).toBe(key);
  });
});

describe("Squads: seats and the shared answers", () => {
  beforeEach(() => clearTopCache());
  afterEach(() => clearTopCache());

  it("one account, 32 connects: one seat; its token from another account is refused", () => {
    const L = squadsLobby();
    const ids = Array.from({ length: 32 }, () => L.core.connect(undefined, { name: "Ghost", v: SQUADS_PROTOCOL, userId: "u-1" }));
    expect(new Set(ids.map((r) => (r.ok ? r.playerId : r.message)))).toEqual(new Set(["p1"]));
    expect(L.core.record.humans.length).toBe(1);
    const token = L.core.record.humans[0]!.token;
    expect(L.core.connect(token, { name: "Buyer", v: SQUADS_PROTOCOL, userId: "u-2" })).toEqual({ ok: false, message: SQUADS_OTHER_ACCOUNT });
    expect(L.core.record.accounts).toEqual({ p1: "u-1" });
    expect(L.core.connect(token, { name: "Ghost", v: SQUADS_PROTOCOL, userId: "u-1" })).toEqual({ ok: true, playerId: "p1" });
  });

  /** A test lobby on its first turn with two computers (solo seats: two parties) that take bot work. */
  function firstTurn(opts: { server?: boolean } = {}) {
    const L = squadsLobby({ test: { start: 0 }, fillInMs: 5_000, serverEngine: !!opts.server });
    const ids = [L.join("D0", { device: "computer" }), L.join("D1", { device: "computer" })];
    ids.forEach((id) => L.core.message(id, { t: "speed", nps: 1_000_000 }));
    L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
    const lead = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).find((j) => j.devices.length === 2 && !j.how)!;
    return { L, ids, lead };
  }

  it("an answer two devices agreed on is used for its job, never handed to another lobby; the engine server's is", () => {
    const A = firstTurn();
    expect(A.lead).toBeDefined();
    const top = fallbackTop(A.lead.fen, SQUADS.bots.candidates);
    for (const id of A.ids) A.L.core.message(id, { t: "botTop", id: A.lead.id, top });
    expect(A.lead).toMatchObject({ how: "agreed", top });
    // A fresh lobby, the same position: it asks its own devices (the planted answer isn't there).
    const B = firstTurn();
    const same = B.L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).filter((j) => j.fen === A.lead.fen);
    expect(same.length).toBeGreaterThan(0);
    expect(same.some((j) => j.how === "cached")).toBe(false);
    // The engine server's verdict (two devices disagreed): that one is shared.
    const C = firstTurn({ server: true });
    const bad = [...top].reverse().map((m, i) => ({ ...m, expected: i === 0 ? 0.99 : m.expected }));
    C.L.core.message(C.ids[0]!, { t: "botTop", id: C.lead.id, top });
    C.L.core.message(C.ids[1]!, { t: "botTop", id: C.lead.id, top: bad });
    const req = C.L.server.find((r) => r.id === C.lead.id)!;
    C.L.core.serverAnswered(C.lead.id, top.filter((m) => req.moves.includes(m.move)));
    expect(C.lead.how).toBe("server");
    const D = firstTurn();
    const cached = D.L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).filter((j) => j.fen === C.lead.fen);
    expect(cached.some((j) => j.how === "cached")).toBe(true);
  });

  it("two devices of one party are never both asked for one job", () => {
    const L = squadsLobby({ test: { start: 0 }, fillInMs: 5_000 });
    expect(L.core.reserve([{ size: 2, pass: "PASS" }], 60_000)).toEqual([0]);
    const party = [L.join("M0", { party: "PASS", device: "computer" }), L.join("M1", { party: "PASS", device: "computer" })];
    const solo = L.join("S0", { device: "phone" });
    for (const id of [...party, solo]) L.core.message(id, { t: "speed", nps: 1_000_000 });
    L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
    const jobs = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).filter((j) => j.devices.length);
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) expect(j.devices.filter((d) => party.includes(d)).length).toBeLessThanOrEqual(1);
  });
});
