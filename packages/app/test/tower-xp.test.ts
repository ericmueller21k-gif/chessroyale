import { describe, expect, it, vi } from "vitest";

/**
 * Audit 2's finding 6: a tower floor rejoined after a reload goes on with the floor's own XP game (its id kept with the floor), never a
 * new one, which would time the floor from the reload (the server keeps one solo game an account: a new start replaces the last).
 */

const started: number[] = [];
vi.mock("../src/account.ts", () => ({
  startSoloGame: async () => (started.push(1), `game${started.length}`),
  onlineGameXp: async () => null,
  refreshProfile: async () => undefined,
}));
vi.mock("../src/boss-tokens.ts", () => ({ accountReady: async () => true }));
vi.mock("../src/test-switches.ts", () => ({ testParams: () => new URLSearchParams() }));

const { noteFloorGame, soloGameId } = await import("../src/xp.ts");

describe("a tower floor's XP game (audit 2, finding 6)", () => {
  it("a new floor: noted on the server as it begins, its id kept with the floor", async () => {
    const kept: string[] = [];
    const m = {};
    noteFloorGame(m, null, (id) => kept.push(id));
    expect(await soloGameId(m)).toBe("game1");
    await Promise.resolve();
    expect(kept).toEqual(["game1"]);
    expect(started.length).toBe(1);
  });

  it("a rejoin: the floor's own game goes on (the id kept), never a new one; none kept, no XP rather than a game timed from the reload", async () => {
    const m = {};
    noteFloorGame(m, { xp: "game1" }, () => expect.unreachable());
    expect(await soloGameId(m)).toBe("game1");
    const old = {};
    noteFloorGame(old, {}, () => expect.unreachable());
    expect(await soloGameId(old)).toBeNull();
    expect(started.length).toBe(1);
  });
});
