import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { FIRE_BURN_MS, POWER_FX, bossShowMs, extraMoveCandidates, initPowers, legalMoves, lightsOutTimeline, passTurn, pieceAt, sanLineToUci, sideToMove, type BoardScore, type MatchRunner, type Opening, type ServerMessage } from "@chessroyale/chess";
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


/** A raid of two people against a boss, with a power brought at once (the test switch), the Last Stand off. */
function raid(patch: Partial<Settings>, lastBoss: (string | null)[] = [null, null]) {
  const L = setup({ ...RAID_SETTINGS, lastStandFrom: 999, ...patch });
  lastBoss.forEach((b, i) => L.core.connect(undefined, `P${i + 1}`, i ? "phone" : "computer", false, 1500, undefined, undefined, b));
  L.core.message("p1", { t: "start" });
  L.advance(1000);
  L.advance(60_000); // past the intro
  return L;
}

/** Everyone picks the first allowed move; the host scores; time passes to the boss's turn. */
function crowdMove(L: ReturnType<typeof setup>, ids = ["p1", "p2"]) {
  for (const id of ids) {
    const r = L.last(id, "round")!;
    const ok = r.boss?.powers?.allowed ?? legalMoves(r.board!.fen);
    L.core.message(id, { t: "pick", key: r.key, move: ok[0]! });
  }
  const req = L.last("p1", "scoreRequest")!;
  expect(L.hostScores("p1")).toBe(true);
  L.advance(30_000);
  return req;
}

/** The host answers the boss request (its first allowed move, or the funhouse's). */
function hostBoss(L: ReturnType<typeof setup>) {
  const req = L.last("p1", "bossRequest")!;
  expect(req).toBeTruthy();
  L.core.message("p1", { t: "bossMove", key: req.key, move: (req.allowed ?? legalMoves(req.fen))[0]! });
  L.inbox.set("p1", (L.inbox.get("p1") ?? []).filter((m) => m.t !== "bossRequest"));
  return req;
}

