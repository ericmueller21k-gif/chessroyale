import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOWN_CHAT } from "@chessroyale/core";

/**
 * The town square's chat, the app's side of the server (town/chat-net.ts; docs/decisions/2026-10-28-town-chat-typing.md):
 * only a signed-in player on a device not marked too young asks for players' lines (riding on the live poll), muted and
 * blocked players' lines never reach the log, a moderator's removal and the switch reach it, and sending mirrors the
 * server's numbers and shows its reasons.
 */

const who = vi.hoisted(() => ({ signedIn: true, young: false, reports: [] as unknown[][], accountHeard: [] as (() => void)[], friendsHeard: new Set<() => void>(), blocked: new Set<string>() }));
const live = vi.hoisted(() => ({ rider: null as null | { query(): string; take(b: unknown): void }, watching: 0 }));

vi.mock("../src/account.ts", async (orig) => ({
  ...(await orig<typeof import("../src/account.ts")>()),
  account: () => ({ profile: { user: { id: "me", name: "Me", signedIn: who.signedIn } } }),
  tooYoung: () => who.young,
  onAccountChange: (fn: () => void) => {
    who.accountHeard.push(fn);
    return () => void (who.accountHeard = who.accountHeard.filter((f) => f !== fn));
  },
  reportPlayer: async (...args: unknown[]) => {
    who.reports.push(args);
    return "Thanks, we'll look into it.";
  },
}));
vi.mock("../src/friends.ts", () => ({
  isBlocked: (uid: string | null | undefined) => !!uid && who.blocked.has(uid),
  onFriendsChange: (fn: () => void) => {
    who.friendsHeard.add(fn);
    return () => void who.friendsHeard.delete(fn);
  },
}));
vi.mock("../src/live.ts", async (orig) => ({
  ...(await orig<typeof import("../src/live.ts")>()),
  rideLive: (r: { query(): string; take(b: unknown): void }) => {
    live.rider = r;
    return () => void (live.rider = null);
  },
  watchLive: () => {
    live.watching++;
    return () => void live.watching--;
  },
}));

import type { TownLine } from "../src/town/chat-net.ts";
const { openTownFeed, takeTownSlice, sendTownChat, townSendWaitMs, townChatOff, reportTownLine, removeTownLine, townChars, cutTownText } = await import("../src/town/chat-net.ts");
const { mutes, setChatBlock } = await import("../src/chat-mod.ts");

const T0 = 1_800_000_000_000;
const line = (n: number, from = `p${n}`, text = `hello ${n}`): TownLine => ({ n, at: T0 + n, from, name: from.toUpperCase(), text });
const answer = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

/** A log standing in for the town's: the lines shown, and the pause. */
function log() {
  const lines: TownLine[] = [];
  const state = { paused: false };
  const sink = {
    line: (l: TownLine) => void lines.push(l),
    drop: (test: (l: { n: number; from: string }) => boolean) => {
      for (let i = lines.length - 1; i >= 0; i--) if (test(lines[i]!)) lines.splice(i, 1);
    },
    paused: (on: boolean) => void (state.paused = on),
  };
  return { lines, state, sink };
}

