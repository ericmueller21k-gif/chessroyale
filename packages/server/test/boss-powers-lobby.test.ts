import { afterEach, describe, expect, it, vi } from "vitest";
import { BOSS_BANNER, BOSS_BRAIN, BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, bossBrainFor, maiaRatingFor, mulberry32, type Settings } from "@chessroyale/core";
import { FIRE_BURN_MS, POWER_FX, applyMove, bossMoveFrom, bossShowMs, bossTurnShowMs, dragOptions, extraMoveCandidates, inCheck, initPowers, legalMoves, lightsOutTimeline, lineups, passTurn, pieceAt, queenSlain, sanLineToUci, sideToMove, withPiece, withoutPiece, type BoardScore, type BossMoveKind, type EngineLike, type HumanEngineLike, type MatchRunner, type Opening, type ServerMessage } from "@chessroyale/chess";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

afterEach(() => vi.restoreAllMocks());

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
    // (The boss's strikes held off: the blizzard's three turns played through without one.)
    const L = raid({ bossId: "gingerbread", bossPowerTest: "blizzard", bossKillEvery: 99 });
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
    // The blizzard: only its free piece (a random one with a move, from the seed) moves this turn; every screen ices
    // the rest, and everyone is told the same piece.
    const b3 = L.last("p2", "boss")!;
    expect(b3.boss.powers!.events.map((e) => e.kind)).toEqual(["blizzard"]);
    expect(L.last("p1", "boss")!.boss.powers!.events).toEqual(b3.boss.powers!.events);
    const free = b3.boss.powers!.events[0]!.square!;
    L.advance(b3.until - L.now + 10);
    const r3 = L.last("p2", "round")!;
    const fen = r3.board!.fen;
    const allowed = r3.boss!.powers!.allowed!;
    expect(allowed.length).toBeGreaterThan(0);
    expect(pieceAt(fen, free)!.color).toBe("w");
    for (const m of allowed) expect(m.slice(0, 2)).toBe(free);
    expect(r3.boss!.powers!.iced).not.toContain(free);
    // The pieces due to thaw next turn: named the same for everyone, among the iced ones.
    const due = r3.boss!.powers!.thaw!;
    expect(due.length).toBeGreaterThanOrEqual(3);
    expect(L.last("p1", "round")!.boss!.powers!.thaw).toEqual(due);
    for (const sq of due) expect(r3.boss!.powers!.iced).toContain(sq);
    expect(crowdMove(L).jobs[0]!.allowed).toEqual(allowed);
    // The boss's turn: the ice stays on for everyone.
    expect(L.last("p1", "boss")!.boss.powers!.iced).toEqual(r3.boss!.powers!.iced);
    hostBoss(L);
    // As turn 4 begins, the thaw (Eric, Oct 12): the same pieces freed for everyone (the cracked ones, from the seed),
    // the clock waits for it; four or five free in all, only they move, and the rest are due to thaw next turn.
    const b4 = L.last("p1", "boss")!;
    expect(L.last("p2", "boss")!.boss.powers).toEqual(b4.boss.powers);
    expect(b4.boss.powers!.events.map((e) => e.kind)).toEqual(["thaw"]);
    expect(b4.until - b4.now).toBe(bossShowMs(b4.boss.lastMove) + POWER_FX.thaw);
    const thawed = b4.boss.powers!.events[0]!.squares!;
    for (const sq of due) if (pieceAt(b4.boss.board.fen, sq)?.color === "w") expect(thawed).toContain(sq);
    L.advance(b4.until - L.now + 10);
    const r4 = L.last("p1", "round")!;
    expect(L.last("p2", "round")!.boss!.powers).toEqual(r4.boss!.powers);
    const iced4 = r4.boss!.powers!.iced;
    const crowd = (fen: string) => [..."abcdefgh"].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`)).filter((sq) => pieceAt(fen, sq)?.color === "w");
    const free4 = crowd(r4.board!.fen).filter((sq) => !iced4.includes(sq));
    expect(free4.length).toBeGreaterThanOrEqual(4);
    expect(free4.length).toBeLessThanOrEqual(6);
    expect(r4.boss!.powers!.thaw).toEqual(iced4);
    for (const m of r4.boss!.powers!.allowed!) expect(iced4).not.toContain(m.slice(0, 2));
    // A move of an iced piece is refused.
    const stuck = legalMoves(r4.board!.fen).find((m) => iced4.includes(m.slice(0, 2)));
    if (stuck) {
      L.core.message("p2", { t: "pick", key: r4.key, move: stuck });
      expect(L.core.record.round!.picks.p2).toBeUndefined();
    }
    expect(crowdMove(L).jobs[0]!.allowed).toEqual(r4.boss!.powers!.allowed);
    hostBoss(L);
    // Turn 5, its last: the rest thaw for everyone, every move allowed; the meter still held empty.
    const b5 = L.last("p2", "boss")!;
    expect(L.last("p1", "boss")!.boss.powers).toEqual(b5.boss.powers);
    expect(b5.boss.powers!.events.map((e) => e.kind)).toEqual(["thaw"]);
    expect(b5.boss.powers!.iced).toEqual([]);
    expect(b5.boss.powers!.paused).toBe(true);
    L.advance(b5.until - L.now + 10);
    expect(L.last("p1", "round")!.boss!.powers!.allowed).toBeNull();
    crowdMove(L);
    // Power turns (the freeze, the blizzard and its thaw) don't count for fair play; the first turn, before any
    // power, and the blizzard's last, with every piece free, do.
    expect(L.core.fairMoves("p1").map((m) => !!m.power)).toEqual([false, true, true, true, false]);
  });

  it("Boingo: his pies kept off by both sides; the funhouse: the host plays the crowd's move once (unscored), the same for everyone, then the board turned for all", () => {
    const L = raid({ bossId: "clown", bossPowerTest: "funhouse" });
    crowdMove(L);
    hostBoss(L);
    const warned = L.last("p1", "boss")!;
    expect(warned.boss.powers!.events.map((e) => e.kind).sort()).toEqual(["pie", "warn"]);
    const pie = warned.boss.powers!.pies![0]!.square;
    expect(warned.boss.powers!.pie!.square).toBe(pie);
    L.advance(warned.until - L.now + 10);
    const r2 = L.last("p1", "round")!;
    expect((r2.boss!.powers!.allowed ?? legalMoves(r2.board!.fen)).some((m) => m.slice(2, 4) === pie)).toBe(false);
    crowdMove(L);
    const req = hostBoss(L);
    // The boss never moves onto the pie either.
    if (req.allowed) expect(req.allowed.some((m) => m.slice(2, 4) === pie)).toBe(false);
    // His move shows the board the right way up still (it turns in the funhouse's own moment).
    const before = L.last("p1", "boss")!;
    expect(before.boss.powers!.angle).toBe(0);
    expect(before.boss.powers!.events.map((e) => e.kind)).not.toContain("funhouse");
    L.advance(before.until - L.now + 10);
    // The funhouse: the host is asked for the crowd's move (from the crowd's allowed ones), nobody picks.
    const f = L.last("p1", "bossRequest")!;
    expect(f.funhouse).toBe(true);
    const crowdOk = L.core.save().runner!.state.boss!.powers!.pies!.map((x) => x.square);
    if (f.allowed) expect(f.allowed.some((m) => crowdOk.includes(m.slice(2, 4)))).toBe(false);
    expect(L.core.record.phase).toBe("boss");
    const scoresBefore = L.core.save().runner!.state.players.map((p) => p.finalLosses.length);
    hostBoss(L);
    const fun = L.last("p2", "boss")!;
    const played = fun.boss.powers!.funhouse!;
    expect(played.move).toBe((f.allowed ?? legalMoves(f.fen))[0]);
    expect(played.san).toBeTruthy();
    expect(fun.boss.powers!.events.map((e) => e.kind)).toContain("funhouse");
    expect(fun.boss.powers!.angle).toBe(180);
    expect(fun.until - fun.now).toBe(POWER_FX.funhouse);
    // Everyone sees the same funhouse and the same move, on the board.
    expect(L.last("p1", "boss")!.boss.powers).toEqual(fun.boss.powers);
    expect(L.last("p1", "boss")!.boss.board.fen).toBe(fun.boss.board.fen);
    expect(fun.boss.board.ply).toBe(before.boss.board.ply + 1);
    // Unscored.
    expect(L.core.save().runner!.state.players.map((p) => p.finalLosses.length)).toEqual(scoresBefore);
    // Then the boss replies (nobody is asked for the crowd's move again), and the crowd's own turn shows the board
    // upside down for everyone.
    L.advance(fun.until - L.now + 10);
    const reply = L.last("p1", "bossRequest")!;
    expect(reply.funhouse).toBeUndefined();
    hostBoss(L);
    L.advance(L.last("p1", "boss")!.until - L.now + 10);
    expect(L.core.record.phase).toBe("play");
    const r3 = L.last("p1", "round")!;
    expect(r3.boss!.powers!.angle).toBe(180);
    expect(L.last("p2", "round")!.boss!.powers!.angle).toBe(180);
    expect(r3.boss!.powers!.funhouse!.move).toBe(played.move);
    // Once: the next turns are the crowd's own.
    crowdMove(L);
    // (The boss's strike may play first.)
    for (let i = 0; i < 10 && !L.last("p1", "bossRequest"); i++) L.advance(5_000);
    expect(L.last("p1", "bossRequest")!.funhouse).toBeUndefined();
  });

  it("Boingo's funhouse with no engine anywhere: a random allowed crowd move, still unscored, and the match goes on", () => {
    const L = raid({ bossId: "clown", bossPowerTest: "funhouse" }, [null]);
    crowdMove(L, ["p1"]);
    hostBoss(L);
    L.advance(L.last("p1", "boss")!.until - L.now + 10);
    crowdMove(L, ["p1"]);
    hostBoss(L);
    L.advance(L.last("p1", "boss")!.until - L.now + 10);
    const f = L.last("p1", "bossRequest")!;
    expect(f.funhouse).toBe(true);
    const scoresBefore = L.core.save().runner!.state.players.map((p) => p.finalLosses.length);
    // The only device doesn't answer: the server plays one itself.
    L.inbox.set("p1", (L.inbox.get("p1") ?? []).filter((m) => m.t !== "bossRequest"));
    L.advance(16_000);
    const fun = L.last("p1", "boss")!;
    expect(fun.boss.powers!.funhouse!.move).toBeTruthy();
    expect(f.allowed ?? legalMoves(f.fen)).toContain(fun.boss.powers!.funhouse!.move);
    expect(L.core.save().runner!.state.players.map((p) => p.finalLosses.length)).toEqual(scoresBefore);
    // Then the boss's own move is asked for.
    L.advance(fun.until - L.now + 10);
    expect(L.last("p1", "bossRequest")!.funhouse).toBeUndefined();
  });

  it("a random boss avoids the one most of the lobby met last; only playable bosses are met", () => {
    for (const seed of [1, 2, 3, 4]) {
      const L = setup({ ...RAID_SETTINGS }, {}, seed);
      for (const [i, b] of ["clown", "clown", "gingerbread"].entries()) L.core.connect(undefined, `P${i}`, "computer", false, 1500, undefined, undefined, b);
      L.core.message("p1", { t: "start" });
      expect(L.core.save().runner!.state.boss!.id).not.toBe("clown");
    }
    const ids = new Set<string>();
    for (let seed = 1; seed <= 80 && ids.size < 8; seed++) {
      const L = setup({ ...RAID_SETTINGS }, {}, seed);
      L.core.connect(undefined, "A", "computer", false, 1500);
      L.core.message("p1", { t: "start" });
      ids.add(L.core.save().runner!.state.boss!.id!);
    }
    expect([...ids].sort()).toEqual(["alfil", "bigboy", "clown", "gingerbread", "grex", "hollow", "pig", "sawyer"]);
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

/**
 * The boss's (Black's) queen moved onto the crowd's third rank where a crowd pawn takes it (never the toy block, never
 * giving check), as a power places pieces; with that capture.
 */
function queenEnPrise(fen: string, block: string | null): { fen: string; take: string } {
  const squares = "abcdefgh".split("").flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${f}${n}`));
  const queen = squares.find((sq) => pieceAt(fen, sq)?.color === "b" && pieceAt(fen, sq)?.type === "q")!;
  for (const sq of ["d3", "e3", "c3", "f3", "b3", "g3", "a3", "h3"]) {
    if (sq === block || pieceAt(fen, sq)) continue;
    const f = withPiece(withoutPiece(fen, queen), sq, { color: "b", type: "q" });
    if (inCheck(f)) continue;
    const take = legalMoves(f).find((m) => m.slice(2, 4) === sq && pieceAt(f, m.slice(0, 2))?.type === "p");
    if (take) return { fen: f, take };
  }
  throw new Error("no square for his queen");
}

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
    // The meter spent: it fills again from empty (several ultimates a battle).
    expect(r3.boss!.powers!.rage).toBe(0);
    expect(r3.boss!.powers!.ultAt).toBeNull();
    expect(r3.boss!.powers!.ults).toBe(1);
  });

  it("your move takes his queen just before the Big Bounce: the bounce waits for QUEEN SLAIN!, his move after it doesn't", () => {
    // (Eric, Oct 16: the banner flashed up again for a second after his ult. His turn thinks twice on the same last move:
    // for the bounce, then for his move; the banner, and the wait for it, belong to the first only.)
    const L = raid({ bossId: "bigboy", bossPowerTest: "bounce" });
    play(L);
    hostBoss(L);
    // His queen where a crowd pawn takes it, before the next turn is dealt (as a power places pieces: a base).
    const runner = (L.core as unknown as { runner: MatchRunner }).runner;
    const board = runner.boards.get(0)!;
    const ply = board.history.length;
    const { fen, take } = queenEnPrise(board.fen, runner.state.boss!.powers!.block?.square ?? null);
    runner.boards.set(0, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen }] });
    const r = toRound(L);
    expect(r.board!.fen).toBe(fen);
    expect(r.boss!.powers!.allowed ?? legalMoves(fen)).toContain(take);
    for (const id of ["p1", "p2"]) L.core.message(id, { t: "pick", key: L.last(id, "round")!.key, move: take });
    expect(L.hostScores("p1")).toBe(true);
    L.advance(30_000);
    // The bounce's thinking: your banner; the bounce, in at once, waits for it.
    const ask = L.last("p1", "bossRequest")!;
    expect(ask.bounce).toBeTruthy();
    const thinking = L.last("p2", "boss")!;
    expect(thinking.thinking).toBe(true);
    expect(thinking.boss.board.history.at(-1)).toBe(take);
    expect(queenSlain(thinking.boss)).toBe(true);
    expect(L.core.record.bossMinAt).toBe(thinking.now + BOSS_BANNER.ms + 500);
    L.core.message("p1", { t: "bossMove", key: ask.key, move: ask.bounce![0]! });
    expect(L.last("p2", "boss")!.boss.powers!.bounce?.at).not.toBe(thinking.boss.crowdMoves);
    L.advance(L.core.record.bossMinAt! - L.now + 10);
    const shown = L.last("p2", "boss")!;
    expect(shown.boss.powers!.bounce!.at).toBe(shown.boss.crowdMoves);
    // His move's thinking, the same last move: no banner, and his move shows as soon as it's in.
    L.advance(shown.until - L.now + 10);
    const again = L.last("p2", "boss")!;
    expect(again.thinking).toBe(true);
    expect(again.boss.board.history.at(-1)).toBe(take);
    expect(queenSlain(again.boss)).toBe(false);
    expect(L.core.record.bossMinAt).toBeUndefined();
    const move = hostBoss(L);
    expect(L.last("p2", "boss")!.boss.lastMove).toMatchObject({ move: (move.allowed ?? legalMoves(move.fen))[0]! });
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

  it("a host's move across the board saw never lands (Eric, Oct 17): the first allowed move is played, and the error logged", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const L = raid({ bossId: "sawyer", bossPowerTest: "boardsaw" });
    crowdMove(L);
    hostBoss(L);
    toRound(L);
    crowdMove(L);
    hostBoss(L);
    toRound(L);
    crowdMove(L);
    // (Past the boss's strike after the crowd's 3rd move.)
    for (let i = 0; i < 10 && !L.last("p1", "bossRequest"); i++) L.advance(10_000);
    const req = L.last("p1", "bossRequest")!;
    expect(req.allowed!.length).toBeGreaterThan(0);
    for (const m of req.allowed!) expect(middle(m)).toBe(false);
    const across = legalMoves(req.fen).find(middle)!;
    expect(across).toBeTruthy();
    L.core.message("p1", { t: "bossMove", key: req.key, move: across });
    const b = L.last("p1", "boss")!;
    expect(b.boss.board.lastMove).toBe(req.allowed![0]);
    expect(b.boss.lastMove!.through).toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining(`boss move refused: ${across}`));
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