describe("boss powers online", () => {
  it("the gingerbread man: everyone sees the same freeze and blizzard, the clock waits for them, picks and jobs follow the allowed moves", () => {
    const L = raid({ bossId: "gingerbread", bossPowerTest: "blizzard" });
    const r1 = L.last("p1", "round")!;
    expect(r1.boss!.id).toBe("gingerbread");
    expect(r1.boss!.name).toBe("Ginger");
    crowdMove(L);
    hostBoss(L);
    // As the turn passes to the crowd: a freeze and the warning, the same for both, and the boss's move shows longer.
    const b1 = L.last("p1", "boss")!;
    const b2 = L.last("p2", "boss")!;
    expect(b1.boss.powers).toEqual(b2.boss.powers);
    const kinds = b1.boss.powers!.events.map((e) => e.kind).sort();
    expect(kinds).toEqual(["freeze", "warn"]);
    expect(b1.until - b1.now).toBe(bossShowMs(b1.boss.lastMove) + POWER_FX.freeze + POWER_FX.warn);
    L.advance(b1.until - L.now + 10);
    const r2 = L.last("p1", "round")!;
    const frozen = r2.boss!.powers!.frozen!.square;
    expect(r2.boss!.powers!.iced).toEqual([frozen]);
    // A move of the frozen piece is refused.
    const icedMove = legalMoves(r2.board!.fen).find((m) => m.startsWith(frozen))!;
    L.core.message("p1", { t: "pick", key: r2.key, move: icedMove });
    expect(L.core.record.round!.picks.p1).toBeUndefined();
    const job2 = crowdMove(L).jobs[0]!;
    expect(job2.allowed!.some((m) => m.startsWith(frozen))).toBe(false);
    hostBoss(L);
    // The blizzard: only the queen moves this turn; every screen ices the rest.
    const b3 = L.last("p2", "boss")!;
    expect(b3.boss.powers!.events.map((e) => e.kind)).toEqual(["blizzard"]);
    L.advance(b3.until - L.now + 10);
    const r3 = L.last("p2", "round")!;
    const fen = r3.board!.fen;
    const allowed = r3.boss!.powers!.allowed!;
    expect(allowed.length).toBeGreaterThan(0);
    for (const m of allowed) expect(pieceAt(fen, m.slice(0, 2))!.type).toBe("q");
    expect(crowdMove(L).jobs[0]!.allowed).toEqual(allowed);
    // Power turns (the freeze, the blizzard) don't count for fair play; the first turn, before any power, does.
    expect(L.core.fairMoves("p1").map((m) => !!m.power)).toEqual([false, true, true]);
  });

  it("Boingo: the host plays the crowd's move in his funhouse (unscored), everyone sees it, then the board shows flipped", () => {
    const L = raid({ bossId: "clown", bossPowerTest: "funhouse" });
    crowdMove(L);
    hostBoss(L);
    const warned = L.last("p1", "boss")!;
    expect(warned.boss.powers!.events.map((e) => e.kind).sort()).toEqual(["pie", "warn"]);
    const pie = warned.boss.powers!.pie!.square;
    L.advance(warned.until - L.now + 10);
    const r2 = L.last("p1", "round")!;
    expect((r2.boss!.powers!.allowed ?? legalMoves(r2.board!.fen)).some((m) => m.slice(2, 4) === pie)).toBe(false);
    crowdMove(L);
    const req = hostBoss(L);
    // The boss never moves onto the pie either.
    if (req.allowed) expect(req.allowed.some((m) => m.slice(2, 4) === pie)).toBe(false);
    L.advance(L.last("p1", "boss")!.until - L.now + 10);
    // The funhouse: the host is asked for the crowd's move (from the allowed ones), nobody picks.
    const f = L.last("p1", "bossRequest")!;
    expect(f.funhouse).toBe(true);
    expect(L.core.record.phase).toBe("boss");
    const scoresBefore = L.core.save().runner!.state.players.map((p) => p.finalLosses.length);
    hostBoss(L);
    const fun = L.last("p2", "boss")!;
    expect(fun.boss.powers!.funhouse).toBeTruthy();
    expect(fun.boss.powers!.events.map((e) => e.kind)).toContain("funhouse");
    expect(fun.until - fun.now).toBe(POWER_FX.funhouse);
    expect(L.core.save().runner!.state.players.map((p) => p.finalLosses.length)).toEqual(scoresBefore);
    // Then the boss replies, and the crowd's next two turns show the board flipped.
    L.advance(fun.until - L.now + 10);
    hostBoss(L);
    L.advance(L.last("p1", "boss")!.until - L.now + 10);
    expect(L.last("p1", "round")!.boss!.powers!.flipped).toBe(true);
    expect(L.last("p2", "round")!.boss!.powers!.flipped).toBe(true);
  });

  it("a random boss avoids the one most of the lobby met last; only playable bosses are met", () => {
    for (const seed of [1, 2, 3, 4]) {
      const L = setup({ ...RAID_SETTINGS }, {}, seed);
      for (const [i, b] of ["clown", "clown", "gingerbread"].entries()) L.core.connect(undefined, `P${i}`, "computer", false, 1500, undefined, undefined, b);
      L.core.message("p1", { t: "start" });
      expect(L.core.save().runner!.state.boss!.id).not.toBe("clown");
    }
    const ids = new Set<string>();
    for (let seed = 1; seed <= 60 && ids.size < 6; seed++) {
      const L = setup({ ...RAID_SETTINGS }, {}, seed);
      L.core.connect(undefined, "A", "computer", false, 1500);
      L.core.message("p1", { t: "start" });
      ids.add(L.core.save().runner!.state.boss!.id!);
    }
    expect([...ids].sort()).toEqual(["bigboy", "clown", "gingerbread", "grex", "hollow", "sawyer"]);
  });

  it("the test trigger: only an admin's is taken; it brings the ultimate as the next turn begins, once; switched off, nothing", () => {
    const L = raid({ bossId: "gingerbread" });
    // Not an admin (the Durable Object says so), or sent as a plain message: nothing.
    expect(L.core.ultimateTrigger("p2", false)).toBe(false);
    L.core.message("p2", { t: "ultimate" });
    const runner = () => (L.core as unknown as { runner: MatchRunner }).runner;
    expect(runner().boss!.powers!.ultNext).toBeUndefined();
    // Switched off: nothing, even for an admin.
    const on = BOSS_POWERS.ultimateTestButton;
    (BOSS_POWERS as { ultimateTestButton: boolean }).ultimateTestButton = false;
    expect(L.core.ultimateTrigger("p1", true)).toBe(false);
    (BOSS_POWERS as { ultimateTestButton: boolean }).ultimateTestButton = on;
    // An admin, in the middle of the crowd's turn: this turn goes on as it was.
    const r1 = L.last("p1", "round")!;
    expect(L.core.ultimateTrigger("p1", true)).toBe(true);
    expect(L.core.record.round!.key).toBe(r1.key);
    expect(L.core.record.phase).toBe("play");
    crowdMove(L);
    // While the boss thinks: again, harmless.
    expect(L.core.ultimateTrigger("p1", true)).toBe(true);
    hostBoss(L);
    const b = L.last("p2", "boss")!;
    expect(b.boss.powers!.events.map((e) => e.kind)).toContain("blizzard");
    expect(b.boss.powers!.events.map((e) => e.kind)).not.toContain("warn");
    expect(L.last("p1", "boss")!.boss.powers).toEqual(b.boss.powers);
    // Spent: nothing more.
    expect(L.core.ultimateTrigger("p1", true)).toBe(false);
    L.advance(b.until - L.now + 10);
    expect(L.last("p1", "round")!.boss!.powers!.allowed!.length).toBeGreaterThan(0);
  });

  it("G-REX: everyone sees the same fire; on a tile's last turn the job names it, a piece left there burns, and the boss waits for it", () => {
    const L = raid({ bossId: "grex", bossUnfinished: true });
    const runner = (L.core as unknown as { runner: MatchRunner }).runner;
    expect(runner.boss!.id).toBe("grex");
    // A tile ablaze this turn under one of the crowd's pieces that has a move but isn't the king.
    const fen = runner.boards.get(0)!.fen;
    const legal = legalMoves(fen);
    const square = legal.map((m) => m.slice(0, 2)).find((sq) => pieceAt(fen, sq)?.type !== "k" && pieceAt(fen, sq)?.type !== "p")!;
    runner.state = { ...runner.state, boss: { ...runner.boss!, powers: { ...runner.boss!.powers!, turn: 1, nextPassive: 99, fire: [{ square, lit: -1 }] } } };
    // Both pick a move that leaves it there.
    const r = L.last("p1", "round")!;
    const stay = legal.find((m) => !m.startsWith(square))!;
    for (const id of ["p1", "p2"]) L.core.message(id, { t: "pick", key: L.last(id, "round")!.key, move: stay });
    const req = L.last("p1", "scoreRequest")!;
    expect(req.key).toBe(r.key);
    expect(req.jobs[0]!.burn).toEqual([square]);
    expect(L.hostScores("p1")).toBe(true);
    L.advance(30_000);
    // The piece burnt: the boss's turn shows the board without it, the same for everyone, and its move waits for the fire.
    const thinking = L.last("p2", "boss")!;
    expect(thinking.boss.powers!.burnt).toEqual([{ turn: 1, square, piece: pieceAt(fen, square)!.type }]);
    expect(pieceAt(thinking.boss.board.fen, square)).toBeNull();
    expect(thinking.boss.board.bases).toEqual([{ ply: thinking.boss.board.ply, fen: thinking.boss.board.fen }]);
    expect(L.last("p1", "boss")!.boss.powers).toEqual(thinking.boss.powers);
    expect(L.core.record.bossMinAt).toBe(thinking.now + FIRE_BURN_MS);
    // A fire turn doesn't count for fair play.
    expect(L.core.fairMoves("p1").map((m) => !!m.power)).toEqual([true]);
    // (The host's move, in before the fire has played out, waits for it.)
    hostBoss(L);
    expect(L.last("p1", "boss")!.thinking).toBe(true);
    L.advance(FIRE_BURN_MS + 10);
    const shown = L.last("p1", "boss")!;
    expect(shown.thinking).toBeFalsy();
    L.advance(shown.until - L.now + 10);
    const next = L.last("p1", "round")!;
    expect(pieceAt(next.board!.fen, square)).toBeNull();
    expect(next.board!.fen.split(" ")[0]).toBe(runner.boards.get(0)!.fen.split(" ")[0]);
  });
});

