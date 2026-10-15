import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, modeSettings, mulberry32 } from "@chessroyale/core";
import { legalMoves, type BoardScore, type Opening, type ServerMessage } from "@chessroyale/chess";
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
