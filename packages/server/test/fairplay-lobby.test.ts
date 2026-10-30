import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, FAIRPLAY, RAID_SETTINGS, modeSettings, mulberry32 } from "@chessroyale/core";
import { applyMove, legalMoves, sanLineToUci, type BoardScore, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

const library: Opening[] = [{ id: "o", eco: "", name: "Start", family: "Start", unusual: false, moves: [], namedPlies: 0, expected: { 0: 0.5 } }];

/** A Crowd 50 v 50 lobby (no votes) on a fake clock, whose host scores with a fixed table. */
function lobby(seed: number) {
  let now = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  const core = new LobbyCore(
    newLobbyRecord("ABCDE", now),
    { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as ServerMessage]) },
    library,
    mulberry32(seed),
    { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { augments: false }), powerUpsAtStart: 1 },
  );
  const last = <T extends ServerMessage["t"]>(id: string, t: T) =>
    [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<ServerMessage, { t: T }> | undefined;
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  /** The host's scores: `best` best (the bots all pick it), `close` a fifth of a point behind, everything else 15 behind. */
  const hostScores = (hostId: string, best = "e2e4", close = "d2d4") => {
    const req = last(hostId, "scoreRequest")!;
    const boards: BoardScore[] = req.jobs.map((j) => {
      const exp = Object.fromEntries(legalMoves(j.fen).map((m) => [m, m === best ? 0.55 : m === close ? 0.548 : 0.4]));
      return { boardId: j.boardId, bestMove: best, bestExpected: 0.55, expectedAfter: exp, botPicks: Object.fromEntries(j.bots.map((b) => [b.id, best])), botThinkMs: {} };
    });
    core.message(hostId, { t: "scores", key: req.key, boards });
  };
  return { core, last, advance, hostScores, get now() { return now; } };
}

/**
 * `n` people join that lobby (the last of them in practice mode, if `practice`) and the match starts. Teams are drawn
 * as it starts, so its seed is the first that gives the teams a test needs (`want`, given the people on White).
 */
function crowd(n: number, want: (white: string[]) => boolean, practice = false) {
  for (let seed = 1; seed < 1000; seed++) {
    const L = lobby(seed);
    for (let i = 1; i <= n; i++) L.core.connect(undefined, `P${i}`, "computer", practice && i === n);
    L.core.message("p1", { t: "start" });
    L.advance(2000);
    const white = L.core.save().runner!.state.players.filter((p) => !p.isBot && p.colour === "w").map((p) => p.id);
    if (want(white)) return Object.assign(L, { white });
  }
  throw new Error("no lobby seed gives those teams");
}

