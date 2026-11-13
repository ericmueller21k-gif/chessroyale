import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, HIDDEN_ROOM, LEAVING, RECLUSE_CHILD, RECLUSE_CUTSCENE, RECLUSE_FORMS, RECLUSE_ONLINE, RECLUSE_PHASE2, childRating, hiddenRoomSettings, levelForMaia, maiaTopRating, modeSettings, mulberry32, recluseChildFirst, recluseNextForm, type FairMove, type Settings } from "@chessroyale/core";
import { START_FEN, applyMove, bankLeft, legalMoves, type BoardScore, type MatchRunner, type MoveScore, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord, type PartyLobby } from "../src/lobby.ts";
import { mateFirst, phase2NoResult, phase2NoResultFor, phase2Unvouched, pick, quickMove, withMates, type Phase2SearchRequest } from "../src/bosses/recluse.ts";
import { lobbyOptions } from "../src/lobby-options.ts";
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
 * the host) and bots in the other seats. `engine`: an engine server (its searches answered by the test: `searches`, `answer`; the
 * host's device's asks for a bot's move by `answerAsks`); `auto`: one that answers every search as time goes on (`advance`), each
 * legal move scored as `answer` does, and a host's device that answers every ask.
 */
function roomFight(people: number, bots: number, o: { engine?: boolean; auto?: boolean; child?: boolean } = {}) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const searches: Phase2SearchRequest[] = [];
  const noResults: number[] = [];
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
  // (At his adult form, as `?form=adult`: these tests are about it and his phase 2. `child`: his fight as it starts, the child first.)
  const overrides = JSON.parse(JSON.stringify({ ...hiddenRoomSettings(), ...(o.child ? {} : { recluseChild: false }) }));
  const core = new LobbyCore(
    newLobbyRecord("FIGHT", now, overrides, party),
    {
      now: () => now,
      send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]),
      ...(o.engine || o.auto ? { phase2Search: (req: Phase2SearchRequest) => void searches.push(req), warmEngine: () => void warms++, phase2NoResult: () => void noResults.push(now) } : {}),
    },
    library,
    mulberry32(7),
    { ...DEFAULT_SETTINGS, ...overrides, lastStandFrom: 999, boardIntroSeconds: 0 } as Settings,
  );
  const last = <K extends Msg["t"]>(id: string, t: K) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: K }> | undefined;
  const all = <K extends Msg["t"]>(id: string, t: K) => (inbox.get(id) ?? []).filter((m) => m.t === t) as Extract<Msg, { t: K }>[];
  // (`auto`: every search waiting answered, and every ask of a device, and those their answers bring, as time goes on.)
  const drain = () => {
    for (let i = 0; o.auto && i < 20 && (searches.length || answerAsks()); i++) for (const s of searches.splice(0)) answer(s);
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
  /**
   * The host's device answers the bots' moves asked of it (phase2Ask) and not answered yet (`fen`: that position's only), with
   * `pickOf`'s move (default the first legal one). How many it answered.
   */
  const answered = new Set<string>();
  const answerAsks = (fen?: string, pickOf: (fen: string) => string = (f) => legalMoves(f)[0]!) => {
    let n = 0;
    for (const [id, msgs] of inbox) {
      for (const m of msgs) {
        if (m.t !== "phase2Ask" || (fen !== undefined && m.fen !== fen) || answered.has(`${id} ${m.id} ${m.now}`)) continue;
        answered.add(`${id} ${m.id} ${m.now}`);
        core.message(id, { t: "phase2Answer", id: m.id, move: pickOf(m.fen) });
        n++;
      }
    }
    return n;
  };
  /** The engine server's answer to a search: every legal move scored by `score` (default: all equal but the first, best). */
  const answer = (s: { id: string; fen: string }, score: (m: string, i: number) => number = (_m, i) => (i === 0 ? 0.6 : 0.4)) => {
    const moves: MoveScore[] = legalMoves(s.fen).map((m, i) => ({ move: m, expected: score(m, i) }));
    core.phase2Searched(s.id, moves);
  };
  /** The fight begun (or `begun`: the form's intro shown), then his form beaten by the admin's "Win this form" (the team's next move), up to his fall. */
  const beatAdult = (begun = false) => {
    if (!begun) advance(1000);
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
    noResults,
    answer,
    answerAsks,
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
  it("the child first (Nov 13), then the adult form, then the four boards", () => {
    expect(RECLUSE_FORMS).toEqual(["child", "adult", "four"]);
    expect(recluseNextForm("child")).toBe("adult");
    expect(recluseNextForm("adult")).toBe("four");
    expect(recluseNextForm("four")).toBeNull();
    expect(recluseNextForm("adult", ["adult", "four"])).toBe("four");
    // (Where he's fought, the settings follow the list: his room's fight and the Crowd's final start as the child.)
    expect(recluseChildFirst()).toBe(true);
    expect(recluseChildFirst(["adult", "four"])).toBe(false);
    expect(hiddenRoomSettings().recluseChild).toBe(true);
    expect(modeSettings("crowd").recluseChild).toBe(true);
    // (?form=adult, a test switch: a lobby that starts at the man; dropped for a player.)
    expect(lobbyOptions(new URLSearchParams("mode=crowd&form=adult"), true).overrides.recluseChild).toBe(false);
    expect(lobbyOptions(new URLSearchParams("mode=crowd&form=adult"), false).overrides.recluseChild).toBe(true);
  });
});

