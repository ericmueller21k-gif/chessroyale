import { describe, expect, it } from "vitest";
import { CRATES, GLOBAL_CHAT, SHOP_ITEMS } from "@chessroyale/core";
import {
  DELETED_ID,
  buyItem,
  createGuest,
  createSession,
  ensureSchema,
  grantReward,
  profile,
  publicProfile,
  recordResult,
  setChatPicks,
  signInWithIdentity,
  startEmailCode,
  userFromToken,
  type Sql,
  type User,
} from "../src/accounts.ts";
import { ACCOUNT_STORES, COVERED_TABLES, accountDownload, deleteAccount } from "../src/account-data.ts";
import { handleAccountApi } from "../src/api.ts";
import { caseDetail, openCases } from "../src/admin.ts";
import { appeal, banCheck, caseOf, decide, reportPlayer, setCase } from "../src/fairplay.ts";
import { answerRequest, block, sendInvite, sendRequest, setFriendSettings } from "../src/friends.ts";
import { GlobalChat } from "../src/global-chat.ts";
import { LiveBoard } from "../src/live.ts";
import { equipLocker, openCrate } from "../src/locker.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Deleting an account and downloading its data (account-data.ts; docs/decisions/2026-10-15-delete-my-account-and-download-my-data.md):
 * every store's rows in the download, every one gone after deleting (results kept without the player, a ban kept),
 * every table that keeps an account id covered, and the API.
 */