describe("fair play in the lobby", () => {
  it("records each person's pick with its loss, the crowd's find rate, complexity, think time and look-aways", () => {
    // White moves first: p1, p2, p9 and p10 (practicing) are there, with some of p3-p8 (k); the rest watch, on Black.
    const L = crowd(10, (w) => ["p1", "p2", "p9", "p10"].every((id) => w.includes(id)) && w.some((id) => /^p[3-8]$/.test(id)), true);
    const g1f3 = ["p3", "p4", "p5", "p6", "p7", "p8"];
    const k = g1f3.filter((id) => L.white.includes(id)).length;
    const r = L.last("p1", "round")!;
    expect(r.board!.fen.startsWith("rnbqkbnr/pppppppp")).toBe(true);
    L.advance(r.startsAt - L.now);
    L.core.message("p9", { t: "powerUp", key: r.key });
    L.advance(4000);
    L.core.message("p1", { t: "pick", key: r.key, move: "e2e4", away: 2 });
    L.core.message("p2", { t: "pick", key: r.key, move: "d2d4" });
    for (let i = 3; i <= 8; i++) L.core.message(`p${i}`, { t: "pick", key: r.key, move: "g1f3" });
    L.core.message("p9", { t: "pick", key: r.key, move: "e2e4" });
    L.core.message("p10", { t: "pick", key: r.key, move: "e2e4" });
    L.hostScores(L.core.record.hostId!);
    expect(L.core.record.phase).toBe("reveal");
    const [m] = L.core.fairMoves("p1");
    expect(m).toMatchObject({
      ply: 0,
      move: "e2e4",
      best: "e2e4",
      loss: 0,
      bestExp: 0.55,
      // e4 and d4 are within 2 points of the best; the second best is a fifth of a point behind.
      near: 2,
      gap: 0.2,
      // The crowd: the other people picking (p2 and White's k of p3-p8), not the practice player (hints) and not the
      // one who used a power-up.
      crowd: 1 + k,
      crowdFound: 1,
      thinkMs: 4000,
      away: 2,
      legal: 20,
    });
    expect(m!.fen).toBe(r.board!.fen);
    expect(m!.powerUp).toBeUndefined();
    expect(L.core.fairMoves(g1f3.find((id) => L.white.includes(id))!)[0]).toMatchObject({ loss: 15, crowd: 1 + k, crowdFound: 2, away: 0 });
    expect(L.core.fairMoves("p9")[0]).toMatchObject({ powerUp: true, crowd: 2 + k });
    // The watching team's picks aren't taken.
    for (const id of g1f3.filter((x) => !L.white.includes(x))) expect(L.core.fairMoves(id)).toEqual([]);
    // A practice player (unlimited hints) isn't recorded. Bots never are.
    expect(L.core.fairMoves("p10")).toEqual([]);
    expect(Object.keys(L.core.record.fair!).every((id) => /^p\d+$/.test(id))).toBe(true);
    expect(L.core.record.fairV).toBe(1);
  });

  it("marks a best move that takes on the square the last move landed on (a recapture), and counts plies", () => {
    // p1 on White, p2 on Black: each sends a pick every move, and only the team to move's is taken.
    const L = crowd(2, (w) => w.length === 1 && w[0] === "p1");
    let key = "";
    const play = (move: string, best: string) => {
      for (let i = 0; i < 60 && L.last("p1", "round")?.key === key; i++) L.advance(1000);
      const r = L.last("p1", "round")!;
      key = r.key;
      L.advance(Math.max(0, r.startsAt - L.now) + 500);
      for (const id of ["p1", "p2"]) L.core.message(id, { t: "pick", key: r.key, move });
      L.hostScores(L.core.record.hostId!, best, "a2a3");
    };
    play("e2e4", "e2e4");
    play("d7d5", "d7d5");
    play("e4d5", "e4d5");
    expect(L.core.fairMoves("p1").map((m) => [m.ply, m.best, !!m.recapture])).toEqual([
      [0, "e2e4", false],
      [2, "e4d5", true],
    ]);
    expect(L.core.fairMoves("p2").map((m) => [m.ply, m.best, !!m.recapture])).toEqual([[1, "d7d5", false]]);
    expect(L.core.record.fairV).toBe(3);
  });
});

/**
 * Premoves and fair play (docs/decisions/2026-10-28-arrows-and-premoves.md): a pick is marked a premove (its time left out
 * of timing) only if the server had that move before any browser could know the position it's played in, and the pick
 * says so and comes at once. Every other pick is timed as any pick, as before premoves.
 */
