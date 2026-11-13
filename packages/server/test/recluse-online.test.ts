import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, HIDDEN_ROOM, LEAVING, RECLUSE_CUTSCENE, RECLUSE_FORMS, RECLUSE_ONLINE, RECLUSE_PHASE2, hiddenRoomSettings, mulberry32, recluseNextForm, type Settings } from "@chessroyale/core";
import { legalMoves, type BoardScore, type MatchRunner, type MoveScore, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord, type PartyLobby } from "../src/lobby.ts";
import { pick, quickMove } from "../src/bosses/recluse.ts";
import { library } from "./lobby-fixture.ts";

/**
 * The Hidden Boss's phase 2 online (Eric, Nov 13: "it plays through till the end"; bosses/recluse.ts): his adult form beaten in his
 * room's fight brings his fall, the cutscene's hold, his phase change for everyone at once and the four boards, run by the server to
 * the result; the admin's "Win this form" in each form; leaving and disconnects.
 */

type Msg = ServerMessage;

/**
 * His room's fight (a party battle of four, as the hub makes it: hiddenRoomSettings, PartyLobby.room): `people` (p1 the admin's,
 * the host) and bots in the other seats. `engine`: an engine server (its searches answered by the test: `searches`, `answer`).
 */
function roomFight(people: number, bots: number, o: { engine?: boolean } = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const searches: { id: string; fen: string }[] = [];
  const party: PartyLobby = {
    admits: Object.fromEntries(Array.from({ length: people }, (_, i) => [`pass${i}`, { seat: i, member: `u${i}`, userId: `u${i}` }])),
    size: people,
    bots,
    leaderSeat: 0,
    startBy: now + HIDDEN_ROOM.joinWaitSec * 1000,
    seats: {},
    partyCode: "",
    startId: 1,
    room: true,
  };
  const overrides = JSON.parse(JSON.stringify(hiddenRoomSettings()));
  const core = new LobbyCore(
    newLobbyRecord("FIGHT", now, overrides, party),
    {
      now: () => now,
      send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]),
      ...(o.engine ? { phase2Search: (req: { id: string; fen: string }) => void searches.push(req) } : {}),
    },
    library,
    mulberry32(7),
    { ...DEFAULT_SETTINGS, ...overrides, lastStandFrom: 999, boardIntroSeconds: 0 } as Settings,
  );
  const last = <K extends Msg["t"]>(id: string, t: K) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: K }> | undefined;
  const all = <K extends Msg["t"]>(id: string, t: K) => (inbox.get(id) ?? []).filter((m) => m.t === t) as Extract<Msg, { t: K }>[];
  const advance = (ms: number) => {
    const to = now + ms;
    while (core.nextAlarm !== null && core.nextAlarm <= to) {
      now = Math.max(now, core.nextAlarm);
      core.alarm();
    }
    now = to;
  };
  const hostScores = () => {
    const req = last("p1", "scoreRequest");
    if (!req) return false;
    const boards: BoardScore[] = req.jobs.map((j) => {
      const legal = legalMoves(j.fen);
      const e = Object.fromEntries(legal.map((m) => [m, 0.4]));
      return { boardId: j.boardId, bestMove: legal[0]!, bestExpected: 0.4, expectedAfter: e, botPicks: Object.fromEntries(j.bots.map((b) => [b.id, legal[0]!])), botThinkMs: {} };
    });
    core.message("p1", { t: "scores", key: req.key, boards });
    inbox.set("p1", (inbox.get("p1") ?? []).filter((m) => m.t !== "scoreRequest"));
    return true;
  };
  for (let i = 0; i < people; i++) expect(core.connect(undefined, `M${i}`, i === 0 ? "computer" : "phone", false, 1500, undefined, `u${i}`, null, null, i === 0, { pass: `pass${i}`, seat: i }).ok).toBe(true);
  const runner = () => (core as unknown as { runner: MatchRunner }).runner;
  /** The engine server's answer to a search: every legal move scored by `score` (default: all equal but the first, best). */
  const answer = (s: { id: string; fen: string }, score: (m: string, i: number) => number = (_m, i) => (i === 0 ? 0.6 : 0.4)) => {
    const moves: MoveScore[] = legalMoves(s.fen).map((m, i) => ({ move: m, expected: score(m, i) }));
    core.phase2Searched(s.id, moves);
  };
  /** The fight begun, then his adult form beaten by the admin's "Win this form" (the team's next move), up to his fall. */
  const beatAdult = () => {
    advance(1000);
    advance(60_000);
    expect(core.record.phase).toBe("play");
    expect(core.winFormTrigger("p1", true)).toBe(true);
    for (let i = 0; i < 40 && !runner().boss!.result; i++) {
      const round = core.record.round;
      if (core.record.phase === "play" && round) {
        const fen = runner().boards.get(runner().state.boards[0]!)!.fen;
        for (let k = 1; k <= people; k++) if (!round.picks[`p${k}`]) core.message(`p${k}`, { t: "pick", key: round.key, move: legalMoves(fen)[0]! });
      }
      hostScores();
      advance(2000);
    }
    expect(runner().boss!.result).toBe("crowd");
  };
  /** On to phase 2's boards, the clocks running. */
  const toBoards = () => {
    const p2 = core.record.recluse2!;
    advance(p2.clocksAt - now + 10);
    expect(core.record.recluse2!.playing).toBe(true);
  };
  const p2 = () => core.record.recluse2!;
  const boardOf = (id: string) => p2().state.boards.find((b) => b.player === id)!;
  return {
    core,
    last,
    all,
    advance,
    hostScores,
    runner,
    inbox,
    searches,
    answer,
    beatAdult,
    toBoards,
    p2,
    boardOf,
    get now() {
      return now;
    },
  };
}

