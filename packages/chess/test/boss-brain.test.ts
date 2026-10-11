import { BOSS_BRAIN, bossBrainFor, maiaRatingFor } from "@chessroyale/core";
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

describe("Maia's rating for a boss's strength (BOSS_BRAIN.maiaRating)", () => {
  it("about 1100 at 1400, rising in a line to 2000 at 2400, then 3000 at 2600; Stockfish from 2800", () => {
    expect(maiaRatingFor(1400)).toBe(1100);
    expect(maiaRatingFor(1900)).toBe(1550);
    expect(maiaRatingFor(2400)).toBe(2000);
    expect(maiaRatingFor(2500)).toBe(2500);
    expect(maiaRatingFor(2600)).toBe(3000);
    expect(maiaRatingFor(2700)).toBe(3000);
    expect(maiaRatingFor(2800)).toBeNull();
    expect(maiaRatingFor(3190)).toBeNull();
  });

  it("below the first point, along the first line, never under the floor", () => {
    expect(maiaRatingFor(1300)).toBe(1010);
    expect(maiaRatingFor(800)).toBe(BOSS_BRAIN.maiaRatingMin);
  });
});

describe("which brain a boss plays with (bossBrainFor)", () => {
  it("Ginger is on the Maia brain, no guard, by default (Eric, Oct 11); other bosses are Stockfish", () => {
    expect(bossBrainFor("gingerbread", 1300, "", true)).toEqual({ brain: "maia-raw", rating: 1010 });
    expect(bossBrainFor("clown", 1300, "", true)).toEqual({ brain: "stockfish", rating: null });
  });

  it("a pick (the admins' Brain picker) wins over the default, for any boss", () => {
    expect(bossBrainFor("gingerbread", 2300, "maia-full", true)).toEqual({ brain: "maia-full", rating: 1910 });
    expect(bossBrainFor("gingerbread", 2300, "stockfish", true).brain).toBe("stockfish");
    expect(bossBrainFor("clown", 2300, "maia-light", true).brain).toBe("maia-light");
  });

  it("Stockfish at 2800 and up whatever was picked, and wherever Maia isn't on offer", () => {
    expect(bossBrainFor("gingerbread", 2800, "maia-raw", true).brain).toBe("stockfish");
    expect(bossBrainFor("gingerbread", 1500, "maia-raw", false).brain).toBe("stockfish");
  });
});

describe("the brain's choice from Maia's candidates and the boss's top-8 (humanBrainMove)", () => {
  it("no guard: Maia's own draw, even a move Stockfish thinks is poor", () => {
    expect(humanBrainMove("maia-raw", 1200, answer("g2g4", [["e2e4", 0.5], ["g2g4", 0.1]]), TOP, null)).toEqual({ move: "g2g4", rank: 2, vetoed: 0 });
  });

  it("light guard (25 points): keeps a 15-point human move, turns down a 30-point one for Maia's next likely move", () => {
    expect(humanBrainMove("maia-light", 1200, answer("b1c3", [["b1c3", 0.4], ["e2e4", 0.3]]), TOP, null)).toEqual({ move: "b1c3", rank: 1, vetoed: 0 });
    expect(humanBrainMove("maia-light", 1200, answer("g2g4", [["g2g4", 0.4], ["c2c4", 0.3]]), TOP, null)).toEqual({ move: "c2c4", rank: 2, vetoed: 1 });
  });

  it("full guard (10 points, 1 logit): today's guard", () => {
    expect(humanBrainMove("maia-full", 1500, answer("c2c4", [["c2c4", 0.5], ["b1c3", 0.2], ["d2d4", 0.2]]), TOP, null)).toEqual({ move: "c2c4", rank: 1, vetoed: 0 });
    expect(humanBrainMove("maia-full", 1500, answer("b1c3", [["b1c3", 0.5], ["f2f3", 0.2], ["d2d4", 0.2]]), TOP, null)).toEqual({ move: "d2d4", rank: 3, vetoed: 2 });
  });

  it("full guard, strict at Maia 3000: only about 4 points", () => {
    expect(brainGuard("maia-full", 3000)).toEqual(BOSS_BRAIN.strict);
    expect(brainGuard("maia-full", 2999)).toEqual(BOSS_BRAIN.full);
    expect(humanBrainMove("maia-full", 3000, answer("c2c4", [["c2c4", 0.5], ["g1f3", 0.3]]), TOP, null)).toEqual({ move: "g1f3", rank: 2, vetoed: 1 });
  });

  it("only candidates of at least 3%, at most 5 tried; none passing: Stockfish's best (null)", () => {
    const many = answer("a2a4", [["a2a4", 0.3], ["g2g4", 0.2], ["f2f3", 0.2], ["b1c3", 0.1], ["h2h3", 0.1], ["e2e4", 0.05], ["d2d4", 0.02]]);
    // (Tried: a2a4, g2g4, f2f3, b1c3 (all over 10 points) and h2h3 (outside the top 8). e2e4 would pass but is the sixth.)
    expect(humanBrainMove("maia-full", 1500, many, TOP, null)).toEqual({ move: null, vetoed: 5 });
    const rare = answer("g2g4", [["g2g4", 0.9], ["e2e4", 0.02]]);
    expect(humanBrainMove("maia-full", 1500, rare, TOP, null)).toEqual({ move: null, vetoed: 1 });
  });

  it("a move outside the top 8 is turned down (no extra search for it)", () => {
    expect(humanBrainMove("maia-light", 1500, answer("h2h3", [["h2h3", 0.6], ["e2e4", 0.3]]), TOP, null)).toEqual({ move: "e2e4", rank: 2, vetoed: 1 });
  });

  it("never a move a power forbids, even if Maia names it", () => {
    expect(humanBrainMove("maia-raw", 1500, answer("e2e4", [["e2e4", 0.6], ["d2d4", 0.3]]), TOP, ["d2d4", "g1f3"])).toEqual({ move: "d2d4", rank: 2, vetoed: 0 });
    expect(humanBrainMove("maia-full", 1500, answer("e2e4", [["e2e4", 0.6], ["d2d4", 0.3]]), TOP.filter((t) => t.move !== "e2e4"), ["d2d4", "g1f3"])).toEqual({ move: "d2d4", rank: 2, vetoed: 0 });
  });

  it("the guard measures against the best score, not the first line", () => {
    const top = [{ move: "g1f3", expected: 0.5 }, { move: "e2e4", expected: 0.62 }];
    expect(humanBrainMove("maia-full", 1500, answer("g1f3", [["g1f3", 0.9]]), top, null)).toEqual({ move: null, vetoed: 1 });
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