describe("premoves in the lobby (fair play's timing)", () => {
  it("Crowd 50 v 50: told after your own pick, before the other team's turn opened: marked; told while they choose or during their reveal, late, another move, never told: timed", () => {
    // p1 on White, p2 on Black.
    const L = crowd(2, (w) => w.length === 1 && w[0] === "p1");
    let key = "";
    const round = () => {
      for (let i = 0; i < 60 && L.last("p1", "round")?.key === key; i++) L.advance(1000);
      const r = L.last("p1", "round")!;
      key = r.key;
      L.advance(Math.max(0, r.startsAt - L.now));
      return r;
    };
    const pick = (id: string, k: string, move: string, after = 300, premove = true) => {
      L.advance(after);
      L.core.message(id, { t: "pick", key: k, move, ...(premove ? { premove: true as const } : {}) });
    };
    const premoved = () => L.core.record.round!.premoved;

    // 1. White: p1 can't tell a premove while its own pick is open (it has seen the position). p2 tells one while White
    // chooses (their picks show live to Black), then another during White's reveal: neither counts.
    let r = round();
    L.core.message("p1", { t: "premove", move: "g1f3" });
    expect(L.core.record.premoves).toBeUndefined();
    L.core.message("p2", { t: "premove", move: "d7d6" });
    pick("p1", r.key, "e2e4", 3000, false);
    // p1 has picked: now it may tell one for its next turn (a computer's queue: the next premove after the one played).
    L.core.message("p1", { t: "premove", move: "g1f3" });
    L.hostScores(L.core.record.hostId!, "e2e4", "a2a3");
    expect(L.core.record.phase).toBe("reveal");
    L.core.message("p2", { t: "premove", move: "d7d5" });

    // 1... Black: p2's premove was told after White's turn opened: not taken. Played at once and flagged: timed.
    r = round();
    expect(premoved()).toBeUndefined();
    pick("p2", r.key, "d7d5");
    expect(L.core.record.round!.picks.p2).toEqual({ move: "d7d5", thinkMs: 300 });
    // (p2's next: told after its own pick, before White's turn opens.)
    L.core.message("p2", { t: "premove", move: "b8c6" });
    L.hostScores(L.core.record.hostId!, "d7d5", "a7a6");

    // 2. White: p1's, told before Black's turn opened, played at once: marked.
    r = round();
    expect(premoved()).toEqual({ p1: "g1f3" });
    pick("p1", r.key, "g1f3");
    expect(L.core.record.round!.picks.p1).toEqual({ move: "g1f3", thinkMs: 300, premove: true });
    L.core.message("p1", { t: "premove", move: "f1c4" });
    L.hostScores(L.core.record.hostId!, "g1f3", "a2a3");

    // 2... Black: p2's counts as told in time, but comes too late to be one.
    r = round();
    expect(premoved()).toEqual({ p2: "b8c6" });
    pick("p2", r.key, "b8c6", FAIRPLAY.signals.premoveMs + 1);
    expect(L.core.record.round!.picks.p2!.premove).toBeUndefined();
    L.hostScores(L.core.record.hostId!, "b8c6", "a7a6");

    // 3. White: another move than the one told.
    r = round();
    expect(premoved()).toEqual({ p1: "f1c4" });
    pick("p1", r.key, "d2d4");
    expect(L.core.record.round!.picks.p1!.premove).toBeUndefined();
    L.hostScores(L.core.record.hostId!, "d2d4", "a2a3");

    // 3... Black: a flag on a move never told.
    r = round();
    expect(premoved()).toBeUndefined();
    pick("p2", r.key, "g8f6");
    expect(L.core.record.round!.picks.p2!.premove).toBeUndefined();
    // (A premove withdrawn, null: nothing kept. Junk: ignored.)
    L.core.message("p1", { t: "premove", move: "e1g1" });
    L.core.message("p1", { t: "premove", move: null });
    L.core.message("p1", { t: "premove", move: "castle!" as string });
    expect(L.core.record.premoves).toBeUndefined();
    L.hostScores(L.core.record.hostId!, "g8f6", "a7a6");

    // Fair play: the one premove is marked, and it's judged as any pick.
    expect(L.core.fairMoves("p1").map((m) => [m.move, !!m.premove])).toEqual([
      ["e2e4", false],
      ["g1f3", true],
      ["d2d4", false],
    ]);
    expect(L.core.fairMoves("p2").every((m) => !m.premove)).toBe(true);
  });

  it("a raid: told during the crowd's reveal, played at once: marked; told after the host was asked for the boss's move, or while his move shows: timed", () => {
    const L = raidLobby();
    const r1 = L.last("p1", "round")!;
    const fen1 = r1.board!.fen;
    const crowd = legalMoves(fen1)[0]!;
    // (The test is the host: it knows the boss's reply it will give, so it can choose premoves legal after it. The
    // server's rule is about when each was told.)
    const reply = legalMoves(applyMove(fen1, crowd))[0]!;
    const [a, b, c] = legalMoves(applyMove(applyMove(fen1, crowd), reply)) as [string, string, string];
    L.advance(Math.max(0, r1.startsAt - L.now) + 2000);
    for (const id of ["p1", "p2", "p3"]) L.core.message(id, { t: "pick", key: r1.key, move: crowd });
    L.scores(crowd);
    expect(L.core.record.phase).toBe("reveal");
    // The crowd's move is out; the boss's reply isn't decided: p1's premove counts.
    L.core.message("p1", { t: "premove", move: a });
    for (let i = 0; i < 30 && L.core.record.phase === "reveal"; i++) L.advance(1000);
    expect(L.core.record.phase).toBe("boss");
    const req = L.last(L.core.record.hostId!, "bossRequest")!;
    expect(req.fen).toBe(applyMove(fen1, crowd));
    // The host has been asked (its browser knows his move): p2's doesn't.
    L.core.message("p2", { t: "premove", move: b });
    L.core.message(L.core.record.hostId!, { t: "bossMove", key: req.key, move: reply });
    expect(L.last("p1", "boss")!.boss.lastMove?.move).toBe(reply);
    // His move shows (before the crowd's clock starts): p3's doesn't either.
    expect(L.core.record.phase).toBe("boss");
    L.core.message("p3", { t: "premove", move: c });
    for (let i = 0; i < 60 && L.core.record.phase !== "play"; i++) L.advance(500);
    const r2 = L.last("p1", "round")!;
    expect(r2.key).not.toBe(r1.key);
    expect(L.core.record.round!.premoved).toEqual({ p1: a });
    L.advance(Math.max(0, r2.startsAt - L.now) + 200);
    L.core.message("p1", { t: "pick", key: r2.key, move: a, premove: true });
    L.core.message("p2", { t: "pick", key: r2.key, move: b, premove: true });
    L.core.message("p3", { t: "pick", key: r2.key, move: c, premove: true });
    const picks = L.core.record.round!.picks;
    expect([picks.p1?.premove, picks.p2?.premove, picks.p3?.premove]).toEqual([true, undefined, undefined]);
    expect([picks.p1?.move, picks.p2?.move, picks.p3?.move]).toEqual([a, b, c]);
  });

  it("a final: told before the other finalist's turn opened: marked; told between movers (their move showing): timed", () => {
    const L = finalLobby();
    // The duel final, p1 against p2, taking turns. Wait for a turn of p1's to open.
    const turn = (id: string) => {
      for (let i = 0; i < 40 && !(L.core.record.phase === "play" && L.core.record.round!.deadlines[id] !== undefined); i++) L.advance(1000);
      const r = L.last(id, "round")!;
      L.advance(Math.max(0, r.startsAt - L.now));
      return r;
    };
    const play = (id: string, r: { key: string; board?: { fen: string } | null }, move: string, premove = false) => {
      L.advance(200);
      L.core.message(id, { t: "pick", key: r.key, move, ...(premove ? { premove: true as const } : {}) });
      L.scores(move);
    };
    let r = turn("p1");
    let fen = r.board!.fen;
    const m1 = legalMoves(fen)[0]!;
    const reply1 = legalMoves(applyMove(fen, m1))[0]!;
    const next1 = legalMoves(applyMove(applyMove(fen, m1), reply1))[0]!;
    play("p1", r, m1);
    // p1 tells its next right after its own move, before p2's turn opens: it counts.
    L.core.message("p1", { t: "premove", move: next1 });
    r = turn("p2");
    play("p2", r, reply1);
    r = turn("p1");
    expect(L.core.record.round!.premoved).toEqual({ p1: next1 });
    play("p1", r, next1, true);
    expect(L.core.record.round!.picks.p1).toMatchObject({ move: next1, premove: true });

    // Now p2's turn; once it's played and shows (between movers), p1 tells its next: it doesn't count.
    r = turn("p2");
    fen = r.board!.fen;
    const reply2 = legalMoves(fen)[0]!;
    const next2 = legalMoves(applyMove(fen, reply2))[0]!;
    play("p2", r, reply2);
    expect(L.core.record.phase).toBe("final");
    L.core.message("p1", { t: "premove", move: next2 });
    r = turn("p1");
    expect(L.core.record.round!.premoved).toBeUndefined();
    play("p1", r, next2, true);
    expect(L.last("p1", "final")!.final.last?.move).toBe(next2);
  });
});

