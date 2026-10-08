import { describe, expect, it } from "vitest";
import { CROWD_KNOCKOUTS, DEFAULT_SETTINGS, FRONT_DOOR, PREGAME_VOTES, RAID_SETTINGS, VARIABLE_CLOCK, modeSettings, mulberry32, type Settings } from "@chessroyale/core";
import { LAST_STAND_MS, applyMove, bossIntroTimeline, legalMoves, sanLineToUci, type BoardScore, type Opening, type ServerMessage } from "@chessroyale/chess";
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
function setup(settings: Partial<Settings> = {}, icons: Record<string, string> = {}, seed = 7) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const core = new LobbyCore(
    newLobbyRecord("ABCDE", now),
    {
      now: () => now,
      send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]),
      icon: (id) => icons[id],
    },
    library,
    mulberry32(seed),
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
    const L = setup({ ...modeSettings("crowd"), augments: false, cutClockVote: true, firstStageRounds: 2, roundsPerStage: 2, boardIntroSeconds: 0 });
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

  it("live tallies: nobody sees picks before making their own; the watching team sees them; the bot plan is scored", () => {
    const L = setup({ ...modeSettings("crowd"), augments: false, firstStageRounds: 4, roundsPerStage: 2, boardIntroSeconds: 0 });
    L.core.connect(undefined, "Ann", "computer");
    L.core.connect(undefined, "Bo", "phone");
    L.core.message("p1", { t: "start" });
    L.advance(DEFAULT_SETTINGS.openingShowSeconds * 1000);
    // Find a round where exactly one of the two humans is picking.
    for (let i = 0; i < 4; i++) {
      const r1 = L.last("p1", "round")!;
      const r2 = L.last("p2", "round")!;
      if (!!r1.watching !== !!r2.watching) {
        const [picker, watcher, rp] = r1.watching ? (["p2", "p1", r2] as const) : (["p1", "p2", r1] as const);
        const pre = L.last(picker, "prefetch") ?? L.last(watcher, "prefetch");
        expect(pre?.plan?.bots).toHaveLength(49);
        // The host sends its plan; the watcher sees it, the picker (not picked yet) doesn't.
        const host = L.last("p1", "prefetch") ? "p1" : "p2";
        const plan = Object.fromEntries(pre!.plan!.bots.map((b) => [b.id, legalMoves(pre!.plan!.fen)[0]!]));
        L.take(picker);
        L.take(watcher);
        L.core.message(host, { t: "botPlan", key: rp.key, picks: plan, powerUps: [] });
        expect(L.last(watcher, "tally")!.picks).toHaveLength(49);
        expect(L.last(picker, "tally")).toBeUndefined();
        // After picking, the picker sees everything, their own pick included.
        const move = legalMoves(rp.board!.fen)[1]!;
        L.core.message(picker, { t: "pick", key: rp.key, move });
        const t = L.last(picker, "tally")!;
        expect(t.picks).toHaveLength(50);
        expect(t.picks.find((p) => p.playerId === picker)!.move).toBe(move);
        // Scoring uses the plan.
        const req = L.last(host, "scoreRequest")!;
        expect(req.jobs[0]!.botPlan).toEqual(plan);
        return;
      }
      if (!r1.watching) L.core.message("p1", { t: "pick", key: r1.key, move: legalMoves(r1.board!.fen)[0]! });
      if (!r2.watching) L.core.message("p2", { t: "pick", key: r2.key, move: legalMoves(r2.board!.fen)[0]! });
      if (r1.watching && r2.watching) L.advance(5000);
      L.hostScores("p1");
      L.advance(10_000);
    }
    throw new Error("the humans were always on the same team");
  });

  it("pre-game votes: everyone votes on the ending and the speed; the winners set the match's settings", () => {
    const L = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: true }), boardIntroSeconds: 0 });
    L.core.connect(undefined, "Ann", "computer");
    L.core.connect(undefined, "Bo", "phone");
    L.core.message("p1", { t: "start" });
    const v = L.last("p2", "vote")!.vote;
    expect(v.index).toBe(0);
    expect(v.count).toBe(PREGAME_VOTES.length);
    // The bots' votes, all decided as it opens: most of the 98 bots vote (a few don't: voteBotSkip).
    const botsVoting = v.votes.length;
    expect(v.votes.every((x) => x.playerId.startsWith("bot") && !x.joined)).toBe(true);
    expect(botsVoting).toBeLessThan(98);
    expect(botsVoting).toBeGreaterThan(98 * (1 - 3 * DEFAULT_SETTINGS.voteBotSkip));
    expect(v.result).toBeNull();
    // A vote shows up for everyone at once; a second vote from the same player doesn't count.
    L.core.message("p1", { t: "vote", key: v.key, option: 1 });
    L.core.message("p1", { t: "vote", key: v.key, option: 2 });
    const casts = L.take("p2").filter((m) => m.t === "voteCast");
    expect(casts).toHaveLength(1);
    expect(casts[0]).toMatchObject({ playerId: "p1", option: 1 });
    L.advance(DEFAULT_SETTINGS.voteSeconds * 1000);
    const done = L.last("p1", "vote")!.vote;
    expect(done.result).not.toBeNull();
    // Time's up: everyone who didn't vote (Bo, and the bots that didn't) joins the winner, so all 100 are counted,
    // once each; the votes cast are as they were.
    expect(new Set(done.votes.map((x) => x.playerId)).size).toBe(100);
    expect(done.votes).toHaveLength(100);
    const joined = done.votes.filter((x) => x.joined);
    expect(joined).toHaveLength(100 - botsVoting - 1);
    expect(joined.map((x) => x.playerId)).toContain("p2");
    expect(joined.every((x) => x.option === done.result && x.at === L.now)).toBe(true);
    expect(done.votes.find((x) => x.playerId === "p1")).toMatchObject({ option: 1 });
    expect(done.votes.filter((x) => !x.joined)).toEqual(expect.arrayContaining(v.votes));
    const format = PREGAME_VOTES[0]!.options[done.result!]!;
    expect(L.core.record.overrides?.finalFormat).toBe(format.patch.finalFormat);
    L.advance(DEFAULT_SETTINGS.voteResultSeconds * 1000);
    const speedVote = L.last("p1", "vote")!.vote;
    expect(speedVote.index).toBe(1);
    L.advance(DEFAULT_SETTINGS.voteSeconds * 1000);
    const speed = PREGAME_VOTES[1]!.options[L.last("p1", "vote")!.vote.result!]!;
    L.advance(DEFAULT_SETTINGS.voteResultSeconds * 1000);
    // The game starts with the voted clock: Normal 20 s, Variable's first step (10 s) or Bullet 10 s.
    expect(L.last("p1", "round")!.moveClock).toBe({ normal: 20, variable: 10, bullet: 10 }[speed.id]);
    expect(L.core.record.overrides?.moveClockSteps ?? []).toEqual(speed.patch.moveClockSteps);
  });

  it("pre-game votes: nobody votes, so the default wins (Team final, then Variable) and everyone joins it", () => {
    const L = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: true }), boardIntroSeconds: 0, voteBotSkip: 1 });
    L.core.connect(undefined, "Ann", "computer");
    L.core.connect(undefined, "Bo", "phone");
    L.core.message("p1", { t: "start" });
    for (const [index, want] of [[0, "team"], [1, "variable"]] as const) {
      const v = L.last("p1", "vote")!.vote;
      expect(v.index).toBe(index);
      expect(v.votes).toEqual([]);
      L.advance(DEFAULT_SETTINGS.voteSeconds * 1000);
      const done = L.last("p2", "vote")!.vote;
      expect(PREGAME_VOTES[index]!.options[done.result!]!.id).toBe(want);
      expect(done.votes).toHaveLength(100);
      expect(done.votes.every((x) => x.joined && x.option === done.result)).toBe(true);
      L.advance(DEFAULT_SETTINGS.voteResultSeconds * 1000);
    }
    expect(L.core.record.overrides?.finalFormat).toBe("team");
    expect(L.core.record.overrides?.moveClockSteps).toEqual(VARIABLE_CLOCK);
  });

  it("pre-game votes: one vote each (a second is ignored); with voteChangeAllowed it replaces the first", () => {
    for (const allowed of [false, true]) {
      const L = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: true }), boardIntroSeconds: 0, voteChangeAllowed: allowed });
      L.core.connect(undefined, "Ann", "computer");
      L.core.connect(undefined, "Bo", "phone");
      L.core.message("p1", { t: "start" });
      const v = L.last("p2", "vote")!.vote;
      expect(!!v.changeAllowed).toBe(allowed);
      L.core.message("p1", { t: "vote", key: v.key, option: 0 });
      L.core.message("p1", { t: "vote", key: v.key, option: 2 });
      const casts = L.take("p2").filter((m) => m.t === "voteCast");
      expect(casts.map((c) => (c as { option: number }).option)).toEqual(allowed ? [0, 2] : [0]);
      L.advance(DEFAULT_SETTINGS.voteSeconds * 1000);
      const mine = L.last("p1", "vote")!.vote.votes.filter((x) => x.playerId === "p1");
      expect(mine.map((x) => x.option)).toEqual([allowed ? 2 : 0]);
    }
  });

  it("the Variable speed online: each move's deadline follows the schedule (10 s on move 1, 15 s on move 6)", () => {
    const L = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: false }), firstStageRounds: 20, roundsPerStage: 2, boardIntroSeconds: 0, moveClockSteps: VARIABLE_CLOCK });
    L.core.connect(undefined, "Ann", "computer");
    L.core.connect(undefined, "Bo", "phone");
    L.core.message("p1", { t: "start" });
    const clocks = new Map<number, number>();
    for (let i = 0; i < 400 && clocks.size < 7; i++) {
      if (L.core.record.phase === "play") {
        for (const id of ["p1", "p2"]) {
          const r = L.last(id, "round");
          if (!r?.board) continue;
          const move = Number(r.board.fen.split(" ")[5]);
          clocks.set(move, r.moveClock!);
          // The deadline is this move's clock (a fresh time bank never cuts it shorter).
          if (!r.watching) expect(r.deadline - r.startsAt!).toBe(r.moveClock! * 1000);
          if (!r.watching && r.alive) L.core.message(id, { t: "pick", key: r.key, move: legalMoves(r.board.fen)[0]! });
        }
        L.take("p1");
        L.take("p2");
        L.advance(20_000);
      }
      if (L.core.record.phase === "scoring") L.hostScores("p1") || L.hostScores("p2");
      L.advance(4000);
    }
    expect([1, 2, 5, 6, 7].map((m) => clocks.get(m))).toEqual([10, 10, 10, 15, 15]);
  });

  it("boss battle online: the host plays the boss's moves, the boss strikes every 3 crowd moves, results carry the outcome", () => {
    const L = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: false }), finalFormat: "boss", knockoutsPerStage: CROWD_KNOCKOUTS.boss, firstStageRounds: 1, roundsPerStage: 1, boardIntroSeconds: 0, bossMaxMoves: 7 });
    L.core.connect(undefined, "Ann", "computer");
    L.core.connect(undefined, "Bo", "phone");
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    let bossMoves = 0;
    let strikes = 0;
    for (let i = 0; i < 400 && L.core.record.phase !== "results"; i++) {
      const req = L.last("p1", "bossRequest") ?? L.last("p2", "bossRequest");
      if (req && L.core.record.phase === "boss" && L.core.record.bossKey === req.key) {
        const host = L.last("p1", "bossRequest") ? "p1" : "p2";
        L.core.message(host, { t: "bossMove", key: req.key, move: legalMoves(req.fen)[0]! });
        bossMoves++;
        // (Held a moment if the crowd just took its queen: its banner plays first.)
        if (L.core.record.bossPending) L.advance(2100);
        const b = L.last("p2", "boss")!;
        expect(b.boss.lastMove).not.toBeNull();
        L.take("p1");
        L.take("p2");
        L.advance(2000);
        continue;
      }
      if (L.core.record.phase === "play") {
        for (const id of ["p1", "p2"]) {
          const r = L.last(id, "round");
          if (r?.board && !r.watching && r.alive) L.core.message(id, { t: "pick", key: r.key, move: legalMoves(r.board.fen)[0]! });
        }
        L.advance(25_000);
      }
      if (L.core.record.phase === "scoring") L.hostScores("p1") || L.hostScores("p2");
      const b = L.last("p1", "boss");
      if (b?.boss.justKilled) {
        strikes++;
        L.take("p1");
      }
      L.advance(5000);
    }
    expect(L.core.record.phase).toBe("results");
    expect(bossMoves).toBeGreaterThan(0);
    expect(strikes).toBe(2);
    const res = L.last("p1", "results")!;
    expect(["crowd", "boss", "draw"]).toContain(res.bossResult);
    expect(Object.keys(res.placements)).toHaveLength(100);
    // What goes on their profiles: cuts faced and survived, brilliant moves, the best move, the boss battle if reached.
    const stages = CROWD_KNOCKOUTS.boss.length;
    const mine = L.core.humanResults();
    expect(mine).toHaveLength(2);
    for (const r of mine) {
      expect(r.cuts).toBeGreaterThan(0);
      expect(r.cuts).toBeLessThanOrEqual(stages);
      expect(r.cutsSurvived).toBe(r.cuts === stages && r.placement <= 10 ? stages : r.cuts! - 1);
      expect(r.brilliant).toBeGreaterThanOrEqual(0);
      expect(r.bestMove).toMatch(/^(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O(?:-O)?)[+#]?$/);
      expect(r.bossElo).toBeNull();
      if (r.placement <= 10) {
        expect(r.strikes).toBeGreaterThanOrEqual(r.strikesSurvived!);
        expect(r.survived).not.toBeNull();
        expect(r.lastStand).not.toBeNull();
      } else expect(r.strikes).toBeNull();
    }
  });

  it("matchmade lobbies start by themselves: at the fill time with bots, or as soon as they're full", () => {
    const L = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: true }) });
    L.core.setAuto(L.now + 60_000);
    L.core.connect(undefined, "Ann", "phone");
    expect(L.core.joinable()).toBe(true);
    expect(L.last("p1", "lobby")).toMatchObject({ auto: true, fillAt: L.now + 60_000 });
    // No host start for matchmade lobbies.
    L.core.message("p1", { t: "start" });
    expect(L.core.record.phase).toBe("lobby");
    L.advance(59_000);
    expect(L.core.joinable()).toBe(false);
    L.advance(1_000);
    // The seats fill (bots pop in on the queue screen), then the match begins a moment later.
    expect(L.core.record.phase).toBe("lobby");
    expect(L.core.record.bots).toHaveLength(99);
    const filled = L.last("p1", "lobby")!;
    expect(filled).toMatchObject({ started: true, filledAt: L.now });
    expect(filled.players.filter((p) => p.isBot)).toHaveLength(99);
    expect(L.core.connect(undefined, "Late").ok).toBe(false);
    expect(L.core.liveSummary()).toMatchObject({ phase: "playing", humans: 1, alive: 100, total: 100 });
    L.advance(FRONT_DOOR.fillShowMs);
    expect(L.core.record.phase).toBe("vote");

    const F = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: false }), lobbySize: 3 });
    F.core.setAuto(F.now + 60_000);
    for (const n of ["A", "B", "C"]) F.core.connect(undefined, n, "phone");
    expect(F.core.record.phase).toBe("lobby");
    F.advance(FRONT_DOOR.fillShowMs);
    expect(F.core.record.phase).toBe("opening");
    expect(F.core.record.bots).toHaveLength(0);
  });

  it("the queue: join order, looks sent once, account ids, Cancel frees the seat, waits are measured", () => {
    const L = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: true }) });
    L.core.setAuto(L.now + 60_000);
    const hat = { head: { def: "santa-hat", color: "red", blemish: 10, seed: 3 } };
    L.core.connect(undefined, "Ann", "phone", false, null, hat, "user-ann");
    expect(L.core.liveSummary()).toMatchObject({ phase: "waiting", humans: 1, alive: null });
    L.advance(10_000);
    L.take("p1");
    L.core.connect(undefined, "Bo", "phone", false, null, {}, "user-bo");
    // Ann hears about Bo (and Bo's look, if any) but isn't sent her own look again.
    const toAnn = L.last("p1", "lobby")!;
    expect(toAnn.players.map((p) => [p.name, p.uid])).toEqual([["Ann", "user-ann"], ["Bo", "user-bo"]]);
    expect(toAnn.players[0]!.look).toBeUndefined();
    // A newcomer (or someone reconnecting) gets everyone's looks.
    L.core.resendTo("p2");
    expect(L.last("p2", "lobby")!.players[0]!.look).toEqual(hat);
    L.core.connect(undefined, "Cy", "phone");
    expect(L.last("p1", "lobby")!.players.map((p) => p.name)).toEqual(["Ann", "Bo", "Cy"]);
    // Cancel: Bo's seat is free, Cy moves up; the host passes on if the host leaves.
    L.core.message("p2", { t: "leave" });
    expect(L.last("p1", "lobby")!.players.map((p) => p.name)).toEqual(["Ann", "Cy"]);
    expect(L.core.record.accounts).toEqual({ p1: "user-ann" });
    L.core.message("p1", { t: "leave" });
    expect(L.core.record.hostId).toBe("p3");
    expect(L.core.liveSummary().humans).toBe(1);
    // Cy waited 50 s when the bots filled the rest.
    L.advance(50_000);
    expect(L.core.record.auto).toMatchObject({ waiters: 1, waitMs: 50_000 });
    // After the start nobody can leave: the seat stays (they're just disconnected).
    L.core.message("p3", { t: "leave" });
    expect(L.core.record.humans.map((h) => h.name)).toEqual(["Cy"]);
  });

  it("standings carry a person's account id (a tap on their name opens their profile); bots have none", () => {
    const L = setup();
    L.core.connect(undefined, "Ann", "computer", false, null, undefined, "user-ann");
    L.core.connect(undefined, "Bo", "phone");
    L.core.message("p1", { t: "start" });
    L.advance(6000);
    const st = L.last("p2", "round")!.standings;
    expect(st.find((s) => s.id === "p1")!.uid).toBe("user-ann");
    expect(st.find((s) => s.id === "p2")!.uid).toBeUndefined();
    expect(st.filter((s) => s.isBot).every((s) => s.uid === undefined)).toBe(true);
  });

  it("boss raid: humans only, the boss a step above the group's average rating, from a named opening", () => {
    const L = setup({ ...RAID_SETTINGS });
    L.core.connect(undefined, "Ann", "computer", false, 1500);
    L.core.connect(undefined, "Bo", "phone", false, 1900);
    L.core.message("p1", { t: "start" });
    expect(L.core.record.bots).toHaveLength(0);
    expect(L.core.record.overrides?.bossFixedElo).toBe(1800);
    L.advance(1000);
    const intro = L.last("p2", "boss")!;
    expect(intro.intro).toBe(true);
    expect(intro.boss.raid).toBe(true);
    expect(intro.boss.openingName).toBeTruthy();
    expect(intro.boss.board.ply).toBe(10);
    // No opening screen first: the intro replays the opening from the start itself, then "START!".
    expect(L.last("p2", "opening")).toBeUndefined();
    const introMs = bossIntroTimeline(10).total;
    expect(intro.until - intro.now).toBe(introMs);
    L.advance(introMs);
    const r = L.last("p1", "round")!;
    expect(r.board).toBeTruthy();
    // One calls the King's strike: not a majority of 2 yet.
    L.core.message("p1", { t: "king", key: r.key, strike: true });
    expect(L.last("p2", "strike")).toMatchObject({ calls: 1, needed: 2 });
    expect(L.last("p2", "strike")!.at).toBeUndefined();
    // The second call: he strikes now. The clock stands still while he does (deadlines move back), and the move goes on.
    L.advance(2000);
    L.core.message("p2", { t: "king", key: r.key, strike: true });
    const s = L.last("p1", "strike")!;
    expect(s).toMatchObject({ calls: 2, needed: 2, at: L.now, until: L.now + DEFAULT_SETTINGS.kingStrikeMs, deadline: r.deadline + DEFAULT_SETTINGS.kingStrikeMs });
    expect(L.core.save().runner?.state.boss?.staggerNext).toBe(true);
    L.advance(DEFAULT_SETTINGS.kingStrikeMs + 1000);
    for (const id of ["p1", "p2"]) L.core.message(id, { t: "pick", key: r.key, move: legalMoves(r.board!.fen)[0]! });
    // Time on the move leaves out the strike.
    expect(L.core.record.round!.picks.p1!.thinkMs).toBe(3000);
    expect(L.hostScores("p1")).toBe(true);
    const v = L.last("p1", "reveal")!;
    expect(v.picks.every((p) => p.move)).toBe(true);
  });
  it("the God King's Last Stand online: everyone sees it, the clock waits for it, then the crowd picks again without the blunder", () => {
    const L = setup({ ...RAID_SETTINGS });
    L.core.connect(undefined, "Ann", "computer", false, 1500);
    L.core.connect(undefined, "Bo", "phone", false, 1500);
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    L.advance(bossIntroTimeline(10).total);
    const r = L.last("p1", "round")!;
    expect(r.boss?.kingCharges).toBe(3);
    const fen = r.board!.fen;
    const legal = legalMoves(fen);
    const [best, blunder] = [legal[0]!, legal[1]!];
    for (const id of ["p1", "p2"]) L.core.message(id, { t: "pick", key: r.key, move: blunder });
    // The host's judge: the blunder throws the game away from a level position. Its search also gives the boss's
    // best reply to each move (and a mate, from the mover's side), which the host sends along.
    const req = L.last("p1", "scoreRequest")!;
    const expectedAfter = Object.fromEntries(legal.map((m) => [m, m === best ? 0.55 : m === blunder ? 0.06 : 0.5]));
    const reply = legalMoves(applyMove(fen, blunder))[0]!;
    L.core.message("p1", {
      t: "scores",
      key: req.key,
      boards: [{ boardId: req.jobs[0]!.boardId, bestMove: best, bestExpected: 0.55, expectedAfter, botPicks: {}, botThinkMs: {}, replies: { [blunder]: reply, [best]: "zzzz" }, mates: { [blunder]: -6 } }],
    });
    // Everyone's reveal carries it, and lasts LAST_STAND_MS longer; the board isn't changed and he has fallen.
    for (const id of ["p1", "p2"]) {
      const v = L.last(id, "reveal")!;
      expect(v.playedMove).toBe(blunder);
      expect(v.lastStand).toEqual({ move: blunder, loss: 49, bar: 35, before: 0.55, after: 0.06, reply, mateIn: 6 });
      expect(v.until - v.now).toBe((RAID_SETTINGS.revealSeconds! + RAID_SETTINGS.drawnMoveSeconds!) * 1000 + LAST_STAND_MS);
      expect(v.board!.fen).toBe(fen);
      expect(v.boss).toMatchObject({ kingCharges: 0, barred: blunder, lastStand: { atMove: 1, move: blunder, charges: 3, fen, bestMove: best, reply, before: 0.55, after: 0.06 } });
      // His three charges are everyone's power-ups now.
      expect(v.standings.map((s) => s.powerUps)).toEqual([3, 3]);
    }
    // Scores stand: both lost 49 on the move.
    for (const p of L.core.save().runner!.state.players) expect(p.finalLosses.map((x) => Math.round(x))).toEqual([49]);
    // Through the reveal: the crowd picks again, same position, the blunder barred, a fresh clock.
    L.advance(RAID_SETTINGS.revealSeconds! * 1000 + RAID_SETTINGS.drawnMoveSeconds! * 1000 + LAST_STAND_MS);
    const again = L.last("p1", "round")!;
    expect(again.key).not.toBe(r.key);
    expect(again.board!.fen).toBe(fen);
    expect(again.boss).toMatchObject({ barred: blunder, kingCharges: 0, crowdMoves: 0 });
    expect(again.deadline - again.startsAt).toBe(r.deadline - r.startsAt);
    L.core.message("p1", { t: "king", key: again.key, strike: true });
    expect(L.last("p1", "strike")).toBeUndefined();
    // The barred move can't be picked; another can. Ann uses one of the power-ups he left (her browser shows the
    // engine's top 3; the server counts it).
    L.core.message("p1", { t: "pick", key: again.key, move: blunder });
    expect(L.core.record.round!.picks.p1).toBeUndefined();
    L.core.message("p1", { t: "powerUp", key: again.key });
    L.core.message("p1", { t: "pick", key: again.key, move: best });
    L.core.message("p2", { t: "pick", key: again.key, move: best });
    const req2 = L.last("p1", "scoreRequest")!;
    expect(req2.jobs[0]!.barred).toBe(blunder);
    L.core.message("p1", { t: "scores", key: req2.key, boards: [{ boardId: req2.jobs[0]!.boardId, bestMove: best, bestExpected: 0.55, expectedAfter, botPicks: {}, botThinkMs: {} }] });
    const v2 = L.last("p2", "reveal")!;
    expect(v2.lastStand).toBeUndefined();
    // Her pick is marked as a power-up move (never brilliant) and cost her one; Bo kept his.
    expect(v2.picks.find((p) => p.playerId === "p1")).toMatchObject({ move: best, usedPowerUp: true });
    expect(v2.picks.find((p) => p.playerId === "p2")!.usedPowerUp).toBeUndefined();
    expect(Object.fromEntries(v2.standings.map((s) => [s.id, s.powerUps]))).toEqual({ p1: 2, p2: 3 });
    expect(v2.playedMove).toBe(best);
    expect(v2.board!.fen).not.toBe(fen);
    expect(v2.boss).toMatchObject({ barred: null, crowdMoves: 1, lastStand: { atMove: 1 } });
  });
});

