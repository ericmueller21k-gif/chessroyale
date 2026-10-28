import { afterEach, describe, expect, it, vi } from "vitest";
import { FAIRPLAY, TOWN_CHAT } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { forgetSecrets, handleAccountApi } from "../src/api.ts";
import { handleAdmin } from "../src/admin.ts";
import { CHAT_OFF, decideChat } from "../src/chat-mod.ts";
import { LINE_GONE } from "../src/fairplay.ts";
import { LiveHub } from "../src/live-hub.ts";
import { CHAT_NOT_ALLOWED, CHAT_NO_CONTACT, rot13 } from "../src/text-filter.ts";
import { SIGN_IN_TO_TOWN_CHAT, TOWN_CHAT_AGE, TOWN_CHAT_PAUSED, forgetTownCache } from "../src/town-chat-api.ts";
import { TOWN_EMPTY, TOWN_REPEAT, TOWN_TOO_LONG, TownChat, townSince, townWait, type TownSender } from "../src/town-chat.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * The town square's typed chat on the server (town-chat.ts, town-chat-api.ts, the live hub's room;
 * docs/decisions/2026-10-28-town-chat-typing.md): the limits, the room's keep and expiry, who may read and send, the
 * switch, a chat ban, a moderator taking a line out, and a report carrying the line. The filter's own cases are in
 * text-filter.test.ts. Slurs and swear words are written ROT13, as in the list.
 */
const T0 = 1_800_000_000_000;
const ann: TownSender = { id: "ann", name: "Ann" };
const bo: TownSender = { id: "bo", name: "Bo" };
const slur = rot13("avttre");
const swear = rot13("shpx");

