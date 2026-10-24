import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { PASS_WAIT, applyMove, hoopStops, hoopsAnswer, hoopsCheck, landFrom, legalMoves, pieceAt, sanLineToUci, sideToMove, type BoardScore, type MatchRunner, type Opening, type ServerMessage } from "@chessroyale/chess";
import { fakeEngine } from "../../chess/test/boss-kit-lib.ts";
import { LobbyCore, newLobbyRecord } from "../src/lobby.ts";

/**
 * The circus tiger online (docs/decisions/2026-10-23-tiger-rules.md): his balloon on the server's clock, its landing asked of
 * the host with his move (the same ask for a balloon that will pop) and checked; his hoops asked of the host as his whole
 * turn, checked, the walls in every allowed move; anything else (junk, PASS_WAIT) leaving him his move. And fair play: no
 * message to any device says a balloon will pop before it does.
 */

type Msg = ServerMessage;
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
// (A game so far with Black's d-pawn gone (raidOpening: a raid's battle from a book position): he has seven pawns, so every
// balloon's shape is one he can have; from the starting position, with all eight, every balloon would pop.)
const line = sanLineToUci(["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5", "d4", "Nf6", "Nf3", "c6", "Bc4", "Bf5", "Bd2", "e6", "Qe2", "Bb4"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, eco: "B01", name: `O${i}`, family: `F${i}`, unusual: false, moves: line, namedPlies: line.length, expected: Object.fromEntries(line.map((_, n) => [n, 0.5])) }));

function tiger(patch: Partial<Settings> = {}, players = ["P1", "P2"]) {
  let now = 1_000_000;
  const inbox = new Map<string, Msg[]>();
  const settings = { ...DEFAULT_SETTINGS, roundsPerStage: 1, firstStageRounds: 1, boardIntroSeconds: 0, ...RAID_SETTINGS, lastStandFrom: 999, bossId: "tiger", bossUnfinished: true, bossStumbleBelow: 0, raidOpening: true, ...patch } as Settings;
  const core = new LobbyCore(newLobbyRecord("TIGER", now), { now: () => now, send: (id, msg) => inbox.set(id, [...(inbox.get(id) ?? []), msg as Msg]), icon: () => undefined }, library, mulberry32(7), settings);
  for (const [i, id] of players.entries()) core.connect(undefined, id, i ? "phone" : "computer", false, 1500);
  core.message("p1", { t: "start" });
  const last = <T extends Msg["t"]>(id: string, t: T) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === t) as Extract<Msg, { t: T }> | undefined;
  const advance = (ms: number) => {
    now += ms;
    if (core.nextAlarm && core.nextAlarm <= now) core.alarm();
  };
  const runner = () => (core as unknown as { runner: MatchRunner }).runner;
  const hostScores = () => {
    const req = last("p1", "scoreRequest");
    if (!req) return false;
    const boards: BoardScore[] = req.jobs.map((j) => {
      const legal = j.allowed ?? legalMoves(j.fen);
      const exp = Object.fromEntries(legal.map((m) => [m, 0.3 + 0.4 * hash(j.fen + m)]));
      const best = legal.reduce((a, b) => (exp[b]! > exp[a]! ? b : a));
      return { boardId: j.boardId, bestMove: best, bestExpected: exp[best]!, expectedAfter: exp, botPicks: {}, botThinkMs: {} };
    });
    core.message("p1", { t: "scores", key: req.key, boards });
    inbox.set("p1", (inbox.get("p1") ?? []).filter((m) => m.t !== "scoreRequest"));
    return true;
  };
  const asked = () => {
    for (let i = 0; i < 12 && !last("p1", "bossRequest") && core.save().phase !== "play"; i++) advance(5_000);
    return last("p1", "bossRequest");
  };
  const toRound = () => {
    for (let i = 0; i < 12 && core.save().phase !== "play"; i++) advance(5_000);
    return last("p1", "round")!;
  };
  const crowdPlays = () => {
    const r = toRound();
    const ok = r.boss?.powers?.allowed ?? legalMoves(r.board!.fen);
    const m = ok.find((x) => x === "g1f3" || x === "b1c3" || x === "h2h3" || x === "a2a3") ?? ok[0]!;
    for (const id of players.map((x) => x.toLowerCase())) core.message(id, { t: "pick", key: last(id, "round")!.key, move: m });
    expect(hostScores()).toBe(true);
    inbox.set("p1", (inbox.get("p1") ?? []).filter((x) => x.t !== "bossRequest"));
  };
  const answer = (move: string, balloon?: string) => {
    const req = last("p1", "bossRequest")!;
    inbox.set("p1", (inbox.get("p1") ?? []).filter((x) => x.t !== "bossRequest"));
    core.message("p1", { t: "bossMove", key: req.key, move, ...(balloon ? { balloon } : {}) });
  };
  advance(1000);
  advance(60_000);
  return { core, inbox, last, advance, runner, asked, toRound, crowdPlays, answer, now: () => now };
}