describe("town chat in the app", () => {
  let close: () => void = () => undefined;
  beforeEach(() => {
    who.signedIn = true;
    who.young = false;
    who.reports = [];
    who.blocked.clear();
    mutes.clear();
    setChatBlock(null);
  });
  afterEach(() => {
    close();
    vi.useRealTimers();
  });

  it("a guest, or a device marked too young, never asks for players' lines", () => {
    who.signedIn = false;
    close = openTownFeed(log().sink);
    expect(live.rider).toBeNull();
    expect(live.watching).toBe(0);
    expect(townChatOff()).toBe("Sign in to chat with other players.");
    who.signedIn = true;
    who.young = true;
    close = openTownFeed(log().sink);
    expect(live.rider).toBeNull();
    expect(townChatOff()).toBe("Chat with other players is for accounts 13 and older.");
  });

  it("a signed-in player's lines ride on the live poll every few seconds, only what's new, until the town closes", () => {
    const { lines, sink } = log();
    close = openTownFeed(sink);
    expect(live.watching).toBe(1);
    expect(live.rider!.query()).toBe("town=0");
    live.rider!.take({ town: { n: 2, lines: [line(1), line(2)] } });
    expect(lines.map((l) => l.n)).toEqual([1, 2]);
    expect(live.rider!.query()).toBe("town=2");
    live.rider!.take({ town: { n: 3, lines: [line(2), line(3), { n: 4, junk: true }] } });
    expect(lines.map((l) => l.n)).toEqual([1, 2, 3]);
    // No `town` in the answer (signed out elsewhere, say): nothing changes.
    live.rider!.take({ online: 3 });
    expect(lines).toHaveLength(3);
    // The room restarted: its count went back, and its lines are taken afresh.
    live.rider!.take({ town: { n: 1, reset: true, lines: [line(1, "q", "after a restart")] } });
    expect(lines.at(-1)!.text).toBe("after a restart");
    close();
    expect(live.rider).toBeNull();
    expect(live.watching).toBe(0);
  });

  it("muted and blocked players' lines never reach the log; muting someone takes theirs out", () => {
    const { lines, sink } = log();
    close = openTownFeed(sink);
    mutes.set("troll", true);
    takeTownSlice({ n: 3, lines: [line(1, "ann"), line(2, "troll"), line(3, "bo")] });
    expect(lines.map((l) => l.from)).toEqual(["ann", "bo"]);
    mutes.set("bo", true);
    expect(lines.map((l) => l.from)).toEqual(["ann"]);
  });

  it("a line a moderator removed leaves the log; the switch says it's paused, and then that it's back", () => {
    const { lines, state, sink } = log();
    close = openTownFeed(sink);
    takeTownSlice({ n: 2, lines: [line(1), line(2)] });
    takeTownSlice({ n: 2, lines: [], gone: [1] });
    expect(lines.map((l) => l.n)).toEqual([2]);
    takeTownSlice({ paused: true });
    expect(state.paused).toBe(true);
    expect(townChatOff()).toBe("Chat is paused.");
    takeTownSlice({ n: 2, lines: [] });
    expect(state.paused).toBe(false);
    expect(townChatOff()).toBeNull();
  });

  it("sending: mirrors 80 characters and the 15 s wait, shows the server's reasons, and your line comes back into the log", async () => {
    vi.useFakeTimers({ now: T0 });
    const { lines, sink } = log();
    close = openTownFeed(sink);
    expect(await sendTownChat("   ")).toEqual({ ok: false, reason: "empty", waitMs: 0 });
    expect(await sendTownChat("x".repeat(TOWN_CHAT.maxChars + 1))).toMatchObject({ ok: false, reason: "refused", message: "Messages are at most 80 characters." });
    const mine = line(1, "me", "hello town");
    expect(await sendTownChat("  hello   town ", answer(200, { ok: true, line: mine, town: { n: 1, lines: [mine] }, waitMs: 15_000 }))).toEqual({ ok: true });
    expect(lines).toEqual([mine]);
    expect(townSendWaitMs()).toBe(15_000);
    expect(await sendTownChat("again")).toEqual({ ok: false, reason: "wait", waitMs: 15_000 });
    vi.setSystemTime(T0 + 15_000);
    // The server's reasons, as it gives them.
    expect(await sendTownChat("bad", answer(400, { ok: false, reason: "text", message: "That message isn't allowed." }))).toMatchObject({ reason: "refused", message: "That message isn't allowed." });
    expect(await sendTownChat("hello town", answer(429, { ok: false, reason: "repeat", message: "You said that a moment ago.", retryMs: 40_000 }))).toMatchObject({
      reason: "refused",
      message: "You said that a moment ago.",
    });
    expect(townSendWaitMs()).toBe(0);
    expect(await sendTownChat("hi", answer(429, { ok: false, reason: "rate", message: "One message every 15 s.", retryMs: 9_000 }))).toEqual({ ok: false, reason: "wait", waitMs: 9_000 });
    vi.setSystemTime(T0 + 30_000);
    expect(await sendTownChat("hi", answer(403, { message: "Your chat is off: a moderator's decision.", block: { until: null } }))).toMatchObject({ reason: "refused", message: "Your chat is off: a moderator's decision." });
    expect(townChatOff()).toBe("Your chat is off: a moderator's decision.");
    setChatBlock(null);
    expect(await sendTownChat("hi", answer(503, { message: "Chat is paused.", paused: "town-chat" }))).toMatchObject({ reason: "refused", message: "Chat is paused." });
    expect(townChatOff()).toBe("Chat is paused.");
  });

  it("Report sends fair play's report with the line's number; a moderator's Remove takes it out of the log at once", async () => {
    const { lines, sink } = log();
    close = openTownFeed(sink);
    takeTownSlice({ n: 2, lines: [line(1, "troll"), line(2, "ann")] });
    expect(await reportTownLine(lines[0]!)).toBe("Thanks, we'll look into it.");
    expect(who.reports).toEqual([["troll", "Offensive chat", undefined, 1]]);
    expect(await removeTownLine(1, answer(200, { ok: true }))).toBe("Removed for everyone.");
    expect(lines.map((l) => l.n)).toEqual([2]);
    expect(await removeTownLine(2, answer(403, { message: "Only a moderator can do that." }))).toBe("Only a moderator can do that.");
  });
});

