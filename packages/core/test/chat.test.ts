import { describe, expect, it } from "vitest";
import {
  CHAT_GROUPS,
  CHAT_PACKS,
  QUICK_CHAT,
  SHOP_ITEMS,
  botChatLines,
  canSay,
  canSayToAll,
  chatButtons,
  chatCheck,
  chatPackItem,
  chatReadyAt,
  chatSay,
  chatSent,
  mulberry32,
  noChatSent,
  ownedChatPacks,
  shopItem,
  type ChatSent,
} from "../src/index.ts";

describe("quick chat: the lines", () => {
  it("has the designed free phrases in four groups, and the free emoji", () => {
    const free = chatButtons([]);
    expect(free.groups.map((g) => [g.group.name, g.lines.map((l) => l.text)])).toEqual([
      ["Hello", ["Good luck!", "Have fun!", "Hi all!", "Let's go!"]],
      ["Reactions", ["Nice move!", "Wow!", "Oops…", "So close!"]],
      ["Plans", ["Trust the crowd", "Defend the king!", "Push the pawns!", "Go for mate!"]],
      ["Sporting", ["GG", "Well played", "Thanks!", "Rematch?"]],
    ]);
    expect(free.emoji.map((e) => e.text).join(" ")).toBe("👍 👏 😂 😮 😬 🔥 💀 🎉");
  });

  it("every id is unique and every phrase has a group; the packs carry Eric's lines", () => {
    const ids = CHAT_PACKS.flatMap((p) => p.lines.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of CHAT_PACKS) for (const l of p.lines) expect(p.kind === "emoji" ? l.group : CHAT_GROUPS.some((g) => g.id === l.group)).toBe(p.kind === "emoji" ? undefined : true);
    const texts = (id: string) => CHAT_PACKS.find((p) => p.id === id)!.lines.map((l) => l.text);
    expect(texts("godking")).toEqual(expect.arrayContaining(["For the crown!", "Not while I stand!"]));
    expect(texts("winter")).toEqual(expect.arrayContaining(["Ho ho ho!", "Snow way!"]));
    expect(texts("spicy")).toEqual(expect.arrayContaining(["Calculated.", "Was that a sacrifice?"]));
    expect(texts("emoji-chess").join(" ")).toBe("♟️ 👑 🏰 🐴 ⚔️ 🛡️");
    expect(texts("emoji-winter").join(" ")).toBe("❄️ ⛄ 🎄 🎁 🦌 🍪");
    expect(texts("emoji-royal").join(" ")).toBe("🤴 👸 💎 🏆 ⚜️ 🐉");
  });

  it("unknown ids are nothing; only Hello and Sporting phrases can go to everyone", () => {
    expect(chatSay("you're bad")).toBeUndefined();
    expect(chatSay({ id: "gg" })).toBeUndefined();
    expect(canSayToAll("good-luck")).toBe(true);
    expect(canSayToAll("gg")).toBe(true);
    expect(canSayToAll("nice-move")).toBe(false);
    expect(canSayToAll("push-pawns")).toBe(false);
    expect(canSayToAll("e-thumbs")).toBe(false);
    expect(canSayToAll("gk-crown")).toBe(true); // a pack's Hello line
  });
});

describe("quick chat: unlocks", () => {
  it("free packs for everyone; a pack's lines once you own its shop item", () => {
    expect(ownedChatPacks([])).toEqual(["basics", "emoji-basics"]);
    expect(canSay("gg", [])).toBe(true);
    expect(canSay("e-fire", null)).toBe(true);
    expect(canSay("gk-crown", [])).toBe(false);
    expect(canSay("e-dragon", ["chat-godking"])).toBe(false);
    expect(canSay("gk-crown", ["chat-godking"])).toBe(true);
    expect(canSay("e-dragon", [chatPackItem("emoji-royal")])).toBe(true);
    // An owned pack's phrases join their groups' rows; its emoji join the emoji row.
    const b = chatButtons(["chat-godking", "chat-emoji-royal"]);
    expect(b.groups.find((g) => g.group.id === "hello")!.lines.map((l) => l.text)).toContain("For the crown!");
    expect(b.emoji.map((e) => e.text)).toContain("🐉");
  });

  it("each pack is a shop item: free ones are starters, the rest cost the coins in settings", () => {
    for (const p of CHAT_PACKS) {
      const item = shopItem(chatPackItem(p.id))!;
      expect(item.slot).toBe("chat");
      expect(item.starter ?? false).toBe(!!p.free);
      expect(item.price).toBe(p.free ? 0 : QUICK_CHAT.packPrices[p.id]);
      if (!p.free) expect(item.price).toBeGreaterThan(0);
    }
    expect(SHOP_ITEMS.filter((i) => i.slot === "chat")).toHaveLength(CHAT_PACKS.length);
  });
});

