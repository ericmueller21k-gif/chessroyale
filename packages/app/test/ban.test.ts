import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The ban screen asks the server while it's up (app/ban.ts; the review of #687, minor 3): a minute after each ban answer, sooner after
 * a failed ask (5 s, doubling to the minute), and leaves at once when the server lets this browser in. One failed ask never keeps a
 * player who isn't banned on the screen for a page's life.
 */

type Ban = typeof import("../src/ban.ts");
const BAN = () => new Response("{}", { status: 403, headers: { "x-hc-banned": "1" } });
let answers: (() => Response)[] = [];
let asked = 0;

async function load(): Promise<Ban> {
  vi.resetModules();
  return import("../src/ban.ts");
}

beforeEach(() => {
  vi.useFakeTimers();
  answers = [];
  asked = 0;
  vi.stubGlobal("fetch", async (url: string) => {
    expect(url).toBe("/api/me");
    asked++;
    const next = answers.shift();
    if (!next) throw new TypeError("offline");
    return next();
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Lets the timers run `ms`, and the ask they start finish. */
const after = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
};

describe("the ban screen's asks (minor 3)", () => {
  it("a ban answer keeps the screen and asks again a minute later; a lift counts in the open tab, and the asks stop", async () => {
    const ban = await load();
    ban.enterBan();
    expect(ban.isBanned()).toBe(true);
    await after(ban.RECHECK_MS - 1);
    expect(asked).toBe(0);
    answers.push(BAN);
    await after(1);
    expect([asked, ban.isBanned()]).toEqual([1, true]);
    answers.push(() => new Response("{}", { status: 200 }));
    await after(ban.RECHECK_MS);
    expect([asked, ban.isBanned()]).toEqual([2, false]);
    await after(10 * ban.RECHECK_MS);
    expect(asked).toBe(2);
  });

  it("no answer, or one that's neither (a 429, a 5xx): asked again after 5 s, doubling up to the minute; then let in", async () => {
    const ban = await load();
    ban.enterBan();
    answers.push(() => new Response("{}", { status: 503 }));
    await ban.checkBan();
    expect([asked, ban.isBanned()]).toEqual([1, true]);
    // (Offline: no answers queued, so the fetch throws.)
    await after(ban.RETRY_MS);
    expect(asked).toBe(2);
    await after(2 * ban.RETRY_MS - 1);
    expect(asked).toBe(2);
    await after(1);
    expect(asked).toBe(3);
    answers.push(() => new Response("{}", { status: 429 }));
    await after(4 * ban.RETRY_MS);
    expect(asked).toBe(4);
    answers.push(() => new Response("{}", { status: 200 }));
    await after(8 * ban.RETRY_MS);
    expect([asked, ban.isBanned()]).toEqual([5, false]);
  });

  it("an ask on demand (back on screen, online, a sign-in here) while one is out doesn't ask twice", async () => {
    const ban = await load();
    ban.enterBan();
    answers.push(BAN);
    await Promise.all([ban.checkBan(), ban.checkBan()]);
    expect(asked).toBe(1);
    // (Not banned: no ask at all.)
    const fresh = await load();
    await fresh.checkBan();
    expect(asked).toBe(1);
  });
});
