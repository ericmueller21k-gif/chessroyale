import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
  purgeEmailCodes,
  recordResult,
  setChatPicks,
  signInWithIdentity,
  startEmailCode,
  userFromToken,
  type Sql,
  type User,
} from "../src/accounts.ts";
import { ACCOUNT_STORES, COVERED_TABLES, NO_ACCOUNT_DATA, accountDownload, deleteAccount } from "../src/account-data.ts";
import { handleAccountApi } from "../src/api.ts";
import { caseDetail, openCases } from "../src/admin.ts";
import { appeal, banCheck, caseOf, decide, recordFairPlay, reportPlayer, setCase } from "../src/fairplay.ts";
import { answerRequest, block, sendInvite, sendRequest, setFriendSettings } from "../src/friends.ts";
import { GlobalChat } from "../src/global-chat.ts";
import { LiveBoard } from "../src/live.ts";
import { equipLocker, openCrate } from "../src/locker.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Deleting an account and downloading its data (account-data.ts; docs/decisions/2026-10-15-delete-my-account-and-download-my-data.md):
 * every table accounted for, every store's rows in the download, none left after deleting (results kept without the
 * player, fair play's file kept for a ban or a review), all in one transaction, and the API.
 */
const T0 = 1_800_000_000_000;
const DAY = 86_400_000;
const DEVICE = "device-marker-0123456789";
const SRC = join(dirname(fileURLToPath(import.meta.url)), "../src");
const count = async (sql: Sql, q: string, ...p: unknown[]) => (await sql.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${q}`, ...p))!.n;
const tablesOf = async (sql: Sql) => (await sql.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).map((t) => t.name);

/** Every row of every table that mentions this id anywhere (any column, JSON inside a column too). */
async function rowsNaming(sql: Sql, id: string, skip: readonly string[] = []) {
  const found: string[] = [];
  for (const t of await tablesOf(sql)) {
    if (skip.includes(t)) continue;
    for (const row of await sql.all<Record<string, unknown>>(`SELECT * FROM ${t}`)) if (JSON.stringify(row).includes(id)) found.push(`${t}: ${JSON.stringify(row).slice(0, 120)}`);
  }
  return found;
}

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
  await recordResult(sql, a.id, { mode: "crowd", online: true, placement: 3, players: 100, lobby: "ABCDE", ranked: true, rating: 1400, bestMove: "Nf3", evalBar: true }, T0 + 1);
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
  // Friends: Bo is her friend, Cy has asked her, an invite to Bo; her settings.
  await sendRequest(sql, a.id, bo.user.id, false, T0 + 8);
  await answerRequest(sql, bo.user.id, a.id, true, T0 + 9);
  await sendRequest(sql, cy.user.id, a.id, false, T0 + 10);
  expect((await sendInvite(sql, a.id, bo.user.id, "crowd", "FGHJK", false, T0 + 11)).ok).toBe(true);
  await setFriendSettings(sql, a.id, { invites: "friends", showOnline: false });
  // Ops: her bug report and an error record with her account in its sample; feedback (no account); Bo's error.
  const sample = (account: string | null) => JSON.stringify({ stack: "at x", where: { screen: "home" }, trail: [], device: { ua: "Phone" }, version: "v1", account, at: T0 });
  await sql.run("INSERT INTO ops_reports (id, at, kind, account, version, note, diag) VALUES ('BUG123', ?, 'bug', ?, 'v1', 'the board froze', ?)", T0 + 12, a.id, JSON.stringify({ account: a.id }));
  await sql.run("INSERT INTO ops_reports (id, at, kind, account, version, note, diag) VALUES ('IDEA45', ?, 'idea', NULL, '', 'more bosses', '{}')", T0 + 12);
  await sql.run("INSERT INTO ops_errors (fingerprint, hour, source, kind, message, version, count, first_seen, last_seen, sample) VALUES ('fp1', ?, 'client', 'error', 'boom', 'v1', 3, ?, ?, ?)", T0, T0, T0 + 13, sample(a.id));
  await sql.run("INSERT INTO ops_errors (fingerprint, hour, source, kind, message, version, count, first_seen, last_seen, sample) VALUES ('fp2', ?, 'client', 'error', 'bang', 'v1', 1, ?, ?, ?)", T0, T0, T0, sample(bo.user.id));
  return { sql, d1, ann, bo, cy, a, phone };
}

/**
 * Every table's columns, pinned. A schema change (a new table or column, from SCHEMA or a COLUMNS migration) fails
 * here until someone checks it against ACCOUNT_STORES and NO_ACCOUNT_DATA (account-data.ts), and for `results`, the
 * kept columns (KEPT_RESULT), then updates this list.
 */
const SCHEMA_COLUMNS: Record<string, string> = {
  blocks: "user_id blocked_id at",
  chat_picks: "user_id lines emoji",
  email_codes: "email code_hash expires_at attempts sent_at hour_start sends_this_hour",
  equipped: "user_id slot item_id",
  equipped_items: "user_id slot item_id",
  fairplay_appeals: "id user_id at text status decided_at decided_by reply",
  fairplay_budget: "day searches",
  fairplay_cases: "user_id status reason opened_at updated_at decided_at decided_by",
  fairplay_devices: "device user_id first_seen last_seen",
  fairplay_identities: "kind hash user_id at",
  fairplay_log: "id user_id at action by reason",
  fairplay_matches: "id user_id lobby mode played_at counted perf score level summary moves keep_until deep_queued deep_done",
  friend_limits: "user_id kind window_start n",
  friend_requests: "from_id to_id at",
  friends: "user_id friend_id since",
  inventory: "user_id item_id acquired_at",
  invites: "from_id to_id kind code at expires_at",
  items: "id user_id def color blemish seed crate fischer created_at color2",
  live_lobbies: "code mode kind phase humans alive total boss_elo started_at updated_at",
  meta: "key value",
  ops_errors: "fingerprint hour source kind message version count first_seen last_seen sample",
  ops_reports: "id at kind account version note diag",
  queue_waits: "id mode at players wait_ms",
  reports: "id reporter target reason at match",
  results:
    "id user_id mode online placement players team team_won avg_score rating played_at brilliant best_move cuts cuts_survived strikes strikes_survived survived last_stand boss_elo boss_id lobby ranked held eval_bar",
  sessions: "token_hash user_id created_at expires_at",
  users: "id name icon email google_sub created_at last_seen rating allow_invites hide_online",
  wallets: "user_id coins crates",
};

/** The server's source files, every folder. */
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? sources(join(dir, f)) : f.endsWith(".ts") ? [join(dir, f)] : []));

describe("every table is accounted for", () => {
  it("every table's columns are as pinned: a schema change means checking account-data.ts, then this list", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const now: Record<string, string> = {};
    for (const t of (await tablesOf(sql)).sort()) now[t] = (await sql.all<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name).join(" ");
    expect(now, "the schema changed: check ACCOUNT_STORES and NO_ACCOUNT_DATA (account-data.ts), then update SCHEMA_COLUMNS").toEqual(SCHEMA_COLUMNS);
  });

  it("each table, in the schema or made anywhere in the server's code, is an account store's or listed as holding no account data", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const made = new Set(await tablesOf(sql));
    // (Tables made outside the schema, such as engine_usage, by their CREATE TABLE anywhere in the server, any folder.)
    for (const f of sources(SRC)) {
      for (const m of readFileSync(f, "utf8").matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?["`]?(\w+)/gi)) made.add(m[1]!);
    }
    expect(made.size).toBeGreaterThan(25);
    for (const t of made) {
      expect(COVERED_TABLES.includes(t) || t in NO_ACCOUNT_DATA, `${t}: give it an entry in ACCOUNT_STORES, or list it in NO_ACCOUNT_DATA (account-data.ts)`).toBe(true);
    }
    for (const t of Object.keys(NO_ACCOUNT_DATA)) expect(COVERED_TABLES, `${t} is in both`).not.toContain(t);
  });
});

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
    // Results, without `held` (it would say whether fair play holds them).
    expect(d.results.map((r: { mode: string; lobby: string | null }) => [r.mode, r.lobby])).toEqual([
      ["crowd", "ABCDE"],
      ["boss", null],
    ]);
    expect(d.results[0]).not.toHaveProperty("held");
    expect(d.shop.wallet).toEqual({ coins: 50, crates: 2 });
    expect(d.shop.items.map((i: { item_id: string }) => i.item_id)).toContain(SHOP_ITEMS.find((i) => i.slot === "chat" && !i.starter)!.id);
    expect(d.locker.items).toHaveLength(1);
    expect(d.reports).toEqual({ made: [{ target: bo.user.id, reason: "Cheating", match: "ABCDE", at: new Date(T0 + 5).toISOString() }] });
    expect(d.fairPlay).toEqual({ banned: false, appeals: [] });
    expect(d.friends.friends.map((f: { id: string; name: string }) => [f.id, f.name])).toEqual([[bo.user.id, "Bo"]]);
    expect(d.friends.requestsReceived.map((r: { id: string }) => r.id)).toEqual([cy.user.id]);
    expect(d.friends.requestsSent).toEqual([]);
    expect(d.friends.invitesSent).toMatchObject([{ id: bo.user.id, kind: "crowd", code: "FGHJK" }]);
    expect(d.friends.limits.length).toBeGreaterThan(0);
    // Her bug report and the error record with her account; not the anonymous idea, not Bo's error.
    expect(d.problemReports.reports.map((r: { id: string; note: string }) => [r.id, r.note])).toEqual([["BUG123", "the board froze"]]);
    expect(d.problemReports.errors.map((e: { message: string; hour: string }) => [e.message, e.hour])).toEqual([["boom", new Date(T0).toISOString()]]);
    // Nothing of anyone else's but the names the app shows her: no other email, no report about her, no hash.
    const text = JSON.stringify(d);
    for (const secret of ["bo@example.com", "cy@example.com", "Offensive name or icon", "token_hash", "code_hash", DEVICE, "more bosses", "bang"]) expect(text).not.toContain(secret);
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
  it("removes everything personal, everywhere, and keeps the results without the player", async () => {
    const { sql, ann, bo, cy, a, phone } = await world();
    const oldIds = (await sql.all<{ id: number }>("SELECT id FROM results WHERE user_id = ?", a.id)).map((r) => r.id);
    const maxIdBefore = (await sql.first<{ m: number }>("SELECT MAX(id) AS m FROM results"))!.m;
    expect(oldIds).toHaveLength(2);
    expect(await deleteAccount(sql, a, T0 + 40)).toEqual({ keptFairPlay: false });
    // Not a row anywhere mentions her: every table, every column, JSON inside columns too.
    expect(await rowsNaming(sql, a.id)).toEqual([]);
    expect(await rowsNaming(sql, "ann@example.com")).toEqual([]);
    // Signed out everywhere: both devices' sessions are gone.
    expect(await userFromToken(sql, ann.token, T0 + 41)).toBeNull();
    expect(await userFromToken(sql, phone, T0 + 41)).toBeNull();
    expect(await publicProfile(sql, a.id, T0 + 41)).toBeNull();
    // Her results stay as nobody's, under new ids after every row that was there (her old ids sat beside Bo's row from
    // the same match): the shared deleted id, the day only, no lobby, rating, best move or eval bar.
    const kept = await sql.all<{ id: number }>("SELECT id FROM results WHERE user_id = ?", DELETED_ID);
    expect(kept).toHaveLength(2);
    for (const { id } of kept) expect(id).toBeGreaterThan(maxIdBefore);
    expect(await count(sql, "results WHERE id IN (" + oldIds.join(",") + ")")).toBe(0);
    expect(await sql.all("SELECT mode, placement, players, played_at, lobby, rating, best_move, eval_bar FROM results WHERE user_id = ? ORDER BY mode", DELETED_ID)).toEqual([
      { mode: "boss", placement: 1, players: 20, played_at: T0 - (T0 % DAY), lobby: null, rating: null, best_move: null, eval_bar: null },
      { mode: "crowd", placement: 3, players: 100, played_at: T0 - (T0 % DAY), lobby: null, rating: null, best_move: null, eval_bar: null },
    ]);
    expect(await publicProfile(sql, DELETED_ID, T0 + 41)).toBeNull();
    expect((await profile(sql, bo.user)).stats.all.matches).toBe(1);
    // Her friendships, requests and invites are gone from the others' lists too; Bo keeps his item, his error record.
    expect(await count(sql, "friends WHERE user_id = ?", bo.user.id)).toBe(0);
    expect(await count(sql, "friend_requests WHERE from_id = ?", cy.user.id)).toBe(0);
    expect(await count(sql, "items WHERE user_id = ?", bo.user.id)).toBe(1);
    // Her error record stays counted, without her; the anonymous idea stays.
    expect(await sql.all("SELECT fingerprint, count FROM ops_errors ORDER BY fingerprint")).toEqual([
      { fingerprint: "fp1", count: 3 },
      { fingerprint: "fp2", count: 1 },
    ]);
    expect(await sql.all("SELECT id FROM ops_reports")).toEqual([{ id: "IDEA45" }]);
    // Nothing of fair play kept for an account that wasn't banned or in review.
    expect(await caseOf(sql, a.id)).toBeNull();
    // Signing in with her email again makes a new, empty account.
    const g = await createGuest(sql, T0 + 50);
    const again = await signInWithIdentity(sql, g.user, "email", "ann@example.com", {}, T0 + 51);
    expect(again.id).not.toBe(a.id);
    expect((await profile(sql, again)).stats.all.matches).toBe(0);
  });

  it("is one transaction: a statement that fails leaves everything as it was", async () => {
    const { sql, a } = await world();
    const before = await rowsNaming(sql, a.id);
    // (Every write goes through the batch: a plain run would throw here.)
    const failing: Sql = {
      ...sql,
      run: async () => {
        throw new Error("deleteAccount must write through one batch");
      },
      batch: (statements) => sql.batch([...statements, { sql: "INSERT INTO no_such_table VALUES (1)", params: [] }]),
    };
    await expect(deleteAccount(failing, a, T0 + 40)).rejects.toThrow();
    expect(await rowsNaming(sql, a.id)).toEqual(before);
    expect(await count(sql, "users WHERE id = ?", a.id)).toBe(1);
  });

  it("a match, a reward or fair play that finishes after the deletion records nothing", async () => {
    const { sql, a } = await world();
    await deleteAccount(sql, a, T0 + 40);
    await recordResult(sql, a.id, { mode: "crowd", online: true, placement: 1, players: 100, lobby: "QWERT", ranked: true, rating: 1500 }, T0 + 41);
    await grantReward(sql, a.id, 100, 1);
    expect((await recordFairPlay(sql, a.id, { lobby: "QWERT", mode: "crowd", moves: [] }, T0 + 42)).acted).toBe("none");
    expect(await rowsNaming(sql, a.id)).toEqual([]);
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
    expect(await deleteAccount(sql, a, T0 + 40)).toEqual({ keptFairPlay: true });
    expect((await caseOf(sql, a.id))?.status).toBe("banned");
    expect(await count(sql, "fairplay_identities WHERE user_id = ?", a.id)).toBe(1);
    expect(await count(sql, "fairplay_devices WHERE user_id = ?", a.id)).toBe(1);
    expect(await sql.first("SELECT action, by FROM fairplay_log WHERE user_id = ? ORDER BY id DESC LIMIT 1", a.id)).toEqual({ action: "account deleted", by: "player" });
    // Only fair play's file names her; her words and the evidence are gone.
    expect((await rowsNaming(sql, a.id, ["fairplay_cases", "fairplay_log", "fairplay_identities", "fairplay_devices"])).length).toBe(0);
    expect(await count(sql, "fairplay_appeals WHERE user_id = ?", a.id)).toBe(0);
    expect(await count(sql, "fairplay_matches WHERE user_id = ?", a.id)).toBe(0);
    // A new account with her email (normalized: a +tag) is banned again; a new account on her device goes to review.
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
    expect(await decide(sql, "nobody-at-all", "clear", "admin:eric@example.com", "no such player", T0)).toMatchObject({ ok: false, status: 404 });
  });

  it("a review outlives the account too: a new account with the same email goes back to review, never told why", async () => {
    const { sql, a } = await world();
    await setCase(sql, a.id, "review", "detection", "engine-like moves", T0 + 20);
    expect(await deleteAccount(sql, a, T0 + 40)).toEqual({ keptFairPlay: true });
    expect((await caseOf(sql, a.id))?.status).toBe("review");
    expect(await count(sql, "fairplay_identities WHERE user_id = ?", a.id)).toBe(1);
    const g = await createGuest(sql, T0 + 50);
    const again = await signInWithIdentity(sql, g.user, "email", "ann@example.com", {}, T0 + 51);
    expect((await banCheck(sql, again, null, T0 + 52)).banned).toBe(false);
    expect((await caseOf(sql, again.id))?.status).toBe("review");
    // Asking again doesn't pile up notes.
    const notes = await count(sql, "fairplay_log WHERE user_id = ?", again.id);
    await banCheck(sql, again, null, T0 + 53);
    expect(await count(sql, "fairplay_log WHERE user_id = ?", again.id)).toBe(notes);
    // The automated reviewer can't decide it (no evidence is left to weigh); a person clearing it forgets its identity.
    expect(await decide(sql, a.id, "clear", "reviewer", "nothing in it after all", T0 + 60)).toMatchObject({ ok: false, status: 409 });
    expect(await count(sql, "fairplay_identities WHERE user_id = ?", a.id)).toBe(1);
    expect(await decide(sql, a.id, "clear", "admin:eric@example.com", "nothing in it after all", T0 + 61)).toEqual({ ok: true, status: "cleared" });
    expect(await count(sql, "fairplay_identities WHERE user_id = ?", a.id)).toBe(0);
  });

  it("an identity shared by two deleted bans stays banned", async () => {
    const { sql, a } = await world();
    await setCase(sql, a.id, "banned", "admin:eric@example.com", "engine moves", T0 + 20);
    await deleteAccount(sql, a, T0 + 40);
    // A new account with the same email: banned by evasion; then it's deleted too.
    const g = await createGuest(sql, T0 + 50);
    const again = await signInWithIdentity(sql, g.user, "email", "ann@example.com", {}, T0 + 51);
    expect((await banCheck(sql, again, null, T0 + 52)).banned).toBe(true);
    expect(await deleteAccount(sql, again, T0 + 60)).toEqual({ keptFairPlay: true });
    // One row for the identity (its key is the identity), a banned deleted account's; a third account is banned too.
    const owners = await sql.all<{ user_id: string }>("SELECT user_id FROM fairplay_identities WHERE kind = 'email'");
    expect(owners).toHaveLength(1);
    expect([a.id, again.id]).toContain(owners[0]!.user_id);
    expect((await caseOf(sql, owners[0]!.user_id))?.status).toBe("banned");
    const g3 = await createGuest(sql, T0 + 70);
    const third = await signInWithIdentity(sql, g3.user, "email", "ann@example.com", {}, T0 + 71);
    expect((await banCheck(sql, third, null, T0 + 72)).banned).toBe(true);
  });

  it("sign-in code records go an hour after their code was sent (the Worker's schedule)", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    await startEmailCode(sql, "old@example.com", T0);
    await startEmailCode(sql, "recent@example.com", T0 + 30 * 60_000);
    await purgeEmailCodes(sql, T0 + 61 * 60_000);
    expect((await sql.all<{ email: string }>("SELECT email FROM email_codes")).map((r) => r.email)).toEqual(["recent@example.com"]);
  });
});

