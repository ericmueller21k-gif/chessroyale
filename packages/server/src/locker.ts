import { CRATES_FREE, ITEM_SLOTS, adminCopies, adminCopyDef, crateDef, isAdminCopy, itemDef, mulberry32, rollCrate, type CrateRoll, type ItemInstance, type ItemLook, type ItemSlot } from "@chessroyale/core";
import type { Sql, Stmt } from "./accounts.ts";
import { bossCrateHoldings, tokenHoldings } from "./boss-tokens.ts";
import { welcomeState, type WelcomeState } from "./welcome.ts";
import { applyOp, deleteItems, keyFor, leg, ledgerAccount, opKeys } from "./ledger.ts";

/**
 * The locker: crate items a player owns (each with its own color, blemish and seed) and what's equipped in each
 * slot. Crates are opened here, on the server, so nobody can make themselves a Pearl crown.
 */
export const LOCKER_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    def TEXT NOT NULL,
    color TEXT NOT NULL,
    blemish REAL NOT NULL,
    seed INTEGER NOT NULL,
    crate TEXT NOT NULL,
    fischer INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS items_user ON items (user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS equipped_items (
    user_id TEXT NOT NULL,
    slot TEXT NOT NULL,
    item_id TEXT NOT NULL,
    PRIMARY KEY (user_id, slot)
  )`,
];

/** Columns added after the tables first shipped (each run once; "duplicate column" afterwards is fine). */
export const LOCKER_MIGRATIONS = [`ALTER TABLE items ADD COLUMN color2 TEXT`];

/**
 * Who's an admin (admin.ts, isAdmin, with the Worker's ADMIN_EMAILS). An admin's locker has one of every item: admin
 * copies (core/admin-copies.ts), never stored, which only wearing takes. Everywhere else the default is nobody.
 */
export type AdminCheck = (user: { email: string | null }) => boolean;
export const NO_ADMINS: AdminCheck = () => false;

export interface LockerState {
  items: ItemInstance[];
  equipped: Partial<Record<ItemSlot, string>>;
  /** What you wear, ready to show (and to send to a lobby). */
  look: ItemLook;
  /** Crates you have (null: unlimited, while testing). */
  crates: number | null;
  /** Crate keys you have (a boss crate takes one; stored since Nov 2, 2026: until then always null, unlimited). */
  keys: number;
  /** Boss tokens you have, by boss (only those you have some of): boss-tokens.ts. */
  tokens: Record<string, number>;
  /** Boss crates you bought and haven't opened, by crate id ("boss-tiger": only those you have some of; Nov 2): boss-tokens.ts. */
  bossCrates: Record<string, number>;
  /** The HunChess Welcome Crate (Nov 6): earned or not, opened or not, its one-time notice, the finished games so far (welcome.ts). */
  welcome: WelcomeState;
}

/** A player's locker. `admin`: theirs is an admin's, so it has an admin copy of every item they don't own. */
export async function lockerState(sql: Sql, userId: string, admin = false): Promise<LockerState> {
  const stored = await sql.all<ItemInstance>("SELECT id, def, color, color2, blemish, seed FROM items WHERE user_id = ? ORDER BY created_at DESC", userId);
  const items = admin ? [...stored, ...adminCopies(stored)] : stored;
  const rows = await sql.all<{ slot: ItemSlot; item_id: string }>("SELECT slot, item_id FROM equipped_items WHERE user_id = ?", userId);
  const equipped: LockerState["equipped"] = {};
  const look: ItemLook = {};
  // An admin's worn admin copy of an item they've since really got (so it has no copy): the purest real one of that item
  // shows in the slot. Read only: what's stored still names the copy.
  const realFor = (id: string) => (admin ? stored.filter((i) => i.def === adminCopyDef(id)?.id).sort((a, b) => a.blemish - b.blemish)[0] : undefined);
  for (const r of rows) {
    const it = items.find((i) => i.id === r.item_id) ?? realFor(r.item_id);
    if (!it || itemDef(it.def)?.slot !== r.slot) continue;
    equipped[r.slot] = it.id;
    look[r.slot] = { def: it.def, color: it.color, blemish: it.blemish, seed: it.seed, ...(it.color2 ? { color2: it.color2 } : {}) };
  }
  for (const it of items) if (!it.color2) delete it.color2;
  // (Crates earned, e.g. Squads' placement rewards, are counted in the wallet for when crates stop being free.)
  const earned = CRATES_FREE ? null : ((await sql.first<{ crates: number | null }>("SELECT crates FROM wallets WHERE user_id = ?", userId).catch(() => null))?.crates ?? 0);
  const { tokens, keys } = await tokenHoldings(sql, userId);
  return { items, equipped, look, crates: earned, keys, tokens, bossCrates: await bossCrateHoldings(sql, userId), welcome: await welcomeState(sql, userId) };
}

/**
 * What several players wear (their looks only, as `lockerState(…).look`), in one read: equipped items joined to the
 * items. A player with nothing on (or no such player) is missing from the map. `admins`: those of them who are admins,
 * read as `lockerState` reads theirs (admin copies they wear included).
 */
export async function looksOf(sql: Sql, userIds: readonly string[], admins: ReadonlySet<string> = new Set()): Promise<Map<string, ItemLook>> {
  const out = new Map<string, ItemLook>();
  if (!userIds.length) return out;
  const rows = await sql.all<{ user_id: string; slot: ItemSlot } & Omit<ItemInstance, "id">>(
    `SELECT e.user_id, e.slot, i.def, i.color, i.color2, i.blemish, i.seed FROM equipped_items e JOIN items i ON i.id = e.item_id AND i.user_id = e.user_id
     WHERE e.user_id IN (${userIds.map(() => "?").join(", ")})`,
    ...userIds,
  );
  for (const r of rows) {
    if (itemDef(r.def)?.slot !== r.slot) continue;
    const look = out.get(r.user_id) ?? {};
    look[r.slot] = { def: r.def, color: r.color, blemish: r.blemish, seed: r.seed, ...(r.color2 ? { color2: r.color2 } : {}) };
    out.set(r.user_id, look);
  }
  for (const id of userIds.filter((id) => admins.has(id))) {
    const look = (await lockerState(sql, id, true)).look;
    if (Object.keys(look).length) out.set(id, look);
    else out.delete(id);
  }
  return out;
}

/**
 * Opens a crate (free and unlimited while testing). `force` only works while testing. `admin`: as lockerState's. One ledger op (the
 * item in), keyed by the app's request id for the open (`open:<ledger id>:<request>`): a retry of it opens nothing more and answers
 * the first open's item. (An older app's open, with none: a fresh key, as each tap was an open.)
 */
export async function openCrate(
  sql: Sql,
  userId: string,
  crateId: unknown,
  force: { fischer?: boolean; shiny?: boolean },
  now: number,
  admin = false,
  request: string | null = null,
): Promise<{ ok: true; roll: CrateRoll; item: ItemInstance; locker: LockerState } | { ok: false; message: string }> {
  const crate = typeof crateId === "string" ? crateDef(crateId) : undefined;
  if (!crate) return { ok: false, message: "No such crate." };
  if (!CRATES_FREE) return { ok: false, message: "You need a crate and a key." };
  const me = await ledgerAccount(sql, userId);
  if (!me) return { ok: false, message: "No such crate." };
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  const roll = rollCrate(mulberry32(seed), crate, CRATES_FREE ? force : {});
  const id = [...crypto.getRandomValues(new Uint8Array(9))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const op = request ? keyFor(opKeys.request("open", request), me) : `open:${id}`;
  const done = await applyOp(sql, me, { id: op, reason: "crate open", now, legs: [leg.item(userId, { ...roll, id }, crate.id, now)] });
  // Every attempt answers the item as stored (this one's, or on a replay the first's), never its own roll, so every answer to one
  // request is the same whichever attempt applied it.
  const opened = done === "refused" ? null : await openedItem(sql, userId, op);
  if (!opened) return { ok: false, message: "No such crate." };
  return { ok: true, ...opened, locker: await lockerState(sql, userId, admin) };
}

/** The item an open (op `opId`) put in your locker, as stored: every attempt at the open answers this. Null: none, or gone since. */
export async function openedItem(sql: Sql, userId: string, opId: string): Promise<{ roll: CrateRoll; item: ItemInstance } | null> {
  const r = await sql.first<ItemInstance & { fischer: number }>(
    `SELECT i.id, i.def, i.color, i.color2, i.blemish, i.seed, i.fischer FROM ledger l JOIN items i ON i.id = l.asset_id AND i.user_id = ?
     WHERE l.op_id = ? AND l.asset_kind = 'item' AND l.delta > 0 LIMIT 1`,
    userId,
    opId,
  );
  if (!r) return null;
  const look = { def: r.def, color: r.color, ...(r.color2 ? { color2: r.color2 } : {}), blemish: r.blemish, seed: r.seed };
  return { roll: { fischer: r.fischer === 1, ...look }, item: { id: r.id, ...look } };
}

/**
 * Equips an item you own in its slot (one of ITEM_SLOTS: a ride's too, since Oct 31), or (item null) empties the slot.
 * `admin`: as lockerState's, so an admin copy (one in their locker, read as it is now) can be worn; what's stored is only which
 * item is worn in the slot, as for any item.
 */
export async function equipLocker(sql: Sql, userId: string, slot: unknown, itemId: unknown, admin = false): Promise<{ ok: true; locker: LockerState } | { ok: false; message: string }> {
  if (!ITEM_SLOTS.includes(slot as ItemSlot)) return { ok: false, message: "No such slot." };
  if (itemId === null) {
    await sql.run("DELETE FROM equipped_items WHERE user_id = ? AND slot = ?", userId, slot);
    return { ok: true, locker: await lockerState(sql, userId, admin) };
  }
  // An admin copy: an admin's only, and only one in their locker now (none of an item they really own). Any other id: a
  // stored item of theirs.
  const it = isAdminCopy(itemId)
    ? admin && (await lockerState(sql, userId, true)).items.find((i) => i.id === itemId)
    : typeof itemId === "string" && (await sql.first<{ def: string }>("SELECT def FROM items WHERE id = ? AND user_id = ?", itemId, userId));
  if (!it) return { ok: false, message: "That isn't yours." };
  if (itemDef(it.def)?.slot !== slot) return { ok: false, message: "That doesn't go there." };
  await sql.run("INSERT INTO equipped_items (user_id, slot, item_id) VALUES (?, ?, ?) ON CONFLICT (user_id, slot) DO UPDATE SET item_id = excluded.item_id", userId, slot, itemId);
  return { ok: true, locker: await lockerState(sql, userId, admin) };
}

/**
 * Deletes crate items you own, for good (the locker's hold-to-delete, after a confirmation). Taken off first if worn.
 * Ids that aren't yours are ignored, and so are admin copies (never stored, so nothing to delete: one stays worn).
 * `admin`: as lockerState's, for the locker it answers with. Each deletion is a ledger op (`delete:<item id>`), all in one batch
 * (ledger.ts, deleteItems), so a second tap deletes nothing more.
 */
export async function deleteLockerItems(
  sql: Sql,
  userId: string,
  itemIds: unknown,
  admin = false,
  now = Date.now(),
): Promise<{ ok: true; locker: LockerState } | { ok: false; message: string }> {
  if (!Array.isArray(itemIds) || itemIds.length === 0 || itemIds.length > 500 || !itemIds.every((id) => typeof id === "string")) {
    return { ok: false, message: "No such items." };
  }
  const ids = (itemIds as string[]).filter((id) => !isAdminCopy(id));
  const me = ids.length ? await ledgerAccount(sql, userId) : null;
  if (me) await deleteItems(sql, me, ids, now);
  return { ok: true, locker: await lockerState(sql, userId, admin) };
}

/**
 * A guest's choices join the account they sign in to (the account's own choices win): the statements, for the sign-in's one batch.
 * (Its crate items move with their ledger legs: ledger.ts, mergeMoves.)
 */
export const lockerMoves = (from: string, to: string): Stmt[] => [
  { sql: "INSERT OR IGNORE INTO equipped_items (user_id, slot, item_id) SELECT ?, slot, item_id FROM equipped_items WHERE user_id = ?", params: [to, from] },
  { sql: "DELETE FROM equipped_items WHERE user_id = ?", params: [from] },
];
