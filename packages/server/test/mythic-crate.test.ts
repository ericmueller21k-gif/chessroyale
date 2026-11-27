import { describe, expect, it } from "vitest";
import { MYTHIC_CRATE, mulberry32, ownsOutfit, rollCrate, stackItems } from "@chessroyale/core";
import { createGuest, ensureSchema } from "../src/accounts.ts";
import { grantTestItems } from "../src/boss-tokens.ts";
import { ledgerMismatches } from "../src/ledger.ts";
import { lockerState, openCrate } from "../src/locker.ts";
import { memoryDb, stockCrates } from "./memory-db.ts";

/**
 * The Mythic Crate (Eric, Nov 10: "that one secret crate... the super secret item is the banana suit"; Nov 27): held and opened on
 * the server like a series crate (one of it and a crate key), every opening a Transcendent spin, the Banana Suit its secret prize.
 */
const T0 = 1_000_000;
const memorySql = () => memoryDb().sql;
/** A seed whose first roll of the Mythic Crate is the Banana Suit. */
const suitSeed = (() => {
  for (let s = 0; ; s++) if (rollCrate(mulberry32(s), MYTHIC_CRATE).def === "banana-suit") return s;
})();

describe("the Mythic Crate on the server", () => {
  it("opens with one held and a key: a Transcendent item from its list; none held, refused and nothing changes", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const { user } = await createGuest(sql, T0, "Guest");
    expect(await openCrate(sql, user.id, "mythic", {}, T0)).toEqual({ ok: false, message: "You need a Mythic Crate and a crate key to open it." });
    await stockCrates(sql, user.id, "mythic", 20);
    for (let i = 0; i < 20; i++) {
      const r = await openCrate(sql, user.id, "mythic", {}, T0 + i, false, null, { bonus: "off", rng: mulberry32(i) });
      if (!r.ok) throw new Error(r.message);
      expect(r.roll.fischer).toBe(true);
      expect(MYTHIC_CRATE.items).toContain(r.item.def);
    }
    const locker = await lockerState(sql, user.id);
    expect(locker.items).toHaveLength(20);
    expect(locker.seriesCrates.mythic ?? 0).toBe(0);
    expect(locker.keys).toBe(0);
    expect((await openCrate(sql, user.id, "mythic", {}, T0 + 30)).ok).toBe(false);
    expect(await ledgerMismatches(sql, user.id)).toEqual([]);
  });

  it("the Banana Suit as its prize: a second one is kept as any duplicate (its own item, stacked), and opens the Outfit tab", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const { user } = await createGuest(sql, T0, "Guest");
    await stockCrates(sql, user.id, "mythic", 2);
    for (const t of [1, 2]) {
      const r = await openCrate(sql, user.id, "mythic", {}, T0 + t, false, null, { bonus: "off", rng: mulberry32(suitSeed) });
      if (!r.ok) throw new Error(r.message);
      expect(r.item.def).toBe("banana-suit");
    }
    const { items } = await lockerState(sql, user.id);
    expect(items.map((i) => i.def)).toEqual(["banana-suit", "banana-suit"]);
    expect(new Set(items.map((i) => i.id)).size).toBe(2);
    expect(stackItems(items).map((s) => s.items.length)).toEqual([2]);
    expect(ownsOutfit(items)).toBe(true);
  });

  it("admins' test grants give Mythic Crates, held as a series crate", async () => {
    const sql = memorySql();
    await ensureSchema(sql);
    const { user } = await createGuest(sql, T0, "Admin");
    expect(await grantTestItems(sql, user.id, { crate: "mythic", crates: 2, keys: 2 }, T0)).toEqual({ ok: true });
    const locker = await lockerState(sql, user.id);
    expect(locker.seriesCrates.mythic).toBe(2);
    expect(locker.keys).toBe(2);
  });
});
