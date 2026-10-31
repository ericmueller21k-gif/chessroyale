import { ITEM_DEFS, itemDef, type ItemDef, type ItemInstance } from "./crates.ts";
import { SHOP_ITEMS, wornFromLocker } from "./shop.ts";

/**
 * Admins own one of every item (Eric, Oct 31, 2026: "Just give me one of everything… do that for everything we build
 * moving forward"): every crate item, whatever its slot, and every shop cosmetic worn from the locker (God King effects),
 * now and whatever is added to those lists later. These admin copies are never stored: the server adds them where it
 * builds an admin's locker and shop and where it checks what they wear, so an account that stops being an admin loses
 * them all at once. One only fills a gap: an item the admin really owns (any copy of it) gets no admin copy. Cosmetic
 * only: nothing that changes a match is in these lists (the Squads match shop is its own thing). Nothing but wearing
 * takes an admin copy: deleting ignores one, and anything else that takes items (selling, trading, …) reads the stored
 * items, where an admin copy never is. docs/decisions/2026-10-31-admin-owns-all.md.
 */

/** An admin copy's id: this, then the item's id. A stored item's id never has a colon (crates give hex). */
export const ADMIN_COPY_PREFIX = "admin:";

/** Whether an id is an admin copy's (never a stored item's). */
export const isAdminCopy = (id: unknown): id is string => typeof id === "string" && id.startsWith(ADMIN_COPY_PREFIX);

/** The item an admin copy's id names (undefined: not an admin copy's id, or no such item). */
export const adminCopyDef = (id: unknown): ItemDef | undefined => (isAdminCopy(id) ? itemDef(id.slice(ADMIN_COPY_PREFIX.length)) : undefined);

/**
 * Every admin copy's roll, the same each time: the fitting sheet's colors (red; emerald for an item's second color),
 * 100% purity (shiny, as everything at 90% and up is) and a fixed seed.
 */
export const ADMIN_ROLL = { color: "red", color2: "emerald", blemish: 0, seed: 1 } as const;

/** An admin's copy of an item. */
export function adminCopy(def: ItemDef): ItemInstance {
  return {
    id: ADMIN_COPY_PREFIX + def.id,
    def: def.id,
    color: ADMIN_ROLL.color,
    ...(def.colors === 2 ? { color2: ADMIN_ROLL.color2 } : {}),
    blemish: ADMIN_ROLL.blemish,
    seed: ADMIN_ROLL.seed,
  };
}

/** The admin copies a locker gets: one of each crate item that isn't among `owned` (what the admin really owns). */
export function adminCopies(owned: readonly Pick<ItemInstance, "def">[]): ItemInstance[] {
  const have = new Set(owned.map((i) => i.def));
  return ITEM_DEFS.filter((d) => !have.has(d.id)).map(adminCopy);
}

/** The shop cosmetics an admin gets: each one worn from the locker (God King effects) that isn't among `owned`. */
export function adminShopCopies(owned: readonly string[]): string[] {
  return SHOP_ITEMS.filter((i) => wornFromLocker(i) && !owned.includes(i.id)).map((i) => i.id);
}