describe("his forms: a list in settings, the child form to go first without touching the online code", () => {
  it("the adult form, then the four boards; the child form, once first, leads to the adult one", () => {
    expect(RECLUSE_FORMS).toEqual(["adult", "four"]);
    expect(recluseNextForm("adult")).toBe("four");
    expect(recluseNextForm("four")).toBeNull();
    expect(recluseNextForm("child", ["child", "adult", "four"])).toBe("adult");
    expect(recluseNextForm("adult", ["child", "adult", "four"])).toBe("four");
  });
});

describe("his phase change online: synced for everyone, after his fall and the cutscene's hold", () => {
  it("beating his adult form (the admin's 🏆): his fall says the phase change follows; at its end everyone gets the cutscene's event and phase 2 with the same times", () => {
    const F = roomFight(2, 2);
    F.beatAdult();
    const fall = F.last("p2", "boss")!;
    expect(fall.fall).toBe(true);
    expect(fall.toPhase2).toBe(true);
    const p2 = F.p2();
    expect(fall.until).toBe(p2.cutAt);
    expect(p2.cutAt - fall.now).toBe(RECLUSE_PHASE2.change.fallMs);
    // (Nothing told before the fall ends: no phase 2 message, the phase still the boss's.)
    expect(F.last("p1", "phase2")).toBeUndefined();
    expect(F.core.record.phase).toBe("boss");
    F.advance(p2.cutAt - F.now);
    expect(F.core.record.phase).toBe("phase2");
    for (const id of ["p1", "p2"]) {
      const cut = F.last(id, "recluseCutscene")!;
      expect(cut).toMatchObject({ at: p2.cutAt, until: p2.at });
      expect(cut.until - cut.at).toBe(RECLUSE_CUTSCENE.holdMs);
      const v = F.last(id, "phase2")!.p2;
      expect(v.at).toBe(p2.at);
      expect(v.clocksAt).toBe(p2.at + RECLUSE_ONLINE.changeMs + RECLUSE_PHASE2.change.countdownSeconds * 1000);
      // (No clock runs before the boards are played.)
      expect(v.boards.every((b) => b.turnAt === null && !b.result)).toBe(true);
    }
    // The four boards in seat order: the people on theirs, the room's bots on the rest; each from its own Chess960 start.
    const v = F.last("p1", "phase2")!.p2;
    expect(v.boards.map((b) => b.player).slice(0, 2)).toEqual(["p1", "p2"]);
    expect(v.boards).toHaveLength(4);
    expect(new Set(v.boards.map((b) => b.number)).size).toBe(4);
    expect(v.boards.every((b) => b.history.length === 0)).toBe(true);
    // (A reconnect gets it again: it's the last thing told.)
    expect(F.core.record.last["p2"]?.t).toBe("phase2");
  });

  it("nobody moves before the clocks: a move in the countdown is refused (and its sender told phase 2 again); at the clocks, the bots' first moves are asked", () => {
    const F = roomFight(1, 3);
    F.beatAdult();
    F.advance(F.p2().cutAt - F.now);
    const key = F.p2().key;
    const mine = F.boardOf("p1");
    const told = F.all("p1", "phase2").length;
    F.core.message("p1", { t: "phase2Move", key, board: mine.id, move: legalMoves(mine.board.fen)[0]! });
    expect(F.boardOf("p1").board.history).toHaveLength(0);
    expect(F.all("p1", "phase2").length).toBe(told + 1);
    // (The host's device is asked: no engine server here.)
    expect(F.all("p1", "phase2Ask")).toHaveLength(0);
    F.toBoards();
    expect(F.all("p1", "phase2Ask")).toHaveLength(3);
    expect(F.last("p1", "phase2Ask")!.elo).toBe(RECLUSE_PHASE2.botElo);
  });
});

