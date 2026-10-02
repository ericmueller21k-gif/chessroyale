import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { legalMoves, sanLineToUci, type BoardScore, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O", "h3", "Nb8", "d4", "Nbd7", "c4"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({
  id: `o${i}`,
  eco: "C95",
  name: `Opening ${i}`,
  family: `Family ${i}`,
  unusual: i >= 25,
  moves: line,
  namedPlies: 21,
  expected: { 20: 0.5, 21: 0.5 },
}));

type Msg = ServerMessage;

/** A fake lobby: clock, outboxes per player, and a fake host that scores with a hash "engine". */
function setup(settings: Partial<Settings> = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const core = new LobbyCore(
    newLobbyRecord("ABCDE", now),
    {
      now: () => now,
      send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]),
    },
    library,
    mulberry32(7),
    { ...DEFAULT_SETTINGS, roundsPerStage: 1, ...settings },
  );
  const take = (id: string) => {
    const msgs = inbox.get(id) ?? [];
    inbox.set(id, []);
    return msgs;
  };
  const last = <T extends Msg["t"]>(id: string, t: T) =>
    [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  /** Answers any score request in the host's inbox. */
  const hostScores = (hostId: string) => {
    const req = last(hostId, "scoreRequest");
    if (!req) return false;
    const boards: BoardScore[] = req.jobs.map((j) => {
      const legal = legalMoves(j.fen);
      const exp = Object.fromEntries(legal.map((m) => [m, 0.3 + 0.4 * hash(j.fen + m)]));
      const best = legal.reduce((a, b) => (exp[b]! > exp[a]! ? b : a));
      return {
        boardId: j.boardId,
        bestMove: best,
        bestExpected: exp[best]!,
        expectedAfter: exp,
        botPicks: Object.fromEntries(j.bots.map((b, i) => [b.id, legal[i % legal.length]!])),
        botThinkMs: Object.fromEntries(j.bots.map((b) => [b.id, 4000])),
      };
    });
    core.message(hostId, { t: "scores", key: req.key, boards });
    inbox.set(hostId, (inbox.get(hostId) ?? []).filter((m) => m.t !== "scoreRequest"));
    return true;
  };
  return { core, take, last, advance, hostScores, inbox, get now() { return now; } };
}

