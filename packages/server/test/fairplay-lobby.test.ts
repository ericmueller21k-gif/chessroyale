import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, modeSettings, mulberry32 } from "@chessroyale/core";
import { legalMoves, type BoardScore, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

const library: Opening[] = [{ id: "o", eco: "", name: "Start", family: "Start", unusual: false, moves: [], namedPlies: 0, expected: { 0: 0.5 } }];

/** A Crowd lobby (everyone moves, no votes) on a fake clock, whose host scores with a fixed table. */
function crowd() {
  let now = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  const core = new LobbyCore(
    newLobbyRecord("ABCDE", now),
    { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as ServerMessage]) },
    library,
    mulberry32(7),
    { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { crowdTeams: false, augments: false }), powerUpsAtStart: 1 },
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

describe("fair play in the lobby", () => {
  it("records each person's pick with its loss, the crowd's find rate, complexity, think time and look-aways", () => {
    const L = crowd();
    for (let i = 1; i <= 10; i++) L.core.connect(undefined, `P${i}`, "computer", i === 10);
    L.core.message("p1", { t: "start" });
    L.advance(2000);
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
      // The crowd: the other people picking, not the practice player (hints) and not the one who used a power-up.
      crowd: 7,
      crowdFound: 1,
      thinkMs: 4000,
      away: 2,
      legal: 20,
    });
    expect(m!.fen).toBe(r.board!.fen);
    expect(m!.powerUp).toBeUndefined();
    expect(L.core.fairMoves("p3")[0]).toMatchObject({ loss: 15, crowd: 7, crowdFound: 2, away: 0 });
    expect(L.core.fairMoves("p9")[0]).toMatchObject({ powerUp: true, crowd: 8 });
    // A practice player (unlimited hints) isn't recorded. Bots never are.
    expect(L.core.fairMoves("p10")).toEqual([]);
    expect(Object.keys(L.core.record.fair!).every((id) => /^p\d+$/.test(id))).toBe(true);
    expect(L.core.record.fairV).toBe(1);
  });

  it("marks a best move that takes on the square the last move landed on (a recapture), and counts plies", () => {
    const L = crowd();
    for (let i = 1; i <= 2; i++) L.core.connect(undefined, `P${i}`, "computer");
    L.core.message("p1", { t: "start" });
    L.advance(2000);
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
      [1, "d7d5", false],
      [2, "e4d5", true],
    ]);
    expect(L.core.record.fairV).toBe(3);
  });
});