describe("the API: GET /api/me/data and POST /api/me/delete", () => {
  const origin = "https://hunchess.com";
  const call = async (env: object, path: string, init: RequestInit & { cookie?: string } = {}) => {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set("cookie", init.cookie);
    return (await handleAccountApi(new Request(origin + path, { ...init, headers }), env as never))!;
  };
  const json = { origin, "content-type": "application/json" };

  it("downloads a file; deletes only when asked from this site, as JSON, confirmed; signs out; the live hub forgets", async () => {
    const { sql, d1, ann, a } = await world();
    const forgotten: string[] = [];
    const hub = {
      accountData: async (id: string) => ({ globalChat: id === a.id ? [{ n: 1, at: T0, from: id, name: "Ann", rating: null, say: "gg" }] : [] }),
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
    const confirm = JSON.stringify({ confirm: "delete" });
    // From another site (or no origin), as a form's text, or unconfirmed: nothing happens.
    expect((await call(env, "/api/me/delete", { method: "POST", cookie, headers: { "content-type": "application/json" }, body: confirm })).status).toBe(403);
    expect((await call(env, "/api/me/delete", { method: "POST", cookie, headers: { ...json, origin: "https://www.hunchess.com" }, body: confirm })).status).toBe(403);
    expect((await call(env, "/api/me/delete", { method: "POST", cookie, headers: { origin, "content-type": "text/plain" }, body: confirm })).status).toBe(415);
    expect((await call(env, "/api/me/delete", { method: "POST", cookie, headers: json, body: "{}" })).status).toBe(400);
    expect(await count(sql, "users WHERE id = ?", a.id)).toBe(1);
    const done = await call(env, "/api/me/delete", { method: "POST", cookie, headers: json, body: confirm });
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
    // (Each a gap apart, the one-message limit.)
    for (const [i, who] of ["ann", "bo", "ann"].entries()) expect(chat.post(sender(who), "l-hey", T0 + i * GLOBAL_CHAT.gapMs).ok).toBe(true);
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
