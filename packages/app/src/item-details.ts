import { SLOT_NAMES, WELCOME_TEXT, isShiny, itemColor, purity, secondColor, showsPurity, type ItemSlot } from "@chessroyale/core";

/**
 * A worn item's details on a profile's Wearing row (ProfileParts.tsx): its slot, its color (both, for a two-color item), its purity
 * and "Shiny" at 90%+. A HunChess ride (the Welcome Crate's, Nov 6) lists no purity and no shine (Eric: "Purity isn't listed for
 * these"): its slot, "HunChess gold & black" and "Not tradeable". Pure, so a test reads it.
 */
export function wornDetails(slot: ItemSlot, it: { def: string; color: string; color2?: string | null; blemish: number; seed: number }): string[] {
  if (!showsPurity(it.def)) return [SLOT_NAMES[slot], "HunChess gold & black", WELCOME_TEXT.notTradeable];
  const c = itemColor(it.color);
  const second = secondColor(it);
  const c2 = second ? itemColor(second) : null;
  return [SLOT_NAMES[slot], c2 ? `${c.name} & ${c2.name}` : c.name, `${purity(it.blemish)}% pure`, ...(isShiny(it.blemish) ? ["Shiny"] : [])];
}