describe("town chat: the room", () => {
  it("a message: tidied, at most 80 characters after trimming (an emoji is one), through the filter", () => {
    const c = new TownChat();
    expect(c.post(ann, "  Good   game,\n\tthanks!  ", T0)).toMatchObject({ ok: true, line: { n: 1, from: "ann", name: "Ann", text: "Good game, thanks!", at: T0 } });
    // Invisible and direction-flipping characters go; a pile of accents on one letter is cut to two.
    expect(c.post(bo, "hi\u200b\u202ethere", T0)).toMatchObject({ ok: true, line: { text: "hithere" } });
    const z = new TownChat();
    expect(z.post(ann, `q${"\u0301".repeat(40)}!`, T0)).toMatchObject({ ok: true, line: { text: `q${"\u0301".repeat(2)}!` } });
    const d = new TownChat();
    expect(d.post(ann, `   ${"a".repeat(TOWN_CHAT.maxChars)}   `, T0)).toMatchObject({ ok: true });
    expect(d.post(bo, "a".repeat(TOWN_CHAT.maxChars + 1), T0)).toEqual({ ok: false, reason: "text", message: TOWN_TOO_LONG });
    expect(d.post(bo, "😀".repeat(TOWN_CHAT.maxChars), T0)).toMatchObject({ ok: true });
    expect(TOWN_TOO_LONG).toBe("Messages are at most 80 characters.");
    for (const empty of ["", "   ", "\u200b", 7, null, undefined, { text: "hi" }]) {
      expect(new TownChat().post(ann, empty, T0)).toEqual({ ok: false, reason: "text", message: TOWN_EMPTY });
    }
  });

  it("the filter: a slur or a swear word refused alike, a link or contact details with their own reason; nothing refused reaches anyone", () => {
    const c = new TownChat();
    expect(c.post(ann, `you ${slur}`, T0)).toEqual({ ok: false, reason: "text", message: "That message isn't allowed." });
    expect(c.post(ann, `${swear.split("").join(" ")} off`, T0)).toEqual({ ok: false, reason: "text", message: CHAT_NOT_ALLOWED });
    expect(c.post(ann, `${swear.replace("u", "ü")}`, T0)).toMatchObject({ message: CHAT_NOT_ALLOWED });
    expect(c.post(ann, "find me at example.com", T0)).toEqual({ ok: false, reason: "text", message: "No links or contact details in chat." });
    expect(c.post(ann, "ann@example.org", T0)).toMatchObject({ message: CHAT_NO_CONTACT });
    expect(c.post(ann, "call 555 123 4567", T0)).toMatchObject({ message: CHAT_NO_CONTACT });
    expect(c.snapshot(T0).lines).toEqual([]);
    // A refused message doesn't start the wait.
    expect(c.post(ann, "gg", T0)).toMatchObject({ ok: true });
  });

  it("one message per account every 15 s; not the same message again within a minute; others aren't held up", () => {
    const c = new TownChat();
    expect(c.post(ann, "gg", T0)).toMatchObject({ ok: true });
    expect(c.post(ann, "rematch?", T0 + 1_000)).toEqual({ ok: false, reason: "rate", message: townWait(TOWN_CHAT.gapMs), retryMs: 14_000 });
    expect(townWait(TOWN_CHAT.gapMs)).toBe("One message every 15 s.");
    expect(c.post(ann, "rematch?", T0 + 14_999)).toMatchObject({ ok: false, reason: "rate", retryMs: 1 });
    expect(c.post(bo, "gg", T0 + 2_000)).toMatchObject({ ok: true });
    expect(c.readyAt("ann", T0 + 5_000)).toBe(T0 + 15_000);
    // The same message (case, spaces and punctuation aside) waits out the minute; a new one goes.
    expect(c.post(ann, "GG!!", T0 + 15_000)).toEqual({ ok: false, reason: "repeat", message: TOWN_REPEAT, retryMs: 45_000 });
    expect(c.post(ann, "rematch?", T0 + 15_000)).toMatchObject({ ok: true });
    expect(c.post(ann, "g g", T0 + 59_999)).toMatchObject({ ok: false, reason: "repeat", retryMs: 1 });
    expect(c.post(ann, "gg", T0 + 60_000)).toMatchObject({ ok: true });
  });

  it("holds each line a minute; a newcomer gets the last 12; readers get only what's new; a restart starts over", () => {
    const c = new TownChat();
    for (let i = 0; i < 20; i++) expect(c.post({ id: `p${i}`, name: `P${i}` }, `hello ${i}`, T0 + i * 1_000)).toMatchObject({ ok: true });
    const snap = c.snapshot(T0 + 20_000);
    expect(snap.lines).toHaveLength(20);
    const newcomer = townSince(snap, 0);
    expect(newcomer.lines.map((l) => l.text)).toEqual(Array.from({ length: TOWN_CHAT.keep }, (_, i) => `hello ${i + 8}`));
    expect(newcomer.n).toBe(20);
    expect(townSince(snap, 18).lines.map((l) => l.n)).toEqual([19, 20]);
    expect(townSince(snap, 20).lines).toEqual([]);
    // The room counted fewer than the reader has: it restarted, so the reader takes what's there afresh.
    expect(townSince(new TownChat().snapshot(T0), 20)).toMatchObject({ n: 0, lines: [], reset: true });
    // A minute after each was said, it's gone.
    expect(c.snapshot(T0 + 60_000).lines.map((l) => l.n)).toEqual(Array.from({ length: 19 }, (_, i) => i + 2));
    expect(c.snapshot(T0 + 78_999).lines.map((l) => l.n)).toEqual([20]);
    expect(c.line(20, T0 + 78_999)).toMatchObject({ text: "hello 19" });
    expect(c.snapshot(T0 + 79_000).lines).toEqual([]);
    expect(c.line(20, T0 + 79_000)).toBeNull();
  });

  it("holds at most TOWN_CHAT.holdMax lines, the oldest going first", () => {
    const c = new TownChat({ ...TOWN_CHAT, holdMax: 5 });
    for (let i = 0; i < 8; i++) c.post({ id: `p${i}`, name: "P" }, `hi ${i}`, T0);
    expect(c.snapshot(T0).lines.map((l) => l.n)).toEqual([4, 5, 6, 7, 8]);
  });

  it("a moderator takes one line out: it leaves the room, and every reader's log is told for a minute", () => {
    const c = new TownChat();
    c.post(ann, "hello", T0);
    c.post(bo, "rude thing", T0 + 1_000);
    expect(c.remove(2, T0 + 2_000)).toBe(true);
    expect(c.remove(2, T0 + 2_000)).toBe(false);
    expect(c.remove(99, T0 + 2_000)).toBe(false);
    const snap = c.snapshot(T0 + 3_000);
    expect(snap.lines.map((l) => l.n)).toEqual([1]);
    expect(townSince(snap, 2)).toEqual({ n: 2, lines: [], gone: [2] });
    expect(c.line(2, T0 + 3_000)).toBeNull();
    expect(c.snapshot(T0 + 62_000).gone).toEqual([]);
  });

  it("a player's lines leave together (a name reset, a deleted account); a reset keeps their wait, a deletion doesn't", () => {
    const c = new TownChat();
    c.post(ann, "one", T0);
    c.post(bo, "two", T0);
    expect(c.dropAccount("ann", T0 + 1_000)).toBe(true);
    expect(c.snapshot(T0 + 1_000)).toMatchObject({ lines: [{ from: "bo" }], gone: [1] });
    expect(c.post(ann, "three", T0 + 2_000)).toMatchObject({ ok: false, reason: "rate" });
    expect(c.dropAccount("bo", T0 + 2_000, true)).toBe(true);
    expect(c.post(bo, "four", T0 + 3_000)).toMatchObject({ ok: true });
  });
});

