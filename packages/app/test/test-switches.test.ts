import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountState, Profile } from "../src/account.ts";
import { bannerPlusFor, testParams, testSwitchesFor, timingSeconds } from "../src/test-switches.ts";

/**
 * The address's test switches (?debug, ?win=1, ?rounds=2, ?pool=, …; docs/areas/ops.md, "Test switches"): only for an
 * admin, where the server has TEST_SWITCHES on, or on Vite's dev server. For anyone else they're ignored.
 */

const config = { accounts: true, google: true, email: true };
const profile = (admin?: boolean) => ({ user: { id: "u", name: "P", icon: "", signedIn: true, email: null, google: false }, stats: {}, rating: null, recent: [], ...(admin ? { admin } : {}) }) as unknown as Profile;
const state = (s: Partial<AccountState>): AccountState => ({ config: null, profile: null, ...s });

describe("who may use them", () => {
  it("a player on the real site: never", () => {
    expect(testSwitchesFor(false, state({}))).toBe(false);
    expect(testSwitchesFor(false, state({ config, profile: profile() }))).toBe(false);
    expect(testSwitchesFor(false, state({ config: { ...config, testSwitches: false }, profile: profile(false) }))).toBe(false);
  });
  it("an admin, a server with TEST_SWITCHES on (local, e2e, staging), or the dev server", () => {
    expect(testSwitchesFor(false, state({ config, profile: profile(true) }))).toBe(true);
    expect(testSwitchesFor(false, state({ config: { ...config, testSwitches: true }, profile: profile() }))).toBe(true);
    expect(testSwitchesFor(true, state({}))).toBe(true);
  });
});

describe("reading them", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("the address's query when allowed; an empty one when not, so every switch reads as absent", () => {
    vi.stubGlobal("location", { search: "?debug&win=1&rounds=2&pool=x" });
    vi.stubEnv("DEV", true);
    expect(testParams().get("win")).toBe("1");
    expect(testParams().get("rounds")).toBe("2");
    vi.stubEnv("DEV", false);
    expect([...testParams().keys()]).toEqual([]);
  });
  it("no address (Node): none", () => {
    vi.stubGlobal("location", undefined);
    expect([...testParams().keys()]).toEqual([]);
  });
});

describe("?bannerplus= and ?talkplus= (Eric, Oct 24: a URL to try the lengths)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });
  it("seconds, 0 to 3, as ms; anything else is ignored", () => {
    expect(timingSeconds("0")).toBe(0);
    expect(timingSeconds("0.5")).toBe(500);
    expect(timingSeconds("0.75")).toBe(750);
    expect(timingSeconds("1")).toBe(1000);
    expect(timingSeconds("3")).toBe(3000);
    for (const bad of [null, "", " ", "-1", "3.5", "abc", "1s", "Infinity", "NaN"]) expect(timingSeconds(bad), String(bad)).toBeNull();
  });
  it("counts only where the test switches do, and only for a game on this device (online: the server's default)", () => {
    expect(bannerPlusFor(1000, () => true, true)).toBe(1000);
    expect(bannerPlusFor(0, () => true, true)).toBe(0);
    expect(bannerPlusFor(1000, () => false, true)).toBeNull();
    expect(bannerPlusFor(1000, () => true, false)).toBeNull();
    expect(bannerPlusFor(null, () => true, true)).toBeNull();
  });
  it("read from the address once, as the page opens; whether it counts, each time", async () => {
    vi.stubGlobal("location", { search: "?bannerplus=1&talkplus=0.5" });
    vi.resetModules();
    const sw = await import("../src/test-switches.ts");
    vi.stubEnv("DEV", true);
    expect(sw.bannerPlusAsked()).toBe(1000);
    expect(sw.talkPlusMs()).toBe(500);
    // (A link that drops the query later keeps them for the page.)
    vi.stubGlobal("location", { search: "" });
    expect(sw.bannerPlusAsked()).toBe(1000);
    sw.timingOnDevice(false);
    expect(sw.bannerPlusAsked()).toBeNull();
    expect(sw.talkPlusMs()).toBe(500);
    sw.timingOnDevice(true);
    vi.stubEnv("DEV", false);
    expect(sw.bannerPlusAsked()).toBeNull();
    expect(sw.talkPlusMs()).toBe(0);
  });
});
