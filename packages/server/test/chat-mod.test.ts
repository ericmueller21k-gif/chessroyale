import { describe, expect, it, vi } from "vitest";
import { CHAT_MOD, GLOBAL_CHAT } from "@chessroyale/core";
import type { ChatBlock } from "@chessroyale/chess";
import { createGuest, createSession, ensureSchema, getUser, profile, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import {
  REPORTED,
  chatBlock,
  chatNoticeSeen,
  chatPlayer,
  chatQueue,
  chatStanding,
  decideChat,
  pruneChatMod,
  reportChat,
  type ReportedLine,
} from "../src/chat-mod.ts";
import { globalReportLine, handleChatMod, type ChatModEnv } from "../src/chat-mod-api.ts";
import { handleChatAdmin } from "../src/chat-mod-admin.ts";
import { chatPostResponse, type ChatHub } from "../src/global-chat-api.ts";
import { GlobalChat, type GlobalLine } from "../src/global-chat.ts";
import { forgetSecrets, handleAccountApi } from "../src/api.ts";
import { rot13 } from "../src/text-filter.ts";
import { memoryDb } from "./memory-db.ts";

const DAY = 86_400_000;
const T0 = 1_800_000_000_000;

async function player(sql: Sql, name: string, now = T0): Promise<User> {
  const g = await createGuest(sql, now, name);
  return signInWithIdentity(sql, g.user, "email", `${name.toLowerCase()}@example.com`, {}, now);
}

/** A line as a lobby or the global chat hands it over (target: who said it). */
const said = (target: User, text = "Oops…", at = T0): ReportedLine => ({
  target: target.id,
  name: target.name,
  text,
  saidAt: at,
  context: [
    { at: at - 2000, name: "Ann", text: "Good luck!", mark: "reporter" },
    { at, name: target.name, text, mark: "this" },
  ],
});

async function world() {
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql);
  const [ann, bo, cy, di, troll] = await Promise.all(["Ann", "Bo", "Cy", "Di", "Troll"].map((n) => player(sql, n)));
  return { sql, d1, ann: ann!, bo: bo!, cy: cy!, di: di!, troll: troll! };
}

