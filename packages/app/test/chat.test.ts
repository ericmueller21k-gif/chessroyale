import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUICK_CHAT, defaultChatPicks, mulberry32, type StoredChatPicks } from "@chessroyale/core";
import type { ClientMessage, NetChatLine } from "@chessroyale/chess";
import { MatchChat, SoloLobbyChat } from "../src/chat.ts";
import { chatBlockText, mutes, setChatBlock } from "../src/chat-mod.ts";
import { GlobalChatStore } from "../src/global-chat.ts";
import { play } from "../src/sound.ts";

// (The chat's tick: counted, not played.)
vi.mock("../src/sound.ts", () => ({ play: vi.fn() }));

/** A chat whose match is "p1" on a team, with the server's clock equal to ours. */
function setup(teams = true, picks: StoredChatPicks | null = null) {
  const sent: ClientMessage[] = [];
  let emits = 0;
  const host = { picks };
  const chat = new MatchChat({
    code: () => "ABCDE",
    me: () => "p1",
    send: (m) => sent.push(m),
    emit: () => emits++,
    local: (t) => t,
    teams: () => teams,
    picks: () => host.picks,
  });
  const line = (n: number, from: string, say: string, extra: Partial<NetChatLine> = {}): NetChatLine => ({ n, from, say, to: "team", team: "w", at: Date.now(), ...extra });
  return { chat, sent, line, host, emits: () => emits };
}

