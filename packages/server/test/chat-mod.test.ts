import { describe, expect, it, vi } from "vitest";
import { CHAT_MOD, GLOBAL_CHAT } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, getUser, profile, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { chatBlock, chatModDetail, chatNoticeSeen, chatStanding, decideChat, pruneChatMod } from "../src/chat-mod.ts";
import { handleAdmin } from "../src/admin.ts";
import { chatPostResponse, type ChatHub } from "../src/global-chat-api.ts";
import { GlobalChat } from "../src/global-chat.ts";
import { forgetSecrets, handleAccountApi } from "../src/api.ts";
import { rot13 } from "../src/text-filter.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Chat moderation on the server (chat-mod.ts; docs/decisions/2026-10-16-chat-moderation.md): a moderator's decisions
 * (warning, chat ban, lift, reset) from fair play's review page, what the player sees of them, how long they're kept,
 * a ban in the global chat, and the name filter on a profile.
 */
const DAY = 86_400_000;
const T0 = 1_800_000_000_000;

async function player(sql: Sql, name: string, now = T0): Promise<User> {
  const g = await createGuest(sql, now, name);
  return signInWithIdentity(sql, g.user, "email", `${name.toLowerCase()}@example.com`, {}, now);
}

async function world() {
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql);
  return { sql, d1, ann: await player(sql, "Ann"), troll: await player(sql, "Troll") };
}

describe("a moderator's decisions", () => {
  it("a chat ban for some days, or with no end; a lift; every decision needs a written reason", async () => {
    const { sql, troll } = await world();
    expect(await decideChat(sql, troll.id, { action: "ban", days: 7 }, "admin:e", T0)).toMatchObject({ ok: false, status: 400 });
    expect(await decideChat(sql, troll.id, { action: "ban", days: 3, reason: "slurs in his name" }, "admin:e", T0)).toMatchObject({ ok: false, status: 400 });
    expect(await decideChat(sql, troll.id, { action: "smite", reason: "slurs in his name" }, "admin:e", T0)).toMatchObject({ ok: false, status: 400 });
    expect(await decideChat(sql, "nobody", { action: "warn", reason: "slurs in his name" }, "admin:e", T0)).toMatchObject({ ok: false, status: 404 });
    expect(await decideChat(sql, troll.id, { action: "ban", days: "7", reason: "spamming taunts", note: "Easy on the 💀." }, "admin:e", T0)).toEqual({ ok: true, block: { until: T0 + 7 * DAY } });
    expect(await chatBlock(sql, troll.id, T0 + 7 * DAY - 1)).toEqual({ until: T0 + 7 * DAY });
    expect(await chatBlock(sql, troll.id, T0 + 7 * DAY)).toBeNull();
    // A new ban replaces the one in force; then lifted.
    expect(await decideChat(sql, troll.id, { action: "ban", days: "forever", reason: "again and again" }, "admin:e", T0 + DAY)).toEqual({ ok: true, block: { until: null } });
    expect(await chatBlock(sql, troll.id, T0 + 1000 * DAY)).toEqual({ until: null });
    expect(await decideChat(sql, troll.id, { action: "lift", reason: "appealed by email" }, "admin:e", T0 + 2 * DAY)).toEqual({ ok: true, block: null });
    expect(await chatBlock(sql, troll.id, T0 + 2 * DAY)).toBeNull();
    expect((await chatModDetail(sql, troll.id, T0 + 2 * DAY)).log.map((l) => [l.action, l.ended_at])).toEqual([
      ["lift", null],
      ["ban", T0 + 2 * DAY],
      ["ban", T0 + DAY],
    ]);
  });

  it("a reset puts the name and icon back to the defaults", async () => {
    const { sql, troll } = await world();
    await sql.run("UPDATE users SET icon = '🔥' WHERE id = ?", troll.id);
    expect(await decideChat(sql, troll.id, { action: "reset", reason: "rude name" }, "admin:e", T0)).toEqual({ ok: true, block: null });
    expect(await getUser(sql, troll.id)).toMatchObject({ name: "Player", icon: "♟" });
  });

  it("the player sees a warning or a ban once (with the note), and the ban with their profile", async () => {
    const { sql, troll } = await world();
    expect(await chatStanding(sql, troll.id, T0)).toBeNull();
    await decideChat(sql, troll.id, { action: "warn", reason: "spamming", note: "Keep it friendly." }, "admin:e", T0);
    expect(await chatStanding(sql, troll.id, T0)).toEqual({ notice: { id: expect.any(Number), kind: "warn", at: T0, until: null, note: "Keep it friendly." } });
    await chatNoticeSeen(sql, troll.id);
    expect(await chatStanding(sql, troll.id, T0)).toBeNull();
    await decideChat(sql, troll.id, { action: "ban", days: 1, reason: "spamming again" }, "admin:e", T0 + 2);
    const p = await profile(sql, (await getUser(sql, troll.id))!);
    expect(p.chatMod).toEqual({ block: { until: T0 + 2 + DAY }, notice: { id: expect.any(Number), kind: "ban", at: T0 + 2, until: T0 + 2 + DAY, note: null } });
    // A ban that ended before they saw it isn't news any more.
    expect(await chatStanding(sql, troll.id, T0 + 3 + DAY)).toBeNull();
  });

  it("a decision is deleted CHAT_MOD.keepDecisionsDays after it ended; a ban with no end stays", async () => {
    const { sql, ann, troll } = await world();
    await decideChat(sql, troll.id, { action: "warn", reason: "spamming" }, "admin:e", T0);
    await decideChat(sql, ann.id, { action: "ban", days: "forever", reason: "slurs in chat names" }, "admin:e", T0);
    await decideChat(sql, troll.id, { action: "ban", days: 1, reason: "spamming again" }, "admin:e", T0);
    const left = async () => (await sql.all<{ action: string; user_id: string }>("SELECT action, user_id FROM chat_mod_log ORDER BY id")).map((r) => r.action);
    await pruneChatMod(sql, T0 + CHAT_MOD.keepDecisionsDays * DAY - 1);
    expect(await left()).toEqual(["warn", "ban", "ban"]);
    await pruneChatMod(sql, T0 + CHAT_MOD.keepDecisionsDays * DAY + 1);
    expect(await left()).toEqual(["ban", "ban"]);
    await pruneChatMod(sql, T0 + DAY + CHAT_MOD.keepDecisionsDays * DAY + 1);
    expect(await left()).toEqual(["ban"]);
  });
});