describe("chat reports", () => {
  it("stores the line, its sender, time and place, the lines around it and the reporter", async () => {
    const { sql, ann, troll } = await world();
    expect(await reportChat(sql, ann, "lobby:ABCDE", said(troll, "Oops…", T0 - 5000), T0)).toEqual({ ok: true });
    const row = await sql.first<Record<string, unknown>>("SELECT * FROM chat_reports");
    expect(row).toMatchObject({ at: T0, reporter: ann.id, target: troll.id, channel: "lobby:ABCDE", said_at: T0 - 5000, name: "Troll", text: "Oops…", status: "open", resolved_at: null });
    expect(JSON.parse(row!.context as string)).toEqual([
      { at: T0 - 7000, name: "Ann", text: "Good luck!", mark: "reporter" },
      { at: T0 - 5000, name: "Troll", text: "Oops…", mark: "this" },
    ]);
  });

  it("one per reporter, player and place a day; your own lines and players who don't exist can't be reported", async () => {
    const { sql, ann, troll } = await world();
    await reportChat(sql, ann, "global", said(troll), T0);
    expect(await reportChat(sql, ann, "global", said(troll, "Wow!"), T0 + 1000)).toEqual({ ok: true, already: true });
    // Another place is another report; the next day too.
    expect(await reportChat(sql, ann, "lobby:ABCDE", said(troll), T0 + 2000)).toEqual({ ok: true });
    expect(await reportChat(sql, ann, "global", said(troll), T0 + CHAT_MOD.dedupeMs + 1)).toEqual({ ok: true });
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM chat_reports"))!.n).toBe(3);
    expect(await reportChat(sql, ann, "global", said(ann), T0)).toMatchObject({ ok: false, status: 400 });
    expect(await reportChat(sql, ann, "global", { ...said(troll), target: "nobody" }, T0)).toMatchObject({ ok: false, status: 404 });
  });

  it("a reporter's day has a limit", async () => {
    const { sql, ann } = await world();
    for (let i = 0; i < CHAT_MOD.reportsPerDay; i++) {
      const p = await player(sql, `P${i}`);
      expect(await reportChat(sql, ann, "global", said(p), T0 + i)).toEqual({ ok: true });
    }
    const one = await player(sql, "OneMore");
    expect(await reportChat(sql, ann, "global", said(one), T0 + 100)).toMatchObject({ ok: false, status: 429 });
    expect(await reportChat(sql, ann, "global", said(one), T0 + DAY + 1)).toEqual({ ok: true });
  });

  it("reports from enough different players pause the chat until a moderator looks; one player reporting again doesn't", async () => {
    const { sql, ann, bo, cy, troll } = await world();
    expect(CHAT_MOD.autoMuteReporters).toBe(3);
    await reportChat(sql, ann, "global", said(troll), T0);
    await reportChat(sql, ann, "lobby:ABCDE", said(troll), T0 + 1);
    await reportChat(sql, ann, "lobby:FGHJK", said(troll), T0 + 2);
    expect(await chatBlock(sql, troll.id, T0 + 3)).toBeNull();
    expect(await reportChat(sql, bo, "global", said(troll), T0 + 3)).toEqual({ ok: true });
    const third = await reportChat(sql, cy, "lobby:ABCDE", said(troll), T0 + 4);
    expect(third).toEqual({ ok: true, block: { until: T0 + 4 + CHAT_MOD.autoMuteMs, auto: true } });
    expect(await chatBlock(sql, troll.id, T0 + 5)).toEqual({ until: T0 + 4 + CHAT_MOD.autoMuteMs, auto: true });
    // At most CHAT_MOD.autoMuteMs if nobody looks.
    expect(await chatBlock(sql, troll.id, T0 + 4 + CHAT_MOD.autoMuteMs)).toBeNull();
    // The players they reported can't be paused this way.
    expect(await chatBlock(sql, ann.id, T0 + 5)).toBeNull();
  });

  it("a dismissal ends the pause and starts the count again; reports older than the window don't count", async () => {
    const { sql, ann, bo, cy, di, troll } = await world();
    for (const [i, p] of [ann, bo, cy].entries()) await reportChat(sql, p, "global", said(troll), T0 + i);
    expect(await chatBlock(sql, troll.id, T0 + 10)).toMatchObject({ auto: true });
    expect(await decideChat(sql, troll.id, { action: "dismiss" }, "admin:eric@example.com", T0 + 20)).toEqual({ ok: true, block: null });
    expect((await sql.all<{ status: string; resolved_by: string }>("SELECT status, resolved_by FROM chat_reports")).every((r) => r.status === "dismissed" && r.resolved_by === "admin:eric@example.com")).toBe(true);
    // One new report: one player, not three.
    await reportChat(sql, di, "global", said(troll), T0 + 30);
    expect(await chatBlock(sql, troll.id, T0 + 40)).toBeNull();
    // Three old ones from the week before don't pause anyone.
    const { sql: sql2, ann: a, bo: b, cy: c, troll: t } = await world();
    await reportChat(sql2, a, "global", said(t), T0);
    await reportChat(sql2, b, "global", said(t), T0 + 1);
    await reportChat(sql2, c, "global", said(t), T0 + CHAT_MOD.autoMuteWindowMs + 2);
    expect(await chatBlock(sql2, t.id, T0 + CHAT_MOD.autoMuteWindowMs + 3)).toBeNull();
  });
});

