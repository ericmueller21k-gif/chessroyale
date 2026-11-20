import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, RECLUSE_CHILD, type Settings } from "@chessroyale/core";
import { legalMoves, type UciEngine } from "@chessroyale/chess";
import { loadOpenings, SoloMatch } from "../src/solo.ts";
import { engineMoveTitle, winFormLabel } from "../src/components/BossDock.tsx";
import { FloorPlay } from "../src/tower.ts";
import { NetMatch } from "../src/net.ts";
import { seatKey, setQueue, yours } from "../src/board/yours.ts";

// (The opening library is its own chunk, loaded on first use: solo.ts.)
beforeAll(() => loadOpenings());

/** Whether this device's profile says admin (as /api/me does for an email in ADMIN_EMAILS). */
const who = vi.hoisted(() => ({ admin: false }));
vi.mock("../src/account.ts", async (orig) => {
  const real = await orig<typeof import("../src/account.ts")>();
  return { ...real, account: () => ({ ...real.account(), profile: who.admin ? ({ admin: true } as never) : null }) };
});

const raid = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, ...patch }) as Settings;

/** The admins' "Engine move" (Eric, Oct 14): admins only, Boss alone only, never online. */
describe("Engine move: who sees it", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    // (An admin's boss may load Maia: a worker that never answers, so it stays "loading".)
    vi.stubGlobal("location", { search: "" });
    vi.stubGlobal("Worker", class { onmessage = null; onerror = null; postMessage() {} terminate() {} });
  });
  afterEach(() => {
    who.admin = false;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const shown = (bots: boolean, settings = raid()) => {
    const m = new SoloMatch([], "Ann", settings, false, bots);
    m.start();
    const on = m.engineMoveShown;
    m.dispose();
    return on;
  };

  it("an admin in Boss alone sees it", () => {
    who.admin = true;
    expect(shown(false)).toBe(true);
  });

  it("a player never does, in Boss alone or anywhere", () => {
    expect(shown(false)).toBe(false);
    expect(shown(true)).toBe(false);
  });

  it("an admin doesn't either outside Boss alone: a Solo raid with bots, a match with no boss", () => {
    who.admin = true;
    expect(shown(true)).toBe(false);
    expect(shown(false, DEFAULT_SETTINGS)).toBe(false);
  });

  it("online matches have no Engine move at all", () => {
    expect("engineMove" in NetMatch.prototype).toBe(false);
    expect("engineMoveShown" in NetMatch.prototype).toBe(false);
  });
});

/**
 * What answers it (Eric, Nov 2: "I think it's set to Maia … Can you set that back to Stockfish?"): Stockfish's own search at full
 * strength, one line at engineMoveNodes over the allowed moves, its best played as yours; its title says so before the boss's
 * brain line.
 */
describe("Engine move: Stockfish at full strength, never Maia", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    vi.stubGlobal("location", { search: "" });
    // (Maia's worker never answers: the boss's loading step ends at its gate.)
    vi.stubGlobal("Worker", class { onmessage = null; onerror = null; postMessage() {} terminate() {} });
  });
  afterEach(() => {
    who.admin = false;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("plays the best of one full-strength search (engineMoveNodes, no strength limit) as your move", async () => {
    who.admin = true;
    // (The search's best is the LAST legal move: the hints' first line would be another, so the test tells them apart.)
    const deep: { n: number; nodes: number }[] = [];
    const engine = {
      topMoves: async (fen: string, n: number) => legalMoves(fen).slice(0, n).map((move, i) => ({ move, expected: 0.5 - 0.01 * i })),
      scoreMoves: async (_fen: string, moves: string[]) => moves.map((move) => ({ move, expected: 0.5 })),
      topMovesAt: async (fen: string, n: number, nodes: number) => {
        if (nodes === BOSS_POWERS.engineMoveNodes) deep.push({ n, nodes });
        return legalMoves(fen).slice(-n).map((move) => ({ move, expected: 0.6 }));
      },
      playAtElo: async (fen: string) => legalMoves(fen)[0]!,
    } as unknown as UciEngine;
    const m = new SoloMatch([engine], "Ann", raid(), false, false);
    m.start();
    for (let i = 0; i < 200 && m.phase.kind !== "play"; i++) await vi.advanceTimersByTimeAsync(500);
    expect(m.phase.kind).toBe("play");
    const fen = (m.phase as { board: { fen: string } }).board.fen;
    const before = m.moves.length;
    await vi.advanceTimersByTimeAsync(1000);
    m.engineMove();
    for (let i = 0; i < 20 && m.moves.length === before; i++) await vi.advanceTimersByTimeAsync(100);
    expect(deep).toEqual([{ n: 1, nodes: 1_000_000 }]);
    expect(m.moves[before]?.fen).toBe(fen);
    expect(m.moves[before]?.move).toBe(legalMoves(fen).at(-1));
    m.dispose();
  }, 30_000);

  it("its title says Stockfish first, then the boss's brain line (Maia's is the boss's)", () => {
    expect(engineMoveTitle("Maia 1450 · no guard · Maia's #1 · 120 ms")).toBe("Engine move (Stockfish) · Boss: Maia 1450 · no guard · Maia's #1 · 120 ms");
    expect(engineMoveTitle("")).toBe("Engine move (Stockfish)");
  });
});