/** Plays on (his moves answered with the first allowed, no balloon square) until a request matches. */
function until(L: ReturnType<typeof tiger>, want: (r: Extract<Msg, { t: "bossRequest" }>) => boolean) {
  for (let i = 0; i < 12; i++) {
    if (L.runner().bossToMove()) {
      const req = L.asked()!;
      if (want(req)) return req;
      L.answer((req.allowed ?? legalMoves(req.fen))[0]!);
      continue;
    }
    L.crowdPlays();
  }
  throw new Error("never asked");
}

describe("the circus tiger online", () => {
  it("his balloon on the server's clock: placed as his turn begins, the same view for everyone, its landing asked of the host with his move and played", async () => {
    const L = tiger({ bossBalloonTest: "knight", bossStageTest: 4 });
    const req = until(L, (r) => !!r.balloon);
    expect(req.balloon).toMatchObject({ shape: "n", blocks: [] });
    // (Asked with his move, not instead of it.)
    expect(req.hoops).toBeUndefined();
    const view = L.runner().bossView()!.powers!;
    expect(view.balloon).toMatchObject({ shape: "n", ready: true });
    const move = (req.allowed ?? legalMoves(req.fen))[0]!;
    const land = (await landFrom([fakeEngine()], applyMove(req.fen, move), req.balloon!))!;
    expect(land).not.toBeNull();
    L.answer(move, land.square);
    const round = L.toRound();
    const p = round.boss!.powers!;
    expect(p.balloonLast).toMatchObject({ outcome: "land", shape: "n", square: land.square });
    expect(pieceAt(round.board!.fen, land.square)).toEqual({ color: L.runner().boss!.crowdSide === "w" ? "b" : "w", type: "n" });
    expect(p.events.filter((e) => e.kind === "balloonLand" || e.kind === "balloonCheer").map((e) => e.kind)).toEqual(["balloonLand", "balloonCheer"]);
    expect(L.last("p2", "round")!.boss!.powers!.balloonLast).toEqual(p.balloonLast);
  });

  it("a balloon square the rules refuse (or none) leaves it ready on the nozzle until the end of his next turn", () => {
    const L = tiger({ bossBalloonTest: "bishop", bossStageTest: 4 });
    const req = until(L, (r) => !!r.balloon);
    const move = (req.allowed ?? legalMoves(req.fen))[0]!;
    // (An occupied square: refused.)
    const after = applyMove(req.fen, move);
    const occupied = ["a1", "b1", "c1", "d1", "e1", "e8"].find((sq) => pieceAt(after, sq))!;
    L.answer(move, occupied);
    const round = L.toRound();
    expect(round.boss!.powers!.balloonLast ?? null).toBeNull();
    expect(round.boss!.powers!.balloon).toMatchObject({ shape: "b", ready: true });
  });

  it("his hoops: the request asks for the cast (and a due balloon's landing); the host's answer, checked, is his whole turn, the walls in every allowed move", async () => {
    const L = tiger({ bossPowerTest: "hoops" });
    const req = until(L, (r) => !!r.hoops);
    expect(req.hoopsAny).toBe(true);
    expect(req.allowed ?? req.brain).toBeUndefined();
    const { answer, pick } = await hoopsAnswer([fakeEngine()], req.fen, req.hoops!, req.balloon ?? null, true);
    const checked = hoopsCheck(req.fen, answer)!;
    expect(checked).not.toBeNull();
    L.answer(answer);
    const round = L.toRound();
    expect(sideToMove(round.board!.fen)).toBe(L.runner().boss!.crowdSide);
    const p = round.boss!.powers!;
    expect(p.hoops).toEqual({ blocks: pick!.blocks, left: 2 });
    expect(p.events.find((e) => e.kind === "hoops")).toMatchObject({ blocks: pick!.blocks });
    const allowed = p.allowed ?? legalMoves(round.board!.fen);
    for (const m of allowed) expect(hoopStops(m, round.board!.fen, pick!.blocks)).toBe(false);
    expect(L.last("p2", "round")!.boss!.powers!.hoops).toEqual(p.hoops);
    // (His move between the crowd's two: asked with the walls' allowed moves.)
    L.crowdPlays();
    const next = L.asked()!;
    for (const m of next.allowed ?? legalMoves(next.fen)) expect(hoopStops(m, next.fen, pick!.blocks)).toBe(false);
  });

  it("junk, \"\" or PASS_WAIT from the host: no cast now, and his move is asked for at once; next turn it's asked again", () => {
    for (const junk of ["e2e4", "", PASS_WAIT, "a1 h8"]) {
      const L = tiger({ bossPowerTest: "hoops" });
      until(L, (r) => !!r.hoops);
      L.answer(junk);
      const move = L.asked()!;
      expect(move.hoops).toBeUndefined();
      expect(L.runner().boss!.powers!.hoopsWait).toBe(L.runner().boss!.crowdMoves);
      L.answer((move.allowed ?? legalMoves(move.fen))[0]!);
      L.crowdPlays();
      expect(L.asked()!.hoops).toBeDefined();
    }
  });

  it("fair play, side by side: a real queen's battle and a fake one's send every device the very same messages until the turn one lands and the other pops (no square, or one refused: both wait)", async () => {
    const real = tiger({ bossBalloonTest: "queen", bossStageTest: 4 });
    const fake = tiger({ bossBalloonTest: "fakequeen", bossStageTest: 4 });
    const same = () => {
      for (const id of ["p1", "p2"]) expect(JSON.stringify(fake.inbox.get(id) ?? [])).toBe(JSON.stringify(real.inbox.get(id) ?? []));
    };
    let asked = 0;
    for (let i = 0; i < 10; i++) {
      if (real.runner().bossToMove()) {
        const a = real.asked()!;
        const b = fake.asked()!;
        expect(JSON.stringify(b)).toBe(JSON.stringify(a));
        if (a.balloon) asked++;
        const move = (a.allowed ?? legalMoves(a.fen))[0]!;
        // (A square the rules refuse, where his piece now stands, and no square at all, in turn.)
        const square = i % 2 ? undefined : move.slice(2, 4);
        real.answer(move, square);
        fake.answer(move, square);
      } else {
        real.crowdPlays();
        fake.crowdPlays();
      }
      same();
    }
    expect(asked).toBeGreaterThan(1);
    expect(real.runner().boss!.powers!.balloon!.last ?? null).toBeNull();
    // A square the rules allow: only now do they part.
    for (let i = 0; i < 4 && !real.runner().bossToMove(); i++) {
      real.crowdPlays();
      fake.crowdPlays();
    }
    const a = real.asked()!;
    fake.asked();
    const move = (a.allowed ?? legalMoves(a.fen))[0]!;
    const land = (await landFrom([fakeEngine()], applyMove(a.fen, move), a.balloon!))!;
    real.answer(move, land.square);
    fake.answer(move, land.square);
    expect(real.runner().boss!.powers!.balloon!.last).toMatchObject({ outcome: "land", shape: "q" });
    expect(fake.runner().boss!.powers!.balloon!.last).toMatchObject({ outcome: "pop", shape: "q" });
  });

  it("fair play: until a dud pops, no message to any device says so; a fake queen is a queen everywhere, asked of the host as one", async () => {
    const L = tiger({ bossBalloonTest: "fakequeen", bossStageTest: 3 }, ["P1", "P2", "P3"]);
    let popped = false;
    for (let i = 0; i < 16 && !popped; i++) {
      if (L.runner().bossToMove()) {
        const req = L.asked()!;
        if (req.balloon) expect(req.balloon.shape).toBe("q");
        const move = (req.allowed ?? legalMoves(req.fen))[0]!;
        const land = req.balloon ? await landFrom([fakeEngine()], applyMove(req.fen, move), req.balloon) : null;
        L.answer(move, land?.square);
      } else L.crowdPlays();
      popped = !!L.runner().boss!.powers!.balloon?.last;
      // Everything every device has been sent so far, before the pop shows: nothing says it.
      for (const id of ["p1", "p2", "p3"]) {
        const text = JSON.stringify(L.inbox.get(id) ?? []);
        expect(text).not.toMatch(/dud|fake/i);
        for (const m of L.inbox.get(id) ?? []) {
          const b = (m as { boss?: { powers?: { balloon?: { shape: string } | null } } }).boss?.powers?.balloon;
          if (b) expect(b.shape).toBe("q");
        }
      }
    }
    expect(popped).toBe(true);
    const round = L.toRound();
    expect(round.boss!.powers!.balloonLast).toMatchObject({ outcome: "pop", shape: "q" });
    expect(round.boss!.powers!.events.filter((e) => e.kind === "pop" || e.kind === "wince").map((e) => e.kind)).toEqual(["pop", "wince"]);
  });
});