/** A live hub with in-memory storage (the same storage across "restarts"). */
function hubWith(store = new Map<string, unknown>()) {
  const storage = {
    get: async (k: string) => store.get(k),
    put: async (k: string, v: unknown) => void store.set(k, structuredClone(v)),
    delete: async (k: string | string[]) => {
      for (const x of Array.isArray(k) ? k : [k]) store.delete(x);
    },
    list: async ({ prefix }: { prefix: string }) => new Map([...store].filter(([k]) => k.startsWith(prefix))),
    getAlarm: async () => null,
    setAlarm: async () => undefined,
  };
  let ready: Promise<unknown> = Promise.resolve();
  const ctx = { storage, blockConcurrencyWhile: (fn: () => Promise<unknown>) => (ready = fn()) };
  const hub = new LiveHub(ctx as unknown as DurableObjectState, {} as never);
  return { hub, store, ready: () => ready };
}

describe("town chat: the live hub holds it in memory only", () => {
  afterEach(() => vi.useRealTimers());

  it("relays lines to readers, never writes them to storage, and forgets them on a restart", async () => {
    vi.useFakeTimers({ now: T0 });
    const { hub, store, ready } = hubWith();
    await ready();
    expect((await hub.townPost(ann, "hello town")).post).toMatchObject({ ok: true, line: { n: 1, text: "hello town" } });
    vi.setSystemTime(T0 + 1_000);
    expect((await hub.townPost(bo, "hi Ann")).town.lines.map((l) => l.text)).toEqual(["hello town", "hi Ann"]);
    expect((await hub.townRead()).lines).toHaveLength(2);
    expect(store.size).toBe(0);
    const again = hubWith(store);
    await again.ready();
    expect((await again.hub.townRead()).lines).toEqual([]);
    vi.setSystemTime(T0 + TOWN_CHAT.lineMs + 1_000);
    expect((await hub.townRead()).lines).toEqual([]);
  });

  it("a deleted account's lines and a reset player's lines leave the town too", async () => {
    vi.useFakeTimers({ now: T0 });
    const { hub, ready } = hubWith();
    await ready();
    await hub.townPost(ann, "one");
    await hub.townPost(bo, "two");
    await hub.dropChatLines(ann.id);
    expect((await hub.townRead()).lines.map((l) => l.from)).toEqual([bo.id]);
    await hub.forgetAccount(bo.id);
    expect((await hub.townRead())).toMatchObject({ lines: [], gone: [1, 2] });
  });
});

async function player(sql: Sql, name: string, now = Date.now()): Promise<User> {
  const g = await createGuest(sql, now, name);
  return signInWithIdentity(sql, g.user, "email", `${name.toLowerCase()}@example.com`, {}, now);
}

