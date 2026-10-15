import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountState, Profile } from "../src/account.ts";
import { testParams, testSwitchesFor } from "../src/test-switches.ts";

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