describe("quick chat: limits", () => {
  const t0 = 1_000_000;
  const send = (s: ChatSent, say: string, at: number) => {
    const c = chatCheck(s, say, at);
    return { c, s: c.ok ? chatSent(s, say, at) : s };
  };

  it("one message every 3 s", () => {
    let s = noChatSent();
    ({ s } = send(s, "gg", t0));
    expect(chatCheck(s, "wow", t0 + 2_999)).toEqual({ ok: false, limit: "gap", retryAt: t0 + 3_000 });
    expect(chatCheck(s, "wow", t0 + 3_000).ok).toBe(true);
  });

  it("at most 5 in 30 s; the buttons can tell when the next is allowed", () => {
    let s = noChatSent();
    const says = ["gg", "wow", "oops", "thanks", "hi-all"];
    says.forEach((say, i) => ({ s } = send(s, say, t0 + i * 3_000)));
    expect(s.times).toHaveLength(5);
    const v = chatCheck(s, "rematch", t0 + 15_000);
    expect(v).toEqual({ ok: false, limit: "burst", retryAt: t0 + 30_000 });
    expect(chatReadyAt(s)).toBe(t0 + 30_000);
    expect(chatCheck(s, "rematch", t0 + 30_000).ok).toBe(true);
    // Old sends fall out of the window as new ones go.
    ({ s } = send(s, "rematch", t0 + 30_000));
    expect(s.times).toHaveLength(5);
    expect(s.times[0]).toBe(t0 + 3_000);
  });

  it("drops a repeat of your last line for a while; other lines go", () => {
    let s = noChatSent();
    ({ s } = send(s, "nice-move", t0));
    expect(chatCheck(s, "nice-move", t0 + 10_000)).toEqual({ ok: false, limit: "repeat", retryAt: t0 + QUICK_CHAT.repeatMs });
    expect(chatCheck(s, "wow", t0 + 10_000).ok).toBe(true);
    expect(chatCheck(s, "nice-move", t0 + QUICK_CHAT.repeatMs).ok).toBe(true);
  });
});

describe("quick chat: bots", () => {
  const bots = Array.from({ length: 50 }, (_, i) => `b${i}`);

  it("say hello at the start and GG at the end, to everyone, a moment later", () => {
    let starts = 0;
    let ends = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const start = botChatLines(mulberry32(seed), { kind: "start" }, bots, [], 0);
      const end = botChatLines(mulberry32(seed), { kind: "end" }, bots, [], 0);
      for (const l of start) {
        expect(["good-luck", "have-fun", "hi-all"]).toContain(l.say);
        expect(l.to).toBe("all");
      }
      for (const l of end) expect(["gg", "well-played"]).toContain(l.say);
      for (const l of [...start, ...end]) {
        expect(bots).toContain(l.from);
        expect(l.delayMs).toBeGreaterThanOrEqual(QUICK_CHAT.botDelayMs[0]);
      }
      expect(start.length).toBeLessThanOrEqual(QUICK_CHAT.botStartMax);
      if (start.length > 1) expect(start[0]!.from).not.toBe(start[1]!.from);
      starts += start.length ? 1 : 0;
      ends += end.length ? 1 : 0;
    }
    // Usually, not always.
    expect(starts).toBeGreaterThan(150);
    expect(ends).toBeGreaterThan(150);
    expect(starts).toBeLessThan(200);
  });

  it("'Nice move!' only after a great move, sometimes, to the team that made it", () => {
    let said = 0;
    for (let seed = 1; seed <= 300; seed++) {
      expect(botChatLines(mulberry32(seed), { kind: "greatMove", loss: 4 }, bots, [], 0)).toEqual([]);
      const lines = botChatLines(mulberry32(seed), { kind: "greatMove", loss: 0.2 }, ["w1", "w2"], [], 0);
      for (const l of lines) {
        expect(["nice-move", "wow"]).toContain(l.say);
        expect(l.to).toBe("team");
        expect(["w1", "w2"]).toContain(l.from);
      }
      said += lines.length;
    }
    expect(said / 300).toBeGreaterThan(QUICK_CHAT.botGreatMoveChance - 0.1);
    expect(said / 300).toBeLessThan(QUICK_CHAT.botGreatMoveChance + 0.1);
    expect(botChatLines(mulberry32(1), { kind: "greatMove", loss: 0 }, [], [], 0)).toEqual([]);
  });

  it("at most a few lines a minute across all bots", () => {
    const rng = mulberry32(5);
    const said: number[] = [];
    // A great move every 5 s for 5 minutes, and the start and the end in between.
    for (let now = 0; now < 300_000; now += 5_000) {
      const moment = now === 0 ? ({ kind: "start" } as const) : now === 295_000 ? ({ kind: "end" } as const) : ({ kind: "greatMove", loss: 0 } as const);
      for (const l of botChatLines(rng, moment, bots, said, now)) said.push(now + l.delayMs);
    }
    said.sort((a, b) => a - b);
    expect(said.length).toBeGreaterThan(5);
    for (const t of said) expect(said.filter((u) => u >= t && u < t + 60_000).length).toBeLessThanOrEqual(QUICK_CHAT.botMaxPerMinute);
  });
});