describe("Alfil online", () => {
  const toRound = (L: ReturnType<typeof setup>) => {
    for (let i = 0; i < 10 && L.core.save().phase !== "play"; i++) L.advance(10_000);
    return L.last("p1", "round")!;
  };
  /** Alfil, picked by the lobby. */
  const alfil = (patch: Partial<Settings> = {}) => raid({ bossId: "alfil", ...patch });
  /** Time passes until the host is asked for something (a step's pick or his move), one alarm at a time; none: his turn is over (his fusion was his move). */
  const asked = (L: ReturnType<typeof setup>) => {
    for (let i = 0; i < 10 && !L.last("p1", "bossRequest") && L.core.save().phase !== "play"; i++) L.advance(5_000);
    return L.last("p1", "bossRequest")!;
  };
  /** The host answers a step's pick (a position); the request is then off its list. */
  const answer = (L: ReturnType<typeof setup>, key: string, move: string) => {
    L.inbox.set("p1", (L.inbox.get("p1") ?? []).filter((m) => m.t !== "bossRequest"));
    L.core.message("p1", { t: "bossMove", key, move });
  };
  /** His turn: each step the host is asked to pick (the fusion, the Slam) answered with its first candidate, then his move (none after the fusion). */
  const hisTurn = (L: ReturnType<typeof setup>) => {
    for (let i = 0; i < 4; i++) {
      const req = asked(L);
      if (!req) return;
      const pick = req.fuse ?? req.slam;
      if (!pick) return hostBoss(L);
      answer(L, req.key, pick[0] ?? "");
    }
    throw new Error("his turn never came to his move");
  };
  /** The boss messages a player got after the `from`-th message in its outbox. */
  const shown = (L: ReturnType<typeof setup>, id: string, from: number) => (L.inbox.get(id) ?? []).slice(from).filter((m): m is Extract<ServerMessage, { t: "boss" }> => m.t === "boss");

  it("his cast at the start of his turn on the host's pick, everyone sees the marked pawns before his move; next turn the fusion is his move", () => {
    const L = alfil({ bossPowerTest: "tusks" });
    expect(L.last("p1", "round")!.boss!.id).toBe("alfil");
    const from = (L.inbox.get("p2") ?? []).length;
    crowdMove(L);
    // The cast: the host weighs the pairs' fusions as if they came now (as the fusion's own pick), before his move.
    const ask = asked(L);
    expect(ask.fuse!.length).toBeGreaterThan(1);
    expect(ask.allowed).toBeUndefined();
    expect(ask.brain).toBeUndefined();
    answer(L, ask.key, ask.fuse![ask.fuse!.length - 1]!);
    const move = asked(L);
    expect(move.fuse ?? move.slam).toBeUndefined();
    const cast = shown(L, "p2", from).find((m) => !m.thinking && m.boss.powers!.events.at(-1)?.kind === "tusks")!;
    expect(cast).toBeTruthy();
    expect(cast.until - (cast as unknown as { now: number }).now).toBe(POWER_FX.tusks);
    const marked = cast.boss.powers!.tusks!.pawns;
    expect(marked).toHaveLength(2);
    for (const sq of marked) expect(pieceAt(cast.boss.board.fen, sq)).toMatchObject({ color: "b", type: "p" });
    // (The pair whose way the host picked: the board shows the pawns as they stand, not the fusion yet.)
    expect(pieceAt(ask.fuse![ask.fuse!.length - 1]!, marked[0]!) === null || pieceAt(ask.fuse![ask.fuse!.length - 1]!, marked[1]!) === null).toBe(true);
    expect(move.fen).toBe(cast.boss.board.fen);
    expect(move.fen).toBe(ask.fen);
    hostBoss(L);
    toRound(L);
    // Your move (the first allowed: here it takes neither), then the fusion: his turn.
    const plies = toRound(L).board!.history.length;
    crowdMove(L);
    const req = asked(L);
    // (Two ways to go: the host's engine picks. One: it lands at once, no host asked.)
    if (req) {
      expect(req.fuse).toHaveLength(2);
      expect(req.allowed).toBeUndefined();
      expect(req.brain).toBeUndefined();
      answer(L, req.key, req.fuse![1]!);
    }
    // Everyone sees the elephant land, and that's his move: no move after it; your turn once the turn's moments (the
    // fusion's first) have played.
    const fused = shown(L, "p2", from).find((m) => !m.thinking && m.boss.powers!.fusion?.to)!;
    if (req) expect(fused.boss.board.fen).toBe(req.fuse![1]);
    expect(fused.boss.lastMove).toBeNull();
    expect(sideToMove(fused.boss.board.fen)).toBe("w");
    expect(fused.until - (fused as unknown as { now: number }).now).toBe(bossTurnShowMs(fused.boss));
    expect(fused.boss.powers!.events.find((e) => e.kind === "fuse")).toEqual({ kind: "fuse", turn: fused.boss.powers!.turn, squares: fused.boss.powers!.fusion!.from, square: fused.boss.powers!.fusion!.to });
    expect(L.last("p1", "bossRequest")).toBeUndefined();
    const next = toRound(L);
    expect(next.board!.fen).toBe(fused.boss.board.fen);
    expect(next.board!.history.length).toBe(plies + 1);
    const after = next.boss!.powers!;
    expect(after.tusks).toBeNull();
    expect(after.elephants).toHaveLength(1);
    expect([...after.fusion!.from].sort()).toEqual([...marked].sort());
    expect(after.fusion!.to).toBe(after.elephants![0]);
  });

  it("the Mammoth Slam: the host plays the candidates out and picks; the pieces' shadows grow; they land as their crowd turn begins", () => {
    const L = alfil({ bossPowerTest: "slam" });
    crowdMove(L);
    hisTurn(L);
    expect(toRound(L).boss!.powers!.warned).toBe(true);
    crowdMove(L);
    const ask = asked(L);
    expect(ask.slam!.length).toBe(BOSS_POWERS.slamLooks);
    expect(ask.allowed).toBeUndefined();
    expect(L.last("p2", "boss")!.thinking).toBe(true);
    answer(L, ask.key, ask.slam![1]!);
    const slam = L.last("p2", "boss")!;
    expect(slam.boss.board.fen).toBe(ask.slam![1]);
    expect(slam.until - L.now).toBe(POWER_FX.slam);
    const p = slam.boss.powers!;
    expect(p.events.at(-1)!.kind).toBe("slam");
    expect(p.slam!.pieces.length).toBeGreaterThan(0);
    expect(p.slam!.loss).toBeNull();
    expect(p.airborne!.map((x) => x.square)).toEqual(p.slam!.pieces.map((x) => x.square));
    expect(slam.boss.board.bases).toContainEqual({ ply: slam.boss.board.history.length, fen: ask.slam![1] });
    expect(slam.boss.powers).toEqual(L.last("p1", "boss")!.boss.powers);
    expect(asked(L).fen).toBe(ask.slam![1]);
    hostBoss(L);
    // Three of your turns with them up, the shadows growing; they land as the next begins.
    const stages: number[] = [];
    for (let i = 0; i < BOSS_POWERS.slamTurns; i++) {
      const r = toRound(L);
      stages.push(r.boss!.powers!.airborne![0]!.stage);
      expect(r.boss!.powers!.paused).toBe(true);
      crowdMove(L);
      hisTurn(L);
    }
    expect(stages).toEqual([1, 2, 3]);
    const landed = toRound(L);
    expect(landed.boss!.powers!.airborne).toEqual([]);
    expect(landed.boss!.powers!.landed!.pieces.map((x) => x.from).sort()).toEqual(p.slam!.pieces.map((x) => x.square).sort());
    expect(landed.boss!.powers!.events.some((e) => e.kind === "land")).toBe(true);
    for (const x of landed.boss!.powers!.landed!.pieces) expect(pieceAt(landed.board!.fen, x.to)!.color).toBe("w");
  });

  it("the landing guard: the host gets the pieces in the air with his move just before they land (`land`), and with no other", () => {
    const L = alfil({ bossPowerTest: "slam" });
    crowdMove(L);
    hisTurn(L);
    toRound(L);
    crowdMove(L);
    const ask = asked(L);
    expect(ask.land).toBeUndefined();
    answer(L, ask.key, ask.slam![1]!);
    const pieces = L.last("p2", "boss")!.boss.powers!.slam!.pieces;
    // His move after the Slam, then his turn after each of yours with them up: every request the host gets, turn by turn.
    const turns: { what: "move" | "pick"; land: unknown }[][] = [];
    const turn = () => {
      const sent: { what: "move" | "pick"; land: unknown }[] = [];
      turns.push(sent);
      for (let i = 0; i < 4; i++) {
        const req = asked(L);
        if (!req) return;
        if (req.fuse || req.slam) {
          sent.push({ what: "pick", land: req.land });
          answer(L, req.key, (req.fuse ?? req.slam)![0] ?? "");
          continue;
        }
        sent.push({ what: "move", land: req.land });
        return void hostBoss(L);
      }
    };
    turn();
    for (let i = 0; i < BOSS_POWERS.slamTurns; i++) {
      toRound(L);
      crowdMove(L);
      turn();
    }
    // (This seed: his cast, then his move, on the second of these turns; on the third his fusion, with one square
    // allowed, so the host isn't asked; on the last, his move just before they land.)
    expect(turns.map((t) => t.map((x) => x.what))).toEqual([["move"], ["pick", "move"], [], ["move"]]);
    // Only that last one carries them: not the cast (his move follows it), nor the moves before.
    expect(turns.slice(0, -1).flat().map((x) => x.land)).toEqual([undefined, undefined, undefined]);
    expect(turns.at(-1)!.map((x) => x.land)).toEqual([pieces]);
    // They land as your next turn begins, as ever.
    expect(toRound(L).boss!.powers!.landed!.pieces.map((x) => x.from).sort()).toEqual(pieces.map((x) => x.square).sort());
  });

  it("nothing within the cap (\"\"), anything that isn't a candidate (an older app's move), or no answer: nothing lifts or shows, the meter kept; asked again on his next turn", () => {
    for (const reply of ["", "e7e5", null]) {
      const L = alfil({ bossPowerTest: "slam" });
      crowdMove(L);
      hisTurn(L);
      toRound(L);
      crowdMove(L);
      const ask = asked(L);
      expect(ask.slam).toBeTruthy();
      const from = (L.inbox.get("p1") ?? []).length;
      // (No answer: the only other device gone, the host never answers; the timeout.)
      if (reply === null) {
        L.core.disconnect("p2");
        L.inbox.set("p1", (L.inbox.get("p1") ?? []).filter((m) => m.t !== "bossRequest"));
        for (let i = 0; i < 6 && !L.last("p1", "bossRequest"); i++) L.advance(15_000);
      } else answer(L, ask.key, reply);
      // His turn goes on (his move here) on the same board, with no Slam's moment, and the meter still full.
      const next = asked(L);
      expect(next.slam).toBeUndefined();
      expect(next.fen).toBe(ask.fen);
      const seen = shown(L, "p1", from);
      expect(seen.length).toBeGreaterThan(0);
      for (const m of seen) {
        expect(m.boss.powers!.events.some((e) => e.kind === "slam")).toBe(false);
        expect(m.boss.powers!.slam).toBeNull();
        expect(m.boss.powers!.airborne).toEqual([]);
        expect(m.boss.powers!.ults).toBe(0);
        expect(m.boss.powers!.warned).toBe(true);
      }
      hisTurn(L);
      expect(toRound(L).boss!.powers!.warned).toBe(true);
      // His next turn: the Slam is asked for again.
      crowdMove(L, reply === null ? ["p1"] : ["p1", "p2"]);
      expect(asked(L).slam).toBeTruthy();
    }
  });

  it("the admins' trigger while the host weighs his cast: that pick is dropped, the Slam is asked for and lands, then the cast", () => {
    const L = alfil({ bossPowerTest: "tusks" });
    crowdMove(L);
    const cast = asked(L);
    expect(cast.fuse).toBeTruthy();
    expect(L.core.ultimateTrigger("p1", true)).toBe(true);
    answer(L, cast.key, cast.fuse![0]!);
    // Nothing of the cast: the Slam's lifts asked for, on the same board.
    const slam = asked(L);
    expect(slam.slam).toBeTruthy();
    expect(slam.fen).toBe(cast.fen);
    expect(L.last("p1", "boss")!.boss.powers!.tusks).toBeNull();
    answer(L, slam.key, slam.slam![0]!);
    const p = L.last("p2", "boss")!.boss.powers!;
    expect(p.slam!.pieces.length).toBeGreaterThan(0);
    expect(p.ults).toBe(1);
    // Then the cast, asked anew.
    expect(asked(L).fuse).toBeTruthy();
  });

  it("the admins' trigger: the Slam at the start of his next turn, without the warning", () => {
    const L = alfil();
    expect(L.core.ultimateTrigger("p1", true)).toBe(true);
    crowdMove(L);
    const ask = asked(L);
    expect(ask.slam).toBeTruthy();
    answer(L, ask.key, ask.slam![0]!);
    expect(L.last("p2", "boss")!.boss.powers!.slam!.at).toBe(1);
    expect(L.last("p2", "boss")!.boss.powers!.warned).toBe(false);
  });
});

