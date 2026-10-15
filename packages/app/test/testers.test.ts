import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAccount } from "../src/account.ts";
import { evalBarOn, practiceOn, setEvalBarOn, setPracticeOn } from "../src/prefs.ts";

/**
 * The testers' options (Settings → Testing, shown to admins; Eric, Oct 15): practice mode and the eval bar count only
 * where the test switches do (an admin, a server with TEST_SWITCHES on, the dev server). For players both are off,
 * whatever the device stored before.
 */

let stored: Record<string, string> = {};

/** The app's account as the server describes it: an admin or not, on a server with TEST_SWITCHES on or not. */
async function signedIn(who: { admin?: boolean; testServer?: boolean }) {
  vi.stubGlobal("fetch", async (path: string) =>
    Response.json(
      path.startsWith("/api/auth/config")
        ? { accounts: true, google: false, email: false, ...(who.testServer ? { testSwitches: true } : {}) }
        : { user: { id: "u", name: "P", icon: "", signedIn: true, email: null, google: false }, stats: {}, rating: null, recent: [], ...(who.admin ? { admin: true } : {}) },
    ),
  );
  await loadAccount();
}

beforeEach(() => {
  stored = {};
  vi.stubGlobal("localStorage", { getItem: (k: string) => stored[k] ?? null, setItem: (k: string, v: string) => void (stored[k] = v) });
  // A production build (Vite's dev server allows the switches).
  vi.stubEnv("DEV", false);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("practice mode and the eval bar: testers only", () => {
  it("a player: both off, even on a device that had practice on and the bar on", async () => {
    stored = { "brc.practice": "1", "brc.evalBar": "1" };
    await signedIn({});
    expect(practiceOn()).toBe(false);
    expect(evalBarOn()).toBe(false);
  });

  it("an admin: the bar on and practice off until switched, then as switched", async () => {
    await signedIn({ admin: true });
    expect(evalBarOn()).toBe(true);
    expect(practiceOn()).toBe(false);
    setPracticeOn(true);
    setEvalBarOn(false);
    expect(practiceOn()).toBe(true);
    expect(evalBarOn()).toBe(false);
  });

  it("a test server (TEST_SWITCHES): the same as an admin", async () => {
    stored = { "brc.practice": "1" };
    await signedIn({ testServer: true });
    expect(practiceOn()).toBe(true);
    expect(evalBarOn()).toBe(true);
  });
});
