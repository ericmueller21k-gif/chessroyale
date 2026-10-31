import { CRATES_FREE, adminCopies, adminCopyDef, crateDef, isAdminCopy, itemDef, mulberry32, rollCrate, type CrateRoll, type ItemInstance, type ItemLook, type ItemSlot } from "@chessroyale/core";
import type { Sql, Stmt } from "./accounts.ts";

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
  /** Crates and keys you have (null: unlimited, while testing). */
  crates: number | null;
  keys: number | null;
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
  return { items, equipped, look, crates: earned, keys: CRATES_FREE ? null : 0 };
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

/** Opens a crate (free and unlimited while testing). `force` only works while testing. `admin`: as lockerState's. */
export async function openCrate(
  sql: Sql,
  userId: string,
  crateId: unknown,
  force: { fischer?: boolean; shiny?: boolean },
  now: number,
  admin = false,
): Promise<{ ok: true; roll: CrateRoll; item: ItemInstance; locker: LockerState } | { ok: false; message: string }> {
  const crate = typeof crateId === "string" ? crateDef(crateId) : undefined;
  if (!crate) return { ok: false, message: "No such crate." };
  if (!CRATES_FREE) return { ok: false, message: "You need a crate and a key." };
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  const roll = rollCrate(mulberry32(seed), crate, CRATES_FREE ? force : {});
  const id = [...crypto.getRandomValues(new Uint8Array(9))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await sql.run(
    "INSERT INTO items (id, user_id, def, color, color2, blemish, seed, crate, fischer, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id,
    userId,
    roll.def,
    roll.color,
    roll.color2 ?? null,
    roll.blemish,
    roll.seed,
    crate.id,
    roll.fischer ? 1 : 0,
    now,
  );
  return { ok: true, roll, item: { id, def: roll.def, color: roll.color, ...(roll.color2 ? { color2: roll.color2 } : {}), blemish: roll.blemish, seed: roll.seed }, locker: await lockerState(sql, userId, admin) };
}

/**
 * Equips an item you own in its slot, or (item null) empties the slot. `admin`: as lockerState's, so an admin copy (one
 * in their locker, read as it is now) can be worn; what's stored is only which item is worn in the slot, as for any item.
 */
export async function equipLocker(sql: Sql, userId: string, slot: unknown, itemId: unknown, admin = false): Promise<{ ok: true; locker: LockerState } | { ok: false; message: string }> {
  if (slot !== "head" && slot !== "face" && slot !== "skin" && slot !== "weapon") return { ok: false, message: "No such slot." };
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
 * `admin`: as lockerState's, for the locker it answers with.
 */
export async function deleteLockerItems(sql: Sql, userId: string, itemIds: unknown, admin = false): Promise<{ ok: true; locker: LockerState } | { ok: false; message: string }> {
  if (!Array.isArray(itemIds) || itemIds.length === 0 || itemIds.length > 500 || !itemIds.every((id) => typeof id === "string")) {
    return { ok: false, message: "No such items." };
  }
  for (const id of (itemIds as string[]).filter((id) => !isAdminCopy(id))) {
    await sql.run("DELETE FROM equipped_items WHERE user_id = ? AND item_id = ?", userId, id);
    await sql.run("DELETE FROM items WHERE user_id = ? AND id = ?", userId, id);
  }
  return { ok: true, locker: await lockerState(sql, userId, admin) };
}

/**
 * A guest's crate items and choices join the account they sign in to (the account's own choices win): the statements,
 * for the sign-in's one batch.
 */
export const lockerMoves = (from: string, to: string): Stmt[] => [
  { sql: "UPDATE items SET user_id = ? WHERE user_id = ?", params: [to, from] },
  { sql: "INSERT OR IGNORE INTO equipped_items (user_id, slot, item_id) SELECT ?, slot, item_id FROM equipped_items WHERE user_id = ?", params: [to, from] },
  { sql: "DELETE FROM equipped_items WHERE user_id = ?", params: [from] },
];