describe("Chub & Chirp online (Leapfrog)", () => {
  const toRound = (L: ReturnType<typeof setup>) => {
    for (let i = 0; i < 10 && L.core.save().phase !== "play"; i++) L.advance(10_000);
    return L.last("p1", "round")!;
  };
  /** Time passes until the host is asked for something (the hop's pick or his move), one alarm at a time. */
  const asked = (L: ReturnType<typeof setup>) => {
    for (let i = 0; i < 10 && !L.last("p1", "bossRequest") && L.core.save().phase !== "play"; i++) L.advance(5_000);
    return L.last("p1", "bossRequest")!;
  };
  const shown = (L: ReturnType<typeof setup>, id: string, from: number) => (L.inbox.get(id) ?? []).slice(from).filter((m): m is Extract<ServerMessage, { t: "boss" }> => m.t === "boss");
  /** Chub & Chirp (hidden: met as the test link does), picked by the lobby; `fen`: the battle from a position of our own, the crowd to move. */
  function hopper(patch: Partial<Settings> = {}, fen?: string) {
    const L = setup({ ...RAID_SETTINGS, lastStandFrom: 999, bossId: "hopper", bossUnfinished: true, ...patch });
    for (const i of [0, 1]) L.core.connect(undefined, `P${i + 1}`, i ? "phone" : "computer", false, 1500);
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    if (fen) {
      // (During the intro, before the first turn is dealt.)
      const runner = (L.core as unknown as { runner: MatchRunner }).runner;
      const board = runner.boards.get(0)!;
      runner.boards.set(0, { ...board, fen, bases: [...(board.bases ?? []), { ply: board.history.length, fen }] });
    }
    L.advance(60_000);
    return L;
  }
  /** Everyone picks `move`; the host scores; time passes to the boss's turn. */
  function crowdPlays(L: ReturnType<typeof setup>, move: string) {
    for (const id of ["p1", "p2"]) L.core.message(id, { t: "pick", key: L.last(id, "round")!.key, move });
    expect(L.hostScores("p1")).toBe(true);
    L.advance(30_000);
  }
  /** Pawns nose to nose on the a, d, e and h files: after your rook's move, four hops to choose from. */
  const FOUR = "r3k3/8/8/p2pp2p/P2PP2P/8/8/R3K3 w - - 0 20";

  it("one pawn can (the test switch): it hops at once (no host asked), everyone sees it before his move, and his move is asked on the new position", () => {
    const L = hopper({ bossPowerTest: "leapfrog" });
    const r0 = L.last("p1", "round")!;
    expect(r0.boss!.id).toBe("hopper");
    expect(r0.boss!.name).toBe("Chub & Chirp");
    expect(r0.board!.fen.split(" ")[0]).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR");
    const from = (L.inbox.get("p2") ?? []).length;
    crowdPlays(L, "g1f3");
    const req = asked(L);
    // (The hop needed no pick: the host is asked for his move straight after it, on the position with his pawn on e3.)
    expect(req.hop).toBeUndefined();
    expect(pieceAt(req.fen, "e3")).toMatchObject({ color: "b", type: "p" });
    expect(pieceAt(req.fen, "e5")).toBeNull();
    expect(sideToMove(req.fen)).toBe("b");
    const hop = shown(L, "p2", from).find((m) => !m.thinking && m.boss.powers!.events.at(-1)?.kind === "hop")!;
    expect(hop).toBeTruthy();
    expect(hop.until - (hop as unknown as { now: number }).now).toBe(POWER_FX.hop);
    expect(hop.boss.powers!.hop).toEqual({ at: 1, from: "e5", over: "e4", to: "e3" });
    expect(hop.boss.powers!.events.at(-1)).toEqual({ kind: "hop", turn: hop.boss.powers!.turn, square: "e3", squares: ["e5", "e4", "e3"] });
    expect(hop.boss.board.fen).toBe(req.fen);
    expect(hop.boss.board.bases).toContainEqual({ ply: hop.boss.board.history.length, fen: req.fen });
    expect(hop.boss.powers).toEqual(L.last("p1", "boss")!.boss.powers);
    // Then his move, as ever (Maia or Stockfish: the brain's), and your turn on the board after both.
    hostBoss(L);
    const next = toRound(L);
    expect(next.board!.history).toHaveLength(r0.board!.history.length + 2);
    expect(next.boss!.powers!.hop!.to).toBe("e3");
  });

  it("several can: the host's engine picks among them (no move list, no brain); its pick plays for everyone, then his move", () => {
    const L = hopper({}, FOUR);
    crowdPlays(L, "a1b1");
    const req = asked(L);
    expect(req.hop).toHaveLength(4);
    expect(req.allowed).toBeUndefined();
    expect(req.brain).toBeUndefined();
    expect(L.last("p2", "boss")!.thinking).toBe(true);
    L.inbox.set("p1", []);
    L.core.message("p1", { t: "bossMove", key: req.key, move: req.hop![2]! });
    const hop = L.last("p2", "boss")!;
    expect(hop.boss.board.fen).toBe(req.hop![2]);
    expect(hop.boss.powers!.hop).toMatchObject({ from: "e5", over: "e4", to: "e3" });
    expect(hop.until - L.now).toBe(POWER_FX.hop);
    const move = asked(L);
    expect(move.hop).toBeUndefined();
    expect(move.fen).toBe(req.hop![2]);
  });

  it("an answer that isn't one of them (an older app's move, \"\"), or no host at all: the first pawn that can hops", () => {
    for (const answer of ["e2e4", "", null]) {
      const L = hopper({}, FOUR);
      crowdPlays(L, "a1b1");
      const req = asked(L);
      expect(req.hop).toHaveLength(4);
      if (answer === null) {
        // (No answer: the only other device gone, the host never answers; the timeout.)
        L.core.disconnect("p2");
        for (let i = 0; i < 6 && !L.last("p1", "boss")?.boss.powers?.hop; i++) L.advance(15_000);
      } else L.core.message("p1", { t: "bossMove", key: req.key, move: answer });
      expect(L.last("p1", "boss")!.boss.powers!.hop, String(answer)).toMatchObject({ from: "a5", over: "a4", to: "a3" });
    }
  });
});

