import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { FIRE_BURN_MS, POWER_FX, bossShowMs, initPowers, legalMoves, pieceAt, sanLineToUci, type BoardScore, type MatchRunner, type Opening, type ServerMessage } from "@chessroyale/chess";
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
  const L = setup({ ...RAID_SETTINGS, lastStandLoss: 999, lastStandLossFloor: 999, ...patch });
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
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      const L = setup({ ...RAID_SETTINGS }, {}, seed);
      L.core.connect(undefined, "A", "computer", false, 1500);
      L.core.message("p1", { t: "start" });
      ids.add(L.core.save().runner!.state.boss!.id!);
    }
    expect([...ids].sort()).toEqual(["clown", "gingerbread", "grex", "hollow"]);
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
    const his = (t: string) => ["a", "b", "c", "d", "e", "f", "g", "h"].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`)).filter((s) => pieceAt(fen, s)?.color === "b" && pieceAt(fen, s)!.type === t);
    const at = l1.lights.at;
    const tl = { r0: 1300 + 2900 + 300 };
    // A tap before the round opens: nothing.
    L.core.message("p1", { t: "lightsTap", key: l1.lights.key, round: 0, square: his(l1.lights.rounds[0]!.pieces[0]!)[0]! });
    expect(L.last("p1", "lights")!.lights.mine[0]).toEqual({ found: [], wrong: [] });
    L.advance(at + tl.r0 + 500 - L.now);
    // p1 finds round 1's piece; p2 taps an empty square.
    const target = his(l1.lights.rounds[0]!.pieces[0]!)[0]!;
    L.core.message("p1", { t: "lightsTap", key: l1.lights.key, round: 0, square: target });
    L.core.message("p2", { t: "lightsTap", key: l1.lights.key, round: 0, square: "e4" });
    expect(L.last("p1", "lights")!.lights.mine[0]).toEqual({ found: [target], wrong: [] });
    expect(L.last("p2", "lights")!.lights.mine[0]).toEqual({ found: [], wrong: ["e4"] });
    // (Out of tries: one piece, one try.)
    L.core.message("p2", { t: "lightsTap", key: l1.lights.key, round: 0, square: target });
    expect(L.last("p2", "lights")!.lights.mine[0]).toEqual({ found: [], wrong: ["e4"] });
    // The round ends (its seconds and the late grace): its answers go out.
    L.advance(at + tl.r0 + 3000 + DEFAULT_SETTINGS.lateGraceMs + 10 - L.now);
    expect(L.last("p1", "lights")!.lights.rounds[0]!.answers).toEqual(his(l1.lights.rounds[0]!.pieces[0]!).sort());
    expect(L.last("p1", "lights")!.lights.rounds[1]!.answers).toBeUndefined();
    // A late tap for a round that's over: nothing.
    L.core.message("p2", { t: "lightsTap", key: l1.lights.key, round: 0, square: target });
    expect(L.last("p2", "lights")!.lights.mine[0]!.found).toEqual([]);
    const before = Object.fromEntries(L.last("p1", "lights")!.standings.map((s) => [s.id, s.points]));
    // Through rounds 2 and 3 (nobody taps), then the lights come back and he moves.
    for (let i = 0; i < 6 && !L.last("p1", "bossRequest"); i++) L.advance(5000);
    const req = L.last("p1", "bossRequest");
    expect(req).toBeTruthy();
    expect(L.now - at).toBeGreaterThanOrEqual(1300 + 2900 + 300 + 3000 + 4000 + 5000 + 3 * (DEFAULT_SETTINGS.lateGraceMs + 1800) + 2300);
    const after = Object.fromEntries(L.last("p1", "boss")!.standings.map((s) => [s.id, s.points]));
    // p1 found 1 of 6 pieces, p2 none: -50 and -60.
    expect(after.p1! - before.p1!).toBe(-5 * BOSS_POWERS.lightsOutMiss);
    expect(after.p2! - before.p2!).toBe(-6 * BOSS_POWERS.lightsOutMiss);
    expect(L.last("p1", "boss")!.boss.powers!.lightsAt).toBe(2);
    hostBoss(L);
    expect(toRound(L).boss!.powers!.lightsAt).toBe(2);
  });
});
