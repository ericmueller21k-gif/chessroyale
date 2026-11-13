import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, HIDDEN_ROOM, LEAVING, RECLUSE_CUTSCENE, RECLUSE_FORMS, RECLUSE_ONLINE, RECLUSE_PHASE2, hiddenRoomSettings, mulberry32, recluseNextForm, type Settings } from "@chessroyale/core";
import { applyMove, bankLeft, legalMoves, type BoardScore, type MatchRunner, type MoveScore, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord, type PartyLobby } from "../src/lobby.ts";
import { phase2NoResult, phase2Unvouched, pick, quickMove, withMates } from "../src/bosses/recluse.ts";
import { library } from "./lobby-fixture.ts";

// (The engine server is a Container, which needs the Workers runtime: the match rooms import it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, serverAllMovesAt: async () => null, warmEngine: async () => false }));
const { lobbyXpGame, writeResult } = await import("../src/lobby-do.ts");

/**
 * The Hidden Boss's phase 2 online (Eric, Nov 13: "it plays through till the end"; bosses/recluse.ts): his adult form beaten in his
 * room's fight brings his fall, the cutscene's hold, his phase change for everyone at once and the four boards, run by the server to
 * the result; the admin's "Win this form" in each form; leaving and disconnects.
 */

type Msg = ServerMessage;

/**
 * His room's fight (a party battle of four, as the hub makes it: hiddenRoomSettings, PartyLobby.room): `people` (p1 the admin's,
 * the host) and bots in the other seats. `engine`: an engine server (its searches answered by the test: `searches`, `answer`); `auto`:
 * one that answers every search as time goes on (`advance`), each legal move scored as `answer` does.
 */
