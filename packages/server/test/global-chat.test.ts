import { afterEach, describe, expect, it, vi } from "vitest";
import { GLOBAL_CHAT, chatPackItem, chatSay, mulberry32 } from "@chessroyale/core";
import { createGuest, ensureSchema } from "../src/accounts.ts";
import { forgetSecrets, handleAccountApi } from "../src/api.ts";
import { forgetChatCache } from "../src/global-chat-api.ts";
import { CHAT_BUSY, GlobalChat, PAWN, TEST_GLOBAL_CHAT, TYPED_AGE, iconKey, linesSince, type GlobalChatOptions, type GlobalPost, type GlobalSender } from "../src/global-chat.ts";
import { LiveHub } from "../src/live-hub.ts";
import { memoryDb } from "./memory-db.ts";

const T0 = 1_800_000_000_000;
const opts = (patch: Partial<GlobalChatOptions> = {}): GlobalChatOptions => ({ ...GLOBAL_CHAT, bots: true, ...patch });
const ann: GlobalSender = { id: "ann", name: "Ann", rating: 1520, icon: "♞", owned: [] };
const bo: GlobalSender = { id: "bo", name: "Bo", rating: null, icon: null, owned: [chatPackItem("emoji-royal")] };
// (A 1 × 1 PNG: stands in for a drawn icon.)
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==";

describe("global chat: the room", () => {
  it("one message per account every 5 s, enforced here; others still post", () => {
    const c = new GlobalChat(opts({ bots: false }));
    expect(c.post(ann, "l-hey", T0)).toMatchObject({ ok: true, delayMs: 0, line: { n: 1, name: "Ann", rating: 1520, icon: "♞", say: "l-hey" } });
    expect(c.post(ann, "gg", T0 + 1_000)).toMatchObject({ ok: false, reason: "rate", retryMs: 4_000, message: "One message every 5 s." });
    expect(c.postText({ ...ann, typed: true }, "hello", T0 + 4_999)).toMatchObject({ ok: false, reason: "rate", retryMs: 1 });
    expect(c.post(bo, "e-dragon", T0 + 2_000)).toMatchObject({ ok: true, line: { n: 2, icon: PAWN } });
    expect(c.post(ann, "gg", T0 + 5_000)).toMatchObject({ ok: true, line: { n: 3 } });
    // A refused line doesn't reset the clock, and the gap is counted from the last line that went.
    expect(c.readyAt("ann", T0 + 6_000)).toBe(T0 + 10_000);
    expect(c.readyAt("cy", T0 + 6_000)).toBe(T0 + 6_000);
  });

  it("the limit survives a restart: it's read from the lines kept too", () => {
    const a = new GlobalChat(opts({ bots: false }));
    a.post(ann, "l-hey", T0);
    const b = new GlobalChat(opts({ bots: false }));
    b.restore(a.saved());
    expect(b.post(ann, "gg", T0 + 2_000)).toMatchObject({ ok: false, reason: "rate", retryMs: 3_000 });
  });

  it("presets only: free text, unknown ids, plans and packs not owned never reach anyone", () => {
    const c = new GlobalChat(opts({ bots: false }));
    for (const say of ["hello there", "<b>hi</b>", "", 7, null, "defend-king", "gk-crown", "e-dragon"]) {
      expect(c.post(ann, say, T0)).toMatchObject({ ok: false, reason: "unknown" });
    }
    expect(c.snapshot(T0).lines).toEqual([]);
    // (A refused line doesn't count toward the limit.)
    expect(c.post(ann, "l-raid", T0)).toMatchObject({ ok: true });
  });

  it("names, ratings and icons come from the account; a drawn icon goes by its key, never inline", () => {
    const c = new GlobalChat(opts({ bots: false }));
    const r = c.post({ ...ann, icon: PNG }, "l-hey", T0);
    expect(r.ok && r.line.iconKey).toBe(iconKey(PNG));
    expect(r.ok && r.line.icon).toBeUndefined();
    expect(JSON.stringify(c.snapshot(T0))).not.toContain("base64");
    expect(c.icon(iconKey(PNG))).toBe(PNG);
    expect(iconKey(PNG)).toMatch(/^[0-9a-f]{14}$/);
    expect(iconKey(PNG + "x")).not.toBe(iconKey(PNG));
  });

  it("keeps the last 50 lines and nothing older than a day; drawn icons go with their lines", () => {
    const c = new GlobalChat(opts({ bots: false }));
    c.post({ ...ann, icon: PNG }, "l-hey", T0);
    // (One every 200 ms: the server-wide cap's pace, five a second, so none waits in line.)
    for (let i = 0; i < 60; i++) c.post({ ...bo, id: `p${i}` }, "gg", T0 + 1000 + i * 200);
    const snap = c.snapshot(T0 + 20_000);
    expect(snap.lines).toHaveLength(50);
    expect(snap.n).toBe(61);
    expect(snap.lines[0]!.n).toBe(12);
    expect(c.unusedIcons()).toEqual([iconKey(PNG)]);
    expect(c.icon(iconKey(PNG))).toBeUndefined();
    expect(c.snapshot(T0 + GLOBAL_CHAT.maxAgeMs + 20_000).lines).toHaveLength(0);
  });

  it("a newcomer gets everything kept; others get only what's new (all again if the count went back)", () => {
    const c = new GlobalChat(opts({ bots: false }));
    c.post(ann, "l-hey", T0);
    c.post(bo, "l-raid", T0 + 1);
    const snap = c.snapshot(T0 + 2);
    expect(linesSince(snap, 0).lines.map((l) => l.say)).toEqual(["l-hey", "l-raid"]);
    expect(linesSince(snap, 1).lines.map((l) => l.say)).toEqual(["l-raid"]);
    expect(linesSince(snap, 2).lines).toEqual([]);
    expect(linesSince(snap, 9)).toMatchObject({ reset: true, n: 2 });
    expect(linesSince(snap, NaN)).toMatchObject({ reset: true });
  });
});

