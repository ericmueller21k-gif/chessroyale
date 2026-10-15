import { describe, expect, it } from "vitest";
import { CROWD_KNOCKOUTS, DEFAULT_SETTINGS, RECLUSE_PHASE2, modeSettings, mulberry32, type Settings } from "@chessroyale/core";
import { PHASE2_CHANGE_MS, PHASE2_FALL_MS, applyMove, chess960Fen, inCheck, legalMoves, phase2FallbackMove, phase2Numbers, sanLineToUci, type BoardScore, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord, type LobbyIO } from "../src/lobby.ts";
import { PAUSE_RECLUSE } from "../src/bosses/recluse-phase2.ts";

/**
 * The Hidden Boss's phase 2 online (DECISIONS.md, "The Hidden Boss's phase 2 online"): the Crowd's boss final, phase 1
 * won, then his fall, the phase change and four boards at once on server time, his moves (and the bot finalists') from
 * the host's device, one board at a time, each request keyed; the next device when one doesn't answer, the last resort
 * when none can; a finalist leaving; the results.
 */

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
type P2 = Extract<Msg, { t: "phase2" }>["p2"];
type Req = Extract<Msg, { t: "p2Request" }>;
const exp = (fen: string, m: string) => 0.3 + 0.4 * hash(fen + m);
const hashBest = (fen: string) => legalMoves(fen).reduce((a, b) => (exp(fen, b) > exp(fen, a) ? b : a));
/** Scholar's mate: the crowd (White) plays it, everyone picking it; the host plays his replies into it. */
const SCHOLAR = sanLineToUci(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]);

/**
 * A fake lobby: Crowd 50 v 50 to the boss final (two quick cuts of 48), three people (Ann, a computer and the host; Bo,
 * a phone; Cy, who never picks and goes out at the first cut, so he watches) and 97 bots; phase 1 won by Scholar's mate,
 * phase 2 on (the lobby's test switch). Stops as phase 2's fall begins.
 */
