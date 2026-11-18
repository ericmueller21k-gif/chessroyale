import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The live line's request (live.ts): one that never answers is given up after FRONT_DOOR.liveTimeoutMs, and the next goes at its
 * time. Before Nov 11 a request with no answer kept every later one from going, and the chats riding on it stopped until a reload
 * (docs/decisions/2026-11-11-flaky-batch.md, batch 2). Short times here, the real ones in settings.ts.
 */
vi.mock("@chessroyale/core", async (orig) => {
  const core = await orig<typeof import("@chessroyale/core")>();
  return { ...core, FRONT_DOOR: { ...core.FRONT_DOOR, liveTimeoutMs: 60, heartbeatMs: 20, livePollMs: 20 } };
});

afterEach(() => vi.unstubAllGlobals());

describe("the live line's request", () => {
  it("a request that never answers is given up, and the next one goes and is heard", async () => {
    const asked: number[] = [];
    vi.stubGlobal("document", { visibilityState: "visible", addEventListener: () => undefined });
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      asked.push(Date.now());
      // (The first never answers, unless it's given up; the rest answer at once.)
      if (asked.length === 1)
        return new Promise((_, no) => init.signal?.addEventListener("abort", () => no(init.signal!.reason)));
      return Promise.resolve(Response.json({ online: 7, matches: 0, queue: 0, playing: [], waits: { crowd: null, boss: null } }));
    });
    const { startLive, liveNow } = await import("../src/live.ts");
    startLive();
    await vi.waitFor(() => expect(liveNow()?.online).toBe(7), { timeout: 2000, interval: 10 });
    expect(asked.length).toBeGreaterThanOrEqual(2);
    // (Given up after its time, not at once.)
    expect(asked[1]! - asked[0]!).toBeGreaterThanOrEqual(50);
  });
});
