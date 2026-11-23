import { afterEach, describe, expect, it, vi } from "vitest";

/** A tab: its session storage (or none) and how often the page was loaded again. */
function tab(noStorage = false, path = "/town") {
  const m = new Map<string, string>();
  const fail = () => {
    throw new Error("no storage");
  };
  vi.stubGlobal(
    "sessionStorage",
    noStorage ? { getItem: fail, setItem: fail, removeItem: fail } : { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) },
  );
  const reloads = { n: 0, storage: m };
  vi.stubGlobal("location", { pathname: path, reload: () => void reloads.n++ });
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

describe("the reload keeps your place (Nov 15: back in the town at its center, the challenge gone)", () => {
  const place = { town: { stand: { c: 12, r: 30, facing: -1, view: 0 }, open: { home: "pig", challenge: true } } };

  it("what the screen says as the page loads again comes back on the next load, once, then is gone from storage", async () => {
    const reloads = tab();
    const first = await stale();
    first.setPlace(() => place);
    expect(first.reloadForStaleChunk(1_000_000)).toBe(true);
    const next = await stale();
    expect(reloads.storage.has("brc.stalePlace"), "read as the page loads, and let go").toBe(false);
    expect(next.takePlace()).toEqual(place);
    expect(next.takePlace(), "once only").toBeNull();
    // (And a later load of the same tab doesn't bring it back.)
    expect((await stale()).takePlace()).toBeNull();
  });

  it("only at the address it was kept at, and nothing when no screen says (setPlace(null)) or the reload doesn't happen", async () => {
    tab();
    const a = await stale();
    a.setPlace(() => place);
    a.reloadForStaleChunk(1_000_000);
    expect((await stale()).takePlace("/")).toBeNull();

    tab();
    const b = await stale();
    b.setPlace(() => place);
    b.setPlace(null);
    b.reloadForStaleChunk(1_000_000);
    expect((await stale()).takePlace()).toBeNull();

    // (Within the minute: no reload, so nothing kept: no loop of reloads reopening the same room.)
    tab();
    (await stale()).reloadForStaleChunk(1_000_000);
    const c = await stale();
    c.setPlace(() => place);
    expect(c.reloadForStaleChunk(1_010_000)).toBe(false);
    expect((await stale()).takePlace()).toBeNull();
  });

  it("without storage: no place, no throw", async () => {
    tab(true);
    const s = await stale();
    s.setPlace(() => place);
    expect(s.takePlace()).toBeNull();
  });
});

describe("a chunk gone while the page loads again: nothing goes on to use it (Nov 15: reading 'loadIntro' of undefined)", () => {
  it("chunk() passes a module on, and holds an import that gave nothing (Vite's, once stale.ts took over) forever, never rejecting", async () => {
    tab();
    const { chunk } = await stale();
    expect(await chunk(Promise.resolve({ loadIntro: 1 }))).toEqual({ loadIntro: 1 });
    const used = vi.fn();
    const failed = vi.fn();
    void chunk(Promise.resolve(undefined as unknown as { loadIntro: number }))
      .then((m) => used(m.loadIntro))
      .catch(failed);
    await new Promise((ok) => setTimeout(ok, 20));
    expect(used).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
    // (A real failure, not taken over by stale.ts, still fails as before.)
    await expect(chunk(Promise.reject(new Error("offline")))).rejects.toThrow("offline");
  });
});

describe("Resume's tap, carried across that reload (solo-kept.ts noteResuming; main's run 45088115360, Nov 23)", () => {
  const kept = async () => {
    vi.resetModules();
    return import("../src/solo-kept.ts");
  };
  it("the page loaded mid-resume takes it once, for that game alone, within the minute", async () => {
    tab();
    (await kept()).noteResuming("g1", 1_000_000);
    const next = await kept();
    expect(next.takeCarriedResume("g2", 1_001_000)).toBe(false);
    expect(next.takeCarriedResume("g1", 1_001_000)).toBe(true);
    expect(next.takeCarriedResume("g1", 1_001_000)).toBe(false);
    // (Gone from storage as it was read: the page after this one shows the card.)
    expect((await kept()).takeCarriedResume("g1", 1_002_000)).toBe(false);
  });
  it("not once the resume is in, nor after the minute, nor without storage", async () => {
    tab();
    const k = await kept();
    k.noteResuming("g1", 1_000_000);
    k.noteResuming(null);
    expect((await kept()).takeCarriedResume("g1", 1_001_000)).toBe(false);
    (await kept()).noteResuming("g1", 1_000_000);
    expect((await kept()).takeCarriedResume("g1", 1_000_000 + 60_001)).toBe(false);
    tab(true);
    (await kept()).noteResuming("g1", 1_000_000);
    expect((await kept()).takeCarriedResume("g1", 1_001_000)).toBe(false);
  });
});
