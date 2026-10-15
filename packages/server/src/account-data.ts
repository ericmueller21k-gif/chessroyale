/**
 * Everything the game keeps about one account, in one place: the player's download ("Download my data", GET
 * /api/me/data) and deleting the account ("Delete account", POST /api/me/delete). See DECISIONS.md, "Delete my account
 * and download my data", and docs/areas/accounts.md.
 *
 * Every store that keeps something about a player has its entry in ACCOUNT_STORES: what goes in the download, and
 * what deleting the account does to it. **A feature that stores something new about a player adds its entry here in
 * the same PR** (and its line in the privacy policy, screens/Legal.tsx); `account-data.test.ts` checks every table
 * with a player column is covered.
 *
 * Deleting removes everything personal. What stays, and why:
 *   - results, without the player: their rows move to the account id DELETED_ID and lose their lobby code, so the
 *     game's own numbers (how often each boss wins, typical placements) stay right while nothing ties them to anyone;
 *   - a fair-play ban: the case, its log, the hashed email and Google id (fairplay_identities) and the device markers,
 *     under the deleted account's random id, so deleting an account never lifts a ban (a new account with the same
 *     identity is banned again). Everything else of fair play goes (judged moves, match summaries, appeals, reports).
 * The users row and the sessions go last, so a deletion that stops halfway can be run again from the same session.
 */
import { DELETED_ID, type Sql, type User } from "./accounts.ts";
import { caseOf, identityHashes, logCase } from "./fairplay.ts";

/** One store's part of an account: its share of the download, and what deleting the account does to it. */
export interface AccountStore {
  /** Its key in the download. */
  name: string;
  /** The tables it covers (the test checks every table with a player column is someone's). */
  tables: readonly string[];
  /** The player's rows, for the download. */
  export(sql: Sql, user: User): Promise<unknown>;
  /** Deletes the player's rows, or keeps what must stay (saying why above). */
  erase(sql: Sql, user: User, ctx: { now: number; banned: boolean }): Promise<void>;
}

const all = (sql: Sql, q: string, ...p: unknown[]) => sql.all<Record<string, unknown>>(q, ...p);

export const ACCOUNT_STORES: AccountStore[] = [
  {
    name: "signInCode",
    tables: ["email_codes"],
    // The latest code sent to the account's email (never the code itself, only that one was sent).
    export: async (sql, u) => (u.email ? await sql.first("SELECT email, sent_at, expires_at, attempts FROM email_codes WHERE email = ?", u.email) : null),
    erase: async (sql, u) => {
      if (u.email) await sql.run("DELETE FROM email_codes WHERE email = ?", u.email);
    },
  },
  {
    name: "results",
    tables: ["results"],
    export: (sql, u) => all(sql, "SELECT * FROM results WHERE user_id = ? ORDER BY played_at, id", u.id),
    erase: async (sql, u) => {
      await sql.run("UPDATE results SET user_id = ?, lobby = NULL WHERE user_id = ?", DELETED_ID, u.id);
    },
  },
  {
    name: "shop",
    tables: ["wallets", "inventory", "equipped", "chat_picks"],
    export: async (sql, u) => ({
      wallet: await sql.first("SELECT coins, crates FROM wallets WHERE user_id = ?", u.id),
      items: await all(sql, "SELECT item_id, acquired_at FROM inventory WHERE user_id = ?", u.id),
      equipped: await all(sql, "SELECT slot, item_id FROM equipped WHERE user_id = ?", u.id),
      chatPicks: await sql.first("SELECT lines, emoji FROM chat_picks WHERE user_id = ?", u.id),
    }),
    erase: async (sql, u) => {
      for (const t of ["wallets", "inventory", "equipped", "chat_picks"]) await sql.run(`DELETE FROM ${t} WHERE user_id = ?`, u.id);
    },
  },
  {
    name: "locker",
    tables: ["items", "equipped_items"],
    export: async (sql, u) => ({
      items: await all(sql, "SELECT * FROM items WHERE user_id = ? ORDER BY created_at", u.id),
      equipped: await all(sql, "SELECT slot, item_id FROM equipped_items WHERE user_id = ?", u.id),
    }),
    erase: async (sql, u) => {
      await sql.run("DELETE FROM equipped_items WHERE user_id = ?", u.id);
      await sql.run("DELETE FROM items WHERE user_id = ?", u.id);
    },
  },
  {
    // Reports the player made (about other players), and reports about them.
    name: "reportsMade",
    tables: ["reports"],
    export: (sql, u) => all(sql, "SELECT target, reason, match, at FROM reports WHERE reporter = ? ORDER BY at", u.id),
    erase: async (sql, u) => {
      await sql.run("DELETE FROM reports WHERE reporter = ? OR target = ?", u.id, u.id);
    },
  },
  {
    // The download has what the player already sees of fair play (banned or not, their appeals and the replies). The
    // detection's own records (judged moves, scores, case notes, reports about them, device markers) are left out, as
    // they'd show how cheating is found: a person answers a request for them (the privacy policy says so).
    name: "fairPlay",
    tables: ["fairplay_cases", "fairplay_log", "fairplay_matches", "fairplay_identities", "fairplay_devices", "fairplay_appeals"],
    export: async (sql, u) => ({
      banned: (await caseOf(sql, u.id))?.status === "banned",
      appeals: await all(sql, "SELECT at, text, status, decided_at, reply FROM fairplay_appeals WHERE user_id = ? ORDER BY at", u.id),
    }),
    erase: async (sql, u, { now, banned }) => {
      await sql.run("DELETE FROM fairplay_matches WHERE user_id = ?", u.id);
      await sql.run("DELETE FROM fairplay_appeals WHERE user_id = ?", u.id);
      if (banned) {
        // The ban outlives the account: its identities (hashed) as they are now, with its case, log and device markers.
        for (const [kind, hash] of await identityHashes(u)) {
          await sql.run("INSERT OR REPLACE INTO fairplay_identities (kind, hash, user_id, at) VALUES (?, ?, ?, ?)", kind, hash, u.id, now);
        }
        await logCase(sql, u.id, "account deleted", "player", "the player deleted their account; the ban, its hashed identities and device markers are kept", now);
        return;
      }
      for (const t of ["fairplay_cases", "fairplay_log", "fairplay_identities", "fairplay_devices"]) await sql.run(`DELETE FROM ${t} WHERE user_id = ?`, u.id);
    },
  },
];

