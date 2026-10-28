import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAT, CHATTER, ChatLog, clampBox, chatterDelay, clockText, loadChatPos, pickChatter, saveChatPos, say, sendTownChat, sendWaitMs, startChatter, type ChatKind } from "../src/town/chat.ts";
import { HOMES } from "../src/town/world.ts";

/** The town square's chat log (Eric, Oct 28): the time's format, the cap per platform, the fade and the way back, a line's life,
 * `say` from any kind, the chatter table, your own line's wait, and the box's place. */

describe("the time as the log shows it", () => {
  it("is hours and minutes, 12-hour, no am/pm", () => {
    expect(clockText(new Date(2026, 9, 28, 21, 41))).toBe("9:41");
    expect(clockText(new Date(2026, 9, 28, 9, 5))).toBe("9:05");
    expect(clockText(new Date(2026, 9, 28, 13, 7))).toBe("1:07");
    expect(clockText(new Date(2026, 9, 28, 0, 5))).toBe("12:05");
    expect(clockText(new Date(2026, 9, 28, 12, 0))).toBe("12:00");
    expect(clockText(new Date(2026, 9, 28, 23, 59))).toBe("11:59");
  });
});

describe("the log", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const make = (cap: number) => {
    const changed = vi.fn();
    const log = new ChatLog(cap, changed);
    return { log, changed, close: log.open() };
  };

  it("keeps at most 5 lines on a phone and 12 on a computer, the newest last", () => {
    for (const [cap, want] of [[CHAT.capPhone, 5], [CHAT.capComputer, 12]] as const) {
      expect(cap).toBe(want);
      const { log, close } = make(cap);
      for (let i = 1; i <= want + 3; i++) log.say("Hollow", `line ${i}`, "boss");
      expect(log.lines).toHaveLength(want);
      expect(log.lines[0]!.text).toBe(`line 4`);
      expect(log.lines.at(-1)!.text).toBe(`line ${want + 3}`);
      close();
    }
  });

  it("drops the oldest when the cap shrinks (the window leaves the computer's size)", () => {
    const { log, close } = make(CHAT.capComputer);
    for (let i = 1; i <= 9; i++) log.say("Sparky", `line ${i}`, "kid");
    log.setCap(CHAT.capPhone);
    expect(log.lines.map((l) => l.text)).toEqual(["line 5", "line 6", "line 7", "line 8", "line 9"]);
    close();
  });

  it("shows on a message, fades after fadeAfterMs with nothing new, and the next message brings the lines back", () => {
    const { log, close } = make(5);
    expect(log.shown).toBe(false);
    log.say("Jefferson", "first", "boss");
    expect(log.shown).toBe(true);
    vi.advanceTimersByTime(CHAT.fadeAfterMs - 1);
    expect(log.shown).toBe(true);
    vi.advanceTimersByTime(1);
    expect(log.shown).toBe(false);
    expect(log.lines).toHaveLength(1); // (faded, not gone)
    log.say("Sparky", "second", "kid");
    expect(log.shown).toBe(true);
    expect(log.lines.map((l) => l.text)).toEqual(["first", "second"]); // the recent lines come back with it
    // A message just before the fade starts the wait over.
    vi.advanceTimersByTime(CHAT.fadeAfterMs - 100);
    log.say("Hollow", "third", "boss");
    vi.advanceTimersByTime(CHAT.fadeAfterMs - 100);
    expect(log.shown).toBe(true);
    vi.advanceTimersByTime(100);
    expect(log.shown).toBe(false);
    close();
  });

  it("removes a line for good lifeMs after it was said, oldest first", () => {
    const { log, close } = make(12);
    log.say("Hollow", "old", "boss");
    vi.advanceTimersByTime(40_000);
    log.say("Sparky", "newer", "kid");
    vi.advanceTimersByTime(CHAT.lifeMs - 40_000 - 1);
    expect(log.lines.map((l) => l.text)).toEqual(["old", "newer"]);
    vi.advanceTimersByTime(1);
    expect(log.lines.map((l) => l.text)).toEqual(["newer"]);
    vi.advanceTimersByTime(40_000);
    expect(log.lines).toEqual([]);
    close();
  });

  it("keeps showing while it's held (picked up, or typed in) and starts the wait when let go", () => {
    const { log, close } = make(5);
    log.say("Hollow", "hi", "boss");
    log.hold(true);
    vi.advanceTimersByTime(CHAT.fadeAfterMs * 3);
    expect(log.shown).toBe(true);
    log.hold(false);
    vi.advanceTimersByTime(CHAT.fadeAfterMs);
    expect(log.shown).toBe(false);
    log.hold(true); // (even with nothing new, picking it up shows it)
    expect(log.shown).toBe(true);
    close();
  });

  it("takes a message from any kind through say(), with the time this device saw it", () => {
    vi.setSystemTime(new Date(2026, 9, 28, 21, 41));
    const { log, close } = make(12);
    const kinds: ChatKind[] = ["boss", "kid", "player", "system"];
    for (const k of kinds) say(`Name ${k}`, `text ${k}`, k);
    expect(log.lines.map((l) => [l.kind, l.name, l.text, l.time])).toEqual(kinds.map((k) => [k, `Name ${k}`, `text ${k}`, "9:41"]));
    close();
    say("Nobody", "after the town closes", "boss"); // (dropped: no town is open)
    expect(log.lines).toHaveLength(4);
  });

  it("tells the screen when it changes, only then", () => {
    const { log, changed, close } = make(5);
    log.say("Hollow", "hi", "boss");
    expect(changed).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(CHAT.fadeAfterMs);
    expect(changed).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(CHAT.lifeMs);
    expect(changed).toHaveBeenCalledTimes(3); // (the line goes: nothing else is ever timed)
    vi.advanceTimersByTime(CHAT.lifeMs * 5);
    expect(changed).toHaveBeenCalledTimes(3);
    close();
  });
});