describe("lobby: quick chat", () => {
  /** A 50 v 50 with three people (two on one team, one on the other), the match begun. */
  function chatLobby(icons: Record<string, string> = {}) {
    const ids = ["p1", "p2", "p3"];
    // Teams are drawn at random: the first seed (from 7) that puts two people on one side and one on the other.
    // (Not whatever seed 7 gives: anything else that draws from the match's random source moves the teams.)
    for (let seed = 7; ; seed++) {
      const L = setup({ ...modeSettings("crowd"), augments: false, boardIntroSeconds: 0 }, icons, seed);
      for (const n of ["Ann", "Bo", "Cy"]) L.core.connect(undefined, n, "computer");
      // (Chat before the match, in the lobby: "lobby: quick chat before the match", below.)
      L.core.message("p1", { t: "start" });
      L.advance(DEFAULT_SETTINGS.openingShowSeconds * 1000);
      const team = (id: string) => L.last(id, "round")!.standings.find((s) => s.id === id)!.team!;
      if (new Set(ids.map(team)).size === 2) return chatTeams(L, ids, team);
      expect(seed).toBeLessThan(40);
    }
  }
  function chatTeams(L: ReturnType<typeof setup>, ids: string[], team: (id: string) => "w" | "b") {
    const side = ids.map(team);
    // Two on one side; find who's with whom.
    const a = ids.find((id, i) => side.filter((x) => x === side[i]).length === 2)!;
    const mate = ids.find((id) => id !== a && team(id) === team(a))!;
    const other = ids.find((id) => team(id) !== team(a))!;
    expect(other).toBeTruthy();
    const said = (id: string) => (L.inbox.get(id) ?? []).filter((m): m is Extract<Msg, { t: "chat" }> => m.t === "chat").map((m) => m.line);
    const humanLines = (id: string) => said(id).filter((l) => l.from.startsWith("p"));
    const clear = () => ids.forEach((id) => L.take(id));
    return { L, a, mate, other, said, humanLines, clear, team };
  }

  it("opens with the match: everyone gets the log and their packs", () => {
    const { L, a } = chatLobby();
    const log = L.last(a, "chatLog")!;
    expect(log.packs).toEqual(["basics", "emoji-basics"]);
    expect(L.core.chatOpen()).toBe(true);
  });

  it("team lines reach only your team (and you); Hello and Sporting can go to everyone", () => {
    const { L, a, mate, other, humanLines, clear } = chatLobby();
    clear();
    L.core.message(a, { t: "chat", say: "push-pawns" });
    expect(humanLines(a).map((l) => l.say)).toEqual(["push-pawns"]);
    expect(humanLines(mate)).toEqual([expect.objectContaining({ from: a, say: "push-pawns", to: "team" })]);
    expect(humanLines(other)).toEqual([]);
    // Plans can't go to everyone.
    L.advance(3_000);
    L.core.message(a, { t: "chat", say: "go-mate", to: "all" });
    expect(L.last(a, "chatNo")).toMatchObject({ say: "go-mate", reason: "team" });
    expect(humanLines(other)).toEqual([]);
    // A Sporting line can.
    L.core.message(a, { t: "chat", say: "gg", to: "all" });
    expect(humanLines(other)).toEqual([expect.objectContaining({ from: a, say: "gg", to: "all" })]);
    expect(humanLines(mate).map((l) => l.say)).toEqual(["push-pawns", "gg"]);
  });

  it("emoji can go to everyone (Eric, Oct 7): the other team gets them, with the same checks as any line", () => {
    const { L, a, mate, other, humanLines, clear } = chatLobby();
    clear();
    // To the team, as before: the other team doesn't see it.
    L.core.message(a, { t: "chat", say: "e-laugh" });
    expect(humanLines(other)).toEqual([]);
    expect(humanLines(mate).map((l) => l.say)).toEqual(["e-laugh"]);
    // To everyone: both teams, marked with the sender's side.
    L.advance(3_000);
    L.core.message(a, { t: "chat", say: "e-fire", to: "all" });
    expect(L.last(a, "chatNo")).toBeUndefined();
    expect(humanLines(other)).toEqual([expect.objectContaining({ from: a, say: "e-fire", to: "all", team: L.core.record.chat!.lines.at(-1)!.team })]);
    expect(humanLines(other)[0]!.team).not.toBeNull();
    expect(humanLines(mate).map((l) => l.say)).toEqual(["e-laugh", "e-fire"]);
    // A pack's emoji still needs the pack.
    L.advance(3_000);
    L.core.message(a, { t: "chat", say: "e-dragon", to: "all" });
    expect(L.last(a, "chatNo")).toMatchObject({ say: "e-dragon", reason: "locked" });
    // The limits: too soon after the last, and a repeat.
    L.core.message(a, { t: "chat", say: "e-clap", to: "all" });
    L.core.message(a, { t: "chat", say: "e-wow", to: "all" });
    expect(L.last(a, "chatNo")).toMatchObject({ say: "e-wow", reason: "gap" });
    L.advance(3_000);
    L.core.message(a, { t: "chat", say: "e-clap", to: "all" });
    expect(L.last(a, "chatNo")).toMatchObject({ say: "e-clap", reason: "repeat" });
    expect(humanLines(other).map((l) => l.say)).toEqual(["e-fire", "e-clap"]);
    // Muted by the other team's player, or their chat off: it doesn't reach them.
    L.core.message(other, { t: "chatPrefs", muted: [a] });
    L.core.message(a, { t: "chat", say: "e-grimace", to: "all" });
    expect(humanLines(other).map((l) => l.say)).toEqual(["e-fire", "e-clap"]);
    L.core.message(other, { t: "chatPrefs", muted: [], off: true });
    L.advance(3_000);
    L.core.message(a, { t: "chat", say: "e-party", to: "all" });
    expect(humanLines(other).map((l) => l.say)).toEqual(["e-fire", "e-clap"]);
    expect(humanLines(mate).map((l) => l.say)).toEqual(["e-laugh", "e-fire", "e-clap", "e-grimace", "e-party"]);
    // Chat off for the sender: they can't send to anyone.
    L.core.message(a, { t: "chatPrefs", off: true });
    L.advance(3_000);
    L.core.message(a, { t: "chat", say: "e-wow", to: "all" });
    expect(L.last(a, "chatNo")).toMatchObject({ say: "e-wow", reason: "off" });
  });

  it("drops anything not on the list, and pack lines the sender doesn't own", () => {
    const { L, a, mate, humanLines, clear } = chatLobby();
    clear();
    for (const say of ["you all stink", "", 42, { id: "gg" }]) L.core.message(a, { t: "chat", say } as never);
    expect(L.last(a, "chatNo")!.reason).toBe("unknown");
    L.core.message(a, { t: "chat", say: "gk-crown" });
    expect(L.last(a, "chatNo")).toMatchObject({ say: "gk-crown", reason: "locked" });
    expect(humanLines(mate)).toEqual([]);
    // Once their account owns the God King pack, it goes.
    L.core.chatOwned(a, ["king-holy", "chat-godking"]);
    L.core.message(a, { t: "chat", say: "gk-crown" });
    expect(humanLines(mate).map((l) => l.say)).toEqual(["gk-crown"]);
  });

  it("enforces the limits: one every 3 s, 5 in 30 s, no repeats", () => {
    const { L, a, mate, humanLines, clear } = chatLobby();
    clear();
    const t0 = L.now;
    L.core.message(a, { t: "chat", say: "nice-move" });
    L.core.message(a, { t: "chat", say: "wow" });
    expect(L.last(a, "chatNo")).toMatchObject({ reason: "gap", retryAt: t0 + 3_000 });
    L.advance(3_000);
    L.core.message(a, { t: "chat", say: "nice-move" });
    expect(L.last(a, "chatNo")).toMatchObject({ reason: "repeat" });
    for (const say of ["wow", "oops", "so-close", "lets-go"]) {
      L.core.message(a, { t: "chat", say });
      L.advance(3_000);
    }
    L.core.message(a, { t: "chat", say: "thanks" });
    expect(L.last(a, "chatNo")).toMatchObject({ reason: "burst", retryAt: t0 + 30_000 });
    expect(humanLines(mate).map((l) => l.say)).toEqual(["nice-move", "wow", "oops", "so-close", "lets-go"]);
    L.advance(30_000 - (L.now - t0));
    L.core.message(a, { t: "chat", say: "thanks" });
    expect(humanLines(mate).map((l) => l.say)).toContain("thanks");
  });

  it("muting a player stops their lines reaching you; chat off stops everything, and back on brings the missed lines", () => {
    const { L, a, mate, humanLines, clear } = chatLobby();
    clear();
    L.core.message(mate, { t: "chatPrefs", muted: [a, "nobody", mate] });
    expect(L.core.record.chat!.muted[mate]).toEqual([a]);
    L.core.message(a, { t: "chat", say: "push-pawns" });
    expect(humanLines(mate)).toEqual([]);
    L.core.message(mate, { t: "chatPrefs", muted: [] });
    L.core.message(mate, { t: "chatPrefs", off: true });
    L.advance(3_000);
    L.core.message(a, { t: "chat", say: "defend-king" });
    expect(humanLines(mate)).toEqual([]);
    // Off: they can't send either.
    L.core.message(mate, { t: "chat", say: "wow" });
    expect(L.last(mate, "chatNo")).toMatchObject({ reason: "off" });
    L.core.message(mate, { t: "chatPrefs", off: false });
    expect(L.last(mate, "chatLog")!.lines.filter((l) => l.from === a).map((l) => l.say)).toEqual(["push-pawns", "defend-king"]);
  });

  it("names come from the lobby; a sender's icon goes with their first line to each player, and again after a rejoin", () => {
    const { L, a, mate, said, clear } = chatLobby({ p1: "♞", p2: "🦊", p3: "🐉" });
    clear();
    L.core.message(a, { t: "chat", say: "wow" });
    L.advance(3_000);
    L.core.message(a, { t: "chat", say: "oops" });
    const lines = said(mate).filter((l) => l.from === a);
    expect(lines.map((l) => l.icon)).toEqual([{ p1: "♞", p2: "🦊", p3: "🐉" }[a], undefined]);
    expect(Object.keys(lines[0]!).sort()).toEqual(["at", "from", "icon", "n", "say", "team", "to"]);
    // A rejoin: the log carries the icon again.
    L.core.disconnect(mate);
    L.core.resendTo(mate);
    const log = L.last(mate, "chatLog")!;
    expect(log.lines.find((l) => l.from === a)!.icon).toBeTruthy();
  });

  it("bots chat a little: hello at the start and GG at the end, from bots, never more than a few a minute", () => {
    const { L, a, team } = chatLobby();
    // The match is over: play it out with nobody picking.
    const st = L.core.record;
    for (let i = 0; i < 400 && st.phase !== "results"; i++) {
      L.hostScores("p1");
      L.advance(5_000);
    }
    expect(st.phase).toBe("results");
    const lines = st.chat!.lines.filter((l) => !l.from.startsWith("p"));
    expect(lines.length).toBeGreaterThan(0);
    const bots = new Set(st.bots.map((b) => b.id));
    for (const l of lines) expect(bots.has(l.from)).toBe(true);
    const at = lines.map((l) => l.at).sort((x, y) => x - y);
    for (const t of at) expect(at.filter((u) => u >= t && u < t + 60_000).length).toBeLessThanOrEqual(3);
    // What each person was sent: lines to everyone, and team lines from their own team's bots.
    for (const m of L.inbox.get(a) ?? []) {
      if (m.t !== "chat" || m.line.from.startsWith("p")) continue;
      expect(m.line.to === "all" || m.line.team === team(a) || m.line.team === null).toBe(true);
      expect(m.line.at).toBeGreaterThan(m.now);
    }
    expect(lines.some((l) => ["gg", "well-played"].includes(l.say))).toBe(true);
  });

  it("boss raid: everyone is one team; Classic has no chat", () => {
    const R = setup({ ...RAID_SETTINGS, bossIntroSeconds: 0 } as Partial<Settings>);
    R.core.connect(undefined, "Ann", "computer");
    R.core.connect(undefined, "Bo", "phone");
    R.core.message("p1", { t: "start" });
    R.core.message("p1", { t: "chat", say: "push-pawns" });
    expect(R.last("p2", "chat")!.line).toMatchObject({ from: "p1", say: "push-pawns", team: null });
    const C = setup();
    C.core.connect(undefined, "Ann", "computer");
    C.core.message("p1", { t: "start" });
    C.core.message("p1", { t: "chat", say: "gg" });
    expect(C.last("p1", "chatNo")).toMatchObject({ reason: "closed" });
    expect(C.last("p1", "chatLog")).toBeUndefined();
  });
});
