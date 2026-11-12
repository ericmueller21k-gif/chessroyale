import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GLOBAL_CHAT } from "@chessroyale/core";
import type { ClientMessage } from "@chessroyale/chess";

/** Typed chat in a match's chat (Nov 7): who types, who reads, the 5 s wait mirrored, the server's reason shown. */
const who = vi.hoisted(() => ({ signedIn: true, young: false, on: true, heard: [] as (() => void)[] }));
vi.mock("../src/sound.ts", () => ({ play: vi.fn() }));
vi.mock("../src/account.ts", async (orig) => ({
  ...(await orig<typeof import("../src/account.ts")>()),
  account: () => ({ profile: { user: { id: "me", name: "Me", signedIn: who.signedIn }, chatOn: who.on } }),
  tooYoung: () => who.young,
}));
vi.mock("../src/chat-on.ts", () => ({
  chatOn: () => who.on,
  onChatOn: (fn: () => void) => {
    who.heard.push(fn);
    return () => void (who.heard = who.heard.filter((f) => f !== fn));
  },
  setChatOn: async () => undefined,
  chatNoticeDue: () => false,
}));

const { MatchChat } = await import("../src/chat.ts");

function setup() {
  const sent: ClientMessage[] = [];
  const chat = new MatchChat({ code: () => "TYPED", me: () => "p1", send: (m) => sent.push(m), emit: () => undefined, local: (t) => t, teams: () => true, picks: () => null });
  chat.onLog([], ["basics", "emoji-basics"]);
  return { chat, sent };
}

describe("typed chat in a match (the app's side)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    Object.assign(who, { signedIn: true, young: false, on: true, heard: [] });
  });
  afterEach(() => vi.useRealTimers());

  it("signed in, chat on, not too young: types to the team (or All), one message every 5 s; tells the server it reads typed lines", () => {
    const { chat, sent } = setup();
    chat.onWelcome();
    expect(sent).toEqual([{ t: "chatPrefs", typed: true }]);
    expect(chat.mayType()).toBe(true);
    expect(chat.type("  gg :crown: ")).toBe(true);
    expect(sent.at(-1)).toEqual({ t: "chat", say: "", text: "gg :crown:", to: "team" });
    expect(chat.type("again")).toBe(false);
    vi.advanceTimersByTime(GLOBAL_CHAT.gapMs);
    chat.setTo("all");
    expect(chat.type("hi all")).toBe(true);
    expect(sent.at(-1)).toMatchObject({ text: "hi all", to: "all" });
    // The server's reason (the filter) shows a moment, then goes.
    chat.onRefused("", "text", Date.now(), undefined, "No links or contact details in chat.");
    expect(chat.note).toBe("No links or contact details in chat.");
    vi.advanceTimersByTime(4_100);
    expect(chat.note).toBeNull();
    // Chat turned off elsewhere: the server is told, and typing stops.
    who.on = false;
    who.heard.forEach((f) => f());
    expect(sent.at(-1)).toEqual({ t: "chatPrefs", typed: false });
    expect(chat.mayType()).toBe(false);
  });

  it("a guest reads (with chat on) but doesn't type; a device too young neither reads nor types (the quick lines stay)", () => {
    who.signedIn = false;
    const g = setup();
    g.chat.onWelcome();
    expect(g.sent).toEqual([{ t: "chatPrefs", typed: true }]);
    expect(g.chat.mayType()).toBe(false);
    expect(g.chat.type("hi")).toBe(false);
    who.signedIn = true;
    who.young = true;
    const y = setup();
    y.chat.onWelcome();
    expect(y.sent).toEqual([]);
    expect(y.chat.mayType()).toBe(false);
    expect(y.chat.canSay("good-luck")).toBe(true);
  });

  it("typed lines show in the feed as typed", () => {
    const { chat } = setup();
    chat.onLine({ n: 1, from: "p2", say: "", text: "nice :knight:", to: "team", team: "w", at: Date.now() });
    expect(chat.lines().map((l) => l.text)).toEqual(["nice :knight:"]);
  });
});
