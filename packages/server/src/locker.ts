import { CRATES_FREE, ITEM_SLOTS, crateDef, itemDef, mulberry32, rollCrate, type CrateRoll, type ItemInstance, type ItemLook, type ItemSlot } from "@chessroyale/core";
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

export interface LockerState {
  items: ItemInstance[];
  equipped: Partial<Record<ItemSlot, string>>;
  /** What you wear, ready to show (and to send to a lobby). */
  look: ItemLook;
  /** Crates and keys you have (null: unlimited, while testing). */
  crates: number | null;
  keys: number | null;
}

export async function lockerState(sql: Sql, userId: string): Promise<LockerState> {
  const items = await sql.all<ItemInstance>("SELECT id, def, color, color2, blemish, seed FROM items WHERE user_id = ? ORDER BY created_at DESC", userId);
  const rows = await sql.all<{ slot: ItemSlot; item_id: string }>("SELECT slot, item_id FROM equipped_items WHERE user_id = ?", userId);
  const equipped: LockerState["equipped"] = {};
  const look: ItemLook = {};
  for (const r of rows) {
    const it = items.find((i) => i.id === r.item_id);
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
 * items. A player with nothing on (or no such player) is missing from the map.
 */
export async function looksOf(sql: Sql, userIds: readonly string[]): Promise<Map<string, ItemLook>> {
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
  return out;
}

/** Opens a crate (free and unlimited while testing). `force` only works while testing. */
export async function openCrate(
  sql: Sql,
  userId: string,
  crateId: unknown,
  force: { fischer?: boolean; shiny?: boolean },
  now: number,
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
  return { ok: true, roll, item: { id, def: roll.def, color: roll.color, ...(roll.color2 ? { color2: roll.color2 } : {}), blemish: roll.blemish, seed: roll.seed }, locker: await lockerState(sql, userId) };
}

/** Equips an item you own in its slot (one of ITEM_SLOTS: a ride's too, since Oct 31), or (item null) empties the slot. */
export async function equipLocker(sql: Sql, userId: string, slot: unknown, itemId: unknown): Promise<{ ok: true; locker: LockerState } | { ok: false; message: string }> {
  if (!ITEM_SLOTS.includes(slot as ItemSlot)) return { ok: false, message: "No such slot." };
  if (itemId === null) {
    await sql.run("DELETE FROM equipped_items WHERE user_id = ? AND slot = ?", userId, slot);
    return { ok: true, locker: await lockerState(sql, userId) };
  }
  const it = typeof itemId === "string" ? await sql.first<{ def: string }>("SELECT def FROM items WHERE id = ? AND user_id = ?", itemId, userId) : null;
  if (!it) return { ok: false, message: "That isn't yours." };
  if (itemDef(it.def)?.slot !== slot) return { ok: false, message: "That doesn't go there." };
  await sql.run("INSERT INTO equipped_items (user_id, slot, item_id) VALUES (?, ?, ?) ON CONFLICT (user_id, slot) DO UPDATE SET item_id = excluded.item_id", userId, slot, itemId);
  return { ok: true, locker: await lockerState(sql, userId) };
}

/**
 * Deletes crate items you own, for good (the locker's hold-to-delete, after a confirmation). Taken off first if worn.
 * Ids that aren't yours are ignored.
 */
export async function deleteLockerItems(sql: Sql, userId: string, itemIds: unknown): Promise<{ ok: true; locker: LockerState } | { ok: false; message: string }> {
  if (!Array.isArray(itemIds) || itemIds.length === 0 || itemIds.length > 500 || !itemIds.every((id) => typeof id === "string")) {
    return { ok: false, message: "No such items." };
  }
  for (const id of itemIds as string[]) {
    await sql.run("DELETE FROM equipped_items WHERE user_id = ? AND item_id = ?", userId, id);
    await sql.run("DELETE FROM items WHERE user_id = ? AND id = ?", userId, id);
  }
  return { ok: true, locker: await lockerState(sql, userId) };
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
