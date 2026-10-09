import { afterEach, describe, expect, it, vi } from "vitest";
import { GLOBAL_CHAT } from "@chessroyale/core";
import { GlobalChatStore, type GlobalLine } from "../src/global-chat.ts";

const T0 = 1_800_000_000_000;
const line = (n: number, patch: Partial<GlobalLine> = {}): GlobalLine => ({ n, at: T0 + n, from: `p${n}`, name: `P${n}`, rating: null, icon: "♟", say: "gg", ...patch });
const answer = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("global chat in the app", () => {
  afterEach(() => vi.useRealTimers());

  it("holds at most GLOBAL_CHAT.keep lines, skips ones it has, and starts over when the server's count went back", () => {
    const c = new GlobalChatStore();
    c.take({ n: 3, lines: [line(1), line(2), line(3)] });
    c.take({ n: 3, lines: [line(2), line(3)] });
    expect(c.lines().map((l) => l.n)).toEqual([1, 2, 3]);
    c.take({ n: 80, lines: Array.from({ length: 77 }, (_, i) => line(i + 4)) });
    expect(c.lines()).toHaveLength(GLOBAL_CHAT.keep);
    expect(c.lines()[0]!.n).toBe(31);
    c.take({ n: 2, reset: true, lines: [line(1), line(2)] });
    expect(c.lines().map((l) => l.n)).toEqual([1, 2]);
    // Lines it doesn't know (an old app) and junk are dropped.
    c.take({ n: 4, lines: [line(3, { say: "free text" }), line(4)] });
    c.take("nonsense");
    expect(c.lines().map((l) => l.n)).toEqual([1, 2, 4]);
  });

  it("mirrors the server's limit: 30 s after a line goes, or when the server says", async () => {
    vi.useFakeTimers({ now: T0 });
    const c = new GlobalChatStore();
    expect(c.readyAt("me")).toBeLessThanOrEqual(T0);
    await c.say("l-hey", answer(200, { ok: true, chat: { n: 1, lines: [line(1, { from: "me", at: T0 })] }, waitMs: 30_000 }));
    expect(c.readyAt("me")).toBe(T0 + 30_000);
    expect(c.lines().map((l) => l.from)).toEqual(["me"]);
    // Over the limit (another tab, say): the server's answer sets the wait.
    const d = new GlobalChatStore();
    await d.say("gg", answer(429, { ok: false, message: "One message every 30 s.", retryMs: 12_000, chat: { n: 0, lines: [] } }));
    expect(d.readyAt("me")).toBe(T0 + 12_000);
    expect(d.error).toBe("One message every 30 s.");
    // A reload: your own last line in the chat says when you can post again.
    const e = new GlobalChatStore();
    e.take({ n: 1, lines: [line(1, { from: "me", at: T0 - 10_000 })] });
    expect(e.readyAt("me")).toBe(T0 + 20_000);
    expect(e.readyAt("someone else")).toBeLessThanOrEqual(T0);
  });

  it("mutes a player's lines on this device", () => {
    const c = new GlobalChatStore();
    c.take({ n: 3, lines: [line(1, { from: "ann" }), line(2, { from: "bo" }), line(3, { from: "ann" })] });
    c.mute("ann", true);
    expect(c.lines().map((l) => l.from)).toEqual(["bo"]);
    expect(c.mutedCount()).toBe(1);
    c.unmuteAll();
    expect(c.lines()).toHaveLength(3);
  });
});
