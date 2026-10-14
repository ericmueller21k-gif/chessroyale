import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, type Settings } from "@chessroyale/core";
import { SoloMatch } from "../src/solo.ts";
import { NetMatch } from "../src/net.ts";

/** Whether this device's profile says admin (as /api/me does for an email in ADMIN_EMAILS). */
const who = vi.hoisted(() => ({ admin: false }));
vi.mock("../src/account.ts", async (orig) => {
  const real = await orig<typeof import("../src/account.ts")>();
  return { ...real, account: () => ({ ...real.account(), profile: who.admin ? ({ admin: true } as never) : null }) };
});

const raid = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, ...patch }) as Settings;

/** The admins' "Engine move" (Eric, Oct 14): admins only, Boss alone only, never online. */
describe("Engine move: who sees it", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    // (An admin's boss may load Maia: a worker that never answers, so it stays "loading".)
    vi.stubGlobal("location", { search: "" });
    vi.stubGlobal("Worker", class { onmessage = null; onerror = null; postMessage() {} terminate() {} });
  });
  afterEach(() => {
    who.admin = false;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const shown = (bots: boolean, settings = raid()) => {
    const m = new SoloMatch([], "Ann", settings, false, bots);
    m.start();
    const on = m.engineMoveShown;
    m.dispose();
    return on;
  };

  it("an admin in Boss alone sees it", () => {
    who.admin = true;
    expect(shown(false)).toBe(true);
  });

  it("a player never does, in Boss alone or anywhere", () => {
    expect(shown(false)).toBe(false);
    expect(shown(true)).toBe(false);
  });

  it("an admin doesn't either outside Boss alone: a Solo raid with bots, a match with no boss", () => {
    who.admin = true;
    expect(shown(true)).toBe(false);
    expect(shown(false, DEFAULT_SETTINGS)).toBe(false);
  });

  it("online matches have no Engine move at all", () => {
    expect("engineMove" in NetMatch.prototype).toBe(false);
    expect("engineMoveShown" in NetMatch.prototype).toBe(false);
  });
});
