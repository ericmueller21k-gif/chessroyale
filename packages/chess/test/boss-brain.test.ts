import { BOSS_BRAIN, BOSS_ROSTER, bossBrainFor, isPlayable, maiaRatingFor } from "@chessroyale/core";
import { describe, expect, it } from "vitest";
import {
  bossMoveFrom,
  brainGuard,
  brainLine,
  HumanUciEngine,
  humanBrainMove,
  parseHumanInfo,
  type BrainNote,
  type EngineLike,
  type HumanAnswer,
  type HumanEngineLike,
  type UciTransport,
} from "../src/index.ts";
import { START_FEN } from "../src/rules.ts";

/** The boss's top-8 search, scripted (expected scores for the mover). */
const TOP = [
  { move: "e2e4", expected: 0.55 },
  { move: "d2d4", expected: 0.54 },
  { move: "g1f3", expected: 0.52 },
  { move: "c2c4", expected: 0.47 },
  { move: "b1c3", expected: 0.4 },
  { move: "f2f3", expected: 0.33 },
  { move: "g2g4", expected: 0.25 },
  { move: "a2a4", expected: 0.2 },
];

const answer = (best: string | null, moves: [string, number][], ms = 90): HumanAnswer => ({ best, moves: moves.map(([move, p]) => ({ move, p })), ms });

/** A handover to test the rules with (BOSS_BRAIN's own numbers come from the calibration and may move). */
const TEST_BRAIN = {
  ...BOSS_BRAIN,
  maiaRating: [
    [1400, 1200],
    [2000, 1800],
    [2400, 2400],
  ] as const,
  maiaRatingMin: 600,
  crowdMargin: 150,
  bridgeFrom: 2600,
  bridgeStrictFrom: 2700,
  bridgeShareFrom: 2600,
  bridgeStockfishShare: 0.5,
  stockfishFrom: 2800,
};

describe("Maia's rating for a strength (BOSS_BRAIN.maiaRating)", () => {
  it("along the lines between the points; held at the last (Maia's ceiling)", () => {
    expect(maiaRatingFor(1400, TEST_BRAIN)).toBe(1200);
    expect(maiaRatingFor(1700, TEST_BRAIN)).toBe(1500);
    expect(maiaRatingFor(2200, TEST_BRAIN)).toBe(2100);
    expect(maiaRatingFor(2400, TEST_BRAIN)).toBe(2400);
    expect(maiaRatingFor(2700, TEST_BRAIN)).toBe(2400);
  });

  it("below the first point, along the first line, never under the floor", () => {
    expect(maiaRatingFor(1300, TEST_BRAIN)).toBe(1100);
    expect(maiaRatingFor(500, TEST_BRAIN)).toBe(600);
  });

  it("the shipped lines rise (never fall) with strength, within Maia's range", () => {
    let last = 0;
    for (let x = 600; x <= BOSS_BRAIN.stockfishFrom; x += 25) {
      const m = maiaRatingFor(x);
      expect(m).toBeGreaterThanOrEqual(last);
      expect(m).toBeGreaterThanOrEqual(BOSS_BRAIN.maiaRatingMin);
      expect(m).toBeLessThanOrEqual(3200);
      last = m;
    }
  });
});