describe("global chat: typed messages, the filter, the age gate and the server-wide cap (Nov 7)", () => {
  const typer: GlobalSender = { ...ann, typed: true };
  it("a player types; the message is tidied and kept as text; one every 5 s whatever they send", () => {
    const c = new GlobalChat(opts({ bots: false }));
    expect(c.postText(typer, "  gg   well   played :crown:  ", T0)).toMatchObject({ ok: true, line: { n: 1, text: "gg well played :crown:", name: "Ann" } });
    expect(c.postText(typer, "again", T0 + 1_000)).toMatchObject({ ok: false, reason: "rate" });
    expect(c.post(typer, "gg", T0 + 1_000)).toMatchObject({ ok: false, reason: "rate" });
    expect(c.snapshot(T0).lines.map((l) => l.text)).toEqual(["gg well played :crown:"]);
  });

  it("the same filter as the town square's on every typed message: refused ones never reach anyone, nor start the wait", () => {
    const c = new GlobalChat(opts({ bots: false }));
    expect(c.postText(typer, "add me on discord", T0)).toMatchObject({ ok: false, reason: "text", message: "No links or contact details in chat." });
    expect(c.postText(typer, "visit example.com now", T0)).toMatchObject({ ok: false, reason: "text", message: "No links or contact details in chat." });
    expect(c.postText(typer, "what the f*cking hell", T0)).toMatchObject({ ok: false, reason: "text", message: "That message isn't allowed." });
    expect(c.postText(typer, "   ", T0)).toMatchObject({ ok: false, reason: "text", message: "Type a message first." });
    expect(c.postText(typer, "x".repeat(81), T0)).toMatchObject({ ok: false, reason: "text", message: "Messages are at most 80 characters." });
    expect(c.postText(typer, 42, T0)).toMatchObject({ ok: false, reason: "text" });
    expect(c.snapshot(T0).lines).toEqual([]);
    expect(c.postText(typer, "x".repeat(80), T0)).toMatchObject({ ok: true });
  });

  it("a device the age gate marked too young can't type (the quick chips still go); with CHAT_TYPED off nobody types", () => {
    const c = new GlobalChat(opts({ bots: false }));
    expect(c.postText({ ...ann, typed: false }, "hi all", T0)).toMatchObject({ ok: false, reason: "typed", message: TYPED_AGE });
    expect(c.postText({ ...ann }, "hi all", T0)).toMatchObject({ ok: false, reason: "typed" });
    expect(c.post({ ...ann, typed: false }, "l-hey", T0)).toMatchObject({ ok: true });
    const off = new GlobalChat(opts({ bots: false, typed: false }));
    expect(off.postText(typer, "hi all", T0)).toMatchObject({ ok: false, reason: "unknown" });
  });

  it("server-wide: 5 messages a second show at once, the rest wait in line in order (up to 10 s), then \"Chat is busy, try again\"", () => {
    const c = new GlobalChat(opts({ bots: true, keep: 100 }), mulberry32(1));
    const sent: GlobalPost[] = [];
    // 60 players at the same moment: 5 a second for 10 s is 55 (the first 5 at once, then 5 more each second up to 10 s late).
    for (let i = 0; i < 60; i++) sent.push(c.postText({ ...typer, id: `p${i}` }, `hello ${i}`, T0));
    const ok = sent.filter((p) => p.ok);
    expect(ok).toHaveLength(55);
    expect(sent.slice(55)).toEqual(Array(5).fill({ ok: false, reason: "busy", message: CHAT_BUSY }));
    expect(CHAT_BUSY).toBe("Chat is busy, try again.");
    const delays = ok.map((p) => (p.ok ? p.delayMs : -1));
    expect(delays.slice(0, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(delays.slice(5, 10)).toEqual([1000, 1000, 1000, 1000, 1000]);
    expect(Math.max(...delays)).toBe(10_000);
    // A busy refusal doesn't start the player's wait: they may try again at once.
    expect(c.readyAt("p59", T0)).toBe(T0);
    // Only what's due shows, numbered in order; a reader never skips a line still waiting.
    expect(c.snapshot(T0)).toMatchObject({ n: 5 });
    expect(c.snapshot(T0 + 2_500).lines.map((l) => l.text)).toEqual(Array.from({ length: 15 }, (_, i) => `hello ${i}`));
    expect(c.snapshot(T0 + 2_500).n).toBe(15);
    // Bots never cut in while players wait.
    for (let t = T0; t < T0 + 10_000; t += 500) expect(c.watch(t)).toBeNull();
    // Over a minute at 5 a second, nobody waits.
    const d = new GlobalChat(opts({ bots: false }));
    for (let i = 0; i < 300; i++) expect(d.postText({ ...typer, id: `q${i}` }, "hi", T0 + i * 200)).toMatchObject({ ok: true, delayMs: 0 });
  });

  it("a test's own chat has a cap of one every 3 s and a 6 s line", () => {
    const c = new GlobalChat(TEST_GLOBAL_CHAT);
    const r = ["a", "b", "c", "d"].map((id) => c.postText({ ...typer, id }, "hi", T0));
    expect(r.map((p) => (p.ok ? p.delayMs : p.reason))).toEqual([0, 3000, 6000, "busy"]);
  });
});

describe("global chat: bots", () => {
  /** A chat watched every 5 s (the home screen's poll) for `ms`; the bot lines said. */
  function watched(c: GlobalChat, from: number, ms: number, every = 5_000) {
    const out = [];
    for (let t = from; t <= from + ms; t += every) {
      const l = c.watch(t);
      if (l) out.push(l);
    }
    return out;
  }

  it("speak about every 30-90 s while someone has the chat open, each line tagged as a bot's", () => {
    const c = new GlobalChat(opts(), mulberry32(3), ["Rookie Ray", "Pawnstar", "Queenie", "Gambit Gus", "Swindler", "Knightowl", "Blitz Bo", "Fork Lift"]);
    const lines = watched(c, T0, 30 * 60_000);
    // Half an hour: between 20 and 60 lines (one every 30-90 s), the first within 15 s.
    expect(lines.length).toBeGreaterThanOrEqual(20);
    expect(lines.length).toBeLessThanOrEqual(61);
    expect(lines[0]!.at - T0).toBeLessThanOrEqual(GLOBAL_CHAT.botFirstMs[1] + 5_000);
    for (let i = 1; i < lines.length; i++) {
      const gap = lines[i]!.at - lines[i - 1]!.at;
      expect(gap).toBeGreaterThanOrEqual(GLOBAL_CHAT.botGapMs[0]);
      expect(gap).toBeLessThanOrEqual(GLOBAL_CHAT.botGapMs[1] + 5_000);
    }
    for (const l of lines) {
      expect(l).toMatchObject({ bot: true, rating: null, icon: PAWN });
      expect(l.from).toBe(l.name);
      expect(chatSay(l.say)).toBeTruthy();
    }
  });

  it("say nothing while nobody has it open, and don't catch up afterwards", () => {
    const c = new GlobalChat(opts(), mulberry32(4));
    expect(watched(c, T0, 10 * 60_000).length).toBeGreaterThan(5);
    const n = c.snapshot(T0 + 10 * 60_000).n;
    // Nobody for an hour: nothing is said (there's no timer: lines are only made when someone asks).
    const back = T0 + 70 * 60_000;
    expect(c.watch(back)).toBeNull();
    expect(c.snapshot(back).n).toBe(n);
    // Back again: one line soon, not an hour's worth.
    const after = watched(c, back + 5_000, 20_000);
    expect(after.length).toBe(1);
  });

  it("one setting turns them off (GLOBAL_CHAT_BOTS)", () => {
    const c = new GlobalChat(opts({ bots: false }), mulberry32(5));
    expect(watched(c, T0, 60 * 60_000)).toEqual([]);
    expect(c.snapshot(T0 + 60 * 60_000).lines).toEqual([]);
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

describe("global chat: the live hub relays and keeps history", () => {
  afterEach(() => vi.useRealTimers());

  it("relays each line to every reader, keeps it through a restart, and serves drawn icons only while used", async () => {
    vi.useFakeTimers({ now: T0 });
    const { hub, store, ready } = hubWith();
    await ready();
    expect((await hub.chatPost({ ...ann, icon: PNG }, "l-raid")).post).toMatchObject({ ok: true });
    vi.setSystemTime(T0 + 1_000);
    expect((await hub.chatPost(bo, "e-dragon")).post).toMatchObject({ ok: true });
    vi.setSystemTime(T0 + 2_000);
    const refused = await hub.chatPost(ann, "gg");
    expect(refused.post).toMatchObject({ ok: false, reason: "rate" });
    // Every reader sees both lines, in order.
    const read = await hub.chatRead();
    expect(read.lines.map((l) => [l.name, l.say])).toEqual([
      ["Ann", "l-raid"],
      ["Bo", "e-dragon"],
    ]);
    expect(await hub.chatIcon(iconKey(PNG))).toBe(PNG);
    expect(await hub.chatIcon("00000000000000")).toBeNull();
    // A restart (a deploy): the history and the icon come back from storage.
    const again = hubWith(store);
    await again.ready();
    expect((await again.hub.chatRead()).lines.map((l) => l.say)).toEqual(["l-raid", "e-dragon"]);
    expect(await again.hub.chatIcon(iconKey(PNG))).toBe(PNG);
    // Once Ann's line has gone (50 newer), her icon goes from storage too.
    for (let i = 0; i < 50; i++) await again.hub.chatPost({ ...bo, id: `p${i}` }, "gg");
    expect(await again.hub.chatIcon(iconKey(PNG))).toBeNull();
    expect([...store.keys()].filter((k) => k.startsWith("chat-icon:"))).toEqual([]);
    expect((store.get("chat") as { lines: unknown[] }).lines).toHaveLength(50);
  });

  it("a moderator's reset (dropChatLines): the player's lines leave, kept that way; they stay online and still wait to post again", async () => {
    vi.useFakeTimers({ now: T0 });
    const { hub, store, ready } = hubWith();
    await ready();
    await hub.seen([ann.id], T0);
    expect((await hub.chatPost(ann, "l-raid")).post).toMatchObject({ ok: true });
    expect((await hub.chatPost(bo, "gg")).post).toMatchObject({ ok: true });
    await hub.dropChatLines(ann.id);
    expect((await hub.chatRead()).lines.map((l) => l.from)).toEqual([bo.id]);
    expect((store.get("chat") as { lines: { from: string }[] }).lines.map((l) => l.from)).toEqual([bo.id]);
    expect(await hub.presence(ann.id)).toEqual({ online: true, lastSeen: T0 });
    vi.setSystemTime(T0 + 1_000);
    expect((await hub.chatPost(ann, "gg")).post).toMatchObject({ ok: false, reason: "rate" });
  });
});

describe("global chat: the API", () => {
  afterEach(() => {
    forgetChatCache();
    forgetSecrets();
  });

  async function setup(signInSetUp: boolean, testSwitches = false) {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql);
    const { hub, ready } = hubWith();
    await ready();
    const env = { DB: d1, LIVE: { idFromName: () => "global", get: () => hub }, ...(signInSetUp ? { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" } : {}), ...(testSwitches ? { TEST_SWITCHES: "1" } : {}) };
    const call = async (path: string, token: string | null, body?: unknown, o: { under?: boolean; method?: string } = {}) => {
      const cookie = [token ? `hc_session=${token}` : "", o.under ? "hc_age=under" : ""].filter(Boolean).join("; ");
      const res = await handleAccountApi(
        new Request(`https://hunchess.test${path}`, {
          method: o.method ?? (body === undefined ? "GET" : "POST"),
          headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
        env as never,
      );
      return res!;
    };
    /** A signed-in player (an email on the account), with chat on unless `off`. */
    const signedIn = async (name: string, off = false) => {
      const g = await createGuest(sql, Date.now(), name);
      await sql.run("UPDATE users SET email = ? WHERE id = ?", `${name.toLowerCase()}@example.com`, g.user.id);
      if (!off) expect((await call("/api/me", g.token, { chatOn: true }, { method: "PATCH" })).status).toBe(200);
      return g;
    };
    return { sql, call, signedIn };
  }

  it("signed-in players post; guests read (and can't post, even where signing in isn't set up); names, ratings and icons from the account, never an email", async () => {
    for (const signInSetUp of [true, false]) {
      forgetChatCache();
      const { sql, call, signedIn } = await setup(signInSetUp);
      const guest = await createGuest(sql, Date.now(), "Guesty");
      const ann = await signedIn("Ann");
      await sql.run("UPDATE users SET rating = ?, icon = ? WHERE id = ?", 1520.4, PNG, ann.user.id);
      // A guest can't post…
      for (const body of [{ say: "l-hey" }, { text: "hi" }]) {
        const g = await call("/api/chat", guest.token, body);
        expect(g.status).toBe(401);
        expect(((await g.json()) as { message: string }).message).toMatch(/Sign in to chat/);
      }
      // …a signed-in player can, and the guest reads it with the live line.
      const a = await call("/api/chat", ann.token, { text: "hello everyone", since: 0 });
      expect(a.status).toBe(200);
      expect(await a.json()).toMatchObject({ ok: true, line: { name: "Ann", rating: 1520, text: "hello everyone", iconKey: iconKey(PNG) }, waitMs: GLOBAL_CHAT.gapMs });
      const live = await call("/api/live?chat=0", guest.token);
      const body = (await live.json()) as { chat: { n: number; lines: { from: string; name: string }[] }; online: number };
      expect(body.chat.lines).toMatchObject([{ from: ann.user.id, name: "Ann", text: "hello everyone" }]);
      expect(JSON.stringify(body.chat)).not.toMatch(/example\.com|email|base64/);
      // Nothing new after the last one; and the live line without ?chat has no chat at all.
      expect(((await (await call(`/api/live?chat=${body.chat.n}`, guest.token)).json()) as { chat: { lines: unknown[] } }).chat.lines).toEqual([]);
      expect("chat" in ((await (await call("/api/live", guest.token)).json()) as object)).toBe(false);
      if (!signInSetUp) continue;
      // The drawn icon, as a PNG the browser keeps.
      const icon = await call(`/api/chat/icon/${iconKey(PNG)}`, null);
      expect(icon.status).toBe(200);
      expect(icon.headers.get("content-type")).toBe("image/png");
      expect(icon.headers.get("cache-control")).toContain("immutable");
      expect((await call("/api/chat/icon/not-a-key", null)).status).toBe(404);
    }
  });

  it("chat is off by default per account: nothing goes until it's on (PATCH /api/me {chatOn}, kept on the account; a guest's isn't kept)", async () => {
    const { sql, call, signedIn } = await setup(true);
    const bo = await signedIn("Bo", true);
    const me = (await (await call("/api/me", bo.token)).json()) as { chatOn: boolean };
    expect(me.chatOn).toBe(false);
    const off = await call("/api/chat", bo.token, { text: "hi" });
    expect(off.status).toBe(403);
    expect(await off.json()).toMatchObject({ message: "Turn on chat first.", chatOff: true });
    const on = (await (await call("/api/me", bo.token, { chatOn: true }, { method: "PATCH" })).json()) as { chatOn: boolean };
    expect(on.chatOn).toBe(true);
    expect(((await (await call("/api/me", bo.token)).json()) as { chatOn: boolean }).chatOn).toBe(true);
    expect((await call("/api/chat", bo.token, { text: "hi" })).status).toBe(200);
    await call("/api/me", bo.token, { chatOn: false }, { method: "PATCH" });
    expect((await sql.first<{ chat_on: number | null }>("SELECT chat_on FROM users WHERE id = ?", bo.user.id))!.chat_on).toBeNull();
    const guest = await createGuest(sql, Date.now(), "Gus");
    expect(((await (await call("/api/me", guest.token, { chatOn: true }, { method: "PATCH" })).json()) as { chatOn: boolean }).chatOn).toBe(false);
  });

  it("the server enforces the 5 s limit, the filter on typed text, the age gate and the presets; a banned player can't post", async () => {
    const { sql, call, signedIn } = await setup(false);
    const bo = await signedIn("Bo");
    expect((await call("/api/chat", bo.token, { text: "gg all" })).status).toBe(200);
    const again = await call("/api/chat", bo.token, { say: "l-hey" });
    expect(again.status).toBe(429);
    expect(((await again.json()) as { retryMs: number }).retryMs).toBeGreaterThan(3_000);
    const cy = await signedIn("Cy");
    // The filter: what it refuses never goes, with its short reason.
    const link = await call("/api/chat", cy.token, { text: "Buy cheap coins at example.com" });
    expect(link.status).toBe(400);
    expect(await link.json()).toMatchObject({ message: "No links or contact details in chat." });
    expect((await call("/api/chat", cy.token, { text: "x".repeat(5000) })).status).toBe(400);
    expect((await call("/api/chat", cy.token, { say: "gk-crown" })).status).toBe(400);
    expect((await call("/api/chat", cy.token, {})).status).toBe(400);
    // A device the age gate marked too young (signed in there all the same): the quick chips only; typed lines never reach it.
    const young = await call("/api/chat", cy.token, { text: "hi" }, { under: true });
    expect(young.status).toBe(403);
    expect(await young.json()).toMatchObject({ message: TYPED_AGE });
    expect((await call("/api/chat", cy.token, { say: "l-hey" }, { under: true })).status).toBe(200);
    forgetChatCache();
    const seen = (await (await call("/api/live?chat=0", cy.token, undefined, { under: true })).json()) as { chat: { lines: { say?: string; text?: string }[] } };
    expect(seen.chat.lines.map((l) => l.say ?? l.text)).toEqual(["l-hey"]);
    forgetChatCache();
    const all = (await (await call("/api/live?chat=0", cy.token)).json()) as { chat: { lines: { say?: string; text?: string }[] } };
    expect(all.chat.lines.map((l) => l.say ?? l.text)).toEqual(["gg all", "l-hey"]);
    await sql.run("INSERT INTO fairplay_cases (user_id, status, reason, opened_at, updated_at) VALUES (?, 'banned', 'test', ?, ?)", cy.user.id, Date.now(), Date.now());
    vi.useFakeTimers({ now: Date.now() + 10_000, toFake: ["Date"] });
    const banned = await call("/api/chat", cy.token, { text: "hi" });
    vi.useRealTimers();
    expect(banned.status).toBe(403);
    expect(await banned.json()).toMatchObject({ banned: true });
  });

  it("past the server-wide line the sender hears \"Chat is busy, try again\" (a test's own chat, under the test switches)", async () => {
    const { call, signedIn } = await setup(false, true);
    const players = await Promise.all(["Ann", "Bo", "Cy", "Di"].map((n) => signedIn(n)));
    const res = [];
    for (const p of players) res.push(await call("/api/chat", p.token, { text: `hi from ${p.user.name}`, chatroom: "busy-test" }));
    expect(res.map((r) => r.status)).toEqual([200, 200, 200, 503]);
    expect(await res[3]!.json()).toMatchObject({ message: "Chat is busy, try again.", busy: true });
    // (Real time passes between the calls: about a second's wait.)
    expect(((await res[1]!.json()) as { delayMs: number }).delayMs).toBeGreaterThan(500);
    // The test's chat is its own: the one chat has none of it.
    const live = (await (await call("/api/live?chat=0", players[0]!.token)).json()) as { chat: { lines: unknown[] } };
    expect(live.chat.lines).toEqual([]);
    const mine = (await (await call("/api/live?chat=0&chatroom=busy-test", players[0]!.token)).json()) as { chat: { lines: { text?: string }[] } };
    expect(mine.chat.lines.map((l) => l.text)).toEqual(["hi from Ann"]);
  });
});