/** A raid's library (as the boss lobby tests have it): openings long enough for a raid's settings. */
const raidLine = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O", "h3", "Nb8", "d4", "Nbd7", "c4"]);
const raidLibrary: Opening[] = Array.from({ length: 30 }, (_, i) => ({
  id: `o${i}`,
  eco: "C95",
  name: `Opening ${i}`,
  family: `Family ${i}`,
  unusual: i >= 25,
  moves: raidLine,
  namedPlies: 21,
  expected: Object.fromEntries(Array.from({ length: 22 }, (_, n) => [n, 0.5])),
}));

/** A raid on the boss Ginger (no power before his fourth move), three people, past the intro: the crowd's first turn open. */
function raidLobby() {
  let now = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  const core = new LobbyCore(
    newLobbyRecord("ABCDE", now),
    { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as ServerMessage]) },
    raidLibrary,
    mulberry32(7),
    { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossId: "gingerbread", bossKillEvery: 99, lastStandFrom: 999, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0 },
  );
  const last = <T extends ServerMessage["t"]>(id: string, t: T) =>
    [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<ServerMessage, { t: T }> | undefined;
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  for (let i = 1; i <= 3; i++) core.connect(undefined, `P${i}`, "computer", false, 1500);
  core.message("p1", { t: "start" });
  advance(1000);
  for (let i = 0; i < 120 && core.record.phase !== "play"; i++) advance(1000);
  return { core, last, advance, scores: (best: string) => answerScores(core, last, best), get now() { return now; } };
}

