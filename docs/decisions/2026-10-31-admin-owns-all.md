# Admins own one of every item (Oct 31, 2026)

Eric (Oct 31): "add those to my admin account inventory… do that for everything we build moving forward. Just give me one
of everything… flip that switch and push it live." He tests on several devices, signed in with different admin emails.
Area: [shop.md](../areas/shop.md).

- **What:** every account `isAdmin` passes (`ADMIN_EMAILS`) owns one of every crate item (`ITEM_DEFS`, every slot) and
  every shop cosmetic worn from the locker (`wornFromLocker`: the God King effects), now and whatever is added to those
  lists later (`packages/core/src/admin-copies.ts`).
- **Never stored.** The server adds these admin copies where it builds the locker and the shop (`lockerState`,
  `shopState`), where it checks ownership (`equipLocker`, `equipItem`) and where it shows what someone wears
  (`publicProfile`, `rankedSummary` → `looksOf`, `duelEntrant`). The one thing written is which item a slot wears
  (`equipped_items`, `equipped`), as for any item. With admin off it points at nothing: the slot reads empty and the God
  King goes back to Holy Light.
- **Only the gaps.** An item the admin really owns (any copy) gets no admin copy; real items stay as they are. If they
  wore the copy of an item they then really get, the purest real one shows in that slot (read only: the stored slot
  still names the copy).
- **Nothing real comes of one.** Its id is `admin:<item>` (a stored item's id is hex). Deleting ignores it; buying goes by
  what's really owned (an admin copy neither stops nor pays for a real one). Selling, trading, gifting and listing don't
  exist yet; anything like them reads the stored items, where an admin copy never is. Every count leaves it out, and so
  does Download my data, except the id a worn slot names (`admin:<item>` in the locker's equipped list, a God King
  effect's id in the shop's).
- **Calls made:**
  - The roll: red (emerald for a second color: the fitting sheet's defaults), 100% purity, seed 1. The brief said 100%
    and not shiny, but the game makes 90% and up shiny, and changing that means changing how items are drawn, which this
    change mustn't touch. Kept 100% (the item as drawn, no blotches), so it shows shiny.
  - Chat packs are left out. They aren't worn, and owning one changes what you can say to others in a match (the lobby
    and the global chat check it on the server). Easy to add if Eric wants them.
  - The "Admin" tag sits top right on the locker card (crate items and God King effects). Holding an admin copy does
    nothing (no delete dialog).
  - Nothing with a gameplay effect: the Squads match shop is its own list and isn't touched.
- **A new catalog** outside `ITEM_DEFS` and the shop (rides, if they come as their own list) needs its line in
  `admin-copies.ts`.