describe("a moderator's decisions", () => {
  it("a chat ban for some days, or with no end; a lift; a reason is required except to dismiss", async () => {
    const { sql, ann, troll } = await world();
    await reportChat(sql, ann, "global", said(troll), T0);
    expect(await decideChat(sql, troll.id, { action: "ban", days: 7 }, "admin:e", T0)).toMatchObject({ ok: false, status: 400 });
    expect(await decideChat(sql, troll.id, { action: "ban", days: 3, reason: "spam all day" }, "admin:e", T0)).toMatchObject({ ok: false, status: 400 });
    expect(await decideChat(sql, troll.id, { action: "smite", reason: "spam all day" }, "admin:e", T0)).toMatchObject({ ok: false, status: 400 });
    expect(await decideChat(sql, "nobody", { action: "warn", reason: "spam all day" }, "admin:e", T0)).toMatchObject({ ok: false, status: 404 });
    expect(await decideChat(sql, troll.id, { action: "ban", days: "7", reason: "spam all day", note: "Easy on the 💀." }, "admin:e", T0)).toEqual({ ok: true, block: { until: T0 + 7 * DAY } });
    expect(await chatBlock(sql, troll.id, T0 + 7 * DAY - 1)).toEqual({ until: T0 + 7 * DAY });
    expect(await chatBlock(sql, troll.id, T0 + 7 * DAY)).toBeNull();
    expect((await sql.first<{ status: string }>("SELECT status FROM chat_reports"))!.status).toBe("actioned");
    // No end; then lifted.
    expect(await decideChat(sql, troll.id, { action: "ban", days: "forever", reason: "again and again" }, "admin:e", T0 + DAY)).toEqual({ ok: true, block: { until: null } });
    expect(await chatBlock(sql, troll.id, T0 + 1000 * DAY)).toEqual({ until: null });
    expect(await decideChat(sql, troll.id, { action: "lift", reason: "appealed by email" }, "admin:e", T0 + 2 * DAY)).toEqual({ ok: true, block: null });
    expect(await chatBlock(sql, troll.id, T0 + 2 * DAY)).toBeNull();
  });

  it("a ban replaces a pause from reports; a warning ends it", async () => {
    const { sql, ann, bo, cy, troll } = await world();
    for (const [i, p] of [ann, bo, cy].entries()) await reportChat(sql, p, "global", said(troll), T0 + i);
    expect(await decideChat(sql, troll.id, { action: "ban", days: 1, reason: "taunting" }, "admin:e", T0 + 10)).toEqual({ ok: true, block: { until: T0 + 10 + DAY } });
    expect(await chatBlock(sql, troll.id, T0 + 10 + DAY)).toBeNull();
    const w = await world();
    for (const [i, p] of [w.ann, w.bo, w.cy].entries()) await reportChat(w.sql, p, "global", said(w.troll), T0 + i);
    expect(await decideChat(w.sql, w.troll.id, { action: "warn", reason: "a bit much" }, "admin:e", T0 + 10)).toEqual({ ok: true, block: null });
  });

  it("a reset puts the name and icon back to the defaults", async () => {
    const { sql, ann, troll } = await world();
    await sql.run("UPDATE users SET icon = '🔥' WHERE id = ?", troll.id);
    await reportChat(sql, ann, "global", said(troll), T0);
    expect(await decideChat(sql, troll.id, { action: "reset", reason: "rude name" }, "admin:e", T0)).toEqual({ ok: true, block: null });
    expect(await getUser(sql, troll.id)).toMatchObject({ name: "Player", icon: "♟" });
  });

  it("the player sees a warning or a ban once (with the note), and their pause with their profile", async () => {
    const { sql, ann, troll } = await world();
    expect(await chatStanding(sql, troll.id, T0)).toBeNull();
    await decideChat(sql, troll.id, { action: "warn", reason: "spamming", note: "Keep it friendly." }, "admin:e", T0);
    expect(await chatStanding(sql, troll.id, T0)).toEqual({ notice: { id: expect.any(Number), kind: "warn", at: T0, until: null, note: "Keep it friendly." } });
    await chatNoticeSeen(sql, troll.id);
    expect(await chatStanding(sql, troll.id, T0)).toBeNull();
    await reportChat(sql, ann, "global", said(troll), T0 + 1);
    await decideChat(sql, troll.id, { action: "ban", days: 1, reason: "spam again" }, "admin:e", T0 + 2);
    const p = await profile(sql, (await getUser(sql, troll.id))!);
    expect(p.chatMod).toEqual({ block: { until: T0 + 2 + DAY }, notice: { id: expect.any(Number), kind: "ban", at: T0 + 2, until: T0 + 2 + DAY, note: null } });
    // A ban that ended before they saw it isn't news any more.
    expect(await chatStanding(sql, troll.id, T0 + 3 + DAY)).toBeNull();
  });
});