const T0 = 1_800_000_000_000;
const DEVICE = "device-marker-0123456789";
const count = async (sql: Sql, q: string, ...p: unknown[]) => (await sql.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${q}`, ...p))!.n;

/** Columns that hold an account id, by name, in any table (the coverage test reads every table for them). */
const ACCOUNT_COLUMNS = ["user_id", "reporter", "target", "from_id", "to_id", "friend_id", "blocked_id", "account"];

/** Ann (signed in by email) with something in every store; Bo and Cy, signed in, around her. */
async function world() {
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql);
  const make = async (name: string, email: string) => {
    const g = await createGuest(sql, T0 - 60_000, name);
    const user = await signInWithIdentity(sql, g.user, "email", email, {}, T0 - 50_000);
    return { user, token: g.token };
  };
  const ann = await make("Ann", "ann@example.com");
  const bo = await make("Bo", "bo@example.com");
  const cy = await make("Cy", "cy@example.com");
  const a = ann.user;
  // A second device, a sign-in code, results (online and solo).
  const phone = await createSession(sql, a.id, T0);
  expect((await startEmailCode(sql, "ann@example.com", T0)).ok).toBe(true);
  await recordResult(sql, a.id, { mode: "crowd", online: true, placement: 3, players: 100, lobby: "ABCDE", ranked: true, rating: 1400 }, T0 + 1);
  await recordResult(sql, a.id, { mode: "boss", online: false, placement: 1, players: 20 }, T0 + 2);
  await recordResult(sql, bo.user.id, { mode: "crowd", online: true, placement: 9, players: 100, lobby: "ABCDE" }, T0 + 1);
  // The shop, the locker, coins and crates.
  await grantReward(sql, a.id, 50, 2);
  const pack = SHOP_ITEMS.find((i) => i.slot === "chat" && !i.starter)!;
  expect((await buyItem(sql, a.id, pack.id, T0 + 3)).ok).toBe(true);
  await setChatPicks(sql, a.id, { emoji: null });
  const crate = await openCrate(sql, a.id, CRATES[0]!.id, {}, T0 + 4);
  if (!crate.ok) throw new Error(crate.message);
  // (An item of Bo's, which stays his.)
  await openCrate(sql, bo.user.id, CRATES[0]!.id, {}, T0 + 4);
  await equipLocker(sql, a.id, "head", null);
  // Reports both ways, and a device she played online from.
  await reportPlayer(sql, a, bo.user.id, "Cheating", "ABCDE", T0 + 5);
  await reportPlayer(sql, bo.user, a.id, "Offensive name or icon", null, T0 + 6);
  await banCheck(sql, a, DEVICE, T0 + 7);
  // Friends: Bo is her friend, Cy has asked her, she blocked nobody yet, an invite to Bo; her settings.
  await sendRequest(sql, a.id, bo.user.id, false, T0 + 8);
  await answerRequest(sql, bo.user.id, a.id, true, T0 + 9);
  await sendRequest(sql, cy.user.id, a.id, false, T0 + 10);
  expect((await sendInvite(sql, a.id, bo.user.id, "crowd", "FGHJK", false, T0 + 11)).ok).toBe(true);
  await setFriendSettings(sql, a.id, { invites: "friends", showOnline: false });
  return { sql, d1, ann, bo, cy, a, phone };
}

describe("download my data", () => {
  it("has every store's rows about the account, times as dates, and nothing about anyone else", async () => {
    const { sql, a, bo, cy } = await world();
    const d = (await accountDownload(sql, a, T0 + 20)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(Object.keys(d)).toEqual(["exportedAt", "about", "account", "sessions", ...ACCOUNT_STORES.map((s) => s.name)]);
    expect(d.exportedAt).toBe(new Date(T0 + 20).toISOString());
    expect(d.account).toMatchObject({ id: a.id, name: "Ann", email: "ann@example.com", allow_invites: "friends", hide_online: 1 });
    expect(d.account.created_at).toBe(new Date(T0 - 60_000).toISOString());
    // Two devices' sessions, never their token hashes; the latest code's record, never the code's hash.
    expect(d.sessions).toHaveLength(2);
    expect(Object.keys(d.sessions[0])).toEqual(["created_at", "expires_at"]);
    expect(d.signInCode).toMatchObject({ email: "ann@example.com", attempts: 0 });
    expect(d.signInCode).not.toHaveProperty("code_hash");
    expect(d.results.map((r: { mode: string; lobby: string | null }) => [r.mode, r.lobby])).toEqual([
      ["crowd", "ABCDE"],
      ["boss", null],
    ]);
    expect(d.shop.wallet).toEqual({ coins: 50, crates: 2 });
    expect(d.shop.items.map((i: { item_id: string }) => i.item_id)).toContain(SHOP_ITEMS.find((i) => i.slot === "chat" && !i.starter)!.id);
    expect(d.locker.items).toHaveLength(1);
    expect(d.reportsMade).toEqual([{ target: bo.user.id, reason: "Cheating", match: "ABCDE", at: new Date(T0 + 5).toISOString() }]);
    expect(d.fairPlay).toEqual({ banned: false, appeals: [] });
    expect(d.friends.friends.map((f: { id: string; name: string }) => [f.id, f.name])).toEqual([[bo.user.id, "Bo"]]);
    expect(d.friends.requestsReceived.map((r: { id: string }) => r.id)).toEqual([cy.user.id]);
    expect(d.friends.requestsSent).toEqual([]);
    expect(d.friends.invitesSent).toMatchObject([{ id: bo.user.id, kind: "crowd", code: "FGHJK" }]);
    expect(d.friends.limits.length).toBeGreaterThan(0);
    // Nothing of anyone else's but the names the app shows her: no other email, no report about her, no token.
    const text = JSON.stringify(d);
    for (const secret of ["bo@example.com", "cy@example.com", "Offensive name or icon", "token_hash", "code_hash", DEVICE]) expect(text).not.toContain(secret);
  });

  it("leaves out who has blocked the player", async () => {
    const { sql, a, bo } = await world();
    await block(sql, bo.user.id, a.id, T0 + 30);
    const d = (await accountDownload(sql, a, T0 + 31)) as { friends: { blocked: unknown[]; friends: unknown[] } };
    // (The block ended their friendship; her report about Bo still names him, as she made it.)
    expect(d.friends.blocked).toEqual([]);
    expect(JSON.stringify(d.friends)).not.toContain(bo.user.id);
  });
});

describe("delete my account", () => {
  it("every table that keeps an account id is covered", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const tables = await sql.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
    const holding: string[] = [];
    for (const { name } of tables) {
      const cols = (await sql.all<{ name: string }>(`PRAGMA table_info(${name})`)).map((c) => c.name);
      if (cols.some((c) => ACCOUNT_COLUMNS.includes(c)) || name === "users" || name === "email_codes") holding.push(name);
    }
    expect(holding.length).toBeGreaterThan(15);
    for (const t of holding) expect(COVERED_TABLES, `${t} keeps an account id: give it an entry in ACCOUNT_STORES (account-data.ts)`).toContain(t);
  });

  it("removes everything personal, everywhere, and keeps the results without the player", async () => {
    const { sql, ann, bo, cy, a, phone } = await world();
    expect(await deleteAccount(sql, a, T0 + 40)).toEqual({ banned: false });
    // Not a row anywhere names her: every table, every account column.
    const tables = await sql.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
    for (const { name } of tables) {
      const cols = (await sql.all<{ name: string }>(`PRAGMA table_info(${name})`)).map((c) => c.name);
      for (const c of [...cols.filter((x) => ACCOUNT_COLUMNS.includes(x)), ...(name === "users" ? ["id"] : [])]) {
        expect(await count(sql, `${name} WHERE ${c} = ?`, a.id), `${name}.${c}`).toBe(0);
      }
    }
    expect(await count(sql, "email_codes WHERE email = ?", "ann@example.com")).toBe(0);
    // Signed out everywhere: both devices' sessions are gone.
    expect(await userFromToken(sql, ann.token, T0 + 41)).toBeNull();
    expect(await userFromToken(sql, phone, T0 + 41)).toBeNull();
    expect(await publicProfile(sql, a.id, T0 + 41)).toBeNull();
    // Her results stay, as nobody's: the shared deleted id, no lobby code. Bo's are untouched.
    expect(await sql.all("SELECT mode, placement, lobby FROM results WHERE user_id = ? ORDER BY played_at", DELETED_ID)).toEqual([
      { mode: "crowd", placement: 3, lobby: null },
      { mode: "boss", placement: 1, lobby: null },
    ]);
    expect(await publicProfile(sql, DELETED_ID, T0 + 41)).toBeNull();
    expect((await profile(sql, bo.user)).stats.all.matches).toBe(1);
    // Her friendships, requests and invites are gone from the others' lists too; Bo keeps his item and his report.
    expect(await count(sql, "friends WHERE user_id = ?", bo.user.id)).toBe(0);
    expect(await count(sql, "friend_requests WHERE from_id = ?", cy.user.id)).toBe(0);
    expect(await count(sql, "items WHERE user_id = ?", bo.user.id)).toBe(1);
    // Nothing of fair play kept for an account that wasn't banned.
    expect(await caseOf(sql, a.id)).toBeNull();
    // Signing in with her email again makes a new, empty account.
    const g = await createGuest(sql, T0 + 50);
    const again = await signInWithIdentity(sql, g.user, "email", "ann@example.com", {}, T0 + 51);
    expect(again.id).not.toBe(a.id);
    expect((await profile(sql, again)).stats.all.matches).toBe(0);
    // Deleting again (a deletion that stopped halfway, run once more) is harmless.
    await deleteAccount(sql, a, T0 + 60);
    expect(await count(sql, "results WHERE user_id = ?", DELETED_ID)).toBe(2);
  });

  it("a lobby or a reward that finishes after the deletion records nothing", async () => {
    const { sql, a } = await world();
    await deleteAccount(sql, a, T0 + 40);
    await recordResult(sql, a.id, { mode: "crowd", online: true, placement: 1, players: 100, lobby: "QWERT" }, T0 + 41);
    await grantReward(sql, a.id, 100, 1);
    expect(await count(sql, "results WHERE user_id = ? OR lobby = 'QWERT'", a.id)).toBe(0);
    expect(await count(sql, "wallets WHERE user_id = ?", a.id)).toBe(0);
  });

  it("a ban outlives the account: its case, log, hashed identity and device marker; an admin can still lift it", async () => {
    const { sql, a } = await world();
    await setCase(sql, a.id, "banned", "admin:eric@example.com", "engine moves in 9 matches", T0 + 20);
    expect((await appeal(sql, a.id, "I didn't cheat, I promise you that.", T0 + 21)).ok).toBe(true);
    await sql.run(
      "INSERT INTO fairplay_matches (user_id, lobby, mode, played_at, counted, perf, score, level, summary, moves, keep_until) VALUES (?, 'ABCDE', 'crowd', ?, 10, 2500, 90, 'ban', '{}', '[]', ?)",
      a.id,
      T0,
      T0 + 1e9,
    );
    expect(await deleteAccount(sql, a, T0 + 40)).toEqual({ banned: true });
    expect((await caseOf(sql, a.id))?.status).toBe("banned");
    expect(await count(sql, "fairplay_identities WHERE user_id = ?", a.id)).toBe(1);
    expect(await count(sql, "fairplay_devices WHERE user_id = ?", a.id)).toBe(1);
    expect(await sql.first("SELECT action, by FROM fairplay_log WHERE user_id = ? ORDER BY id DESC LIMIT 1", a.id)).toEqual({ action: "account deleted", by: "player" });
    // Her words and the evidence go; nothing else of hers stays.
    expect(await count(sql, "fairplay_appeals WHERE user_id = ?", a.id)).toBe(0);
    expect(await count(sql, "fairplay_matches WHERE user_id = ?", a.id)).toBe(0);
    expect(await count(sql, "users WHERE id = ?", a.id)).toBe(0);
    // A new account with her email (as Gmail-style variants normalize, here a +tag) is banned again; a new account on
    // her device goes to review.
    const g1 = await createGuest(sql, T0 + 50);
    const again = await signInWithIdentity(sql, g1.user, "email", "ann+new@example.com", {}, T0 + 51);
    expect((await banCheck(sql, again, null, T0 + 52)).banned).toBe(true);
    const g2 = await createGuest(sql, T0 + 53);
    expect((await banCheck(sql, g2.user, DEVICE, T0 + 54)).banned).toBe(false);
    expect((await caseOf(sql, g2.user.id))?.status).toBe("review");
    // The review page lists the kept ban as a deleted player, and an admin can lift it (which forgets the identity).
    expect((await openCases(sql, T0 + 55, "banned")).find((c) => c.userId === a.id)?.name).toBe("Deleted player");
    const detail = await caseDetail(sql, a.id, { email: true });
    expect(detail?.player).toMatchObject({ id: a.id, name: "Deleted player", joinedAt: null, email: null });
    expect(await decide(sql, a.id, "clear", "admin:eric@example.com", "lifted after a second look", T0 + 56)).toEqual({ ok: true, status: "cleared" });
    expect(await count(sql, "fairplay_identities WHERE user_id = ?", a.id)).toBe(0);
    // Nothing kept for an id that never had an account or a case.
    expect((await decide(sql, "nobody-at-all", "clear", "admin:eric@example.com", "no such player", T0))).toMatchObject({ ok: false, status: 404 });
  });

  it("sign-in code records go an hour after their code was sent", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const t = T0 + 100 * 3_600_000;
    await startEmailCode(sql, "old@example.com", t);
    await startEmailCode(sql, "recent@example.com", t + 30 * 60_000);
    await startEmailCode(sql, "new@example.com", t + 61 * 60_000);
    expect((await sql.all<{ email: string }>("SELECT email FROM email_codes ORDER BY email")).map((r) => r.email)).toEqual(["new@example.com", "recent@example.com"]);
  });
});

describe("the API: GET /api/me/data and POST /api/me/delete", () => {
  const origin = "https://hunchess.com";
  const call = async (env: object, path: string, init: RequestInit & { cookie?: string } = {}) => {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set("cookie", init.cookie);
    return (await handleAccountApi(new Request(origin + path, { ...init, headers }), env as never))!;
  };

  it("downloads a file, deletes only when confirmed, signs out, and the live hub forgets the account", async () => {
    const { sql, d1, ann, a } = await world();
    const forgotten: string[] = [];
    const hub = {
      accountData: async (id: string) => ({ globalChat: id === a.id ? [{ n: 1, at: T0, from: id, name: "Ann", rating: null, say: "gg" }] : [], lastSeen: T0 }),
      forgetAccount: async (id: string) => void forgotten.push(id),
    };
    const env = { DB: d1, LIVE: { idFromName: () => "hub", get: () => hub } };
    const cookie = `hc_session=${ann.token}`;
    const file = await call(env, "/api/me/data", { cookie });
    expect(file.status).toBe(200);
    expect(file.headers.get("content-disposition")).toMatch(/^attachment; filename="hunchess-data-\d{4}-\d{2}-\d{2}\.json"$/);
    const body = (await file.json()) as { account: User; globalChat: { say: string }[] };
    expect(body.account.id).toBe(a.id);
    expect(body.globalChat.map((l) => l.say)).toEqual(["gg"]);
    // Without the confirmation: nothing happens.
    expect((await call(env, "/api/me/delete", { method: "POST", cookie, body: "{}" })).status).toBe(400);
    expect(await count(sql, "users WHERE id = ?", a.id)).toBe(1);
    const done = await call(env, "/api/me/delete", { method: "POST", cookie, body: JSON.stringify({ confirm: "delete" }) });
    expect(done.status).toBe(200);
    expect(done.headers.getSetCookie().find((c) => c.startsWith("hc_session="))).toMatch(/^hc_session=; .*Max-Age=0/);
    expect(forgotten).toEqual([a.id]);
    expect(await count(sql, "users WHERE id = ?", a.id)).toBe(0);
    // The old cookie is no one's now: the account API answers as for a new device.
    expect((await call(env, "/api/me/data", { cookie })).status).toBe(401);
    expect((await call(env, `/api/profile/${a.id}`)).status).toBe(404);
  });
});

describe("the live hub's part", () => {
  const sender = (id: string) => ({ id, name: id, rating: null, icon: null, owned: [] as string[] });

  it("global chat: a deleted account's lines leave it, everyone else's stay; a player's own lines for their download", () => {
    const chat = new GlobalChat({ ...GLOBAL_CHAT, bots: false });
    const say = "l-hey";
    // (Each a gap apart, the one-message limit.)
    for (const [i, who] of ["ann", "bo", "ann"].entries()) expect(chat.post(sender(who), say, T0 + i * GLOBAL_CHAT.gapMs).ok).toBe(true);
    expect(chat.linesOf("ann")).toHaveLength(2);
    expect(chat.forgetAccount("ann")).toBe(true);
    expect(chat.snapshot(T0 + 3 * GLOBAL_CHAT.gapMs).lines.map((l) => l.from)).toEqual(["bo"]);
    expect(chat.forgetAccount("ann")).toBe(false);
  });

  it("presence: a deleted account is no longer online", () => {
    const board = new LiveBoard();
    board.markSeen(["ann", "bo"], T0);
    board.forgetSeen("ann");
    expect(board.isOnline("ann", T0 + 1)).toBe(false);
    expect(board.isOnline("bo", T0 + 1)).toBe(true);
    expect(board.lastSeen("ann")).toBeNull();
  });
});