function phase2Lobby(patch: Partial<Settings> = {}, io: Partial<LobbyIO> = {}, seed = 7) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const core = new LobbyCore(
    newLobbyRecord("ABCDE", now),
    { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), { ...msg, now } as Msg]), icon: () => undefined, ...io },
    library,
    mulberry32(seed),
    {
      ...DEFAULT_SETTINGS,
      ...modeSettings("crowd", { crowdTeams: true, augments: false }),
      finalFormat: "boss",
      knockoutsPerStage: [48, 48],
      firstStageRounds: 2,
      roundsPerStage: 2,
      boardIntroSeconds: 0,
      phase2Online: true,
      ...patch,
    },
  );
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const all = <T extends Msg["t"]>(id: string, t: T) => (inbox.get(id) ?? []).filter((m) => m.t === t) as Extract<Msg, { t: T }>[];
  const advance = (ms: number) => {
    const until = now + ms;
    // (Every alarm on the way, as the Durable Object would run it.)
    for (let i = 0; i < 1000; i++) {
      const at = core.nextAlarm;
      if (at === null || at > until) break;
      now = Math.max(now, at);
      core.alarm();
    }
    now = until;
  };
  const people = ["p1", "p2", "p3"];
  const script = SCHOLAR.filter((_, i) => i % 2 === 0);
  const bossScript = SCHOLAR.filter((_, i) => i % 2 === 1);
  const inBattle = () => !!core.save().runner?.state.boss;
  const crowdPick = (fen: string) => (inBattle() ? script.find((m) => legalMoves(fen).includes(m)) : undefined) ?? hashBest(fen);
  const hostScores = () => {
    for (const host of people) {
      const req = last(host, "scoreRequest");
      if (!req) continue;
      const boards: BoardScore[] = req.jobs.map((j) => {
        const legal = legalMoves(j.fen);
        const e = Object.fromEntries(legal.map((m) => [m, exp(j.fen, m)]));
        const best = hashBest(j.fen);
        const scripted = inBattle() ? script.find((m) => legal.includes(m)) : undefined;
        return {
          boardId: j.boardId,
          bestMove: best,
          bestExpected: e[best]!,
          expectedAfter: e,
          botPicks: Object.fromEntries(j.bots.map((b, i) => [b.id, scripted ?? legal[i % legal.length]!])),
          botThinkMs: Object.fromEntries(j.bots.map((b) => [b.id, 4000])),
        };
      });
      core.message(host, { t: "scores", key: req.key, boards });
      inbox.set(host, (inbox.get(host) ?? []).filter((m) => m.t !== "scoreRequest"));
      return true;
    }
    return false;
  };
  const step = () => {
    const phase = core.record.phase;
    if (phase === "play") {
      for (const id of ["p1", "p2"]) {
        const r = last(id, "round");
        const round = core.record.round;
        if (r?.board && !r.watching && r.alive && round?.key === r.key && !round.picks[id]) core.message(id, { t: "pick", key: r.key, move: crowdPick(r.board.fen) });
      }
      advance(1000);
    } else if (phase === "scoring") {
      if (!hostScores()) advance(1000);
    } else if (phase === "boss" && core.record.bossKey) {
      const host = people.find((id) => last(id, "bossRequest")?.key === core.record.bossKey);
      const req = host ? last(host, "bossRequest")! : undefined;
      if (req && host) {
        const legal = req.allowed ?? legalMoves(req.fen);
        core.message(host, { t: "bossMove", key: req.key, move: bossScript.find((m) => legal.includes(m)) ?? legal[0]! });
      } else advance(1000);
    } else advance(1000);
  };
  core.connect(undefined, "Ann", "computer");
  core.connect(undefined, "Bo", "phone");
  core.connect(undefined, "Cy", "phone");
  core.message("p1", { t: "start" });
  advance(1000);
  for (let i = 0; i < 6000 && core.record.phase !== "phase2" && core.record.phase !== "results"; i++) step();

  const p2 = () => core.record.p2!;
  /** Requests a device was sent for a move still asked for (newest last). */
  const asked = (id: string) => all(id, "p2Request").filter((q) => p2().asks.some((a) => a.key === q.key && a.to.includes(id)));
  /** Every device answers what it was asked: `pick` chooses (default: the first legal move, his and the bots'). */
  const answerAll = (pick: (q: Req) => string = (q) => legalMoves(q.fen)[0]!) => {
    for (const id of people) for (const q of asked(id)) core.message(id, { t: "p2Answer", key: q.key, move: pick(q) });
  };
  /** A person's board, and their move on it (default: the last resort's choice, a sensible one). */
  const boardOf = (id: string) => p2().state.boards.find((b) => b.player === id);
  const play = (id: string, move?: string) => {
    const b = boardOf(id)!;
    core.message(id, { t: "p2Move", board: b.id, ply: b.board.history.length, move: move ?? phase2FallbackMove(b.board.fen, () => 0.5)! });
  };
  return {
    core,
    last,
    all,
    advance,
    asked,
    answerAll,
    boardOf,
    play,
    p2,
    people,
    get now() {
      return now;
    },
  };
}

/** To the clocks: past his fall and the phase change. */
function toPlay(L: ReturnType<typeof phase2Lobby>) {
  L.advance(PHASE2_FALL_MS + PHASE2_CHANGE_MS + 10);
  expect(L.p2().stage).toBe("play");
}