describe("which brain a boss plays with (bossBrainFor)", () => {
  it("every playable boss is on Maia, no guard, by default (Eric, Oct 12), below the bridge", () => {
    for (const b of BOSS_ROSTER.filter(isPlayable)) expect(bossBrainFor(b.id, 1700, "", true, {}, TEST_BRAIN)).toEqual({ brain: "maia-raw", rating: 1500, stockfishShare: 0 });
    expect(BOSS_BRAIN.brain).toBe("maia-raw");
    expect(BOSS_BRAIN.byBoss).toEqual({});
  });

  it("a crowd (more than one picking its moves) meets Maia its margin higher; one player doesn't", () => {
    expect(bossBrainFor("clown", 1700, "", true, { crowd: true }, TEST_BRAIN).rating).toBe(maiaRatingFor(1850, TEST_BRAIN));
    expect(bossBrainFor("clown", 1700, "", true, { crowd: false }, TEST_BRAIN).rating).toBe(1500);
  });

  it("the bridge band: the light guard, then the strict one, a share of Stockfish growing to its top; Stockfish from 2800", () => {
    expect(bossBrainFor("grex", 2599, "", true, {}, TEST_BRAIN)).toMatchObject({ brain: "maia-raw", stockfishShare: 0 });
    expect(bossBrainFor("grex", 2600, "", true, {}, TEST_BRAIN)).toEqual({ brain: "maia-light", rating: 2400, stockfishShare: 0 });
    expect(bossBrainFor("grex", 2650, "", true, {}, TEST_BRAIN)).toEqual({ brain: "maia-light", rating: 2400, stockfishShare: 0.125 });
    expect(bossBrainFor("grex", 2700, "", true, {}, TEST_BRAIN)).toEqual({ brain: "maia-strict", rating: 2400, stockfishShare: 0.25 });
    expect(bossBrainFor("grex", 2799, "", true, {}, TEST_BRAIN)).toEqual({ brain: "maia-strict", rating: 2400, stockfishShare: 0.498 });
    expect(bossBrainFor("grex", 2800, "", true, {}, TEST_BRAIN)).toEqual({ brain: "stockfish", rating: null, stockfishShare: 0 });
    expect(bossBrainFor("grex", 3190, "", true, {}, TEST_BRAIN).brain).toBe("stockfish");
  });

  it("the guard follows the level (a crowd meets it sooner), Stockfish's share the strength", () => {
    // (A crowd at 2500: level 2650, the light guard already, but no share yet; one player at 2500: no guard.)
    expect(bossBrainFor("hollow", 2500, "", true, { crowd: true }, TEST_BRAIN)).toEqual({ brain: "maia-light", rating: 2400, stockfishShare: 0 });
    expect(bossBrainFor("hollow", 2500, "", true, {}, TEST_BRAIN)).toEqual({ brain: "maia-raw", rating: 2400, stockfishShare: 0 });
    expect(bossBrainFor("hollow", 2560, "", true, { crowd: true }, TEST_BRAIN).brain).toBe("maia-strict");
    expect(bossBrainFor("hollow", 2700, "", true, { crowd: true }, TEST_BRAIN)).toEqual({ brain: "maia-strict", rating: 2400, stockfishShare: 0.25 });
  });

  it("a boss of its own brain (byBoss): Stockfish stays Stockfish", () => {
    const s = { ...TEST_BRAIN, byBoss: { hollow: "stockfish" as const, clown: "maia-full" as const } };
    expect(bossBrainFor("hollow", 1700, "", true, {}, s).brain).toBe("stockfish");
    expect(bossBrainFor("clown", 1700, "", true, {}, s).brain).toBe("maia-full");
    expect(bossBrainFor("gingerbread", 1700, "", true, {}, s).brain).toBe("maia-raw");
  });

  it("a pick (the admins' Brain picker) wins over the default for any boss, without the bridge's share", () => {
    expect(bossBrainFor("gingerbread", 2300, "maia-full", true, {}, TEST_BRAIN)).toEqual({ brain: "maia-full", rating: 2250, stockfishShare: 0 });
    expect(bossBrainFor("sawyer", 2750, "maia-raw", true, {}, TEST_BRAIN)).toEqual({ brain: "maia-raw", rating: 2400, stockfishShare: 0 });
    expect(bossBrainFor("gingerbread", 2300, "stockfish", true, {}, TEST_BRAIN).brain).toBe("stockfish");
    expect(bossBrainFor("clown", 2300, "maia-strict", true, {}, TEST_BRAIN).brain).toBe("maia-strict");
  });

  it("Stockfish from 2800 whatever was picked, and wherever Maia isn't on offer (a player while it's off for them)", () => {
    expect(bossBrainFor("gingerbread", 2800, "maia-raw", true, {}, TEST_BRAIN).brain).toBe("stockfish");
    expect(bossBrainFor("gingerbread", 1500, "maia-raw", false, {}, TEST_BRAIN)).toEqual({ brain: "stockfish", rating: null, stockfishShare: 0 });
    expect(bossBrainFor("gingerbread", 1500, "", false)).toEqual({ brain: "stockfish", rating: null, stockfishShare: 0 });
  });

  it("players meet Maia too: it's switched on for them (one value: BOSS_BRAIN.forPlayers; Eric, Oct 14)", () => {
    expect(BOSS_BRAIN.forPlayers).toBe(true);
  });
});