describe("the boss's brain online (BOSS_BRAIN: Maia while it's off for players only for a lobby of admins)", () => {
  /** A raid of people, each an admin or not (as the Durable Object found them), the Last Stand off. */
  function raidOf(patch: Partial<Settings>, admins: boolean[], rating = 1500) {
    const L = setup({ ...RAID_SETTINGS, lastStandFrom: 999, ...patch });
    admins.forEach((a, i) => L.core.connect(undefined, `P${i + 1}`, i ? "phone" : "computer", false, rating, undefined, undefined, null, null, a));
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    return L;
  }

  it("a lobby of admins: the host is told the battle's brain as it begins, and the boss's own moves ask for Maia", () => {
    const L = raidOf({ bossId: "gingerbread" }, [true, true]);
    const b = L.core.save().runner!.state.boss!;
    const plan = bossBrainFor("gingerbread", b.elo, "", true, { crowd: true });
    expect(plan.brain).toBe("maia-raw");
    // Only the host, as the intro starts (it loads Maia meanwhile).
    expect(L.last("p1", "bossBrain")!.brain).toEqual({ brain: "maia-raw", rating: plan.rating });
    expect(L.last("p2", "bossBrain")).toBeUndefined();
    expect(L.core.record.bossBrain).toEqual({ brain: "maia-raw", rating: plan.rating });
    // (Two people: a crowd, so Maia's margin.)
    expect(plan.rating).toBe(maiaRatingFor(b.elo + BOSS_BRAIN.crowdMargin));
    L.advance(60_000);
    crowdMove(L);
    const req = hostBoss(L);
    expect(req.brain).toEqual({ brain: "maia-raw", rating: plan.rating });
    // Everyone gets the one move the host played.
    expect(L.last("p1", "boss")!.boss.board.fen).toBe(L.last("p2", "boss")!.boss.board.fen);
    expect(L.last("p2", "boss")!.boss.lastMove!.move).toBe((req.allowed ?? legalMoves(req.fen))[0]);
  });

  it("while it's off for players, a lobby with a player in it: Stockfish (no brain sent)", () => {
    const was = BOSS_BRAIN.forPlayers;
    (BOSS_BRAIN as { forPlayers: boolean }).forPlayers = false;
    try {
      const L = raidOf({ bossId: "gingerbread" }, [true, false]);
      expect(L.last("p1", "bossBrain")).toBeUndefined();
      expect(L.core.record.bossBrain).toBeNull();
      L.advance(60_000);
      crowdMove(L);
      expect(hostBoss(L).brain).toBeUndefined();
    } finally {
      (BOSS_BRAIN as { forPlayers: boolean }).forPlayers = was;
    }
  });

  it("once it's on for players (forPlayers, one value), every lobby meets it", () => {
    const was = BOSS_BRAIN.forPlayers;
    (BOSS_BRAIN as { forPlayers: boolean }).forPlayers = true;
    try {
      const L = raidOf({ bossId: "clown" }, [false, false]);
      expect(L.last("p1", "bossBrain")!.brain.brain).toBe("maia-raw");
      // The same plan an admins' lobby gets: the rule's Maia rating for a crowd, told to the host only, on every
      // request for the boss's own move.
      const b = L.core.save().runner!.state.boss!;
      const plan = bossBrainFor("clown", b.elo, "", true, { crowd: true });
      expect(L.last("p1", "bossBrain")!.brain).toEqual({ brain: plan.brain, rating: plan.rating });
      expect(plan.rating).toBe(maiaRatingFor(b.elo + BOSS_BRAIN.crowdMargin));
      expect(L.last("p2", "bossBrain")).toBeUndefined();
      L.advance(60_000);
      crowdMove(L);
      expect(hostBoss(L).brain).toEqual({ brain: plan.brain, rating: plan.rating });
      // A player alone (no crowd margin), and a mixed lobby, too.
      const alone = raidOf({ bossId: "gingerbread" }, [false]);
      const a = alone.core.save().runner!.state.boss!;
      expect(alone.last("p1", "bossBrain")!.brain).toEqual({ brain: "maia-raw", rating: maiaRatingFor(a.elo) });
      expect(raidOf({ bossId: "gingerbread" }, [true, false]).last("p1", "bossBrain")!.brain.brain).toBe("maia-raw");
    } finally {
      (BOSS_BRAIN as { forPlayers: boolean }).forPlayers = was;
    }
  });

  it("a new host is told the brain (it loads Maia then); a reconnecting one too", () => {
    const L = raidOf({ bossId: "gingerbread" }, [true, true]);
    L.advance(60_000);
    L.core.disconnect("p1");
    expect(L.last("p2", "bossBrain")!.brain.brain).toBe("maia-raw");
  });

  it("Boingo's funhouse move for the crowd keeps its own engine pick: its request carries no brain", () => {
    const L = raidOf({ bossId: "clown", bossPowerTest: "funhouse" }, [true, true]);
    L.advance(60_000);
    crowdMove(L);
    expect(hostBoss(L).brain).toBeDefined();
    L.advance(L.last("p1", "boss")!.until - L.now + 10);
    crowdMove(L);
    hostBoss(L);
    L.advance(L.last("p1", "boss")!.until - L.now + 10);
    const f = L.last("p1", "bossRequest")!;
    expect(f.funhouse).toBe(true);
    expect(f.brain).toBeUndefined();
  });

  it("Big Boy's bounce keeps its own pick too; a boss in the bridge band plays the strict guard with Stockfish's share", () => {
    const L = raidOf({ bossId: "bigboy", bossPowerTest: "bounce" }, [true, true]);
    L.advance(60_000);
    for (let i = 0; i < 4; i++) {
      crowdMove(L);
      for (let k = 0; k < 10 && !L.last("p1", "bossRequest"); k++) L.advance(5_000);
      const req = L.last("p1", "bossRequest")!;
      if (req.bounce) {
        expect(req.brain).toBeUndefined();
        break;
      }
      hostBoss(L);
      L.advance(L.last("p1", "boss")!.until - L.now + 10);
    }
    // (A raid's tier is the weakest above its rating: 2800 for 2750, Ginger 100 under it; 3000 for 2850.)
    const top = raidOf({ bossId: "gingerbread" }, [true], 2750);
    expect(top.core.save().runner!.state.boss!.elo).toBe(2700);
    const brain = top.last("p1", "bossBrain")!.brain;
    expect(brain.brain).toBe(2700 >= BOSS_BRAIN.bridgeStrictFrom ? "maia-strict" : "maia-light");
    expect(brain.stockfishShare).toBeGreaterThan(0);
    const sf = raidOf({ bossId: "gingerbread" }, [true], 2850);
    expect(sf.core.save().runner!.state.boss!.elo).toBe(2900);
    expect(sf.last("p1", "bossBrain")).toBeUndefined();
    expect(sf.core.record.bossBrain).toBeNull();
  });
});

