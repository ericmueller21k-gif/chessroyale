import { describe, expect, it } from "vitest";
import { Matchmaker } from "../src/matchmaker.ts";
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
  const open = new Map<string, { joinable: boolean }>();
  const tried: string[] = [];
  const ns = {
    idFromName: (name: string) => name,
    get: (code: string) => ({
      async create(c: string) {
        tried.push(c);
        if (tried.length <= inUse || open.has(c)) return false;
        open.set(c, { joinable: true });
        return true;
      },
      async joinable() {
        return open.get(code)?.joinable ?? false;
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
    expect(L.open.get(code)).toEqual({ joinable: true });
    // The next player joins the same lobby while it fills.
    expect((await mm.next({}, 60_000)).code).toBe(code);
    expect(L.tried).toHaveLength(3);
    // Once it can't take more, the next player gets a new lobby (never the old code).
    L.open.get(code)!.joinable = false;
    const next = (await mm.next({}, 60_000)).code;
    expect(next).not.toBe(code);
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