describe("the four boards online: the server runs them", () => {
  it("a person's move: only theirs, on their move, legal; his reply from the engine server is its best; a bot's within botLoss, after its thinking", () => {
    const F = roomFight(2, 2, { engine: true });
    F.beatAdult();
    F.toBoards();
    const key = F.p2().key;
    const mine = F.boardOf("p1");
    const theirs = F.boardOf("p2");
    const move = legalMoves(mine.board.fen)[0]!;
    // (Not your board; not legal: refused.)
    F.core.message("p1", { t: "phase2Move", key, board: theirs.id, move: legalMoves(theirs.board.fen)[0]! });
    F.core.message("p1", { t: "phase2Move", key, board: mine.id, move: "a1a1" });
    expect(F.boardOf("p2").board.history).toHaveLength(0);
    expect(F.boardOf("p1").board.history).toHaveLength(0);
    F.advance(300);
    const thought = F.now - F.p2().clocksAt;
    F.core.message("p1", { t: "phase2Move", key, board: mine.id, move, away: 2 });
    expect(F.boardOf("p1").board.history).toEqual([move]);
    // His reply: the engine server's best (here the last legal move scores highest).
    const his = F.searches.find((s) => s.fen === F.boardOf("p1").board.fen)!;
    expect(his).toBeTruthy();
    const legal = legalMoves(his.fen);
    F.answer(his, (_m, i) => (i === legal.length - 1 ? 0.7 : 0.3));
    expect(F.boardOf("p1").board.history).toEqual([move, legal[legal.length - 1]]);
    // Fair play: your move's position scored on the engine server, kept as a FairMove (no crowd: your board alone).
    const fairSearch = F.searches.find((s) => s.fen === mine.board.fen)!;
    F.answer(fairSearch, (_m, i) => (i === 0 ? 0.62 : 0.5));
    const fair = F.core.record.fair?.["p1"] ?? [];
    expect(fair).toHaveLength(1);
    expect(fair[0]).toMatchObject({ move, best: legalMoves(mine.board.fen)[0], loss: 0, crowd: 0, away: 2, thinkMs: thought });
    // A bot's move comes after its thinking, whatever the engine server's speed.
    // (The bot that thinks longest: its move waits for its time; a bot whose time has passed plays as the answer comes.)
    const bots = F.p2().state.boards.filter((b) => !["p1", "p2"].includes(b.player));
    const bot = bots.reduce((a, b) => (F.p2().botAt[b.id]! > F.p2().botAt[a.id]! ? b : a));
    const early = bots.find((b) => b !== bot)!;
    const moved = (id: number) => F.p2().state.boards.find((b) => b.id === id)!.board.history.length;
    F.advance(-1);
    const due = F.p2().botAt[bot.id]!;
    expect(due).toBeGreaterThan(F.now);
    F.answer(F.searches.find((s) => s.fen === bot.board.fen)!);
    expect(moved(bot.id)).toBe(0);
    F.advance(due - F.now + 1);
    expect(moved(bot.id)).toBe(1);
    expect(F.p2().botAt[early.id]!).toBeLessThan(F.now);
    F.answer(F.searches.find((s) => s.fen === early.board.fen)!);
    expect(moved(early.id)).toBe(1);
    // (Nothing asked of a device: the engine server played it all.)
    expect(F.all("p1", "phase2Ask")).toHaveLength(0);
  });

  it("no engine server: the host's device plays his moves and the bots' (one device's word: the match pays as a solo game); none from it in time, the server's quick move", () => {
    const F = roomFight(1, 3);
    F.beatAdult();
    F.toBoards();
    const ask = F.last("p1", "phase2Ask")!;
    const bot = F.p2().state.boards.find((b) => b.board.fen === ask.fen && b.player !== "p1")!;
    F.core.message("p1", { t: "phase2Answer", id: ask.id, move: legalMoves(ask.fen)[1]! });
    expect(F.core.record.unvouched).toBeTruthy();
    F.advance(RECLUSE_PHASE2.botMoveMs[1] + 100);
    expect(F.p2().state.boards.find((b) => b.id === bot.id)!.board.history).toEqual([legalMoves(ask.fen)[1]]);
    // Another bot's ask, never answered: the quick move after askMs.
    const other = F.p2().state.boards.find((b) => b.player !== "p1" && b.id !== bot.id && b.board.history.length === 0);
    if (other) {
      F.advance(RECLUSE_ONLINE.askMs + 100);
      expect(F.p2().state.boards.find((b) => b.id === other.id)!.board.history.length).toBeGreaterThan(0);
    }
  });

  it("every board won: the results are his defeat, \"4 of 4\", after his reaction; a board lost on time: his, however many are won", () => {
    const F = roomFight(1, 3, { engine: true });
    F.beatAdult();
    F.toBoards();
    // (The admin's 🏆, and the team's next move: a bot's.)
    expect(F.core.winFormTrigger("p1", true)).toBe(true);
    expect(F.last("p1", "phase2")!.p2.winNext).toBe(true);
    for (const s of F.searches.splice(0)) F.answer(s);
    F.advance(RECLUSE_PHASE2.botMoveMs[1] + 100);
    const done = F.p2().done!;
    expect(done).toMatchObject({ beaten: true, won: 4, of: 4 });
    expect(F.core.record.phase).toBe("phase2");
    F.advance(done.until - F.now);
    expect(F.core.record.phase).toBe("results");
    const res = F.last("p1", "results")!;
    expect(res.bossResult).toBe("crowd");
    expect(res.simul).toEqual({ won: 4, of: 4 });

    // A board lost (your clock run out), the rest won: he wins, 3 of 4.
    const G = roomFight(1, 3, { engine: true });
    G.beatAdult();
    G.toBoards();
    G.advance(RECLUSE_PHASE2.bankSeconds * 1000 + 100);
    expect(G.boardOf("p1").result).toMatchObject({ winner: "boss", how: "time" });
    expect(G.core.winFormTrigger("p1", true)).toBe(true);
    for (const s of G.searches.splice(0)) G.answer(s);
    for (let i = 0; i < 20 && !G.p2().done; i++) {
      for (const s of G.searches.splice(0)) G.answer(s);
      G.advance(1000);
    }
    expect(G.p2().done).toMatchObject({ beaten: false, won: 3, of: 4 });
    G.advance(RECLUSE_PHASE2.endMs + 10);
    expect(G.last("p1", "results")).toMatchObject({ bossResult: "boss", simul: { won: 3, of: 4 } });
  });
});