describe("quick chat in the app", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => vi.useRealTimers());

  it("opens with the server's log; lines that came with it aren't news", () => {
    const { chat, line } = setup();
    expect(chat.enabled).toBe(false);
    chat.onLog([line(1, "p2", "gg", { icon: "♞" })], ["basics", "emoji-basics", "godking"]);
    expect(chat.enabled).toBe(true);
    expect(chat.packs).toContain("godking");
    expect(chat.icons.get("p2")).toBe("♞");
    expect(chat.unread()).toBe(0);
    chat.onLine(line(2, "p2", "wow"));
    // Duplicates (a rejoin's log after a live line) show once.
    chat.onLine(line(2, "p2", "wow"));
    expect(chat.lines().map((l) => l.say)).toEqual(["gg", "wow"]);
    expect(chat.unread()).toBe(1);
  });

  it("while a panel is on screen nothing is unread and no bubble shows; hidden, the newest shows for a moment", () => {
    const { chat, line } = setup();
    chat.onLog([], ["basics", "emoji-basics"]);
    const panel = {};
    chat.shown(panel, true);
    chat.onLine(line(1, "p2", "nice-move"));
    expect(chat.unread()).toBe(0);
    expect(chat.bubble()).toBeNull();
    chat.shown(panel, false);
    // Seen on screen: it doesn't bubble up again when the panel goes.
    expect(chat.bubble()).toBeNull();
    chat.onLine(line(2, "p3", "wow"));
    expect(chat.bubble()?.say).toBe("wow");
    expect(chat.unread()).toBe(1);
    vi.advanceTimersByTime(QUICK_CHAT.bubbleMs);
    expect(chat.bubble()).toBeNull();
    // Your own lines never bubble or count.
    chat.onLine(line(3, "p1", "gg"));
    expect(chat.bubble()).toBeNull();
    expect(chat.unread()).toBe(1);
  });

  it("a bot's line waits for its moment", () => {
    const { chat, line } = setup();
    chat.onLog([], []);
    chat.onLine(line(1, "bot4", "good-luck", { to: "all", at: Date.now() + 3000 }));
    expect(chat.lines()).toEqual([]);
    vi.advanceTimersByTime(3000);
    expect(chat.lines().map((l) => l.from)).toEqual(["bot4"]);
  });

  it("mirrors the limits: the buttons gray out after a send, the same line for longer; All allows only Hello and Sporting lines and emoji", () => {
    const { chat, sent } = setup();
    chat.onLog([], ["basics", "emoji-basics"]);
    expect(chat.canSay("gk-crown")).toBe(false); // a pack you don't own
    chat.say("push-pawns");
    expect(sent.at(-1)).toEqual({ t: "chat", say: "push-pawns", to: "team" });
    expect(chat.canSay("wow")).toBe(false);
    vi.advanceTimersByTime(QUICK_CHAT.minGapMs);
    expect(chat.canSay("wow")).toBe(true);
    expect(chat.canSay("push-pawns")).toBe(false);
    chat.setTo("all");
    expect(chat.canSay("trust-crowd")).toBe(false);
    chat.say("gg");
    expect(sent.at(-1)).toEqual({ t: "chat", say: "gg", to: "all" });
    // The server said wait: the buttons wait too.
    vi.advanceTimersByTime(QUICK_CHAT.minGapMs);
    chat.onRefused("hi-all", "burst", Date.now() + 20_000);
    expect(chat.canSay("hi-all")).toBe(false);
    vi.advanceTimersByTime(20_000);
    expect(chat.canSay("hi-all")).toBe(true);
  });

  it("without teams there's no All: everything goes to everyone as 'team'", () => {
    const { chat, sent } = setup(false);
    chat.onLog([], ["basics", "emoji-basics"]);
    chat.setTo("all");
    expect(chat.canSay("push-pawns")).toBe(true);
    chat.say("push-pawns");
    expect(sent.at(-1)).toEqual({ t: "chat", say: "push-pawns", to: "team" });
  });

  it("muting hides a player's lines and emoji and tells the server", () => {
    const { chat, sent, line } = setup();
    chat.onLog([], ["basics", "emoji-basics"]);
    chat.onLine(line(1, "p2", "e-fire"));
    expect(chat.floats().get("p2")?.text).toBe("🔥");
    chat.mute("p2", true);
    expect(sent.at(-1)).toEqual({ t: "chatPrefs", muted: ["p2"] });
    expect(chat.lines()).toEqual([]);
    expect(chat.floats().size).toBe(0);
    chat.mute("p1", true); // not yourself
    expect(chat.mutedIds()).toEqual(["p2"]);
    chat.mute("p2", false);
    expect(chat.lines().map((l) => l.say)).toEqual(["e-fire"]);
    // An emoji floats for a moment only.
    vi.advanceTimersByTime(QUICK_CHAT.emojiFloatMs);
    expect(chat.floats().size).toBe(0);
  });

  it("emoji go to everyone with All on; one from the other team floats from the scoreboard's header with their chip", () => {
    const { chat, sent, line } = setup();
    chat.onLog([], ["basics", "emoji-basics"]);
    chat.setTo("all");
    expect(chat.canSay("e-thumbs")).toBe(true);
    chat.say("e-thumbs");
    expect(sent.at(-1)).toEqual({ t: "chat", say: "e-thumbs", to: "all" });
    // A pack's emoji still needs the pack.
    expect(chat.canSay("e-dragon")).toBe(false);
    // Their team's emoji to everyone carries their side (no row of theirs on this scoreboard); a team one doesn't.
    chat.onLine(line(1, "p9", "e-fire", { to: "all", team: "b" }));
    chat.onLine(line(2, "p2", "e-clap"));
    expect(chat.floats().get("p9")).toEqual({ text: "🔥", key: 1, team: "b" });
    expect(chat.floats().get("p2")).toEqual({ text: "👏", key: 2 });
    expect(chat.lines().find((l) => l.from === "p9")).toMatchObject({ to: "all", team: "b" });
  });

  it("the buttons are the profile's picks, in the player's order, among the packs the server knows they own", () => {
    const { chat, host } = setup();
    chat.onLog([], ["basics", "emoji-basics"]);
    // Never chosen: the defaults.
    expect(chat.picked().lines.map((s) => s.id)).toEqual(defaultChatPicks().lines);
    expect(chat.picked().emoji.map((s) => s.id)).toEqual(defaultChatPicks().emoji);
    // Their own, in their order; a pack the server doesn't know they own doesn't show (yet).
    host.picks = { lines: ["rematch", "gk-crown", "push-pawns"], emoji: ["e-skull", "e-dragon"] };
    expect(chat.picked().lines.map((s) => s.text)).toEqual(["Rematch?", "Push the pawns!"]);
    expect(chat.picked().emoji.map((s) => s.text)).toEqual(["💀"]);
    chat.onLog([], ["basics", "emoji-basics", "godking"]);
    expect(chat.picked().lines.map((s) => s.text)).toEqual(["Rematch?", "For the crown!", "Push the pawns!"]);
    // A line that isn't picked can still be said (picks are which buttons show; the server checks ownership).
    expect(chat.canSay("gg")).toBe(true);
  });
});

