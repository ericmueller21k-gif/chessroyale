import { describe, expect, it } from "vitest";
import { MATCHMAKING } from "@chessroyale/core";
import { Matchmaker, queueName } from "../src/matchmaker.ts";
import { openLobbyCode, randomCode } from "../src/codes.ts";

/**
 * "Play now" never hands out a used code: a lobby still open (a match, or its results) refuses to be created again,
 * and the matchmaker tries another code.
 */

/**
 * Lobbies by code. Codes are random, so the first `inUse` codes tried stand for lobbies that are still open (a match,
 * or its results): creating one again is refused.
 */
function lobbies(inUse: number) {
  const open = new Map<string, { joinable: boolean; auto?: { fillAt: number | null; botsOff?: boolean }; hurried?: number }>();
  const tried: string[] = [];
  const ns = {
    idFromName: (name: string) => name,
    get: (code: string) => ({
      async create(c: string, _overrides: unknown, auto?: { fillAt: number | null; botsOff?: boolean }) {
        tried.push(c);
        if (tried.length <= inUse || open.has(c)) return false;
        open.set(c, { joinable: true, auto });
        return true;
      },
      async joinable() {
        return open.get(code)?.joinable ?? false;
      },
      async hurry(at: number) {
        open.get(code)!.hurried = at;
      },
    }),
  };
  return { open, tried, ns };
}

function matchmaker(ns: unknown) {
  const store = new Map<string, unknown>();
  const ctx = {
    storage: { get: async (k: string) => store.get(k), put: async (k: string, v: unknown) => void store.set(k, v) },
    blockConcurrencyWhile: <T>(fn: () => Promise<T>) => fn(),
  };
  return new Matchmaker(ctx as unknown as DurableObjectState, { LOBBIES: ns } as never);
}

describe("matchmaker", () => {
  it("never hands out a code whose lobby is still open: it tries another", async () => {
    const L = lobbies(2);
    const mm = matchmaker(L.ns);
    const { code } = await mm.next({}, 60_000);
    expect(L.tried).toHaveLength(3);
    expect(code).toBe(L.tried[2]);
    expect(L.open.get(code)).toMatchObject({ joinable: true });
    // The next player joins the same lobby while it fills.
    expect((await mm.next({}, 60_000)).code).toBe(code);
    expect(L.tried).toHaveLength(3);
    // Once it can't take more, the next player gets a new lobby (never the old code).
    L.open.get(code)!.joinable = false;
    const next = (await mm.next({}, 60_000)).code;
    expect(next).not.toBe(code);
  });

  it("one queue per mode and type: Default and Bots off never share a lobby", () => {
    const names = [queueName("crowd", "default"), queueName("crowd", "botsoff"), queueName("raid", "default"), queueName("raid", "botsoff")];
    expect(new Set(names).size).toBe(4);
    expect(queueName("crowd", "botsoff", "tests-1")).toBe("crowd-botsoff-tests-1");
    // A pool that isn't a plain name is ignored.
    expect(queueName("crowd", "default", "../x")).toBe("crowd-default");
  });

  it("Bots off: a 50 v 50 lobby has no fill time (it waits until full); a raid's minute is when it may begin with enough people", async () => {
    const L = lobbies(0);
    const t0 = Date.now();
    const crowd = (await matchmaker(L.ns).next({}, 60_000, { botsOff: true, crowdWaitsForFull: true })).code;
    expect(L.open.get(crowd)!.auto).toEqual({ fillAt: null, botsOff: true });
    const raid = (await matchmaker(L.ns).next({}, 60_000, { botsOff: true })).code;
    expect(L.open.get(raid)!.auto!.botsOff).toBe(true);
    expect(L.open.get(raid)!.auto!.fillAt).toBeGreaterThanOrEqual(t0 + 60_000);
  });

  it("Bots off → Default keeps your wait: bots fill a minute after you first joined (into a new lobby, or the one filling)", async () => {
    const L = lobbies(0);
    const mm = matchmaker(L.ns);
    const now = Date.now();
    // Waited 40 s: a new Default lobby fills in about 20 s.
    const a = (await mm.next({}, 60_000, { since: now - 40_000 })).code;
    const at = L.open.get(a)!.auto!.fillAt!;
    expect(at).toBeGreaterThanOrEqual(now + 19_000);
    expect(at).toBeLessThanOrEqual(Date.now() + 21_000);
    // Someone else switching while it fills: it's told to fill a minute after their start.
    await mm.next({}, 60_000, { since: now - 300_000 });
    expect(L.open.get(a)!.hurried).toBe(now - 300_000 + 60_000);
    // Waited ages, new lobby: soon, but not at once.
    L.open.get(a)!.joinable = false;
    const b = (await mm.next({}, 60_000, { since: now - 600_000 })).code;
    expect(L.open.get(b)!.auto!.fillAt! - Date.now()).toBeGreaterThan(MATCHMAKING.switchMinWaitMs - 1000);
  });

  it("openLobbyCode: skips codes in use, gives up after its tries", async () => {
    const inUse = new Set(["AAAAA", "BBBBB"]);
    const codes = ["AAAAA", "BBBBB", "CCCCC", "DDDDD"];
    const made: string[] = [];
    const create = async (c: string) => (inUse.has(c) ? false : (made.push(c), inUse.add(c), true));
    let i = 0;
    expect(await openLobbyCode(create, 5, () => codes[i++]!)).toBe("CCCCC");
    expect(made).toEqual(["CCCCC"]);
    i = 0;
    expect(await openLobbyCode(create, 3, () => codes[i++]!)).toBeNull();
    expect(made).toEqual(["CCCCC"]);
    expect(randomCode()).toMatch(/^[A-HJKMNP-Z2-9]{5}$/);
  });
});
