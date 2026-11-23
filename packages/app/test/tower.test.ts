import { afterEach, describe, expect, it, vi } from "vitest";
import { BATTLE_TOWER } from "@chessroyale/core";
import { FloorPlay, TOWER_WORDS, floorOutcome, floorPlan, floorRating, leaveIsFree, livesOf, livesWords, lostWords, loadKept, ordinal, readKept, saveKept, settleKept, spentLine, towerBoss, type KeptFloor } from "../src/tower.ts";

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
    // (A floor lost again: a party gone back to a floor one of its members lost with it, the review of #839, finding 1.)
    expect([[2, 2], [2, 5, 2], [3, 3, 3]].map(lostWords)).toEqual(["Lost floor 2 twice", "Lost floors 2 twice and 5", "Lost floor 3 3 times"]);
  });

  it("the clerk's words follow the lives setting, never a number written in (the review of #839, finding 5)", () => {
    // (Today's setting, 2: built from livesWords and ordinal, so another number changes the words with it.)
    expect(BATTLE_TOWER.lives).toBe(2);
    // (Nov 20, Eric: no floor count shown to players, so the clerk's line asks how high instead of naming the 99.)
    expect([TOWER_WORDS.climb, TOWER_WORDS.livesAClimb]).toEqual(["How high can you climb? Two lives: the third loss ends it.", "Two lives a climb"]);
    expect(TOWER_WORDS.climb).not.toContain(String(BATTLE_TOWER.floors));
    expect([0, 1, 2, 3, 10, 12].map(livesWords)).toEqual(["no lives", "one life", "two lives", "three lives", "ten lives", "12 lives"]);
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual(["first", "second", "third", "fourth", "tenth", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st"]);
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

  it("a free leave whose stop answer was lost: the stop sent again answers \"between\", the run still on the floor, and it's free (the lobby); a counted one moved the floor on (the review of #839, finding 3)", async () => {
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    const left: KeptFloor = { ...kept, game: undefined, done: "left", moves: 1 };
    const on2 = { id: "r", kind: "solo", floor: 2, bosses: ["gingerbread", "moo"], beaten: [["clown"]], fight: null, startedAt: 1, lives: 2, lost: [] };
    const on3 = { ...on2, floor: 3, bosses: ["moo"], lives: 1, lost: [2] };
    for (const [run, free] of [[on2, true], [on3, undefined]] as const) {
      const replies = [{ stopped: "between", run }, { runs: { solo: run, party: null }, best: { solo: 1, party: 0 } }];
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(replies.shift()), { status: 200 })));
      const end = await settleKept(left);
      expect(end).toMatchObject({ outcome: "left", status: "open", run, lives: run.lives, lost: run.lost });
      expect(end.free).toBe(free);
    }
  });

  it("a win sent after the floor was counted lost on another device (its counted leave): the server's loss stands, never \"cleared\" (the review of #839, finding 2)", async () => {
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    const won: KeptFloor = { ...kept, game: undefined, done: "won", moves: 12 };
    const run = { id: "r", kind: "solo", floor: 3, bosses: ["moo"], beaten: [["clown"]], fight: null, startedAt: 1, lives: 1, lost: [2] };
    vi.stubGlobal("fetch", answer(409, { message: "That floor isn't under way.", run, best: 1 }));
    expect(await settleKept(won)).toMatchObject({ outcome: "lost", status: "open", run, lives: 1, lost: [2] });
    // (Its floor not on the run's lost list: this device's own result, as before.)
    vi.stubGlobal("fetch", answer(409, { message: "That floor isn't under way.", run: { ...run, lost: [1], floor: 3 }, best: 2 }));
    expect(await settleKept(won)).toMatchObject({ outcome: "won", status: "open" });
  });
});

