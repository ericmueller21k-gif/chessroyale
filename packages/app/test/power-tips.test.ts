// Power tips (Eric, Nov 24; docs/decisions/2026-11-24-power-tips.md): the schedule (the 1st, 3rd and 8th battle in which a power is seen,
// then every 5th), once a battle, per account on this device, a broken store showing it; the table (every tip's boss and trigger real);
// and the exchange (the boss's line, then the God King's once it has typed out, his other lines held meanwhile).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOSS_ROSTER, POWER_TIPS, SPEECH } from "@chessroyale/core";
import { TIPS, playTip, tipDue, tipFor, tipNow } from "../src/power-tips.ts";
import { bossMomentKinds } from "../src/components/BossPowers.tsx";
import { kingLine, kingSay, resetKingSpeech } from "../src/godKing.ts";
import { bossVoice, holdMs, typeMs } from "../src/speech.tsx";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
  resetKingSpeech();
  bossVoice.reset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("power tips' schedule", () => {
  it("plays in the battles that bring the count to 1, 3, 8, then every 5", () => {
    const shown = Array.from({ length: 30 }, (_, i) => i + 1).filter((n) => tipDue(n));
    expect(shown).toEqual([1, 3, 8, 13, 18, 23, 28]);
    for (const n of [2, 4, 5, 6, 7, 9, 10, 11, 12]) expect(tipDue(n)).toBe(false);
    expect(POWER_TIPS.at).toEqual([1, 3, 8]);
  });

  it("counts a battle once, as its first such moment comes, and plays at most once a battle", () => {
    const shows: boolean[] = [];
    for (let battle = 1; battle <= 9; battle++) {
      resetKingSpeech();
      // (Two warnings in the battle, and the first asked again by another screen.)
      const first = tipNow("birdie", { kind: "trainSignal", key: `w1-${battle}` });
      expect(tipNow("birdie", { kind: "trainSignal", key: `w1-${battle}` })).toBe(first);
      expect(tipNow("birdie", { kind: "trainSignal", key: `w2-${battle}` })).toBeNull();
      shows.push(!!first);
    }
    expect(shows).toEqual([true, false, true, false, false, false, false, true, false]);
    expect(store.get("brc.tips.guest.birdie.train")).toBe("9");
    // (Another power keeps its own count.)
    expect(tipNow("clown", { kind: "pie", key: "p1" })?.power).toBe("pie");
  });

  it("shows the tip when the store can't be read", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
    });
    for (let battle = 0; battle < 3; battle++) {
      resetKingSpeech();
      expect(tipNow("sawyer", { kind: "split", key: `s-${battle}` })?.power).toBe("split");
    }
  });

  it("Chandy's tip comes with a lock at the end of his turn, never a taught capture's", () => {
    expect(tipFor("chandy", { kind: "lockOn", first: true })).toBeNull();
    expect(tipFor("chandy", { kind: "lockOn" })?.power).toBe("lockOn");
    expect(tipFor("hollow", { kind: "pie" })).toBeNull();
  });
});

describe("power tips' table", () => {
  it("every tip's boss is in the roster and its trigger is one of that boss's moments; 1 to 3 short lines, the God King answering", () => {
    const ids = new Set(BOSS_ROSTER.map((b) => b.id));
    const keys = new Set<string>();
    for (const t of TIPS) {
      expect(ids.has(t.boss), t.boss).toBe(true);
      expect(bossMomentKinds(t.boss), `${t.boss}: ${t.trigger.kind}`).toContain(t.trigger.kind);
      expect(t.lines.length).toBeGreaterThanOrEqual(1);
      expect(t.lines.length).toBeLessThanOrEqual(3);
      expect(t.lines.some((l) => l.who === "king")).toBe(true);
      for (const l of t.lines) expect(l.text.length, l.text).toBeLessThanOrEqual(110);
      keys.add(`${t.boss}.${t.power}`);
      // (One tip for a boss's moment: a second for the same trigger would never play.)
      expect(TIPS.filter((x) => x.boss === t.boss && x.trigger.kind === t.trigger.kind && x.trigger.first === t.trigger.first)).toHaveLength(1);
    }
    expect(keys.size).toBe(TIPS.length);
  });
});

describe("a tip's exchange", () => {
  it("the boss's line, then the God King's once it has typed out; his other lines held until his part is over", () => {
    vi.useFakeTimers();
    const t0 = 5_000_000;
    vi.setSystemTime(t0);
    const tip = TIPS.find((t) => t.boss === "birdie")!;
    const [b, k] = [tip.lines[0]!.text, tip.lines[1]!.text];
    playTip(tip, "birdie:0:warn");
    expect(bossVoice.line()?.text).toBe(b);
    expect(kingLine()).toBeNull();
    // (Before his reply, his danger warning is held.)
    expect(kingSay("queenDanger", "q-1")).toBeNull();
    vi.advanceTimersByTime(typeMs(b) + POWER_TIPS.replyMs + 50);
    expect(kingLine()?.text).toBe(k);
    expect(bossVoice.line()?.text).toBe(b);
    // (Through his line's time, still held; after it, he speaks again.)
    expect(kingSay("queenDanger", "q-2")).toBeNull();
    vi.advanceTimersByTime(SPEECH.maxReadMs + typeMs(k) + SPEECH.fadeMs + 100);
    expect(kingSay("queenDanger", "q-3")).not.toBeNull();
  });

  it("his reply waits for a critical line of his already up to end, rather than lapse behind it", () => {
    vi.useFakeTimers();
    const t0 = 7_000_000;
    vi.setSystemTime(t0);
    // (A long warning of his, said just before the tip: up longer than SPEECH.waitMs.)
    const danger = kingSay("blizzard", "b-1", t0, () => 0)!;
    expect(holdMs(danger) - typeMs("Pie in your face!") - POWER_TIPS.replyMs - 100).toBeGreaterThan(SPEECH.waitMs);
    const tip = TIPS.find((t) => t.boss === "clown")!;
    const k = tip.lines[1]!.text;
    vi.advanceTimersByTime(100);
    playTip(tip, "clown:0:pie");
    const ends = t0 + holdMs(danger);
    vi.advanceTimersByTime(ends - Date.now() - 50);
    expect(kingLine()?.text).toBe(danger);
    vi.advanceTimersByTime(150);
    expect(kingLine()?.text).toBe(k);
    // (Meanwhile, and through his reply, his other lines held.)
    expect(kingSay("queenDanger", "q-9")).toBeNull();
  });
});