describe("town chat in the app, after the review", () => {
  let close: () => void = () => undefined;
  beforeEach(() => {
    who.signedIn = true;
    who.young = false;
    who.blocked.clear();
    mutes.clear();
  });
  afterEach(() => close());

  it("a new room (the server restarted) or a reset: the players' lines shown go before the new ones come (finding 4)", () => {
    const { lines, sink } = log();
    close = openTownFeed(sink);
    takeTownSlice({ room: "r1", n: 2, lines: [line(1, "ann"), line(2, "bo")] });
    expect(live.rider!.query()).toBe("town=2&room=r1");
    // The restarted room's own line 1: never mistaken for the old line 1 (Remove and Report go by number).
    takeTownSlice({ room: "r2", n: 1, lines: [line(1, "cy", "new room")] });
    expect(lines.map((l) => [l.n, l.from])).toEqual([[1, "cy"]]);
    takeTownSlice({ room: "r2", n: 2, reset: true, lines: [line(1, "cy", "new room"), line(2, "di")] });
    expect(lines.map((l) => l.from)).toEqual(["cy", "di"]);
  });

  it("players' lines leave at once when access ends: signed out, a device marked too young, the chat paused, or a block (a nit)", () => {
    const { lines, sink } = log();
    close = openTownFeed(sink);
    const fill = (from: number) => takeTownSlice({ room: "r", n: from + 1, lines: [line(from, "ann"), line(from + 1, "troll")] });
    fill(1);
    who.blocked.add("troll");
    who.friendsHeard.forEach((f) => f());
    expect(lines.map((l) => l.from)).toEqual(["ann"]);
    who.blocked.clear();
    fill(3);
    takeTownSlice({ paused: true });
    expect(lines).toEqual([]);
    takeTownSlice({ room: "r", n: 4, lines: [] });
    fill(5);
    expect(lines).toHaveLength(2);
    who.signedIn = false;
    who.accountHeard.at(-1)!();
    expect(lines).toEqual([]);
    who.signedIn = true;
    fill(7);
    who.young = true;
    who.accountHeard.at(-1)!();
    expect(lines).toEqual([]);
  });

  it("the field's reason for a guest and for a young device (a nit: the field shows to everyone, greyed)", () => {
    who.signedIn = false;
    expect(townChatOff()).toBe("Sign in to chat with other players.");
    who.signedIn = true;
    who.young = true;
    expect(townChatOff()).toBe("Chat with other players is for accounts 13 and older.");
  });
});

describe("town chat in the app: counting as the server does (the re-review's R4)", () => {
  it("an emoji is one, with its skin tone or joined into one; a huge one counts its parts; the field cuts at 80", () => {
    expect(townChars("👍🏽")).toBe(1);
    expect(townChars("👨\u200D👩\u200D👧\u200D👦")).toBe(1);
    expect(townChars(`👍${"🏽".repeat(300)}`)).toBe(301);
    expect(townChars("😀".repeat(80))).toBe(80);
    expect(cutTownText("😀".repeat(85))).toBe("😀".repeat(80));
    expect(cutTownText("x".repeat(90))).toBe("x".repeat(80));
    // (The tones join the "b": one "character" of 101 parts, which doesn't fit.)
    expect(cutTownText(`ab${"🏽".repeat(100)}`)).toBe("a");
  });
});
