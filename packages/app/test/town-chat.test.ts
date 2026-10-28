import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOWN_CHAT } from "@chessroyale/core";
import { CHAT, CHATTER, CHAT_MODES, CHAT_MODE_CHOICE, CHAT_MODE_LABEL, ChatLog, Stick, chatMode, clampBox, chatterDelay, clockText, loadChatMode, loadChatPos, nextChatMode, onChatMode, onTownChatLineTap, pickChatter, saveChatMode, saveChatPos, say, setChatMode, setTownChatLineTap, startChatter, unsay, type ChatKind } from "../src/town/chat.ts";
import { HOMES } from "../src/town/world.ts";

/** The town square's chat log (Eric, Oct 28): the time's format, the three modes (their cycle, what each shows, remembered on
 * this device), the fade and the way back, the tap that brings the faded lines back, the stream pinned to its foot unless scrolled
 * up, a line's minute of life, `say` from any kind, the chatter table, players' lines (who said them, taken out again, a tap's
 * menu), the server's numbers, and the box's place. */

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

describe("the chat's three modes (Eric, Oct 28: the header icon goes from one to the next)", () => {
  it("are always on, new messages and off, in that order, and a tap goes round: always on, new messages, off, always on", () => {
    expect(CHAT_MODES).toEqual(["always", "new", "off"]);
    expect(nextChatMode("always")).toBe("new");
    expect(nextChatMode("new")).toBe("off");
    expect(nextChatMode("off")).toBe("always");
  });

  it("are named for the icon and for the settings sheet, in the words Eric's brief gives", () => {
    expect(CHAT_MODE_LABEL).toEqual({ always: "Chat: always on", new: "Chat: new messages only", off: "Chat: off" });
    expect(CHAT_MODE_CHOICE).toEqual({ always: "Always on", new: "New messages", off: "Off" });
  });

  afterEach(() => vi.unstubAllGlobals());
  const stub = (store: Map<string, string>) => vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });

  it("are remembered on this device: always on to begin with, then the last one set; a stranger or a storage that won't answer is always on", async () => {
    const store = new Map<string, string>();
    stub(store);
    vi.resetModules();
    const first = await import("../src/town/chat.ts");
    expect(first.chatMode()).toBe("always");
    const seen = vi.fn();
    const off = first.onChatMode(seen);
    first.setChatMode("new");
    first.setChatMode("new"); // (nothing changed: nobody is told twice)
    expect(first.chatMode()).toBe("new");
    expect(seen).toHaveBeenCalledTimes(1);
    expect(store.get(CHAT.modeKey)).toBe("new");
    off();
    first.setChatMode("off");
    expect(seen).toHaveBeenCalledTimes(1); // (let go: not told)
    // A reload: the page asks again and gets the one stored.
    vi.resetModules();
    const again = await import("../src/town/chat.ts");
    expect(again.chatMode()).toBe("off");
    store.set(CHAT.modeKey, "loud");
    expect(loadChatMode()).toBe("always");
    store.delete(CHAT.modeKey);
    expect(loadChatMode()).toBe("always");
    for (const m of CHAT_MODES) {
      saveChatMode(m);
      expect(loadChatMode()).toBe(m);
    }
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadChatMode()).toBe("always");
    expect(() => saveChatMode("new")).not.toThrow();
    // ... and the mode still works, for as long as the page lives.
    vi.resetModules();
    const blocked = await import("../src/town/chat.ts");
    blocked.setChatMode("new");
    expect(blocked.chatMode()).toBe("new");
  });

  it("the module's mode starts always on and tells the screen when it changes", () => {
    // (This file's own copy of the module: stored nothing, or what an earlier test left; set it to a known place first.)
    setChatMode("always");
    const seen = vi.fn();
    const off = onChatMode(seen);
    setChatMode("off");
    expect(chatMode()).toBe("off");
    expect(seen).toHaveBeenCalledTimes(1);
    setChatMode("always");
    off();
  });
});