describe("the chatter table (placeholders until real players chat)", () => {
  const all = HOMES.map((h) => ({ home: h, v: CHATTER[h.id] }));

  it("has every boss with a home: two lines each, and a kid with one or two", () => {
    expect(Object.keys(CHATTER).sort()).toEqual(HOMES.map((h) => h.id).sort());
    for (const { home, v } of all) {
      expect(v.boss, home.boss).toHaveLength(2);
      expect(v.kidSays.length, v.kid).toBeGreaterThanOrEqual(1);
      expect(v.kidSays.length, v.kid).toBeLessThanOrEqual(2);
    }
  });

  it("names the fourteen kids from the sidekicks brief", () => {
    expect(all.map(({ v }) => v.kid).sort()).toEqual(["Blocky", "Bun & Bug", "Chip", "Crumb", "Dabble", "Drizzle", "Glim", "Pleat", "Sparky", "Squirt", "Stripes", "Tex", "Twinkle", "Woolly"].sort());
  });

  it("keeps every line short (under 60 characters), distinct, plain and kind", () => {
    const lines = all.flatMap(({ v }) => [...v.boss, ...v.kidSays]);
    for (const l of lines) {
      expect(l.length, l).toBeLessThan(60);
      expect(l, l).not.toMatch(/soviet|russian|hidden boss|statue/i);
    }
    expect(new Set(lines).size).toBe(lines.length);
  });

  it("never has the Hidden Boss talk", () => {
    expect(Object.keys(CHATTER)).not.toContain("recluse");
    expect(HOMES.map((h) => h.boss)).not.toContain("Hidden Boss");
  });

  it("picks anyone but the one who spoke last, a line of theirs, and reaches all 28", () => {
    const seen = new Set<string>();
    let last: string | null = null;
    for (let i = 0; i < 280; i++) {
      const c = pickChatter(() => ((i * 37 + 11) % 280) / 280, last);
      expect(c.name).not.toBe(last);
      expect(c.text.length).toBeGreaterThan(0);
      const home = HOMES.find((h) => (c.kind === "boss" ? h.boss : CHATTER[h.id].kid) === c.name)!;
      expect(c.kind === "boss" ? CHATTER[home.id].boss : CHATTER[home.id].kidSays).toContain(c.text);
      seen.add(`${c.kind}:${c.name}`);
      last = c.name;
    }
    expect(seen.size).toBe(28);
  });

  it("speaks every 20 to 45 seconds, at random", () => {
    expect(chatterDelay(() => 0)).toBe(CHAT.everyMs[0]);
    expect(chatterDelay(() => 0.999999)).toBeCloseTo(CHAT.everyMs[1], -1);
    expect(CHAT.everyMs).toEqual([20_000, 45_000]);
    vi.useFakeTimers();
    const log = new ChatLog(12, () => {});
    const close = log.open();
    const chatter = startChatter(() => 0.5);
    vi.advanceTimersByTime(32_499);
    expect(log.lines).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(log.lines).toHaveLength(1);
    expect(["boss", "kid"]).toContain(log.lines[0]!.kind);
    vi.advanceTimersByTime(32_500);
    expect(log.lines).toHaveLength(2);
    chatter.now(); // (the test hook: someone talks now)
    expect(log.lines).toHaveLength(3);
    chatter.stop();
    vi.advanceTimersByTime(120_000);
    expect(log.lines.length).toBeLessThanOrEqual(3);
    close();
    vi.useRealTimers();
  });
});