function roomFight(people: number, bots: number, o: { engine?: boolean; auto?: boolean } = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const searches: { id: string; fen: string; boss?: true }[] = [];
  let warms = 0;
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
      ...(o.engine || o.auto ? { phase2Search: (req: { id: string; fen: string; boss?: true }) => void searches.push(req), warmEngine: () => void warms++ } : {}),
    },
    library,
    mulberry32(7),
    { ...DEFAULT_SETTINGS, ...overrides, lastStandFrom: 999, boardIntroSeconds: 0 } as Settings,
  );
  const last = <K extends Msg["t"]>(id: string, t: K) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: K }> | undefined;
  const all = <K extends Msg["t"]>(id: string, t: K) => (inbox.get(id) ?? []).filter((m) => m.t === t) as Extract<Msg, { t: K }>[];
  // (`auto`: every search waiting answered, and those its answers bring, as time goes on.)
  const drain = () => {
    for (let i = 0; o.auto && i < 20 && searches.length; i++) for (const s of searches.splice(0)) answer(s);
  };
  const advance = (ms: number) => {
    const to = now + ms;
    drain();
    while (core.nextAlarm !== null && core.nextAlarm <= to) {
      now = Math.max(now, core.nextAlarm);
      core.alarm();
      drain();
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
    get warms() {
      return warms;
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
    F.core.message("p1", { t: "phase2Move", key, board: mine.id, move: legalMoves(mine.board.fen)[0]!, ply: 0 });
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
    // (As a real fight: the 🏆 that brought phase 2 here made this one a test, and a test fight's moves aren't kept for fair play.)
    delete F.core.record.overrides!.tested;
    F.toBoards();
    const key = F.p2().key;
    const mine = F.boardOf("p1");
    const theirs = F.boardOf("p2");
    const move = legalMoves(mine.board.fen)[0]!;
    // (Not your board; not legal: refused.)
    F.core.message("p1", { t: "phase2Move", key, board: theirs.id, move: legalMoves(theirs.board.fen)[0]!, ply: 0 });
    F.core.message("p1", { t: "phase2Move", key, board: mine.id, move: "a1a1", ply: 0 });
    expect(F.boardOf("p2").board.history).toHaveLength(0);
    expect(F.boardOf("p1").board.history).toHaveLength(0);
    F.advance(300);
    const thought = F.now - F.p2().clocksAt;
    F.core.message("p1", { t: "phase2Move", key, board: mine.id, move, away: 2, ply: 0 });
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

  it("no engine server set up (local runs, the e2e suite): a bot's move from the host's device (nothing unvouched), none in time the quick move; his, the server's quick move at once (phase 2's result unvouched), never a device's", () => {
    const F = roomFight(1, 3);
    F.beatAdult();
    // (Phase 1 vouched for, as with judges in production: the harness's host scored its rounds alone.)
    delete F.core.record.unvouched;
    F.toBoards();
    const ask = F.last("p1", "phase2Ask")!;
    expect(ask).toMatchObject({ elo: RECLUSE_PHASE2.botElo, nodes: RECLUSE_PHASE2.botNodes });
    const bot = F.p2().state.boards.find((b) => b.board.fen === ask.fen && b.player !== "p1")!;
    const played = legalMoves(ask.fen)[1]!;
    F.core.message("p1", { t: "phase2Answer", id: ask.id, move: played });
    expect(F.core.record.unvouched).toBeUndefined();
    expect(F.p2().unvouched).toBeUndefined();
    F.advance(RECLUSE_PHASE2.botMoveMs[1] + 100);
    // (His reply: the server's quick move, at once.)
    const after = applyMove(ask.fen, played);
    expect(F.p2().state.boards.find((b) => b.id === bot.id)!.board.history.slice(0, 2)).toEqual([played, quickMove(after)]);
    // Another bot's ask, never answered: the quick move after askMs.
    const other = F.p2().state.boards.find((b) => b.player !== "p1" && b.id !== bot.id && b.board.history.length === 0);
    if (other) {
      F.advance(RECLUSE_ONLINE.askMs + 100);
      expect(F.p2().state.boards.find((b) => b.id === other.id)!.board.history.length).toBeGreaterThan(0);
    }
    // (Never his move asked of a device: every ask is a bot's. His quick move unvouches phase 2's result alone.)
    expect(F.all("p1", "phase2Ask").every((a) => a.elo === RECLUSE_PHASE2.botElo && a.fen !== after)).toBe(true);
    expect(F.p2().unvouched).toBe("his move was the server's quick move (no engine server here)");
    expect(F.core.record.unvouched).toBeUndefined();
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
    // (An engine server that answers as time goes on: his moves come, and nothing pauses the clocks. Your bank cut to 2 s, so your
    // flag falls before the bots' slow moves bring his ultimate, where no flag falls.)
    const G = roomFight(1, 3, { auto: true });
    G.beatAdult();
    G.toBoards();
    G.p2().state = { ...G.p2().state, boards: G.p2().state.boards.map((b) => (b.player === "p1" ? { ...b, bankMs: 2000 } : b)) };
    G.advance(2100);
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
    F.core.message("p1", { t: "phase2Move", key, board: mine.id, move: legalMoves(mine.board.fen)[0]!, ply: 0 });
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
    const F = roomFight(2, 2, { auto: true });
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

/** Phase 1 vouched for (as with judges in production), on to the boards with no engine server: a bot's move asked of the host's device. */
function botMoveAsked(F: ReturnType<typeof roomFight>) {
  delete F.core.record.unvouched;
  delete F.core.record.overrides!.tested;
  F.toBoards();
  const w = Object.values(F.p2().work).find((x) => x.who === "bot" && x.via === "device")!;
  expect(w).toBeTruthy();
  const board = F.p2().state.boards.find((b) => b.board.fen === w.fen && !["p1", "p2"].includes(b.player))!.id;
  return { fen: w.fen, w, board };
}

describe("the review of #677, M1: a phase 2 ask (a bot's move: never his) follows the host", () => {
  it("the host drops with a bot's move asked of it: the new host is asked, with a fresh time, and its answer plays (not the quick move)", () => {
    const F = roomFight(2, 2);
    F.beatAdult();
    const { fen, w, board } = botMoveAsked(F);
    expect(w.device).toBe("p1");
    F.advance(RECLUSE_ONLINE.askMs - 1000);
    const before = F.all("p2", "phase2Ask").length;
    F.core.disconnect("p1");
    const asks = F.all("p2", "phase2Ask").slice(before);
    expect(asks.find((a) => a.id === w.id)).toMatchObject({ fen, elo: RECLUSE_PHASE2.botElo });
    expect(F.p2().work[board]).toMatchObject({ device: "p2", at: F.now });
    // (Past the first ask's time: still waiting for the new host's answer.)
    F.advance(2000);
    expect(F.p2().state.boards.find((x) => x.id === board)!.board.history).toHaveLength(0);
    const move = legalMoves(fen).at(-1)!;
    // (The old host's late answer: refused; the new host's: played, once the bot has thought its while.)
    F.core.message("p1", { t: "phase2Answer", id: w.id, move: legalMoves(fen)[0]! });
    expect(F.p2().work[board]!.move).toBeUndefined();
    F.core.message("p2", { t: "phase2Answer", id: w.id, move });
    F.advance(RECLUSE_PHASE2.botSlowMs[1]);
    expect(F.p2().state.boards.find((x) => x.id === board)!.board.history[0]).toBe(move);
  });

  it("an honest host's reload: back (resendTo, as the Durable Object does), it's asked again for every move still asked of it, with a fresh time", () => {
    const F = roomFight(1, 3);
    F.beatAdult();
    const { fen, w, board } = botMoveAsked(F);
    const open = () =>
      Object.values(F.p2().work)
        .filter((x) => x.via === "device" && !x.move)
        .map((x) => x.id)
        .sort();
    F.advance(RECLUSE_ONLINE.askMs - 1000);
    F.core.disconnect("p1");
    const before = F.all("p1", "phase2Ask").length;
    const token = F.core.record.humans.find((h) => h.id === "p1")!.token;
    expect(F.core.connect(token, "M0", "computer", false, 1500, undefined, "u0", null, null, true).ok).toBe(true);
    F.core.resendTo("p1");
    const again = F.all("p1", "phase2Ask").slice(before);
    expect(again.map((a) => a.id).sort()).toEqual(open());
    expect(again.map((a) => a.id)).toContain(w.id);
    F.advance(2000);
    const move = legalMoves(fen).at(-1)!;
    F.core.message("p1", { t: "phase2Answer", id: w.id, move });
    F.advance(RECLUSE_PHASE2.botSlowMs[1]);
    expect(F.p2().state.boards.find((x) => x.id === board)!.board.history[0]).toBe(move);
  });
});

describe("the review of #677, M2: an engine server miss in phase 2 reaches phase 2's result only", () => {
  it("the engine server woken as phase 2 begins (his fall and phase change are its time to boot)", () => {
    const F = roomFight(1, 3, { engine: true });
    expect(F.warms).toBe(0);
    F.beatAdult();
    expect(F.warms).toBe(1);
  });

  it("his quick move with no engine server set up: phase 2's result unvouched (its players: not ranked, a solo game's XP, the results say so); the match's flag, its fair play and anyone else's result stand", () => {
    const F = roomFight(2, 2);
    F.beatAdult();
    const fair = { ply: 1 } as never;
    F.core.record.fair = { p1: [fair] };
    delete F.core.record.unvouched;
    delete F.core.record.overrides!.tested;
    F.toBoards();
    const mine = F.boardOf("p2");
    F.core.message("p2", { t: "phase2Move", key: F.p2().key, board: mine.id, move: legalMoves(mine.board.fen)[0]!, ply: 0 });
    F.advance(10);
    expect(F.boardOf("p2").board.history).toHaveLength(2);
    expect(F.p2().unvouched).toBeTruthy();
    expect(F.core.record.unvouched).toBeUndefined();
    expect(F.core.record.fair?.["p1"]).toEqual([fair]);
    // (Everyone who played a board: p1 and p2; nobody else.)
    expect(phase2Unvouched(F.core.record, "p1")).toBe(true);
    expect(phase2Unvouched(F.core.record, "p2")).toBe(true);
    expect(phase2Unvouched(F.core.record, "someone watching")).toBe(false);
    const result = { playerId: "p1", placement: 1, teamWon: true };
    expect(lobbyXpGame(F.core.record, result, "u0", { moves: 20, ms: 600_000 }, "crowd", [], true, F.now).cap).toBe("solo");
    expect(lobbyXpGame(F.core.record, { ...result, playerId: "someone watching" }, "u9", { moves: 20, ms: 600_000 }, "crowd", [], true, F.now).cap).not.toBe("solo");
    // To the results (the admin's 🏆, the team's next move): theirs say it pays as a solo game; not ranked even where the match is.
    (F.core as unknown as { ranked: () => boolean }).ranked = () => true;
    expect(F.core.winFormTrigger("p1", true)).toBe(true);
    F.advance(RECLUSE_PHASE2.botMoveMs[1] + RECLUSE_ONLINE.askMs + 100);
    F.advance(RECLUSE_PHASE2.endMs + 100);
    expect(F.core.record.phase).toBe("results");
    for (const id of ["p1", "p2"]) expect(F.last(id, "results")).toMatchObject({ unvouched: true, ranked: false });
    expect(F.core.humanResults().every((r) => r.ranked === false)).toBe(true);
  });
});

describe("the review of #677, minors", () => {
  it("m1: everyone's told phase 2 lean (no standings, no battle); what a reconnect gets carries them", () => {
    const F = roomFight(2, 2, { engine: true });
    F.beatAdult();
    F.toBoards();
    const told = F.all("p2", "phase2");
    expect(told.length).toBeGreaterThan(1);
    for (const m of told) expect(m.standings === undefined && m.boss === undefined).toBe(true);
    const last = F.core.record.last["p2"] as Extract<Msg, { t: "phase2" }>;
    expect(last.t).toBe("phase2");
    expect(last.standings?.length).toBeGreaterThan(0);
    expect(last.boss?.id).toBe("recluse");
    // (One copy for everyone's, so it's stored once.)
    expect(F.core.record.last["p1"]).toBe(last);
  });

  it("m2: a move carries its board's move count; one made on a position gone is refused (told so), never played as the next", () => {
    const F = roomFight(1, 3, { engine: true });
    F.beatAdult();
    F.toBoards();
    const key = F.p2().key;
    const mine = F.boardOf("p1");
    const first = legalMoves(mine.board.fen)[0]!;
    F.core.message("p1", { t: "phase2Move", key, board: mine.id, move: first, ply: 0 });
    const his = F.searches.find((s) => s.fen === F.boardOf("p1").board.fen)!;
    F.answer(his);
    const history = [...F.boardOf("p1").board.history];
    expect(history).toHaveLength(2);
    // (A second move chosen on the start position, sent with its ply 0: refused, even where it's legal now.)
    const stale = legalMoves(F.boardOf("p1").board.fen).find((m) => legalMoves(mine.board.fen).includes(m))!;
    expect(stale).toBeTruthy();
    const told = F.all("p1", "phase2").length;
    F.core.message("p1", { t: "phase2Move", key, board: mine.id, move: stale, ply: 0 });
    expect(F.boardOf("p1").board.history).toEqual(history);
    expect(F.all("p1", "phase2").length).toBe(told + 1);
    expect(F.all("p1", "phase2").at(-1)!.refused).toBe(true);
    // (Not remembered: a reconnect gets the last told to everyone, with the battle and the standings.)
    expect((F.core.record.last["p1"] as Extract<Msg, { t: "phase2" }>).refused).toBeUndefined();
    // Its right count: played.
    F.core.message("p1", { t: "phase2Move", key, board: mine.id, move: stale, ply: 2 });
    expect(F.boardOf("p1").board.history).toEqual([...history, stale]);
  });

  it("m3: his fall says who takes the boards (the four, in board order)", () => {
    const F = roomFight(2, 2);
    F.beatAdult();
    const fall = F.last("p1", "boss")!;
    expect(fall.toPhase2).toBe(true);
    expect(fall.phase2Boards).toEqual(F.p2().state.boards.map((b) => b.player));
    expect(fall.phase2Boards!.slice(0, 2)).toEqual(["p1", "p2"]);
  });

  it("m4: a test fight (the admins' 🏆 or ultimate trigger) keeps no fair-play moves, and spends no search on them", () => {
    const F = roomFight(1, 3, { engine: true });
    F.beatAdult();
    expect(F.core.record.overrides?.tested).toBe(true);
    F.toBoards();
    const mine = F.boardOf("p1");
    F.core.message("p1", { t: "phase2Move", key: F.p2().key, board: mine.id, move: legalMoves(mine.board.fen)[0]!, ply: 0 });
    expect(F.boardOf("p1").board.history).toHaveLength(1);
    expect(F.searches.some((s) => s.fen === mine.board.fen)).toBe(false);
    expect(Object.keys(F.p2().fair)).toHaveLength(0);
  });

  it("m5: the last one here resigns, so the match ends at once: the bot that takes their board asks no search (it would be thrown away)", () => {
    const F = roomFight(1, 3, { engine: true });
    F.beatAdult();
    F.toBoards();
    const mine = F.boardOf("p1");
    const asked = F.searches.length;
    F.core.message("p1", { t: "resign" });
    expect(F.core.record.phase).toBe("results");
    expect(F.searches.slice(asked).filter((s) => s.fen === mine.board.fen)).toHaveLength(0);
    // (While someone else is here, the bot's move is asked as ever: the resign test above.)
  });

  it("m6: phase 2's view says when the cutscene's hold begins (`cutAt`), so a device back during it knows the scene", () => {
    const F = roomFight(1, 3);
    F.beatAdult();
    F.advance(F.p2().cutAt - F.now);
    const v = F.last("p1", "phase2")!.p2;
    expect(v.cutAt).toBe(F.p2().cutAt);
    expect(v.at - v.cutAt).toBe(RECLUSE_CUTSCENE.holdMs);
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

  it("a mate scored: the quickest, a bot's too (the review's nit: in a won position every move scores near 1)", () => {
    const won = [
      { move: "a", expected: 0.999 },
      { move: "b", expected: 0.999, mate: 3 },
      { move: "c", expected: 0.998, mate: 1 },
      { move: "d", expected: 0.2, mate: -2 },
    ];
    for (let i = 0; i < 10; i++) expect(pick(won, "bot", () => i / 10)).toBe("c");
    expect(pick(won, "boss", () => 0)).toBe("c");
  });

  it("the quick move takes the most valuable piece it can, else plays the first legal move", () => {
    expect(quickMove("4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1")).toBe("e4d5");
    const fen = "4k3/8/8/8/8/8/8/4K2R w - - 0 1";
    expect(quickMove(fen)).toBe(legalMoves(fen)[0]);
  });
});

describe("his moves from the engine server only (Eric, Nov 13: \"we can't have him breaking\"; never a device's, never a quick move)", () => {
  /** A real fight on the boards (fair play kept), your first move made: his reply asked of the engine server. */
  const hisReply = (F: ReturnType<typeof roomFight>) => {
    delete F.core.record.overrides!.tested;
    F.toBoards();
    const mine = F.boardOf("p1");
    F.core.message("p1", { t: "phase2Move", key: F.p2().key, board: mine.id, move: legalMoves(mine.board.fen)[0]!, ply: 0 });
    const fen = F.boardOf("p1").board.fen;
    return { fen, from: mine.board.fen, tries: () => F.searches.filter((s) => s.boss && s.fen === fen) };
  };

  it("an empty answer is tried again (retryMs, then twice as long); an earlier try's empty answer adds no try; any try's answer plays; nothing is asked of a device. A bot's empty answer: the host's device, at a bot's strength", () => {
    const F = roomFight(1, 3, { engine: true });
    F.beatAdult();
    const { fen, tries } = hisReply(F);
    expect(tries()).toHaveLength(1);
    // (His searches are his own share's: `boss`. A bot's or a person's fair play: the match's.)
    expect(F.searches.filter((s) => s.boss).every((s) => s.fen === fen)).toBe(true);
    F.core.phase2Searched(tries()[0]!.id, null);
    F.advance(RECLUSE_ONLINE.retryMs - 1);
    expect(tries()).toHaveLength(1);
    F.advance(2);
    expect(tries()).toHaveLength(2);
    // (The first try's empty answer again, late: no third try; the second's: one, twice as long after.)
    F.core.phase2Searched(tries()[0]!.id, null);
    F.core.phase2Searched(tries()[1]!.id, null);
    F.advance(RECLUSE_ONLINE.retryMs * 2 - 1);
    expect(tries()).toHaveLength(2);
    F.advance(2);
    expect(tries()).toHaveLength(3);
    // (The second try's answer, late: it plays, the same position.)
    const legal = legalMoves(fen);
    F.answer(tries()[1]!, (_m, i) => (i === legal.length - 1 ? 0.7 : 0.3));
    expect(F.boardOf("p1").board.history[1]).toBe(legal.at(-1));
    expect(F.all("p1", "phase2Ask").some((a) => a.fen === fen || a.elo === RECLUSE_PHASE2.elo)).toBe(false);
    // A bot's search come back empty: the host's device plays it, at a bot's strength.
    const bot = F.searches.find((s) => !s.boss && F.p2().state.boards.some((b) => b.player !== "p1" && b.board.fen === s.fen))!;
    F.core.phase2Searched(bot.id, null);
    expect(F.last("p1", "phase2Ask")).toMatchObject({ fen: bot.fen, elo: RECLUSE_PHASE2.botElo });
  });

  it("a slow answer: every board's clock pauses at pauseMs (told to everyone; no move, flag or ultimate meanwhile), then runs on from where it stood once his move is in", () => {
    const F = roomFight(2, 2, { engine: true });
    F.beatAdult();
    const { tries } = hisReply(F);
    const asked = F.now;
    // (Your partner's bank cut to 5 s, so it would run out within the pause: its 2 minutes are longer than serverWaitMs.)
    F.p2().state = { ...F.p2().state, boards: F.p2().state.boards.map((b) => (b.player === "p2" ? { ...b, bankMs: 5000 } : b)) };
    F.advance(RECLUSE_ONLINE.pauseMs - 10);
    expect(F.p2().paused).toBeUndefined();
    F.advance(20);
    expect(F.p2().paused).toBe(asked + RECLUSE_ONLINE.pauseMs);
    for (const id of ["p1", "p2"]) expect(F.last(id, "phase2")!.p2.paused).toBe(asked + RECLUSE_ONLINE.pauseMs);
    // (Your partner's clock stands still: their move is refused, and nothing flags, long past their bank.)
    const theirs = F.boardOf("p2");
    const left = bankLeft(theirs, F.p2().paused!);
    F.core.message("p2", { t: "phase2Move", key: F.p2().key, board: theirs.id, move: legalMoves(theirs.board.fen)[0]!, ply: 0 });
    expect(F.boardOf("p2").board.history).toHaveLength(0);
    expect(F.last("p2", "phase2")!.refused).toBe(true);
    expect(F.core.ultimateTrigger("p1", true)).toBe(false);
    const turnAt = F.boardOf("p2").turnAt!;
    F.advance(left + 20_000);
    expect(F.p2().done).toBeUndefined();
    expect(F.boardOf("p2").result).toBeNull();
    expect(F.p2().state.boards.every((b) => b.player === "p1" || b.board.history.length === 0)).toBe(true);
    // His move in (a try's answer): the clocks run on from where they stood, his move played.
    const pause = F.now - F.p2().paused!;
    F.answer(tries().at(-1)!);
    expect(F.p2().paused).toBeUndefined();
    expect(F.last("p2", "phase2")!.p2.paused).toBeUndefined();
    expect(F.boardOf("p1").board.history).toHaveLength(2);
    expect(F.boardOf("p2").turnAt).toBe(turnAt + pause);
    expect(bankLeft(F.boardOf("p2"), F.now)).toBe(left);
    F.core.message("p2", { t: "phase2Move", key: F.p2().key, board: theirs.id, move: legalMoves(theirs.board.fen)[0]!, ply: 0 });
    expect(F.boardOf("p2").board.history).toHaveLength(1);
  });

  it("no answer in serverWaitMs: the fight ends with no result; nothing counts (not ranked, no XP or result row), phase 2's fair-play moves dropped, those before it kept", async () => {
    const F = roomFight(2, 2, { engine: true });
    F.beatAdult();
    // (Phase 1 vouched for, as with judges in production; and a fair-play move of its, before phase 2.)
    delete F.core.record.unvouched;
    const before = { ply: 1 } as never;
    F.core.record.fair = { p1: [before] };
    F.p2().fairFrom = { p1: 1, p2: 0 };
    const { from, tries } = hisReply(F);
    for (const s of F.searches.filter((x) => !x.boss && x.fen === from)) F.answer(s);
    expect(F.core.record.fair!["p1"]).toHaveLength(2);
    // (Your partner's move too, its fair-play numbers still on their way when the fight ends.)
    const theirs = F.boardOf("p2");
    F.core.message("p2", { t: "phase2Move", key: F.p2().key, board: theirs.id, move: legalMoves(theirs.board.fen)[0]!, ply: 0 });
    const late = F.searches.find((x) => !x.boss && x.fen === theirs.board.fen)!;
    expect(late).toBeTruthy();
    F.advance(RECLUSE_ONLINE.serverWaitMs - 100);
    expect(F.p2().done).toBeUndefined();
    // (Tried again all along, never a device: each try lost on the way (no answer at all), again after 20 s: at 0, 20 and 40 s.)
    expect(tries()).toHaveLength(3);
    expect(F.all("p1", "phase2Ask").some((a) => a.elo === RECLUSE_PHASE2.elo)).toBe(false);
    F.advance(200);
    expect(F.p2().done).toMatchObject({ noResult: true, beaten: false });
    expect(F.last("p2", "phase2")!.p2.done?.noResult).toBe(true);
    expect(phase2NoResult(F.core.record)).toBe(true);
    expect(F.core.record.fair!["p1"]).toEqual([before]);
    F.answer(late);
    expect(F.core.record.fair!["p2"] ?? []).toEqual([]);
    F.advance(RECLUSE_PHASE2.endMs + 100);
    expect(F.core.record.phase).toBe("results");
    for (const id of ["p1", "p2"]) expect(F.last(id, "results")).toMatchObject({ noResult: true, ranked: false, bossResult: "draw" });
    const results = F.core.humanResults();
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.noResult === true && r.ranked === false)).toBe(true);
    // Written: fair play's (phase 1's moves), and nothing else: no XP, no result row, no Welcome Crate, no token.
    const queries: string[] = [];
    const sql = {
      run: async (q: string) => void queries.push(q),
      first: async (q: string) => (queries.push(q), null),
      all: async (q: string) => (queries.push(q), []),
      batch: async (st: readonly { sql: string }[]) => void queries.push(...st.map((x) => x.sql)),
    };
    const ctx = { sql, mode: "boss", mail: undefined, signedInOnly: true, paused: false, off: undefined } as never;
    await writeResult(ctx, F.core.record, { playerId: "p1", userId: "u0", result: results.find((r) => r.playerId === "p1")!, at: F.now, span: { moves: 30, ms: 600_000 }, opponents: [], battle: { moves: 30, ms: 600_000 } });
    expect(queries).toEqual(["SELECT rating FROM users WHERE id = ?"]);
  });
});

describe("a mate in one, his or a bot's (the delta review of #677: the engine server never sends `mate`)", () => {
  it("marked by the rules (withMates), so pick() plays it over a higher score", () => {
    // (Black to move: Qh4 mates.)
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2";
    const scores = legalMoves(fen).map((m) => ({ move: m, expected: m === "d8h4" ? 0.9 : m === "b8c6" ? 0.95 : 0.5 }));
    expect(pick(scores, "boss", () => 0)).toBe("b8c6");
    const marked = withMates(fen, scores);
    expect(marked.filter((s) => s.mate !== undefined)).toEqual([{ move: "d8h4", expected: 0.9, mate: 1 }]);
    expect(pick(marked, "boss", () => 0)).toBe("d8h4");
    for (let i = 0; i < 10; i++) expect(pick(marked, "bot", () => i / 10)).toBe("d8h4");
  });
});