describe("town chat: the API", () => {
  afterEach(() => {
    forgetTownCache();
    forgetSecrets();
    vi.useRealTimers();
  });

  async function setup(vars: Record<string, string> = {}) {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql);
    const { hub, ready } = hubWith();
    await ready();
    const env = { DB: d1, LIVE: { idFromName: () => "global", get: () => hub }, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret", ADMIN_EMAILS: "mod@example.com", ...vars };
    const call = async (path: string, token: string | null, body?: unknown, cookie = "") => {
      const res = await handleAccountApi(
        new Request(`https://hunchess.test${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: { "content-type": "application/json", cookie: `${token ? `hc_session=${token}` : ""}${cookie}` },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
        env as never,
      );
      return res!;
    };
    const signedIn = async (name: string) => {
      const u = await player(sql, name);
      return { user: u, token: await createSession(sql, u.id, Date.now()) };
    };
    return { sql, d1, env, hub, call, signedIn };
  }
  type Live = { town?: { n: number; lines: { n: number; from: string; name: string; text: string; at: number }[]; gone?: number[]; paused?: true } };
  const live = async (res: Response) => (await res.json()) as Live;

  it("signed-in players send and read each other's lines with the live poll; a guest gets none and can't send", async () => {
    const { sql, call, signedIn } = await setup();
    const a = await signedIn("Ann");
    const b = await signedIn("Bo");
    const guest = await createGuest(sql, Date.now(), "Guesty");
    const sent = await call("/api/town/chat", a.token, { text: "  hello   town  ", since: 0 });
    expect(sent.status).toBe(200);
    const body = (await sent.json()) as { ok: true; line: { n: number }; town: { lines: unknown[] }; waitMs: number };
    expect(body).toMatchObject({ ok: true, line: { name: "Ann", text: "hello town", from: a.user.id }, waitMs: TOWN_CHAT.gapMs });
    expect(body.town.lines).toHaveLength(1);
    // Bo reads it with the live line.
    const read = await live(await call("/api/live?town=0", b.token));
    expect(read.town!.lines).toMatchObject([{ name: "Ann", text: "hello town", from: a.user.id }]);
    expect(JSON.stringify(read.town)).not.toMatch(/example\.com|email/);
    expect((await live(await call(`/api/live?town=${read.town!.n}`, b.token))).town!.lines).toEqual([]);
    // The guest: no players' lines at all (no `town` in the answer), and sending is refused.
    expect("town" in (await live(await call("/api/live?town=0", guest.token)))).toBe(false);
    const g = await call("/api/town/chat", guest.token, { text: "hi" });
    expect(g.status).toBe(401);
    expect(await g.json()).toEqual({ message: SIGN_IN_TO_TOWN_CHAT });
    expect(SIGN_IN_TO_TOWN_CHAT).toBe("Sign in to chat with other players.");
    // Without ?town, nothing of the town's.
    expect("town" in (await live(await call("/api/live", b.token)))).toBe(false);
  });

  it("a guest gets none even where signing in isn't set up (local runs): the town's chat is for accounts", async () => {
    const { sql, call, signedIn } = await setup({ GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" });
    const a = await signedIn("Ann");
    const guest = await createGuest(sql, Date.now(), "Guesty");
    expect((await call("/api/town/chat", a.token, { text: "hello" })).status).toBe(200);
    expect("town" in (await live(await call("/api/live?town=0", guest.token)))).toBe(false);
    expect((await call("/api/town/chat", guest.token, { text: "hi" })).status).toBe(401);
  });

  it("a device the age gate marked too young gets none and can't send, even signed in from before", async () => {
    const { call, signedIn } = await setup();
    const a = await signedIn("Ann");
    const b = await signedIn("Bo");
    expect((await call("/api/town/chat", a.token, { text: "hello" })).status).toBe(200);
    expect("town" in (await live(await call("/api/live?town=0", b.token, undefined, "; hc_age=under")))).toBe(false);
    const r = await call("/api/town/chat", b.token, { text: "hi" }, "; hc_age=under");
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ message: TOWN_CHAT_AGE });
  });

  it("the server's limits: the 15 s wait, 80 characters, the filter's reasons; names from the account, filtered", async () => {
    const { sql, call, signedIn } = await setup();
    const a = await signedIn("Ann");
    expect((await call("/api/town/chat", a.token, { text: "gg" })).status).toBe(200);
    const again = await call("/api/town/chat", a.token, { text: "rematch?" });
    expect(again.status).toBe(429);
    const wait = (await again.json()) as { message: string; retryMs: number };
    expect(wait.message).toBe("One message every 15 s.");
    expect(wait.retryMs).toBeGreaterThan(10_000);
    expect(Number(again.headers.get("retry-after"))).toBeGreaterThan(10);
    const b = await signedIn("Bo");
    for (const [text, message] of [
      ["x".repeat(81), TOWN_TOO_LONG],
      [`you ${slur}`, CHAT_NOT_ALLOWED],
      [`${swear}!`, CHAT_NOT_ALLOWED],
      ["www.example.org", CHAT_NO_CONTACT],
      ["", TOWN_EMPTY],
    ]) {
      const r = await call("/api/town/chat", b.token, { text });
      expect(r.status, text).toBe(400);
      expect(((await r.json()) as { message: string }).message).toBe(message);
    }
    // A name from before the name filter that it refuses goes out as "Player".
    await sql.run("UPDATE users SET name = ? WHERE id = ?", `${slur}99`, b.user.id);
    expect(await (await call("/api/town/chat", b.token, { text: "hello" })).json()).toMatchObject({ ok: true, line: { name: "Player" } });
  });

  it("a moderator's chat ban stops typing with its reason; so does a fair-play ban; they still read", async () => {
    const { sql, call, signedIn } = await setup();
    const a = await signedIn("Ann");
    const troll = await signedIn("Troll");
    await decideChat(sql, troll.user.id, { action: "ban", days: 7, reason: "spamming the town" }, "admin:mod@example.com", Date.now());
    const r = await call("/api/town/chat", troll.token, { text: "hello" });
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ message: CHAT_OFF, block: { until: expect.any(Number) } });
    expect((await call("/api/town/chat", a.token, { text: "hello" })).status).toBe(200);
    expect((await live(await call("/api/live?town=0", troll.token))).town!.lines).toHaveLength(1);
    const cheat = await signedIn("Cheat");
    const now = Date.now();
    await sql.run("INSERT INTO fairplay_cases (user_id, status, reason, opened_at, updated_at) VALUES (?, 'banned', 'test', ?, ?)", cheat.user.id, now, now);
    const c = await call("/api/town/chat", cheat.token, { text: "hello" });
    expect(c.status).toBe(403);
    expect(await c.json()).toMatchObject({ banned: true });
  });

  it("the switch (PAUSE_TOWN_CHAT): nobody sends, readers hear it's paused and get no players' lines", async () => {
    const { call, signedIn } = await setup({ PAUSE_TOWN_CHAT: "1" });
    const a = await signedIn("Ann");
    const r = await call("/api/town/chat", a.token, { text: "hello" });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ message: TOWN_CHAT_PAUSED, paused: "town-chat" });
    expect(TOWN_CHAT_PAUSED).toBe("Chat is paused.");
    expect((await live(await call("/api/live?town=0", a.token))).town).toEqual({ paused: true });
    // On by default.
    const on = await setup();
    const b = await on.signedIn("Bo");
    expect((await on.call("/api/town/chat", b.token, { text: "hello" })).status).toBe(200);
  });

  it("a moderator takes a line out: it leaves everyone's log; nobody else can", async () => {
    const { sql, call, signedIn } = await setup();
    const a = await signedIn("Ann");
    const troll = await signedIn("Troll");
    const mod = await signedIn("Mod");
    await sql.run("UPDATE users SET email = ? WHERE id = ?", "mod@example.com", mod.user.id);
    expect((await call("/api/town/chat", a.token, { text: "hello" })).status).toBe(200);
    const line = ((await (await call("/api/town/chat", troll.token, { text: "something mean" })).json()) as { line: { n: number } }).line;
    expect((await call("/api/town/chat/remove", troll.token, { n: line.n })).status).toBe(403);
    expect((await call("/api/town/chat/remove", a.token, { n: line.n })).status).toBe(403);
    expect((await call("/api/town/chat/remove", mod.token, { n: line.n })).status).toBe(200);
    const read = await live(await call(`/api/live?town=${line.n}`, a.token));
    expect(read.town).toMatchObject({ lines: [], gone: [line.n] });
    expect((await live(await call("/api/live?town=0", a.token))).town!.lines.map((l) => l.text)).toEqual(["hello"]);
    expect((await call("/api/town/chat/remove", mod.token, { n: line.n })).status).toBe(404);
    expect((await call("/api/town/chat/remove", mod.token, { n: "x" })).status).toBe(400);
  });

  it("Report on a line: fair play's report with \"Offensive chat\", carrying the line's text and time from the room", async () => {
    const { sql, d1, env, call, signedIn } = await setup();
    const a = await signedIn("Ann");
    const troll = await signedIn("Troll");
    const sent = (await (await call("/api/town/chat", troll.token, { text: "you play like a potato" })).json()) as { line: { n: number; at: number } };
    expect((await call("/api/town/chat", a.token, { text: "hello" })).status).toBe(200);
    const mine = ((await live(await call("/api/live?town=0", a.token))).town!.lines.find((l) => l.from === a.user.id))!;
    const report = (body: unknown) => call("/api/report", a.token, body);
    const reason = FAIRPLAY.reports.chatReason;
    expect(reason).toBe("Offensive chat");
    // Not a line of theirs, no line, a line that isn't there: refused, so a report only carries words they really sent.
    for (const body of [{ target: troll.user.id, reason, line: mine.n }, { target: troll.user.id, reason }, { target: troll.user.id, reason, line: 999 }]) {
      const r = await report(body);
      expect(r.status).toBe(400);
      expect(((await r.json()) as { message: string }).message).toBe(LINE_GONE);
    }
    const r = await report({ target: troll.user.id, reason, line: sent.line.n, text: "something made up" });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true });
    const row = await sql.first<{ reason: string; line: string; line_at: number; match: string | null }>("SELECT reason, line, line_at, match FROM reports WHERE target = ?", troll.user.id);
    expect(row).toEqual({ reason: "Offensive chat", line: "you play like a potato", line_at: sent.line.at, match: null });
    // It opens a watch case, as reports do; the same line again is "already".
    expect(await sql.first("SELECT status FROM fairplay_cases WHERE user_id = ?", troll.user.id)).toEqual({ status: "watch" });
    expect(await (await report({ target: troll.user.id, reason, line: sent.line.n })).json()).toMatchObject({ ok: true, already: true });
    // The profile sheet's reasons are unchanged, and a profile report the same day still goes (it's not a line's).
    expect(FAIRPLAY.reports.reasons).toEqual(["Cheating", "Offensive name or icon", "Something else"]);
    expect(await (await report({ target: troll.user.id, reason: "Offensive name or icon" })).json()).toMatchObject({ ok: true });
    expect(await (await report({ target: troll.user.id, reason: "Offensive name or icon" })).json()).toMatchObject({ ok: true, already: true });
    // A moderator sees what was said, and when, on fair play's page.
    const mod = await signedIn("Mod");
    await sql.run("UPDATE users SET email = ? WHERE id = ?", "mod@example.com", mod.user.id);
    const page = await (await handleAdmin(new Request(`https://x/admin/fairplay/case/${troll.user.id}`, { headers: { cookie: `hc_session=${mod.token}` } }), { ...env, DB: d1 } as never))!.text();
    expect(page).toContain("Offensive chat");
    expect(page).toContain("“you play like a potato”");
    expect(page).toContain("in the town square");
    // Deleting either account deletes the report, line and all (account-data.ts, as before).
  });
});
