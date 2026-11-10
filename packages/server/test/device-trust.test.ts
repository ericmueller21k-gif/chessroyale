/**
 * A device's word counts only when it's checked (docs/decisions/2026-11-10-device-trust.md). The outside review's two
 * proofs (many seats on one account; a host whose scores leave its own pick out) turned around, plus one check per fix.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, FRONT_DOOR, JUDGES, RAID_SETTINGS, SQUADS, SQUADS_LOBBY, modeSettings, mulberry32, voteResultMs, type Settings } from "@chessroyale/core";
import { legalMoves, type BoardScore, type ScoreJob, type ServerMessage } from "@chessroyale/chess";
import { SQUADS_PROTOCOL, squadsLegalMoves, squadsVotes } from "@chessroyale/chess/squads";
import { LobbyCore, OTHER_ACCOUNT, atTheDoor, hostBoardOk, newLobbyRecord } from "../src/lobby.ts";
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

  it("the second judge comes from the first's class while it has 3 other owners left, else from anyone", () => {
    const comp = (id: string) => ({ id, nps: 2_000_000, kind: "computer" as const });
    const phone = (id: string) => ({ id, nps: 300_000, kind: "phone" as const });
    const devices = [comp("c1"), comp("c2"), comp("c3"), comp("c4"), phone("p1"), phone("p2"), phone("p3"), phone("p4")];
    const rng = mulberry32(5);
    const kind = (id: string) => devices.find((d) => d.id === id)!.kind;
    for (let i = 0; i < 200; i++) {
      const [a, b] = drawJudges(rng, devices, 2, JUDGES);
      expect(kind(a!)).toBe(kind(b!));
    }
    // A class with fewer than 3 others: the second from everyone (here mostly a phone; a claimed class can't pick it).
    const few = [comp("c1"), comp("c2"), phone("p1"), phone("p2"), phone("p3"), phone("p4")];
    let mixed = 0;
    for (let i = 0; i < 2000; i++) {
      const pair = drawJudges(rng, few, 2, JUDGES);
      if (pair.includes("c1") && pair.some((id) => id.startsWith("p"))) mixed++;
    }
    expect(mixed).toBeGreaterThan(0);
    // One computer only: its partner is a phone (a pair beats one judge).
    expect(drawJudges(rng, [comp("c1"), phone("p1")], 2, JUDGES).sort()).toEqual(["c1", "p1"]);
    // A refill beside a remaining judge (`kind`): from that class under the same threshold.
    for (let i = 0; i < 200; i++) expect(kind(drawJudges(rng, devices, 1, JUDGES, new Map(), new Set(["p1"]), "phone")[0]!)).toBe("phone");
    for (let i = 0; i < 200; i++) expect(kind(drawJudges(rng, devices, 1, JUDGES, new Map(), new Set(["c1"]), "computer")[0]!)).toBe("computer");
    const refills = new Set(Array.from({ length: 400 }, () => drawJudges(rng, few, 1, JUDGES, new Map(), new Set(["c1"]), "computer")[0]));
    expect([...refills].some((id) => id!.startsWith("p"))).toBe(true);
  });

  it("a claimed speed counts at most medianCap times the lobby's median (3 times a phone in a lobby of phones)", () => {
    const lobby = [...Array.from({ length: 98 }, (_, i) => ({ id: `p${i}`, nps: 300_000 })), { id: "a", nps: 3_000_000 }];
    const rng = mulberry32(2);
    let a = 0;
    const N = 20_000;
    for (let i = 0; i < N; i++) if (drawJudges(rng, lobby, 1, JUDGES)[0] === "a") a++;
    // Weight (3 x 300k)^2 = 9 phones' (not 100), so about 9 / 107.
    expect(a / N).toBeCloseTo(9 / 107, 2);
  });

  /**
   * Two attacker accounts claiming "computer" at 3M, in the review's lobby and in lobbies of phones (the delta review's
   * table), and the review's lobby's mixed pairs (a computer and a phone: the computer's answer used alone). Each row,
   * 20,000 draws; the worst case is in 2026-11-10-judge-pairing.md.
   */
  it("judge pairs: an attacker's both-judges chance stays at or below about 5% in every lobby, and real computers pair together", () => {
    const N = 20_000;
    const many = (n: number, kind: "computer" | "phone", nps: number, tag: string) =>
      Array.from({ length: n }, (_, i) => ({ id: `${tag}${i}`, nps, kind }));
    const atk = (nps: number, kind: "computer" | "phone" = "computer") => ["A1", "A2"].map((id) => ({ id, nps, kind }));
    const share = (devices: { id: string; nps: number; kind?: "computer" | "phone" }[], hit: (pair: string[]) => boolean, cfg: Parameters<typeof drawJudges>[3] = JUDGES) => {
      const rng = mulberry32(11);
      let n = 0;
      for (let i = 0; i < N; i++) if (hit(drawJudges(rng, devices, 2, cfg))) n++;
      return n / N;
    };
    const both = (pair: string[]) => pair.includes("A1") && pair.includes("A2");
    const review = [...many(20, "computer", 2_000_000, "c"), ...many(78, "phone", 300_000, "p")];
    const rows: Record<string, number> = {
      review: share([...review, ...atk(3_000_000)], both),
      phones98: share([...many(98, "phone", 300_000, "p"), ...atk(3_000_000)], both),
      phones98NoSpeedLie: share([...many(98, "phone", 300_000, "p"), ...atk(300_000)], both),
      computers3Phones95: share([...many(3, "computer", 2_000_000, "c"), ...many(95, "phone", 300_000, "p"), ...atk(3_000_000)], both),
      phones62: share([...many(62, "phone", 300_000, "p"), ...atk(3_000_000)], both),
      computers98AtkPhone: share([...many(98, "computer", 2_000_000, "c"), ...atk(3_000_000, "phone")], both),
    };
    const mixed = (pair: string[]) => pair.filter((id) => id.startsWith("p")).length === 1;
    const reviewMixed = share(review, mixed);
    const reviewMixedLinear = share(review.map(({ kind: _, ...d }) => d), mixed, { speedWeight: 1 });
    const reviewComputerFirst = share(review, (pair) => pair[0]!.startsWith("c"));
    console.log("judge pairs", JSON.stringify({ rows, reviewMixed, reviewMixedLinear, reviewComputerFirst }));
    for (const [row, v] of Object.entries(rows)) expect(v, row).toBeLessThanOrEqual(0.05);
    expect(rows.phones98NoSpeedLie).toBeLessThan(0.005);
    expect(reviewMixedLinear).toBeGreaterThan(0.4);
    expect(reviewMixed).toBeLessThan(0.01);
    expect(reviewComputerFirst).toBeGreaterThan(0.6);
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

  it("an answer two devices agreed on is used for its job, never handed to another lobby", () => {
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
  });

  it("the review's junk-verdict proof, turned around: two parties that disagree on purpose get a verdict for their job only, never shared", () => {
    const C = firstTurn({ server: true });
    const real = fallbackTop(C.lead.fen, SQUADS.bots.candidates).map((m) => m.move);
    const junk = squadsLegalMoves(C.lead.fen).filter((m) => !real.includes(m));
    const a = junk.slice(0, 4).map((move, i) => ({ move, expected: 0.6 - i * 0.01 }));
    const b = junk.slice(4, 8).map((move, i) => ({ move, expected: 0.55 - i * 0.01 }));
    C.L.core.message(C.ids[0]!, { t: "botTop", id: C.lead.id, top: a });
    C.L.core.message(C.ids[1]!, { t: "botTop", id: C.lead.id, top: b });
    const req = C.L.server.find((r) => r.id === C.lead.id)!;
    // The server only scores the devices' moves (the ROADMAP's next step: its own top moves) ...
    expect(req.moves.some((m) => real.includes(m))).toBe(false);
    C.L.core.serverAnswered(C.lead.id, req.moves.map((move, i) => ({ move, expected: 0.3 - i * 0.01 })));
    expect(C.lead.how).toBe("server");
    // ... so its verdict settles this job and goes no further: another lobby asks its own devices.
    const D = firstTurn();
    const same = D.L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).filter((j) => j.fen === C.lead.fen);
    expect(same.length).toBeGreaterThan(0);
    expect(same.some((j) => j.how === "cached")).toBe(false);
  });

  it("a party alone (no outside device): a second party device checks each job; agreement is one answer, disagreement goes to the server", () => {
    const partyAlone = () => {
      const L = squadsLobby({ test: { start: 0 }, fillInMs: 5_000, serverEngine: true });
      L.core.reserve([{ size: 4, pass: "PASS" }], 60_000);
      const party = [0, 1, 2, 3].map((i) => L.join(`M${i}`, { party: "PASS", device: "computer" }));
      for (const id of party) L.core.message(id, { t: "speed", nps: 1_000_000 });
      L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
      const jobs = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).filter((j) => j.devices.length && !j.how);
      expect(jobs.length).toBeGreaterThan(0);
      // (Before: one device per job, alone. The review's party-of-four proof.)
      expect(jobs.every((j) => j.devices.length === 2)).toBe(true);
      return { L, job: jobs[0]! };
    };
    const A = partyAlone();
    const top = fallbackTop(A.job.fen, SQUADS.bots.candidates);
    for (const d of A.job.devices) A.L.core.message(d, { t: "botTop", id: A.job.id, top });
    expect(A.job.how).toBe("one");
    const B = partyAlone();
    B.L.core.message(B.job.devices[0]!, { t: "botTop", id: B.job.id, top });
    B.L.core.message(B.job.devices[1]!, { t: "botTop", id: B.job.id, top: [...top].reverse().map((m, i) => ({ ...m, expected: i === 0 ? 0.99 : m.expected })) });
    expect(B.job.how).toBeUndefined();
    expect(B.L.server.some((r) => r.id === B.job.id)).toBe(true);
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

describe("the lobby's door (the review's minor 5)", () => {
  it("lets in an object with a type; the host's scores only as a list of at most 64 board objects", () => {
    expect(atTheDoor({ t: "pick", key: "k", move: "e2e4" })).toBe(true);
    expect(atTheDoor(null)).toBe(false);
    expect(atTheDoor("scores")).toBe(false);
    expect(atTheDoor({ t: 3 })).toBe(false);
    expect(atTheDoor({ t: "scores", key: "k", boards: [{ boardId: 0 }] })).toBe(true);
    expect(atTheDoor({ t: "scores", key: "k", boards: [null] })).toBe(false);
    expect(atTheDoor({ t: "scores", key: "k", boards: [{ boardId: 0 }, 7] })).toBe(false);
    expect(atTheDoor({ t: "scores", key: "k", boards: [[]] })).toBe(false);
    expect(atTheDoor({ t: "scores", key: "k", boards: {} })).toBe(false);
    expect(atTheDoor({ t: "scores", key: "k", boards: Array.from({ length: 65 }, () => ({})) })).toBe(false);
  });
});
