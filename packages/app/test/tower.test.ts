import { afterEach, describe, expect, it, vi } from "vitest";
import { BATTLE_TOWER } from "@chessroyale/core";
import { floorOutcome, floorPlan, floorRating, leaveIsFree, loadKept, readKept, saveKept, settleKept, towerBoss, type KeptFloor } from "../src/tower.ts";

// (The server's answers, faked: your account is ready at once.)
vi.mock("../src/boss-tokens.ts", () => ({ accountReady: async () => true }));

/**
 * The Battle Tower's solo restore and rules on this device (PR 10; docs/areas/battle-tower.md): the floor kept on the device read
 * back (and refused when it isn't one), which floor a start answer means here, when leaving is free, a result as the tower takes it,
 * and a boss id this app doesn't know drawn safely. (The runner's own trip through JSON: chess several-bosses.test.ts.)
 */

const fight = { id: "a1b2c3d4e5f6a7b8c9", startedAt: 1 };
const game = { snapshot: { state: { round: 0 }, boards: [], groups: [], usedFamilies: [], retired: [] }, moves: [], intro: true };
const kept: KeptFloor = { v: 1, fight: fight.id, floor: 2, bosses: ["gingerbread", "moo"], settings: { towerFloor: 2 }, beaten: [["clown"]], game: game as unknown as KeptFloor["game"] };

describe("the floor kept on the device", () => {
  it("reads back what was kept, the game with it", () => {
    expect(readKept(JSON.stringify(kept))).toEqual(kept);
    const done: KeptFloor = { ...kept, game: undefined, done: "left", moves: 3 };
    const { game: _g, ...plain } = done;
    expect(readKept(JSON.stringify(done))).toEqual(plain);
  });

  it("refuses what isn't a kept floor: nothing, damaged, another version, a bad result; a damaged game is dropped, the floor kept", () => {
    for (const t of [null, "", "{", "null", "[]", JSON.stringify({ ...kept, v: 2 }), JSON.stringify({ ...kept, fight: 7 }), JSON.stringify({ ...kept, bosses: [1] }), JSON.stringify({ ...kept, done: "maybe" }), JSON.stringify({ ...kept, settings: null })]) {
      expect(readKept(t), String(t)).toBeNull();
    }
    const broken = readKept(JSON.stringify({ ...kept, game: { snapshot: { state: null }, moves: [] } }));
    expect(broken?.fight).toBe(fight.id);
    expect(broken?.game).toBeUndefined();
  });
});

describe("what a floor's start means here", () => {
  it("a new floor: from its start", () => {
    expect(floorPlan({ fight }, null)).toBe("fresh");
    expect(floorPlan({ fight }, kept)).toBe("fresh");
  });

  it("under way and kept here: rejoined; kept with no game yet (no move made): from its start", () => {
    expect(floorPlan({ fight, under: true }, kept)).toBe("rejoin");
    expect(floorPlan({ fight, under: true }, { ...kept, game: undefined })).toBe("fresh");
  });

  it("under way with nothing kept here (another device, storage cleared, or its result already kept): ask before the counted stop", () => {
    expect(floorPlan({ fight, under: true }, null)).toBe("elsewhere");
    expect(floorPlan({ fight, under: true }, { ...kept, fight: "ffffffffffffffffff" })).toBe("elsewhere");
    expect(floorPlan({ fight, under: true }, { ...kept, done: "won" })).toBe("elsewhere");
  });

  it("under way, started by this device with nothing kept for it (its start's answer lost): its own, from its start (audit 2, finding 3)", () => {
    const dev = "0123456789abcdef0123";
    const ours = { ...fight, device: dev };
    expect(floorPlan({ fight: ours, under: true }, null, dev)).toBe("fresh");
    expect(floorPlan({ fight: ours, under: true }, { ...kept, fight: "ffffffffffffffffff" }, dev)).toBe("fresh");
    // (Another device's, or one with no id: still asked first. Its result kept here: not played again.)
    expect(floorPlan({ fight: ours, under: true }, null, "ffffffffffffffffffff")).toBe("elsewhere");
    expect(floorPlan({ fight, under: true }, null, dev)).toBe("elsewhere");
    expect(floorPlan({ fight: ours, under: true }, { ...kept, done: "won" }, dev)).toBe("elsewhere");
  });

  it("its bosses resting: only the free leave, whatever is kept", () => {
    expect(floorPlan({ fight, under: true, resting: true }, kept)).toBe("resting");
    expect(floorPlan({ fight, under: true, resting: true }, null)).toBe("resting");
  });
});

describe("the tower's rules on the device", () => {
  it("leaving is free before your 2nd move (core's leaveFloor), a loss after", () => {
    expect(BATTLE_TOWER.leaveFreeBefore).toBe(2);
    expect([0, 1, 2, 3].map(leaveIsFree)).toEqual([true, true, false, false]);
  });

  it("only a win climbs: a battle's result as the tower takes it", () => {
    expect(floorOutcome("crowd")).toBe("won");
    expect(floorOutcome("boss")).toBe("lost");
    expect(floorOutcome("draw")).toBe("drawn");
  });

  it("a floor's rating as the screens show it (the design's table), full strength from floor 80", () => {
    expect([1, 2, 5, 10, 60, 79].map((f) => floorRating(f))).toEqual(["800", "700", "1200", "1500", "2725", "3190"]);
    expect(floorRating(80)).toBe("Full strength");
  });

  it("draws a boss id it doesn't know (renamed or removed) as a stand-in, never a crash", () => {
    expect(towerBoss("gingerbread")).toMatchObject({ name: "Ginger", known: true });
    expect(towerBoss("no-such-boss")).toEqual({ id: "no-such-boss", name: "A boss", icon: "?", known: false });
  });
});

describe("sending a kept result", () => {
  const store = new Map<string, string>();
  afterEach(() => {
    vi.unstubAllGlobals();
    store.clear();
  });
  const answer = (status: number, body: object) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

  it("a 409 carrying the fight (the floor still under way: a win too soon) keeps the result to send again; a 409 without is read as the run now, and forgets it (audit 2, finding 5)", async () => {
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    const won: KeptFloor = { ...kept, game: undefined, done: "won", moves: 4 };
    saveKept(won);
    vi.stubGlobal("fetch", answer(409, { message: "Too soon.", fight, run: null, best: 0 }));
    const end = await settleKept(won);
    expect(end.error).toBe("Too soon.");
    expect(loadKept()?.done).toBe("won");
    vi.stubGlobal("fetch", answer(409, { message: "Read it again.", run: null, best: 1 }));
    const again = await settleKept(won);
    expect(again.error).toBeUndefined();
    expect(loadKept()).toBeNull();
  });
});