describe("lobby chat in the app (before the match)", () => {
  /** A device's storage (chat off, mutes). */
  const storage = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), keys: () => [...m.keys()] };
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    vi.mocked(play).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("the buttons wait while the queue connects (the panel shows at once, so nothing jumps), then work", () => {
    const { chat, sent } = setup(false);
    expect(chat.enabled).toBe(false);
    expect(chat.canSay("hi-all")).toBe(false);
    chat.say("hi-all");
    expect(sent).toEqual([]);
    chat.onLog([], ["basics", "emoji-basics"]);
    expect(chat.canSay("hi-all")).toBe(true);
  });

  it("the lobby's lines from others don't tick (they go to everyone there); a team line in the match does", () => {
    const { chat, line } = setup(false);
    chat.onLog([], ["basics", "emoji-basics"]);
    chat.onLine(line(1, "p2", "hi-all", { to: "all", team: null, lobby: true }));
    expect(play).not.toHaveBeenCalled();
    expect(chat.lines().map((l) => [l.say, l.lobby])).toEqual([["hi-all", true]]);
    chat.onLine(line(2, "p2", "push-pawns"));
    expect(play).toHaveBeenCalledWith("chat");
  });

  /** Solo's queue: its own stand-in for the server. */
  function solo(owned: string[] = []) {
    let emits = 0;
    const s = new SoloLobbyChat("you", () => emits++, () => owned, () => null);
    s.open();
    return { s, chat: s.chat, emits: () => emits };
  }

  it("Solo: your line shows at once as a lobby line, with the same limits and ownership as online", () => {
    const { s, chat } = solo();
    expect(chat.enabled).toBe(true);
    expect(chat.hasTeams()).toBe(false);
    chat.say("good-luck");
    expect(chat.lines()).toEqual([expect.objectContaining({ from: "you", say: "good-luck", to: "all", team: null, lobby: true })]);
    // The buttons gray out as online; and the stand-in refuses what a server would (it's sent past the buttons here).
    expect(chat.canSay("wow")).toBe(false);
    const send = (say: unknown) => (s as unknown as { receive(m: ClientMessage): void })["receive"]({ t: "chat", say } as ClientMessage);
    send("wow");
    expect(chat.lines()).toHaveLength(1);
    vi.advanceTimersByTime(QUICK_CHAT.minGapMs);
    send("free text!");
    send("gk-crown");
    send("good-luck");
    expect(chat.lines()).toHaveLength(1);
    send("e-fire");
    expect(chat.lines().map((l) => l.say)).toEqual(["good-luck", "e-fire"]);
    // Owning the pack: its lines go.
    const owner = solo(["chat-godking"]);
    owner.chat.say("gk-crown");
    expect(owner.chat.lines().map((l) => l.say)).toEqual(["gk-crown"]);
  });

  it("Solo: one or two of the seated bots say hello a moment later, then chat closes as the match begins", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { s, chat } = solo();
      const bots = ["b1", "b2", "b3", "b4"];
      s.botsArrived(bots, mulberry32(seed));
      expect(chat.lines()).toEqual([]);
      vi.advanceTimersByTime(QUICK_CHAT.botLobbyDelayMs[1] + QUICK_CHAT.botLobbyGapMs * QUICK_CHAT.botLobbyMax);
      const said = chat.lines();
      expect(said.length).toBeGreaterThanOrEqual(1);
      expect(said.length).toBeLessThanOrEqual(QUICK_CHAT.botLobbyMax);
      for (const l of said) expect(l).toMatchObject({ to: "all", team: null, lobby: true });
      for (const l of said) expect(bots).toContain(l.from);
      // A second batch of arrivals is kept within the per-minute cap.
      s.botsArrived(bots, mulberry32(seed + 100));
      s.botsArrived(bots, mulberry32(seed + 200));
      vi.advanceTimersByTime(5_000);
      expect(chat.lines().length).toBeLessThanOrEqual(QUICK_CHAT.botMaxPerMinute);
      // The match begins: no more chat (solo matches have none); a line still on its way never shows.
      s.botsArrived(["b9"], mulberry32(seed));
      s.close();
      vi.advanceTimersByTime(5_000);
      expect(chat.enabled).toBe(false);
      expect(chat.canSay("hi-all")).toBe(false);
      expect(chat.lines().some((l) => l.from === "b9")).toBe(false);
      expect(chat.floats().size).toBe(0);
    }
  });

  it("Solo: mute and chat off are this device's, as online; a mute isn't kept after the queue", () => {
    const store = storage();
    vi.stubGlobal("localStorage", store);
    const { s, chat } = solo();
    s.botsArrived(["b1"], mulberry32(3));
    vi.advanceTimersByTime(3_000);
    expect(chat.lines().map((l) => l.from)).toEqual(["b1"]);
    chat.mute("b1", true);
    expect(chat.lines()).toEqual([]);
    expect(store.keys().some((k) => k.startsWith("brc.chatMuted"))).toBe(false);
    chat.setOff(true);
    expect(chat.canSay("hi-all")).toBe(false);
    (s as unknown as { receive(m: ClientMessage): void })["receive"]({ t: "chat", say: "hi-all" });
    expect(chat.lines().filter((l) => l.from === "you")).toEqual([]);
    chat.setOff(false);
    chat.say("hi-all");
    expect(chat.lines().map((l) => l.from)).toEqual(["you"]);
  });
});

