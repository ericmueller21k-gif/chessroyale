import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, type Settings } from "@chessroyale/core";
import { legalMoves, type UciEngine } from "@chessroyale/chess";
import { loadOpenings, SoloMatch } from "../src/solo.ts";
import { FloorPlay, loadKept, type KeptFloor } from "../src/tower.ts";

/**
 * Audit 2's finding 2 (docs/decisions/2026-11-19-battle-tower-audit-2.md): a tower floor is kept on the device as each step of the
 * bosses' turn has played, so a reload rejoins after his reply, never before it to draw another; and the director's call on the
 * clock: the time you've used on your turn is kept with the game and given back as used on a rejoin, and no time passes while you're
 * away (the page hidden).
 */

beforeAll(() => loadOpenings());

/** A stand-in engine: its searches answer at once with the first legal moves. */
const engine = {
  topMoves: async (fen: string, n: number) => legalMoves(fen).slice(0, n).map((move) => ({ move, expected: 0.5 })),
  scoreMoves: async (_fen: string, moves: string[]) => moves.map((move) => ({ move, expected: 0.5 })),
  topMovesAt: async (fen: string) => legalMoves(fen).slice(0, 1).map((move) => ({ move, expected: 0.5 })),
  playAtElo: async (fen: string) => legalMoves(fen)[0]!,
} as unknown as UciEngine;

/** Floor 2: Ginger and Boingo, as the server's start deals them (core floorSettings), no powers' test switch. */
const floor = { towerFloor: 2, bossId: "gingerbread", bossIds: ["gingerbread", "clown"], bossAvoid: "" } satisfies Partial<Settings>;
const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossDifficulty: 0, bossAloneMaia: 0, bossHidden: false, bossUnfinished: false, ...floor } as Settings;
const kept0: KeptFloor = { v: 1, fight: "a1b2c3d4e5f6a7b8c9", floor: 2, bosses: floor.bossIds, settings: floor, beaten: [["moo"]] };

/** The page's visibility, as the floor's clock reads it. */
const page = { visibilityState: "visible" as "visible" | "hidden", listeners: new Map<string, () => void>() };
const setVisible = (v: "visible" | "hidden") => {
  page.visibilityState = v;
  page.listeners.get("visibilitychange")?.();
};

const step = (ms = 100) => vi.advanceTimersByTimeAsync(ms);
async function until(m: SoloMatch, ok: () => boolean, what: string) {
  for (let i = 0; i < 2000 && !ok(); i++) await step();
  expect(ok(), what).toBe(true);
}
const yourTurn = (m: SoloMatch) => m.phase.kind === "play";
/** `ms`, within the 100 ms steps the test's clock moves in. */
const near = (got: number, ms: number) => expect(got - ms).toBeGreaterThanOrEqual(0) && expect(got - ms).toBeLessThan(150);
const board = (m: SoloMatch) => m.runner.boards.get(m.runner.state.boards[0]!)!;

function floorMatch(kept: KeptFloor): SoloMatch {
  const m = new SoloMatch([engine], "Ann", settings, false, false);
  m.tower = new FloorPlay(kept, 0);
  m.tower.begin();
  return m;
}

describe("a tower floor kept on the device (audit 2, finding 2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    vi.stubGlobal("location", { search: "" });
    // (Maia's worker never answers: its loading step ends at BOSS_BRAIN.loadGateMs, then the bosses play the stand-in engine.)
    vi.stubGlobal("Worker", class { onmessage = null; onerror = null; postMessage() {} terminate() {} });
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    page.visibilityState = "visible";
    page.listeners.clear();
    vi.stubGlobal("document", {
      get visibilityState() {
        return page.visibilityState;
      },
      addEventListener: (t: string, f: () => void) => void page.listeners.set(t, f),
      removeEventListener: (t: string) => void page.listeners.delete(t),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("as the bosses' reply shows, the floor is kept after it: a reload rejoins after his move, never before it to draw another", async () => {
    const m = floorMatch(kept0);
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    const fen = (m.phase as { board: { fen: string } }).board.fen;
    m.submit((m.runner.crowdAllowed() ?? legalMoves(fen))[0]!);
    // (His reply on screen: the boss phase's show, its `until` set, not his thinking.)
    await until(m, () => m.phase.kind === "boss" && !m.phase.thinking && m.phase.until > Date.now() && board(m).history.length === 2, "his reply on screen");
    const kept = loadKept()!;
    expect(kept.game!.snapshot.boards[0]!.history).toEqual(board(m).history);
    expect(kept.game!.snapshot.boards[0]!.fen).toBe(board(m).fen);
    m.dispose();
    // Rejoined: your turn again at once, the same position, no boss turn played again.
    const kinds: string[] = [];
    const r = floorMatch(kept);
    r.subscribe(() => void (r.phase.kind === "boss" && r.phase.thinking && kinds.push("thinking")));
    r.resume(kept.game!);
    await until(r, () => yourTurn(r), "your turn, rejoined");
    expect(board(r).history).toEqual(board(m).history);
    expect(kinds).toEqual([]);
    r.dispose();
  });

  it("the clock: the time used on your turn is kept as you go away and given back as used on a rejoin; none passes while the page is hidden", async () => {
    const m = floorMatch(kept0);
    m.start();
    await until(m, () => yourTurn(m), "your first turn");
    const p0 = m.phase as { startsAt: number; deadline: number; allowedMs: number };
    const allowed = p0.deadline - p0.startsAt;
    // 20 s thinking, then the page hidden: the 20 s kept with the floor.
    await step(20_000);
    setVisible("hidden");
    const used = loadKept()!.game!.turnMs!;
    near(used, 20_000);
    // A night away with the page hidden: the turn is still yours, its clock where it stood.
    await step(8 * 3_600_000);
    expect(yourTurn(m)).toBe(true);
    setVisible("visible");
    const p1 = m.phase as { startsAt: number; deadline: number };
    expect(p1.deadline - Date.now()).toBe(allowed - used);
    // 5 s more, then a reload (the page closed): 25 s kept; the rejoin gives them back as used, the time away not counted.
    await step(5_000);
    setVisible("hidden");
    const kept = loadKept()!;
    expect(kept.game!.turnMs).toBe(used + 5_000);
    m.dispose();
    await step(3_600_000);
    const r = floorMatch(kept);
    r.resume(kept.game!);
    await until(r, () => yourTurn(r), "your turn, rejoined");
    const p2 = r.phase as { startsAt: number; deadline: number };
    expect(p2.deadline - p2.startsAt).toBe(allowed);
    near(Date.now() - p2.startsAt, used + 5_000);
    // (Kept again as the round began: a second reload straight away gives the same 25 s back, not a fresh clock.)
    expect(loadKept()!.game!.turnMs).toBe(used + 5_000);
    r.dispose();
  });
});
