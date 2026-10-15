import { describe, expect, it, vi } from "vitest";
import { FRIENDS, type FriendsState } from "@chessroyale/core";
import type { NetChatLine } from "@chessroyale/chess";
import { loadAccount } from "../src/account.ts";
import { friendsBadge, friendsStatus, hideToast, inviteMode, invitePlayer, inviteToast, isBlocked, joinInvite, loadFriends, openInvites, relationTo, setInviteHost, toastOnScreen } from "../src/friends.ts";
import { GlobalChatStore } from "../src/global-chat.ts";
import { MatchChat } from "../src/chat.ts";

vi.mock("../src/sound.ts", () => ({ play: vi.fn() }));

const NOW = Date.now();
const friend = (id: string, name: string, online = true) => ({ id, name, since: NOW - 1000, online, busy: false, hidden: false });
let friends: FriendsState = {
  friends: [friend("f1", "Fay"), friend("f2", "Gus", false)],
  requests: [{ id: "r1", name: "Rae", at: NOW - 500 }],
  sent: [{ id: "s1", name: "Sol", at: NOW - 400 }],
  invites: [
    { from: "f1", name: "Fay", kind: "crowd", code: "ABCDE", at: NOW - 100, expiresAt: NOW + FRIENDS.inviteMinutes * 60_000 },
    { from: "f2", name: "Gus", kind: "squads", code: "PQRST", at: NOW - 20 * 60_000, expiresAt: NOW - 1 },
  ],
  blocked: [{ id: "x1", name: "Xan" }],
  settings: { invites: "everyone", showOnline: true },
};
const posted: { path: string; body: Record<string, unknown> }[] = [];
/** "invite" answers: refused (they take no invites) or fine. */
let refuseInvites = false;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
  const path = String(url);
  if (init?.method === "POST") posted.push({ path, body: JSON.parse(String(init.body ?? "{}")) });
  if (path === "/api/auth/config") return json({ accounts: true, google: false, email: false });
  if (path.startsWith("/api/me")) return json({ user: { id: "me", name: "Me", icon: "♟", signedIn: false, email: null, google: false }, stats: {}, rating: null, recent: [] });
  if (path === "/api/friends/invite" && refuseInvites) return json({ message: "This player isn't taking invites right now." }, 403);
  return json({ state: friends });
});

describe("friends in the app", () => {
  it("loads with your account: where you stand with each player, the badge, who's blocked, the new invite's toast", async () => {
    await loadAccount();
    await vi.waitFor(() => expect(friendsStatus()).toBe("on"));
    expect(["me", "f1", "r1", "s1", "x1", "zz"].map(relationTo)).toEqual(["self", "friend", "received", "sent", "blocked", "none"]);
    expect([isBlocked("x1"), isBlocked("f1"), isBlocked(undefined)]).toEqual([true, false, false]);
    // One request and one open invite (the other has expired).
    expect(openInvites().map((i) => i.from)).toEqual(["f1"]);
    expect(friendsBadge()).toBe(2);
    expect(inviteToast()?.from).toBe("f1");
    // Shown once: a refresh doesn't bring it back after it's gone; a new invite does.
    hideToast();
    await loadFriends();
    expect(inviteToast()).toBeNull();
    friends = { ...friends, invites: [{ ...friends.invites[0]!, at: NOW }, ...friends.invites] };
    await loadFriends();
    expect(inviteToast()?.at).toBe(NOW);
    // It waits for a page that can show it (in a match or the queue none can): no clock runs until it's on screen...
    vi.useFakeTimers();
    vi.advanceTimersByTime(3 * FRIENDS.toastMs);
    expect(inviteToast()?.at).toBe(NOW);
    // ...then it goes after FRIENDS.toastMs.
    toastOnScreen(inviteToast()!);
    vi.advanceTimersByTime(FRIENDS.toastMs - 1);
    expect(inviteToast()?.at).toBe(NOW);
    vi.advanceTimersByTime(1);
    expect(inviteToast()).toBeNull();
    vi.useRealTimers();
  });

  it("hides a blocked account's lines: the global chat by account, quick chat in a match by the seat's account", () => {
    const g = new GlobalChatStore();
    const at = NOW;
    g.take({ n: 2, lines: [{ n: 1, at, from: "x1", name: "Xan", rating: null, icon: "♟", say: "gg" }, { n: 2, at, from: "f1", name: "Fay", rating: null, icon: "♟", say: "gg" }] });
    expect(g.lines().map((l) => l.from)).toEqual(["f1"]);
    const seats: Record<string, string> = { p2: "x1", p3: "f1" };
    const chat = new MatchChat({ code: () => "ABCDE", me: () => "p1", send: () => undefined, emit: () => undefined, local: (t) => t, teams: () => false, picks: () => null, uidOf: (id) => seats[id] });
    const line = (n: number, from: string): NetChatLine => ({ n, from, say: "gg", to: "all", team: null, at: Date.now() - 10 });
    chat.onLog([line(1, "p2"), line(2, "p3"), line(3, "bot1")], []);
    expect(chat.lines().map((l) => l.from)).toEqual(["p3", "bot1"]);
    expect([chat.hidden("p2"), chat.isMuted("p2")]).toEqual([true, false]);
  });

  it("inviting from the front door asks first, then makes a game and invites into it; joining an invite takes it off the list", async () => {
    const made: string[] = [];
    const joined: string[] = [];
    let target: { kind: "crowd"; code: string } | null = null;
    setInviteHost({
      target: () => target,
      canCreate: () => true,
      create: async () => {
        made.push("lobby");
        target = { kind: "crowd", code: "LOBBY" };
        return target;
      },
      join: (kind, code) => joined.push(`${kind}:${code}`),
    });
    expect(inviteMode()).toBe("new");
    // Refused: no game is made for it.
    refuseInvites = true;
    posted.length = 0;
    await expect(invitePlayer("f2")).rejects.toThrow("isn't taking invites");
    expect(made).toEqual([]);
    expect(posted.map((p) => p.body)).toEqual([{ id: "f2", check: true }]);
    // Fine: ask, make the lobby, invite into it. Then the next invite goes straight into it.
    refuseInvites = false;
    posted.length = 0;
    expect(await invitePlayer("f2")).toEqual({ kind: "crowd", code: "LOBBY" });
    expect(made).toEqual(["lobby"]);
    expect(posted.map((p) => p.body)).toEqual([{ id: "f2", check: true }, { id: "f2", kind: "crowd", code: "LOBBY" }]);
    expect(inviteMode()).toBe("game");
    posted.length = 0;
    await invitePlayer("f1");
    expect(posted.map((p) => p.body)).toEqual([{ id: "f1", kind: "crowd", code: "LOBBY" }]);
    // Join: the host goes there, and the invite is dismissed.
    posted.length = 0;
    joinInvite(friends.invites[0]!);
    expect(joined).toEqual(["crowd:ABCDE"]);
    await vi.waitFor(() => expect(posted).toEqual([{ path: "/api/friends/dismiss", body: { id: "f1" } }]));
    expect(inviteToast()).toBeNull();
  });
});