describe("your own line (this device only)", () => {
  const T0 = 5_000_000_000;
  it("shows in the log as a player, trimmed and cut to 80 characters", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const log = new ChatLog(12, () => {});
    const close = log.open();
    expect(sendTownChat("   ", T0)).toEqual({ ok: false, reason: "empty", waitMs: 0 });
    expect(log.lines).toHaveLength(0);
    expect(sendTownChat(`  hello   there ${"x".repeat(100)}`, T0)).toEqual({ ok: true });
    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]!.kind).toBe("player");
    expect(log.lines[0]!.name).toBe("Player"); // (no profile in a unit test: playerName's fallback)
    expect(log.lines[0]!.text.length).toBe(CHAT.maxChars);
    expect(log.lines[0]!.text.startsWith("hello there xxx")).toBe(true);
    close();
    vi.useRealTimers();
  });

  it("allows one message per 15 seconds and says how long is left", () => {
    expect(CHAT.sendEveryMs).toBe(15_000);
    const t = T0 + 100_000; // (after the test above sent)
    expect(sendTownChat("one", t)).toEqual({ ok: true });
    expect(sendWaitMs(t + 3_000)).toBe(12_000);
    expect(sendTownChat("two", t + 3_000)).toEqual({ ok: false, reason: "wait", waitMs: 12_000 });
    expect(sendTownChat("two", t + 14_999)).toEqual({ ok: false, reason: "wait", waitMs: 1 });
    expect(sendWaitMs(t + 15_000)).toBe(0);
    expect(sendTownChat("two", t + 15_000)).toEqual({ ok: true });
  });
});

describe("the box's place", () => {
  const map = { w: 390, h: 790 };
  const size = { w: 258, h: 182 };
  const hud = { x: 390 - 14 - 140, y: 790 - 14 - 82, w: 140, h: 82 };
  const pad = CHAT.margin;
  const inside = (p: { x: number; y: number }) => p.x >= pad && p.y >= pad && p.x + size.w <= map.w - pad && p.y + size.h <= map.h - pad;
  const clear = (p: { x: number; y: number }) => p.x + size.w <= hud.x - pad + 0.001 || p.x >= hud.x + hud.w + pad || p.y + size.h <= hud.y - pad + 0.001 || p.y >= hud.y + hud.h + pad;

  it("stays where it's put when that is on the map and clear of the buttons", () => {
    expect(clampBox(100, 200, size, map, hud)).toEqual({ x: 100, y: 200 });
  });

  it("never leaves the map", () => {
    for (const [x, y] of [[-50, -50], [9999, 9999], [-5, 400], [300, -9]] as const) expect(inside(clampBox(x, y, size, map, hud)), `${x},${y}`).toBe(true);
    expect(clampBox(-50, -50, size, map, hud)).toEqual({ x: pad, y: pad });
  });

  it("never covers the buttons: it ends beside or above them, the nearest place that fits", () => {
    for (let x = -20; x <= 420; x += 20) {
      for (let y = -20; y <= 820; y += 20) {
        const p = clampBox(x, y, size, map, hud);
        expect(inside(p) && clear(p), `${x},${y} -> ${p.x},${p.y}`).toBe(true);
      }
    }
    // Dropped over them from above: it sits above them, and from the left: left of them.
    expect(clampBox(200, 600, size, map, hud).y + size.h).toBeLessThanOrEqual(hud.y - pad);
  });

  it("remembers a place on this device, and forgets a bad one", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    expect(loadChatPos()).toBeNull();
    saveChatPos({ x: 120.4, y: 33.6 });
    expect(loadChatPos()).toEqual({ x: 120, y: 34 });
    store.set(CHAT.storageKey, "{not json");
    expect(loadChatPos()).toBeNull();
    store.set(CHAT.storageKey, JSON.stringify({ x: "a", y: 1 }));
    expect(loadChatPos()).toBeNull();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadChatPos()).toBeNull();
    expect(() => saveChatPos({ x: 1, y: 2 })).not.toThrow();
    vi.unstubAllGlobals();
  });
});