describe("the Hidden Boss's phase 2 online: his fall, the phase change, four boards on server time", () => {
  it("phase 1 won: the short fall (marked phase2), the phase change for everyone (watchers too), then four boards: the finalists best first, each its own Chess960 start from the battle's seed; the clocks start after the change", () => {
    const L = phase2Lobby();
    expect(L.core.record.phase).toBe("phase2");
    const runner = L.core.save().runner!;
    expect(runner.state.boss!.result).toBe("crowd");
    // His fall: the boss message with `fall` and `phase2`, as long as solo's before its phase change.
    const fall = L.last("p3", "boss")!;
    expect(fall).toMatchObject({ fall: true, phase2: true });
    expect(fall.until - fall.now).toBe(PHASE2_FALL_MS);
    expect(L.last("p3", "phase2")).toBeUndefined();
    // The phase change: everyone the same boards, no clock running yet.
    L.advance(PHASE2_FALL_MS + 10);
    const change = L.last("p3", "phase2")!.p2;
    expect(change.stage).toBe("change");
    expect(change.boards).toHaveLength(RECLUSE_PHASE2.boards);
    expect(change.boards.every((b) => b.turnAt === null && b.toMove === null)).toBe(true);
    expect(L.last("p1", "phase2")!.p2).toEqual(change);
    // The finalists, best first (their places from phase 1's end): people and bots.
    const placed = runner.state.players.filter((p) => p.placement !== null && p.placement <= 4).sort((a, b) => a.placement! - b.placement!);
    expect(change.boards.map((b) => b.player)).toEqual(placed.map((p) => p.id));
    expect(change.boards.map((b) => b.name)).toEqual(placed.map((p) => p.name));
    expect(change.boards.some((b) => b.player === "p1") && change.boards.some((b) => b.player === "p2")).toBe(true);
    expect(change.boards.some((b) => b.player === "p3")).toBe(false);
    const seed = runner.state.boss!.powers!.seed;
    expect(change.boards.map((b) => b.number)).toEqual(phase2Numbers(seed));
    expect(change.boards.map((b) => b.fen)).toEqual(phase2Numbers(seed).map((n) => chess960Fen(n)));
    // Then the clocks: every player's runs from the end of the change (they're White).
    L.advance(PHASE2_CHANGE_MS);
    const play = L.last("p3", "phase2")!.p2;
    expect(play.stage).toBe("play");
    expect(play.boards.every((b) => b.toMove === "crowd" && b.turnAt === play.at && b.bankMs === RECLUSE_PHASE2.bankSeconds * 1000)).toBe(true);
    expect(play.at - change.at).toBeGreaterThanOrEqual(PHASE2_CHANGE_MS);
  });

  it("his moves come from the host, one board at a time, each request keyed to its board and position: an answer from a device not asked, for another key, an illegal move or a position that's gone is dropped", () => {
    const L = phase2Lobby();
    toPlay(L);
    const host = L.core.record.hostId!;
    expect(host).toBe("p1");
    L.play("p1");
    L.play("p2");
    // One request for him at a time, to the host, at his strength and budget (and one for a bot finalist meanwhile).
    const boss = L.asked(host).filter((q) => !q.bot);
    expect(boss).toHaveLength(1);
    expect(boss[0]).toMatchObject({ elo: RECLUSE_PHASE2.elo, nodes: RECLUSE_PHASE2.nodes, moveMs: RECLUSE_PHASE2.moveMs });
    const q = boss[0]!;
    const b = L.p2().state.boards.find((x) => x.id === q.board)!;
    expect(q.fen).toBe(b.board.fen);
    const ply = b.board.history.length;
    const legal = legalMoves(q.fen);
    // Dropped: from a device not asked, another key, an illegal move.
    L.core.message("p2", { t: "p2Answer", key: q.key, move: legal[0]! });
    L.core.message(host, { t: "p2Answer", key: "p2-999", move: legal[0]! });
    L.core.message(host, { t: "p2Answer", key: q.key, move: "a1a1" });
    expect(L.p2().state.boards.find((x) => x.id === q.board)!.board.history).toHaveLength(ply);
    // Taken: the host's legal move for that key; the same answer again changes nothing.
    L.core.message(host, { t: "p2Answer", key: q.key, move: legal[1]! });
    expect(L.p2().state.boards.find((x) => x.id === q.board)!.board.history).toEqual([...b.board.history, legal[1]!]);
    L.core.message(host, { t: "p2Answer", key: q.key, move: legal[2]! });
    expect(L.p2().state.boards.find((x) => x.id === q.board)!.board.history).toHaveLength(ply + 1);
    // The next waiting board's request has gone out at once.
    const next = L.asked(host).filter((x) => !x.bot);
    expect(next).toHaveLength(1);
    expect(next[0]!.key).not.toBe(q.key);
    expect(next[0]!.board).not.toBe(q.board);
  });

  it("the clocks on server time: a bank runs on the player's move only; a move just past its end (within the late grace) counts; past the grace the board is lost on time and the move isn't played", () => {
    const L = phase2Lobby();
    toPlay(L);
    const bank = RECLUSE_PHASE2.bankSeconds * 1000;
    // Ann takes 30 s: 30 s gone from her bank; his move then doesn't run her clock.
    const start = L.boardOf("p1")!.turnAt!;
    L.advance(30_000);
    L.play("p1");
    expect(L.boardOf("p1")!.bankMs).toBe(bank - (L.now - start));
    const left = L.boardOf("p1")!.bankMs;
    L.answerAll();
    L.advance(20_000);
    L.answerAll();
    const ann = L.boardOf("p1")!;
    expect(ann.board.history).toHaveLength(2);
    expect(ann.bankMs).toBe(left);
    // Bo plays his move just past his bank's end, within the late grace: it counts, with nothing left.
    const bo = L.boardOf("p2")!;
    L.advance(bo.turnAt! + bo.bankMs - L.now + DEFAULT_SETTINGS.lateGraceMs - 50);
    expect(L.boardOf("p2")!.result).toBeNull();
    L.play("p2");
    expect(L.boardOf("p2")!.board.history).toHaveLength(1);
    expect(L.boardOf("p2")!.result).toBeNull();
    // Ann lets hers run out: past the grace her board is lost on time; her late move isn't played.
    const a = L.boardOf("p1")!;
    L.advance(a.turnAt! + a.bankMs - L.now + DEFAULT_SETTINGS.lateGraceMs + 10);
    expect(L.boardOf("p1")!.result).toEqual({ winner: "boss", how: "time" });
    L.play("p1");
    expect(L.boardOf("p1")!.board.history).toHaveLength(2);
    expect(L.last("p3", "phase2")!.p2.boards.find((b) => b.player === "p1")!.result).toEqual({ winner: "boss", how: "time" });
  });

  it("slow moves count for the team on server time; the tenth brings his ultimate for everyone; then a move out of its few seconds is played at random for that player, never a loss", () => {
    const L = phase2Lobby();
    toPlay(L);
    // (Bots think quickly here: only the people's slow moves count. Every device answers at once.)
    let slow = 0;
    for (let i = 0; i < 40 && L.p2().state.ultAt === null; i++) {
      L.advance((RECLUSE_PHASE2.slowMoveSeconds + 0.5) * 1000);
      for (const id of ["p1", "p2"]) if (L.boardOf(id)?.result === null && L.boardOf(id)!.board.fen.split(" ")[1] === "w" && L.boardOf(id)!.turnAt !== null) L.play(id);
      L.answerAll();
      slow = L.p2().state.slow;
    }
    expect(slow).toBeGreaterThanOrEqual(RECLUSE_PHASE2.slowMovesForUlt);
    const ult = L.p2().state.ultAt!;
    expect(ult).not.toBeNull();
    expect(L.last("p3", "phase2")!.p2.ultAt).toBe(ult);
    expect(L.last("p3", "phase2")!.p2.lastSlow).toMatchObject({ at: ult });
    // Then: a person doesn't move. Out of their few seconds (and the grace), a move is played for them; the board plays on.
    L.answerAll();
    const who = ["p1", "p2"].find((id) => !L.boardOf(id)!.result && L.boardOf(id)!.turnAt !== null)!;
    expect(who, "a person to move").toBeTruthy();
    const before = L.boardOf(who)!;
    L.advance(before.turnAt! + RECLUSE_PHASE2.ultMoveSeconds * 1000 + DEFAULT_SETTINGS.lateGraceMs + 10 - L.now);
    const after = L.boardOf(who)!;
    expect(after.board.history.length).toBe(before.board.history.length + 1);
    expect(after.result?.how).not.toBe("time");
  });

  it("bot finalists: their moves come from the host too (at the bots' strength), played once their thinking time is up", () => {
    const L = phase2Lobby();
    toPlay(L);
    const bots = L.p2().state.boards.filter((b) => L.p2().bots.includes(b.player));
    expect(bots.length).toBeGreaterThanOrEqual(1);
    const req = L.asked(L.core.record.hostId!).find((q) => q.bot)!;
    expect(req).toMatchObject({ elo: RECLUSE_PHASE2.botElo, nodes: RECLUSE_PHASE2.botNodes, bot: true });
    expect(req.moveMs).toBeLessThanOrEqual(RECLUSE_PHASE2.botMoveMs[1]);
    const due = L.p2().botMoves[req.board]!.due;
    // The answer comes at once; the move waits for its thinking time.
    L.answerAll();
    expect(L.p2().state.boards.find((b) => b.id === req.board)!.board.history).toHaveLength(0);
    L.advance(due - L.now + 5);
    expect(L.p2().state.boards.find((b) => b.id === req.board)!.board.history).toHaveLength(1);
  });

  it("a host that doesn't answer: the next device is asked (and is the host now); no device left, the last resort plays his move (the material search), never a random one; a host who drops is replaced at once", () => {
    const L = phase2Lobby();
    toPlay(L);
    L.play("p1");
    const q = L.asked("p1").find((x) => !x.bot)!;
    // Ann (the host) says nothing: after the wait, the next device (Cy or Bo) gets the same move to make.
    L.advance(RECLUSE_PHASE2.hostWaitMs + 10);
    const next = L.core.record.hostId!;
    expect(next).not.toBe("p1");
    const again = L.asked(next).find((x) => x.key === q.key)!;
    expect(again).toMatchObject({ board: q.board, fen: q.fen });
    // Nobody answers: the third device, then the last resort, on this board, at this position.
    L.advance(RECLUSE_PHASE2.hostWaitMs + 10);
    L.advance(RECLUSE_PHASE2.hostWaitMs + 10);
    const board = L.p2().state.boards.find((b) => b.id === q.board)!;
    expect(board.board.history.at(-1)).toBeDefined();
    expect(board.board.history).toHaveLength(2);
    expect(L.p2().fallbacks).toBeGreaterThanOrEqual(1);
    // A host who drops: the work goes to the next device at once.
    const host = L.core.record.hostId!;
    L.play("p2");
    const pending = L.p2().asks.filter((a) => a.by === "host");
    expect(pending.length).toBeGreaterThanOrEqual(1);
    L.core.disconnect(host);
    const now = L.core.record.hostId!;
    expect(now).not.toBe(host);
    for (const a of L.p2().asks.filter((x) => x.by === "host")) expect(L.all(now, "p2Request").some((x) => x.key === a.key)).toBe(true);
  });

  it("the last resort: a mate in one taken, a mate in one against him avoided, a free queen taken, his queen never left to be taken", () => {
    const rnd = [0, 0.25, 0.5, 0.75, 0.99];
    // His move (Black) in each. The fool's mate: Qh4#. (Already mated: no move.)
    expect(phase2FallbackMove("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2", () => 0.5)).toBe("d8h4");
    expect(phase2FallbackMove("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3", () => 0.5)).toBeNull();
    // A free queen: his knight takes it.
    expect(phase2FallbackMove("rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 3 3", () => 0.5)).toBe("f6h5");
    // His back rank: his queen keeps e8 covered (or he makes room), never Re8#.
    const back = "3q3k/6pp/8/8/8/8/5PPP/4R1K1 b - - 0 1";
    const mates = (fen: string, m: string) => {
      const after = applyMove(fen, m);
      return legalMoves(after).some((r) => {
        const next = applyMove(after, r);
        return !legalMoves(next).length && inCheck(next);
      });
    };
    for (const r of rnd) expect(mates(back, phase2FallbackMove(back, () => r)!)).toBe(false);
    // His queen attacked by a pawn: it moves away (to a square no pawn or piece takes it on).
    const hit = "rnb1kbnr/pppp1ppp/8/4q3/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 3";
    for (const r of rnd) {
      const after = applyMove(hit, phase2FallbackMove(hit, () => r)!);
      expect(legalMoves(after).some((x) => applyMove(after, x).split(" ")[0]!.replace(/[^q]/g, "") === "")).toBe(false);
    }
  });

  it("a finalist leaving: gone longer than LEAVING.awayMs, a loss for them at once and a bot plays their board on where it stands; resigning a board: lost, the others play on, and they still watch", () => {
    const L = phase2Lobby();
    toPlay(L);
    // Bo resigns his board: lost; he stays (still in the lobby, still sent phase 2).
    L.core.message("p2", { t: "p2Resign" });
    expect(L.boardOf("p2")!.result).toEqual({ winner: "boss", how: "resign" });
    expect(L.core.record.humans.some((h) => h.id === "p2")).toBe(true);
    L.play("p1");
    expect(L.last("p2", "phase2")!.p2.boards.find((b) => b.player === "p1")!.history).toHaveLength(1);
    // Ann drops and doesn't come back: after the away time, her board is a bot's (her clock as it stood), a loss for her.
    const board = L.boardOf("p1")!.id;
    L.core.disconnect("p1");
    L.advance(200_000);
    const b = L.p2().state.boards.find((x) => x.id === board)!;
    expect(b.player).not.toBe("p1");
    expect(L.p2().bots).toContain(b.player);
    const left = L.core.record.left!.find((l) => l.id === "p1")!;
    expect(left.how).toBe("away");
    expect(left.result).toMatchObject({ teamWon: false });
    expect(L.core.takeLeftResults().map((r) => r.playerId)).toContain("p1");
  });

  it("results: every board decided, his reaction, then the results: all four won is the crowd's victory, else his, with boards won of four; the stored results follow phase 2", () => {
    const L = phase2Lobby({ bossWinTest: true });
    // (The test switch: phase 1 a mate in one, and every phase 2 board too; the bots take theirs, the people play Qxf7.)
    toPlay(L);
    for (let i = 0; i < 20 && L.p2().stage === "play"; i++) {
      L.answerAll((q) => (q.bot ? "h5f7" : legalMoves(q.fen)[0]!));
      for (const id of ["p1", "p2"]) if (L.boardOf(id) && !L.boardOf(id)!.result) L.play(id, "h5f7");
      L.advance(500);
    }
    expect(L.p2().stage).toBe("end");
    expect(L.last("p3", "phase2")!.p2.stage).toBe("end");
    L.advance(RECLUSE_PHASE2.endMs + 10);
    expect(L.core.record.phase).toBe("results");
    const res = L.last("p3", "results")!;
    expect(res.bossResult).toBe("crowd");
    expect(res.simul).toEqual({ won: 4, of: 4 });
    for (const r of L.core.humanResults()) if (r.placement <= 4) expect(r.teamWon).toBe(true);
  });

  it("results, a board lost: his win, with the boards won (all must be won); the finalists' stored results say lost", () => {
    const L = phase2Lobby({ bossWinTest: true });
    toPlay(L);
    L.core.message("p2", { t: "p2Resign" });
    for (let i = 0; i < 20 && L.p2().stage === "play"; i++) {
      L.answerAll((q) => (q.bot ? "h5f7" : legalMoves(q.fen)[0]!));
      if (L.boardOf("p1") && !L.boardOf("p1")!.result) L.play("p1", "h5f7");
      L.advance(500);
    }
    L.advance(RECLUSE_PHASE2.endMs + 10);
    const res = L.last("p1", "results")!;
    expect(res.bossResult).toBe("boss");
    expect(res.simul).toEqual({ won: 3, of: 4 });
    for (const r of L.core.humanResults()) if (r.placement <= 4) expect(r.teamWon).toBe(false);
  });

  it("off (no switch) or paused (PAUSE_BOSS_RECLUSE): phase 1 won is the crowd's victory, as before", () => {
    const off = phase2Lobby({ phase2Online: false });
    expect(off.core.record.phase).toBe("results");
    expect(off.core.record.p2).toBeUndefined();
    expect(off.last("p1", "results")!.bossResult).toBe("crowd");
    const paused = phase2Lobby({}, { paused: (name) => name === PAUSE_RECLUSE });
    expect(paused.core.record.phase).toBe("results");
    expect(paused.last("p1", "results")!.simul).toBeUndefined();
  });

  it("someone reconnecting mid-phase-2 gets it as it stands (not phase 1's board); the host back gets its work again", () => {
    const L = phase2Lobby();
    toPlay(L);
    L.play("p1");
    const token = L.core.record.humans.find((h) => h.id === "p3")!.token;
    L.core.disconnect("p3");
    L.core.connect(token, "Cy", "phone");
    const msgs = L.all("p3", "phase2");
    expect(msgs.at(-1)!.p2.boards.find((b) => b.player === "p1")!.history).toHaveLength(1);
  });
});