describe("the brain's choice from Maia's candidates and the boss's top-8 (humanBrainMove)", () => {
  it("no guard: Maia's own draw, even a move Stockfish thinks is poor", () => {
    expect(humanBrainMove("maia-raw", answer("g2g4", [["e2e4", 0.5], ["g2g4", 0.1]]), TOP, null)).toEqual({ move: "g2g4", rank: 2, vetoed: 0 });
  });

  it("light guard (25 points): keeps a 15-point human move, turns down a 30-point one for Maia's next likely move", () => {
    expect(humanBrainMove("maia-light", answer("b1c3", [["b1c3", 0.4], ["e2e4", 0.3]]), TOP, null)).toEqual({ move: "b1c3", rank: 1, vetoed: 0 });
    expect(humanBrainMove("maia-light", answer("g2g4", [["g2g4", 0.4], ["c2c4", 0.3]]), TOP, null)).toEqual({ move: "c2c4", rank: 2, vetoed: 1 });
  });

  it("full guard (10 points, 1 logit): today's guard", () => {
    expect(humanBrainMove("maia-full", answer("c2c4", [["c2c4", 0.5], ["b1c3", 0.2], ["d2d4", 0.2]]), TOP, null)).toEqual({ move: "c2c4", rank: 1, vetoed: 0 });
    expect(humanBrainMove("maia-full", answer("b1c3", [["b1c3", 0.5], ["f2f3", 0.2], ["d2d4", 0.2]]), TOP, null)).toEqual({ move: "d2d4", rank: 3, vetoed: 2 });
  });

  it("strict guard (the bridge's top): only about 4 points", () => {
    expect(brainGuard("maia-strict")).toEqual(BOSS_BRAIN.strict);
    expect(brainGuard("maia-full")).toEqual(BOSS_BRAIN.full);
    expect(brainGuard("maia-light")).toEqual(BOSS_BRAIN.light);
    expect(brainGuard("maia-raw")).toBeNull();
    expect(humanBrainMove("maia-strict", answer("c2c4", [["c2c4", 0.5], ["g1f3", 0.3]]), TOP, null)).toEqual({ move: "g1f3", rank: 2, vetoed: 1 });
  });

  it("only candidates of at least 3%, at most 5 tried; none passing: Stockfish's best (null, the guard)", () => {
    const many = answer("a2a4", [["a2a4", 0.3], ["g2g4", 0.2], ["f2f3", 0.2], ["b1c3", 0.1], ["h2h3", 0.1], ["e2e4", 0.05], ["d2d4", 0.02]]);
    // (Tried: a2a4, g2g4, f2f3, b1c3 (all over 10 points) and h2h3 (outside the top 8). e2e4 would pass but is the sixth.)
    expect(humanBrainMove("maia-full", many, TOP, null)).toEqual({ move: null, vetoed: 5, why: "guard" });
    const rare = answer("g2g4", [["g2g4", 0.9], ["e2e4", 0.02]]);
    expect(humanBrainMove("maia-full", rare, TOP, null)).toEqual({ move: null, vetoed: 1, why: "guard" });
  });

  it("a move outside the top 8 is turned down (no extra search for it)", () => {
    expect(humanBrainMove("maia-light", answer("h2h3", [["h2h3", 0.6], ["e2e4", 0.3]]), TOP, null)).toEqual({ move: "e2e4", rank: 2, vetoed: 1 });
  });

  it("never a move a power forbids, even if Maia names it; none of its moves allowed: null (today's move)", () => {
    expect(humanBrainMove("maia-raw", answer("e2e4", [["e2e4", 0.6], ["d2d4", 0.3]]), TOP, ["d2d4", "g1f3"])).toEqual({ move: "d2d4", rank: 2, vetoed: 0 });
    expect(humanBrainMove("maia-full", answer("e2e4", [["e2e4", 0.6], ["d2d4", 0.3]]), TOP.filter((t) => t.move !== "e2e4"), ["d2d4", "g1f3"])).toEqual({ move: "d2d4", rank: 2, vetoed: 0 });
    expect(humanBrainMove("maia-raw", answer("e2e4", [["e2e4", 0.6]]), TOP, ["g1f3"])).toEqual({ move: null, vetoed: 0, why: "none allowed" });
    expect(humanBrainMove("maia-light", answer("e2e4", [["e2e4", 0.6]]), TOP, ["g1f3"])).toEqual({ move: null, vetoed: 0, why: "none allowed" });
  });

  it("the guard measures against the best score, not the first line", () => {
    const top = [{ move: "g1f3", expected: 0.5 }, { move: "e2e4", expected: 0.62 }];
    expect(humanBrainMove("maia-full", answer("g1f3", [["g1f3", 0.9]]), top, null)).toEqual({ move: null, vetoed: 1, why: "guard" });
  });
});