describe("the global chat and the profile", () => {
  it("a banned player can't post (they still read), and a name the filter refuses goes out as Player", async () => {
    const { sql, troll } = await world();
    const chat = new GlobalChat({ ...GLOBAL_CHAT, bots: false });
    const hub: ChatHub = {
      chatRead: async () => chat.snapshot(Date.now()),
      chatPost: async (sender, say) => ({ post: chat.post(sender, say, Date.now()), chat: chat.snapshot(Date.now()) }),
      chatIcon: async () => null,
    };
    const post = (u: User) => chatPostResponse(new Request("https://x/api/chat", { method: "POST", body: JSON.stringify({ say: "gg" }) }), sql, hub, u, true, Date.now());
    await decideChat(sql, troll.id, { action: "ban", days: 1, reason: "spamming" }, "admin:e", Date.now());
    const res = await post(troll);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ message: "Your chat is off: a moderator's decision.", block: { until: expect.any(Number) } });
    expect(chat.snapshot(Date.now()).lines).toEqual([]);
    const old = await player(sql, "Oldname");
    await sql.run("UPDATE users SET name = ? WHERE id = ?", `x${rot13("avttre")}`, old.id);
    expect((await post(old)).status).toBe(200);
    expect(chat.snapshot(Date.now()).lines.map((l) => l.name)).toEqual(["Player"]);
  });

  it("PATCH /api/me refuses a name the filter refuses (a long one too, quickly); POST /api/chat/notice marks the notice read", async () => {
    forgetSecrets();
    const { sql, d1, ann } = await world();
    const cookie = `hc_session=${await createSession(sql, ann.id, Date.now())}`;
    const api = (method: string, path: string, body?: unknown) =>
      handleAccountApi(new Request(`https://x${path}`, { method, headers: { cookie }, ...(body ? { body: JSON.stringify(body) } : {}) }), { DB: d1 });
    const bad = await api("PATCH", "/api/me", { name: `The ${rot13("avttre").replace("i", "1")}` });
    expect(bad!.status).toBe(400);
    expect(await bad!.json()).toEqual({ message: "That name isn't allowed. Pick another one." });
    const t = performance.now();
    expect((await api("PATCH", "/api/me", { name: "w".repeat(160_000) }))!.status).toBe(200);
    expect(performance.now() - t).toBeLessThan(500);
    expect((await getUser(sql, ann.id))!.name).toBe("w".repeat(16));
    expect((await api("PATCH", "/api/me", { name: "Annie" }))!.status).toBe(200);
    expect((await getUser(sql, ann.id))!.name).toBe("Annie");
    await decideChat(sql, ann.id, { action: "warn", reason: "spamming" }, "admin:e", Date.now());
    expect(((await (await api("GET", "/api/me"))!.json()) as { chatMod?: unknown }).chatMod).toMatchObject({ notice: { kind: "warn" } });
    expect((await api("POST", "/api/chat/notice"))!.status).toBe(200);
    expect(((await (await api("GET", "/api/me"))!.json()) as { chatMod?: unknown }).chatMod).toBeUndefined();
  });
});