/** The admins' "Win this form" (Nov 13, Eric's timing test of the Hidden Boss's music): admins only, Boss alone, him only, never online. */
describe("Win this form: who sees it", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    vi.stubGlobal("location", { search: "" });
    vi.stubGlobal("Worker", class { onmessage = null; onerror = null; postMessage() {} terminate() {} });
  });
  afterEach(() => {
    who.admin = false;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const shown = (bots: boolean, settings = raid({ bossId: "recluse", bossHidden: true })) => {
    const m = new SoloMatch([], "Ann", settings, false, bots);
    m.start();
    const on = m.winFormShown;
    // (Pressed by a player: nothing armed.)
    m.winForm();
    const armed = m.winFormArmed;
    m.dispose();
    return on || armed;
  };
  it("an admin in Boss alone against him sees it", () => {
    who.admin = true;
    expect(shown(false)).toBe(true);
  });
  it("a player never does, and pressing it does nothing", () => {
    expect(shown(false)).toBe(false);
    expect(shown(true)).toBe(false);
  });
  it("an admin sees it against any boss since Nov 20 (\"Win this match\"), in Boss alone or a solo raid with bots; never with no boss", () => {
    who.admin = true;
    expect(shown(false, raid({ bossId: "clown", bossHidden: false }))).toBe(true);
    expect(shown(true)).toBe(true);
    expect(shown(false, DEFAULT_SETTINGS)).toBe(false);
  });
  it("its words: \"Win this match\" for every boss, \"Win this form\" for the Hidden Boss's", () => {
    expect(winFormLabel(false, false)).toBe("Win this match (testing)");
    expect(winFormLabel(false, true)).toBe("Your next move wins this match (testing)");
    expect(winFormLabel(true, false)).toBe("Win this form (testing)");
  });
  it("online, in any boss battle, for an admin (Nov 13 the Hidden Boss's room's fight; Nov 20 every boss; the server checks again)", () => {
    const shownOnline = (hiddenRoom: boolean, boss: string) => {
      const m = new NetMatch("ABCDE", "Ann", null as never, false);
      m.hiddenRoom = hiddenRoom;
      (m as unknown as { boss: unknown }).boss = { id: boss, result: null };
      const sent: unknown[] = [];
      (m as unknown as { send: (x: unknown) => void }).send = (x) => void sent.push(x);
      const on = m.winFormShown;
      m.winForm();
      return { on, sent: sent.length, armed: m.winFormArmed };
    };
    // (A player, in his room's fight or anywhere: none, and pressing sends nothing.)
    expect(shownOnline(true, "recluse")).toEqual({ on: false, sent: 0, armed: false });
    expect(shownOnline(false, "clown")).toEqual({ on: false, sent: 0, armed: false });
    who.admin = true;
    expect(shownOnline(false, "recluse")).toEqual({ on: true, sent: 1, armed: true });
    expect(shownOnline(false, "clown")).toEqual({ on: true, sent: 1, armed: true });
    expect(shownOnline(true, "recluse")).toEqual({ on: true, sent: 1, armed: true });
  });

  /** A stand-in engine: its searches answer at once with the first legal moves. */
  const quick = {
    topMoves: async (fen: string, n: number) => legalMoves(fen).slice(0, n).map((move) => ({ move, expected: 0.5 })),
    scoreMoves: async (_fen: string, moves: string[]) => moves.map((move) => ({ move, expected: 0.5 })),
    topMovesAt: async (fen: string) => legalMoves(fen).slice(0, 1).map((move) => ({ move, expected: 0.5 })),
    playAtElo: async (fen: string) => legalMoves(fen)[0]!,
  } as unknown as UciEngine;
  /** Your first turn, 🏆 pressed (greyed then: armed), one move: the boss is beaten as a mate would beat him. */
  async function winOne(m: SoloMatch) {
    m.start();
    for (let i = 0; i < 400 && m.phase.kind !== "play"; i++) await vi.advanceTimersByTimeAsync(100);
    expect(m.phase.kind).toBe("play");
    expect(m.winFormShown).toBe(true);
    m.winForm();
    expect(m.winFormArmed).toBe(true);
    m.submit(legalMoves((m.phase as { board: { fen: string } }).board.fen)[0]!);
    for (let i = 0; i < 400 && !m.boss?.result; i++) await vi.advanceTimersByTimeAsync(100);
    expect(m.boss!.result).toBe("crowd");
    expect(m.boss!.crowdMoves).toBe(1);
  }

  it("Win this match, Boss alone against Boingo: the next move wins, the result as for a mate (Nov 20)", async () => {
    who.admin = true;
    const m = new SoloMatch([quick], "Ann", raid({ bossId: "clown", bossHidden: false, bossAloneMaia: 0 }), false, false);
    await winOne(m);
    for (let i = 0; i < 400 && m.phase.kind !== "results"; i++) await vi.advanceTimersByTimeAsync(100);
    expect(m.phase.kind).toBe("results");
    m.dispose();
  }, 60_000);

  it("Win this match on a Battle Tower floor (two bosses): the next move wins it, and the floor is reported won", async () => {
    who.admin = true;
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    const floor = { towerFloor: 2, bossId: "gingerbread", bossIds: ["gingerbread", "clown"], bossAvoid: "" } satisfies Partial<Settings>;
    const m = new SoloMatch([quick], "Ann", raid({ bossDifficulty: 0, bossAloneMaia: 0, bossHidden: false, bossUnfinished: false, ...floor }), false, false);
    m.tower = new FloorPlay({ v: 1, fight: "a1b2c3d4e5f6a7b8c9", floor: 2, bosses: floor.bossIds, settings: floor, beaten: [["moo"]] }, 0);
    m.tower.begin();
    const done = vi.spyOn(m.tower, "done").mockImplementation(() => undefined as never);
    await winOne(m);
    for (let i = 0; i < 400 && done.mock.calls.length === 0; i++) await vi.advanceTimersByTimeAsync(100);
    expect(done).toHaveBeenCalledWith("won", 1);
    m.dispose();
  }, 60_000);

  it("his child beaten (🏆) and grown up: a premove queued in his fall is dropped as the man's game starts, from the start on the same board (the review of the child form online, m2)", async () => {
    who.admin = true;
    const engine = {
      topMoves: async (fen: string, n: number) => legalMoves(fen).slice(0, n).map((move, i) => ({ move, expected: 0.5 - 0.01 * i })),
      scoreMoves: async (_fen: string, moves: string[]) => moves.map((move) => ({ move, expected: 0.5 })),
      topMovesAt: async (fen: string, n: number) => legalMoves(fen).slice(0, n).map((move) => ({ move, expected: 0.5 })),
      playAtElo: async (fen: string) => legalMoves(fen)[0]!,
    } as unknown as UciEngine;
    const m = new SoloMatch([engine], "Ann", raid({ bossId: "recluse", bossHidden: true, recluseChild: true }), false, false);
    m.start();
    for (let i = 0; i < 200 && m.phase.kind !== "play"; i++) await vi.advanceTimersByTimeAsync(500);
    expect(m.phase.kind).toBe("play");
    expect(m.boss!.form).toBe("child");
    m.winForm();
    m.submit(legalMoves((m.phase as { board: { fen: string } }).board.fen)[0]!);
    const falling = () => m.phase.kind === "boss" && !!m.phase.fall;
    for (let i = 0; i < 100 && !falling(); i++) await vi.advanceTimersByTimeAsync(100);
    expect(falling()).toBe(true);
    const key = seatKey(m, m.boss!.board.id, m.boss!.crowdSide);
    setQueue(key, [{ from: "g1", to: "f3" }]);
    await vi.advanceTimersByTimeAsync(RECLUSE_CHILD.fallMs + 100);
    expect(m.boss!.form).toBeUndefined();
    expect(yours(key).queue).toEqual([]);
    m.dispose();
  }, 30_000);
});
