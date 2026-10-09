import { afterEach, describe, expect, it, vi } from "vitest";
import { GLOBAL_CHAT, chatPackItem, chatSay, mulberry32 } from "@chessroyale/core";
import { createGuest, ensureSchema } from "../src/accounts.ts";
import { forgetSecrets, handleAccountApi } from "../src/api.ts";
import { forgetChatCache } from "../src/global-chat-api.ts";
import { GlobalChat, PAWN, iconKey, linesSince, type GlobalChatOptions, type GlobalSender } from "../src/global-chat.ts";
import { LiveHub } from "../src/live-hub.ts";
import { memoryDb } from "./memory-db.ts";

const T0 = 1_800_000_000_000;
const opts = (patch: Partial<GlobalChatOptions> = {}): GlobalChatOptions => ({ ...GLOBAL_CHAT, bots: true, ...patch });
const ann: GlobalSender = { id: "ann", name: "Ann", rating: 1520, icon: "♞", owned: [] };
const bo: GlobalSender = { id: "bo", name: "Bo", rating: null, icon: null, owned: [chatPackItem("emoji-royal")] };
// (A 1 × 1 PNG: stands in for a drawn icon.)
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==";

describe("global chat: the room", () => {
  it("one message per account every 30 s, enforced here; others still post", () => {
    const c = new GlobalChat(opts({ bots: false }));
    expect(c.post(ann, "l-hey", T0)).toMatchObject({ ok: true, line: { n: 1, name: "Ann", rating: 1520, icon: "♞", say: "l-hey" } });
    expect(c.post(ann, "gg", T0 + 1_000)).toMatchObject({ ok: false, reason: "rate", retryMs: 29_000 });
    expect(c.post(ann, "gg", T0 + 29_999)).toMatchObject({ ok: false, reason: "rate", retryMs: 1 });
    expect(c.post(bo, "e-dragon", T0 + 2_000)).toMatchObject({ ok: true, line: { n: 2, icon: PAWN } });
    expect(c.post(ann, "gg", T0 + 30_000)).toMatchObject({ ok: true, line: { n: 3 } });
    // A refused line doesn't reset the clock, and the gap is counted from the last line that went.
    expect(c.readyAt("ann", T0 + 31_000)).toBe(T0 + 60_000);
    expect(c.readyAt("cy", T0 + 31_000)).toBe(T0 + 31_000);
  });

  it("the limit survives a restart: it's read from the lines kept too", () => {
    const a = new GlobalChat(opts({ bots: false }));
    a.post(ann, "l-hey", T0);
    const b = new GlobalChat(opts({ bots: false }));
    b.restore(a.saved());
    expect(b.post(ann, "gg", T0 + 10_000)).toMatchObject({ ok: false, reason: "rate", retryMs: 20_000 });
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
    for (let i = 0; i < 60; i++) c.post({ ...bo, id: `p${i}` }, "gg", T0 + 1000 + i);
    const snap = c.snapshot(T0 + 2000);
    expect(snap.lines).toHaveLength(50);
    expect(snap.n).toBe(61);
    expect(snap.lines[0]!.n).toBe(12);
    expect(c.unusedIcons()).toEqual([iconKey(PNG)]);
    expect(c.icon(iconKey(PNG))).toBeUndefined();
    expect(c.snapshot(T0 + GLOBAL_CHAT.maxAgeMs + 2000).lines).toHaveLength(0);
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
    const n = c.snapshot(T0).n;
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
});

describe("global chat: the API", () => {
  afterEach(() => {
    forgetChatCache();
    forgetSecrets();
  });

  async function setup(signInSetUp: boolean) {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql);
    const { hub, ready } = hubWith();
    await ready();
    const env = { DB: d1, LIVE: { idFromName: () => "global", get: () => hub }, ...(signInSetUp ? { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" } : {}) };
    const call = async (path: string, token: string | null, body?: unknown) => {
      const res = await handleAccountApi(
        new Request(`https://hunchess.test${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: { "content-type": "application/json", ...(token ? { cookie: `hc_session=${token}` } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
        env as never,
      );
      return res!;
    };
    return { sql, call };
  }

  it("signed-in players post; guests read; names, ratings and icons from the account, never an email", async () => {
    const { sql, call } = await setup(true);
    const now = Date.now();
    const guest = await createGuest(sql, now, "Guesty");
    const ann = await createGuest(sql, now, "Ann");
    await sql.run("UPDATE users SET email = ?, rating = ?, icon = ? WHERE id = ?", "ann@example.com", 1520.4, PNG, ann.user.id);
    // A guest can't post where sign-in is set up…
    const g = await call("/api/chat", guest.token, { say: "l-hey" });
    expect(g.status).toBe(401);
    expect(((await g.json()) as { message: string }).message).toMatch(/Sign in to chat/);
    // …a signed-in player can, and the guest reads it with the live line.
    const a = await call("/api/chat", ann.token, { say: "l-raid", since: 0 });
    expect(a.status).toBe(200);
    expect(await a.json()).toMatchObject({ ok: true, line: { name: "Ann", rating: 1520, say: "l-raid", iconKey: iconKey(PNG) }, waitMs: GLOBAL_CHAT.gapMs });
    const live = await call("/api/live?chat=0", guest.token);
    const body = (await live.json()) as { chat: { n: number; lines: { from: string; name: string }[] }; online: number };
    expect(body.chat.lines).toMatchObject([{ from: ann.user.id, name: "Ann" }]);
    expect(JSON.stringify(body.chat)).not.toMatch(/example\.com|email|base64/);
    // Nothing new after the last one; and the live line without ?chat has no chat at all.
    expect(((await (await call(`/api/live?chat=${body.chat.n}`, guest.token)).json()) as { chat: { lines: unknown[] } }).chat.lines).toEqual([]);
    expect("chat" in ((await (await call("/api/live", guest.token)).json()) as object)).toBe(false);
    // The drawn icon, as a PNG the browser keeps.
    const icon = await call(`/api/chat/icon/${iconKey(PNG)}`, null);
    expect(icon.status).toBe(200);
    expect(icon.headers.get("content-type")).toBe("image/png");
    expect(icon.headers.get("cache-control")).toContain("immutable");
    expect((await call("/api/chat/icon/not-a-key", null)).status).toBe(404);
  });

  it("the server enforces the limit and the presets; a banned player can't post", async () => {
    const { sql, call } = await setup(false);
    const now = Date.now();
    const bo = await createGuest(sql, now, "Bo");
    expect((await call("/api/chat", bo.token, { say: "gg" })).status).toBe(200);
    const again = await call("/api/chat", bo.token, { say: "l-hey" });
    expect(again.status).toBe(429);
    expect(((await again.json()) as { retryMs: number }).retryMs).toBeGreaterThan(25_000);
    const cy = await createGuest(sql, now, "Cy");
    expect((await call("/api/chat", cy.token, { say: "Buy cheap coins at example.com" })).status).toBe(400);
    expect((await call("/api/chat", cy.token, { say: "gk-crown" })).status).toBe(400);
    expect((await call("/api/chat", cy.token, {})).status).toBe(400);
    await sql.run("INSERT INTO fairplay_cases (user_id, status, reason, opened_at, updated_at) VALUES (?, 'banned', 'test', ?, ?)", cy.user.id, now, now);
    const banned = await call("/api/chat", cy.token, { say: "gg" });
    expect(banned.status).toBe(403);
    expect(await banned.json()).toMatchObject({ banned: true });
  });
});
