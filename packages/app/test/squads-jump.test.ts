import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A device's storage (each case loads prefs.ts fresh, as a reload would). */
function storage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  const s = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    keys: () => [...m.keys()],
  };
  vi.stubGlobal("localStorage", s);
  return s;
}
const prefs = async () => {
  vi.resetModules();
  return import("../src/prefs.ts");
};

describe("Squads: \"Jump to my next board\" (Oct 14)", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("on for a device that hasn't set it; switched off, it stays off (remembered); on again", async () => {
    const s = storage();
    const p = await prefs();
    expect(p.squadsJumpNext()).toBe(true);
    let calls = 0;
    p.onPrefsChange(() => calls++);
    p.setSquadsJumpNext(false);
    expect(p.squadsJumpNext()).toBe(false);
    expect(calls).toBe(1);
    // A reload reads it back.
    expect((await prefs()).squadsJumpNext()).toBe(false);
    p.setSquadsJumpNext(true);
    expect((await prefs()).squadsJumpNext()).toBe(true);
    expect(s.keys()).toEqual(["brc.squads.jumpNext"]);
  });

  it("no storage (private mode): on, and switching it doesn't throw", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    const p = await prefs();
    expect(p.squadsJumpNext()).toBe(true);
    expect(() => p.setSquadsJumpNext(false)).not.toThrow();
  });
});