describe("the admin's Win this form in every form online (server-checked)", () => {
  it("the adult form (the next move beats it), then the four boards (the team's next move wins every one): refused for a player", () => {
    const F = roomFight(2, 2, { engine: true });
    F.beatAdult();
    // (During his fall and phase change: a player's refused; the admin's arms the four boards, armed once.)
    expect(F.core.winFormTrigger("p2", false)).toBe(false);
    expect(F.core.winFormTrigger("p2", true)).toBe(true);
    expect(F.p2().winNext).toBe(true);
    F.toBoards();
    const key = F.p2().key;
    const mine = F.boardOf("p1");
    // A person's move is the team's next move: every board won.
    F.core.message("p1", { t: "phase2Move", key, board: mine.id, move: legalMoves(mine.board.fen)[0]! });
    expect(F.p2().done).toMatchObject({ beaten: true, won: 4 });
    expect(F.p2().winNext).toBeUndefined();
    // (Once it's decided: nothing more to win.)
    expect(F.core.winFormTrigger("p1", true)).toBe(false);
    expect(F.core.record.overrides?.tested).toBe(true);
  });
});

describe("the admins' ultimate trigger in phase 2 (as solo's)", () => {
  it("brings his \"5 SECONDS!\" once the clocks run: every move then has its few seconds", () => {
    const F = roomFight(1, 3, { engine: true });
    F.beatAdult();
    expect(F.core.ultimateTrigger("p1", true)).toBe(false);
    F.toBoards();
    expect(F.core.ultimateTrigger("p1", false)).toBe(false);
    expect(F.core.ultimateTrigger("p1", true)).toBe(true);
    expect(F.p2().state.ultAt).toBe(F.now);
    expect(F.last("p1", "phase2")!.p2.ultAt).toBe(F.now);
    expect(F.core.ultimateTrigger("p1", true)).toBe(false);
  });
});