describe("Hollow online", () => {
  /** To the next crowd turn's round message (past the boss's move and his moments). */
  const toRound = (L: ReturnType<typeof setup>) => {
    for (let i = 0; i < 10 && L.core.save().phase !== "play"; i++) L.advance(10_000);
    return L.last("p1", "round")!;
  };

  it("the dark: each attempt into it is judged for its player alone; -5 a wrong one, the 5th ends the turn as a miss; a legal one is the pick", () => {
    const L = raid({ bossId: "hollow" });
    const r1 = L.last("p1", "round")!;
    expect(r1.boss!.id).toBe("hollow");
    expect(r1.board!.history).toEqual([]);
    expect(r1.boss!.crowdSide).toBe("w");
    crowdMove(L);
    const req = hostBoss(L);
    // After his first move he covers the square of the piece he moved, the same for everyone.
    const b1 = L.last("p1", "boss")!;
    expect(b1.boss.powers!.events).toEqual([{ kind: "dark", turn: 2, square: (req.allowed ?? legalMoves(req.fen))[0]!.slice(2, 4), first: true }]);
    expect(b1.boss.powers).toEqual(L.last("p2", "boss")!.boss.powers);
    expect(b1.until - L.now).toBeGreaterThanOrEqual(POWER_FX.dark);
    const r2 = toRound(L);
    const sq = r2.boss!.powers!.dark![0]!.square;
    L.take("p1");
    L.take("p2");
    // p1 tries to move his piece from the dark: wrong, -5, only p1 hears it.
    for (let i = 1; i <= 4; i++) {
      L.core.message("p1", { t: "darkTry", key: r2.key, move: `${sq}a3` });
      expect(L.last("p1", "darkTry")).toMatchObject({ ok: false, tries: i });
      expect(L.last("p1", "darkTry")!.out).toBeUndefined();
    }
    expect(L.last("p2", "darkTry")).toBeUndefined();
    // An attempt that doesn't touch the dark: refused, nothing lost.
    L.core.message("p2", { t: "darkTry", key: r2.key, move: "a2a5" });
    expect(L.last("p2", "darkTry")).toMatchObject({ ok: false, refused: true });
    // p2 gets two wrong, then plays a legal move.
    L.core.message("p2", { t: "darkTry", key: r2.key, move: `${sq}a3` });
    L.core.message("p2", { t: "darkTry", key: r2.key, move: `${sq}h3` });
    expect(L.last("p2", "darkTry")).toMatchObject({ ok: false, tries: 2 });
    // p1's 5th: out of tries; their turn is over (everyone sees they're done).
    L.core.message("p1", { t: "darkTry", key: r2.key, move: `${sq}a3` });
    expect(L.last("p1", "darkTry")).toMatchObject({ ok: false, tries: 5, out: true });
    expect(L.last("p2", "moved")).toMatchObject({ playerId: "p1" });
    // (A pick after that is too late.)
    L.core.message("p1", { t: "pick", key: r2.key, move: "a2a3" });
    expect(L.core.save().phase).toBe("play");
    const legal = legalMoves(r2.board!.fen).find((m) => !r2.boss!.powers!.dark!.some((d) => m.includes(d.square)))!;
    L.core.message("p2", { t: "pick", key: r2.key, move: legal });
    const score = L.last("p1", "scoreRequest")!;
    expect(score.jobs[0]!.humanPicks).toEqual({ p1: null, p2: legal });
    expect(L.hostScores("p1")).toBe(true);
    const rev = L.last("p2", "reveal")!;
    const pick = (id: string) => rev.picks.find((p) => p.playerId === id)!;
    // p1: a missed move (-25), never more; p2: the only pick (0 on its own), less 10 for two wrong attempts.
    expect(pick("p1")).toMatchObject({ move: null, roundScore: DEFAULT_SETTINGS.missedMoveScore });
    expect(pick("p2").roundScore).toBeCloseTo(-2 * BOSS_POWERS.darkTryCost, 6);
  });

  it("Lights out: at the start of his turn, before his move; the server times each round and judges each player's taps; the misses cost; then his move", () => {
    const L = raid({ bossId: "hollow", bossPowerTest: "lightsout" });
    crowdMove(L);
    hostBoss(L);
    toRound(L);
    crowdMove(L);
    // The boss's turn: Lights out first (no request for his move yet), the same test for both.
    const l1 = L.last("p1", "lights")!;
    const l2 = L.last("p2", "lights")!;
    expect(l1).toBeTruthy();
    expect(L.last("p1", "bossRequest")).toBeUndefined();
    expect(l1.lights.rounds.map((r) => r.pieces.length)).toEqual([1, 2, 3]);
    expect(l1.lights.rounds).toEqual(l2.lights.rounds);
    expect(l1.lights.rounds.every((r) => !r.answers)).toBe(true);
    const fen = l1.boss.board.fen;
    // The squares answering a round's first target (his pieces of its type; a pawn on its file).
    const his = (round: number) => {
      const t = l1.lights.rounds[round]!.targets![0]!;
      return ["a", "b", "c", "d", "e", "f", "g", "h"].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`)).filter((s) => pieceAt(fen, s)?.color === "b" && pieceAt(fen, s)!.type === t.type && (!t.file || s[0] === t.file));
    };
    const at = l1.lights.at;
    const tl = lightsOutTimeline(l1.lights.rounds, DEFAULT_SETTINGS.lateGraceMs);
    const grace = DEFAULT_SETTINGS.lateGraceMs;
    const none = { found: [], wrong: [], used: 0 };
    // A tap before the round opens: nothing.
    L.core.message("p1", { t: "lightsTap", key: l1.lights.key, round: 0, square: his(0)[0]! });
    expect(L.last("p1", "lights")!.lights.mine[0]).toEqual(none);
    L.advance(at + tl.rounds[0]!.at + 500 - L.now);
    // p1 finds round 1's piece; p2 taps an empty square.
    const target = his(0)[0]!;
    // (The crowd's count before anyone taps: nothing settled, 6 pieces asked of each of the two.)
    expect(l1.lights.crowd).toEqual({ found: 0, settled: 0, asked: 12 });
    L.core.message("p1", { t: "lightsTap", key: l1.lights.key, round: 0, square: target });
    expect(L.last("p1", "lights")!.lights.mine[0]).toEqual({ found: [target], wrong: [], used: 1 });
    expect(L.last("p1", "lights")!.lights.rounds[0]!.answers).toBeUndefined();
    // Everyone's meter moves with the tap: the server's count, the same for both (Eric, Oct 10).
    expect(L.last("p1", "lights")!.lights.crowd).toEqual({ found: 1, settled: 1, asked: 12 });
    expect(L.last("p2", "lightsCrowd")).toMatchObject({ key: l1.lights.key, crowd: { found: 1, settled: 1, asked: 12 } });
    L.core.message("p2", { t: "lightsTap", key: l1.lights.key, round: 0, square: "e4" });
    // Everyone has used their tries (one piece, one try): the round is over at once, its answers go out.
    expect(L.last("p2", "lights")!.lights.mine[0]).toEqual({ found: [], wrong: ["e4"], used: 1 });
    const over = L.last("p1", "lights")!.lights.rounds[0]!;
    expect(over.answers).toEqual(his(0).sort());
    expect(over.endedAt).toBe(L.now - at);
    expect(L.last("p1", "lights")!.lights.rounds[1]!.answers).toBeUndefined();
    // A late tap for a round that's over: nothing.
    L.core.message("p2", { t: "lightsTap", key: l1.lights.key, round: 0, square: target });
    expect(L.last("p2", "lights")!.lights.mine[0]!.found).toEqual([]);
    // Round 2 follows round 1's answers. p1 taps once (wrong): a second more, for p1. p2 doesn't tap.
    const r1 = lightsOutTimeline(L.last("p1", "lights")!.lights.rounds, grace).rounds[1]!;
    L.advance(at + r1.at + 200 - L.now);
    L.core.message("p1", { t: "lightsTap", key: l1.lights.key, round: 1, square: "e4" });
    expect(L.last("p1", "lights")!.lights.mine[1]).toMatchObject({ wrong: ["e4"], used: 1 });
    // p2's own time is up at its seconds (and the grace): a tap after is refused.
    L.advance(at + r1.until + grace + 200 - L.now);
    L.core.message("p2", { t: "lightsTap", key: l1.lights.key, round: 1, square: his(1)[0]! });
    expect(L.last("p2", "lights")!.lights.mine[1]).toEqual(none);
    // But the round isn't over: p1 still has a try and a second more.
    expect(L.last("p1", "lights")!.lights.rounds[1]!.answers).toBeUndefined();
    L.advance(at + r1.until + BOSS_POWERS.lightsOutTapMs + grace + 10 - L.now);
    expect(L.last("p1", "lights")!.lights.rounds[1]!.answers).toBeTruthy();
    // (Ended when the server saw it: never before its time, so nobody loses any.)
    expect(L.last("p1", "lights")!.lights.rounds[1]!.endedAt).toBe(L.now - at);
    expect(L.now - at).toBeGreaterThanOrEqual(r1.until + BOSS_POWERS.lightsOutTapMs + grace);
    const before = Object.fromEntries(L.last("p1", "lights")!.standings.map((s) => [s.id, s.points]));
    // Through round 3 (nobody taps), then the lights come back and he moves.
    for (let i = 0; i < 6 && !L.last("p1", "bossRequest"); i++) L.advance(5000);
    const req = L.last("p1", "bossRequest");
    expect(req).toBeTruthy();
    const after = Object.fromEntries(L.last("p1", "boss")!.standings.map((s) => [s.id, s.points]));
    // p1 found 1 of 6 pieces, p2 none: -50 and -60.
    expect(after.p1! - before.p1!).toBe(-5 * BOSS_POWERS.lightsOutMiss);
    expect(after.p2! - before.p2!).toBe(-6 * BOSS_POWERS.lightsOutMiss);
    expect(L.last("p1", "boss")!.boss.powers!.lightsAt).toBe(2);
    // 1 of 12 found, under the line: as the last round ended, every screen had the count to say so.
    expect(L.last("p2", "lights")!.lights.crowd).toEqual({ found: 1, settled: 12, asked: 12 });
    expect(L.last("p1", "boss")!.boss.powers!.lightsExtra).toBe("due");
    hostBoss(L);
    // After his own move (and its moments), he thinks again: the host is asked for his extra move.
    for (let i = 0; i < 6 && !L.last("p1", "bossRequest"); i++) L.advance(5000);
    const extra = L.last("p1", "bossRequest")!;
    expect(extra).toMatchObject({ extra: true });
    expect(L.core.save().phase).toBe("boss");
    expect(L.last("p2", "boss")!.thinking).toBe(true);
    const quiet = extraMoveCandidates(passTurn(extra.fen)!);
    L.core.message("p1", { t: "bossMove", key: extra.key, move: quiet[0]! });
    const shown = L.last("p2", "boss")!;
    expect(shown.boss.lastMove!.move).toBe(quiet[0]);
    expect(shown.boss.powers!.lightsExtra).toBe("played");
    expect(shown.boss.powers!.events.some((e) => e.kind === "extra")).toBe(true);
    expect(shown.until - L.now).toBe(POWER_FX.extra);
    const h = shown.boss.board.history;
    expect(sideToMove(shown.boss.board.fen)).toBe("w");
    expect(h.length).toBe(5); // e2e4-ish, his reply, the crowd's 2nd, his move, his extra move
    const round = toRound(L);
    expect(round.boss!.powers!.lightsAt).toBe(2);
    expect(round.board!.history.length).toBe(5);
  });

  it("Lights out held (the crowd's find rate at the line or over): no extra move; and his extra move, asked of a host that can't, is skipped", () => {
    const L = raid({ bossId: "hollow", bossPowerTest: "lightsout" });
    crowdMove(L);
    hostBoss(L);
    toRound(L);
    crowdMove(L);
    const l1 = L.last("p1", "lights")!;
    const fen = l1.boss.board.fen;
    const squares = (round: number) =>
      l1.lights.rounds[round]!.targets!.map((t) => ["a", "b", "c", "d", "e", "f", "g", "h"].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`)).find((s) => pieceAt(fen, s)?.color === "b" && pieceAt(fen, s)!.type === t.type && (!t.file || s[0] === t.file))!);
    // Both find everything they're asked (a piece named twice in a round needs two squares: the test's own rounds don't).
    for (let k = 0; k < 3; k++) {
      const tl = lightsOutTimeline(L.last("p1", "lights")!.lights.rounds, DEFAULT_SETTINGS.lateGraceMs).rounds[k]!;
      L.advance(Math.max(0, l1.lights.at + tl.at + 100 - L.now));
      for (const id of ["p1", "p2"]) for (const sq of [...new Set(squares(k))]) L.core.message(id, { t: "lightsTap", key: l1.lights.key, round: k, square: sq });
    }
    for (let i = 0; i < 6 && !L.last("p1", "bossRequest"); i++) L.advance(5000);
    const c = L.last("p1", "lights")!.lights.crowd!;
    expect(c.settled).toBe(c.asked);
    expect(c.found / c.asked).toBeGreaterThanOrEqual(BOSS_POWERS.lightsOutHold);
    expect(L.last("p1", "boss")!.boss.powers!.lightsExtra).toBeUndefined();
    hostBoss(L);
    const round = toRound(L);
    expect(round.board!.history.length).toBe(4);

    // Under the line, and the host finds no quiet move within the cap (it answers ""): he skips it, the crowd's turn goes on.
    const M = raid({ bossId: "hollow", bossPowerTest: "lightsout" });
    crowdMove(M);
    hostBoss(M);
    toRound(M);
    crowdMove(M);
    // (Nobody taps: the rounds run their time out.)
    for (let i = 0; i < 12 && !M.last("p1", "bossRequest"); i++) M.advance(5000);
    hostBoss(M);
    for (let i = 0; i < 12 && !M.last("p1", "bossRequest"); i++) M.advance(5000);
    const ask = M.last("p1", "bossRequest")!;
    expect(ask).toMatchObject({ extra: true });
    M.core.message("p1", { t: "bossMove", key: ask.key, move: "" });
    const r = toRound(M);
    expect(r.board!.history.length).toBe(4);
    expect(r.boss!.powers!.lightsExtra).toBe("skipped");
  });
});

