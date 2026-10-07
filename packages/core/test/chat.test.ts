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
  chatPicks,
  chatPicksAfterGetting,
  chatPicksOf,
  chatReadyAt,
  chatSay,
  chatSays,
  chatSent,
  cleanChatPickList,
  defaultChatPicks,
  mulberry32,
  noChatSent,
  ownedChatPacks,
  shopItem,
  toggleChatPick,
  type ChatPicks,
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

  it("unknown ids are nothing; only Hello and Sporting phrases, and emoji, can go to everyone", () => {
    expect(chatSay("you're bad")).toBeUndefined();
    expect(chatSay({ id: "gg" })).toBeUndefined();
    expect(canSayToAll("good-luck")).toBe(true);
    expect(canSayToAll("gg")).toBe(true);
    expect(canSayToAll("nice-move")).toBe(false);
    expect(canSayToAll("push-pawns")).toBe(false);
    expect(canSayToAll("gk-crown")).toBe(true); // a pack's Hello line
    // Every emoji, free or from a pack (Eric, Oct 7).
    for (const p of CHAT_PACKS.filter((x) => x.kind === "emoji")) for (const l of p.lines) expect(canSayToAll(l.id)).toBe(true);
    expect(canSayToAll("not-an-emoji")).toBe(false);
  });

  it("every emoji has a name (the profile's search, and screen readers)", () => {
    for (const p of CHAT_PACKS.filter((x) => x.kind === "emoji")) for (const l of p.lines) expect(l.name).toMatch(/^[a-z][a-z -]+$/);
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

describe("quick chat: picks (the profile's Quick chat and emoji)", () => {
  const free = ownedChatPacks([]);
  const all = CHAT_PACKS.map((p) => p.id);
  const texts = (ids: readonly string[]) => chatSays(ids).map((s) => s.text);

  it("the caps and the defaults are in settings: 10 sensible free lines and the 8 free emoji, for everyone who hasn't chosen", () => {
    expect(QUICK_CHAT.maxLines).toBe(10);
    expect(QUICK_CHAT.maxEmoji).toBe(8);
    const d = defaultChatPicks();
    expect(texts(d.lines)).toEqual(["Good luck!", "Have fun!", "Nice move!", "Wow!", "Oops…", "Trust the crowd", "Defend the king!", "Go for mate!", "GG", "Thanks!"]);
    expect(d.lines).toEqual(QUICK_CHAT.defaultLines);
    // The free emoji, all of them: nobody's emoji row changes.
    expect(texts(d.emoji).join(" ")).toBe("👍 👏 😂 😮 😬 🔥 💀 🎉");
    expect(d.emoji).toEqual(CHAT_PACKS.find((p) => p.id === "emoji-basics")!.lines.map((l) => l.id));
    // Free lines only, so they work for a new player; some go to everyone, some stay in the team.
    for (const id of [...d.lines, ...d.emoji]) expect(free).toContain(chatSay(id)!.pack);
    expect(d.lines.some(canSayToAll)).toBe(true);
    expect(d.lines.some((id) => !canSayToAll(id))).toBe(true);
    // Nothing stored (a new player, or one from before picks): the defaults.
    expect(chatPicks(null, [])).toEqual(d);
    expect(chatPicks(undefined, ["chat-godking"])).toEqual(d);
    expect(chatPicks({ lines: null, emoji: null }, [])).toEqual(d);
  });

  it("each kind is the player's own once chosen (even none); the other kind keeps the defaults", () => {
    const p = chatPicks({ lines: ["gg", "push-pawns"] }, []);
    expect(p.lines).toEqual(["gg", "push-pawns"]);
    expect(p.emoji).toEqual(defaultChatPicks().emoji);
    expect(chatPicks({ lines: [], emoji: ["e-fire"] }, [])).toEqual({ lines: [], emoji: ["e-fire"] });
  });

  it("cleaning keeps the player's order and drops unknown ids, the other kind, repeats and packs they don't own; at most the cap", () => {
    expect(cleanChatPickList(["rematch", "you stink", "e-fire", "gg", "rematch", 42, "gk-crown", "wow"], "lines", free)).toEqual(["rematch", "gg", "wow"]);
    expect(cleanChatPickList(["gk-crown", "gg"], "lines", [...free, "godking"])).toEqual(["gk-crown", "gg"]);
    expect(cleanChatPickList(["e-dragon", "gg", "e-fire"], "emoji", free)).toEqual(["e-fire"]);
    expect(cleanChatPickList("gg", "lines", free)).toEqual([]);
    const sixteen = chatButtons([]).groups.flatMap((g) => g.lines.map((l) => l.id)).reverse();
    expect(cleanChatPickList(sixteen, "lines", free)).toEqual(sixteen.slice(0, QUICK_CHAT.maxLines));
    const emoji = CHAT_PACKS.filter((x) => x.kind === "emoji").flatMap((x) => x.lines.map((l) => l.id));
    expect(cleanChatPickList(emoji, "emoji", all)).toHaveLength(QUICK_CHAT.maxEmoji);
    // A stored pick from a pack no longer owned (it can't happen today) just doesn't show.
    expect(chatPicksOf({ lines: ["gk-crown", "gg"] }, free).lines).toEqual(["gg"]);
  });

  it("toggling: a new pick goes at the end; at the cap, or from a pack you don't own, it's refused; a pick comes out", () => {
    let p: ChatPicks = { lines: ["gg", "wow"], emoji: ["e-fire"] };
    let r = toggleChatPick(p, "push-pawns", free);
    expect(r).toEqual({ ok: true, picks: { lines: ["gg", "wow", "push-pawns"], emoji: ["e-fire"] } });
    p = r.picks;
    r = toggleChatPick(p, "wow", free);
    expect(r.ok && r.picks.lines).toEqual(["gg", "push-pawns"]);
    expect(toggleChatPick(p, "gk-crown", free)).toMatchObject({ ok: false, reason: "locked" });
    expect(toggleChatPick(p, "nope", free)).toMatchObject({ ok: false, reason: "unknown" });
    expect(toggleChatPick(p, "e-clap", free).picks.emoji).toEqual(["e-fire", "e-clap"]);
    // At the cap: refused, nothing changes; taking one out makes room.
    const d = defaultChatPicks();
    expect(toggleChatPick(d, "rematch", free)).toEqual({ ok: false, reason: "full", picks: d });
    expect(toggleChatPick(d, "e-fire", free).picks.emoji).not.toContain("e-fire");
    // `on` forces a side: already in stays in.
    expect(toggleChatPick(d, "gg", free, true)).toEqual({ ok: true, picks: d });
  });

  it("getting a pack: its lines fill the empty slots in its order, up to the cap; full picks don't change", () => {
    const some: ChatPicks = { lines: ["gg", "wow", "oops", "thanks", "so-close", "hi-all", "lets-go", "rematch"], emoji: ["e-fire"] };
    const got = chatPicksAfterGetting(some, "godking");
    expect(texts(got.added)).toEqual(["For the crown!", "Not while I stand!"]);
    expect(got.picks.lines).toEqual([...some.lines, "gk-crown", "gk-stand"]);
    expect(got.picks.emoji).toEqual(some.emoji);
    // An emoji pack fills the emoji.
    const e = chatPicksAfterGetting(some, "emoji-royal");
    expect(texts(e.added).join(" ")).toBe("🤴 👸 💎 🏆 ⚜️ 🐉");
    expect(e.picks.lines).toEqual(some.lines);
    // The defaults are full: nothing changes (the shop says "Pick these in your profile").
    expect(chatPicksAfterGetting(defaultChatPicks(), "winter")).toEqual({ picks: defaultChatPicks(), added: [] });
    expect(chatPicksAfterGetting(defaultChatPicks(), "emoji-chess").added).toEqual([]);
    // Lines already picked aren't added twice; an unknown pack changes nothing.
    expect(chatPicksAfterGetting({ lines: ["gk-crown"], emoji: [] }, "godking").added).toEqual(["gk-stand", "gk-call", "gk-long-live"]);
    expect(chatPicksAfterGetting(some, "nope")).toEqual({ picks: some, added: [] });
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