describe("the party's plan in words (tower-plan.ts planWords; the review of #835, finding 10; the delta review, finding 3)", async () => {
  const { planWaiting, planWords } = await import("../src/tower-plan.ts");
  it("on together: your own climb going back, with its floor, and the others' counted; the up button where START goes; asked first only when it's yours", () => {
    const plan = { kind: "continue" as const, floor: 5, back: [{ id: "a", floor: 30 }, { id: "b", floor: 12 }] };
    expect(planWords(plan, "c")).toEqual({ line: "Your climb together goes on: floor 5. 2 party climbs go back to it.", up: "Up to floor 5", ask: null, ok: true });
    expect(planWords({ ...plan, back: [{ id: "a", floor: 30 }] }, "c").line).toBe("Your climb together goes on: floor 5. 1 party climb goes back to it.");
    const mine = planWords(plan, "b");
    expect(mine.line).toBe("Your climb together goes on: floor 5. Yours goes back from floor 12, and 1 more.");
    expect(mine.ask).toEqual({ heading: "Back to floor 5?", note: "Your climb goes back from floor 12 to floor 5, where your party left off. Your best floors stay." });
    expect(planWords({ ...plan, back: [{ id: "b", floor: 12 }] }, "b").line).toBe("Your climb together goes on: floor 5. Yours goes back from floor 12.");
    expect(planWords({ kind: "continue", floor: 3, back: [] }, "a")).toMatchObject({ line: "Your climb together goes on: floor 3.", ask: null });
    // (Its lives once one is spent: Nov 20.)
    expect(planWords({ kind: "continue", floor: 3, back: [], lives: 2 }, "a").line).toBe("Your climb together goes on: floor 3.");
    expect(planWords({ kind: "continue", floor: 9, back: [], lives: 1 }, "a").line).toBe("Your climb together goes on: floor 9, 1 life left.");
    expect(planWords({ kind: "continue", floor: 9, back: [{ id: "a", floor: 12 }], lives: 0 }, "a").line).toBe("Your climb together goes on: floor 9, no lives left. Yours goes back from floor 12.");
  });
  it("a new climb: yours ended, with its floor, and the others' counted; asked first when it's yours; waiting: no START", () => {
    expect(planWords({ kind: "new", ends: [{ id: "a", floor: 6 }] }, "a")).toEqual({
      line: "A new climb from floor 1. It ends yours on floor 6.",
      up: "New climb: floor 1",
      ask: { heading: "Start a new climb?", note: "Your party climb on floor 6 ends, and this party starts on floor 1." },
      ok: true,
    });
    const ends = [{ id: "a", floor: 6 }, { id: "b", floor: 40 }, { id: "c", floor: 9 }];
    expect(planWords({ kind: "new", ends }, "a").line).toBe("A new climb from floor 1. It ends yours on floor 6, and 2 more.");
    expect(planWords({ kind: "new", ends }, "d").line).toBe("A new climb from floor 1. It ends 3 party climbs.");
    expect(planWords({ kind: "new", ends: [] }, "a").line).toBe("A new climb from floor 1.");
    expect(planWords({ kind: "wait", message: "Reading everyone's climbs…" }, "a")).toMatchObject({ ok: false, up: "START", ask: null });
  });
  it("no names in the line, so a party of four's is never longer than its worst case (the clerk's card keeps three lines for it)", () => {
    const back = ["a", "b", "c", "d"].map((id) => ({ id, floor: 99 }));
    // (With its lives once one is spent, Nov 20: no lives left is the longest; three lines at the card's 245 px, measured.)
    const worst = [planWords({ kind: "continue", floor: 98, back, lives: 0 }, "a").line, planWords({ kind: "new", ends: back }, "a").line].map((l) => planWaiting(l, 3));
    expect(worst).toEqual(["Your climb together goes on: floor 98, no lives left. Yours goes back from floor 99, and 3 more. 3 not ready yet.", "A new climb from floor 1. It ends yours on floor 99, and 3 more. 3 not ready yet."]);
  });
});
