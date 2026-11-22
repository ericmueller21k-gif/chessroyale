# The level-up reward card, and the inventory as a layer (Nov 22, 2026)

**Eric (Nov 22), on the end screen's crate toast:** "more in the ... UI scheme of like what it normally looks like when you open a crate
... more in the center of the screens, and it should pop more ... an OK, or ... go to inventory ... if you were doing the battle tower
with like 4 people, then I guess you can't really save. So I guess maybe in the battle tower we don't, or like if you're in a party ...
I'm not sure how we handle that." On the mockup: "the mockup looks good"; and: "is there a way to make it so you can go to your inventory
while you're in a party ... How do we make it so people don't have to like leave the town if they want to go to their inventory? How
complicated is that?"

**The answer (the director's, built here):** the inventory opens as a **layer** over whatever you're on, not by going to the shop's page,
so nothing underneath unmounts: you stay in the tower run, the party, the town. So "Go to inventory" is never greyed (the mockup's
"After your run" / "After the party" rule is gone).

- **The card** (`components/RewardBox.tsx`): the approved mockup. Centered, the crate screens' blue window, popping in as a crate's
  reveal, the crate and key at 96 px with their counts, the lines, "Already in your inventory.", then **OK** (Escape, a tap outside)
  and **Go to inventory**. It waits for you (it was a toast that took no taps and went by itself).
- **The layer** (`components/InventoryLayer.tsx`): the shop screen itself (`ShopScreen initial="crates"`, not a copy), full window, in a
  portal on the body. Calls made:
  - **Back:** its Back button, Escape and the phone's back gesture close it. It pushes one history step (carrying the step under it, so
    the town's `townStep` still reads); a pop closes it, a close by button goes back over its own step, and App.tsx's one popstate
    listener asks `inventoryTakesPop()` first so the town's "leave town?" never sees those pops. The page never navigates.
  - **Keys:** a capture-phase guard stops every key from reaching the screen under it (the town's walk, a match's history arrows and
    their Escapes). The three pop-ups that can open inside it (the locker's delete, the gambling warning, the shop's note) now take their
    own Escape in the capture phase and stop it, so one Escape closes only the top thing.
  - **Who owns it:** the card that opened it. If the screen underneath moves on (a party's floor, a match beginning), that screen's card
    unmounts and the layer with it; its step is taken back. Nothing is lost: the prizes were in the inventory already.
  - **Only from the card for now.** Nothing else opens the layer yet; it's one component, so a town or party "Inventory" button later is
    a one-liner.