describe("keeping only what's needed", () => {
  it("resolved reports go after CHAT_MOD.keepResolvedDays, decisions CHAT_MOD.keepDecisionsDays after they ended; open reports and bans with no end stay", async () => {
    const { sql, ann, bo, troll } = await world();
    await reportChat(sql, ann, "global", said(troll), T0);
    await decideChat(sql, troll.id, { action: "warn", reason: "spamming" }, "admin:e", T0);
    await reportChat(sql, bo, "global", said(troll), T0 + 1);
    await decideChat(sql, bo.id, { action: "ban", days: "forever", reason: "slurs in chat" }, "admin:e", T0);
    const counts = async () => ({
      reports: (await sql.all<{ status: string }>("SELECT status FROM chat_reports ORDER BY id")).map((r) => r.status),
      log: (await sql.all<{ action: string }>("SELECT action FROM chat_mod_log ORDER BY id")).map((r) => r.action),
    });
    await pruneChatMod(sql, T0 + CHAT_MOD.keepResolvedDays * DAY - 1, true);
    expect(await counts()).toEqual({ reports: ["actioned", "open"], log: ["warn", "ban"] });
    await pruneChatMod(sql, T0 + CHAT_MOD.keepResolvedDays * DAY + 1, true);
    expect(await counts()).toEqual({ reports: ["open"], log: ["warn", "ban"] });
    await pruneChatMod(sql, T0 + CHAT_MOD.keepDecisionsDays * DAY + 1, true);
    expect(await counts()).toEqual({ reports: ["open"], log: ["ban"] });
  });
});

describe("the global chat", () => {
  const line = (n: number, patch: Partial<GlobalLine> = {}): GlobalLine => ({ n, at: T0 + n * 1000, from: `u${n}`, name: `P${n}`, rating: null, say: "gg", ...patch });

  it("a report takes the line and the lines around it from the hub's own copy; never a bot's or your own", () => {
    const lines = Array.from({ length: 12 }, (_, i) => line(i + 1, i === 8 ? { from: "troll", name: "Troll", say: "e-skull" } : i === 3 ? { bot: true, from: "Botty", name: "Botty" } : i === 6 ? { from: "me" } : {}));
    const r = globalReportLine({ n: 12, lines }, "me", 9);
    expect("line" in r && r.line).toMatchObject({ target: "troll", name: "Troll", text: "💀", saidAt: T0 + 9000 });
    const ctx = "line" in r ? r.line.context : [];
    expect(ctx.map((c) => c.at)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => T0 + n * 1000));
    expect(ctx.find((c) => c.mark === "this")).toMatchObject({ name: "Troll", text: "💀" });
    expect(ctx.filter((c) => c.mark === "bot").map((c) => c.name)).toEqual(["Botty"]);
    expect(ctx.filter((c) => c.mark === "reporter")).toHaveLength(1);
    expect(globalReportLine({ n: 12, lines }, "me", 4)).toEqual({ error: "bot" });
    expect(globalReportLine({ n: 12, lines }, "me", 7)).toEqual({ error: "self" });
    expect(globalReportLine({ n: 12, lines }, "me", 99)).toEqual({ error: "gone" });
  });

  it("a paused player can't post (they still read), and a name the filter refuses goes out as Player", async () => {
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
    expect(await res.json()).toMatchObject({ block: { until: expect.any(Number) } });
    expect(chat.snapshot(Date.now()).lines).toEqual([]);
    const old = await player(sql, "Oldname");
    await sql.run("UPDATE users SET name = ? WHERE id = ?", `x${rot13("avttre")}`, old.id);
    expect((await post(old)).status).toBe(200);
    expect(chat.snapshot(Date.now()).lines.map((l) => l.name)).toEqual(["Player"]);
  });
});