describe("chat moderation in the app", () => {
  const storage = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), keys: () => [...m.keys()] };
  };
  const PACKS = ["basics", "emoji-basics"];
  let store = storage();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    store = storage();
    vi.stubGlobal("localStorage", store);
    mutes.reload();
    setChatBlock(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** An online match's chat: "p1" is you; `uids` says whose account each seat is (bots have none). */
  function online(code: string, uids: Record<string, string>) {
    const sent: ClientMessage[] = [];
    const chat = new MatchChat({ code: () => code, me: () => "p1", send: (m) => sent.push(m), emit: () => {}, local: (t) => t, teams: () => false, picks: () => null, uidOf: (id) => uids[id] });
    chat.onLog([], PACKS);
    const line = (n: number, from: string, say = "gg"): NetChatLine => ({ n, from, say, to: "all", team: null, at: Date.now() });
    return { chat, sent, line };
  }

  it("a mute is by account, on this device: Bo stays muted in the next match (a new seat) and in the global chat, until unmuted anywhere", () => {
    const a = online("AAAAA", { p1: "u-me", p2: "u-bo" });
    a.chat.onLine(a.line(1, "p2"));
    a.chat.mute("p2", true);
    expect(a.sent.at(-1)).toEqual({ t: "chatPrefs", muted: ["p2"] });
    expect(a.chat.lines()).toEqual([]);
    expect(a.chat.isMuted("p2")).toBe(true);
    // A reload: the device remembers.
    mutes.reload();
    expect(mutes.has("u-bo")).toBe(true);
    // The next match: Bo is p7 now.
    const b = online("BBBBB", { p1: "u-me", p7: "u-bo", p8: "u-cy" });
    b.chat.onLine(b.line(1, "p7", "wow"));
    b.chat.onLine(b.line(2, "p8", "wow"));
    expect(b.chat.lines().map((l) => l.from)).toEqual(["p8"]);
    expect(b.chat.mutedIds()).toEqual(["p7"]);
    // The global chat (by account) too.
    const g = new GlobalChatStore();
    g.take({ n: 1, lines: [{ n: 1, at: Date.now(), from: "u-bo", name: "Bo", rating: null, say: "gg" }] });
    expect(g.lines()).toEqual([]);
    expect(g.mutedCount()).toBe(1);
    // Unmuted in this match: everywhere.
    b.chat.mute("p7", false);
    expect(b.chat.lines().map((l) => l.from)).toEqual(["p7", "p8"]);
    expect(g.lines()).toHaveLength(1);
    expect(store.getItem("brc.muted")).toBeNull();
  });

  it("a bot (no account) is muted for this match only", () => {
    const a = online("AAAAA", { p2: "u-bo" });
    a.chat.onLine(a.line(1, "bot4"));
    a.chat.mute("bot4", true);
    expect(a.chat.lines()).toEqual([]);
    expect(mutes.count).toBe(0);
    expect(JSON.parse(store.getItem("brc.chatMuted.AAAAA")!)).toEqual(["bot4"]);
    const b = online("BBBBB", {});
    b.chat.onLine(b.line(1, "bot4"));
    expect(b.chat.lines()).toHaveLength(1);
  });

  it("reporting: someone else's line, with an account, in an online lobby; the lobby's code goes with it", async () => {
    const a = online("AAAAA", { p1: "u-me", p2: "u-bo" });
    expect(a.chat.canReport("p2")).toBe(true);
    expect(a.chat.canReport("p1")).toBe(false);
    expect(a.chat.canReport("bot4")).toBe(false);
    expect(online("", { p2: "u-bo" }).chat.canReport("p2")).toBe(false);
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true, message: "Reported. Thanks: a moderator will look at it." })));
    vi.stubGlobal("fetch", fetcher);
    expect(await a.chat.report(5)).toBe("Reported. Thanks: a moderator will look at it.");
    expect(fetcher.mock.calls[0]![0]).toBe("/api/chat/report");
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body))).toEqual({ n: 5, lobby: "AAAAA" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "That's a lot of reports today. Try again tomorrow." }), { status: 429 })));
    expect(await a.chat.report(6)).toBe("That's a lot of reports today. Try again tomorrow.");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await a.chat.report(7)).toBe("Couldn't reach the server. Try again in a moment.");
  });

  it("a paused chat: the server says so, the buttons stop and the panel says why, until the pause ends", () => {
    const a = online("AAAAA", { p2: "u-bo" });
    expect(a.chat.canSay("gg")).toBe(true);
    a.chat.onRefused("gg", "mod", 1_060_000, { until: 1_060_000 });
    expect(a.chat.paused()).toEqual({ until: 1_060_000 });
    expect(a.chat.canSay("gg")).toBe(false);
    expect(chatBlockText(a.chat.paused()!)).toMatch(/^Your chat is off until .+: a moderator's decision\.$/);
    vi.advanceTimersByTime(60_000);
    expect(a.chat.paused()).toBeNull();
    expect(a.chat.canSay("gg")).toBe(true);
    a.chat.onRefused("gg", "mod", 1_060_000, { until: null });
    expect(chatBlockText(a.chat.paused()!)).toBe("Your chat is off: a moderator's decision.");
    expect(chatBlockText({ until: 2_000_000, auto: true })).toBe("Your chat is paused while a moderator looks at reports about it.");
  });
});