describe("Big Boy online", () => {
  /** To the next crowd turn's round message (past the boss's move and his moments). */
  const toRound = (L: ReturnType<typeof setup>) => {
    for (let i = 0; i < 10 && L.core.save().phase !== "play"; i++) L.advance(10_000);
    return L.last("p1", "round")!;
  };
  /** Everyone plays an allowed move that keeps the battle going (any of them: the toy block's limits). */
  const play = (L: ReturnType<typeof setup>) => crowdMove(L);

  it("his snack before move 1 and his toy blocks: the same for everyone, the crowd's moves and the jobs keep off the block", () => {
    const L = raid({ bossId: "bigboy" });
    const r1 = L.last("p1", "round")!;
    expect(r1.boss!.id).toBe("bigboy");
    expect(r1.board!.history).toEqual([]);
    const snack = r1.boss!.powers!.snack!;
    expect(["d2", "e2"]).toContain(snack);
    expect(pieceAt(r1.board!.fen, snack)).toBeNull();
    expect(r1.board!.bases).toEqual([{ ply: 0, fen: r1.board!.fen }]);
    expect(L.last("p2", "round")!.boss!.powers!.snack).toBe(snack);
    play(L);
    hostBoss(L);
    const b = L.last("p1", "boss")!;
    const block = b.boss.powers!.events.find((e) => e.kind === "block")!;
    expect(block).toMatchObject({ kind: "block", turn: 2 });
    expect(b.boss.powers).toEqual(L.last("p2", "boss")!.boss.powers);
    expect(b.boss.powers!.block).toEqual({ square: block.square, at: 2, until: 2 + BOSS_POWERS.blockTurns - 1 });
    expect(b.until - L.now).toBeGreaterThanOrEqual(POWER_FX.block);
    const r2 = toRound(L);
    const allowed = r2.boss!.powers!.allowed!;
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.some((m) => m.slice(2, 4) === block.square)).toBe(false);
    expect(legalMoves(r2.board!.fen).some((m) => m.slice(2, 4) === block.square)).toBe(true);
    // A pick onto the block is refused; the scoring job carries the allowed moves.
    L.core.message("p1", { t: "pick", key: r2.key, move: legalMoves(r2.board!.fen).find((m) => m.slice(2, 4) === block.square)! });
    const req = crowdMove(L);
    expect(req.jobs[0]!.allowed).toEqual(allowed);
  });

  it("the Big Bounce: at the start of his turn the host scores the candidates; everyone sees the bounce and the new position; then his move", () => {
    const L = raid({ bossId: "bigboy", bossPowerTest: "bounce" });
    play(L);
    hostBoss(L);
    const warned = toRound(L);
    expect(warned.boss!.powers!.warned).toBe(true);
    play(L);
    // His turn: the host is asked to pick the bounce, not his move; everyone sees him get ready.
    const ask = L.last("p1", "bossRequest")!;
    expect(ask.bounce!.length).toBe(BOSS_POWERS.bounceCandidates);
    expect(ask.allowed).toBeUndefined();
    expect(L.last("p2", "boss")!.thinking).toBe(true);
    const before = ask.fen;
    const pick = ask.bounce![3]!;
    L.inbox.set("p1", []);
    L.core.message("p1", { t: "bossMove", key: ask.key, move: pick });
    const shown = L.last("p2", "boss")!;
    expect(shown.boss.board.fen).toBe(pick);
    expect(shown.boss.powers!.bounce).toMatchObject({ at: 2, before });
    expect(shown.boss.powers!.bounce!.moves.length).toBeGreaterThanOrEqual(2);
    expect(shown.boss.powers!.bounce!.spots).toHaveLength(3);
    expect(shown.boss.powers!.events.at(-1)).toEqual({ kind: "bounce", turn: 2 });
    expect(shown.boss.powers).toEqual(L.last("p1", "boss")!.boss.powers);
    expect(shown.until - L.now).toBe(POWER_FX.bounce);
    expect(shown.boss.board.bases).toContainEqual({ ply: shown.boss.board.history.length, fen: pick });
    // Then his own move, from the new position.
    L.advance(shown.until - L.now + 10);
    const move = L.last("p1", "bossRequest")!;
    expect(move.bounce).toBeUndefined();
    expect(move.fen).toBe(pick);
    hostBoss(L);
    const r3 = toRound(L);
    // (The crowd's two moves and his two: the bounce isn't a move.)
    expect(r3.board!.history.length).toBe(4);
    expect(r3.boss!.powers!.rage).toBeNull();
  });

  it("nothing within the cap (the host answers \"\"), anything that isn't a candidate, or no host at all: the bounces play, nothing moves", () => {
    for (const answer of ["", "8/8/8/8/8/8/8/K6k b - - 0 1", null]) {
      const L = raid({ bossId: "bigboy", bossPowerTest: "bounce" });
      play(L);
      hostBoss(L);
      toRound(L);
      play(L);
      const ask = L.last("p1", "bossRequest")!;
      if (answer === null) {
        // (The host goes quiet: after the timeout another is asked; nobody answers, so nothing moves.)
        L.core.disconnect("p2");
        for (let i = 0; i < 6 && !L.last("p1", "boss")?.boss.powers?.bounce; i++) L.advance(15_000);
      } else L.core.message("p1", { t: "bossMove", key: ask.key, move: answer });
      const shown = L.last("p1", "boss")!;
      expect(shown.boss.powers!.bounce!.moves).toEqual([]);
      expect(shown.boss.board.fen).toBe(ask.fen);
    }
  });

  it("the admins' trigger: the bounce at the start of his turn after the crowd's move, without the warning", () => {
    const L = raid({ bossId: "bigboy" });
    expect(L.core.ultimateTrigger("p1", true)).toBe(true);
    play(L);
    const ask = L.last("p1", "bossRequest")!;
    expect(ask.bounce).toBeTruthy();
    L.core.message("p1", { t: "bossMove", key: ask.key, move: ask.bounce![0]! });
    expect(L.last("p2", "boss")!.boss.powers!.bounce!.at).toBe(1);
    expect(L.last("p2", "boss")!.boss.powers!.warned).toBe(false);
    expect(L.core.ultimateTrigger("p1", true)).toBe(false);
  });
});