/** A Worker environment over an in-memory database, with lobbies that answer from a table. */
function env(d1: D1Database, patch: Partial<ChatModEnv> = {}) {
  const lobbies = new Map<string, { line?: ReportedLine; error?: string; changed: [string, ChatBlock | null][] }>();
  const e: ChatModEnv = {
    DB: d1,
    LOBBIES: {
      idFromName: (name: string) => name as unknown as DurableObjectId,
      get: (id: DurableObjectId) => {
        const l = lobbies.get(id as unknown as string) ?? { error: "gone", changed: [] };
        lobbies.set(id as unknown as string, l);
        return {
          chatReportLine: async () => (l.line ? { line: l.line } : { error: l.error ?? "gone" }),
          chatStandingChanged: async (uid: string, block: ChatBlock | null) => void l.changed.push([uid, block]),
        };
      },
    },
    ...patch,
  };
  return { e, lobbies };
}

async function session(sql: Sql, u: User) {
  return `hc_session=${await createSession(sql, u.id, Date.now())}`;
}

describe("the routes", () => {
  it("POST /api/chat/report: a lobby's line, the confirmation, the same report again; a pause from it reaches the lobby at once", async () => {
    const { sql, d1, ann, bo, cy, troll } = await world();
    const { e, lobbies } = env(d1);
    lobbies.set("ABCDE", { line: said(troll), changed: [] });
    const ask = async (u: User, body: unknown) => {
      const res = await handleChatMod(new Request("https://x/api/chat/report", { method: "POST", headers: { cookie: await session(sql, u) }, body: JSON.stringify(body) }), e);
      return { status: res!.status, body: (await res!.json()) as { message: string; already?: boolean } };
    };
    expect(await ask(ann, { n: 3, lobby: "abcde" })).toEqual({ status: 200, body: { ok: true, message: REPORTED } });
    expect(await ask(ann, { n: 4, lobby: "ABCDE" })).toEqual({ status: 200, body: { ok: true, already: true, message: "You've already reported this player here." } });
    expect((await ask(ann, { n: 3, lobby: "ZZZZZ" })).status).toBe(404);
    expect((await ask(ann, { n: "x", lobby: "ABCDE" })).status).toBe(400);
    expect((await ask(ann, { n: 3, lobby: "nope!" })).status).toBe(400);
    await ask(bo, { n: 3, lobby: "ABCDE" });
    expect(lobbies.get("ABCDE")!.changed).toEqual([]);
    await ask(cy, { n: 3, lobby: "ABCDE" });
    expect(lobbies.get("ABCDE")!.changed).toEqual([[troll.id, { until: expect.any(Number), auto: true }]]);
    // No account here: nothing.
    const none = await handleChatMod(new Request("https://x/api/chat/report", { method: "POST", body: "{}" }), e);
    expect(none!.status).toBe(401);
    // Other paths aren't these routes.
    expect(await handleChatMod(new Request("https://x/api/chat"), e)).toBeNull();
  });

  it("guests can't report once sign-in is set up", async () => {
    const { sql, d1 } = await world();
    const { e } = env(d1, { RESEND_API_KEY: "key" });
    const g = await createGuest(sql, Date.now(), "Guest");
    const res = await handleChatMod(new Request("https://x/api/chat/report", { method: "POST", headers: { cookie: `hc_session=${g.token}` }, body: JSON.stringify({ n: 1, lobby: "ABCDE" }) }), e);
    expect(res!.status).toBe(401);
    expect(await res!.json()).toEqual({ message: "Sign in to report." });
  });

  it("PATCH /api/me refuses a name the filter refuses", async () => {
    forgetSecrets();
    const { sql, d1, ann } = await world();
    const patch = async (name: string) =>
      handleAccountApi(new Request("https://x/api/me", { method: "PATCH", headers: { cookie: await session(sql, ann) }, body: JSON.stringify({ name }) }), { DB: d1 });
    const bad = await patch(`The ${rot13("avttre").replace("i", "1")}`);
    expect(bad!.status).toBe(400);
    expect(await bad!.json()).toEqual({ message: "That name isn't allowed. Pick another one." });
    expect((await getUser(sql, ann.id))!.name).toBe("Ann");
    expect((await patch("Annie"))!.status).toBe(200);
    expect((await getUser(sql, ann.id))!.name).toBe("Annie");
  });
});