describe("his child form online (Nov 13: RECLUSE_CHILD, the first of his forms)", () => {
  /** Plays the fight on (the team's first legal move; the host's Maia loaded, his move the first legal one) until `plies` moves are on the board, or his form is beaten. */
  const playOn = (F: ReturnType<typeof roomFight>, plies: number, people = 1) => {
    const asked: { brain?: { rating: number }; elo: number; ply: number }[] = [];
    for (let i = 0; i < 400 && F.runner().boards.get(F.runner().state.boards[0]!)!.history.length < plies && !F.runner().boss!.result; i++) {
      const round = F.core.record.round;
      const board = F.runner().boards.get(F.runner().state.boards[0]!)!;
      if (F.core.record.phase === "play" && round) {
        for (let k = 1; k <= people; k++) if (!round.picks[`p${k}`]) F.core.message(`p${k}`, { t: "pick", key: round.key, move: legalMoves(board.fen)[0]! });
      }
      F.hostScores();
      const req = F.last("p1", "bossRequest");
      if (F.core.record.phase === "boss" && req && req.key === F.core.record.bossKey) {
        asked.push({ ...(req.brain ? { brain: { rating: req.brain.rating } } : {}), elo: req.elo, ply: board.history.length });
        F.core.message("p1", { t: "bossMove", key: req.key, move: (req.allowed ?? legalMoves(req.fen))[0]! });
      }
      F.advance(1000);
    }
    return asked;
  };

  it("his room's fight starts as the child: no powers, his level known; the host asked for his moves at the child's rating (Maia) and strength (Stockfish's stand-in), rising every 4 moves", () => {
    const F = roomFight(1, 3, { child: true });
    // (The host's Maia loaded: his own moves go out as Maia's, with their rating.)
    F.core.message("p1", { t: "maiaReady" });
    F.advance(1000);
    const intro = F.last("p1", "boss")!;
    expect(intro.intro).toBe(true);
    expect(intro.boss).toMatchObject({ id: HIDDEN_ROOM.boss, form: "child", formStep: 0 });
    expect(intro.boss.powers).toBeUndefined();
    expect(typeof intro.boss.level).toBe("number");
    F.advance(60_000);
    const asked = playOn(F, 12);
    expect(asked.length).toBeGreaterThanOrEqual(5);
    for (const a of asked) {
      expect(a.brain?.rating, `his move at ply ${a.ply}`).toBe(childRating(a.ply));
      expect(a.elo).toBe(levelForMaia(childRating(a.ply)));
    }
    expect(asked[0]!.brain!.rating).toBe(RECLUSE_CHILD.startRating);
    expect(asked.at(-1)!.brain!.rating).toBeGreaterThan(RECLUSE_CHILD.startRating);
    expect(F.last("p1", "boss")!.boss.formStep).toBeGreaterThanOrEqual(2);
  });

  it("the admin's 🏆 on the child: the team's next move beats him; nobody placed; his fall (he grows up), then a new match against his adult form, his own 🏆 next, then his phase 2", () => {
    const F = roomFight(1, 3, { child: true });
    F.core.message("p1", { t: "maiaReady" });
    F.advance(1000);
    F.advance(60_000);
    playOn(F, 4);
    expect(F.core.winFormTrigger("p2", true)).toBe(false);
    expect(F.core.winFormTrigger("p1", true)).toBe(true);
    playOn(F, 99);
    expect(F.runner().boss).toMatchObject({ form: "child", result: "crowd" });
    expect(F.runner().isOver()).toBe(false);
    expect(Object.keys(F.core.record.placements)).toEqual([]);
    // His fall: not his phase change's, the child's (RECLUSE_CHILD.fallMs), and a 🏆 can't be pressed in it.
    const fall = F.last("p1", "boss")!;
    expect(fall).toMatchObject({ fall: true });
    expect(fall.toPhase2).toBeUndefined();
    expect(fall.until! - fall.now).toBe(RECLUSE_CHILD.fallMs);
    expect(F.core.winFormTrigger("p1", true)).toBe(false);
    expect(F.core.record.winForm).toBeUndefined();
    // The new match: his adult form's intro, from the starting position, at his own rating.
    F.advance(RECLUSE_CHILD.fallMs);
    const intro = F.last("p1", "boss")!;
    expect(intro.intro).toBe(true);
    expect(intro.boss.form).toBeUndefined();
    expect(intro.boss.result).toBeUndefined();
    expect(intro.boss.level).toBeNull();
    expect(intro.boss.powers).toMatchObject({ passive: "nohelp", ultimate: "bullet" });
    expect(intro.boss.board.history).toEqual([]);
    expect(F.runner().boss!.form).toBeUndefined();
    const asked = playOn(F, 1);
    F.advance(60_000);
    asked.push(...playOn(F, 4));
    for (const a of asked) expect(a.brain?.rating).toBe(maiaTopRating());
    // His adult form beaten (the 🏆 again): his fall says the phase change follows, then the four boards.
    F.beatAdult(true);
    expect(F.last("p1", "boss")!.toPhase2).toBe(true);
    F.advance(F.p2().cutAt - F.now);
    expect(F.core.record.phase).toBe("phase2");
  });

  it("the Crowd's final starts him as the child too (its settings, from his forms)", () => {
    const overrides = JSON.parse(JSON.stringify(modeSettings("crowd")));
    expect(newLobbyRecord("CROWD", 0, overrides).overrides?.recluseChild).toBe(true);
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
  it("a person's move: only theirs, on their move, legal; his reply from the engine server is its best; a bot's from the host's device, after its thinking. The match engine's queue holds his moves alone (the review of #683, M1)", () => {
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
    // Fair play: your move's position scored on fair play's own instance (`fair`), kept as a FairMove (no crowd: your board alone).
    const fairSearch = F.searches.find((s) => s.fen === mine.board.fen)!;
    expect(fairSearch).toMatchObject({ fair: true });
    expect(fairSearch.boss).toBeUndefined();
    F.answer(fairSearch, (_m, i) => (i === 0 ? 0.62 : 0.5));
    const fair = F.core.record.fair?.["p1"] ?? [];
    expect(fair).toHaveLength(1);
    expect(fair[0]).toMatchObject({ move, best: legalMoves(mine.board.fen)[0], loss: 0, crowd: 0, away: 2, thinkMs: thought });
    // A bot's move: asked of the host's device first (a bot plays for its own team), at a bot's strength; it plays after its
    // thinking, whatever the device's speed.
    // (The bot that thinks longest: its move waits for its time; a bot whose time has passed plays as the answer comes.)
    const bots = F.p2().state.boards.filter((b) => !["p1", "p2"].includes(b.player));
    for (const b of bots) expect(F.all("p1", "phase2Ask").find((a) => a.fen === b.board.fen)).toMatchObject({ elo: RECLUSE_PHASE2.botElo, nodes: RECLUSE_PHASE2.botNodes });
    const bot = bots.reduce((a, b) => (F.p2().botAt[b.id]! > F.p2().botAt[a.id]! ? b : a));
    const early = bots.find((b) => b !== bot)!;
    const moved = (id: number) => F.p2().state.boards.find((b) => b.id === id)!.board.history.length;
    F.advance(-1);
    const due = F.p2().botAt[bot.id]!;
    expect(due).toBeGreaterThan(F.now);
    expect(F.answerAsks(bot.board.fen)).toBe(1);
    expect(moved(bot.id)).toBe(0);
    F.advance(due - F.now + 1);
    expect(moved(bot.id)).toBe(1);
    expect(F.p2().botAt[early.id]!).toBeLessThan(F.now);
    expect(F.answerAsks(early.board.fen)).toBe(1);
    expect(moved(early.id)).toBe(1);
    // (The match engine's queue: his moves alone. Fair play's on its own instance; no bot's searched while a device answers.)
    expect(F.searches.length).toBeGreaterThanOrEqual(2);
    expect(F.searches.every((s) => (s.boss && !s.fair) || (s.fair && !s.boss))).toBe(true);
    // (Every move of his is asked once, counted once: a first try carries no `again`.)
    expect(F.searches.filter((s) => s.boss).every((s) => !s.again)).toBe(true);
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
    F.answerAsks();
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
    // (Its move is asked as a bot's: of the host's device, at a bot's strength.)
    expect(F.all("p1", "phase2Ask").find((a) => a.fen === now.board.fen)).toMatchObject({ elo: RECLUSE_PHASE2.botElo });
    const left = F.core.record.left!.find((l) => l.id === "p2")!;
    expect(left.how).toBe("resigned");
    expect(left.result?.teamWon).toBe(false);
    expect(F.core.record.phase).toBe("phase2");
  });

  it("a disconnect: their clock runs; gone longer than LEAVING.awayMs, a bot takes their board. Everyone gone: the match ends, his", () => {
    const F = roomFight(2, 2, { auto: true });
    F.beatAdult();
    F.toBoards();
    // (The people's banks 10 minutes, so the sweep comes before their flags: a 2:00 bank is LEAVING.awayMs itself, and only his
    // ultimate, which the bots' slow moves bring by chance, kept it from falling first.)
    F.p2().state = { ...F.p2().state, boards: F.p2().state.boards.map((b) => (["p1", "p2"].includes(b.player) ? { ...b, bankMs: 600_000 } : b)) };
    F.core.disconnect("p2");
    F.advance(LEAVING.awayMs + 1000);
    expect(F.p2().state.boards.some((b) => b.player === "p2")).toBe(false);
    expect(F.p2().done).toBeUndefined();
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

  it("an empty answer is tried again (retryMs, then twice as long), counted once; an earlier try's empty answer adds no try; any try's answer plays; nothing is asked of a device", () => {
    const F = roomFight(1, 3, { engine: true });
    F.beatAdult();
    const { fen, tries } = hisReply(F);
    expect(tries()).toHaveLength(1);
    // (His searches are his own: `boss`. A person's fair play: fair play's instance, `fair`.)
    expect(F.searches.filter((s) => s.boss).every((s) => s.fen === fen)).toBe(true);
    F.core.phase2Searched(tries()[0]!.id, null);
    F.advance(RECLUSE_ONLINE.retryMs - 1);
    expect(tries()).toHaveLength(1);
    F.advance(2);
    expect(tries()).toHaveLength(2);
    // (A try again at the same position: not counted again (the review of #683, m2).)
    expect(tries().map((t) => !!t.again)).toEqual([false, true]);
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
  });

  it("a try still unanswered is never sent again while it could still be running (searchMs, every group's wait in it): only once it's lost, past it (the review of #683, M1)", () => {
    const F = roomFight(1, 3, { engine: true });
    F.beatAdult();
    const { tries } = hisReply(F);
    const asked = F.now;
    F.advance(RECLUSE_ONLINE.searchMs + 1000);
    expect(tries()).toHaveLength(1);
    F.advance(asked + RECLUSE_ONLINE.searchMs + 5000 - F.now + 10);
    expect(tries()).toHaveLength(2);
    expect(tries()[1]!.again).toBe(true);
  });

  it("a bot's move: the host's device first; no answer in askMs, the engine server's (a bot's search, never his); empty there too, the server's quick move", () => {
    const F = roomFight(1, 3, { engine: true });
    F.beatAdult();
    F.toBoards();
    const bot = F.p2().state.boards.find((b) => b.player !== "p1")!;
    const ask = F.all("p1", "phase2Ask").find((a) => a.fen === bot.board.fen)!;
    expect(ask).toMatchObject({ elo: RECLUSE_PHASE2.botElo });
    expect(F.searches.some((s) => s.fen === bot.board.fen)).toBe(false);
    F.advance(RECLUSE_ONLINE.askMs + 10);
    const search = F.searches.find((s) => s.fen === bot.board.fen)!;
    expect(search).toBeTruthy();
    expect(search.boss ?? search.fair).toBeUndefined();
    // (The device's answer, late: it's the engine server's now.)
    F.core.message("p1", { t: "phase2Answer", id: ask.id, move: legalMoves(bot.board.fen)[1]! });
    expect(F.p2().work[bot.id]?.move).toBeUndefined();
    F.core.phase2Searched(search.id, null);
    F.advance(RECLUSE_PHASE2.botSlowMs[1]);
    expect(F.p2().state.boards.find((b) => b.id === bot.id)!.board.history[0]).toBe(quickMove(bot.board.fen));
    expect(F.p2().unvouched).toBeUndefined();
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

  it("no answer in serverWaitMs: the fight ends with no result; nothing counts for its board players (not ranked, no XP or result row), phase 2's fair-play moves dropped, those before it kept and written; counted for the health view", async () => {
    const F = roomFight(2, 2, { engine: true });
    F.beatAdult();
    // (Phase 1 vouched for, as with judges in production; and a fair-play move of its, before phase 2.)
    delete F.core.record.unvouched;
    const before: FairMove = { ply: 1, fen: START_FEN, move: "e2e4", best: "e2e4", loss: 0, bestExp: 0.55, near: 3, gap: 1.2, crowd: 0, crowdFound: 0, thinkMs: 4000, away: 0, legal: 20, top: ["e2e4", "d2d4"] };
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
    expect(F.noResults).toEqual([]);
    F.advance(200);
    expect(F.p2().done).toMatchObject({ noResult: true, beaten: false });
    expect(F.last("p2", "phase2")!.p2.done?.noResult).toBe(true);
    expect(phase2NoResult(F.core.record)).toBe(true);
    expect(F.noResults).toHaveLength(1);
    expect(F.core.record.fair!["p1"]).toEqual([before]);
    F.answer(late);
    expect(F.core.record.fair!["p2"] ?? []).toEqual([]);
    F.advance(RECLUSE_PHASE2.endMs + 100);
    expect(F.core.record.phase).toBe("results");
    // (Both played its boards: nothing counts for or against them, the results say so.)
    for (const id of ["p1", "p2"]) expect(F.last(id, "results")).toMatchObject({ noResult: "board", ranked: false, bossResult: "draw" });
    const results = F.core.humanResults();
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.noResult === true && r.ranked === false && r.teamWon === null)).toBe(true);
    // Written: fair play's, with phase 1's move alone, and nothing else: no XP, no result row, no Welcome Crate, no token.
    const queries: { q: string; args: unknown[] }[] = [];
    const sql = {
      run: async (q: string, ...args: unknown[]) => void queries.push({ q, args }),
      first: async (q: string, ...args: unknown[]) => (queries.push({ q, args }), q.startsWith("SELECT rating FROM users") ? { rating: null } : null),
      all: async (q: string, ...args: unknown[]) => (queries.push({ q, args }), []),
      batch: async (st: readonly { sql: string }[]) => void queries.push(...st.map((x) => ({ q: x.sql, args: [] }))),
    };
    const ctx = { sql, mode: "boss", mail: undefined, signedInOnly: true, paused: false, off: undefined } as never;
    await writeResult(ctx, F.core.record, { playerId: "p1", userId: "u0", result: results.find((r) => r.playerId === "p1")!, at: F.now, span: { moves: 30, ms: 600_000 }, opponents: [], battle: { moves: 30, ms: 600_000 } });
    const kept = queries.find((x) => x.q.includes("INSERT INTO fairplay_matches"));
    expect(kept?.args).toContain(JSON.stringify([before]));
    expect(queries.every((x) => /fairplay_|FROM users WHERE id/.test(x.q))).toBe(true);
  });
});

describe("the review of #683, minors", () => {
  it("m1: a board handed to a bot during a pause: the bot thinks from the pause's end, its clock charged as it stood (never the pause)", () => {
    const F = roomFight(2, 2, { engine: true });
    F.beatAdult();
    delete F.core.record.overrides!.tested;
    F.toBoards();
    const mine = F.boardOf("p1");
    F.core.message("p1", { t: "phase2Move", key: F.p2().key, board: mine.id, move: legalMoves(mine.board.fen)[0]!, ply: 0 });
    const his = F.searches.find((s) => s.boss)!;
    F.advance(RECLUSE_ONLINE.pauseMs + 10);
    const paused = F.p2().paused!;
    expect(paused).toBeDefined();
    const board = F.boardOf("p2").id;
    const left = bankLeft(F.boardOf("p2"), paused);
    // (40 s into the pause, p2 resigns: their board is a bot's, its move asked of the host's device, and in.)
    F.advance(40_000);
    F.core.message("p2", { t: "resign" });
    const bot = F.p2().state.boards.find((b) => b.id === board)!.player;
    expect(F.p2().botAt[board]! - paused).toBeLessThanOrEqual(RECLUSE_PHASE2.botSlowMs[1]);
    expect(F.answerAsks(F.p2().state.boards.find((b) => b.id === board)!.board.fen)).toBe(1);
    // (His move in: the clocks run on; the bot plays its while after, charged its while alone.)
    F.answer(his);
    const resumed = F.now;
    expect(F.p2().paused).toBeUndefined();
    F.advance(RECLUSE_PHASE2.botSlowMs[1] + 10);
    const b = F.p2().state.boards.find((x) => x.id === board)!;
    expect(b.player).toBe(bot);
    expect(b.board.history).toHaveLength(1);
    expect(b.bankMs).toBeLessThan(left);
    expect(b.bankMs).toBeGreaterThanOrEqual(left - RECLUSE_PHASE2.botSlowMs[1]);
    expect(F.now - resumed).toBeLessThan(RECLUSE_PHASE2.botSlowMs[1] + 100);
  });

  it("m3: the engine server gone mid-fight (a deploy without it): his next try is the quick move (phase 2 unvouched), never a throw", () => {
    const F = roomFight(1, 3, { engine: true });
    F.beatAdult();
    delete F.core.record.overrides!.tested;
    F.toBoards();
    const mine = F.boardOf("p1");
    F.core.message("p1", { t: "phase2Move", key: F.p2().key, board: mine.id, move: legalMoves(mine.board.fen)[0]!, ply: 0 });
    const his = F.searches.find((s) => s.boss)!;
    F.core.phase2Searched(his.id, null);
    delete (F.core as unknown as { io: { phase2Search?: unknown } }).io.phase2Search;
    expect(() => F.advance(RECLUSE_ONLINE.retryMs + 10)).not.toThrow();
    expect(F.boardOf("p1").board.history).toEqual([legalMoves(mine.board.fen)[0], quickMove(his.fen)]);
    expect(F.p2().unvouched).toBe("his move was the server's quick move (no engine server here)");
  });

  it("nit: a host's reload re-asks a bot's moves only (a move of his an older server asked of a device goes to the engine server)", () => {
    const F = roomFight(1, 3, { engine: true });
    F.beatAdult();
    F.toBoards();
    const mine = F.boardOf("p1");
    F.core.message("p1", { t: "phase2Move", key: F.p2().key, board: mine.id, move: legalMoves(mine.board.fen)[0]!, ply: 0 });
    // (As an older server left it: his move asked of the host's device, no `since`.)
    const w = Object.values(F.p2().work).find((x) => x.who === "boss")!;
    Object.assign(w, { via: "device", device: "p1", since: undefined, tries: undefined, ask: undefined });
    const asks = F.all("p1", "phase2Ask").length;
    F.core.disconnect("p1");
    const token = F.core.record.humans.find((h) => h.id === "p1")!.token;
    expect(F.core.connect(token, "M0", "computer", false, 1500, undefined, "u0", null, null, true).ok).toBe(true);
    F.core.resendTo("p1");
    const again = F.all("p1", "phase2Ask").slice(asks);
    expect(again.length).toBeGreaterThan(0);
    expect(again.some((a) => a.fen === w.fen || a.id === w.id)).toBe(false);
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

  it("in a Chess960 position too (phase 2's boards), the rules' own: Ra8 mates, castling (the king taking its own rook) doesn't", () => {
    const fen = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w A - 0 1";
    const scores = legalMoves(fen).map((m) => ({ move: m, expected: m === "a1a8" ? 0.9 : 0.95 }));
    expect(legalMoves(fen)).toContain("g1a1");
    expect(withMates(fen, scores).filter((s) => s.mate !== undefined).map((s) => s.move)).toEqual(["a1a8"]);
    expect(pick(withMates(fen, scores), "boss", () => 0)).toBe("a1a8");
  });
});

describe("his phase 1 server move takes a mate in one (the review of #686, m1)", () => {
  it("every move scored 1 (a won position, the engine server's numbers): the mate is played, even outside the first 8 legal moves; one he may not play isn't", () => {
    // (The review's position: Black (him) to move, Ra1# and Qd1# both mate; a8a1 is the 9th legal move in generation order.)
    const fen = "r5k1/5ppp/8/3q4/8/8/5PPP/6K1 b - - 0 1";
    const scores = legalMoves(fen).map((move) => ({ move, expected: 1 }));
    const m = mateFirst(fen, scores, null);
    expect(["a8a1", "d5d1"]).toContain(m);
    expect(mateFirst(fen, scores, ["a8a1"])).toBe("a8a1");
    expect(mateFirst(fen, scores, ["a8b8"])).toBeUndefined();
    expect(mateFirst("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [{ move: "e2e4", expected: 0.5 }], null)).toBeUndefined();
  });
});

describe("his phase 1 move when no device answers (Eric, Nov 13, option 1: \"replace the random-move fallback with the same pause plus a server move\")", () => {
  const boardNow = (F: ReturnType<typeof roomFight>) => F.runner().boards.get(F.runner().state.boards[0]!)!;
  /** On to his next turn (the team's first legal move each crowd turn): his move asked of the host and not answered. The request. */
  const toHisTurn = (F: ReturnType<typeof roomFight>, people = 1) => {
    for (let i = 0; i < 300 && !(F.core.record.phase === "boss" && F.core.record.bossKey); i++) {
      const round = F.core.record.round;
      if (F.core.record.phase === "play" && round) {
        const fen = boardNow(F).fen;
        for (let k = 1; k <= people; k++) if (!round.picks[`p${k}`]) F.core.message(`p${k}`, { t: "pick", key: round.key, move: legalMoves(fen)[0]! });
      }
      F.hostScores();
      F.advance(1000);
    }
    const req = F.all(F.core.record.hostId!, "bossRequest").find((m) => m.key === F.core.record.bossKey);
    expect(req, "his move asked of the host").toBeTruthy();
    return req!;
  };
  /** His tries at this move on the engine server (searches "p1-…"). */
  const tries = (F: ReturnType<typeof roomFight>) => F.searches.filter((s) => s.id.startsWith("p1-"));

  it("the host's window passes: his move from the engine server at the man's level, never a random move; his turn waits for it (nobody's clock runs); a device's late answer isn't heard; his next move is the devices' again", () => {
    const F = roomFight(1, 3, { engine: true });
    F.advance(1000);
    F.advance(60_000);
    const req = toHisTurn(F);
    const key = F.core.record.bossKey!;
    const ply = boardNow(F).history.length;
    F.advance(15_000 - 100);
    expect(tries(F)).toEqual([]);
    F.advance(200);
    expect(tries(F)).toHaveLength(1);
    expect(tries(F)[0]).toMatchObject({ fen: req.fen, boss: true });
    expect(tries(F)[0]!.again).toBeUndefined();
    // (His strength now: the man's fixed level, as the devices are asked for it.)
    expect(F.core.record.recluse1).toMatchObject({ key, fen: req.fen, elo: req.elo, tries: 1 });
    expect(req.elo).toBe(F.runner().state.boss!.elo);
    // His turn waits: still his, thinking; no crowd round, so nobody's clock runs; the host's move now isn't heard, nothing random.
    const legal = legalMoves(req.fen);
    const rounds = F.all("p1", "round").length;
    F.core.message("p1", { t: "bossMove", key, move: legal[1]! });
    F.advance(5000);
    expect(F.core.record.phase).toBe("boss");
    expect(F.all("p1", "round")).toHaveLength(rounds);
    expect(F.last("p1", "boss")!.thinking).toBe(true);
    expect(boardNow(F).history).toHaveLength(ply);
    // The engine server's numbers: his move at his strength (every other move far behind the best, beyond his guard: the best).
    F.answer(tries(F)[0]!, (_m, i) => (i === 0 ? 0.6 : 0.2));
    expect(boardNow(F).history).toHaveLength(ply + 1);
    expect(boardNow(F).lastMove).toBe(legal[0]);
    expect(F.core.record.recluse1).toBeUndefined();
    expect(F.core.record.unvouched ?? "").not.toMatch(/quick move/);
    // His next move: asked of the host again, nothing more of the engine server.
    const req2 = toHisTurn(F);
    expect(req2.key).not.toBe(key);
    expect(tries(F)).toHaveLength(1);
    F.core.message("p1", { t: "bossMove", key: req2.key, move: legalMoves(req2.fen)[0]! });
    expect(boardNow(F).lastMove).toBe(legalMoves(req2.fen)[0]);
  });

  it("the child's strength: asked at his rating's Stockfish stand-in as it rises (levelForMaia of childRating), as the devices are", () => {
    const F = roomFight(1, 3, { engine: true, child: true });
    F.advance(1000);
    F.advance(60_000);
    const elos: number[] = [];
    for (let turn = 0; turn < 5; turn++) {
      const req = toHisTurn(F);
      const ply = boardNow(F).history.length;
      expect(F.runner().boss!.form).toBe("child");
      if (turn === 0 || turn === 4) {
        // (No device answers: the engine server, at the strength the host was asked for.)
        F.advance(15_100);
        const a = F.core.record.recluse1!;
        expect(a.elo).toBe(levelForMaia(childRating(ply)));
        expect(a.elo).toBe(req.elo);
        elos.push(a.elo);
        F.answer(tries(F).at(-1)!);
      } else F.core.message("p1", { t: "bossMove", key: req.key, move: legalMoves(req.fen)[0]! });
      expect(boardNow(F).history).toHaveLength(ply + 1);
    }
    expect(elos[1]).toBeGreaterThan(elos[0]!);
  });

  it("tried again as phase 2's are (an empty answer after retryMs, a lost one past searchMs + 5 s, counted once); never in after serverWaitMs: no result, nothing counts for those fighting him, every move of their fair play kept; counted for the health view", () => {
    const F = roomFight(2, 2, { engine: true });
    F.advance(1000);
    F.advance(60_000);
    toHisTurn(F, 2);
    const ply = boardNow(F).history.length;
    const before: FairMove = { ply: 0, fen: START_FEN, move: "a2a3", best: "e2e4", loss: 3, bestExp: 0.55, near: 3, gap: 1.2, crowd: 4, crowdFound: 1, thinkMs: 4000, away: 0, legal: 20, top: ["e2e4", "d2d4"] };
    F.core.record.fair = { p1: [before] };
    F.advance(15_100);
    expect(tries(F)).toHaveLength(1);
    // (The host silent: another device hosts his moves to come; this one is the engine server's.)
    expect(F.core.record.hostId).toBe("p2");
    const since = F.core.record.recluse1!.since;
    // Empty: again after retryMs, `again` (his row counts the position once).
    F.core.phase2Searched(tries(F)[0]!.id, []);
    F.advance(RECLUSE_ONLINE.retryMs - 100);
    expect(tries(F)).toHaveLength(1);
    F.advance(200);
    expect(tries(F)).toHaveLength(2);
    expect(tries(F)[1]!.again).toBe(true);
    // (An earlier try's empty answer, the next on its way: nothing more.)
    F.core.phase2Searched(tries(F)[0]!.id, null);
    F.advance(1000);
    expect(tries(F)).toHaveLength(2);
    // None back: lost past searchMs + 5 s, again; and so on to serverWaitMs.
    F.advance(RECLUSE_ONLINE.searchMs + 5000 - 1000);
    expect(tries(F)).toHaveLength(3);
    F.advance(since + RECLUSE_ONLINE.serverWaitMs - 100 - F.now);
    expect(F.core.record.phase).toBe("boss");
    expect(boardNow(F).history).toHaveLength(ply);
    expect(F.noResults).toEqual([]);
    F.advance(200);
    // No result: the battle over as a draw; both fought him: nothing counts for or against them, the results say so.
    expect(F.core.record.phase).toBe("results");
    expect(boardNow(F).history).toHaveLength(ply);
    expect(F.noResults).toHaveLength(1);
    expect(F.core.record.recluse1!.none).toEqual(expect.arrayContaining(["p1", "p2"]));
    for (const id of ["p1", "p2"]) expect(F.last(id, "results")).toMatchObject({ noResult: "board", ranked: false, bossResult: "draw" });
    const results = F.core.humanResults();
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.noResult === true && r.ranked === false && r.teamWon === null)).toBe(true);
    expect(F.core.record.fair!["p1"]).toEqual([before]);
    // (A late answer changes nothing.)
    F.answer(tries(F).at(-1)!);
    expect(F.core.record.phase).toBe("results");
    expect(boardNow(F).history).toHaveLength(ply);
  });

  it("no engine server set up (local runs, the e2e suite): the server's quick move, never a random one, and the match unvouched (as phase 2's quick move)", () => {
    const F = roomFight(1, 3);
    F.advance(1000);
    F.advance(60_000);
    const req = toHisTurn(F);
    // (Phase 1 vouched for so far, as with judges in production: the harness's host scores alone.)
    delete F.core.record.unvouched;
    F.advance(15_100);
    expect(boardNow(F).lastMove).toBe(quickMove(req.fen));
    expect(F.core.record.unvouched).toMatch(/quick move/);
    expect(F.core.record.recluse1).toBeUndefined();
  });
});