/** An engine whose top moves and limited-strength pick are scripted. */
function scripted(eloPick = "d2d4"): EngineLike & { searches: number } {
  const e = {
    searches: 0,
    topMoves: async (_f: string, n: number) => {
      e.searches++;
      return TOP.slice(0, n);
    },
    scoreMoves: async (_f: string, moves: readonly string[]) => {
      e.searches++;
      return moves.map((m) => ({ move: m, expected: TOP.find((t) => t.move === m)?.expected ?? 0.1 }));
    },
    playAtElo: async () => eloPick,
  };
  return e;
}

/** A pretend Maia: ready or not, an answer after `delay` ms. */
function fakeMaia(ans: HumanAnswer | null, ready = true, delay = 0): HumanEngineLike & { asked: { rating: number; allowed: readonly string[] | null }[] } {
  const asked: { rating: number; allowed: readonly string[] | null }[] = [];
  return {
    asked,
    ready: () => ready,
    candidates: async (_fen, rating, allowed) => {
      asked.push({ rating, allowed });
      await new Promise((r) => setTimeout(r, delay));
      return ans;
    },
  };
}

describe("the boss's move with a Maia brain (bossMoveFrom)", () => {
  const settings = { ...BOSS_BRAIN, timeoutMs: 80 };

  it("Maia's move, asked at its rating, with nothing more from Stockfish than the top-8 search", async () => {
    const maia = fakeMaia(answer("g2g4", [["e2e4", 0.5], ["g2g4", 0.2]]));
    const engine = scripted();
    let note: BrainNote | null = null;
    const move = await bossMoveFrom(engine, START_FEN, 1400, 1000, "elo", Math.random, [5, 15], undefined, null, { brain: "maia-raw", rating: 1100, engine: maia, settings, onNote: (n) => (note = n) });
    expect(move).toBe("g2g4");
    expect(maia.asked).toEqual([{ rating: 1100, allowed: null }]);
    expect(engine.searches).toBe(1);
    expect(note).toEqual({ brain: "maia-raw", rating: 1100, by: "maia", rank: 2, vetoed: 0, ms: 90 });
    expect(brainLine(note!)).toBe("Maia 1100 · no guard · Maia's #2 · 90 ms");
  });

  it("the full guard turns Maia's blunder down for its next likely move", async () => {
    let note: BrainNote | null = null;
    const move = await bossMoveFrom(scripted(), START_FEN, 1400, 1000, "elo", Math.random, [5, 15], undefined, null, {
      brain: "maia-full",
      rating: 1100,
      engine: fakeMaia(answer("g2g4", [["g2g4", 0.5], ["g1f3", 0.2]])),
      settings,
      onNote: (n) => (note = n),
    });
    expect(move).toBe("g1f3");
    expect(brainLine(note!)).toBe("Maia 1100 · full guard · guard → Maia's #2 · 90 ms");
  });

  it("every candidate vetoed: Stockfish's best", async () => {
    let note: BrainNote | null = null;
    const move = await bossMoveFrom(scripted(), START_FEN, 1400, 1000, "elo", Math.random, [5, 15], undefined, null, { brain: "maia-full", rating: 1100, engine: fakeMaia(answer("g2g4", [["g2g4", 0.9]])), settings, onNote: (n) => (note = n) });
    expect(move).toBe("e2e4");
    expect(brainLine(note!)).toBe("Maia 1100 · full guard · guard → Stockfish · 90 ms");
  });

  it("Maia not loaded yet, or too slow: today's move, never waiting", async () => {
    const notes: BrainNote[] = [];
    const notReady = fakeMaia(answer("g2g4", [["g2g4", 0.9]]), false);
    expect(await bossMoveFrom(scripted("d2d4"), START_FEN, 2200, 1000, "elo", Math.random, [5, 15], undefined, null, { brain: "maia-raw", rating: 1820, engine: notReady, settings, onNote: (n) => notes.push(n) })).toBe("d2d4");
    expect(notReady.asked).toEqual([]);
    const t = performance.now();
    const slow = fakeMaia(answer("g2g4", [["g2g4", 0.9]]), true, 2000);
    expect(await bossMoveFrom(scripted("d2d4"), START_FEN, 2200, 1000, "elo", Math.random, [5, 15], undefined, null, { brain: "maia-raw", rating: 1820, engine: slow, settings, onNote: (n) => notes.push(n) })).toBe("d2d4");
    expect(performance.now() - t).toBeLessThan(1000);
    const broken = { ...fakeMaia(null, false), failed: () => true };
    expect(await bossMoveFrom(scripted("d2d4"), START_FEN, 2200, 1000, "elo", Math.random, [5, 15], undefined, null, { brain: "maia-raw", rating: 1820, engine: broken, settings, onNote: (n) => notes.push(n) })).toBe("d2d4");
    expect(notes.map(brainLine)).toEqual(["Maia 1820 · no guard · Stockfish (Maia loading)", "Maia 1820 · no guard · Stockfish (Maia too slow)", "Maia 1820 · no guard · Stockfish (Maia failed)"]);
  });

  it("the King's strike stays Stockfish's step back; Maia isn't asked", async () => {
    const maia = fakeMaia(answer("g2g4", [["g2g4", 0.9]]));
    const notes: BrainNote[] = [];
    const move = await bossMoveFrom(scripted(), START_FEN, 1400, 1000, "stagger", Math.random, [5, 15], undefined, null, { brain: "maia-raw", rating: 1100, engine: maia, settings, onNote: (n) => notes.push(n) });
    expect(maia.asked).toEqual([]);
    expect(["c2c4", "b1c3"]).toContain(move);
    expect(notes[0]!.why).toBe("strike");
  });

  it("the bridge's share of moves: today's Stockfish move, Maia not asked (drawn per move)", async () => {
    const maia = fakeMaia(answer("g2g4", [["g2g4", 0.9]]));
    const notes: BrainNote[] = [];
    const call = (roll: number) =>
      bossMoveFrom(scripted("d2d4"), START_FEN, 2750, 1000, "elo", () => roll, [5, 15], undefined, null, { brain: "maia-strict", rating: 2400, stockfishShare: 0.375, engine: maia, settings, onNote: (n) => notes.push(n) });
    expect(await call(0.2)).toBe("d2d4");
    expect(maia.asked).toEqual([]);
    // (Not drawn: Maia's move, here vetoed by the strict guard for Stockfish's best.)
    expect(await call(0.5)).toBe("e2e4");
    expect(maia.asked).toHaveLength(1);
    expect(notes.map(brainLine)).toEqual(["Maia 2400 · strict guard · 38% Stockfish · Stockfish (bridge share)", "Maia 2400 · strict guard · 38% Stockfish · guard → Stockfish · 90 ms"]);
  });

  it("none of Maia's moves allowed: today's Stockfish move", async () => {
    let note: BrainNote | null = null;
    const move = await bossMoveFrom(scripted("d2d4"), START_FEN, 1400, 1000, "elo", Math.random, [5, 15], undefined, ["d2d4", "g1f3"], { brain: "maia-raw", rating: 1100, engine: fakeMaia(answer("e2e4", [["e2e4", 0.9]])), settings, onNote: (n) => (note = n) });
    expect(move).toBe("d2d4");
    expect(brainLine(note!)).toBe("Maia 1100 · no guard · Stockfish (none of Maia's moves allowed) · 90 ms");
  });

  it("a slip's roll is Maia's own mistakes under Maia: its move is played", async () => {
    const move = await bossMoveFrom(scripted("d2d4"), START_FEN, 1400, 1000, "stumble", Math.random, [5, 15], undefined, null, { brain: "maia-raw", rating: 1100, engine: fakeMaia(answer("b1c3", [["b1c3", 0.9]])), settings });
    expect(move).toBe("b1c3");
  });

  it("a power's limits go to Maia (searchmoves) and the move stays within them", async () => {
    const maia = fakeMaia(answer("g1f3", [["g1f3", 0.7], ["b1c3", 0.3]]));
    const move = await bossMoveFrom(scripted(), START_FEN, 1400, 1000, "elo", Math.random, [5, 15], undefined, ["g1f3", "b1c3"], { brain: "maia-full", rating: 1100, engine: maia, settings });
    expect(move).toBe("g1f3");
    expect(maia.asked[0]!.allowed).toEqual(["g1f3", "b1c3"]);
  });
});

