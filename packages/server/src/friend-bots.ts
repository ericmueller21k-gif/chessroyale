/**
 * Friend bots (Eric, Nov 20: "I want to like have some bots on my friends list that like have random activity showing, so I can ...
 * start simulating more what it actually looks like if there are real people"; docs/decisions/2026-11-20-friend-bots.md): an admin adds
 * FRIEND_BOTS.count test accounts with players' names and icons to their own friends list, and removes them again, from /admin/ops.
 * Their presence on the friends page and their profiles comes from friend-bot-schedule.ts (the time and their id: nothing written).
 *
 *   GET    /api/admin/friend-bots                → {bots}: the asker's bots, each with its presence now
 *   POST   /api/admin/friend-bots                → adds the asker's missing bots and friends them with the asker (again: none new)
 *   DELETE /api/admin/friend-bots                → deletes the asker's bots as the test accounts' delete does (account-data.ts)
 *   A form's POST (action=add|remove: /admin/ops's buttons) does the same and goes back to /admin/ops.
 *
 * Who may: an admin's session (a change only from the site itself: the origin is checked), or the e2e's local key with a session (its
 * account is the asker). The asker is the session's account, never a name or an email in the code. Anyone else: "Not found".
 *
 * Nobody else sees them: each is friends with its admin only, and as a test account (`users.test`) it's left out of the player search
 * and public rankings. Its email is `fbot-<asker's key>-<n>@test.hunchess` (no such domain: no mail, no sign-in), so adding again finds
 * the same bots, and removing finds them even if the admin unfriended one.
 */
import { FRIEND_BOTS } from "@chessroyale/core";
import { d1Sql, ensureSchema, getUser, sha256, userFromToken, type Sql } from "./accounts.ts";
import { isAdmin, type AdminEnv } from "./admin.ts";
import { SESSION_COOKIE, readCookie } from "./api.ts";
import { deleteAccount } from "./account-data.ts";
import { e2eSqlAllowed, type E2eSqlEnv } from "./e2e-sql.ts";
import { FRIEND_BOT_PREFIX, botPresence } from "./friend-bot-schedule.ts";
import { TEST_DOMAIN } from "./test-accounts.ts";

export type FriendBotsEnv = AdminEnv & E2eSqlEnv;

/** Players' names, as people pick them (each admin's bots are FRIEND_BOTS.count of these, in an order from the admin's key). */
export const BOT_NAMES = [
  "knightowl",
  "Maya R",
  "pawnstorm88",
  "Theo",
  "QueenieB",
  "rookie_jules",
  "Sam K",
  "deltaFox",
  "Ines",
  "bishop_bash",
  "Marcus T",
  "lilchecks",
  "Priya",
  "GambitGabe",
  "noah.plays",
  "Zoe W",
] as const;
/** Their icons: the emoji icons any older account may have (accounts.ts' ICONS). */
const BOT_ICONS = ["♞", "♝", "♜", "♛", "🦁", "🦊", "🐺", "🦅", "🐉", "🔥", "⚡", "🎯", "🧠"] as const;

const DAY = 86_400_000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const notFound = () => json({ message: "Not found" }, 404);

/** A short key from the admin's account id: their bots' emails carry it (the id itself stays out of an address). */
const keyOf = async (adminId: string) => (await sha256(adminId)).slice(0, 10);
const botEmail = (key: string, n: number) => `${FRIEND_BOT_PREFIX}${key}-${n}@${TEST_DOMAIN}`;
/** A number in [0, n) from a hex key and a salt (the same for the same admin every time). */
const pick = (key: string, salt: number, n: number) => parseInt(key.slice((salt * 3) % 8, ((salt * 3) % 8) + 3), 16) % n;

/** The bots' names for this admin: FRIEND_BOTS.count of BOT_NAMES, none twice, in an order of their own. */
export function botNames(key: string): string[] {
  const left: string[] = [...BOT_NAMES];
  const out: string[] = [];
  for (let i = 0; i < Math.min(FRIEND_BOTS.count, BOT_NAMES.length); i++) out.push(left.splice(pick(key, i, left.length), 1)[0]!);
  return out;
}

/** The admin's bots (by their address, friends or not). */
async function botsOf(sql: Sql, adminId: string): Promise<{ id: string; name: string }[]> {
  const key = await keyOf(adminId);
  return sql.all<{ id: string; name: string }>("SELECT id, name FROM users WHERE test = 1 AND email LIKE ? ORDER BY email", `${FRIEND_BOT_PREFIX}${key}-%@${TEST_DOMAIN}`);
}