describe("lobby", () => {
  it("lets players join, makes the first the host, and fills empty seats with bots on start", () => {
    const L = setup();
    const a = L.core.connect(undefined, "Ann", "computer");
    const b = L.core.connect(undefined, "Bo", "phone");
    expect(a.ok && b.ok).toBe(true);
    const lobby = L.last("p1", "lobby")!;
    expect(lobby.hostId).toBe("p1");
    expect(lobby.players.map((p) => p.name)).toEqual(["Ann", "Bo"]);
    L.core.message("p2", { t: "start" }); // not the host: ignored
    expect(L.core.record.phase).toBe("lobby");
    L.core.message("p1", { t: "start" });
    expect(L.core.record.phase).toBe("opening");
    expect(L.core.record.bots).toHaveLength(30);
    expect(L.last("p2", "opening")!.boards).toHaveLength(8);
    expect(L.core.connect(undefined, "Late").ok).toBe(false);
  });

  it("plays a round: deal, picks, host scoring, reveal; nobody sees scores before picks lock", () => {
    const L = setup();
    L.core.connect(undefined, "Ann", "computer");
    L.core.connect(undefined, "Bo", "phone");
    L.core.message("p1", { t: "start" });
    L.advance(6000);
    const r1 = L.last("p1", "round")!;
    const r2 = L.last("p2", "round")!;
    expect(r1.board && r2.board).toBeTruthy();
    expect(L.core.record.phase).toBe("play");
    // Illegal and late picks are ignored.
    L.core.message("p1", { t: "pick", key: r1.key, move: "a1a8" });
    expect(L.core.record.round!.picks.p1).toBeUndefined();
    L.core.message("p1", { t: "pick", key: r1.key, move: legalMoves(r1.board!.fen)[0]! });
    expect(L.core.record.phase).toBe("play");
    expect(L.last("p1", "scoreRequest")).toBeUndefined();
    L.core.message("p2", { t: "pick", key: r2.key, move: legalMoves(r2.board!.fen)[0]! });
    // Both humans picked: locked early and sent to the host.
    expect(L.core.record.phase).toBe("scoring");
    expect(L.last("p1", "scoreRequest")!.jobs).toHaveLength(8);
    expect(L.last("p2", "scoreRequest")).toBeUndefined();
    expect(L.hostScores("p1")).toBe(true);
    const rev = L.last("p2", "reveal")!;
    expect(rev.picks).toHaveLength(4);
    expect(rev.picks.reduce((s, p) => s + p.roundScore, 0)).toBeCloseTo(0, 6);
    expect(rev.playedMove).toBeTruthy();
  });

  it("counts a missing pick as a miss when the clock runs out", () => {
    const L = setup();
    L.core.connect(undefined, "Ann", "computer");
    L.core.message("p1", { t: "start" });
    L.advance(6000);
    L.advance(DEFAULT_SETTINGS.moveClockSeconds * 1000 + DEFAULT_SETTINGS.lateGraceMs + 1);
    expect(L.core.record.phase).toBe("scoring");
    L.hostScores("p1");
    const me = L.last("p1", "reveal")!.picks.find((p) => p.playerId === "p1")!;
    expect(me.roundScore).toBe(-25);
  });

  it("moves scoring to another player if the host drops mid-round, and resends state on reconnect", () => {
    const L = setup();
    L.core.connect(undefined, "Ann", "computer");
    L.core.connect(undefined, "Bo", "computer");
    L.core.message("p1", { t: "start" });
    L.advance(6000);
    L.advance(DEFAULT_SETTINGS.moveClockSeconds * 1000 + 400);
    expect(L.core.record.phase).toBe("scoring");
    L.core.disconnect("p1");
    expect(L.core.record.hostId).toBe("p2");
    expect(L.hostScores("p2")).toBe(true);
    expect(L.core.record.phase).toBe("reveal");
    // Ann reconnects with her token and gets the current phase again.
    const token = L.core.record.humans[0]!.token;
    L.take("p1");
    L.core.connect(token, undefined);
    L.core.resendTo("p1");
    expect(L.last("p1", "welcome")!.playerId).toBe("p1");
    expect(L.last("p1", "reveal")).toBeTruthy();
  });

  it("keeps going without any scorer (all picks treated equal) rather than stalling", () => {
    const L = setup();
    L.core.connect(undefined, "Ann", "computer");
    L.core.message("p1", { t: "start" });
    L.advance(6000);
    L.core.disconnect("p1");
    L.advance(DEFAULT_SETTINGS.moveClockSeconds * 1000 + 400);
    L.advance(16_000);
    expect(L.core.record.phase).toBe("reveal");
  });

  it("runs every stage to the duel and results, with a human finalist playing a bot", () => {
    const L = setup();
    L.core.connect(undefined, "Ann", "computer");
    L.core.message("p1", { t: "start" });
    L.advance(6000);
    for (let i = 0; i < 400 && L.core.record.phase !== "results"; i++) {
      const phase = L.core.record.phase;
      if (phase === "play") {
        const r = L.last("p1", "round")!;
        if (r.board && !L.core.record.round!.picks.p1) {
          // Play the hash-best move so Ann tends to survive.
          const legal = legalMoves(r.board.fen);
          const best = legal.reduce((a, b) => (hash(r.board!.fen + b) > hash(r.board!.fen + a) ? b : a));
          L.core.message("p1", { t: "pick", key: r.key, move: best });
        } else L.advance(11_000);
      } else if (phase === "scoring") L.hostScores("p1");
      else if (phase === "chooseColour") L.core.message("p1", { t: "chooseColour", colour: "w" });
      else if (phase === "duel") {
        const d = L.core.record.duel!;
        const req = L.last("p1", "botMoveRequest");
        if (req && req.ply === d.history.length) {
          L.core.message("p1", { t: "botMove", ply: req.ply, move: legalMoves(req.fen)[0]!, loss: 1 });
        } else if ((d.history.length % 2 === 0) === (d.white === "p1")) {
          L.core.message("p1", { t: "resign" });
        } else L.advance(500);
      } else L.advance(11_000);
    }
    expect(L.core.record.phase).toBe("results");
    const res = L.last("p1", "results")!;
    expect(Object.values(res.placements).sort((a, b) => a - b)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });

  it("gives each player their own deadline from their bank, and counts power-ups", () => {
    const L = setup({ roundsPerStage: 2 });
    L.core.connect(undefined, "Ann", "computer");
    L.core.connect(undefined, "Bo", "phone", true);
    L.core.message("p1", { t: "start" });
    L.advance(6000);
    const r1 = L.last("p1", "round")!;
    expect(r1.deadline - L.now).toBe(30_000);
    L.core.message("p1", { t: "powerUp", key: r1.key });
    L.core.message("p2", { t: "powerUp", key: r1.key });
    L.advance(12_000);
    L.core.message("p1", { t: "pick", key: r1.key, move: legalMoves(r1.board!.fen)[0]! });
    L.core.message("p2", { t: "pick", key: r1.key, move: legalMoves(L.last("p2", "round")!.board!.fen)[0]! });
    L.hostScores("p1");
    const st = L.last("p1", "reveal")!.standings;
    const ann = st.find((s) => s.id === "p1")!;
    const bo = st.find((s) => s.id === "p2")!;
    expect(ann.powerUps).toBe(0);
    expect(bo.powerUps).toBe(1); // practice: unlimited
    expect(bo.practice).toBe(true);
    expect(ann.bankMs).toBe(600_000 + 5000 - 12_000);
    // A second power-up in the same match, with none left, isn't counted.
    L.advance(10_000);
    const r2 = L.last("p1", "round")!;
    L.core.message("p1", { t: "powerUp", key: r2.key });
    expect(L.core.record.round!.powerUps.p1).toBeUndefined();
  });
});
