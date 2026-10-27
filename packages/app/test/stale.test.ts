import { afterEach, describe, expect, it, vi } from "vitest";

/** A tab: its session storage (or none) and how often the page was loaded again. */
function tab(noStorage = false) {
  const m = new Map<string, string>();
  const fail = () => {
    throw new Error("no storage");
  };
  vi.stubGlobal("sessionStorage", noStorage ? { getItem: fail, setItem: fail } : { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)) });
  const reloads = { n: 0 };
  vi.stubGlobal("location", { reload: () => void reloads.n++ });
  return reloads;
}
const stale = async () => {
  vi.resetModules();
  return import("../src/stale.ts");
};

afterEach(() => vi.unstubAllGlobals());

describe("a chunk gone after a deploy (the town square opened on an old page)", () => {
  it("loads the page again, once: a second miss on the same load waits for it", async () => {
    const reloads = tab();
    const { reloadForStaleChunk } = await stale();
    expect(reloadForStaleChunk(1_000_000)).toBe(true);
    expect(reloadForStaleChunk(1_000_001)).toBe(true);
    expect(reloads.n).toBe(1);
  });

  it("not again within a minute (after the reload, a chunk still missing is reported), and again after it", async () => {
    const reloads = tab();
    expect((await stale()).reloadForStaleChunk(1_000_000)).toBe(true);
    // (The page loaded again: a fresh module, the same tab's storage.)
    expect((await stale()).reloadForStaleChunk(1_030_000)).toBe(false);
    expect((await stale()).reloadForStaleChunk(1_061_000)).toBe(true);
    expect(reloads.n).toBe(2);
  });

  it("never without storage to remember that it tried (no loop)", async () => {
    const reloads = tab(true);
    expect((await stale()).reloadForStaleChunk(1_000_000)).toBe(false);
    expect(reloads.n).toBe(0);
  });
});