describe("the log", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const make = () => {
    const changed = vi.fn();
    const log = new ChatLog(changed);
    return { log, changed, close: log.open() };
  };
  const texts = (lines: readonly { text: string }[]) => lines.map((l) => l.text);

  it("holds every line of the last minute, the newest last (no cap: the box scrolls)", () => {
    const { log, close } = make();
    for (let i = 1; i <= 80; i++) {
      log.say("Hollow", `line ${i}`, "boss");
      vi.advanceTimersByTime(700); // (80 lines in 56 s)
    }
    expect(log.lines).toHaveLength(80);
    expect(log.lines[0]!.text).toBe("line 1");
    expect(log.lines.at(-1)!.text).toBe("line 80");
    expect(texts(log.visible("always"))).toHaveLength(80);
    close();
  });

  it("shows on a message, fades after fadeAfterMs with nothing new, and the next message brings it back", () => {
    const { log, close } = make();
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
    expect(texts(log.lines)).toEqual(["first", "second"]);
    // A message just before the fade starts the wait over.
    vi.advanceTimersByTime(CHAT.fadeAfterMs - 100);
    log.say("Hollow", "third", "boss");
    vi.advanceTimersByTime(CHAT.fadeAfterMs - 100);
    expect(log.shown).toBe(true);
    vi.advanceTimersByTime(100);
    expect(log.shown).toBe(false);
    close();
  });

  it("always on shows every line, new messages the lines said since the box last came back, off none", () => {
    const { log, close } = make();
    log.say("Hollow", "one", "boss");
    vi.advanceTimersByTime(3000);
    log.say("Glim", "two", "kid"); // (the same burst: the box hadn't faded)
    expect(texts(log.visible("new"))).toEqual(["one", "two"]);
    vi.advanceTimersByTime(CHAT.fadeAfterMs); // (it fades)
    expect(log.shown).toBe(false);
    vi.advanceTimersByTime(10_000);
    log.say("Sparky", "three", "kid"); // (a new burst: only this one comes back)
    expect(texts(log.visible("always"))).toEqual(["one", "two", "three"]);
    expect(texts(log.visible("new"))).toEqual(["three"]);
    expect(log.visible("off")).toEqual([]);
    expect(log.lines).toHaveLength(3); // (off still keeps them: turning it on shows the last minute)
    close();
  });

  it("a tap on a line in new messages brings back every line of the last minute, the faded ones too, until it fades again after fadeAfterMs with nothing new", () => {
    const { log, changed, close } = make();
    log.say("Hollow", "one", "boss");
    log.say("Glim", "two", "kid");
    vi.advanceTimersByTime(CHAT.fadeAfterMs + 20_000); // (faded, 28 s on)
    log.say("Sparky", "three", "kid");
    expect(texts(log.visible("new"))).toEqual(["three"]);
    const before = changed.mock.calls.length;
    log.expand();
    expect(changed.mock.calls.length).toBe(before + 1);
    expect(log.expanded).toBe(true);
    expect(texts(log.visible("new"))).toEqual(["one", "two", "three"]);
    // It stays while someone reads (scrolling starts the wait over), and fades after fadeAfterMs of nothing.
    vi.advanceTimersByTime(CHAT.fadeAfterMs - 1);
    expect(log.shown).toBe(true);
    log.poke();
    vi.advanceTimersByTime(CHAT.fadeAfterMs - 1);
    expect(log.shown).toBe(true);
    // A message while it's open keeps every line (and starts the wait over).
    log.say("Chip", "four", "kid");
    expect(texts(log.visible("new"))).toEqual(["one", "two", "three", "four"]);
    vi.advanceTimersByTime(CHAT.fadeAfterMs - 1);
    expect(log.shown).toBe(true);
    vi.advanceTimersByTime(1);
    expect(log.shown).toBe(false);
    // The lines stay in it as it fades (nothing jumps), and the next message after it has faded shows only itself.
    expect(texts(log.visible("new"))).toEqual(["one", "two", "three", "four"]);
    log.say("Tex", "five", "kid");
    expect(log.expanded).toBe(false);
    expect(texts(log.visible("new"))).toEqual(["five"]);
    close();
  });

  it("poke does nothing to a faded box (a scroll can't bring it back)", () => {
    const { log, changed, close } = make();
    log.say("Hollow", "one", "boss");
    vi.advanceTimersByTime(CHAT.fadeAfterMs);
    const before = changed.mock.calls.length;
    log.poke();
    vi.advanceTimersByTime(CHAT.fadeAfterMs * 2);
    expect(log.shown).toBe(false);
    expect(changed.mock.calls.length).toBe(before);
    close();
  });

  it("removes a line for good lifeMs after it was said, oldest first (a line 50 s old is still there to scroll back to)", () => {
    const { log, close } = make();
    log.say("Hollow", "old", "boss");
    vi.advanceTimersByTime(40_000);
    log.say("Sparky", "newer", "kid");
    vi.advanceTimersByTime(10_000); // ("old" is 50 s old, "newer" 10 s)
    expect(texts(log.visible("always"))).toEqual(["old", "newer"]);
    vi.advanceTimersByTime(CHAT.lifeMs - 50_000 - 1);
    expect(texts(log.lines)).toEqual(["old", "newer"]);
    vi.advanceTimersByTime(1);
    expect(texts(log.lines)).toEqual(["newer"]);
    vi.advanceTimersByTime(40_000);
    expect(log.lines).toEqual([]);
    close();
  });

  it("keeps showing while it's held (picked up, typed in, or a menu open) and starts the wait when let go", () => {
    const { log, close } = make();
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
    const { log, close } = make();
    const kinds: ChatKind[] = ["boss", "kid", "player", "system"];
    for (const k of kinds) say(`Name ${k}`, `text ${k}`, k);
    expect(log.lines.map((l) => [l.kind, l.name, l.text, l.time])).toEqual(kinds.map((k) => [k, `Name ${k}`, `text ${k}`, "9:41"]));
    close();
    say("Nobody", "after the town closes", "boss"); // (dropped: no town is open)
    expect(log.lines).toHaveLength(4);
  });

  it("tells the screen when it changes, only then", () => {
    const { log, changed, close } = make();
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

describe("the stream stays at its foot unless it's scrolled up (Eric, Oct 28)", () => {
  /** A box 100 px of content, 40 px high, scrolled `top` px: its foot is at 60. */
  const at = (top: number) => ({ scrollTop: top, scrollHeight: 100, clientHeight: 40 });

  it("keeps up with new lines while it's at its foot, and stays where you are once you've scrolled up, counting what came", () => {
    const s = new Stick();
    expect(s.pinned).toBe(true);
    expect(s.added(1)).toBe(true); // (pinned: go to the foot)
    s.scrolled(at(60));
    expect(s.pinned).toBe(true);
    s.scrolled(at(20)); // (a finger or the wheel took it up)
    expect(s.pinned).toBe(false);
    expect(s.added(1)).toBe(false); // (stays put)
    expect(s.added(2)).toBe(false);
    expect(s.unseen).toBe(3); // (the "↓ new" marker)
    // Scrolled back down (within a few pixels of the foot): pinned again, the marker goes.
    s.scrolled(at(60 - CHAT.pinSlopPx));
    expect(s.pinned).toBe(true);
    expect(s.unseen).toBe(0);
    expect(s.added(1)).toBe(true);
  });

  it("goes to the foot when told (the marker's tap, the mode turned on)", () => {
    const s = new Stick();
    s.scrolled(at(10));
    s.added(4);
    s.toFoot();
    expect([s.pinned, s.unseen]).toEqual([true, 0]);
  });

  it("is never pinned a few pixels above the foot and unpinned at the slop's edge", () => {
    const s = new Stick();
    s.scrolled(at(60 - CHAT.pinSlopPx - 1));
    expect(s.pinned).toBe(false);
    s.scrolled(at(60 - CHAT.pinSlopPx));
    expect(s.pinned).toBe(true);
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
    const log = new ChatLog(() => {});
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

describe("players' lines (from the server: chat-net.ts)", () => {
  it("carry who said them and their number; unsay takes them out by number or by player, and a tap reaches the menu", () => {
    const changes = vi.fn();
    const log = new ChatLog(changes);
    const close = log.open();
    say("Ann", "hello town", "player", { uid: "ann", n: 1 });
    say("Bo", "hi Ann", "player", { uid: "bo", n: 2 });
    say("Ann", "rematch?", "player", { uid: "ann", n: 3 });
    say("Hollow", "The park gets quiet after dark.", "boss");
    expect(log.lines.map((l) => [l.name, l.uid, l.n])).toEqual([
      ["Ann", "ann", 1],
      ["Bo", "bo", 2],
      ["Ann", "ann", 3],
      ["Hollow", undefined, undefined],
    ]);
    // A moderator's Remove (by number), then a player muted (by account): only their lines go.
    unsay((l) => l.n === 2);
    expect(log.lines.map((l) => l.text)).toEqual(["hello town", "rematch?", "The park gets quiet after dark."]);
    unsay((l) => l.uid === "ann");
    expect(log.lines.map((l) => l.name)).toEqual(["Hollow"]);
    // Nothing picked: nothing changes, nothing is drawn.
    const before = changes.mock.calls.length;
    unsay((l) => l.uid === "nobody");
    expect(changes.mock.calls.length).toBe(before);
    // A tap on a player's line goes to whatever the menu set; nothing once it's let go.
    const tapped = vi.fn();
    const release = setTownChatLineTap(tapped);
    const line = { ...log.lines[0]!, uid: "bo", n: 9 };
    onTownChatLineTap(line, { x: 1, y: 2, w: 3, h: 4 });
    expect(tapped).toHaveBeenCalledWith(line, { x: 1, y: 2, w: 3, h: 4 });
    release();
    onTownChatLineTap(line, { x: 1, y: 2, w: 3, h: 4 });
    expect(tapped).toHaveBeenCalledTimes(1);
    close();
  });

  it("keeps the server's numbers: 80 characters, one message per 15 seconds, a line's minute", () => {
    expect([CHAT.maxChars, CHAT.sendEveryMs, CHAT.lifeMs]).toEqual([TOWN_CHAT.maxChars, TOWN_CHAT.gapMs, TOWN_CHAT.lineMs]);
    expect([CHAT.maxChars, CHAT.sendEveryMs, CHAT.lifeMs]).toEqual([80, 15_000, 60_000]);
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