describe("Sawyer online", () => {
  const toRound = (L: ReturnType<typeof setup>) => {
    for (let i = 0; i < 10 && L.core.save().phase !== "play"; i++) L.advance(10_000);
    return L.last("p1", "round")!;
  };
  const middle = (m: string) => m.charCodeAt(0) - 97 <= 3 !== m.charCodeAt(2) - 97 <= 3;

  it("his first move is a pawn move (the host is told); with all 8 of his pawns still there, the split waits (no ninth pawn), the same for everyone", () => {
    const L = raid({ bossId: "sawyer" });
    const r1 = L.last("p1", "round")!;
    expect(r1.boss!.id).toBe("sawyer");
    expect(r1.boss!.powers!.split ?? null).toBeNull();
    crowdMove(L);
    const req = L.last("p1", "bossRequest")!;
    expect(req.allowed!.length).toBeGreaterThan(0);
    for (const m of req.allowed!) expect(pieceAt(req.fen, m.slice(0, 2))!.type).toBe("p");
    // A host that answers with something else gets the first allowed move played instead.
    const knight = legalMoves(req.fen).find((m) => pieceAt(req.fen, m.slice(0, 2))!.type === "n")!;
    L.core.message("p1", { t: "bossMove", key: req.key, move: knight });
    const b = L.last("p1", "boss")!;
    expect(b.boss.board.lastMove).toBe(req.allowed![0]);
    const split = b.boss.powers!.split!;
    expect(split).toEqual(L.last("p2", "boss")!.boss.powers!.split);
    // (The opening here, 5 moves into the Ruy Lopez, has taken none of his pawns.)
    expect(split).toMatchObject({ pawn: req.allowed![0]!.slice(2, 4), square: null, waiting: true });
    expect([...b.boss.board.fen.split(" ")[0]!].filter((c) => c === "p").length).toBe(8);
    expect(b.boss.powers!.events.map((e) => e.kind)).not.toContain("split");
    expect(b.until - b.now).toBe(bossShowMs(b.boss.lastMove));
  });

  it("a saw cut on the 3rd turn: the crowd's moves and the jobs keep off it; the board saw (the test switch) keeps everything on its half", () => {
    const L = raid({ bossId: "sawyer", bossPowerTest: "boardsaw" });
    crowdMove(L);
    hostBoss(L);
    const r2 = toRound(L);
    expect(r2.boss!.powers!.warned).toBe(true);
    crowdMove(L);
    hostBoss(L);
    const b = L.last("p1", "boss")!;
    expect(b.boss.powers!.events.map((e) => e.kind)).toContain("boardsaw");
    expect(b.boss.powers!.boardSaw).toEqual({ at: 3, until: 3 + BOSS_POWERS.boardSawTurns - 1 });
    expect(b.until - b.now).toBeGreaterThanOrEqual(POWER_FX.boardsaw);
    const r3 = toRound(L);
    const allowed = r3.boss!.powers!.allowed!;
    expect(allowed.length).toBeGreaterThan(0);
    for (const m of allowed) expect(middle(m)).toBe(false);
    expect(legalMoves(r3.board!.fen).some(middle)).toBe(true);
    const req = crowdMove(L);
    expect(req.jobs[0]!.allowed).toEqual(allowed);
    // (Past the boss's strike after the crowd's 3rd move.)
    for (let i = 0; i < 10 && !L.last("p1", "bossRequest"); i++) L.advance(10_000);
    hostBoss(L);
    // The cut that waited a turn for the saw comes on the 4th.
    const r4 = toRound(L);
    const cut = r4.boss!.powers!.cut!;
    expect(cut).toMatchObject({ at: 4, until: 4 + BOSS_POWERS.sawTurns - 1 });
    expect(r4.boss!.powers!.cut).toEqual(L.last("p2", "round")!.boss!.powers!.cut);
  });

  it("the admins' trigger: the board saw as the next crowd turn begins, without the warning", () => {
    const L = raid({ bossId: "sawyer" });
    expect(L.core.ultimateTrigger("p1", true)).toBe(true);
    crowdMove(L);
    hostBoss(L);
    const b = L.last("p2", "boss")!;
    expect(b.boss.powers!.boardSaw).toEqual({ at: 2, until: 1 + BOSS_POWERS.boardSawTurns });
    expect(b.boss.powers!.warned).toBe(false);
    expect(L.core.ultimateTrigger("p1", true)).toBe(false);
  });
});
