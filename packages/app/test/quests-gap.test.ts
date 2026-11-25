import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUESTS } from "@chessroyale/core";
import { autoOpenWaits, noteQuestsClosed, questsClosedAt, QUESTS_CLOSED_KEY } from "../src/quests.ts";
import { bossCratesShown, readShowUnowned, saveShowUnowned, SHOW_UNOWNED_KEY } from "../src/boss-crate-rows.ts";

const H = 3_600_000;
let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("the quests overlay's 12 hours between opening by itself (Eric, Nov 24)", () => {
  it("is 12 hours", () => expect(QUESTS.autoOpenGapHours).toBe(12));
  it("never closed: it may open by itself", () => expect(autoOpenWaits(null, 1_000)).toBe(false));
  it("closed at t: it waits until t + 12 h, then may open again", () => {
    const t = 1_700_000_000_000;
    expect(autoOpenWaits(t, t)).toBe(true);
    expect(autoOpenWaits(t, t + 1 * H)).toBe(true);
    expect(autoOpenWaits(t, t + 12 * H - 1)).toBe(true);
    expect(autoOpenWaits(t, t + 12 * H)).toBe(false);
    expect(autoOpenWaits(t, t + 30 * H)).toBe(false);
  });
  it("a clock set back before the close doesn't hold it forever", () => expect(autoOpenWaits(10 * H, 1 * H)).toBe(false));
  it("per account on this device: one account's close doesn't hold another's", () => {
    noteQuestsClosed("a", 5_000);
    noteQuestsClosed("b", 9_000);
    expect(questsClosedAt("a")).toBe(5_000);
    expect(questsClosedAt("b")).toBe(9_000);
    expect(questsClosedAt("c")).toBeNull();
    expect(JSON.parse(store.get(QUESTS_CLOSED_KEY)!)).toEqual({ a: 5_000, b: 9_000 });
  });
  it("no storage: never held (as before)", () => {
    const fail = () => {
      throw new Error("no storage");
    };
    vi.stubGlobal("localStorage", { getItem: fail, setItem: fail, removeItem: fail });
    noteQuestsClosed("a");
    expect(questsClosedAt("a")).toBeNull();
  });
});

describe("the Crates tab's boss crates: Show unowned (Eric, Nov 24)", () => {
  const crates = [{ id: "x" }, { id: "y" }, { id: "z" }];
  const held: Record<string, number> = { y: 2 };
  const n = (c: { id: string }) => held[c.id] ?? 0;
  it("unchecked: only the ones you hold", () => expect(bossCratesShown(crates, n, false).map((c) => c.id)).toEqual(["y"]));
  it("checked: every one, in order", () => expect(bossCratesShown(crates, n, true).map((c) => c.id)).toEqual(["x", "y", "z"]));
  it("none held, unchecked: none (the tab says so)", () => expect(bossCratesShown(crates, () => 0, false)).toEqual([]));
  it("unchecked by default; the choice is remembered on this device", () => {
    expect(readShowUnowned()).toBe(false);
    saveShowUnowned(true);
    expect(store.get(SHOW_UNOWNED_KEY)).toBe("1");
    expect(readShowUnowned()).toBe(true);
    saveShowUnowned(false);
    expect(readShowUnowned()).toBe(false);
  });
});
