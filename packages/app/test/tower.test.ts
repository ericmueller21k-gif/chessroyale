import { afterEach, describe, expect, it, vi } from "vitest";
import { BATTLE_TOWER } from "@chessroyale/core";
import { FloorPlay, floorOutcome, floorPlan, floorRating, leaveIsFree, livesOf, lostWords, loadKept, readKept, saveKept, settleKept, spentLine, towerBoss, type KeptFloor } from "../src/tower.ts";

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

  it("keeps the floor's XP game and the time used on your turn (audit 2, findings 6 and 2); a bad one is dropped, the floor kept", () => {
    const more: KeptFloor = { ...kept, xp: "abc123", game: { ...kept.game!, turnMs: 20_000 } };
    expect(readKept(JSON.stringify(more))).toEqual(more);
    const bad = readKept(JSON.stringify({ ...more, xp: 7, game: { ...more.game, turnMs: "soon" } }));
    expect(bad?.xp).toBeUndefined();
    expect(bad?.game?.turnMs).toBeUndefined();
    expect(bad?.game?.moves).toEqual([]);
  });

  it("keeps the run's lives going into the floor (Nov 20); one kept before lives, or a bad one, reads as all of them", () => {
    expect(readKept(JSON.stringify({ ...kept, lives: 1 }))?.lives).toBe(1);
    expect(new FloorPlay({ ...kept, lives: 0 }, 0).lives).toBe(0);
    for (const bad of [undefined, "1", 1.5, null]) {
      const k = readKept(JSON.stringify({ ...kept, lives: bad }))!;
      expect(k.lives).toBeUndefined();
      expect(new FloorPlay(k, 0).lives).toBe(BATTLE_TOWER.lives);
    }
    expect(readKept(JSON.stringify({ ...kept, lives: 9 }))?.lives).toBe(BATTLE_TOWER.lives);
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

  it("a battle's result as the tower takes it", () => {
    expect(floorOutcome("crowd")).toBe("won");
    expect(floorOutcome("boss")).toBe("lost");
    expect(floorOutcome("draw")).toBe("drawn");
  });

  it("a floor's rating as the screens show it (the design's table), full strength on the top floor", () => {
    expect([1, 2, 5, 10, 60, 98].map((f) => floorRating(f))).toEqual(["700", "620", "780", "830", "2029", "3190"]);
    expect(floorRating(99)).toBe("Full strength");
  });

  it("lives in words (Nov 20): the result's line after a floor not won, the recap of the floors lost, the lives as shown", () => {
    expect(spentLine("lost", 8, 1)).toBe("You lost floor 8. It still counts: 1 life left.");
    expect(spentLine("drawn", 8, 0)).toBe("Floor 8 was a draw. It still counts: no lives left.");
    expect(spentLine("left", 3, 1)).toBe("You left floor 3. It still counts: 1 life left.");
    expect(spentLine("lost", 4, 1, "Your party")).toBe("Your party lost floor 4. It still counts: 1 life left.");
    expect([[], [8], [8, 11], [3, 8, 11]].map(lostWords)).toEqual(["", "Lost floor 8", "Lost floors 8 and 11", "Lost floors 3, 8 and 11"]);
    expect([undefined, -1, 0, 1, 2, 5].map(livesOf)).toEqual([2, 0, 0, 1, 2, 2]);
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

  it("a floor lost with a life spent (Nov 20): the climb goes on, the lives and floors lost the server's; a counted leave too, never taken for a free one", async () => {
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    const run = { id: "r", kind: "solo", floor: 3, bosses: ["moo"], beaten: [["clown"], ["gingerbread", "moo"]], fight: null, startedAt: 1, lives: 1, lost: [2] };
    const lost: KeptFloor = { ...kept, game: undefined, done: "lost", moves: 9, lives: 2 };
    vi.stubGlobal("fetch", answer(200, { outcome: "lost", floor: 2, status: "open", lives: 1, lost: [2], run, best: 1 }));
    expect(await settleKept(lost)).toEqual({ outcome: "lost", floor: 2, status: "open", run, best: 1, lives: 1, lost: [2] });
    // (The third loss: out, none left, every floor lost listed.)
    vi.stubGlobal("fetch", answer(200, { outcome: "lost", floor: 2, status: "out", lives: 0, lost: [1, 2, 2], run: null, best: 0 }));
    expect(await settleKept(lost)).toMatchObject({ status: "out", lives: 0, lost: [1, 2, 2], run: null });
    // (A counted leave with a life left: the stop says "lost" and the run goes on; the state read after it.)
    const left: KeptFloor = { ...kept, game: undefined, done: "left", moves: 3 };
    const replies = [
      { stopped: "lost", floor: 2, status: "open", lives: 1, lost: [2], run },
      { runs: { solo: run, party: null }, best: { solo: 1, party: 0 } },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(replies.shift()), { status: 200 })));
    const end = await settleKept(left);
    expect(end).toMatchObject({ outcome: "left", status: "open", lives: 1, lost: [2], run });
    expect(end.free).toBeUndefined();
  });
});

describe("the party's plan in words (tower-party.ts planWords; the review of #835, finding 10)", async () => {
  const { planWords } = await import("../src/tower-party.ts");
  const names: Record<string, string> = { a: "Ann", b: "Bo", c: "Cy" };
  const nameOf = (id: string) => names[id] ?? "A member";
  it("on together: who goes back from which floor, named; the up button where START goes; asked first only when it's yours", () => {
    const plan = { kind: "continue" as const, floor: 5, back: [{ id: "a", floor: 30 }, { id: "b", floor: 12 }] };
    expect(planWords(plan, "c", nameOf)).toEqual({ line: "Your climb together goes on: floor 5. Ann's climb goes back from floor 30, Bo's from floor 12.", up: "Up to floor 5", ask: null, ok: true });
    const mine = planWords(plan, "b", nameOf);
    expect(mine.line).toBe("Your climb together goes on: floor 5. Your climb goes back from floor 12, Ann's from floor 30.");
    expect(mine.ask).toEqual({ heading: "Back to floor 5?", note: "Your climb goes back from floor 12 to floor 5, where your party left off. Your best floors stay." });
    expect(planWords({ kind: "continue", floor: 3, back: [] }, "a", nameOf)).toMatchObject({ line: "Your climb together goes on: floor 3.", ask: null });
    // (Its lives once one is spent: Nov 20.)
    expect(planWords({ kind: "continue", floor: 3, back: [], lives: 2 }, "a", nameOf).line).toBe("Your climb together goes on: floor 3.");
    expect(planWords({ kind: "continue", floor: 9, back: [], lives: 1 }, "a", nameOf).line).toBe("Your climb together goes on: floor 9, 1 life left.");
    expect(planWords({ kind: "continue", floor: 9, back: [], lives: 0 }, "a", nameOf).line).toBe("Your climb together goes on: floor 9, no lives left.");
  });
  it("a new climb: what it ends, asked first when it's yours; waiting: no START", () => {
    expect(planWords({ kind: "new", ends: [{ id: "a", floor: 6 }] }, "a", nameOf)).toEqual({
      line: "A new climb from floor 1. It ends yours on floor 6.",
      up: "New climb: floor 1",
      ask: { heading: "Start a new climb?", note: "Your party climb on floor 6 ends, and this party starts on floor 1." },
      ok: true,
    });
    expect(planWords({ kind: "wait", message: "Reading everyone's climbs…" }, "a", nameOf)).toMatchObject({ ok: false, up: "START", ask: null });
  });
});