/** The account itself (users) and its sessions: first in the download, last to go. */
const ACCOUNT_TABLES = ["users", "sessions"] as const;
/** Every table this file covers (for the test). */
export const COVERED_TABLES = [...ACCOUNT_TABLES, ...ACCOUNT_STORES.flatMap((s) => s.tables)];

/** Times in the download as dates, not milliseconds. */
const readable = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(readable);
  if (!v || typeof v !== "object") return v;
  return Object.fromEntries(
    Object.entries(v).map(([k, x]) => [k, typeof x === "number" && /(_at|_seen|_until)$/.test(k) && x > 1e11 ? new Date(x).toISOString() : readable(x)]),
  );
};

export const DOWNLOAD_ABOUT =
  "Everything HunChess keeps about your account, as of exportedAt. Times are UTC. Fair play's detection records (judged moves, match scores, case notes, reports about you, device markers) aren't included: email privacy@hunchess.com for them, and a person will answer.";

/** "Download my data": everything kept about the account, readable. `extra`: what Durable Objects hold (the live hub's). */
export async function accountDownload(sql: Sql, user: User, now: number, extra: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    exportedAt: new Date(now).toISOString(),
    about: DOWNLOAD_ABOUT,
    account: await sql.first("SELECT * FROM users WHERE id = ?", user.id),
    sessions: await all(sql, "SELECT created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at", user.id),
  };
  for (const s of ACCOUNT_STORES) out[s.name] = await s.export(sql, user);
  return readable({ ...out, ...extra }) as Record<string, unknown>;
}

/**
 * Deletes an account: every store's part (ACCOUNT_STORES), then the account and its sessions, so it's signed out on
 * every device. What stays and why: this file's header. Safe to run again if it stopped halfway.
 */
export async function deleteAccount(sql: Sql, user: User, now: number): Promise<{ banned: boolean }> {
  const banned = (await caseOf(sql, user.id))?.status === "banned";
  for (const s of ACCOUNT_STORES) await s.erase(sql, user, { now, banned });
  await sql.run("DELETE FROM users WHERE id = ?", user.id);
  await sql.run("DELETE FROM sessions WHERE user_id = ?", user.id);
  return { banned };
}