/** The admin's bots and each one's presence now (GET; the ops page's count). */
export async function friendBots(sql: Sql, adminId: string, now: number) {
  return (await botsOf(sql, adminId)).map((b) => ({ ...b, ...botPresence(b.id, now) }));
}

/**
 * Adds the admin's missing bots (FRIEND_BOTS.count in all) and makes each one their friend, both ways, as an accepted request does. A
 * bot joined weeks ago and has been a friend for days (so its profile and the list read as a real friend's). Answers how many it made.
 */
export async function addFriendBots(sql: Sql, adminId: string, now: number): Promise<number> {
  const key = await keyOf(adminId);
  const names = botNames(key);
  let made = 0;
  for (let n = 0; n < names.length; n++) {
    const email = botEmail(key, n);
    const id = `${FRIEND_BOT_PREFIX}${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const joined = now - (10 + pick(key, n + 3, 80)) * DAY;
    // (One statement: two taps at once make one bot; the second finds it.)
    await sql.run(
      "INSERT INTO users (id, name, icon, email, created_at, last_seen, test, pawn_color) VALUES (?, ?, ?, ?, ?, ?, 1, ?) ON CONFLICT (email) DO NOTHING",
      id,
      names[n]!,
      BOT_ICONS[pick(key, n + 5, BOT_ICONS.length)]!,
      email,
      joined,
      now,
      pick(key, n + 7, 3) === 0 ? "black" : "white",
    );
    const bot = await sql.first<{ id: string; test: number | null }>("SELECT id, test FROM users WHERE email = ?", email);
    if (!bot || bot.test !== 1) continue;
    if (bot.id === id) made++;
    const since = now - (1 + pick(key, n + 9, 20)) * DAY;
    await sql.run("INSERT INTO friends (user_id, friend_id, since) VALUES (?, ?, ?), (?, ?, ?) ON CONFLICT DO NOTHING", adminId, bot.id, since, bot.id, adminId, since);
  }
  return made;
}

/** Deletes the admin's bots as any account is deleted (their friendships go with them). Answers how many. */
export async function removeFriendBots(sql: Sql, adminId: string, now: number): Promise<number> {
  const bots = await botsOf(sql, adminId);
  for (const b of bots) {
    const user = await getUser(sql, b.id);
    if (user) await deleteAccount(sql, user, now, { purgeFairPlay: true });
  }
  return bots.length;
}

/**
 * The asker's account id, if they may: an admin's session (a change only from the site itself), or the e2e's key with a session.
 * Null for anyone else.
 */
async function asker(request: Request, env: FriendBotsEnv, sql: Sql, now: number): Promise<{ id: string; who: string } | null> {
  const user = await userFromToken(sql, readCookie(request, SESSION_COOKIE), now);
  if (!user) return null;
  if (e2eSqlAllowed(env.E2E_SQL, request.headers.get("x-e2e-sql"))) return { id: user.id, who: "e2e" };
  if (!isAdmin(env, user)) return null;
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) return null;
  return { id: user.id, who: `admin:${user.email!.toLowerCase()}` };
}

/** The route (null: not it). */
export async function handleFriendBots(request: Request, env: FriendBotsEnv, opts: { now?: number } = {}): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/admin/friend-bots") return null;
  if (!env.DB) return notFound();
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const now = opts.now ?? Date.now();
  const me = await asker(request, env, sql, now);
  if (!me) return notFound();
  if (request.method === "GET") return json({ bots: await friendBots(sql, me.id, now) });
  // (The ops page's buttons: a form's POST, action=add or remove, then back to the page.)
  const form = (request.headers.get("content-type") ?? "").startsWith("application/x-www-form-urlencoded");
  const action = request.method === "DELETE" ? "remove" : request.method !== "POST" ? null : form ? String((await request.formData()).get("action") ?? "") : "add";
  if (action !== "add" && action !== "remove") return json({ message: "GET, POST or DELETE" }, 405);
  const done = action === "add" ? { added: await addFriendBots(sql, me.id, now) } : { removed: await removeFriendBots(sql, me.id, now) };
  console.log(`friend bots: ${JSON.stringify(done)} for ${me.who}`);
  if (form) return new Response(null, { status: 303, headers: { location: "/admin/ops#friend-bots", "cache-control": "no-store" } });
  return json({ ...done, bots: await friendBots(sql, me.id, now) });
}
