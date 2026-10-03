import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, modeSettings, mulberry32, type Settings } from "@chessroyale/core";
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
  expected: Object.fromEntries(Array.from({ length: 22 }, (_, n) => [n, 0.5])),
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
    { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...settings },
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
    expect(L.core.record.bots).toHaveLength(62);
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
    expect(rev.picks).toHaveLength(8);
    expect(rev.picks.reduce((s, p) => s + p.roundScore, 0)).toBeCloseTo(0, 6);
    expect(rev.playedMove).toBeTruthy();
    // Every board slot comes with the round and the reveal, the reveal's after the moves were played.
    expect(r1.slots.map((x) => x.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(r1.slots.every((x) => x.live)).toBe(true);
    const mine = rev.slots.find((x) => x.id === r2.board!.id)!;
    expect(mine.lastMove).toBe(rev.playedMove);
    expect(mine.fen).toBe(rev.board!.fen);
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

  it("runs every stage to the 2v2 final and results, with a human finalist", () => {
    const L = setup();
    L.core.connect(undefined, "Ann", "computer");
    L.core.message("p1", { t: "start" });
    L.advance(6000);
    let finalTurnsForAnn = 0;
    let sawFinal = false;
    for (let i = 0; i < 2000 && L.core.record.phase !== "results"; i++) {
      const phase = L.core.record.phase;
      if (phase === "play") {
        const r = L.last("p1", "round")!;
        if (r.board && !L.core.record.round!.picks.p1 && L.core.record.round!.key === r.key) {
          // Play the hash-best move so Ann tends to survive.
          const legal = legalMoves(r.board.fen);
          const best = legal.reduce((a, b) => (hash(r.board!.fen + b) > hash(r.board!.fen + a) ? b : a));
          if (r.stage >= DEFAULT_SETTINGS.knockoutsPerStage.length) finalTurnsForAnn++;
          L.core.message("p1", { t: "pick", key: r.key, move: best });
        } else L.advance(1000);
      } else if (phase === "scoring") L.hostScores("p1");
      else {
        if (phase === "final") sawFinal = true;
        L.advance(1000);
      }
    }
    expect(L.core.record.phase).toBe("results");
    const res = L.last("p1", "results")!;
    expect(Object.values(res.placements).sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
    expect(res.winner).toBeTruthy();
    // Ann reached the final (she plays the hash-best move every time) and took her turns there.
    expect(sawFinal).toBe(true);
    const f = L.last("p1", "final")!.final;
    expect(f.order).toHaveLength(4);
    if (f.order.includes("p1")) expect(finalTurnsForAnn).toBeGreaterThan(0);
  });

  it("gives each player their own deadline from their bank, and counts power-ups", () => {
    const L = setup({ roundsPerStage: 2, firstStageRounds: 2, powerUpsAtStart: 1 });
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

  it("starts the move clock after the board's settling-in countdown, and ignores moves before it", () => {
    const L = setup({ boardIntroSeconds: 5, roundsPerStage: 2, firstStageRounds: 2 });
    L.core.connect(undefined, "Ann", "computer");
    L.core.message("p1", { t: "start" });
    L.advance(6000);
    const r = L.last("p1", "round")!;
    expect(r.startsAt - L.now).toBe(5000);
    expect(r.deadline - r.startsAt).toBe(30_000);
    const move = legalMoves(r.board!.fen)[0]!;
    L.core.message("p1", { t: "pick", key: r.key, move });
    expect(L.core.record.round!.picks.p1).toBeUndefined();
    L.advance(5000 + 3000);
    L.core.message("p1", { t: "pick", key: r.key, move });
    expect(L.core.record.round!.picks.p1!.thinkMs).toBe(3000);
  });
});

describe("lobby: Crowd mode", () => {
  it("50 v 50: the watching team gets the board, everyone sees the vote, and the cut's augment vote sets the clock", () => {
    const L = setup({ ...modeSettings("crowd"), firstStageRounds: 2, roundsPerStage: 2, boardIntroSeconds: 0 });
    L.core.connect(undefined, "Ann", "computer");
    L.core.connect(undefined, "Bo", "phone");
    L.core.message("p1", { t: "start" });
    expect(L.core.record.bots).toHaveLength(98);
    L.advance(DEFAULT_SETTINGS.openingShowSeconds * 1000);
    for (let round = 0; round < 2; round++) {
      const r1 = L.last("p1", "round")!;
      const r2 = L.last("p2", "round")!;
      expect(r1.key).toBe(r2.key);
      for (const [id, r] of [["p1", r1], ["p2", r2]] as const) {
        // Everyone gets the one board; the team not to move is marked as watching.
        expect(r.board).toBeTruthy();
        const playing = !r.watching;
        if (playing) L.core.message(id, { t: "pick", key: r.key, move: legalMoves(r.board!.fen)[0]! });
      }
      if (r1.watching && r2.watching) L.advance(5000); // only bots picking: the vote shows for a few seconds
      expect(L.hostScores("p1")).toBe(true);
      const v1 = L.last("p1", "reveal")!;
      const v2 = L.last("p2", "reveal")!;
      expect(v1.picks).toHaveLength(50);
      expect(v2.picks).toHaveLength(50);
      expect(v1.playedMove).toBe(v2.playedMove);
      L.advance(10_000);
    }
    const brk = L.last("p1", "stageBreak")!;
    expect(brk.augments).toBe(true);
    expect(brk.knockedOut).toHaveLength(16);
    L.core.message("p1", { t: "augment", choice: "more" });
    L.core.message("p2", { t: "augment", choice: "more" });
    L.advance(10_000);
    expect(L.last("p1", "round")!.moveClock).toBe(25);
  });
});