describe("the review page", () => {
  it("admins only: anyone else, test switches or not, gets Not found", async () => {
    forgetSecrets();
    const { sql, d1, ann, bo } = await world();
    const page = async (patch: Partial<ChatModEnv>, cookie?: string) => (await handleChatAdmin(new Request("https://x/admin/chat", { headers: cookie ? { cookie } : {} }), env(d1, patch).e))!;
    const notFound = await page({});
    expect(notFound.status).toBe(404);
    expect(await notFound.text()).toBe("Not found");
    expect((await page({ ADMIN_EMAILS: "ann@example.com" }, await session(sql, ann))).status).toBe(200);
    expect((await page({ ADMIN_EMAILS: "ann@example.com", TEST_SWITCHES: "1" }, await session(sql, bo))).status).toBe(404);
    expect(await handleChatAdmin(new Request("https://x/admin/fairplay"), env(d1).e)).toBeNull();
  });

  it("lists players by reports, shows the lines around each, and a decision (from the page only) reaches the lobby", async () => {
    vi.useFakeTimers({ now: T0 });
    try {
      const { sql, d1, ann, bo, troll, di } = await world();
      await reportChat(sql, ann, "lobby:ABCDE", said(troll, "Oops…"), T0);
      await reportChat(sql, bo, "global", said(troll, "💀"), T0 + 1);
      await reportChat(sql, ann, "global", said(di, "GG"), T0 + 2);
      expect((await chatQueue(sql, T0)).map((q) => [q.name, q.open, q.reporters])).toEqual([
        ["Troll", 2, 2],
        ["Di", 1, 1],
      ]);
      const { e, lobbies } = env(d1, { ADMIN_EMAILS: "eric@example.com" });
      const eric = await player(sql, "Eric");
      const cookie = await session(sql, eric);
      const list = await (await handleChatAdmin(new Request("https://x/admin/chat", { headers: { cookie } }), e))!.text();
      expect(list).toContain("Chat reports");
      expect(list).toMatch(/Troll<\/a><\/td><td>2<\/td><td>2<\/td>/);
      const detail = await (await handleChatAdmin(new Request(`https://x/admin/chat/player/${troll.id}`, { headers: { cookie } }), e))!.text();
      expect(detail).toContain("Lobby ABCDE");
      expect(detail).toContain("Global chat");
      expect(detail).toMatch(/class="hard"><td>[^<]*<\/td><td>Troll<\/td><td class="wrap">Oops… <span class="pill">reported<\/span>/);
      expect(detail).toContain('<span class="pill">reporter</span>');
      const form = (fields: Record<string, string>, origin = "https://x") =>
        new Request(`https://x/admin/chat/player/${troll.id}`, { method: "POST", headers: { origin, cookie }, body: new URLSearchParams(fields) });
      expect((await handleChatAdmin(form({ action: "ban:7", reason: "spamming" }, "https://evil"), e))!.status).toBe(403);
      const res = (await handleChatAdmin(form({ action: "ban:7", reason: "spam all match", note: "Easy." }), e))!;
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe(`https://x/admin/chat/player/${troll.id}?note=Done.`);
      expect(await chatBlock(sql, troll.id, T0)).toEqual({ until: T0 + 7 * DAY });
      expect(lobbies.get("ABCDE")!.changed).toEqual([[troll.id, { until: T0 + 7 * DAY }]]);
      expect((await chatPlayer(sql, troll.id, T0))!.log[0]).toMatchObject({ action: "ban", by: "admin:eric@example.com", reason: "spam all match", note: "Easy." });
      // A decision without its reason: the page says so.
      const nope = (await handleChatAdmin(form({ action: "warn" }), e))!;
      expect(decodeURIComponent(nope.headers.get("location")!)).toContain("a written reason is required");
    } finally {
      vi.useRealTimers();
    }
  });
});