describe("his brain on the engine server (option (b), not wired yet): the interface", () => {
  it("every waiting board is asked of the server at once; a move it can't make (null, or too slow) goes to the host", () => {
    const asked: { key: string; fen: string; elo: number }[] = [];
    const L = phase2Lobby({}, { serverMove: (req) => (asked.push(req), true) });
    toPlay(L);
    L.play("p1");
    L.play("p2");
    expect(asked.length).toBeGreaterThanOrEqual(2);
    expect(asked.every((r) => r.elo === RECLUSE_PHASE2.elo)).toBe(true);
    // (Nothing of his to the host while the server has it.)
    expect(L.asked("p1").filter((q) => !q.bot)).toHaveLength(0);
    const [a, b] = asked;
    const boardA = L.p2().asks.find((x) => x.key === a!.key)!.board;
    L.core.phase2ServerMoved(a!.key, legalMoves(a!.fen)[0]!);
    expect(L.p2().state.boards.find((x) => x.id === boardA)!.board.history).toHaveLength(2);
    // The server couldn't: the host gets that move.
    const boardB = L.p2().asks.find((x) => x.key === b!.key)!.board;
    L.core.phase2ServerMoved(b!.key, null);
    expect(L.asked("p1").find((q) => !q.bot && q.board === boardB)).toBeTruthy();
    // A late answer for a key already given up on is dropped.
    L.core.phase2ServerMoved(b!.key, legalMoves(b!.fen)[0]!);
    expect(L.p2().state.boards.find((x) => x.id === boardB)!.board.history).toHaveLength(1);
  });
});