describe("fair play's review page: a player's chat", () => {
  it("admins act on a player's chat from their page (from this page only, with a reason), or find one by id or profile link", async () => {
    vi.useFakeTimers({ now: T0 });
    try {
      forgetSecrets();
      const { sql, d1, troll } = await world();
      const eric = await player(sql, "Eric");
      // The live hub (the global chat): a reset takes the player's lines out of it.
      const forgot: string[] = [];
      const LIVE = { idFromName: (n: string) => n, get: () => ({ forgetAccount: async (id: string) => void forgot.push(id) }) };
      const env = { DB: d1, ADMIN_EMAILS: "eric@example.com", LIVE } as never;
      const cookie = `hc_session=${await createSession(sql, eric.id, T0)}`;
      const get = async (path: string, c = cookie) => (await handleAdmin(new Request(`https://x${path}`, { headers: { cookie: c } }), env))!;
      expect((await get(`/admin/fairplay/case/${troll.id}`, "")).status).toBe(404);
      const page = await (await get(`/admin/fairplay/case/${troll.id}`)).text();
      expect(page).toContain("<h2>Chat</h2>");
      expect(page).toContain(`Chat: <span class="cleared">open</span> · <a href="/profile/${troll.id}">Their profile (name and icon)</a>`);
      const form = (fields: Record<string, string>, origin = "https://x") =>
        handleAdmin(new Request(`https://x/admin/fairplay/case/${troll.id}`, { method: "POST", headers: { origin, cookie }, body: new URLSearchParams(fields) }), env);
      expect((await form({ action: "chat:ban:7", chat_reason: "spamming taunts" }, "https://evil"))!.status).toBe(403);
      const nope = (await form({ action: "chat:warn" }))!;
      expect(decodeURIComponent(nope.headers.get("location")!)).toContain("a written reason is required");
      const res = (await form({ action: "chat:ban:7", chat_reason: "spamming taunts", chat_note: "Easy." }))!;
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe(`https://x/admin/fairplay/case/${troll.id}?note=Done.`);
      expect(await chatBlock(sql, troll.id, T0)).toEqual({ until: T0 + 7 * DAY });
      expect((await chatModDetail(sql, troll.id, T0)).log[0]).toMatchObject({ action: "ban", by: "admin:eric@example.com", reason: "spamming taunts", note: "Easy." });
      // Fair play's own case is untouched: a chat ban isn't a fair-play ban.
      expect(await sql.first("SELECT status FROM fairplay_cases WHERE user_id = ?", troll.id)).toBeNull();
      const after = await (await get(`/admin/fairplay/case/${troll.id}`)).text();
      expect(after).toContain('Chat: <b class="banned">chat ban</b> until');
      expect(after).toMatch(/chat ban until [^<]+<\/td><td>admin:eric@example.com<\/td><td class="wrap">spamming taunts<\/td><td class="wrap">Easy\.<\/td>/);
      expect(forgot).toEqual([]);
      await form({ action: "chat:reset", chat_reason: "rude name" });
      expect(await getUser(sql, troll.id)).toMatchObject({ name: "Player" });
      expect(forgot).toEqual([troll.id]);
      // A guest's decisions merged in (a sign-in) are labeled as such.
      await sql.run("INSERT INTO chat_mod_log (user_id, at, action, by, reason) VALUES (?, ?, 'merged', 'sign-in', 'a guest signed in')", troll.id, T0 + 1);
      expect(await (await get(`/admin/fairplay/case/${troll.id}`)).text()).toContain("<td>a guest&#39;s decisions merged in</td><td>sign-in</td>");
      // Find a player by id, or by their profile's link.
      for (const q of [troll.id, `https://hunchess.com/profile/${troll.id}`, `https://hunchess.com/profile/${troll.id}?tab=stats`]) {
        const found = await get(`/admin/fairplay/find?q=${encodeURIComponent(q)}`);
        expect(found.status).toBe(303);
        expect(found.headers.get("location")).toBe(`https://x/admin/fairplay/case/${troll.id}`);
      }
      expect((await get("/admin/fairplay/find?q=%3Cscript%3E")).status).toBe(404);
    } finally {
      vi.useRealTimers();
    }
  });
});
