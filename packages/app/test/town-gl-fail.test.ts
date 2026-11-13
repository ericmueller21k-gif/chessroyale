import { afterEach, describe, expect, it, vi } from "vitest";
import { afterFail, lossWatch, RETRY_WINDOW_MS } from "../src/town/gl-fail.ts";

/**
 * The street town's WebGL failing (Eric, Nov 13; town/gl-fail.ts): never the old town. A loss while hidden doesn't count; one not back
 * reloads the street town once; failing again soon after, the message.
 */

afterEach(() => vi.useRealTimers());

describe("the street town's lost context", () => {
  const setup = () => {
    vi.useFakeTimers();
    const s = { lost: false, hidden: false, fails: 0 };
    const w = lossWatch(() => s.lost, () => s.hidden, 5000, () => s.fails++);
    return { s, w };
  };

  it("lost while the page shows and not back within the wait: fails once", () => {
    const { s, w } = setup();
    s.lost = true;
    w.changed();
    vi.advanceTimersByTime(4999);
    expect(s.fails).toBe(0);
    vi.advanceTimersByTime(1);
    expect(s.fails).toBe(1);
    vi.advanceTimersByTime(60_000);
    expect(s.fails, "once").toBe(1);
  });

  it("back within the wait: nothing", () => {
    const { s, w } = setup();
    s.lost = true;
    w.changed();
    vi.advanceTimersByTime(1000);
    s.lost = false;
    w.changed();
    vi.advanceTimersByTime(60_000);
    expect(s.fails).toBe(0);
  });

  it("lost while hidden (iOS backgrounding) doesn't count, however long; shown again, it gets the whole wait from then", () => {
    const { s, w } = setup();
    s.hidden = true;
    s.lost = true;
    w.changed();
    vi.advanceTimersByTime(10 * 60_000);
    expect(s.fails).toBe(0);
    s.hidden = false;
    w.changed();
    vi.advanceTimersByTime(4999);
    expect(s.fails).toBe(0);
    // Back soon after showing: nothing.
    s.lost = false;
    w.changed();
    vi.advanceTimersByTime(60_000);
    expect(s.fails).toBe(0);
  });

  it("hidden during the wait: the wait stops, and starts afresh when the page shows", () => {
    const { s, w } = setup();
    s.lost = true;
    w.changed();
    vi.advanceTimersByTime(4000);
    s.hidden = true;
    w.changed();
    vi.advanceTimersByTime(60_000);
    expect(s.fails).toBe(0);
    s.hidden = false;
    w.changed();
    vi.advanceTimersByTime(4999);
    expect(s.fails).toBe(0);
    vi.advanceTimersByTime(1);
    expect(s.fails).toBe(1);
  });

  it("lost twice within a minute, back each time: not a failure (Nov 13)", () => {
    const { s, w } = setup();
    for (let i = 0; i < 3; i++) {
      s.lost = true;
      w.changed();
      vi.advanceTimersByTime(500);
      s.lost = false;
      w.changed();
      vi.advanceTimersByTime(10_000);
    }
    expect(s.fails).toBe(0);
  });

  it("stopped: nothing after", () => {
    const { s, w } = setup();
    s.lost = true;
    w.changed();
    w.stop();
    vi.advanceTimersByTime(60_000);
    expect(s.fails).toBe(0);
  });
});

describe("after a failure", () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it("the first reloads the street town; another soon after shows the message; long after, it reloads once more", () => {
    const st = store();
    const t = 1_700_000_000_000;
    expect(afterFail(t, st)).toBe("reload");
    expect(afterFail(t + 8000, st), "failing again after the reload").toBe("message");
    expect(afterFail(t + RETRY_WINDOW_MS - 1, st)).toBe("message");
    expect(afterFail(t + RETRY_WINDOW_MS, st), "an hour's play later is a new failure").toBe("reload");
    expect(afterFail(t + RETRY_WINDOW_MS + 5000, st)).toBe("message");
  });

  it("no session storage (or it throws): the message, never a reload that could loop", () => {
    expect(afterFail(1, null)).toBe("message");
    const broken = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(afterFail(1, broken)).toBe("message");
  });
});