/** A transport to a pretend Maia worker: answers the way the Maia box does. */
function fakeWorker(reply: (cmd: string, say: (l: string) => void) => void): UciTransport & { sent: string[]; closed: boolean } {
  const listeners: ((l: string) => void)[] = [];
  const t = {
    sent: [] as string[],
    closed: false,
    send(c: string) {
      t.sent.push(c);
      queueMicrotask(() => reply(c, (l) => listeners.forEach((f) => f(l))));
    },
    onLine: (l: (line: string) => void) => void listeners.push(l),
    close() {
      t.closed = true;
    },
  };
  return t;
}

const maiaBox = (fail = false) =>
  fakeWorker((cmd, say) => {
    if (cmd === "uci") ["id name Maia-3", "option name UCI_Elo type spin default 1500 min 0 max 5000", "uciok"].forEach(say);
    if (cmd === "isready") {
      if (fail) say("info string error load failed: HTTP 404");
      say("readyok");
    }
    if (cmd.startsWith("go")) {
      say("info depth 1 multipv 1 time 84 p 0.6120 pv e2e4");
      say("info depth 1 multipv 2 time 84 p 0.2500 pv d2d4");
      say("info string something else");
      say("bestmove d2d4");
    }
  });

describe("speaking to the Maia box (HumanUciEngine)", () => {
  it("reads its candidate lines, wherever the p sits", () => {
    expect(parseHumanInfo("info depth 1 multipv 3 time 84 p 0.0321 pv g1f3")).toEqual({ rank: 3, move: "g1f3", p: 0.0321 });
    expect(parseHumanInfo("info depth 1 multipv 2 pv a7a8q p 0.5")).toEqual({ rank: 2, move: "a7a8q", p: 0.5 });
    expect(parseHumanInfo("info string loaded")).toBeNull();
    expect(parseHumanInfo("bestmove e2e4")).toBeNull();
  });

  it("the handshake loads the model; then each move is text in, text out", async () => {
    const t = maiaBox();
    const maia = new HumanUciEngine(t, () => 0);
    expect(maia.ready()).toBe(false);
    expect(await maia.candidates(START_FEN, 1200, null, { temperature: 0.8, topP: 0.9, multipv: 8 })).toBeNull();
    expect(await maia.init()).toBe(true);
    expect(maia.ready()).toBe(true);
    const a = await maia.candidates(START_FEN, 1234.4, ["e2e4", "d2d4"], { temperature: 0.8, topP: 0.9, multipv: 8 });
    expect(a).toEqual({ best: "d2d4", moves: [{ move: "e2e4", p: 0.612 }, { move: "d2d4", p: 0.25 }], ms: 0 });
    expect(t.sent.slice(2)).toEqual([
      "setoption name UCI_Elo value 1234",
      "setoption name Temperature value 0.8",
      "setoption name TopP value 0.9",
      "setoption name MultiPV value 8",
      `position fen ${START_FEN}`,
      "go searchmoves e2e4 d2d4",
    ]);
    maia.close();
    expect(t.closed).toBe(true);
    expect(t.sent.at(-1)).toBe("quit");
    expect(maia.ready()).toBe(false);
  });

  it("a failed load (or a broken worker) leaves it not ready: the boss plays Stockfish", async () => {
    const maia = new HumanUciEngine(maiaBox(true));
    expect(await maia.init()).toBe(false);
    expect(maia.status).toBe("failed");
    expect(maia.error).toBe("load failed: HTTP 404");
    const ok = new HumanUciEngine(maiaBox());
    await ok.init();
    ok.fail("worker error");
    expect(ok.ready()).toBe(false);
    expect(ok.failed()).toBe(true);
  });

  it("a load that never ends gives up after its time", async () => {
    const maia = new HumanUciEngine(fakeWorker((cmd, say) => cmd === "uci" && say("uciok")));
    expect(await maia.init(50)).toBe(false);
    expect(maia.error).toBe("load timed out");
  });
});