describe("leaving and disconnects in phase 2: a seat gone, its bot plays the board", () => {
  it("a resign: their board is a bot's (it plays on), their result a loss; the others play on", () => {
    const F = roomFight(2, 2, { engine: true });
    F.beatAdult();
    F.toBoards();
    const board = F.boardOf("p2").id;
    F.core.message("p2", { t: "resign" });
    const now = F.p2().state.boards.find((b) => b.id === board)!;
    expect(now.player).not.toBe("p2");
    expect(F.p2().names[now.player]).toBeTruthy();
    expect(F.last("p1", "phase2")!.p2.boards.find((b) => b.id === board)!.player).toBe(now.player);
    // (Its move is asked as a bot's: a search of its position.)
    expect(F.searches.some((s) => s.fen === now.board.fen)).toBe(true);
    const left = F.core.record.left!.find((l) => l.id === "p2")!;
    expect(left.how).toBe("resigned");
    expect(left.result?.teamWon).toBe(false);
    expect(F.core.record.phase).toBe("phase2");
  });

  it("a disconnect: their clock runs; gone longer than LEAVING.awayMs, a bot takes their board. Everyone gone: the match ends, his", () => {
    const F = roomFight(2, 2, { engine: true });
    F.beatAdult();
    F.toBoards();
    F.core.disconnect("p2");
    F.advance(LEAVING.awayMs + 1000);
    expect(F.p2().state.boards.some((b) => b.player === "p2")).toBe(false);
    F.core.disconnect("p1");
    F.advance(LEAVING.awayMs + 1000);
    expect(F.core.record.phase).toBe("results");
    expect(F.runner().boss!.result).toBe("boss");
  });
});

describe("his move and the bots' from the engine server's numbers; the quick move with none", () => {
  it("he plays the best; a bot one within botLoss of it", () => {
    const scores = [
      { move: "a", expected: 0.5 },
      { move: "b", expected: 0.62 },
      { move: "c", expected: 0.6 },
      { move: "d", expected: 0.2 },
    ];
    expect(pick(scores, "boss", () => 0.99)).toBe("b");
    const seen = new Set(Array.from({ length: 20 }, (_, i) => pick(scores, "bot", () => i / 20)));
    expect([...seen].sort()).toEqual(["b", "c"]);
  });

  it("the quick move takes the most valuable piece it can, else plays the first legal move", () => {
    expect(quickMove("4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1")).toBe("e4d5");
    const fen = "4k3/8/8/8/8/8/8/4K2R w - - 0 1";
    expect(quickMove(fen)).toBe(legalMoves(fen)[0]);
  });
});