/** A Crowd lobby whose short knockouts leave its two people facing each other in the duel final. */
function finalLobby() {
  let now = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  const core = new LobbyCore(
    newLobbyRecord("ABCDE", now),
    { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as ServerMessage]) },
    library,
    mulberry32(3),
    { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { augments: false }), finalFormat: "duel", knockoutsPerStage: [2, 2], firstStageRounds: 1, roundsPerStage: 1, boardIntroSeconds: 0 },
  );
  const last = <T extends ServerMessage["t"]>(id: string, t: T) =>
    [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<ServerMessage, { t: T }> | undefined;
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  for (let i = 1; i <= 2; i++) core.connect(undefined, `P${i}`, "computer");
  core.message("p1", { t: "start" });
  advance(2000);
  // Through the knockouts: each person picks the judges' best, the bots something worse, so both people reach the final.
  for (let i = 0; i < 200 && !last("p1", "final"); i++) {
    if (core.record.phase === "play") {
      for (const id of Object.keys(core.record.round!.deadlines)) {
        const r = last(id, "round");
        if (r?.board && !core.record.round!.picks[id]) core.message(id, { t: "pick", key: r.key, move: legalMoves(r.board.fen)[0]! });
      }
    }
    if (core.record.phase === "scoring") answerScores(core, last, null);
    advance(1000);
  }
  const f = last("p1", "final")!.final;
  expect(f.teams).toEqual([["p1"], ["p2"]]);
  return { core, last, advance, scores: (best: string) => answerScores(core, last, best), get now() { return now; } };
}

/** The host's scores: `best` (null: each board's first legal move) best, everything else 15 points behind; the bots pick worse. */
function answerScores(core: LobbyCore, last: <T extends ServerMessage["t"]>(id: string, t: T) => Extract<ServerMessage, { t: T }> | undefined, best: string | null) {
  const host = core.record.hostId!;
  const req = last(host, "scoreRequest");
  if (!req) return;
  const boards: BoardScore[] = req.jobs.map((j) => {
    const legal = legalMoves(j.fen);
    const top = best && legal.includes(best) ? best : legal[0]!;
    const worse = legal.find((m) => m !== top) ?? top;
    return { boardId: j.boardId, bestMove: top, bestExpected: 0.55, expectedAfter: Object.fromEntries(legal.map((m) => [m, m === top ? 0.55 : 0.4])), botPicks: Object.fromEntries(j.bots.map((b) => [b.id, worse])), botThinkMs: {} };
  });
  core.message(host, { t: "scores", key: req.key, boards });
}