describe("Wrangler online", () => {
  const toRound = (L: ReturnType<typeof setup>) => {
    for (let i = 0; i < 10 && L.core.save().phase !== "play"; i++) L.advance(10_000);
    return L.last("p1", "round")!;
  };
  /** The host answers the boss request: `move` (else the first legal), with `extras` (Wrangler's drag or showdown). */
  const answer = (L: ReturnType<typeof setup>, move?: string, extras: { drag?: string; showdown?: string; outside?: boolean } = {}) => {
    const req = L.last("p1", "bossRequest")!;
    L.inbox.set("p1", (L.inbox.get("p1") ?? []).filter((m) => m.t !== "bossRequest"));
    L.core.message("p1", { t: "bossMove", key: req.key, move: move ?? legalMoves(req.fen).sort()[0]!, ...extras });
    return req;
  };

  it("his long pull: the host is sent his pulls (and a seed of the turn's, never the battle's); the pull everyone sees, a base on the board", () => {
    const L = raid({ bossId: "pig" });
    const r1 = L.last("p1", "round")!;
    expect(r1.boss!.id).toBe("pig");
    expect(r1.board!.history).toEqual([]);
    crowdMove(L);
    const req = L.last("p1", "bossRequest")!;
    expect(req.pull!.length).toBeGreaterThan(0);
    for (const p of req.pull!) expect(["d", "e"]).toContain(p[0]);
    expect(req.seed).toBeTypeOf("number");
    expect(req.seed).not.toBe(L.core.save().runner!.state.boss!.powers!.seed);
    expect(req.drag).toBeUndefined();
    expect(req.showdown).toBeUndefined();
    const pull = req.pull![0]!;
    answer(L, pull);
    const b = L.last("p2", "boss")!;
    expect(b.boss.lastMove).toMatchObject({ move: pull, san: pull.slice(2, 4) });
    expect(pieceAt(b.boss.board.fen, pull.slice(2, 4))).toEqual({ color: "b", type: "p" });
    expect(b.boss.board.bases).toContainEqual({ ply: b.boss.board.history.length, fen: b.boss.board.fen });
    expect(b.boss.powers!.pull).toMatchObject({ turn: 2, from: pull.slice(0, 2), to: pull.slice(2, 4) });
    expect(b.boss.powers!.events.map((e) => e.kind)).toContain("pull");
    expect(b.boss.powers).toEqual(L.last("p1", "boss")!.boss.powers);
    expect(b.until - b.now).toBe(bossShowMs(b.boss.lastMove) + POWER_FX.pull);
  });

  it("an ordinary first move when the host answers one; a later three-square move is never a pull", () => {
    const L = raid({ bossId: "pig" });
    crowdMove(L);
    answer(L);
    const b = L.last("p1", "boss")!;
    expect(b.boss.powers!.pull).toBeNull();
    expect(b.boss.powers!.events.map((e) => e.kind)).not.toContain("pull");
  });

  it("his drag: asked for after his move as turn 3 begins; the host's drag everyone sees; one outside his rules is ignored", () => {
    for (const good of [true, false]) {
      const L = raid({ bossId: "pig", bossKillEvery: 99 });
      crowdMove(L);
      expect(L.last("p1", "bossRequest")!.drag).toBeUndefined();
      answer(L);
      toRound(L);
      crowdMove(L);
      const req = L.last("p1", "bossRequest")!;
      expect(req.drag).toBe(true);
      const move = legalMoves(req.fen).sort()[0]!;
      const after = applyMove(req.fen, move);
      const drag = good ? dragOptions(after)[0]! : null;
      answer(L, move, { drag: drag ? drag.from + drag.to : "e1e2" });
      const b = L.last("p2", "boss")!;
      if (drag) {
        expect(b.boss.powers!.drag).toEqual({ turn: 3, from: drag.from, to: drag.to, piece: drag.piece });
        expect(b.boss.board.fen).toBe(drag.fen);
        expect(b.boss.powers!.events).toContainEqual({ kind: "drag", turn: 3, square: drag.to, squares: [drag.from, drag.to] });
        expect(b.until - b.now).toBe(bossShowMs(b.boss.lastMove) + POWER_FX.drag);
      } else {
        expect(b.boss.powers!.drag ?? null).toBeNull();
        expect(b.boss.board.fen).toBe(after);
      }
      expect(b.boss.powers).toEqual(L.last("p1", "boss")!.boss.powers);
    }
  });

  it("SHOWDOWN! (the test switch: his meter full from turn 2, no warning): at his turn the host is asked for the line-up; everyone gets it, and the crowd's picks and jobs are the duels", () => {
    const L = raid({ bossId: "pig", bossPowerTest: "showdown", bossKillEvery: 99 });
    crowdMove(L);
    answer(L);
    const r2 = toRound(L);
    expect(r2.boss!.powers!.warned).toBe(false);
    expect(r2.boss!.powers!.events.map((e) => e.kind)).not.toContain("warn");
    expect(r2.boss!.powers!.ready).not.toBeNull();
    expect(r2.boss!.powers!.rage).toBe(1);
    crowdMove(L);
    const req = L.last("p1", "bossRequest")!;
    expect(req.showdown).toBe("try");
    // (Longer for the host: line-ups to search.)
    const move = legalMoves(req.fen).sort()[0]!;
    const after = applyMove(req.fen, move);
    const lineup = [...lineups(after, 1, 3, 3000)].find(Boolean)!;
    answer(L, move, { showdown: lineup.spec });
    const b = L.last("p2", "boss")!;
    expect(b.boss.powers!.showdown).toMatchObject({ turn: 3, pairs: lineup.pairs, before: after });
    expect(b.boss.powers!.showdown!.outside).toBeUndefined();
    expect(b.boss.board.fen).toBe(lineup.fen);
    expect(b.boss.powers!.events).toContainEqual({ kind: "showdown", turn: 3, squares: lineup.pairs.flatMap((p) => [p.crowd, p.boss]) });
    expect(b.boss.powers).toEqual(L.last("p1", "boss")!.boss.powers);
    expect(b.until - b.now).toBe(bossShowMs(b.boss.lastMove) + POWER_FX.showdown);
    const r3 = toRound(L);
    expect([...r3.boss!.powers!.allowed!].sort()).toEqual([...lineup.duels].sort());
    // A pick that isn't a duel is refused; the job carries the duels.
    const notDuel = legalMoves(r3.board!.fen).find((m) => !lineup.duels.includes(m))!;
    L.core.message("p1", { t: "pick", key: r3.key, move: notDuel });
    const job = crowdMove(L);
    expect([...job.jobs[0]!.allowed!].sort()).toEqual([...lineup.duels].sort());
  });

  it("no line-up (\"\", junk, or no host): he plays on, no moment, no warning; asked again next turn; the test trigger: \"test\", its line-up outside the band marked so", () => {
    const L = raid({ bossId: "pig", bossPowerTest: "showdown", bossKillEvery: 99 });
    crowdMove(L);
    answer(L);
    toRound(L);
    for (const reply of ["", "d1d4d8d5 a1c3a8c5 c1e3c8f5"]) {
      crowdMove(L);
      for (let i = 0; i < 10 && !L.last("p1", "bossRequest"); i++) L.advance(5_000);
      const req = L.last("p1", "bossRequest")!;
      expect(req.showdown).toBe("try");
      answer(L, undefined, { showdown: reply });
      const b = L.last("p2", "boss")!;
      expect(b.boss.powers!.events.map((e) => e.kind)).toEqual([]);
      expect(b.boss.powers!.showdown ?? null).toBeNull();
      expect(b.boss.powers!.ready).not.toBeNull();
      expect(b.until - b.now).toBe(bossShowMs(b.boss.lastMove));
      toRound(L);
    }
    // The test trigger (an admin's): asked as "test"; a line-up the host found outside the band is marked so.
    expect(L.core.ultimateTrigger("p1", true)).toBe(true);
    crowdMove(L);
    for (let i = 0; i < 10 && !L.last("p1", "bossRequest"); i++) L.advance(5_000);
    const req = L.last("p1", "bossRequest")!;
    expect(req.showdown).toBe("test");
    const move = legalMoves(req.fen).sort()[0]!;
    const lineup = [...lineups(applyMove(req.fen, move), 2, 3, 3000)].find(Boolean)!;
    answer(L, move, { showdown: lineup.spec, outside: true });
    const b = L.last("p2", "boss")!;
    expect(b.boss.powers!.showdown).toMatchObject({ pairs: lineup.pairs, outside: true });
  });

  it("his reply to the duel (Eric, Oct 13), and his moves while its tactics are live: the host is asked for the engine's best, without his brain or a slip; everyone gets it; then his brain again", async () => {
    // A lobby of admins (his brain: Maia), slips on (every move of his a stumble).
    const L = setup({ ...RAID_SETTINGS, lastStandFrom: 999, bossId: "pig", bossPowerTest: "showdown", bossKillEvery: 99, bossStumbleBelow: 9999, bossStumbleMax: 1 });
    for (const [i, name] of ["P1", "P2"].entries()) L.core.connect(undefined, name, i ? "phone" : "computer", false, 1500, undefined, undefined, null, null, true);
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    L.advance(60_000);
    expect(L.core.record.bossBrain?.brain).toBe("maia-raw");
    const nextRequest = () => {
      for (let i = 0; i < 10 && !L.last("p1", "bossRequest"); i++) L.advance(5_000);
      return L.last("p1", "bossRequest")!;
    };
    crowdMove(L);
    expect(nextRequest()).toMatchObject({ stumble: true, brain: { brain: "maia-raw" } });
    answer(L);
    toRound(L);
    crowdMove(L);
    const req = nextRequest();
    expect(req.showdown).toBe("try");
    const move = legalMoves(req.fen).sort()[0]!;
    const lineup = [...lineups(applyMove(req.fen, move), 1, 3, 3000)].find(Boolean)!;
    answer(L, move, { showdown: lineup.spec });
    toRound(L);
    // The crowd's duel, then his reply: the engine's best, no brain sent, no slip.
    crowdMove(L);
    const reply = nextRequest();
    const duel = lineup.duels.find((d) => applyMove(lineup.fen, d) === reply.fen)!;
    expect(duel).toBeTruthy();
    expect(reply.best).toBe(true);
    expect(reply.brain).toBeUndefined();
    expect(reply.stumble).toBeUndefined();
    expect(reply.stagger).toBeUndefined();
    // The host (as net.ts plays a request): its engine's best takes back on the duel's square; his brain (Maia, which
    // the host still has loaded) and a slip would take something else.
    const worth: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
    const legal = legalMoves(reply.fen);
    const best = legal.filter((m) => m.slice(2, 4) === duel.slice(2, 4)).sort((a, b) => worth[pieceAt(reply.fen, a.slice(0, 2))!.type]! - worth[pieceAt(reply.fen, b.slice(0, 2))!.type]!)[0]!;
    const other = legal.filter((m) => m.slice(2, 4) !== duel.slice(2, 4)).sort()[0]!;
    expect(best).toBeTruthy();
    const engine: EngineLike = {
      topMoves: async (_fen, n) => [best, other].slice(0, n).map((m, i) => ({ move: m, expected: i ? 0.555 : 0.6 })),
      topMovesAt: async (fen, n) => engine.topMoves(fen, n),
      scoreMoves: async (_fen, moves) => moves.map((m) => ({ move: m, expected: m === best ? 0.6 : 0.555 })),
      playAtElo: async () => other,
    };
    const maia: HumanEngineLike = { ready: () => true, candidates: async () => ({ best: other, moves: [{ move: other, p: 0.9 }], ms: 5 }) };
    const kind: BossMoveKind = reply.best ? "best" : reply.stumble ? "stumble" : reply.stagger ? "stagger" : "elo";
    const host = (k: BossMoveKind) => bossMoveFrom(engine, reply.fen, reply.elo, reply.nodes, k, Math.random, DEFAULT_SETTINGS.kingStrikeLoss, undefined, reply.allowed ?? null, { brain: "maia-raw", rating: 600, engine: maia });
    expect(await host("stumble")).toBe(other);
    const played = await host(kind);
    expect(played).toBe(best);
    answer(L, played);
    // (Your queen banner first, if the duel took his queen: the move is held until then.)
    for (let i = 0; i < 10 && L.last("p2", "boss")!.boss.lastMove?.move !== played; i++) L.advance(1000);
    for (const id of ["p1", "p2"]) expect(L.last(id, "boss")!.boss.lastMove).toMatchObject({ move: played });
    expect(pieceAt(L.last("p2", "boss")!.boss.board.fen, duel.slice(2, 4))?.color).toBe("b");
    // While a line-up piece is still attacked, his next moves are the engine's too (up to showdownEngineMoves in all);
    // then his brain's again (and a slip's chance).
    let engineMoves = 1;
    for (let i = 0; i < BOSS_POWERS.showdownEngineMoves + 1; i++) {
      toRound(L);
      crowdMove(L);
      const req = nextRequest();
      if (!req.best) {
        expect(req).toMatchObject({ stumble: true, brain: { brain: "maia-raw" } });
        break;
      }
      expect(req.brain).toBeUndefined();
      engineMoves++;
      answer(L);
    }
    expect(engineMoves).toBeLessThanOrEqual(BOSS_POWERS.showdownEngineMoves);
    expect(L.last("p1", "bossRequest")!.best).toBeUndefined();
  });
});
